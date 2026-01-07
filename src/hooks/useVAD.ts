/**
 * useVAD Hook
 * Voice Activity Detection using @ricky0123/vad-web with Silero VAD
 *
 * Uses neural network-based speech detection for accurate barge-in detection.
 * This is much more reliable than simple audio level thresholds.
 *
 * NOTE: Loads VAD library via CDN script tags to avoid Vite/ESM compatibility issues.
 * The library uses CommonJS internally which doesn't work with Vite's ESM handling.
 */

import { useCallback, useRef, useEffect, useState } from 'react'

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

// Type for the MicVAD instance from the global vad object
interface MicVADInstance {
  listening: boolean
  start: () => void
  pause: () => void
}

// Type for the global vad object loaded via CDN
interface VADGlobal {
  MicVAD: {
    new: (options: {
      positiveSpeechThreshold?: number
      negativeSpeechThreshold?: number
      minSpeechMs?: number
      redemptionMs?: number
      onSpeechStart?: () => void
      onSpeechEnd?: (audio: Float32Array) => void
      onVADMisfire?: () => void
    }) => Promise<MicVADInstance>
  }
}

// Declare the global vad object
declare global {
  interface Window {
    vad?: VADGlobal
    ort?: unknown
  }
}

// CDN URLs for the VAD library
// IMPORTANT: Use ort.wasm.min.js (not ort.min.js) and matching versions from docs:
// https://docs.vad.ricky0123.com/user-guide/browser/#script-tags-quick-start
const ORT_CDN_URL =
  'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/ort.wasm.min.js'
const VAD_CDN_URL =
  'https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.29/dist/bundle.min.js'

// CDN base paths for model/wasm files
const VAD_BASE_ASSET_PATH =
  'https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.29/dist/'
const ONNX_WASM_BASE_PATH =
  'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/'

// Track if scripts are already loading/loaded
let scriptsLoading: Promise<void> | null = null

