/**
 * Insight Card Component
 * Displays insight quotes with category styling
 */

import {
  AlertTriangle,
  BookOpen,
  Heart,
  HelpCircle,
  Lightbulb,
  Sparkles,
  Star,
  Target,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { INSIGHT_CATEGORY_META } from '../../types/insights'
import type { InsightCategory } from '../../types/insights'

// Icon mapping
const CATEGORY_ICONS: Record<InsightCategory, React.ElementType> = {
  realization: Lightbulb,
  goal: Target,
  gratitude: Heart,
  concern: AlertTriangle,
  question: HelpCircle,
  learning: BookOpen,
  idea: Sparkles,
  inspiration: Star,
}

// Color classes for each category
const CATEGORY_COLORS: Record<InsightCategory, string> = {
  realization: 'border-amber-500 bg-amber-50 dark:bg-amber-950/20',
  goal: 'border-blue-500 bg-blue-50 dark:bg-blue-950/20',
  gratitude: 'border-pink-500 bg-pink-50 dark:bg-pink-950/20',
  concern: 'border-orange-500 bg-orange-50 dark:bg-orange-950/20',
  question: 'border-purple-500 bg-purple-50 dark:bg-purple-950/20',
  learning: 'border-green-500 bg-green-50 dark:bg-green-950/20',
  idea: 'border-cyan-500 bg-cyan-50 dark:bg-cyan-950/20',
  inspiration: 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20',
}

const ICON_COLORS: Record<InsightCategory, string> = {
  realization: 'text-amber-500',
  goal: 'text-blue-500',
  gratitude: 'text-pink-500',
  concern: 'text-orange-500',
  question: 'text-purple-500',
  learning: 'text-green-500',
  idea: 'text-cyan-500',
  inspiration: 'text-yellow-500',
}

interface InsightCardProps {
  text: string
  category: InsightCategory
  date?: Date | string
  showCategory?: boolean
  className?: string
}

export function InsightCard({
  text,
  category,
  date,
  showCategory = true,
  className,
}: InsightCardProps) {
  const Icon = CATEGORY_ICONS[category]
  const meta = INSIGHT_CATEGORY_META[category]
  const colorClasses = CATEGORY_COLORS[category]
  const iconColor = ICON_COLORS[category]

  const formattedDate =
    date instanceof Date
      ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : date

  return (
    <div className={cn('border-l-4 rounded-r-lg p-4', colorClasses, className)}>
      <div className="flex items-start gap-3">
        <Icon className={cn('h-5 w-5 mt-0.5 shrink-0', iconColor)} />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground italic">"{text}"</p>
          {(showCategory || date) && (
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              {showCategory && <span className="capitalize">{meta.label}</span>}
              {showCategory && date && <span>•</span>}
              {formattedDate && <span>{formattedDate}</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Compact version for lists
interface InsightItemProps {
  text: string
  category: InsightCategory
  date?: Date | string
  onClick?: () => void
}

export function InsightItem({
  text,
  category,
  date,
  onClick,
}: InsightItemProps) {
  const Icon = CATEGORY_ICONS[category]
  const iconColor = ICON_COLORS[category]

  const formattedDate =
    date instanceof Date
      ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : date

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors',
        onClick && 'cursor-pointer',
      )}
      onClick={onClick}
    >
      <Icon className={cn('h-4 w-4 mt-0.5 shrink-0', iconColor)} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground line-clamp-2">"{text}"</p>
        {formattedDate && (
          <p className="text-xs text-muted-foreground mt-1">{formattedDate}</p>
        )}
      </div>
    </div>
  )
}
