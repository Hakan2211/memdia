/**
 * Reflection Session Server Functions
 * API functions for managing 10-minute reflection sessions
 */

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { format } from 'date-fns'
import { prisma } from '../db'
import { authMiddleware } from './middleware'
import {
  checkSubscription,
  ensureTrialInitialized,
} from './services/subscription.service'
import type {
  SessionStatus,
  ReflectionSession,
  ReflectionTurn,
} from '../types/voice-session'
import { REFLECTION_CONFIG } from '../types/voice-session'

// ==========================================
// Helper Functions
// ==========================================

/**
 * Get start of day in user's timezone (or UTC)
 */
function getStartOfDay(date: Date = new Date()): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

// ==========================================
// Schemas
// ==========================================

const sessionIdSchema = z.object({ sessionId: z.string() })
const endSessionSchema = z.object({
  sessionId: z.string(),
  totalUserSpeakingTime: z.number().optional(),
})
const dateSchema = z.object({ date: z.string() })
const monthSchema = z.object({ year: z.number(), month: z.number() })
const paginationSchema = z.object({
  limit: z.number().optional(),
  cursor: z.string().optional(),
})
const updateTimeSchema = z.object({
  sessionId: z.string(),
  userSpeakingTime: z.number(),
})
const addTurnSchema = z.object({
  sessionId: z.string(),
  speaker: z.enum(['user', 'ai']),
  text: z.string(),
  audioUrl: z.string().optional(),
  startTime: z.number(),
  duration: z.number(),
})

// ==========================================
// Get Today's Reflection
// ==========================================

export const getTodayReflectionFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const today = getStartOfDay()

    const session = await prisma.reflectionSession.findUnique({
      where: {
        userId_date: {
          userId: context.user.id,
          date: today,
        },
      },
      include: {
        turns: {
          orderBy: { order: 'asc' },
        },
      },
    })

    return session as (ReflectionSession & { turns: ReflectionTurn[] }) | null
  })

// ==========================================
// Get Reflection by ID
// ==========================================

export const getReflectionByIdFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(sessionIdSchema)
  .handler(async ({ data, context }) => {
    const session = await prisma.reflectionSession.findFirst({
      where: {
        id: data.sessionId,
        userId: context.user.id,
      },
      include: {
        turns: {
          orderBy: { order: 'asc' },
        },
      },
    })

    if (!session) {
      throw new Error('Reflection not found')
    }

    return session as ReflectionSession & { turns: ReflectionTurn[] }
  })

// ==========================================
// Get Reflection by Date
// ==========================================

export const getReflectionByDateFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(dateSchema)
  .handler(async ({ data, context }) => {
    const date = getStartOfDay(new Date(data.date))

    const session = await prisma.reflectionSession.findUnique({
      where: {
        userId_date: {
          userId: context.user.id,
          date,
        },
      },
      include: {
        turns: {
          orderBy: { order: 'asc' },
        },
      },
    })

    return session as (ReflectionSession & { turns: ReflectionTurn[] }) | null
  })

// ==========================================
// Check Reflection Availability
// ==========================================

export const checkReflectionAvailabilityFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const today = getStartOfDay()

    // Check if there's an existing reflection today
    const existingSession = await prisma.reflectionSession.findUnique({
      where: {
        userId_date: {
          userId: context.user.id,
          date: today,
        },
      },
    })

    // Check if there was a deleted attempt today
    const deletedAttempt = await prisma.deletedReflectionAttempt.findUnique({
      where: {
        userId_date: {
          userId: context.user.id,
          date: today,
        },
      },
    })

    const hasExistingSession = !!existingSession
    const hasDeletedAttempt = !!deletedAttempt
    const canStartReflection = !hasExistingSession && !hasDeletedAttempt

    return {
      canStartReflection,
      hasExistingSession,
      existingSessionStatus: existingSession?.status as SessionStatus | null,
      hasUsedAttempt: hasDeletedAttempt,
      maxAttempts: REFLECTION_CONFIG.MAX_DAILY_ATTEMPTS,
    }
  })

