/**
 * Conversation Server Functions
 * Handles AI conversation with SSE streaming
 */

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { authMiddleware } from './middleware'
import { prisma } from '../db'
import { chatCompletion, type ChatMessage } from './services/openrouter.service'
import { generateSpeech } from './services/falai.service'
import { generateImage } from './services/falai.service'
import { uploadImageFromUrl } from './services/bunny.service'
import {
  buildConversationSystemPrompt,
  buildConversationContext,
  getRandomGreeting,
} from '../lib/prompts/conversation'
import {
  buildSummaryMessages,
  formatTranscriptForSummary,
} from '../lib/prompts/summary'
import { buildImagePrompt } from '../lib/prompts/image'
import type { AIPersonality, ImageStyle } from '../types/voice-session'

// ==========================================
// Schemas
// ==========================================

const conversationSchema = z.object({
  sessionId: z.string(),
  userMessage: z.string(),
  userAudioBase64: z.string().optional(), // Base64 encoded user audio (WebM/PCM)
  userAudioContentType: z.string().optional(), // e.g., 'audio/webm' or 'audio/pcm'
})

const generateGreetingSchema = z.object({
  sessionId: z.string(),
})

const processSessionSchema = z.object({
  sessionId: z.string(),
})

const savePreloadedGreetingSchema = z.object({
  sessionId: z.string(),
  text: z.string(),
  audioUrl: z.string().nullable(),
})

// ==========================================
// Pre-Generate AI Greeting (Before Session Starts)
// Caches greeting per user per day to avoid repeated TTS API calls
// ==========================================

