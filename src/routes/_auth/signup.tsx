import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import { useState } from 'react'
import { Check } from 'lucide-react'
import { signUp } from '../../lib/auth-client'
import { createCheckoutFn } from '../../server/billing.fn'
import { SUBSCRIPTION_TIERS } from '../../types/subscription'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Honeypot, isHoneypotFilled } from '../../components/common/Honeypot'
import type { SubscriptionTier } from '../../types/subscription'

// Search params schema for tier selection
const signupSearchSchema = z.object({
  tier: z.enum(['starter', 'pro']).optional().default('starter'),
})

export const Route = createFileRoute('/_auth/signup')({
  validateSearch: signupSearchSchema,
  component: SignupPage,
})

const signupFormSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  _gotcha: z.string().optional(),
})

function SignupPage() {
  const router = useRouter()
  const { tier: selectedTier } = Route.useSearch()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const form = useForm({
    defaultValues: {
      name: '',
      email: '',
      password: '',
      _gotcha: '',
    },
    onSubmit: async ({ value }) => {
      // Honeypot check
      if (isHoneypotFilled(value)) {
        return
      }

      setError(null)
      setLoading(true)

      try {
        // Step 1: Create the account
        const result = await signUp.email({
          email: value.email,
          password: value.password,
          name: value.name,
        })

        if (result.error) {
          setError(result.error.message || 'Failed to create account')
          setLoading(false)
          return
        }

        // Step 2: Redirect to Stripe Checkout
        const checkoutResult = await createCheckoutFn({
          data: {
            tier: selectedTier as SubscriptionTier,
            isNewUser: true,
          },
        })

        // Redirect to Stripe Checkout
        window.location.href = checkoutResult.url
      } catch (err) {
        console.error('Signup error:', err)
        setError('An unexpected error occurred')
        setLoading(false)
      }
    },
  })

  const handleTierChange = (tier: SubscriptionTier) => {
    router.navigate({
      to: '/signup',
      search: { tier },
      replace: true,
    })
  }

  return (
    <div className="w-full max-w-4xl space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight bg-linear-to-r from-[#5a7ba6] to-[#7e9ec9] bg-clip-text text-transparent">
          Create your account
        </h1>
        <p className="mt-2 text-muted-foreground">
          Choose your plan and get started with Memdia
        </p>
      </div>

      {/* Tier Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(['starter', 'pro'] as const).map((tier) => {
          const tierInfo = SUBSCRIPTION_TIERS[tier]
          const isSelected = selectedTier === tier

          return (
            <button
              key={tier}
              type="button"
              onClick={() => handleTierChange(tier)}
              className={`relative p-6 rounded-xl border-2 text-left transition-all ${
                isSelected
                  ? 'border-[#7e9ec9] bg-[#7e9ec9]/5 ring-2 ring-[#7e9ec9]/20'
                  : 'border-muted hover:border-[#7e9ec9]/30 hover:bg-accent/50'
              }`}
            >
              {tier === 'pro' && (
                <div className="absolute -top-3 right-4 rounded-full bg-[#7e9ec9] px-3 py-1 text-xs font-medium text-white shadow-sm">
                  Best Value
                </div>
              )}

              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">{tierInfo.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {tierInfo.description}
                  </p>
                </div>
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    isSelected
                      ? 'border-[#7e9ec9] bg-[#7e9ec9]'
                      : 'border-muted'
                  }`}
                >
                  {isSelected && (
                    <Check className="w-3 h-3 text-primary-foreground" />
                  )}
                </div>
              </div>

              <div className="mb-4">
                <span className="text-3xl font-bold">
                  ${tierInfo.priceMonthly}
                </span>
                <span className="text-muted-foreground">/month</span>
              </div>

              <ul className="space-y-2">
                {tierInfo.features.slice(0, 4).map((feature, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-[#7e9ec9] shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </button>
          )
        })}
      </div>

      {/* Signup Form */}
      <div className="rounded-lg border bg-card p-8 shadow-sm">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            form.handleSubmit()
          }}
          className="space-y-6"
        >
          <Honeypot />

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <form.Field
            name="name"
            validators={{
              onChange: ({ value }) => {
                const result = signupFormSchema.shape.name.safeParse(value)
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
                  placeholder="John Doe"
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

          <form.Field
            name="email"
            validators={{
              onChange: ({ value }) => {
                const result = signupFormSchema.shape.email.safeParse(value)
                return result.success
                  ? undefined
                  : result.error.issues[0]?.message
              },
            }}
          >
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
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

          <form.Field
            name="password"
            validators={{
              onChange: ({ value }) => {
                const result = signupFormSchema.shape.password.safeParse(value)
                return result.success
                  ? undefined
                  : result.error.issues[0]?.message
              },
            }}
          >
            {(field) => (
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
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

          <Button
            type="submit"
            className="w-full bg-linear-to-r from-[#7e9ec9] to-[#5a7ba6] hover:opacity-90 transition-opacity text-white border-0"
            disabled={loading}
          >
            {loading
              ? 'Creating account...'
              : `Continue with ${SUBSCRIPTION_TIERS[selectedTier].name} Plan`}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            By continuing, you agree to our Terms of Service and Privacy Policy.
            You will be redirected to Stripe to complete payment.
          </p>
        </form>

        {/* Google OAuth - Phase 2
        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                Or continue with
              </span>
            </div>
          </div>

          <Button
            variant="outline"
            className="mt-4 w-full"
            onClick={() =>
              (window.location.href =
                '/api/auth/sign-in/social?provider=google')
            }
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Google
          </Button>
        </div>
        */}
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link
          to="/login"
          className="font-medium text-[#5a7ba6] hover:text-[#7e9ec9] hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  )
}
