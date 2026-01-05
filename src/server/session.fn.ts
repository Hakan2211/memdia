/**
 * Voice Session Server Functions
 * API functions for managing voice sessions
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
  VoiceSession,
  TranscriptTurn,
  ImageStyle,
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
// Get Today's Session
// ==========================================

export const getTodaySessionFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const today = getStartOfDay()

    const session = await prisma.voiceSession.findUnique({
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

    return session as (VoiceSession & { turns: TranscriptTurn[] }) | null
  })

// ==========================================
// Get Session by ID
// ==========================================

export const getSessionByIdFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(sessionIdSchema)
  .handler(async ({ data, context }) => {
    const session = await prisma.voiceSession.findFirst({
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
      throw new Error('Session not found')
    }

    return session as VoiceSession & { turns: TranscriptTurn[] }
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

    return session as (VoiceSession & { turns: TranscriptTurn[] }) | null
  })

// ==========================================
// Start New Session
// ==========================================

export const startSessionFn = createServerFn({ method: 'POST' })
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

    // Check if session already exists today
    const existing = await prisma.voiceSession.findUnique({
      where: {
        userId_date: {
          userId: context.user.id,
          date: today,
        },
      },
    })

    if (existing) {
      // If session is completed, can't start new one
      if (existing.status === 'completed') {
        throw new Error('You already have a completed session today.')
      }
      // If session is active or paused, return it
      if (existing.status === 'active' || existing.status === 'paused') {
        return existing as VoiceSession
      }
    }

    // Check if there was a deleted session today (user already used one attempt)
    const deletedAttempt = await prisma.deletedSessionAttempt.findUnique({
      where: {
        userId_date: {
          userId: context.user.id,
          date: today,
        },
      },
    })

    // If there was a deleted attempt, this would be attempt 2
    // If there are 2 deleted attempts tracked (via multiple records somehow), block
    // Actually our schema only allows one record per day, so if it exists, this is attempt 2
    const recordingAttempt = deletedAttempt ? 2 : 1

    // Block if this would be attempt 3 (shouldn't happen with current schema, but defensive)
    if (recordingAttempt > 2) {
      throw new Error(
        'You have used all recording attempts for today. Come back tomorrow!',
      )
    }

    // Get user preferences for image style
    const preferences = await prisma.userPreferences.findUnique({
      where: { userId: context.user.id },
    })

    // Create new session
    const session = await prisma.voiceSession.create({
      data: {
        userId: context.user.id,
        date: today,
        status: 'active',
        maxDuration: subCheck.maxDurationSeconds,
        imageStyle: (preferences?.imageStyle as ImageStyle) || 'realistic',
        recordingAttempt,
      },
    })

    return session as VoiceSession
  })

// ==========================================
// End Session
// ==========================================

export const endSessionFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(sessionIdSchema)
  .handler(async ({ data, context }) => {
    const session = await prisma.voiceSession.findFirst({
      where: {
        id: data.sessionId,
        userId: context.user.id,
      },
    })

    if (!session) {
      throw new Error('Session not found')
    }

    if (session.status === 'completed') {
      throw new Error('Session is already completed')
    }

    // Update session to processing status
    const updated = await prisma.voiceSession.update({
      where: { id: session.id },
      data: {
        status: 'processing',
        completedAt: new Date(),
      },
    })

    return updated as VoiceSession
  })

// ==========================================
// Pause Session (for disconnection)
// ==========================================

export const pauseSessionFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(sessionIdSchema)
  .handler(async ({ data, context }) => {
    const session = await prisma.voiceSession.findFirst({
      where: {
        id: data.sessionId,
        userId: context.user.id,
        status: 'active',
      },
    })

    if (!session) {
      throw new Error('Active session not found')
    }

    const updated = await prisma.voiceSession.update({
      where: { id: session.id },
      data: {
        status: 'paused',
        pausedAt: new Date(),
      },
    })

    return updated as VoiceSession
  })

// ==========================================
// Resume Session
// ==========================================

export const resumeSessionFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(sessionIdSchema)
  .handler(async ({ data, context }) => {
    const session = await prisma.voiceSession.findFirst({
      where: {
        id: data.sessionId,
        userId: context.user.id,
        status: 'paused',
      },
    })

    if (!session) {
      throw new Error('Paused session not found')
    }

    // Check if reconnection timeout has passed (5 minutes)
    if (session.pausedAt) {
      const pausedTime = Date.now() - session.pausedAt.getTime()
      const timeoutMs = 5 * 60 * 1000 // 5 minutes

      if (pausedTime > timeoutMs) {
        // Session expired, lock it
        await prisma.voiceSession.update({
          where: { id: session.id },
          data: {
            status: 'processing',
            completedAt: new Date(),
          },
        })
        throw new Error('Session timeout exceeded. Session has been locked.')
      }
    }

    const updated = await prisma.voiceSession.update({
      where: { id: session.id },
      data: {
        status: 'active',
        pausedAt: null,
      },
    })

    return updated as VoiceSession
  })

// ==========================================
// Delete Session
// ==========================================

export const deleteSessionFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(sessionIdSchema)
  .handler(async ({ data, context }) => {
    const session = await prisma.voiceSession.findFirst({
      where: {
        id: data.sessionId,
        userId: context.user.id,
      },
    })

    if (!session) {
      throw new Error('Session not found')
    }

    // Check if this is already attempt 2 - if so, block deletion (no more retries)
    if (session.recordingAttempt >= 2) {
      throw new Error(
        'You cannot delete this session. You have used all recording attempts for today.',
      )
    }

    // Track that this user has deleted a session for this date (uses one attempt)
    const sessionDate = getStartOfDay(session.date)
    await prisma.deletedSessionAttempt.upsert({
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

    // Delete from Bunny.net (audio files and image)
    try {
      const { deleteSessionFiles } = await import('./services/bunny.service')
      await deleteSessionFiles(context.user.id, session.id)
    } catch (error) {
      console.error('Failed to delete session files from CDN:', error)
      // Continue with database deletion even if CDN deletion fails
    }

    // Delete from database (cascade will delete turns)
    await prisma.voiceSession.delete({
      where: { id: session.id },
    })

    return { success: true, wasLastAttempt: false }
  })

// ==========================================
// Cancel Short Session (doesn't count as attempt)
// ==========================================

/**
 * Cancel a session that was too short (< 60 seconds)
 * This doesn't count as a used attempt - the user can try again
 */
