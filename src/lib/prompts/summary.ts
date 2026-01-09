/**
 * Summary Prompts
 * Prompts for generating conversation summaries
 */

import { LANGUAGE_LABELS  } from '../../types/voice-session'
import type {Language} from '../../types/voice-session';

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
export const SUMMARY_SYSTEM_PROMPT = `You are a thoughtful writer creating a personal reflection journal entry.
Your task is to transform a conversation transcript into a meaningful, reflective summary.

GUIDELINES:
- Write in second person ("You discussed...", "You shared...")
- Capture the emotional essence, not just the facts
- Highlight key themes, insights, and feelings expressed
- Keep it warm and personal, like a journal entry
- Be concise but meaningful (2-3 paragraphs)
- Focus on what seemed most important to the person
- Note any growth, realizations, or emotional shifts
- End with a forward-looking or grounding statement`

/**
 * Build the user prompt for summary generation
 */
export function buildSummaryPrompt(transcript: string): string {
  return `Please create a reflective journal entry summary of this conversation:

---
${transcript}
---

Write a 2-3 paragraph summary that captures the emotional themes, key moments, and overall essence of what was shared. 
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
