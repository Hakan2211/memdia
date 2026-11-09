/**
 * Legacy redirect: /reflections/$date → /conversations/$date
 * (also covers /reflections/today, which lands on the same-named route)
 */

import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/reflections_/$date')({
  beforeLoad: ({ params }) => {
    if (params.date === 'today') {
      throw redirect({ to: '/conversations/today' })
    }
    throw redirect({
      to: '/conversations/$date',
      params: { date: params.date },
    })
  },
})
