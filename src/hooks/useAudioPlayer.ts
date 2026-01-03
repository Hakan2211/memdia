/**
 * useAudioPlayer Hook
 * Handles audio playback with browser autoplay policy handling
 */

import { useState, useCallback, useRef, useEffect } from 'react'

export interface AudioPlayerState {
  /** Whether audio is currently playing */
  isPlaying: boolean
  /** Whether audio is loading */
  isLoading: boolean
  /** Current playback progress (0-1) */
  progress: number
  /** Duration in seconds */
  duration: number
  /** Error message if any */
  error: string | null
  /** Whether user has interacted (required for autoplay) */
  canAutoplay: boolean
}

export interface AudioPlayerActions {
  /** Play audio from URL */
  play: (url: string) => Promise<void>
  /** Stop current playback */
  stop: () => void
  /** Pause playback */
  pause: () => void
  /** Resume playback */
  resume: () => void
  /** Enable autoplay after user interaction */
  enableAutoplay: () => void
}

export interface UseAudioPlayerOptions {
  /** Callback when playback starts */
  onPlay?: () => void
  /** Callback when playback ends */
  onEnd?: () => void
  /** Callback when error occurs */
  onError?: (error: Error) => void
}

export function useAudioPlayer(
  options: UseAudioPlayerOptions = {},
): [AudioPlayerState, AudioPlayerActions] {
  const { onPlay, onEnd, onError } = options

  const [state, setState] = useState<AudioPlayerState>({
    isPlaying: false,
    isLoading: false,
    progress: 0,
    duration: 0,
    error: null,
    canAutoplay: false,
  })

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  // Initialize audio element
  useEffect(() => {
    audioRef.current = new Audio()
    audioRef.current.preload = 'auto'

    const audio = audioRef.current

    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)
    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('canplaythrough', handleCanPlay)
    audio.addEventListener('play', handlePlayStart)

    // Check if autoplay is allowed (some browsers allow it after interaction)
    checkAutoplayAllowed()

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleError)
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('canplaythrough', handleCanPlay)
      audio.removeEventListener('play', handlePlayStart)
      audio.pause()
      audio.src = ''
    }
  }, [])

  const checkAutoplayAllowed = async () => {
    // Create a silent audio to test autoplay
    const testAudio = new Audio()
    testAudio.src =
      'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA'
    testAudio.volume = 0

    try {
      await testAudio.play()
      testAudio.pause()
      setState((prev) => ({ ...prev, canAutoplay: true }))
    } catch {
      // Autoplay blocked - user interaction needed
      setState((prev) => ({ ...prev, canAutoplay: false }))
    }
  }

  const handleEnded = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
    setState((prev) => ({
      ...prev,
      isPlaying: false,
      progress: 1,
    }))
    onEnd?.()
  }, [onEnd])

  const handleError = useCallback(() => {
    const error = new Error('Failed to play audio')
    setState((prev) => ({
      ...prev,
      isPlaying: false,
      isLoading: false,
      error: error.message,
    }))
    onError?.(error)
  }, [onError])

  const handleLoadedMetadata = useCallback(() => {
    if (audioRef.current) {
      setState((prev) => ({
        ...prev,
        duration: audioRef.current?.duration || 0,
      }))
    }
  }, [])

  const handleCanPlay = useCallback(() => {
    setState((prev) => ({ ...prev, isLoading: false }))
  }, [])

  const handlePlayStart = useCallback(() => {
    setState((prev) => ({ ...prev, isPlaying: true, canAutoplay: true }))
    onPlay?.()
    updateProgress()
  }, [onPlay])

  const updateProgress = useCallback(() => {
    if (audioRef.current && !audioRef.current.paused) {
      const progress = audioRef.current.currentTime / audioRef.current.duration
      setState((prev) => ({
        ...prev,
        progress: isNaN(progress) ? 0 : progress,
      }))
      animationFrameRef.current = requestAnimationFrame(updateProgress)
    }
  }, [])

  // Play audio from URL
  const play = useCallback(
    async (url: string) => {
      if (!audioRef.current || !url) {
        console.warn('[AudioPlayer] No audio URL provided')
        return
      }

      setState((prev) => ({
        ...prev,
        isLoading: true,
        error: null,
        progress: 0,
      }))

      try {
        // Stop any current playback
        audioRef.current.pause()
        audioRef.current.currentTime = 0

        // Set new source
        audioRef.current.src = url

        // Attempt to play
        await audioRef.current.play()
      } catch (error) {
        console.error('[AudioPlayer] Playback error:', error)

        // If autoplay was blocked, mark it
        if (error instanceof Error && error.name === 'NotAllowedError') {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            canAutoplay: false,
            error: 'Click to enable audio playback',
          }))
        } else {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error: error instanceof Error ? error.message : 'Playback failed',
          }))
        }
        onError?.(error instanceof Error ? error : new Error('Playback failed'))
      }
    },
    [onError],
  )

  // Stop playback
  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
    setState((prev) => ({
      ...prev,
      isPlaying: false,
      progress: 0,
    }))
  }, [])

  // Pause playback
  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
    setState((prev) => ({ ...prev, isPlaying: false }))
  }, [])

  // Resume playback
  const resume = useCallback(async () => {
    if (audioRef.current) {
      try {
        await audioRef.current.play()
      } catch (error) {
        console.error('[AudioPlayer] Resume error:', error)
      }
    }
  }, [])

  // Enable autoplay (call this on user interaction)
  const enableAutoplay = useCallback(() => {
    setState((prev) => ({ ...prev, canAutoplay: true }))

    // Play a silent sound to unlock audio
    if (audioRef.current) {
      const currentSrc = audioRef.current.src
      audioRef.current.src =
        'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA'
      audioRef.current.play().catch(() => {})
      audioRef.current.src = currentSrc
    }
  }, [])

  return [
    state,
    {
      play,
      stop,
      pause,
      resume,
      enableAutoplay,
    },
  ]
}
