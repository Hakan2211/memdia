/**
 * Session by Date Route
 * View/replay a specific day's session
 */

import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { ArrowLeft, Trash2, Play, Pause, Clock } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../../components/ui/button'
import { getSessionByDateFn, deleteSessionFn } from '../../server/session.fn'
import type { VoiceSession, TranscriptTurn } from '../../types/voice-session'

export const Route = createFileRoute('/_app/memories/$date')({
  component: SessionByDate,
})

function SessionByDate() {
  const { date } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Fetch session for this date
  const {
    data: session,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['session', 'date', date],
    queryFn: () => getSessionByDateFn({ data: { date } }),
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
          <h2 className="text-lg font-semibold mb-3">Reflection</h2>
          <div className="prose prose-sm prose-zinc">
            {session.summaryText.split('\n\n').map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>
        </div>
      )}

      {/* Audio Player */}
      {session.turns && session.turns.length > 0 && (
        <div className="mb-8">
          <AudioPlayer session={session} />
        </div>
      )}

      {/* Transcript */}
      {session.turns && session.turns.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Transcript</h2>
          <TranscriptView turns={session.turns} />
        </div>
      )}

      {/* Processing state */}
      {session.status === 'processing' && (
        <div className="text-center py-8 border rounded-lg bg-muted/20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="mt-4 text-muted-foreground">
            Your memory is being processed...
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Summary and image will appear shortly
          </p>
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
}: {
  session: VoiceSession & { turns: TranscriptTurn[] }
}) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  // TODO: Wire up setCurrentTime to audio element events
  void setCurrentTime

  // TODO: Implement actual audio playback
  const totalDuration = session.turns.reduce(
    (acc, turn) => acc + turn.duration,
    0,
  )

  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setIsPlaying(!isPlaying)}
          className="h-12 w-12 rounded-full"
        >
          {isPlaying ? (
            <Pause className="h-5 w-5" />
          ) : (
            <Play className="h-5 w-5 ml-0.5" />
          )}
        </Button>

        <div className="flex-1">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${(currentTime / totalDuration) * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>
              {Math.floor(currentTime / 60)}:
              {String(Math.floor(currentTime % 60)).padStart(2, '0')}
            </span>
            <span>
              {Math.floor(totalDuration / 60)}:
              {String(Math.floor(totalDuration % 60)).padStart(2, '0')}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function TranscriptView({ turns }: { turns: TranscriptTurn[] }) {
  return (
    <div className="space-y-4">
      {turns.map((turn) => (
        <div
          key={turn.id}
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
            <p className="text-xs opacity-70 mt-1">
              {Math.floor(turn.startTime / 60)}:
              {String(Math.floor(turn.startTime % 60)).padStart(2, '0')}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
