/**
 * Audio tags for expressive TTS (ElevenLabs Eleven v4)
 *
 * The LLM may prefix sentences with delivery tags like `[softly]` or
 * `[warmly]`. They are sent to TTS as-is (v4 interprets them), but must never
 * be shown to the user or persisted — transcripts, summaries and insight
 * extraction all read the stored text.
 */

/** Tags the LLM is allowed to use (kept in sync with the prompts). */
export const ALLOWED_AUDIO_TAGS = [
  'softly',
  'warmly',
  'gently',
  'sympathetic',
  'cheerfully',
  'laughs softly',
] as const

/** System-prompt section teaching the LLM when to use audio tags. */
export const AUDIO_TAG_INSTRUCTIONS = `
VOICE DELIVERY TAGS:
Your reply is spoken by an expressive voice. You may put ONE delivery tag at the start of a sentence to shape its tone.
Allowed tags (use exactly these, always in English): ${ALLOWED_AUDIO_TAGS.map((t) => `[${t}]`).join(', ')}
- Use them sparingly: only when the emotional moment calls for it (e.g. [softly] or [sympathetic] when they share something painful, [cheerfully] when they share good news)
- Most replies need no tag at all; never more than two tags in one reply
- Never use any other bracketed text, and never refer to the tags`

/** Matches a bracketed delivery tag such as `[softly]` or `[laughs softly]`. */
const AUDIO_TAG_PATTERN = /\[[a-z][a-z' -]{0,30}\]\s*/gi
const SINGLE_TAG_PATTERN = /^\[[a-z][a-z' -]{0,30}\]$/i

/** Longest possible tag, used to give up buffering an unclosed `[`. */
const MAX_TAG_LENGTH = 34

/** Remove all audio tags from text intended for display or storage. */
export function stripAudioTags(text: string): string {
  return text.replace(AUDIO_TAG_PATTERN, '').replace(/ {2,}/g, ' ').trim()
}

/**
 * Incremental tag stripper for streamed LLM tokens.
 * Tags can be split across tokens (`"[sof"` + `"tly] "`), so text after an
 * unclosed `[` is held back until the tag closes or clearly isn't a tag.
 */
export function createAudioTagStreamFilter() {
  let pending = ''
  // After dropping a tag, skip the whitespace that follows it - even if that
  // whitespace arrives in a later token.
  let skipWhitespace = false

  const drain = (final: boolean): string => {
    let out = ''
    while (pending.length > 0) {
      if (skipWhitespace) {
        pending = pending.replace(/^\s+/, '')
        if (pending.length === 0) break
        skipWhitespace = false
      }
      const open = pending.indexOf('[')
      if (open === -1) {
        out += pending
        pending = ''
        break
      }
      out += pending.slice(0, open)
      pending = pending.slice(open)

      const close = pending.indexOf(']')
      if (close === -1) {
        // Possibly an incomplete tag - wait for more tokens
        if (!final && pending.length <= MAX_TAG_LENGTH) break
        out += pending
        pending = ''
        break
      }

      const candidate = pending.slice(0, close + 1)
      if (SINGLE_TAG_PATTERN.test(candidate)) {
        // Drop the tag (and, on the next loop, the whitespace after it)
        pending = pending.slice(close + 1)
        skipWhitespace = true
      } else {
        out += candidate
        pending = pending.slice(close + 1)
      }
    }
    return out
  }

  return {
    /** Feed a token; returns the text that is safe to display now. */
    push(token: string): string {
      pending += token
      return drain(false)
    },
    /** Flush anything still buffered at the end of the stream. */
    flush(): string {
      return drain(true)
    },
  }
}

/**
 * Map an app language (e.g. `de`, `zh-TW`, `nl-BE`) to the ISO 639-1 code
 * expected by the TTS `language_code` param.
 */
export function toTtsLanguageCode(
  language?: string | null,
): string | undefined {
  if (!language) return undefined
  return language.split('-')[0].toLowerCase()
}
