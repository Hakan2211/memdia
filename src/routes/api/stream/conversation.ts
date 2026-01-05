/**
 * SSE Streaming Conversation Endpoint
 * Streams AI responses with audio chunks for real-time voice conversation
 */

import { createFileRoute } from '@tanstack/react-router'
import { auth } from '../../../lib/auth'
import { prisma } from '../../../db'
import {
  streamChatCompletion,
  type ChatMessage,
} from '../../../server/services/openrouter.service'
import { streamSpeech } from '../../../server/services/falai-streaming.service'
import {
  buildConversationSystemPrompt,
  buildConversationContext,
} from '../../../lib/prompts/conversation'
import type { AIPersonality } from '../../../types/voice-session'

// ==========================================
// Sentence Detection
// ==========================================

const SENTENCE_ENDINGS = /[.!?]+(?:\s|$)/

function extractSentences(text: string): [string[], string] {
  const sentences: string[] = []
  let remaining = text

  let match: RegExpExecArray | null
  while ((match = SENTENCE_ENDINGS.exec(remaining)) !== null) {
    const sentenceEnd = match.index + match[0].length
    const sentence = remaining.slice(0, sentenceEnd).trim()
    if (sentence.length > 0) {
      sentences.push(sentence)
    }
    remaining = remaining.slice(sentenceEnd)
    SENTENCE_ENDINGS.lastIndex = 0
  }

  return [sentences, remaining.trim()]
}

// ==========================================
// SSE Route Handler
// ==========================================

