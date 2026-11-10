import { describe, expect, it } from 'vitest'
import {
  MULTILINGUAL_VOICES,
  NATIVE_VOICES,
  getDefaultVoice,
  getVoiceSamplePath,
  getVoicesForLanguage,
  isVoiceAvailable,
  resolveVoice,
} from './voices'

const nativeGerman = NATIVE_VOICES.de ?? []

describe('voice catalog', () => {
  it('offers the multilingual set for languages without native voices', () => {
    expect(getVoicesForLanguage('sv')).toBe(MULTILINGUAL_VOICES)
  })

  it('offers the multilingual set plus native voices where configured', () => {
    expect(nativeGerman.length).toBeGreaterThan(0)
    expect(getVoicesForLanguage('de')).toEqual([
      ...MULTILINGUAL_VOICES,
      ...nativeGerman,
    ])
    // Stable reference, so pickers don't see a new list every render
    expect(getVoicesForLanguage('de')).toBe(getVoicesForLanguage('de'))
  })

  it('uses Rachel as the default in every language', () => {
    expect(getDefaultVoice('en').key).toBe('rachel')
    expect(getDefaultVoice('sv').key).toBe('rachel')
    expect(getDefaultVoice('de').key).toBe('rachel')
  })

  it('resolves a valid key to its voice', () => {
    expect(resolveVoice('en', 'aria').key).toBe('aria')
    expect(resolveVoice('de', 'aria').key).toBe('aria')
    expect(resolveVoice('de', nativeGerman[2].key)).toBe(nativeGerman[2])
  })

  it('falls back to the default for missing, unknown or retired keys', () => {
    expect(resolveVoice('en', null).key).toBe('rachel')
    expect(resolveVoice('en', undefined).key).toBe('rachel')
    expect(resolveVoice('de', 'no-such-voice').key).toBe('rachel')
  })

  it('keeps multilingual voices across a language change, but not native ones', () => {
    expect(isVoiceAvailable('de', 'aria')).toBe(true)
    expect(isVoiceAvailable('sv', 'aria')).toBe(true)
    const germanOnly = nativeGerman[1].key
    expect(isVoiceAvailable('de', germanOnly)).toBe(true)
    expect(isVoiceAvailable('en', germanOnly)).toBe(false)
    expect(resolveVoice('en', germanOnly).key).toBe('rachel')
  })

  it('has unique keys and ElevenLabs voices across the whole catalog', () => {
    const all = [MULTILINGUAL_VOICES, ...Object.values(NATIVE_VOICES)].flat()
    expect(new Set(all.map((v) => v.key)).size).toBe(all.length)
    const ids = all.map((v) => v.elevenLabsVoice)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('builds a preview path that changes when the voice is re-tuned', () => {
    const aria = resolveVoice('de', 'aria')
    const path = getVoiceSamplePath(aria, 'de')
    expect(path).toMatch(/^voice-samples\/aria-de-[a-z0-9]+\.mp3$/)
    expect(getVoiceSamplePath(aria, 'de')).toBe(path)
    expect(getVoiceSamplePath({ ...aria, stability: 0.5 }, 'de')).not.toBe(path)
    expect(getVoiceSamplePath(aria, 'en')).not.toBe(path)
  })

  it('gives the German library voices their tuned settings', () => {
    for (const voice of nativeGerman) {
      expect(voice.stability).toBe(0.5)
      expect(voice.similarityBoost).toBe(0.6)
    }
    expect(MULTILINGUAL_VOICES[0].stability).toBeUndefined()
  })
})
