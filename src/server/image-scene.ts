/**
 * Image Scene Generation
 *
 * Turns a reflection / voice-session summary into a concrete, vivid visual
 * scene description before it is handed to the image model. A literal journal
 * summary produces flat, generic images; a described scene gives the model a
 * clear subject (or an intentional abstract composition), setting, lighting,
 * and mood to render.
 *
 * To keep the daily image a small surprise, each call also picks a random
 * *visual approach* — sometimes a human moment, sometimes an object, a place, a
 * sci-fi or surreal scene, or a purely abstract/fractal composition — and asks
 * the art director to express the reflection through that lens. The user's
 * chosen render style (watercolor, sketch, …) is preserved separately; only the
 * subject/metaphor varies here.
 *
 * It also normalizes the scene to English (image models work best with English
 * prompts), which replaces the previous standalone translation step.
 */

import { buildImageSceneMessages } from '../lib/prompts/image'
import { chatCompletion } from './services/openrouter.service'
import type { ChatMessage } from './services/openrouter.service'

export interface ImageScene {
  /** The English visual scene description fed to the image model. */
  scene: string
  /** Whether this scene is intentionally abstract (no literal subject). */
  abstract: boolean
}

/**
 * Visual approaches the art director rotates through for variety. `abstract`
 * approaches drop the "must contain a subject" guardrail downstream.
 */
interface VisualApproach {
  key: string
  hint: string
  abstract: boolean
}

const VISUAL_APPROACHES: ReadonlyArray<VisualApproach> = [
  {
    key: 'human',
    abstract: false,
    hint: 'an intimate human moment — a person or people captured mid-feeling, through gesture, posture, or presence',
  },
  {
    key: 'object',
    abstract: false,
    hint: 'a single evocative object or still life that quietly stands in for the feeling',
  },
  {
    key: 'place',
    abstract: false,
    hint: 'an atmospheric landscape, room, or place that holds the mood, with no people in it',
  },
  {
    key: 'nature',
    abstract: false,
    hint: 'a natural-world metaphor — sky, water, light, weather, or organic growth that mirrors the emotion',
  },
  {
    key: 'surreal',
    abstract: false,
    hint: 'a surreal, dreamlike scene that gently bends reality to express the emotion',
  },
  {
    key: 'scifi',
    abstract: false,
    hint: 'a science-fiction or otherworldly scene — cosmic, futuristic, or quietly speculative',
  },
  {
    key: 'abstract',
    abstract: true,
    hint: 'a purely abstract composition — flowing forms, fractals, or intricate patterns of color, light, and texture, with no literal subject',
  },
]

function pickVisualApproach(): VisualApproach {
  const index = Math.floor(Math.random() * VISUAL_APPROACHES.length)
  return VISUAL_APPROACHES[index]
}

/**
 * Convert a (possibly long, possibly non-English) summary into an English
 * visual scene description for image generation, choosing a random visual
 * approach for variety.
 *
 * Falls back to the raw summary (treated as subject-based) if the scene
 * generation fails or returns nothing, so image generation still proceeds.
 */
export async function generateImageScene(
  summaryText: string,
): Promise<ImageScene> {
  const approach = pickVisualApproach()

  try {
    const messages = buildImageSceneMessages(summaryText, approach.hint)
    const scene = await chatCompletion(messages as Array<ChatMessage>, {
      maxTokens: 300,
      temperature: 0.9,
    })
    const trimmed = scene?.trim()
    if (trimmed) {
      console.log(
        `[Image Scene] Using "${approach.key}" approach (abstract=${approach.abstract})`,
      )
      return { scene: trimmed, abstract: approach.abstract }
    }
    console.warn(
      '[Image Scene] Empty scene description, falling back to summary',
    )
  } catch (error) {
    console.error(
      '[Image Scene] Failed to generate scene description, falling back to summary:',
      error,
    )
  }

  // Fallback: render the raw summary as a subject-based image.
  return { scene: summaryText, abstract: false }
}
