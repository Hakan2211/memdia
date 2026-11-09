/**
 * Week List
 * Day-by-day timeline rail: date block | line + dot | images & summaries
 */

import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { format, isSameDay } from 'date-fns'
import { ChevronDown, MessageCircle, Mic, Plus } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Skeleton } from '../ui/skeleton'
import { MoodBadge } from '../insights/mood-badge'
import type { TimelineData, TimelineDay } from '../../server/timeline.fn'

interface WeekListProps {
  /** Days to render, in display order (the feed passes newest first) */
  days: Array<Date>
  data?: TimelineData
}

export function WeekList({ days, data }: WeekListProps) {
  const today = new Date()

  return (
    <ol>
      {days.map((date, i) => {
        const dateKey = format(date, 'yyyy-MM-dd')
        return (
          <WeekDay
            key={dateKey}
            date={date}
            dateKey={dateKey}
            day={data?.[dateKey]}
            isToday={isSameDay(date, today)}
            isFirst={i === 0}
            isLast={i === days.length - 1}
          />
        )
      })}
    </ol>
  )
}

interface WeekDayProps {
  date: Date
  dateKey: string
  day?: TimelineDay
  isToday: boolean
  isFirst: boolean
  isLast: boolean
}

/*
 * Vertical position of the dot: the centre of the day number in the date
 * column (weekday label ≈ 1rem + gap 0.25rem + half of the 1.75rem number).
 * Line segments and the dot both use it so they always meet exactly.
 */
const DOT_Y = '2.1rem'

