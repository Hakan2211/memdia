/**
 * Memory Page
 *
 * Shows what the companion remembers about the user — the long-term profile
 * and the notes it wrote after recent conversations — and lets them delete
 * single items, forget a conversation, or wipe everything.
 */

import { useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format, formatDistanceToNow } from 'date-fns'
import { Brain, Loader2, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  deleteMemoryItemFn,
  forgetConversationFn,
  getMemoryFn,
  wipeMemoryFn,
} from '../../server/memory.fn'
import { Button } from '../../components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog'
import { Skeleton } from '../../components/ui/skeleton'

export const Route = createFileRoute('/_app/memory')({
  component: MemoryPage,
})

/** Profile headings are stored in English for the AI; show them to the user in their words. */
const SECTION_LABELS: Record<string, string> = {
  'About their life': 'Your life',
  People: 'People',
  'Interests and open questions': 'Interests and open questions',
  'Views and how they have changed': 'Your views',
  'Ongoing threads': 'Ongoing threads',
  'How they like to talk': 'How you like to talk',
}

const MEMORY_QUERY_KEY = ['memory'] as const

type ConfirmAction =
  | { type: 'forget'; sessionId: string; date: Date }
  | { type: 'wipe' }

function MemoryPage() {
  const queryClient = useQueryClient()
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null)
  const [pendingItem, setPendingItem] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: MEMORY_QUERY_KEY,
    queryFn: () => getMemoryFn(),
  })

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: MEMORY_QUERY_KEY })

  const deleteItem = useMutation({
    mutationFn: (vars: { heading: string; item: string }) =>
      deleteMemoryItemFn({ data: vars }),
    onMutate: (vars) => setPendingItem(`${vars.heading}::${vars.item}`),
    onSuccess: () => toast.success('Forgotten'),
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : 'Failed to delete'),
    onSettled: () => {
      setPendingItem(null)
      void refresh()
    },
  })

  const forgetConversation = useMutation({
    mutationFn: (sessionId: string) =>
      forgetConversationFn({ data: { sessionId } }),
    onSuccess: () => {
      toast.success('Conversation forgotten')
      setConfirm(null)
    },
    onError: () => toast.error('Failed to forget conversation'),
    onSettled: () => void refresh(),
  })

  const wipe = useMutation({
    mutationFn: () => wipeMemoryFn(),
    onSuccess: () => {
      toast.success('Your companion’s memory has been wiped')
      setConfirm(null)
    },
    onError: () => toast.error('Failed to wipe memory'),
    onSettled: () => void refresh(),
  })

  const sections = (data?.sections ?? []).filter((s) => s.items.length > 0)
  const notes = data?.notes ?? []
  const isEmpty = sections.length === 0 && notes.length === 0

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <h1 className="text-2xl font-bold tracking-tight">Memory</h1>
        <p className="text-sm text-muted-foreground mt-1">
          What your companion remembers about you, and what it forgets
        </p>
      </div>

      <div className="mx-auto w-full max-w-4xl space-y-6 p-6">
        <p className="text-sm text-muted-foreground">
          After each conversation, your companion updates what it knows about
          you and writes a short note for itself, so it can pick up where you
          left off. It also looks back at past conversations when something you
          say connects to them. Only you and your companion see this. Deleting
          something removes it from future conversations, but it may be learned
          again if you bring it up again.
        </p>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-40 w-full" />
            ))}
          </div>
        ) : isEmpty ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Brain className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">
                Nothing remembered yet
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {data?.wipedAt
                  ? `You wiped your companion’s memory ${formatDistanceToNow(new Date(data.wipedAt), { addSuffix: true })}. It will start learning again from your next conversation.`
                  : 'After your next conversation, what your companion learns about you will appear here.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Profile */}
            {sections.length > 0 && (
              <div className="grid gap-4 md:grid-cols-2">
                {sections.map((section) => (
                  <Card key={section.heading}>
                    <CardHeader>
                      <CardTitle className="text-base">
                        {SECTION_LABELS[section.heading] ?? section.heading}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-1">
                        {section.items.map((item) => {
                          const key = `${section.heading}::${item}`
                          const isPending = pendingItem === key
                          return (
                            <li
                              key={key}
                              className="group -mx-2 flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50"
                            >
                              <span className="flex-1 text-sm leading-relaxed">
                                {item}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 shrink-0 cursor-pointer text-muted-foreground opacity-100 hover:text-destructive md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100"
                                aria-label="Forget this"
                                title="Forget this"
                                disabled={deleteItem.isPending}
                                onClick={() =>
                                  deleteItem.mutate({
                                    heading: section.heading,
                                    item,
                                  })
                                }
                              >
                                {isPending ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <X className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            </li>
                          )
                        })}
                      </ul>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Conversation notes */}
            {notes.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Notes from your conversations
                  </CardTitle>
                  <CardDescription>
                    What your companion wrote down for itself after each
                    conversation. The most recent ones help it pick up where you
                    left off.
                  </CardDescription>
                </CardHeader>
                <CardContent className="divide-y">
                  {notes.map((n) => (
                    <div key={n.sessionId} className="py-4 first:pt-0">
                      <div className="mb-2 flex items-center justify-between gap-4">
                        <Link
                          to="/conversations/$date"
                          params={{
                            date: format(new Date(n.date), 'yyyy-MM-dd'),
                          }}
                          className="text-sm font-medium text-[#7e9ec9] hover:underline"
                        >
                          {format(new Date(n.date), 'EEEE, MMMM d, yyyy')}
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="cursor-pointer text-muted-foreground hover:text-destructive"
                          onClick={() =>
                            setConfirm({
                              type: 'forget',
                              sessionId: n.sessionId,
                              date: new Date(n.date),
                            })
                          }
                        >
                          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                          Forget
                        </Button>
                      </div>
                      <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                        {n.note}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <p className="text-xs text-muted-foreground">
              Learned from {data?.sessionCount ?? 0} conversation
              {data?.sessionCount === 1 ? '' : 's'}
              {data?.recallCount
                ? ` · ${data.recallCount} past moments it can recall`
                : ''}
              {data?.updatedAt
                ? ` · updated ${formatDistanceToNow(new Date(data.updatedAt), { addSuffix: true })}`
                : ''}
            </p>
          </>
        )}

        {/* Danger zone */}
        {!isLoading && !isEmpty && (
          <Card className="border-destructive/30">
            <CardHeader>
              <CardTitle className="text-base">Forget everything</CardTitle>
              <CardDescription>
                Wipe everything your companion remembers and start fresh. Your
                conversations, journal entries and Insights are kept.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="destructive"
                className="cursor-pointer"
                onClick={() => setConfirm({ type: 'wipe' })}
              >
                Wipe memory
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Confirmation */}
      <Dialog
        open={!!confirm}
        onOpenChange={(open) => {
          if (!open && !forgetConversation.isPending && !wipe.isPending) {
            setConfirm(null)
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {confirm?.type === 'wipe'
                ? 'Wipe your companion’s memory?'
                : 'Forget this conversation?'}
            </DialogTitle>
            <DialogDescription>
              {confirm?.type === 'wipe'
                ? 'Your companion will no longer remember anything from your past conversations or check-ins: not what it learned about you, not its notes, and it won’t look back at them anymore. Your conversations, journal entries and Insights stay. This can’t be undone.'
                : confirm?.type === 'forget'
                  ? `Your companion will delete its note from ${format(confirm.date, 'MMMM d')} and won’t look back at that conversation anymore. Anything it already learned from it stays in the cards above; delete those items separately. The conversation itself stays in your journal.`
                  : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              className="cursor-pointer"
              disabled={forgetConversation.isPending || wipe.isPending}
              onClick={() => setConfirm(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="cursor-pointer"
              disabled={forgetConversation.isPending || wipe.isPending}
              onClick={() => {
                if (confirm?.type === 'wipe') wipe.mutate()
                else if (confirm?.type === 'forget')
                  forgetConversation.mutate(confirm.sessionId)
              }}
            >
              {(forgetConversation.isPending || wipe.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {confirm?.type === 'wipe' ? 'Wipe memory' : 'Forget'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
