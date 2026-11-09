/**
 * PlanCard — the single (Pro) plan shown on signup and subscribe pages.
 * Copy comes from SUBSCRIPTION_TIERS.pro so every surface stays in sync.
 */

import { Check } from 'lucide-react'
import { SUBSCRIPTION_TIERS, formatEuro } from '../../types/subscription'

export function PlanCard() {
  const plan = SUBSCRIPTION_TIERS.pro

  return (
    <div className="relative mx-auto w-full max-w-md rounded-xl border-2 border-[#7e9ec9] bg-[#7e9ec9]/5 p-6 text-left ring-2 ring-[#7e9ec9]/20">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">{plan.name}</h3>
        <p className="text-sm text-muted-foreground">{plan.description}</p>
      </div>

      <div className="mb-4">
        <span className="text-3xl font-bold">
          {formatEuro(plan.priceMonthly)}
        </span>
        <span className="text-muted-foreground">/month</span>
      </div>

      <ul className="space-y-2">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#7e9ec9]" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
