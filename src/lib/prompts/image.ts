/**
 * Image Generation Prompts
 * Prompts for generating daily memory images
 */

import type { ImageStyle } from '../../types/voice-session'

/**
 * Style-specific prompt prefixes
 */
const STYLE_PREFIXES: Record<ImageStyle, string> = {
  realistic: `Create a photorealistic, hyperreal visualization of daily life activities.
The scene should look like a high-quality cinematic photograph capturing real moments.
Include realistic lighting, natural textures, and detailed environmental elements.
Show the activities and settings described with editorial photography quality.
Style: hyperrealistic digital art, cinematic lighting, detailed scene composition, 
lifelike colors and shadows, professional photography aesthetics.`,

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
 * System prompt for the "scene writer" step.
 *
 * A raw reflection summary is abstract second-person prose ("You discussed…,
 * you felt…"). Image models render what they can *see*, so feeding them that
 * narrative produces flat, generic results. This step acts as an art director:
 * it reads the whole reflection and invents ONE concrete, vivid visual scene
 * for the image model to depict. It also normalizes the output to English,
 * which is what the image model handles best (folding in what used to be a
 * separate translation step).
 */
export const IMAGE_SCENE_SYSTEM_PROMPT = `You are an art director turning a personal reflection into a single still image.
Read the reflection and invent ONE vivid, concrete visual idea that captures its emotional core, expressed through the visual approach you are given.

RULES:
- Commit to the given visual approach. Describe exactly what is in the frame: the main elements, the setting (if any), lighting, color palette, mood, and composition.
- Be concrete and visual. Do NOT narrate events, summarize the conversation, or address the reader as "you". Avoid vague or generic filler.
- Choose imagery that evokes the underlying feeling rather than literally illustrating private details.
- Do not include any text, words, letters, signs, or numbers.
- Always write in English, regardless of the language of the reflection.
- Output ONLY the description as a single paragraph of roughly 50-90 words. No preamble, no title, no quotation marks.`

/**
 * Build the messages for the scene-writer LLM call.
 *
 * @param summary - The full reflection summary (any language, not truncated)
 * @param approachHint - The visual approach to express the reflection through
 *   (e.g. "an intimate human moment", "a purely abstract composition of fractals")
 */
export function buildImageSceneMessages(
  summary: string,
  approachHint: string,
): Array<{ role: 'system' | 'user'; content: string }> {
  return [
    { role: 'system', content: IMAGE_SCENE_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Reflection:\n\n${summary}\n\nVisual approach for this image: ${approachHint}\n\nDescribe the single image to create.`,
    },
  ]
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