// ==========================================
// Start New Reflection
// ==========================================

export const startReflectionFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    // Ensure trial is initialized
    await ensureTrialInitialized(context.user.id)

    // Check subscription
    const subCheck = await checkSubscription(context.user.id)
    if (!subCheck.canCreateSession) {
      throw new Error(
        subCheck.blockedReason === 'trial_expired'
          ? 'Your free trial has ended. Please subscribe to continue.'
          : 'Subscription required to create sessions.',
      )
    }

    const today = getStartOfDay()

    // Check if reflection already exists today
    const existing = await prisma.reflectionSession.findUnique({
      where: {
        userId_date: {
          userId: context.user.id,
          date: today,
        },
      },
    })

    if (existing) {
      // If reflection is completed, can't start new one
      if (existing.status === 'completed') {
        throw new Error('You already have a completed reflection today.')
      }
      // If reflection is active or paused, return it
      if (existing.status === 'active' || existing.status === 'paused') {
        return existing as ReflectionSession
      }
    }

    // Skip attempt limits for admins (for testing/development)
    const isAdmin = context.user.role === 'admin'

    if (!isAdmin) {
      // Check if there was a deleted reflection today (user already used their 1 attempt)
      const deletedAttempt = await prisma.deletedReflectionAttempt.findUnique({
        where: {
          userId_date: {
            userId: context.user.id,
            date: today,
          },
        },
      })

      // Reflections only allow 1 attempt per day to protect costs
      if (deletedAttempt) {
        throw new Error(
          'You have already used your reflection for today. Come back tomorrow!',
        )
      }
    }

    // Create new reflection session
    const session = await prisma.reflectionSession.create({
      data: {
        userId: context.user.id,
        date: today,
        status: 'active',
        maxDuration: REFLECTION_CONFIG.MAX_DURATION_SECONDS,
        recordingAttempt: 1,
      },
    })

    return session as ReflectionSession
  })

// ==========================================
// End Reflection
// ==========================================

export const endReflectionFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(endSessionSchema)
  .handler(async ({ data, context }) => {
    const session = await prisma.reflectionSession.findFirst({
      where: {
        id: data.sessionId,
        userId: context.user.id,
      },
    })

    if (!session) {
      throw new Error('Reflection not found')
    }

    if (session.status === 'completed') {
      throw new Error('Reflection is already completed')
    }

    // Update session to processing status with duration atomically
    const updated = await prisma.reflectionSession.update({
      where: { id: session.id },
      data: {
        status: 'processing',
        completedAt: new Date(),
        // Save duration atomically - use provided value or keep existing
        ...(data.totalUserSpeakingTime !== undefined && {
          totalUserSpeakingTime: data.totalUserSpeakingTime,
        }),
      },
    })

    return updated as ReflectionSession
  })

// ==========================================
// Pause Reflection (for disconnection)
// ==========================================

export const pauseReflectionFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(sessionIdSchema)
  .handler(async ({ data, context }) => {
    const session = await prisma.reflectionSession.findFirst({
      where: {
        id: data.sessionId,
        userId: context.user.id,
        status: 'active',
      },
    })

    if (!session) {
      throw new Error('Active reflection not found')
    }

    const updated = await prisma.reflectionSession.update({
      where: { id: session.id },
      data: {
        status: 'paused',
        pausedAt: new Date(),
      },
    })

    return updated as ReflectionSession
  })

// ==========================================
// Resume Reflection
// ==========================================

