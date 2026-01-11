/**
 * Subscription Types
 * Types for paid subscription management (Starter & Pro tiers)
 */

// ==========================================
// Subscription Status
// ==========================================

export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'none'

// ==========================================
// Subscription Tier
// ==========================================

export type SubscriptionTier = 'starter' | 'pro'

export const SUBSCRIPTION_TIERS: Record<
  SubscriptionTier,
  {
    name: string
    maxDurationSeconds: number
    maxReflectionDurationSeconds: number
    priceMonthly: number
    features: Array<string>
    description: string
  }
> = {
  starter: {
    name: 'Starter',
    maxDurationSeconds: 180, // 3 minutes for voice sessions
    maxReflectionDurationSeconds: 600, // 10 minutes for reflections
    priceMonthly: 19.99,
    description: 'Perfect for daily check-ins',
    features: [
      '3-minute daily voice check-ins',
      '10-minute reflection sessions',
      'AI-generated memory images',
      'Full transcripts & summaries',
      'Calendar view & history',
      'Export your data',
    ],
  },
  pro: {
    name: 'Pro',
    maxDurationSeconds: 600, // 10 minutes for voice sessions
    maxReflectionDurationSeconds: 600, // 10 minutes for reflections
    priceMonthly: 29.99,
    description: 'For deeper daily reflections',
    features: [
      '10-minute daily voice check-ins',
      '10-minute reflection sessions',
      'AI-generated memory images',
      'Full transcripts & summaries',
      'Calendar view & history',
      'Export your data',
      'Priority support',
    ],
  },
}

// ==========================================
// Subscription Check Result
// ==========================================

export interface SubscriptionCheckResult {
  /** Whether the user can create a new session */
  canCreateSession: boolean

  /** Current subscription tier (null if not subscribed) */
  tier: SubscriptionTier | null

  /** Subscription status */
  status: SubscriptionStatus

  /** Maximum duration allowed for voice sessions (in seconds) */
  maxDurationSeconds: number

  /** Maximum duration allowed for reflection sessions (in seconds) */
  maxReflectionDurationSeconds: number

  /** Reason if session creation is blocked */
  blockedReason?: 'no_subscription' | 'subscription_canceled' | 'past_due'
}

// ==========================================
// Subscription Event Types (for audit logging)
// ==========================================

export type SubscriptionEventType =
  | 'subscribed'
  | 'upgraded'
  | 'downgraded'
  | 'canceled'
  | 'reactivated'
  | 'payment_failed'
  | 'payment_succeeded'

// ==========================================
// Stripe Integration
// ==========================================

export const STRIPE_PRICE_IDS = {
  starter_monthly: process.env.STRIPE_STARTER_MONTHLY_PRICE_ID ?? '',
  pro_monthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID ?? '',
} as const

/**
 * Get the tier from a Stripe price ID
 */
export function getTierFromPriceId(priceId: string): SubscriptionTier | null {
  if (priceId === STRIPE_PRICE_IDS.starter_monthly) return 'starter'
  if (priceId === STRIPE_PRICE_IDS.pro_monthly) return 'pro'
  return null
}

/**
 * Get the price ID for a tier
 */
export function getPriceIdForTier(tier: SubscriptionTier): string {
  return tier === 'pro'
    ? STRIPE_PRICE_IDS.pro_monthly
    : STRIPE_PRICE_IDS.starter_monthly
}
