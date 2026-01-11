/**
 * Subscription Service
 * Handles subscription checks and status management
 * No trial - users must subscribe to use the app
 */

import { prisma } from '../../db'
import { SUBSCRIPTION_TIERS } from '../../types/subscription'
import type {
  SubscriptionCheckResult,
  SubscriptionStatus,
  SubscriptionTier,
} from '../../types/subscription'

/**
 * Check if mock payments are enabled
 */
function isMockMode(): boolean {
  return process.env.MOCK_PAYMENTS === 'true'
}

/**
 * Get user's current subscription tier from database
 */
export function getUserTier(
  subscriptionStatus: string | null,
  subscriptionTier: string | null,
): SubscriptionTier | null {
  // Only return tier if subscription is active
  if (subscriptionStatus === 'active' && subscriptionTier) {
    return subscriptionTier as SubscriptionTier
  }
  return null
}

/**
 * Main subscription check function
 * Determines if user can create a session and what limits apply
 */
export async function checkSubscription(
  userId: string,
): Promise<SubscriptionCheckResult> {
  // In mock mode, always allow with pro tier
  if (isMockMode()) {
    const proTier = SUBSCRIPTION_TIERS.pro
    return {
      canCreateSession: true,
      tier: 'pro',
      status: 'active',
      maxDurationSeconds: proTier.maxDurationSeconds,
      maxReflectionDurationSeconds: proTier.maxReflectionDurationSeconds,
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      subscriptionStatus: true,
      subscriptionTier: true,
      stripeCustomerId: true,
    },
  })

  if (!user) {
    return {
      canCreateSession: false,
      tier: null,
      status: 'none',
      maxDurationSeconds: 0,
      maxReflectionDurationSeconds: 0,
      blockedReason: 'no_subscription',
    }
  }

  const status = (user.subscriptionStatus ?? 'none') as SubscriptionStatus
  const tier = getUserTier(status, user.subscriptionTier)

  // No active subscription
  if (!tier || status === 'none') {
    return {
      canCreateSession: false,
      tier: null,
      status: 'none',
      maxDurationSeconds: 0,
      maxReflectionDurationSeconds: 0,
      blockedReason: 'no_subscription',
    }
  }

  // Subscription canceled
  if (status === 'canceled') {
    return {
      canCreateSession: false,
      tier,
      status: 'canceled',
      maxDurationSeconds: 0,
      maxReflectionDurationSeconds: 0,
      blockedReason: 'subscription_canceled',
    }
  }

  // Payment past due
  if (status === 'past_due') {
    return {
      canCreateSession: false,
      tier,
      status: 'past_due',
      maxDurationSeconds: 0,
      maxReflectionDurationSeconds: 0,
      blockedReason: 'past_due',
    }
  }

  // Active subscription
  const tierConfig = SUBSCRIPTION_TIERS[tier]
  return {
    canCreateSession: true,
    tier,
    status: 'active',
    maxDurationSeconds: tierConfig.maxDurationSeconds,
    maxReflectionDurationSeconds: tierConfig.maxReflectionDurationSeconds,
  }
}

/**
 * Update subscription status (called from webhook handler)
 */
export async function updateSubscriptionStatus(
  userId: string,
  status: SubscriptionStatus,
  tier?: SubscriptionTier | null,
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      subscriptionStatus: status,
      ...(tier !== undefined && { subscriptionTier: tier }),
    },
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
 * Get subscription status for display in UI
 */
export async function getSubscriptionDisplayInfo(userId: string): Promise<{
  tier: SubscriptionTier | null
  tierName: string
  status: SubscriptionStatus
  isActive: boolean
  price: number | null
  features: Array<string>
}> {
  // In mock mode, return pro tier
  if (isMockMode()) {
    const proTier = SUBSCRIPTION_TIERS.pro
    return {
      tier: 'pro',
      tierName: proTier.name,
      status: 'active',
      isActive: true,
      price: proTier.priceMonthly,
      features: proTier.features,
    }
  }

  const check = await checkSubscription(userId)

  if (!check.tier) {
    return {
      tier: null,
      tierName: 'No Subscription',
      status: check.status,
      isActive: false,
      price: null,
      features: [],
    }
  }

  const tierConfig = SUBSCRIPTION_TIERS[check.tier]

  return {
    tier: check.tier,
    tierName: tierConfig.name,
    status: check.status,
    isActive: check.canCreateSession,
    price: tierConfig.priceMonthly,
    features: tierConfig.features,
  }
}

/**
 * Check if user has an active subscription
 */
export async function hasActiveSubscription(userId: string): Promise<boolean> {
  if (isMockMode()) {
    return true
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { subscriptionStatus: true },
  })

  return user?.subscriptionStatus === 'active'
}

/**
 * Get subscription events for a user (for admin dashboard)
 */
export async function getSubscriptionEvents(
  userId?: string,
  limit = 50,
): Promise<
  Array<{
    id: string
    userId: string
    userEmail: string
    event: string
    fromTier: string | null
    toTier: string | null
    createdAt: Date
  }>
> {
  const events = await prisma.subscriptionEvent.findMany({
    where: userId ? { userId } : undefined,
    include: {
      user: {
        select: { email: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  return events.map((event) => ({
    id: event.id,
    userId: event.userId,
    userEmail: event.user.email,
    event: event.event,
    fromTier: event.fromTier,
    toTier: event.toTier,
    createdAt: event.createdAt,
  }))
}
