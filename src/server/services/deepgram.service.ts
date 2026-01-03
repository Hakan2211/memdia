/**
 * Deepgram Service
 * Handles real-time speech-to-text transcription
 *
 * Features:
 * - WebSocket streaming for real-time transcription
 * - Voice Activity Detection (VAD)
 * - End of utterance detection
 * - Partial and final transcript handling
 */

// ==========================================
// Types
// ==========================================

export interface DeepgramConfig {
  apiKey: string
  model?: string
  language?: string
  punctuate?: boolean
  interimResults?: boolean
  utteranceEndMs?: number
  vadEvents?: boolean
}

export interface DeepgramTranscript {
  /** The transcribed text */
  text: string
  /** Whether this is a final (vs interim) result */
  isFinal: boolean
  /** Confidence score (0-1) */
  confidence: number
  /** Start time in seconds */
  start: number
  /** Duration in seconds */
  duration: number
  /** Words with timing information */
  words: Array<{
    word: string
    start: number
    end: number
    confidence: number
  }>
}

export interface DeepgramEvents {
  onTranscript: (transcript: DeepgramTranscript) => void
  onUtteranceEnd: () => void
  onSpeechStarted: () => void
  onError: (error: Error) => void
  onClose: () => void
}

// ==========================================
// Constants
// ==========================================

const DEEPGRAM_WS_URL = 'wss://api.deepgram.com/v1/listen'

const DEFAULT_CONFIG: Partial<DeepgramConfig> = {
  model: 'nova-2',
  language: 'en',
  punctuate: true,
  interimResults: true,
  utteranceEndMs: 1000, // 1 second silence to end utterance
  vadEvents: true,
}

// ==========================================
// Mock Mode
// ==========================================

const MOCK_DEEPGRAM = process.env.MOCK_DEEPGRAM === 'true'

// ==========================================
// Service
// ==========================================

/**
 * Create a Deepgram WebSocket connection for streaming audio
 */
export function createDeepgramConnection(
  config: DeepgramConfig,
  events: DeepgramEvents,
): {
  send: (audioChunk: ArrayBuffer) => void
  close: () => void
} {
  const apiKey = config.apiKey || process.env.DEEPGRAM_API_KEY

  if (!apiKey && !MOCK_DEEPGRAM) {
    throw new Error('DEEPGRAM_API_KEY is required')
  }

  // Mock mode for development
  if (MOCK_DEEPGRAM) {
    return createMockConnection(events)
  }

  const mergedConfig = { ...DEFAULT_CONFIG, ...config }

  // Build WebSocket URL with query parameters
  const params = new URLSearchParams({
    model: mergedConfig.model!,
    language: mergedConfig.language!,
    punctuate: String(mergedConfig.punctuate),
    interim_results: String(mergedConfig.interimResults),
    utterance_end_ms: String(mergedConfig.utteranceEndMs),
    vad_events: String(mergedConfig.vadEvents),
    encoding: 'linear16',
    sample_rate: '16000',
    channels: '1',
  })

  const wsUrl = `${DEEPGRAM_WS_URL}?${params.toString()}`

  // Create WebSocket connection
  const ws = new WebSocket(wsUrl, {
    // @ts-expect-error - Node.js WebSocket accepts headers
    headers: {
      Authorization: `Token ${apiKey}`,
    },
  })

  ws.onopen = () => {
    console.log('[Deepgram] Connected')
  }

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data as string)
      handleDeepgramMessage(data, events)
    } catch (error) {
      console.error('[Deepgram] Failed to parse message:', error)
    }
  }

  ws.onerror = (error) => {
    console.error('[Deepgram] WebSocket error:', error)
    events.onError(new Error('Deepgram WebSocket error'))
  }

  ws.onclose = () => {
    console.log('[Deepgram] Connection closed')
    events.onClose()
  }

  return {
    send: (audioChunk: ArrayBuffer) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(audioChunk)
      }
    },
    close: () => {
      if (ws.readyState === WebSocket.OPEN) {
        // Send close message to Deepgram
        ws.send(JSON.stringify({ type: 'CloseStream' }))
        ws.close()
      }
    },
  }
}

/**
 * Handle incoming Deepgram messages
 */
function handleDeepgramMessage(
  data: Record<string, unknown>,
  events: DeepgramEvents,
) {
  const type = data.type as string

  switch (type) {
    case 'Results': {
      const channel = (data.channel as { alternatives: Array<unknown> })
        ?.alternatives?.[0] as Record<string, unknown> | undefined

      if (channel) {
        const transcript: DeepgramTranscript = {
          text: (channel.transcript as string) || '',
          isFinal: (data.is_final as boolean) || false,
          confidence: (channel.confidence as number) || 0,
          start: (data.start as number) || 0,
          duration: (data.duration as number) || 0,
          words: (channel.words as DeepgramTranscript['words']) || [],
        }

        if (transcript.text) {
          events.onTranscript(transcript)
        }
      }
      break
    }

    case 'UtteranceEnd': {
      events.onUtteranceEnd()
      break
    }

    case 'SpeechStarted': {
      events.onSpeechStarted()
      break
    }

    case 'Error': {
      const message = (data.message as string) || 'Unknown Deepgram error'
      events.onError(new Error(message))
      break
    }

    default:
      // Ignore other message types (Metadata, etc.)
      break
  }
}

/**
 * Create a mock connection for development without API key
 */
function createMockConnection(events: DeepgramEvents) {
  console.log('[Deepgram] Running in mock mode')

  let isOpen = true
  let mockTextIndex = 0
  const mockTexts = [
    "Hello, how's your day going?",
    "That's interesting, tell me more.",
    'I understand how you feel.',
    'What else happened today?',
  ]

  // Simulate periodic transcripts
  const interval = setInterval(() => {
    if (!isOpen) return

    // Simulate speech started
    events.onSpeechStarted()

    // Simulate interim result
    setTimeout(() => {
      if (!isOpen) return
      events.onTranscript({
        text: mockTexts[mockTextIndex]!.slice(0, 10),
        isFinal: false,
        confidence: 0.8,
        start: 0,
        duration: 0.5,
        words: [],
      })
    }, 200)

    // Simulate final result
    setTimeout(() => {
      if (!isOpen) return
      events.onTranscript({
        text: mockTexts[mockTextIndex]!,
        isFinal: true,
        confidence: 0.95,
        start: 0,
        duration: 2,
        words: [],
      })
      mockTextIndex = (mockTextIndex + 1) % mockTexts.length
    }, 500)

    // Simulate utterance end
    setTimeout(() => {
      if (!isOpen) return
      events.onUtteranceEnd()
    }, 600)
  }, 5000)

  return {
    send: (_audioChunk: ArrayBuffer) => {
      // In mock mode, we don't process audio
    },
    close: () => {
      isOpen = false
      clearInterval(interval)
      events.onClose()
    },
  }
}

/**
 * Validate Deepgram API key by making a test request
 */
export async function validateDeepgramApiKey(apiKey: string): Promise<boolean> {
  if (MOCK_DEEPGRAM) return true

  try {
    const response = await fetch('https://api.deepgram.com/v1/projects', {
      headers: {
        Authorization: `Token ${apiKey}`,
      },
    })
    return response.ok
  } catch {
    return false
  }
}
