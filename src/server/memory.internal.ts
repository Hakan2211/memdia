/**
 * Long-term Memory - Server-only
 *
 * Maintains each user's living profile (UserMemory) and per-session notes
 * (ReflectionSession.memoryNote):
 *
 * - `updateMemoryAfterSession` runs after every completed conversation: one LLM
 *   call writes the session note and merges the conversation into the profile.
 * - `backfillUserMemory` builds the profile once from ALL past conversations and
 *   legacy 3-minute check-ins (summaries + extracted details), and writes notes
 *   for the most recent past conversations. Runs lazily the first time a user
 *   visits the conversation page after this shipped (and before the first
 *   post-session merge), so no deploy-time script is needed. Also exposed via
 *   `scripts/backfill-memory.ts` for running it locally.
 * - `loadMemoryContext` / `generateOpeningLine` read memory for the prompt and
 *   for a personal opening line.
 *
 * All writes for one user are serialized with an in-process lock (the app runs
 * as a single long-lived Node server), so a backfill and a post-session merge
 * can't overwrite each other's profile.
 *
 * NOT wrapped in createServerFn — never import this from client code.
 */

import { prisma } from '../db'
import {
  buildBackfillMessages,
  buildOpeningLineMessages,
  buildSessionMemoryMessages,
  buildSessionNoteMessages,
  cleanOpeningLine,
  parseBackfillResult,
  parseNoteResult,
  parseSessionMemoryResult,
} from '../lib/prompts/memory'
import { formatTranscriptForSummary } from '../lib/prompts/summary'
import {
  OPENROUTER_MODELS,
  chatCompletion,
} from './services/openrouter.service'
import { isLocked, withLock } from './user-lock'
import { ensureRecallIndex } from './recall.internal'
import type { RecentNote, SessionDigest } from '../lib/prompts/memory'

// How many past session notes go verbatim into the next conversation.
const RECENT_NOTES = 3
const MAX_TODOS = 8
// Sessions per backfill LLM call.
const BACKFILL_BATCH_SIZE = 12
// Minimum transcript length worth remembering.
const MIN_TRANSCRIPT_CHARS = 200
// The opening line is generated while the page idles; never let it hang.
const OPENING_LINE_TIMEOUT_MS = 8000

const MEMORY_MODEL = OPENROUTER_MODELS.GEMINI_38_FLASH

const memoryLockKey = (userId: string) => `memory:${userId}`

function withUserLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  return withLock(memoryLockKey(userId), fn)
}

// ==========================================
// Helpers
// ==========================================

async function getUserLanguage(userId: string): Promise<string> {
  const prefs = await prisma.userPreferences.findUnique({
    where: { userId },
    select: { language: true },
  })
  return prefs?.language || 'en'
}

function transcriptOf(turns: Array<{ speaker: string; text: string }>): string {
  return formatTranscriptForSummary(
    turns.map((t) => ({ speaker: t.speaker as 'user' | 'ai', text: t.text })),
  )
}

// ==========================================
// Backfill
// ==========================================

/**
 * Build the user's profile from their whole history. Idempotent: does nothing
 * once `backfilledAt` is set. `excludeSessionId` keeps the session currently
 * being merged out of the backfill (it gets merged right after, from its full
 * transcript).
 */
