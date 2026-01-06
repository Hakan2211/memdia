/**
 * Voice Session Types
 * Types for the Voice AI Daily Companion feature
 */

// ==========================================
// Session Status
// ==========================================

export type SessionStatus = 'active' | 'paused' | 'processing' | 'completed'

// ==========================================
// Archival Status
// ==========================================

export type ArchivalStatus = 'pending' | 'processing' | 'completed' | 'failed'

// ==========================================
// Speaker Types
// ==========================================

export type Speaker = 'user' | 'ai'

// ==========================================
// Image Styles
// ==========================================

export type ImageStyle =
  | 'realistic'
  | 'dreamlike'
  | 'watercolor'
  | 'geometric'
  | 'sketch'

export const IMAGE_STYLE_LABELS: Record<ImageStyle, string> = {
  realistic: 'Realistic & Hyperreal',
  dreamlike: 'Minimal & Dreamlike',
  watercolor: 'Watercolor',
  geometric: 'Abstract Geometric',
  sketch: 'Sketch & Line Art',
}

// ==========================================
// AI Personality
// ==========================================

export type AIPersonality = 'empathetic' | 'curious'

export const AI_PERSONALITY_LABELS: Record<AIPersonality, string> = {
  empathetic: 'Warm & Empathetic',
  curious: 'Curious Friend',
}

// ==========================================
// Language (Multilingual Support)
// ==========================================

/**
 * Multilingual languages supported by Deepgram Nova 3's code-switching mode
 * These languages use `language=multi` parameter and support automatic
 * language detection with seamless switching between languages
 */
export const MULTILINGUAL_LANGUAGES = [
  'en',
  'es',
  'fr',
  'de',
  'it',
  'pt',
  'nl',
  'ja',
  'ru',
  'hi',
] as const

export type MultilingualLanguage = (typeof MULTILINGUAL_LANGUAGES)[number]

/**
 * Monolingual languages supported by Deepgram Nova 3
 * These languages require a specific language code and do not support code-switching
 */
export const MONOLINGUAL_LANGUAGES = [
  'bg', // Bulgarian
  'ca', // Catalan
  'cs', // Czech
  'da', // Danish
  'et', // Estonian
  'fi', // Finnish
  'nl-BE', // Flemish
  'el', // Greek
  'hu', // Hungarian
  'id', // Indonesian
  'ko', // Korean
  'lv', // Latvian
  'lt', // Lithuanian
  'ms', // Malay
  'no', // Norwegian
  'pl', // Polish
  'ro', // Romanian
  'sk', // Slovak
  'sv', // Swedish
  'tr', // Turkish
  'uk', // Ukrainian
  'vi', // Vietnamese
  'zh', // Chinese (Simplified) - requires Nova-2
  'zh-TW', // Chinese (Traditional) - requires Nova-2
] as const

export type MonolingualLanguage = (typeof MONOLINGUAL_LANGUAGES)[number]

/**
 * Languages that require Nova-2 model (not supported on Nova-3)
 * These languages will automatically use the Nova-2 model for transcription
 */
export const NOVA2_ONLY_LANGUAGES = ['zh', 'zh-TW'] as const

export type Nova2OnlyLanguage = (typeof NOVA2_ONLY_LANGUAGES)[number]

/**
 * All supported languages (multilingual + monolingual)
 */
export type Language = MultilingualLanguage | MonolingualLanguage

export const SUPPORTED_LANGUAGES: Language[] = [
  ...MULTILINGUAL_LANGUAGES,
  ...MONOLINGUAL_LANGUAGES,
]

/**
 * Check if a language supports multilingual code-switching mode
 */
export function isMultilingualLanguage(
  lang: string,
): lang is MultilingualLanguage {
  return MULTILINGUAL_LANGUAGES.includes(lang as MultilingualLanguage)
}

/**
 * Get the Deepgram language parameter for a given user language
 * - Multilingual languages use 'multi' for code-switching support
 * - Monolingual languages use their specific language code
 */
export function getDeepgramLanguageParam(userLanguage: Language): string {
  return isMultilingualLanguage(userLanguage) ? 'multi' : userLanguage
}

/**
 * Check if a language requires Nova-2 model
 */
export function requiresNova2Model(lang: string): lang is Nova2OnlyLanguage {
  return NOVA2_ONLY_LANGUAGES.includes(lang as Nova2OnlyLanguage)
}

/**
 * Get the Deepgram model for a given language
 * - Chinese requires Nova-2
 * - All other languages use Nova-3
 */
export function getDeepgramModel(userLanguage: Language): 'nova-2' | 'nova-3' {
  return requiresNova2Model(userLanguage) ? 'nova-2' : 'nova-3'
}

/**
 * Labels for multilingual languages (code-switching supported)
 */
export const MULTILINGUAL_LANGUAGE_LABELS: Record<
  MultilingualLanguage,
  { name: string; native: string }
> = {
  en: { name: 'English', native: 'English' },
  es: { name: 'Spanish', native: 'Español' },
  fr: { name: 'French', native: 'Français' },
  de: { name: 'German', native: 'Deutsch' },
  it: { name: 'Italian', native: 'Italiano' },
  pt: { name: 'Portuguese', native: 'Português' },
  nl: { name: 'Dutch', native: 'Nederlands' },
  ja: { name: 'Japanese', native: '日本語' },
  ru: { name: 'Russian', native: 'Русский' },
  hi: { name: 'Hindi', native: 'हिन्दी' },
}

/**
 * Labels for monolingual languages
 */
