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
