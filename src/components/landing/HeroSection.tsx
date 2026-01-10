import { Link } from '@tanstack/react-router'
import { motion } from 'framer-motion'
import { Globe, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { HeroCanvas } from './HeroCanvas'
import { AudioVisualization } from './AudioVisualization'

export function HeroSection() {
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <section className="relative overflow-hidden bg-linear-to-br from-blue-100/40 to-blue-50/40 py-24 lg:py-40">
      {/* Background WebGL canvas */}
      <HeroCanvas />

      <div className="container mx-auto px-4 lg:px-8 relative z-10">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
          {/* Left content */}
          <div className="flex-1 text-center lg:text-left">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight text-white mb-8 leading-[1.1] drop-shadow-sm">
                Your Voice,{' '}
                <span className="bg-linear-to-r from-[#8baedb] via-[#7e9ec9] to-[#5a7ba6] bg-clip-text text-transparent drop-shadow-none">
                  Your Story
                </span>
              </h1>
            </motion.div>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-lg md:text-xl text-slate-200 mb-10 max-w-xl mx-auto lg:mx-0 leading-relaxed font-light"
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
                <div className="absolute -inset-1 bg-linear-to-r from-[#7e9ec9] to-[#5a7ba6] rounded-xl blur opacity-40 group-hover:opacity-75 transition duration-500 group-hover:duration-200 animate-tilt"></div>
                <Button
                  size="lg"
                  className="relative w-full sm:w-auto h-14 px-8 text-lg font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-2xl transition-all duration-300 border border-slate-700"
                >
                  Start Journey
                </Button>
              </Link>
              <Button
                variant="outline"
                size="lg"
                onClick={() => scrollToSection('how-it-works')}
                className="w-full sm:w-auto h-14 px-8 text-lg border border-blue-200/20 text-slate-200 hover:bg-white/10 hover:text-white hover:border-blue-300/40 rounded-xl transition-all duration-300 bg-white/5 backdrop-blur-md shadow-lg"
              >
                See How It Works
              </Button>
            </motion.div>

            {/* Premium Specs Row */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-wrap items-center justify-center lg:justify-start gap-8 border-t border-slate-200/20 pt-8"
            >
              <div className="flex items-center gap-3 group">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-200 group-hover:text-blue-100 transition-colors">
                  <Globe className="w-5 h-5" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-sm font-semibold text-slate-200">
                    30+ Languages
                  </span>
                </div>
              </div>

              <div className="w-px h-10 bg-slate-200/20 hidden sm:block" />

              <div className="flex items-center gap-3 group">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-200 group-hover:text-blue-100 transition-colors">
                  <Shield className="w-5 h-5" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-sm font-semibold text-slate-200">
                    Private & Secure
                  </span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Right - Audio Visualization container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="flex-1 flex items-center justify-center w-full max-w-lg lg:max-w-none relative"
          >
            <div className="absolute inset-0 bg-linear-to-tr from-[#7e9ec9]/10 to-[#5a7ba6]/10 rounded-full blur-[100px]" />
            <div className="relative w-full aspect-square max-w-[500px] flex items-center justify-center backdrop-blur-3xl rounded-full bg-white/5 border border-white/10 shadow-2xl overflow-hidden">
              <AudioVisualization />
            </div>
          </motion.div>
        </div>
      </div>

      {/* Curved Divider */}
      <div className="absolute bottom-0 left-0 w-full overflow-hidden leading-0 z-20">
        <svg
          className="relative block w-[calc(100%+1.3px)] h-[60px] md:h-[60px] rotate-180"
          data-name="Layer 1"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 1200 120"
          preserveAspectRatio="none"
        >
          <path
            d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z"
            className="fill-slate-50"
          />
        </svg>
      </div>
    </section>
  )
}
