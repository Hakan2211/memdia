import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { updateProfileFn } from '../../server/auth.fn'
import {
  createBillingPortalFn,
  createCheckoutFn,
  getSubscriptionFn,
} from '../../server/billing.fn'
import {
  getUserPreferencesFn,
  updateUserPreferencesFn,
} from '../../server/session.fn'
import { useSession } from '../../lib/auth-client'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
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

// Type for user
interface ProfileUser {
  id: string
  email: string
  name: string | null
  image?: string | null
  role?: string
}

// Type for checkout/portal response
interface UrlResponse {
  url: string
}

export const Route = createFileRoute('/_app/profile')({
  component: ProfilePage,
})

const profileSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
})

function ProfilePage() {
  const routeContext = Route.useRouteContext()
  const { data: session } = useSession()
  const queryClient = useQueryClient()
  const [success, setSuccess] = useState(false)

  // User from session takes precedence, fallback to route context
  const sessionUser = session?.user as ProfileUser | undefined
  const contextUser = routeContext.user as ProfileUser | undefined
  const user = sessionUser ?? contextUser
  const userName = user?.name || ''
  const userEmail = user?.email || ''
  const userRole = user?.role || 'user'

  const { data: subscription } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => getSubscriptionFn(),
  })

  const { data: preferences } = useQuery({
    queryKey: ['user-preferences'],
    queryFn: () => getUserPreferencesFn(),
  })

  // Preferences state
  const [selectedTimezone, setSelectedTimezone] = useState('UTC')
  const [selectedImageStyle, setSelectedImageStyle] =
    useState<ImageStyle>('realistic')
  const [selectedPersonality, setSelectedPersonality] =
    useState<AIPersonality>('empathetic')
  const [selectedLanguage, setSelectedLanguage] = useState<Language>('en')
  const [prefsSuccess, setPrefsSuccess] = useState(false)

  // Update local state when preferences load
  useEffect(() => {
    if (preferences) {
      setSelectedTimezone(preferences.timezone)
      setSelectedImageStyle(preferences.imageStyle as ImageStyle)
      setSelectedPersonality(preferences.aiPersonality as AIPersonality)
      setSelectedLanguage((preferences.language as Language) || 'en')
    }
  }, [preferences])

  const updateMutation = useMutation({
    mutationFn: (input: { name: string }) => updateProfileFn({ data: input }),
    onSuccess: () => {
      setSuccess(true)
      void queryClient.invalidateQueries({ queryKey: ['session'] })
      setTimeout(() => setSuccess(false), 3000)
    },
  })

  const checkoutMutation = useMutation({
    mutationFn: () => createCheckoutFn({ data: {} }),
    onSuccess: (response: UrlResponse) => {
      window.location.href = response.url
    },
  })

  const portalMutation = useMutation({
    mutationFn: () => createBillingPortalFn(),
    onSuccess: (data: UrlResponse) => {
      window.location.href = data.url
    },
  })

  const updatePrefsMutation = useMutation({
    mutationFn: updateUserPreferencesFn,
    onSuccess: () => {
      setPrefsSuccess(true)
      void queryClient.invalidateQueries({ queryKey: ['user-preferences'] })
      setTimeout(() => setPrefsSuccess(false), 3000)
    },
  })

  const form = useForm({
    defaultValues: {
      name: userName,
    },
    onSubmit: ({ value }) => {
      updateMutation.mutate(value)
    },
  })

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <p className="text-muted-foreground">Manage your account settings</p>
      </div>

      {/* Two-Column Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Sidebar: Profile Info & Subscription */}
        <div className="space-y-6 lg:col-span-4">
          {/* Profile Form */}
          <div className="rounded-lg border bg-card p-6">
            <h2 className="mb-4 text-lg font-semibold">Personal Information</h2>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                void form.handleSubmit()
              }}
              className="space-y-4"
            >
              {success && (
                <div className="rounded-md bg-green-500/10 p-3 text-sm text-green-600">
                  Profile updated successfully!
                </div>
              )}

              {updateMutation.error && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {updateMutation.error.message}
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-sm">Email</Label>
                <Input
                  type="email"
                  value={userEmail}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Email cannot be changed
                </p>
              </div>

              <form.Field
                name="name"
                validators={{
                  onChange: ({ value }) => {
                    const result = profileSchema.shape.name.safeParse(value)
                    return result.success
                      ? undefined
                      : result.error.issues[0]?.message
                  },
                }}
              >
                {(field) => (
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-sm">
                      Name
                    </Label>
                    <Input
                      id="name"
                      type="text"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                    />
                    {field.state.meta.errors.length > 0 && (
                      <p className="text-sm text-destructive">
                        {field.state.meta.errors.join(', ')}
                      </p>
                    )}
                  </div>
                )}
              </form.Field>

              <div className="space-y-2">
                <Label className="text-sm">Role</Label>
                <Input
                  value={userRole}
                  disabled
                  className="bg-muted capitalize"
                />
              </div>

              <Button
                type="submit"
                disabled={updateMutation.isPending}
                className="w-full"
              >
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </form>
          </div>

          {/* Subscription */}
          <div className="rounded-lg border bg-card p-6">
            <h2 className="mb-4 text-lg font-semibold">Subscription</h2>

            <div className="mb-4 rounded-lg bg-muted/50 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">
                    {subscription?.status === 'active'
                      ? 'Pro Plan'
                      : 'Free Plan'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {subscription?.status === 'active'
                      ? 'Full access to all features'
                      : 'Upgrade to unlock all features'}
                  </p>
                </div>
                <span
                  className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    subscription?.status === 'active'
                      ? 'bg-green-500/10 text-green-600'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {subscription?.status === 'active' ? 'Active' : 'Free'}
                </span>
              </div>
            </div>

            {subscription?.status === 'active' ? (
              <Button
                variant="outline"
                onClick={() => portalMutation.mutate()}
                disabled={portalMutation.isPending}
                className="w-full"
              >
                {portalMutation.isPending
                  ? 'Loading...'
                  : 'Manage Subscription'}
              </Button>
            ) : (
              <Button
                onClick={() => checkoutMutation.mutate()}
                disabled={checkoutMutation.isPending}
                className="w-full"
              >
                {checkoutMutation.isPending ? 'Loading...' : 'Upgrade to Pro'}
              </Button>
            )}
          </div>
        </div>

        {/* Right Content: Preferences */}
        <div className="lg:col-span-8">
          <div className="rounded-lg border bg-card p-6">
            <h2 className="mb-6 text-lg font-semibold">Preferences</h2>

            {prefsSuccess && (
              <div className="mb-4 rounded-md bg-green-500/10 p-3 text-sm text-green-600">
                Preferences saved successfully!
              </div>
            )}

            <div className="space-y-8">
              {/* First Row: Timezone & AI Personality */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Timezone */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Timezone</Label>
                  <select
                    value={selectedTimezone}
                    onChange={(e) => setSelectedTimezone(e.target.value)}
                    className="w-full p-2.5 border rounded-lg text-sm bg-background"
                  >
                    {[
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
                    ].map((tz) => (
                      <option key={tz} value={tz}>
                        {tz.replace('_', ' ')}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Used for scheduling and displaying dates
                  </p>
                </div>

                {/* AI Personality */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">AI Personality</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      {
                        value: 'empathetic' as const,
                        label: 'Empathetic',
                        description: 'Warm & supportive',
                      },
                      {
                        value: 'curious' as const,
                        label: 'Curious',
                        description: 'Thought-provoking',
                      },
                    ].map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setSelectedPersonality(p.value)}
                        className={`p-3 rounded-lg border text-left transition-colors ${
                          selectedPersonality === p.value
                            ? 'border-primary bg-primary/5'
                            : 'border-muted hover:border-muted-foreground/30'
                        }`}
                      >
                        <div className="font-medium text-sm">{p.label}</div>
                        <div className="text-xs text-muted-foreground">
                          {p.description}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Image Style */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">
                  Memory Image Style
                </Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                  {[
                    {
                      value: 'realistic' as const,
                      label: 'Realistic',
                      description: 'Cinematic',
                    },
                    {
                      value: 'dreamlike' as const,
                      label: 'Dreamlike',
                      description: 'Ethereal',
                    },
                    {
                      value: 'watercolor' as const,
                      label: 'Watercolor',
                      description: 'Flowing',
                    },
                    {
                      value: 'geometric' as const,
                      label: 'Geometric',
                      description: 'Minimalist',
                    },
                    {
                      value: 'sketch' as const,
                      label: 'Sketch',
                      description: 'Line art',
                    },
                  ].map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setSelectedImageStyle(s.value)}
                      className={`p-3 rounded-lg border text-left transition-colors ${
                        selectedImageStyle === s.value
                          ? 'border-primary bg-primary/5'
                          : 'border-muted hover:border-muted-foreground/30'
                      }`}
                    >
                      <div className="font-medium text-sm">{s.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {s.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Language Selector */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">
                    Conversation Language
                  </Label>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    Selected:{' '}
                    <span
                      className={`fi fi-${LANGUAGE_TO_FLAG[selectedLanguage]} rounded-sm`}
                    />
                    <span className="font-medium text-foreground">
                      {isMultilingualLanguage(selectedLanguage)
                        ? MULTILINGUAL_LANGUAGE_LABELS[selectedLanguage].native
                        : MONOLINGUAL_LANGUAGE_LABELS[selectedLanguage].native}
                    </span>
                  </div>
                </div>

                {requiresNova2Model(selectedLanguage) && (
                  <div className="text-xs text-amber-600 bg-amber-500/10 p-2 rounded-md">
                    Uses Nova-2 model. Nova-3 support coming soon.
                  </div>
                )}

                <div className="border rounded-lg overflow-hidden">
                  {/* Multilingual Section */}
                  <div className="p-4 bg-muted/30">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-sm font-medium">Multilingual</span>
                      <span className="text-xs text-muted-foreground bg-primary/10 px-2 py-0.5 rounded-full">
                        Auto-detect
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">
                      Supports switching between languages mid-conversation
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                      {MULTILINGUAL_LANGUAGES.map((lang) => {
                        const { name, native } =
                          MULTILINGUAL_LANGUAGE_LABELS[lang]
                        const flagCode = LANGUAGE_TO_FLAG[lang]
                        return (
                          <button
                            key={lang}
                            type="button"
                            onClick={() => setSelectedLanguage(lang)}
                            className={`flex items-center gap-2 p-2.5 rounded-lg border text-left transition-colors ${
                              selectedLanguage === lang
                                ? 'border-primary bg-primary/5'
                                : 'border-muted bg-background hover:border-muted-foreground/30'
                            }`}
                          >
                            <span
                              className={`fi fi-${flagCode} text-lg rounded-sm shrink-0`}
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

                  {/* Divider */}
                  <div className="border-t" />

                  {/* Monolingual Section */}
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-sm font-medium">
                        Single Language
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">
                      Optimized for single-language conversations
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                      {MONOLINGUAL_LANGUAGES.map((lang) => {
                        const { name, native } =
                          MONOLINGUAL_LANGUAGE_LABELS[lang]
                        const flagCode = LANGUAGE_TO_FLAG[lang]
                        const isNova2 = requiresNova2Model(lang)
                        return (
                          <button
                            key={lang}
                            type="button"
                            onClick={() => setSelectedLanguage(lang)}
                            className={`flex items-center gap-2 p-2.5 rounded-lg border text-left transition-colors ${
                              selectedLanguage === lang
                                ? 'border-primary bg-primary/5'
                                : 'border-muted hover:border-muted-foreground/30'
                            }`}
                          >
                            <span
                              className={`fi fi-${flagCode} text-lg rounded-sm shrink-0`}
                            />
                            <div className="min-w-0">
                              <div className="font-medium text-sm truncate">
                                {native}
                              </div>
                              <div className="text-xs text-muted-foreground truncate">
                                {name}
                                {isNova2 && (
                                  <span className="text-amber-600 ml-1">
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
              </div>

              {/* Save Button */}
              <div className="flex justify-end pt-4 border-t">
                <Button
                  onClick={() =>
                    updatePrefsMutation.mutate({
                      data: {
                        timezone: selectedTimezone,
                        imageStyle: selectedImageStyle,
                        aiPersonality: selectedPersonality,
                        language: selectedLanguage,
                      },
                    })
                  }
                  disabled={updatePrefsMutation.isPending}
                  size="lg"
                >
                  {updatePrefsMutation.isPending
                    ? 'Saving...'
                    : 'Save Preferences'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
