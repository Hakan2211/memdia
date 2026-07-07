/**
 * Deepgram Server Functions
 * Provides secure access to Deepgram API from the client
 */

import { createServerFn } from '@tanstack/react-start'
import { authMiddleware } from './middleware'

// ==========================================
// Get Deepgram API Key for Client
// ==========================================

/**
 * Returns the Deepgram API key for use in the client
 * In production, you would want to use Deepgram's temporary key API
 * or proxy audio through your server
 */
export const getDeepgramKeyFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async () => {
    const apiKey = process.env.DEEPGRAM_API_KEY

    if (!apiKey) {
      console.warn('[Deepgram Server] No API key configured in environment')
      return { apiKey: null, error: 'Deepgram not configured' }
    }

    console.log('[Deepgram Server] API key found, returning to client')
    console.log('[Deepgram Server] Key prefix:', apiKey.substring(0, 8) + '...')

    // For development, return the API key directly
    // In production, consider using Deepgram's temporary token API:
    // https://developers.deepgram.com/docs/create-a-temporary-api-key

    return { apiKey, error: null }
  })
