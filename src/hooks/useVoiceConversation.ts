/**
 * useVoiceConversation Hook
 * WebSocket client for real-time voice conversation
 *
 * Features:
 * - Bidirectional WebSocket communication
 * - Auto-reconnection with exponential backoff
 * - Connection status tracking
 * - Streaming audio playback integration
 */

import { useCallback, useEffect, useRef, useState } from 'react'

// ==========================================
// Types
// ==========================================

export interface VoiceConversationState {
  /** Whether WebSocket is connected */
  isConnected: boolean
  /** Whether connection is being established */
  isConnecting: boolean
  /** Whether reconnection is in progress */
  isReconnecting: boolean
  /** Number of reconnection attempts */
  reconnectAttempts: number
  /** Whether AI is currently speaking */
  isAISpeaking: boolean
  /** Current AI response text (accumulated) */
  aiText: string
  /** Error message if any */
  error: string | null
  /** Session ID if connected */
  sessionId: string | null
}

export interface VoiceConversationEvents {
  /** Called when connection is established */
  onConnected?: () => void
  /** Called when connection is lost */
  onDisconnected?: () => void
  /** Called when reconnection starts */
  onReconnecting?: (attempt: number) => void
  /** Called when session starts */
  onSessionStarted?: (sessionId: string) => void
  /** Called when AI starts speaking */
  onAISpeakingStart?: () => void
  /** Called when AI audio chunk is received */
  onAudioChunk?: (
    audioBase64: string | undefined,
    audioUrl: string | undefined,
    contentType: string,
    sentenceIndex?: number,
  ) => void
  /** Called when AI text token is received */
  onTextToken?: (token: string, accumulated: string) => void
  /** Called when AI finishes speaking */
  onAISpeakingEnd?: (text: string, latencyMs?: number) => void
  /** Called when greeting is received */
  onGreeting?: (text: string, latencyMs: number) => void
  /** Called when session ends */
  onSessionEnded?: () => void
  /** Called on any error */
  onError?: (error: string) => void
}

export interface VoiceConversationActions {
  /** Connect to WebSocket and start session */
  connect: (sessionId: string, userId: string) => void
  /** Disconnect from WebSocket */
  disconnect: () => void
  /** Send user message */
  sendMessage: (text: string) => void
  /** Request AI greeting */
  requestGreeting: () => void
  /** End the session */
  endSession: () => void
  /** Clear error state */
  clearError: () => void
}

export interface UseVoiceConversationOptions extends VoiceConversationEvents {
  /** Maximum reconnection attempts (default: 5) */
  maxReconnectAttempts?: number
  /** Base reconnection delay in ms (default: 1000) */
  reconnectDelay?: number
  /** Whether to auto-reconnect on disconnect (default: true) */
  autoReconnect?: boolean
}

// ==========================================
// Constants
// ==========================================

const DEFAULT_MAX_RECONNECT_ATTEMPTS = 5
const DEFAULT_RECONNECT_DELAY = 1000
const PING_INTERVAL = 30000 // 30 seconds

// ==========================================
// Hook
// ==========================================

