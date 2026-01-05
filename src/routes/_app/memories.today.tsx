/**
 * Today's Session Route
 * Main recording interface for today's voice session
 *
 * Uses SSE streaming for AI responses with real-time audio playback
 */

import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect, useCallback, useRef } from 'react'
import { format } from 'date-fns'
import { Play, AlertCircle, Volume2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../../components/ui/button'
import {
  getTodaySessionFn,
  startSessionFn,
  endSessionFn,
  updateSessionTimeFn,
  cancelShortSessionFn,
} from '../../server/session.fn'

// Minimum session duration in seconds (sessions shorter than this are discarded)
const MIN_SESSION_DURATION = 60
import {
  generateGreetingFn,
  processSessionFn,
  preGenerateGreetingFn,
  savePreloadedGreetingFn,
} from '../../server/conversation.fn'
import { streamMessageFn } from '../../server/streaming.fn'
import { PulsingCircle } from '../../components/memories/PulsingCircle'
import { CountdownTimer } from '../../components/memories/CountdownTimer'
import { SessionControls } from '../../components/memories/SessionControls'
import { useAudioRecorder, useAudioSupport } from '../../hooks/useAudioRecorder'
import { useAudioPlayer } from '../../hooks/useAudioPlayer'
import { useDeepgramSTT } from '../../hooks/useDeepgramSTT'
// New streaming hooks for improved latency
import { useStreamingAudioPlayer } from '../../hooks/useStreamingAudioPlayer'
import { useConversationStream } from '../../hooks/useConversationStream'
import { useVAD } from '../../hooks/useVAD'
import type { VoiceSession, TranscriptTurn } from '../../types/voice-session'

// Feature flag: Use new SSE streaming architecture for lower latency
const USE_SSE_STREAMING = true
// Feature flag: Use VAD for improved speech detection and barge-in
const USE_VAD = true

export const Route = createFileRoute('/_app/memories/today')({
  component: TodaySession,
})

type SessionState =
  | 'idle'
  | 'starting'
  | 'recording'
  | 'paused'
  | 'processing'
  | 'completed'

function TodaySession() {
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
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const pendingTranscriptRef = useRef('')
  // Prevent duplicate processing of speech end events
  const isProcessingRef = useRef(false)
  // Track if session should end when AI finishes speaking
  const sessionEndPendingRef = useRef(false)
  // Track if we've shown the 30-second warning
  const warningShownRef = useRef(false)
  // Hard cutoff timer - forces session end 30 seconds after maxDuration
  const hardCutoffTimerRef = useRef<NodeJS.Timeout | null>(null)
  // Grace period in seconds after maxDuration before forcing session end
  const HARD_CUTOFF_GRACE_SECONDS = 30

  // Accumulate audio chunks for uploading user audio
  const audioChunksRef = useRef<Int16Array[]>([])

  // Preloaded greeting for instant playback on session start
  const preloadedGreetingRef = useRef<{
    text: string
    audioUrl: string | null
    audioBase64: string | null
    contentType: string
  } | null>(null)
  const isPreloadingRef = useRef(false)
  // Track if we've already attempted preloading this mount (prevent duplicate calls)
  const hasPreloadedOnceRef = useRef(false)

  // Helper to create a WAV file from PCM data
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

      // RIFF header
      const writeString = (offset: number, str: string) => {
        for (let i = 0; i < str.length; i++) {
          view.setUint8(offset + i, str.charCodeAt(i))
        }
      }

      writeString(0, 'RIFF')
      view.setUint32(4, totalSize - 8, true) // File size - 8
      writeString(8, 'WAVE')

      // fmt sub-chunk
      writeString(12, 'fmt ')
      view.setUint32(16, 16, true) // Subchunk1Size (16 for PCM)
      view.setUint16(20, 1, true) // AudioFormat (1 for PCM)
      view.setUint16(22, numChannels, true)
      view.setUint32(24, sampleRate, true)
      view.setUint32(28, byteRate, true)
      view.setUint16(32, blockAlign, true)
      view.setUint16(34, bitsPerSample, true)

      // data sub-chunk
      writeString(36, 'data')
      view.setUint32(40, dataSize, true)

      // Write PCM data
      const pcmOffset = 44
      for (let i = 0; i < pcmData.length; i++) {
        view.setInt16(pcmOffset + i * 2, pcmData[i], true)
      }

      return buffer
    },
    [],
  )

  // Helper to get accumulated audio as base64 WAV
  const getAccumulatedAudioBase64 = useCallback((): string | undefined => {
    if (audioChunksRef.current.length === 0) return undefined

    // Calculate total length
    const totalLength = audioChunksRef.current.reduce(
      (acc, chunk) => acc + chunk.length,
      0,
    )
    if (totalLength === 0) return undefined

    // Concatenate all chunks
    const combined = new Int16Array(totalLength)
    let offset = 0
    for (const chunk of audioChunksRef.current) {
      combined.set(chunk, offset)
      offset += chunk.length
    }

    // Create WAV file
    const wavBuffer = createWavFromPcm(combined, 16000)

    // Convert to base64
    const uint8Array = new Uint8Array(wavBuffer)
    let binary = ''
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i])
    }
    return btoa(binary)
  }, [createWavFromPcm])

  // Deepgram STT hook for real-time transcription
  const [sttState, sttActions] = useDeepgramSTT({
    onFinalTranscript: (transcript) => {
      console.log('[STT] Final transcript:', transcript)
      // Accumulate transcripts until silence
      pendingTranscriptRef.current +=
        (pendingTranscriptRef.current ? ' ' : '') + transcript
    },
    onSpeechStart: () => {
      setCurrentSpeaker('user')
      // Clear accumulated audio when new speech starts
      audioChunksRef.current = []
    },
    onSpeechEnd: () => {
      // Prevent duplicate processing - check and set atomically
      if (isProcessingRef.current) {
        console.log('[STT] Ignoring duplicate onSpeechEnd - already processing')
        return
      }

      // Send accumulated transcript when user stops speaking
      if (pendingTranscriptRef.current.trim() && session) {
        isProcessingRef.current = true
        // Capture transcript immediately to avoid race conditions
        const transcript = pendingTranscriptRef.current.trim()
        pendingTranscriptRef.current = '' // Clear immediately
        setLiveTranscript('')

        // Delay audio capture by 150ms to ensure final audio chunks arrive
        // This prevents the audio cutoff issue where the last part of speech is missing
        setTimeout(() => {
          // Get accumulated audio and convert to base64
          const audioBase64 = getAccumulatedAudioBase64()
          handleUserSpeechEnd(transcript, audioBase64)
          audioChunksRef.current = [] // Clear after sending

          // Reset processing flag after sending
          setTimeout(() => {
            isProcessingRef.current = false
          }, 100)
        }, 150)
      }
    },
    onError: (error) => {
      console.error('[STT] Error:', error)
    },
  })

  // ==========================================
  // Voice Activity Detection (VAD) for Barge-In
  // ==========================================

  // VAD for accurate speech detection and barge-in
  const [vadState, vadActions] = useVAD({
    enabled: USE_VAD && sessionState === 'recording',
    onSpeechStart: () => {
      console.log('[VAD] Speech detected')
      setCurrentSpeaker('user')
      audioChunksRef.current = []

      // BARGE-IN: Stop AI if it's currently speaking
      if (isAISpeaking) {
        console.log('[Barge-in] User started speaking, interrupting AI')
        streamingAudioActions.stop()
        audioActions.stop()
        conversationStreamActions.cancel()
        setIsAISpeaking(false)
      }
    },
    onSpeechEnd: (_audio, duration) => {
      console.log(`[VAD] Speech ended after ${duration.toFixed(2)}s`)
      // Note: We don't trigger send here - Deepgram's onSpeechEnd handles that
      // VAD is primarily for barge-in detection, Deepgram handles transcription timing
    },
  })

  // ==========================================
  // Audio Playback - SSE Streaming vs Legacy
  // ==========================================

  // Legacy: Audio queue for URL-based playback
  const audioQueueRef = useRef<string[]>([])
  const isPlayingQueueRef = useRef(false)
  const playNextInQueueRef = useRef<(() => void) | null>(null)

  // NEW: Streaming audio player for base64 chunks (lower latency)
  const [streamingAudioState, streamingAudioActions] = useStreamingAudioPlayer({
    onStart: () => {
      setIsAISpeaking(true)
      setCurrentSpeaker('ai')
    },
    onEnd: () => {
      setIsAISpeaking(false)
      setCurrentSpeaker(null)

      // If session end was pending, end now
      if (sessionEndPendingRef.current) {
        sessionEndPendingRef.current = false
        console.log('[Timer] AI finished speaking, ending session now')
        setTimeout(() => {
          handleEndSession()
        }, 100)
      }
    },
    onError: (error) => {
      console.error('[StreamingAudio] Playback error:', error)
      setIsAISpeaking(false)
      setCurrentSpeaker(null)

      if (sessionEndPendingRef.current) {
        sessionEndPendingRef.current = false
        setTimeout(() => {
          handleEndSession()
        }, 100)
      }
    },
  })

  // NEW: SSE conversation stream for lower latency responses
  const [conversationStreamState, conversationStreamActions] =
    useConversationStream({
      onStart: (userTurnId) => {
        console.log('[ConversationStream] Started, userTurnId:', userTurnId)
      },
      onText: (_token, _accumulated) => {
        // Optionally show AI text as it streams
      },
      onAudio: (audioBase64, audioUrl, contentType, _sentenceIndex, _text) => {
        if (USE_SSE_STREAMING && audioBase64) {
          // Use streaming audio player for base64 chunks
          streamingAudioActions.queueAudioChunk(audioBase64, contentType)
        } else if (audioUrl) {
          // Fallback to URL-based playback
          audioQueueRef.current.push(audioUrl)
          if (!isPlayingQueueRef.current) {
            playNextInQueueRef.current?.()
          }
        }
      },
      onDone: (fullText, totalSentences, _aiTurnId) => {
        console.log(
          `[ConversationStream] Done: ${totalSentences} sentences, text: "${fullText.slice(0, 50)}..."`,
        )
        queryClient.invalidateQueries({ queryKey: ['session', 'today'] })
      },
      onError: (error) => {
        console.error('[ConversationStream] Error:', error)
        toast.error('AI response failed', { description: error })
        setIsAISpeaking(false)
        setCurrentSpeaker(null)
      },
    })

  // Legacy: Audio player hook for URL-based playback
  const [audioState, audioActions] = useAudioPlayer({
    onPlay: () => {
      setIsAISpeaking(true)
      setCurrentSpeaker('ai')
    },
    onEnd: () => {
      // Check if there are more audio chunks in the queue
      if (audioQueueRef.current.length > 0) {
        // Play next chunk without resetting speaking state
        playNextInQueueRef.current?.()
        return
      }

      setIsAISpeaking(false)
      setCurrentSpeaker(null)
      isPlayingQueueRef.current = false

      // If session end was pending (timer expired while AI was speaking), end now
      if (sessionEndPendingRef.current) {
        sessionEndPendingRef.current = false
        console.log('[Timer] AI finished speaking, ending session now')
        // Small delay to ensure state is updated
        setTimeout(() => {
          handleEndSession()
        }, 100)
      }
    },
    onError: (error) => {
      console.error('[Audio] Playback error:', error)

      // Try to play next in queue on error
      if (audioQueueRef.current.length > 0) {
        playNextInQueueRef.current?.()
        return
      }

      setIsAISpeaking(false)
      setCurrentSpeaker(null)
      isPlayingQueueRef.current = false

      // Also check pending session end on error
      if (sessionEndPendingRef.current) {
        sessionEndPendingRef.current = false
        setTimeout(() => {
          handleEndSession()
        }, 100)
      }
    },
  })

  // Check audio support
  const { isSupported, missingFeatures } = useAudioSupport()

  // Fetch today's session
  const { data: session, isLoading } = useQuery({
    queryKey: ['session', 'today'],
    queryFn: () => getTodaySessionFn(),
  })

  // Audio recorder hook - sends audio to Deepgram and accumulates for upload
  const [recorderState, recorderActions] = useAudioRecorder({
    onSpeechStart: () => {
      setCurrentSpeaker('user')
      // Clear accumulated audio when new speech starts
      audioChunksRef.current = []
    },
    onSpeechEnd: () => {
      // When Deepgram is not connected, use recorder's VAD for speech detection
      // If we have accumulated transcript (typed or from failed STT), send it
      if (isProcessingRef.current) {
        console.log(
          '[Recorder VAD] Ignoring duplicate onSpeechEnd - already processing',
        )
        return
      }

      if (
        !sttState.isConnected &&
        pendingTranscriptRef.current.trim() &&
        session
      ) {
        isProcessingRef.current = true
        console.log('[Recorder VAD] Speech ended, sending pending transcript')

        // Capture transcript immediately
        const transcript = pendingTranscriptRef.current.trim()
        pendingTranscriptRef.current = ''
        setLiveTranscript('')

        // Delay audio capture by 150ms to ensure final audio chunks arrive
        setTimeout(() => {
          const audioBase64 = getAccumulatedAudioBase64()
          handleUserSpeechEnd(transcript, audioBase64)
          audioChunksRef.current = [] // Clear after sending

          setTimeout(() => {
            isProcessingRef.current = false
          }, 100)
        }, 150)
      }
    },
    onPCMData: (pcmData) => {
      // Send raw PCM audio directly to Deepgram
      if (sttState.isConnected && useVoiceInput) {
        sttActions.sendAudio(pcmData)
      }
      // Also accumulate for later upload
      const pcmArray = new Int16Array(pcmData)
      audioChunksRef.current.push(pcmArray)
    },
  })

  // Update live transcript from STT interim results
  useEffect(() => {
    if (sttState.interimTranscript) {
      setLiveTranscript(
        pendingTranscriptRef.current +
          (pendingTranscriptRef.current ? ' ' : '') +
          sttState.interimTranscript,
      )
    }
  }, [sttState.interimTranscript])

  // Play audio helper - handles autoplay restrictions
  const playAudio = useCallback(
    async (url: string | null) => {
      if (!url) {
        // No audio URL - simulate speaking time
        setIsAISpeaking(true)
        setCurrentSpeaker('ai')
        setTimeout(() => {
          setIsAISpeaking(false)
          setCurrentSpeaker(null)
        }, 2500)
        return
      }

      try {
        await audioActions.play(url)
      } catch (error) {
        console.error('[Audio] Failed to play:', error)
        // Fallback: simulate speaking time
        setIsAISpeaking(true)
        setCurrentSpeaker('ai')
        setTimeout(() => {
          setIsAISpeaking(false)
          setCurrentSpeaker(null)
        }, 2500)
      }
    },
    [audioActions],
  )

  // State for showing second attempt warning
  const [showRetryWarning, setShowRetryWarning] = useState(false)

  // Start session mutation
  const startMutation = useMutation({
    mutationFn: () => startSessionFn(),
    onSuccess: async (newSession) => {
      queryClient.setQueryData(['session', 'today'], newSession)
      setSessionState('recording')

      // Show warning if this is the second (and final) attempt
      if (newSession.recordingAttempt === 2) {
        setShowRetryWarning(true)
      }

      // Enable audio autoplay on user interaction
      audioActions.enableAutoplay()
      streamingAudioActions.enablePlayback()

      // Connect to Deepgram for STT (if voice input enabled)
      if (useVoiceInput) {
        await sttActions.connect()
      }

      // Start recording
      await recorderActions.startRecording()

      // Start timer
      startTimer()

      // Use preloaded greeting if available, otherwise generate fresh
      console.log(
        '[Session] Checking preloaded greeting:',
        preloadedGreetingRef.current ? 'EXISTS' : 'NULL',
      )
      if (preloadedGreetingRef.current) {
        console.log('[Session] Using preloaded greeting for instant playback')
        const preloaded = preloadedGreetingRef.current
        preloadedGreetingRef.current = null // Clear after use

        // Play audio immediately using base64 for lowest latency
        if (preloaded.audioBase64) {
          streamingAudioActions.queueAudioChunk(
            preloaded.audioBase64,
            preloaded.contentType,
          )
        } else if (preloaded.audioUrl) {
          playAudio(preloaded.audioUrl)
        }

        // Save the greeting to the session in the background
        savePreloadedGreetingFn({
          data: {
            sessionId: newSession.id,
            text: preloaded.text,
            audioUrl: preloaded.audioUrl,
          },
        })
          .then(() => {
            queryClient.invalidateQueries({ queryKey: ['session', 'today'] })
          })
          .catch((error) => {
            console.error('[Session] Failed to save preloaded greeting:', error)
          })
      } else {
        // Fallback: generate greeting if preload not ready
        console.log('[Session] No preloaded greeting, generating fresh')
        generateGreeting(newSession.id)
      }
    },
    onError: (error) => {
      console.error('Failed to start session:', error)
      toast.error('Failed to start session', {
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
      // First update the speaking time
      if (elapsedTime > 0) {
        await updateSessionTimeFn({
          data: { sessionId, userSpeakingTime: elapsedTime },
        })
      }
      // Then end the session
      return endSessionFn({ data: { sessionId } })
    },
    onSuccess: (updatedSession) => {
      // Stop recording, STT, and audio
      recorderActions.stopRecording()
      sttActions.disconnect()
      audioActions.stop()
      streamingAudioActions.stop()
      conversationStreamActions.cancel()
      stopTimer()

      queryClient.setQueryData(['session', 'today'], updatedSession)

      // Trigger background processing (don't await - runs in parallel)
      if (updatedSession) {
        processSession(updatedSession.id)
      }

      // Immediately redirect to detail page - processing continues in background
      const dateStr = format(new Date(updatedSession.date), 'yyyy-MM-dd')
      navigate({ to: '/memories/$date', params: { date: dateStr } })
    },
    onError: (error) => {
      console.error('Failed to end session:', error)
      toast.error('Failed to end session', {
        description: 'Please try again.',
      })
    },
  })

  // Generate greeting mutation
  const greetingMutation = useMutation({
    mutationFn: (sessionId: string) =>
      generateGreetingFn({ data: { sessionId } }),
    onSuccess: (result) => {
      // Play audio using our hook
      playAudio(result.audioUrl)

      // Invalidate to refresh turns
      queryClient.invalidateQueries({ queryKey: ['session', 'today'] })
    },
  })

  // Play next audio in queue
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
      } catch (error) {
        console.error('[AudioQueue] Failed to play:', error)
        // Try next in queue
        playNextInQueue()
      }
    }
  }, [audioActions])

  // Wire up the ref for use in the audio player callback
  useEffect(() => {
    playNextInQueueRef.current = playNextInQueue
  }, [playNextInQueue])

  // Send message mutation using streaming endpoint
  const sendMessageMutation = useMutation({
    mutationFn: (params: {
      sessionId: string
      userMessage: string
      userAudioBase64?: string
      userAudioContentType?: string
    }) => streamMessageFn({ data: params }),
    onSuccess: (result) => {
      console.log(
        `[Streaming] Response received in ${result.latencyMs}ms, ${result.totalSentences} sentences`,
      )

      // Queue all audio chunks for playback
      if (result.audioChunks && result.audioChunks.length > 0) {
        // Clear any existing queue
        audioQueueRef.current = []

        // Add all audio URLs to the queue in order
        for (const chunk of result.audioChunks) {
          audioQueueRef.current.push(chunk.audioUrl)
        }

        // Start playing if not already
        if (!isPlayingQueueRef.current) {
          playNextInQueue()
        }
      } else if (result.firstAudioUrl) {
        // Fallback: play just the first audio
        playAudio(result.firstAudioUrl)
      }

      queryClient.invalidateQueries({ queryKey: ['session', 'today'] })
    },
  })

  // Process session mutation
  const processSessionMutation = useMutation({
    mutationFn: (sessionId: string) =>
      processSessionFn({ data: { sessionId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session', 'today'] })
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      setSessionState('completed')
    },
    onError: (error) => {
      console.error('Failed to process session:', error)
      // Still mark as completed even if processing fails
      setSessionState('completed')
    },
  })

  // Update session state based on fetched data
  useEffect(() => {
    if (session) {
      if (session.status === 'completed') {
        setSessionState('completed')
        setElapsedTime(session.totalUserSpeakingTime)
      } else if (session.status === 'processing') {
        setSessionState('processing')
      } else if (session.status === 'active') {
        // If session is active but we're idle, we need to resume
        if (sessionState === 'idle') {
          setElapsedTime(session.totalUserSpeakingTime)
          // Don't auto-resume, let user click start
        }
      } else if (session.status === 'paused') {
        setSessionState('paused')
        setElapsedTime(session.totalUserSpeakingTime)
      }
    }
  }, [session, sessionState])

  // Pre-generate greeting when user lands on the page (idle state)
  // This effect should only trigger preloading ONCE per component mount
  useEffect(() => {
    // Only preload if:
    // 1. Session state is idle (user hasn't started yet)
    // 2. Not already preloading
    // 3. No existing preloaded greeting
    // 4. Haven't already attempted preloading this mount
    // 5. No completed session (don't preload if viewing completed session)
    const shouldPreload =
      sessionState === 'idle' &&
      !isPreloadingRef.current &&
      !preloadedGreetingRef.current &&
      !hasPreloadedOnceRef.current &&
      (!session || session.status !== 'completed')

    if (shouldPreload) {
      hasPreloadedOnceRef.current = true // Mark as attempted - prevents duplicate calls
      isPreloadingRef.current = true
      console.log('[Preload] Starting greeting pre-generation (once per mount)')

      preGenerateGreetingFn()
        .then((result) => {
          preloadedGreetingRef.current = result
          isPreloadingRef.current = false
          console.log(
            '[Preload] Greeting ready:',
            result.text.substring(0, 30) + '...',
          )
        })
        .catch((error) => {
          console.error('[Preload] Failed to pre-generate greeting:', error)
          isPreloadingRef.current = false
          // Silently fail - will fall back to normal generation
        })
    }
    // NOTE: No cleanup here - we don't want to clear the preloaded greeting on re-renders
    // Cleanup happens in the separate unmount effect below
  }, [sessionState, session])

  // Cleanup preloaded greeting only on actual component unmount
  useEffect(() => {
    return () => {
      preloadedGreetingRef.current = null
      isPreloadingRef.current = false
      hasPreloadedOnceRef.current = false
    }
  }, []) // Empty deps = only runs on unmount

  // Timer logic
  const startTimer = useCallback(() => {
    // Reset warning flag when starting
    warningShownRef.current = false
    sessionEndPendingRef.current = false

    timerRef.current = setInterval(() => {
      setElapsedTime((prev) => {
        const newTime = prev + 1
        const maxDuration = session?.maxDuration ?? 180
        const remainingTime = maxDuration - newTime

        // Show warning at 30 seconds remaining
        if (remainingTime === 30 && !warningShownRef.current) {
          warningShownRef.current = true
          toast.warning('30 seconds remaining', {
            description: 'Your session will end soon. Wrap up your thoughts!',
            duration: 5000,
          })
        }

        // Check if time limit reached
        if (session && newTime >= session.maxDuration) {
          // If AI is currently speaking, set pending flag and let it finish
          if (isAISpeaking) {
            // Only set pending if not already set
            if (!sessionEndPendingRef.current) {
              sessionEndPendingRef.current = true
              toast.info('Session time reached', {
                description: 'Waiting for AI to finish speaking...',
                duration: 3000,
              })

              // Start hard cutoff timer - force end after grace period
              if (!hardCutoffTimerRef.current) {
                hardCutoffTimerRef.current = setTimeout(() => {
                  console.log(
                    '[Timer] Hard cutoff reached - forcing session end',
                  )
                  toast.info('Session ending', {
                    description: 'Saving your memory...',
                    duration: 2000,
                  })
                  handleEndSession()
                }, HARD_CUTOFF_GRACE_SECONDS * 1000)
              }
            }
          } else {
            handleEndSession()
          }
        }
        return newTime
      })
    }, 1000)
  }, [session, isAISpeaking])

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    // Also clear hard cutoff timer
    if (hardCutoffTimerRef.current) {
      clearTimeout(hardCutoffTimerRef.current)
      hardCutoffTimerRef.current = null
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTimer()
      if (hardCutoffTimerRef.current) {
        clearTimeout(hardCutoffTimerRef.current)
        hardCutoffTimerRef.current = null
      }
      recorderActions.stopRecording()
      sttActions.disconnect()
      audioActions.stop()
      streamingAudioActions.stop()
      conversationStreamActions.cancel()
      // Pause VAD on unmount
      if (USE_VAD) {
        vadActions.pause()
      }
    }
  }, [])

  // Helper functions
  const generateGreeting = (sessionId: string) => {
    greetingMutation.mutate(sessionId)
  }

  const processSession = (sessionId: string) => {
    processSessionMutation.mutate(sessionId)
  }

  // Track last sent message to prevent duplicates
  const lastSentMessageRef = useRef<string>('')
  const lastSentTimeRef = useRef<number>(0)

  const handleUserSpeechEnd = (transcript: string, _audioBase64?: string) => {
    if (session && transcript.trim()) {
      // Deduplication: prevent sending the same message within 2 seconds
      const now = Date.now()
      const trimmedTranscript = transcript.trim()
      if (
        trimmedTranscript === lastSentMessageRef.current &&
        now - lastSentTimeRef.current < 2000
      ) {
        console.log(
          '[handleUserSpeechEnd] Ignoring duplicate message within 2 seconds',
        )
        return
      }

      lastSentMessageRef.current = trimmedTranscript
      lastSentTimeRef.current = now
      setCurrentSpeaker(null)

      if (USE_SSE_STREAMING) {
        // NEW: Use SSE streaming for lower latency
        console.log('[SSE] Sending message via streaming endpoint')
        conversationStreamActions.sendMessage(session.id, trimmedTranscript)
      } else {
        // Legacy: Use mutation-based approach
        sendMessageMutation.mutate({
          sessionId: session.id,
          userMessage: trimmedTranscript,
          // Note: User audio upload can be done separately for archival
        })
      }
    }
  }

  const handleStartSession = useCallback(async () => {
    // Check microphone permission first
    const hasPermission = await recorderActions.requestPermission()
    if (!hasPermission) {
      toast.error('Microphone Required', {
        description: 'Please allow microphone access to start a session.',
        duration: 5000,
      })
      return
    }

    setSessionState('starting')
    startMutation.mutate()
  }, [startMutation, recorderActions])

  const handleEndSession = useCallback(async () => {
    if (!session) return

    // Check if session is too short (less than 60 seconds)
    if (elapsedTime < MIN_SESSION_DURATION) {
      // Stop recording and cleanup
      recorderActions.stopRecording()
      sttActions.disconnect()
      audioActions.stop()
      streamingAudioActions.stop()
      conversationStreamActions.cancel()
      stopTimer()

      // Cancel the short session (doesn't count as an attempt)
      try {
        await cancelShortSessionFn({ data: { sessionId: session.id } })
      } catch (error) {
        console.error('Failed to cancel short session:', error)
      }

      // Reset state
      queryClient.invalidateQueries({ queryKey: ['session', 'today'] })
      queryClient.invalidateQueries({ queryKey: ['sessions'] }) // Also refresh sidebar
      setSessionState('idle')
      setElapsedTime(0)
      setShowRetryWarning(false)

      // Show friendly notification using sonner toast
      toast.info('Session too short', {
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
  const maxDuration = session?.maxDuration ?? 180
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
            {missingFeatures.join(', ')}. Please use a modern browser like
            Chrome, Firefox, or Edge.
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

  // Completed session - show replay view
  if (sessionState === 'completed' && session) {
    return <CompletedSessionView session={session} />
  }

  // Processing session
  if (sessionState === 'processing') {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="h-16 w-16 animate-pulse rounded-full bg-amber-500/20 flex items-center justify-center mx-auto">
            <div className="h-8 w-8 rounded-full bg-amber-500" />
          </div>
          <h2 className="mt-6 text-xl font-semibold">
            Processing your memory...
          </h2>
          <p className="mt-2 text-muted-foreground">
            Generating summary and creating your daily image
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col items-center justify-center p-8">
      {/* Date Header */}
      <div className="text-center mb-8">
        <p className="text-sm text-muted-foreground uppercase tracking-wider">
          {format(new Date(), 'EEEE')}
        </p>
        <h1 className="text-2xl font-light">
          {format(new Date(), 'MMMM d, yyyy')}
        </h1>
      </div>

      {/* Retry Warning Banner */}
      {showRetryWarning && (
        <div className="mb-6 max-w-md rounded-lg border border-amber-200 bg-amber-50 p-4 text-center">
          <div className="flex items-center justify-center gap-2 text-amber-700">
            <AlertCircle className="h-5 w-5" />
            <span className="font-medium">Final Recording</span>
          </div>
          <p className="mt-1 text-sm text-amber-600">
            This is your last recording attempt for today. Make it count!
          </p>
          <button
            onClick={() => setShowRetryWarning(false)}
            className="mt-2 text-xs text-amber-500 hover:text-amber-700"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Timer above circle */}
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

      {/* Audio status indicator */}
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

      {/* Streaming status indicator */}
      {sessionState === 'recording' && conversationStreamState.isStreaming && (
        <div className="mb-2 text-xs text-muted-foreground">
          AI is responding...
        </div>
      )}

      {/* Controls */}
      {sessionState === 'idle' && (
        <div className="text-center">
          <Button
            size="lg"
            onClick={handleStartSession}
            className="rounded-full px-8 py-6 text-lg"
          >
            <Play className="mr-2 h-5 w-5" />
            Start Today's Session
          </Button>
          <p className="mt-4 text-sm text-muted-foreground">
            3 minutes to reflect on your day
          </p>
          {recorderState.error && (
            <p className="mt-2 text-sm text-red-500">{recorderState.error}</p>
          )}
        </div>
      )}

      {sessionState === 'starting' && (
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="mt-4 text-muted-foreground">Starting session...</p>
        </div>
      )}

      {(sessionState === 'recording' || sessionState === 'paused') && (
        <SessionControls
          isMuted={recorderState.isMuted}
          isPaused={sessionState === 'paused'}
          isEnding={endMutation.isPending}
          elapsedTime={elapsedTime}
          minDuration={MIN_SESSION_DURATION}
          onToggleMute={handleToggleMute}
          onEndSession={handleEndSession}
        />
      )}

      {/* Live Transcript Preview */}
      {sessionState === 'recording' && (
        <div className="mt-8 max-w-md text-center">
          <p className="text-sm text-muted-foreground italic">
            {isAISpeaking
              ? 'AI is speaking...'
              : USE_VAD && vadState.isSpeaking
                ? 'Listening...'
                : recorderState.audioLevel > 0.1
                  ? 'Listening...'
                  : "Speak whenever you're ready"}
          </p>
          {liveTranscript && <p className="mt-2 text-sm">{liveTranscript}</p>}
          {/* VAD loading indicator */}
          {USE_VAD && vadState.isLoading && (
            <p className="mt-1 text-xs text-muted-foreground">
              Loading speech detection...
            </p>
          )}
        </div>
      )}

      {/* Input mode toggle and text input */}
      {sessionState === 'recording' && (
        <div className="mt-4 w-full max-w-md">
          {/* Voice/Text toggle */}
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

          {/* STT Status */}
          {useVoiceInput && (
            <div className="text-center mb-3">
              {sttState.isConnecting && (
                <span className="text-xs text-muted-foreground">
                  Connecting to speech recognition...
                </span>
              )}
              {sttState.isConnected && (
                <span className="text-xs text-emerald-600">
                  Speech recognition active
                </span>
              )}
              {sttState.error && (
                <span className="text-xs text-amber-600">
                  {sttState.error} - Type your response below
                </span>
              )}
              {!sttState.isConnected &&
                !sttState.isConnecting &&
                !sttState.error && (
                  <span className="text-xs text-muted-foreground">
                    Type your response below
                  </span>
                )}
            </div>
          )}

          {/* Text input (always available as fallback) */}
          <div className="flex gap-2">
            <input
              type="text"
              value={liveTranscript}
              onChange={(e) => setLiveTranscript(e.target.value)}
              onKeyDown={(e) => {
                if (
                  e.key === 'Enter' &&
                  liveTranscript.trim() &&
                  session &&
                  !sendMessageMutation.isPending
                ) {
                  handleUserSpeechEnd(liveTranscript)
                  setLiveTranscript('')
                  pendingTranscriptRef.current = ''
                }
              }}
              placeholder={
                useVoiceInput
                  ? 'Speak or type your message...'
                  : 'Type your message and press Enter...'
              }
              className="flex-1 px-4 py-2 border rounded-lg text-sm"
              disabled={sendMessageMutation.isPending || isAISpeaking}
            />
            <Button
              onClick={() => {
                if (
                  liveTranscript.trim() &&
                  session &&
                  !sendMessageMutation.isPending
                ) {
                  handleUserSpeechEnd(liveTranscript)
                  setLiveTranscript('')
                  pendingTranscriptRef.current = ''
                }
              }}
              disabled={
                !liveTranscript.trim() ||
                sendMessageMutation.isPending ||
                isAISpeaking
              }
              size="sm"
            >
              {sendMessageMutation.isPending ? 'Sending...' : 'Send'}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground text-center">
            {useVoiceInput
              ? 'Speak naturally - your voice will be transcribed automatically'
              : 'Type your message and press Enter to send'}
          </p>
        </div>
      )}
    </div>
  )
}

/**
 * View for completed sessions - shows summary, transcript, and image
 */
function CompletedSessionView({
  session,
}: {
  session: VoiceSession & { turns?: TranscriptTurn[] }
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
        <p className="mt-2 text-sm text-emerald-600">Session completed</p>
      </div>

      {/* Daily Image */}
      {session.imageUrl && (
        <div className="mb-8">
          <img
            src={session.imageUrl}
            alt="Daily memory"
            className="w-full rounded-xl shadow-lg"
          />
        </div>
      )}

      {/* Summary */}
      {session.summaryText && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-3">Today's Reflection</h2>
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
          <h2 className="text-lg font-semibold mb-3">Transcript</h2>
          <div className="space-y-4">
            {session.turns.map((turn, i) => (
              <div
                key={i}
                className={`flex ${turn.speaker === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                    turn.speaker === 'user'
                      ? 'bg-primary text-primary-foreground'
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

      {/* Processing state placeholder */}
      {!session.summaryText && !session.imageUrl && (
        <div className="text-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="mt-4 text-muted-foreground">
            Your memory is being processed...
          </p>
        </div>
      )}
    </div>
  )
}
