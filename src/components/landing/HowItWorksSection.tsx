'use client'

import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { Bot, LineChart, Mic } from 'lucide-react'

const steps = [
  {
    number: '01',
    icon: Mic,
    title: 'Speak',
    description:
      'Share your day naturally through voice. Just press record and talk about your experiences, thoughts, and feelings.',
  },
  {
    number: '02',
    icon: Bot,
    title: 'AI Listens',
    description:
      'Our AI companion engages in meaningful conversation, asking thoughtful questions and helping you process your experiences.',
  },
  {
    number: '03',
    icon: LineChart,
    title: 'Gain Insights',
    description:
      'See your moods, topics, and personal growth over time. Discover patterns and build a deeper understanding of yourself.',
  },
]

function StepCard({
  step,
  index,
  isLast,
}: {
  step: (typeof steps)[0]
  index: number
  isLast: boolean
}) {
  const Icon = step.icon

  return (
    <div className="relative flex-1 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 0.5, delay: index * 0.15 }}
        className="relative z-10 flex flex-col items-center"
      >
        {/* Step Number */}
        <div className="mb-4 text-sm font-bold tracking-wider text-[#7e9ec9] uppercase">
          {step.number}
        </div>

        {/* Icon Circle */}
        <motion.div
          whileHover={{ scale: 1.05 }}
          className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#7e9ec9] to-[#5a7ba6] shadow-xl shadow-[#7e9ec9]/20 ring-4 ring-white"
        >
          <Icon className="h-8 w-8 text-white" />
        </motion.div>

        {/* Content */}
        <h3 className="mb-3 text-xl font-bold text-slate-900">{step.title}</h3>
        <p className="text-slate-600 leading-relaxed max-w-sm mx-auto">
          {step.description}
        </p>
      </motion.div>

      {/* Connector Line (hidden on last item and mobile) */}
      {!isLast && (
        <motion.div
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: index * 0.15 + 0.3 }}
          className="hidden lg:block absolute top-[68px] left-[calc(50%+64px)] w-[calc(100%-128px)] h-0.5 origin-left"
        >
          <div className="h-full w-full bg-gradient-to-r from-[#7e9ec9] to-[#7e9ec9]/30" />
          {/* Arrow */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1">
            <div className="w-2.5 h-2.5 border-t-2 border-r-2 border-[#7e9ec9]/50 rotate-45" />
          </div>
        </motion.div>
      )}
    </div>
  )
}

export function HowItWorksSection() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, amount: 0.2 })

  return (
    <section id="how-it-works" className="py-20 lg:py-28 bg-slate-50" ref={ref}>
      <div className="container mx-auto px-4 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            How{' '}
            <span className="bg-gradient-to-r from-[#7e9ec9] to-[#5a7ba6] bg-clip-text text-transparent">
              Memdia
            </span>{' '}
            Works
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            A simple three-step process to transform your daily experiences into
            meaningful insights.
          </p>
        </motion.div>

        {/* Steps */}
        <div className="flex flex-col lg:flex-row gap-12 lg:gap-8">
          {steps.map((step, index) => (
            <StepCard
              key={step.number}
              step={step}
              index={index}
              isLast={index === steps.length - 1}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
