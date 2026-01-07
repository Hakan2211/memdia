/**
 * useSpeechDetection Hook - SIMPLIFIED VERSION
 *
 * Uses Deepgram as the primary speech detection source.
 * VAD is only used for barge-in detection (interrupting AI).
 *
 * Key Features:
 * - Simple: Trust Deepgram's SpeechStarted/UtteranceEnd events
 * - Debounced UI state to prevent flickering
 * - VAD only for barge-in during AI speech
 * - Automatic transcript accumulation
 * - Audio chunk management for upload
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useVAD } from './useVAD'
import { useDeepgramSTT } from './useDeepgramSTT'
import { useAudioRecorder } from './useAudioRecorder'

// ============================================
// Types
// ============================================

export type MachineState = 'IDLE' | 'SPEAKING'
export type Confidence = 'none' | 'low' | 'high'

export interface UseSpeechDetectionOptions {
  // === Deepgram Settings ===
  language?: string
  model?: string

  // === VAD Settings (for barge-in only) ===
  positiveSpeechThreshold?: number
  negativeSpeechThreshold?: number
  minSpeechMs?: number
  redemptionMs?: number

  // === Debounce Timing ===
  /** Delay before showing speech indicator (ms). Default: 50 */
  startDelayMs?: number
  /** Delay before hiding speech indicator (ms). Default: 300 */
  endDelayMs?: number

  // === AI Awareness ===
  isAISpeaking?: boolean
  onBargeIn?: () => void

  // === Session Control ===
  enabled?: boolean

  // === Callbacks ===
  onSpeechStart?: () => void
  onSpeechEnd?: () => void
  onUtteranceEnd?: (transcript: string, audioBase64?: string) => void
  onInterimTranscript?: (text: string) => void
  onError?: (error: Error) => void
}

export interface SpeechDetectionState {
  isSpeaking: boolean
  interimTranscript: string
  accumulatedTranscript: string
  isConnected: boolean
  isConnecting: boolean
  isVADReady: boolean
  isRecording: boolean
  machineState: MachineState
  vadIsSpeaking: boolean
  deepgramIsSpeaking: boolean
  confidence: Confidence
  error: string | null
}

export interface SpeechDetectionActions {
  connect: () => Promise<void>
  disconnect: () => void
  startRecording: () => Promise<void>
  stopRecording: () => void
  getAudioBase64: () => string | undefined
  startKeepalive: () => void
  stopKeepalive: () => void
  startVAD: () => void
  pauseVAD: () => void
  clearTranscripts: () => void
}

// ============================================
// Helper: Create WAV from PCM
// ============================================

function createWavFromPcm(
  pcmData: Int16Array,
  sampleRate: number = 16000,
): ArrayBuffer {
  const numChannels = 1
  const bitsPerSample = 16
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8)
  const blockAlign = numChannels * (bitsPerSample / 8)
  const dataSize = pcmData.length * 2

  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i))
    }
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)
  writeString(36, 'data')
  view.setUint32(40, dataSize, true)

  const pcmOffset = 44
  for (let i = 0; i < pcmData.length; i++) {
    view.setInt16(pcmOffset + i * 2, pcmData[i], true)
  }

  return buffer
}

// ============================================
// Main Hook
// ============================================

