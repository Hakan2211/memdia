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
 * Note: ImagineArt 2.0 follows prompts very literally. Style descriptions are
 * framed as a *rendering treatment* applied to a concrete scene, rather than
 * abstract qualities that could replace the subject. Words like "abstract",
 * "minimalist", or "shapes only" are avoided as primary descriptors because
 * the model otherwise drops figures/objects entirely.
 */
const STYLE_PROMPTS: Record<ImageStyle, string> = {
  realistic: `Render the scene as photorealistic, cinematic photography:
    natural lighting and shadows, real textures, depth of field,
    editorial composition, lifelike colors, high detail.
    Include real people, objects, and environments — a believable moment captured on camera.`,

  dreamlike: `Render the scene with a soft, dreamlike atmosphere:
    pastel palette, gentle gradients, hazy light, a slightly surreal mood.
    Still depict recognizable people, objects, or places — just bathed in this dreamy quality,
    as if remembered rather than photographed. Avoid empty color fields.`,

  watercolor: `Render the scene as a delicate watercolor painting:
    soft washes of color, organic flowing edges, visible paper texture,
    loose expressive brushwork. The subject — people, objects, an environment —
    should be clearly readable, painted with emotional, painterly strokes.`,

  geometric: `Render the scene in a stylized geometric illustration style:
    figures, objects, and environments built from clean geometric forms,
    bold harmonious colors, modernist composition, flat-design influence.
    Think contemporary editorial illustration — there must still be a recognizable
    subject (people, places, symbolic objects), simplified into geometric shapes
    rather than replaced by pure abstract patterns.`,

  sketch: `Render the scene as an elegant hand-drawn pencil sketch:
    fine confident line work, subtle shading, expressive strokes,
    occasional hints of color wash. Depict real subjects — people, objects,
    a place — as if drawn from life in a sketchbook.`,
}

/** Style-specific endings to reinforce the visual style */
const STYLE_ENDINGS: Record<ImageStyle, string> = {
  realistic:
    'Final result should look like a candid editorial photograph of a real moment — with people, objects, or a clear environment present.',
  dreamlike:
    'Final result should feel like a softly remembered moment with a recognizable subject — not an empty color wash.',
  watercolor:
    'Final result should look like a painted scene with a clear subject rendered in flowing watercolor — not just abstract color blooms.',
  geometric:
    'Final result should be a stylized illustration of a scene or figure built from geometric forms — not a pattern of shapes without a subject.',
  sketch:
    'Final result should look like a sketchbook drawing of a real scene or person — not just abstract pencil marks.',
}

/**
 * Generate an image based on a summary and style using ImagineArt 2.0
 * Model: imagineart/imagineart-2.0-preview/text-to-image
 */
export async function generateImage(
  summary: string,
  config: { style: ImageStyle; width?: number; height?: number },
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
  const styleEnding = STYLE_ENDINGS[config.style]

  // ImagineArt 2.0 follows prompts very literally, so we:
  // 1. Lead with a concrete scene direction (subjects must appear)
  // 2. Apply style as a *rendering treatment* on top of that scene
  // 3. Explicitly forbid pure-abstract / subjectless output
  const prompt = `Create a single evocative image inspired by this personal reflection:

"${summary.slice(0, 500)}"

Visualize a concrete scene that captures the feeling of this reflection — for example a person, a place, an object, a moment, or a symbolic situation drawn from the reflection itself. The image must contain a clearly recognizable subject; do not produce a purely abstract composition of colors or shapes without a subject. Use composition, lighting, and color to convey the emotional tone.

${stylePrompt}

Constraints:
- No text, no words, no letters, no signage anywhere in the image.
- Must contain a discernible subject (people, objects, environment, or symbolic figure) — not just colors or patterns.
- Style is a rendering treatment applied to the scene, not a replacement for it.

${styleEnding}`

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