export function useVoiceConversation(
  options: UseVoiceConversationOptions = {},
): [VoiceConversationState, VoiceConversationActions] {
  const {
    maxReconnectAttempts = DEFAULT_MAX_RECONNECT_ATTEMPTS,
    reconnectDelay = DEFAULT_RECONNECT_DELAY,
    autoReconnect = true,
    onConnected,
    onDisconnected,
    onReconnecting,
    onSessionStarted,
    onAISpeakingStart,
    onAudioChunk,
    onTextToken,
    onAISpeakingEnd,
    onGreeting,
    onSessionEnded,
    onError,
  } = options

  // State
  const [state, setState] = useState<VoiceConversationState>({
    isConnected: false,
    isConnecting: false,
    isReconnecting: false,
    reconnectAttempts: 0,
    isAISpeaking: false,
    aiText: '',
    error: null,
    sessionId: null,
  })

  // Refs
  const wsRef = useRef<WebSocket | null>(null)
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const connectionParamsRef = useRef<{
    sessionId: string
    userId: string
  } | null>(null)
  const accumulatedTextRef = useRef<string>('')
  const shouldReconnectRef = useRef<boolean>(true)

  // Callback refs to avoid stale closures
  const callbacksRef = useRef({
    onConnected,
    onDisconnected,
    onReconnecting,
    onSessionStarted,
    onAISpeakingStart,
    onAudioChunk,
    onTextToken,
    onAISpeakingEnd,
    onGreeting,
    onSessionEnded,
    onError,
  })

  useEffect(() => {
    callbacksRef.current = {
      onConnected,
      onDisconnected,
      onReconnecting,
      onSessionStarted,
      onAISpeakingStart,
      onAudioChunk,
      onTextToken,
      onAISpeakingEnd,
      onGreeting,
      onSessionEnded,
      onError,
    }
  }, [
    onConnected,
    onDisconnected,
    onReconnecting,
    onSessionStarted,
    onAISpeakingStart,
    onAudioChunk,
    onTextToken,
    onAISpeakingEnd,
    onGreeting,
    onSessionEnded,
    onError,
  ])

  // Start ping interval
  const startPing = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current)
    }

    pingIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }))
      }
    }, PING_INTERVAL)
  }, [])

  // Stop ping interval
  const stopPing = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current)
      pingIntervalRef.current = null
    }
  }, [])

  // Handle WebSocket message
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data)
      const callbacks = callbacksRef.current

      switch (data.type) {
        case 'pong':
          // Heartbeat response, ignore
          break

        case 'session_started':
          setState((prev) => ({ ...prev, sessionId: data.sessionId }))
          callbacks.onSessionStarted?.(data.sessionId)
          break

        case 'ai_speaking_start':
          accumulatedTextRef.current = ''
          setState((prev) => ({ ...prev, isAISpeaking: true, aiText: '' }))
          callbacks.onAISpeakingStart?.()
          break

        case 'ai_audio_chunk':
          callbacks.onAudioChunk?.(
            data.audioBase64,
            data.audioUrl,
            data.contentType || 'audio/mpeg',
            data.sentenceIndex,
          )
          break

        case 'ai_text':
          accumulatedTextRef.current += data.token
          setState((prev) => ({
            ...prev,
            aiText: accumulatedTextRef.current,
          }))
          callbacks.onTextToken?.(data.token, accumulatedTextRef.current)
          break

        case 'ai_speaking_end':
          setState((prev) => ({ ...prev, isAISpeaking: false }))
          callbacks.onAISpeakingEnd?.(data.text, data.latencyMs)
          break

        case 'greeting':
          callbacks.onGreeting?.(data.text, data.latencyMs)
          break

        case 'session_ended':
          setState((prev) => ({
            ...prev,
            sessionId: null,
          }))
          callbacks.onSessionEnded?.()
          break

        case 'error':
          console.error('[VoiceConversation] Server error:', data.message)
          setState((prev) => ({ ...prev, error: data.message }))
          callbacks.onError?.(data.message)
          break

        default:
          console.log('[VoiceConversation] Unknown message type:', data.type)
      }
    } catch (error) {
      console.error('[VoiceConversation] Failed to parse message:', error)
    }
  }, [])

  // Attempt reconnection
  const attemptReconnect = useCallback(() => {
    if (
      !shouldReconnectRef.current ||
      !connectionParamsRef.current ||
      !autoReconnect
    ) {
      return
    }

    setState((prev) => {
      if (prev.reconnectAttempts >= maxReconnectAttempts) {
        console.log('[VoiceConversation] Max reconnect attempts reached')
        callbacksRef.current.onError?.(
          'Connection lost. Please refresh the page.',
        )
        return {
          ...prev,
          isReconnecting: false,
          error: 'Connection lost. Please refresh the page.',
        }
      }

      const nextAttempt = prev.reconnectAttempts + 1
      const delay = reconnectDelay * Math.pow(2, nextAttempt - 1) // Exponential backoff

      console.log(
        `[VoiceConversation] Reconnecting in ${delay}ms (attempt ${nextAttempt})`,
      )
      callbacksRef.current.onReconnecting?.(nextAttempt)

      reconnectTimeoutRef.current = setTimeout(() => {
        if (connectionParamsRef.current && shouldReconnectRef.current) {
          const { sessionId, userId } = connectionParamsRef.current
          connectInternal(sessionId, userId)
        }
      }, delay)

      return {
        ...prev,
        isReconnecting: true,
        reconnectAttempts: nextAttempt,
      }
    })
  }, [autoReconnect, maxReconnectAttempts, reconnectDelay])

  // Internal connect function
  const connectInternal = useCallback(
    (sessionId: string, userId: string) => {
      // Clean up existing connection
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }

      setState((prev) => ({
        ...prev,
        isConnecting: true,
        error: null,
      }))

      // Build WebSocket URL
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const wsUrl = `${protocol}//${window.location.host}/api/ws/conversation`

      console.log(`[VoiceConversation] Connecting to ${wsUrl}`)

      try {
        const ws = new WebSocket(wsUrl)

        ws.onopen = () => {
          console.log('[VoiceConversation] Connected')
          wsRef.current = ws
          setState((prev) => ({
            ...prev,
            isConnected: true,
            isConnecting: false,
            isReconnecting: false,
            reconnectAttempts: 0,
            error: null,
          }))

          startPing()
          callbacksRef.current.onConnected?.()

          // Start session
          ws.send(
            JSON.stringify({
              type: 'start_session',
              sessionId,
              userId,
            }),
          )
        }

        ws.onmessage = handleMessage

        ws.onerror = (event) => {
          console.error('[VoiceConversation] WebSocket error:', event)
        }

        ws.onclose = (event) => {
          console.log(
            `[VoiceConversation] Disconnected: ${event.code} ${event.reason}`,
          )
          wsRef.current = null
          stopPing()

          setState((prev) => ({
            ...prev,
            isConnected: false,
            isConnecting: false,
          }))

          callbacksRef.current.onDisconnected?.()

          // Attempt reconnection if not intentional close
          if (
            shouldReconnectRef.current &&
            event.code !== 1000 &&
            event.code !== 1001
          ) {
            attemptReconnect()
          }
        }
      } catch (error) {
        console.error('[VoiceConversation] Failed to create WebSocket:', error)
        setState((prev) => ({
          ...prev,
          isConnecting: false,
          error: 'Failed to connect',
        }))
        callbacksRef.current.onError?.('Failed to connect')
      }
    },
    [handleMessage, startPing, stopPing, attemptReconnect],
  )

  // Public connect function
  const connect = useCallback(
    (sessionId: string, userId: string) => {
      shouldReconnectRef.current = true
      connectionParamsRef.current = { sessionId, userId }
      connectInternal(sessionId, userId)
    },
    [connectInternal],
  )

  // Disconnect
  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false
    connectionParamsRef.current = null

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    stopPing()

    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnected')
      wsRef.current = null
    }

    setState((prev) => ({
      ...prev,
      isConnected: false,
      isConnecting: false,
      isReconnecting: false,
      reconnectAttempts: 0,
      sessionId: null,
    }))
  }, [stopPing])

  // Send message
  const sendMessage = useCallback((text: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'user_message',
          text,
        }),
      )
    } else {
      console.warn('[VoiceConversation] Cannot send - not connected')
    }
  }, [])

  // Request greeting
  const requestGreeting = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'get_greeting' }))
    } else {
      console.warn(
        '[VoiceConversation] Cannot request greeting - not connected',
      )
    }
  }, [])

  // End session
  const endSession = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'end_session' }))
    }
    // Don't auto-reconnect after ending session
    shouldReconnectRef.current = false
  }, [])

  // Clear error
  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }))
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      shouldReconnectRef.current = false
      disconnect()
    }
  }, [disconnect])

  return [
    state,
    {
      connect,
      disconnect,
      sendMessage,
      requestGreeting,
      endSession,
      clearError,
    },
  ]
}
