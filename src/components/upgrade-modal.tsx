/**
 * Upgrade Modal Component
 * Shows when Starter tier users try to access Pro-only features (Reflections, Insights)
 */

import { useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Check, Crown, Loader2, Lock, Sparkles } from 'lucide-react'
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
  const router = useRouter()
  const queryClient = useQueryClient()
  const [isRefreshing, setIsRefreshing] = useState(false)

  const upgradeMutation = useMutation({
    mutationFn: () => createUpgradeFn(),
    onSuccess: async (data) => {
      // If URL is returned and different from current, redirect (e.g., to Stripe checkout)
      if (data.url && data.url !== window.location.href) {
        window.location.href = data.url
      } else {
        // Upgrade was processed directly - refresh subscription data
        setIsRefreshing(true)
        await queryClient.invalidateQueries({ queryKey: ['subscription'] })
        // Re-run route loaders to refresh subscription in context
        await router.invalidate()
        setIsRefreshing(false)
        // Show success toast
        toast.success('Successfully upgraded to Pro!', {
          description: 'You now have access to all Pro features.',
        })
        // Close modal
        onOpenChange(false)
      }
    },
  })

  const isLoading = upgradeMutation.isPending || isRefreshing
  const proTier = SUBSCRIPTION_TIERS.pro

  // Helper to get button text based on state
  const getButtonText = () => {
    if (isRefreshing) return 'Unlocking...'
    if (upgradeMutation.isPending) return 'Processing...'
    return 'Upgrade to Pro'
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton={true}>
        <DialogHeader className="text-center sm:text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-purple-500/20 to-purple-600/20 border border-purple-500/30">
            <Crown className="h-8 w-8 text-purple-500" />
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
              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-500/10">
                <Check className="h-3 w-3 text-purple-500" />
              </div>
              <div>
                <p className="font-medium">10-minute voice sessions</p>
                <p className="text-sm text-muted-foreground">
                  Extended daily check-ins for deeper reflection
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-500/10">
                <Check className="h-3 w-3 text-purple-500" />
              </div>
              <div>
                <p className="font-medium">Therapeutic Reflections</p>
                <p className="text-sm text-muted-foreground">
                  10-minute guided conversations for personal growth
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-500/10">
                <Check className="h-3 w-3 text-purple-500" />
              </div>
              <div>
                <p className="font-medium">Insights Dashboard</p>
                <p className="text-sm text-muted-foreground">
                  Track moods, topics, people, and personal patterns
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-500/10">
                <Check className="h-3 w-3 text-purple-500" />
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
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600"
            size="lg"
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {getButtonText()}
          </Button>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="w-full"
            disabled={isLoading}
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
}

export function ProFeatureGate({
  children,
  subscriptionTier,
  featureName,
}: ProFeatureGateProps) {
  const isPro = subscriptionTier === 'pro'

  if (isPro) {
    return <>{children}</>
  }

  // Show content with overlay for non-Pro users
  return (
    <div className="relative h-full">
      {/* Blurred content preview */}
      <div className="h-full blur-sm pointer-events-none select-none opacity-50">
        {children}
      </div>

      {/* Overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <ProUpgradeCard featureName={featureName} />
      </div>
    </div>
  )
}

/**
 * Inline upgrade card (used in the overlay)
 */
function ProUpgradeCard({ featureName }: { featureName: string }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [isRefreshing, setIsRefreshing] = useState(false)

  const upgradeMutation = useMutation({
    mutationFn: () => createUpgradeFn(),
    onSuccess: async (data) => {
      // If URL is returned and different from current, redirect (e.g., to Stripe checkout)
      if (data.url && data.url !== window.location.href) {
        window.location.href = data.url
      } else {
        // Upgrade was processed directly - refresh subscription data
        setIsRefreshing(true)
        await queryClient.invalidateQueries({ queryKey: ['subscription'] })
        // Re-run route loaders to refresh subscription in context
        await router.invalidate()
        setIsRefreshing(false)
        // Show success toast
        toast.success('Successfully upgraded to Pro!', {
          description: `${featureName} is now unlocked.`,
        })
      }
    },
  })

  const isLoading = upgradeMutation.isPending || isRefreshing

  // Helper to get button text based on state
  const getButtonText = () => {
    if (isRefreshing) return 'Unlocking...'
    if (upgradeMutation.isPending) return 'Processing...'
    return 'Upgrade to Pro'
  }

  return (
    <div className="max-w-md w-full mx-4 p-6 rounded-xl border bg-card shadow-lg">
      <div className="text-center space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-purple-500/20 to-purple-600/20 border border-purple-500/30">
          <Lock className="h-7 w-7 text-purple-500" />
        </div>

        <div>
          <h3 className="text-xl font-semibold">{featureName} is Pro-Only</h3>
          <p className="text-muted-foreground mt-1">
            Upgrade to Pro to unlock {featureName.toLowerCase()} and other
            premium features.
          </p>
        </div>

        <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
          <Crown className="h-4 w-4 text-purple-500" />
          <span>
            <strong className="text-foreground">$29.99</strong>/month
          </span>
        </div>

        <Button
          onClick={() => upgradeMutation.mutate()}
          disabled={isLoading}
          className="w-full bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600"
          size="lg"
        >
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          {getButtonText()}
        </Button>
      </div>
    </div>
  )
}
