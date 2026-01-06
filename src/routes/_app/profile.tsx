import { useState, useEffect } from 'react'
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
import type {
  AIPersonality,
  ImageStyle,
  Language,
} from '../../types/voice-session'
import { SUPPORTED_LANGUAGES, LANGUAGE_LABELS } from '../../types/voice-session'

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
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <p className="text-muted-foreground">Manage your account settings</p>
      </div>

      {/* Profile Form */}
      <div className="max-w-2xl rounded-lg border bg-card p-6">
        <h2 className="mb-4 text-xl font-semibold">Personal Information</h2>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            void form.handleSubmit()
          }}
          className="space-y-6"
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
            <Label>Email</Label>
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
                <Label htmlFor="name">Name</Label>
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
            <Label>Role</Label>
            <Input value={userRole} disabled className="bg-muted capitalize" />
          </div>

          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </form>
      </div>

      {/* Subscription */}
      <div className="max-w-2xl rounded-lg border bg-card p-6">
        <h2 className="mb-4 text-xl font-semibold">Subscription</h2>

        <div className="mb-6 rounded-lg bg-muted/50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">
                {subscription?.status === 'active' ? 'Pro Plan' : 'Free Plan'}
              </p>
              <p className="text-sm text-muted-foreground">
                {subscription?.status === 'active'
                  ? 'You have access to all features'
                  : 'Upgrade to unlock all features'}
              </p>
            </div>
            <div className="text-right">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  subscription?.status === 'active'
                    ? 'bg-green-500/10 text-green-600'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {subscription?.status === 'active' ? 'Active' : 'Free'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          {subscription?.status === 'active' ? (
            <Button
              variant="outline"
              onClick={() => portalMutation.mutate()}
              disabled={portalMutation.isPending}
            >
              {portalMutation.isPending ? 'Loading...' : 'Manage Subscription'}
            </Button>
          ) : (
            <Button
              onClick={() => checkoutMutation.mutate()}
              disabled={checkoutMutation.isPending}
            >
              {checkoutMutation.isPending ? 'Loading...' : 'Upgrade to Pro'}
            </Button>
          )}
        </div>
      </div>

      {/* Preferences */}
      <div className="max-w-2xl rounded-lg border bg-card p-6">
        <h2 className="mb-4 text-xl font-semibold">Preferences</h2>

        {prefsSuccess && (
          <div className="mb-4 rounded-md bg-green-500/10 p-3 text-sm text-green-600">
            Preferences saved successfully!
          </div>
        )}

        <div className="space-y-6">
          {/* Timezone */}
          <div className="space-y-2">
            <Label>Timezone</Label>
            <select
              value={selectedTimezone}
              onChange={(e) => setSelectedTimezone(e.target.value)}
              className="w-full p-2 border rounded-md text-sm"
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

          {/* Language */}
          <div className="space-y-2">
            <Label>Conversation Language</Label>
            <div className="grid grid-cols-2 gap-3">
              {SUPPORTED_LANGUAGES.map((lang) => {
                const { name, native } = LANGUAGE_LABELS[lang]
                return (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setSelectedLanguage(lang)}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      selectedLanguage === lang
                        ? 'border-primary bg-primary/5'
                        : 'border-muted hover:border-muted-foreground/30'
                    }`}
                  >
                    <div className="font-medium text-sm">{native}</div>
                    <div className="text-xs text-muted-foreground">{name}</div>
                  </button>
                )
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Your preferred language for greetings and conversations. The AI
              will adapt if you switch languages.
            </p>
          </div>

          {/* AI Personality */}
          <div className="space-y-2">
            <Label>AI Personality</Label>
            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  value: 'empathetic' as const,
                  label: 'Empathetic',
                  description: 'Warm, supportive, understanding',
                },
                {
                  value: 'curious' as const,
                  label: 'Curious',
                  description: 'Inquisitive, thought-provoking',
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

          {/* Image Style */}
          <div className="space-y-2">
            <Label>Memory Image Style</Label>
            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  value: 'realistic' as const,
                  label: 'Realistic',
                  description: 'Photorealistic, cinematic, hyperreal',
                },
                {
                  value: 'dreamlike' as const,
                  label: 'Dreamlike',
                  description: 'Ethereal, soft focus, pastel',
                },
                {
                  value: 'watercolor' as const,
                  label: 'Watercolor',
                  description: 'Delicate washes, flowing shapes',
                },
                {
                  value: 'geometric' as const,
                  label: 'Geometric',
                  description: 'Clean lines, modern minimalist',
                },
                {
                  value: 'sketch' as const,
                  label: 'Sketch',
                  description: 'Elegant pencil, fine line art',
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
          >
            {updatePrefsMutation.isPending ? 'Saving...' : 'Save Preferences'}
          </Button>
        </div>
      </div>
    </div>
  )
}
