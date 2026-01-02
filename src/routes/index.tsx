import { Link, createFileRoute } from '@tanstack/react-router'
import { Button } from '../components/ui/button'

export const Route = createFileRoute('/')({
  component: LandingPage,
})

function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex items-center space-x-2">
            <div className="h-8 w-8 rounded-lg bg-primary" />
            <span className="text-xl font-bold">AppStarter</span>
          </Link>
          <nav className="flex items-center space-x-4">
            <Link
              to="/pricing"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Pricing
            </Link>
            <Link to="/login">
              <Button variant="ghost" size="sm">
                Sign in
              </Button>
            </Link>
            <Link to="/signup">
              <Button size="sm">Get Started</Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="container mx-auto flex flex-col items-center justify-center px-4 py-24 text-center lg:py-32">
          <div className="mb-4 inline-flex items-center rounded-full border bg-muted px-4 py-1.5 text-sm font-medium">
            <span className="mr-2">🚀</span>
            Built with TanStack Start
          </div>
          <h1 className="mb-6 max-w-4xl text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Ship your next{' '}
            <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              SaaS product
            </span>{' '}
            in record time
          </h1>
          <p className="mb-10 max-w-2xl text-lg text-muted-foreground sm:text-xl">
            A production-ready starter template with authentication, payments,
            database, and everything you need to go from idea to MVP.
          </p>
          <div className="flex flex-col gap-4 sm:flex-row">
            <Link to="/signup">
              <Button size="lg" className="min-w-[160px]">
                Start Building
              </Button>
            </Link>
            <Link to="/pricing">
              <Button variant="outline" size="lg" className="min-w-[160px]">
                View Pricing
              </Button>
            </Link>
          </div>
        </section>

        {/* Features Section */}
        <section className="border-t bg-muted/30 py-24">
          <div className="container mx-auto px-4">
            <div className="mb-16 text-center">
              <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
                Everything you need to build
              </h2>
              <p className="text-lg text-muted-foreground">
                Pre-configured with best practices and modern tooling
              </p>
            </div>
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              <FeatureCard
                icon="🔐"
                title="Authentication"
                description="Email/password and OAuth with Better-Auth. Session management and RBAC built-in."
              />
              <FeatureCard
                icon="💳"
                title="Payments"
                description="Stripe integration with subscription management. Mock mode for development."
              />
              <FeatureCard
                icon="🗄️"
                title="Database"
                description="SQLite with Prisma ORM. Production-ready with Turso/Litestream support."
              />
              <FeatureCard
                icon="🎨"
                title="UI Components"
                description="Shadcn UI with Tailwind CSS. Beautiful, accessible, and customizable."
              />
              <FeatureCard
                icon="🛡️"
                title="Security"
                description="CSRF protection, honeypot fields, rate limiting, and secure headers."
              />
              <FeatureCard
                icon="📝"
                title="Forms"
                description="TanStack Form with Zod validation. Type-safe from client to server."
              />
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 md:flex-row">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} AppStarter. Built with TanStack Start.
          </p>
          <nav className="flex items-center space-x-4">
            <Link
              to="/pricing"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Pricing
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string
  title: string
  description: string
}) {
  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
      <div className="mb-4 text-4xl">{icon}</div>
      <h3 className="mb-2 text-xl font-semibold">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  )
}
