/**
 * WebSocket Conversation Handler
 * Real-time bidirectional voice conversation using WebSocket
 *
 * This handler uses h3's defineWebSocket for Nitro integration
 */

import { defineWebSocket, type WebSocketPeer, type WebSocketMessage } from 'h3'
import { prisma } from '../../../../src/db'
import {
  streamChatCompletion,
  type ChatMessage,
} from '../../../../src/server/services/openrouter.service'
import { streamSpeech } from '../../../../src/server/services/falai-streaming.service'
import {
  buildConversationSystemPrompt,
  getRandomGreeting,
} from '../../../../src/lib/prompts/conversation'
import type { AIPersonality } from '../../../../src/types/voice-session'

// ==========================================
// Types
// ==========================================

interface ConversationSession {
  sessionId: string
  userId: string
  userName?: string
  personality: AIPersonality
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  turnCount: number
}

interface ClientMessage {
  type:
    | 'start_session'
    | 'user_message'
    | 'end_session'
    | 'ping'
    | 'get_greeting'
  sessionId?: string
  userId?: string
  text?: string
}

interface ServerMessage {
  type:
    | 'session_started'
    | 'greeting'
    | 'ai_speaking_start'
    | 'ai_audio_chunk'
    | 'ai_text'
    | 'ai_speaking_end'
    | 'transcript_saved'
    | 'session_ended'
    | 'error'
    | 'pong'
  [key: string]: unknown
}

// ==========================================
// Session Management
// ==========================================

const sessions = new Map<string, ConversationSession>()

// ==========================================
// Helpers
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
// WebSocket Handler
// ==========================================

