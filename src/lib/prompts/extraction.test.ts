import { describe, expect, it } from 'vitest'
import { normalizeExtractionResult } from './extraction'

const base = {
  mood: { primary: 'curious', confidence: 0.8 },
  topics: ['Philosophy', 'free will', 'philosophy'],
  insights: [
    { text: 'I think meaning is created, not found', category: 'view' },
    { text: 'Can you be happy without being good?', category: 'question' },
  ],
  todos: [
    {
      text: 'Read Meditations',
      dueDate: null,
      priority: 'medium',
      context: null,
    },
  ],
  people: [{ name: 'Sarah', relationship: 'friend', sentiment: 'positive' }],
  references: [
    { name: 'Seneca', kind: 'thinker', note: 'On the shortness of life' },
    { name: 'Stoicism', kind: 'concept', note: null },
  ],
}

describe('normalizeExtractionResult', () => {
  it('passes a well-formed result through, deduping + lowercasing topics', () => {
    const result = normalizeExtractionResult(base)
    expect(result).not.toBeNull()
    expect(result!.mood).toEqual({ primary: 'curious', confidence: 0.8 })
    expect(result!.topics).toEqual(['philosophy', 'free will'])
    expect(result!.insights).toHaveLength(2)
    expect(result!.references).toEqual([
      { name: 'Seneca', kind: 'thinker', note: 'On the shortness of life' },
      { name: 'Stoicism', kind: 'concept', note: null },
    ])
  })

  it('accepts a null mood (purely intellectual conversation)', () => {
    const result = normalizeExtractionResult({ ...base, mood: null })
    expect(result!.mood).toBeNull()
  })

  it('treats an unknown mood as no mood instead of failing', () => {
    const result = normalizeExtractionResult({
      ...base,
      mood: { primary: 'philosophical', confidence: 0.9 },
    })
    expect(result).not.toBeNull()
    expect(result!.mood).toBeNull()
  })

  it('drops malformed items but keeps the rest', () => {
    const result = normalizeExtractionResult({
      ...base,
      insights: [
        { text: 'valid', category: 'realization' },
        { text: 'bad category', category: 'musing' },
        { category: 'idea' },
      ],
      people: [{ name: '' }, { name: 'Mom', sentiment: 'weird' }],
      references: [
        { name: 'Kant', kind: 'philosopher' },
        { name: 'Seneca', kind: 'thinker' },
        { name: 'seneca', kind: 'thinker' },
      ],
    })
    expect(result!.insights).toEqual([
      { text: 'valid', category: 'realization' },
    ])
    expect(result!.people).toEqual([
      { name: 'Mom', relationship: null, sentiment: 'neutral' },
    ])
    expect(result!.references).toEqual([
      { name: 'Seneca', kind: 'thinker', note: null },
    ])
  })

  it('tolerates missing arrays (older-style responses without references)', () => {
    const { references: _omit, ...withoutRefs } = base
    const result = normalizeExtractionResult(withoutRefs)
    expect(result!.references).toEqual([])
  })

  it('clamps confidence and drops unparseable due dates', () => {
    const result = normalizeExtractionResult({
      ...base,
      mood: { primary: 'calm', confidence: 7 },
      todos: [{ text: 'Call mom', dueDate: 'this weekend' }],
    })
    expect(result!.mood!.confidence).toBe(1)
    expect(result!.todos[0]).toEqual({
      text: 'Call mom',
      dueDate: null,
      priority: null,
      context: null,
    })
  })

  it('returns null for non-object responses', () => {
    expect(normalizeExtractionResult(null)).toBeNull()
    expect(normalizeExtractionResult('nope')).toBeNull()
    expect(normalizeExtractionResult([])).toBeNull()
  })
})
