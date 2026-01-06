/**
 * useConversationStream Hook
 * SSE client for streaming AI conversation responses
 *
 * Features:
 * - Streams text tokens as they arrive
 * - Streams audio chunks for immediate playback
 * - Handles connection errors gracefully
 * - Supports cancellation
 */

import { useCallback, useRef, useState } from 'react'

export interface ConversationStreamState {
  /** Whether a stream is currently active */
  isStreaming: boolean
  /** Accumulated text from the current response */
  accumulatedText: string
  /** Error message if any */
  error: string | null
}

export interface ConversationStreamEvents {
  /** Called when a text token is received */
  onText?: (token: string, accumulated: string) => void
  /** Called when an audio chunk is received */
  onAudio?: (
    audioBase64: string | undefined,
    audioUrl: string | undefined,
    contentType: string,
    sentenceIndex: number,
    text: string,
  ) => void
  /** Called when the stream completes successfully */
  onDone?: (fullText: string, totalSentences: number, aiTurnId: string) => void
  /** Called when an error occurs */
  onError?: (error: string) => void
  /** Called when the stream starts */
  onStart?: (userTurnId: string) => void
}

export interface UseConversationStreamOptions extends ConversationStreamEvents {}

export interface ConversationStreamActions {
  /** Send a message and stream the response */
  sendMessage: (sessionId: string, userMessage: string) => Promise<void>
  /** Cancel the current stream */
  cancel: () => void
  /** Clear error state */
  clearError: () => void
}

export function useConversationStream(
  options: UseConversationStreamOptions = {},
): [ConversationStreamState, ConversationStreamActions] {
  const { onText, onAudio, onDone, onError, onStart } = options

  const [state, setState] = useState<ConversationStreamState>({
    isStreaming: false,
    accumulatedText: '',
    error: null,
  })

  const abortControllerRef = useRef<AbortController | null>(null)
  const accumulatedTextRef = useRef<string>('')
  // Deduplication guard to prevent double-sends
  const isSendingRef = useRef<boolean>(false)
  const lastMessageRef = useRef<string>('')
  // Generation ID to track and ignore stale audio after barge-in/cancellation
  const generationIdRef = useRef<number>(0)
  const currentGenerationRef = useRef<number>(0)

  // Send message and stream response
  const sendMessage = useCallback(
    async (sessionId: string, userMessage: string) => {
      // Deduplication: prevent sending the same message twice in quick succession
      const messageKey = `${sessionId}:${userMessage}`
      if (isSendingRef.current && lastMessageRef.current === messageKey) {
        console.log('[ConversationStream] Ignoring duplicate send request')
        return
      }

      // Mark as sending
      isSendingRef.current = true
      lastMessageRef.current = messageKey

      // Cancel any existing stream
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }

      // Increment generation ID for this new request
      generationIdRef.current++
      const thisGeneration = generationIdRef.current
      currentGenerationRef.current = thisGeneration

      // Reset state
      accumulatedTextRef.current = ''
      setState({
        isStreaming: true,
        accumulatedText: '',
        error: null,
      })

      // Create new abort controller
      abortControllerRef.current = new AbortController()

      try {
        console.log(
          `[ConversationStream] Starting stream for session ${sessionId}`,
        )

        const response = await fetch('/api/stream/conversation', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ sessionId, userMessage }),
          signal: abortControllerRef.current.signal,
        })

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(
            `Stream request failed: ${response.status} - ${errorText}`,
          )
        }

        if (!response.body) {
          throw new Error('No response body')
        }

        // Read SSE stream
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let currentEvent = ''

        while (true) {
          const { done, value } = await reader.read()

          if (done) {
            console.log('[ConversationStream] Stream ended')
            break
          }

          // Decode chunk and add to buffer
          buffer += decoder.decode(value, { stream: true })

          // Process complete lines
          const lines = buffer.split('\n')
          buffer = lines.pop() || '' // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              currentEvent = line.slice(7).trim()
            } else if (line.startsWith('data: ')) {
              const dataStr = line.slice(6)

              try {
                const data = JSON.parse(dataStr)

                switch (currentEvent) {
                  case 'started':
                    console.log('[ConversationStream] Stream started')
                    onStart?.(data.userTurnId)
                    break

                  case 'text':
                    accumulatedTextRef.current += data.token
                    setState((prev) => ({
                      ...prev,
                      accumulatedText: accumulatedTextRef.current,
                    }))
                    onText?.(data.token, accumulatedTextRef.current)
                    break

                  case 'audio':
                    // Ignore stale audio from cancelled/old generations (barge-in protection)
                    if (thisGeneration !== currentGenerationRef.current) {
                      console.log(
                        `[ConversationStream] BLOCKING stale audio chunk ${data.sentenceIndex} - generation ${thisGeneration} vs current ${currentGenerationRef.current}`,
                      )
                      break
                    }
                    console.log(
                      `[ConversationStream] Audio chunk ${data.sentenceIndex} received (gen ${thisGeneration})`,
                    )
                    onAudio?.(
                      data.audioBase64,
                      data.audioUrl,
                      data.contentType || 'audio/mpeg',
                      data.sentenceIndex,
                      data.text,
                    )
                    break

                  case 'done':
                    console.log(
                      `[ConversationStream] Complete: ${data.totalSentences} sentences, ${data.latencyMs}ms`,
                    )
                    setState((prev) => ({
                      ...prev,
                      isStreaming: false,
                    }))
                    onDone?.(data.fullText, data.totalSentences, data.aiTurnId)
                    break

                  case 'error':
                    console.error(
                      '[ConversationStream] Server error:',
                      data.message,
                    )
                    setState((prev) => ({
                      ...prev,
                      isStreaming: false,
                      error: data.message,
                    }))
                    onError?.(data.message)
                    break

                  default:
                    console.log(
                      `[ConversationStream] Unknown event: ${currentEvent}`,
                      data,
                    )
                }
              } catch (parseError) {
                console.warn(
                  '[ConversationStream] Failed to parse SSE data:',
                  dataStr,
                )
              }
            }
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          console.log('[ConversationStream] Stream aborted')
          setState((prev) => ({ ...prev, isStreaming: false }))
          return
        }

        const errorMessage =
          error instanceof Error ? error.message : 'Stream failed'
        console.error('[ConversationStream] Error:', errorMessage)
        setState((prev) => ({
          ...prev,
          isStreaming: false,
          error: errorMessage,
        }))
        onError?.(errorMessage)
      } finally {
        abortControllerRef.current = null
        // Reset deduplication guard after a short delay to allow for legitimate retries
        setTimeout(() => {
          isSendingRef.current = false
        }, 500)
      }
    },
    [onText, onAudio, onDone, onError, onStart],
  )

  // Cancel current stream (used for barge-in)
  const cancel = useCallback(() => {
    console.log(
      '[ConversationStream] cancel() - gen:',
      generationIdRef.current,
      '-> ',
      generationIdRef.current + 1,
    )

    // Increment generation to invalidate any pending audio from this stream
    generationIdRef.current++
    currentGenerationRef.current = generationIdRef.current

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }

    setState((prev) => ({ ...prev, isStreaming: false }))
  }, [])

  // Clear error
  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }))
  }, [])

  return [
    state,
    {
      sendMessage,
      cancel,
      clearError,
    },
  ]
}
