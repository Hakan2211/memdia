/**
 * Upgrade Modal Component
 * Shows when Starter tier users try to access Pro-only features (Reflections, Insights)
 */

import { useMutation } from '@tanstack/react-query'
import { Check, Crown, Lock, Sparkles } from 'lucide-react'
import { createUpgradeFn } from '../server/billing.fn'
import { SUBSCRIPTION_TIERS } from '../types/subscription'
import { Button } from './ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'

interface UpgradeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  featureName: string // e.g., "Reflections", "Insights"
}

export function UpgradeModal({
  open,
  onOpenChange,
  featureName,
}: UpgradeModalProps) {
  const upgradeMutation = useMutation({
    mutationFn: () => createUpgradeFn(),
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url
      }
    },
  })

  const proTier = SUBSCRIPTION_TIERS.pro

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton={true}>
        <DialogHeader className="text-center sm:text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-linear-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/30">
            <Crown className="h-8 w-8 text-blue-500" />
          </div>
          <DialogTitle className="text-xl">Upgrade to Pro</DialogTitle>
          <DialogDescription className="text-base">
            {featureName} is a Pro feature. Upgrade to unlock deeper
            conversations and insights.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Price */}
          <div className="text-center">
            <span className="text-4xl font-bold">${proTier.priceMonthly}</span>
            <span className="text-muted-foreground">/month</span>
          </div>

          {/* Features */}
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500/10">
                <Check className="h-3 w-3 text-blue-500" />
              </div>
              <div>
                <p className="font-medium">10-minute voice sessions</p>
                <p className="text-sm text-muted-foreground">
                  Extended daily check-ins for deeper reflection
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500/10">
                <Check className="h-3 w-3 text-blue-500" />
              </div>
              <div>
                <p className="font-medium">Therapeutic Reflections</p>
                <p className="text-sm text-muted-foreground">
                  10-minute guided conversations for personal growth
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500/10">
                <Check className="h-3 w-3 text-blue-500" />
              </div>
              <div>
                <p className="font-medium">Insights Dashboard</p>
                <p className="text-sm text-muted-foreground">
                  Track moods, topics, people, and personal patterns
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-500/10">
                <Check className="h-3 w-3 text-blue-500" />
              </div>
              <div>
                <p className="font-medium">Priority Support</p>
                <p className="text-sm text-muted-foreground">
                  Get help when you need it
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Button
            onClick={() => upgradeMutation.mutate()}
            disabled={upgradeMutation.isPending}
            className="w-full bg-linear-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600"
            size="lg"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            {upgradeMutation.isPending ? 'Processing...' : 'Upgrade to Pro'}
          </Button>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="w-full"
          >
            Maybe Later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Pro Feature Gate Component
 * Wraps content that should only be visible to Pro users
 * Shows upgrade modal overlay for Starter users
 */
interface ProFeatureGateProps {
  children: React.ReactNode
  subscriptionTier: string | null
  featureName: string
  className?: string
}

export function ProFeatureGate({
  children,
  subscriptionTier,
  featureName,
  className,
}: ProFeatureGateProps) {
  const isPro = subscriptionTier === 'pro'

  if (isPro) {
    return <>{children}</>
  }

  // Show content with overlay for non-Pro users
  return (
    <div className={`relative h-full ${className || ''}`}>
      {/* Blurred content preview */}
      <div className="h-full blur-sm pointer-events-none select-none opacity-50">
        {children}
      </div>

      {/* Overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-linear-to-b from-background/50 to-background/95 backdrop-blur-md">
        <ProUpgradeCard featureName={featureName} />
      </div>
    </div>
  )
}

/**
 * Inline upgrade card (used in the overlay)
 */
function ProUpgradeCard({ featureName }: { featureName: string }) {
  const upgradeMutation = useMutation({
    mutationFn: () => createUpgradeFn(),
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url
      }
    },
  })

  return (
    <div className="max-w-md w-full mx-4 p-6 rounded-xl border bg-card shadow-2xl">
      <div className="text-center space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-linear-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/30">
          <Lock className="h-7 w-7 text-blue-500" />
        </div>

        <div>
          <h3 className="text-xl font-semibold">{featureName} is Pro-Only</h3>
          <p className="text-muted-foreground mt-1">
            Upgrade to Pro to unlock {featureName.toLowerCase()} and other
            premium features.
          </p>
        </div>

        <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
          <Crown className="h-4 w-4 text-blue-500" />
          <span>
            <strong className="text-foreground">$29.99</strong>/month
          </span>
        </div>

        <Button
          onClick={() => upgradeMutation.mutate()}
          disabled={upgradeMutation.isPending}
          className="w-full bg-linear-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600"
          size="lg"
        >
          <Sparkles className="mr-2 h-4 w-4" />
          {upgradeMutation.isPending ? 'Processing...' : 'Upgrade to Pro'}
        </Button>
      </div>
    </div>
  )
}
