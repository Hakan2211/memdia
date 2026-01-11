/**
 * Stripe Webhook API Route
 *
 * Handles incoming webhook events from Stripe.
 * This route does NOT use auth middleware since webhooks come from Stripe servers.
 */

import { createFileRoute } from '@tanstack/react-router'
import { processStripeWebhook } from '../../../server/stripe-webhook.fn'

export const Route = createFileRoute('/api/stripe/webhook')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          // Get the raw body as text for signature verification
          const payload = await request.text()
          const signature = request.headers.get('stripe-signature')

          console.log('[Webhook Route] Received POST request')
          console.log('[Webhook Route] Has signature:', !!signature)

          if (!signature) {
            console.error('[Webhook Route] Missing stripe-signature header')
            return new Response(
              JSON.stringify({ error: 'Missing stripe-signature header' }),
              { status: 400, headers: { 'Content-Type': 'application/json' } },
            )
          }

          const result = await processStripeWebhook(payload, signature)

          console.log('[Webhook Route] Success:', result)
          return new Response(JSON.stringify(result), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (error) {
          console.error('[Webhook Route] Error:', error)

          const message =
            error instanceof Error ? error.message : 'Webhook handler failed'

          return new Response(JSON.stringify({ error: message }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          })
        }
      },
    },
  },
})
