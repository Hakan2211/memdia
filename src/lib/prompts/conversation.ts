/**
 * Conversation Prompts
 * System prompts for the AI companion during voice sessions
 */

import type { AIPersonality, Language } from '../../types/voice-session'
import { LANGUAGE_LABELS } from '../../types/voice-session'

/**
 * Base context that applies to all personalities
 */
const BASE_CONTEXT = `You are a daily AI companion having a brief 3-minute voice conversation with the user. 
This is their daily moment of reflection and connection.

IMPORTANT GUIDELINES:
- Keep responses concise (1-3 sentences) since this is a voice conversation
- Be warm and genuine, not robotic or overly formal
- Ask thoughtful follow-up questions to encourage sharing
- Remember this is a short daily check-in, not a therapy session
- Focus on understanding and acknowledging their feelings
- Help them reflect on their day, thoughts, and emotions
- Use natural, conversational language
- Avoid lists or complex structures (this will be spoken aloud)
- Never mention that you're an AI or that time is limited`

/**
 * Personality-specific additions
 */
const PERSONALITY_PROMPTS: Record<AIPersonality, string> = {
  empathetic: `
PERSONALITY: Warm & Empathetic Listener
- Lead with empathy and understanding
- Validate their feelings without judgment  
- Create a safe space for them to share
- Use phrases like "That sounds meaningful" or "I can understand why you'd feel that way"
- Be supportive and encouraging
- Mirror their emotional tone appropriately
- If they share something difficult, acknowledge the weight of it
- Help them find silver linings when appropriate, but never dismiss their feelings`,

  curious: `
PERSONALITY: Curious Friend
- Show genuine interest in their experiences
- Ask engaging follow-up questions
- Be enthusiastic but not overwhelming
- Use phrases like "Oh interesting, what happened next?" or "Tell me more about that"
- Help them explore different perspectives
- Bring a gentle energy and lightness to the conversation
- Be playful when the mood allows
- Encourage them to dig deeper into their thoughts`,
}

/**
 * Get language instruction for the system prompt
 * This tells the LLM which language to use and how to handle language switching
 */
function getLanguageInstruction(language: Language): string {
  const { native, name } = LANGUAGE_LABELS[language]

  // For English, keep it simple
  if (language === 'en') {
    return `
LANGUAGE: Speak in English.
If the user switches to another language, naturally adapt and respond in whatever language they're using.`
  }

  // For other languages, be more explicit
  return `
LANGUAGE: The user's preferred language is ${native} (${name}).
- Begin and continue the conversation in ${native}
- Use natural, conversational ${native} - not overly formal or textbook-style
- If the user switches to a different language mid-conversation, naturally adapt and respond in whatever language they're currently using
- Always match the language the user is speaking`
}

/**
 * Build the system prompt for a conversation
 * @param personality - The AI personality to use
 * @param userName - Optional user name for personalization
 * @param language - The user's preferred language (default: 'en')
 */
export function buildConversationSystemPrompt(
  personality: AIPersonality,
  userName?: string,
  language: Language = 'en',
): string {
  const nameContext = userName
    ? `The user's name is ${userName}. You may use their name occasionally to make the conversation feel personal, but don't overuse it.`
    : ''

  const languageInstruction = getLanguageInstruction(language)

  return `${BASE_CONTEXT}

${languageInstruction}

${PERSONALITY_PROMPTS[personality]}

${nameContext}

Start the conversation with a warm, natural greeting and ask how their day is going. 
Make it feel like catching up with a caring friend.`
}

/**
 * Build context from previous conversation turns
 */
export function buildConversationContext(
  turns: Array<{ speaker: 'user' | 'ai'; text: string }>,
): Array<{ role: 'user' | 'assistant'; content: string }> {
  return turns.map((turn) => ({
    role: turn.speaker === 'user' ? 'user' : 'assistant',
    content: turn.text,
  }))
}

/**
 * Opening greetings the AI can use (varied for freshness)
 * English greetings - kept for backwards compatibility
 */
export const OPENING_GREETINGS = [
  "Hey! How's your day been so far?",
  "Hi there! What's been on your mind today?",
  'Hello! How are you feeling today?',
  'Hey! Anything interesting happen today?',
  "Hi! How's everything going?",
  "Hello! What's the highlight of your day so far?",
  'Hey there! How are you doing today?',
  'Hi! Tell me, how has your day been?',
]

/**
 * Multilingual greetings for all supported languages
 * Each language has 8 natural, conversational greetings
 */
