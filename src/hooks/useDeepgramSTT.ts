/**
 * useDeepgramSTT Hook
 * Handles real-time speech-to-text using Deepgram WebSocket API
 *
 * Uses nova-3 model with proper browser WebSocket authentication
 */

import { useState, useCallback, useRef, useEffect } from 'react'
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
}

export interface DeepgramSTTActions {
  /** Start the STT connection */
  connect: () => Promise<void>
  /** Stop the STT connection */
  disconnect: () => void
  /** Send audio data to Deepgram */
  sendAudio: (audioData: ArrayBuffer) => void
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
  /** Deepgram API key (optional - will fetch from server if not provided) */
  apiKey?: string
  /** Model to use (default: nova-3) */
  model?: string
  /**
   * Language code for speech recognition (default: 'multi')
   * - 'multi': Automatic language detection with code-switching support
   *   Supports: en, es, fr, de, hi, ru, pt, ja, it, nl
   * - Or use a specific ISO 639-1 code like 'en', 'es', etc.
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
  })

  const wsRef = useRef<WebSocket | null>(null)
  const apiKeyRef = useRef<string | null>(null)

  // Store callbacks in refs to avoid dependency issues
  const callbacksRef = useRef({
    onFinalTranscript,
    onSpeechStart,
    onSpeechEnd,
    onError,
  })
  callbacksRef.current = {
    onFinalTranscript,
    onSpeechStart,
    onSpeechEnd,
    onError,
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

            if (transcript) {
              if (isFinal) {
                console.log('[Deepgram] Final transcript:', transcript)
                setState((prev) => ({
                  ...prev,
                  finalTranscript: transcript,
                  interimTranscript: '',
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
        endpointing: '300',
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
        setState((prev) => ({
          ...prev,
          isConnected: true,
          isConnecting: false,
          error: null,
        }))
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
    }
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

    setState((prev) => ({
      ...prev,
      isConnected: false,
      isConnecting: false,
      isSpeaking: false,
    }))
  }, [])

  // Send audio data to Deepgram
  const sendAudio = useCallback((audioData: ArrayBuffer) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(audioData)
    } else {
      console.warn('[Deepgram] Cannot send audio - not connected')
    }
  }, [])

  // Clear transcripts
  const clearTranscripts = useCallback(() => {
    setState((prev) => ({
      ...prev,
      interimTranscript: '',
      finalTranscript: '',
    }))
  }, [])

  return [
    state,
    {
      connect,
      disconnect,
      sendAudio,
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
          channelData[srcIndexFloor]! * (1 - fraction) +
          channelData[srcIndexCeil]! * fraction
      }
    }

    // Convert float32 to int16
    const int16Array = new Int16Array(samples.length)
    for (let i = 0; i < samples.length; i++) {
      // Clamp and convert
      const sample = Math.max(-1, Math.min(1, samples[i]!))
      int16Array[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff
    }

    return int16Array.buffer
  } finally {
    await audioContext.close()
  }
}
