/**
 * Subscription Types
 * Types for trial and subscription management
 */

// ==========================================
// Subscription Status
// ==========================================

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'canceled'
  | 'past_due'
  | 'none'

// ==========================================
// Subscription Tier
// ==========================================

export type SubscriptionTier = 'trial' | 'standard' | 'premium'

export const SUBSCRIPTION_TIERS: Record<
  SubscriptionTier,
  {
    name: string
    maxDurationSeconds: number
    priceMonthly: number | null
    features: Array<string>
  }
> = {
  trial: {
    name: 'Free Trial',
    maxDurationSeconds: 180, // 3 minutes
    priceMonthly: null,
    features: [
      '7-day free trial',
      '3-minute daily conversations',
      'Daily memory images',
      'Full transcript & summary',
    ],
  },
  standard: {
    name: 'Standard',
    maxDurationSeconds: 180, // 3 minutes
    priceMonthly: 19.99,
    features: [
      '3-minute daily conversations',
      'Daily memory images',
      'Full transcript & summary',
      'Calendar view & history',
      'Export your data',
    ],
  },
  premium: {
    name: 'Premium',
    maxDurationSeconds: 300, // 5 minutes - Future
    priceMonthly: 29.99,
    features: [
      '5-minute daily conversations',
      'Daily, weekly & monthly images',
      'Full transcript & summary',
      'Calendar view & history',
      'Export your data',
      'Priority support',
    ],
  },
}

// ==========================================
// Trial Configuration
// ==========================================

export const TRIAL_CONFIG = {
  /** Trial duration in days */
  TRIAL_DURATION_DAYS: 7,

  /** Grace period after trial ends (in hours) */
  GRACE_PERIOD_HOURS: 24,
} as const

// ==========================================
// Subscription Check Result
// ==========================================

export interface SubscriptionCheckResult {
  /** Whether the user can create a new session */
  canCreateSession: boolean

  /** Current subscription tier */
  tier: SubscriptionTier

  /** Subscription status */
  status: SubscriptionStatus

  /** Maximum duration allowed (in seconds) */
  maxDurationSeconds: number

  /** Trial info (if applicable) */
  trial?: {
    isActive: boolean
    daysRemaining: number
    endsAt: Date
  }

  /** Reason if session creation is blocked */
  blockedReason?: 'trial_expired' | 'subscription_inactive' | 'past_due'
}

// ==========================================
// Stripe Integration
// ==========================================

export const STRIPE_PRICE_IDS = {
  standard_monthly: process.env.STRIPE_STANDARD_MONTHLY_PRICE_ID ?? '',
  premium_monthly: process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID ?? '',
} as const
