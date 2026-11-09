/**
 * Recall - pure helpers
 *
 * Mid-conversation recall of relevant past moments: ranking embedded memory
 * chunks against what the user is saying now, keeping a small rolling set of
 * hits across turns, and formatting them for the prompt.
 *
 * Pure functions only (no I/O) so they can be unit-tested.
 */

import { describeWhen, formatMonth } from './memory'

export interface RecallCandidate {
  id: string
  /** Session (conversation or check-in) the chunk came from */
  sourceId: string
  kind: string
  date: Date
  text: string
  vector: Float32Array
}

export interface RecallHit {
  id: string
  sourceId: string
  kind: string
  date: Date
  text: string
  score: number
}

/** Below this cosine similarity a chunk isn't considered relevant (text-embedding-3-small). */
export const RECALL_MIN_SCORE = 0.35
/** Max hits surfaced from a single search. */
export const RECALL_TOP_K = 3
/** Max chunks from the same session in one search (diversity). */
export const RECALL_MAX_PER_SOURCE = 2
/** Max hits kept in the prompt at once. */
export const RECALL_MAX_ACTIVE = 4
/** A hit not re-found within this many searches is dropped. */
export const RECALL_HIT_TTL = 3

/** Dot product of two unit vectors = cosine similarity. */
export function dot(a: Float32Array, b: Float32Array): number {
  const n = Math.min(a.length, b.length)
  let sum = 0
  for (let i = 0; i < n; i++) sum += a[i] * b[i]
  return sum
}

/**
 * Rank candidates against a query vector: drop excluded sources,
 * low-scoring chunks and duplicate texts, cap per-source, return the best `k`.
 */
export function rankCandidates(
  query: Float32Array,
  candidates: Array<RecallCandidate>,
  options: {
    excludeSourceIds?: Set<string>
    minScore?: number
    k?: number
    maxPerSource?: number
  } = {},
): Array<RecallHit> {
  const minScore = options.minScore ?? RECALL_MIN_SCORE
  const k = options.k ?? RECALL_TOP_K
  const maxPerSource = options.maxPerSource ?? RECALL_MAX_PER_SOURCE

  const scored: Array<RecallHit> = []
  for (const c of candidates) {
    if (options.excludeSourceIds?.has(c.sourceId)) continue
    const score = dot(query, c.vector)
    if (score < minScore) continue
    scored.push({
      id: c.id,
      sourceId: c.sourceId,
      kind: c.kind,
      date: c.date,
      text: c.text,
      score,
    })
  }
  scored.sort((a, b) => b.score - a.score)

  const perSource = new Map<string, number>()
  const seenTexts = new Set<string>()
  const result: Array<RecallHit> = []
  for (const hit of scored) {
    // Identical texts (e.g. repeated check-ins) would crowd out everything else.
    const textKey = hit.text.replace(/\s+/g, ' ').trim().toLowerCase()
    if (seenTexts.has(textKey)) continue
    const count = perSource.get(hit.sourceId) ?? 0
    if (count >= maxPerSource) continue
    perSource.set(hit.sourceId, count + 1)
    seenTexts.add(textKey)
    result.push(hit)
    if (result.length >= k) break
  }
  return result
}

export interface ActiveHit extends RecallHit {
  /** Search counter value when this hit was last found */
  lastSeen: number
}

/**
 * Merge a new search's hits into the rolling set: fresh hits first (refreshing
 * ones already present), older hits kept until they go stale, capped in size.
 */
export function mergeActiveHits(
  active: Array<ActiveHit>,
  fresh: Array<RecallHit>,
  searchCount: number,
  options: { maxActive?: number; ttl?: number } = {},
): Array<ActiveHit> {
  const maxActive = options.maxActive ?? RECALL_MAX_ACTIVE
  const ttl = options.ttl ?? RECALL_HIT_TTL

  const freshIds = new Set(fresh.map((h) => h.id))
  const next: Array<ActiveHit> = fresh.map((h) => ({
    ...h,
    lastSeen: searchCount,
  }))
  for (const h of active) {
    if (freshIds.has(h.id)) continue
    if (searchCount - h.lastSeen >= ttl) continue
    next.push(h)
  }
  return next.slice(0, maxActive)
}

const KIND_LABELS: Record<string, string> = {
  note: 'your note from that conversation',
  summary: 'summary of that conversation',
  checkin: 'summary of a short daily check-in',
  insight: 'something they said',
}

/**
 * Format active hits as the context block placed right before the user's
 * latest message. Returns null when there's nothing to surface.
 */
export function formatRecallBlock(
  hits: Array<RecallHit>,
  now: Date = new Date(),
): string | null {
  if (hits.length === 0) return null
  const lines = [...hits]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .map((h) => {
      const when = `${describeWhen(h.date, now)}, ${formatMonth(h.date)}`
      const label = KIND_LABELS[h.kind] ?? h.kind
      return `- [${when} — ${label}] ${h.text.replace(/\s+/g, ' ').trim()}`
    })

  return `RECALLED FROM PAST CONVERSATIONS
These past moments came up because they relate to what the person is talking about right now. Use one only if it genuinely deepens this moment — e.g. noticing a pattern, a change of view, or a thread they left open ("back in March you said..."). Never mention searching, notes or a memory system, and never list them. Ignore them if they don't fit.
${lines.join('\n')}`
}

/** Should this utterance trigger a new search? Very short replies ("yes", "mm") make poor queries. */
export function isSearchworthy(text: string): boolean {
  return text.trim().split(/\s+/).filter(Boolean).length >= 4
}

/** Float32Array <-> bytes for SQLite storage. */
export function vectorToBytes(v: Float32Array): Uint8Array<ArrayBuffer> {
  const copy = new Float32Array(v)
  return new Uint8Array(copy.buffer)
}

export function bytesToVector(bytes: Uint8Array): Float32Array {
  // Copy to guarantee 4-byte alignment of the underlying buffer.
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return new Float32Array(copy.buffer)
}
