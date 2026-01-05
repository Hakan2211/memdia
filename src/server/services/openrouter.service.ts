/**
 * OpenRouter Service
 * Handles LLM interactions via OpenRouter (Gemini 2.5 Flash/Pro)
 *
 * Features:
 * - Streaming text responses via SSE
 * - Conversation context management
 * - Configurable model selection
 */

// ==========================================
// Types
// ==========================================

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface OpenRouterConfig {
  apiKey?: string
  model?: string
  maxTokens?: number
  temperature?: number
}

export interface StreamCallbacks {
  onToken: (token: string) => void
  onComplete: (fullText: string) => void
  onError: (error: Error) => void
}

// ==========================================
// Constants
// ==========================================

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'

/** Available models via OpenRouter */
export const OPENROUTER_MODELS = {
  // Gemini 3 Flash Preview - fast and capable
  GEMINI_3_FLASH: 'google/gemini-3-flash-preview',
  // Gemini 2 Flash - stable fallback
  GEMINI_2_FLASH: 'google/gemini-2.0-flash-001',
  // Gemini Pro for complex tasks
  GEMINI_PRO: 'google/gemini-2.5-pro-preview-03-25',
  // Fallback options
  GEMINI_FLASH_STABLE: 'google/gemini-flash-1.5',
  GPT_4O_MINI: 'openai/gpt-4o-mini',
} as const

const DEFAULT_CONFIG: OpenRouterConfig = {
  model: OPENROUTER_MODELS.GEMINI_3_FLASH,
  maxTokens: 500,
  temperature: 0.7,
}

// ==========================================
// Mock Mode
// ==========================================

const MOCK_OPENROUTER = process.env.MOCK_OPENROUTER === 'true'

// ==========================================
// Service
// ==========================================

/**
 * Generate a streaming chat completion
 */
