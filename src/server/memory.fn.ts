/**
 * Memory Server Functions
 *
 * Lets users see what the companion remembers about them (the long-term
 * profile and the notes from recent conversations) and delete it: single
 * profile items, a conversation's note, or everything.
 *
 * Deletions take the same per-user locks as the background memory merge and
 * recall indexing, so a merge running at the same time can't write deleted
 * content back.
 */

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { prisma } from '../db'
import { parseProfile, removeProfileItem } from '../lib/prompts/memory'
import { authMiddleware } from './middleware'
import { withMemoryLock } from './memory.internal'
import {
  clearRecallState,
  invalidateRecallCache,
  withRecallIndexLock,
} from './recall.internal'

const MAX_NOTES_SHOWN = 30

/** Today's cached opening line may mention what was just deleted. */
async function clearGreetingCache(userId: string): Promise<void> {
  await prisma.dailyReflectionGreeting.deleteMany({ where: { userId } })
}

// ==========================================
// Read
// ==========================================

export const getMemoryFn = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const userId = context.user.id
    const [memory, notes, chunkCount] = await Promise.all([
      prisma.userMemory.findUnique({ where: { userId } }),
      prisma.reflectionSession.findMany({
        where: { userId, memoryNote: { not: null } },
        orderBy: { date: 'desc' },
        take: MAX_NOTES_SHOWN,
        select: { id: true, date: true, memoryNote: true },
      }),
      prisma.memoryChunk.count({ where: { userId } }),
    ])

    return {
      sections: parseProfile(memory?.profile ?? null),
      updatedAt: memory?.updatedAt ?? null,
      wipedAt: memory?.wipedAt ?? null,
      sessionCount: memory?.sessionCount ?? 0,
      notes: notes.map((n) => ({
        sessionId: n.id,
        date: n.date,
        note: n.memoryNote ?? '',
      })),
      recallCount: chunkCount,
    }
  })

// ==========================================
// Delete one profile item
// ==========================================

export const deleteMemoryItemFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ heading: z.string(), item: z.string() }))
  .handler(async ({ data, context }) => {
    const userId = context.user.id
    await withMemoryLock(userId, async () => {
      const memory = await prisma.userMemory.findUnique({ where: { userId } })
      const next = memory
        ? removeProfileItem(memory.profile, data.heading, data.item)
        : null
      if (next === null) {
        throw new Error('That item no longer exists. Refresh and try again.')
      }
      await prisma.userMemory.update({
        where: { userId },
        data: { profile: next },
      })
    })
    await clearGreetingCache(userId)
    return { success: true }
  })

// ==========================================
// Forget one conversation
// ==========================================

export const forgetConversationFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ sessionId: z.string() }))
  .handler(async ({ data, context }) => {
    const userId = context.user.id
    await withMemoryLock(userId, () =>
      withRecallIndexLock(userId, async () => {
        const result = await prisma.reflectionSession.updateMany({
          where: { id: data.sessionId, userId },
          data: {
            memoryNote: null,
            memoryForgotten: true,
            // Never merge it into the profile later either.
            memoryMergedAt: new Date(),
          },
        })
        if (result.count === 0) throw new Error('Conversation not found')
        await prisma.memoryChunk.deleteMany({
          where: { userId, sessionId: data.sessionId },
        })
        invalidateRecallCache(userId)
      }),
    )
    await clearGreetingCache(userId)
    return { success: true }
  })

// ==========================================
// Wipe everything
// ==========================================

export const wipeMemoryFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const userId = context.user.id
    await withMemoryLock(userId, () =>
      withRecallIndexLock(userId, async () => {
        const now = new Date()
        const activeSessions = await prisma.reflectionSession.findMany({
          where: { userId, status: { in: ['active', 'paused'] } },
          select: { id: true },
        })

        await prisma.$transaction([
          // Keep an empty, already-backfilled row so the history is never
          // re-learned by the lazy backfill.
          prisma.userMemory.upsert({
            where: { userId },
            create: {
              userId,
              profile: '',
              sessionCount: 0,
              backfilledAt: now,
              wipedAt: now,
            },
            update: {
              profile: '',
              sessionCount: 0,
              backfilledAt: now,
              wipedAt: now,
            },
          }),
          // Every conversation so far (including one in progress or being
          // processed) is forgotten for good.
          prisma.reflectionSession.updateMany({
            where: { userId },
            data: {
              memoryNote: null,
              memoryForgotten: true,
              memoryMergedAt: now,
            },
          }),
          // A conversation in progress drops the memory it started with.
          prisma.reflectionSession.updateMany({
            where: { userId, status: { in: ['active', 'paused'] } },
            data: { contextBrief: null },
          }),
          prisma.memoryChunk.deleteMany({ where: { userId } }),
        ])

        invalidateRecallCache(userId)
        for (const s of activeSessions) clearRecallState(s.id)
      }),
    )
    await clearGreetingCache(userId)
    return { success: true }
  })
