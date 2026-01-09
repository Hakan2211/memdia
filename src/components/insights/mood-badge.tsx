/**
 * Mood Badge Component
 * Displays mood with appropriate color based on valence
 */

import { cn } from '../../lib/utils'
import { Badge } from '../ui/badge'
import { getMoodValence } from '../../types/insights'
import type { Mood } from '../../types/insights'

// Mood colors organized by valence
const MOOD_COLORS: Record<Mood, string> = {
  // Positive moods - greens and blues
  joyful:
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  grateful: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  hopeful: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  excited:
    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  peaceful: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  content:
    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  proud:
    'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  loved: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  // Neutral moods - grays and muted colors
  calm: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  reflective:
    'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  curious: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  contemplative:
    'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
  uncertain: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  nostalgic:
    'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  // Negative moods - reds and oranges
  anxious:
    'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  frustrated: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  overwhelmed:
    'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  sad: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  worried:
    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  angry: 'bg-red-200 text-red-800 dark:bg-red-900/40 dark:text-red-400',
  lonely:
    'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  exhausted:
    'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-400',
}

// Mood emojis for visual appeal
const MOOD_EMOJIS: Record<Mood, string> = {
  joyful: '',
  grateful: '',
  hopeful: '',
  excited: '',
  peaceful: '',
  content: '',
  proud: '',
  loved: '',
  calm: '',
  reflective: '',
  curious: '',
  contemplative: '',
  uncertain: '',
  nostalgic: '',
  anxious: '',
  frustrated: '',
  overwhelmed: '',
  sad: '',
  worried: '',
  angry: '',
  lonely: '',
  exhausted: '',
}

interface MoodBadgeProps {
  mood: Mood
  showEmoji?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function MoodBadge({
  mood,
  showEmoji = true,
  size = 'md',
  className,
}: MoodBadgeProps) {
  const colorClasses = MOOD_COLORS[mood] || MOOD_COLORS.calm
  const emoji = MOOD_EMOJIS[mood]

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-0.5',
    lg: 'text-base px-3 py-1',
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        'border-0 font-medium capitalize',
        colorClasses,
        sizeClasses[size],
        className,
      )}
    >
      {showEmoji && emoji && <span className="mr-1">{emoji}</span>}
      {mood}
    </Badge>
  )
}

// Simple variant for lists/compact views
export function MoodDot({ mood }: { mood: Mood }) {
  const valence = getMoodValence(mood)

  const dotColors = {
    positive: 'bg-green-500',
    neutral: 'bg-blue-500',
    negative: 'bg-orange-500',
  }

  return (
    <span
      className={cn('inline-block h-2 w-2 rounded-full', dotColors[valence])}
      title={mood}
    />
  )
}