export function useSpeechDetection(
  options: UseSpeechDetectionOptions = {},
): [SpeechDetectionState, SpeechDetectionActions] {
  const {
    language = 'multi',
    model = 'nova-3',
    positiveSpeechThreshold = 0.8,
    negativeSpeechThreshold = 0.35,
    minSpeechMs = 250,
    redemptionMs = 800,
    startDelayMs = 50,
    endDelayMs = 300,
    isAISpeaking = false,
    onBargeIn,
    enabled = true,
    onSpeechStart,
    onSpeechEnd,
    onUtteranceEnd,
    onInterimTranscript,
    onError,
  } = options

  // Callbacks ref to avoid stale closures
  const callbacksRef = useRef({
    onSpeechStart,
    onSpeechEnd,
    onUtteranceEnd,
    onInterimTranscript,
    onBargeIn,
    onError,
  })

  useEffect(() => {
    callbacksRef.current = {
      onSpeechStart,
      onSpeechEnd,
      onUtteranceEnd,
      onInterimTranscript,
      onBargeIn,
      onError,
    }
  }, [
    onSpeechStart,
    onSpeechEnd,
    onUtteranceEnd,
    onInterimTranscript,
    onBargeIn,
    onError,
  ])

  // AI speaking state
  const isAISpeakingRef = useRef(isAISpeaking)
  useEffect(() => {
    isAISpeakingRef.current = isAISpeaking
  }, [isAISpeaking])

  // Simple state: IDLE or SPEAKING
  const [machineState, setMachineState] = useState<MachineState>('IDLE')

  // Debounce timers
  const startTimerRef = useRef<NodeJS.Timeout | null>(null)
  const endTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Transcript accumulation
  const accumulatedTranscriptRef = useRef('')
  const [accumulatedTranscript, setAccumulatedTranscript] = useState('')

  // Audio chunks for upload
  const audioChunksRef = useRef<Int16Array[]>([])

  // Raw signal tracking (for debug display)
  const [vadIsSpeaking, setVadIsSpeaking] = useState(false)
  const [deepgramIsSpeaking, setDeepgramIsSpeaking] = useState(false)

  // Debounced UI state
  const [isSpeaking, setIsSpeaking] = useState(false)

  // Interim transcript
  const [interimTranscript, setInterimTranscript] = useState('')

  // Error state
  const [error, setError] = useState<string | null>(null)

  // ==========================================
  // Helper: Clear timers
  // ==========================================
  const clearTimers = useCallback(() => {
    if (startTimerRef.current) {
      clearTimeout(startTimerRef.current)
      startTimerRef.current = null
    }
    if (endTimerRef.current) {
      clearTimeout(endTimerRef.current)
      endTimerRef.current = null
    }
  }, [])

  // ==========================================
  // Helper: Get audio as base64 WAV
  // ==========================================
  const getAudioBase64 = useCallback((): string | undefined => {
    if (audioChunksRef.current.length === 0) return undefined

    const totalLength = audioChunksRef.current.reduce(
      (acc, chunk) => acc + chunk.length,
      0,
    )
    if (totalLength === 0) return undefined

    const combined = new Int16Array(totalLength)
    let offset = 0
    for (const chunk of audioChunksRef.current) {
      combined.set(chunk, offset)
      offset += chunk.length
    }

    const wavBuffer = createWavFromPcm(combined, 16000)
    const uint8Array = new Uint8Array(wavBuffer)
    let binary = ''
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i])
    }
    return btoa(binary)
  }, [])

  // ==========================================
  // VAD Hook - ONLY for barge-in detection
  // ==========================================
  const [vadState, vadActions] = useVAD({
    enabled: enabled && isAISpeaking, // Only active during AI speech!
    positiveSpeechThreshold,
    negativeSpeechThreshold,
    minSpeechMs,
    redemptionMs,
    onSpeechStart: () => {
      console.log('[SpeechDetection] VAD: speech started (barge-in check)')
      setVadIsSpeaking(true)
      // Trigger barge-in if AI is speaking
      if (isAISpeakingRef.current) {
        console.log('[SpeechDetection] BARGE-IN TRIGGERED!')
        callbacksRef.current.onBargeIn?.()
      }
    },
    onSpeechEnd: () => {
      console.log('[SpeechDetection] VAD: speech ended')
      setVadIsSpeaking(false)
    },
  })

  // ==========================================
  // Deepgram STT Hook - PRIMARY speech detection
  // ==========================================
  const [sttState, sttActions] = useDeepgramSTT({
    language,
    model,
    onFinalTranscript: (transcript) => {
      console.log(
        `[SpeechDetection] Deepgram final: "${transcript.substring(0, 50)}"`,
      )
      // Accumulate transcripts
      accumulatedTranscriptRef.current +=
        (accumulatedTranscriptRef.current ? ' ' : '') + transcript
      setAccumulatedTranscript(accumulatedTranscriptRef.current)
      setInterimTranscript('')
    },
    onSpeechStart: () => {
      // Ignore if AI is speaking
      if (isAISpeakingRef.current) {
        console.log(
          '[SpeechDetection] Deepgram speech started (ignored - AI speaking)',
        )
        return
      }

      console.log('[SpeechDetection] Deepgram: speech started')
      setDeepgramIsSpeaking(true)

      // Debounced transition to SPEAKING
      clearTimers()
      startTimerRef.current = setTimeout(() => {
        if (!isAISpeakingRef.current) {
          console.log('[SpeechDetection] -> SPEAKING')
          setMachineState('SPEAKING')
          setIsSpeaking(true)
          callbacksRef.current.onSpeechStart?.()
        }
      }, startDelayMs)
    },
    onSpeechEnd: () => {
      console.log('[SpeechDetection] Deepgram: speech ended (UtteranceEnd)')
      setDeepgramIsSpeaking(false)

      // If AI is speaking, just ignore
      if (isAISpeakingRef.current) {
        return
      }

      // Debounced transition to IDLE + send utterance
      clearTimers()
      endTimerRef.current = setTimeout(() => {
        console.log('[SpeechDetection] -> IDLE (utterance complete)')
        setMachineState('IDLE')
        setIsSpeaking(false)
        callbacksRef.current.onSpeechEnd?.()

        // Fire utterance end with accumulated transcript
        const transcript = accumulatedTranscriptRef.current.trim()
        if (transcript) {
          const audioBase64 = getAudioBase64()
          console.log(
            `[SpeechDetection] onUtteranceEnd: "${transcript.substring(0, 50)}..."`,
          )
          callbacksRef.current.onUtteranceEnd?.(transcript, audioBase64)
        }

        // Clear accumulated data
        accumulatedTranscriptRef.current = ''
        setAccumulatedTranscript('')
        audioChunksRef.current = []
        setInterimTranscript('')
      }, endDelayMs)
    },
    onError: (err) => {
      console.error('[SpeechDetection] Deepgram error:', err)
      setError(err.message)
      callbacksRef.current.onError?.(err)
    },
  })

  // Update interim transcript
  useEffect(() => {
    if (sttState.interimTranscript) {
      setInterimTranscript(sttState.interimTranscript)
      callbacksRef.current.onInterimTranscript?.(sttState.interimTranscript)
    }
  }, [sttState.interimTranscript])

  // ==========================================
  // Audio Recorder Hook
  // ==========================================
  const [recorderState, recorderActions] = useAudioRecorder({
    onPCMData: (pcmData) => {
      // Always send audio to Deepgram (even during AI speech for keepalive)
      if (sttState.isConnected) {
        sttActions.sendAudio(pcmData)
      }
      // Accumulate audio chunks when not AI speaking
      if (!isAISpeakingRef.current) {
        const pcmArray = new Int16Array(pcmData)
        audioChunksRef.current.push(pcmArray)
      }
    },
  })

  // ==========================================
  // Reset state when AI starts speaking
  // ==========================================
  useEffect(() => {
    if (isAISpeaking) {
      console.log('[SpeechDetection] AI started speaking - resetting state')
      clearTimers()
      setMachineState('IDLE')
      setIsSpeaking(false)
      setDeepgramIsSpeaking(false)
      // Keep accumulated transcript in case user was mid-sentence
    }
  }, [isAISpeaking, clearTimers])

  // ==========================================
  // Compute confidence (for debug)
  // ==========================================
  const confidence: Confidence = useMemo(() => {
    if (vadIsSpeaking && deepgramIsSpeaking) return 'high'
    if (vadIsSpeaking || deepgramIsSpeaking) return 'low'
    return 'none'
  }, [vadIsSpeaking, deepgramIsSpeaking])

  // ==========================================
  // Build State
  // ==========================================
  const state: SpeechDetectionState = {
    isSpeaking,
    interimTranscript,
    accumulatedTranscript,
    isConnected: sttState.isConnected,
    isConnecting: sttState.isConnecting,
    isVADReady: !vadState.isLoading && !vadState.error,
    isRecording: recorderState.isRecording,
    machineState,
    vadIsSpeaking,
    deepgramIsSpeaking,
    confidence,
    error: error || sttState.error || vadState.error,
  }

  // ==========================================
  // Build Actions
  // ==========================================
  const actions: SpeechDetectionActions = useMemo(
    () => ({
      connect: sttActions.connect,
      disconnect: () => {
        clearTimers()
        sttActions.disconnect()
        recorderActions.stopRecording()
        vadActions.pause()
        setMachineState('IDLE')
        setIsSpeaking(false)
        setVadIsSpeaking(false)
        setDeepgramIsSpeaking(false)
        accumulatedTranscriptRef.current = ''
        setAccumulatedTranscript('')
        audioChunksRef.current = []
        setInterimTranscript('')
      },
      startRecording: recorderActions.startRecording,
      stopRecording: recorderActions.stopRecording,
      getAudioBase64,
      startKeepalive: sttActions.startKeepalive,
      stopKeepalive: sttActions.stopKeepalive,
      startVAD: vadActions.start,
      pauseVAD: vadActions.pause,
      clearTranscripts: () => {
        accumulatedTranscriptRef.current = ''
        setAccumulatedTranscript('')
        setInterimTranscript('')
        sttActions.clearTranscripts()
      },
    }),
    [sttActions, recorderActions, vadActions, getAudioBase64, clearTimers],
  )

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimers()
    }
  }, [clearTimers])

  return [state, actions]
}
