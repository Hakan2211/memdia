/**
 * Subscription Service
 * Handles trial creation, validation, and subscription checks
 */

import { prisma } from '../../db'
import {
  SUBSCRIPTION_TIERS,
  
  
  
  TRIAL_CONFIG
} from '../../types/subscription'
import type {SubscriptionCheckResult, SubscriptionStatus, SubscriptionTier} from '../../types/subscription';

/**
 * Initialize trial for a new user
 * Called after user registration
 */
export async function initializeUserTrial(userId: string): Promise<Date> {
  const trialEndsAt = new Date()
  trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_CONFIG.TRIAL_DURATION_DAYS)

  await prisma.user.update({
    where: { id: userId },
    data: {
      trialEndsAt,
      subscriptionStatus: 'trialing',
    },
  })

  return trialEndsAt
}

/**
 * Check if user's trial is active
 */
export function isTrialActive(trialEndsAt: Date | null): boolean {
  if (!trialEndsAt) return false
  return new Date() < trialEndsAt
}

/**
 * Calculate days remaining in trial
 */
export function getTrialDaysRemaining(trialEndsAt: Date | null): number {
  if (!trialEndsAt) return 0
  const now = new Date()
  const diff = trialEndsAt.getTime() - now.getTime()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

/**
 * Get user's current subscription tier
 */
export function getUserTier(
  subscriptionStatus: string | null,
  trialEndsAt: Date | null,
): SubscriptionTier {
  // Check if on active trial
  if (isTrialActive(trialEndsAt)) {
    return 'trial'
  }

  // Check subscription status
  if (subscriptionStatus === 'active') {
    // For now, all paid users are on standard tier
    // In the future, we can check for premium tier
    return 'standard'
  }

  // Default to trial (expired)
  return 'trial'
}

/**
 * Main subscription check function
 * Determines if user can create a session and what limits apply
 */
export async function checkSubscription(
  userId: string,
): Promise<SubscriptionCheckResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      subscriptionStatus: true,
      trialEndsAt: true,
      stripeCustomerId: true,
    },
  })

  if (!user) {
    return {
      canCreateSession: false,
      tier: 'trial',
      status: 'none',
      maxDurationSeconds: 0,
      blockedReason: 'trial_expired',
    }
  }

  const status = (user.subscriptionStatus ?? 'none') as SubscriptionStatus
  const tier = getUserTier(status, user.trialEndsAt)
  const tierConfig = SUBSCRIPTION_TIERS[tier]

  // Build trial info if applicable
  const trialInfo = user.trialEndsAt
    ? {
        isActive: isTrialActive(user.trialEndsAt),
        daysRemaining: getTrialDaysRemaining(user.trialEndsAt),
        endsAt: user.trialEndsAt,
      }
    : undefined

  // Check if user can create a session
  let canCreateSession = false
  let blockedReason: SubscriptionCheckResult['blockedReason']

  if (tier === 'trial') {
    if (trialInfo?.isActive) {
      canCreateSession = true
    } else {
      blockedReason = 'trial_expired'
    }
  } else if (status === 'active') {
    canCreateSession = true
  } else if (status === 'past_due') {
    blockedReason = 'past_due'
  } else {
    blockedReason = 'subscription_inactive'
  }

  return {
    canCreateSession,
    tier,
    status,
    maxDurationSeconds: tierConfig.maxDurationSeconds,
    trial: trialInfo,
    blockedReason,
  }
}

/**
 * Ensure user has trial initialized
 * Called during signup or first API access
 */
export async function ensureTrialInitialized(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { trialEndsAt: true },
  })

  if (user && !user.trialEndsAt) {
    await initializeUserTrial(userId)
  }
}

/**
 * Update subscription status from Stripe webhook
 */
export async function updateSubscriptionStatus(
  userId: string,
  status: SubscriptionStatus,
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { subscriptionStatus: status },
  })
}

/**
 * Cancel subscription (mark as canceled)
 */
export async function cancelSubscription(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { subscriptionStatus: 'canceled' },
  })
}

/**
 * Get subscription status for display
 */
export async function getSubscriptionDisplayInfo(userId: string): Promise<{
  tier: SubscriptionTier
  tierName: string
  status: SubscriptionStatus
  isActive: boolean
  trial?: {
    isActive: boolean
    daysRemaining: number
    endsAt: Date
  }
  price: number | null
}> {
  const check = await checkSubscription(userId)
  const tierConfig = SUBSCRIPTION_TIERS[check.tier]

  return {
    tier: check.tier,
    tierName: tierConfig.name,
    status: check.status,
    isActive: check.canCreateSession,
    trial: check.trial,
    price: tierConfig.priceMonthly,
  }
}
