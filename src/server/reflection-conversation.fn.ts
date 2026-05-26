/**
 * Reflection Conversation Server Functions
 * Handles AI conversation for 10-minute reflection sessions
 * Similar to conversation.fn.ts but with reflection-specific prompts and no image generation
 */

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { prisma } from '../db'
import {
  buildReflectionContext,
  buildReflectionSystemPrompt,
  getRandomReflectionGreeting,
} from '../lib/prompts/reflection'
import {
  buildSummaryMessages,
  buildTranslationMessages,
  formatTranscriptForSummary,
} from '../lib/prompts/summary'
import { authMiddleware } from './middleware'
import { chatCompletion } from './services/openrouter.service'
import { generateImage, generateSpeech } from './services/falai.service'
import { uploadImageFromUrl } from './services/bunny.service'
import { extractInsightsFromSession } from './extraction.internal'
import type { ChatMessage } from './services/openrouter.service'
import type {
  AIPersonality,
  ImageStyle,
  Language,
} from '../types/voice-session'

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
// Background Reflection Image Generation
// ==========================================

/**
 * Generate the reflection image in the background.
 *
 * Runs fire-and-forget after the session is already marked `completed`, so a
 * slow or failed image generation never blocks the user's response or risks
 * losing the summary to a request timeout. The session's `imageStatus` tracks
 * the lifecycle (`generating` -> `ready` | `failed`) so the UI can poll while
 * it works and show a terminal state when it stops.
 *
 * Retries transient failures a couple of times (Fal.ai occasionally returns
 * network/queue errors that succeed on retry).
 */
async function generateReflectionImageInBackground(params: {
  sessionId: string
  userId: string
  summaryText: string
  userLanguage: string
  imageStyle: ImageStyle
}): Promise<void> {
  const { sessionId, userId, summaryText, userLanguage, imageStyle } = params

  try {
    // Translate summary to English for image generation if not already English.
    // Image generation models work best with English prompts.
    let imagePromptText = summaryText
    if (userLanguage !== 'en') {
      try {
        const translationMessages = buildTranslationMessages(summaryText)
        const translatedSummary = await chatCompletion(
          translationMessages as Array<ChatMessage>,
          { maxTokens: 1000 },
        )
        if (translatedSummary) {
          imagePromptText = translatedSummary
        }
      } catch (translationError) {
        console.error(
          '[Reflection Image] Translation failed, using original summary:',
          translationError,
        )
      }
    }

    // Generate the image, retrying transient failures.
    const maxAttempts = 3
    let imageResult: { imageUrl: string } | null = null
    let lastError: unknown = null
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        imageResult = await generateImage(imagePromptText, {
          style: imageStyle,
        })
        break
      } catch (error) {
        lastError = error
        console.error(
          `[Reflection Image] generateImage attempt ${attempt}/${maxAttempts} failed:`,
          error,
        )
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 1000 * attempt))
        }
      }
    }

    if (!imageResult) {
      throw lastError ?? new Error('Image generation failed')
    }

    // Upload to Bunny.net and persist the result.
    const uploadResult = await uploadImageFromUrl(
      userId,
      sessionId,
      imageResult.imageUrl,
    )

    await prisma.reflectionSession.update({
      where: { id: sessionId },
      data: { imageUrl: uploadResult.url, imageStatus: 'ready' },
    })
    console.log(`[Reflection Image] Image ready for session ${sessionId}`)
  } catch (error) {
    console.error(
      `[Reflection Image] Failed to generate image for session ${sessionId}:`,
      error,
    )
    // Mark as failed so the UI stops showing the "generating" state.
    await prisma.reflectionSession
      .update({
        where: { id: sessionId },
        data: { imageStatus: 'failed' },
      })
      .catch((updateError) => {
        console.error(
          `[Reflection Image] Failed to mark image as failed for ${sessionId}:`,
          updateError,
        )
      })
  }
}

// ==========================================
// Process Completed Reflection (summary first, image in background)
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
          imageUrl: null,
          imageStatus: 'none',
        },
      })

      return {
        session: updatedSession,
        summaryText: null,
        imageUrl: null,
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
      summaryText = await chatCompletion(
        summaryMessages as Array<ChatMessage>,
        {
          maxTokens: 1000,
        },
      )
    } catch (error) {
      console.error('Failed to generate reflection summary:', error)
    }

    // Decide whether an image will be generated. We only do so when there is a
    // meaningful summary to base it on.
    const imageStyle = (preferences?.imageStyle as ImageStyle) || 'realistic'
    const willGenerateImage = !!summaryText && summaryText.length > 50

    // Mark the session complete immediately with the summary. The image is
    // generated in the background (see below) so a slow or failed generation
    // never blocks the response or risks losing the summary to a timeout.
    const updatedSession = await prisma.reflectionSession.update({
      where: { id: session.id },
      data: {
        status: 'completed',
        summaryText,
        imageStatus: willGenerateImage ? 'generating' : 'none',
      },
    })

    // Kick off image generation in the background (fire-and-forget).
    if (willGenerateImage && summaryText) {
      void generateReflectionImageInBackground({
        sessionId: session.id,
        userId: context.user.id,
        summaryText,
        userLanguage,
        imageStyle,
      })
    }

    // Extract insights from the completed session (async, non-blocking)
    // This runs after the session is marked complete so the user gets a response quickly
    extractInsightsFromSession(session.id, context.user.id)
      .then((result) => {
        if (result) {
          console.log(
            `[Process Reflection] Extracted insights: mood=${result.mood.primary}, ` +
              `topics=${result.topics.length}, insights=${result.insights.length}, ` +
              `todos=${result.todos.length}, people=${result.people.length}`,
          )
        }
      })
      .catch((error) => {
        console.error('[Process Reflection] Failed to extract insights:', error)
      })

    return {
      session: updatedSession,
      summaryText,
      imageUrl: updatedSession.imageUrl,
      imageStatus: updatedSession.imageStatus,
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
        imageUrl: true,
        imageStatus: true,
      },
    })

    if (!session) {
      throw new Error('Reflection not found')
    }

    return {
      status: session.status,
      isComplete: session.status === 'completed',
      hasSummary: !!session.summaryText,
      hasImage: !!session.imageUrl,
      imageStatus: session.imageStatus,
      // Image work is finished when it's no longer actively generating.
      isImageDone: session.imageStatus !== 'generating',
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
}): Array<ChatMessage> {
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
