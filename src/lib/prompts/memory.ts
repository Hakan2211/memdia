/**
 * Memory Prompts
 *
 * Long-term memory for the companion, in two layers:
 *
 * 1. A living PROFILE per user (UserMemory.profile): a document the AI keeps up
 *    to date after every conversation — their life, people, interests and open
 *    questions, views (and how they've changed), ongoing threads, and how they
 *    like to talk. Injected into every conversation.
 * 2. A SESSION NOTE per conversation (ReflectionSession.memoryNote): written for
 *    the companion, not the user — what was explored, positions taken, what was
 *    left unresolved, what to follow up on. The last few are injected verbatim
 *    so the companion can genuinely pick up where they left off.
 *
 * Both are also used to write the opening line of the next conversation.
 *
 * Pure functions only (no I/O) so they can be unit-tested.
 */

import { LANGUAGE_LABELS } from '../../types/voice-session'
import type { Language } from '../../types/voice-session'

function getLanguageName(code: string): string {
  const labels = LANGUAGE_LABELS[code as Language] as
    | (typeof LANGUAGE_LABELS)[Language]
    | undefined
  return labels?.name || 'English'
}

// ==========================================
// Profile shape
// ==========================================

/** Fixed section headings of the profile. Kept in English so code/UI can rely on them. */
export const PROFILE_SECTIONS = [
  'About their life',
  'People',
  'Interests and open questions',
  'Views and how they have changed',
  'Ongoing threads',
  'How they like to talk',
] as const

/** Soft target the model is asked to stay under. */
export const PROFILE_TARGET_WORDS = 900

/** Hard cap on what we store / inject (a runaway model output gets truncated). */
export const PROFILE_MAX_CHARS = 9000

/** Hard cap on a single session note. */
export const NOTE_MAX_CHARS = 2000

const PROFILE_SKELETON = PROFILE_SECTIONS.map((s) => `## ${s}\n-`).join('\n\n')

const PROFILE_RULES = `PROFILE FORMAT AND RULES:
- Use exactly these section headings, in this order, each on its own line starting with "## ":
${PROFILE_SECTIONS.map((s) => `  ## ${s}`).join('\n')}
- Under each heading, short bullet points ("- ..."). Leave a section with a single "-" if there's nothing yet.
- Keep the WHOLE profile under ~${PROFILE_TARGET_WORDS} words. When it gets long, compress: merge related bullets, drop one-off trivia and anything clearly resolved or outdated. Never drop important life facts, key people, or views.
- Views: record positions the PERSON holds or argued for (not the companion's), with the month they were expressed, e.g. "- Thinks free will is compatible with determinism (Mar 2026)". When a view changes, keep the old one and note the change: "- Used to think X (Jan 2026); now leans towards Y (Mar 2026)".
- Ongoing threads: unresolved situations, decisions, questions or plans that are worth checking in on — with roughly when they last came up. Remove threads that were clearly resolved (or move the outcome into the right section).
- People: name or descriptor, relationship, and the one or two things that matter most about them for this person.
- "How they like to talk": what kind of conversation helps them — e.g. likes being challenged, wants explanations, needs space before advice, prefers humor.
- Only record what the PERSON actually said or clearly implied. Never invent, never diagnose, never moralize. Hold feelings and sentiments as gentle observations.
- Do NOT store highly sensitive specifics that aren't needed for continuity (exact addresses, account numbers, passwords, etc.).`

// ==========================================
// After-session update (note + profile merge in one call)
// ==========================================

export interface SessionMemoryInput {
  /** Current profile, or null if this is the first one */
  profile: string | null
  /** Formatted transcript of the session that just ended */
  transcript: string
  /** Session date (used for dating views/threads) */
  date: Date
  /** User's preferred language code (profile/note content is written in it) */
  language: string
}

export function formatMonth(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function formatDay(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function buildSessionMemoryMessages(
  input: SessionMemoryInput,
): Array<{ role: 'system' | 'user'; content: string }> {
  const language = getLanguageName(input.language)

  const system = `You maintain the long-term memory of a warm AI companion that has daily spoken conversations with one person. Conversations range from processing feelings and life events to philosophy, science, ethics and ideas — often both.

After each conversation you write two things:

1. A SESSION NOTE for the companion (the person never sees it). 4-8 short lines covering: what was explored; positions the person took and why; what shifted for them; what was left unresolved or open; and one or two natural things to follow up on next time. Concrete and specific — names, details, the actual question — not generic. Written so the companion could say "last time we got stuck on whether meaning is found or made".

2. The UPDATED PROFILE: the existing profile with everything durable from this conversation merged in. Rewrite the whole profile (not a diff).

${PROFILE_RULES}

Write the content of both in ${language} (keep the section headings in English exactly as given). Names, book titles and quotes stay as the person said them.

Output EXACTLY this and nothing else:
<note>
...the session note...
</note>
<profile>
...the full updated profile...
</profile>`

  const user = `Date of this conversation: ${formatDay(input.date)}

EXISTING PROFILE:
${input.profile?.trim() || `(none yet — this is the first conversation; start from this skeleton)\n${PROFILE_SKELETON}`}

TRANSCRIPT ("You" is the person, "AI Companion" is the companion):
---
${input.transcript}
---`

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]
}

/** Extract the inner text of the first <tag>...</tag> block (tolerates a missing close tag at the very end). */
function extractTag(text: string, tag: string): string | null {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)(?:</${tag}>|$)`, 'i')
  const match = text.match(re)
  const inner = match?.[1]?.trim()
  return inner ? inner : null
}

/** Strip markdown code fences a model may wrap its output in. */
function stripFences(text: string): string {
  return text.replace(/```[a-z]*\n?/gi, '').trim()
}

