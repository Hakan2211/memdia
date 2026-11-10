/**
 * Companion voice catalog (single source of truth).
 *
 * Users pick one of the voices offered for their language: the multilingual
 * set (every language, Rachel first = always the default) plus, for languages
 * with enough users, native-speaker voices on top (NATIVE_VOICES). We store our own stable `key` in the database,
 * never the ElevenLabs id, so voices can be swapped here without migrating
 * data: an unknown or retired key simply falls back to the language default.
 *
 * Voices are curated by ear: scripts/voice-audition.ts renders candidates,
 * scripts/generate-voice-samples.ts renders the preview clips.
 */
import type { Language } from '@/types/voice-session'

export type VoiceGender = 'female' | 'male'

export interface VoiceOption {
  /** Stable id stored in UserPreferences.voice / ReflectionSession.ttsVoice */
  key: string
  /** ElevenLabs premade voice name or voice id, passed to fal as `voice` */
  elevenLabsVoice: string
  /** Display name */
  name: string
  gender: VoiceGender
  /** Short character description shown under the name (optional) */
  character?: string
  /**
   * Per-voice TTS settings, tuned by ear (scripts/voice-audition.ts with
   * --stability/--similarity). Unset = the shared defaults in falai.service.
   */
  stability?: number
  similarityBoost?: number
}

/**
 * Offered in every supported language. The first entry (Rachel) is the
 * default everywhere, so users hear no change until they choose a voice.
 */
export const MULTILINGUAL_VOICES: Array<VoiceOption> = [
  {
    key: 'rachel',
    elevenLabsVoice: 'Rachel',
    name: 'Rachel',
    gender: 'female',
    character: 'Calm & warm',
  },
  {
    key: 'aria',
    elevenLabsVoice: 'Aria',
    name: 'Aria',
    gender: 'female',
    character: 'Bright & expressive',
  },
  {
    key: 'brian',
    elevenLabsVoice: 'Brian',
    name: 'Brian',
    gender: 'male',
    character: 'Deep & reassuring',
  },
  {
    key: 'george',
    elevenLabsVoice: 'George',
    name: 'George',
    gender: 'male',
    character: 'Warm & grounded',
  },
]

/**
 * Settings for the German library voices, picked by ear 2026-11-10 from a
 * stability x similarity grid: 0.5 / 0.6 sounded best, ahead of 0.5 / 0.75
 * and the shared default 0.35 / 0.75.
 */
const GERMAN_VOICE_SETTINGS = { stability: 0.5, similarityBoost: 0.6 }

/**
 * Extra native-speaker voices for the most used languages, listed after the
 * multilingual set. Voice Library ids work through fal (verified 2026-11-10).
 */
export const NATIVE_VOICES: Partial<Record<Language, Array<VoiceOption>>> = {
  // German: 9 female voices, hand-picked from the ElevenLabs Voice Library
  de: [
    germanVoice('de-lena', 'hcbJLSPyFeHgRNBG3yl1', 'Lena'),
    germanVoice('de-clara', 'baebHbhnJ9ASPPp11oEY', 'Clara'),
    germanVoice('de-hanna', 'gVOibprogMfmHVVyo5r6', 'Hanna'),
    germanVoice('de-sophie', 'v3V1d2rk6528UrLKRuy8', 'Sophie'),
    germanVoice('de-marie', 'NE7AIW5DoJ7lUosXV2KR', 'Marie'),
    germanVoice('de-emma', 'R24r0IV80Iw9eyByq1ps', 'Emma'),
    germanVoice('de-johanna', 'MiVAi0PlB7YlXfCDRCkq', 'Johanna'),
    germanVoice('de-greta', 'nGISSznGHAgSTKaMXEPO', 'Greta'),
    germanVoice('de-paula', 'ogdlaxy0T9rCSVdH0VJM', 'Paula'),
  ],
}

function germanVoice(
  key: string,
  elevenLabsVoice: string,
  name: string,
): VoiceOption {
  return {
    key,
    elevenLabsVoice,
    name,
    gender: 'female',
    ...GERMAN_VOICE_SETTINGS,
  }
}

const voicesByLanguage = new Map<Language, Array<VoiceOption>>()

/** The voices offered for a language: multilingual set + native extras. */
export function getVoicesForLanguage(language: Language): Array<VoiceOption> {
  const native = NATIVE_VOICES[language]
  if (!native) return MULTILINGUAL_VOICES
  let voices = voicesByLanguage.get(language)
  if (!voices) {
    voices = [...MULTILINGUAL_VOICES, ...native]
    voicesByLanguage.set(language, voices)
  }
  return voices
}

/** The voice used when the user hasn't picked one (or theirs is retired). */
export function getDefaultVoice(language: Language): VoiceOption {
  return getVoicesForLanguage(language)[0]
}

/** Whether `key` is one of the voices offered for `language`. */
export function isVoiceAvailable(
  language: Language,
  key: string | null | undefined,
): boolean {
  return (
    !!key && getVoicesForLanguage(language).some((voice) => voice.key === key)
  )
}

/**
 * The voice to speak with: the requested one if it's offered for this
 * language, otherwise the language default. Never throws.
 */
export function resolveVoice(
  language: Language,
  key: string | null | undefined,
): VoiceOption {
  const voices = getVoicesForLanguage(language)
  return voices.find((voice) => voice.key === key) ?? voices[0]
}

/** Bump when the preview line in scripts/generate-voice-samples.ts changes. */
const SAMPLE_VERSION = 1

/**
 * CDN path of a voice's preview clip in a given language. The file name
 * carries a short hash of everything that changes how the clip sounds, so a
 * re-tuned voice gets a new URL instead of a stale CDN/browser cache hit
 * (clips are cached for 30 days).
 */
export function getVoiceSamplePath(
  voice: VoiceOption,
  language: Language,
): string {
  const fingerprint = [
    SAMPLE_VERSION,
    voice.elevenLabsVoice,
    voice.stability ?? '',
    voice.similarityBoost ?? '',
  ].join('|')
  return `voice-samples/${voice.key}-${language}-${shortHash(fingerprint)}.mp3`
}

/** Small, stable string hash (djb2), base36. Not for security. */
function shortHash(input: string): string {
  let hash = 5381
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) >>> 0
  }
  return hash.toString(36)
}
