/**
 * Insights Overview Tab
 * Dashboard view with stats and recent activity
 */

import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Calendar, CheckSquare, Smile, Users } from 'lucide-react'
import {
  getInsightsOverviewFn,
  getReflectionTimelineFn,
} from '../../server/insights.fn'
import { StatCard } from '../../components/insights/stat-card'
import { MoodBadge } from '../../components/insights/mood-badge'
import { TopicPill } from '../../components/insights/topic-pill'
import { InsightItem } from '../../components/insights/insight-card'
import { TimelineItem } from '../../components/insights/timeline-item'
import { Skeleton } from '../../components/ui/skeleton'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../components/ui/card'

export const Route = createFileRoute('/_app/insights/')({
  component: OverviewTab,
})

function OverviewTab() {
  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ['insights', 'overview'],
    queryFn: () => getInsightsOverviewFn(),
  })

  const { data: timeline, isLoading: timelineLoading } = useQuery({
    queryKey: ['insights', 'timeline'],
    queryFn: () => getReflectionTimelineFn(),
  })

  if (overviewLoading) {
    return <OverviewSkeleton />
  }

  return (
    <div className="p-6 space-y-6">
      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Reflections"
          value={overview?.totalReflections || 0}
          icon={<Calendar className="h-5 w-5" />}
        />
        <StatCard
          title="Pending Todos"
          value={overview?.pendingTodos || 0}
          subtitle={`${overview?.completedTodos || 0} completed`}
          icon={<CheckSquare className="h-5 w-5" />}
        />
        <StatCard
          title="People Tracked"
          value={overview?.trackedPeople || 0}
          icon={<Users className="h-5 w-5" />}
        />
        <StatCard
          title="Current Mood"
          value={overview?.recentMood?.mood || 'No data'}
          icon={<Smile className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Mood */}
        {overview?.recentMood && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-medium">
                Your Latest Mood
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <MoodBadge mood={overview.recentMood.mood} size="lg" />
                <span className="text-sm text-muted-foreground">
                  from{' '}
                  {new Date(overview.recentMood.date).toLocaleDateString(
                    'en-US',
                    {
                      weekday: 'long',
                      month: 'short',
                      day: 'numeric',
                    },
                  )}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Top Topics */}
        {overview?.topTopics && overview.topTopics.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-medium">
                  Top Topics
                </CardTitle>
                <Link
                  to="/insights/topics"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  View all
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {overview.topTopics.map((t) => (
                  <TopicPill key={t.topic} topic={t.topic} count={t.count} />
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Recent Insights */}
      {overview?.recentInsights && overview.recentInsights.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-medium">
                Recent Insights
              </CardTitle>
              <Link
                to="/insights/insights"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                View all
              </Link>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="divide-y">
              {overview.recentInsights.map((insight) => (
                <InsightItem
                  key={insight.id}
                  text={insight.text}
                  category={insight.category}
                  date={new Date(insight.date)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Timeline */}
      {!timelineLoading && timeline && timeline.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-medium">
              Recent Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-0">
              {timeline
                .slice(0, 5)
                .map((item) =>
                  item.mood ? (
                    <TimelineItem
                      key={item.id}
                      date={new Date(item.date)}
                      mood={item.mood}
                      topics={item.topics}
                      summaryPreview={item.summaryPreview || undefined}
                    />
                  ) : null,
                )}
            </div>
            {timeline.length > 5 && (
              <Link
                to="/reflections"
                className="block text-center text-sm text-muted-foreground hover:text-foreground mt-4"
              >
                View all reflections
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!overviewLoading && overview?.totalReflections === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Smile className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">No reflections yet</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Start a reflection to see insights here.
            </p>
            <Link
              to="/reflections/today"
              className="inline-block mt-4 text-sm text-violet-600 hover:underline"
            >
              Start your first reflection
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function OverviewSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-[120px] rounded-lg" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-[150px] rounded-lg" />
        <Skeleton className="h-[150px] rounded-lg" />
      </div>
      <Skeleton className="h-[300px] rounded-lg" />
    </div>
  )
}
