import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import {
  createBillingPortalSession,
  createCheckoutSession,
  createUpgradeSession,
  getSubscriptionStatus,
} from '../lib/stripe.server'
import { getPriceIdForTier } from '../types/subscription'
import { adminMiddleware, authMiddleware } from './middleware'
import { getSubscriptionEvents } from './services/subscription.service'
import type { SubscriptionTier } from '../types/subscription'

/**
 * Create Stripe Checkout Session for new subscription
 */
const checkoutSchema = z.object({
  tier: z.enum(['starter', 'pro']).optional(),
  priceId: z.string().optional(),
  isNewUser: z.boolean().optional(), // If true, redirect to onboarding after success
})

export const createCheckoutFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(checkoutSchema)
  .handler(async ({ data, context }) => {
    const tier = (data.tier ?? 'starter') as SubscriptionTier
    const priceId = data.priceId || getPriceIdForTier(tier)
    const baseUrl = process.env.BETTER_AUTH_URL || 'http://localhost:3000'

    // New users go to onboarding, existing users go to memories
    const successPath = data.isNewUser ? '/onboarding' : '/memories'

    const result = await createCheckoutSession(
      context.user.id,
      priceId,
      `${baseUrl}${successPath}?checkout=success`,
      `${baseUrl}/subscribe?canceled=true`,
    )

    return result
  })

/**
 * Get current user's subscription status
 */
export const getSubscriptionFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const status = await getSubscriptionStatus(context.user.id)
    return status
  })

/**
 * Create Stripe Billing Portal Session for subscription management
 */
export const createBillingPortalFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const baseUrl = process.env.BETTER_AUTH_URL || 'http://localhost:3000'

    const result = await createBillingPortalSession(
      context.user.id,
      `${baseUrl}/profile`,
    )

    return result
  })

/**
 * Upgrade from Starter to Pro tier
 */
export const createUpgradeFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const baseUrl = process.env.BETTER_AUTH_URL || 'http://localhost:3000'

    const result = await createUpgradeSession(
      context.user.id,
      `${baseUrl}/profile?upgraded=true`,
      `${baseUrl}/profile?upgrade_canceled=true`,
    )

    return result
  })

/**
 * Get subscription events for admin dashboard
 */
export const getSubscriptionEventsFn = createServerFn({ method: 'GET' })
  .middleware([adminMiddleware])
  .handler(async () => {
    const events = await getSubscriptionEvents(undefined, 100)
    return events
  })
