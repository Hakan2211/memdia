import { describe, expect, it } from 'vitest'
import {
  PROFILE_SECTIONS,
  buildMemoryBrief,
  cleanOpeningLine,
  describeWhen,
  parseSessionMemoryResult,
  validateProfile,
} from './memory'

const profile = PROFILE_SECTIONS.map(
  (s) => `## ${s}\n- something about ${s.toLowerCase()}`,
).join('\n\n')

describe('parseSessionMemoryResult', () => {
  it('extracts note and profile from tagged output', () => {
    const raw = `<note>\nExplored whether meaning is found or made. Leaned towards made.\n</note>\n<profile>\n${profile}\n</profile>`
    const result = parseSessionMemoryResult(raw, null)
    expect(result.note).toContain('meaning is found or made')
    expect(result.profile).toBe(profile)
  })

  it('tolerates code fences and a missing closing profile tag', () => {
    const raw =
      '```\n<note>A note that is long enough to keep.</note>\n<profile>\n' +
      profile
    const result = parseSessionMemoryResult(raw, null)
    expect(result.note).toBe('A note that is long enough to keep.')
    expect(result.profile).toBe(profile)
  })

  it('returns nulls for unusable output', () => {
    const result = parseSessionMemoryResult('Sorry, I cannot help.', null)
    expect(result).toEqual({ note: null, profile: null })
  })
})

describe('validateProfile', () => {
  it('rejects a profile missing most section headings', () => {
    expect(validateProfile('## People\n- Sarah', null)).toBeNull()
  })

  it('accepts a profile missing at most one heading', () => {
    const withoutOne = PROFILE_SECTIONS.slice(1)
      .map((s) => `## ${s}\n-`)
      .join('\n')
    expect(validateProfile(withoutOne, null)).not.toBeNull()
  })

  it('rejects a rewrite that drops most of a long previous profile', () => {
    const longPrevious = `${profile}\n${'- a detail worth keeping\n'.repeat(100)}`
    expect(validateProfile(profile, longPrevious)).toBeNull()
  })
})

describe('buildMemoryBrief', () => {
  const now = new Date('2026-11-09T12:00:00')

  it('returns null with nothing to inject', () => {
    expect(
      buildMemoryBrief({ profile: '', recentNotes: [], openTodos: [], now }),
    ).toBeNull()
  })

  it('includes profile, dated notes and todos', () => {
    const brief = buildMemoryBrief({
      profile,
      recentNotes: [
        {
          date: new Date('2026-11-08T00:00:00'),
          note: 'Got stuck on free will.',
        },
      ],
      openTodos: ['Call Mom'],
      now,
    })!
    expect(brief).toContain('## People')
    expect(brief).toContain('[yesterday')
    expect(brief).toContain('Got stuck on free will.')
    expect(brief).toContain('- Call Mom')
  })
})

describe('describeWhen', () => {
  const now = new Date('2026-11-09T12:00:00')
  it('labels relative days', () => {
    expect(describeWhen(new Date('2026-11-09T01:00:00'), now)).toBe(
      'earlier today',
    )
    expect(describeWhen(new Date('2026-11-08T23:00:00'), now)).toBe('yesterday')
    expect(describeWhen(new Date('2026-11-01T10:00:00'), now)).toBe('last week')
  })
})

describe('cleanOpeningLine', () => {
  it('strips surrounding quotes and whitespace', () => {
    expect(cleanOpeningLine('  "How did the talk with Mark go?"\n')).toBe(
      'How did the talk with Mark go?',
    )
  })

  it('rejects empty or runaway output', () => {
    expect(cleanOpeningLine('')).toBeNull()
    expect(cleanOpeningLine('x'.repeat(400))).toBeNull()
  })
})
