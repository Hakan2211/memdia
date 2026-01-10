'use client'

import { motion } from 'framer-motion'
import { useAudio } from '@/contexts/AudioContext'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface AudioToggleProps {
  variant?: 'light' | 'dark'
  className?: string
}

export function AudioToggle({
  variant = 'light',
  className,
}: AudioToggleProps) {
  const { isPlaying, isLoaded, toggle } = useAudio()

  const getBarColor = () => {
    if (variant === 'light') {
      return isPlaying ? 'bg-white' : 'bg-white/60 group-hover:bg-white/90'
    } else {
      return isPlaying
        ? 'bg-[#5a7ba6]'
        : 'bg-slate-400 group-hover:bg-slate-600'
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.button
          onClick={toggle}
          disabled={!isLoaded}
          className={cn(
            'group flex items-center justify-center gap-[3px] h-9 w-9 rounded-full cursor-pointer transition-colors',
            variant === 'light' ? 'hover:bg-white/10' : 'hover:bg-black/5',
            !isLoaded && 'opacity-50 cursor-not-allowed',
            className,
          )}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          aria-label={
            isPlaying ? 'Pause background music' : 'Play background music'
          }
        >
          {[0, 1, 2, 3].map((i) => (
            <motion.span
              key={i}
              className={cn(
                'w-[3px] rounded-full transition-colors duration-300',
                getBarColor(),
              )}
              initial={{ height: 4 }}
              animate={
                isPlaying
                  ? {
                      height: [8, 16 + (i % 2) * 8, 8, 12 + (i % 3) * 4, 8],
                    }
                  : {
                      height: [4, 6 + (i % 2) * 2, 4],
                    }
              }
              transition={
                isPlaying
                  ? {
                      duration: 0.8,
                      repeat: Infinity,
                      ease: 'easeInOut',
                      delay: i * 0.1,
                      repeatType: 'reverse',
                    }
                  : {
                      duration: 1.5,
                      repeat: Infinity,
                      ease: 'easeInOut',
                      delay: i * 0.2,
                      repeatType: 'reverse',
                    }
              }
            />
          ))}
        </motion.button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{isPlaying ? 'Pause Music' : 'Play Music'}</p>
      </TooltipContent>
    </Tooltip>
  )
}
