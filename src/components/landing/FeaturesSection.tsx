'use client'

import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { BarChart3, Brain, Heart, Image, Mic, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

const features = [
  {
    icon: Mic,
    title: '3-Minute Daily Sessions',
    description:
      "Capture your day in your own words. Share what happened, how you felt, and what's on your mind in just three minutes.",
    color: 'from-[#7e9ec9] to-[#5a7ba6]',
    iconBg: 'bg-[#7e9ec9]/10',
    borderColor: 'group-hover:border-[#7e9ec9]/40',
    shadowColor: 'group-hover:shadow-[#7e9ec9]/20',
  },
  {
    icon: Heart,
    title: '10-Minute Reflections',
    description:
      'Dive deeper with therapeutic conversations. Our AI asks thoughtful questions to help you process emotions and gain clarity.',
    color: 'from-rose-400 to-rose-500',
    iconBg: 'bg-rose-50',
    borderColor: 'group-hover:border-rose-200',
    shadowColor: 'group-hover:shadow-rose-500/10',
  },
  {
    icon: BarChart3,
    title: 'Insights Dashboard',
    description:
      'Track your emotional journey. See moods over time, frequently mentioned topics, important people, and actionable insights.',
    color: 'from-teal-400 to-teal-500',
    iconBg: 'bg-teal-50',
    borderColor: 'group-hover:border-teal-200',
    shadowColor: 'group-hover:shadow-teal-500/10',
  },
  {
    icon: Image,
    title: 'AI-Generated Memories',
    description:
      'Each voice session creates a unique, personalized image that captures the essence of your day as a visual memory.',
    color: 'from-amber-400 to-amber-500',
    iconBg: 'bg-amber-50',
    borderColor: 'group-hover:border-amber-200',
    shadowColor: 'group-hover:shadow-amber-500/10',
  },
  {
    icon: Brain,
    title: 'Smart Extraction',
    description:
      'Our AI automatically identifies moods, topics, people you mention, and even to-dos hidden in your conversations.',
    color: 'from-sky-400 to-sky-500',
    iconBg: 'bg-sky-50',
    borderColor: 'group-hover:border-sky-200',
    shadowColor: 'group-hover:shadow-sky-500/10',
  },
  {
    icon: Sparkles,
    title: 'Personal Growth',
    description:
      "Watch patterns emerge over weeks and months. Understand what makes you happy, what stresses you, and how you've grown.",
    color: 'from-emerald-400 to-emerald-500',
    iconBg: 'bg-emerald-50',
    borderColor: 'group-hover:border-emerald-200',
    shadowColor: 'group-hover:shadow-emerald-500/10',
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
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      whileHover={{ y: -8 }}
      className="group relative h-full"
    >
      <div
        className={cn(
          'relative h-full rounded-3xl border border-slate-200 bg-white p-8 lg:p-10 shadow-lg transition-all duration-300',
          feature.borderColor,
          feature.shadowColor,
          'hover:shadow-2xl',
        )}
      >
        {/* Background Gradient Blob on Hover */}
        <div
          className={cn(
            'absolute -top-10 -right-10 h-32 w-32 rounded-full bg-linear-to-br opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-20',
            feature.color,
          )}
        />

        {/* Icon */}
        <motion.div
          whileHover={{ rotate: 5, scale: 1.05 }}
          transition={{ duration: 0.2 }}
          className={cn(
            'mb-8 inline-flex h-16 w-16 items-center justify-center rounded-2xl transition-colors duration-300 shadow-sm',
            feature.iconBg,
            'group-hover:bg-opacity-100',
          )}
        >
          <Icon
            className={cn(
              'h-8 w-8',
              feature.color.replace('from-', 'text-').split(' ')[0],
            )}
          />
        </motion.div>

        {/* Content */}
        <h3 className="mb-4 text-2xl font-bold text-slate-900 tracking-tight">
          {feature.title}
        </h3>
        <p className="text-slate-600 leading-relaxed text-lg font-medium opacity-90">
          {feature.description}
        </p>

        {/* Bottom colored line */}
        <div
          className={cn(
            'absolute bottom-0 left-10 right-10 h-1.5 rounded-t-full bg-linear-to-r opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:bottom-0',
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
    <section
      id="features"
      className="relative py-24 lg:py-32 bg-slate-50 overflow-hidden"
      ref={ref}
    >
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[10%] -left-[10%] w-[40%] h-[40%] bg-blue-100/40 rounded-full blur-[120px]" />
        <div className="absolute top-[20%] right-[0%] w-[30%] h-[30%] bg-rose-100/40 rounded-full blur-[100px]" />
        <div className="absolute bottom-[5%] left-[5%] w-[30%] h-[30%] bg-yellow-100/40 rounded-full blur-[100px]" />
        <div className="absolute bottom-[5%] right-[5%] w-[30%] h-[30%] bg-teal-100/40 rounded-full blur-[100px]" />
      </div>

      <div className="container mx-auto px-4 lg:px-8 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16 lg:mb-24"
        >
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 mb-6 tracking-tight">
            Everything you need to reflect,{' '}
            <span className="relative">
              <span className="relative z-10 bg-linear-to-r from-[#7e9ec9] to-[#5a7ba6] bg-clip-text text-transparent">
                remember, and grow
              </span>
              <span className="absolute bottom-2 left-0 w-full h-3 bg-[#7e9ec9]/20 -rotate-1 rounded-full z-0"></span>
            </span>
          </h2>
          <p className="text-xl md:text-2xl text-slate-600 max-w-3xl mx-auto leading-relaxed font-light">
            Powerful features designed to help you understand yourself better
            through daily voice journaling and AI-powered insights.
          </p>
        </motion.div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-10">
          {features.map((feature, index) => (
            <FeatureCard key={feature.title} feature={feature} index={index} />
          ))}
        </div>
      </div>
    </section>
  )
}