/**
 * Validate a profile produced by the model.
 *
 * Returns the cleaned profile, or null if it should be rejected (missing most
 * headings, or so much shorter than the previous one that it looks like the
 * model dropped content). Rejection keeps the old profile — losing memory is
 * worse than missing one update.
 */
export function validateProfile(
  candidate: string | null,
  previous: string | null,
): string | null {
  if (!candidate) return null
  const cleaned = stripFences(candidate).trim()

  const headingsPresent = PROFILE_SECTIONS.filter((s) =>
    new RegExp(`^##\\s*${s}\\s*$`, 'im').test(cleaned),
  ).length
  if (headingsPresent < PROFILE_SECTIONS.length - 1) return null

  if (
    previous &&
    previous.length > 1500 &&
    cleaned.length < previous.length * 0.4
  ) {
    return null
  }

  return cleaned.length > PROFILE_MAX_CHARS
    ? cleaned.slice(0, PROFILE_MAX_CHARS)
    : cleaned
}

export function cleanNote(note: string | null): string | null {
  if (!note) return null
  const cleaned = stripFences(note).trim()
  if (cleaned.length < 20) return null
  return cleaned.length > NOTE_MAX_CHARS
    ? cleaned.slice(0, NOTE_MAX_CHARS)
    : cleaned
}

/**
 * Parse the after-session model output into a note and a (validated) profile.
 * Either may be null; callers keep the old profile when `profile` is null.
 */
export function parseSessionMemoryResult(
  raw: string,
  previousProfile: string | null,
): { note: string | null; profile: string | null } {
  return {
    note: cleanNote(extractTag(raw, 'note')),
    profile: validateProfile(extractTag(raw, 'profile'), previousProfile),
  }
}

// ==========================================
// Backfill (build the profile from history)
// ==========================================

/** One past session, condensed for the backfill. */
export interface SessionDigest {
  date: Date
  kind: 'conversation' | 'check-in'
  summary: string
  /** Extracted insights/views, references, mood — optional extra signal */
  details?: string
}

export function formatDigest(d: SessionDigest): string {
  const label = d.kind === 'check-in' ? 'short daily check-in' : 'conversation'
  const details = d.details ? `\n${d.details}` : ''
  return `### ${formatDay(d.date)} (${label})\n${d.summary.trim()}${details}`
}

/**
 * Fold a batch of past sessions (oldest first) into the profile.
 * Called repeatedly over the user's history, oldest batch first.
 */