function WeekDay({
  date,
  dateKey,
  day,
  isToday,
  isFirst,
  isLast,
}: WeekDayProps) {
  const memory = day?.memory
  const reflection = day?.reflection
  const isEmpty = !memory && !reflection

  return (
    <li className="grid grid-cols-[2.75rem_1.5rem_minmax(0,1fr)] gap-x-3 sm:grid-cols-[3.25rem_2rem_minmax(0,1fr)] sm:gap-x-5">
      {/* Date block */}
      <div className="pt-1 text-right">
        <div
          className={cn(
            'text-[11px] font-semibold uppercase leading-4 tracking-[0.14em]',
            isToday ? 'text-[#5a7ba6]' : 'text-muted-foreground',
          )}
        >
          {format(date, 'EEE')}
        </div>
        <div
          className={cn(
            'mt-1 text-[1.75rem] font-semibold leading-7 tabular-nums tracking-tight',
            isEmpty && !isToday && 'text-muted-foreground/50',
            isToday && 'text-[#5a7ba6]',
          )}
        >
          {format(date, 'd')}
        </div>
        {isToday && (
          <div className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#5a7ba6]">
            Today
          </div>
        )}
      </div>

      {/* Rail: line segment + dot */}
      <div className="relative" aria-hidden>
        {/* Segment above the dot (hidden for the first day) */}
        {!isFirst && (
          <span
            className="absolute left-1/2 top-0 w-px -translate-x-1/2 bg-[#7e9ec9]/30"
            style={{ height: DOT_Y }}
          />
        )}
        {/* Segment below the dot (hidden for the last day) */}
        {!isLast && (
          <span
            className="absolute bottom-0 left-1/2 w-px -translate-x-1/2 bg-[#7e9ec9]/30"
            style={{ top: DOT_Y }}
          />
        )}
        <span
          className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ top: DOT_Y }}
        >
          <TimelineDot isEmpty={isEmpty} isToday={isToday} />
        </span>
      </div>

      {/* Content */}
      <div className={cn(isEmpty ? 'pb-6 pt-[1.45rem]' : 'pb-12 pt-1')}>
        {isEmpty ? (
          isToday ? (
            <Link
              to="/conversations/today"
              className="-mt-2.5 flex items-center gap-2 rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-[#7e9ec9]/60 hover:bg-[#7e9ec9]/5 hover:text-foreground"
            >
              <Plus className="h-4 w-4" />
              Start today's conversation
            </Link>
          ) : (
            <p className="text-sm leading-5 text-muted-foreground/60">
              No entry
            </p>
          )
        ) : (
          <div className="space-y-4">
            <div
              className={cn(
                'grid gap-3',
                memory && reflection ? 'grid-cols-2' : 'grid-cols-1',
              )}
            >
              {memory && (
                <WeekImage
                  to="/memories/$date"
                  dateKey={dateKey}
                  imageUrl={memory.imageUrl}
                  generating={false}
                  kind="memory"
                  wide={!reflection}
                />
              )}
              {reflection && (
                <WeekImage
                  to="/conversations/$date"
                  dateKey={dateKey}
                  imageUrl={reflection.imageUrl}
                  generating={reflection.imageStatus === 'generating'}
                  kind="reflection"
                  wide={!memory}
                  badge={
                    reflection.mood ? (
                      <MoodBadge
                        mood={reflection.mood}
                        size="sm"
                        className="shadow-sm"
                      />
                    ) : null
                  }
                />
              )}
            </div>

            {(memory?.summaryText || reflection?.summaryText) && (
              <div className="space-y-3">
                {memory?.summaryText && (
                  <CollapsibleSummary
                    label="Memory"
                    text={memory.summaryText}
                  />
                )}
                {reflection?.summaryText && (
                  <CollapsibleSummary
                    label="Conversation"
                    text={reflection.summaryText}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </li>
  )
}

function TimelineDot({
  isEmpty,
  isToday,
}: {
  isEmpty: boolean
  isToday: boolean
}) {
  if (isToday) {
    // Pulsing ring draws the eye to today, filled or not
    return (
      <span className="relative flex h-4 w-4 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-[#7e9ec9]/40" />
        <span className="relative h-4 w-4 rounded-full border-[3px] border-background bg-[#5a7ba6] shadow-[0_0_0_2px_#7e9ec9]" />
      </span>
    )
  }
  if (isEmpty) {
    return (
      <span className="block h-2.5 w-2.5 rounded-full border-[1.5px] border-[#7e9ec9]/50 bg-background" />
    )
  }
  // Day with entries: solid dot with a soft halo
  return (
    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#7e9ec9]/20 ring-4 ring-background">
      <span className="h-2.5 w-2.5 rounded-full bg-[#5a7ba6]" />
    </span>
  )
}

interface WeekImageProps {
  to: '/memories/$date' | '/conversations/$date'
  dateKey: string
  imageUrl: string | null
  generating: boolean
  kind: 'memory' | 'reflection'
  /** Only image of the day: render wider */
  wide: boolean
  badge?: React.ReactNode
}

function WeekImage({
  to,
  dateKey,
  imageUrl,
  generating,
  kind,
  wide,
  badge,
}: WeekImageProps) {
  const Icon = kind === 'memory' ? Mic : MessageCircle
  return (
    <Link
      to={to}
      params={{ date: dateKey }}
      className={cn(
        'group relative block overflow-hidden rounded-xl bg-muted shadow-sm ring-1 ring-black/5',
        wide ? 'aspect-[2/1]' : 'aspect-[4/3]',
      )}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
      ) : generating ? (
        <Skeleton className="h-full w-full rounded-none" />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <Icon className="h-6 w-6 text-muted-foreground" />
        </div>
      )}
      <span className="absolute bottom-2.5 left-2.5 flex items-center gap-1 rounded-full bg-background/85 px-2 py-0.5 text-[11px] font-medium shadow-sm backdrop-blur-sm">
        <Icon className="h-3 w-3" />
        {kind === 'memory' ? 'Check-in' : 'Conversation'}
      </span>
      {badge && <span className="absolute right-2.5 top-2.5">{badge}</span>}
    </Link>
  )
}

function CollapsibleSummary({ label, text }: { label: string; text: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
      >
        {label} summary
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>
      <p
        className={cn(
          'mt-1.5 whitespace-pre-line text-sm leading-relaxed text-foreground/75',
          !open && 'line-clamp-2',
        )}
      >
        {text}
      </p>
    </div>
  )
}
