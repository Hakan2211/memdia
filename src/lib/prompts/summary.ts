/**
 * Summary Prompts
 * Prompts for generating conversation summaries
 */

import { LANGUAGE_LABELS } from '../../types/voice-session'
import type { Language } from '../../types/voice-session'

/**
 * Get the English name of a language from its code
 */
export function getLanguageName(code: string): string {
  const labels = LANGUAGE_LABELS[code as Language]
  return labels?.name || 'English'
}

/**
 * System prompt for summary generation
 */
export const SUMMARY_SYSTEM_PROMPT = `You are a thoughtful writer creating a personal journal entry from a conversation between a person and their AI companion.
These conversations range from processing feelings and life events to exploring philosophy, meaning, science and ideas about the world — often both in one conversation.

GUIDELINES:
- Write in second person ("You discussed...", "You wondered whether...")
- Focus on what seemed most important to the person
- For the personal side: capture the emotional essence, not just the facts, and note growth, realizations or emotional shifts
- For the intellectual side: capture the actual substance — the question they explored, the position they took or questioned, the key idea or argument that mattered, and where their thinking ended up (including what is still unresolved). Name thinkers or concepts that came up when they mattered
- Keep it warm and personal, like a journal entry they'll enjoy rereading — never like lecture notes
- Be concise but meaningful (2-3 paragraphs)
- End with a forward-looking or grounding statement, or the open question they're carrying forward`

/**
 * Build the user prompt for summary generation
 */
export function buildSummaryPrompt(transcript: string): string {
  return `Please create a reflective journal entry summary of this conversation:

---
${transcript}
---

Write a 2-3 paragraph summary that captures the key moments, feelings and ideas, and the overall essence of what was shared and explored.
Make it feel like a personal journal entry that the person would appreciate reading later.`
}

/**
 * Build the full messages array for summary generation
 * @param transcript - The formatted transcript text
 * @param language - Optional language code (e.g., 'de' for German). If provided, the summary will be written in that language.
 */
export function buildSummaryMessages(
  transcript: string,
  language?: string,
): Array<{ role: 'system' | 'user'; content: string }> {
  // Add language instruction if a specific language is requested
  const langInstruction = language
    ? `\n\nIMPORTANT: Write the summary in ${getLanguageName(language)}.`
    : ''

  return [
    { role: 'system', content: SUMMARY_SYSTEM_PROMPT + langInstruction },
    { role: 'user', content: buildSummaryPrompt(transcript) },
  ]
}

/**
 * Format transcript turns into readable text
 */
export function formatTranscriptForSummary(
  turns: Array<{ speaker: 'user' | 'ai'; text: string }>,
): string {
  return turns
    .map((turn) => {
      const speaker = turn.speaker === 'user' ? 'You' : 'AI Companion'
      return `${speaker}: ${turn.text}`
    })
    .join('\n\n')
}

// ==========================================
// Translation (for Image Generation)
// ==========================================

/**
 * System prompt for translating summary to English
 * Used for image generation which works best with English prompts
 */
export const TRANSLATION_SYSTEM_PROMPT = `You are a translator. Translate the following text to English.
Keep the emotional tone and meaning intact.
Only output the translated text, nothing else.`

/**
 * Build messages for translating a summary to English
 * Used before image generation since image models work best with English
 */
export function buildTranslationMessages(
  summary: string,
): Array<{ role: 'system' | 'user'; content: string }> {
  return [
    { role: 'system', content: TRANSLATION_SYSTEM_PROMPT },
    { role: 'user', content: summary },
  ]
}