export const MONOLINGUAL_LANGUAGE_LABELS: Record<
  MonolingualLanguage,
  { name: string; native: string }
> = {
  bg: { name: 'Bulgarian', native: 'Български' },
  ca: { name: 'Catalan', native: 'Català' },
  cs: { name: 'Czech', native: 'Čeština' },
  da: { name: 'Danish', native: 'Dansk' },
  et: { name: 'Estonian', native: 'Eesti' },
  fi: { name: 'Finnish', native: 'Suomi' },
  'nl-BE': { name: 'Flemish', native: 'Vlaams' },
  el: { name: 'Greek', native: 'Ελληνικά' },
  hu: { name: 'Hungarian', native: 'Magyar' },
  id: { name: 'Indonesian', native: 'Bahasa Indonesia' },
  ko: { name: 'Korean', native: '한국어' },
  lv: { name: 'Latvian', native: 'Latviešu' },
  lt: { name: 'Lithuanian', native: 'Lietuvių' },
  ms: { name: 'Malay', native: 'Bahasa Melayu' },
  no: { name: 'Norwegian', native: 'Norsk' },
  pl: { name: 'Polish', native: 'Polski' },
  ro: { name: 'Romanian', native: 'Română' },
  sk: { name: 'Slovak', native: 'Slovenčina' },
  sv: { name: 'Swedish', native: 'Svenska' },
  tr: { name: 'Turkish', native: 'Türkçe' },
  uk: { name: 'Ukrainian', native: 'Українська' },
  vi: { name: 'Vietnamese', native: 'Tiếng Việt' },
  zh: { name: 'Chinese (Simplified)', native: '简体中文' },
  'zh-TW': { name: 'Chinese (Traditional)', native: '繁體中文' },
}

/**
 * Combined language labels for all supported languages
 */
export const LANGUAGE_LABELS: Record<
  Language,
  { name: string; native: string }
> = {
  ...MULTILINGUAL_LANGUAGE_LABELS,
  ...MONOLINGUAL_LANGUAGE_LABELS,
}

// ==========================================
// Session Configuration
// ==========================================

export const SESSION_CONFIG = {
  /** Maximum session duration in seconds (3 minutes) */
  MAX_DURATION_SECONDS: 180,

  /** Premium session duration in seconds (5 minutes) - Future */
  PREMIUM_MAX_DURATION_SECONDS: 300,

  /** Reconnection timeout in seconds */
  RECONNECTION_TIMEOUT_SECONDS: 300, // 5 minutes

  /** Audio chunk size in milliseconds */
  AUDIO_CHUNK_MS: 250,
} as const

// ==========================================
// Transcript Turn
// ==========================================

export interface TranscriptTurn {
  id: string
  sessionId: string
  speaker: Speaker
  text: string
  audioUrl: string | null
  startTime: number // seconds from session start
  duration: number // seconds
  order: number
  createdAt: Date
}

// ==========================================
// Voice Session
// ==========================================

export interface VoiceSession {
  id: string
  userId: string
  date: Date
  status: SessionStatus
  recordingAttempt: number // 1 = first, 2 = retry (max 2 allowed)
  totalUserSpeakingTime: number // seconds
  maxDuration: number // seconds
  summaryText: string | null
  imageUrl: string | null
  imageStyle: ImageStyle
  archivalStatus: ArchivalStatus
  pausedAt: Date | null
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
  turns?: TranscriptTurn[]
}

// ==========================================
// User Preferences
// ==========================================

export interface UserPreferences {
  id: string
  userId: string
  timezone: string
  imageStyle: ImageStyle
  aiPersonality: AIPersonality
  language: Language
  createdAt: Date
  updatedAt: Date
}

// ==========================================
// WebSocket Events (Client → Server)
// ==========================================

export type ClientWSMessage =
  | { type: 'audio_chunk'; data: ArrayBuffer }
  | { type: 'end_session' }
  | { type: 'mute'; muted: boolean }
  | { type: 'ping' }

// ==========================================
// WebSocket Events (Server → Client)
// ==========================================

export type ServerWSMessage =
  | { type: 'session_started'; sessionId: string; remainingTime: number }
  | { type: 'transcript_partial'; text: string; speaker: Speaker }
  | { type: 'transcript_final'; turn: TranscriptTurn }
  | { type: 'ai_speaking_start' }
  | { type: 'ai_audio_chunk'; data: ArrayBuffer }
  | { type: 'ai_speaking_end' }
  | { type: 'time_update'; remainingTime: number; userSpeakingTime: number }
  | { type: 'session_paused'; reason: string }
  | { type: 'session_ended'; reason: 'time_limit' | 'user_ended' | 'error' }
  | { type: 'session_locked' }
  | { type: 'error'; message: string; code: string }
  | { type: 'pong' }

// ==========================================
// API Response Types
// ==========================================

export interface SessionResponse {
  session: VoiceSession
  turns: TranscriptTurn[]
}

export interface SessionsListResponse {
  sessions: VoiceSession[]
  hasMore: boolean
  nextCursor?: string
}

export interface CalendarSessionsResponse {
  /** Map of date string (YYYY-MM-DD) to session summary */
  sessions: Record<
    string,
    {
      id: string
      status: SessionStatus
      imageUrl: string | null
      duration: number
    }
  >
}

// ==========================================
// Audio Manifest (stored in Bunny.net)
// ==========================================

export interface AudioManifest {
  sessionId: string
  totalDuration: number
  turns: {
    order: number
    speaker: Speaker
    audioUrl: string
    startTime: number
    duration: number
  }[]
}
