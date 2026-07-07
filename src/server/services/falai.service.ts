/**
 * fal.ai Service
 * Handles Text-to-Speech (ElevenLabs) and Image Generation (Krea 2 Turbo)
 *
 * Uses the official @fal-ai/client
 *
 * Models:
 * - TTS:   fal-ai/elevenlabs/tts/turbo-v2.5 (faster than eleven-v3)
 * - Image: fal-ai/krea-2/turbo (default, 1K) with
 *          imagineart/imagineart-2.0-preview/text-to-image as a silent fallback.
 *          Model choice is backend-only — it is not user-selectable.
 */

import { fal } from '@fal-ai/client'
import type { ImageStyle } from '../../types/voice-session'

// ==========================================
// Initialize fal.ai client
// ==========================================

// Configure fal.ai with API key from environment
if (process.env.FAL_KEY) {
  fal.config({
    credentials: process.env.FAL_KEY,
  })
}

// ==========================================
// Types
// ==========================================

export interface TTSResult {
  audioUrl: string
  durationSeconds: number
  contentType: string
}

export interface ImageGenerationResult {
  imageUrl: string
  seed: number
}

// ==========================================
// Mock Mode
// ==========================================

const MOCK_FAL = process.env.MOCK_FAL === 'true'

// ==========================================
// TTS Service using ElevenLabs via fal.ai
// ==========================================

/**
 * Generate speech from text using ElevenLabs via fal.ai
 * Model: fal-ai/elevenlabs/tts/turbo-v2.5 (faster, optimized for low latency)
 */
export async function generateSpeech(
  text: string,
  voiceId?: string,
): Promise<TTSResult> {
  // Mock mode for development
  if (MOCK_FAL) {
    return mockGenerateSpeech(text)
  }

  if (!process.env.FAL_KEY) {
    console.error('[fal.ai] FAL_KEY is not set!')
    throw new Error('FAL_KEY is required')
  }

  const startTime = Date.now()
  console.log('[fal.ai TTS] Generating speech for:', text.slice(0, 50) + '...')

  try {
    const result = await fal.subscribe('fal-ai/elevenlabs/tts/turbo-v2.5', {
      input: {
        text,
        // Use a warm, friendly voice - Rachel is the default
        voice: voiceId || 'Rachel',
        stability: 0.5,
        similarity_boost: 0.75,
        speed: 1,
      },
    })

    const ttsLatency = Date.now() - startTime
    console.log(
      `[fal.ai TTS] Raw result (took ${ttsLatency}ms):`,
      JSON.stringify(result, null, 2),
    )

    const data = result.data as {
      audio: { url: string; content_type?: string; file_size?: number }
    }

    if (!data.audio?.url) {
      console.error('[fal.ai TTS] No audio URL in response:', data)
      throw new Error('No audio URL in response')
    }

    // Estimate duration based on text length
    const estimatedDuration = estimateDuration(text)

    console.log(
      `[fal.ai TTS] Success! Audio URL: ${data.audio.url} (latency: ${ttsLatency}ms)`,
    )

    return {
      audioUrl: data.audio.url,
      durationSeconds: estimatedDuration,
      contentType: data.audio.content_type || 'audio/mpeg', // ElevenLabs returns mp3
    }
  } catch (error) {
    console.error('[fal.ai TTS] Error:', error)
    throw error
  }
}

/**
 * Mock TTS for development
 */
async function mockGenerateSpeech(text: string): Promise<TTSResult> {
  console.log('[fal.ai TTS] Running in mock mode')
  await sleep(300)
  return {
    audioUrl: '',
    durationSeconds: estimateDuration(text),
    contentType: 'audio/mpeg',
  }
}

/**
 * Estimate audio duration based on text length
 * Average speaking rate: ~150 words per minute
 */
function estimateDuration(text: string): number {
  const words = text.split(/\s+/).length
  const wordsPerSecond = 150 / 60 // 2.5 words per second
  return Math.max(1, Math.ceil(words / wordsPerSecond))
}

// ==========================================
// Image Generation Service using ImagineArt 2.0
// ==========================================

/**
 * Style prompts for different image styles.
 *
 * Each describes only the *rendering treatment* (how the image should look),
 * not what it should contain. Whether the image has a literal subject or is
 * intentionally abstract is decided separately, by the `allowAbstract` flag and
 * the scene description itself — so the same style can render either a candid
 * moment or a fractal field.
 */
