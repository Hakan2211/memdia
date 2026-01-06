/**
 * Onboarding Route
 * First-time user setup: mic permission, timezone, preferences
 */

import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import {
  Mic,
  Globe,
  Palette,
  Sparkles,
  ChevronRight,
  Check,
} from 'lucide-react'
import { Button } from '../../components/ui/button'
import {
  completeOnboardingFn,
  getUserPreferencesFn,
  updateUserPreferencesFn,
} from '../../server/session.fn'
import type {
  AIPersonality,
  ImageStyle,
  Language,
} from '../../types/voice-session'
import {
  MULTILINGUAL_LANGUAGES,
  MONOLINGUAL_LANGUAGES,
  MULTILINGUAL_LANGUAGE_LABELS,
  MONOLINGUAL_LANGUAGE_LABELS,
  isMultilingualLanguage,
  requiresNova2Model,
} from '../../types/voice-session'

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
const ALL_SUPPORTED_LANGUAGES: Language[] = [
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

const IMAGE_STYLES: {
  value: ImageStyle
  label: string
  description: string
}[] = [
  {
    value: 'realistic',
    label: 'Realistic',
    description: 'Photorealistic, cinematic, hyperreal',
  },
  {
    value: 'dreamlike',
    label: 'Dreamlike',
    description: 'Ethereal, soft focus, pastel colors',
  },
  {
    value: 'watercolor',
    label: 'Watercolor',
    description: 'Delicate washes, flowing shapes',
  },
  {
    value: 'geometric',
    label: 'Geometric',
    description: 'Clean lines, modern minimalist',
  },
  {
    value: 'sketch',
    label: 'Sketch',
    description: 'Elegant pencil, fine line art',
  },
]

const AI_PERSONALITIES: {
  value: AIPersonality
  label: string
  description: string
}[] = [
  {
    value: 'empathetic',
    label: 'Empathetic',
    description: 'Warm, supportive, and understanding',
  },
  {
    value: 'curious',
    label: 'Curious',
    description: 'Inquisitive, exploratory, thought-provoking',
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
  ]

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-md">
        {/* Progress indicator */}
        <div className="flex justify-center gap-2 mb-8">
          {(
            [
              'welcome',
              'language',
              'microphone',
              'timezone',
              'preferences',
              'complete',
            ] as const
          ).map((s, i) => (
            <div
              key={s}
              className={`h-2 w-2 rounded-full transition-colors ${
                step === s
                  ? 'bg-primary'
                  : i <
                      [
                        'welcome',
                        'language',
                        'microphone',
                        'timezone',
                        'preferences',
                        'complete',
                      ].indexOf(step)
                    ? 'bg-primary/50'
                    : 'bg-muted'
              }`}
            />
          ))}
        </div>

        {/* Welcome Step */}
        {step === 'welcome' && (
          <div className="text-center">
            <div className="h-20 w-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <Sparkles className="h-10 w-10 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold mb-2">Welcome to Memdia</h1>
            <p className="text-muted-foreground mb-8">
              Your daily 3-minute voice companion for reflection and
              mindfulness. Let's get you set up.
            </p>
            <Button onClick={handleNext} size="lg" className="w-full">
              Get Started
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Language Step */}
        {step === 'language' && (
          <div className="text-center">
            <div className="h-20 w-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <Globe className="h-10 w-10 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold mb-2">
              Choose Your Language
            </h1>
            <p className="text-muted-foreground mb-6">
              Select your preferred language for conversations.
            </p>

            {/* Scrollable language container */}
            <div className="max-h-[400px] overflow-y-auto pr-1 mb-6">
              {/* Multilingual Section */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-medium text-left">
                    Multilingual
                  </span>
                  <span className="text-xs text-muted-foreground bg-primary/10 px-2 py-0.5 rounded-full">
                    Auto-detect
                  </span>
                </div>
                <p className="text-xs text-muted-foreground text-left mb-3">
                  Supports switching between languages mid-conversation
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {MULTILINGUAL_LANGUAGES.map((lang) => {
                    const { name, native } = MULTILINGUAL_LANGUAGE_LABELS[lang]
                    return (
                      <button
                        key={lang}
                        onClick={() => setSelectedLanguage(lang)}
                        className={`p-3 rounded-lg border text-left transition-colors ${
                          selectedLanguage === lang
                            ? 'border-primary bg-primary/5'
                            : 'border-muted hover:border-muted-foreground/30'
                        }`}
                      >
                        <div className="font-medium text-sm">{native}</div>
                        <div className="text-xs text-muted-foreground">
                          {name}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-muted my-4" />

              {/* Monolingual Section */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-medium text-left">
                    Single Language
                  </span>
                </div>
                <p className="text-xs text-muted-foreground text-left mb-3">
                  Optimized for single-language conversations
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {MONOLINGUAL_LANGUAGES.map((lang) => {
                    const { name, native } = MONOLINGUAL_LANGUAGE_LABELS[lang]
                    const isNova2 = requiresNova2Model(lang)
                    return (
                      <button
                        key={lang}
                        onClick={() => setSelectedLanguage(lang)}
                        className={`p-3 rounded-lg border text-left transition-colors ${
                          selectedLanguage === lang
                            ? 'border-primary bg-primary/5'
                            : 'border-muted hover:border-muted-foreground/30'
                        }`}
                      >
                        <div className="font-medium text-sm">{native}</div>
                        <div className="text-xs text-muted-foreground">
                          {name}
                        </div>
                        {isNova2 && (
                          <div className="text-xs text-amber-600 mt-1">
                            Nova-2 model
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Selected language indicator */}
            {selectedLanguage && (
              <div className="text-sm text-muted-foreground mb-4">
                Selected:{' '}
                <span className="font-medium text-foreground">
                  {isMultilingualLanguage(selectedLanguage)
                    ? MULTILINGUAL_LANGUAGE_LABELS[selectedLanguage].native
                    : MONOLINGUAL_LANGUAGE_LABELS[selectedLanguage].native}
                </span>
                {isMultilingualLanguage(selectedLanguage) && (
                  <span className="text-xs ml-1">(multilingual)</span>
                )}
                {requiresNova2Model(selectedLanguage) && (
                  <div className="text-xs text-amber-600 mt-1">
                    Uses Nova-2 model. Nova-3 support coming soon.
                  </div>
                )}
              </div>
            )}

            <Button
              onClick={handleNext}
              size="lg"
              className="w-full"
              disabled={updatePrefsMutation.isPending}
            >
              {updatePrefsMutation.isPending ? 'Saving...' : 'Continue'}
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Microphone Step */}
        {step === 'microphone' && (
          <div className="text-center">
            <div
              className={`h-20 w-20 mx-auto mb-6 rounded-full flex items-center justify-center ${
                hasMicPermission
                  ? 'bg-emerald-500/20'
                  : 'bg-gradient-to-br from-primary/20 to-primary/5'
              }`}
            >
              {hasMicPermission ? (
                <Check className="h-10 w-10 text-emerald-500" />
              ) : (
                <Mic className="h-10 w-10 text-primary" />
              )}
            </div>
            <h1 className="text-2xl font-semibold mb-2">Enable Microphone</h1>
            <p className="text-muted-foreground mb-8">
              Memdia needs microphone access to record your daily reflections.
              Your audio is processed securely and never shared.
            </p>
            {!hasMicPermission ? (
              <Button
                onClick={requestMicPermission}
                size="lg"
                className="w-full mb-4"
              >
                <Mic className="mr-2 h-4 w-4" />
                Allow Microphone Access
              </Button>
            ) : (
              <div className="text-emerald-600 mb-4 flex items-center justify-center gap-2">
                <Check className="h-4 w-4" />
                Microphone access granted
              </div>
            )}
            <Button
              onClick={handleNext}
              variant={hasMicPermission ? 'default' : 'outline'}
              size="lg"
              className="w-full"
              disabled={!hasMicPermission}
            >
              Continue
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Timezone Step */}
        {step === 'timezone' && (
          <div className="text-center">
            <div className="h-20 w-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <Globe className="h-10 w-10 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold mb-2">Your Timezone</h1>
            <p className="text-muted-foreground mb-6">
              We'll use this to schedule your daily sessions and show the right
              dates.
            </p>
            <select
              value={selectedTimezone}
              onChange={(e) => setSelectedTimezone(e.target.value)}
              className="w-full p-3 border rounded-lg mb-6 text-sm"
            >
              {commonTimezones.map((tz) => (
                <option key={tz} value={tz}>
                  {tz.replace('_', ' ')}
                </option>
              ))}
            </select>
            <Button onClick={handleNext} size="lg" className="w-full">
              Continue
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Preferences Step */}
        {step === 'preferences' && (
          <div>
            <div className="text-center mb-6">
              <div className="h-20 w-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                <Palette className="h-10 w-10 text-primary" />
              </div>
              <h1 className="text-2xl font-semibold mb-2">Personalize</h1>
              <p className="text-muted-foreground">
                Choose how you'd like your AI companion to interact with you.
              </p>
            </div>

            {/* AI Personality */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-3">
                AI Personality
              </label>
              <div className="grid grid-cols-2 gap-3">
                {AI_PERSONALITIES.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setSelectedPersonality(p.value)}
                    className={`p-4 rounded-lg border text-left transition-colors ${
                      selectedPersonality === p.value
                        ? 'border-primary bg-primary/5'
                        : 'border-muted hover:border-muted-foreground/30'
                    }`}
                  >
                    <div className="font-medium text-sm">{p.label}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {p.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Image Style */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-3">
                Memory Image Style
              </label>
              <div className="grid grid-cols-2 gap-3">
                {IMAGE_STYLES.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setSelectedImageStyle(s.value)}
                    className={`p-4 rounded-lg border text-left transition-colors ${
                      selectedImageStyle === s.value
                        ? 'border-primary bg-primary/5'
                        : 'border-muted hover:border-muted-foreground/30'
                    }`}
                  >
                    <div className="font-medium text-sm">{s.label}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {s.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <Button
              onClick={handleNext}
              size="lg"
              className="w-full"
              disabled={updatePrefsMutation.isPending}
            >
              {updatePrefsMutation.isPending ? 'Saving...' : 'Continue'}
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Complete Step */}
        {step === 'complete' && (
          <div className="text-center">
            <div className="h-20 w-20 mx-auto mb-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <Check className="h-10 w-10 text-emerald-500" />
            </div>
            <h1 className="text-2xl font-semibold mb-2">You're All Set!</h1>
            <p className="text-muted-foreground mb-8">
              Your 7-day free trial starts now. Take 3 minutes each day to
              reflect, and we'll turn your thoughts into beautiful memories.
            </p>
            <Button
              onClick={handleNext}
              size="lg"
              className="w-full"
              disabled={completeMutation.isPending}
            >
              {completeMutation.isPending
                ? 'Starting...'
                : 'Start My First Session'}
              <Sparkles className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
