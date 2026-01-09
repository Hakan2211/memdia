import React from 'react'
import { cn } from '@/lib/utils'

interface MagicButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
  gradientColors?: [string, string, string]
}

export function MagicButton({
  children,
  className,
  gradientColors = ['#A07CFE', '#FE8FB5', '#FFBE7B'],
  ...props
}: MagicButtonProps) {
  return (
    <button
      className={cn(
        'relative inline-flex h-14 overflow-hidden rounded-full p-[1px] focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-slate-50 transition-transform active:scale-95 shadow-lg hover:shadow-xl',
        className,
      )}
      {...props}
    >
      <span
        className="absolute inset-[-1000%] animate-[spin_3s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,var(--color-1)_0%,var(--color-2)_50%,var(--color-3)_100%)]"
        style={
          {
            '--color-1': gradientColors[0],
            '--color-2': gradientColors[1],
            '--color-3': gradientColors[2],
          } as React.CSSProperties
        }
      />
      <span className="inline-flex h-full w-full cursor-pointer items-center justify-center rounded-full bg-white dark:bg-slate-950 px-8 py-1 text-base font-medium text-slate-900 dark:text-white backdrop-blur-3xl transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/90">
        {children}
      </span>
    </button>
  )
}