export function buildBackfillMessages(input: {
  profile: string | null
  digests: Array<SessionDigest>
  language: string
}): Array<{ role: 'system' | 'user'; content: string }> {
  const language = getLanguageName(input.language)

  const system = `You maintain the long-term memory of a warm AI companion that has daily spoken conversations with one person. You are building their profile from past sessions, in chronological batches. Each session is given as a journal-style summary (written in second person: "you" is the person) plus extracted details.

Merge everything durable from this batch into the profile and output the WHOLE updated profile. Later sessions override earlier ones when something changed — record changes of view with their dates.

${PROFILE_RULES}

Write the content in ${language} (keep the section headings in English exactly as given).

Output EXACTLY this and nothing else:
<profile>
...the full updated profile...
</profile>`

  const user = `EXISTING PROFILE:
${input.profile?.trim() || `(none yet — start from this skeleton)\n${PROFILE_SKELETON}`}

PAST SESSIONS (oldest first):
${input.digests.map(formatDigest).join('\n\n')}`

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]
}

export function parseBackfillResult(
  raw: string,
  previousProfile: string | null,
): string | null {
  return validateProfile(extractTag(raw, 'profile'), previousProfile)
}

/** Note-only prompt, used by the backfill for the most recent past conversations. */
export function buildSessionNoteMessages(input: {
  transcript: string
  date: Date
  language: string
}): Array<{ role: 'system' | 'user'; content: string }> {
  const language = getLanguageName(input.language)
  return [
    {
      role: 'system',
      content: `You write private notes for a warm AI companion about a conversation it had with a person (the person never sees them). 4-8 short lines covering: what was explored; positions the person took and why; what shifted for them; what was left unresolved or open; and one or two natural things to follow up on next time. Concrete and specific — names, details, the actual question — not generic. Only what the PERSON said or clearly implied. Write in ${language}.

Output EXACTLY this and nothing else:
<note>
...the note...
</note>`,
    },
    {
      role: 'user',
      content: `Date: ${formatDay(input.date)}\n\nTRANSCRIPT ("You" is the person, "AI Companion" is the companion):\n---\n${input.transcript}\n---`,
    },
  ]
}

export function parseNoteResult(raw: string): string | null {
  return cleanNote(extractTag(raw, 'note'))
}

// ==========================================
// Injection into the conversation prompt
// ==========================================

export interface RecentNote {
  date: Date
  note: string
}

/** Relative time label at day granularity ("yesterday", "3 weeks ago"). */
export function describeWhen(date: Date, now: Date = new Date()): string {
  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)
  const startOfThen = new Date(date)
  startOfThen.setHours(0, 0, 0, 0)

  const diffDays = Math.round(
    (startOfToday.getTime() - startOfThen.getTime()) / 86_400_000,
  )

  if (diffDays <= 0) return 'earlier today'
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 14) return 'last week'
  if (diffDays < 31) return `${Math.round(diffDays / 7)} weeks ago`
  if (diffDays < 60) return 'last month'
  return `${Math.round(diffDays / 30)} months ago`
}

/**
 * Build the memory block injected into the conversation's system prompt.
 * Returns null if there's nothing to inject.
 */
export function buildMemoryBrief(input: {
  profile: string | null
  recentNotes: Array<RecentNote>
  openTodos: Array<string>
  now?: Date
}): string | null {
  const now = input.now ?? new Date()
  const parts: Array<string> = []

  // No profile and no notes (first conversations, or the user wiped their
  // memory): inject nothing — todos alone would contradict "forgotten".
  if (!input.profile?.trim() && input.recentNotes.length === 0) return null

  if (input.profile?.trim()) {
    parts.push(
      `WHAT YOU KNOW ABOUT THEM (long-term profile):\n${input.profile.trim()}`,
    )
  }

  if (input.recentNotes.length > 0) {
    const notes = input.recentNotes
      .map(
        (n) =>
          `[${describeWhen(n.date, now)} — ${formatDay(n.date)}]\n${n.note.trim()}`,
      )
      .join('\n\n')
    parts.push(
      `YOUR NOTES FROM THE LAST CONVERSATIONS (most recent first):\n${notes}`,
    )
  }

  if (input.openTodos.length > 0) {
    parts.push(
      `Open intentions they set for themselves:\n${input.openTodos.map((t) => `- ${t}`).join('\n')}`,
    )
  }

  if (parts.length === 0) return null

  return `MEMORY
You have talked with this person before. This is what you remember. Today is ${formatDay(now)}.

How to use it:
- Let it make you a companion who genuinely knows them: remember people's names, what they were wrestling with, the positions they hold, how they like to talk.
- Weave it in naturally and ONLY when it's relevant to what they bring up. Follow their lead — today may be about something completely new.
- Never recite it back or read it like a list; that feels like surveillance. One well-placed "last time you said..." beats five.
- When a view of theirs comes up again, you can notice whether it has shifted ("a few weeks ago you leaned the other way — what changed?").
- Things change: if something seems resolved or outdated, check rather than assume.

${parts.join('\n\n')}`
}