const STYLE_PROMPTS: Record<ImageStyle, string> = {
  realistic: `Render as photorealistic, cinematic photography:
    natural lighting and shadows, real textures, depth of field,
    editorial composition, lifelike colors, high detail.`,

  dreamlike: `Render with a soft, dreamlike atmosphere:
    pastel palette, gentle gradients, hazy light, a slightly surreal mood,
    as if remembered rather than photographed.`,

  watercolor: `Render as a delicate watercolor painting:
    soft washes of color, organic flowing edges, visible paper texture,
    loose expressive painterly brushwork.`,

  geometric: `Render in a stylized geometric illustration style:
    clean geometric forms, bold harmonious colors, modernist composition,
    flat-design influence — contemporary editorial illustration.`,

  sketch: `Render as an elegant hand-drawn pencil sketch:
    fine confident line work, subtle shading, expressive strokes,
    occasional hints of color wash, as if drawn from life in a sketchbook.`,
}

/**
 * Constraints for subject-based images: force a recognizable subject so the
 * model never falls back to a flat, empty color field.
 */
const SUBJECT_CONSTRAINTS = `Constraints:
- No text, no words, no letters, no signage anywhere in the image.
- Render a clear, recognizable subject — the people, objects, environment, or symbolic figure described above. Do not produce a purely abstract field of colors or shapes without a subject.
- The rendering style is a treatment applied to the scene, not a replacement for it.
- Make it richly detailed and fully composed, conveying the emotional tone through composition, lighting, and color.`

/**
 * Constraints for intentionally abstract images (fractals, patterns, cosmic
 * fields). No subject is required, but the frame must still be rich and full —
 * not an empty or minimal wash.
 */
const ABSTRACT_CONSTRAINTS = `Constraints:
- No text, no words, no letters, no signage anywhere in the image.
- This is an intentionally abstract image: render the forms, patterns, textures, and colors described above with rich, intricate detail and depth. Do NOT include literal figures or objects.
- Fill the frame edge to edge with evocative visual interest — never a flat, empty, or minimal field.
- Apply the rendering style above as the visual treatment.`

// Default output resolution (1K square). Both callers omit width/height, so this
// is what we actually generate unless a caller overrides it.
const DEFAULT_IMAGE_WIDTH = 1024
const DEFAULT_IMAGE_HEIGHT = 1024

/**
 * A single image-generation backend: takes an already-assembled prompt (+ target
 * dimensions) and returns a normalized { imageUrl, seed }. Both fal models return
 * the same output shape (`images[0].url` + `seed`), so callers don't care which
 * one ran.
 */
interface ImageModel {
  name: string
  generate: (
    prompt: string,
    width: number,
    height: number,
  ) => Promise<ImageGenerationResult>
}

/**
 * Shared parser for both models — fal image endpoints all return
 * `{ images: [{ url, ... }], seed }`. Cast through unknown to bridge the SDK's
 * generic type and the actual API response.
 */
function parseImageResult(
  modelName: string,
  result: unknown,
): ImageGenerationResult {
  const data = (
    result as {
      data?: {
        images?: Array<{ url: string; content_type?: string }>
        seed?: number
      }
    }
  ).data

  const imageUrl = data?.images?.[0]?.url

  if (!imageUrl) {
    console.error(`[fal.ai Image:${modelName}] No image URL in response:`, data)
    throw new Error('No image URL in response')
  }

  return {
    imageUrl,
    // `data` is proven non-null here: imageUrl derives from data.images[0].url.
    seed: data.seed || 0,
  }
}

/**
 * Default model: Krea 2 Turbo. Fast, high-quality 1K text-to-image.
 * Uses a custom `image_size` object to request an exact 1024×1024 (1K) frame.
 */
const kreaModel: ImageModel = {
  name: 'krea-2-turbo',
  async generate(prompt, width, height) {
    const result = await fal.subscribe('fal-ai/krea-2/turbo', {
      input: {
        prompt,
        image_size: { width, height },
        num_images: 1,
        output_format: 'png',
      },
    })
    return parseImageResult('krea-2-turbo', result)
  },
}

