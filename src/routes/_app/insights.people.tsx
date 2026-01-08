/**
 * People Tab
 * View people mentioned in reflections with sentiment tracking
 */

import { createFileRoute, getRouteApi } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { getPeopleFn, getPersonDetailFn } from '../../server/insights.fn'
import {
  MOCK_PEOPLE,
  MOCK_PERSON_MENTIONS,
} from '../../lib/mock/insights-mock-data'
import { PersonCard } from '../../components/insights/person-card'
import { Card, CardContent } from '../../components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog'
import { Skeleton } from '../../components/ui/skeleton'
import { Badge } from '../../components/ui/badge'
import { Users, Calendar, MessageSquare } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { format } from 'date-fns'
import type { RelationshipType, Sentiment } from '../../types/insights'

export const Route = createFileRoute('/_app/insights/people')({
  component: PeopleTab,
})

const parentRoute = getRouteApi('/_app/insights')

function PeopleTab() {
  const { mock } = parentRoute.useSearch()
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null)

  const { data: people, isLoading } = useQuery({
    queryKey: ['insights', 'people', mock],
    queryFn: () => (mock ? Promise.resolve(MOCK_PEOPLE) : getPeopleFn()),
  })

  // Mock person detail helper
  const getMockPersonDetail = (id: string) => {
    const person = MOCK_PEOPLE.find((p) => p.id === id)
    if (!person) return null
    return {
      ...person,
      mentions: MOCK_PERSON_MENTIONS[id] || [],
    }
  }

  const { data: personDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['insights', 'person', selectedPersonId, mock],
    queryFn: () => {
      if (!selectedPersonId) return null
      if (mock) return Promise.resolve(getMockPersonDetail(selectedPersonId))
      return getPersonDetailFn({ data: { id: selectedPersonId } })
    },
    enabled: !!selectedPersonId,
  })

  if (isLoading) {
    return <PeopleSkeleton />
  }

  if (!people || people.length === 0) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">No people tracked yet</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              People mentioned in your reflections will appear here.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {people.map((person) => (
          <PersonCard
            key={person.id}
            name={person.name}
            relationship={person.relationship as RelationshipType | null}
            mentionCount={person.mentionCount}
            averageSentiment={person.averageSentiment}
            lastMentioned={person.lastMentioned}
            onClick={() => setSelectedPersonId(person.id)}
          />
        ))}
      </div>

      {/* Person Detail Modal */}
      <Dialog
        open={!!selectedPersonId}
        onOpenChange={(open) => !open && setSelectedPersonId(null)}
      >
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          {detailLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-[200px]" />
            </div>
          ) : personDetail ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  {personDetail.name}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 mt-4">
                {/* Stats */}
                <div className="flex flex-wrap gap-2">
                  {personDetail.relationship && (
                    <Badge variant="secondary" className="capitalize">
                      {personDetail.relationship}
                    </Badge>
                  )}
                  <Badge variant="outline">
                    {personDetail.mentionCount} mention
                    {personDetail.mentionCount !== 1 ? 's' : ''}
                  </Badge>
                  {personDetail.averageSentiment !== null && (
                    <Badge
                      variant="outline"
                      className={
                        personDetail.averageSentiment > 0.3
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30'
                          : personDetail.averageSentiment < -0.3
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30'
                            : ''
                      }
                    >
                      {personDetail.averageSentiment > 0.3
                        ? 'Positive'
                        : personDetail.averageSentiment < -0.3
                          ? 'Negative'
                          : 'Neutral'}{' '}
                      sentiment
                    </Badge>
                  )}
                </div>

                {/* Mentions */}
                <div>
                  <h4 className="text-sm font-medium mb-3">Mentions</h4>
                  <div className="space-y-3">
                    {personDetail.mentions.map((mention) => (
                      <div
                        key={mention.id}
                        className="p-3 rounded-lg bg-muted/50"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <Link
                            to="/reflections/$date"
                            params={{
                              date: format(
                                new Date(mention.date),
                                'yyyy-MM-dd',
                              ),
                            }}
                            className="text-sm font-medium hover:underline flex items-center gap-1"
                            onClick={() => setSelectedPersonId(null)}
                          >
                            <Calendar className="h-3.5 w-3.5" />
                            {format(new Date(mention.date), 'MMM d, yyyy')}
                          </Link>
                          {mention.sentiment && (
                            <SentimentBadge sentiment={mention.sentiment} />
                          )}
                        </div>
                        {mention.summaryPreview && (
                          <p className="text-sm text-muted-foreground flex items-start gap-1.5">
                            <MessageSquare className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                            <span className="line-clamp-2">
                              {mention.summaryPreview}...
                            </span>
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SentimentBadge({ sentiment }: { sentiment: Sentiment }) {
  const colors = {
    positive: 'bg-green-100 text-green-700 dark:bg-green-900/30',
    neutral: 'bg-gray-100 text-gray-700 dark:bg-gray-800',
    negative: 'bg-red-100 text-red-700 dark:bg-red-900/30',
  }

  return (
    <Badge variant="outline" className={`text-xs ${colors[sentiment]}`}>
      {sentiment}
    </Badge>
  )
}

function PeopleSkeleton() {
  return (
    <div className="p-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-[100px] rounded-lg" />
        ))}
      </div>
    </div>
  )
}
