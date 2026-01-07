/**
 * Reflection Conversation Server Functions
 * Handles AI conversation for 10-minute reflection sessions
 * Similar to conversation.fn.ts but with reflection-specific prompts and no image generation
 */

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { authMiddleware } from './middleware'
import { prisma } from '../db'
import { chatCompletion, type ChatMessage } from './services/openrouter.service'
import { generateSpeech } from './services/falai.service'
import {
  buildReflectionSystemPrompt,
  getRandomReflectionGreeting,
  buildReflectionContext,
} from '../lib/prompts/reflection'
import type { Language } from '../types/voice-session'
import {
  buildSummaryMessages,
  formatTranscriptForSummary,
} from '../lib/prompts/summary'
import type { AIPersonality } from '../types/voice-session'

// ==========================================
// Schemas
// ==========================================

const processSessionSchema = z.object({
  sessionId: z.string(),
})

const savePreloadedGreetingSchema = z.object({
  sessionId: z.string(),
  text: z.string(),
  audioUrl: z.string().nullable(),
})

// ==========================================
// Pre-Generate Reflection Greeting
// Caches greeting per user per day for reflection sessions
// ==========================================

export const preGenerateReflectionGreetingFn = createServerFn({
  method: 'POST',
})
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const startTime = Date.now()
    const userId = context.user.id

    // Calculate today's date (start of day in UTC)
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)

    // Get user preferences to determine language
    const preferences = await prisma.userPreferences.findUnique({
      where: { userId },
    })
    const language = (preferences?.language || 'en') as Language

    console.log(
      '[PreReflectionGreeting] Checking cache for user:',
      userId,
      'language:',
      language,
    )

    // 1. Lazy cleanup: Delete greetings older than 24 hours
    try {
      const deletedCount = await prisma.dailyReflectionGreeting.deleteMany({
        where: {
          createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      })
      if (deletedCount.count > 0) {
        console.log(
          `[PreReflectionGreeting] Cleaned up ${deletedCount.count} old greetings`,
        )
      }
    } catch (cleanupError) {
      console.warn('[PreReflectionGreeting] Cleanup error:', cleanupError)
    }

    // 2. Check if we already have a cached greeting for today + language
    const existingGreeting = await prisma.dailyReflectionGreeting.findUnique({
      where: {
        userId_date_language: { userId, date: today, language },
      },
    })

    if (existingGreeting && existingGreeting.audioBase64) {
      const latency = Date.now() - startTime
      console.log(
        `[PreReflectionGreeting] Cache HIT (${latency}ms) - returning cached greeting in ${language}`,
      )
      return {
        text: existingGreeting.text,
        audioUrl: null,
        audioBase64: existingGreeting.audioBase64,
        contentType: existingGreeting.contentType,
      }
    }

    // 3. Cache MISS - generate new reflection greeting
    console.log(
      '[PreReflectionGreeting] Cache MISS - generating new greeting in',
      language,
    )

    // Get a random reflection greeting in the user's language
    const greeting = getRandomReflectionGreeting(language)

    // Generate TTS for the greeting
    let audioBase64: string | null = null
    try {
      const ttsResult = await generateSpeech(greeting)

      if (ttsResult.audioUrl && ttsResult.audioUrl.length > 0) {
        const response = await fetch(ttsResult.audioUrl)
        if (response.ok) {
          const audioBuffer = await response.arrayBuffer()
          audioBase64 = Buffer.from(audioBuffer).toString('base64')
        }
      }
    } catch (error) {
      console.error('[PreReflectionGreeting] Failed to generate TTS:', error)
    }

    // 4. Cache the greeting
    if (audioBase64) {
      try {
        await prisma.dailyReflectionGreeting.upsert({
          where: {
            userId_date_language: { userId, date: today, language },
          },
          create: {
            userId,
            date: today,
            language,
            text: greeting,
            audioBase64,
            contentType: 'audio/mpeg',
          },
          update: {
            text: greeting,
            audioBase64,
            contentType: 'audio/mpeg',
          },
        })
        console.log(
          '[PreReflectionGreeting] Cached new greeting for today in',
          language,
        )
      } catch (cacheError) {
        console.warn(
          '[PreReflectionGreeting] Failed to cache greeting:',
          cacheError,
        )
      }
    }

    const latency = Date.now() - startTime
    console.log(
      `[PreReflectionGreeting] Complete (${latency}ms), language: ${language}, audio: ${audioBase64 ? 'yes' : 'no'}`,
    )

    return {
      text: greeting,
      audioUrl: null,
      audioBase64,
      contentType: 'audio/mpeg',
    }
  })

