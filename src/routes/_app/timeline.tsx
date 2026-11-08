/**
 * Timeline Route
 * Monthly collage + continuous weekly feed of memory/reflection images
 */

import { useEffect, useRef } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isValid,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs'
import { MonthGrid } from '../../components/timeline/month-grid'
import { WeekFeed } from '../../components/timeline/week-feed'
import { getTimelineFn } from '../../server/timeline.fn'

// Match the Memories calendar (react-day-picker default: Sunday)
const WEEK_STARTS_ON = 0

const timelineSearchSchema = z.object({
  view: z.enum(['week', 'month']).optional().default('month'),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .catch(undefined),
})

type TimelineView = 'week' | 'month'

export const Route = createFileRoute('/_app/timeline')({
  validateSearch: timelineSearchSchema,
  component: TimelinePage,
})

function TimelinePage() {
  const navigate = useNavigate({ from: '/timeline' })
  const { view, date } = Route.useSearch()
  const pageRef = useRef<HTMLDivElement>(null)

  const parsed = date ? parseISO(date) : new Date()
  const anchor = isValid(parsed) ? parsed : new Date()
  const anchorWeekStart = startOfWeek(anchor, { weekStartsOn: WEEK_STARTS_ON })

  // Jump back to the top whenever the view or anchor changes
  useEffect(() => {
    // Depending on layout, either the app <main> or the window scrolls
    pageRef.current?.closest('main')?.scrollTo({ top: 0 })
    window.scrollTo({ top: 0 })
  }, [view, date])

  const goTo = (next: { view?: TimelineView; date?: Date }) => {
    navigate({
      search: {
        view: next.view ?? view,
        date: format(next.date ?? anchor, 'yyyy-MM-dd'),
      },
    })
  }

  return (
    <div ref={pageRef} className="flex flex-col">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <h1 className="text-2xl font-bold tracking-tight">Timeline</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Look back on your days, one picture at a time
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 border-b px-6 py-3">
        <Tabs
          value={view}
          onValueChange={(v) => goTo({ view: v as TimelineView })}
        >
          <TabsList>
            <TabsTrigger value="week" className="cursor-pointer">
              Week
            </TabsTrigger>
            <TabsTrigger value="month" className="cursor-pointer">
              Month
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {view === 'month' ? (
          <MonthControls
            anchor={anchor}
            onStep={(dir) => goTo({ date: addMonths(anchor, dir) })}
          />
        ) : (
          <h2 className="text-lg font-semibold">Week by week</h2>
        )}

        <div className="ml-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => goTo({ date: new Date() })}
            className="cursor-pointer"
          >
            Today
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-6">
        {view === 'month' ? (
          <div className="mx-auto max-w-4xl">
            <MonthView anchor={anchor} />
          </div>
        ) : (
          <div className="mx-auto max-w-3xl">
            <WeekFeed
              anchorWeekStart={anchorWeekStart}
              weekStartsOn={WEEK_STARTS_ON}
            />
          </div>
        )}
      </div>
    </div>
  )
}

function MonthControls({
  anchor,
  onStep,
}: {
  anchor: Date
  onStep: (dir: 1 | -1) => void
}) {
  return (
    <>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onStep(-1)}
          aria-label="Previous month"
          className="cursor-pointer"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onStep(1)}
          aria-label="Next month"
          className="cursor-pointer"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <h2 className="text-lg font-semibold">{format(anchor, 'MMMM yyyy')}</h2>
    </>
  )
}

function MonthView({ anchor }: { anchor: Date }) {
  // Full weeks around the month so the grid is calendar-aligned
  const rangeStart = startOfWeek(startOfMonth(anchor), {
    weekStartsOn: WEEK_STARTS_ON,
  })
  const rangeEnd = endOfWeek(endOfMonth(anchor), {
    weekStartsOn: WEEK_STARTS_ON,
  })
  const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd })
  const start = format(rangeStart, 'yyyy-MM-dd')
  const end = format(rangeEnd, 'yyyy-MM-dd')

  const { data, isLoading } = useQuery({
    queryKey: ['timeline', start, end],
    queryFn: () => getTimelineFn({ data: { start, end } }),
  })

  if (isLoading) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        Loading…
      </div>
    )
  }

  return <MonthGrid days={days} month={anchor} data={data} />
}
