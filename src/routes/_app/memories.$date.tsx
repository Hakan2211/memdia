/**
 * Session by Date Route
 * View a specific day's session (transcript, summary, image)
 */

import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { ArrowLeft, Trash2, Clock } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '../../components/ui/button'
import { getSessionByDateFn, deleteSessionFn } from '../../server/session.fn'
import type { TranscriptTurn } from '../../types/voice-session'

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
    // Poll every 2 seconds while session is processing or missing image
    refetchInterval: (query) => {
      const data = query.state.data
      if (!data) return false
      // Keep polling if processing or missing image
      if (data.status === 'processing') return 2000
      if (data.status === 'completed' && !data.imageUrl) return 2000
      return false
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (sessionId: string) => deleteSessionFn({ data: { sessionId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] })
      toast.success('Session deleted', {
        description: 'Your memory has been permanently deleted.',
      })
      navigate({ to: '/memories' })
    },
    onError: (error) => {
      console.error('Failed to delete session:', error)
      toast.error('Failed to delete session', {
        description:
          error instanceof Error ? error.message : 'Please try again.',
      })
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

      {/* Transcript */}
      {session.turns && session.turns.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Transcript</h2>
          <TranscriptView turns={session.turns} />
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