async function backfillUnlocked(
  userId: string,
  excludeSessionId?: string,
): Promise<boolean> {
  const existing = await prisma.userMemory.findUnique({ where: { userId } })
  if (existing?.backfilledAt) return true

  const language = await getUserLanguage(userId)

  const [reflections, checkIns] = await Promise.all([
    prisma.reflectionSession.findMany({
      where: {
        userId,
        status: 'completed',
        summaryText: { not: null },
        memoryMergedAt: null,
        ...(excludeSessionId ? { id: { not: excludeSessionId } } : {}),
      },
      orderBy: { date: 'asc' },
      include: { mood: true, insights: true, references: true },
    }),
    prisma.voiceSession.findMany({
      where: { userId, status: 'completed', summaryText: { not: null } },
      orderBy: { date: 'asc' },
      select: { date: true, summaryText: true },
    }),
  ])

  const digests: Array<SessionDigest & { reflectionId?: string }> = [
    ...reflections.map((s) => {
      const details: Array<string> = []
      if (s.mood) details.push(`Mood: ${s.mood.mood}`)
      if (s.insights.length > 0) {
        details.push(
          `Insights/views: ${s.insights.map((i) => `(${i.category}) ${i.text}`).join('; ')}`,
        )
      }
      if (s.references.length > 0) {
        details.push(
          `Discussed: ${s.references.map((r) => `${r.name} (${r.kind})`).join(', ')}`,
        )
      }
      return {
        date: s.date,
        kind: 'conversation' as const,
        summary: s.summaryText ?? '',
        details: details.join('\n') || undefined,
        reflectionId: s.id,
      }
    }),
    ...checkIns.map((s) => ({
      date: s.date,
      kind: 'check-in' as const,
      summary: s.summaryText ?? '',
    })),
  ]
    .filter((d) => d.summary.trim().length > 0)
    .sort((a, b) => a.date.getTime() - b.date.getTime())

  console.log(
    `[Memory] Backfilling user ${userId}: ${reflections.length} conversations, ${checkIns.length} check-ins`,
  )

  let profile: string | null = existing?.profile || null
  let merged = 0
  const mergedReflectionIds: Array<string> = []

  for (let i = 0; i < digests.length; i += BACKFILL_BATCH_SIZE) {
    const batch = digests.slice(i, i + BACKFILL_BATCH_SIZE)
    try {
      const raw = await chatCompletion(
        buildBackfillMessages({ profile, digests: batch, language }),
        {
          model: MEMORY_MODEL,
          maxTokens: 6000,
          reasoningEffort: 'low',
          temperature: 0.3,
        },
      )
      const next = parseBackfillResult(raw, profile)
      if (!next) {
        console.error(
          `[Memory] Backfill batch ${i / BACKFILL_BATCH_SIZE + 1} rejected for user ${userId}`,
        )
        continue
      }
      profile = next
      merged += batch.length
      for (const d of batch) {
        if (d.reflectionId) mergedReflectionIds.push(d.reflectionId)
      }
    } catch (error) {
      console.error('[Memory] Backfill batch failed:', error)
    }
  }

  // Leave `backfilledAt` unset if there was history but nothing could be
  // merged, so a later visit retries instead of silently forgetting it all.
  if (digests.length > 0 && merged === 0) {
    console.error(`[Memory] Backfill produced nothing for user ${userId}`)
    return false
  }

  const now = new Date()
  await prisma.userMemory.upsert({
    where: { userId },
    create: {
      userId,
      profile: profile ?? '',
      sessionCount: merged,
      backfilledAt: now,
    },
    update: {
      profile: profile ?? '',
      sessionCount: { increment: merged },
      backfilledAt: now,
    },
  })
  if (mergedReflectionIds.length > 0) {
    await prisma.reflectionSession.updateMany({
      where: { id: { in: mergedReflectionIds } },
      data: { memoryMergedAt: now },
    })
  }

  // Notes for the most recent past conversations, so "last time..." works
  // from the very first conversation after the backfill.
  const recent = await prisma.reflectionSession.findMany({
    where: {
      userId,
      status: 'completed',
      memoryNote: null,
      ...(excludeSessionId ? { id: { not: excludeSessionId } } : {}),
    },
    orderBy: { date: 'desc' },
    take: RECENT_NOTES,
    include: { turns: { orderBy: { order: 'asc' } } },
  })
  for (const s of recent) {
    const transcript = transcriptOf(s.turns)
    if (transcript.length < MIN_TRANSCRIPT_CHARS) continue
    try {
      const raw = await chatCompletion(
        buildSessionNoteMessages({ transcript, date: s.date, language }),
        {
          model: MEMORY_MODEL,
          maxTokens: 2000,
          reasoningEffort: 'low',
          temperature: 0.3,
        },
      )
      const note = parseNoteResult(raw)
      if (note) {
        await prisma.reflectionSession.update({
          where: { id: s.id },
          data: { memoryNote: note },
        })
      }
    } catch (error) {
      console.error(`[Memory] Backfill note failed for session ${s.id}:`, error)
    }
  }

  console.log(
    `[Memory] Backfill done for user ${userId}: merged ${merged}/${digests.length} sessions`,
  )
  return true
}

/** Returns false if there was history that couldn't be merged (retry later). */
export function backfillUserMemory(userId: string): Promise<boolean> {
  return withUserLock(userId, () => backfillUnlocked(userId))
}

/**
 * Fire-and-forget: make sure the user's history has been folded into memory
 * and the recall index. Cheap when already done (a few indexed lookups).
 */
export function ensureUserMemoryInBackground(userId: string): void {
  void (async () => {
    // A backfill/merge is already running; it indexes when it's done.
    if (isLocked(memoryLockKey(userId))) return
    const memory = await prisma.userMemory.findUnique({
      where: { userId },
      select: { backfilledAt: true },
    })
    if (!memory?.backfilledAt) await backfillUserMemory(userId)
    // After the backfill, so past conversations are indexed with their notes.
    await ensureRecallIndex(userId)
  })().catch((error) => {
    console.error('[Memory] Background backfill failed:', error)
  })
}

// ==========================================
// After-session update
// ==========================================

/**
 * Write the session note and merge the finished conversation into the
 * profile. Safe to call more than once (skips sessions already merged).
 */
