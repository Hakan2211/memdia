/**
 * useDeepgramSTT Hook
 * Handles real-time speech-to-text using Deepgram WebSocket API
 *
 * Uses nova-3 model with proper browser WebSocket authentication
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { getDeepgramKeyFn } from '../server/deepgram.fn'

export interface DeepgramSTTState {
  /** Whether the STT is connected */
  isConnected: boolean
  /** Whether it's connecting */
  isConnecting: boolean
  /** Current interim transcript (partial result) */
  interimTranscript: string
  /** Final transcript from last utterance */
  finalTranscript: string
  /** Error message if any */
  error: string | null
  /** Whether speech is currently detected */
  isSpeaking: boolean
  /** Whether Deepgram is in a degraded state (receiving audio but not transcribing) */
  isDegraded: boolean
}

export interface DeepgramSTTActions {
  /** Start the STT connection */
  connect: () => Promise<void>
  /** Stop the STT connection */
  disconnect: () => void
  /** Send audio data to Deepgram */
  sendAudio: (audioData: ArrayBuffer) => void
  /** Send KeepAlive message to prevent timeout (use during AI speech) */
  sendKeepalive: () => void
  /** Start automatic keepalive interval (call when AI starts speaking) */
  startKeepalive: () => void
  /** Stop automatic keepalive interval (call when AI stops speaking) */
  stopKeepalive: () => void
  /** Clear the transcripts */
  clearTranscripts: () => void
}

export interface UseDeepgramSTTOptions {
  /** Called when a final transcript is received */
  onFinalTranscript?: (transcript: string) => void
  /** Called when speech starts */
  onSpeechStart?: () => void
  /** Called when speech ends (utterance complete) */
  onSpeechEnd?: () => void
  /** Called on any error */
  onError?: (error: Error) => void
  /** Called when Deepgram enters degraded state (receiving audio but not transcribing) */
  onDegradedState?: () => void
  /** Deepgram API key (optional - will fetch from server if not provided) */
  apiKey?: string
  /** Model to use (default: nova-3) */
  model?: string
  /**
   * Language parameter for Deepgram speech recognition
   *
   * This should be pre-processed using getDeepgramLanguageParam():
   * - 'multi': For multilingual languages (en, es, fr, de, it, pt, nl, ja, ru, hi)
   *   Enables automatic language detection with code-switching support
   * - Specific language code (e.g., 'tr', 'ko', 'pl'): For monolingual transcription
   *   Used for languages that don't support code-switching
   *
   * @example
   * // For multilingual languages (e.g., user selected 'en', 'es', 'fr')
   * language: 'multi'
   *
   * // For monolingual languages (e.g., user selected 'tr', 'ko', 'pl')
   * language: 'tr'
   */
  language?: string
}

// Deepgram WebSocket URL
const DEEPGRAM_WS_URL = 'wss://api.deepgram.com/v1/listen'

