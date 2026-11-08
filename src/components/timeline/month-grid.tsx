/**
 * Month Grid
 * Calendar-aligned 7-column collage of daily images
 */

import { format, isSameDay, isSameMonth } from 'date-fns'
import { DayTile } from './day-tile'
import type { TimelineData } from '../../server/timeline.fn'

interface MonthGridProps {
  /** Every day shown in the grid (full weeks covering the month) */
  days: Array<Date>
  /** Any date inside the month being displayed */
  month: Date
  data?: TimelineData
}

export function MonthGrid({ days, month, data }: MonthGridProps) {
  const today = new Date()
  const weekdayLabels = days.slice(0, 7).map((d) => format(d, 'EEEEEE'))

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {weekdayLabels.map((label) => (
          <div
            key={label}
            className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider"
          >
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {days.map((date) => {
          const dateKey = format(date, 'yyyy-MM-dd')
          return (
            <DayTile
              key={dateKey}
              date={date}
              dateKey={dateKey}
              day={data?.[dateKey]}
              inRange={isSameMonth(date, month)}
              isToday={isSameDay(date, today)}
            />
          )
        })}
      </div>
    </div>
  )
}
