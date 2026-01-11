/**
 * Insights Layout Route
 * Main layout with tab navigation for insights
 * PRO-ONLY: Requires Pro subscription tier
 */

import {
  Link,
  Outlet,
  createFileRoute,
  useLocation,
} from '@tanstack/react-router'
import {
  CheckSquare,
  LayoutDashboard,
  Lightbulb,
  Smile,
  Tag,
  Users,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { ProFeatureGate } from '../../components/upgrade-modal'

export const Route = createFileRoute('/_app/insights')({
  component: InsightsLayoutWrapper,
})

/**
 * Wrapper component that checks subscription tier
 */
function InsightsLayoutWrapper() {
  const { subscription } = Route.useRouteContext()

  return (
    <ProFeatureGate
      subscriptionTier={subscription?.tier ?? null}
      featureName="Insights"
    >
      <InsightsLayout />
    </ProFeatureGate>
  )
}

const TABS = [
  { path: '/insights', label: 'Overview', icon: LayoutDashboard },
  { path: '/insights/todos', label: 'Todos', icon: CheckSquare },
  { path: '/insights/people', label: 'People', icon: Users },
  { path: '/insights/moods', label: 'Moods', icon: Smile },
  { path: '/insights/topics', label: 'Topics', icon: Tag },
  { path: '/insights/insights', label: 'Insights', icon: Lightbulb },
] as const

function InsightsLayout() {
  const location = useLocation()

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <h1 className="text-2xl font-bold tracking-tight">Insights</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Discover patterns from your reflections
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b px-6">
        <nav className="flex gap-1 -mb-px overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive =
              tab.path === '/insights'
                ? location.pathname === '/insights'
                : location.pathname.startsWith(tab.path)

            return (
              <Link
                key={tab.path}
                to={tab.path}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                  isActive
                    ? 'border-[#7e9ec9] text-[#7e9ec9]'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
                )}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  )
}
