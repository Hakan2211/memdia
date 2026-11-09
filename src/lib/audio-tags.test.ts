import { describe, expect, it } from 'vitest'
import {
  createAudioTagStreamFilter,
  stripAudioTags,
  toTtsLanguageCode,
} from './audio-tags'

const streamThrough = (tokens: Array<string>) => {
  const filter = createAudioTagStreamFilter()
  return tokens.map((t) => filter.push(t)).join('') + filter.flush()
}

describe('stripAudioTags', () => {
  it('removes tags at sentence starts', () => {
    expect(
      stripAudioTags(
        '[sympathetic] Oh, das klingt anstrengend. [softly] Was hat dich getroffen?',
      ),
    ).toBe('Oh, das klingt anstrengend. Was hat dich getroffen?')
  })

  it('removes multi-word tags', () => {
    expect(stripAudioTags('Haha [laughs softly] stimmt.')).toBe('Haha stimmt.')
  })

  it('leaves text without tags untouched', () => {
    expect(stripAudioTags('Wie war dein Tag?')).toBe('Wie war dein Tag?')
  })
})

describe('createAudioTagStreamFilter', () => {
  it('strips a tag split across tokens', () => {
    expect(
      streamThrough(['Oh. ', '[sof', 'tly', ']', ' Was', ' ist los?']),
    ).toBe('Oh. Was ist los?')
  })

  it('strips a tag at the very start', () => {
    expect(streamThrough(['[warmly] ', 'Hallo!'])).toBe('Hallo!')
  })

  it('passes through brackets that are not tags', () => {
    expect(streamThrough(['Punkt [1', '2] ok'])).toBe('Punkt [12] ok')
  })

  it('flushes an unclosed bracket at the end', () => {
    expect(streamThrough(['Ende [offen'])).toBe('Ende [offen')
  })

  it('does not hold back text without brackets', () => {
    const filter = createAudioTagStreamFilter()
    expect(filter.push('Hallo ')).toBe('Hallo ')
    expect(filter.push('du')).toBe('du')
  })
})

describe('toTtsLanguageCode', () => {
  it('maps app languages to ISO 639-1', () => {
    expect(toTtsLanguageCode('de')).toBe('de')
    expect(toTtsLanguageCode('zh-TW')).toBe('zh')
    expect(toTtsLanguageCode('nl-BE')).toBe('nl')
    expect(toTtsLanguageCode(undefined)).toBeUndefined()
  })
})