export function useDeepgramSTT(
  options: UseDeepgramSTTOptions = {},
): [DeepgramSTTState, DeepgramSTTActions] {
  const {
    onFinalTranscript,
    onSpeechStart,
    onSpeechEnd,
    onError,
    onDegradedState,
    apiKey,
    model = 'nova-3',
    // Use 'multi' for automatic language detection and code-switching
    // Supports: English, Spanish, French, German, Hindi, Russian, Portuguese, Japanese, Italian, Dutch
    language = 'multi',
  } = options

  const [state, setState] = useState<DeepgramSTTState>({
    isConnected: false,
    isConnecting: false,
    interimTranscript: '',
    finalTranscript: '',
    error: null,
    isSpeaking: false,
    isDegraded: false,
  })

  const wsRef = useRef<WebSocket | null>(null)
  const apiKeyRef = useRef<string | null>(null)
  const keepaliveIntervalRef = useRef<NodeJS.Timeout | null>(null)
  // Timer for delayed keepalive stop - gives Deepgram time to transition after AI stops speaking
  const keepaliveStopTimerRef = useRef<NodeJS.Timeout | null>(null)
  // Track consecutive empty transcripts to detect degraded state
  const emptyTranscriptCountRef = useRef<number>(0)
  const DEGRADED_THRESHOLD = 3 // Number of consecutive empty is_final results to trigger degraded state
  // Grace period after AI stops speaking before stopping keepalives (ms)
  // This gives Deepgram time to transition from "keepalive mode" to "listening mode"
  const KEEPALIVE_GRACE_PERIOD = 2000

  // Store callbacks in refs to avoid dependency issues
  const callbacksRef = useRef({
    onFinalTranscript,
    onSpeechStart,
    onSpeechEnd,
    onError,
    onDegradedState,
  })
  callbacksRef.current = {
    onFinalTranscript,
    onSpeechStart,
    onSpeechEnd,
    onError,
    onDegradedState,
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
    }
  }, [])

  // Handle incoming Deepgram messages
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data)
      const type = data.type as string

      console.log('[Deepgram] Message received:', type, data)

      switch (type) {
        case 'Results': {
          const channel = data.channel?.alternatives?.[0]

          if (channel) {
            const transcript = channel.transcript || ''
            const isFinal = data.is_final || false
            const speechFinal = data.speech_final || false

            // Track consecutive empty is_final results to detect degraded state
            if (isFinal && !transcript) {
              emptyTranscriptCountRef.current++
              console.warn(
                `[Deepgram] Received is_final=true but EMPTY transcript (${emptyTranscriptCountRef.current}/${DEGRADED_THRESHOLD}) - potential degraded state`,
              )

              // Check if we've hit the degraded threshold
              if (emptyTranscriptCountRef.current >= DEGRADED_THRESHOLD) {
                console.error(
                  '[Deepgram] DEGRADED STATE DETECTED - Deepgram is not transcribing',
                )
                setState((prev) => ({ ...prev, isDegraded: true }))
                callbacksRef.current.onDegradedState?.()
              }
            }

            if (transcript) {
              // Reset empty transcript counter when we get a real transcript
              emptyTranscriptCountRef.current = 0

              // Clear degraded state if we were in it
              setState((prev) =>
                prev.isDegraded ? { ...prev, isDegraded: false } : prev,
              )

              if (isFinal) {
                console.log('[Deepgram] Final transcript:', transcript)
                setState((prev) => ({
                  ...prev,
                  finalTranscript: transcript,
                  interimTranscript: '',
                  isDegraded: false, // Also clear here for good measure
                }))
                callbacksRef.current.onFinalTranscript?.(transcript)

                // If speech_final is true, this is the end of an utterance
                if (speechFinal) {
                  console.log('[Deepgram] Speech final - utterance complete')
                  setState((prev) => ({ ...prev, isSpeaking: false }))
                  callbacksRef.current.onSpeechEnd?.()
                }
              } else {
                setState((prev) => ({
                  ...prev,
                  interimTranscript: transcript,
                  isSpeaking: true,
                }))
              }
            }
          }
          break
        }

        case 'SpeechStarted': {
          console.log('[Deepgram] Speech started')
          setState((prev) => ({ ...prev, isSpeaking: true }))
          callbacksRef.current.onSpeechStart?.()
          break
        }

        case 'UtteranceEnd': {
          console.log('[Deepgram] Utterance ended')
          setState((prev) => ({ ...prev, isSpeaking: false }))
          callbacksRef.current.onSpeechEnd?.()
          break
        }

        case 'Error': {
          const message =
            data.message || data.description || 'Unknown Deepgram error'
          console.error('[Deepgram] Error:', message)
          const error = new Error(message)
          setState((prev) => ({ ...prev, error: message }))
          callbacksRef.current.onError?.(error)
          break
        }

        case 'Metadata':
          console.log('[Deepgram] Metadata:', data)
          break

        default:
          console.log('[Deepgram] Unknown message type:', type)
          break
      }
    } catch (error) {
      console.error('[Deepgram] Failed to parse message:', error)
    }
  }, [])

  // Connect to Deepgram
  const connect = useCallback(async () => {
    // Don't connect if already connected or connecting
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('[Deepgram] Already connected')
      return
    }

    // Fetch API key from server if not provided
    let key = apiKey || apiKeyRef.current

    if (!key) {
      try {
        console.log('[Deepgram] Fetching API key from server...')
        const result = await getDeepgramKeyFn()
        key = result.apiKey || null
        apiKeyRef.current = key
        if (result.error) {
          console.warn('[Deepgram] Server warning:', result.error)
        }
      } catch (error) {
        console.error('[Deepgram] Failed to fetch API key:', error)
      }
    }

    if (!key) {
      console.log('[Deepgram] No API key available')
      setState((prev) => ({
        ...prev,
        isConnected: false,
        isConnecting: false,
        error: 'Voice input unavailable - use text input',
      }))
      return
    }

    setState((prev) => ({ ...prev, isConnecting: true, error: null }))

    // Return a Promise that resolves when WebSocket is fully open
    return new Promise<void>((resolve, reject) => {
      try {
        // Build WebSocket URL with query parameters
        const params = new URLSearchParams({
          model,
          language,
          punctuate: 'true',
          smart_format: 'true',
          interim_results: 'true',
          utterance_end_ms: '1500',
          vad_events: 'true',
          endpointing: '400', // Increased from 300ms to reduce premature utterance endings
          // Audio format - we'll send raw PCM
          encoding: 'linear16',
          sample_rate: '16000',
          channels: '1',
        })

        const wsUrl = `${DEEPGRAM_WS_URL}?${params.toString()}`
        console.log('[Deepgram] Connecting to Deepgram...')

        // Create WebSocket with token protocol for browser authentication
        // This is Deepgram's recommended way for browser clients
        const ws = new WebSocket(wsUrl, ['token', key])

        ws.onopen = () => {
          console.log('[Deepgram] WebSocket connected!')
          // Reset degraded state on new connection
          emptyTranscriptCountRef.current = 0
          setState((prev) => ({
            ...prev,
            isConnected: true,
            isConnecting: false,
            error: null,
            isDegraded: false,
          }))
          resolve() // Resolve the promise when connection is established
        }

        ws.onmessage = handleMessage

        ws.onerror = (event) => {
          console.error('[Deepgram] WebSocket error:', event)
          setState((prev) => ({
            ...prev,
            error: 'Connection error',
            isConnecting: false,
            isConnected: false,
          }))
          callbacksRef.current.onError?.(new Error('Deepgram connection error'))
          reject(new Error('Deepgram connection error'))
        }

        ws.onclose = (event) => {
          console.log('[Deepgram] WebSocket closed:', event.code, event.reason)
          setState((prev) => ({
            ...prev,
            isConnected: false,
            isConnecting: false,
          }))
        }

        wsRef.current = ws
      } catch (error) {
        console.error('[Deepgram] Failed to connect:', error)
        const err =
          error instanceof Error ? error : new Error('Connection failed')
        setState((prev) => ({
          ...prev,
          error: err.message,
          isConnecting: false,
        }))
        callbacksRef.current.onError?.(err)
        reject(err)
      }
    })
  }, [apiKey, model, language, handleMessage])

  // Disconnect from Deepgram
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      console.log('[Deepgram] Disconnecting...')
      if (wsRef.current.readyState === WebSocket.OPEN) {
        try {
          // Send close stream message
          wsRef.current.send(JSON.stringify({ type: 'CloseStream' }))
        } catch {
          // Ignore errors when closing
        }
        wsRef.current.close()
      }
      wsRef.current = null
    }

    // Reset degraded state counter on disconnect
    emptyTranscriptCountRef.current = 0

    setState((prev) => ({
      ...prev,
      isConnected: false,
      isConnecting: false,
      isSpeaking: false,
      isDegraded: false,
    }))
  }, [])

  // Send audio data to Deepgram
  const sendAudio = useCallback((audioData: ArrayBuffer) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(audioData)
    } else {
      // Only log once per second to avoid spam
      const now = Date.now()
      if (!sendAudio.lastWarnTime || now - sendAudio.lastWarnTime > 1000) {
        console.warn(
          '[Deepgram] Cannot send audio - WebSocket state:',
          wsRef.current?.readyState,
          '(0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED)',
        )
        sendAudio.lastWarnTime = now
      }
    }
  }, []) as { (audioData: ArrayBuffer): void; lastWarnTime?: number }

  // Clear transcripts
  const clearTranscripts = useCallback(() => {
    setState((prev) => ({
      ...prev,
      interimTranscript: '',
      finalTranscript: '',
    }))
  }, [])

  // Send a single KeepAlive message to Deepgram
  // This prevents the connection from timing out when no audio is being sent
  const sendKeepalive = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({ type: 'KeepAlive' }))
        console.log('[Deepgram] KeepAlive sent')
      } catch (error) {
        console.warn('[Deepgram] Failed to send KeepAlive:', error)
      }
    }
  }, [])

  // Start automatic keepalive interval (every 5 seconds)
  // Call this when AI starts speaking to prevent timeout
  const startKeepalive = useCallback(() => {
    // Cancel any pending delayed stop - AI is speaking again
    if (keepaliveStopTimerRef.current) {
      console.log(
        '[Deepgram] Cancelling pending keepalive stop - AI speaking again',
      )
      clearTimeout(keepaliveStopTimerRef.current)
      keepaliveStopTimerRef.current = null
    }

    // Clear any existing interval
    if (keepaliveIntervalRef.current) {
      clearInterval(keepaliveIntervalRef.current)
    }

    console.log('[Deepgram] Starting keepalive interval')

    // Send immediately, then every 5 seconds
    sendKeepalive()
    keepaliveIntervalRef.current = setInterval(() => {
      sendKeepalive()
    }, 5000) // Deepgram timeout is ~10 seconds, so 5 seconds is safe
  }, [sendKeepalive])

  // Stop automatic keepalive interval with grace period
  // Call this when AI stops speaking
  // The grace period gives Deepgram time to transition from "keepalive mode" back to
  // "active listening mode" - without this, if user speaks immediately after AI,
  // Deepgram returns empty transcripts (degraded state)
  const stopKeepalive = useCallback(() => {
    // Cancel any existing delayed stop timer
    if (keepaliveStopTimerRef.current) {
      clearTimeout(keepaliveStopTimerRef.current)
      keepaliveStopTimerRef.current = null
    }

    console.log(
      `[Deepgram] Scheduling keepalive stop in ${KEEPALIVE_GRACE_PERIOD}ms`,
    )

    // Delay the actual stop to give Deepgram time to transition
    keepaliveStopTimerRef.current = setTimeout(() => {
      if (keepaliveIntervalRef.current) {
        console.log(
          '[Deepgram] Stopping keepalive interval (after grace period)',
        )
        clearInterval(keepaliveIntervalRef.current)
        keepaliveIntervalRef.current = null
      }
      keepaliveStopTimerRef.current = null
    }, KEEPALIVE_GRACE_PERIOD)
  }, [])

  // Clean up keepalive interval and timers on unmount
  useEffect(() => {
    return () => {
      if (keepaliveIntervalRef.current) {
        clearInterval(keepaliveIntervalRef.current)
        keepaliveIntervalRef.current = null
      }
      if (keepaliveStopTimerRef.current) {
        clearTimeout(keepaliveStopTimerRef.current)
        keepaliveStopTimerRef.current = null
      }
    }
  }, [])

  return [
    state,
    {
      connect,
      disconnect,
      sendAudio,
      sendKeepalive,
      startKeepalive,
      stopKeepalive,
      clearTranscripts,
    },
  ]
}

