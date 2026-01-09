/**
 * useAudioPlayer Hook
 * Handles audio playback with browser autoplay policy handling
 */

import { useCallback, useEffect, useRef, useState } from 'react'

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

  // Use refs to always have the latest callbacks
  const onPlayRef = useRef(onPlay)
  const onEndRef = useRef(onEnd)
  const onErrorRef = useRef(onError)

  // Keep refs updated with latest callbacks
  useEffect(() => {
    onPlayRef.current = onPlay
    onEndRef.current = onEnd
    onErrorRef.current = onError
  }, [onPlay, onEnd, onError])

  // Initialize audio element
  useEffect(() => {
    audioRef.current = new Audio()
    audioRef.current.preload = 'auto'

    const audio = audioRef.current

    const handleEndedEvent = () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      setState((prev) => ({
        ...prev,
        isPlaying: false,
        progress: 1,
      }))
      // Call the latest onEnd callback via ref
      onEndRef.current?.()
    }

    const handleErrorEvent = () => {
      const error = new Error('Failed to play audio')
      setState((prev) => ({
        ...prev,
        isPlaying: false,
        isLoading: false,
        error: error.message,
      }))
      onErrorRef.current?.(error)
    }

    const handleLoadedMetadataEvent = () => {
      if (audioRef.current) {
        setState((prev) => ({
          ...prev,
          duration: audioRef.current?.duration || 0,
        }))
      }
    }

    const handleCanPlayEvent = () => {
      setState((prev) => ({ ...prev, isLoading: false }))
    }

    const handlePlayStartEvent = () => {
      setState((prev) => ({ ...prev, isPlaying: true, canAutoplay: true }))
      onPlayRef.current?.()
      updateProgressLoop()
    }

    const updateProgressLoop = () => {
      if (audioRef.current && !audioRef.current.paused) {
        const progress =
          audioRef.current.currentTime / audioRef.current.duration
        setState((prev) => ({
          ...prev,
          progress: isNaN(progress) ? 0 : progress,
        }))
        animationFrameRef.current = requestAnimationFrame(updateProgressLoop)
      }
    }

    audio.addEventListener('ended', handleEndedEvent)
    audio.addEventListener('error', handleErrorEvent)
    audio.addEventListener('loadedmetadata', handleLoadedMetadataEvent)
    audio.addEventListener('canplaythrough', handleCanPlayEvent)
    audio.addEventListener('play', handlePlayStartEvent)

    // Check if autoplay is allowed (some browsers allow it after interaction)
    checkAutoplayAllowed()

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      audio.removeEventListener('ended', handleEndedEvent)
      audio.removeEventListener('error', handleErrorEvent)
      audio.removeEventListener('loadedmetadata', handleLoadedMetadataEvent)
      audio.removeEventListener('canplaythrough', handleCanPlayEvent)
      audio.removeEventListener('play', handlePlayStartEvent)
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

  // Play audio from URL
  const play = useCallback(async (url: string) => {
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
      onErrorRef.current?.(
        error instanceof Error ? error : new Error('Playback failed'),
      )
    }
  }, [])

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
