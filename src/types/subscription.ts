/**
 * Subscription Types
 *
 * There is ONE plan for sale: Pro. The 'starter' tier still exists because
 * legacy Starter subscribers (and their Stripe price) are kept as-is — they
 * get the full product at their existing price. Never offer Starter in the UI.
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
  // Legacy tier — grandfathered subscribers get the full product.
  starter: {
    name: 'Starter',
    maxDurationSeconds: 900,
    maxReflectionDurationSeconds: 900,
    priceMonthly: 19.99,
    description: 'Legacy plan',
    features: [],
  },
  pro: {
    name: 'Pro',
    maxDurationSeconds: 900,
    maxReflectionDurationSeconds: 900, // 15-minute conversations
    priceMonthly: 29.99,
    description: 'Deep daily conversations with an AI that remembers you',
    features: [
      '15-minute daily voice conversations',
      'Explore anything: feelings, philosophy, ideas, the world',
      'An AI companion that remembers your past conversations',
      'Summaries, transcripts & an AI-generated image of each day',
      'Insights: moods, topics, ideas, people & intentions over time',
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

/** Format a monthly price the way the app displays it, e.g. 29.99 → "€29,99" */
export function formatEuro(amount: number): string {
  return `€${amount.toFixed(2).replace('.', ',')}`
}
