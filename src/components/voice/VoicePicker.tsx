/**
 * VoicePicker — choose the companion's voice for the user's language.
 *
 * Four voice cards (2 female, 2 male) in a 2x2 grid. Built on the shadcn
 * RadioGroup for single-choice semantics and arrow-key navigation. Each card
 * has a preview button; selecting a card also plays its preview, and only one
 * preview plays at a time.
 */
import { useEffect, useRef, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import type { Language } from '@/types/voice-session'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import {
  getVoiceSamplePath,
  getVoicesForLanguage,
  isVoiceAvailable,
  resolveVoice,
} from '@/lib/voices'
import { LANGUAGE_LABELS } from '@/types/voice-session'

const AVATAR_GRADIENTS = [
  'from-rose-300 to-amber-200',
  'from-sky-300 to-indigo-300',
  'from-emerald-300 to-teal-300',
  'from-violet-300 to-fuchsia-300',
]

interface VoicePickerProps {
  language: Language
  /** Selected voice key (null = language default) */
  value: string | null
  onChange: (key: string) => void
  /** CDN base URL of the preview clips (from getUserPreferencesFn) */
  sampleBaseUrl: string
  className?: string
}

export function VoicePicker({
  language,
  value,
  onChange,
  sampleBaseUrl,
  className,
}: VoicePickerProps) {
  const voices = getVoicesForLanguage(language)
  // Gender only helps tell voices apart when the list has both
  const showGender = new Set(voices.map((voice) => voice.gender)).size > 1
  const selected = resolveVoice(language, value).key

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playingKey, setPlayingKey] = useState<string | null>(null)
  const [failedKey, setFailedKey] = useState<string | null>(null)
  const [languageHint, setLanguageHint] = useState<string | null>(null)

  // Stop any preview when the language changes or the picker unmounts.
  useEffect(() => {
    return () => {
      audioRef.current?.pause()
      setPlayingKey(null)
    }
  }, [language])

  // The language changed and the saved voice isn't offered there: switch to
  // that language's default so what's shown is what will be used.
  useEffect(() => {
    if (value && !isVoiceAvailable(language, value)) {
      onChange(resolveVoice(language, null).key)
      setLanguageHint(`Voices updated for ${LANGUAGE_LABELS[language].name}`)
    }
  }, [language, value, onChange])

  const togglePreview = (key: string) => {
    if (playingKey === key) {
      audioRef.current?.pause()
      setPlayingKey(null)
      return
    }
    if (!audioRef.current) {
      audioRef.current = new Audio()
      audioRef.current.onended = () => setPlayingKey(null)
    }
    const audio = audioRef.current
    audio.pause()
    audio.src = `${sampleBaseUrl}/${getVoiceSamplePath(resolveVoice(language, key), language)}`
    setFailedKey(null)
    setPlayingKey(key)
    audio.play().catch(() => {
      setPlayingKey((current) => (current === key ? null : current))
      setFailedKey(key)
    })
  }

  const handleSelect = (key: string) => {
    onChange(key)
    setLanguageHint(null)
    if (playingKey !== key) togglePreview(key)
  }

  return (
    <div className={className}>
      <RadioGroup
        value={selected}
        onValueChange={handleSelect}
        aria-label="Companion voice"
        className={cn(
          'grid grid-cols-2 gap-2',
          voices.length > 4 && 'lg:grid-cols-3',
        )}
      >
        {voices.map((voice, index) => {
          const id = `voice-${voice.key}`
          const isPlaying = playingKey === voice.key
          return (
            <Label
              key={voice.key}
              htmlFor={id}
              className={cn(
                'relative flex cursor-pointer items-center gap-3 rounded-lg border p-3 font-normal transition-colors',
                'border-muted hover:border-muted-foreground/30',
                'has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5',
                'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/50',
              )}
            >
              <RadioGroupItem id={id} value={voice.key} className="sr-only" />

              <div
                aria-hidden
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-linear-to-br text-sm font-semibold text-slate-700',
                  AVATAR_GRADIENTS[index % AVATAR_GRADIENTS.length],
                )}
              >
                {voice.name.charAt(0)}
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{voice.name}</div>
                {voice.character && (
                  <div className="truncate text-xs text-muted-foreground">
                    {voice.character}
                  </div>
                )}
                {failedKey === voice.key ? (
                  <div className="text-[11px] text-muted-foreground/70">
                    Preview unavailable
                  </div>
                ) : (
                  showGender && (
                    <div className="text-[11px] text-muted-foreground/70 capitalize">
                      {voice.gender}
                    </div>
                  )
                )}
              </div>

              <button
                type="button"
                onClick={(event) => {
                  // Previewing shouldn't select the voice (the Label would)
                  event.preventDefault()
                  togglePreview(voice.key)
                }}
                aria-label={`${isPlaying ? 'Stop' : 'Play'} ${voice.name} preview`}
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors',
                  isPlaying
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-muted-foreground/20 hover:border-primary hover:text-primary',
                )}
              >
                {isPlaying ? (
                  <Pause className="h-3.5 w-3.5" />
                ) : (
                  <Play className="ml-0.5 h-3.5 w-3.5" />
                )}
              </button>

              {isPlaying && <PlayingBars />}
            </Label>
          )
        })}
      </RadioGroup>

      {languageHint && (
        <p className="mt-2 text-xs text-muted-foreground">{languageHint}</p>
      )}
    </div>
  )
}

/** Small animated equalizer shown on the card that is playing. */
function PlayingBars() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute right-3 bottom-1.5 flex h-2 items-end gap-0.5"
    >
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="w-0.5 animate-pulse rounded-full bg-primary"
          style={{ height: '100%', animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
  )
}
