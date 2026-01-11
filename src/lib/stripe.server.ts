import Stripe from 'stripe'
import { prisma } from '../db'
import { getTierFromPriceId } from '../types/subscription'
import type {
  SubscriptionEventType,
  SubscriptionTier,
} from '../types/subscription'

/**
 * Stripe Adapter Pattern
 * - When MOCK_PAYMENTS=true or no STRIPE_SECRET_KEY, returns mock responses
 * - This allows development without Stripe credentials
 */

const MOCK_PAYMENTS = process.env.MOCK_PAYMENTS === 'true'

// Initialize Stripe only if we have a key and not in mock mode
function getStripeClient(): Stripe | null {
  if (MOCK_PAYMENTS) return null
  if (!process.env.STRIPE_SECRET_KEY) return null
  return new Stripe(process.env.STRIPE_SECRET_KEY)
}

export interface CheckoutResult {
  url: string
}

export interface SubscriptionStatusResult {
  status: 'active' | 'canceled' | 'past_due' | 'none'
  tier: SubscriptionTier | null
  periodEnd: Date | null
  cancelAtPeriodEnd: boolean
}

/**
 * Log a subscription event for audit purposes
 */
async function logSubscriptionEvent(
  userId: string,
  event: SubscriptionEventType,
  options: {
    fromTier?: string | null
    toTier?: string | null
    stripeEventId?: string
    stripeSubscriptionId?: string
    metadata?: Record<string, unknown>
  } = {},
): Promise<void> {
  await prisma.subscriptionEvent.create({
    data: {
      userId,
      event,
      fromTier: options.fromTier,
      toTier: options.toTier,
      stripeEventId: options.stripeEventId,
      stripeSubscriptionId: options.stripeSubscriptionId,
      metadata: options.metadata ? JSON.stringify(options.metadata) : null,
    },
  })
}

/**
 * Create a Stripe checkout session for subscription
 */
export async function createCheckoutSession(
  userId: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string,
): Promise<CheckoutResult> {
  const stripe = getStripeClient()
  const tier = getTierFromPriceId(priceId)

  if (!stripe) {
    console.log(
      `[MOCK STRIPE] Created checkout session for user: ${userId}, tier: ${tier}`,
    )
    // In mock mode, update user directly
    await prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionStatus: 'active',
        subscriptionTier: tier,
      },
    })
    await logSubscriptionEvent(userId, 'subscribed', { toTier: tier })
    return { url: `${successUrl}?session_id=mock_session_${Date.now()}` }
  }

  // Get or create Stripe customer
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new Error('User not found')

  let customerId = user.stripeCustomerId

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name ?? undefined,
      metadata: { userId },
    })
    customerId = customer.id

    await prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId: customerId },
    })
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    mode: 'subscription',
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { userId, tier: tier ?? 'unknown' },
  })

  if (!session.url) {
    throw new Error('Failed to create checkout session')
  }

  return { url: session.url }
}

/**
 * Get subscription status for a user
 */
export async function getSubscriptionStatus(
  userId: string,
): Promise<SubscriptionStatusResult> {
  const stripe = getStripeClient()

  if (!stripe) {
    // In mock mode, check the database directly
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        subscriptionStatus: true,
        subscriptionTier: true,
        subscriptionPeriodEnd: true,
        cancelAtPeriodEnd: true,
      },
    })

    if (user?.subscriptionStatus === 'active') {
      return {
        status: 'active',
        tier: (user.subscriptionTier as SubscriptionTier) ?? 'starter',
        periodEnd: user.subscriptionPeriodEnd,
        cancelAtPeriodEnd: user.cancelAtPeriodEnd,
      }
    }
    return {
      status: 'none',
      tier: null,
      periodEnd: null,
      cancelAtPeriodEnd: false,
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      subscriptionStatus: true,
      subscriptionTier: true,
      subscriptionPeriodEnd: true,
      cancelAtPeriodEnd: true,
    },
  })

  if (!user?.subscriptionStatus || user.subscriptionStatus === 'none') {
    return {
      status: 'none',
      tier: null,
      periodEnd: null,
      cancelAtPeriodEnd: false,
    }
  }

  return {
    status: user.subscriptionStatus as SubscriptionStatusResult['status'],
    tier:
      user.subscriptionStatus === 'active'
        ? ((user.subscriptionTier as SubscriptionTier) ?? null)
        : null,
    periodEnd: user.subscriptionPeriodEnd,
    cancelAtPeriodEnd: user.cancelAtPeriodEnd,
  }
}

/**
 * Handle Stripe webhook events
 * Called by the webhook API endpoint
 */
