/**
 * Deepgram Server Functions
 * Provides secure access to Deepgram API from the client
 */

import { createServerFn } from '@tanstack/react-start'
import { authMiddleware } from './middleware'

// ==========================================
// Get short-lived Deepgram token for client
// ==========================================

/**
 * Token TTL in seconds. Long enough to cover connection setup and
 * reconnects during a session; the WebSocket stays open past expiry,
 * the token only needs to be valid at connection time.
 */
const TOKEN_TTL_SECONDS = 600

/**
 * Returns a short-lived Deepgram access token (JWT) for browser use.
 * The master DEEPGRAM_API_KEY never leaves the server — the client
 * authenticates its WebSocket with this ephemeral token via the
 * ['bearer', token] subprotocol.
 *
 * https://developers.deepgram.com/guides/fundamentals/token-based-authentication
 */
export const getDeepgramTokenFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async () => {
    const apiKey = process.env.DEEPGRAM_API_KEY

    if (!apiKey) {
      console.warn('[Deepgram Server] No API key configured in environment')
      return { token: null, error: 'Deepgram not configured' }
    }

    try {
      const response = await fetch('https://api.deepgram.com/v1/auth/grant', {
        method: 'POST',
        headers: {
          Authorization: `Token ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ttl_seconds: TOKEN_TTL_SECONDS }),
      })

      if (!response.ok) {
        const body = await response.text()
        console.error(
          '[Deepgram Server] Token grant failed:',
          response.status,
          body,
        )
        return { token: null, error: 'Failed to create Deepgram token' }
      }

      const data = (await response.json()) as { access_token?: string }

      if (!data.access_token) {
        console.error('[Deepgram Server] Grant response missing access_token')
        return { token: null, error: 'Failed to create Deepgram token' }
      }

      return { token: data.access_token, error: null }
    } catch (error) {
      console.error('[Deepgram Server] Token grant error:', error)
      return { token: null, error: 'Failed to create Deepgram token' }
    }
  })