// ==========================================
// Save Pre-Generated Greeting to Reflection Session
// ==========================================

export const savePreloadedReflectionGreetingFn = createServerFn({
  method: 'POST',
})
  .middleware([authMiddleware])
  .inputValidator(savePreloadedGreetingSchema)
  .handler(async ({ data, context }) => {
    console.log('[SaveReflectionGreeting] Saving preloaded greeting to session')

    // Verify session belongs to user
    const session = await prisma.reflectionSession.findFirst({
      where: {
        id: data.sessionId,
        userId: context.user.id,
      },
    })

    if (!session) {
      throw new Error('Reflection not found')
    }

    // Save the greeting as the first turn
    const turn = await prisma.reflectionTurn.create({
      data: {
        sessionId: session.id,
        speaker: 'ai',
        text: data.text,
        audioUrl: null,
        startTime: 0,
        duration: 2,
        order: 0,
      },
    })

    console.log('[SaveReflectionGreeting] Greeting saved as turn:', turn.id)

    return {
      turn,
      audioUrl: null,
    }
  })

// ==========================================
// Process Completed Reflection (Summary only - no image)
// ==========================================

export const processReflectionFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(processSessionSchema)
  .handler(async ({ data, context }) => {
    // Get session with turns
    const session = await prisma.reflectionSession.findFirst({
      where: {
        id: data.sessionId,
        userId: context.user.id,
        status: 'processing',
      },
      include: {
        turns: {
          orderBy: { order: 'asc' },
        },
      },
    })

    if (!session) {
      throw new Error('Reflection not found or not in processing state')
    }

    // Get user preferences for language
    const preferences = await prisma.userPreferences.findUnique({
      where: { userId: context.user.id },
    })
    const userLanguage = preferences?.language || 'en'

    // Check if there are any user turns
    const userTurns = session.turns.filter((t) => t.speaker === 'user')

    // If no user turns or very short session, skip summary
    if (userTurns.length === 0 || session.totalUserSpeakingTime < 10) {
      console.log(
        '[Process Reflection] Skipping summary - no meaningful user input',
      )

      const updatedSession = await prisma.reflectionSession.update({
        where: { id: session.id },
        data: {
          status: 'completed',
          summaryText: null,
        },
      })

      return {
        session: updatedSession,
        summaryText: null,
        skipped: true,
        reason: 'No meaningful user input detected',
      }
    }

    // Format transcript
    const transcript = formatTranscriptForSummary(
      session.turns.map((t) => ({
        speaker: t.speaker as 'user' | 'ai',
        text: t.text,
      })),
    )

    // Generate summary in user's preferred language
    let summaryText: string | null = null
    try {
      const summaryMessages = buildSummaryMessages(transcript, userLanguage)
      summaryText = await chatCompletion(summaryMessages as ChatMessage[], {
        maxTokens: 1000,
      })
    } catch (error) {
      console.error('Failed to generate reflection summary:', error)
    }

    // Update session (no image for reflections)
    const updatedSession = await prisma.reflectionSession.update({
      where: { id: session.id },
      data: {
        status: 'completed',
        summaryText,
      },
    })

    return {
      session: updatedSession,
      summaryText,
    }
  })

// ==========================================
// Get Reflection Processing Status
// ==========================================

export const getReflectionProcessingStatusFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ sessionId: z.string() }))
  .handler(async ({ data, context }) => {
    const session = await prisma.reflectionSession.findFirst({
      where: {
        id: data.sessionId,
        userId: context.user.id,
      },
      select: {
        id: true,
        status: true,
        summaryText: true,
      },
    })

    if (!session) {
      throw new Error('Reflection not found')
    }

    return {
      status: session.status,
      isComplete: session.status === 'completed',
      hasSummary: !!session.summaryText,
    }
  })

// ==========================================
// Build Reflection Conversation Messages
// Helper for streaming endpoint to use reflection prompts
// ==========================================

export function buildReflectionMessages(params: {
  personality: AIPersonality
  userName?: string
  language: Language
  turns: Array<{ speaker: 'user' | 'ai'; text: string }>
  userMessage: string
}): ChatMessage[] {
  const systemPrompt = buildReflectionSystemPrompt(
    params.personality,
    params.userName,
    params.language,
  )

  const conversationHistory = buildReflectionContext(params.turns)

  return [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
    { role: 'user', content: params.userMessage },
  ]
}