export async function handleStripeWebhook(
  payload: string,
  signature: string,
): Promise<{ received: boolean }> {
  const stripe = getStripeClient()

  if (!stripe) {
    console.log('[MOCK STRIPE] Webhook received')
    return { received: true }
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    throw new Error('Stripe webhook secret not configured')
  }

  const event = stripe.webhooks.constructEvent(
    payload,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET,
  )

  console.log(`[Stripe Webhook] Received event: ${event.type}`)

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object
      const userId = session.metadata?.userId
      const tier = session.metadata?.tier as SubscriptionTier | undefined

      if (userId) {
        // Get subscription to find the price, tier, and period end
        let determinedTier = tier
        let periodEnd: Date | null = null

        if (session.subscription) {
          const subscriptionId =
            typeof session.subscription === 'string'
              ? session.subscription
              : session.subscription.id
          const subscription =
            await stripe.subscriptions.retrieve(subscriptionId)
          const priceId = subscription.items.data[0]?.price.id
          const currentPeriodEnd =
            subscription.items.data[0]?.current_period_end

          if (priceId && !determinedTier) {
            determinedTier = getTierFromPriceId(priceId) ?? 'starter'
          }
          if (currentPeriodEnd) {
            periodEnd = new Date(currentPeriodEnd * 1000)
          }
        }

        await prisma.user.update({
          where: { id: userId },
          data: {
            subscriptionStatus: 'active',
            subscriptionTier: determinedTier ?? 'starter',
            subscriptionPeriodEnd: periodEnd,
          },
        })

        await logSubscriptionEvent(userId, 'subscribed', {
          toTier: determinedTier ?? 'starter',
          stripeEventId: event.id,
          stripeSubscriptionId:
            typeof session.subscription === 'string'
              ? session.subscription
              : session.subscription?.id,
        })

        console.log(
          `[Stripe Webhook] User ${userId} subscribed to ${determinedTier ?? 'starter'} tier`,
        )
      }
      break
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object
      const customer = subscription.customer
      const customerId = typeof customer === 'string' ? customer : customer.id

      if (customerId) {
        const user = await prisma.user.findFirst({
          where: { stripeCustomerId: customerId },
        })

        if (user) {
          const priceId = subscription.items.data[0]?.price.id
          const newTier = priceId ? getTierFromPriceId(priceId) : null
          const previousTier = user.subscriptionTier as SubscriptionTier | null

          // Check if this is an upgrade or downgrade
          const isUpgrade = previousTier === 'starter' && newTier === 'pro'
          const isDowngrade = previousTier === 'pro' && newTier === 'starter'

          // Track cancellation status and period end
          // Stripe can use either cancel_at_period_end OR cancel_at to schedule cancellation
          // - cancel_at_period_end: true = cancel at end of current billing period
          // - cancel_at: timestamp = cancel at a specific date (used by Billing Portal)
          const cancelAt = subscription.cancel_at
          const cancelAtPeriodEnd =
            subscription.cancel_at_period_end || cancelAt !== null

          // Use cancel_at if available (more precise), otherwise use current_period_end
          const currentPeriodEnd =
            subscription.items.data[0]?.current_period_end
          const periodEndTimestamp = cancelAt ?? currentPeriodEnd
          const periodEnd = periodEndTimestamp
            ? new Date(periodEndTimestamp * 1000)
            : null

          await prisma.user.update({
            where: { id: user.id },
            data: {
              subscriptionStatus:
                subscription.status === 'active' ? 'active' : 'past_due',
              subscriptionTier: newTier,
              cancelAtPeriodEnd,
              subscriptionPeriodEnd: periodEnd,
            },
          })

          // Log cancellation scheduling
          if (cancelAtPeriodEnd && !user.cancelAtPeriodEnd) {
            await logSubscriptionEvent(user.id, 'canceled', {
              fromTier: newTier,
              stripeEventId: event.id,
              stripeSubscriptionId: subscription.id,
              metadata: {
                scheduledCancellation: true,
                periodEnd: periodEnd?.toISOString() ?? null,
              },
            })
            console.log(
              `[Stripe Webhook] User ${user.id} scheduled cancellation at ${periodEnd?.toISOString() ?? 'unknown'}`,
            )
          } else if (!cancelAtPeriodEnd && user.cancelAtPeriodEnd) {
            // User resumed their subscription
            await logSubscriptionEvent(user.id, 'reactivated', {
              toTier: newTier,
              stripeEventId: event.id,
              stripeSubscriptionId: subscription.id,
              metadata: { resumedSubscription: true },
            })
            console.log(`[Stripe Webhook] User ${user.id} resumed subscription`)
          } else if (isUpgrade) {
            await logSubscriptionEvent(user.id, 'upgraded', {
              fromTier: previousTier,
              toTier: newTier,
              stripeEventId: event.id,
              stripeSubscriptionId: subscription.id,
            })
            console.log(
              `[Stripe Webhook] User ${user.id} upgraded from ${previousTier} to ${newTier}`,
            )
          } else if (isDowngrade) {
            await logSubscriptionEvent(user.id, 'downgraded', {
              fromTier: previousTier,
              toTier: newTier,
              stripeEventId: event.id,
              stripeSubscriptionId: subscription.id,
            })
            console.log(
              `[Stripe Webhook] User ${user.id} downgraded from ${previousTier} to ${newTier}`,
            )
          }
        }
      }
      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object
      const customer = subscription.customer
      const customerId = typeof customer === 'string' ? customer : customer.id

      if (customerId) {
        const user = await prisma.user.findFirst({
          where: { stripeCustomerId: customerId },
        })

        if (user) {
          const previousTier = user.subscriptionTier as SubscriptionTier | null

          await prisma.user.update({
            where: { id: user.id },
            data: {
              subscriptionStatus: 'canceled',
              // Keep the tier for reference, but mark as canceled
            },
          })

          await logSubscriptionEvent(user.id, 'canceled', {
            fromTier: previousTier,
            stripeEventId: event.id,
            stripeSubscriptionId: subscription.id,
          })

          console.log(`[Stripe Webhook] User ${user.id} canceled subscription`)
        }
      }
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object
      const invoiceCustomer = invoice.customer
      if (!invoiceCustomer) break

      const customerId =
        typeof invoiceCustomer === 'string'
          ? invoiceCustomer
          : invoiceCustomer.id

      if (customerId) {
        const user = await prisma.user.findFirst({
          where: { stripeCustomerId: customerId },
        })

        if (user) {
          await prisma.user.update({
            where: { id: user.id },
            data: { subscriptionStatus: 'past_due' },
          })

          await logSubscriptionEvent(user.id, 'payment_failed', {
            stripeEventId: event.id,
            metadata: { invoiceId: invoice.id },
          })

          console.log(`[Stripe Webhook] Payment failed for user ${user.id}`)
        }
      }
      break
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object
      const invoiceCustomer = invoice.customer
      if (!invoiceCustomer) break

      const customerId =
        typeof invoiceCustomer === 'string'
          ? invoiceCustomer
          : invoiceCustomer.id

      if (customerId) {
        const user = await prisma.user.findFirst({
          where: { stripeCustomerId: customerId },
        })

        if (user) {
          // Ensure status is active after successful payment
          if (user.subscriptionStatus === 'past_due') {
            await prisma.user.update({
              where: { id: user.id },
              data: { subscriptionStatus: 'active' },
            })

            await logSubscriptionEvent(user.id, 'reactivated', {
              toTier: user.subscriptionTier,
              stripeEventId: event.id,
            })

            console.log(
              `[Stripe Webhook] Subscription reactivated for user ${user.id}`,
            )
          } else {
            await logSubscriptionEvent(user.id, 'payment_succeeded', {
              stripeEventId: event.id,
              metadata: { invoiceId: invoice.id },
            })
          }
        }
      }
      break
    }
  }

  return { received: true }
}

