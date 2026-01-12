import { useEffect, useState, type ReactNode } from 'react'

/**
 * ClientOnly wrapper component
 * Only renders children after the component has mounted on the client.
 * Prevents server-side rendering of client-only components like Three.js Canvas.
 */
export function ClientOnly({
  children,
  fallback = null,
}: {
  children: ReactNode
  fallback?: ReactNode
}) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return fallback
  return <>{children}</>
}
