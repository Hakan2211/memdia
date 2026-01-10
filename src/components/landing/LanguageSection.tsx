'use client'

import { motion, useMotionValue, useAnimationFrame } from 'framer-motion'
import { useState } from 'react'
import 'flag-icons/css/flag-icons.min.css'

// Map language codes to flag-icons country codes
const LANGUAGE_TO_FLAG: Record<string, string> = {
  // Multilingual
  en: 'gb',
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
  ca: 'es-ct',
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

const LANGUAGES = Object.entries(LANGUAGE_TO_FLAG).map(([code, flag]) => ({
  code,
  flag,
}))

export function LanguageSection() {
  return (
    <section className="py-16 bg-slate-50 border-t border-slate-100 overflow-hidden">
      <div className="container mx-auto px-4 mb-10 text-center">
        <p className="text-sm font-semibold text-[#7e9ec9] uppercase tracking-wider mb-2">
          Global Support
        </p>
        <h3 className="text-2xl font-bold text-slate-900">
          Available in {LANGUAGES.length}+ languages
        </h3>
      </div>

      <div className="relative w-full overflow-hidden py-8">
        {/* Gradients */}
        <div className="absolute left-0 top-0 bottom-0 w-20 bg-linear-to-r from-slate-50 to-transparent z-20 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-20 bg-linear-to-l from-slate-50 to-transparent z-20 pointer-events-none" />

        <CurvedMarquee items={LANGUAGES} />
      </div>
    </section>
  )
}

function CurvedMarquee({ items }: { items: { code: string; flag: string }[] }) {
  // Triple the items for infinite loop
  const repeatedItems = [...items, ...items, ...items]

  // We'll use a container ref to measure width if needed, but for now we'll estimate
  // or use a very large scrollable area.
  // Actually, for a seamless loop with drag, we need to wrap the x position.

  const baseX = useMotionValue(0)
  const [isDragging, setIsDragging] = useState(false)

  // Speed of the marquee
  const baseVelocity = -0.5

  // Calculate width of one set of items
  // item width (64px) + gap (32px) = 96px approx?
  // Let's use a fixed width approach for smoother calculation or measure it.
  // Tailwind gap-8 is 2rem = 32px.
  // Flag container w-16 = 4rem = 64px.
  // Total per item = 96px.
  const ITEM_WIDTH = 96
  const TOTAL_WIDTH = items.length * ITEM_WIDTH

  useAnimationFrame((t, delta) => {
    if (!isDragging) {
      let moveBy = baseVelocity * (delta / 16) // Normalize to roughly 60fps

      // Update x
      let currentX = baseX.get() + moveBy

      // Wrap around
      // If we moved past the first set (TOTAL_WIDTH), reset by adding TOTAL_WIDTH
      // We are moving left (negative), so when currentX <= -TOTAL_WIDTH, we reset
      if (currentX <= -TOTAL_WIDTH) {
        currentX += TOTAL_WIDTH
      }
      // If we drag right (positive) and go > 0, we wrap to -TOTAL_WIDTH
      if (currentX > 0) {
        currentX -= TOTAL_WIDTH
      }

      baseX.set(currentX)
    }
  })

  return (
    <motion.div
      className="flex gap-8 items-center pl-4 cursor-grab active:cursor-grabbing w-fit"
      style={{ x: baseX }}
      drag="x"
      dragConstraints={{ left: -TOTAL_WIDTH * 2, right: 0 }} // Loose constraints
      onDragStart={() => setIsDragging(true)}
      onDragEnd={() => {
        setIsDragging(false)
        // Add momentum or just resume?
        // We'll just resume for now.
      }}
      onDrag={() => {
        // While dragging, we update the wrap logic manually if needed?
        // Actually, framer motion handles the drag update on the value.
        // We just need to check wrap logic inside the render or effect?
        // The useAnimationFrame stops updating when isDragging is true.
        // But the user might drag it far.
        // We can check wrap here too.
        const currentX = baseX.get()
        if (currentX <= -TOTAL_WIDTH) {
          baseX.set(currentX + TOTAL_WIDTH)
        }
        if (currentX > 0) {
          baseX.set(currentX - TOTAL_WIDTH)
        }
      }}
    >
      {repeatedItems.map((lang, index) => (
        <FlagItem key={`${lang.code}-${index}`} lang={lang} index={index} />
      ))}
    </motion.div>
  )
}

function FlagItem({
  lang,
  index,
}: {
  lang: { code: string; flag: string }
  index: number
}) {
  // Create a wave effect
  // We use time to animate y
  const y = useMotionValue(0)

  useAnimationFrame((t) => {
    // t is milliseconds
    // Create a wave: sin(time + offset)
    const timeInSeconds = t / 1000
    const offset = index * 0.5 // Phase shift per item
    const waveHeight = 10 // pixels

    // Calculate Y
    const newY = Math.sin(timeInSeconds * 2 + offset) * waveHeight
    y.set(newY)
  })

  return (
    <motion.div
      style={{ y }}
      className="shrink-0 flex flex-col items-center gap-3 select-none group w-16"
    >
      <div className="w-16 h-12 relative rounded-lg overflow-hidden shadow-sm border border-slate-200 bg-white flex items-center justify-center transform transition-transform group-hover:scale-110 group-hover:shadow-md z-10">
        <span className={`fi fi-${lang.flag} text-4xl`} />
      </div>
      <span className="text-xs font-medium text-slate-500 uppercase tracking-wide opacity-0 group-hover:opacity-100 transition-opacity absolute -bottom-6">
        {lang.code}
      </span>
    </motion.div>
  )
}
