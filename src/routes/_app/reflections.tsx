/**
 * Legacy redirect: /reflections → /conversations
 * Reflections were merged into Conversations; keep old links/bookmarks working.
 */

import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/reflections')({
  beforeLoad: () => {
    throw redirect({ to: '/conversations' })
  },
})
