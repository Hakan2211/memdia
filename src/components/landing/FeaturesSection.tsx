'use client'

import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { Mic, Heart, BarChart3, Image, Brain, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

const features = [
  {
    icon: Mic,
    title: '3-Minute Daily Sessions',
    description:
      "Capture your day in your own words. Share what happened, how you felt, and what's on your mind in just three minutes.",
    color: 'from-[#7e9ec9] to-[#5a7ba6]',
    iconBg: 'bg-[#7e9ec9]/10',
    borderColor: 'group-hover:border-[#7e9ec9]/30',
  },
  {
    icon: Heart,
    title: '10-Minute Reflections',
    description:
      'Dive deeper with therapeutic conversations. Our AI asks thoughtful questions to help you process emotions and gain clarity.',
    color: 'from-rose-400 to-rose-500',
    iconBg: 'bg-rose-50',
    borderColor: 'group-hover:border-rose-200',
  },
  {
    icon: BarChart3,
    title: 'Insights Dashboard',
    description:
      'Track your emotional journey. See moods over time, frequently mentioned topics, important people, and actionable insights.',
    color: 'from-teal-400 to-teal-500',
    iconBg: 'bg-teal-50',
    borderColor: 'group-hover:border-teal-200',
  },
  {
    icon: Image,
    title: 'AI-Generated Memories',
    description:
      'Each voice session creates a unique, personalized image that captures the essence of your day as a visual memory.',
    color: 'from-amber-400 to-amber-500',
    iconBg: 'bg-amber-50',
    borderColor: 'group-hover:border-amber-200',
  },
  {
    icon: Brain,
    title: 'Smart Extraction',
    description:
      'Our AI automatically identifies moods, topics, people you mention, and even to-dos hidden in your conversations.',
    color: 'from-sky-400 to-sky-500',
    iconBg: 'bg-sky-50',
    borderColor: 'group-hover:border-sky-200',
  },
  {
    icon: Sparkles,
    title: 'Personal Growth',
    description:
      "Watch patterns emerge over weeks and months. Understand what makes you happy, what stresses you, and how you've grown.",
    color: 'from-emerald-400 to-emerald-500',
    iconBg: 'bg-emerald-50',
    borderColor: 'group-hover:border-emerald-200',
  },
]

function FeatureCard({
  feature,
  index,
}: {
  feature: (typeof features)[0]
  index: number
}) {
  const Icon = feature.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      whileHover={{ y: -6 }}
      className="group relative"
    >
      <div
        className={cn(
          'relative h-full rounded-2xl border border-slate-100 bg-white p-8 shadow-sm transition-all duration-300 hover:shadow-xl hover:shadow-slate-200/50',
          feature.borderColor,
        )}
      >
        {/* Icon */}
        <motion.div
          whileHover={{ rotate: 5, scale: 1.05 }}
          transition={{ duration: 0.2 }}
          className={cn(
            'mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl transition-colors duration-300',
            feature.iconBg,
            'group-hover:bg-opacity-80',
          )}
        >
          <Icon
            className={cn(
              'h-7 w-7 bg-gradient-to-br bg-clip-text',
              feature.color.replace('from-', 'text-').split(' ')[0],
            )}
          />
        </motion.div>

        {/* Content */}
        <h3 className="mb-3 text-xl font-semibold text-slate-900">
          {feature.title}
        </h3>
        <p className="text-slate-600 leading-relaxed">{feature.description}</p>

        {/* Hover gradient line */}
        <div
          className={cn(
            'absolute bottom-0 left-8 right-8 h-1 rounded-t-full bg-gradient-to-r opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:bottom-0',
            feature.color,
          )}
        />
      </div>
    </motion.div>
  )
}

export function FeaturesSection() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, amount: 0.2 })

  return (
    <section id="features" className="py-24 lg:py-32 bg-slate-50/50" ref={ref}>
      <div className="container mx-auto px-4 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16 lg:mb-20"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6 tracking-tight">
            Everything you need to reflect,{' '}
            <span className="bg-gradient-to-r from-[#7e9ec9] to-[#5a7ba6] bg-clip-text text-transparent">
              remember, and grow
            </span>
          </h2>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Powerful features designed to help you understand yourself better
            through daily voice journaling and AI-powered insights.
          </p>
        </motion.div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <FeatureCard key={feature.title} feature={feature} index={index} />
          ))}
        </div>
      </div>
    </section>
  )
}
