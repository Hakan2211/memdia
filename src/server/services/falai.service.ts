/**
 * fal.ai Service
 * Handles Text-to-Speech (ElevenLabs) and Image Generation (ImagineArt 1.5)
 *
 * Uses the official @fal-ai/client
 *
 * Models:
 * - TTS: fal-ai/elevenlabs/tts/eleven-v3
 * - Image: imagineart/imagineart-1.5-preview/text-to-image
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
 * Model: fal-ai/elevenlabs/tts/eleven-v3
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

  console.log('[fal.ai TTS] Generating speech for:', text.slice(0, 50) + '...')

  try {
    const result = await fal.subscribe('fal-ai/elevenlabs/tts/eleven-v3', {
      input: {
        text,
        // Use a warm, friendly voice - Rachel is the default
        voice: voiceId || 'Rachel',
        stability: 0.5,
        similarity_boost: 0.75,
        speed: 1,
      },
    })

    console.log('[fal.ai TTS] Raw result:', JSON.stringify(result, null, 2))

    const data = result.data as {
      audio: { url: string; content_type?: string; file_size?: number }
    }

    if (!data.audio?.url) {
      console.error('[fal.ai TTS] No audio URL in response:', data)
      throw new Error('No audio URL in response')
    }

    // Estimate duration based on text length
    const estimatedDuration = estimateDuration(text)

    console.log('[fal.ai TTS] Success! Audio URL:', data.audio.url)

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
// Image Generation Service using ImagineArt 1.5
// ==========================================

/** Style prompts for different image styles */
const STYLE_PROMPTS: Record<ImageStyle, string> = {
  realistic: `Style: photorealistic, hyperreal, cinematic photography quality,
    realistic lighting and shadows, natural textures, detailed environmental elements,
    editorial photography aesthetic, lifelike colors, professional composition,
    high-quality 4K detail, real-world scene visualization`,

  dreamlike: `Style: ethereal, soft focus, pastel colors, minimalist composition, 
    dreamlike atmosphere, gentle gradients, calm and serene, subtle symbolism, 
    fine art photography aesthetic, muted tones, peaceful mood`,

  watercolor: `Style: delicate watercolor painting, soft washes of color, 
    organic flowing shapes, gentle bleeding edges, artistic and emotional, 
    traditional watercolor texture, loose brushwork, expressive`,

  geometric: `Style: abstract geometric shapes, clean lines, modern minimalist, 
    bold but harmonious colors, mathematical precision, contemporary art, 
    balanced composition, sophisticated simplicity`,

  sketch: `Style: elegant pencil sketch, fine line art, minimalist drawing, 
    subtle shading, artistic illustration, clean strokes, 
    delicate details, hand-drawn aesthetic, monochromatic with hints of color`,
}

/**
 * Generate an image based on a summary and style using ImagineArt 1.5
 * Model: imagineart/imagineart-1.5-preview/text-to-image
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

  // Build the full prompt
  const prompt = `Create a symbolic, artistic image representing the emotional themes of this reflection:

${summary.slice(0, 500)}

${stylePrompt}

Important: No text, no words, no letters in the image. Pure visual art only. Abstract and symbolic.`

  console.log(
    '[fal.ai Image] Generating image with prompt:',
    prompt.slice(0, 100) + '...',
  )

  try {
    const result = await fal.subscribe(
      'imagineart/imagineart-1.5-preview/text-to-image',
      {
        input: {
          prompt,
          // ImagineArt 1.5 uses aspect_ratio instead of image_size
          aspect_ratio: '1:1',
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
