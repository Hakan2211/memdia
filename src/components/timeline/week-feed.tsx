/**
 * Week Feed
 * Continuous, newest-first timeline: starts at the anchor week and loads
 * older weeks as the user scrolls down, until the first ever entry.
 */

import { useEffect, useRef } from 'react'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import {
  eachDayOfInterval,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  parseISO,
  startOfDay,
  subWeeks,
} from 'date-fns'
import { getTimelineFn, getTimelineStartFn } from '../../server/timeline.fn'
import { WeekList } from './week-list'

/** "Nov 1 – 7" within one month, "Oct 25 – Nov 1" across months */
function formatWeekRange(start: Date, end: Date) {
  return start.getMonth() === end.getMonth()
    ? `${format(start, 'MMM d')} – ${format(end, 'd')}`
    : `${format(start, 'MMM d')} – ${format(end, 'MMM d')}`
}

interface WeekFeedProps {
  /** Start of the newest week shown (top of the feed) */
  anchorWeekStart: Date
  weekStartsOn: 0 | 1
}

export function WeekFeed({ anchorWeekStart, weekStartsOn }: WeekFeedProps) {
  const anchorKey = format(anchorWeekStart, 'yyyy-MM-dd')

  const { data: firstEntry, isLoading: firstLoading } = useQuery({
    queryKey: ['timeline', 'start'],
    queryFn: () => getTimelineStartFn(),
  })
  const firstEntryDate = firstEntry ? parseISO(firstEntry) : null

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery({
      queryKey: ['timeline', 'weeks', anchorKey, weekStartsOn],
      initialPageParam: 0,
      queryFn: async ({ pageParam }) => {
        const weekStart = subWeeks(anchorWeekStart, pageParam)
        const weekEnd = endOfWeek(weekStart, { weekStartsOn })
        const days = await getTimelineFn({
          data: {
            start: format(weekStart, 'yyyy-MM-dd'),
            end: format(weekEnd, 'yyyy-MM-dd'),
          },
        })
        return { weekStart, weekEnd, days }
      },
      getNextPageParam: (lastPage, allPages) => {
        // Stop once we've reached the week containing the first entry
        if (!firstEntryDate) return undefined
        if (lastPage.weekStart <= firstEntryDate) return undefined
        return allPages.length
      },
      enabled: !firstLoading,
    })

  // Load the next (older) week when the sentinel scrolls into view
  const sentinelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !hasNextPage) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) {
          void fetchNextPage()
        }
      },
      // Viewport root: works whichever ancestor (app <main>) does the scrolling
      { rootMargin: '600px 0px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  if (isLoading || firstLoading) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        Loading…
      </div>
    )
  }

  const today = startOfDay(new Date())

  return (
    <div className="space-y-4">
      {data?.pages.map((page) => {
        const days = eachDayOfInterval({
          start: page.weekStart,
          end: page.weekEnd,
        })
          // Hide future days and days before the user's first ever entry
          .filter((d) => !isAfter(startOfDay(d), today))
          .filter((d) => !firstEntryDate || !isBefore(d, firstEntryDate))
          .reverse()
        if (days.length === 0) return null
        const entryCount = Object.keys(page.days).length

        return (
          <section key={page.weekStart.toISOString()}>
            {/* Negative top cancels <main> padding (p-6 / md:p-8) so it pins flush.
                Pinned while scrolling through this week; the next week's
                header pushes it out because each is sticky within its section */}
            <div className="sticky -top-6 md:-top-8 z-20 -mx-4 mb-6 flex items-baseline gap-3 border-b bg-background/85 px-4 py-3 backdrop-blur-md">
              <h2 className="text-base font-semibold tracking-tight">
                {formatWeekRange(page.weekStart, page.weekEnd)}
              </h2>
              <span className="text-sm text-muted-foreground tabular-nums">
                {format(page.weekEnd, 'yyyy')}
              </span>
              <span className="ml-auto rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
                {entryCount} {entryCount === 1 ? 'entry day' : 'entry days'}
              </span>
            </div>
            <WeekList days={days} data={page.days} />
          </section>
        )
      })}

      <div ref={sentinelRef} className="py-6 text-center text-sm">
        {isFetchingNextPage ? (
          <span className="text-muted-foreground">Loading earlier weeks…</span>
        ) : hasNextPage ? (
          <button
            type="button"
            onClick={() => void fetchNextPage()}
            className="text-muted-foreground hover:text-foreground cursor-pointer"
          >
            Load earlier weeks
          </button>
        ) : (
          <span className="text-muted-foreground/70">
            {firstEntryDate
              ? `That's the beginning — your first entry was ${format(firstEntryDate, 'MMMM d, yyyy')}.`
              : 'No entries yet.'}
          </span>
        )}
      </div>
    </div>
  )
}