export const preGenerateGreetingFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const startTime = Date.now()
    const userId = context.user.id

    // Calculate today's date (start of day in UTC)
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)

    console.log('[PreGreeting] Checking cache for user:', userId)

    // 1. Lazy cleanup: Delete greetings older than 24 hours
    try {
      const deletedCount = await prisma.dailyGreeting.deleteMany({
        where: {
          createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      })
      if (deletedCount.count > 0) {
        console.log(
          `[PreGreeting] Cleaned up ${deletedCount.count} old greetings`,
        )
      }
    } catch (cleanupError) {
      // Non-critical, just log
      console.warn('[PreGreeting] Cleanup error:', cleanupError)
    }

    // 2. Check if we already have a cached greeting for today
    const existingGreeting = await prisma.dailyGreeting.findUnique({
      where: {
        userId_date: { userId, date: today },
      },
    })

    if (existingGreeting && existingGreeting.audioBase64) {
      const latency = Date.now() - startTime
      console.log(
        `[PreGreeting] Cache HIT (${latency}ms) - returning cached greeting`,
      )
      return {
        text: existingGreeting.text,
        audioUrl: null, // We only cache base64, URLs expire
        audioBase64: existingGreeting.audioBase64,
        contentType: existingGreeting.contentType,
      }
    }

    // 3. Cache MISS - generate new greeting
    console.log('[PreGreeting] Cache MISS - generating new greeting')

    // Get user preferences (optional - for future personality customization)
    const preferences = await prisma.userPreferences.findUnique({
      where: { userId },
    })

    // personality is stored for potential future use
    void (preferences?.aiPersonality || 'empathetic')

    // Get a random greeting
    const greeting = getRandomGreeting()

    // Generate TTS for the greeting
    let audioBase64: string | null = null
    try {
      const ttsResult = await generateSpeech(greeting)

      // Fetch the audio and convert to base64 for immediate playback
      if (ttsResult.audioUrl && ttsResult.audioUrl.length > 0) {
        const response = await fetch(ttsResult.audioUrl)
        if (response.ok) {
          const audioBuffer = await response.arrayBuffer()
          // Convert to base64 for immediate playback and caching
          audioBase64 = Buffer.from(audioBuffer).toString('base64')
        }
      }
    } catch (error) {
      console.error('[PreGreeting] Failed to generate TTS:', error)
      // Continue without audio
    }

    // 4. Cache the greeting for subsequent visits today
    if (audioBase64) {
      try {
        await prisma.dailyGreeting.upsert({
          where: {
            userId_date: { userId, date: today },
          },
          create: {
            userId,
            date: today,
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
        console.log('[PreGreeting] Cached new greeting for today')
      } catch (cacheError) {
        // Non-critical - greeting still works, just won't be cached
        console.warn('[PreGreeting] Failed to cache greeting:', cacheError)
      }
    }

    const latency = Date.now() - startTime
    console.log(
      `[PreGreeting] Complete (${latency}ms), audio: ${audioBase64 ? 'yes' : 'no'}`,
    )

    return {
      text: greeting,
      audioUrl: null, // We don't return URL anymore, only base64
      audioBase64,
      contentType: 'audio/mpeg',
    }
  })

// ==========================================
// Save Pre-Generated Greeting to Session
// ==========================================

export const savePreloadedGreetingFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(savePreloadedGreetingSchema)
  .handler(async ({ data, context }) => {
    console.log('[SaveGreeting] Saving preloaded greeting to session')

    // Verify session belongs to user
    const session = await prisma.voiceSession.findFirst({
      where: {
        id: data.sessionId,
        userId: context.user.id,
      },
    })

    if (!session) {
      throw new Error('Session not found')
    }

    // Save the greeting as the first turn (no audio upload - replay feature removed)
    const turn = await prisma.transcriptTurn.create({
      data: {
        sessionId: session.id,
        speaker: 'ai',
        text: data.text,
        audioUrl: null, // Audio replay removed
        startTime: 0,
        duration: 2, // Approximate
        order: 0,
      },
    })

    console.log('[SaveGreeting] Greeting saved as turn:', turn.id)

    return {
      turn,
      audioUrl: null,
    }
  })

// ==========================================
// Generate AI Greeting (First Message)
// ==========================================

export const generateGreetingFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(generateGreetingSchema)
  .handler(async ({ data, context }) => {
    const startTime = Date.now()
    console.log('[Greeting] Starting greeting generation')

    // Get session and user preferences
    const session = await prisma.voiceSession.findFirst({
      where: {
        id: data.sessionId,
        userId: context.user.id,
      },
    })

    if (!session) {
      throw new Error('Session not found')
    }

    const preferences = await prisma.userPreferences.findUnique({
      where: { userId: context.user.id },
    })

    // personality is stored for potential future use
    void (preferences?.aiPersonality || 'empathetic')

    // Get a greeting
    const greeting = getRandomGreeting()

    // Generate TTS for the greeting (for live playback only, no permanent storage)
    let audioUrl: string | null = null
    try {
      const ttsResult = await generateSpeech(greeting)
      audioUrl = ttsResult.audioUrl // Temporary URL for immediate playback
    } catch (error) {
      console.error('Failed to generate TTS for greeting:', error)
      // Continue without audio
    }

    // Save the greeting as the first turn (no audio URL - replay feature removed)
    const turn = await prisma.transcriptTurn.create({
      data: {
        sessionId: session.id,
        speaker: 'ai',
        text: greeting,
        audioUrl: null, // Audio replay removed
        startTime: 0,
        duration: 2, // Approximate
        order: 0,
      },
    })

    const latency = Date.now() - startTime
    console.log(
      `[Greeting] Complete (${latency}ms), audioUrl for playback: ${audioUrl ? 'yes' : 'no'}`,
    )

    return {
      text: greeting,
      audioUrl, // Still return for immediate playback
      turn,
    }
  })

// ==========================================
// Send Message and Get AI Response
// ==========================================

export const sendMessageFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(conversationSchema)
  .handler(async ({ data, context }) => {
    // Get session with turns
    const session = await prisma.voiceSession.findFirst({
      where: {
        id: data.sessionId,
        userId: context.user.id,
        status: 'active',
      },
      include: {
        turns: {
          orderBy: { order: 'asc' },
        },
      },
    })

    if (!session) {
      throw new Error('Active session not found')
    }

    // Get user preferences
    const preferences = await prisma.userPreferences.findUnique({
      where: { userId: context.user.id },
    })

    const personality = (preferences?.aiPersonality ||
      'empathetic') as AIPersonality

    // Build conversation context
    const systemPrompt = buildConversationSystemPrompt(
      personality,
      context.user.name || undefined,
    )

    const conversationHistory = buildConversationContext(
      session.turns.map((t) => ({
        speaker: t.speaker as 'user' | 'ai',
        text: t.text,
      })),
    )

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: data.userMessage },
    ]

    // Calculate timing
    const lastTurn = session.turns[session.turns.length - 1]
    const startTime = lastTurn
      ? lastTurn.startTime + lastTurn.duration + 0.5
      : 0

    // Save user's message as a turn (no audio upload - replay feature removed)
    const userTurn = await prisma.transcriptTurn.create({
      data: {
        sessionId: session.id,
        speaker: 'user',
        text: data.userMessage,
        audioUrl: null, // Audio replay removed
        startTime,
        duration: Math.ceil(data.userMessage.split(' ').length / 2.5), // Rough estimate
        order: session.turns.length,
      },
    })

    // Generate AI response (non-streaming for simplicity in this endpoint)
    const aiResponse = await chatCompletion(messages)

    // Generate TTS for immediate playback (no permanent storage)
    let audioUrl: string | null = null
    let audioDuration = 2
    try {
      const ttsResult = await generateSpeech(aiResponse)
      audioDuration = ttsResult.durationSeconds
      audioUrl = ttsResult.audioUrl // Temporary URL for immediate playback
    } catch (error) {
      console.error('Failed to generate TTS:', error)
    }

    // Save AI response as a turn (no audio URL stored - replay feature removed)
    const aiTurn = await prisma.transcriptTurn.create({
      data: {
        sessionId: session.id,
        speaker: 'ai',
        text: aiResponse,
        audioUrl: null, // Audio replay removed
        startTime: startTime + userTurn.duration + 0.5,
        duration: audioDuration,
        order: session.turns.length + 1,
      },
    })

    return {
      userTurn,
      aiTurn,
      aiText: aiResponse,
      aiAudioUrl: audioUrl, // Still return for immediate playback
    }
  })

