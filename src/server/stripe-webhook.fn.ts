/**
 * Stripe Webhook Handler
 *
 * This file contains the logic for processing Stripe webhook events.
 * It's called by the API route handler.
 */

import Stripe from 'stripe'
import { prisma } from '../db'

// Initialize Stripe
function getStripeClient(): Stripe | null {
  if (process.env.MOCK_PAYMENTS === 'true') return null
  if (!process.env.STRIPE_SECRET_KEY) return null
  return new Stripe(process.env.STRIPE_SECRET_KEY)
}

// Get tier from price ID
function getTierFromPriceId(priceId: string): 'starter' | 'pro' | null {
  if (priceId === process.env.STRIPE_STARTER_MONTHLY_PRICE_ID) return 'starter'
  if (priceId === process.env.STRIPE_PRO_MONTHLY_PRICE_ID) return 'pro'
  return null
}

// Log subscription event
async function logSubscriptionEvent(
  userId: string,
  event: string,
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
 * Process Stripe webhook event
 */
export async function processStripeWebhook(
  payload: string,
  signature: string,
): Promise<{ received: boolean }> {
  const stripe = getStripeClient()

  // Mock mode - just acknowledge
  if (!stripe) {
    console.log('[MOCK STRIPE] Webhook received')
    return { received: true }
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    throw new Error('Stripe webhook secret not configured')
  }

  // Verify and construct event
  const stripeEvent = stripe.webhooks.constructEvent(
    payload,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET,
  )

  console.log(`[Stripe Webhook] Received event: ${stripeEvent.type}`)

  switch (stripeEvent.type) {
    case 'checkout.session.completed': {
      const session = stripeEvent.data.object
      const userId = session.metadata?.userId
      const tier = session.metadata?.tier as 'starter' | 'pro' | undefined

      if (userId) {
        // Get subscription to find the price and determine tier
        let determinedTier = tier
        if (!determinedTier && session.subscription) {
          const subscriptionId =
            typeof session.subscription === 'string'
              ? session.subscription
              : session.subscription.id
          const subscription =
            await stripe.subscriptions.retrieve(subscriptionId)
          const priceId = subscription.items.data[0]?.price.id
          if (priceId) {
            determinedTier = getTierFromPriceId(priceId) ?? 'starter'
          }
        }

        await prisma.user.update({
          where: { id: userId },
          data: {
            subscriptionStatus: 'active',
            subscriptionTier: determinedTier ?? 'starter',
          },
        })

        await logSubscriptionEvent(userId, 'subscribed', {
          toTier: determinedTier ?? 'starter',
          stripeEventId: stripeEvent.id,
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
      const subscription = stripeEvent.data.object
      const customer = subscription.customer
      const customerId = typeof customer === 'string' ? customer : customer.id

      if (customerId) {
        const user = await prisma.user.findFirst({
          where: { stripeCustomerId: customerId },
        })

        if (user) {
          const priceId = subscription.items.data[0]?.price.id
          const newTier = priceId ? getTierFromPriceId(priceId) : null
          const previousTier = user.subscriptionTier as 'starter' | 'pro' | null

          const isUpgrade = previousTier === 'starter' && newTier === 'pro'
          const isDowngrade = previousTier === 'pro' && newTier === 'starter'

          // Track cancellation status and period end
          // Access properties from the Stripe subscription object with proper null checks
          const cancelAtPeriodEnd = subscription.cancel_at_period_end ?? false
          const currentPeriodEnd = (
            subscription as unknown as { current_period_end?: number }
          ).current_period_end
          const periodEnd = currentPeriodEnd
            ? new Date(currentPeriodEnd * 1000)
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
              stripeEventId: stripeEvent.id,
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
              stripeEventId: stripeEvent.id,
              stripeSubscriptionId: subscription.id,
              metadata: { resumedSubscription: true },
            })
            console.log(`[Stripe Webhook] User ${user.id} resumed subscription`)
          } else if (isUpgrade) {
            await logSubscriptionEvent(user.id, 'upgraded', {
              fromTier: previousTier,
              toTier: newTier,
              stripeEventId: stripeEvent.id,
              stripeSubscriptionId: subscription.id,
            })
            console.log(
              `[Stripe Webhook] User ${user.id} upgraded from ${previousTier} to ${newTier}`,
            )
          } else if (isDowngrade) {
            await logSubscriptionEvent(user.id, 'downgraded', {
              fromTier: previousTier,
              toTier: newTier,
              stripeEventId: stripeEvent.id,
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
      const subscription = stripeEvent.data.object
      const customer = subscription.customer
      const customerId = typeof customer === 'string' ? customer : customer.id

      if (customerId) {
        const user = await prisma.user.findFirst({
          where: { stripeCustomerId: customerId },
        })

        if (user) {
          const previousTier = user.subscriptionTier as 'starter' | 'pro' | null

          await prisma.user.update({
            where: { id: user.id },
            data: { subscriptionStatus: 'canceled' },
          })

          await logSubscriptionEvent(user.id, 'canceled', {
            fromTier: previousTier,
            stripeEventId: stripeEvent.id,
            stripeSubscriptionId: subscription.id,
          })

          console.log(`[Stripe Webhook] User ${user.id} canceled subscription`)
        }
      }
      break
    }

    case 'invoice.payment_failed': {
      const invoice = stripeEvent.data.object
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
            stripeEventId: stripeEvent.id,
            metadata: { invoiceId: invoice.id },
          })

          console.log(`[Stripe Webhook] Payment failed for user ${user.id}`)
        }
      }
      break
    }

    case 'invoice.payment_succeeded': {
      const invoice = stripeEvent.data.object
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
          if (user.subscriptionStatus === 'past_due') {
            await prisma.user.update({
              where: { id: user.id },
              data: { subscriptionStatus: 'active' },
            })

            await logSubscriptionEvent(user.id, 'reactivated', {
              toTier: user.subscriptionTier,
              stripeEventId: stripeEvent.id,
            })

            console.log(
              `[Stripe Webhook] Subscription reactivated for user ${user.id}`,
            )
          } else {
            await logSubscriptionEvent(user.id, 'payment_succeeded', {
              stripeEventId: stripeEvent.id,
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