export function updateMemoryAfterSession(
  sessionId: string,
  userId: string,
): Promise<void> {
  return withUserLock(userId, async () => {
    // History first, so the first post-session merge doesn't start a fresh
    // profile that hides everything from before.
    const backfilled = await backfillUnlocked(userId, sessionId).catch(
      (error) => {
        console.error('[Memory] Backfill before merge failed:', error)
        return false
      },
    )

    const [session, memory, language] = await Promise.all([
      prisma.reflectionSession.findFirst({
        where: { id: sessionId, userId },
        include: { turns: { orderBy: { order: 'asc' } } },
      }),
      prisma.userMemory.findUnique({ where: { userId } }),
      getUserLanguage(userId),
    ])

    if (!session) return
    if (session.memoryMergedAt) {
      console.log(`[Memory] Session ${sessionId} already merged`)
      return
    }

    const transcript = transcriptOf(session.turns)
    if (transcript.length < MIN_TRANSCRIPT_CHARS) {
      console.log(`[Memory] Session ${sessionId} too short to remember`)
      return
    }

    const previous = memory?.profile || null
    const raw = await chatCompletion(
      buildSessionMemoryMessages({
        profile: previous,
        transcript,
        date: session.date,
        language,
      }),
      {
        model: MEMORY_MODEL,
        maxTokens: 8000,
        reasoningEffort: 'low',
        temperature: 0.3,
      },
    )
    const { note, profile } = parseSessionMemoryResult(raw, previous)

    if (note) {
      await prisma.reflectionSession.update({
        where: { id: sessionId },
        data: { memoryNote: note },
      })
    }

    if (!profile) {
      // Keep the old profile; session stays unmerged so it isn't lost.
      console.error(
        `[Memory] Profile update rejected for session ${sessionId} (note ${note ? 'saved' : 'missing'})`,
      )
      return
    }

    const now = new Date()
    await prisma.$transaction([
      prisma.userMemory.upsert({
        where: { userId },
        // If the backfill failed, leave backfilledAt unset so it's retried
        // (and folds the older history into this profile) on a later visit.
        create: {
          userId,
          profile,
          sessionCount: 1,
          backfilledAt: backfilled ? now : null,
        },
        update: { profile, sessionCount: { increment: 1 } },
      }),
      prisma.reflectionSession.update({
        where: { id: sessionId },
        data: { memoryMergedAt: now },
      }),
    ])

    console.log(
      `[Memory] Updated memory for user ${userId} from session ${sessionId} (profile ${profile.length} chars)`,
    )
  })
}

// ==========================================
// Reading memory
// ==========================================

export interface MemoryContext {
  profile: string | null
  recentNotes: Array<RecentNote>
  openTodos: Array<string>
}

export async function loadMemoryContext(
  userId: string,
): Promise<MemoryContext> {
  const [memory, notes, todos] = await Promise.all([
    prisma.userMemory.findUnique({
      where: { userId },
      select: { profile: true },
    }),
    prisma.reflectionSession.findMany({
      where: { userId, status: 'completed', memoryNote: { not: null } },
      orderBy: { date: 'desc' },
      take: RECENT_NOTES,
      select: { date: true, memoryNote: true },
    }),
    prisma.todo.findMany({
      where: { userId, completed: false },
      orderBy: { createdAt: 'desc' },
      take: MAX_TODOS,
      select: { text: true },
    }),
  ])

  return {
    profile: memory?.profile.trim() || null,
    recentNotes: notes.map((n) => ({ date: n.date, note: n.memoryNote ?? '' })),
    openTodos: todos.map((t) => t.text),
  }
}

/**
 * A personal opening line written from memory, or null (no memory yet, error,
 * or timeout) so the caller falls back to a static greeting.
 */
export async function generateOpeningLine(params: {
  userId: string
  language: string
  userName?: string
}): Promise<string | null> {
  try {
    const { profile, recentNotes } = await loadMemoryContext(params.userId)
    if (!profile && recentNotes.length === 0) return null

    const completion = chatCompletion(
      buildOpeningLineMessages({
        profile,
        recentNotes,
        language: params.language,
        userName: params.userName,
      }),
      {
        // Spoken aloud and generated only once a day (while the page idles),
        // so worth the smarter model: Flash Lite made grammar slips in German.
        model: MEMORY_MODEL,
        maxTokens: 1000,
        reasoningEffort: 'minimal',
        temperature: 0.8,
      },
    )
    const timeout = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), OPENING_LINE_TIMEOUT_MS),
    )
    const raw = await Promise.race([completion, timeout])
    if (raw === null) {
      console.warn('[Memory] Opening line timed out')
      completion.catch(() => {})
      return null
    }
    return cleanOpeningLine(raw)
  } catch (error) {
    console.error('[Memory] Failed to generate opening line:', error)
    return null
  }
}
