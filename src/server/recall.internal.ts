/**
 * Mid-conversation Recall - Server-only
 *
 * Past moments (conversation notes/summaries, extracted insights, legacy
 * check-in summaries) are embedded into MemoryChunk rows. During a
 * conversation, each substantial user message triggers a semantic search over
 * the user's chunks; the hits are injected into the AI's NEXT reply.
 *
 * Searching in the background and using the previous turn's results keeps
 * time-to-first-audio unchanged: the embedding round-trip (~0.7s) never sits
 * in front of the LLM call. A few hundred chunks per user are searched in
 * plain JS from an in-memory cache.
 *
 * NOT wrapped in createServerFn — never import this from client code.
 */

import { prisma } from '../db'
import {
  bytesToVector,
  formatRecallBlock,
  isSearchworthy,
  mergeActiveHits,
  rankCandidates,
  vectorToBytes,
} from '../lib/prompts/recall'
import {
  EMBEDDING_MODEL,
  createEmbeddings,
} from './services/openrouter.service'
import { withLock } from './user-lock'
import type { ActiveHit, RecallCandidate } from '../lib/prompts/recall'

const EMBED_BATCH_SIZE = 96
const QUERY_TIMEOUT_MS = 5000
const QUERY_MAX_CHARS = 1200
// Sessions whose notes are already in the prompt verbatim (see memory brief).
const RECENT_NOTES_IN_BRIEF = 3
const USER_CACHE_TTL_MS = 30 * 60 * 1000
const SESSION_STATE_TTL_MS = 60 * 60 * 1000

const indexLockKey = (userId: string) => `recall-index:${userId}`

/** Serialize work with this user's recall indexing (used by memory deletion). */
export function withRecallIndexLock<T>(
  userId: string,
  fn: () => Promise<T>,
): Promise<T> {
  return withLock(indexLockKey(userId), fn)
}

// ==========================================
// Per-user chunk cache
// ==========================================

const chunkCache = new Map<
  string,
  { candidates: Array<RecallCandidate>; loadedAt: number }
>()

export function invalidateRecallCache(userId: string): void {
  chunkCache.delete(userId)
}

async function getCandidates(userId: string): Promise<Array<RecallCandidate>> {
  const now = Date.now()
  for (const [key, entry] of chunkCache) {
    if (now - entry.loadedAt > USER_CACHE_TTL_MS) chunkCache.delete(key)
  }
  const cached = chunkCache.get(userId)
  if (cached) return cached.candidates

  const rows = await prisma.memoryChunk.findMany({
    where: { userId, model: EMBEDDING_MODEL },
    select: {
      id: true,
      sessionId: true,
      voiceSessionId: true,
      kind: true,
      date: true,
      text: true,
      embedding: true,
    },
  })
  const candidates = rows.map((r) => ({
    id: r.id,
    sourceId: r.sessionId ?? r.voiceSessionId ?? r.id,
    kind: r.kind,
    date: r.date,
    text: r.text,
    vector: bytesToVector(r.embedding),
  }))
  chunkCache.set(userId, { candidates, loadedAt: now })
  return candidates
}

// ==========================================
// Indexing
// ==========================================

interface PendingChunk {
  userId: string
  sessionId?: string
  voiceSessionId?: string
  kind: string
  date: Date
  text: string
}

async function embedAndStore(chunks: Array<PendingChunk>): Promise<void> {
  for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
    const batch = chunks.slice(i, i + EMBED_BATCH_SIZE)
    const vectors = await createEmbeddings(batch.map((c) => c.text))
    await prisma.memoryChunk.createMany({
      data: batch.map((c, j) => ({
        userId: c.userId,
        sessionId: c.sessionId ?? null,
        voiceSessionId: c.voiceSessionId ?? null,
        kind: c.kind,
        date: c.date,
        text: c.text,
        embedding: vectorToBytes(vectors[j]),
        model: EMBEDDING_MODEL,
      })),
    })
  }
}

function chunksForConversation(s: {
  id: string
  userId: string
  date: Date
  memoryNote: string | null
  summaryText: string | null
  insights: Array<{ text: string; category: string }>
}): Array<PendingChunk> {
  const chunks: Array<PendingChunk> = []
  const main = s.memoryNote ?? s.summaryText
  if (main?.trim()) {
    chunks.push({
      userId: s.userId,
      sessionId: s.id,
      kind: s.memoryNote ? 'note' : 'summary',
      date: s.date,
      text: main.trim(),
    })
  }
  for (const insight of s.insights) {
    if (!insight.text.trim()) continue
    chunks.push({
      userId: s.userId,
      sessionId: s.id,
      kind: 'insight',
      date: s.date,
      text: `(${insight.category}) ${insight.text.trim()}`,
    })
  }
  return chunks
}

/**
 * (Re)index one completed conversation. Call after its memory note and
 * insights exist. Replaces any previous chunks for the session.
 */
export function indexConversation(
  sessionId: string,
  userId: string,
): Promise<void> {
  return withLock(indexLockKey(userId), async () => {
    const session = await prisma.reflectionSession.findFirst({
      where: {
        id: sessionId,
        userId,
        status: 'completed',
        memoryForgotten: false,
      },
      select: {
        id: true,
        userId: true,
        date: true,
        memoryNote: true,
        summaryText: true,
        insights: { select: { text: true, category: true } },
      },
    })
    if (!session) return

    const chunks = chunksForConversation(session)
    await prisma.memoryChunk.deleteMany({ where: { sessionId } })
    if (chunks.length > 0) await embedAndStore(chunks)
    invalidateRecallCache(userId)
    console.log(
      `[Recall] Indexed conversation ${sessionId}: ${chunks.length} chunks`,
    )
  })
}