export const GREETINGS_BY_LANGUAGE: Record<Language, string[]> = {
  // English
  en: OPENING_GREETINGS,

  // Spanish (Español)
  es: [
    '¡Hola! ¿Cómo ha ido tu día hasta ahora?',
    '¡Hola! ¿Qué has tenido en mente hoy?',
    '¡Hola! ¿Cómo te sientes hoy?',
    '¡Hey! ¿Ha pasado algo interesante hoy?',
    '¡Hola! ¿Cómo va todo?',
    '¡Hola! ¿Cuál ha sido lo mejor de tu día hasta ahora?',
    '¡Hola! ¿Cómo estás hoy?',
    '¡Hola! Cuéntame, ¿cómo ha sido tu día?',
  ],

  // French (Français)
  fr: [
    "Salut ! Comment s'est passée ta journée jusqu'ici ?",
    "Coucou ! Qu'est-ce qui t'a traversé l'esprit aujourd'hui ?",
    "Bonjour ! Comment te sens-tu aujourd'hui ?",
    "Hey ! Il s'est passé quelque chose d'intéressant aujourd'hui ?",
    'Salut ! Comment ça va ?',
    "Bonjour ! C'est quoi le meilleur moment de ta journée jusqu'ici ?",
    "Coucou ! Comment vas-tu aujourd'hui ?",
    "Salut ! Raconte-moi, comment s'est passée ta journée ?",
  ],

  // German (Deutsch)
  de: [
    'Hey! Wie war dein Tag bisher?',
    'Hallo! Was ging dir heute so durch den Kopf?',
    'Hallo! Wie fühlst du dich heute?',
    'Hey! Ist heute etwas Interessantes passiert?',
    "Hi! Wie läuft's so?",
    'Hallo! Was war das Highlight deines Tages bisher?',
    "Hey! Wie geht's dir heute?",
    'Hi! Erzähl mal, wie war dein Tag?',
  ],

  // Italian (Italiano)
  it: [
    "Ciao! Com'è andata la tua giornata finora?",
    'Ciao! A cosa hai pensato oggi?',
    'Ciao! Come ti senti oggi?',
    'Ehi! È successo qualcosa di interessante oggi?',
    'Ciao! Come va tutto?',
    'Ciao! Qual è stato il momento migliore della tua giornata finora?',
    'Ciao! Come stai oggi?',
    "Ciao! Raccontami, com'è stata la tua giornata?",
  ],

  // Portuguese (Português)
  pt: [
    'Oi! Como foi o seu dia até agora?',
    'Olá! O que passou pela sua cabeça hoje?',
    'Olá! Como você está se sentindo hoje?',
    'E aí! Aconteceu algo interessante hoje?',
    'Oi! Como está tudo?',
    'Olá! Qual foi o melhor momento do seu dia até agora?',
    'Oi! Como você está hoje?',
    'Olá! Me conta, como foi o seu dia?',
  ],

  // Dutch (Nederlands)
  nl: [
    'Hé! Hoe is je dag tot nu toe geweest?',
    'Hoi! Waar heb je vandaag aan gedacht?',
    'Hallo! Hoe voel je je vandaag?',
    'Hey! Is er iets interessants gebeurd vandaag?',
    'Hoi! Hoe gaat het allemaal?',
    'Hallo! Wat was het hoogtepunt van je dag tot nu toe?',
    'Hé! Hoe gaat het met je vandaag?',
    'Hoi! Vertel, hoe was je dag?',
  ],

  // Japanese (日本語)
  ja: [
    'やあ！今日はどんな一日だった？',
    'こんにちは！今日は何を考えてた？',
    'こんにちは！今日の調子はどう？',
    'ねえ！今日何か面白いことあった？',
    'やあ！調子はどう？',
    'こんにちは！今日のハイライトは何だった？',
    'やあ！今日はどんな感じ？',
    'こんにちは！今日はどんな一日だったか教えて！',
  ],

  // Russian (Русский)
  ru: [
    'Привет! Как прошёл твой день?',
    'Привет! О чём ты сегодня думал?',
    'Привет! Как ты себя чувствуешь сегодня?',
    'Эй! Сегодня произошло что-нибудь интересное?',
    'Привет! Как дела?',
    'Привет! Что было самым ярким моментом твоего дня?',
    'Привет! Как ты сегодня?',
    'Привет! Расскажи, как прошёл твой день?',
  ],

  // Hindi (हिन्दी)
  hi: [
    'नमस्ते! आज का दिन कैसा रहा अब तक?',
    'हाय! आज दिमाग में क्या चल रहा था?',
    'नमस्ते! आज कैसा महसूस कर रहे हो?',
    'अरे! आज कुछ दिलचस्प हुआ?',
    'हाय! सब कैसा चल रहा है?',
    'नमस्ते! आज का सबसे अच्छा पल क्या रहा?',
    'हाय! आज कैसे हो?',
    'नमस्ते! बताओ, आज का दिन कैसा रहा?',
  ],
}

/**
 * Get a random opening greeting in the specified language
 * Falls back to English if language not found
 */
export function getRandomGreeting(language: Language = 'en'): string {
  const greetings = GREETINGS_BY_LANGUAGE[language] ?? GREETINGS_BY_LANGUAGE.en
  const index = Math.floor(Math.random() * greetings.length)
  return greetings[index]!
}

/**
 * Build prompt for generating the AI's first message
 */
export function buildFirstMessagePrompt(
  personality: AIPersonality,
  userName?: string,
  language: Language = 'en',
): string {
  return buildConversationSystemPrompt(personality, userName, language)
}
