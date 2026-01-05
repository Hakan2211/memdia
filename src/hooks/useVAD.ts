/**
 * useVAD Hook
 * Voice Activity Detection using @ricky0123/vad-react with Silero VAD
 *
 * Uses neural network-based speech detection for accurate barge-in detection.
 * This is much more reliable than simple audio level thresholds.
 */

import { useMicVAD, utils } from '@ricky0123/vad-react'
import { useCallback, useRef, useEffect } from 'react'

export interface UseVADOptions {
  /** Called when speech starts (user begins speaking) */
  onSpeechStart?: () => void
  /** Called when speech ends with the audio data */
  onSpeechEnd?: (audio: Float32Array, duration: number) => void
  /** Whether VAD should be active */
  enabled?: boolean
  /** Positive speech threshold (0-1, higher = less sensitive) */
  positiveSpeechThreshold?: number
  /** Negative speech threshold (0-1, lower = faster end detection) */
  negativeSpeechThreshold?: number
  /** Minimum speech duration in ms to trigger speech end (not misfire) */
  minSpeechMs?: number
  /** Duration in ms to wait after speech stops before triggering end */
  redemptionMs?: number
}

export interface VADState {
  /** Whether VAD is currently listening */
  isListening: boolean
  /** Whether user is currently speaking */
  isSpeaking: boolean
  /** Whether VAD is loading (model loading) */
  isLoading: boolean
  /** Error message if VAD failed to initialize */
  error: string | null
}

export interface VADActions {
  /** Start listening for speech */
  start: () => void
  /** Pause listening */
  pause: () => void
  /** Toggle listening on/off */
  toggle: () => void
}

export function useVAD(options: UseVADOptions = {}): [VADState, VADActions] {
  const {
    onSpeechStart,
    onSpeechEnd,
    enabled = true,
    // Tuned for conversational speech - not too sensitive
    positiveSpeechThreshold = 0.7,
    negativeSpeechThreshold = 0.35,
    minSpeechMs = 250, // Minimum 250ms of speech to count
    redemptionMs = 600, // Wait 600ms of silence before ending
  } = options

  // Use refs for callbacks to avoid stale closures
  const onSpeechStartRef = useRef(onSpeechStart)
  const onSpeechEndRef = useRef(onSpeechEnd)

  useEffect(() => {
    onSpeechStartRef.current = onSpeechStart
    onSpeechEndRef.current = onSpeechEnd
  }, [onSpeechStart, onSpeechEnd])

  // Track speech start time to calculate duration
  const speechStartTimeRef = useRef<number>(0)

  const vad = useMicVAD({
    startOnLoad: enabled,
    positiveSpeechThreshold,
    negativeSpeechThreshold,
    minSpeechMs,
    redemptionMs,
    onSpeechStart: () => {
      console.log('[VAD] Speech started')
      speechStartTimeRef.current = Date.now()
      onSpeechStartRef.current?.()
    },
    onSpeechEnd: (audio: Float32Array) => {
      const duration = (Date.now() - speechStartTimeRef.current) / 1000
      console.log(`[VAD] Speech ended (${duration.toFixed(2)}s)`)
      onSpeechEndRef.current?.(audio, duration)
    },
    onVADMisfire: () => {
      console.log('[VAD] Misfire (very short speech)')
    },
  })

  // Wrapper actions with logging
  const start = useCallback(() => {
    console.log('[VAD] Starting')
    vad.start()
  }, [vad])

  const pause = useCallback(() => {
    console.log('[VAD] Pausing')
    vad.pause()
  }, [vad])

  const toggle = useCallback(() => {
    console.log('[VAD] Toggling')
    vad.toggle()
  }, [vad])

  const state: VADState = {
    isListening: vad.listening,
    isSpeaking: vad.userSpeaking,
    isLoading: vad.loading,
    error: vad.errored ? String(vad.errored) : null,
  }

  const actions: VADActions = {
    start,
    pause,
    toggle,
  }

  return [state, actions]
}

/**
 * Convert Float32Array audio to WAV Blob for uploading
 */
export function audioToWav(audio: Float32Array, sampleRate = 16000): Blob {
  // The utils.encodeWAV returns an ArrayBuffer, wrap it in a Blob
  const wavBuffer = utils.encodeWAV(audio, sampleRate)
  return new Blob([wavBuffer], { type: 'audio/wav' })
}

/**
 * Convert Float32Array audio to base64 WAV
 */
export async function audioToBase64Wav(
  audio: Float32Array,
  sampleRate = 16000,
): Promise<string> {
  const wavBuffer = utils.encodeWAV(audio, sampleRate)
  const bytes = new Uint8Array(wavBuffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}