// ==========================================
// Process Completed Session (Summary + Image)
// ==========================================

export const processSessionFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(processSessionSchema)
  .handler(async ({ data, context }) => {
    // Get session with turns
    const session = await prisma.voiceSession.findFirst({
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
      throw new Error('Session not found or not in processing state')
    }

    // Check if there are any user turns (actual conversation happened)
    const userTurns = session.turns.filter((t) => t.speaker === 'user')

    // If no user turns or very short session, skip summary/image generation
    if (userTurns.length === 0 || session.totalUserSpeakingTime < 10) {
      console.log(
        '[Process Session] Skipping summary/image - no meaningful user input',
      )

      const updatedSession = await prisma.voiceSession.update({
        where: { id: session.id },
        data: {
          status: 'completed',
          summaryText: null,
          imageUrl: null,
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

    // Generate summary
    let summaryText: string | null = null
    try {
      const summaryMessages = buildSummaryMessages(transcript)
      summaryText = await chatCompletion(summaryMessages as ChatMessage[], {
        maxTokens: 1000,
      })
    } catch (error) {
      console.error('Failed to generate summary:', error)
    }

    // Generate image only if we have a meaningful summary
    let imageUrl: string | null = null
    if (summaryText && summaryText.length > 50) {
      try {
        // Build prompt and generate image
        void buildImagePrompt(summaryText, session.imageStyle as ImageStyle)
        const imageResult = await generateImage(summaryText, {
          style: session.imageStyle as ImageStyle,
        })

        // Upload to Bunny.net
        const uploadResult = await uploadImageFromUrl(
          context.user.id,
          session.id,
          imageResult.imageUrl,
        )
        imageUrl = uploadResult.url
      } catch (error) {
        console.error('Failed to generate image:', error)
      }
    }

    // Update session with results (no archival needed - audio replay removed)
    const updatedSession = await prisma.voiceSession.update({
      where: { id: session.id },
      data: {
        status: 'completed',
        summaryText,
        imageUrl,
      },
    })

    return {
      session: updatedSession,
      summaryText,
      imageUrl,
    }
  })

// ==========================================
// Get Session Processing Status
// ==========================================

export const getProcessingStatusFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ sessionId: z.string() }))
  .handler(async ({ data, context }) => {
    const session = await prisma.voiceSession.findFirst({
      where: {
        id: data.sessionId,
        userId: context.user.id,
      },
      select: {
        id: true,
        status: true,
        summaryText: true,
        imageUrl: true,
      },
    })

    if (!session) {
      throw new Error('Session not found')
    }

    return {
      status: session.status,
      isComplete: session.status === 'completed',
      hasSummary: !!session.summaryText,
      hasImage: !!session.imageUrl,
    }
  })
