import { Link } from '@tanstack/react-router'
import { motion } from 'framer-motion'
import { Globe, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AudioVisualization } from './AudioVisualization'
import { PrismBackground } from './PrismBackground'

export function HeroSection() {
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <section className="relative overflow-hidden bg-transparent py-24 lg:py-40">
      {/* Background decoration */}
      <PrismBackground />

      <div className="container mx-auto px-4 lg:px-8 relative z-10">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
          {/* Left content */}
          <div className="flex-1 text-center lg:text-left">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight text-slate-900 mb-8 leading-[1.1]">
                Your Voice,{' '}
                <span className="bg-gradient-to-r from-[#7e9ec9] via-[#6b8bb6] to-[#5a7ba6] bg-clip-text text-transparent">
                  Your Story
                </span>
              </h1>
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-lg md:text-xl text-slate-600 mb-10 max-w-xl mx-auto lg:mx-0 leading-relaxed font-light"
            >
              An AI companion that listens, remembers, and helps you grow
              through daily reflection. Capture your moments, gain insights, and
              build a deeper understanding of yourself.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="flex flex-col sm:flex-row gap-6 justify-center lg:justify-start mb-16"
            >
              <Link to="/signup" className="group relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-[#7e9ec9] to-[#5a7ba6] rounded-xl blur opacity-40 group-hover:opacity-75 transition duration-500 group-hover:duration-200 animate-tilt"></div>
                <Button
                  size="lg"
                  className="relative w-full sm:w-auto h-16 px-10 text-lg font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-2xl transition-all duration-300"
                >
                  Start Journey
                </Button>
              </Link>
              <Button
                variant="outline"
                size="lg"
                onClick={() => scrollToSection('how-it-works')}
                className="w-full sm:w-auto h-16 px-10 text-lg border-2 border-slate-200 text-slate-700 hover:bg-white hover:text-slate-900 hover:border-slate-300 rounded-xl transition-all duration-300 bg-white/50 backdrop-blur-sm"
              >
                See How It Works
              </Button>
            </motion.div>

            {/* Premium Specs Row */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-wrap items-center justify-center lg:justify-start gap-8 border-t border-slate-200/60 pt-8"
            >
              <div className="flex items-center gap-3 group">
                <div className="p-2 rounded-lg bg-blue-50/50 text-[#7e9ec9] group-hover:text-[#5a7ba6] transition-colors">
                  <Globe className="w-5 h-5" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-sm font-semibold text-slate-900">
                    30+ Languages
                  </span>
                  <span className="text-xs text-slate-500">Auto-detected</span>
                </div>
              </div>

              <div className="w-px h-10 bg-slate-200/60 hidden sm:block" />

              <div className="flex items-center gap-3 group">
                <div className="p-2 rounded-lg bg-blue-50/50 text-[#7e9ec9] group-hover:text-[#5a7ba6] transition-colors">
                  <Shield className="w-5 h-5" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-sm font-semibold text-slate-900">
                    Private & Secure
                  </span>
                  <span className="text-xs text-slate-500">
                    End-to-end Encrypted
                  </span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Right - Audio Visualization */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="flex-1 flex items-center justify-center w-full max-w-lg lg:max-w-none relative"
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-[#7e9ec9]/10 to-[#5a7ba6]/10 rounded-full blur-[100px]" />
            <div className="relative w-full aspect-square max-w-[500px] flex items-center justify-center backdrop-blur-3xl rounded-full bg-white/10 border border-white/20 shadow-2xl">
              <AudioVisualization />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