/**
 * Load a script from URL and return a promise
 */
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if script already exists
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve()
      return
    }

    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`))
    document.head.appendChild(script)
  })
}

/**
 * Load VAD library scripts from CDN
 */
async function loadVADScripts(): Promise<VADGlobal> {
  if (scriptsLoading) {
    await scriptsLoading
    if (!window.vad) {
      throw new Error('VAD library not available after loading')
    }
    return window.vad
  }

  scriptsLoading = (async () => {
    console.log('[VAD] Loading ONNX runtime from CDN...')
    await loadScript(ORT_CDN_URL)

    console.log('[VAD] Loading VAD library from CDN...')
    await loadScript(VAD_CDN_URL)

    // Wait a bit for the library to initialize
    await new Promise((resolve) => setTimeout(resolve, 100))
  })()

  await scriptsLoading

  if (!window.vad) {
    throw new Error('VAD library not available after loading scripts')
  }

  console.log('[VAD] Libraries loaded successfully')
  return window.vad
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

  // State for the VAD instance
  const [vadInstance, setVadInstance] = useState<MicVADInstance | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)

  // Use refs for callbacks to avoid stale closures
  const onSpeechStartRef = useRef(onSpeechStart)
  const onSpeechEndRef = useRef(onSpeechEnd)
  const enabledRef = useRef(enabled)

  useEffect(() => {
    onSpeechStartRef.current = onSpeechStart
    onSpeechEndRef.current = onSpeechEnd
    enabledRef.current = enabled
  }, [onSpeechStart, onSpeechEnd, enabled])

  // Track speech start time to calculate duration
  const speechStartTimeRef = useRef<number>(0)

  // Initialize VAD on client side only
  useEffect(() => {
    // Only run on client
    if (typeof window === 'undefined') {
      setIsLoading(false)
      setError('VAD only works in browser')
      return
    }

    let mounted = true
    let vadRef: MicVADInstance | null = null

    const initVAD = async () => {
      try {
        console.log('[VAD] Initializing...')

        // Load VAD library from CDN
        const vad = await loadVADScripts()

        if (!mounted) return

        console.log('[VAD] Creating MicVAD instance...')

        // Cast to any to bypass TypeScript - baseAssetPath and onnxWASMBasePath
        // are valid runtime options but not in the type definitions
        const instance = await vad.MicVAD.new({
          // Specify CDN paths for model and wasm files
          baseAssetPath: VAD_BASE_ASSET_PATH,
          onnxWASMBasePath: ONNX_WASM_BASE_PATH,
          positiveSpeechThreshold,
          negativeSpeechThreshold,
          minSpeechMs,
          redemptionMs,
          onSpeechStart: () => {
            console.log('[VAD] Speech started')
            speechStartTimeRef.current = Date.now()
            setIsSpeaking(true)
            onSpeechStartRef.current?.()
          },
          onSpeechEnd: (audio: Float32Array) => {
            const duration = (Date.now() - speechStartTimeRef.current) / 1000
            console.log(`[VAD] Speech ended (${duration.toFixed(2)}s)`)
            setIsSpeaking(false)
            onSpeechEndRef.current?.(audio, duration)
          },
          onVADMisfire: () => {
            console.log('[VAD] Misfire (very short speech)')
            setIsSpeaking(false)
          },
        } as any)

        if (!mounted) {
          instance.pause()
          return
        }

        vadRef = instance
        console.log('[VAD] Initialized successfully')

        setVadInstance(instance)
        setIsLoading(false)

        // Start if enabled
        if (enabledRef.current) {
          instance.start()
          setIsListening(true)
        }
      } catch (err) {
        console.error('[VAD] Initialization failed:', err)
        if (mounted) {
          setError(
            err instanceof Error ? err.message : 'Failed to initialize VAD',
          )
          setIsLoading(false)
        }
      }
    }

    initVAD()

    return () => {
      mounted = false
      if (vadRef) {
        console.log('[VAD] Cleaning up...')
        vadRef.pause()
      }
    }
  }, [
    positiveSpeechThreshold,
    negativeSpeechThreshold,
    minSpeechMs,
    redemptionMs,
  ])

  // Handle enabled changes
  useEffect(() => {
    if (!vadInstance) return

    if (enabled) {
      vadInstance.start()
      setIsListening(true)
    } else {
      vadInstance.pause()
      setIsListening(false)
      setIsSpeaking(false) // Clear speaking state when VAD is paused
    }
  }, [enabled, vadInstance])

  // Build state
  const state: VADState = {
    isListening: vadInstance?.listening ?? isListening,
    isSpeaking, // Now properly tracked via onSpeechStart/onSpeechEnd callbacks
    isLoading,
    error,
  }

  // Build actions
  const start = useCallback(() => {
    console.log('[VAD] Starting')
    vadInstance?.start()
    setIsListening(true)
  }, [vadInstance])

  const pause = useCallback(() => {
    console.log('[VAD] Pausing')
    vadInstance?.pause()
    setIsListening(false)
  }, [vadInstance])

  const toggle = useCallback(() => {
    console.log('[VAD] Toggling')
    if (vadInstance?.listening) {
      vadInstance.pause()
      setIsListening(false)
    } else {
      vadInstance?.start()
      setIsListening(true)
    }
  }, [vadInstance])

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
  const buffer = encodeWAV(audio, sampleRate)
  return new Blob([buffer], { type: 'audio/wav' })
}

/**
 * Convert Float32Array audio to base64 WAV
 */
export async function audioToBase64Wav(
  audio: Float32Array,
  sampleRate = 16000,
): Promise<string> {
  const buffer = encodeWAV(audio, sampleRate)
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/**
 * Encode Float32Array audio as WAV
 */
function encodeWAV(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const numChannels = 1
  const bitsPerSample = 16
  const bytesPerSample = bitsPerSample / 8
  const blockAlign = numChannels * bytesPerSample
  const byteRate = sampleRate * blockAlign
  const dataSize = samples.length * bytesPerSample
  const headerSize = 44
  const totalSize = headerSize + dataSize

  const buffer = new ArrayBuffer(totalSize)
  const view = new DataView(buffer)

  // Helper to write string
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i))
    }
  }

  // RIFF header
  writeString(0, 'RIFF')
  view.setUint32(4, totalSize - 8, true)
  writeString(8, 'WAVE')

  // fmt sub-chunk
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true) // Subchunk1Size
  view.setUint16(20, 1, true) // AudioFormat (PCM)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)

  // data sub-chunk
  writeString(36, 'data')
  view.setUint32(40, dataSize, true)

  // Write PCM samples
  let offset = 44
  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i]))
    const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7fff
    view.setInt16(offset, int16, true)
    offset += 2
  }

  return buffer
}
