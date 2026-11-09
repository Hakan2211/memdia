/**
 * Voice Session (legacy check-in archive) + user preference server functions
 *
 * 3-minute VoiceSessions are no longer created — they were merged into
 * Conversations (ReflectionSession). What remains here is read/delete access
 * to the archive, plus user preferences, onboarding and subscription status.
 */

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { format } from 'date-fns'
import { prisma } from '../db'
import { authMiddleware } from './middleware'
import type {
  SessionStatus,
  TranscriptTurn,
  VoiceSession,
} from '../types/voice-session'

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
const dateSchema = z.object({ date: z.string() })
const monthSchema = z.object({ year: z.number(), month: z.number() })
const paginationSchema = z.object({
  limit: z.number().optional(),
  cursor: z.string().optional(),
})
const updatePreferencesSchema = z.object({
  timezone: z.string().optional(),
  imageStyle: z.string().optional(),
  aiPersonality: z.string().optional(),
  language: z.string().optional(),
})

// ==========================================
// Get Session by Date
// ==========================================

export const getSessionByDateFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(dateSchema)
  .handler(async ({ data, context }) => {
    const date = getStartOfDay(new Date(data.date))

    const session = await prisma.voiceSession.findUnique({
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

    return session as (VoiceSession & { turns: Array<TranscriptTurn> }) | null
  })

// ==========================================
// Delete Session
// ==========================================

export const deleteSessionFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(sessionIdSchema)
  .handler(async ({ data, context }) => {
    console.log('[Delete Session] Starting deletion for:', data.sessionId)

    const session = await prisma.voiceSession.findFirst({
      where: {
        id: data.sessionId,
        userId: context.user.id,
      },
    })

    if (!session) {
      console.error('[Delete Session] Session not found:', data.sessionId)
      throw new Error('Session not found')
    }

    console.log('[Delete Session] Found session:', {
      id: session.id,
      status: session.status,
      recordingAttempt: session.recordingAttempt,
      date: session.date,
    })

    // Delete from Bunny.net (audio files and image)
    try {
      const { deleteSessionFiles } = await import('./services/bunny.service')
      await deleteSessionFiles(context.user.id, session.id)
      console.log('[Delete Session] CDN files deleted')
    } catch (error) {
      console.error('[Delete Session] Failed to delete CDN files:', error)
      // Continue with database deletion even if CDN deletion fails
    }

    // Delete from database (cascade will delete turns)
    await prisma.voiceSession.delete({
      where: { id: session.id },
    })

    console.log('[Delete Session] Session deleted successfully')
    return { success: true }
  })

// ==========================================
// Get Sessions for Calendar
// ==========================================

export const getSessionsForMonthFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(monthSchema)
  .handler(async ({ data, context }) => {
    // Get first and last day of month
    const startDate = new Date(data.year, data.month - 1, 1)
    const endDate = new Date(data.year, data.month, 0, 23, 59, 59, 999)

    const sessions = await prisma.voiceSession.findMany({
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
        imageUrl: true,
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
        imageUrl: string | null
        duration: number
      }
    > = {}

    for (const session of sessions) {
      const dateKey = format(session.date, 'yyyy-MM-dd')
      sessionsByDate[dateKey] = {
        id: session.id,
        status: session.status as SessionStatus,
        imageUrl: session.imageUrl,
        duration: session.totalUserSpeakingTime,
      }
    }

    return sessionsByDate
  })

// ==========================================
// Get Recent Sessions List
// ==========================================

export const getRecentSessionsFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(paginationSchema)
  .handler(async ({ data, context }) => {
    const limit = data.limit || 10

    const sessions = await prisma.voiceSession.findMany({
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
        imageUrl: true,
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
        imageUrl: string | null
        totalUserSpeakingTime: number
        summaryText: string | null
      }>,
      hasMore,
      nextCursor: hasMore ? sessions[sessions.length - 1]?.id : undefined,
    }
  })

// ==========================================
// User Preferences
// ==========================================

export const getUserPreferencesFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    let preferences = await prisma.userPreferences.findUnique({
      where: { userId: context.user.id },
    })

    // Create default preferences if none exist
    if (!preferences) {
      preferences = await prisma.userPreferences.create({
        data: {
          userId: context.user.id,
          timezone: 'UTC',
          imageStyle: 'realistic',
          aiPersonality: 'empathetic',
          language: 'en',
        },
      })
    }

    return preferences
  })

export const updateUserPreferencesFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(updatePreferencesSchema)
  .handler(async ({ data, context }) => {
    const updateData: Record<string, string> = {}
    if (data.timezone) updateData.timezone = data.timezone
    if (data.imageStyle) updateData.imageStyle = data.imageStyle
    if (data.aiPersonality) updateData.aiPersonality = data.aiPersonality
    if (data.language) updateData.language = data.language

    const preferences = await prisma.userPreferences.upsert({
      where: { userId: context.user.id },
      update: updateData,
      create: {
        userId: context.user.id,
        timezone: data.timezone || 'UTC',
        imageStyle: data.imageStyle || 'realistic',
        aiPersonality: data.aiPersonality || 'empathetic',
        language: data.language || 'en',
      },
    })

    return preferences
  })

// ==========================================
// Onboarding
// ==========================================

export const completeOnboardingFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    // Mark onboarding as complete
    const user = await prisma.user.update({
      where: { id: context.user.id },
      data: { onboardingComplete: true },
    })

    return { success: true, user }
  })

export const getOnboardingStatusFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const user = await prisma.user.findUnique({
      where: { id: context.user.id },
      select: {
        onboardingComplete: true,
      },
    })

    return {
      onboardingComplete: user?.onboardingComplete ?? false,
    }
  })

// ==========================================
// Subscription Status
// ==========================================

export const getSubscriptionStatusFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const user = await prisma.user.findUnique({
      where: { id: context.user.id },
      select: {
        subscriptionStatus: true,
        subscriptionTier: true,
        subscriptionPeriodEnd: true,
        cancelAtPeriodEnd: true,
      },
    })

    if (!user) {
      return {
        isSubscribed: false,
        tier: null,
        status: 'none' as const,
        periodEnd: null,
        cancelAtPeriodEnd: false,
      }
    }

    const isSubscribed = user.subscriptionStatus === 'active'

    return {
      isSubscribed,
      tier: isSubscribed ? user.subscriptionTier : null,
      status: (user.subscriptionStatus ?? 'none') as
        | 'active'
        | 'canceled'
        | 'past_due'
        | 'none',
      periodEnd: user.subscriptionPeriodEnd,
      cancelAtPeriodEnd: user.cancelAtPeriodEnd,
    }
  })
