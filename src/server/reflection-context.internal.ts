/**
 * Internal Reflection Context Builder - Server-only
 *
 * Distills the user's PAST reflections into a short "memory brief" that is
 * injected into the system prompt of their NEXT reflection, so the companion
 * has genuine continuity ("how did that conversation with Mark go?") instead of
 * starting cold every day.
 *
 * It deliberately does NOT replay raw transcripts. Raw history is slow (every
 * token is time-to-first-audio in a voice session), goes stale, and dilutes the
 * model's focus. Instead it assembles the already-distilled structured data
 * (moods, topics, people, insights, open todos, recent summaries) into a compact
 * brief. This is pure DB aggregation — no LLM call — so it adds no cost and is
 * fast enough to build synchronously at session start.
 *
 * NOT wrapped in createServerFn — never import this from client code.
 */

import { prisma } from '../db'

// How much history to fold into the brief. Kept small on purpose: recent +
// recurring is what creates the feeling of being known; ancient one-offs just
// add noise (and tokens).
const RECENT_SESSIONS = 5
const MAX_PEOPLE = 6
const MAX_TODOS = 8
const MAX_INSIGHTS = 6
const SUMMARY_SNIPPET_CHARS = 180

// Insight categories worth carrying forward into a future conversation. We skip
// transient ones (e.g. gratitude) and keep open threads the user might still be
// sitting with.
const CARRY_FORWARD_CATEGORIES = ['goal', 'concern', 'question', 'realization']

/**
 * Human-friendly relative time ("yesterday", "3 days ago") from a session date.
 * Compared at day granularity so a session late last night still reads as
 * "yesterday" rather than "1 day ago" off by hours.
 */
function describeWhen(date: Date): string {
  const startOfToday = new Date()
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
 * Turn the stored -1..1 average sentiment into a soft, human label. Intentionally
 * vague — the companion should hold these as gentle priors, not hard facts.
 */
function sentimentLabel(avg: number | null): string {
  if (avg === null || avg === undefined) return ''
  if (avg > 0.3) return 'usually a positive presence'
  if (avg < -0.3) return 'often a source of difficulty'
  return 'mixed feelings'
}

/** Trim a summary to a short snippet on a word boundary. */
function snippet(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= SUMMARY_SNIPPET_CHARS) return clean
  const cut = clean.slice(0, SUMMARY_SNIPPET_CHARS)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim()}…`
}

/**
 * Build the memory brief for a user's upcoming reflection.
 *
 * Returns `null` when there's nothing worth carrying forward (e.g. the user's
 * first-ever reflection), in which case the prompt is left unchanged.
 */
export async function buildReflectionContextBrief(
  userId: string,
): Promise<string | null> {
  const [recentSessions, people, todos, insights] = await Promise.all([
    prisma.reflectionSession.findMany({
      where: { userId, status: 'completed' },
      orderBy: { date: 'desc' },
      take: RECENT_SESSIONS,
      include: { mood: true, topics: true },
    }),
    prisma.person.findMany({
      where: { userId },
      orderBy: [{ lastMentioned: 'desc' }, { mentionCount: 'desc' }],
      take: MAX_PEOPLE,
    }),
    prisma.todo.findMany({
      where: { userId, completed: false },
      orderBy: { createdAt: 'desc' },
      take: MAX_TODOS,
    }),
    prisma.reflectionInsight.findMany({
      where: {
        session: { userId },
        category: { in: CARRY_FORWARD_CATEGORIES },
      },
      orderBy: { createdAt: 'desc' },
      take: MAX_INSIGHTS,
    }),
  ])

  const sections: Array<string> = []

  // Recent sessions: when, how they felt, and a one-line gist.
  const sessionLines = recentSessions
    .map((s) => {
      const mood = s.mood?.mood
      const gist = s.summaryText ? snippet(s.summaryText) : ''
      if (!mood && !gist) return null
      const feel = mood ? ` (felt ${mood})` : ''
      return gist
        ? `- ${describeWhen(s.date)}${feel}: ${gist}`
        : `- ${describeWhen(s.date)}${feel}`
    })
    .filter((line): line is string => line !== null)

  if (sessionLines.length > 0) {
    sections.push(`Recent reflections:\n${sessionLines.join('\n')}`)
  }

  // Recurring themes across recent sessions (most frequent first).
  const topicCounts = new Map<string, number>()
  for (const s of recentSessions) {
    for (const t of s.topics) {
      topicCounts.set(t.topic, (topicCounts.get(t.topic) ?? 0) + 1)
    }
  }
  const recurringThemes = [...topicCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([topic]) => topic)

  if (recurringThemes.length > 0) {
    sections.push(`Recurring themes lately: ${recurringThemes.join(', ')}`)
  }

  // People in their life.
  if (people.length > 0) {
    const peopleLines = people.map((p) => {
      const rel = p.relationship ? ` (${p.relationship})` : ''
      const feel = sentimentLabel(p.averageSentiment)
      return `- ${p.name}${rel}${feel ? ` — ${feel}` : ''}`
    })
    sections.push(`People they've talked about:\n${peopleLines.join('\n')}`)
  }

  // Open intentions they set for themselves (incomplete todos).
  if (todos.length > 0) {
    const todoLines = todos.map((t) => `- ${t.text}`)
    sections.push(
      `Open intentions they set for themselves:\n${todoLines.join('\n')}`,
    )
  }

  // Threads still on their mind (recent goals / concerns / questions).
  if (insights.length > 0) {
    const insightLines = insights.map((i) => `- (${i.category}) ${i.text}`)
    sections.push(`Still on their mind recently:\n${insightLines.join('\n')}`)
  }

  if (sections.length === 0) {
    return null
  }

  return `MEMORY FROM PAST REFLECTIONS
You have spoken with this person before in previous reflection sessions. Use the context below to show genuine continuity and care.

How to use it:
- Weave it in naturally and ONLY when it's relevant to what they bring up now.
- Never recite this back to them or read it like a list — that feels like surveillance.
- If a past topic seems resolved or they've clearly moved on, let it go unless they raise it.
- Treat sentiments and themes as gentle priors, not facts — check rather than assume.
- It's completely fine to draw on none of this if today's conversation goes elsewhere.

${sections.join('\n\n')}`
}
