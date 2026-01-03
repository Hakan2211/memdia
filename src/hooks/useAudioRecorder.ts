/**
 * useAudioRecorder Hook
 * Handles microphone audio capture and streaming with direct PCM output
 *
 * Outputs raw 16-bit PCM audio at 16kHz suitable for Deepgram
 */

import { useState, useCallback, useRef, useEffect } from 'react'

export interface AudioRecorderState {
  /** Whether the recorder is currently recording */
  isRecording: boolean
  /** Whether the microphone is muted */
  isMuted: boolean
  /** Whether the recorder is initializing */
  isInitializing: boolean
  /** Current audio level (0-1) for visualization */
  audioLevel: number
  /** Error message if any */
  error: string | null
  /** Whether microphone permission is granted */
  hasPermission: boolean
}

export interface AudioRecorderActions {
  /** Start recording audio */
  startRecording: () => Promise<void>
  /** Stop recording audio */
  stopRecording: () => void
  /** Toggle mute state */
  toggleMute: () => void
  /** Request microphone permission */
  requestPermission: () => Promise<boolean>
}

export interface UseAudioRecorderOptions {
  /** Callback when audio chunk is available (raw PCM Int16Array buffer) */
  onAudioChunk?: (chunk: Blob) => void
  /** Callback when raw PCM data is available (for Deepgram) */
  onPCMData?: (pcmData: ArrayBuffer) => void
  /** Callback when speech is detected (voice activity) */
  onSpeechStart?: () => void
  /** Callback when speech ends (silence detected) */
  onSpeechEnd?: () => void
  /** Audio chunk interval in milliseconds */
  chunkInterval?: number
  /** Sample rate for audio (default 16000 for Deepgram) */
  sampleRate?: number
}

// Target sample rate for Deepgram
const TARGET_SAMPLE_RATE = 16000

