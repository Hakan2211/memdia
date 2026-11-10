/**
 * Voice audition: render the same short companion lines with many candidate
 * voices (and optionally several voice settings) plus an HTML page to compare
 * them by ear. Used to curate the voice catalog in src/lib/voices.ts.
 *
 * Usage:
 *   npx tsx scripts/voice-audition.ts <outDir>
 *   npx tsx scripts/voice-audition.ts <outDir> --langs de,es --voices "Aria,Lena:abc123voiceId"
 *   npx tsx scripts/voice-audition.ts <outDir> --langs de --voices "Lena:abc123" \
 *     --stability 0.25,0.35,0.5 --similarity 0.6,0.75,0.9
 *
 * Voices are ElevenLabs premade names or voice IDs (incl. Voice Library IDs),
 * optionally labelled as "Label:voice". Every voice x language x stability x
 * similarity combination is one clip, roughly $0.01 each (Eleven v4 Turbo via
 * fal). Existing clips are kept, so an interrupted run can simply be resumed.
 */
import fs from 'node:fs'
import path from 'node:path'
import { config } from 'dotenv'
import { fal } from '@fal-ai/client'

config({ path: '.env.local' })

const TTS_MODEL = 'elevenlabs/tts/eleven-v4-turbo'
/** Production defaults (src/server/services/falai.service.ts) */
const DEFAULT_STABILITY = 0.35
const DEFAULT_SIMILARITY = 0.75

/** Premade multilingual candidates (name → gender). */
const DEFAULT_VOICES: Record<string, 'female' | 'male'> = {
  Rachel: 'female',
  Aria: 'female',
  Sarah: 'female',
  Laura: 'female',
  Jessica: 'female',
  Lily: 'female',
  Alice: 'female',
  Matilda: 'female',
  Charlotte: 'female',
  Brian: 'male',
  George: 'male',
  Daniel: 'male',
  Liam: 'male',
  Chris: 'male',
  Will: 'male',
  Eric: 'male',
  Roger: 'male',
  Callum: 'male',
  Bill: 'male',
}

/** Warm opener, sympathetic follow-up and a cheerful reaction: the 3 registers. */
const SAMPLE_LINES: Record<string, string> = {
  en: "[warmly] Hey, it's good to hear from you. How has your day been so far? [softly] That sounds really hard. Do you want to tell me more about it? [cheerfully] Oh, that's wonderful news, I'm so happy for you!",
  de: '[warmly] Hey, schön, von dir zu hören. Wie war dein Tag bisher? [softly] Das klingt wirklich schwer. Magst du mir mehr davon erzählen? [cheerfully] Oh, das sind ja tolle Neuigkeiten, ich freu mich so für dich!',
  es: '[warmly] Hola, qué bueno escucharte. ¿Cómo ha ido tu día hasta ahora? [softly] Eso suena muy difícil. ¿Quieres contarme un poco más? [cheerfully] ¡Ay, qué buena noticia, me alegro muchísimo por ti!',
  fr: "[warmly] Coucou, ça fait plaisir de t'entendre. Comment s'est passée ta journée jusqu'ici ? [softly] Ça a l'air vraiment difficile. Tu veux m'en dire un peu plus ? [cheerfully] Oh, c'est une super nouvelle, je suis tellement contente pour toi !",
  it: "[warmly] Ciao, che bello sentirti. Com'è andata la tua giornata finora? [softly] Sembra davvero difficile. Ti va di raccontarmi di più? [cheerfully] Oh, che bella notizia, sono così felice per te!",
  pt: '[warmly] Oi, que bom ouvir você. Como está sendo o seu dia até agora? [softly] Isso parece muito difícil. Quer me contar um pouco mais? [cheerfully] Ah, que notícia maravilhosa, fico muito feliz por você!',
  nl: '[warmly] Hoi, fijn om van je te horen. Hoe is je dag tot nu toe gegaan? [softly] Dat klinkt echt zwaar. Wil je me er meer over vertellen? [cheerfully] Oh, wat een geweldig nieuws, ik ben zo blij voor je!',
  ja: '[warmly] こんにちは、声が聞けてうれしいです。今日はここまでどんな一日でしたか？ [softly] それは本当につらかったですね。もう少し話してくれますか？ [cheerfully] わあ、それは素敵なニュースですね。本当によかったです！',
}

interface Variant {
  lang: string
  stability: number
  similarity: number
}

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag)
  return i > -1 ? process.argv[i + 1] : undefined
}

function numberList(flag: string, fallback: number): Array<number> {
  const value = argValue(flag)
  if (!value) return [fallback]
  return value.split(',').map((v) => {
    const n = Number(v)
    if (Number.isNaN(n) || n < 0 || n > 1) {
      throw new Error(`${flag} values must be between 0 and 1, got "${v}"`)
    }
    return n
  })
}

async function renderSample(
  voice: string,
  variant: Variant,
  file: string,
): Promise<string | null> {
  if (fs.existsSync(file)) return null // resume: keep earlier renders
  try {
    const result = await fal.subscribe(TTS_MODEL, {
      input: {
        text: SAMPLE_LINES[variant.lang],
        voice,
        stability: variant.stability,
        similarity_boost: variant.similarity,
        language_code: variant.lang,
      },
    })
    const url = (result.data as { audio: { url: string } }).audio.url
    const audio = Buffer.from(await (await fetch(url)).arrayBuffer())
    fs.writeFileSync(file, audio)
    return null
  } catch (error) {
    const body = (error as { body?: unknown }).body
    return JSON.stringify(body ?? String(error)).slice(0, 200)
  }
}

