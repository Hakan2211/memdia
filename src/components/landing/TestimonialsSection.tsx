'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, Quote } from 'lucide-react'
import { cn } from '@/lib/utils'

const testimonials = [
  {
    quote:
      "Memdia has become my daily ritual. It's like having a thoughtful friend who really listens and helps me make sense of my days.",
    author: 'Sarah M.',
    role: 'Product Designer',
    duration: 'Using for 3 months',
    avatar: 'SM',
  },
  {
    quote:
      'The insights dashboard is incredible. I can actually see patterns in my mood and understand what affects my wellbeing.',
    author: 'James L.',
    role: 'Software Engineer',
    duration: 'Using for 6 months',
    avatar: 'JL',
  },
  {
    quote:
      "I've tried journaling apps before, but speaking feels so much more natural. The AI-generated images are a beautiful touch.",
    author: 'Maria K.',
    role: 'Therapist',
    duration: 'Using for 4 months',
    avatar: 'MK',
  },
  {
    quote:
      'Being able to use it in Spanish means I can express myself naturally. The reflection sessions have helped me process a lot.',
    author: 'Carlos R.',
    role: 'Marketing Manager',
    duration: 'Using for 2 months',
    avatar: 'CR',
  },
  {
    quote:
      'The 3-minute format is perfect for my busy schedule. Quick enough to do daily, meaningful enough to make a difference.',
    author: 'Emily W.',
    role: 'Startup Founder',
    duration: 'Using for 5 months',
    avatar: 'EW',
  },
]

export function TestimonialsSection() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [direction, setDirection] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startAutoPlay = () => {
    intervalRef.current = setInterval(() => {
      setDirection(1)
      setCurrentIndex((prev) => (prev + 1) % testimonials.length)
    }, 6000)
  }

  const stopAutoPlay = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
  }

  useEffect(() => {
    startAutoPlay()
    return () => stopAutoPlay()
  }, [])

  const goToPrev = () => {
    stopAutoPlay()
    setDirection(-1)
    setCurrentIndex(
      (prev) => (prev - 1 + testimonials.length) % testimonials.length,
    )
    startAutoPlay()
  }

  const goToNext = () => {
    stopAutoPlay()
    setDirection(1)
    setCurrentIndex((prev) => (prev + 1) % testimonials.length)
    startAutoPlay()
  }

  const goToIndex = (index: number) => {
    stopAutoPlay()
    setDirection(index > currentIndex ? 1 : -1)
    setCurrentIndex(index)
    startAutoPlay()
  }

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 100 : -100,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 100 : -100,
      opacity: 0,
    }),
  }

  return (
    <section className="py-20 lg:py-28 bg-white overflow-hidden">
      <div className="container mx-auto px-4 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            What our{' '}
            <span className="bg-gradient-to-r from-[#7e9ec9] to-[#5a7ba6] bg-clip-text text-transparent">
              users
            </span>{' '}
            are saying
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Join thousands of people who are building a deeper understanding of
            themselves.
          </p>
        </motion.div>

        {/* Testimonial Carousel */}
        <div className="relative max-w-3xl mx-auto">
          {/* Navigation Arrows */}
          <button
            onClick={goToPrev}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 lg:-translate-x-16 z-10 p-2 rounded-full bg-white border border-slate-200 shadow-md hover:shadow-lg transition-shadow"
            aria-label="Previous testimonial"
          >
            <ChevronLeft className="h-5 w-5 text-slate-600" />
          </button>
          <button
            onClick={goToNext}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 lg:translate-x-16 z-10 p-2 rounded-full bg-white border border-slate-200 shadow-md hover:shadow-lg transition-shadow"
            aria-label="Next testimonial"
          >
            <ChevronRight className="h-5 w-5 text-slate-600" />
          </button>

          {/* Testimonial Card */}
          <div className="relative min-h-[280px] flex items-center justify-center">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={currentIndex}
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.4, ease: 'easeInOut' }}
                className="w-full"
              >
                <div className="relative rounded-2xl border border-slate-200 bg-white p-8 lg:p-10 shadow-lg">
                  {/* Quote Icon */}
                  <Quote className="absolute top-6 left-6 h-8 w-8 text-[#7e9ec9]/20" />

                  {/* Quote Text */}
                  <p className="text-lg lg:text-xl text-slate-700 leading-relaxed mb-8 pt-4">
                    "{testimonials[currentIndex].quote}"
                  </p>

                  {/* Author */}
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-gradient-to-br from-[#7e9ec9] to-[#5a7ba6] flex items-center justify-center text-white font-semibold">
                      {testimonials[currentIndex].avatar}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900">
                        {testimonials[currentIndex].author}
                      </div>
                      <div className="text-sm text-slate-500">
                        {testimonials[currentIndex].role} &middot;{' '}
                        {testimonials[currentIndex].duration}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Dots */}
          <div className="flex justify-center gap-2 mt-8">
            {testimonials.map((_, index) => (
              <button
                key={index}
                onClick={() => goToIndex(index)}
                className={cn(
                  'w-2.5 h-2.5 rounded-full transition-all duration-300',
                  index === currentIndex
                    ? 'bg-[#7e9ec9] w-8'
                    : 'bg-slate-300 hover:bg-slate-400',
                )}
                aria-label={`Go to testimonial ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
