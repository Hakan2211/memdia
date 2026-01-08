/**
 * Insights Tab
 * View categorized insights from reflections
 */

import { createFileRoute, getRouteApi } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { getInsightsByCategoryFn } from '../../server/insights.fn'
import { MOCK_INSIGHTS_BY_CATEGORY } from '../../lib/mock/insights-mock-data'
import { InsightCard } from '../../components/insights/insight-card'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../components/ui/card'
import { Skeleton } from '../../components/ui/skeleton'
import { Lightbulb } from 'lucide-react'
import type { InsightCategory } from '../../types/insights'
import { INSIGHT_CATEGORY_META } from '../../types/insights'

export const Route = createFileRoute('/_app/insights/insights')({
  component: InsightsTab,
})

const parentRoute = getRouteApi('/_app/insights')

const CATEGORY_ORDER: InsightCategory[] = [
  'realization',
  'goal',
  'gratitude',
  'learning',
  'idea',
  'inspiration',
  'concern',
  'question',
]

function InsightsTab() {
  const { mock } = parentRoute.useSearch()

  const { data: byCategory, isLoading } = useQuery({
    queryKey: ['insights', 'insights', 'byCategory', mock],
    queryFn: () =>
      mock
        ? Promise.resolve(MOCK_INSIGHTS_BY_CATEGORY)
        : getInsightsByCategoryFn(),
  })

  if (isLoading) {
    return <InsightsSkeleton />
  }

  const hasAnyInsights =
    byCategory &&
    Object.values(byCategory).some((insights) => insights.length > 0)

  if (!hasAnyInsights) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <Lightbulb className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">No insights yet</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Insights from your reflections will appear here, organized by
              category.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {CATEGORY_ORDER.map((category) => {
        const insights = byCategory?.[category] || []
        if (insights.length === 0) return null

        const meta = INSIGHT_CATEGORY_META[category]

        return (
          <Card key={category}>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <span className={meta.color}>{getCategoryEmoji(category)}</span>
                {meta.label}
                <span className="text-sm font-normal text-muted-foreground">
                  ({insights.length})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {insights.map((insight) => (
                <InsightCard
                  key={insight.id}
                  text={insight.text}
                  category={category}
                  date={new Date(insight.date)}
                  showCategory={false}
                />
              ))}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

function getCategoryEmoji(category: InsightCategory): string {
  const emojis: Record<InsightCategory, string> = {
    realization: '',
    goal: '',
    gratitude: '',
    concern: '',
    question: '',
    learning: '',
    idea: '',
    inspiration: '',
  }
  return emojis[category]
}

function InsightsSkeleton() {
  return (
    <div className="p-6 space-y-6">
      {[...Array(4)].map((_, i) => (
        <Skeleton key={i} className="h-[200px] rounded-lg" />
      ))}
    </div>
  )
}
