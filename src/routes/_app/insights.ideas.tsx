/**
 * Ideas Tab
 * Thinkers, books, works and concepts that came up across conversations —
 * a map of what the user has been exploring intellectually.
 */

import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { BookOpen } from 'lucide-react'
import { getReferencesFn } from '../../server/insights.fn'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../components/ui/card'
import { Skeleton } from '../../components/ui/skeleton'
import { REFERENCE_KINDS, REFERENCE_KIND_META } from '../../types/insights'

export const Route = createFileRoute('/_app/insights/ideas')({
  component: IdeasTab,
})

function IdeasTab() {
  const { data: references, isLoading } = useQuery({
    queryKey: ['insights', 'references'],
    queryFn: () => getReferencesFn(),
  })

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-48 w-full" />
        ))}
      </div>
    )
  }

  if (!references || references.length === 0) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">No ideas yet</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Thinkers, books and concepts you explore in your conversations
              will appear here.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {REFERENCE_KINDS.map((kind) => {
        const items = references.filter((r) => r.kind === kind)
        if (items.length === 0) return null

        return (
          <Card key={kind}>
            <CardHeader>
              <CardTitle className="text-lg">
                {REFERENCE_KIND_META[kind].plural}
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({items.length})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y">
              {items.map((ref) => (
                <div key={`${ref.kind}:${ref.name}`} className="py-3">
                  <div className="flex items-baseline justify-between gap-4">
                    <p className="font-medium">{ref.name}</p>
                    {ref.count > 1 && (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {ref.count} conversations
                      </span>
                    )}
                  </div>
                  <ul className="mt-1 space-y-1">
                    {ref.mentions.slice(0, 3).map((m, i) => (
                      <li key={i} className="text-sm text-muted-foreground">
                        <Link
                          to="/conversations/$date"
                          params={{
                            date: format(new Date(m.date), 'yyyy-MM-dd'),
                          }}
                          className="mr-2 text-xs text-[#7e9ec9] hover:underline"
                        >
                          {format(new Date(m.date), 'MMM d')}
                        </Link>
                        {m.note}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
