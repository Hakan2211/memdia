/**
 * Topic Pill Component
 * Displays topic tags with optional count
 */

import { cn } from '../../lib/utils'
import { Badge } from '../ui/badge'

interface TopicPillProps {
  topic: string
  count?: number
  onClick?: () => void
  selected?: boolean
  size?: 'sm' | 'md'
  className?: string
}

export function TopicPill({
  topic,
  count,
  onClick,
  selected = false,
  size = 'md',
  className,
}: TopicPillProps) {
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
  }

  return (
    <Badge
      variant={selected ? 'default' : 'secondary'}
      className={cn(
        'font-normal capitalize cursor-pointer transition-colors',
        selected
          ? 'bg-[#7e9ec9] text-white hover:bg-[#5a7ba6]'
          : 'bg-muted hover:bg-muted/80',
        sizeClasses[size],
        onClick && 'cursor-pointer',
        className,
      )}
      onClick={onClick}
    >
      {topic}
      {count !== undefined && (
        <span className="ml-1.5 text-xs opacity-70">({count})</span>
      )}
    </Badge>
  )
}

interface TopicListProps {
  topics: string[] | { topic: string; count?: number }[]
  onTopicClick?: (topic: string) => void
  selectedTopic?: string
  maxVisible?: number
  size?: 'sm' | 'md'
  className?: string
}

export function TopicList({
  topics,
  onTopicClick,
  selectedTopic,
  maxVisible,
  size = 'md',
  className,
}: TopicListProps) {
  // Normalize topics to objects
  const normalizedTopics = topics.map((t) =>
    typeof t === 'string' ? { topic: t, count: undefined } : t,
  )

  const visibleTopics = maxVisible
    ? normalizedTopics.slice(0, maxVisible)
    : normalizedTopics

  const hiddenCount =
    maxVisible && normalizedTopics.length > maxVisible
      ? normalizedTopics.length - maxVisible
      : 0

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {visibleTopics.map(({ topic, count }) => (
        <TopicPill
          key={topic}
          topic={topic}
          count={count}
          onClick={onTopicClick ? () => onTopicClick(topic) : undefined}
          selected={selectedTopic === topic}
          size={size}
        />
      ))}
      {hiddenCount > 0 && (
        <Badge
          variant="outline"
          className={cn('font-normal', size === 'sm' ? 'text-xs' : 'text-sm')}
        >
          +{hiddenCount} more
        </Badge>
      )}
    </div>
  )
}
