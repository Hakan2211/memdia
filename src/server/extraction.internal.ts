/**
 * Internal Extraction Functions - Server-only
 *
 * These functions are NOT wrapped in createServerFn and should NEVER be
 * imported from client code. They are used internally by server functions
 * and other server-side modules.
 */

import { prisma } from '../db'
import {
  EXTRACTION_SYSTEM_PROMPT,
  buildExtractionPrompt,
  normalizeExtractionResult,
} from '../lib/prompts/extraction'
import {
  OPENROUTER_MODELS,
  chatCompletion,
} from './services/openrouter.service'
import type { ExtractedInsights, Sentiment } from '../types/insights'

// ==========================================
// Helpers
// ==========================================

function sentimentToNumber(sentiment: Sentiment | null): number | null {
  if (!sentiment) return null
  switch (sentiment) {
    case 'positive':
      return 1
    case 'neutral':
      return 0
    case 'negative':
      return -1
    default:
      return null
  }
}

// ==========================================
// Save Extracted Insights to Database
// ==========================================

async function saveExtractedInsights(
  sessionId: string,
  userId: string,
  extracted: ExtractedInsights,
): Promise<void> {
  // Use transaction for atomicity
  await prisma.$transaction(async (tx) => {
    // 1. Save mood (optional — purely intellectual conversations may have none)
    if (extracted.mood) {
      await tx.reflectionMood.upsert({
        where: { sessionId },
        create: {
          sessionId,
          mood: extracted.mood.primary,
          confidence: extracted.mood.confidence,
        },
        update: {
          mood: extracted.mood.primary,
          confidence: extracted.mood.confidence,
        },
      })
    } else {
      await tx.reflectionMood.deleteMany({ where: { sessionId } })
    }

    // 2. Save topics (delete existing first)
    await tx.reflectionTopic.deleteMany({ where: { sessionId } })
    if (extracted.topics.length > 0) {
      await tx.reflectionTopic.createMany({
        data: extracted.topics.map((topic) => ({
          sessionId,
          topic: topic.toLowerCase(),
        })),
      })
    }

    // 3. Save insights (delete existing first)
    await tx.reflectionInsight.deleteMany({ where: { sessionId } })
    if (extracted.insights.length > 0) {
      await tx.reflectionInsight.createMany({
        data: extracted.insights.map((insight) => ({
          sessionId,
          text: insight.text,
          category: insight.category,
        })),
      })
    }

    // 4. Save references: thinkers, books, works, concepts (delete existing first)
    await tx.reflectionReference.deleteMany({ where: { sessionId } })
    if (extracted.references.length > 0) {
      await tx.reflectionReference.createMany({
        data: extracted.references.map((ref) => ({
          sessionId,
          name: ref.name,
          kind: ref.kind,
          note: ref.note,
        })),
      })
    }

    // 5. Save todos
    if (extracted.todos.length > 0) {
      await tx.todo.createMany({
        data: extracted.todos.map((todo) => ({
          userId,
          text: todo.text,
          dueDate: todo.dueDate ? new Date(todo.dueDate) : null,
          priority: todo.priority,
          context: todo.context,
          sourceSessionId: sessionId,
        })),
      })
    }

    // 6. Save people and mentions
    for (const personData of extracted.people) {
      // Upsert person
      const person = await tx.person.upsert({
        where: {
          userId_name: {
            userId,
            name: personData.name,
          },
        },
        create: {
          userId,
          name: personData.name,
          relationship: personData.relationship,
          mentionCount: 1,
          averageSentiment: sentimentToNumber(personData.sentiment),
          lastMentioned: new Date(),
        },
        update: {
          mentionCount: { increment: 1 },
          lastMentioned: new Date(),
          // Update average sentiment
          averageSentiment: personData.sentiment
            ? {
                // Simple moving average approximation
                // (old * count + new) / (count + 1)
                // We'll just set it for now, can improve later
                set: sentimentToNumber(personData.sentiment),
              }
            : undefined,
        },
      })

      // Create mention
      await tx.personMention.upsert({
        where: {
          personId_sessionId: {
            personId: person.id,
            sessionId,
          },
        },
        create: {
          personId: person.id,
          sessionId,
          sentiment: personData.sentiment,
          context: null, // Could extract context in the future
        },
        update: {
          sentiment: personData.sentiment,
        },
      })
    }
  })

  console.log(`[Extraction] Saved insights for session ${sessionId}`)
}

// ==========================================
// Extract Insights from Reflection
// ==========================================

/**
 * Extract insights from a completed reflection session
 * Called during post-processing after summary generation
 */
export async function extractInsightsFromSession(
  sessionId: string,
  userId: string,
): Promise<ExtractedInsights | null> {
  console.log(`[Extraction] Starting extraction for session ${sessionId}`)

  // Fetch session with transcript AND user preferences in parallel
  const [session, preferences] = await Promise.all([
    prisma.reflectionSession.findUnique({
      where: { id: sessionId },
      include: {
        turns: {
          orderBy: { order: 'asc' },
        },
      },
    }),
    prisma.userPreferences.findUnique({
      where: { userId },
    }),
  ])

  // Get user's language preference
  const userLanguage = preferences?.language || 'en'
  console.log(`[Extraction] Using language: ${userLanguage}`)

  if (!session) {
    console.error(`[Extraction] Session ${sessionId} not found`)
    return null
  }

  if (session.userId !== userId) {
    console.error(`[Extraction] User mismatch for session ${sessionId}`)
    return null
  }

  // Build transcript string
  const transcript = session.turns
    .map((turn) => {
      const speaker = turn.speaker === 'user' ? 'You' : 'AI Companion'
      return `${speaker}: ${turn.text}`
    })
    .join('\n\n')

  if (!transcript || transcript.trim().length < 50) {
    console.log(`[Extraction] Transcript too short for session ${sessionId}`)
    return null
  }

  // Call AI for extraction
  const messages = [
    { role: 'system' as const, content: EXTRACTION_SYSTEM_PROMPT },
    {
      role: 'user' as const,
      content: buildExtractionPrompt(
        session.summaryText || '',
        transcript,
        userLanguage,
      ),
    },
  ]

  try {
    const response = await chatCompletion(messages, {
      model: OPENROUTER_MODELS.GEMINI_38_FLASH,
      // max_tokens includes reasoning tokens — leave headroom so the JSON isn't truncated
      maxTokens: 4000,
      reasoningEffort: 'low',
      temperature: 0.3, // Lower temperature for more consistent extraction
    })

    // Parse JSON response
    const cleanedResponse = response
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    let parsed: unknown
    try {
      parsed = JSON.parse(cleanedResponse)
    } catch (parseError) {
      console.error('[Extraction] Failed to parse JSON:', parseError)
      console.error('[Extraction] Raw response:', response)
      return null
    }

    // Validate + normalize (drops malformed items instead of failing outright)
    const extracted = normalizeExtractionResult(parsed)
    if (!extracted) {
      console.error('[Extraction] Invalid extraction result structure')
      return null
    }

    console.log(
      `[Extraction] Successfully extracted: mood=${extracted.mood?.primary ?? 'none'}, ` +
        `topics=${extracted.topics.length}, insights=${extracted.insights.length}, ` +
        `todos=${extracted.todos.length}, people=${extracted.people.length}, ` +
        `references=${extracted.references.length}`,
    )

    // Save to database
    await saveExtractedInsights(sessionId, userId, extracted)

    return extracted
  } catch (error) {
    console.error('[Extraction] AI extraction failed:', error)
    return null
  }
}
