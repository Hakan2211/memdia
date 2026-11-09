/**
 * Extraction Prompts
 * AI prompts for extracting structured insights from conversation transcripts.
 *
 * Conversations range from personal/emotional processing to philosophy,
 * learning and "how does the world work" discussions, so extraction captures
 * ideas and views (and the thinkers/books/concepts that came up) as well as
 * moods, people and intentions.
 */

import {
  ALL_MOODS,
  INSIGHT_CATEGORIES,
  REFERENCE_KINDS,
  RELATIONSHIP_TYPES,
  SENTIMENT_TYPES,
  TODO_PRIORITIES,
} from '../../types/insights'
import { LANGUAGE_LABELS } from '../../types/voice-session'
import type { ExtractedInsights } from '../../types/insights'
import type { Language } from '../../types/voice-session'

/**
 * Get the English name of a language from its code
 */
function getLanguageName(code: string): string {
  const labels = LANGUAGE_LABELS[code as Language]
  return labels?.name || 'English'
}

// System prompt for insight extraction
export const EXTRACTION_SYSTEM_PROMPT = `You are an expert at analyzing spoken conversations between a person and their AI companion, and extracting structured insights.

These conversations cover anything: processing feelings, relationships and life events, but also philosophy, meaning, ethics, science, society and ideas the person is trying to understand. Capture both the personal AND the intellectual side.

IMPORTANT: Only extract information that is CLEARLY present in the conversation. Do not invent or assume anything. Insights, views and intentions must come from what the PERSON said — not from what the companion said.

## Output Schema

Return a valid JSON object with the following structure:

{
  "mood": { "primary": "<single mood word>", "confidence": <0.0-1.0> } | null,
  "topics": ["<topic1>", "<topic2>", ...],
  "insights": [
    { "text": "<insight text>", "category": "<category>" }
  ],
  "todos": [
    {
      "text": "<action item>",
      "dueDate": "<ISO date or null>",
      "priority": "<high|medium|low or null>",
      "context": "<brief context or null>"
    }
  ],
  "people": [
    {
      "name": "<name or relationship descriptor>",
      "relationship": "<type or null>",
      "sentiment": "<positive|neutral|negative>"
    }
  ],
  "references": [
    { "name": "<canonical name>", "kind": "<thinker|book|work|concept>", "note": "<how it came up, one short sentence>" }
  ]
}

## Field Specifications

### Mood
Choose ONE primary mood from: ${ALL_MOODS.join(', ')}

Use null if the conversation had no discernible emotional tone (e.g. a purely intellectual discussion with no feelings expressed). For an engaged, idea-focused conversation, "curious" or "contemplative" are often right — but only if that is genuinely how the person came across.

Confidence should reflect how clearly the mood was expressed:
- 0.9-1.0: Very clearly expressed
- 0.7-0.9: Reasonably clear
- 0.5-0.7: Somewhat ambiguous
- Below 0.5: Very unclear (still pick the most likely)

### Topics
Extract 1-5 key themes discussed. Use lowercase, short, reusable terms so the same theme gets the same name across conversations. Examples:
- Personal life: work, career, relationships, family, friendship, health, stress, mental health, personal growth, goals, finances, hobbies
- Ideas: philosophy, meaning of life, free will, consciousness, ethics, morality, death, religion, spirituality, happiness, identity, truth, science, psychology, society, politics, history, technology, ai, art, nature
Prefer a broad term ("ethics") over a hyper-specific one ("trolley problem") — specific ideas belong in references.

### Insights
Extract meaningful statements the person made. Categories:
${INSIGHT_CATEGORIES.map((c) => `- ${c}`).join('\n')}

Category guidance:
- realization: something they newly saw or understood about themselves or their life
- view: a position, belief or conviction they hold or argued for ("I think meaning is something we create, not find"). Capture the view itself, including nuance or uncertainty they expressed
- question: an open question they are genuinely wrestling with ("Can you be happy without being good?")
- learning: something they learned about the world in this conversation (e.g. from the companion's explanation) that clearly landed with them
- idea: an original idea or plan they came up with
- goal, gratitude, concern, inspiration: as named

Rules:
- Use the person's own words when possible; paraphrase only if necessary for clarity
- Each insight should be a complete thought that would make sense months later without the transcript
- Skip generic or obvious statements

### Todos
Extract specific action items or intentions mentioned.

Rules:
- Only include SPECIFIC intentions, not vague wishes
- "I should exercise more" = NO (too vague)
- "I want to start running on Monday mornings" = YES (specific)
- "I want to read Meditations by Marcus Aurelius" = YES
- "I need to call my mom this weekend" = YES

Priority inference:
- "urgent", "must", "need to", "have to" → high
- "should", "want to", "plan to" → medium
- "maybe", "might", "could" → low

Due date: Parse natural language dates if mentioned ("this weekend", "tomorrow", "next week")

### People
Extract people from the person's OWN life (names or relationship descriptors). Do NOT include thinkers, authors or public figures discussed as ideas — those go in references.

Relationship types: ${RELATIONSHIP_TYPES.join(', ')}

Rules:
- Include both specific names ("Sarah", "John") and role descriptors ("my boss", "my mom")
- Determine sentiment based on how they were discussed:
  - positive: spoken about warmly, gratefully, lovingly
  - neutral: mentioned factually without strong emotion
  - negative: source of stress, frustration, or conflict

### References
Thinkers, books, works and named concepts that meaningfully came up — whether the person or the companion brought them up.
Kinds: ${REFERENCE_KINDS.join(', ')}
- thinker: a philosopher, scientist, writer, teacher etc. ("Seneca", "Viktor Frankl")
- book: a specific book ("Man's Search for Meaning")
- work: a film, article, podcast, artwork, speech etc.
- concept: a named idea, theory, school or tradition ("Stoicism", "the hedonic treadmill", "cognitive dissonance")

Rules:
- Use the canonical, commonly used name (English or the original form for proper names)
- Only include references that were actually discussed, not just name-dropped in passing
- These are IDEAS and their sources only. Never include companies, employers, products, apps, brands, places or events (e.g. "OpenAI", "Google", "Instagram", "Berlin" are NOT references) — use an empty array if nothing qualifies
- Note: one short sentence on how it connected to what the person was exploring
- Maximum 8

## Response Format

Return ONLY the JSON object. No markdown, no explanation, no preamble.
If a category has no items, use an empty array.
`

