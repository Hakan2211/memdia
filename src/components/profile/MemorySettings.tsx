/**
 * Memory settings (Profile page)
 *
 * Memory works silently in the background; this card is the one place users
 * manage it: a short explanation, a link to see what's remembered (the
 * /memory page, intentionally not in the main navigation), and "forget
 * everything".
 */

import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { ChevronRight, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { getMemoryFn, wipeMemoryFn } from '../../server/memory.fn'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'

export const MEMORY_QUERY_KEY = ['memory'] as const

export function MemorySettings() {
  const queryClient = useQueryClient()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: MEMORY_QUERY_KEY,
    queryFn: () => getMemoryFn(),
  })

  const wipe = useMutation({
    mutationFn: () => wipeMemoryFn(),
    onSuccess: () => {
      toast.success('Your companion’s memory has been wiped')
      setConfirmOpen(false)
    },
    onError: () => toast.error('Failed to wipe memory'),
    onSettled: () =>
      void queryClient.invalidateQueries({ queryKey: MEMORY_QUERY_KEY }),
  })

  const hasMemory =
    !!data &&
    (data.sections.some((s) => s.items.length > 0) || data.notes.length > 0)

  let status: string | null = null
  if (data && !hasMemory) {
    status = data.wipedAt
      ? `Memory wiped ${formatDistanceToNow(new Date(data.wipedAt), { addSuffix: true })}. It will start learning again from your next conversation.`
      : 'Nothing remembered yet. It starts learning from your first conversation.'
  } else if (data && data.sessionCount > 0) {
    status = `Learned from ${data.sessionCount} conversation${data.sessionCount === 1 ? '' : 's'}.`
  }

  return (
    <div className="rounded-lg border bg-card p-6">
      <h2 className="mb-2 text-lg font-semibold">Memory</h2>
      <p className="text-sm text-muted-foreground">
        Your companion remembers past conversations so it can pick up where you
        left off. Only you and your companion can see what it remembers.
      </p>
      {status && <p className="mt-2 text-sm text-muted-foreground">{status}</p>}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        {hasMemory ? (
          <Link
            to="/memory"
            className="inline-flex items-center text-sm font-medium text-[#7e9ec9] hover:underline"
          >
            See what it remembers
            <ChevronRight className="ml-0.5 h-4 w-4" />
          </Link>
        ) : (
          <span />
        )}
        <Button
          variant="outline"
          className="cursor-pointer text-destructive hover:bg-destructive/10 hover:text-destructive"
          disabled={isLoading || !hasMemory}
          onClick={() => setConfirmOpen(true)}
        >
          Forget everything
        </Button>
      </div>

      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!wipe.isPending) setConfirmOpen(open)
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Wipe your companion’s memory?</DialogTitle>
            <DialogDescription>
              Your companion will no longer remember anything from your past
              conversations or check-ins: not what it learned about you, not its
              notes, and it won’t look back at them anymore. Your conversations,
              journal entries and Insights stay. This can’t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              className="cursor-pointer"
              disabled={wipe.isPending}
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="cursor-pointer"
              disabled={wipe.isPending}
              onClick={() => wipe.mutate()}
            >
              {wipe.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Wipe memory
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
