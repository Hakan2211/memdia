'use client'

import {
  createContext,
  useContext,
  useRef,
  useState,
  useEffect,
  useCallback,
} from 'react'
import type { ReactNode } from 'react'

const AUDIO_SRC = '/audio/ELEVEN KINGDOMS - Tears of Eternity.mp3'
const STORAGE_KEY = 'memdia-bg-audio-enabled'

export interface AudioAnalyzerData {
  bass: number // 0-1, low frequencies
  mid: number // 0-1, mid frequencies
  high: number // 0-1, high frequencies
  amplitude: number // 0-1, overall amplitude
}

const IDLE_AUDIO_DATA: AudioAnalyzerData = {
  bass: 0,
  mid: 0,
  high: 0,
  amplitude: 0,
}

interface AudioContextType {
  isPlaying: boolean
  isLoaded: boolean
  loopCount: number
  toggle: () => void
  getAudioData: () => AudioAnalyzerData
}

const AudioContext = createContext<AudioContextType | null>(null)

export function AudioProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [loopCount, setLoopCount] = useState(0)

  // Refs for loop detection
  const lastTimeRef = useRef(0)

  // Web Audio API refs for frequency analysis
  const audioContextRef = useRef<globalThis.AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const frequencyDataRef = useRef<Uint8Array | null>(null)
  const processedDataRef = useRef<AudioAnalyzerData>({ ...IDLE_AUDIO_DATA })

  useEffect(() => {
    // Create audio element only on client
    const audio = new Audio(AUDIO_SRC)
    audio.loop = true
    audio.volume = 0.3
    audio.preload = 'auto'
    audioRef.current = audio

    const handleCanPlay = () => setIsLoaded(true)
    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => setIsPlaying(false)

    // Detect audio loop: when currentTime jumps backward significantly
    const handleTimeUpdate = () => {
      const currentTime = audio.currentTime
      // If time jumped backward by more than 1 second, audio has looped
      if (lastTimeRef.current - currentTime > 1) {
        setLoopCount((prev) => prev + 1)
      }
      lastTimeRef.current = currentTime
    }

    audio.addEventListener('canplaythrough', handleCanPlay)
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('timeupdate', handleTimeUpdate)

    return () => {
      audio.removeEventListener('canplaythrough', handleCanPlay)
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.pause()
      audio.src = ''
      // Clean up Web Audio API
      if (audioContextRef.current) {
        audioContextRef.current.close()
        audioContextRef.current = null
      }
    }
  }, [])

  // Initialize Web Audio API analyzer (called on first play)
  const initializeAnalyzer = useCallback(() => {
    if (analyserRef.current || !audioRef.current) return

    try {
      // Create AudioContext
      const AudioContextClass =
        window.AudioContext || (window as any).webkitAudioContext
      const ctx = new AudioContextClass()
      audioContextRef.current = ctx

      // Create AnalyserNode
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256 // 128 frequency bins
      analyser.smoothingTimeConstant = 0.85 // Smoother frequency data
      analyserRef.current = analyser

      // Connect: audio element -> analyser -> destination
      const source = ctx.createMediaElementSource(audioRef.current)
      source.connect(analyser)
      analyser.connect(ctx.destination)
      sourceRef.current = source

      // Initialize frequency data array
      frequencyDataRef.current = new Uint8Array(analyser.frequencyBinCount)
    } catch (error) {
      console.warn('Failed to initialize audio analyzer:', error)
    }
  }, [])

  // Get current audio frequency data (call in animation loop)
  const getAudioData = useCallback((): AudioAnalyzerData => {
    if (!analyserRef.current || !frequencyDataRef.current || !isPlaying) {
      return processedDataRef.current
    }

    const analyser = analyserRef.current
    const data = frequencyDataRef.current

    // Get frequency data
    analyser.getByteFrequencyData(data)

    // Calculate frequency bands
    // With fftSize=256, we have 128 bins, each covering ~172Hz (44100/256)
    // Bass: bins 0-3 (~0-688Hz)
    // Mid: bins 4-20 (~688-3440Hz)
    // High: bins 21-64 (~3440-11000Hz)
    let bassSum = 0
    let midSum = 0
    let highSum = 0
    let totalSum = 0

    for (let i = 0; i < data.length; i++) {
      totalSum += data[i]
      if (i < 4) bassSum += data[i]
      else if (i < 21) midSum += data[i]
      else if (i < 65) highSum += data[i]
    }

    processedDataRef.current = {
      bass: bassSum / (4 * 255),
      mid: midSum / (17 * 255),
      high: highSum / (44 * 255),
      amplitude: totalSum / (data.length * 255),
    }

    return processedDataRef.current
  }, [isPlaying])

  const toggle = useCallback(async () => {
    const audio = audioRef.current
    if (!audio) return

    try {
      if (isPlaying) {
        audio.pause()
        localStorage.setItem(STORAGE_KEY, 'false')
      } else {
        // Initialize analyzer on first play
        initializeAnalyzer()

        // Resume AudioContext if suspended (browser autoplay policy)
        if (
          audioContextRef.current &&
          audioContextRef.current.state === 'suspended'
        ) {
          await audioContextRef.current.resume()
        }

        await audio.play()
        localStorage.setItem(STORAGE_KEY, 'true')
      }
    } catch (error) {
      console.warn('Audio playback failed:', error)
    }
  }, [isPlaying, initializeAnalyzer])

  return (
    <AudioContext.Provider
      value={{ isPlaying, isLoaded, loopCount, toggle, getAudioData }}
    >
      {children}
    </AudioContext.Provider>
  )
}

export function useAudio() {
  const context = useContext(AudioContext)
  if (!context) {
    throw new Error('useAudio must be used within AudioProvider')
  }
  return context
}
