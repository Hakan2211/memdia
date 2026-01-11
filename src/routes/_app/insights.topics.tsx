/**
 * Topics Tab
 * View topics mentioned in reflections
 */

import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Calendar, Tag } from 'lucide-react'
import { format } from 'date-fns'
import { getSessionsByTopicFn, getTopicsFn } from '../../server/insights.fn'
import { TopicPill } from '../../components/insights/topic-pill'
import { MoodBadge } from '../../components/insights/mood-badge'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog'
import { Skeleton } from '../../components/ui/skeleton'

export const Route = createFileRoute('/_app/insights/topics')({
  component: TopicsTab,
})

function TopicsTab() {
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null)

  const { data: topics, isLoading } = useQuery({
    queryKey: ['insights', 'topics'],
    queryFn: () => getTopicsFn(),
  })

  const { data: topicSessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ['insights', 'topics', selectedTopic],
    queryFn: () => {
      if (!selectedTopic) return null
      return getSessionsByTopicFn({ data: { topic: selectedTopic } })
    },
    enabled: !!selectedTopic,
  })

  if (isLoading) {
    return <TopicsSkeleton />
  }

  if (!topics || topics.length === 0) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <Tag className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">No topics yet</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Topics from your reflections will appear here.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-medium">All Topics</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Click a topic to see related reflections
          </p>
          <div className="flex flex-wrap gap-3">
            {topics.map((t) => (
              <TopicPill
                key={t.topic}
                topic={t.topic}
                count={t.count}
                onClick={() => setSelectedTopic(t.topic)}
                selected={selectedTopic === t.topic}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Topic Detail Modal */}
      <Dialog
        open={!!selectedTopic}
        onOpenChange={(open) => !open && setSelectedTopic(null)}
      >
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 capitalize">
              <Tag className="h-5 w-5" />
              {selectedTopic}
            </DialogTitle>
          </DialogHeader>

          <div className="mt-4">
            {sessionsLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-[80px]" />
                ))}
              </div>
            ) : topicSessions && topicSessions.length > 0 ? (
              <div className="space-y-3">
                {topicSessions.map((session) => (
                  <Link
                    key={session.id}
                    to="/reflections/$date"
                    params={{
                      date: format(new Date(session.date), 'yyyy-MM-dd'),
                    }}
                    onClick={() => setSelectedTopic(null)}
                    className="block p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {format(new Date(session.date), 'EEEE, MMM d')}
                      </span>
                      {session.mood && (
                        <MoodBadge
                          mood={session.mood}
                          size="sm"
                          showEmoji={false}
                        />
                      )}
                    </div>
                    {session.summaryPreview && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {session.summaryPreview}...
                      </p>
                    )}
                    {session.topics.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {session.topics.slice(0, 4).map((topic) => (
                          <TopicPill
                            key={topic}
                            topic={topic}
                            size="sm"
                            selected={topic === selectedTopic}
                          />
                        ))}
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No reflections found for this topic
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function TopicsSkeleton() {
  return (
    <div className="p-6">
      <Skeleton className="h-[300px] rounded-lg" />
    </div>
  )
}
