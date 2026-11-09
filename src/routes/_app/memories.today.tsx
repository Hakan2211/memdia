/**
 * Legacy redirect: /memories/today → /conversations/today
 * The 3-minute check-in was merged into Conversations. Past check-ins remain
 * viewable (read-only) at /memories/$date.
 */

import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/memories/today')({
  beforeLoad: () => {
    throw redirect({ to: '/conversations/today' })
  },
})
