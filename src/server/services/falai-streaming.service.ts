/**
 * fal.ai Streaming TTS Service
 * Provides streaming text-to-speech using fal.stream() for lower latency
 *
 * Uses ElevenLabs Turbo v2.5 via fal.ai with streaming support
 */

import { fal } from '@fal-ai/client'

// ==========================================
// Types
// ==========================================

export interface TTSStreamChunk {
  type: 'audio_chunk' | 'done'
  /** Base64 encoded audio data */
  audioBase64?: string
  /** Audio URL from fal.ai (alternative to base64) */
  audioUrl?: string
  /** MIME type of the audio */
  contentType?: string
  /** Estimated duration in seconds */
  durationSeconds?: number
}

export interface StreamSpeechOptions {
  /** Voice ID to use (default: Rachel) */
  voiceId?: string
  /** Voice stability 0-1 (default: 0.5) */
  stability?: number
  /** Similarity boost 0-1 (default: 0.75) */
  similarityBoost?: number
  /** Speech speed 0.7-1.2 (default: 1) */
  speed?: number
  /** Return base64 instead of URL (default: true for lower latency) */
  returnBase64?: boolean
}

// ==========================================
// Mock Mode
// ==========================================

const MOCK_FAL = process.env.MOCK_FAL === 'true'

// ==========================================
// Streaming TTS Service
// ==========================================

/**
 * Stream TTS audio using fal.stream()
 * Yields audio chunks as they're generated for lower latency
 *
 * Note: fal.ai streaming may return the complete audio at once or in chunks
 * depending on the model's support. We handle both cases.
 */
export async function* streamSpeech(
  text: string,
  options: StreamSpeechOptions = {},
): AsyncGenerator<TTSStreamChunk> {
  const {
    voiceId = 'Rachel',
    stability = 0.5,
    similarityBoost = 0.75,
    speed = 1,
    returnBase64 = true,
  } = options

  // Mock mode for development
  if (MOCK_FAL) {
    yield* mockStreamSpeech(text)
    return
  }

  if (!process.env.FAL_KEY) {
    console.error('[fal.ai Streaming] FAL_KEY is not set!')
    throw new Error('FAL_KEY is required')
  }

  const startTime = Date.now()
  console.log(
    `[fal.ai Streaming] Starting TTS stream for: "${text.slice(0, 50)}..."`,
  )

  try {
    // Use fal.stream for streaming TTS
    const stream = await fal.stream('fal-ai/elevenlabs/tts/turbo-v2.5', {
      input: {
        text,
        voice: voiceId,
        stability,
        similarity_boost: similarityBoost,
        speed,
      },
    })

    let chunkCount = 0
    // Accumulate binary chunks for streaming APIs that return raw audio bytes
    const binaryChunks: Array<Uint8Array> = []

    // Process streaming events
    for await (const event of stream) {
      chunkCount++
      const chunkTime = Date.now() - startTime

      // Check if event is raw binary data (Uint8Array or ArrayBuffer)
      if (event instanceof Uint8Array) {
        console.log(
          `[fal.ai Streaming] Received binary chunk ${chunkCount} (${chunkTime}ms): ${event.length} bytes`,
        )
        binaryChunks.push(event)
        continue
      }

      if (event instanceof ArrayBuffer) {
        console.log(
          `[fal.ai Streaming] Received ArrayBuffer chunk ${chunkCount} (${chunkTime}ms): ${event.byteLength} bytes`,
        )
        binaryChunks.push(new Uint8Array(event))
        continue
      }

      // Check if event is a JSON object with numeric keys (serialized binary)
      // This happens when fal.stream() returns raw bytes as { "0": 73, "1": 68, ... }
      if (
        typeof event === 'object' &&
        event !== null &&
        '0' in event &&
        typeof (event as any)['0'] === 'number'
      ) {
        const keys = Object.keys(event)
        const numericKeys = keys.filter((k) => !isNaN(parseInt(k, 10)))
        if (numericKeys.length === keys.length) {
          // This is serialized binary data
          const length = numericKeys.length
          const bytes = new Uint8Array(length)
          for (let i = 0; i < length; i++) {
            bytes[i] = (event as any)[i.toString()]
          }
          console.log(
            `[fal.ai Streaming] Received serialized binary chunk ${chunkCount} (${chunkTime}ms): ${length} bytes`,
          )
          binaryChunks.push(bytes)
          continue
        }
      }

      console.log(
        `[fal.ai Streaming] Received chunk ${chunkCount} (${chunkTime}ms):`,
        JSON.stringify(event).slice(0, 200),
      )

      // Handle different response formats from fal.ai
      const audioData = (event as any).audio || (event as any).data?.audio

      if (audioData?.url) {
        if (returnBase64) {
          // Fetch and convert to base64 for direct streaming to client
          try {
            const response = await fetch(audioData.url)
            if (response.ok) {
              const buffer = await response.arrayBuffer()
              const base64 = Buffer.from(buffer).toString('base64')

              yield {
                type: 'audio_chunk',
                audioBase64: base64,
                audioUrl: audioData.url,
                contentType: audioData.content_type || 'audio/mpeg',
                durationSeconds: estimateDuration(text),
              }
            }
          } catch (fetchError) {
            console.error(
              '[fal.ai Streaming] Failed to fetch audio chunk:',
              fetchError,
            )
            // Fall back to URL
            yield {
              type: 'audio_chunk',
              audioUrl: audioData.url,
              contentType: audioData.content_type || 'audio/mpeg',
              durationSeconds: estimateDuration(text),
            }
          }
        } else {
          yield {
            type: 'audio_chunk',
            audioUrl: audioData.url,
            contentType: audioData.content_type || 'audio/mpeg',
            durationSeconds: estimateDuration(text),
          }
        }
      }
    }

    // If we accumulated binary chunks, combine and yield them
    if (binaryChunks.length > 0) {
      const totalLength = binaryChunks.reduce(
        (sum, chunk) => sum + chunk.length,
        0,
      )
      const combined = new Uint8Array(totalLength)
      let offset = 0
      for (const chunk of binaryChunks) {
        combined.set(chunk, offset)
        offset += chunk.length
      }

      console.log(
        `[fal.ai Streaming] Combined ${binaryChunks.length} binary chunks (${totalLength} bytes)`,
      )

      const base64 = Buffer.from(combined).toString('base64')
      yield {
        type: 'audio_chunk',
        audioBase64: base64,
        contentType: 'audio/mpeg',
        durationSeconds: estimateDuration(text),
      }
    }

    // Get final result
    const result = await stream.done()
    const totalTime = Date.now() - startTime

    console.log(
      `[fal.ai Streaming] Stream complete (${totalTime}ms), ${chunkCount} chunks`,
    )

    // If no chunks were yielded during streaming, yield the final result
    if (chunkCount === 0) {
      const finalAudio = (result as any).audio || (result as any).data?.audio

      if (finalAudio?.url) {
        if (returnBase64) {
          try {
            const response = await fetch(finalAudio.url)
            if (response.ok) {
              const buffer = await response.arrayBuffer()
              const base64 = Buffer.from(buffer).toString('base64')

              yield {
                type: 'audio_chunk',
                audioBase64: base64,
                audioUrl: finalAudio.url,
                contentType: finalAudio.content_type || 'audio/mpeg',
                durationSeconds: estimateDuration(text),
              }
            }
          } catch (fetchError) {
            console.error(
              '[fal.ai Streaming] Failed to fetch final audio:',
              fetchError,
            )
            yield {
              type: 'audio_chunk',
              audioUrl: finalAudio.url,
              contentType: finalAudio.content_type || 'audio/mpeg',
              durationSeconds: estimateDuration(text),
            }
          }
        } else {
          yield {
            type: 'audio_chunk',
            audioUrl: finalAudio.url,
            contentType: finalAudio.content_type || 'audio/mpeg',
            durationSeconds: estimateDuration(text),
          }
        }
      }
    }

    yield { type: 'done' }
  } catch (error) {
    console.error('[fal.ai Streaming] Error:', error)
    throw error
  }
}