export default defineWebSocket({
  open(peer: WebSocketPeer) {
    console.log(`[WS] Connection opened: ${peer.id}`)
  },

  async message(peer: WebSocketPeer, rawMessage: WebSocketMessage) {
    let message: ClientMessage

    try {
      const text =
        typeof rawMessage === 'string'
          ? rawMessage
          : rawMessage.text?.() || String(rawMessage)
      message = JSON.parse(text)
    } catch (error) {
      console.error('[WS] Failed to parse message:', error)
      peer.send(
        JSON.stringify({
          type: 'error',
          message: 'Invalid message format',
        } as ServerMessage),
      )
      return
    }

    const send = (msg: ServerMessage) => {
      peer.send(JSON.stringify(msg))
    }

    try {
      switch (message.type) {
        case 'ping': {
          send({ type: 'pong' })
          break
        }

        case 'start_session': {
          const { sessionId, userId } = message

          if (!sessionId || !userId) {
            send({ type: 'error', message: 'Missing sessionId or userId' })
            return
          }

          console.log(`[WS] Starting session: ${sessionId} for user ${userId}`)

          // Get user preferences
          const preferences = await prisma.userPreferences.findUnique({
            where: { userId },
          })

          const user = await prisma.user.findUnique({
            where: { id: userId },
          })

          // Initialize session
          const session: ConversationSession = {
            sessionId,
            userId,
            userName: user?.name || undefined,
            personality:
              (preferences?.aiPersonality as AIPersonality) || 'empathetic',
            messages: [],
            turnCount: 0,
          }

          sessions.set(peer.id, session)

          send({
            type: 'session_started',
            sessionId,
          })
          break
        }

        case 'get_greeting': {
          const session = sessions.get(peer.id)
          if (!session) {
            send({ type: 'error', message: 'No active session' })
            return
          }

          console.log(
            `[WS] Generating greeting for session ${session.sessionId}`,
          )
          const startTime = Date.now()

          // Get greeting text
          const greetingText = getRandomGreeting()

          send({ type: 'ai_speaking_start' })

          // Stream TTS for greeting
          try {
            for await (const chunk of streamSpeech(greetingText)) {
              if (chunk.type === 'audio_chunk') {
                send({
                  type: 'ai_audio_chunk',
                  audioBase64: chunk.audioBase64,
                  audioUrl: chunk.audioUrl,
                  contentType: chunk.contentType,
                })
              }
            }
          } catch (ttsError) {
            console.error('[WS] Greeting TTS error:', ttsError)
          }

          // Add to conversation history
          session.messages.push({ role: 'assistant', content: greetingText })

          const latency = Date.now() - startTime
          console.log(`[WS] Greeting complete in ${latency}ms`)

          send({
            type: 'ai_speaking_end',
            text: greetingText,
          })

          send({
            type: 'greeting',
            text: greetingText,
            latencyMs: latency,
          })
          break
        }

        case 'user_message': {
          const session = sessions.get(peer.id)
          if (!session) {
            send({ type: 'error', message: 'No active session' })
            return
          }

          const { text } = message
          if (!text?.trim()) {
            send({ type: 'error', message: 'Empty message' })
            return
          }

          console.log(
            `[WS] User message: "${text.slice(0, 50)}..." (session: ${session.sessionId})`,
          )
          const startTime = Date.now()

          // Add user message to history
          session.messages.push({ role: 'user', content: text })
          session.turnCount++

          // Build LLM messages
          const systemPrompt = buildConversationSystemPrompt(
            session.personality,
            session.userName,
          )

          const llmMessages: ChatMessage[] = [
            { role: 'system', content: systemPrompt },
            ...session.messages.map((m) => ({
              role:
                m.role === 'user' ? ('user' as const) : ('assistant' as const),
              content: m.content,
            })),
          ]

          send({ type: 'ai_speaking_start' })

          let accumulatedText = ''
          let fullText = ''
          let sentenceCount = 0
          const audioPromises: Promise<void>[] = []

          // Process a sentence - generate and stream TTS
          const processSentence = async (sentence: string, index: number) => {
            try {
              for await (const chunk of streamSpeech(sentence)) {
                if (chunk.type === 'audio_chunk') {
                  send({
                    type: 'ai_audio_chunk',
                    audioBase64: chunk.audioBase64,
                    audioUrl: chunk.audioUrl,
                    contentType: chunk.contentType,
                    sentenceIndex: index,
                  })

                  if (index === 0) {
                    const latency = Date.now() - startTime
                    console.log(`[WS] First audio chunk: ${latency}ms`)
                  }
                }
              }
            } catch (ttsError) {
              console.error(`[WS] TTS error for sentence ${index}:`, ttsError)
            }
          }

          // Stream LLM response
          await new Promise<void>((resolve, reject) => {
            streamChatCompletion(llmMessages, {
              onToken: (token) => {
                accumulatedText += token
                fullText += token

                // Send text token
                send({ type: 'ai_text', token })

                // Check for complete sentences
                const [sentences, remaining] = extractSentences(accumulatedText)

                for (const sentence of sentences) {
                  const promise = processSentence(sentence, sentenceCount)
                  audioPromises.push(promise)
                  sentenceCount++
                }

                accumulatedText = remaining
              },
              onComplete: async () => {
                // Process remaining text
                if (accumulatedText.trim()) {
                  const promise = processSentence(
                    accumulatedText.trim(),
                    sentenceCount,
                  )
                  audioPromises.push(promise)
                  sentenceCount++
                }

                // Wait for all TTS to complete
                await Promise.all(audioPromises)

                // Add to conversation history
                session.messages.push({ role: 'assistant', content: fullText })

                const latency = Date.now() - startTime
                console.log(
                  `[WS] Response complete: ${sentenceCount} sentences, ${latency}ms`,
                )

                send({
                  type: 'ai_speaking_end',
                  text: fullText,
                  sentenceCount,
                  latencyMs: latency,
                })

                // Save to database (async, don't wait)
                saveTurns(session, text, fullText).catch((err) =>
                  console.error('[WS] Failed to save turns:', err),
                )

                resolve()
              },
              onError: (error) => {
                console.error('[WS] LLM error:', error)
                send({ type: 'error', message: 'AI response failed' })
                reject(error)
              },
            })
          })
          break
        }

        case 'end_session': {
          const session = sessions.get(peer.id)
          if (!session) {
            send({ type: 'session_ended' })
            return
          }

          console.log(`[WS] Ending session: ${session.sessionId}`)

          // Cleanup
          sessions.delete(peer.id)

          send({ type: 'session_ended', sessionId: session.sessionId })
          break
        }

        default:
          console.log(`[WS] Unknown message type: ${message.type}`)
          send({
            type: 'error',
            message: `Unknown message type: ${message.type}`,
          })
      }
    } catch (error) {
      console.error('[WS] Handler error:', error)
      send({
        type: 'error',
        message: error instanceof Error ? error.message : 'Internal error',
      })
    }
  },

  close(peer: WebSocketPeer) {
    console.log(`[WS] Connection closed: ${peer.id}`)
    sessions.delete(peer.id)
  },

  error(peer: WebSocketPeer, error: Error) {
    console.error(`[WS] Error for peer ${peer.id}:`, error)
    sessions.delete(peer.id)
  },
})

// ==========================================
// Database Helpers
// ==========================================

async function saveTurns(
  session: ConversationSession,
  userText: string,
  aiText: string,
): Promise<void> {
  const voiceSession = await prisma.voiceSession.findUnique({
    where: { id: session.sessionId },
    include: { turns: { orderBy: { order: 'desc' }, take: 1 } },
  })

  if (!voiceSession) {
    console.error(`[WS] Voice session not found: ${session.sessionId}`)
    return
  }

  const lastTurn = voiceSession.turns[0]
  const baseOrder = lastTurn ? lastTurn.order + 1 : 0
  const baseTime = lastTurn ? lastTurn.startTime + lastTurn.duration + 0.5 : 0

  // Save user turn
  await prisma.transcriptTurn.create({
    data: {
      sessionId: session.sessionId,
      speaker: 'user',
      text: userText,
      audioUrl: null,
      startTime: baseTime,
      duration: Math.ceil(userText.split(' ').length / 2.5),
      order: baseOrder,
    },
  })

  // Save AI turn
  await prisma.transcriptTurn.create({
    data: {
      sessionId: session.sessionId,
      speaker: 'ai',
      text: aiText,
      audioUrl: null,
      startTime: baseTime + Math.ceil(userText.split(' ').length / 2.5) + 0.5,
      duration: Math.ceil(aiText.split(' ').length / 2.5),
      order: baseOrder + 1,
    },
  })

  console.log(`[WS] Saved turns for session ${session.sessionId}`)
}
