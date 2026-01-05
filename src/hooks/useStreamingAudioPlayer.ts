/**
 * useStreamingAudioPlayer Hook
 * Handles streaming audio playback using Web Audio API
 *
 * Features:
 * - Plays base64-encoded audio chunks seamlessly
 * - Gapless playback by scheduling chunks ahead
 * - Handles browser autoplay restrictions
 * - Queue management for sequential playback
 */

import { useState, useCallback, useRef, useEffect } from 'react'

export interface StreamingAudioPlayerState {
  /** Whether audio is currently playing */
  isPlaying: boolean
  /** Whether there are chunks queued but not yet playing */
  isPending: boolean
  /** Number of chunks in the queue */
  queueLength: number
  /** Whether audio context is ready (user has interacted) */
  isReady: boolean
  /** Error message if any */
  error: string | null
}

export interface StreamingAudioPlayerActions {
  /** Queue a base64 audio chunk for playback */
  queueAudioChunk: (base64Audio: string, contentType?: string) => Promise<void>
  /** Queue an audio URL for playback (will fetch and decode) */
  queueAudioUrl: (url: string) => Promise<void>
  /** Stop all playback and clear queue */
  stop: () => void
  /** Enable playback (call on user interaction to unlock AudioContext) */
  enablePlayback: () => Promise<void>
  /** Clear any errors */
  clearError: () => void
}

export interface UseStreamingAudioPlayerOptions {
  /** Called when playback starts */
  onStart?: () => void
  /** Called when all queued audio has finished playing */
  onEnd?: () => void
  /** Called when an error occurs */
  onError?: (error: Error) => void
  /** Called when a chunk starts playing */
  onChunkStart?: (index: number) => void
}

