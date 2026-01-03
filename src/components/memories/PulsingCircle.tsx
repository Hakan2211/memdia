/**
 * PulsingCircle Component
 * Main visual indicator for the voice session
 * Pulses when user or AI is speaking
 */

import { cn } from '../../lib/utils'

interface PulsingCircleProps {
  /** Whether the session is active */
  isActive: boolean
  /** Current speaker */
  speaker: 'user' | 'ai' | null
  /** Whether the microphone is muted */
  isMuted?: boolean
  /** Size of the circle */
  size?: 'sm' | 'md' | 'lg'
}

export function PulsingCircle({
  isActive,
  speaker,
  isMuted = false,
  size = 'lg',
}: PulsingCircleProps) {
  const sizeClasses = {
    sm: 'h-24 w-24',
    md: 'h-40 w-40',
    lg: 'h-56 w-56',
  }

  const innerSizeClasses = {
    sm: 'h-16 w-16',
    md: 'h-28 w-28',
    lg: 'h-40 w-40',
  }

  const isUserSpeaking = speaker === 'user' && !isMuted
  const isAISpeaking = speaker === 'ai'

  return (
    <div
      className={cn(
        'relative flex items-center justify-center',
        sizeClasses[size],
      )}
    >
      {/* Outer pulse rings */}
      {isActive && (isUserSpeaking || isAISpeaking) && (
        <>
          <div
            className={cn(
              'absolute inset-0 rounded-full animate-ping opacity-20',
              isUserSpeaking && 'bg-teal-500',
              isAISpeaking && 'bg-slate-500',
            )}
            style={{ animationDuration: '1.5s' }}
          />
          <div
            className={cn(
              'absolute inset-2 rounded-full animate-ping opacity-30',
              isUserSpeaking && 'bg-teal-500',
              isAISpeaking && 'bg-slate-500',
            )}
            style={{ animationDuration: '1.5s', animationDelay: '0.2s' }}
          />
        </>
      )}

      {/* Middle ring - subtle pulse when active but not speaking */}
      <div
        className={cn(
          'absolute inset-4 rounded-full transition-all duration-500',
          isActive && !speaker && 'animate-pulse bg-slate-200',
          isActive && isUserSpeaking && 'bg-teal-100',
          isActive && isAISpeaking && 'bg-slate-100',
          !isActive && 'bg-slate-100',
        )}
      />

      {/* Inner circle */}
      <div
        className={cn(
          'relative rounded-full transition-all duration-300 flex items-center justify-center',
          innerSizeClasses[size],
          !isActive && 'bg-slate-200 hover:bg-slate-300',
          isActive && !speaker && 'bg-slate-300',
          isActive &&
            isUserSpeaking &&
            'bg-teal-500 shadow-lg shadow-teal-500/30',
          isActive &&
            isAISpeaking &&
            'bg-slate-600 shadow-lg shadow-slate-500/30',
          isMuted && isActive && 'bg-red-400',
        )}
      >
        {/* Inner glow when speaking */}
        {isActive && (isUserSpeaking || isAISpeaking) && (
          <div
            className={cn(
              'absolute inset-0 rounded-full',
              isUserSpeaking && 'bg-gradient-to-br from-teal-400 to-teal-600',
              isAISpeaking && 'bg-gradient-to-br from-slate-500 to-slate-700',
            )}
          />
        )}

        {/* Status icon or indicator */}
        <div className="relative z-10">
          {!isActive && (
            <svg
              className="h-12 w-12 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
              />
            </svg>
          )}
          {isActive && isMuted && (
            <svg
              className="h-10 w-10 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
              />
            </svg>
          )}
          {isActive && !isMuted && isUserSpeaking && (
            <div className="flex items-center gap-1">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="w-1 bg-white rounded-full animate-bounce"
                  style={{
                    height: `${12 + Math.random() * 16}px`,
                    animationDelay: `${i * 0.1}s`,
                    animationDuration: '0.5s',
                  }}
                />
              ))}
            </div>
          )}
          {isActive && !isMuted && isAISpeaking && (
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="w-0.5 bg-white rounded-full animate-pulse"
                  style={{
                    height: `${8 + Math.random() * 20}px`,
                    animationDelay: `${i * 0.15}s`,
                  }}
                />
              ))}
            </div>
          )}
          {isActive && !isMuted && !speaker && (
            <div className="h-4 w-4 rounded-full bg-slate-500 animate-pulse" />
          )}
        </div>
      </div>
    </div>
  )
}