// User prompt template
export function buildExtractionPrompt(
  summary: string,
  transcript: string,
  language?: string,
): string {
  // Add language instruction if non-English
  const langInstruction =
    language && language !== 'en'
      ? `\n\nLANGUAGE: Output all extracted text content (insights, todo items, topics, context, reference notes) in ${getLanguageName(language)}. Keep proper nouns/names (people, thinkers, book titles) in their original or commonly known form. Mood keywords, categories and kinds must remain in English (from the allowed lists).`
      : ''

  return `Analyze this conversation and extract structured insights.${langInstruction}

## Summary
${summary || 'No summary available.'}

## Full Transcript
${transcript}

---

Extract the mood, topics, insights, todos, people and references. Return only valid JSON.`
}

// ==========================================
// Validation / normalization
// ==========================================

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null
}

function oneOf<T extends string>(
  allowed: ReadonlyArray<T>,
  value: unknown,
): T | null {
  return typeof value === 'string' && allowed.includes(value as T)
    ? (value as T)
    : null
}

/**
 * Validate and normalize a parsed extraction result.
 *
 * The overall shape must be an object, but individual malformed items (an
 * unknown insight category, a person without a name, ...) are DROPPED rather
 * than failing the whole extraction — one bad item from the LLM shouldn't cost
 * the user every insight from a 15-minute conversation.
 *
 * Returns null only if the response isn't a usable object at all.
 */
export function normalizeExtractionResult(
  data: unknown,
): ExtractedInsights | null {
  if (!isRecord(data)) return null

  const arr = (value: unknown): Array<unknown> =>
    Array.isArray(value) ? value : []

  // Mood (optional)
  let mood: ExtractedInsights['mood'] = null
  if (isRecord(data.mood)) {
    const primary = oneOf(ALL_MOODS, data.mood.primary)
    if (primary) {
      const raw = data.mood.confidence
      const confidence =
        typeof raw === 'number' && Number.isFinite(raw)
          ? Math.min(1, Math.max(0, raw))
          : 0.7
      mood = { primary, confidence }
    }
  }

  const topics = [
    ...new Set(
      arr(data.topics)
        .map((t) => nonEmptyString(t)?.toLowerCase() ?? null)
        .filter((t): t is string => t !== null),
    ),
  ].slice(0, 5)

  const insights: ExtractedInsights['insights'] = []
  for (const item of arr(data.insights)) {
    if (!isRecord(item)) continue
    const text = nonEmptyString(item.text)
    const category = oneOf(INSIGHT_CATEGORIES, item.category)
    if (text && category) insights.push({ text, category })
  }

  const todos: ExtractedInsights['todos'] = []
  for (const item of arr(data.todos)) {
    if (!isRecord(item)) continue
    const text = nonEmptyString(item.text)
    if (!text) continue
    const dueRaw = nonEmptyString(item.dueDate)
    const dueDate =
      dueRaw && !Number.isNaN(new Date(dueRaw).getTime()) ? dueRaw : null
    todos.push({
      text,
      dueDate,
      priority: oneOf(TODO_PRIORITIES, item.priority),
      context: nonEmptyString(item.context),
    })
  }

  const people: ExtractedInsights['people'] = []
  for (const item of arr(data.people)) {
    if (!isRecord(item)) continue
    const name = nonEmptyString(item.name)
    if (!name) continue
    people.push({
      name,
      relationship: oneOf(RELATIONSHIP_TYPES, item.relationship),
      sentiment: oneOf(SENTIMENT_TYPES, item.sentiment) ?? 'neutral',
    })
  }

  const references: ExtractedInsights['references'] = []
  const seenRefs = new Set<string>()
  for (const item of arr(data.references)) {
    if (!isRecord(item)) continue
    const name = nonEmptyString(item.name)
    const kind = oneOf(REFERENCE_KINDS, item.kind)
    if (!name || !kind) continue
    const key = `${kind}:${name.toLowerCase()}`
    if (seenRefs.has(key)) continue
    seenRefs.add(key)
    references.push({ name, kind, note: nonEmptyString(item.note) })
    if (references.length >= 8) break
  }

  return { mood, topics, insights, todos, people, references }
}