// ==========================================
// Opening line
// ==========================================

export function buildOpeningLineMessages(input: {
  profile: string | null
  recentNotes: Array<RecentNote>
  language: string
  userName?: string
  now?: Date
}): Array<{ role: 'system' | 'user'; content: string }> {
  const now = input.now ?? new Date()
  const language = getLanguageName(input.language)
  const notes = input.recentNotes
    .map((n) => `[${describeWhen(n.date, now)}]\n${n.note.trim()}`)
    .join('\n\n')

  return [
    {
      role: 'system',
      content: `You write the spoken opening line of today's conversation between a warm AI companion and a person it has talked with before. It will be read aloud by a text-to-speech voice.

Rules:
- 1-2 short sentences, under 35 words, natural spoken ${language}. No audio tags, no emojis, no quotes around it.
- Pick up a thread from memory lightly — usually the most recent open question, plan or situation — so they feel remembered. Be specific ("how did the talk with Mark go?", "last time we got stuck on whether meaning is found or made").
- ALWAYS leave the door open to something else: they may want to talk about something new today.
- End with exactly one question.
- Warm, not clinical, not effusive. Don't say "Welcome back". Don't recite several facts. Never mention notes, memory or a profile.
- If the most recent thing was painful, approach gently ("I've been thinking about what you shared...") rather than cheerfully.
- If you use their name, do so at most once.

Output only the line.`,
    },
    {
      role: 'user',
      content: `${input.userName ? `Their name: ${input.userName}\n` : ''}Today: ${formatDay(now)}

NOTES FROM RECENT CONVERSATIONS (most recent first):
${notes || '(none)'}

PROFILE:
${input.profile?.trim() || '(none)'}`,
    },
  ]
}

/** Clean the model's opening line; null if unusable (caller falls back to a static greeting). */
export function cleanOpeningLine(raw: string): string | null {
  const line = stripFences(raw)
    .replace(/^["'“”„«»]+|["'“”„«»]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (line.length < 8 || line.length > 300) return null
  return line
}

// ==========================================
// Viewing / editing the profile (memory page)
// ==========================================

export interface ProfileSection {
  heading: string
  items: Array<string>
}

const HEADING_RE = /^##\s*(.+?)\s*$/
const BULLET_RE = /^\s*[-*•]\s*(.*)$/

/**
 * Parse the profile into sections of bullet items. Continuation lines are
 * joined onto the previous bullet; empty "-" placeholders are dropped.
 */
export function parseProfile(profile: string | null): Array<ProfileSection> {
  if (!profile?.trim()) return []
  const sections: Array<ProfileSection> = []
  let current: ProfileSection | null = null

  for (const line of profile.split(/\r?\n/)) {
    const heading = line.match(HEADING_RE)
    if (heading) {
      current = { heading: heading[1], items: [] }
      sections.push(current)
      continue
    }
    if (!current || !line.trim()) continue
    const bullet = line.match(BULLET_RE)
    if (bullet) {
      current.items.push(bullet[1].trim())
    } else if (current.items.length > 0) {
      current.items[current.items.length - 1] += ` ${line.trim()}`
    } else {
      current.items.push(line.trim())
    }
  }

  return sections.map((s) => ({
    heading: s.heading,
    items: s.items.filter((i) => i.length > 0),
  }))
}

/** Serialize sections back into the profile format. */
export function serializeProfile(sections: Array<ProfileSection>): string {
  return sections
    .map(
      (s) =>
        `## ${s.heading}\n${s.items.length > 0 ? s.items.map((i) => `- ${i}`).join('\n') : '-'}`,
    )
    .join('\n\n')
}

/**
 * Remove one item from the profile. Returns the new profile, or null if the
 * section/item wasn't found (e.g. the profile changed in the meantime).
 */
export function removeProfileItem(
  profile: string,
  heading: string,
  item: string,
): string | null {
  const sections = parseProfile(profile)
  const section = sections.find((s) => s.heading === heading)
  if (!section) return null
  const index = section.items.indexOf(item)
  if (index === -1) return null
  section.items.splice(index, 1)
  return serializeProfile(sections)
}
