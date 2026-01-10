import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { getSessionFn } from '../server/auth.fn'
import { FloatingAudioToggle } from '@/components/audio/FloatingAudioToggle'

/**
 * Auth Layout
 * Centered layout for authentication pages (login, signup)
 * Redirects to memories if already authenticated
 */
export const Route = createFileRoute('/_auth')({
  beforeLoad: async () => {
    const session = await getSessionFn()
    if (session?.user) {
      throw redirect({ to: '/memories' })
    }
  },
  component: AuthLayout,
})

function AuthLayout() {
  return (
    <div className="grid min-h-screen place-items-center bg-muted/40 px-4">
      <FloatingAudioToggle />
      <Outlet />
    </div>
  )
}