async function main(): Promise<void> {
  const outDir = process.argv[2]
  if (!outDir || outDir.startsWith('--')) {
    throw new Error('Usage: npx tsx scripts/voice-audition.ts <outDir> [...]')
  }
  if (!process.env.FAL_KEY) throw new Error('FAL_KEY is not set')
  fal.config({ credentials: process.env.FAL_KEY })

  const langs = (argValue('--langs') ?? 'en,de,es,fr').split(',')
  for (const lang of langs) {
    if (!SAMPLE_LINES[lang]) throw new Error(`No sample line for "${lang}"`)
  }
  const stabilities = numberList('--stability', DEFAULT_STABILITY)
  const similarities = numberList('--similarity', DEFAULT_SIMILARITY)
  const variants: Array<Variant> = langs.flatMap((lang) =>
    stabilities.flatMap((stability) =>
      similarities.map((similarity) => ({ lang, stability, similarity })),
    ),
  )

  // [label, voice, note]
  const customVoices = argValue('--voices')
  const voices: Array<[string, string, string]> = customVoices
    ? customVoices.split(',').map((entry) => {
        const [label, id] = entry.trim().split(':')
        return id ? [label, id, id] : [label, label, '']
      })
    : Object.entries(DEFAULT_VOICES).map(([name, gender]) => [
        name,
        name,
        gender,
      ])

  fs.mkdirSync(outDir, { recursive: true })
  const safe = (v: string) => v.replace(/[^a-zA-Z0-9_.-]/g, '_')
  const fileName = (voice: string, v: Variant) =>
    `${safe(voice)}-${v.lang}-s${v.stability}-b${v.similarity}.mp3`
  const jobs = voices.flatMap(([, voice]) =>
    variants.map((variant) => ({ voice, variant })),
  )
  console.log(`${jobs.length} clips`)

  const errors = new Map<string, string>()
  // Small worker pool: fast, but gentle on the fal queue.
  let next = 0
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (next < jobs.length) {
        const { voice, variant } = jobs[next++]
        const file = fileName(voice, variant)
        const error = await renderSample(
          voice,
          variant,
          path.join(outDir, file),
        )
        if (error) errors.set(file, error)
        console.log(`${error ? 'FAIL' : 'ok  '} ${file}`)
      }
    }),
  )

  const isDefault = (v: Variant) =>
    v.stability === DEFAULT_STABILITY && v.similarity === DEFAULT_SIMILARITY
  const header = variants
    .map(
      (v) =>
        `<th${isDefault(v) ? ' class="current"' : ''}>${langs.length > 1 ? `${v.lang}<br>` : ''}stability ${v.stability}<br>similarity ${v.similarity}${isDefault(v) ? '<br><em>current</em>' : ''}</th>`,
    )
    .join('')
  const rows = voices
    .map(([label, voice, note]) => {
      const cells = variants
        .map((variant) => {
          const file = fileName(voice, variant)
          const error = errors.get(file)
          const cls = isDefault(variant) ? ' class="current"' : ''
          return error
            ? `<td class="err" title="${error.replace(/"/g, '&quot;')}">failed</td>`
            : `<td${cls}><audio controls preload="none" src="${file}"></audio></td>`
        })
        .join('')
      return `<tr><th class="voice">${label}<small>${note}</small></th>${cells}</tr>`
    })
    .join('\n')

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Voice audition</title>
<style>
body{font-family:system-ui,sans-serif;margin:24px;color:#1e293b}
table{border-collapse:collapse}th,td{padding:6px 10px;border-bottom:1px solid #e2e8f0}
thead th{position:sticky;top:0;background:#fff;text-align:left;font-weight:500;font-size:13px}
th.voice{text-align:left;white-space:nowrap;position:sticky;left:0;background:#fff}
th.voice small{display:block;color:#94a3b8;font-weight:400;font-size:11px}
.current{background:#f0f9ff}thead th.current{background:#e0f2fe}
td.err{color:#b91c1c}audio{height:32px;width:200px}
</style></head><body>
<h1>Voice audition</h1>
<p>Same lines for every clip: a warm opener, a sympathetic follow-up, then a cheerful reaction. Eleven v4 Turbo.
<br>Lower <b>stability</b> = more expressive but less predictable. Higher <b>similarity</b> = closer to the original voice (including its recording quality).
<br>The highlighted column is what production uses today. Only one clip plays at a time.</p>
<table><thead><tr><th class="voice">Voice</th>${header}</tr></thead><tbody>
${rows}
</tbody></table>
<script>
document.addEventListener('play', (e) => {
  document.querySelectorAll('audio').forEach((a) => { if (a !== e.target) a.pause() })
}, true)
</script>
</body></html>`
  fs.writeFileSync(path.join(outDir, 'index.html'), html)
  console.log(
    `\nDone. ${errors.size} failed. Open ${path.join(outDir, 'index.html')}`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