export const resumeReflectionFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(sessionIdSchema)
  .handler(async ({ data, context }) => {
    const session = await prisma.reflectionSession.findFirst({
      where: {
        id: data.sessionId,
        userId: context.user.id,
        status: 'paused',
      },
    })

    if (!session) {
      throw new Error('Paused reflection not found')
    }

    // Check if reconnection timeout has passed (5 minutes)
    if (session.pausedAt) {
      const pausedTime = Date.now() - session.pausedAt.getTime()
      const timeoutMs = REFLECTION_CONFIG.RECONNECTION_TIMEOUT_SECONDS * 1000

      if (pausedTime > timeoutMs) {
        // Session expired, lock it
        await prisma.reflectionSession.update({
          where: { id: session.id },
          data: {
            status: 'processing',
            completedAt: new Date(),
          },
        })
        throw new Error('Reflection timeout exceeded. Session has been locked.')
      }
    }

    const updated = await prisma.reflectionSession.update({
      where: { id: session.id },
      data: {
        status: 'active',
        pausedAt: null,
      },
    })

    return updated as ReflectionSession
  })

// ==========================================
// Delete Reflection
// ==========================================

export const deleteReflectionFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(sessionIdSchema)
  .handler(async ({ data, context }) => {
    console.log('[Delete Reflection] Starting deletion for:', data.sessionId)

    const session = await prisma.reflectionSession.findFirst({
      where: {
        id: data.sessionId,
        userId: context.user.id,
      },
    })

    if (!session) {
      console.error('[Delete Reflection] Session not found:', data.sessionId)
      throw new Error('Reflection not found')
    }

    console.log('[Delete Reflection] Found session:', {
      id: session.id,
      status: session.status,
      date: session.date,
    })

    const isCompleted = session.status === 'completed'

    // Track deleted attempt only for non-completed sessions (to prevent re-recording abuse)
    // Completed sessions can be deleted freely but still counts as used attempt
    if (!isCompleted) {
      const sessionDate = getStartOfDay(session.date)
      await prisma.deletedReflectionAttempt.upsert({
        where: {
          userId_date: {
            userId: context.user.id,
            date: sessionDate,
          },
        },
        create: {
          userId: context.user.id,
          date: sessionDate,
        },
        update: {}, // No update needed, just ensure the record exists
      })
    }

    // Delete from Bunny.net (audio files if any)
    try {
      const { deleteSessionFiles } = await import('./services/bunny.service')
      await deleteSessionFiles(context.user.id, session.id)
      console.log('[Delete Reflection] CDN files deleted')
    } catch (error) {
      console.error('[Delete Reflection] Failed to delete CDN files:', error)
      // Continue with database deletion even if CDN deletion fails
    }

    // Delete from database (cascade will delete turns)
    await prisma.reflectionSession.delete({
      where: { id: session.id },
    })

    console.log('[Delete Reflection] Session deleted successfully')
    return { success: true }
  })

// ==========================================
// Cancel Short Reflection (doesn't count as attempt)
// ==========================================

/**
 * Cancel a reflection that was too short (< 60 seconds)
 * This doesn't count as a used attempt - the user can try again
 */
export const cancelShortReflectionFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(sessionIdSchema)
  .handler(async ({ data, context }) => {
    const session = await prisma.reflectionSession.findFirst({
      where: {
        id: data.sessionId,
        userId: context.user.id,
        status: 'active', // Can only cancel active sessions
      },
    })

    if (!session) {
      throw new Error('Active reflection not found')
    }

    // Delete from Bunny.net (audio files if any)
    try {
      const { deleteSessionFiles } = await import('./services/bunny.service')
      await deleteSessionFiles(context.user.id, session.id)
    } catch (error) {
      console.error('Failed to delete reflection files from CDN:', error)
      // Continue with database deletion even if CDN deletion fails
    }

    // Delete from database (cascade will delete turns)
    // Note: We don't track this as a deleted attempt since it was too short
    await prisma.reflectionSession.delete({
      where: { id: session.id },
    })

    return { success: true, cancelled: true }
  })

// ==========================================
// Update Reflection Time
// ==========================================