/**
 * Generate speech and return base64 audio directly (non-streaming, but faster than URL fetch)
 * Good for short sentences where streaming overhead isn't worth it
 */
export async function generateSpeechBase64(
  text: string,
  options: StreamSpeechOptions = {},
): Promise<{
  audioBase64: string
  contentType: string
  durationSeconds: number
}> {
  const {
    voiceId = 'Rachel',
    stability = 0.5,
    similarityBoost = 0.75,
    speed = 1,
  } = options

  if (MOCK_FAL) {
    return {
      audioBase64: '', // Empty for mock
      contentType: 'audio/mpeg',
      durationSeconds: estimateDuration(text),
    }
  }

  if (!process.env.FAL_KEY) {
    throw new Error('FAL_KEY is required')
  }

  const startTime = Date.now()

  const result = await fal.subscribe('fal-ai/elevenlabs/tts/turbo-v2.5', {
    input: {
      text,
      voice: voiceId,
      stability,
      similarity_boost: similarityBoost,
      speed,
    },
  })

  const audioData = (result as any).data?.audio

  if (!audioData?.url) {
    throw new Error('No audio URL in response')
  }

  // Fetch and convert to base64
  const response = await fetch(audioData.url)
  if (!response.ok) {
    throw new Error(`Failed to fetch audio: ${response.status}`)
  }

  const buffer = await response.arrayBuffer()
  const base64 = Buffer.from(buffer).toString('base64')

  const latency = Date.now() - startTime
  console.log(`[fal.ai] Generated base64 audio (${latency}ms)`)

  return {
    audioBase64: base64,
    contentType: audioData.content_type || 'audio/mpeg',
    durationSeconds: estimateDuration(text),
  }
}

// ==========================================
// Helpers
// ==========================================

/**
 * Estimate audio duration based on text length
 * Average speaking rate: ~150 words per minute
 */
function estimateDuration(text: string): number {
  const words = text.split(/\s+/).length
  const wordsPerSecond = 150 / 60 // 2.5 words per second
  return Math.max(1, Math.ceil(words / wordsPerSecond))
}

/**
 * Mock streaming for development
 */
async function* mockStreamSpeech(text: string): AsyncGenerator<TTSStreamChunk> {
  console.log('[fal.ai Streaming] Running in mock mode')

  // Simulate streaming delay
  await sleep(200)

  yield {
    type: 'audio_chunk',
    audioBase64: '', // Empty for mock
    contentType: 'audio/mpeg',
    durationSeconds: estimateDuration(text),
  }

  yield { type: 'done' }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
