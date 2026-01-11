import { Link, Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import { getSessionFn } from '../server/auth.fn'
import { FloatingAudioToggle } from '@/components/audio/FloatingAudioToggle'
import { Button } from '@/components/ui/button'

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
    <div className="grid min-h-screen place-items-center bg-muted/40 px-4 relative">
      <div className="absolute top-4 left-4 md:top-8 md:left-8">
        <Link to="/">
          <Button
            variant="ghost"
            className="gap-2 text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Home
          </Button>
        </Link>
      </div>
      <FloatingAudioToggle />
      <Outlet />
    </div>
  )
}
