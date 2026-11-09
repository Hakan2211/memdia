/**
 * Check-in Archive Index
 * Landing view for /memories — explains that daily check-ins were merged into
 * Conversations and points to the archive calendar.
 */

import { Link, createFileRoute } from '@tanstack/react-router'
import { Archive, MessageCircle } from 'lucide-react'
import { Button } from '../../components/ui/button'

export const Route = createFileRoute('/_app/memories/')({
  component: MemoriesArchiveIndex,
})

function MemoriesArchiveIndex() {
  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center">
      <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <Archive className="h-7 w-7 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-semibold">Your earlier check-ins</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Daily check-ins are now part of Conversations. Your earlier check-ins
        are kept here — pick a day from the calendar to revisit one.
      </p>
      <Button asChild variant="premium" size="lg" className="mt-6 gap-2">
        <Link to="/conversations/today">
          <MessageCircle className="h-4 w-4" />
          Start a Conversation
        </Link>
      </Button>
    </div>
  )
}
