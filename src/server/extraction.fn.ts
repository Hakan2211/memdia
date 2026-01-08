/**
 * Extraction Service
 * Extracts structured insights from reflection transcripts using AI
 */

import { createServerFn } from '@tanstack/react-start'
import { prisma } from '../db'
import { authMiddleware } from './middleware'
import {
  chatCompletion,
  OPENROUTER_MODELS,
} from './services/openrouter.service'
import {
  EXTRACTION_SYSTEM_PROMPT,
  buildExtractionPrompt,
  isValidExtractionResult,
} from '../lib/prompts/extraction'
import type { ExtractedInsights, Sentiment } from '../types/insights'

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

  // Fetch session with transcript
  const session = await prisma.reflectionSession.findUnique({
    where: { id: sessionId },
    include: {
      turns: {
        orderBy: { order: 'asc' },
      },
    },
  })

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
      content: buildExtractionPrompt(session.summaryText || '', transcript),
    },
  ]

  try {
    const response = await chatCompletion(messages, {
      model: OPENROUTER_MODELS.GEMINI_3_FLASH,
      maxTokens: 2000,
      temperature: 0.3, // Lower temperature for more consistent extraction
    })

    // Parse JSON response
    const cleanedResponse = response
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    let extracted: ExtractedInsights
    try {
      extracted = JSON.parse(cleanedResponse)
    } catch (parseError) {
      console.error('[Extraction] Failed to parse JSON:', parseError)
      console.error('[Extraction] Raw response:', response)
      return null
    }

    // Validate structure
    if (!isValidExtractionResult(extracted)) {
      console.error('[Extraction] Invalid extraction result structure')
      return null
    }

    console.log(
      `[Extraction] Successfully extracted: mood=${extracted.mood.primary}, ` +
        `topics=${extracted.topics.length}, insights=${extracted.insights.length}, ` +
        `todos=${extracted.todos.length}, people=${extracted.people.length}`,
    )

    // Save to database
    await saveExtractedInsights(sessionId, userId, extracted)

    return extracted
  } catch (error) {
    console.error('[Extraction] AI extraction failed:', error)
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
    // 1. Save mood
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

    // 4. Save todos
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

    // 5. Save people and mentions
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
// Server Functions (for manual re-extraction)
// ==========================================

// Schemas for input validation
import { z } from 'zod'

const sessionIdSchema = z.object({ sessionId: z.string() })

/**
 * Manually trigger extraction for a session
 * Useful for re-processing or debugging
 */
export const reExtractInsightsFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(sessionIdSchema)
  .handler(async ({ data, context }) => {
    const userId = context.user.id

    // Verify ownership
    const session = await prisma.reflectionSession.findUnique({
      where: { id: data.sessionId },
    })

    if (!session || session.userId !== userId) {
      throw new Error('Session not found')
    }

    if (session.status !== 'completed') {
      throw new Error('Session must be completed before extraction')
    }

    const result = await extractInsightsFromSession(data.sessionId, userId)
    return { success: !!result }
  })

/**
 * Get extracted insights for a session
 */
export const getSessionInsightsFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(sessionIdSchema)
  .handler(async ({ data, context }) => {
    const userId = context.user.id

    const session = await prisma.reflectionSession.findUnique({
      where: { id: data.sessionId },
      include: {
        mood: true,
        topics: true,
        insights: true,
        personMentions: {
          include: {
            person: true,
          },
        },
      },
    })

    if (!session || session.userId !== userId) {
      return null
    }

    // Get todos linked to this session
    const todos = await prisma.todo.findMany({
      where: {
        sourceSessionId: data.sessionId,
        userId,
      },
    })

    return {
      mood: session.mood,
      topics: session.topics,
      insights: session.insights,
      people: session.personMentions.map((m) => ({
        ...m.person,
        sentiment: m.sentiment,
        mentionContext: m.context,
      })),
      todos,
    }
  })