/**
 * Create a Stripe billing portal session for subscription management
 */
export async function createBillingPortalSession(
  userId: string,
  returnUrl: string,
): Promise<{ url: string }> {
  const stripe = getStripeClient()

  if (!stripe) {
    console.log(`[MOCK STRIPE] Created billing portal for user: ${userId}`)
    return { url: returnUrl }
  }

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user?.stripeCustomerId) {
    throw new Error('No Stripe customer found for user')
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: returnUrl,
  })

  return { url: session.url }
}

/**
 * Create an upgrade checkout session (from starter to pro)
 */
export async function createUpgradeSession(
  userId: string,
  successUrl: string,
  _cancelUrl: string,
): Promise<CheckoutResult> {
  const stripe = getStripeClient()
  const proPriceId = process.env.STRIPE_PRO_MONTHLY_PRICE_ID

  if (!proPriceId) {
    throw new Error('Pro price ID not configured')
  }

  if (!stripe) {
    console.log(`[MOCK STRIPE] Created upgrade session for user: ${userId}`)
    await prisma.user.update({
      where: { id: userId },
      data: { subscriptionTier: 'pro' },
    })
    await logSubscriptionEvent(userId, 'upgraded', {
      fromTier: 'starter',
      toTier: 'pro',
    })
    return { url: `${successUrl}?upgraded=true` }
  }

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user?.stripeCustomerId) {
    throw new Error('No Stripe customer found for user')
  }

  // Get current subscription
  const subscriptions = await stripe.subscriptions.list({
    customer: user.stripeCustomerId,
    status: 'active',
    limit: 1,
  })

  const currentSubscription = subscriptions.data[0]
  if (!currentSubscription) {
    throw new Error('No active subscription found')
  }

  // Update the subscription to the new price
  const subscriptionItem = currentSubscription.items.data[0]
  if (!subscriptionItem) {
    throw new Error('No subscription item found')
  }

  await stripe.subscriptions.update(currentSubscription.id, {
    items: [
      {
        id: subscriptionItem.id,
        price: proPriceId,
      },
    ],
    proration_behavior: 'create_prorations',
  })

  // The webhook will handle logging the upgrade
  return { url: successUrl }
}
