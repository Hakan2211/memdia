import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { getSessionFn } from '../server/auth.fn'
import { useSession } from '../lib/auth-client'
import {
  getOnboardingStatusFn,
  getSubscriptionStatusFn,
} from '../server/session.fn'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '../components/ui/sidebar'
import { AppSidebar } from '../components/app-sidebar'
import { Separator } from '../components/ui/separator'

// Type for the user from Better-Auth session
interface AppUser {
  id: string
  email: string
  name: string | null
  image?: string | null
  emailVerified: boolean
  role?: string
  onboardingComplete?: boolean
}

// Type for subscription info passed through context
interface SubscriptionInfo {
  tier: string | null
  status: 'active' | 'canceled' | 'past_due' | 'none'
  periodEnd: Date | null
  cancelAtPeriodEnd: boolean
}

/**
 * Protected App Layout
 * Requires:
 * 1. Authentication - redirects to /login if not authenticated
 * 2. Active subscription - redirects to /subscribe if not subscribed
 * 3. Completed onboarding - redirects to /onboarding if not complete
 */
export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ location }) => {
    // Check authentication
    const session = await getSessionFn()
    if (!session?.user) {
      throw redirect({ to: '/login' })
    }

    // Initialize subscription info
    let subscription: SubscriptionInfo = {
      tier: null,
      status: 'none',
      periodEnd: null,
      cancelAtPeriodEnd: false,
    }

    // Check subscription (but not on onboarding page - user just paid and needs to complete onboarding)
    if (!location.pathname.includes('/onboarding')) {
      const subscriptionStatus = await getSubscriptionStatusFn()

      // Update subscription info
      subscription = {
        tier: subscriptionStatus.tier,
        status: subscriptionStatus.status,
        periodEnd: subscriptionStatus.periodEnd,
        cancelAtPeriodEnd: subscriptionStatus.cancelAtPeriodEnd,
      }

      // If not subscribed, redirect to paywall
      if (!subscriptionStatus.isSubscribed) {
        throw redirect({ to: '/subscribe' })
      }
    }

    // Check if user needs onboarding (but not if already on onboarding page)
    if (!location.pathname.includes('/onboarding')) {
      const onboardingStatus = await getOnboardingStatusFn()
      if (!onboardingStatus.onboardingComplete) {
        throw redirect({ to: '/onboarding' })
      }
    }

    return { user: session.user as AppUser, subscription }
  },
  component: AppLayout,
})

function AppLayout() {
  const routeContext = Route.useRouteContext()
  const { data: session } = useSession()

  // User from session takes precedence, fallback to route context
  const sessionUser = session?.user as AppUser | undefined
  const user = sessionUser ?? routeContext.user
  const subscription = routeContext.subscription

  return (
    <SidebarProvider>
      <AppSidebar user={user} subscriptionTier={subscription?.tier ?? null} />
      <SidebarInset>
        <div className="flex flex-1 flex-col overflow-hidden h-full">
          {/* Header with Sidebar Trigger */}
          <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-background/60 backdrop-blur-md px-4 sticky top-0 z-10 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
            <div className="flex items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 overflow-auto bg-muted/5 p-6 md:p-8">
            <Outlet />
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
