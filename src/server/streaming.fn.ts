/**
 * Streaming Server Functions
 * Handles streaming AI responses with sentence-level TTS for low latency
 */

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { prisma } from '../db'
import {
  buildConversationContext,
  buildConversationSystemPrompt,
} from '../lib/prompts/conversation'
import { authMiddleware } from './middleware'
import { streamChatCompletion } from './services/openrouter.service'
import { generateSpeech } from './services/falai.service'
import { uploadAudio } from './services/bunny.service'
import type { ChatMessage } from './services/openrouter.service'
// NOTE: uploadAudio only used for user audio; AI audio uses fal.ai URLs directly
import type { AIPersonality } from '../types/voice-session'

// ==========================================
// Schemas
// ==========================================

const streamMessageSchema = z.object({
  sessionId: z.string(),
  userMessage: z.string(),
  userAudioBase64: z.string().optional(),
  userAudioContentType: z.string().optional(),
})

// ==========================================
// Types
// ==========================================

export interface StreamingAudioChunk {
  type: 'audio'
  audioUrl: string
  text: string
  sentenceIndex: number
}

export interface StreamingComplete {
  type: 'done'
  fullText: string
  totalSentences: number
}

export type StreamingChunk = StreamingAudioChunk | StreamingComplete

// ==========================================
// Sentence Detection
// ==========================================

/** Sentence boundary patterns */
const SENTENCE_ENDINGS = /[.!?]+(?:\s|$)/

/**
 * Extract complete sentences from accumulated text
 * Returns [completeSentences[], remainingText]
 */
function extractSentences(text: string): [Array<string>, string] {
  const sentences: Array<string> = []
  let remaining = text

  let match: RegExpExecArray | null
  while ((match = SENTENCE_ENDINGS.exec(remaining)) !== null) {
    const sentenceEnd = match.index + match[0].length
    const sentence = remaining.slice(0, sentenceEnd).trim()
    if (sentence.length > 0) {
      sentences.push(sentence)
    }
    remaining = remaining.slice(sentenceEnd)
    // Reset regex lastIndex for global matching
    SENTENCE_ENDINGS.lastIndex = 0
  }

  return [sentences, remaining.trim()]
}

// ==========================================
// Streaming Message with Sentence-Level TTS
// ==========================================

/**
 * Send a message and get back the first audio URL as fast as possible
 * Then continue processing remaining sentences in background
 *
 * This function returns as soon as the first sentence's audio is ready,
 * providing much lower latency than waiting for the full response.
 */
