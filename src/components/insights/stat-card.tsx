/**
 * Stat Card Component
 * Displays a statistic with label and optional trend
 */

import { cn } from '../../lib/utils'
import { Card, CardContent } from '../ui/card'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  trend?: 'up' | 'down' | 'stable'
  icon?: React.ReactNode
  onClick?: () => void
  className?: string
}

export function StatCard({
  title,
  value,
  subtitle,
  trend,
  icon,
  onClick,
  className,
}: StatCardProps) {
  const TrendIcon =
    trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus
  const trendColor =
    trend === 'up'
      ? 'text-green-500'
      : trend === 'down'
        ? 'text-red-500'
        : 'text-muted-foreground'

  return (
    <Card
      className={cn(
        'transition-colors',
        onClick && 'cursor-pointer hover:bg-muted/50',
        className,
      )}
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="mt-2 text-3xl font-bold">{value}</p>
            {subtitle && (
              <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          {icon && <div className="text-muted-foreground">{icon}</div>}
          {trend && !icon && (
            <TrendIcon className={cn('h-5 w-5', trendColor)} />
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Compact version for grids
interface StatItemProps {
  label: string
  value: string | number
  icon?: React.ReactNode
  className?: string
}

export function StatItem({ label, value, icon, className }: StatItemProps) {
  return (
    <div className={cn('flex items-center justify-between p-3', className)}>
      <div className="flex items-center gap-2">
        {icon && <div className="text-muted-foreground">{icon}</div>}
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <span className="font-semibold">{value}</span>
    </div>
  )
}
