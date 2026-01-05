/**
 * Session by Date Route
 * View/replay a specific day's session
 */

import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import {
  ArrowLeft,
  Trash2,
  Play,
  Pause,
  Clock,
  Volume2,
  SkipForward,
  Square,
} from 'lucide-react'
import { useState, useCallback, useEffect, useRef } from 'react'
import { Button } from '../../components/ui/button'
import { getSessionByDateFn, deleteSessionFn } from '../../server/session.fn'
import { useAudioPlayer } from '../../hooks/useAudioPlayer'
import type { VoiceSession, TranscriptTurn } from '../../types/voice-session'

export const Route = createFileRoute('/_app/memories/$date')({
  component: SessionByDate,
})

function SessionByDate() {
  const { date } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [activeTurnIndex, setActiveTurnIndex] = useState<number | null>(null)

  // Function to play a specific turn (set by AudioPlayer)
  const [playTurnFn, setPlayTurnFn] = useState<
    ((index: number) => void) | null
  >(null)

  // Fetch session for this date
  const {
    data: session,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['session', 'date', date],
    queryFn: () => getSessionByDateFn({ data: { date } }),
    // Poll every 2 seconds while session is processing or missing image/audio
    refetchInterval: (query) => {
      const data = query.state.data
      if (!data) return false
      // Keep polling if processing or missing image
      if (data.status === 'processing') return 2000
      if (data.status === 'completed' && !data.imageUrl) return 2000
      // Keep polling if archival not complete (check if any AI turns missing audio)
      if (
        data.status === 'completed' &&
        data.archivalStatus !== 'completed' &&
        data.archivalStatus !== 'failed'
      ) {
        return 3000
      }
      return false
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (sessionId: string) => deleteSessionFn({ data: { sessionId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      navigate({ to: '/memories' })
    },
  })

  const handleDelete = () => {
    if (session) {
      deleteMutation.mutate(session.id)
    }
    setShowDeleteConfirm(false)
  }

  const parsedDate = parseISO(date)

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading session...</p>
        </div>
      </div>
    )
  }

  if (error || !session) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">
            No session found for this date.
          </p>
          <Button
            variant="link"
            onClick={() => navigate({ to: '/memories' })}
            className="mt-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to memories
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate({ to: '/memories' })}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowDeleteConfirm(true)}
          className="text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </Button>
      </div>

      {/* Date Header */}
      <div className="text-center mb-8">
        <p className="text-sm text-muted-foreground uppercase tracking-wider">
          {format(parsedDate, 'EEEE')}
        </p>
        <h1 className="text-2xl font-light">
          {format(parsedDate, 'MMMM d, yyyy')}
        </h1>
        <div className="mt-2 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>
            {Math.floor(session.totalUserSpeakingTime / 60)}:
            {String(session.totalUserSpeakingTime % 60).padStart(2, '0')}
          </span>
          <SessionStatusBadge status={session.status} />
        </div>
      </div>

      {/* Daily Image - with skeleton while processing */}
      <div className="mb-8">
        {session.imageUrl ? (
          <img
            src={session.imageUrl}
            alt="Daily memory"
            className="w-full rounded-xl shadow-lg"
          />
        ) : session.status === 'processing' ||
          (session.status === 'completed' && !session.imageUrl) ? (
          <div className="aspect-square bg-muted animate-pulse rounded-xl flex flex-col items-center justify-center">
            <div className="h-12 w-12 rounded-full border-4 border-primary/30 border-t-primary animate-spin mb-4" />
            <span className="text-muted-foreground text-sm">
              Creating your memory image...
            </span>
          </div>
        ) : null}
      </div>

      {/* Summary - with skeleton while processing */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-3">Reflection</h2>
        {session.summaryText ? (
          <div className="prose prose-sm prose-zinc">
            {session.summaryText.split('\n\n').map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>
        ) : session.status === 'processing' ? (
          <div className="space-y-3">
            <div className="h-4 bg-muted animate-pulse rounded w-full" />
            <div className="h-4 bg-muted animate-pulse rounded w-11/12" />
            <div className="h-4 bg-muted animate-pulse rounded w-4/5" />
            <div className="h-4 bg-muted animate-pulse rounded w-full" />
            <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            No reflection available for this session.
          </p>
        )}
      </div>

      {/* Audio Player - with skeleton while archiving */}
      {session.turns && session.turns.length > 0 && (
        <div className="mb-8">
          {session.archivalStatus === 'pending' ||
          session.archivalStatus === 'processing' ? (
            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-muted animate-pulse" />
                <div className="flex-1">
                  <div className="h-2 bg-muted animate-pulse rounded-full" />
                  <div className="flex justify-between mt-2">
                    <div className="h-3 w-10 bg-muted animate-pulse rounded" />
                    <div className="h-3 w-10 bg-muted animate-pulse rounded" />
                  </div>
                </div>
              </div>
              <p className="text-center text-sm text-muted-foreground mt-3">
                Processing audio for replay...
              </p>
            </div>
          ) : (
            <AudioPlayer
              session={session}
              onTurnChange={setActiveTurnIndex}
              onPlayTurnReady={(fn) => setPlayTurnFn(() => fn)}
            />
          )}
        </div>
      )}

      {/* Transcript */}
      {session.turns && session.turns.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Transcript</h2>
          <TranscriptView
            turns={session.turns}
            activeTurnIndex={activeTurnIndex}
            onPlayTurn={(index) => playTurnFn?.(index)}
          />
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background p-6 rounded-lg shadow-xl max-w-md">
            <h3 className="text-lg font-semibold mb-2">Delete this memory?</h3>
            <p className="text-muted-foreground mb-4">
              This will permanently delete the transcript, summary, and image.
              This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SessionStatusBadge({ status }: { status: string }) {
  const colors = {
    completed: 'bg-emerald-100 text-emerald-700',
    processing: 'bg-amber-100 text-amber-700',
    active: 'bg-blue-100 text-blue-700',
    paused: 'bg-gray-100 text-gray-700',
  }

  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status as keyof typeof colors] || colors.paused}`}
    >
      {status}
    </span>
  )
}

function AudioPlayer({
  session,
  onTurnChange,
  onPlayTurnReady,
}: {
  session: VoiceSession & { turns: TranscriptTurn[] }
  onTurnChange?: (turnIndex: number | null) => void
  onPlayTurnReady?: (playFn: (index: number) => void) => void
}) {
  const [isSequentialMode, setIsSequentialMode] = useState(false)
  const [currentTurnIndex, setCurrentTurnIndex] = useState<number | null>(null)
  const [overallProgress, setOverallProgress] = useState(0)
  const turnsWithAudio = session.turns.filter((t) => t.audioUrl)

  // Use refs to track current values for the onEnd callback
  const isSequentialModeRef = useRef(isSequentialMode)
  const currentTurnIndexRef = useRef(currentTurnIndex)

  // Keep refs in sync with state
  useEffect(() => {
    isSequentialModeRef.current = isSequentialMode
  }, [isSequentialMode])

  useEffect(() => {
    currentTurnIndexRef.current = currentTurnIndex
  }, [currentTurnIndex])

  // playNextTurn needs to be defined before useAudioPlayer
  const playNextTurnRef = useRef<() => void>(() => {})

  const [audioState, audioActions] = useAudioPlayer({
    onEnd: () => {
      // When a turn ends, play the next one in sequence mode
      // Use refs to get current values
      console.log('[AudioPlayer] onEnd called', {
        isSequentialMode: isSequentialModeRef.current,
        currentTurnIndex: currentTurnIndexRef.current,
      })
      if (isSequentialModeRef.current && currentTurnIndexRef.current !== null) {
        console.log('[AudioPlayer] Playing next turn...')
        playNextTurnRef.current()
      }
    },
  })

  // Calculate total duration
  const totalDuration = session.turns.reduce(
    (acc, turn) => acc + turn.duration,
    0,
  )

  // Calculate cumulative start times for progress tracking
  const turnStartTimes = useRef<number[]>([])
  useEffect(() => {
    let cumulative = 0
    turnStartTimes.current = session.turns.map((turn) => {
      const start = cumulative
      cumulative += turn.duration
      return start
    })
  }, [session.turns])

  // Update progress based on current turn and audio progress
  useEffect(() => {
    if (currentTurnIndex !== null && audioState.duration > 0) {
      const turnStart = turnStartTimes.current[currentTurnIndex] || 0
      const turnProgress =
        audioState.progress * session.turns[currentTurnIndex].duration
      setOverallProgress(turnStart + turnProgress)
    }
  }, [
    currentTurnIndex,
    audioState.progress,
    audioState.duration,
    session.turns,
  ])

  // Notify parent of current turn for highlighting
  useEffect(() => {
    onTurnChange?.(currentTurnIndex)
  }, [currentTurnIndex, onTurnChange])

  const playTurn = useCallback(
    async (index: number) => {
      const turn = session.turns[index]
      console.log('[AudioPlayer] playTurn called', {
        index,
        turn,
        audioUrl: turn?.audioUrl,
      })
      if (!turn?.audioUrl) {
        console.warn('[AudioPlayer] No audio URL for turn', index)
        return
      }

      setCurrentTurnIndex(index)
      try {
        await audioActions.play(turn.audioUrl)
        console.log('[AudioPlayer] Started playing turn', index)
      } catch (error) {
        console.error('Failed to play turn:', error)
      }
    },
    [session.turns, audioActions],
  )

  const playNextTurn = useCallback(() => {
    const currentIdx = currentTurnIndexRef.current
    console.log('[AudioPlayer] playNextTurn called', {
      currentIdx,
      totalTurns: session.turns.length,
    })
    if (currentIdx === null) return

    // Find next turn with audio
    let nextIndex = currentIdx + 1
    while (nextIndex < session.turns.length) {
      if (session.turns[nextIndex].audioUrl) {
        console.log(
          '[AudioPlayer] Found next turn with audio at index',
          nextIndex,
        )
        playTurn(nextIndex)
        return
      }
      nextIndex++
    }

    // No more turns with audio
    console.log(
      '[AudioPlayer] No more turns with audio, stopping sequential mode',
    )
    setIsSequentialMode(false)
    setCurrentTurnIndex(null)
  }, [session.turns, playTurn])

  // Keep the ref updated with the latest playNextTurn function
  useEffect(() => {
    playNextTurnRef.current = playNextTurn
  }, [playNextTurn])

  const handlePlayAll = useCallback(async () => {
    if (audioState.isPlaying) {
      audioActions.pause()
      return
    }

    if (currentTurnIndex !== null && !audioState.isPlaying) {
      // Resume current turn
      audioActions.resume()
      return
    }

    // Start from beginning
    setIsSequentialMode(true)
    const firstTurnWithAudio = session.turns.findIndex((t) => t.audioUrl)
    if (firstTurnWithAudio >= 0) {
      await playTurn(firstTurnWithAudio)
    }
  }, [
    audioState.isPlaying,
    currentTurnIndex,
    session.turns,
    playTurn,
    audioActions,
  ])

  const handleStop = useCallback(() => {
    audioActions.stop()
    setIsSequentialMode(false)
    setCurrentTurnIndex(null)
    setOverallProgress(0)
  }, [audioActions])

  const handlePlaySingleTurn = useCallback(
    (index: number) => {
      console.log('[AudioPlayer] handlePlaySingleTurn called', { index })
      setIsSequentialMode(false) // Don't continue to next turn
      playTurn(index)
    },
    [playTurn],
  )

  // Expose the play function to parent component
  useEffect(() => {
    onPlayTurnReady?.(handlePlaySingleTurn)
  }, [handlePlaySingleTurn, onPlayTurnReady])

  // Check if there are any turns with audio
  const hasAudio = turnsWithAudio.length > 0

  if (!hasAudio) {
    return (
      <div className="border rounded-lg p-4 text-center text-muted-foreground">
        <Volume2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">
          No audio recordings available for this session
        </p>
      </div>
    )
  }

  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center gap-4">
        {/* Play/Pause button */}
        <Button
          variant="outline"
          size="icon"
          onClick={handlePlayAll}
          className="h-12 w-12 rounded-full"
          disabled={audioState.isLoading}
        >
          {audioState.isLoading ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          ) : audioState.isPlaying ? (
            <Pause className="h-5 w-5" />
          ) : (
            <Play className="h-5 w-5 ml-0.5" />
          )}
        </Button>

        {/* Stop button */}
        {(audioState.isPlaying || currentTurnIndex !== null) && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleStop}
            className="h-10 w-10"
          >
            <Square className="h-4 w-4" />
          </Button>
        )}

        {/* Skip button */}
        {isSequentialMode && currentTurnIndex !== null && (
          <Button
            variant="ghost"
            size="icon"
            onClick={playNextTurn}
            className="h-10 w-10"
          >
            <SkipForward className="h-4 w-4" />
          </Button>
        )}

        <div className="flex-1">
          {/* Progress bar */}
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-200"
              style={{ width: `${(overallProgress / totalDuration) * 100}%` }}
            />
          </div>

          {/* Time display */}
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>
              {Math.floor(overallProgress / 60)}:
              {String(Math.floor(overallProgress % 60)).padStart(2, '0')}
            </span>
            <span>
              {Math.floor(totalDuration / 60)}:
              {String(Math.floor(totalDuration % 60)).padStart(2, '0')}
            </span>
          </div>
        </div>
      </div>

      {/* Current turn indicator */}
      {currentTurnIndex !== null && (
        <div className="mt-3 text-xs text-muted-foreground text-center">
          Playing:{' '}
          {session.turns[currentTurnIndex].speaker === 'ai' ? 'AI' : 'You'}
          {isSequentialMode && (
            <span className="ml-2 text-primary">(Sequential mode)</span>
          )}
        </div>
      )}

      {/* Enable audio button if blocked */}
      {!audioState.canAutoplay && (
        <div className="mt-3 text-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => audioActions.enableAutoplay()}
            className="text-xs"
          >
            <Volume2 className="h-3 w-3 mr-1" />
            Click to enable audio
          </Button>
        </div>
      )}
    </div>
  )
}

// Individual turn play button for transcript view
function TurnPlayButton({
  turn,
  isActive,
  onPlay,
}: {
  turn: TranscriptTurn
  isActive: boolean
  onPlay: () => void
}) {
  if (!turn.audioUrl) return null

  return (
    <button
      onClick={onPlay}
      className={`inline-flex items-center justify-center h-6 w-6 rounded-full transition-colors ${
        isActive
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted hover:bg-muted-foreground/20'
      }`}
      title="Play this turn"
    >
      <Play className="h-3 w-3 ml-0.5" />
    </button>
  )
}

function TranscriptView({
  turns,
  activeTurnIndex,
  onPlayTurn,
}: {
  turns: TranscriptTurn[]
  activeTurnIndex: number | null
  onPlayTurn: (index: number) => void
}) {
  return (
    <div className="space-y-4">
      {turns.map((turn, index) => (
        <div
          key={turn.id}
          className={`flex ${turn.speaker === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-[80%] rounded-2xl px-4 py-2 transition-all ${
              turn.speaker === 'user'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted'
            } ${
              activeTurnIndex === index
                ? 'ring-2 ring-primary ring-offset-2'
                : ''
            }`}
          >
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <p className="text-sm">{turn.text}</p>
                <p className="text-xs opacity-70 mt-1">
                  {Math.floor(turn.startTime / 60)}:
                  {String(Math.floor(turn.startTime % 60)).padStart(2, '0')}
                </p>
              </div>
              <TurnPlayButton
                turn={turn}
                isActive={activeTurnIndex === index}
                onPlay={() => onPlayTurn(index)}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