export const updateReflectionTimeFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(updateTimeSchema)
  .handler(async ({ data, context }) => {
    const session = await prisma.reflectionSession.findFirst({
      where: {
        id: data.sessionId,
        userId: context.user.id,
        status: 'active',
      },
    })

    if (!session) {
      throw new Error('Active reflection not found')
    }

    // Check if time limit reached
    if (data.userSpeakingTime >= session.maxDuration) {
      // Lock the session
      const updated = await prisma.reflectionSession.update({
        where: { id: session.id },
        data: {
          status: 'processing',
          totalUserSpeakingTime: session.maxDuration,
          completedAt: new Date(),
        },
      })
      return { session: updated as ReflectionSession, timeLimitReached: true }
    }

    const updated = await prisma.reflectionSession.update({
      where: { id: session.id },
      data: {
        totalUserSpeakingTime: data.userSpeakingTime,
      },
    })

    return { session: updated as ReflectionSession, timeLimitReached: false }
  })

// ==========================================
// Add Reflection Turn
// ==========================================

export const addReflectionTurnFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(addTurnSchema)
  .handler(async ({ data, context }) => {
    const session = await prisma.reflectionSession.findFirst({
      where: {
        id: data.sessionId,
        userId: context.user.id,
      },
    })

    if (!session) {
      throw new Error('Reflection not found')
    }

    if (session.status !== 'active' && session.status !== 'processing') {
      throw new Error('Cannot add turns to this reflection')
    }

    // Get the next order number
    const lastTurn = await prisma.reflectionTurn.findFirst({
      where: { sessionId: session.id },
      orderBy: { order: 'desc' },
    })

    const order = (lastTurn?.order ?? -1) + 1

    const turn = await prisma.reflectionTurn.create({
      data: {
        sessionId: session.id,
        speaker: data.speaker,
        text: data.text,
        audioUrl: data.audioUrl || null,
        startTime: data.startTime,
        duration: data.duration,
        order,
      },
    })

    return turn as ReflectionTurn
  })

// ==========================================
// Get Reflections for Calendar
// ==========================================

export const getReflectionsForMonthFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(monthSchema)
  .handler(async ({ data, context }) => {
    // Get first and last day of month
    const startDate = new Date(data.year, data.month - 1, 1)
    const endDate = new Date(data.year, data.month, 0, 23, 59, 59, 999)

    const sessions = await prisma.reflectionSession.findMany({
      where: {
        userId: context.user.id,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        id: true,
        date: true,
        status: true,
        totalUserSpeakingTime: true,
      },
      orderBy: { date: 'asc' },
    })

    // Convert to map by date string
    const sessionsByDate: Record<
      string,
      {
        id: string
        status: SessionStatus
        duration: number
      }
    > = {}

    for (const session of sessions) {
      const dateKey = format(session.date, 'yyyy-MM-dd')
      sessionsByDate[dateKey] = {
        id: session.id,
        status: session.status as SessionStatus,
        duration: session.totalUserSpeakingTime,
      }
    }

    return sessionsByDate
  })

// ==========================================
// Get Recent Reflections List
// ==========================================

export const getRecentReflectionsFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(paginationSchema)
  .handler(async ({ data, context }) => {
    const limit = data.limit || 10

    const sessions = await prisma.reflectionSession.findMany({
      where: {
        userId: context.user.id,
        ...(data.cursor ? { id: { lt: data.cursor } } : {}),
      },
      orderBy: { date: 'desc' },
      take: limit + 1, // Get one extra to check if there's more
      select: {
        id: true,
        date: true,
        status: true,
        totalUserSpeakingTime: true,
        summaryText: true,
      },
    })

    const hasMore = sessions.length > limit
    if (hasMore) {
      sessions.pop() // Remove the extra item
    }

    return {
      sessions: sessions as Array<{
        id: string
        date: Date
        status: SessionStatus
        totalUserSpeakingTime: number
        summaryText: string | null
      }>,
      hasMore,
      nextCursor: hasMore ? sessions[sessions.length - 1]?.id : undefined,
    }
  })
