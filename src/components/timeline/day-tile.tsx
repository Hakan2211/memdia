/**
 * Day Tile
 * One square in the month collage: memory image as the main picture,
 * reflection image as a corner thumbnail when both exist.
 */

import { Link } from '@tanstack/react-router'
import { MessageCircle, Mic, Plus } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Skeleton } from '../ui/skeleton'
import type { TimelineDay } from '../../server/timeline.fn'

interface DayTileProps {
  date: Date
  dateKey: string
  day?: TimelineDay
  inRange: boolean
  isToday: boolean
}

export function DayTile({
  date,
  dateKey,
  day,
  inRange,
  isToday,
}: DayTileProps) {
  const memory = day?.memory
  const reflection = day?.reflection
  const dayNumber = date.getDate()

  // Empty day
  if (!memory && !reflection) {
    const base = cn(
      'relative aspect-square rounded-lg bg-muted/40 flex items-start justify-start p-1.5 text-xs text-muted-foreground',
      !inRange && 'opacity-40',
      isToday && 'ring-2 ring-primary/40',
    )
    if (isToday) {
      return (
        <Link
          to="/memories/today"
          className={cn(base, 'hover:bg-muted transition-colors group')}
          title="Record today's memory"
        >
          <span className="font-medium">{dayNumber}</span>
          <Plus className="absolute inset-0 m-auto h-5 w-5 opacity-50 group-hover:opacity-100 transition-opacity" />
        </Link>
      )
    }
    return (
      <div className={base}>
        <span>{dayNumber}</span>
      </div>
    )
  }

  // Main picture: memory if present, otherwise reflection
  const main = memory
    ? { kind: 'memory' as const, imageUrl: memory.imageUrl, generating: false }
    : {
        kind: 'reflection' as const,
        imageUrl: reflection!.imageUrl,
        generating: reflection!.imageStatus === 'generating',
      }
  const showReflectionThumb = !!memory && !!reflection

  const linkProps =
    main.kind === 'memory'
      ? ({ to: '/memories/$date', params: { date: dateKey } } as const)
      : ({ to: '/reflections/$date', params: { date: dateKey } } as const)

  return (
    <div
      className={cn(
        'relative aspect-square rounded-lg overflow-hidden bg-muted group',
        !inRange && 'opacity-40',
        isToday && 'ring-2 ring-primary/40',
      )}
    >
      <Link {...linkProps} className="absolute inset-0">
        {main.imageUrl ? (
          <img
            src={main.imageUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : main.generating ? (
          <Skeleton className="h-full w-full rounded-none" />
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            {main.kind === 'memory' ? (
              <Mic className="h-5 w-5 text-muted-foreground" />
            ) : (
              <MessageCircle className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        )}
        <span className="absolute top-1 left-1.5 text-xs font-medium text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
          {dayNumber}
        </span>
      </Link>

      {showReflectionThumb && (
        <Link
          to="/reflections/$date"
          params={{ date: dateKey }}
          title="Reflection"
          className="absolute bottom-1 right-1 h-1/3 w-1/3 min-h-5 min-w-5 rounded-md overflow-hidden ring-2 ring-background bg-muted"
        >
          {reflection.imageUrl ? (
            <img
              src={reflection.imageUrl}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : reflection.imageStatus === 'generating' ? (
            <Skeleton className="h-full w-full rounded-none" />
          ) : (
            <div className="h-full w-full flex items-center justify-center">
              <MessageCircle className="h-3 w-3 text-muted-foreground" />
            </div>
          )}
        </Link>
      )}

      {!showReflectionThumb && main.kind === 'reflection' && (
        <span className="absolute bottom-1 right-1 rounded-full bg-background/80 p-1">
          <MessageCircle className="h-3 w-3" />
        </span>
      )}
    </div>
  )
}
