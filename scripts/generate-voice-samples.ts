/**
 * Render the voice-picker preview clips and upload them to Bunny CDN as
 * voice-samples/{voiceKey}-{language}-{hash}.mp3 (see getVoiceSamplePath).
 *
 * One short greeting per voice x language it is offered for: the multilingual
 * voices in every language, native voices in their own language. Existing clips are skipped unless --force is given, so re-run it
 * after changing the catalog in src/lib/voices.ts.
 *
 * Usage:
 *   npx tsx scripts/generate-voice-samples.ts
 *   npx tsx scripts/generate-voice-samples.ts --langs en,de --force
 *
 * Needs FAL_KEY and BUNNY_* in .env.local. Uploads for real even when
 * MOCK_BUNNY is set (the clips are shared by all environments).
 */
import { config } from 'dotenv'
import { fal } from '@fal-ai/client'
import { toTtsLanguageCode } from '../src/lib/audio-tags'
import {
  getSampleSettings,
  getVoiceSamplePath,
  getVoicesForLanguage,
} from '../src/lib/voices'
import { SUPPORTED_LANGUAGES } from '../src/types/voice-session'
import type { Language } from '../src/types/voice-session'
import type { VoiceOption } from '../src/lib/voices'

config({ path: '.env.local' })
process.env.MOCK_BUNNY = 'false'

const TTS_MODEL = 'elevenlabs/tts/eleven-v4-turbo'
/** Shared defaults (src/server/services/falai.service.ts); voices may override */
const TTS_STABILITY = 0.35
const TTS_SIMILARITY_BOOST = 0.75

/** "Hi, I'm {name}. I'm here whenever you want to talk." per language. */
const PREVIEW_LINES: Record<Language, string> = {
  en: "Hi, I'm {name}. I'm here whenever you want to talk.",
  es: 'Hola, soy {name}. Estoy aquí cuando quieras hablar.',
  fr: 'Salut, je suis {name}. Je suis là dès que tu as envie de parler.',
  de: 'Hallo, ich bin {name}. Ich bin da, wann immer du reden möchtest.',
  it: 'Ciao, sono {name}. Sono qui ogni volta che hai voglia di parlare.',
  pt: 'Oi, eu sou {name}. Estou aqui sempre que você quiser conversar.',
  nl: 'Hoi, ik ben {name}. Ik ben er wanneer je maar wilt praten.',
  'nl-BE': 'Hoi, ik ben {name}. Ik ben er wanneer je maar wilt praten.',
  ja: 'こんにちは、{name}です。話したいときは、いつでもここにいますよ。',
  ru: 'Привет, я {name}. Я рядом, когда тебе захочется поговорить.',
  hi: 'नमस्ते, मैं {name} हूँ। जब भी आप बात करना चाहें, मैं यहाँ हूँ।',
  bg: 'Здравей, аз съм {name}. Тук съм, когато поискаш да поговорим.',
  ca: 'Hola, sóc {name}. Sóc aquí sempre que vulguis parlar.',
  cs: 'Ahoj, jsem {name}. Jsem tu, kdykoli si budeš chtít popovídat.',
  da: 'Hej, jeg hedder {name}. Jeg er her, når du har lyst til at snakke.',
  et: 'Tere, mina olen {name}. Olen siin alati, kui tahad rääkida.',
  fi: 'Hei, olen {name}. Olen täällä aina, kun haluat jutella.',
  el: 'Γεια σου, με λένε {name}. Είμαι εδώ όποτε θέλεις να μιλήσουμε.',
  hu: 'Szia, {name} vagyok. Itt vagyok, amikor csak beszélgetni szeretnél.',
  id: 'Hai, aku {name}. Aku di sini kapan pun kamu ingin bicara.',
  ko: '안녕하세요, {name}입니다. 이야기하고 싶을 때 언제든 여기 있을게요.',
  lv: 'Sveiki, es esmu {name}. Esmu šeit, kad vien vēlies parunāties.',
  lt: 'Labas, aš esu {name}. Esu čia, kai tik norėsi pasikalbėti.',
  ms: 'Hai, saya {name}. Saya sentiasa ada bila-bila masa awak mahu berbual.',
  no: 'Hei, jeg heter {name}. Jeg er her når du har lyst til å snakke.',
  pl: 'Cześć, jestem {name}. Jestem tu, kiedy tylko zechcesz porozmawiać.',
  ro: 'Bună, sunt {name}. Sunt aici oricând vrei să vorbim.',
  sk: 'Ahoj, som {name}. Som tu, kedykoľvek sa budeš chcieť porozprávať.',
  sv: 'Hej, jag heter {name}. Jag finns här när du vill prata.',
  tr: 'Merhaba, ben {name}. Konuşmak istediğin her an buradayım.',
  uk: 'Привіт, я {name}. Я поруч, коли захочеш поговорити.',
  vi: 'Xin chào, mình là {name}. Mình luôn ở đây mỗi khi bạn muốn trò chuyện.',
  zh: '你好，我是{name}。想聊天的时候，我一直都在。',
  'zh-TW': '你好，我是{name}。想聊天的時候，我一直都在。',
}

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag)
  return i > -1 ? process.argv[i + 1] : undefined
}

async function main(): Promise<void> {
  if (!process.env.FAL_KEY) throw new Error('FAL_KEY is not set')
  const cdnUrl = process.env.BUNNY_CDN_URL
  if (!cdnUrl) throw new Error('BUNNY_CDN_URL is not set')
  fal.config({ credentials: process.env.FAL_KEY })
  // Imported after MOCK_BUNNY is forced off (read at module load)
  const { uploadFile } = await import('../src/server/services/bunny.service')

  const force = process.argv.includes('--force')
  const onlyLangs = argValue('--langs')?.split(',') as
    | Array<Language>
    | undefined
  const languages = onlyLangs ?? SUPPORTED_LANGUAGES

  const jobs: Array<{ voice: VoiceOption; language: Language }> = []
  for (const language of languages) {
    for (const voice of getVoicesForLanguage(language))
      jobs.push({ voice, language })
  }
  console.log(`${jobs.length} clips to check`)

  let rendered = 0
  let skipped = 0
  const failures: Array<string> = []
  let next = 0
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (next < jobs.length) {
        const { voice, language } = jobs[next++]
        const path = getVoiceSamplePath(voice, language)
        const settings = getSampleSettings(voice)
        try {
          if (!force) {
            const head = await fetch(`${cdnUrl}/${path}`, { method: 'HEAD' })
            if (head.ok) {
              skipped++
              continue
            }
          }
          const result = await fal.subscribe(TTS_MODEL, {
            input: {
              text: PREVIEW_LINES[language].replace('{name}', voice.name),
              voice: voice.elevenLabsVoice,
              stability: settings.stability ?? TTS_STABILITY,
              similarity_boost:
                settings.similarityBoost ?? TTS_SIMILARITY_BOOST,
              language_code: toTtsLanguageCode(language),
            },
          })
          const url = (result.data as { audio: { url: string } }).audio.url
          const audio = Buffer.from(await (await fetch(url)).arrayBuffer())
          await uploadFile(path, audio, 'audio/mpeg')
          rendered++
          console.log(`ok   ${path}`)
        } catch (error) {
          failures.push(path)
          console.log(`FAIL ${path}: ${String(error).slice(0, 200)}`)
        }
      }
    }),
  )

  console.log(
    `\nDone: ${rendered} rendered, ${skipped} already existed, ${failures.length} failed`,
  )
  if (failures.length) process.exit(1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
