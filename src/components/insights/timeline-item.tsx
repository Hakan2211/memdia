/**
 * Timeline Item Component
 * Displays a reflection entry in timeline format
 */

import { cn } from '../../lib/utils'
import { MoodBadge, MoodDot } from './mood-badge'
import { TopicPill } from './topic-pill'
import type { Mood } from '../../types/insights'
import { Link } from '@tanstack/react-router'
import { format } from 'date-fns'

interface TimelineItemProps {
  date: Date
  mood: Mood
  topics: string[]
  summaryPreview?: string
  onClick?: () => void
  className?: string
}

export function TimelineItem({
  date,
  mood,
  topics,
  summaryPreview,
  onClick,
  className,
}: TimelineItemProps) {
  const dateStr = format(date, 'yyyy-MM-dd')

  return (
    <div
      className={cn(
        'relative flex gap-4 pb-6 group',
        onClick && 'cursor-pointer',
        className,
      )}
      onClick={onClick}
    >
      {/* Timeline line */}
      <div className="absolute left-[11px] top-6 bottom-0 w-px bg-border group-last:hidden" />

      {/* Mood dot */}
      <div className="relative z-10 mt-1.5">
        <MoodDot mood={mood} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Link
            to="/reflections/$date"
            params={{ date: dateStr }}
            className="text-sm font-medium hover:underline"
          >
            {format(date, 'EEEE, MMM d')}
          </Link>
          <MoodBadge mood={mood} size="sm" showEmoji={false} />
        </div>

        {topics.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {topics.slice(0, 3).map((topic) => (
              <TopicPill key={topic} topic={topic} size="sm" />
            ))}
            {topics.length > 3 && (
              <span className="text-xs text-muted-foreground">
                +{topics.length - 3} more
              </span>
            )}
          </div>
        )}

        {summaryPreview && (
          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
            {summaryPreview}
          </p>
        )}
      </div>
    </div>
  )
}

// Compact timeline for sidebar/overview
interface TimelineCompactProps {
  items: Array<{
    date: Date
    mood: Mood
    sessionId: string
  }>
  maxItems?: number
  className?: string
}

export function TimelineCompact({
  items,
  maxItems = 5,
  className,
}: TimelineCompactProps) {
  const visibleItems = items.slice(0, maxItems)

  return (
    <div className={cn('space-y-2', className)}>
      {visibleItems.map((item) => {
        const dateStr = format(item.date, 'yyyy-MM-dd')
        return (
          <Link
            key={item.sessionId}
            to="/reflections/$date"
            params={{ date: dateStr }}
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
          >
            <MoodDot mood={item.mood} />
            <span className="text-sm">{format(item.date, 'MMM d')}</span>
            <span className="text-sm text-muted-foreground capitalize">
              {item.mood}
            </span>
          </Link>
        )
      })}
    </div>
  )
}