/**
 * Fallback model: ImagineArt 2.0. Used only if Krea fails. It takes an aspect
 * ratio + resolution preset rather than explicit pixel dimensions, so we map to
 * its 1K / 1:1 preset (our default target is square anyway).
 */
const imagineArtModel: ImageModel = {
  name: 'imagineart-2.0',
  async generate(prompt) {
    const result = await fal.subscribe(
      'imagineart/imagineart-2.0-preview/text-to-image',
      {
        input: {
          prompt,
          aspect_ratio: '1:1',
          resolution: '1K',
        },
      },
    )
    return parseImageResult('imagineart-2.0', result)
  },
}

/**
 * Image models tried in order. The first entry is the default; later entries are
 * silent fallbacks used only when an earlier model errors. This ordering is the
 * single source of truth for "which model do we use" — adding a model is just a
 * new entry here.
 */
const IMAGE_MODELS: Array<ImageModel> = [kreaModel, imagineArtModel]

/**
 * Generate an image from a visual scene description and style.
 *
 * Renders with Krea 2 Turbo by default and silently falls back to ImagineArt 2.0
 * if Krea errors (see `IMAGE_MODELS`). Model selection is backend-only — it is
 * never surfaced to the user.
 *
 * `sceneDescription` should already be a concrete, vivid scene (see
 * `generateImageScene`), not a raw reflection summary — these models follow
 * prompts very literally, so they render a described scene far better than they
 * interpret abstract journal prose.
 *
 * `allowAbstract` flips the constraints: when the scene-writer chose an abstract
 * visual approach (fractals/patterns/cosmic), we drop the subject requirement;
 * otherwise we enforce a recognizable subject to avoid flat, empty output.
 */
export async function generateImage(
  sceneDescription: string,
  config: {
    style: ImageStyle
    allowAbstract?: boolean
    width?: number
    height?: number
  },
): Promise<ImageGenerationResult> {
  // Mock mode for development
  if (MOCK_FAL) {
    return mockGenerateImage()
  }

  if (!process.env.FAL_KEY) {
    console.error('[fal.ai] FAL_KEY is not set!')
    throw new Error('FAL_KEY is required')
  }

  const width = config.width ?? DEFAULT_IMAGE_WIDTH
  const height = config.height ?? DEFAULT_IMAGE_HEIGHT

  const stylePrompt = STYLE_PROMPTS[config.style]
  const constraints = config.allowAbstract
    ? ABSTRACT_CONSTRAINTS
    : SUBJECT_CONSTRAINTS

  // These models follow prompts very literally, so we:
  // 1. Lead with the concrete thing to depict (the described scene)
  // 2. Apply style as a *rendering treatment* on top of it
  // 3. Enforce subject-vs-abstract via the matching constraints block
  const prompt = `Depict the following ${config.allowAbstract ? 'abstract composition' : 'scene'} as a single evocative image:

"${sceneDescription.slice(0, 1500)}"

${stylePrompt}

${constraints}`

  console.log(
    '[fal.ai Image] Generating image with prompt:',
    prompt.slice(0, 100) + '...',
  )

  // Try each model in order; the first success wins. Later models are silent
  // fallbacks used only when an earlier one errors.
  let lastError: unknown
  for (const model of IMAGE_MODELS) {
    try {
      const result = await model.generate(prompt, width, height)
      console.log(
        `[fal.ai Image:${model.name}] Success! Image URL: ${result.imageUrl}`,
      )
      return result
    } catch (error) {
      lastError = error
      console.error(`[fal.ai Image:${model.name}] Error:`, error)
      const isLast = model === IMAGE_MODELS[IMAGE_MODELS.length - 1]
      if (!isLast) {
        console.warn(
          `[fal.ai Image] ${model.name} failed — falling back to next model.`,
        )
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('All image models failed')
}

/**
 * Mock image generation for development
 */
async function mockGenerateImage(): Promise<ImageGenerationResult> {
  console.log('[fal.ai Image] Running in mock mode')
  await sleep(1000)
  return {
    imageUrl: 'https://placehold.co/1024x1024/f5f5f5/333333?text=Memory+Image',
    seed: Math.floor(Math.random() * 1000000),
  }
}

// ==========================================
// Helpers
// ==========================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
