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
 *
 * SIMPLIFIED ARCHITECTURE (Jan 2026):
 * - Direct use of useDeepgramSTT, useVAD, useAudioRecorder hooks
 * - No complex useSpeechDetection abstraction
 * - 5-second recovery timeout for stuck states
 * - Visual feedback when recovery happens
 */

import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import { AlertCircle, MessageCircle, Play, Volume2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../../components/ui/button'
import { MagicButton } from '../../components/ui/magic-button'
import {
  cancelShortReflectionFn,
  endReflectionFn,
  getTodayReflectionFn,
  startReflectionFn,
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
import { useStreamingAudioPlayer } from '../../hooks/useStreamingAudioPlayer'
import { useConversationStream } from '../../hooks/useConversationStream'
import { useDeepgramSTT } from '../../hooks/useDeepgramSTT'
import { useVAD } from '../../hooks/useVAD'
import {
  REFLECTION_CONFIG,
  getDeepgramLanguageParam,
  getDeepgramModel,
} from '../../types/voice-session'
import type {
  Language,
  ReflectionSession,
  ReflectionTurn,
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
  const [showResetButton, setShowResetButton] = useState(false)

  // Refs for managing state across callbacks
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const sessionEndPendingRef = useRef(false)
  const warningShownRef = useRef(false)
  const hardCutoffTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isEndingSessionRef = useRef(false)
  const elapsedTimeRef = useRef(0)
  const preloadedGreetingRef = useRef<{
    text: string
    audioUrl: string | null
    audioBase64: string | null
    contentType: string
  } | null>(null)
  const isPreloadingRef = useRef(false)
  const hasPreloadedOnceRef = useRef(false)
  const isAISpeakingRef = useRef(false)
  const sessionRef = useRef<ReflectionSession | null>(null)
  const audioQueueRef = useRef<Array<string>>([])
  const isPlayingQueueRef = useRef(false)
  const playNextInQueueRef = useRef<(() => void) | null>(null)
  const lastSentMessageRef = useRef<string>('')
  const lastSentTimeRef = useRef<number>(0)
  // For transcript accumulation (replaces useSpeechDetection internal state)
  const pendingTranscriptRef = useRef<string>('')
  // For audio chunk accumulation
  const audioChunksRef = useRef<Array<Int16Array>>([])
  // Recovery timeout ref
  const speechTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  // Track when user started speaking (for stuck state detection)
  const userSpeakingStartRef = useRef<number | null>(null)
  const resetButtonTimerRef = useRef<NodeJS.Timeout | null>(null)

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

  // Update isAISpeaking ref for use in callbacks
  useEffect(() => {
    isAISpeakingRef.current = isAISpeaking
  }, [isAISpeaking])

  // Barge-in handler ref - will be set after other hooks are initialized
  const triggerBargeInRef = useRef<(() => void) | null>(null)

  // ==========================================
  // Direct Hooks - Simplified Architecture
  // ==========================================

  // Deepgram STT for transcription
  const [sttState, sttActions] = useDeepgramSTT({
    language: deepgramLanguage,
    model: deepgramModel,
    onFinalTranscript: (transcript: string) => {
      console.log('[STT] Final transcript:', transcript)
      pendingTranscriptRef.current +=
        (pendingTranscriptRef.current ? ' ' : '') + transcript
    },
    onSpeechStart: () => {
      console.log('[STT] Speech started')
      if (!isAISpeakingRef.current) {
        setCurrentSpeaker('user')
        audioChunksRef.current = []
      }
    },
    onSpeechEnd: () => {
      console.log('[STT] Speech ended (UtteranceEnd)')
      // Send accumulated transcript to AI
      if (pendingTranscriptRef.current.trim() && sessionRef.current) {
        const transcript = pendingTranscriptRef.current.trim()
        pendingTranscriptRef.current = ''
        setLiveTranscript('')
        handleUserSpeechEnd(transcript)
      }
      setCurrentSpeaker(null)
    },
    onError: (error: Error) => {
      console.error('[STT] Error:', error)
    },
    onDegradedState: () => {
      console.log(
        '[STT] Degraded state detected - showing reset button immediately',
      )
      setShowResetButton(true)
    },
  })

  // VAD for barge-in detection only (when AI is speaking)
  const [vadState, vadActions] = useVAD({
    enabled: USE_VAD && sessionState === 'recording',
    positiveSpeechThreshold: 0.8,
    redemptionMs: 800,
    onSpeechStart: () => {
      console.log(
        '[VAD] Speech detected, isAISpeaking:',
        isAISpeakingRef.current,
      )
      // Only trigger barge-in when AI is speaking
      if (isAISpeakingRef.current) {
        console.log('[VAD] BARGE-IN triggered!')
        triggerBargeInRef.current?.()
      }
    },
    onSpeechEnd: () => {
      console.log('[VAD] Speech ended')
      // Reset currentSpeaker when VAD detects speech end
      // This prevents the "stuck green" state when Deepgram's UtteranceEnd is delayed
      if (!isAISpeakingRef.current) {
        setCurrentSpeaker(null)
      }
    },
  })

  // Audio recorder for capturing and streaming PCM to Deepgram
  const [recorderState, recorderActions] = useAudioRecorder({
    onSpeechStart: () => {
      if (!isAISpeakingRef.current) {
        setCurrentSpeaker('user')
        audioChunksRef.current = []
      }
    },
    onSpeechEnd: () => {
      // Fallback handled by recovery timeout
    },
    onPCMData: (pcmData: ArrayBuffer) => {
      // Send audio to Deepgram for transcription
      if (sttState.isConnected && useVoiceInput && !isAISpeakingRef.current) {
        sttActions.sendAudio(pcmData)
      }
      // Accumulate audio chunks when user is speaking
      if (!isAISpeakingRef.current) {
        const pcmArray = new Int16Array(pcmData)
        audioChunksRef.current.push(pcmArray)
      }
    },
  })

  // Update live transcript from interim results
  useEffect(() => {
    if (sttState.interimTranscript) {
      setLiveTranscript(
        pendingTranscriptRef.current +
          (pendingTranscriptRef.current ? ' ' : '') +
          sttState.interimTranscript,
      )
    }
  }, [sttState.interimTranscript])

  // ==========================================
  // Recovery Timeout - Reset stuck speaking state
  // ==========================================
  useEffect(() => {
    // Don't start recovery if session is ending
    if (isEndingSessionRef.current) return

    // Only start recovery timer when user appears to be speaking but AI isn't
    if (
      currentSpeaker === 'user' &&
      !isAISpeaking &&
      sessionState === 'recording'
    ) {
      speechTimeoutRef.current = setTimeout(() => {
        // Don't recover if session ended during timeout
        if (isEndingSessionRef.current) return

        // If no transcript accumulated after 5 seconds, we're stuck
        if (!pendingTranscriptRef.current.trim()) {
          console.warn(
            '[Recovery] No transcript after 5s - resetting speech state',
          )
          setCurrentSpeaker(null)
          pendingTranscriptRef.current = ''
          setLiveTranscript('')

          // Show toast notification
          toast.info('Speech detection reset', {
            description: 'Please try speaking again',
            duration: 3000,
          })

          // Attempt to reconnect Deepgram if disconnected
          if (!sttState.isConnected && !sttState.isConnecting) {
            console.log('[Recovery] Reconnecting to Deepgram...')
            sttActions.connect()
          }
        }
      }, 5000)
    }

    return () => {
      if (speechTimeoutRef.current) {
        clearTimeout(speechTimeoutRef.current)
        speechTimeoutRef.current = null
      }
    }
  }, [
    currentSpeaker,
    isAISpeaking,
    sessionState,
    sttState.isConnected,
    sttState.isConnecting,
    sttActions,
  ])

  // ==========================================
  // Stuck State Detection - Show reset button after 8 seconds
  // ==========================================
  useEffect(() => {
    // Track when user starts speaking
    if (
      currentSpeaker === 'user' &&
      !isAISpeaking &&
      sessionState === 'recording'
    ) {
      if (!userSpeakingStartRef.current) {
        userSpeakingStartRef.current = Date.now()
      }

      // Show reset button after 8 seconds of being in "user speaking" state
      resetButtonTimerRef.current = setTimeout(() => {
        console.log(
          '[Recovery] Showing reset button - stuck in user speaking state',
        )
        setShowResetButton(true)
      }, 8000)
    } else {
      // Clear timer and hide button when state changes
      userSpeakingStartRef.current = null
      setShowResetButton(false)
      if (resetButtonTimerRef.current) {
        clearTimeout(resetButtonTimerRef.current)
        resetButtonTimerRef.current = null
      }
    }

    return () => {
      if (resetButtonTimerRef.current) {
        clearTimeout(resetButtonTimerRef.current)
        resetButtonTimerRef.current = null
      }
    }
  }, [currentSpeaker, isAISpeaking, sessionState])

  // Reset handler for the stuck state button - Full audio system restart
  const handleResetSpeechState = useCallback(async () => {
    console.log('[Recovery] Full audio system restart triggered')

    // Reset all UI state
    setCurrentSpeaker(null)
    pendingTranscriptRef.current = ''
    setLiveTranscript('')
    setShowResetButton(false)
    userSpeakingStartRef.current = null

    // Stop everything in the audio pipeline
    console.log('[Recovery] Stopping audio recorder...')
    recorderActions.stopRecording()

    console.log('[Recovery] Pausing VAD...')
    vadActions.pause()

    console.log('[Recovery] Disconnecting Deepgram...')
    sttActions.disconnect()

    // Wait for cleanup to complete
    await new Promise((resolve) => setTimeout(resolve, 500))

    // Restart everything (same order as session start)
    // IMPORTANT: Must wait for Deepgram to be fully connected before starting recorder
    // Otherwise the recorder sends audio to an old/closing WebSocket reference
    console.log('[Recovery] Reconnecting Deepgram (waiting for connection)...')
    await sttActions.connect()
    console.log('[Recovery] Deepgram connected!')

    console.log('[Recovery] Restarting audio recorder...')
    await recorderActions.startRecording()

    // VAD will auto-resume since enabled=true when sessionState='recording'
    console.log('[Recovery] Audio system restart complete')

    toast.info('Speech recognition reset', {
      description: 'Ready to listen again',
      duration: 3000,
    })
  }, [sttActions, recorderActions, vadActions])

  // Streaming audio player
  const [streamingAudioState, streamingAudioActions] = useStreamingAudioPlayer({
    onStart: () => {
      console.log('[Audio] AI started speaking')
      isAISpeakingRef.current = true
      setIsAISpeaking(true)
      setCurrentSpeaker('ai')
      // Start keepalive to prevent Deepgram timeout during AI speech
      sttActions.startKeepalive()
    },
    onEnd: () => {
      console.log('[Audio] AI finished speaking')
      isAISpeakingRef.current = false
      setIsAISpeaking(false)
      setCurrentSpeaker(null)
      // Stop keepalive - resume normal audio streaming
      sttActions.stopKeepalive()

      if (sessionEndPendingRef.current) {
        sessionEndPendingRef.current = false
        setTimeout(() => handleEndSession(), 100)
      }
    },
    onError: (error) => {
      console.error('[Audio] Playback error:', error)
      isAISpeakingRef.current = false
      setIsAISpeaking(false)
      setCurrentSpeaker(null)
      // Stop keepalive on error too
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
        isAISpeakingRef.current = false
        setIsAISpeaking(false)
        setCurrentSpeaker(null)
      },
    })

  // Legacy audio player
  const [audioState, audioActions] = useAudioPlayer({
    onPlay: () => {
      isAISpeakingRef.current = true
      setIsAISpeaking(true)
      setCurrentSpeaker('ai')
    },
    onEnd: () => {
      if (audioQueueRef.current.length > 0) {
        playNextInQueueRef.current?.()
        return
      }
      isAISpeakingRef.current = false
      setIsAISpeaking(false)
      setCurrentSpeaker(null)
      isPlayingQueueRef.current = false

      if (sessionEndPendingRef.current) {
        sessionEndPendingRef.current = false
        setTimeout(() => handleEndSession(), 100)
      }
    },
    onError: () => {
      // Legacy player error - silenced since streaming player is primary
      if (audioQueueRef.current.length > 0) {
        playNextInQueueRef.current?.()
        return
      }
      isAISpeakingRef.current = false
      setIsAISpeaking(false)
      setCurrentSpeaker(null)
      isPlayingQueueRef.current = false

      if (sessionEndPendingRef.current) {
        sessionEndPendingRef.current = false
        setTimeout(() => handleEndSession(), 100)
      }
    },
  })

  // Check audio support
  const { isSupported, missingFeatures } = useAudioSupport()

  // Play audio helper
  const playAudio = useCallback(
    async (url: string | null) => {
      if (!url) {
        isAISpeakingRef.current = true
        setIsAISpeaking(true)
        setCurrentSpeaker('ai')
        setTimeout(() => {
          isAISpeakingRef.current = false
          setIsAISpeaking(false)
          setCurrentSpeaker(null)
        }, 2500)
        return
      }
      try {
        await audioActions.play(url)
      } catch {
        isAISpeakingRef.current = true
        setIsAISpeaking(true)
        setCurrentSpeaker('ai')
        setTimeout(() => {
          isAISpeakingRef.current = false
          setIsAISpeaking(false)
          setCurrentSpeaker(null)
        }, 2500)
      }
    },
    [audioActions],
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

      // Connect to Deepgram and start recording
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
      vadActions.pause()
      audioActions.stop()
      streamingAudioActions.stop()
      conversationStreamActions.cancel()
      stopTimer()

      // Reset ending states to prevent stuck overlay
      isEndingSessionRef.current = false
      setIsAutoEnding(false)
      setIsEndingSession(false)

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
      // Reset ending states to prevent stuck overlay
      isEndingSessionRef.current = false
      setIsAutoEnding(false)
      setIsEndingSession(false)
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
    onError: (error) => {
      console.error('Failed to process reflection:', error)
      toast.error('Failed to generate summary', {
        description: 'Your conversation was saved. Summary may appear later.',
      })
      // Don't set to completed - let the detail page handle retry
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

    isAISpeakingRef.current = false
    setIsAISpeaking(false)
  }, [
    session?.id,
    streamingAudioActions,
    audioActions,
    conversationStreamActions,
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
    // Prevent re-entry if already ending (use ref to avoid stale closure)
    if (isEndingSessionRef.current) {
      console.log('[forceEndSession] Already ending, skipping')
      return
    }

    // Mark as ending immediately (ref first for instant visibility)
    isEndingSessionRef.current = true

    // Stop timer FIRST to prevent further ticks
    stopTimer()

    // Clear hard cutoff timer to prevent double-firing
    if (hardCutoffTimerRef.current) {
      clearTimeout(hardCutoffTimerRef.current)
      hardCutoffTimerRef.current = null
    }

    // Stop all audio/recording immediately
    streamingAudioActions.stop()
    audioActions.stop()
    conversationStreamActions.cancel()
    recorderActions.stopRecording()
    sttActions.disconnect()
    vadActions.pause()

    setIsAutoEnding(true)
    setIsEndingSession(true)

    // Guard against double mutation calls
    // Use sessionRef.current to avoid stale closure issue when timer fires
    if (sessionRef.current && !endMutation.isPending) {
      // Pass the current elapsed time to ensure it's saved atomically
      // The navigation will happen in endMutation.onSuccess
      endMutation.mutate(sessionRef.current.id)
    }
  }, [
    endMutation,
    streamingAudioActions,
    audioActions,
    conversationStreamActions,
    recorderActions,
    sttActions,
    vadActions,
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
      if (speechTimeoutRef.current) {
        clearTimeout(speechTimeoutRef.current)
      }
      recorderActions.stopRecording()
      sttActions.disconnect()
      vadActions.pause()
      audioActions.stop()
      streamingAudioActions.stop()
      conversationStreamActions.cancel()
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
    // Request microphone permission via the speech detection system
    // The hook will handle this when we call startRecording
    setSessionState('starting')
    startMutation.mutate()
  }, [startMutation])

  const handleEndSession = useCallback(async () => {
    // Prevent re-entry if already ending (use ref to avoid stale closure)
    if (isEndingSessionRef.current) {
      console.log('[handleEndSession] Already ending, skipping')
      return
    }

    // Use sessionRef.current to avoid stale closure issue
    if (!sessionRef.current) return

    // Mark as ending immediately (ref first for instant visibility)
    isEndingSessionRef.current = true

    // Stop timer FIRST to prevent further ticks
    stopTimer()

    // Clear hard cutoff timer to prevent double-firing
    if (hardCutoffTimerRef.current) {
      clearTimeout(hardCutoffTimerRef.current)
      hardCutoffTimerRef.current = null
    }

    setIsEndingSession(true)

    if (elapsedTime < MIN_SESSION_DURATION) {
      recorderActions.stopRecording()
      sttActions.disconnect()
      vadActions.pause()
      audioActions.stop()
      streamingAudioActions.stop()
      conversationStreamActions.cancel()

      try {
        await cancelShortReflectionFn({ data: { sessionId: sessionRef.current.id } })
      } catch (error) {
        console.error('Failed to cancel short reflection:', error)
      }

      queryClient.invalidateQueries({ queryKey: ['reflection', 'today'] })
      queryClient.invalidateQueries({ queryKey: ['reflections'] })
      setSessionState('idle')
      setElapsedTime(0)
      isEndingSessionRef.current = false
      setIsEndingSession(false)

      toast.info('Reflection too short', {
        description:
          'You need at least 1 minute to record. Come back anytime to try again!',
        duration: 5000,
      })
      return
    }

    // Guard against double mutation calls
    // Use sessionRef.current to avoid stale closure issue
    if (!endMutation.isPending) {
      endMutation.mutate(sessionRef.current.id)
    }
  }, [
    elapsedTime,
    endMutation,
    recorderActions,
    sttActions,
    vadActions,
    audioActions,
    streamingAudioActions,
    conversationStreamActions,
    stopTimer,
    queryClient,
  ])

  // Note: Mute toggle not available in unified hook - could be added later
  const handleToggleMute = useCallback(() => {
    // TODO: Add mute toggle to useSpeechDetection if needed
    console.log('[TODO] Mute toggle not implemented in useSpeechDetection')
  }, [])

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
          <div className="h-16 w-16 animate-pulse rounded-full bg-[#7e9ec9]/20 flex items-center justify-center mx-auto">
            <MessageCircle className="h-8 w-8 text-[#7e9ec9]" />
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
    <div className="flex h-full flex-col p-8">
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

      {/* Date Header - positioned at top */}
      <div className="flex flex-col items-center justify-center pt-4 pb-8 space-y-2 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <h1 className="text-3xl md:text-4xl font-extralight tracking-tight text-foreground/90">
          {format(new Date(), 'EEEE')}
        </h1>
        <p className="text-sm text-muted-foreground font-light tracking-wide uppercase">
          {format(new Date(), 'MMMM d, yyyy')}
        </p>
      </div>

      {/* Main content area - centered vertically */}
      <div className="flex-1 flex flex-col items-center justify-center">
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

          {/* Reset button when stuck in user speaking state */}
          {showResetButton && sessionState === 'recording' && (
            <button
              onClick={handleResetSpeechState}
              className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full animate-pulse cursor-pointer"
            >
              <span className="text-white text-sm font-medium px-4 py-2 bg-black/60 rounded-full">
                Tap to reset
              </span>
            </button>
          )}
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
        {sessionState === 'recording' &&
          conversationStreamState.isStreaming && (
            <div className="mb-2 text-xs text-muted-foreground">
              AI is responding...
            </div>
          )}

        {/* Idle state controls */}
        {sessionState === 'idle' && (
          <div className="text-center animate-in fade-in zoom-in-95 duration-700 delay-150">
            <MagicButton onClick={handleStartSession}>
              <Play className="mr-3 h-5 w-5 fill-current" />
              Start Reflection
            </MagicButton>
            <p className="mt-6 text-sm text-muted-foreground font-light tracking-wide">
              10 minutes to process your thoughts
            </p>
            {sttState.error && (
              <p className="mt-2 text-sm text-red-500">{sttState.error}</p>
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
            isMuted={false}
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
            <p
              className={`text-sm italic ${sttState.isDegraded ? 'text-amber-500' : 'text-muted-foreground'}`}
            >
              {isAISpeaking
                ? 'AI is speaking...'
                : sttState.isDegraded
                  ? 'Speech recognition issue - tap circle to reset'
                  : currentSpeaker === 'user'
                    ? 'Listening...'
                    : "Take your time. Share what's on your mind."}
            </p>
            {liveTranscript && <p className="mt-2 text-sm">{liveTranscript}</p>}
            {vadState.isLoading && (
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
                  <span className="text-xs text-amber-600">
                    {sttState.error}
                  </span>
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
                    sttActions.clearTranscripts()
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
                    sttActions.clearTranscripts()
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
    </div>
  )
}

/**
 * View for completed reflections
 */
function CompletedReflectionView({
  session,
}: {
  session: ReflectionSession & { turns?: Array<ReflectionTurn> }
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
        <p className="mt-2 text-sm text-[#7e9ec9]">Reflection completed</p>
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
                      ? 'bg-[#7e9ec9] text-white'
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