/**
 * Convert audio blob to linear16 PCM format for Deepgram
 * Deepgram expects 16-bit PCM audio at 16kHz mono
 */
export async function convertToLinear16(
  audioBlob: Blob,
  targetSampleRate: number = 16000,
): Promise<ArrayBuffer> {
  // Create audio context with target sample rate
  const audioContext = new AudioContext({ sampleRate: targetSampleRate })

  try {
    const arrayBuffer = await audioBlob.arrayBuffer()

    // Try to decode the audio data
    let audioBuffer: AudioBuffer
    try {
      audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
    } catch (decodeError) {
      console.warn(
        '[Audio] Failed to decode audio, returning empty buffer:',
        decodeError,
      )
      // Return empty buffer if decoding fails
      return new ArrayBuffer(0)
    }

    // Get the audio data (mono - use first channel)
    const channelData = audioBuffer.getChannelData(0)

    // If sample rates don't match, we need to resample
    let samples = channelData
    if (audioBuffer.sampleRate !== targetSampleRate) {
      // Simple linear interpolation resampling
      const ratio = audioBuffer.sampleRate / targetSampleRate
      const newLength = Math.floor(channelData.length / ratio)
      samples = new Float32Array(newLength)
      for (let i = 0; i < newLength; i++) {
        const srcIndex = i * ratio
        const srcIndexFloor = Math.floor(srcIndex)
        const srcIndexCeil = Math.min(srcIndexFloor + 1, channelData.length - 1)
        const fraction = srcIndex - srcIndexFloor
        samples[i] =
          channelData[srcIndexFloor] * (1 - fraction) +
          channelData[srcIndexCeil] * fraction
      }
    }

    // Convert float32 to int16
    const int16Array = new Int16Array(samples.length)
    for (let i = 0; i < samples.length; i++) {
      // Clamp and convert
      const sample = Math.max(-1, Math.min(1, samples[i]))
      int16Array[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff
    }

    return int16Array.buffer
  } finally {
    await audioContext.close()
  }
}
