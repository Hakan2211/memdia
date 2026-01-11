'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Quote } from 'lucide-react'
import { cn } from '@/lib/utils'

const testimonials = [
  {
    quote:
      "Memdia has become my daily ritual. It's like having a thoughtful friend who really listens and helps me make sense of my days.",
    author: 'Sarah M.',
    role: 'Product Designer',
    avatar: 'SM',
  },
  {
    quote:
      'The insights dashboard is incredible. I can actually see patterns in my mood and understand what affects my wellbeing.',
    author: 'James L.',
    role: 'Software Engineer',
    avatar: 'JL',
  },
  {
    quote:
      "I've tried journaling apps before, but speaking feels so much more natural. The AI-generated images are a beautiful touch.",
    author: 'Maria K.',
    role: 'Therapist',
    avatar: 'MK',
  },
  {
    quote:
      'Being able to use it in Spanish means I can express myself naturally. The reflection sessions have helped me process a lot.',
    author: 'Carlos R.',
    role: 'Marketing Manager',
    avatar: 'CR',
  },
  {
    quote:
      'The 3-minute format is perfect for my busy schedule. Quick enough to do daily, meaningful enough to make a difference.',
    author: 'Emily W.',
    role: 'Startup Founder',
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
            Join hundreds of people who are capturing their memories and
            reflecting by talking.
          </p>
        </motion.div>

        {/* Testimonial Carousel */}
        <div className="relative max-w-3xl mx-auto">
          {/* Navigation Arrows */}
          <button
            onClick={goToPrev}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 lg:-translate-x-20 z-10 p-3 rounded-full bg-white/80 backdrop-blur-sm border border-slate-200/50 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 text-slate-600 hover:text-[#7e9ec9]"
            aria-label="Previous testimonial"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            onClick={goToNext}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 lg:translate-x-20 z-10 p-3 rounded-full bg-white/80 backdrop-blur-sm border border-slate-200/50 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 text-slate-600 hover:text-[#7e9ec9]"
            aria-label="Next testimonial"
          >
            <ChevronRight className="h-6 w-6" />
          </button>

          {/* Testimonial Card */}
          <div className="relative min-h-[320px] flex items-center justify-center">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={currentIndex}
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.4, ease: 'easeOut' }}
                className="w-full"
              >
                <div className="relative rounded-3xl border border-white/50 bg-white/60 backdrop-blur-xl p-8 lg:p-12 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                  {/* Quote Icon */}
                  <div className="absolute -top-5 -left-2 rotate-12 bg-white rounded-full p-2 shadow-sm border border-slate-100">
                    <Quote className="h-8 w-8 text-[#7e9ec9] fill-[#7e9ec9]/10" />
                  </div>

                  {/* Quote Text */}
                  <div className="relative z-10">
                    <p className="text-xl lg:text-2xl font-medium text-slate-800 leading-relaxed mb-8 text-center italic">
                      "{testimonials[currentIndex].quote}"
                    </p>

                    {/* Author */}
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="h-14 w-14 rounded-full bg-gradient-to-br from-[#7e9ec9] to-[#5a7ba6] flex items-center justify-center text-white text-lg font-bold shadow-lg shadow-[#7e9ec9]/25 ring-4 ring-white">
                        {testimonials[currentIndex].avatar}
                      </div>
                      <div className="text-center">
                        <div className="font-bold text-slate-900 text-lg">
                          {testimonials[currentIndex].author}
                        </div>
                        <div className="text-sm font-medium text-[#7e9ec9]">
                          {testimonials[currentIndex].role}
                        </div>
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
