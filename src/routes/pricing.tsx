import { createFileRoute } from '@tanstack/react-router'
import { LandingHeader } from '@/components/landing/LandingHeader'
import { PricingSection } from '@/components/landing/PricingSection'
import { LandingFooter } from '@/components/landing/LandingFooter'

export const Route = createFileRoute('/pricing')({
  component: PricingPage,
})

/**
 * Standalone pricing page.
 * Reuses the landing page's PricingSection so plan details/prices
 * have a single source of truth.
 */
function PricingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <LandingHeader />
      <main className="flex-1 pt-16">
        <PricingSection />
      </main>
      <LandingFooter />
    </div>
  )
}