export function useStreamingAudioPlayer(
  options: UseStreamingAudioPlayerOptions = {},
): [StreamingAudioPlayerState, StreamingAudioPlayerActions] {
  const { onStart, onEnd, onError, onChunkStart } = options

  // State
  const [state, setState] = useState<StreamingAudioPlayerState>({
    isPlaying: false,
    isPending: false,
    queueLength: 0,
    isReady: false,
    error: null,
  })

  // Refs for Web Audio API
  const audioContextRef = useRef<AudioContext | null>(null)
  const nextStartTimeRef = useRef<number>(0)
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set())
  const chunkIndexRef = useRef<number>(0)
  const hasStartedRef = useRef<boolean>(false)
  const queueRef = useRef<Array<{ buffer: AudioBuffer; index: number }>>([])

  // Callback refs to avoid stale closures
  const onStartRef = useRef(onStart)
  const onEndRef = useRef(onEnd)
  const onErrorRef = useRef(onError)
  const onChunkStartRef = useRef(onChunkStart)

  useEffect(() => {
    onStartRef.current = onStart
    onEndRef.current = onEnd
    onErrorRef.current = onError
    onChunkStartRef.current = onChunkStart
  }, [onStart, onEnd, onError, onChunkStart])

  // Initialize AudioContext
  const getAudioContext = useCallback((): AudioContext => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext()
    }
    return audioContextRef.current
  }, [])

  // Enable playback (unlock AudioContext on user interaction)
  const enablePlayback = useCallback(async () => {
    const ctx = getAudioContext()

    if (ctx.state === 'suspended') {
      try {
        await ctx.resume()
      } catch (error) {
        console.error('[StreamingAudio] Failed to resume AudioContext:', error)
      }
    }

    setState((prev) => ({ ...prev, isReady: true }))
  }, [getAudioContext])

  // Schedule an audio buffer for playback
  const scheduleBuffer = useCallback(
    (buffer: AudioBuffer, chunkIndex: number) => {
      const ctx = getAudioContext()

      // Create source node
      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.connect(ctx.destination)

      // Calculate start time for gapless playback
      const now = ctx.currentTime
      const startTime = Math.max(now + 0.01, nextStartTimeRef.current) // Small buffer to prevent glitches
      nextStartTimeRef.current = startTime + buffer.duration

      // Track this source
      activeSourcesRef.current.add(source)

      // Handle chunk start
      if (!hasStartedRef.current) {
        hasStartedRef.current = true
        setState((prev) => ({ ...prev, isPlaying: true }))
        onStartRef.current?.()
      }

      onChunkStartRef.current?.(chunkIndex)

      // Handle chunk end
      source.onended = () => {
        activeSourcesRef.current.delete(source)

        // Update queue length
        setState((prev) => ({
          ...prev,
          queueLength: Math.max(0, prev.queueLength - 1),
        }))

        // Check if all playback is done
        if (
          activeSourcesRef.current.size === 0 &&
          queueRef.current.length === 0
        ) {
          setState((prev) => ({ ...prev, isPlaying: false, isPending: false }))
          hasStartedRef.current = false
          onEndRef.current?.()
        }
      }

      // Start playback at scheduled time
      source.start(startTime)

      console.log(
        `[StreamingAudio] Scheduled chunk ${chunkIndex} at ${startTime.toFixed(3)}s (duration: ${buffer.duration.toFixed(3)}s)`,
      )
    },
    [getAudioContext],
  )

  // Process queue
  const processQueue = useCallback(() => {
    while (queueRef.current.length > 0) {
      const item = queueRef.current.shift()
      if (item) {
        scheduleBuffer(item.buffer, item.index)
      }
    }
  }, [scheduleBuffer])

  // Queue a base64 audio chunk
  const queueAudioChunk = useCallback(
    async (base64Audio: string, _contentType: string = 'audio/mpeg') => {
      if (!base64Audio) {
        console.warn('[StreamingAudio] Empty audio chunk received')
        return
      }

      try {
        const ctx = getAudioContext()

        // Resume if suspended
        if (ctx.state === 'suspended') {
          await ctx.resume()
          setState((prev) => ({ ...prev, isReady: true }))
        }

        // Decode base64 to ArrayBuffer
        const binaryString = atob(base64Audio)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }

        // Decode audio data
        const audioBuffer = await ctx.decodeAudioData(bytes.buffer.slice(0))

        // Get chunk index
        const chunkIndex = chunkIndexRef.current++

        // Update state
        setState((prev) => ({
          ...prev,
          isPending: true,
          queueLength: prev.queueLength + 1,
        }))

        // Schedule immediately if context is running
        if (ctx.state === 'running') {
          scheduleBuffer(audioBuffer, chunkIndex)
        } else {
          // Queue for later
          queueRef.current.push({ buffer: audioBuffer, index: chunkIndex })
        }
      } catch (error) {
        console.error('[StreamingAudio] Failed to queue chunk:', error)
        const err =
          error instanceof Error ? error : new Error('Failed to decode audio')
        setState((prev) => ({ ...prev, error: err.message }))
        onErrorRef.current?.(err)
      }
    },
    [getAudioContext, scheduleBuffer],
  )

  // Queue an audio URL (fetch and decode)
  const queueAudioUrl = useCallback(
    async (url: string) => {
      try {
        const response = await fetch(url)
        if (!response.ok) {
          throw new Error(`Failed to fetch audio: ${response.status}`)
        }

        const arrayBuffer = await response.arrayBuffer()
        const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))

        await queueAudioChunk(
          base64,
          response.headers.get('content-type') || 'audio/mpeg',
        )
      } catch (error) {
        console.error('[StreamingAudio] Failed to fetch audio URL:', error)
        const err =
          error instanceof Error ? error : new Error('Failed to fetch audio')
        setState((prev) => ({ ...prev, error: err.message }))
        onErrorRef.current?.(err)
      }
    },
    [queueAudioChunk],
  )

  // Stop all playback
  const stop = useCallback(() => {
    // Stop all active sources
    activeSourcesRef.current.forEach((source) => {
      try {
        source.stop()
        source.disconnect()
      } catch {
        // Ignore errors on stop
      }
    })
    activeSourcesRef.current.clear()

    // Clear queue
    queueRef.current = []

    // Reset timing
    if (audioContextRef.current) {
      nextStartTimeRef.current = audioContextRef.current.currentTime
    }

    // Reset state
    chunkIndexRef.current = 0
    hasStartedRef.current = false

    setState((prev) => ({
      ...prev,
      isPlaying: false,
      isPending: false,
      queueLength: 0,
    }))
  }, [])

  // Clear error
  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }))
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop()
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {})
        audioContextRef.current = null
      }
    }
  }, [stop])

  // Auto-process queue when context becomes ready
  useEffect(() => {
    if (state.isReady && queueRef.current.length > 0) {
      processQueue()
    }
  }, [state.isReady, processQueue])

  return [
    state,
    {
      queueAudioChunk,
      queueAudioUrl,
      stop,
      enablePlayback,
      clearError,
    },
  ]
}
