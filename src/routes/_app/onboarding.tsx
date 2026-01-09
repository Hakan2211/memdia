/**
 * Onboarding Route
 * First-time user setup: mic permission, timezone, preferences
 */

import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import {
  Check,
  ChevronRight,
  Clock,
  Globe,
  Languages,
  Mic,
  Palette,
  Sparkles,
} from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Label } from '../../components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select'
import {
  completeOnboardingFn,
  getUserPreferencesFn,
  updateUserPreferencesFn,
} from '../../server/session.fn'
import {
  MONOLINGUAL_LANGUAGES,
  MONOLINGUAL_LANGUAGE_LABELS,
  MULTILINGUAL_LANGUAGES,
  MULTILINGUAL_LANGUAGE_LABELS,
  isMultilingualLanguage,
  requiresNova2Model,
} from '../../types/voice-session'
import type {
  AIPersonality,
  ImageStyle,
  Language,
} from '../../types/voice-session'
import 'flag-icons/css/flag-icons.min.css'

// Map language codes to flag-icons country codes
const LANGUAGE_TO_FLAG: Record<string, string> = {
  // Multilingual
  en: 'us',
  es: 'es',
  fr: 'fr',
  de: 'de',
  it: 'it',
  pt: 'pt',
  nl: 'nl',
  ja: 'jp',
  ru: 'ru',
  hi: 'in',
  // Monolingual
  bg: 'bg',
  ca: 'es-ct', // Catalan - use Catalonia flag
  cs: 'cz',
  da: 'dk',
  et: 'ee',
  fi: 'fi',
  'nl-BE': 'be',
  el: 'gr',
  hu: 'hu',
  id: 'id',
  ko: 'kr',
  lv: 'lv',
  lt: 'lt',
  ms: 'my',
  no: 'no',
  pl: 'pl',
  ro: 'ro',
  sk: 'sk',
  sv: 'se',
  tr: 'tr',
  uk: 'ua',
  vi: 'vn',
  zh: 'cn',
  'zh-TW': 'tw',
}

export const Route = createFileRoute('/_app/onboarding')({
  component: OnboardingPage,
})

type OnboardingStep =
  | 'welcome'
  | 'language'
  | 'microphone'
  | 'timezone'
  | 'preferences'
  | 'complete'

// All supported languages (multilingual + monolingual)
const ALL_SUPPORTED_LANGUAGES: Array<Language> = [
  ...MULTILINGUAL_LANGUAGES,
  ...MONOLINGUAL_LANGUAGES,
]

/**
 * Detect the user's browser language and map it to a supported language
 */
function detectBrowserLanguage(): Language {
  if (typeof navigator === 'undefined') return 'en'

  // Get the browser's language (e.g., "en-US", "es", "fr-FR")
  const browserLang =
    navigator.language ||
    (navigator as { userLanguage?: string }).userLanguage ||
    'en'

  // Extract the primary language code (e.g., "en" from "en-US")
  const primaryLang = browserLang.split('-')[0]?.toLowerCase() as Language

  // Check if it's a supported language (multilingual or monolingual)
  if (primaryLang && ALL_SUPPORTED_LANGUAGES.includes(primaryLang)) {
    return primaryLang
  }

  // Default to English
  return 'en'
}

const IMAGE_STYLES: Array<{
  value: ImageStyle
  label: string
  description: string
}> = [
  {
    value: 'realistic',
    label: 'Realistic',
    description: 'Photorealistic, cinematic',
  },
  {
    value: 'dreamlike',
    label: 'Dreamlike',
    description: 'Ethereal, soft focus',
  },
  {
    value: 'watercolor',
    label: 'Watercolor',
    description: 'Delicate washes, flowing',
  },
  {
    value: 'geometric',
    label: 'Geometric',
    description: 'Clean lines, minimalist',
  },
  {
    value: 'sketch',
    label: 'Sketch',
    description: 'Elegant pencil, line art',
  },
]

const AI_PERSONALITIES: Array<{
  value: AIPersonality
  label: string
  description: string
}> = [
  {
    value: 'empathetic',
    label: 'Empathetic',
    description: 'Warm, supportive, understanding',
  },
  {
    value: 'curious',
    label: 'Curious',
    description: 'Inquisitive, thought-provoking',
  },
]

function OnboardingPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [step, setStep] = useState<OnboardingStep>('welcome')
  const [hasMicPermission, setHasMicPermission] = useState(false)
  const [selectedTimezone, setSelectedTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  )
  const [selectedImageStyle, setSelectedImageStyle] =
    useState<ImageStyle>('realistic')
  const [selectedPersonality, setSelectedPersonality] =
    useState<AIPersonality>('empathetic')
  const [selectedLanguage, setSelectedLanguage] = useState<Language>(() =>
    detectBrowserLanguage(),
  )

  // Get existing preferences (if any)
  const { data: existingPrefs } = useQuery({
    queryKey: ['user-preferences'],
    queryFn: () => getUserPreferencesFn(),
  })

  // Update preferences on load if they exist
  useState(() => {
    if (existingPrefs) {
      setSelectedTimezone(existingPrefs.timezone)
      setSelectedImageStyle(existingPrefs.imageStyle as ImageStyle)
      setSelectedPersonality(existingPrefs.aiPersonality as AIPersonality)
      if (existingPrefs.language) {
        setSelectedLanguage(existingPrefs.language as Language)
      }
    }
  })

  // Update preferences mutation
  const updatePrefsMutation = useMutation({
    mutationFn: updateUserPreferencesFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-preferences'] })
    },
  })

  // Complete onboarding mutation
  const completeMutation = useMutation({
    mutationFn: () => completeOnboardingFn(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth'] })
      navigate({ to: '/memories/today' })
    },
  })

  // Request microphone permission
  const requestMicPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((track) => track.stop())
      setHasMicPermission(true)
      return true
    } catch {
      return false
    }
  }

  // Handle step completion
  const handleNext = async () => {
    switch (step) {
      case 'welcome':
        setStep('language')
        break

      case 'language':
        await updatePrefsMutation.mutateAsync({
          data: { language: selectedLanguage },
        })
        setStep('microphone')
        break

      case 'microphone':
        if (!hasMicPermission) {
          const granted = await requestMicPermission()
          if (!granted) {
            alert('Microphone access is required for voice sessions.')
            return
          }
        }
        setStep('timezone')
        break

      case 'timezone':
        await updatePrefsMutation.mutateAsync({
          data: { timezone: selectedTimezone },
        })
        setStep('preferences')
        break

      case 'preferences':
        await updatePrefsMutation.mutateAsync({
          data: {
            imageStyle: selectedImageStyle,
            aiPersonality: selectedPersonality,
          },
        })
        setStep('complete')
        break

      case 'complete':
        completeMutation.mutate()
        break
    }
  }

  // Common timezones
  const commonTimezones = [
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Anchorage',
    'Pacific/Honolulu',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Asia/Kolkata',
    'Australia/Sydney',
    'UTC',
  ]

  const steps = [
    { id: 'welcome', label: 'Welcome', icon: Sparkles },
    { id: 'language', label: 'Language', icon: Languages },
    { id: 'microphone', label: 'Mic', icon: Mic },
    { id: 'timezone', label: 'Timezone', icon: Clock },
    { id: 'preferences', label: 'Preferences', icon: Palette },
    { id: 'complete', label: 'Ready', icon: Check },
  ] as const

  const currentStepIndex = steps.findIndex((s) => s.id === step)
  const stepCount = steps.length
  const halfStepPercent = 100 / (stepCount * 2) // Center of first step in %

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-muted/30">
      <div className="w-full max-w-3xl">
        {/* Progress Stepper */}
        <div className="mb-8 relative">
          {/* Line Container */}
          <div
            className="absolute top-4 h-1 -translate-y-1/2 z-0"
            style={{
              left: `${halfStepPercent}%`,
              right: `${halfStepPercent}%`,
            }}
          >
            {/* Background Track */}
            <div className="absolute inset-0 bg-muted rounded-full" />
            {/* Progress Bar */}
            <div
              className="absolute top-0 left-0 h-full bg-primary rounded-full transition-all duration-1000 ease-in-out"
              style={{
                width: `${(currentStepIndex / (stepCount - 1)) * 100}%`,
              }}
            />
          </div>

          {/* Steps Grid */}
          <div className="grid grid-cols-6 relative z-10">
            {steps.map((s, i) => {
              const Icon = s.icon
              const isActive = i === currentStepIndex
              const isCompleted = i < currentStepIndex
              return (
                <div
                  key={s.id}
                  className={`flex flex-col items-center gap-2 ${
                    isActive || isCompleted
                      ? 'text-primary'
                      : 'text-muted-foreground'
                  }`}
                >
                  <div
                    className={`h-8 w-8 rounded-full flex items-center justify-center border-2 transition-all duration-500 bg-background ${
                      isActive
                        ? 'border-primary scale-110 shadow-sm delay-500'
                        : isCompleted
                          ? 'bg-primary border-primary text-primary-foreground'
                          : 'border-muted'
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </div>
                  <span className="text-xs font-medium hidden sm:block">
                    {s.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Content Card */}
        <div className="rounded-xl border bg-card p-6 md:p-10 shadow-lg">
          {/* Welcome Step */}
          {step === 'welcome' && (
            <div className="text-center max-w-md mx-auto py-8">
              <div className="h-24 w-24 mx-auto mb-8 rounded-full bg-primary/10 flex items-center justify-center animate-in zoom-in-50 duration-500">
                <Sparkles className="h-12 w-12 text-primary" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight mb-4">
                Welcome to Memdia
              </h1>
              <p className="text-lg text-muted-foreground mb-10 leading-relaxed">
                Your daily voice companion for reflection and mindfulness. Let's
                customize your experience in just a few steps.
              </p>
              <Button
                onClick={handleNext}
                size="lg"
                className="w-full text-base"
              >
                Get Started
                <ChevronRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          )}

          {/* Language Step */}
          {step === 'language' && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h1 className="text-2xl font-semibold mb-2">
                  Choose Your Language
                </h1>
                <p className="text-muted-foreground">
                  Select your preferred language for voice conversations.
                </p>
              </div>

              {/* Scrollable language container */}
              <div className="max-h-[400px] overflow-y-auto pr-2 custom-scrollbar -mr-2">
                {/* Multilingual Section */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <span className="text-sm font-medium">Multilingual</span>
                    <span className="text-xs text-muted-foreground bg-primary/10 px-2 py-0.5 rounded-full">
                      Auto-detect
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {MULTILINGUAL_LANGUAGES.map((lang) => {
                      const { name, native } =
                        MULTILINGUAL_LANGUAGE_LABELS[lang]
                      const flagCode = LANGUAGE_TO_FLAG[lang]
                      return (
                        <button
                          key={lang}
                          type="button"
                          onClick={() => setSelectedLanguage(lang)}
                          className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                            selectedLanguage === lang
                              ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                              : 'border-muted hover:border-muted-foreground/30 hover:bg-accent/50'
                          }`}
                        >
                          <span
                            className={`fi fi-${flagCode} text-2xl rounded-sm shadow-sm shrink-0`}
                          />
                          <div className="min-w-0">
                            <div className="font-medium text-sm truncate">
                              {native}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {name}
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="border-t my-6" />

                {/* Monolingual Section */}
                <div>
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <span className="text-sm font-medium">Single Language</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {MONOLINGUAL_LANGUAGES.map((lang) => {
                      const { name, native } = MONOLINGUAL_LANGUAGE_LABELS[lang]
                      const flagCode = LANGUAGE_TO_FLAG[lang]
                      const isNova2 = requiresNova2Model(lang)
                      return (
                        <button
                          key={lang}
                          type="button"
                          onClick={() => setSelectedLanguage(lang)}
                          className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                            selectedLanguage === lang
                              ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                              : 'border-muted hover:border-muted-foreground/30 hover:bg-accent/50'
                          }`}
                        >
                          <span
                            className={`fi fi-${flagCode} text-2xl rounded-sm shadow-sm shrink-0`}
                          />
                          <div className="min-w-0">
                            <div className="font-medium text-sm truncate">
                              {native}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {name}
                              {isNova2 && (
                                <span className="text-amber-600 ml-1 text-[10px]">
                                  (Nova-2)
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t flex justify-end">
                <Button
                  onClick={handleNext}
                  size="lg"
                  className="w-full md:w-auto min-w-[150px]"
                  disabled={updatePrefsMutation.isPending}
                >
                  {updatePrefsMutation.isPending ? 'Saving...' : 'Continue'}
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Microphone Step */}
          {step === 'microphone' && (
            <div className="text-center max-w-md mx-auto py-8">
              <div
                className={`h-24 w-24 mx-auto mb-8 rounded-full flex items-center justify-center transition-all duration-500 ${
                  hasMicPermission
                    ? 'bg-emerald-100 text-emerald-600 scale-110'
                    : 'bg-primary/10 text-primary'
                }`}
              >
                {hasMicPermission ? (
                  <Check className="h-12 w-12" />
                ) : (
                  <Mic className="h-12 w-12" />
                )}
              </div>
              <h1 className="text-2xl font-semibold mb-4">Enable Microphone</h1>
              <p className="text-muted-foreground mb-8 text-lg">
                Memdia needs microphone access to record your daily reflections.
                Your audio is processed securely.
              </p>

              <div className="space-y-4">
                {!hasMicPermission ? (
                  <Button
                    onClick={requestMicPermission}
                    size="lg"
                    className="w-full py-6 text-lg"
                  >
                    <Mic className="mr-2 h-5 w-5" />
                    Allow Microphone Access
                  </Button>
                ) : (
                  <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-4 text-emerald-700 flex items-center justify-center gap-2">
                    <Check className="h-5 w-5" />
                    <span className="font-medium">
                      Microphone access granted
                    </span>
                  </div>
                )}

                <Button
                  onClick={handleNext}
                  variant={hasMicPermission ? 'default' : 'ghost'}
                  size="lg"
                  className={`w-full ${!hasMicPermission && 'text-muted-foreground hover:text-foreground'}`}
                  disabled={!hasMicPermission}
                >
                  Continue
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Timezone Step */}
          {step === 'timezone' && (
            <div className="max-w-md mx-auto py-8 text-center">
              <div className="h-20 w-20 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
                <Clock className="h-10 w-10 text-primary" />
              </div>
              <h1 className="text-2xl font-semibold mb-2">Your Timezone</h1>
              <p className="text-muted-foreground mb-8">
                We'll use this to schedule your daily sessions and display dates
                correctly.
              </p>

              <div className="space-y-8 text-left">
                <div className="space-y-2">
                  <Label>Select Timezone</Label>
                  <Select
                    value={selectedTimezone}
                    onValueChange={setSelectedTimezone}
                  >
                    <SelectTrigger className="w-full h-11">
                      <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      {commonTimezones.map((tz) => (
                        <SelectItem key={tz} value={tz}>
                          {tz.replace('_', ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button onClick={handleNext} size="lg" className="w-full">
                  Continue
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Preferences Step */}
          {step === 'preferences' && (
            <div className="space-y-8">
              <div className="text-center mb-6">
                <h1 className="text-2xl font-semibold mb-2">Personalize</h1>
                <p className="text-muted-foreground">
                  Customize your AI companion's personality and visual style.
                </p>
              </div>

              <div className="space-y-8">
                {/* AI Personality */}
                <div className="space-y-3">
                  <Label className="text-base">AI Personality</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {AI_PERSONALITIES.map((p) => (
                      <button
                        key={p.value}
                        onClick={() => setSelectedPersonality(p.value)}
                        className={`p-4 rounded-xl border-2 text-left transition-all hover:shadow-md ${
                          selectedPersonality === p.value
                            ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                            : 'border-muted hover:border-primary/30 hover:bg-accent/50'
                        }`}
                      >
                        <div className="font-semibold mb-1">{p.label}</div>
                        <div className="text-sm text-muted-foreground">
                          {p.description}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Image Style */}
                <div className="space-y-3">
                  <Label className="text-base">Memory Image Style</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {IMAGE_STYLES.map((s) => (
                      <button
                        key={s.value}
                        onClick={() => setSelectedImageStyle(s.value)}
                        className={`p-3 rounded-xl border-2 text-left transition-all hover:shadow-sm ${
                          selectedImageStyle === s.value
                            ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                            : 'border-muted hover:border-primary/30 hover:bg-accent/50'
                        }`}
                      >
                        <div className="font-medium text-sm mb-1">
                          {s.label}
                        </div>
                        <div className="text-xs text-muted-foreground leading-tight">
                          {s.description}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t flex justify-end">
                <Button
                  onClick={handleNext}
                  size="lg"
                  className="w-full md:w-auto min-w-[150px]"
                  disabled={updatePrefsMutation.isPending}
                >
                  {updatePrefsMutation.isPending ? 'Saving...' : 'Finish Setup'}
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Complete Step */}
          {step === 'complete' && (
            <div className="text-center max-w-md mx-auto py-8">
              <div className="h-24 w-24 mx-auto mb-8 rounded-full bg-emerald-100 flex items-center justify-center animate-in zoom-in-50 duration-500">
                <Check className="h-12 w-12 text-emerald-600" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight mb-4">
                You're All Set!
              </h1>
              <p className="text-lg text-muted-foreground mb-10 leading-relaxed">
                Your 7-day free trial starts now. Take 3 minutes each day to
                reflect, and we'll turn your thoughts into beautiful memories.
              </p>
              <Button
                onClick={handleNext}
                size="lg"
                className="w-full py-6 text-lg shadow-lg hover:shadow-xl transition-all"
                disabled={completeMutation.isPending}
              >
                {completeMutation.isPending
                  ? 'Starting...'
                  : 'Start My First Session'}
                <Sparkles className="ml-2 h-5 w-5" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
