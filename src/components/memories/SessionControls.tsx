/**
 * SessionControls Component
 * Control buttons for the voice session (mute, end session)
 */

import { Mic, MicOff, Square } from 'lucide-react'
import { Button } from '../ui/button'
import { cn } from '../../lib/utils'

interface SessionControlsProps {
  /** Whether the microphone is muted */
  isMuted: boolean
  /** Whether the session is paused */
  isPaused?: boolean
  /** Callback when mute toggle is clicked */
  onToggleMute: () => void
  /** Callback when end session is clicked */
  onEndSession: () => void
}

export function SessionControls({
  isMuted,
  isPaused = false,
  onToggleMute,
  onEndSession,
}: SessionControlsProps) {
  return (
    <div className="flex items-center gap-4">
      {/* Mute Button */}
      <Button
        variant="outline"
        size="lg"
        onClick={onToggleMute}
        className={cn(
          'rounded-full h-14 w-14 p-0',
          isMuted && 'bg-red-100 border-red-300 text-red-600 hover:bg-red-200',
        )}
        title={isMuted ? 'Unmute' : 'Mute'}
      >
        {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
      </Button>

      {/* End Session Button */}
      <Button
        variant="destructive"
        size="lg"
        onClick={onEndSession}
        className="rounded-full h-14 px-6 gap-2"
      >
        <Square className="h-4 w-4 fill-current" />
        End Session
      </Button>

      {/* Paused indicator */}
      {isPaused && (
        <span className="text-sm text-amber-600 animate-pulse">
          Reconnecting...
        </span>
      )}
    </div>
  )
}

/**
 * Minimal controls for compact view
 */
export function SessionControlsMinimal({
  isMuted,
  onToggleMute,
  onEndSession,
}: Omit<SessionControlsProps, 'isPaused'>) {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleMute}
        className={cn('rounded-full h-8 w-8', isMuted && 'text-red-600')}
      >
        {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
      </Button>

      <Button
        variant="ghost"
        size="icon"
        onClick={onEndSession}
        className="rounded-full h-8 w-8 text-red-600 hover:bg-red-100"
      >
        <Square className="h-4 w-4 fill-current" />
      </Button>
    </div>
  )
}
