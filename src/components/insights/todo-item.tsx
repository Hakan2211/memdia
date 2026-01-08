/**
 * Todo Item Component
 * Displays todo with checkbox, priority, and due date
 */

import { cn } from '../../lib/utils'
import { Checkbox } from '../ui/checkbox'
import { Badge } from '../ui/badge'
import { Calendar, MessageSquare } from 'lucide-react'
import type { TodoPriority } from '../../types/insights'

interface TodoItemProps {
  id: string
  text: string
  completed: boolean
  priority?: TodoPriority | null
  dueDate?: Date | null
  context?: string | null
  sourceDate?: Date | null
  onToggle?: (id: string, completed: boolean) => void
  onDelete?: (id: string) => void
  showContext?: boolean
  className?: string
}

const PRIORITY_COLORS: Record<TodoPriority, string> = {
  high: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  medium:
    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  low: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
}

export function TodoItem({
  id,
  text,
  completed,
  priority,
  dueDate,
  context,
  sourceDate,
  onToggle,
  showContext = false,
  className,
}: TodoItemProps) {
  const formattedDueDate = dueDate
    ? new Date(dueDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
    : null

  const formattedSourceDate = sourceDate
    ? new Date(sourceDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
    : null

  return (
    <div
      className={cn(
        'group flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors',
        className,
      )}
    >
      <Checkbox
        id={id}
        checked={completed}
        onCheckedChange={(checked) => onToggle?.(id, checked === true)}
        className="mt-0.5"
      />
      <div className="flex-1 min-w-0">
        <label
          htmlFor={id}
          className={cn(
            'text-sm cursor-pointer',
            completed && 'line-through text-muted-foreground',
          )}
        >
          {text}
        </label>

        {/* Meta info row */}
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          {priority && (
            <Badge
              variant="outline"
              className={cn(
                'text-xs px-1.5 py-0 border-0 font-normal',
                PRIORITY_COLORS[priority],
              )}
            >
              {priority}
            </Badge>
          )}

          {formattedDueDate && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {formattedDueDate}
            </span>
          )}

          {formattedSourceDate && (
            <span className="text-xs text-muted-foreground">
              from {formattedSourceDate}
            </span>
          )}
        </div>

        {/* Context */}
        {showContext && context && (
          <div className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
            <MessageSquare className="h-3 w-3 mt-0.5 shrink-0" />
            <span className="italic">"{context}"</span>
          </div>
        )}
      </div>
    </div>
  )
}

// Compact version for overview
export function TodoItemCompact({
  text,
  completed,
  priority,
  dueDate,
}: Pick<TodoItemProps, 'text' | 'completed' | 'priority' | 'dueDate'>) {
  const formattedDueDate = dueDate
    ? new Date(dueDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
    : null

  return (
    <div className="flex items-center gap-2 text-sm">
      <span
        className={cn(
          'h-2 w-2 rounded-full shrink-0',
          completed ? 'bg-green-500' : 'bg-muted-foreground/30',
        )}
      />
      <span
        className={cn(
          'flex-1 truncate',
          completed && 'line-through text-muted-foreground',
        )}
      >
        {text}
      </span>
      {!completed && priority && (
        <Badge
          variant="outline"
          className={cn(
            'text-xs px-1 py-0 border-0 font-normal',
            PRIORITY_COLORS[priority],
          )}
        >
          {priority}
        </Badge>
      )}
      {!completed && formattedDueDate && (
        <span className="text-xs text-muted-foreground shrink-0">
          {formattedDueDate}
        </span>
      )}
    </div>
  )
}