/**
 * Index every past conversation and check-in that isn't indexed yet. Cheap
 * no-op once everything is indexed (two indexed lookups).
 */
export function ensureRecallIndex(userId: string): Promise<void> {
  return withLock(indexLockKey(userId), async () => {
    // After a wipe, legacy check-ins (which predate it by definition) stay out.
    const memory = await prisma.userMemory.findUnique({
      where: { userId },
      select: { wipedAt: true },
    })
    const [conversations, checkIns] = await Promise.all([
      prisma.reflectionSession.findMany({
        where: {
          userId,
          status: 'completed',
          memoryForgotten: false,
          OR: [{ memoryNote: { not: null } }, { summaryText: { not: null } }],
          memoryChunks: { none: {} },
        },
        select: {
          id: true,
          userId: true,
          date: true,
          memoryNote: true,
          summaryText: true,
          insights: { select: { text: true, category: true } },
        },
      }),
      memory?.wipedAt
        ? Promise.resolve([])
        : prisma.voiceSession.findMany({
            where: {
              userId,
              status: 'completed',
              summaryText: { not: null },
              memoryChunks: { none: {} },
            },
            select: { id: true, date: true, summaryText: true },
          }),
    ])
    if (conversations.length === 0 && checkIns.length === 0) return

    const chunks: Array<PendingChunk> = [
      ...conversations.flatMap(chunksForConversation),
      ...checkIns
        .filter((c) => c.summaryText?.trim())
        .map((c) => ({
          userId,
          voiceSessionId: c.id,
          kind: 'checkin',
          date: c.date,
          text: (c.summaryText ?? '').trim(),
        })),
    ]
    await embedAndStore(chunks)
    invalidateRecallCache(userId)
    console.log(
      `[Recall] Indexed ${conversations.length} conversations + ${checkIns.length} check-ins for user ${userId} (${chunks.length} chunks)`,
    )
  })
}

// ==========================================
// Per-conversation recall state
// ==========================================

interface SessionRecallState {
  userId: string
  active: Array<ActiveHit>
  searchCount: number
  /** Sources never surfaced: this session + those whose notes are in the brief */
  excluded: Set<string> | null
  inFlight: AbortController | null
  touchedAt: number
}

const sessionStates = new Map<string, SessionRecallState>()

function getState(sessionId: string, userId: string): SessionRecallState {
  const now = Date.now()
  for (const [key, st] of sessionStates) {
    if (now - st.touchedAt > SESSION_STATE_TTL_MS) sessionStates.delete(key)
  }
  let state = sessionStates.get(sessionId)
  if (!state || state.userId !== userId) {
    state = {
      userId,
      active: [],
      searchCount: 0,
      excluded: null,
      inFlight: null,
      touchedAt: now,
    }
    sessionStates.set(sessionId, state)
  }
  state.touchedAt = now
  return state
}

async function loadExcluded(
  sessionId: string,
  userId: string,
): Promise<Set<string>> {
  const recent = await prisma.reflectionSession.findMany({
    where: {
      userId,
      status: 'completed',
      memoryNote: { not: null },
      id: { not: sessionId },
    },
    orderBy: { date: 'desc' },
    take: RECENT_NOTES_IN_BRIEF,
    select: { id: true },
  })
  return new Set([sessionId, ...recent.map((r) => r.id)])
}

/**
 * The recall block for the reply being generated now (results of searches
 * triggered by earlier turns). Null when nothing relevant has come up.
 */
export function getRecallBlock(
  sessionId: string,
  userId: string,
): string | null {
  const state = sessionStates.get(sessionId)
  if (!state || state.userId !== userId) return null
  return formatRecallBlock(state.active)
}

/**
 * Fire-and-forget: search past moments related to what the user just said
 * (plus their previous message for context) and update the session's
 * rolling hit set for the next reply.
 */
export function scheduleRecallSearch(params: {
  sessionId: string
  userId: string
  userMessage: string
  previousUserMessage?: string
}): void {
  const { sessionId, userId, userMessage, previousUserMessage } = params
  if (!isSearchworthy(userMessage)) return

  const state = getState(sessionId, userId)
  state.inFlight?.abort()
  const controller = new AbortController()
  state.inFlight = controller
  const timeout = setTimeout(() => controller.abort(), QUERY_TIMEOUT_MS)

  void (async () => {
    const started = Date.now()
    const query = [previousUserMessage, userMessage]
      .filter(Boolean)
      .join('\n')
      .slice(-QUERY_MAX_CHARS)

    const [candidates, excluded] = await Promise.all([
      getCandidates(userId),
      state.excluded ?? loadExcluded(sessionId, userId),
    ])
    state.excluded = excluded
    if (candidates.length === 0) return

    const [vector] = await createEmbeddings([query], {
      signal: controller.signal,
    })
    if (controller.signal.aborted) return

    const fresh = rankCandidates(vector, candidates, {
      excludeSourceIds: excluded,
    })
    state.searchCount += 1
    state.active = mergeActiveHits(state.active, fresh, state.searchCount)

    console.log(
      `[Recall] Session ${sessionId}: ${fresh.length} new hit(s) ` +
        `[${fresh.map((h) => h.score.toFixed(2)).join(', ')}], ` +
        `${state.active.length} active, ${Date.now() - started}ms`,
    )
  })()
    .catch((error: unknown) => {
      if (controller.signal.aborted) return
      console.error('[Recall] Search failed:', error)
    })
    .finally(() => {
      clearTimeout(timeout)
      if (state.inFlight === controller) state.inFlight = null
    })
}

/** Forget a finished conversation's in-memory recall state. */
export function clearRecallState(sessionId: string): void {
  sessionStates.get(sessionId)?.inFlight?.abort()
  sessionStates.delete(sessionId)
}
