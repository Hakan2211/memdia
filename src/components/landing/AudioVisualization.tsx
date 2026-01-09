'use client'

import { motion } from 'framer-motion'

export function AudioVisualization() {
  return (
    <div className="relative w-72 h-72 md:w-80 md:h-80 lg:w-96 lg:h-96">
      {/* Outer pulsing rings */}
      {[0, 1, 2, 3].map((i) => (
        <motion.div
          key={i}
          className="absolute inset-0 rounded-full border-2 border-[#7e9ec9]"
          initial={{ scale: 0.8, opacity: 0.4 }}
          animate={{
            scale: [0.8, 1.4, 0.8],
            opacity: [0.4, 0, 0.4],
          }}
          transition={{
            duration: 3.5,
            repeat: Infinity,
            delay: i * 0.6,
            ease: 'easeInOut',
          }}
        />
      ))}

      {/* Middle glow ring */}
      <motion.div
        className="absolute inset-8 rounded-full bg-gradient-to-br from-[#7e9ec9]/20 to-[#5a7ba6]/10"
        animate={{
          scale: [1, 1.1, 1],
          opacity: [0.5, 0.8, 0.5],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Inner gradient circle */}
      <motion.div
        className="absolute inset-16 md:inset-20 lg:inset-24 rounded-full bg-gradient-to-br from-[#7e9ec9] to-[#5a7ba6] shadow-2xl shadow-[#7e9ec9]/40"
        animate={{
          scale: [1, 1.08, 1],
        }}
        transition={{
          duration: 2.5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Innermost bright core */}
      <motion.div
        className="absolute inset-20 md:inset-24 lg:inset-28 rounded-full bg-gradient-to-br from-white/80 to-[#93c5fd]/60"
        animate={{
          opacity: [0.7, 1, 0.7],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Audio equalizer bars */}
      <div className="absolute inset-0 flex items-center justify-center gap-1.5 md:gap-2">
        {[...Array(7)].map((_, i) => (
          <motion.div
            key={i}
            className="w-1 md:w-1.5 bg-white rounded-full origin-center"
            initial={{ scaleY: 0.3 }}
            animate={{
              scaleY: [0.3, 1, 0.5, 0.8, 0.3],
            }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              delay: i * 0.08,
              ease: 'easeInOut',
            }}
            style={{
              height: 32 + Math.sin(i * 0.8) * 12,
            }}
          />
        ))}
      </div>

      {/* Floating particles */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={`particle-${i}`}
          className="absolute w-2 h-2 rounded-full bg-[#7e9ec9]/60"
          style={{
            left: `${20 + (i % 3) * 30}%`,
            top: `${15 + Math.floor(i / 3) * 50}%`,
          }}
          animate={{
            y: [0, -15, 0],
            x: [0, (i % 2 === 0 ? 1 : -1) * 8, 0],
            opacity: [0.4, 0.8, 0.4],
          }}
          transition={{
            duration: 3 + i * 0.3,
            repeat: Infinity,
            delay: i * 0.4,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  )
}
