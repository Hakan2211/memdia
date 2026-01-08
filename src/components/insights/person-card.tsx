/**
 * Person Card Component
 * Displays person with sentiment and mention count
 */

import { cn } from '../../lib/utils'
import { Card, CardContent } from '../ui/card'
import { Badge } from '../ui/badge'
import { User, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { Sentiment, RelationshipType } from '../../types/insights'

interface PersonCardProps {
  name: string
  relationship?: RelationshipType | null
  mentionCount: number
  averageSentiment?: number | null
  lastMentioned?: Date | null
  onClick?: () => void
  className?: string
}

const RELATIONSHIP_LABELS: Record<RelationshipType, string> = {
  friend: 'Friend',
  family: 'Family',
  coworker: 'Coworker',
  partner: 'Partner',
  acquaintance: 'Acquaintance',
  other: 'Other',
}

function getSentimentDisplay(sentiment: number | null | undefined) {
  if (sentiment === null || sentiment === undefined) {
    return { icon: Minus, color: 'text-muted-foreground', label: 'Neutral' }
  }
  if (sentiment > 0.3) {
    return { icon: TrendingUp, color: 'text-green-500', label: 'Positive' }
  }
  if (sentiment < -0.3) {
    return { icon: TrendingDown, color: 'text-red-500', label: 'Negative' }
  }
  return { icon: Minus, color: 'text-muted-foreground', label: 'Neutral' }
}

export function PersonCard({
  name,
  relationship,
  mentionCount,
  averageSentiment,
  lastMentioned,
  onClick,
  className,
}: PersonCardProps) {
  const sentiment = getSentimentDisplay(averageSentiment)
  const SentimentIcon = sentiment.icon

  const formattedDate = lastMentioned
    ? new Date(lastMentioned).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
    : null

  return (
    <Card
      className={cn(
        'transition-colors',
        onClick && 'cursor-pointer hover:bg-muted/50',
        className,
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Avatar placeholder */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
            <User className="h-5 w-5" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium truncate">{name}</h3>
              <SentimentIcon
                className={cn('h-4 w-4 shrink-0', sentiment.color)}
                aria-label={sentiment.label}
              />
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {relationship && (
                <span className="capitalize">
                  {RELATIONSHIP_LABELS[relationship]}
                </span>
              )}
              {relationship && <span>•</span>}
              <span>
                {mentionCount} mention{mentionCount !== 1 ? 's' : ''}
              </span>
              {formattedDate && (
                <>
                  <span>•</span>
                  <span>Last: {formattedDate}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Compact version for lists
interface PersonChipProps {
  name: string
  sentiment?: Sentiment | null
  onClick?: () => void
  className?: string
}

export function PersonChip({
  name,
  sentiment,
  onClick,
  className,
}: PersonChipProps) {
  const sentimentColors: Record<string, string> = {
    positive: 'bg-green-500',
    neutral: 'bg-muted-foreground/30',
    negative: 'bg-red-500',
  }

  const dotColor = sentiment
    ? sentimentColors[sentiment]
    : sentimentColors.neutral

  return (
    <Badge
      variant="secondary"
      className={cn(
        'font-normal gap-1.5',
        onClick && 'cursor-pointer hover:bg-muted/80',
        className,
      )}
      onClick={onClick}
    >
      <User className="h-3 w-3" />
      {name}
      <span className={cn('h-2 w-2 rounded-full', dotColor)} />
    </Badge>
  )
}