export const Route = createFileRoute('/api/stream/conversation')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const startTime = Date.now()

        // Authenticate user
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session?.user) {
          return new Response('Unauthorized', { status: 401 })
        }

        // Parse request body
        let body: { sessionId: string; userMessage: string }
        try {
          body = await request.json()
        } catch {
          return new Response('Invalid JSON body', { status: 400 })
        }

        const { sessionId, userMessage } = body

        if (!sessionId || !userMessage) {
          return new Response('Missing sessionId or userMessage', {
            status: 400,
          })
        }

        // Get voice session
        const voiceSession = await prisma.voiceSession.findFirst({
          where: {
            id: sessionId,
            userId: session.user.id,
            status: 'active',
          },
          include: {
            turns: {
              orderBy: { order: 'asc' },
            },
          },
        })

        if (!voiceSession) {
          return new Response('Session not found', { status: 404 })
        }

        // Get user preferences
        const preferences = await prisma.userPreferences.findUnique({
          where: { userId: session.user.id },
        })

        const personality = (preferences?.aiPersonality ||
          'empathetic') as AIPersonality

        // Build conversation messages
        const systemPrompt = buildConversationSystemPrompt(
          personality,
          session.user.name || undefined,
        )

        const conversationHistory = buildConversationContext(
          voiceSession.turns.map((t) => ({
            speaker: t.speaker as 'user' | 'ai',
            text: t.text,
          })),
        )

        const messages: ChatMessage[] = [
          { role: 'system', content: systemPrompt },
          ...conversationHistory,
          { role: 'user', content: userMessage },
        ]

        // Save user turn first
        const lastTurn = voiceSession.turns[voiceSession.turns.length - 1]
        const userStartTime = lastTurn
          ? lastTurn.startTime + lastTurn.duration + 0.5
          : 0

        const userTurn = await prisma.transcriptTurn.create({
          data: {
            sessionId: voiceSession.id,
            speaker: 'user',
            text: userMessage,
            audioUrl: null,
            startTime: userStartTime,
            duration: Math.ceil(userMessage.split(' ').length / 2.5),
            order: voiceSession.turns.length,
          },
        })

        // Create SSE response stream
        const encoder = new TextEncoder()

        const stream = new ReadableStream({
          async start(controller) {
            // Track controller lifecycle to prevent "Controller is already closed" errors
            let isClosed = false

            const send = (event: string, data: object) => {
              if (isClosed) {
                console.warn(
                  `[SSE Stream] Attempted to send "${event}" after controller closed`,
                )
                return
              }
              try {
                const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
                controller.enqueue(encoder.encode(message))
              } catch (error) {
                console.error(`[SSE Stream] Failed to send "${event}":`, error)
                isClosed = true
              }
            }

            const closeController = () => {
              if (!isClosed) {
                isClosed = true
                try {
                  controller.close()
                } catch (error) {
                  console.warn('[SSE Stream] Controller already closed:', error)
                }
              }
            }

            try {
              console.log(
                `[SSE Stream] Starting for session ${sessionId}, message: "${userMessage.slice(0, 50)}..."`,
              )

              send('started', {
                userTurnId: userTurn.id,
                timestamp: Date.now(),
              })

              let accumulatedText = ''
              let processedSentenceCount = 0
              let fullText = ''
              const audioPromises: Promise<void>[] = []

              // Process a complete sentence - generate TTS and stream audio
              const processSentence = async (
                sentence: string,
                index: number,
              ) => {
                const sentenceStart = Date.now()
                console.log(
                  `[SSE Stream] Processing sentence ${index}: "${sentence.slice(0, 40)}..."`,
                )

                try {
                  // Stream TTS for this sentence
                  for await (const chunk of streamSpeech(sentence)) {
                    if (chunk.type === 'audio_chunk') {
                      send('audio', {
                        sentenceIndex: index,
                        audioBase64: chunk.audioBase64,
                        audioUrl: chunk.audioUrl,
                        contentType: chunk.contentType,
                        text: sentence,
                      })

                      const latency = Date.now() - sentenceStart
                      console.log(
                        `[SSE Stream] Sentence ${index} audio sent (${latency}ms)`,
                      )

                      // Log first audio latency
                      if (index === 0) {
                        const totalLatency = Date.now() - startTime
                        console.log(
                          `[SSE Stream] FIRST AUDIO! Total latency: ${totalLatency}ms`,
                        )
                      }
                    }
                  }
                } catch (error) {
                  console.error(
                    `[SSE Stream] TTS error for sentence ${index}:`,
                    error,
                  )
                  send('error', {
                    message: `TTS failed for sentence ${index}`,
                    sentenceIndex: index,
                  })
                }
              }

              // Stream LLM response
              await new Promise<void>((resolve, reject) => {
                streamChatCompletion(messages, {
                  onToken: (token) => {
                    accumulatedText += token
                    fullText += token

                    // Send text token for live display
                    send('text', { token })

                    // Check for complete sentences
                    const [sentences, remaining] =
                      extractSentences(accumulatedText)

                    for (const sentence of sentences) {
                      // Start TTS for this sentence immediately (parallel)
                      const sentenceIndex = processedSentenceCount
                      const promise = processSentence(sentence, sentenceIndex)
                      audioPromises.push(promise)
                      processedSentenceCount++
                    }

                    accumulatedText = remaining
                  },
                  onComplete: async (_completedText) => {
                    console.log(
                      `[SSE Stream] LLM complete, ${processedSentenceCount} sentences so far`,
                    )

                    // Process any remaining text as final sentence
                    if (accumulatedText.trim()) {
                      const promise = processSentence(
                        accumulatedText.trim(),
                        processedSentenceCount,
                      )
                      audioPromises.push(promise)
                      processedSentenceCount++
                    }

                    // Wait for all TTS to complete
                    await Promise.all(audioPromises)

                    // Save AI turn to database
                    const aiTurn = await prisma.transcriptTurn.create({
                      data: {
                        sessionId: voiceSession.id,
                        speaker: 'ai',
                        text: fullText,
                        audioUrl: null, // Will be set during archival
                        startTime: userStartTime + userTurn.duration + 0.5,
                        duration: Math.ceil(fullText.split(' ').length / 2.5),
                        order: voiceSession.turns.length + 1,
                      },
                    })

                    const totalLatency = Date.now() - startTime
                    console.log(
                      `[SSE Stream] Complete! Total: ${totalLatency}ms, Sentences: ${processedSentenceCount}`,
                    )

                    send('done', {
                      fullText,
                      totalSentences: processedSentenceCount,
                      aiTurnId: aiTurn.id,
                      latencyMs: totalLatency,
                    })

                    resolve()
                  },
                  onError: (error) => {
                    console.error('[SSE Stream] LLM error:', error)
                    send('error', { message: error.message })
                    reject(error)
                  },
                })
              })
            } catch (error) {
              console.error('[SSE Stream] Fatal error:', error)
              send('error', {
                message:
                  error instanceof Error ? error.message : 'Stream failed',
              })
            } finally {
              closeController()
            }
          },
        })

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no', // Disable nginx buffering
          },
        })
      },
    },
  },
})
