/**
 * Subscribe Page (Paywall) - Standalone Route
 *
 * This is NOT under _auth layout because logged-in users without subscription
 * need to access this page. The _auth layout redirects logged-in users to /memories.
 *
 * For users who:
 * - Created an account but didn't complete payment
 * - Had their subscription canceled/expired
 * - Need to resubscribe
 */

import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { AlertCircle, Check, ChevronLeft } from 'lucide-react'
import { z } from 'zod'
import { getSessionFn } from '../server/auth.fn'
import { createCheckoutFn } from '../server/billing.fn'
import { SUBSCRIPTION_TIERS } from '../types/subscription'
import { Button } from '../components/ui/button'
import type { SubscriptionTier } from '../types/subscription'

const subscribeSearchSchema = z.object({
  tier: z.enum(['starter', 'pro']).optional().default('starter'),
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
  const { tier: initialTier, canceled } = Route.useSearch()
  const [selectedTier, setSelectedTier] =
    useState<SubscriptionTier>(initialTier)

  const checkoutMutation = useMutation({
    mutationFn: (tier: SubscriptionTier) =>
      createCheckoutFn({
        data: {
          tier,
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
            Choose Your Plan
          </h1>
          <p className="mt-2 text-muted-foreground">
            Subscribe to start your daily voice journaling journey
          </p>
        </div>

        {canceled && (
          <div className="flex items-center gap-2 p-4 rounded-lg bg-amber-500/10 text-amber-600 border border-amber-500/20">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p>Your checkout was canceled. Select a plan to try again.</p>
          </div>
        )}

        {/* Tier Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {(['starter', 'pro'] as const).map((tier) => {
            const tierInfo = SUBSCRIPTION_TIERS[tier]
            const isSelected = selectedTier === tier

            return (
              <button
                key={tier}
                type="button"
                onClick={() => setSelectedTier(tier)}
                className={`relative p-6 rounded-xl border-2 text-left transition-all ${
                  isSelected
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                    : 'border-muted hover:border-primary/30 hover:bg-accent/50'
                }`}
              >
                {tier === 'pro' && (
                  <div className="absolute -top-3 right-4 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                    Best Value
                  </div>
                )}

                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-semibold">{tierInfo.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {tierInfo.description}
                    </p>
                  </div>
                  <div
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                      isSelected ? 'border-primary bg-primary' : 'border-muted'
                    }`}
                  >
                    {isSelected && (
                      <Check className="w-4 h-4 text-primary-foreground" />
                    )}
                  </div>
                </div>

                <div className="mb-6">
                  <span className="text-4xl font-bold">
                    ${tierInfo.priceMonthly}
                  </span>
                  <span className="text-muted-foreground">/month</span>
                </div>

                <ul className="space-y-3">
                  {tierInfo.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </button>
            )
          })}
        </div>

        {/* Subscribe Button */}
        <div className="flex flex-col items-center gap-4">
          <Button
            size="lg"
            className="w-full max-w-md bg-linear-to-r from-[#7e9ec9] to-[#5a7ba6] hover:opacity-90 transition-opacity text-white border-0"
            onClick={() => checkoutMutation.mutate(selectedTier)}
            disabled={checkoutMutation.isPending}
          >
            {checkoutMutation.isPending
              ? 'Redirecting to checkout...'
              : `Subscribe to ${SUBSCRIPTION_TIERS[selectedTier].name} - $${SUBSCRIPTION_TIERS[selectedTier].priceMonthly}/mo`}
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
