/**
 * Memories Layout Route
 * Parent route for all /memories/* routes
 * Contains the sidebar navigation and calendar view
 */

import {
  Link,
  Outlet,
  createFileRoute,
  redirect,
  useLocation,
  useNavigate,
  useParams,
} from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Calendar, Clock, Home } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../../components/ui/button'
import {
  getRecentSessionsFn,
  getSessionsForMonthFn,
} from '../../server/session.fn'
import { cn } from '../../lib/utils'
import {
  Calendar as CalendarComponent,
  CalendarDayButton,
} from '../../components/ui/calendar'

export const Route = createFileRoute('/_app/memories')({
  component: MemoriesLayout,
  beforeLoad: async ({ location }) => {
    // Redirect /memories to /memories/today for default microphone view
    if (location.pathname === '/memories') {
      throw redirect({ to: '/memories/today' })
    }
  },
})

function MemoriesLayout() {
  const navigate = useNavigate()
  // Use location/params to determine current date selection
  const params = useParams({ strict: false })
  const location = useLocation()

  // Parse currently selected date from URL
  const selectedDate = (() => {
    // If on /memories/today, it's today
    if (location.pathname.endsWith('/today')) {
      return new Date()
    }
    // If on /memories/YYYY-MM-DD
    if (params.date) {
      const parsed = new Date(params.date)
      if (!isNaN(parsed.getTime())) return parsed
    }
    return undefined
  })()

  const [currentMonth, setCurrentMonth] = useState(
    () => selectedDate || new Date(),
  )

  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth() + 1

  // Fetch sessions for current month
  const { data: sessionsByDate } = useQuery({
    queryKey: ['sessions', 'month', year, month],
    queryFn: () => getSessionsForMonthFn({ data: { year, month } }),
  })

  // Fetch recent sessions for sidebar list
  const { data: recentSessions } = useQuery({
    queryKey: ['sessions', 'recent'],
    queryFn: () => getRecentSessionsFn({ data: { limit: 10 } }),
  })

  const goToToday = () => {
    setCurrentMonth(new Date())
    navigate({ to: '/memories/today' })
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] -m-6">
      {/* Sidebar */}
      <aside className="hidden w-80 shrink-0 border-r bg-muted/20 md:flex md:flex-col">
        {/* Calendar */}
        <div className="border-b p-4">
          <CalendarComponent
            mode="single"
            month={currentMonth}
            onMonthChange={setCurrentMonth}
            selected={selectedDate}
            onSelect={(date) => {
              if (!date) return // Prevent deselection
              const dateStr = format(date, 'yyyy-MM-dd')
              const today = format(new Date(), 'yyyy-MM-dd')
              const hasSession = !!(sessionsByDate || {})[dateStr]

              if (dateStr === today && !hasSession) {
                navigate({ to: '/memories/today' })
              } else {
                navigate({ to: '/memories/$date', params: { date: dateStr } })
              }
            }}
            className="w-full flex justify-center p-3 [--cell-size:2.6rem] md:[--cell-size:2.9rem]"
            classNames={{
              month: 'space-y-4 w-full',
              table: 'w-full border-collapse space-y-1',
              head_row: 'flex w-full justify-between',
              row: 'flex w-full mt-2 justify-between',
              cell: 'relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md',
            }}
            components={{
              DayButton: (props) => {
                const { day } = props // Extract day from props
                const date = day.date
                const dateStr = format(date, 'yyyy-MM-dd')
                // Safe access to sessionsByDate
                const session = sessionsByDate
                  ? sessionsByDate[dateStr]
                  : undefined
                const hasSession = !!session

                return (
                  <CalendarDayButton {...props}>
                    <div className="relative flex items-center justify-center w-full h-full">
                      {date.getDate()}
                      {hasSession && (
                        <span
                          className={cn(
                            'absolute bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full',
                            session?.status === 'completed'
                              ? 'bg-stone-500'
                              : 'bg-stone-300',
                          )}
                        />
                      )}
                    </div>
                  </CalendarDayButton>
                )
              },
            }}
          />
        </div>

        {/* Quick Actions */}
        <div className="border-b p-4">
          <Button
            onClick={goToToday}
            className="w-full justify-start gap-2 cursor-pointer"
            variant="premium"
            size="lg"
          >
            <Home className="h-4 w-4" />
            Start Memory
          </Button>
        </div>

        {/* Recent Sessions List */}
        <div className="flex-1 overflow-auto p-4">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
            Recent Memories
          </h3>
          <div className="space-y-2">
            {recentSessions?.sessions.map((session) => (
              <Link
                key={session.id}
                to="/memories/$date"
                params={{ date: format(new Date(session.date), 'yyyy-MM-dd') }}
                className={cn(
                  'flex items-center gap-3 rounded-lg p-2 text-sm transition-colors',
                  'hover:bg-accent hover:text-accent-foreground',
                  '[&.active]:bg-accent [&.active]:text-accent-foreground',
                )}
              >
                {session.imageUrl ? (
                  <img
                    src={session.imageUrl}
                    alt=""
                    className="h-10 w-10 rounded-md object-cover"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
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
                No memories yet. Start your first session today!
              </p>
            )}
          </div>
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
 * Session Status Dot
 */
function SessionStatusDot({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'h-2 w-2 rounded-full',
        status === 'completed' && 'bg-stone-500',
        status === 'processing' && 'bg-stone-300 animate-pulse',
        status === 'active' && 'bg-stone-400 animate-pulse',
        status === 'paused' && 'bg-stone-200',
      )}
    />
  )
}
