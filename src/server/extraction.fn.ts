/**
 * Extraction Server Functions
 * Server functions for extracting and fetching insights from reflection sessions
 *
 * Note: The core extraction logic is in extraction.internal.ts to avoid
 * bundling server-side code (Prisma) into the client.
 */

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { prisma } from '../db'
import { authMiddleware } from './middleware'
import { extractInsightsFromSession } from './extraction.internal'

// ==========================================
// Schemas
// ==========================================

const sessionIdSchema = z.object({ sessionId: z.string() })

// ==========================================
// Server Functions
// ==========================================

/**
 * Manually trigger extraction for a session
 * Useful for re-processing or debugging
 */
export const reExtractInsightsFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(sessionIdSchema)
  .handler(async ({ data, context }) => {
    const userId = context.user.id

    // Verify ownership
    const session = await prisma.reflectionSession.findUnique({
      where: { id: data.sessionId },
    })

    if (!session || session.userId !== userId) {
      throw new Error('Session not found')
    }

    if (session.status !== 'completed') {
      throw new Error('Session must be completed before extraction')
    }

    const result = await extractInsightsFromSession(data.sessionId, userId)
    return { success: !!result }
  })

/**
 * Get extracted insights for a session
 */
export const getSessionInsightsFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(sessionIdSchema)
  .handler(async ({ data, context }) => {
    const userId = context.user.id

    const session = await prisma.reflectionSession.findUnique({
      where: { id: data.sessionId },
      include: {
        mood: true,
        topics: true,
        insights: true,
        personMentions: {
          include: {
            person: true,
          },
        },
      },
    })

    if (!session || session.userId !== userId) {
      return null
    }

    // Get todos linked to this session
    const todos = await prisma.todo.findMany({
      where: {
        sourceSessionId: data.sessionId,
        userId,
      },
    })

    return {
      mood: session.mood,
      topics: session.topics,
      insights: session.insights,
      people: session.personMentions.map((m) => ({
        ...m.person,
        sentiment: m.sentiment,
        mentionContext: m.context,
      })),
      todos,
    }
  })
