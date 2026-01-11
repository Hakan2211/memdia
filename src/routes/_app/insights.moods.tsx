/**
 * Moods Tab
 * View mood history and distribution charts
 */

import { Link, createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Smile } from 'lucide-react'
import { format } from 'date-fns'
import { Bar, BarChart, XAxis, YAxis } from 'recharts'
import {
  getMoodDistributionFn,
  getMoodHistoryFn,
} from '../../server/insights.fn'
import { MoodBadge, MoodDot } from '../../components/insights/mood-badge'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../../components/ui/card'
import { Skeleton } from '../../components/ui/skeleton'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '../../components/ui/chart'
import { getMoodValence } from '../../types/insights'
import type { Mood } from '../../types/insights'

export const Route = createFileRoute('/_app/insights/moods')({
  component: MoodsTab,
})

function MoodsTab() {
  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ['insights', 'moods', 'history'],
    queryFn: () => getMoodHistoryFn(),
  })

  const { data: distribution, isLoading: distributionLoading } = useQuery({
    queryKey: ['insights', 'moods', 'distribution'],
    queryFn: () => getMoodDistributionFn(),
  })

  if (historyLoading || distributionLoading) {
    return <MoodsSkeleton />
  }

  if (!history || history.length === 0) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <Smile className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">No mood data yet</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Complete reflections to track your moods over time.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Prepare chart data
  const chartData =
    distribution?.map((d) => ({
      mood: d.mood,
      count: d.count,
      fill: getMoodColor(d.mood),
    })) || []

  const chartConfig =
    distribution?.reduce(
      (acc, d) => {
        acc[d.mood] = {
          label: d.mood.charAt(0).toUpperCase() + d.mood.slice(1),
          color: getMoodColor(d.mood),
        }
        return acc
      },
      {} as Record<string, { label: string; color: string }>,
    ) || {}

  return (
    <div className="p-6 space-y-6">
      {/* Distribution Chart */}
      {distribution && distribution.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-medium">
              Mood Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ left: 100, right: 20 }}
              >
                <XAxis type="number" />
                <YAxis
                  type="category"
                  dataKey="mood"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) =>
                    value.charAt(0).toUpperCase() + value.slice(1)
                  }
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Mood History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-medium">Mood History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {history.map((entry) => (
              <Link
                key={entry.id}
                to="/reflections/$date"
                params={{ date: format(new Date(entry.date), 'yyyy-MM-dd') }}
                className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <MoodDot mood={entry.mood} />
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {format(new Date(entry.date), 'EEEE, MMM d')}
                  </p>
                </div>
                <MoodBadge mood={entry.mood} size="sm" />
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function getMoodColor(mood: Mood): string {
  const valence = getMoodValence(mood)
  switch (valence) {
    case 'positive':
      return 'hsl(142, 76%, 36%)' // green
    case 'neutral':
      return 'hsl(221, 83%, 53%)' // blue
    case 'negative':
      return 'hsl(24, 95%, 53%)' // orange
    default:
      return 'hsl(0, 0%, 50%)'
  }
}

function MoodsSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <Skeleton className="h-[350px] rounded-lg" />
      <Skeleton className="h-[400px] rounded-lg" />
    </div>
  )
}
