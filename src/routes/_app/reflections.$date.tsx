/**
 * Reflection by Date Route
 * View a specific day's reflection (transcript, summary - no image)
 */

import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { ArrowLeft, Trash2, Clock, MessageCircle } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '../../components/ui/button'
import {
  getReflectionByDateFn,
  deleteReflectionFn,
} from '../../server/reflection.fn'
import type { ReflectionTurn } from '../../types/voice-session'

export const Route = createFileRoute('/_app/reflections/$date')({
  component: ReflectionByDate,
})

function ReflectionByDate() {
  const { date } = Route.useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Fetch reflection for this date
  const {
    data: session,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['reflection', 'date', date],
    queryFn: () => getReflectionByDateFn({ data: { date } }),
    // Poll every 2 seconds while session is processing
    refetchInterval: (query) => {
      const data = query.state.data
      if (!data) return false
      if (data.status === 'processing') return 2000
      return false
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (sessionId: string) =>
      deleteReflectionFn({ data: { sessionId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reflections'] })
      toast.success('Reflection deleted', {
        description: 'Your reflection has been permanently deleted.',
      })
      navigate({ to: '/reflections' })
    },
    onError: (error) => {
      console.error('Failed to delete reflection:', error)
      toast.error('Failed to delete reflection', {
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
          <p className="mt-4 text-muted-foreground">Loading reflection...</p>
        </div>
      </div>
    )
  }

  if (error || !session) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">
            No reflection found for this date.
          </p>
          <Button
            variant="link"
            onClick={() => navigate({ to: '/reflections' })}
            className="mt-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to reflections
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
          onClick={() => navigate({ to: '/reflections' })}
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
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-violet-100 dark:bg-violet-900/30 mb-4">
          <MessageCircle className="h-8 w-8 text-violet-600 dark:text-violet-400" />
        </div>
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

      {/* Summary - with skeleton while processing */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-3">Your Reflection</h2>
        {session.summaryText ? (
          <div className="prose prose-sm prose-zinc dark:prose-invert">
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
            No summary available for this reflection.
          </p>
        )}
      </div>

      {/* Transcript */}
      {session.turns && session.turns.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Conversation</h2>
          <TranscriptView turns={session.turns} />
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background p-6 rounded-lg shadow-xl max-w-md">
            <h3 className="text-lg font-semibold mb-2">
              Delete this reflection?
            </h3>
            <p className="text-muted-foreground mb-4">
              This will permanently delete the transcript and summary. This
              action cannot be undone.
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
    completed:
      'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
    processing:
      'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    active: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    paused: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  }

  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status as keyof typeof colors] || colors.paused}`}
    >
      {status}
    </span>
  )
}

function TranscriptView({ turns }: { turns: ReflectionTurn[] }) {
  return (
    <div className="space-y-4">
      {turns.map((turn) => (
        <div
          key={turn.id}
          className={`flex ${turn.speaker === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-[80%] rounded-2xl px-4 py-2 ${
              turn.speaker === 'user' ? 'bg-violet-600 text-white' : 'bg-muted'
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
