import { Link } from '@tanstack/react-router'
import { motion, useScroll, useTransform } from 'framer-motion'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AudioToggle } from '@/components/audio/AudioToggle'
import { cn } from '@/lib/utils'

export function LandingHeader() {
  const { scrollY } = useScroll()
  const [isScrolled, setIsScrolled] = useState(false)

  // Transform values based on scroll
  const headerWidth = useTransform(scrollY, [0, 100], ['100%', '80%'])
  const headerTop = useTransform(scrollY, [0, 100], [0, 20])
  const headerBorderRadius = useTransform(scrollY, [0, 100], [0, 24])

  useEffect(() => {
    const unsubscribe = scrollY.on('change', (latest) => {
      setIsScrolled(latest > 50)
    })
    return unsubscribe
  }, [scrollY])

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pointer-events-none">
      <motion.header
        style={{
          width: headerWidth,
          top: headerTop,
          borderRadius: headerBorderRadius,
        }}
        className={cn(
          'pointer-events-auto transition-all duration-300 ease-in-out',
          isScrolled
            ? 'bg-white/60 backdrop-blur-xl shadow-lg border border-white/40'
            : 'bg-transparent backdrop-blur-none border-b-0',
        )}
      >
        <div className="container mx-auto flex h-16 items-center justify-between px-4 lg:px-8">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group cursor-pointer">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#7e9ec9] to-[#5a7ba6] shadow-md transition-transform group-hover:scale-105" />
            <span className="text-xl font-bold bg-gradient-to-r from-[#5a7ba6] to-[#7e9ec9] bg-clip-text text-transparent">
              Memdia
            </span>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            {['features', 'how-it-works', 'pricing', 'faq'].map((section) => (
              <button
                key={section}
                onClick={() => scrollToSection(section)}
                className={cn(
                  'text-sm font-medium transition-colors cursor-pointer relative group capitalize',
                  isScrolled
                    ? 'text-slate-600 hover:text-[#5a7ba6]'
                    : 'text-slate-200 hover:text-white',
                )}
              >
                {section.replace(/-/g, ' ')}
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-[#5a7ba6] transition-all duration-300 group-hover:w-full" />
              </button>
            ))}
          </nav>

          {/* Audio Toggle & Auth Buttons */}
          <div className="flex items-center gap-3">
            <AudioToggle variant={isScrolled ? 'dark' : 'light'} />
            <Link to="/login">
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'hover:text-[#5a7ba6] hover:bg-[#7e9ec9]/10 cursor-pointer',
                  isScrolled
                    ? 'text-slate-600'
                    : 'text-slate-200 hover:text-white',
                )}
              >
                Sign in
              </Button>
            </Link>
            <Link to="/signup">
              <Button
                size="sm"
                className="bg-gradient-to-r from-[#7e9ec9] to-[#5a7ba6] hover:from-[#6b8bb6] hover:to-[#4a6b96] text-white shadow-md hover:shadow-lg transition-all hover:scale-105 cursor-pointer"
              >
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </motion.header>
    </div>
  )
}
