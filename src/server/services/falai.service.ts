/**
 * fal.ai Service
 * Handles Text-to-Speech (ElevenLabs) and Image Generation (ImagineArt 2.0)
 *
 * Uses the official @fal-ai/client
 *
 * Models:
 * - TTS: fal-ai/elevenlabs/tts/turbo-v2.5 (faster than eleven-v3)
 * - Image: imagineart/imagineart-2.0-preview/text-to-image
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

/**
 * Generate an image from a visual scene description and style using ImagineArt 2.0
 * Model: imagineart/imagineart-2.0-preview/text-to-image
 *
 * `sceneDescription` should already be a concrete, vivid scene (see
 * `generateImageScene`), not a raw reflection summary — ImagineArt 2.0 follows
 * prompts very literally, so it renders a described scene far better than it
 * interprets abstract journal prose.
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

  const stylePrompt = STYLE_PROMPTS[config.style]
  const constraints = config.allowAbstract
    ? ABSTRACT_CONSTRAINTS
    : SUBJECT_CONSTRAINTS

  // ImagineArt 2.0 follows prompts very literally, so we:
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

  try {
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

    console.log('[fal.ai Image] Raw result:', JSON.stringify(result, null, 2))

    // ImagineArt output: images is Array<{ url, content_type, ... }>
    // Cast through unknown to handle SDK type mismatch with actual API response
    const data = result.data as unknown as {
      images: Array<{ url: string; content_type?: string }>
      seed?: number
    }

    // Get the image URL directly from the first image
    const imageUrl = data.images?.[0]?.url

    if (!imageUrl) {
      console.error('[fal.ai Image] No image URL in response:', data)
      throw new Error('No image URL in response')
    }

    console.log('[fal.ai Image] Success! Image URL:', imageUrl)

    return {
      imageUrl,
      seed: data.seed || 0,
    }
  } catch (error) {
    console.error('[fal.ai Image] Error:', error)
    throw error
  }
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