export const cancelShortSessionFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(sessionIdSchema)
  .handler(async ({ data, context }) => {
    const session = await prisma.voiceSession.findFirst({
      where: {
        id: data.sessionId,
        userId: context.user.id,
        status: 'active', // Can only cancel active sessions
      },
    })

    if (!session) {
      throw new Error('Active session not found')
    }

    // Delete from Bunny.net (audio files if any)
    try {
      const { deleteSessionFiles } = await import('./services/bunny.service')
      await deleteSessionFiles(context.user.id, session.id)
    } catch (error) {
      console.error('Failed to delete session files from CDN:', error)
      // Continue with database deletion even if CDN deletion fails
    }

    // Delete from database (cascade will delete turns)
    // Note: We don't track this as a deleted attempt since it was too short
    await prisma.voiceSession.delete({
      where: { id: session.id },
    })

    return { success: true, cancelled: true }
  })

// ==========================================
// Update Session Time
// ==========================================

export const updateSessionTimeFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(updateTimeSchema)
  .handler(async ({ data, context }) => {
    const session = await prisma.voiceSession.findFirst({
      where: {
        id: data.sessionId,
        userId: context.user.id,
        status: 'active',
      },
    })

    if (!session) {
      throw new Error('Active session not found')
    }

    // Check if time limit reached
    if (data.userSpeakingTime >= session.maxDuration) {
      // Lock the session
      const updated = await prisma.voiceSession.update({
        where: { id: session.id },
        data: {
          status: 'processing',
          totalUserSpeakingTime: session.maxDuration,
          completedAt: new Date(),
        },
      })
      return { session: updated as VoiceSession, timeLimitReached: true }
    }

    const updated = await prisma.voiceSession.update({
      where: { id: session.id },
      data: {
        totalUserSpeakingTime: data.userSpeakingTime,
      },
    })

    return { session: updated as VoiceSession, timeLimitReached: false }
  })

// ==========================================
// Add Transcript Turn
// ==========================================

export const addTranscriptTurnFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(addTurnSchema)
  .handler(async ({ data, context }) => {
    const session = await prisma.voiceSession.findFirst({
      where: {
        id: data.sessionId,
        userId: context.user.id,
      },
    })

    if (!session) {
      throw new Error('Session not found')
    }

    if (session.status !== 'active' && session.status !== 'processing') {
      throw new Error('Cannot add turns to this session')
    }

    // Get the next order number
    const lastTurn = await prisma.transcriptTurn.findFirst({
      where: { sessionId: session.id },
      orderBy: { order: 'desc' },
    })

    const order = (lastTurn?.order ?? -1) + 1

    const turn = await prisma.transcriptTurn.create({
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

    return turn as TranscriptTurn
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

    const preferences = await prisma.userPreferences.upsert({
      where: { userId: context.user.id },
      update: updateData,
      create: {
        userId: context.user.id,
        timezone: data.timezone || 'UTC',
        imageStyle: data.imageStyle || 'realistic',
        aiPersonality: data.aiPersonality || 'empathetic',
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
    // Initialize trial if not done already
    await ensureTrialInitialized(context.user.id)

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
        trialEndsAt: true,
      },
    })

    return {
      onboardingComplete: user?.onboardingComplete ?? false,
      trialEndsAt: user?.trialEndsAt,
    }
  })

// ==========================================
// Trial Status
// ==========================================

export const getTrialStatusFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const user = await prisma.user.findUnique({
      where: { id: context.user.id },
      select: {
        trialEndsAt: true,
        subscriptionStatus: true,
      },
    })

    if (!user) {
      return {
        isTrialing: false,
        isSubscribed: false,
        trialExpired: false,
        daysRemaining: 0,
      }
    }

    const isSubscribed = user.subscriptionStatus === 'active'
    const now = new Date()
    const trialEndsAt = user.trialEndsAt

    if (!trialEndsAt) {
      return {
        isTrialing: false,
        isSubscribed,
        trialExpired: false,
        daysRemaining: 0,
      }
    }

    const isTrialing = trialEndsAt > now
    const trialExpired = !isTrialing && !isSubscribed
    const daysRemaining = isTrialing
      ? Math.ceil(
          (trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        )
      : 0

    return {
      isTrialing,
      isSubscribed,
      trialExpired,
      daysRemaining,
      trialEndsAt,
    }
  })
