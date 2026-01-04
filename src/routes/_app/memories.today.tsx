/**
 * Today's Session Route
 * Main recording interface for today's voice session
 */

import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect, useCallback, useRef } from 'react'
import { format } from 'date-fns'
import { Play, AlertCircle, Volume2 } from 'lucide-react'
import { Button } from '../../components/ui/button'
import {
  getTodaySessionFn,
  startSessionFn,
  endSessionFn,
  updateSessionTimeFn,
  deleteSessionFn,
} from '../../server/session.fn'

// Minimum session duration in seconds (sessions shorter than this are discarded)
const MIN_SESSION_DURATION = 60
import {
  generateGreetingFn,
  sendMessageFn,
  processSessionFn,
} from '../../server/conversation.fn'
import { PulsingCircle } from '../../components/memories/PulsingCircle'
import { CountdownTimer } from '../../components/memories/CountdownTimer'
import { SessionControls } from '../../components/memories/SessionControls'
import { useAudioRecorder, useAudioSupport } from '../../hooks/useAudioRecorder'
import { useAudioPlayer } from '../../hooks/useAudioPlayer'
import { useDeepgramSTT } from '../../hooks/useDeepgramSTT'
import type { VoiceSession, TranscriptTurn } from '../../types/voice-session'

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

  // Accumulate audio chunks for uploading user audio
  const audioChunksRef = useRef<Int16Array[]>([])

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
      // Send accumulated transcript when user stops speaking
      if (pendingTranscriptRef.current.trim() && session) {
        // Get accumulated audio and convert to base64
        const audioBase64 = getAccumulatedAudioBase64()
        handleUserSpeechEnd(pendingTranscriptRef.current.trim(), audioBase64)
        pendingTranscriptRef.current = ''
        setLiveTranscript('')
        audioChunksRef.current = [] // Clear after sending
      }
    },
    onError: (error) => {
      console.error('[STT] Error:', error)
    },
  })

  // Audio player hook with better browser compatibility
  const [audioState, audioActions] = useAudioPlayer({
    onPlay: () => {
      setIsAISpeaking(true)
      setCurrentSpeaker('ai')
    },
    onEnd: () => {
      setIsAISpeaking(false)
      setCurrentSpeaker(null)
    },
    onError: (error) => {
      console.error('[Audio] Playback error:', error)
      setIsAISpeaking(false)
      setCurrentSpeaker(null)
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
      if (
        !sttState.isConnected &&
        pendingTranscriptRef.current.trim() &&
        session
      ) {
        console.log('[Recorder VAD] Speech ended, sending pending transcript')
        const audioBase64 = getAccumulatedAudioBase64()
        handleUserSpeechEnd(pendingTranscriptRef.current.trim(), audioBase64)
        pendingTranscriptRef.current = ''
        setLiveTranscript('')
        audioChunksRef.current = [] // Clear after sending
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

      // Connect to Deepgram for STT (if voice input enabled)
      if (useVoiceInput) {
        await sttActions.connect()
      }

      // Start recording
      await recorderActions.startRecording()

      // Start timer
      startTimer()

      // Generate AI greeting
      generateGreeting(newSession.id)
    },
    onError: (error) => {
      console.error('Failed to start session:', error)
      alert(error instanceof Error ? error.message : 'Failed to start session')
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
      stopTimer()

      queryClient.setQueryData(['session', 'today'], updatedSession)
      setSessionState('processing')

      // Trigger processing
      if (updatedSession) {
        processSession(updatedSession.id)
      }
    },
    onError: (error) => {
      console.error('Failed to end session:', error)
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

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: (params: {
      sessionId: string
      userMessage: string
      userAudioBase64?: string
      userAudioContentType?: string
    }) => sendMessageFn({ data: params }),
    onSuccess: (result) => {
      // Play AI audio using our hook
      playAudio(result.aiAudioUrl)

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

  // Timer logic
  const startTimer = useCallback(() => {
    timerRef.current = setInterval(() => {
      setElapsedTime((prev) => {
        const newTime = prev + 1
        // Check if time limit reached
        if (session && newTime >= session.maxDuration) {
          handleEndSession()
        }
        return newTime
      })
    }, 1000)
  }, [session])

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  // Cleanup
  useEffect(() => {
    return () => {
      stopTimer()
      recorderActions.stopRecording()
      sttActions.disconnect()
      audioActions.stop()
    }
  }, [])

  // Helper functions
  const generateGreeting = (sessionId: string) => {
    greetingMutation.mutate(sessionId)
  }

  const processSession = (sessionId: string) => {
    processSessionMutation.mutate(sessionId)
  }

  const handleUserSpeechEnd = (transcript: string, audioBase64?: string) => {
    if (session && transcript.trim()) {
      setCurrentSpeaker(null)
      sendMessageMutation.mutate({
        sessionId: session.id,
        userMessage: transcript,
        userAudioBase64: audioBase64,
        userAudioContentType: 'audio/wav', // WAV format (playable in browsers)
      })
    }
  }

  const handleStartSession = useCallback(async () => {
    // Check microphone permission first
    const hasPermission = await recorderActions.requestPermission()
    if (!hasPermission) {
      alert('Microphone permission is required to start a session.')
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
      stopTimer()

      // Delete the session without saving
      try {
        await deleteSessionFn({ data: { sessionId: session.id } })
      } catch (error) {
        console.error('Failed to delete short session:', error)
      }

      // Reset state
      queryClient.invalidateQueries({ queryKey: ['session', 'today'] })
      setSessionState('idle')
      setElapsedTime(0)
      setShowRetryWarning(false)

      // Show friendly notification
      alert(
        'Session too short! You need at least 1 minute to record. Come back anytime to try again.',
      )
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
      {sessionState === 'recording' && !audioState.canAutoplay && (
        <div className="mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => audioActions.enableAutoplay()}
            className="flex items-center gap-2"
          >
            <Volume2 className="h-4 w-4" />
            Click to enable audio
          </Button>
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
              : recorderState.audioLevel > 0.1
                ? 'Listening...'
                : "Speak whenever you're ready"}
          </p>
          {liveTranscript && <p className="mt-2 text-sm">{liveTranscript}</p>}
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
