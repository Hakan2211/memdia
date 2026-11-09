/**
 * Subscribe Page (Paywall) - Standalone Route
 *
 * This is NOT under _auth layout because logged-in users without subscription
 * need to access this page. The _auth layout redirects logged-in users to /conversations.
 *
 * For users who:
 * - Created an account but didn't complete payment
 * - Had their subscription canceled/expired
 * - Need to resubscribe
 */

import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import { AlertCircle, ChevronLeft } from 'lucide-react'
import { z } from 'zod'
import { getSessionFn } from '../server/auth.fn'
import { createCheckoutFn } from '../server/billing.fn'
import { SUBSCRIPTION_TIERS, formatEuro } from '../types/subscription'
import { PlanCard } from '../components/billing/plan-card'
import { Button } from '../components/ui/button'

const subscribeSearchSchema = z.object({
  canceled: z.string().optional(),
})

export const Route = createFileRoute('/subscribe')({
  validateSearch: subscribeSearchSchema,
  beforeLoad: async () => {
    // Check if user is logged in
    const session = await getSessionFn()
    if (!session?.user) {
      // Not logged in - redirect to signup
      throw redirect({ to: '/signup' })
    }
    // User is logged in - allow access to subscribe page
    // (they need to pay to get access to the app)
    return { user: session.user }
  },
  component: SubscribePage,
})

function SubscribePage() {
  const { canceled } = Route.useSearch()

  const checkoutMutation = useMutation({
    mutationFn: () =>
      createCheckoutFn({
        data: {
          isNewUser: true, // Will redirect to onboarding after success
        },
      }),
    onSuccess: (result) => {
      window.location.href = result.url
    },
  })

  return (
    <div className="min-h-screen bg-muted/40 px-4 py-8">
      {/* Back button */}
      <div className="max-w-4xl mx-auto mb-8">
        <Link to="/">
          <Button
            variant="ghost"
            className="gap-2 text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Home
          </Button>
        </Link>
      </div>

      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight bg-linear-to-r from-[#5a7ba6] to-[#7e9ec9] bg-clip-text text-transparent">
            Subscribe to Memdia
          </h1>
          <p className="mt-2 text-muted-foreground">
            Start your daily conversations with an AI that remembers you
          </p>
        </div>

        {canceled && (
          <div className="flex items-center gap-2 p-4 rounded-lg bg-amber-500/10 text-amber-600 border border-amber-500/20">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p>Your checkout was canceled. You can try again below.</p>
          </div>
        )}

        {/* Plan */}
        <PlanCard />

        {/* Subscribe Button */}
        <div className="flex flex-col items-center gap-4">
          <Button
            size="lg"
            className="w-full max-w-md bg-linear-to-r from-[#7e9ec9] to-[#5a7ba6] hover:opacity-90 transition-opacity text-white border-0"
            onClick={() => checkoutMutation.mutate()}
            disabled={checkoutMutation.isPending}
          >
            {checkoutMutation.isPending
              ? 'Redirecting to checkout...'
              : `Subscribe to ${SUBSCRIPTION_TIERS.pro.name} - ${formatEuro(SUBSCRIPTION_TIERS.pro.priceMonthly)}/mo`}
          </Button>

          <p className="text-xs text-center text-muted-foreground max-w-md">
            You will be redirected to Stripe for secure payment. Cancel anytime
            from your profile settings.
          </p>
        </div>

        {checkoutMutation.error && (
          <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm text-center">
            {checkoutMutation.error.message ||
              'Failed to create checkout session. Please try again.'}
          </div>
        )}
      </div>
    </div>
  )
}
