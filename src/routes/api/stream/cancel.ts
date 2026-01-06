/**
 * Cancel Streaming Endpoint
 * Signals server to stop TTS generation for barge-in
 *
 * This endpoint maintains a map of active generation IDs per session.
 * When cancelled, the generation ID is incremented, causing the streaming
 * endpoint to stop processing TTS for that session.
 */

import { createFileRoute } from '@tanstack/react-router'
import { auth } from '../../../lib/auth'

// In-memory store for active generation IDs (per session)
// Key: sessionId, Value: current generation number
export const activeGenerations = new Map<string, number>()

/**
 * Get the current generation ID for a session
 * Returns 0 if no generation exists
 */
export function getGeneration(sessionId: string): number {
  return activeGenerations.get(sessionId) || 0
}

/**
 * Increment the generation ID for a session (used to cancel)
 * Returns the new generation ID
 */
export function incrementGeneration(sessionId: string): number {
  const current = activeGenerations.get(sessionId) || 0
  const next = current + 1
  activeGenerations.set(sessionId, next)
  return next
}

/**
 * Set a specific generation ID for a session (used when starting a new stream)
 */
export function setGeneration(sessionId: string, generation: number): void {
  activeGenerations.set(sessionId, generation)
}

export const Route = createFileRoute('/api/stream/cancel')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        // Authenticate user
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session?.user) {
          return new Response('Unauthorized', { status: 401 })
        }

        // Parse request body
        let body: { sessionId: string }
        try {
          body = await request.json()
        } catch {
          return new Response('Invalid JSON body', { status: 400 })
        }

        const { sessionId } = body

        if (!sessionId) {
          return new Response('Missing sessionId', { status: 400 })
        }

        // Increment generation ID to signal cancellation
        const oldGeneration = getGeneration(sessionId)
        const newGeneration = incrementGeneration(sessionId)

        console.log(
          `[Cancel API] Session ${sessionId}: gen ${oldGeneration} -> ${newGeneration}`,
        )

        return new Response(
          JSON.stringify({
            cancelled: true,
            generation: newGeneration,
          }),
          {
            headers: { 'Content-Type': 'application/json' },
          },
        )
      },
    },
  },
})
