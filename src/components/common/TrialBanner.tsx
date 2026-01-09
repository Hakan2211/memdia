/**
 * Trial Banner Component
 * Shows remaining trial days and upgrade prompt
 */

import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Sparkles, X } from 'lucide-react'
import { useState } from 'react'
import { getTrialStatusFn } from '../../server/session.fn'
import { Button } from '../ui/button'

export function TrialBanner() {
  const [dismissed, setDismissed] = useState(false)

  const { data: trialStatus, isLoading } = useQuery({
    queryKey: ['trial-status'],
    queryFn: () => getTrialStatusFn(),
    staleTime: 60 * 1000, // 1 minute
  })

  // Don't show if loading, dismissed, or user is subscribed
  if (isLoading || dismissed) return null
  if (!trialStatus) return null
  if (trialStatus.isSubscribed) return null
  if (!trialStatus.isTrialing) return null

  const daysRemaining = trialStatus.daysRemaining

  // Different styles based on urgency
  const isUrgent = daysRemaining <= 2
  const isWarning = daysRemaining <= 4

  return (
    <div
      className={`relative px-4 py-2 text-center text-sm ${
        isUrgent
          ? 'bg-red-500/10 text-red-600'
          : isWarning
            ? 'bg-amber-500/10 text-amber-600'
            : 'bg-primary/10 text-primary'
      }`}
    >
      <div className="flex items-center justify-center gap-2">
        <Sparkles className="h-4 w-4" />
        <span>
          {daysRemaining === 0 ? (
            <>Your free trial ends today!</>
          ) : daysRemaining === 1 ? (
            <>1 day left in your free trial</>
          ) : (
            <>{daysRemaining} days left in your free trial</>
          )}
        </span>
        <Link to="/pricing">
          <Button
            size="sm"
            variant={isUrgent ? 'default' : 'outline'}
            className="h-7 px-3 text-xs"
          >
            Upgrade Now
          </Button>
        </Link>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-black/5"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

/**
 * Trial Expired Banner
 * Shows when trial has ended without subscription
 */
export function TrialExpiredBanner() {
  const { data: trialStatus, isLoading } = useQuery({
    queryKey: ['trial-status'],
    queryFn: () => getTrialStatusFn(),
    staleTime: 60 * 1000,
  })

  if (isLoading) return null
  if (!trialStatus) return null
  if (trialStatus.isSubscribed) return null
  if (trialStatus.isTrialing) return null
  if (!trialStatus.trialExpired) return null

  return (
    <div className="bg-red-500 text-white px-4 py-3 text-center">
      <div className="flex items-center justify-center gap-3">
        <span className="font-medium">Your free trial has ended</span>
        <Link to="/pricing">
          <Button size="sm" variant="secondary" className="h-7">
            Subscribe to Continue
          </Button>
        </Link>
      </div>
    </div>
  )
}
