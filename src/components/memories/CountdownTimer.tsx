/**
 * CountdownTimer Component
 * Shows remaining time in the session with a circular progress indicator
 */

import { cn } from '../../lib/utils'

interface CountdownTimerProps {
  /** Remaining seconds */
  remainingSeconds: number
  /** Maximum seconds (for progress calculation) */
  maxSeconds: number
  /** Size variant */
  size?: 'sm' | 'md' | 'lg'
}

export function CountdownTimer({
  remainingSeconds,
  maxSeconds,
  size = 'md',
}: CountdownTimerProps) {
  const minutes = Math.floor(remainingSeconds / 60)
  const seconds = remainingSeconds % 60
  const progress = (remainingSeconds / maxSeconds) * 100
  const isLow = remainingSeconds <= 30

  const sizeClasses = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl',
  }

  // Calculate stroke dasharray for circular progress
  const radius = 45
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (progress / 100) * circumference

  return (
    <div className="relative flex items-center justify-center">
      {/* Circular progress background */}
      <svg
        className="absolute -rotate-90"
        width="120"
        height="120"
        viewBox="0 0 100 100"
      >
        {/* Background circle */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-slate-200"
        />
        {/* Progress circle */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className={cn(
            'transition-all duration-1000',
            isLow ? 'text-red-500' : 'text-[#7e9ec9]',
          )}
        />
      </svg>

      {/* Time display */}
      <div
        className={cn(
          'font-sans font-light tracking-widest text-[#7e9ec9]',
          sizeClasses[size],
          isLow && 'text-red-500 animate-pulse',
        )}
      >
        {minutes}:{String(seconds).padStart(2, '0')}
      </div>
    </div>
  )
}

/**
 * Simple linear timer for header/status bar use
 */
export function LinearTimer({
  remainingSeconds,
  maxSeconds,
}: {
  remainingSeconds: number
  maxSeconds: number
}) {
  const minutes = Math.floor(remainingSeconds / 60)
  const seconds = remainingSeconds % 60
  const progress = (remainingSeconds / maxSeconds) * 100
  const isLow = remainingSeconds <= 30

  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          'text-sm font-mono tabular-nums',
          isLow && 'text-red-500',
        )}
      >
        {minutes}:{String(seconds).padStart(2, '0')}
      </span>
      <div className="w-20 h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-1000',
            isLow ? 'bg-red-500' : 'bg-slate-600',
          )}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}