export async function streamChatCompletion(
  messages: ChatMessage[],
  callbacks: StreamCallbacks,
  config?: OpenRouterConfig,
): Promise<void> {
  const startTime = Date.now()
  const apiKey = config?.apiKey || process.env.OPENROUTER_API_KEY

  if (!apiKey && !MOCK_OPENROUTER) {
    throw new Error('OPENROUTER_API_KEY is required')
  }

  // Mock mode for development
  if (MOCK_OPENROUTER) {
    return mockStreamCompletion(messages, callbacks)
  }

  const mergedConfig = { ...DEFAULT_CONFIG, ...config }
  console.log(`[OpenRouter] Starting stream with model: ${mergedConfig.model}`)

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.BETTER_AUTH_URL || 'http://localhost:3000',
        'X-Title': 'Voice AI Daily Companion',
      },
      body: JSON.stringify({
        model: mergedConfig.model,
        messages,
        max_tokens: mergedConfig.maxTokens,
        temperature: mergedConfig.temperature,
        stream: true,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`)
    }

    if (!response.body) {
      throw new Error('No response body received')
    }

    // Process SSE stream
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let fullText = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n')

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)

          if (data === '[DONE]') {
            const latency = Date.now() - startTime
            console.log(
              `[OpenRouter] Stream complete (${latency}ms), ${fullText.length} chars`,
            )
            callbacks.onComplete(fullText)
            return
          }

          try {
            const parsed = JSON.parse(data)
            const token = parsed.choices?.[0]?.delta?.content

            if (token) {
              fullText += token
              callbacks.onToken(token)
            }
          } catch {
            // Skip invalid JSON lines
          }
        }
      }
    }

    const latency = Date.now() - startTime
    console.log(
      `[OpenRouter] Stream ended (${latency}ms), ${fullText.length} chars`,
    )
    callbacks.onComplete(fullText)
  } catch (error) {
    const latency = Date.now() - startTime
    console.error(`[OpenRouter] Stream error after ${latency}ms:`, error)
    callbacks.onError(
      error instanceof Error ? error : new Error('Unknown error'),
    )
  }
}

/**
 * Generate a non-streaming chat completion
 */
export async function chatCompletion(
  messages: ChatMessage[],
  config?: OpenRouterConfig,
): Promise<string> {
  const apiKey = config?.apiKey || process.env.OPENROUTER_API_KEY

  if (!apiKey && !MOCK_OPENROUTER) {
    console.error('[OpenRouter] OPENROUTER_API_KEY is not set!')
    throw new Error('OPENROUTER_API_KEY is required')
  }

  // Mock mode for development
  if (MOCK_OPENROUTER) {
    return mockCompletion(messages)
  }

  const mergedConfig = { ...DEFAULT_CONFIG, ...config }

  console.log('[OpenRouter] Calling API with model:', mergedConfig.model)
  console.log(
    '[OpenRouter] Messages:',
    JSON.stringify(
      messages.map((m) => ({ role: m.role, content: m.content.slice(0, 100) })),
      null,
      2,
    ),
  )

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.BETTER_AUTH_URL || 'http://localhost:3000',
      'X-Title': 'Memdia Voice AI Companion',
    },
    body: JSON.stringify({
      model: mergedConfig.model,
      messages,
      max_tokens: mergedConfig.maxTokens,
      temperature: mergedConfig.temperature,
      stream: false,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[OpenRouter] API error:', response.status, errorText)
    throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  const result = data.choices?.[0]?.message?.content || ''
  console.log('[OpenRouter] Response:', result.slice(0, 100) + '...')
  return result
}

/**
 * Mock streaming completion for development
 */
async function mockStreamCompletion(
  messages: ChatMessage[],
  callbacks: StreamCallbacks,
): Promise<void> {
  console.log('[OpenRouter] Running in mock mode')

  const lastUserMessage = [...messages]
    .reverse()
    .find((m) => m.role === 'user')?.content
  const mockResponses = [
    "That sounds like you've had quite a day! Tell me more about how that made you feel.",
    "I appreciate you sharing that with me. It's important to acknowledge these feelings.",
    'What do you think was the most significant moment of your day?',
    "It sounds like there's a lot on your mind. Let's unpack that together.",
    'Thank you for opening up. How are you feeling right now in this moment?',
  ]

  // Select a response based on the last message
  const responseIndex = lastUserMessage
    ? Math.abs(lastUserMessage.length % mockResponses.length)
    : 0
  const response = mockResponses[responseIndex]!

  // Simulate streaming with delays
  const words = response.split(' ')
  let fullText = ''

  for (const word of words) {
    const token = (fullText ? ' ' : '') + word
    fullText += token
    callbacks.onToken(token)
    await sleep(50 + Math.random() * 50) // 50-100ms per word
  }

  callbacks.onComplete(fullText)
}

/**
 * Mock non-streaming completion for development
 */
async function mockCompletion(messages: ChatMessage[]): Promise<string> {
  console.log('[OpenRouter] Running in mock mode (non-streaming)')

  // Simulate API delay
  await sleep(500)

  const isConversation = messages.some(
    (m) => m.role === 'system' && m.content.includes('conversation'),
  )
  const isSummary = messages.some(
    (m) => m.role === 'system' && m.content.includes('summary'),
  )

  if (isSummary) {
    return `Today's reflection reveals a moment of growth and self-awareness. The conversation touched on themes of daily challenges and personal resilience. There's a sense of processing emotions while maintaining forward momentum.

The dialogue showed genuine engagement with life's complexities, acknowledging both struggles and small victories. It's clear that taking time for reflection serves as an important anchor point in the day.

Moving forward, there's an opportunity to build on these insights and continue cultivating mindfulness in daily experiences.`
  }

  if (isConversation) {
    return "That's a meaningful reflection. How does that connect to what you're hoping for tomorrow?"
  }

  return 'Thank you for sharing. Is there anything else on your mind?'
}

/**
 * Validate OpenRouter API key
 */
export async function validateOpenRouterApiKey(
  apiKey: string,
): Promise<boolean> {
  if (MOCK_OPENROUTER) return true

  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    })
    return response.ok
  } catch {
    return false
  }
}

// ==========================================
// Helpers
// ==========================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
