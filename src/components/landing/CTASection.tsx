'use client'

import { Link } from '@tanstack/react-router'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'

export function CTASection() {
  return (
    <section className="py-20 lg:py-28 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#7e9ec9]/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#5a7ba6]/20 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 lg:px-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl mx-auto text-center"
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6">
            Ready to start your journey of{' '}
            <span className="bg-gradient-to-r from-[#7e9ec9] to-[#93c5fd] bg-clip-text text-transparent">
              self-reflection
            </span>
            ?
          </h2>
          <p className="text-lg text-slate-300 mb-10 max-w-xl mx-auto">
            Join thousands of people who are building a deeper understanding of
            themselves through daily voice journaling.
          </p>

          {/* CTA Button */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Link to="/signup">
              <button className="group relative inline-flex h-14 overflow-hidden rounded-full p-[2px] focus:outline-none focus:ring-2 focus:ring-[#7e9ec9] focus:ring-offset-2 focus:ring-offset-slate-900">
                {/* Spinning gradient border */}
                <span
                  className="absolute inset-[-1000%] animate-[spin_3s_linear_infinite]"
                  style={{
                    background:
                      'conic-gradient(from 90deg at 50% 50%, #7e9ec9 0%, #93c5fd 50%, #7e9ec9 100%)',
                  }}
                />
                {/* Button content */}
                <span className="inline-flex h-full w-full cursor-pointer items-center justify-center rounded-full bg-slate-900 px-10 py-1 text-base font-semibold text-white backdrop-blur-3xl transition-all group-hover:bg-slate-800 gap-2">
                  Start Free Today
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </button>
            </Link>
          </motion.div>

          {/* Sub-text */}
          <p className="mt-6 text-sm text-slate-400">
            No credit card required. Cancel anytime.
          </p>
        </motion.div>
      </div>
    </section>
  )
}
