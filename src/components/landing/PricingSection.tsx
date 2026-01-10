'use client'

import { Link } from '@tanstack/react-router'
import { motion } from 'framer-motion'
import { Check, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const plans = [
  {
    name: 'Starter',
    price: '€19',
    period: '/month',
    description: 'Perfect for building a daily memory habit.',
    features: [
      '3-minute daily voice memories',
      'Daily AI-generated image',
      '2 recording attempts per day',
      '2 AI personalities',
      '5 image styles',
      '32 supported languages',
      'Full history access',
    ],
    cta: 'Start Journey',
    popular: false,
  },
  {
    name: 'Pro',
    price: '€29',
    period: '/month',
    description: 'Deepen your self-discovery with extended sessions.',
    features: [
      'Everything in Starter',
      '10-minute reflection conversations',
      '1 extended recording attempt per day',
      'Advanced Insights Dashboard',
      'Automatic Information Extraction to Insight Dashboard',
      'Tracking your mood, topics, insights, todos, and people over time',
    ],
    cta: 'Go Pro',
    popular: true,
  },
]

function PricingCard({
  plan,
  index,
}: {
  plan: (typeof plans)[0]
  index: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      whileHover={{ y: -8 }}
      className="relative flex flex-col"
    >
      {/* Popular Badge */}
      {plan.popular && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
          <motion.div
            animate={{
              boxShadow: [
                '0 0 20px rgba(126, 158, 201, 0.3)',
                '0 0 30px rgba(126, 158, 201, 0.5)',
                '0 0 20px rgba(126, 158, 201, 0.3)',
              ],
            }}
            transition={{ duration: 2, repeat: Infinity }}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-[#7e9ec9] to-[#5a7ba6] text-white text-sm font-medium shadow-lg backdrop-blur-sm"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Most Popular
          </motion.div>
        </div>
      )}

      <div
        className={cn(
          'flex flex-col h-full rounded-2xl border p-8 transition-all duration-300',
          plan.popular
            ? 'border-[#7e9ec9]/30 bg-white/80 backdrop-blur-xl shadow-2xl shadow-[#7e9ec9]/10'
            : 'border-slate-200 bg-white/60 backdrop-blur-lg hover:shadow-xl hover:shadow-slate-200/50',
        )}
      >
        {/* Plan Name */}
        <div className="mb-4">
          <h3 className="text-xl font-semibold text-slate-900 tracking-wide uppercase text-sm opacity-80">
            {plan.name}
          </h3>
        </div>

        {/* Price */}
        <div className="mb-4">
          <span className="text-5xl font-bold text-slate-900 tracking-tight">
            {plan.price}
          </span>
          <span className="text-slate-500 font-medium ml-1">{plan.period}</span>
        </div>

        {/* Description */}
        <p className="text-slate-600 mb-8 leading-relaxed h-12">
          {plan.description}
        </p>

        {/* CTA Button */}
        <Link to="/signup" className="block mb-8 w-full">
          <Button
            size="lg"
            className={cn(
              'w-full h-12 text-base transition-all duration-300',
              plan.popular
                ? 'bg-gradient-to-r from-[#7e9ec9] to-[#5a7ba6] hover:from-[#6b8bb6] hover:to-[#4a6b96] text-white shadow-lg shadow-[#7e9ec9]/25 hover:shadow-xl hover:shadow-[#7e9ec9]/30 hover:scale-[1.02]'
                : 'bg-slate-900 hover:bg-slate-800 text-white hover:scale-[1.02] shadow-lg hover:shadow-xl',
            )}
          >
            {plan.cta}
          </Button>
        </Link>

        {/* Features */}
        <div className="mt-auto">
          <ul className="space-y-4">
            {plan.features.map((feature) => (
              <li key={feature} className="flex items-start gap-3 group">
                <div
                  className={cn(
                    'mt-0.5 rounded-full p-1 transition-colors',
                    plan.popular
                      ? 'bg-[#7e9ec9]/10 group-hover:bg-[#7e9ec9]/20'
                      : 'bg-slate-100 group-hover:bg-slate-200',
                  )}
                >
                  <Check
                    className={cn(
                      'h-3.5 w-3.5',
                      plan.popular ? 'text-[#7e9ec9]' : 'text-slate-600',
                    )}
                  />
                </div>
                <span className="text-slate-600 text-sm leading-tight">
                  {feature}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </motion.div>
  )
}

export function PricingSection() {
  return (
    <section
      id="pricing"
      className="py-24 lg:py-32 bg-gradient-to-b from-slate-50 to-white overflow-hidden relative"
    >
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[20%] left-[-10%] w-[500px] h-[500px] bg-blue-100/40 rounded-full blur-[100px]" />
        <div className="absolute bottom-[10%] right-[-5%] w-[400px] h-[400px] bg-indigo-100/40 rounded-full blur-[100px]" />
      </div>

      <div className="container relative mx-auto px-4 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16 lg:mb-20"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6 tracking-tight">
            Invest in your{' '}
            <span className="bg-gradient-to-r from-[#7e9ec9] via-[#6b8bb6] to-[#5a7ba6] bg-clip-text text-transparent">
              peace of mind
            </span>
          </h2>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Choose the plan that fits your journey. Simple pricing, no hidden
            fees.
          </p>
        </motion.div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto items-stretch">
          {plans.map((plan, index) => (
            <PricingCard key={plan.name} plan={plan} index={index} />
          ))}
        </div>
      </div>
    </section>
  )
}
