/**
 * Extraction Prompts
 * AI prompts for extracting structured insights from reflection transcripts
 */

import {
  ALL_MOODS,
  INSIGHT_CATEGORIES,
  RELATIONSHIP_TYPES,
} from '../../types/insights'
import { LANGUAGE_LABELS  } from '../../types/voice-session'
import type {Language} from '../../types/voice-session';

/**
 * Get the English name of a language from its code
 */
function getLanguageName(code: string): string {
  const labels = LANGUAGE_LABELS[code as Language]
  return labels?.name || 'English'
}

// System prompt for insight extraction
export const EXTRACTION_SYSTEM_PROMPT = `You are an expert at analyzing therapeutic reflection conversations and extracting structured insights.

Your task is to analyze a reflection conversation and extract meaningful insights in a specific JSON format.

IMPORTANT: Only extract information that is CLEARLY present in the conversation. Do not invent or assume anything.

## Output Schema

Return a valid JSON object with the following structure:

{
  "mood": {
    "primary": "<single mood word>",
    "confidence": <0.0-1.0>
  },
  "topics": ["<topic1>", "<topic2>", ...],
  "insights": [
    {
      "text": "<insight text>",
      "category": "<category>"
    }
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
  ]
}

## Field Specifications

### Mood
Choose ONE primary mood from: ${ALL_MOODS.join(', ')}

Confidence should reflect how clearly the mood was expressed:
- 0.9-1.0: Very clearly expressed
- 0.7-0.9: Reasonably clear
- 0.5-0.7: Somewhat ambiguous
- Below 0.5: Very unclear (still pick the most likely)

### Topics
Extract 1-5 key themes discussed. Use lowercase, simple terms like:
- work, career, job
- relationships, love, dating
- family, parents, children
- health, fitness, wellness
- personal growth, self-improvement
- stress, anxiety, mental health
- goals, plans, future
- finances, money
- hobbies, interests
- social life, friends

### Insights
Extract meaningful quotes, realizations, or statements. Categories:
${INSIGHT_CATEGORIES.map((c) => `- ${c}`).join('\n')}

Rules:
- Use the person's own words when possible
- Paraphrase only if necessary for clarity
- Each insight should be a complete thought
- Skip generic or obvious statements

### Todos
Extract specific action items or intentions mentioned. 

Rules:
- Only include SPECIFIC intentions, not vague wishes
- "I should exercise more" = NO (too vague)
- "I want to start running on Monday mornings" = YES (specific)
- "Maybe I'll call my mom" = Maybe (depends on certainty)
- "I need to call my mom this weekend" = YES

Priority inference:
- "urgent", "must", "need to", "have to" → high
- "should", "want to", "plan to" → medium  
- "maybe", "might", "could" → low

Due date: Parse natural language dates if mentioned ("this weekend", "tomorrow", "next week")

### People
Extract names or relationship descriptors of people mentioned.

Relationship types: ${RELATIONSHIP_TYPES.join(', ')}

Rules:
- Include both specific names ("Sarah", "John") and role descriptors ("my boss", "my mom")
- Determine sentiment based on how they were discussed:
  - positive: spoken about warmly, gratefully, lovingly
  - neutral: mentioned factually without strong emotion
  - negative: source of stress, frustration, or conflict

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
      ? `\n\nLANGUAGE: Output all extracted text content (insights, todo items, topics, context) in ${getLanguageName(language)}. Keep proper nouns/names in their original form. Mood keywords must remain in English (from the allowed list).`
      : ''

  return `Analyze this reflection conversation and extract structured insights.${langInstruction}

## Summary
${summary || 'No summary available.'}

## Full Transcript
${transcript}

---

Extract the mood, topics, insights, todos, and people mentioned. Return only valid JSON.`
}

// Validate extraction result
export function isValidExtractionResult(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false

  const obj = data as Record<string, unknown>

  // Check mood
  if (!obj.mood || typeof obj.mood !== 'object') return false
  const mood = obj.mood as Record<string, unknown>
  if (typeof mood.primary !== 'string') return false
  if (typeof mood.confidence !== 'number') return false
  if (!ALL_MOODS.includes(mood.primary as (typeof ALL_MOODS)[number]))
    return false

  // Check topics
  if (!Array.isArray(obj.topics)) return false

  // Check insights
  if (!Array.isArray(obj.insights)) return false
  for (const insight of obj.insights) {
    if (typeof insight !== 'object' || !insight) return false
    const i = insight as Record<string, unknown>
    if (typeof i.text !== 'string') return false
    if (typeof i.category !== 'string') return false
    if (
      !INSIGHT_CATEGORIES.includes(
        i.category as (typeof INSIGHT_CATEGORIES)[number],
      )
    )
      return false
  }

  // Check todos
  if (!Array.isArray(obj.todos)) return false
  for (const todo of obj.todos) {
    if (typeof todo !== 'object' || !todo) return false
    const t = todo as Record<string, unknown>
    if (typeof t.text !== 'string') return false
  }

  // Check people
  if (!Array.isArray(obj.people)) return false
  for (const person of obj.people) {
    if (typeof person !== 'object' || !person) return false
    const p = person as Record<string, unknown>
    if (typeof p.name !== 'string') return false
    if (typeof p.sentiment !== 'string') return false
  }

  return true
}