export const streamMessageFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(streamMessageSchema)
  .handler(async ({ data, context }) => {
    const startTime = Date.now()
    console.log('[Streaming] Starting streamMessageFn')

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

    const messages: Array<ChatMessage> = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: data.userMessage },
    ]

    // Calculate timing
    const lastTurn = session.turns[session.turns.length - 1]
    const startTimeOffset = lastTurn
      ? lastTurn.startTime + lastTurn.duration + 0.5
      : 0

    // Upload user audio if provided (do this in parallel)
    const userAudioPromise = data.userAudioBase64
      ? (async () => {
          try {
            const audioBuffer = Buffer.from(data.userAudioBase64!, 'base64')
            const contentType = data.userAudioContentType || 'audio/webm'
            const uploadResult = await uploadAudio(
              context.user.id,
              session.id,
              session.turns.length,
              'user',
              audioBuffer,
              contentType,
            )
            console.log(`[Streaming] User audio uploaded: ${uploadResult.url}`)
            return uploadResult.url
          } catch (error) {
            console.error('[Streaming] Failed to upload user audio:', error)
            return null
          }
        })()
      : Promise.resolve(null)

    // Save user's message as a turn
    const userTurn = await prisma.transcriptTurn.create({
      data: {
        sessionId: session.id,
        speaker: 'user',
        text: data.userMessage,
        audioUrl: null, // Will update after upload
        startTime: startTimeOffset,
        duration: Math.ceil(data.userMessage.split(' ').length / 2.5),
        order: session.turns.length,
      },
    })

    // Track streaming state
    let accumulatedText = ''
    let processedSentenceCount = 0
    const audioChunks: Array<StreamingAudioChunk> = []
    let firstAudioResolve: ((url: string | null) => void) | null = null
    const firstAudioPromise = new Promise<string | null>((resolve) => {
      firstAudioResolve = resolve
    })

    // Process sentences as they complete
    // NOTE: Skip Bunny upload for live playback - use fal.ai URLs directly
    // Bunny upload happens after session ends for archival
    const processSentence = async (sentence: string, index: number) => {
      const sentenceStart = Date.now()
      console.log(
        `[Streaming] Processing sentence ${index}: "${sentence.slice(0, 50)}..."`,
      )

      try {
        // Generate TTS for this sentence
        const ttsResult = await generateSpeech(sentence)

        if (ttsResult.audioUrl) {
          // Use fal.ai URL directly for faster playback (skip Bunny upload)
          const chunk: StreamingAudioChunk = {
            type: 'audio',
            audioUrl: ttsResult.audioUrl, // Direct fal.ai URL
            text: sentence,
            sentenceIndex: index,
          }
          audioChunks.push(chunk)

          const sentenceLatency = Date.now() - sentenceStart
          console.log(
            `[Streaming] Sentence ${index} audio ready (${sentenceLatency}ms): ${ttsResult.audioUrl}`,
          )

          // If this is the first audio, resolve the promise
          if (index === 0 && firstAudioResolve) {
            firstAudioResolve(ttsResult.audioUrl)
            const totalLatency = Date.now() - startTime
            console.log(
              `[Streaming] FIRST AUDIO READY! Total latency: ${totalLatency}ms`,
            )
          }

          return chunk
        }
      } catch (error) {
        console.error(`[Streaming] Failed to process sentence ${index}:`, error)
      }
      return null
    }

    // Queue for sentence processing
    const sentenceQueue: Array<Promise<StreamingAudioChunk | null>> = []

    // Stream LLM response
    const llmStartTime = Date.now()
    await new Promise<void>((resolve, reject) => {
      streamChatCompletion(messages, {
        onToken: (token) => {
          accumulatedText += token

          // Check for complete sentences
          const [sentences, remaining] = extractSentences(accumulatedText)

          for (const sentence of sentences) {
            // Start processing this sentence immediately
            const sentencePromise = processSentence(
              sentence,
              processedSentenceCount,
            )
            sentenceQueue.push(sentencePromise)
            processedSentenceCount++
          }

          // Keep remaining text for next iteration
          accumulatedText = remaining
        },
        onComplete: (fullText) => {
          const llmLatency = Date.now() - llmStartTime
          console.log(
            `[Streaming] LLM complete (${llmLatency}ms): ${fullText.slice(0, 100)}...`,
          )

          // Process any remaining text as final sentence
          if (accumulatedText.trim()) {
            const sentencePromise = processSentence(
              accumulatedText.trim(),
              processedSentenceCount,
            )
            sentenceQueue.push(sentencePromise)
            processedSentenceCount++
          }

          // Store full text for later
          accumulatedText = fullText
          resolve()
        },
        onError: (error) => {
          console.error('[Streaming] LLM error:', error)
          reject(error)
        },
      })
    })

    // Wait for first audio to be ready
    const firstAudio = await firstAudioPromise

    // Wait for user audio upload to complete
    const userAudioUrl = await userAudioPromise

    // Update user turn with audio URL if available
    if (userAudioUrl) {
      await prisma.transcriptTurn.update({
        where: { id: userTurn.id },
        data: { audioUrl: userAudioUrl },
      })
    }

    // Wait for all sentences to complete processing
    await Promise.all(sentenceQueue)

    // Save AI response as a turn (use first audio URL for now)
    const aiTurn = await prisma.transcriptTurn.create({
      data: {
        sessionId: session.id,
        speaker: 'ai',
        text: accumulatedText,
        audioUrl: firstAudio,
        startTime: startTimeOffset + userTurn.duration + 0.5,
        duration: Math.ceil(accumulatedText.split(' ').length / 2.5),
        order: session.turns.length + 1,
      },
    })

    const totalLatency = Date.now() - startTime
    console.log(
      `[Streaming] Complete! Total latency: ${totalLatency}ms, Sentences: ${processedSentenceCount}`,
    )

    return {
      userTurn,
      aiTurn,
      aiText: accumulatedText,
      // Return all audio chunks for the client to queue and play
      audioChunks: audioChunks.sort(
        (a, b) => a.sentenceIndex - b.sentenceIndex,
      ),
      firstAudioUrl: firstAudio,
      totalSentences: processedSentenceCount,
      latencyMs: totalLatency,
    }
  })
