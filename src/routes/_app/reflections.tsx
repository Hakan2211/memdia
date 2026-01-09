/**
 * Reflections Layout Route
 * Parent route for all /reflections/* routes
 * Contains the sidebar navigation and calendar view for 10-minute reflection sessions
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
import { Clock, MessageCircle } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../../components/ui/button'
import {
  getRecentReflectionsFn,
  getReflectionsForMonthFn,
} from '../../server/reflection.fn'
import { cn } from '../../lib/utils'
import {
  Calendar as CalendarComponent,
  CalendarDayButton,
} from '../../components/ui/calendar'

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
  // Use location/params to determine current date selection
  const params = useParams({ strict: false })
  const location = useLocation()

  // Parse currently selected date from URL
  const selectedDate = (() => {
    // If on /reflections/today, it's today
    if (location.pathname.endsWith('/today')) {
      return new Date()
    }
    // If on /reflections/YYYY-MM-DD
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

  const goToToday = () => {
    setCurrentMonth(new Date())
    navigate({ to: '/reflections/today' })
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
                navigate({ to: '/reflections/today' })
              } else {
                navigate({
                  to: '/reflections/$date',
                  params: { date: dateStr },
                })
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
                const { day } = props
                const date = day.date
                const dateStr = format(date, 'yyyy-MM-dd')
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
                              ? 'bg-stone-500' /* Stone/Neutral for reflections */
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
                <div className="h-10 w-10 rounded-md bg-stone-100 dark:bg-stone-800 flex items-center justify-center">
                  <MessageCircle className="h-4 w-4 text-stone-600 dark:text-stone-400" />
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
        // Stone/Neutral for completed reflections
        status === 'completed' && 'bg-stone-500',
        status === 'processing' && 'bg-stone-300 animate-pulse',
        status === 'active' && 'bg-stone-400 animate-pulse',
        status === 'paused' && 'bg-stone-200',
      )}
    />
  )
}