export function useAudioRecorder(
  options: UseAudioRecorderOptions = {},
): [AudioRecorderState, AudioRecorderActions] {
  const {
    onAudioChunk,
    onPCMData,
    onSpeechStart,
    onSpeechEnd,
    chunkInterval = 250,
  } = options

  const [state, setState] = useState<AudioRecorderState>({
    isRecording: false,
    isMuted: false,
    isInitializing: false,
    audioLevel: 0,
    error: null,
    hasPermission: false,
  })

  const mediaStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const isSpeakingRef = useRef(false)
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isMutedRef = useRef(false)
  const pcmBufferRef = useRef<Int16Array[]>([])
  const lastChunkTimeRef = useRef<number>(0)

  // Store callbacks in refs to avoid stale closures
  const callbacksRef = useRef({
    onAudioChunk,
    onPCMData,
    onSpeechStart,
    onSpeechEnd,
  })
  callbacksRef.current = { onAudioChunk, onPCMData, onSpeechStart, onSpeechEnd }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording()
    }
  }, [])

  // Request microphone permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })

      // Stop the stream immediately - we just wanted to check permission
      stream.getTracks().forEach((track) => track.stop())

      setState((prev) => ({ ...prev, hasPermission: true, error: null }))
      return true
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Microphone permission denied'
      setState((prev) => ({
        ...prev,
        hasPermission: false,
        error: message,
      }))
      return false
    }
  }, [])

  // Analyze audio levels for visualization and VAD
  const analyzeAudio = useCallback(() => {
    if (!analyserRef.current) return

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
    analyserRef.current.getByteFrequencyData(dataArray)

    // Calculate average level
    const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
    const normalizedLevel = average / 255

    setState((prev) => ({ ...prev, audioLevel: normalizedLevel }))

    // Simple Voice Activity Detection
    const speechThreshold = 0.08 // Lowered threshold for better detection
    const isSpeaking = normalizedLevel > speechThreshold

    if (isSpeaking && !isSpeakingRef.current) {
      isSpeakingRef.current = true
      callbacksRef.current.onSpeechStart?.()

      // Clear any pending silence timeout
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current)
        silenceTimeoutRef.current = null
      }
    } else if (!isSpeaking && isSpeakingRef.current) {
      // Wait for sustained silence before triggering end
      if (!silenceTimeoutRef.current) {
        silenceTimeoutRef.current = setTimeout(() => {
          isSpeakingRef.current = false
          callbacksRef.current.onSpeechEnd?.()
          silenceTimeoutRef.current = null
        }, 1500) // 1.5 seconds of silence
      }
    }

    animationFrameRef.current = requestAnimationFrame(analyzeAudio)
  }, [])

  // Start recording
  const startRecording = useCallback(async () => {
    setState((prev) => ({ ...prev, isInitializing: true, error: null }))

    try {
      // Get microphone stream
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          // Request higher sample rate, we'll downsample
          sampleRate: { ideal: 48000 },
        },
      })

      mediaStreamRef.current = stream

      // Create audio context - browser will use its preferred sample rate
      const audioContext = new AudioContext()
      audioContextRef.current = audioContext

      console.log(
        '[AudioRecorder] Audio context sample rate:',
        audioContext.sampleRate,
      )

      const source = audioContext.createMediaStreamSource(stream)

      // Setup analyser for visualization
      analyserRef.current = audioContext.createAnalyser()
      analyserRef.current.fftSize = 256
      source.connect(analyserRef.current)

      // Setup ScriptProcessor for PCM capture
      // Buffer size of 4096 samples at native sample rate
      const bufferSize = 4096
      const processor = audioContext.createScriptProcessor(bufferSize, 1, 1)
      processorRef.current = processor

      // Calculate resampling ratio
      const resampleRatio = audioContext.sampleRate / TARGET_SAMPLE_RATE

      processor.onaudioprocess = (event) => {
        if (isMutedRef.current) return

        const inputData = event.inputBuffer.getChannelData(0)

        // Resample to 16kHz
        const outputLength = Math.floor(inputData.length / resampleRatio)
        const pcmData = new Int16Array(outputLength)

        for (let i = 0; i < outputLength; i++) {
          // Linear interpolation for resampling
          const srcIndex = i * resampleRatio
          const srcIndexFloor = Math.floor(srcIndex)
          const srcIndexCeil = Math.min(srcIndexFloor + 1, inputData.length - 1)
          const fraction = srcIndex - srcIndexFloor

          const sample =
            inputData[srcIndexFloor]! * (1 - fraction) +
            inputData[srcIndexCeil]! * fraction

          // Convert float32 [-1, 1] to int16 [-32768, 32767]
          const clampedSample = Math.max(-1, Math.min(1, sample))
          pcmData[i] =
            clampedSample < 0 ? clampedSample * 0x8000 : clampedSample * 0x7fff
        }

        // Accumulate PCM data
        pcmBufferRef.current.push(pcmData)

        // Send PCM data at regular intervals
        const now = Date.now()
        if (now - lastChunkTimeRef.current >= chunkInterval) {
          lastChunkTimeRef.current = now

          // Concatenate all buffered PCM data
          const totalLength = pcmBufferRef.current.reduce(
            (acc, arr) => acc + arr.length,
            0,
          )
          const combinedPcm = new Int16Array(totalLength)
          let offset = 0
          for (const chunk of pcmBufferRef.current) {
            combinedPcm.set(chunk, offset)
            offset += chunk.length
          }
          pcmBufferRef.current = []

          // Send the PCM data
          if (combinedPcm.length > 0) {
            callbacksRef.current.onPCMData?.(combinedPcm.buffer)

            // Also create a Blob for compatibility
            const blob = new Blob([combinedPcm.buffer], { type: 'audio/pcm' })
            callbacksRef.current.onAudioChunk?.(blob)
          }
        }
      }

      // Connect processor (needs to be connected to destination to work)
      source.connect(processor)
      processor.connect(audioContext.destination)

      // Mute the output to prevent feedback
      const gainNode = audioContext.createGain()
      gainNode.gain.value = 0
      processor.disconnect()
      processor.connect(gainNode)
      gainNode.connect(audioContext.destination)

      // Start audio analysis
      analyzeAudio()

      lastChunkTimeRef.current = Date.now()

      setState((prev) => ({
        ...prev,
        isRecording: true,
        isInitializing: false,
        hasPermission: true,
        error: null,
      }))

      console.log('[AudioRecorder] Recording started, outputting 16kHz PCM')
    } catch (error) {
      console.error('[AudioRecorder] Failed to start:', error)
      const message =
        error instanceof Error ? error.message : 'Failed to start recording'
      setState((prev) => ({
        ...prev,
        isInitializing: false,
        error: message,
      }))
    }
  }, [chunkInterval, analyzeAudio])

  // Stop recording
  const stopRecording = useCallback(() => {
    // Stop animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    // Disconnect and cleanup processor
    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current = null
    }

    // Stop all tracks
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop())
      mediaStreamRef.current = null
    }

    // Close audio context
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close()
      audioContextRef.current = null
    }

    analyserRef.current = null
    isSpeakingRef.current = false
    pcmBufferRef.current = []

    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current)
      silenceTimeoutRef.current = null
    }

    setState((prev) => ({
      ...prev,
      isRecording: false,
      audioLevel: 0,
    }))

    console.log('[AudioRecorder] Recording stopped')
  }, [])

  // Toggle mute
  const toggleMute = useCallback(() => {
    setState((prev) => {
      const newMuted = !prev.isMuted
      isMutedRef.current = newMuted

      // Mute/unmute the actual audio track
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getAudioTracks().forEach((track) => {
          track.enabled = !newMuted
        })
      }

      return { ...prev, isMuted: newMuted }
    })
  }, [])

  return [
    state,
    {
      startRecording,
      stopRecording,
      toggleMute,
      requestPermission,
    },
  ]
}

/**
 * Hook to check if browser supports required audio APIs
 */
export function useAudioSupport(): {
  isSupported: boolean
  missingFeatures: string[]
} {
  const [support, setSupport] = useState({
    isSupported: true,
    missingFeatures: [] as string[],
  })

  useEffect(() => {
    const missing: string[] = []

    if (!navigator.mediaDevices?.getUserMedia) {
      missing.push('getUserMedia')
    }

    if (
      !window.AudioContext &&
      !(window as unknown as { webkitAudioContext: unknown }).webkitAudioContext
    ) {
      missing.push('AudioContext')
    }

    setSupport({
      isSupported: missing.length === 0,
      missingFeatures: missing,
    })
  }, [])

  return support
}
