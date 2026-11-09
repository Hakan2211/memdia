import { describe, expect, it } from 'vitest'
import {
  bytesToVector,
  formatRecallBlock,
  isSearchworthy,
  mergeActiveHits,
  rankCandidates,
  vectorToBytes,
} from './recall'
import type { RecallCandidate, RecallHit } from './recall'

const unit = (...xs: Array<number>) => {
  const n = Math.sqrt(xs.reduce((s, x) => s + x * x, 0))
  return Float32Array.from(xs.map((x) => x / n))
}

const cand = (
  id: string,
  sourceId: string,
  vector: Float32Array,
): RecallCandidate => ({
  id,
  sourceId,
  kind: 'insight',
  date: new Date('2026-10-01T00:00:00'),
  text: `text ${id}`,
  vector,
})

describe('rankCandidates', () => {
  const query = unit(1, 0, 0)
  const candidates = [
    cand('a', 's1', unit(1, 0.1, 0)),
    cand('b', 's1', unit(1, 0.2, 0)),
    cand('c', 's1', unit(1, 0.3, 0)),
    cand('d', 's2', unit(1, 0.5, 0)),
    cand('e', 's3', unit(0, 1, 0)), // unrelated
    cand('f', 'current', unit(1, 0, 0)), // excluded
  ]

  it('ranks by similarity, caps per source, drops excluded + low scores', () => {
    const hits = rankCandidates(query, candidates, {
      excludeSourceIds: new Set(['current']),
      k: 5,
    })
    expect(hits.map((h) => h.id)).toEqual(['a', 'b', 'd'])
  })

  it('drops duplicate texts from different sessions', () => {
    const dupes = [
      cand('x', 's1', unit(1, 0, 0)),
      cand('y', 's2', unit(1, 0.1, 0)),
    ]
    dupes[1].text = dupes[0].text
    expect(rankCandidates(query, dupes).map((h) => h.id)).toEqual(['x'])
  })

  it('respects k', () => {
    expect(rankCandidates(query, candidates, { k: 1 })).toHaveLength(1)
  })
})

describe('mergeActiveHits', () => {
  const hit = (id: string): RecallHit => ({
    id,
    sourceId: id,
    kind: 'note',
    date: new Date(),
    text: id,
    score: 0.5,
  })

  it('puts fresh hits first and expires stale ones', () => {
    let active = mergeActiveHits([], [hit('a'), hit('b')], 1)
    active = mergeActiveHits(active, [hit('c')], 2)
    expect(active.map((h) => h.id)).toEqual(['c', 'a', 'b'])
    active = mergeActiveHits(active, [], 3)
    active = mergeActiveHits(active, [], 4) // a, b last seen at 1 -> stale
    expect(active.map((h) => h.id)).toEqual(['c'])
  })

  it('refreshes a re-found hit instead of duplicating it', () => {
    let active = mergeActiveHits([], [hit('a')], 1)
    active = mergeActiveHits(active, [hit('a')], 2)
    expect(active).toHaveLength(1)
    expect(active[0].lastSeen).toBe(2)
  })

  it('caps the active set', () => {
    const active = mergeActiveHits([], ['a', 'b', 'c', 'd', 'e'].map(hit), 1, {
      maxActive: 4,
    })
    expect(active).toHaveLength(4)
  })
})

describe('formatRecallBlock', () => {
  it('returns null without hits and dates each hit', () => {
    expect(formatRecallBlock([])).toBeNull()
    const block = formatRecallBlock(
      [
        {
          id: 'a',
          sourceId: 's',
          kind: 'insight',
          date: new Date('2026-10-01T00:00:00'),
          text: '(view) Free will is compatible with determinism',
          score: 0.6,
        },
      ],
      new Date('2026-11-09T12:00:00'),
    )!
    expect(block).toContain('Oct 2026')
    expect(block).toContain('Free will is compatible')
  })
})

describe('helpers', () => {
  it('isSearchworthy skips very short utterances', () => {
    expect(isSearchworthy('yes')).toBe(false)
    expect(isSearchworthy('I keep thinking about free will')).toBe(true)
  })

  it('round-trips vectors through bytes', () => {
    const v = unit(0.3, -0.2, 0.9)
    expect(Array.from(bytesToVector(vectorToBytes(v)))).toEqual(Array.from(v))
  })
})
