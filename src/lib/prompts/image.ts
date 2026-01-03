/**
 * Image Generation Prompts
 * Prompts for generating daily memory images
 */

import type { ImageStyle } from '../../types/voice-session'

/**
 * Style-specific prompt prefixes
 */
const STYLE_PREFIXES: Record<ImageStyle, string> = {
  dreamlike: `Create a dreamlike, ethereal image with soft focus and gentle pastel colors.
The composition should be minimal and calming, with subtle symbolic elements.
Think fine art photography with a peaceful, meditative quality.`,

  watercolor: `Create a delicate watercolor painting with soft washes of color.
The style should be loose and expressive, with organic flowing shapes.
Colors should blend naturally with gentle bleeding edges, creating an emotional and artistic feel.`,

  geometric: `Create an abstract geometric composition with clean lines and balanced shapes.
Use a modern minimalist approach with harmonious colors.
The design should feel sophisticated and contemporary, with mathematical precision.`,

  sketch: `Create an elegant pencil sketch or fine line drawing.
Use minimal, delicate strokes with subtle shading.
The style should feel hand-drawn and artistic, mostly monochromatic with perhaps hints of color.`,
}

/**
 * Common guidelines for all image styles
 */
const COMMON_GUIDELINES = `
IMPORTANT REQUIREMENTS:
- NO text, words, letters, or numbers in the image
- NO human faces (abstract human forms are okay)
- Focus on symbolic representation of emotions and themes
- Keep it abstract enough to be universally meaningful
- The image should evoke feeling, not tell a literal story
- Suitable for all audiences (no disturbing imagery)`

/**
 * Build the image generation prompt
 */
export function buildImagePrompt(summary: string, style: ImageStyle): string {
  const stylePrefix = STYLE_PREFIXES[style]

  return `${stylePrefix}

Create a symbolic, artistic image that represents the emotional themes and essence of this personal reflection:

"${summary}"

${COMMON_GUIDELINES}

The image should capture the mood and feeling of this reflection in a way that would be meaningful to look back on.`
}

/**
 * Extract key emotional themes from a summary for image generation
 * This creates a more focused prompt for better image results
 */
export function extractThemesForImage(summary: string): string {
  // This is a simplified extraction - in production, you might use
  // another LLM call to extract themes more intelligently

  // Common emotional keywords to look for
  const emotionalKeywords = [
    'happy',
    'sad',
    'anxious',
    'peaceful',
    'excited',
    'worried',
    'grateful',
    'frustrated',
    'hopeful',
    'tired',
    'energized',
    'calm',
    'stressed',
    'content',
    'lonely',
    'connected',
    'growth',
    'change',
    'challenge',
    'success',
    'reflection',
    'love',
    'joy',
    'fear',
    'anger',
    'surprise',
    'anticipation',
  ]

  const lowerSummary = summary.toLowerCase()
  const foundThemes = emotionalKeywords.filter((keyword) =>
    lowerSummary.includes(keyword),
  )

  if (foundThemes.length > 0) {
    return `Key themes: ${foundThemes.slice(0, 5).join(', ')}`
  }

  return ''
}

/**
 * Build a condensed prompt when the summary is very long
 */
export function buildCondensedImagePrompt(
  summary: string,
  style: ImageStyle,
  maxLength: number = 500,
): string {
  // Truncate summary if too long
  const truncatedSummary =
    summary.length > maxLength ? summary.slice(0, maxLength) + '...' : summary

  const themes = extractThemesForImage(summary)
  const stylePrefix = STYLE_PREFIXES[style]

  return `${stylePrefix}

Create a symbolic image representing:
${truncatedSummary}

${themes}

${COMMON_GUIDELINES}`
}

/**
 * Prompts for weekly/monthly/yearly images (Phase 2)
 */
export const PERIOD_IMAGE_PROMPTS = {
  weekly: `Create an image that captures the essence of a week's worth of reflections.
The image should represent recurring themes, overall mood, and the journey of the past 7 days.`,

  monthly: `Create an image that represents a month of personal growth and reflection.
Capture the overarching themes, emotional patterns, and transformation over 30 days.`,

  yearly: `Create a meaningful image that symbolizes a year of daily reflections.
This should feel significant and encompassing, representing the major themes and growth of an entire year.`,
}

/**
 * Build prompt for period-based images
 */
export function buildPeriodImagePrompt(
  period: 'weekly' | 'monthly' | 'yearly',
  metaSummary: string,
  style: ImageStyle,
): string {
  const periodContext = PERIOD_IMAGE_PROMPTS[period]
  const stylePrefix = STYLE_PREFIXES[style]

  return `${stylePrefix}

${periodContext}

Based on these collected reflections:
"${metaSummary}"

${COMMON_GUIDELINES}

This image represents a ${period} milestone - make it feel special and meaningful.`
}
