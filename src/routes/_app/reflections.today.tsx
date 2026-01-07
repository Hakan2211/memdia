/**
 * Today's Reflection Route
 * Main recording interface for today's 10-minute reflection session
 *
 * Uses SSE streaming for AI responses with real-time audio playback
 * Similar to memories.today.tsx but with:
 * - 10 minute duration (vs 3 minutes)
 * - 1 attempt per day (vs 2 attempts)
 * - No image generation
 * - More therapeutic AI prompts
 */

import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect, useCallback, useRef } from 'react'
import { format } from 'date-fns'
import { Play, AlertCircle, Volume2, MessageCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../../components/ui/button'
import {
  getTodayReflectionFn,
  startReflectionFn,
  endReflectionFn,
  cancelShortReflectionFn,
} from '../../server/reflection.fn'
import { getUserPreferencesFn } from '../../server/session.fn'
import {
  preGenerateReflectionGreetingFn,
  processReflectionFn,
  savePreloadedReflectionGreetingFn,
} from '../../server/reflection-conversation.fn'
import { PulsingCircle } from '../../components/memories/PulsingCircle'
import { CountdownTimer } from '../../components/memories/CountdownTimer'
import { SessionControls } from '../../components/memories/SessionControls'
import { useAudioRecorder, useAudioSupport } from '../../hooks/useAudioRecorder'
import { useAudioPlayer } from '../../hooks/useAudioPlayer'
import { useDeepgramSTT } from '../../hooks/useDeepgramSTT'
import { useStreamingAudioPlayer } from '../../hooks/useStreamingAudioPlayer'
import { useConversationStream } from '../../hooks/useConversationStream'
import { useVAD } from '../../hooks/useVAD'
import type {
  ReflectionSession,
  ReflectionTurn,
  Language,
} from '../../types/voice-session'
import {
  getDeepgramLanguageParam,
  getDeepgramModel,
  REFLECTION_CONFIG,
} from '../../types/voice-session'

// Feature flags
const USE_SSE_STREAMING = true
const USE_VAD = true

// Minimum session duration in seconds (sessions shorter than this are discarded)
const MIN_SESSION_DURATION = REFLECTION_CONFIG.MIN_DURATION_SECONDS

export const Route = createFileRoute('/_app/reflections/today')({
  component: TodayReflection,
})

type SessionState =
  | 'idle'
  | 'starting'
  | 'recording'
  | 'paused'
  | 'processing'
  | 'completed'

function TodayReflection() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [sessionState, setSessionState] = useState<SessionState>('idle')
  const [currentSpeaker, setCurrentSpeaker] = useState<'user' | 'ai' | null>(
    null,
  )
  const [elapsedTime, setElapsedTime] = useState(0)
  const [liveTranscript, setLiveTranscript] = useState('')
  const [isAISpeaking, setIsAISpeaking] = useState(false)
  const [useVoiceInput, setUseVoiceInput] = useState(true)
  const [isEndingSession, setIsEndingSession] = useState(false)
  const [isAutoEnding, setIsAutoEnding] = useState(false)

  // Refs for managing state across callbacks
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const pendingTranscriptRef = useRef('')
  const isProcessingRef = useRef(false)
  const sessionEndPendingRef = useRef(false)
  const warningShownRef = useRef(false)
  const hardCutoffTimerRef = useRef<NodeJS.Timeout | null>(null)
  const elapsedTimeRef = useRef(0)
  const triggerBargeInRef = useRef<(() => void) | null>(null)
  const audioChunksRef = useRef<Int16Array[]>([])
  const preloadedGreetingRef = useRef<{
    text: string
    audioUrl: string | null
    audioBase64: string | null
    contentType: string
  } | null>(null)
  const isPreloadingRef = useRef(false)
  const hasPreloadedOnceRef = useRef(false)
  const isAISpeakingRef = useRef(false)
  const vadIsSpeakingRef = useRef(false) // Track VAD speaking state for hybrid detection
  const sessionRef = useRef<ReflectionSession | null>(null)
  const audioQueueRef = useRef<string[]>([])
  const isPlayingQueueRef = useRef(false)
  const playNextInQueueRef = useRef<(() => void) | null>(null)
  const lastSentMessageRef = useRef<string>('')
  const lastSentTimeRef = useRef<number>(0)

  // Fetch user preferences for language setting
  const { data: userPreferences } = useQuery({
    queryKey: ['preferences'],
    queryFn: () => getUserPreferencesFn(),
  })

  // Get Deepgram settings based on user's language
  const deepgramLanguage = userPreferences?.language
    ? getDeepgramLanguageParam(userPreferences.language as Language)
    : 'multi'
  const deepgramModel = userPreferences?.language
    ? getDeepgramModel(userPreferences.language as Language)
    : 'nova-3'

  // Fetch today's reflection
  const { data: session, isLoading } = useQuery({
    queryKey: ['reflection', 'today'],
    queryFn: () => getTodayReflectionFn(),
  })

  // Update session ref
  useEffect(() => {
    sessionRef.current = session ?? null
  }, [session])

  // Sync helper: updates both ref and state to avoid race conditions
  // The ref is checked in onPCMData callback which runs frequently,
  // so we need to update it synchronously with state changes
  const setIsAISpeakingSync = useCallback((value: boolean) => {
    isAISpeakingRef.current = value
    setIsAISpeaking(value)
  }, [])

  // Helper to create WAV from PCM
  const createWavFromPcm = useCallback(
    (pcmData: Int16Array, sampleRate: number = 16000): ArrayBuffer => {
      const numChannels = 1
      const bitsPerSample = 16
      const byteRate = sampleRate * numChannels * (bitsPerSample / 8)
      const blockAlign = numChannels * (bitsPerSample / 8)
      const dataSize = pcmData.length * (bitsPerSample / 8)
      const headerSize = 44
      const totalSize = headerSize + dataSize

      const buffer = new ArrayBuffer(totalSize)
      const view = new DataView(buffer)

      const writeString = (offset: number, str: string) => {
        for (let i = 0; i < str.length; i++) {
          view.setUint8(offset + i, str.charCodeAt(i))
        }
      }

      writeString(0, 'RIFF')
      view.setUint32(4, totalSize - 8, true)
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
    },
    [],
  )

  // Get accumulated audio as base64 WAV
  const getAccumulatedAudioBase64 = useCallback((): string | undefined => {
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
  }, [createWavFromPcm])

  // Deepgram STT hook
  const [sttState, sttActions] = useDeepgramSTT({
    language: deepgramLanguage,
    model: deepgramModel,
    onFinalTranscript: (transcript) => {
      console.log(
        '[DEBUG-STT] Final transcript received:',
        transcript.substring(0, 50),
      )
      pendingTranscriptRef.current +=
        (pendingTranscriptRef.current ? ' ' : '') + transcript
      console.log(
        '[DEBUG-STT] Pending transcript now:',
        pendingTranscriptRef.current.substring(0, 50),
      )
    },
    onSpeechStart: () => {
      // HYBRID APPROACH: Set currentSpeaker if EITHER Deepgram OR VAD detects speech
      // This ensures responsive UI - we show speaking indicator immediately
      console.log(
        '[DEBUG-STT] SpeechStarted event, isAISpeaking:',
        isAISpeakingRef.current,
      )

      // Don't set speaker if AI is speaking (this is likely TTS echo)
      if (isAISpeakingRef.current) {
        console.log(
          '[DEBUG-STT] Ignoring SpeechStarted - AI is speaking (TTS echo)',
        )
        return
      }

      // Set user as speaker - OR logic with VAD
      setCurrentSpeaker('user')
    },
    onSpeechEnd: () => {
      console.log(
        '[DEBUG-STT] SpeechEnd/UtteranceEnd event, isProcessing:',
        isProcessingRef.current,
        'isAISpeaking:',
        isAISpeakingRef.current,
      )
      // Ignore if AI is speaking - this is likely TTS audio ending, not user speech
      if (isAISpeakingRef.current) {
        console.log(
          '[DEBUG-STT] Ignoring SpeechEnd - AI is speaking (TTS echo)',
        )
        return
      }
      if (isProcessingRef.current) return

      if (pendingTranscriptRef.current.trim() && session) {
        console.log(
          '[DEBUG-STT] Sending transcript to AI:',
          pendingTranscriptRef.current.substring(0, 50),
        )
        isProcessingRef.current = true
        const transcript = pendingTranscriptRef.current.trim()
        pendingTranscriptRef.current = ''
        setLiveTranscript('')

        setTimeout(() => {
          const audioBase64 = getAccumulatedAudioBase64()
          handleUserSpeechEnd(transcript, audioBase64)
          audioChunksRef.current = []
          setTimeout(() => {
            isProcessingRef.current = false
          }, 100)
        }, 150)
      } else {
        console.log(
          '[DEBUG-STT] No transcript to send, pending:',
          pendingTranscriptRef.current,
        )
      }

      // HYBRID APPROACH: Only clear currentSpeaker if VAD also stopped
      // This prevents flickering when one system detects end before the other
      if (!vadIsSpeakingRef.current) {
        console.log('[DEBUG-STT] Clearing currentSpeaker (VAD also stopped)')
        setCurrentSpeaker(null)
      } else {
        console.log(
          '[DEBUG-STT] Keeping currentSpeaker=user (VAD still speaking)',
        )
      }
    },
    onError: (error) => {
      console.error('[DEBUG-STT] Error:', error)
    },
  })

  // VAD hook for barge-in and fallback speech end detection
  // Tuned to reduce false positives that cause unwanted barge-ins
  const [vadState, vadActions] = useVAD({
    enabled: USE_VAD && sessionState === 'recording',
    positiveSpeechThreshold: 0.8, // Higher threshold to reduce false positives (default: 0.7)
    redemptionMs: 800, // Longer silence before ending speech (default: 600ms)
    onSpeechStart: () => {
      console.log(
        '[DEBUG-VAD] Speech START, isAISpeaking:',
        isAISpeakingRef.current,
      )

      // Update ref for hybrid detection
      vadIsSpeakingRef.current = true

      // If AI is speaking, this could be:
      // 1. User trying to barge-in (legitimate) - trigger barge-in but don't set speaker yet
      // 2. VAD picking up TTS audio (false positive) - ignore
      // We trigger barge-in either way, but don't set currentSpeaker to avoid UI flicker
      if (isAISpeakingRef.current) {
        console.log('[DEBUG-VAD] Triggering barge-in (AI is speaking)')
        triggerBargeInRef.current?.()
        // Don't set currentSpeaker here - wait for AI to actually stop
        return
      }

      // HYBRID APPROACH: Set currentSpeaker if EITHER VAD OR Deepgram detects speech
      setCurrentSpeaker('user')
      audioChunksRef.current = []
    },
    onSpeechEnd: (_audio, duration) => {
      console.log(
        `[DEBUG-VAD] Speech END (${duration.toFixed(2)}s), isProcessing:`,
        isProcessingRef.current,
      )
      console.log(
        '[DEBUG-VAD] Pending transcript:',
        pendingTranscriptRef.current.substring(0, 50) || '(empty)',
      )

      // Fallback: If we have accumulated transcript and Deepgram hasn't
      // triggered onSpeechEnd yet (UtteranceEnd not received), send it now
      if (
        pendingTranscriptRef.current.trim() &&
        session &&
        !isProcessingRef.current
      ) {
        console.log(
          '[DEBUG-VAD] Fallback trigger - sending transcript that Deepgram missed',
        )
        isProcessingRef.current = true
        const transcript = pendingTranscriptRef.current.trim()
        pendingTranscriptRef.current = ''
        setLiveTranscript('')

        const audioBase64 = getAccumulatedAudioBase64()
        handleUserSpeechEnd(transcript, audioBase64)
        audioChunksRef.current = []

        setTimeout(() => {
          isProcessingRef.current = false
        }, 100)
      }

      // Update ref for hybrid detection
      vadIsSpeakingRef.current = false

      // HYBRID APPROACH: Only clear currentSpeaker if Deepgram also stopped
      // This prevents flickering when one system detects end before the other
      if (!sttState.isSpeaking) {
        console.log(
          '[DEBUG-VAD] Clearing currentSpeaker (Deepgram also stopped)',
        )
        setCurrentSpeaker(null)
      } else {
        console.log(
          '[DEBUG-VAD] Keeping currentSpeaker=user (Deepgram still speaking)',
        )
      }
    },
  })

  // Streaming audio player
  const [streamingAudioState, streamingAudioActions] = useStreamingAudioPlayer({
    onStart: () => {
      console.log('[DEBUG-Audio] AI audio playback STARTED')
      setIsAISpeakingSync(true)
      setCurrentSpeaker('ai')

      // Start Deepgram keepalive to prevent timeout during AI speech
      // We don't send audio while AI speaks (to prevent TTS echo), so keepalive is needed
      if (useVoiceInput && sttState.isConnected) {
        sttActions.startKeepalive()
      }
    },
    onEnd: () => {
      console.log('[DEBUG-Audio] AI audio playback ENDED')
      setIsAISpeakingSync(false)
      setCurrentSpeaker(null)

      // Stop keepalive - audio will flow again now that AI is done
      sttActions.stopKeepalive()

      if (sessionEndPendingRef.current) {
        sessionEndPendingRef.current = false
        setTimeout(() => handleEndSession(), 100)
      }
    },
    onError: (error) => {
      console.log('[DEBUG-Audio] AI audio playback ERROR:', error)
      setIsAISpeakingSync(false)
      setCurrentSpeaker(null)

      // Stop keepalive on error
      sttActions.stopKeepalive()

      if (sessionEndPendingRef.current) {
        sessionEndPendingRef.current = false
        setTimeout(() => handleEndSession(), 100)
      }
    },
  })

  // SSE conversation stream
  // Note: The streaming endpoint will use reflection-specific prompts when
  // the session is a ReflectionSession (detected server-side)
  const [conversationStreamState, conversationStreamActions] =
    useConversationStream({
      onStart: () => {},
      onText: () => {},
      onAudio: (audioBase64, audioUrl, contentType) => {
        if (USE_SSE_STREAMING && audioBase64) {
          streamingAudioActions.queueAudioChunk(audioBase64, contentType)
        } else if (audioUrl) {
          audioQueueRef.current.push(audioUrl)
          if (!isPlayingQueueRef.current) {
            playNextInQueueRef.current?.()
          }
        }
      },
      onDone: () => {
        queryClient.invalidateQueries({ queryKey: ['reflection', 'today'] })
      },
      onError: (error) => {
        console.error('[ConversationStream] Error:', error)
        toast.error('AI response failed', { description: error })
        setIsAISpeakingSync(false)
        setCurrentSpeaker(null)

        // Stop keepalive on conversation error
        sttActions.stopKeepalive()
      },
    })

  // Legacy audio player
  const [audioState, audioActions] = useAudioPlayer({
    onPlay: () => {
      setIsAISpeakingSync(true)
      setCurrentSpeaker('ai')

      // Start Deepgram keepalive (legacy player)
      if (useVoiceInput && sttState.isConnected) {
        sttActions.startKeepalive()
      }
    },
    onEnd: () => {
      if (audioQueueRef.current.length > 0) {
        playNextInQueueRef.current?.()
        return
      }
      setIsAISpeakingSync(false)
      setCurrentSpeaker(null)
      isPlayingQueueRef.current = false

      // Stop keepalive (legacy player)
      sttActions.stopKeepalive()

      if (sessionEndPendingRef.current) {
        sessionEndPendingRef.current = false
        setTimeout(() => handleEndSession(), 100)
      }
    },
    onError: () => {
      if (audioQueueRef.current.length > 0) {
        playNextInQueueRef.current?.()
        return
      }
      setIsAISpeakingSync(false)
      setCurrentSpeaker(null)
      isPlayingQueueRef.current = false

      // Stop keepalive on error (legacy player)
      sttActions.stopKeepalive()

      if (sessionEndPendingRef.current) {
        sessionEndPendingRef.current = false
        setTimeout(() => handleEndSession(), 100)
      }
    },
  })

  // Check audio support
  const { isSupported, missingFeatures } = useAudioSupport()

  // Track audio send count for debugging
  const audioSendCountRef = useRef(0)
  const lastAudioLogTimeRef = useRef(0)

  // Audio recorder
  // NOTE: We no longer use onSpeechStart/onSpeechEnd from recorder for UI state
  // VAD is the single source of truth for "user is speaking" state
  const [recorderState, recorderActions] = useAudioRecorder({
    onSpeechStart: () => {
      // NOTE: VAD handles currentSpeaker state, not the recorder
      console.log(
        '[DEBUG-Recorder] Speech start detected (ignored for UI - VAD handles this)',
      )
    },
    onSpeechEnd: () => {
      // NOTE: VAD handles currentSpeaker state, not the recorder
      // Only use this as fallback for sending transcript when STT is disconnected
      console.log(
        '[DEBUG-Recorder] Speech end detected, isProcessing:',
        isProcessingRef.current,
      )
      if (isProcessingRef.current) return
      if (
        !sttState.isConnected &&
        pendingTranscriptRef.current.trim() &&
        session
      ) {
        console.log(
          '[DEBUG-Recorder] Fallback - STT not connected, sending transcript',
        )
        isProcessingRef.current = true
        const transcript = pendingTranscriptRef.current.trim()
        pendingTranscriptRef.current = ''
        setLiveTranscript('')
        setTimeout(() => {
          const audioBase64 = getAccumulatedAudioBase64()
          handleUserSpeechEnd(transcript, audioBase64)
          audioChunksRef.current = []
          setTimeout(() => {
            isProcessingRef.current = false
          }, 100)
        }, 150)
      }
    },
    onPCMData: (pcmData) => {
      // Log audio send status every 2 seconds
      const now = Date.now()
      audioSendCountRef.current++
      if (now - lastAudioLogTimeRef.current > 2000) {
        console.log(
          '[DEBUG-Audio] Sending audio to Deepgram, connected:',
          sttState.isConnected,
          'voiceInput:',
          useVoiceInput,
          'chunks sent:',
          audioSendCountRef.current,
        )
        lastAudioLogTimeRef.current = now
        audioSendCountRef.current = 0
      }

      // Don't send audio to Deepgram while AI is speaking (prevents TTS echo)
      if (sttState.isConnected && useVoiceInput && !isAISpeakingRef.current) {
        sttActions.sendAudio(pcmData)
      }
      const pcmArray = new Int16Array(pcmData)
      audioChunksRef.current.push(pcmArray)
    },
  })

  // Update live transcript from STT
  useEffect(() => {
    if (sttState.interimTranscript) {
      setLiveTranscript(
        pendingTranscriptRef.current +
          (pendingTranscriptRef.current ? ' ' : '') +
          sttState.interimTranscript,
      )
    }
  }, [sttState.interimTranscript])

  // DEBUG: Periodic status logger - logs state every 3 seconds during recording
  useEffect(() => {
    if (sessionState !== 'recording') return

    const statusInterval = setInterval(() => {
      console.log('[DEBUG-STATUS] ==================')
      console.log('[DEBUG-STATUS] Session state:', sessionState)
      console.log('[DEBUG-STATUS] currentSpeaker:', currentSpeaker)
      console.log('[DEBUG-STATUS] isAISpeaking:', isAISpeaking)
      console.log('[DEBUG-STATUS] VAD isSpeaking:', vadState.isSpeaking)
      console.log('[DEBUG-STATUS] VAD isListening:', vadState.isListening)
      console.log('[DEBUG-STATUS] STT isConnected:', sttState.isConnected)
      console.log('[DEBUG-STATUS] STT isSpeaking:', sttState.isSpeaking)
      console.log(
        '[DEBUG-STATUS] Pending transcript:',
        pendingTranscriptRef.current.substring(0, 30) || '(empty)',
      )
      console.log('[DEBUG-STATUS] isProcessing:', isProcessingRef.current)
      console.log('[DEBUG-STATUS] ==================')
    }, 3000)

    return () => clearInterval(statusInterval)
  }, [
    sessionState,
    currentSpeaker,
    isAISpeaking,
    vadState.isSpeaking,
    vadState.isListening,
    sttState.isConnected,
    sttState.isSpeaking,
  ])

  // Play audio helper
  const playAudio = useCallback(
    async (url: string | null) => {
      if (!url) {
        setIsAISpeakingSync(true)
        setCurrentSpeaker('ai')
        setTimeout(() => {
          setIsAISpeakingSync(false)
          setCurrentSpeaker(null)
        }, 2500)
        return
      }
      try {
        await audioActions.play(url)
      } catch {
        setIsAISpeakingSync(true)
        setCurrentSpeaker('ai')
        setTimeout(() => {
          setIsAISpeakingSync(false)
          setCurrentSpeaker(null)
        }, 2500)
      }
    },
    [audioActions, setIsAISpeakingSync],
  )

  // Play next in queue
  const playNextInQueue = useCallback(async () => {
    if (audioQueueRef.current.length === 0) {
      isPlayingQueueRef.current = false
      return
    }
    isPlayingQueueRef.current = true
    const nextUrl = audioQueueRef.current.shift()
    if (nextUrl) {
      try {
        await audioActions.play(nextUrl)
      } catch {
        playNextInQueue()
      }
    }
  }, [audioActions])

  useEffect(() => {
    playNextInQueueRef.current = playNextInQueue
  }, [playNextInQueue])

  // Start session mutation
  const startMutation = useMutation({
    mutationFn: () => startReflectionFn(),
    onSuccess: async (newSession) => {
      queryClient.setQueryData(['reflection', 'today'], newSession)
      setSessionState('recording')

      // Show warning about single attempt
      toast.info('This is your only reflection for today', {
        description:
          "Make it count! Take your time to explore what's on your mind.",
        duration: 5000,
      })

      audioActions.enableAutoplay()
      streamingAudioActions.enablePlayback()

      if (useVoiceInput) {
        await sttActions.connect()
      }

      await recorderActions.startRecording()
      startTimer()

      // Use preloaded greeting or generate fresh
      if (preloadedGreetingRef.current) {
        const preloaded = preloadedGreetingRef.current
        preloadedGreetingRef.current = null

        if (preloaded.audioBase64) {
          streamingAudioActions.queueAudioChunk(
            preloaded.audioBase64,
            preloaded.contentType,
          )
        } else if (preloaded.audioUrl) {
          playAudio(preloaded.audioUrl)
        }

        savePreloadedReflectionGreetingFn({
          data: {
            sessionId: newSession.id,
            text: preloaded.text,
            audioUrl: preloaded.audioUrl,
          },
        })
          .then(() => {
            queryClient.invalidateQueries({ queryKey: ['reflection', 'today'] })
          })
          .catch(console.error)
      } else {
        // Fallback: will use default greeting behavior from conversation stream
      }
    },
    onError: (error) => {
      console.error('Failed to start reflection:', error)
      toast.error('Failed to start reflection', {
        description:
          error instanceof Error ? error.message : 'Please try again.',
        duration: 5000,
      })
      setSessionState('idle')
    },
  })

  // End session mutation
  const endMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      // Save duration atomically with status change to prevent data loss
      return endReflectionFn({
        data: {
          sessionId,
          totalUserSpeakingTime:
            elapsedTimeRef.current > 0 ? elapsedTimeRef.current : elapsedTime,
        },
      })
    },
    onSuccess: (updatedSession) => {
      recorderActions.stopRecording()
      sttActions.disconnect()
      audioActions.stop()
      streamingAudioActions.stop()
      conversationStreamActions.cancel()
      stopTimer()

      queryClient.setQueryData(['reflection', 'today'], updatedSession)

      if (updatedSession) {
        processReflection(updatedSession.id)
      }

      const dateStr = format(new Date(updatedSession.date), 'yyyy-MM-dd')
      navigate({ to: '/reflections/$date', params: { date: dateStr } })
    },
    onError: (error) => {
      console.error('Failed to end reflection:', error)
      toast.error('Failed to end reflection')
    },
  })

  // Process reflection mutation
  const processReflectionMutation = useMutation({
    mutationFn: (sessionId: string) =>
      processReflectionFn({ data: { sessionId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reflection', 'today'] })
      queryClient.invalidateQueries({ queryKey: ['reflections'] })
      setSessionState('completed')
    },
    onError: () => {
      setSessionState('completed')
    },
  })

  // Update session state from fetched data
  useEffect(() => {
    if (session) {
      if (session.status === 'completed') {
        setSessionState('completed')
        setElapsedTime(session.totalUserSpeakingTime)
      } else if (session.status === 'processing') {
        setSessionState('processing')
      } else if (session.status === 'active' && sessionState === 'idle') {
        setElapsedTime(session.totalUserSpeakingTime)
      } else if (session.status === 'paused') {
        setSessionState('paused')
        setElapsedTime(session.totalUserSpeakingTime)
      }
    }
  }, [session, sessionState])

  // Pre-generate greeting
  useEffect(() => {
    const shouldPreload =
      sessionState === 'idle' &&
      !isPreloadingRef.current &&
      !preloadedGreetingRef.current &&
      !hasPreloadedOnceRef.current &&
      (!session || session.status !== 'completed')

    if (shouldPreload) {
      hasPreloadedOnceRef.current = true
      isPreloadingRef.current = true

      preGenerateReflectionGreetingFn()
        .then(
          (result: {
            text: string
            audioUrl: string | null
            audioBase64: string | null
            contentType: string
          }) => {
            preloadedGreetingRef.current = result
            isPreloadingRef.current = false
          },
        )
        .catch(() => {
          isPreloadingRef.current = false
        })
    }
  }, [sessionState, session])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      preloadedGreetingRef.current = null
      isPreloadingRef.current = false
      hasPreloadedOnceRef.current = false
    }
  }, [])

  // Barge-in helper
  const triggerBargeIn = useCallback(() => {
    streamingAudioActions.stop()
    audioActions.stop()
    conversationStreamActions.cancel()

    if (session?.id) {
      fetch('/api/stream/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id }),
      }).catch(console.error)
    }

    setIsAISpeakingSync(false)
  }, [
    session?.id,
    streamingAudioActions,
    audioActions,
    conversationStreamActions,
    setIsAISpeakingSync,
  ])

  useEffect(() => {
    triggerBargeInRef.current = triggerBargeIn
  }, [triggerBargeIn])

  // Timer helpers
  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (hardCutoffTimerRef.current) {
      clearTimeout(hardCutoffTimerRef.current)
      hardCutoffTimerRef.current = null
    }
  }, [])

  const forceEndSession = useCallback(() => {
    // Stop all audio/recording immediately
    streamingAudioActions.stop()
    audioActions.stop()
    conversationStreamActions.cancel()
    recorderActions.stopRecording()
    sttActions.disconnect()
    stopTimer()

    setIsAutoEnding(true)
    setIsEndingSession(true)

    if (session) {
      // Pass the current elapsed time to ensure it's saved atomically
      // The navigation will happen in endMutation.onSuccess
      endMutation.mutate(session.id)
    }
  }, [
    session,
    endMutation,
    streamingAudioActions,
    audioActions,
    conversationStreamActions,
    recorderActions,
    sttActions,
    stopTimer,
  ])

  const startTimer = useCallback(() => {
    warningShownRef.current = false
    sessionEndPendingRef.current = false
    elapsedTimeRef.current = 0

    timerRef.current = setInterval(() => {
      setElapsedTime((prev) => {
        const newTime = prev + 1
        elapsedTimeRef.current = newTime
        const currentSession = sessionRef.current
        const maxDuration =
          currentSession?.maxDuration ?? REFLECTION_CONFIG.MAX_DURATION_SECONDS
        const remainingTime = maxDuration - newTime

        // Warning at 60 seconds remaining (1 minute)
        if (remainingTime === 60 && !warningShownRef.current) {
          warningShownRef.current = true
          toast.warning('1 minute remaining', {
            description:
              'Your reflection will end soon. Wrap up your thoughts!',
            duration: 5000,
          })
        }

        if (currentSession && newTime >= currentSession.maxDuration) {
          if (isAISpeakingRef.current) {
            if (!sessionEndPendingRef.current) {
              sessionEndPendingRef.current = true
              toast.info('Session time reached', {
                description: 'Waiting for AI to finish speaking...',
                duration: 3000,
              })

              if (!hardCutoffTimerRef.current) {
                hardCutoffTimerRef.current = setTimeout(() => {
                  toast.info('Session ending', {
                    description: 'Saving your reflection...',
                    duration: 2000,
                  })
                  forceEndSession()
                }, REFLECTION_CONFIG.HARD_CUTOFF_GRACE_SECONDS * 1000)
              }
            }
          } else {
            forceEndSession()
          }
        }
        return newTime
      })
    }, 1000)
  }, [forceEndSession])

  // Cleanup
  useEffect(() => {
    return () => {
      stopTimer()
      if (hardCutoffTimerRef.current) {
        clearTimeout(hardCutoffTimerRef.current)
      }
      recorderActions.stopRecording()
      sttActions.disconnect()
      audioActions.stop()
      streamingAudioActions.stop()
      conversationStreamActions.cancel()
      if (USE_VAD) vadActions.pause()
    }
  }, [])

  const processReflection = (sessionId: string) => {
    processReflectionMutation.mutate(sessionId)
  }

  const handleUserSpeechEnd = (transcript: string, _audioBase64?: string) => {
    if (session && transcript.trim()) {
      const now = Date.now()
      const trimmedTranscript = transcript.trim()
      if (
        trimmedTranscript === lastSentMessageRef.current &&
        now - lastSentTimeRef.current < 2000
      ) {
        return
      }

      lastSentMessageRef.current = trimmedTranscript
      lastSentTimeRef.current = now
      setCurrentSpeaker(null)

      if (USE_SSE_STREAMING) {
        conversationStreamActions.sendMessage(session.id, trimmedTranscript)
      }
    }
  }

  const handleStartSession = useCallback(async () => {
    const hasPermission = await recorderActions.requestPermission()
    if (!hasPermission) {
      toast.error('Microphone Required', {
        description: 'Please allow microphone access to start a reflection.',
        duration: 5000,
      })
      return
    }

    setSessionState('starting')
    startMutation.mutate()
  }, [startMutation, recorderActions])

  const handleEndSession = useCallback(async () => {
    if (!session) return

    setIsEndingSession(true)

    if (elapsedTime < MIN_SESSION_DURATION) {
      recorderActions.stopRecording()
      sttActions.disconnect()
      audioActions.stop()
      streamingAudioActions.stop()
      conversationStreamActions.cancel()
      stopTimer()

      try {
        await cancelShortReflectionFn({ data: { sessionId: session.id } })
      } catch (error) {
        console.error('Failed to cancel short reflection:', error)
      }

      queryClient.invalidateQueries({ queryKey: ['reflection', 'today'] })
      queryClient.invalidateQueries({ queryKey: ['reflections'] })
      setSessionState('idle')
      setElapsedTime(0)
      setIsEndingSession(false)

      toast.info('Reflection too short', {
        description:
          'You need at least 1 minute to record. Come back anytime to try again!',
        duration: 5000,
      })
      return
    }

    endMutation.mutate(session.id)
  }, [
    session,
    elapsedTime,
    endMutation,
    recorderActions,
    sttActions,
    audioActions,
    streamingAudioActions,
    conversationStreamActions,
    stopTimer,
    queryClient,
  ])

  const handleToggleMute = useCallback(() => {
    recorderActions.toggleMute()
  }, [recorderActions])

  // Calculate remaining time
  const maxDuration =
    session?.maxDuration ?? REFLECTION_CONFIG.MAX_DURATION_SECONDS
  const remainingTime = Math.max(0, maxDuration - elapsedTime)

  // Browser not supported
  if (!isSupported) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Browser Not Supported</h2>
          <p className="text-muted-foreground">
            Your browser is missing required features:{' '}
            {missingFeatures.join(', ')}.
          </p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  // Completed session
  if (sessionState === 'completed' && session) {
    return <CompletedReflectionView session={session} />
  }

  // Processing session
  if (sessionState === 'processing') {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="h-16 w-16 animate-pulse rounded-full bg-violet-500/20 flex items-center justify-center mx-auto">
            <MessageCircle className="h-8 w-8 text-violet-500" />
          </div>
          <h2 className="mt-6 text-xl font-semibold">
            Processing your reflection...
          </h2>
          <p className="mt-2 text-muted-foreground">Generating your summary</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col items-center justify-center p-8">
      {/* Auto-ending overlay */}
      {isAutoEnding && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="text-center">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
            <h2 className="mt-4 text-xl font-semibold">Ending reflection...</h2>
            <p className="mt-2 text-muted-foreground">Saving your thoughts</p>
          </div>
        </div>
      )}

      {/* Date Header */}
      <div className="text-center mb-8">
        <p className="text-sm text-muted-foreground uppercase tracking-wider">
          {format(new Date(), 'EEEE')}
        </p>
        <h1 className="text-2xl font-light">
          {format(new Date(), 'MMMM d, yyyy')}
        </h1>
      </div>

      {/* Timer */}
      {sessionState === 'recording' && (
        <div className="mb-6">
          <CountdownTimer
            remainingSeconds={remainingTime}
            maxSeconds={maxDuration}
          />
        </div>
      )}

      {/* Main Circle */}
      <div className="relative mb-8">
        <PulsingCircle
          isActive={sessionState === 'recording'}
          speaker={
            isAISpeaking
              ? 'ai'
              : recorderState.audioLevel > 0.1
                ? 'user'
                : currentSpeaker
          }
          isMuted={recorderState.isMuted}
        />
      </div>

      {/* Audio enable button */}
      {sessionState === 'recording' &&
        !audioState.canAutoplay &&
        !streamingAudioState.isReady && (
          <div className="mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                audioActions.enableAutoplay()
                streamingAudioActions.enablePlayback()
              }}
              className="flex items-center gap-2"
            >
              <Volume2 className="h-4 w-4" />
              Click to enable audio
            </Button>
          </div>
        )}

      {/* Streaming indicator */}
      {sessionState === 'recording' && conversationStreamState.isStreaming && (
        <div className="mb-2 text-xs text-muted-foreground">
          AI is responding...
        </div>
      )}

      {/* Idle state controls */}
      {sessionState === 'idle' && (
        <div className="text-center">
          <Button
            size="lg"
            onClick={handleStartSession}
            className="rounded-full px-8 py-6 text-lg bg-violet-600 hover:bg-violet-700"
          >
            <Play className="mr-2 h-5 w-5" />
            Start Reflection
          </Button>
          <p className="mt-4 text-sm text-muted-foreground">
            10 minutes to process your thoughts
          </p>
          {recorderState.error && (
            <p className="mt-2 text-sm text-red-500">{recorderState.error}</p>
          )}
        </div>
      )}

      {sessionState === 'starting' && (
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="mt-4 text-muted-foreground">Starting reflection...</p>
        </div>
      )}

      {(sessionState === 'recording' || sessionState === 'paused') && (
        <SessionControls
          isMuted={recorderState.isMuted}
          isPaused={sessionState === 'paused'}
          isEnding={isEndingSession || endMutation.isPending}
          elapsedTime={elapsedTime}
          minDuration={MIN_SESSION_DURATION}
          onToggleMute={handleToggleMute}
          onEndSession={handleEndSession}
        />
      )}

      {/* Live transcript */}
      {sessionState === 'recording' && (
        <div className="mt-8 max-w-md text-center">
          <p className="text-sm text-muted-foreground italic">
            {isAISpeaking
              ? 'AI is speaking...'
              : USE_VAD && vadState.isSpeaking
                ? 'Listening...'
                : recorderState.audioLevel > 0.1
                  ? 'Listening...'
                  : "Take your time. Share what's on your mind."}
          </p>
          {liveTranscript && <p className="mt-2 text-sm">{liveTranscript}</p>}
          {USE_VAD && vadState.isLoading && (
            <p className="mt-1 text-xs text-muted-foreground">
              Loading speech detection...
            </p>
          )}
        </div>
      )}

      {/* Input controls */}
      {sessionState === 'recording' && (
        <div className="mt-4 w-full max-w-md">
          <div className="flex justify-center mb-3">
            <div className="inline-flex rounded-lg border p-1 text-xs">
              <button
                onClick={() => setUseVoiceInput(true)}
                className={`px-3 py-1 rounded-md transition-colors ${
                  useVoiceInput
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Voice
              </button>
              <button
                onClick={() => setUseVoiceInput(false)}
                className={`px-3 py-1 rounded-md transition-colors ${
                  !useVoiceInput
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Text
              </button>
            </div>
          </div>

          {useVoiceInput && (
            <div className="text-center mb-3">
              {sttState.isConnecting && (
                <span className="text-xs text-muted-foreground">
                  Connecting...
                </span>
              )}
              {sttState.isConnected && (
                <span className="text-xs text-emerald-600">
                  Speech recognition active
                </span>
              )}
              {sttState.error && (
                <span className="text-xs text-amber-600">{sttState.error}</span>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <input
              type="text"
              value={liveTranscript}
              onChange={(e) => setLiveTranscript(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && liveTranscript.trim() && session) {
                  handleUserSpeechEnd(liveTranscript)
                  setLiveTranscript('')
                  pendingTranscriptRef.current = ''
                }
              }}
              placeholder={
                useVoiceInput ? 'Speak or type...' : 'Type your message...'
              }
              className="flex-1 px-4 py-2 border rounded-lg text-sm"
              disabled={isAISpeaking}
            />
            <Button
              onClick={() => {
                if (liveTranscript.trim() && session) {
                  handleUserSpeechEnd(liveTranscript)
                  setLiveTranscript('')
                  pendingTranscriptRef.current = ''
                }
              }}
              disabled={!liveTranscript.trim() || isAISpeaking}
              size="sm"
            >
              Send
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * View for completed reflections
 */
function CompletedReflectionView({
  session,
}: {
  session: ReflectionSession & { turns?: ReflectionTurn[] }
}) {
  return (
    <div className="p-8 max-w-2xl mx-auto">
      {/* Date Header */}
      <div className="text-center mb-8">
        <p className="text-sm text-muted-foreground uppercase tracking-wider">
          {format(new Date(session.date), 'EEEE')}
        </p>
        <h1 className="text-2xl font-light">
          {format(new Date(session.date), 'MMMM d, yyyy')}
        </h1>
        <p className="mt-2 text-sm text-violet-600">Reflection completed</p>
      </div>

      {/* Summary */}
      {session.summaryText && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-3">Your Reflection</h2>
          <div className="prose prose-sm prose-zinc">
            {session.summaryText.split('\n\n').map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>
        </div>
      )}

      {/* Transcript */}
      {session.turns && session.turns.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Conversation</h2>
          <div className="space-y-4">
            {session.turns.map((turn, i) => (
              <div
                key={i}
                className={`flex ${turn.speaker === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                    turn.speaker === 'user'
                      ? 'bg-violet-600 text-white'
                      : 'bg-muted'
                  }`}
                >
                  <p className="text-sm">{turn.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Processing state */}
      {!session.summaryText && (
        <div className="text-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="mt-4 text-muted-foreground">
            Your reflection is being processed...
          </p>
        </div>
      )}
    </div>
  )
}
