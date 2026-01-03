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
import { uploadAudio, uploadImageFromUrl } from './services/bunny.service'
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
})

const generateGreetingSchema = z.object({
  sessionId: z.string(),
})

const processSessionSchema = z.object({
  sessionId: z.string(),
})

// ==========================================
// Generate AI Greeting (First Message)
// ==========================================

export const generateGreetingFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(generateGreetingSchema)
  .handler(async ({ data, context }) => {
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

    // Generate TTS for the greeting
    let audioUrl: string | null = null
    try {
      const ttsResult = await generateSpeech(greeting)

      // Only upload if we got a real audio URL
      if (ttsResult.audioUrl && ttsResult.audioUrl.length > 0) {
        const response = await fetch(ttsResult.audioUrl)
        if (response.ok) {
          const audioBuffer = await response.arrayBuffer()

          const uploadResult = await uploadAudio(
            context.user.id,
            session.id,
            0,
            'ai',
            audioBuffer,
            ttsResult.contentType,
          )
          audioUrl = uploadResult.url
        }
      }
    } catch (error) {
      console.error('Failed to generate TTS for greeting:', error)
      // Continue without audio
    }

    // Save the greeting as the first turn
    const turn = await prisma.transcriptTurn.create({
      data: {
        sessionId: session.id,
        speaker: 'ai',
        text: greeting,
        audioUrl,
        startTime: 0,
        duration: 2, // Approximate
        order: 0,
      },
    })

    return {
      text: greeting,
      audioUrl,
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

    // Save user's message as a turn
    const userTurn = await prisma.transcriptTurn.create({
      data: {
        sessionId: session.id,
        speaker: 'user',
        text: data.userMessage,
        audioUrl: null, // User audio would be uploaded separately
        startTime,
        duration: Math.ceil(data.userMessage.split(' ').length / 2.5), // Rough estimate
        order: session.turns.length,
      },
    })

    // Generate AI response (non-streaming for simplicity in this endpoint)
    const aiResponse = await chatCompletion(messages)

    // Generate TTS
    let audioUrl: string | null = null
    let audioDuration = 2
    try {
      const ttsResult = await generateSpeech(aiResponse)
      audioDuration = ttsResult.durationSeconds

      // Only upload if we got a real audio URL
      if (ttsResult.audioUrl && ttsResult.audioUrl.length > 0) {
        const response = await fetch(ttsResult.audioUrl)
        if (response.ok) {
          const audioBuffer = await response.arrayBuffer()

          const uploadResult = await uploadAudio(
            context.user.id,
            session.id,
            session.turns.length + 1,
            'ai',
            audioBuffer,
            ttsResult.contentType,
          )
          audioUrl = uploadResult.url
        }
      }
    } catch (error) {
      console.error('Failed to generate TTS:', error)
    }

    // Save AI response as a turn
    const aiTurn = await prisma.transcriptTurn.create({
      data: {
        sessionId: session.id,
        speaker: 'ai',
        text: aiResponse,
        audioUrl,
        startTime: startTime + userTurn.duration + 0.5,
        duration: audioDuration,
        order: session.turns.length + 1,
      },
    })

    return {
      userTurn,
      aiTurn,
      aiText: aiResponse,
      aiAudioUrl: audioUrl,
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

    // Generate image
    let imageUrl: string | null = null
    if (summaryText) {
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

    // Update session with results
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
