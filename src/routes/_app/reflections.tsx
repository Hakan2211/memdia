/**
 * Reflections Layout Route
 * Parent route for all /reflections/* routes
 * Contains the sidebar navigation and calendar view for 10-minute reflection sessions
 */

import {
  createFileRoute,
  Outlet,
  Link,
  useNavigate,
  redirect,
} from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import {
  Clock,
  MessageCircle,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useState } from 'react'
import { Button } from '../../components/ui/button'
import {
  getReflectionsForMonthFn,
  getRecentReflectionsFn,
} from '../../server/reflection.fn'
import { cn } from '../../lib/utils'

export const Route = createFileRoute('/_app/reflections')({
  component: ReflectionsLayout,
  beforeLoad: async ({ location }) => {
    // Redirect /reflections to /reflections/today for default view
    if (location.pathname === '/reflections') {
      throw redirect({ to: '/reflections/today' })
    }
  },
})

function ReflectionsLayout() {
  const navigate = useNavigate()
  const [currentMonth, setCurrentMonth] = useState(() => new Date())

  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth() + 1

  // Fetch reflections for current month
  const { data: sessionsByDate } = useQuery({
    queryKey: ['reflections', 'month', year, month],
    queryFn: () => getReflectionsForMonthFn({ data: { year, month } }),
  })

  // Fetch recent reflections for sidebar list
  const { data: recentSessions } = useQuery({
    queryKey: ['reflections', 'recent'],
    queryFn: () => getRecentReflectionsFn({ data: { limit: 10 } }),
  })

  const goToPrevMonth = () => {
    setCurrentMonth(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1),
    )
  }

  const goToNextMonth = () => {
    setCurrentMonth(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1),
    )
  }

  const goToToday = () => {
    setCurrentMonth(new Date())
    navigate({ to: '/reflections/today' })
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] -m-6">
      {/* Sidebar */}
      <aside className="hidden w-80 shrink-0 border-r bg-muted/20 md:flex md:flex-col">
        {/* Mini Calendar */}
        <div className="border-b p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sm">
              {format(currentMonth, 'MMMM yyyy')}
            </h2>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={goToPrevMonth}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={goToNextMonth}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <MiniCalendar
            year={year}
            month={month}
            sessionsByDate={sessionsByDate || {}}
            onSelectDate={(date) => {
              const today = format(new Date(), 'yyyy-MM-dd')
              const hasSession = !!(sessionsByDate || {})[date]

              // If clicking today and no session exists, go to recording page
              if (date === today && !hasSession) {
                navigate({ to: '/reflections/today' })
              } else {
                navigate({ to: '/reflections/$date', params: { date } })
              }
            }}
          />
        </div>

        {/* Quick Actions */}
        <div className="border-b p-4">
          <Button
            onClick={goToToday}
            className="w-full justify-start gap-2"
            variant="default"
          >
            <MessageCircle className="h-4 w-4" />
            Start Reflection
          </Button>
        </div>

        {/* Recent Reflections List */}
        <div className="flex-1 overflow-auto p-4">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
            Recent Reflections
          </h3>
          <div className="space-y-2">
            {recentSessions?.sessions.map((session) => (
              <Link
                key={session.id}
                to="/reflections/$date"
                params={{ date: format(new Date(session.date), 'yyyy-MM-dd') }}
                className={cn(
                  'flex items-center gap-3 rounded-lg p-2 text-sm transition-colors',
                  'hover:bg-accent hover:text-accent-foreground',
                  '[&.active]:bg-accent [&.active]:text-accent-foreground',
                )}
              >
                {/* Icon instead of image for reflections */}
                <div className="h-10 w-10 rounded-md bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                  <MessageCircle className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    {format(new Date(session.date), 'MMM d, yyyy')}
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {Math.floor(session.totalUserSpeakingTime / 60)}:
                    {String(session.totalUserSpeakingTime % 60).padStart(
                      2,
                      '0',
                    )}
                  </p>
                </div>
                <SessionStatusDot status={session.status} />
              </Link>
            ))}
            {(!recentSessions?.sessions ||
              recentSessions.sessions.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No reflections yet. Start your first session today!
              </p>
            )}
          </div>
        </div>

        {/* Settings Link */}
        <div className="border-t p-4">
          <Link
            to="/profile"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}

/**
 * Mini Calendar Component
 * Uses purple dots for reflections (different from memories' green)
 */
function MiniCalendar({
  year,
  month,
  sessionsByDate,
  onSelectDate,
}: {
  year: number
  month: number
  sessionsByDate: Record<string, { id: string; status: string }>
  onSelectDate: (date: string) => void
}) {
  const firstDay = new Date(year, month - 1, 1)
  const lastDay = new Date(year, month, 0)
  const startPadding = firstDay.getDay() // 0 = Sunday
  const daysInMonth = lastDay.getDate()
  const today = format(new Date(), 'yyyy-MM-dd')

  const days = []

  // Add empty cells for padding
  for (let i = 0; i < startPadding; i++) {
    days.push(<div key={`pad-${i}`} className="h-8 w-8" />)
  }

  // Add day cells
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const session = sessionsByDate[dateStr]
    const isToday = dateStr === today
    const hasSession = !!session

    days.push(
      <button
        key={day}
        onClick={() => onSelectDate(dateStr)}
        className={cn(
          'h-8 w-8 rounded-full text-sm relative transition-colors',
          'hover:bg-accent hover:text-accent-foreground',
          isToday && 'ring-1 ring-primary',
          hasSession && session.status === 'completed' && 'font-medium',
        )}
      >
        {day}
        {hasSession && (
          <span
            className={cn(
              'absolute bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full',
              // Purple for reflections (different from memories' green)
              session.status === 'completed' ? 'bg-violet-500' : 'bg-amber-500',
            )}
          />
        )}
      </button>,
    )
  }

  return (
    <div className="grid grid-cols-7 gap-1 text-center">
      {/* Day headers */}
      {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
        <div
          key={d}
          className="h-8 w-8 text-xs text-muted-foreground flex items-center justify-center"
        >
          {d}
        </div>
      ))}
      {days}
    </div>
  )
}

/**
 * Session Status Dot
 */
function SessionStatusDot({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'h-2 w-2 rounded-full',
        // Purple for completed reflections
        status === 'completed' && 'bg-violet-500',
        status === 'processing' && 'bg-amber-500 animate-pulse',
        status === 'active' && 'bg-blue-500 animate-pulse',
        status === 'paused' && 'bg-gray-400',
      )}
    />
  )
}
