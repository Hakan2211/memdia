# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Memdia is a voice AI daily companion application built with TanStack Start. It features voice sessions for daily check-ins, reflection sessions for therapeutic conversations, and an insights system for tracking moods, topics, and personal growth.

## Commands

### Development

```bash
npm run dev          # Start dev server on port 3000
npm run build        # Production build
npm run preview      # Preview production build
npm run test         # Run vitest tests
npm run check        # Run prettier + eslint with fixes
```

### Database (Prisma)

```bash
npm run db:generate  # Generate Prisma client to src/generated/prisma
npm run db:push      # Push schema changes to SQLite
npm run db:migrate   # Create migration
npm run db:studio    # Open Prisma Studio GUI
npm run db:seed      # Seed test data
```

### Adding UI Components

```bash
pnpm dlx shadcn@latest add <component>
```

## Architecture

### Framework Stack

- **TanStack Start** with Nitro for full-stack React
- **TanStack Router** for file-based, type-safe routing
- **TanStack Query** for data fetching with SSR integration
- **Better-Auth** for authentication (email/password + Google OAuth)
- **Prisma** with SQLite and generated client in `src/generated/prisma`

### Route Structure

Routes use TanStack Router's file-based convention:

- `src/routes/__root.tsx` - Root layout with devtools and Toaster
- `src/routes/_auth.tsx` - Auth layout (login/signup) - public routes
- `src/routes/_app.tsx` - Protected app layout with sidebar, requires auth + onboarding
- `src/routes/_app/*.tsx` - Protected pages (memories, reflections, admin, profile)
- `src/routes/api/*.ts` - API routes (auth handler, streaming endpoints)

### Server Functions

Located in `src/server/`:

- `*.fn.ts` - Server functions using TanStack's `createServerFn`
- `*.actions.ts` - Server actions for mutations
- `middleware.ts` - Auth middleware (`authMiddleware`, `adminMiddleware`, `optionalAuthMiddleware`)
- `services/*.service.ts` - External service integrations (Deepgram, OpenRouter, Bunny CDN, Fal.ai)

### Key Patterns

**Protected Routes**: Use `beforeLoad` to check auth via `getSessionFn()` and redirect to `/login` if unauthenticated.

**Server Functions**: Defined with `createServerFn` from `@tanstack/react-start`, can chain middleware:

```typescript
const myFn = createServerFn()
  .middleware([authMiddleware])
  .handler(async ({ context }) => { ... })
```

**Path Aliases**: `@/*` maps to `./src/*` (configured in tsconfig.json)

### Voice/Reflection System

- `VoiceSession` - 3-minute daily voice check-ins with AI, generates summary + image
- `ReflectionSession` - 10-minute therapeutic conversations, extracts moods/topics/insights
- Real-time STT via Deepgram, TTS via OpenRouter/Deepgram
- Audio storage on Bunny CDN, image generation via Fal.ai

### Database Models (prisma/schema.prisma)

Core: `User`, `Session`, `Account`, `Verification`
Voice: `VoiceSession`, `TranscriptTurn`, `DailyGreeting`
Reflection: `ReflectionSession`, `ReflectionTurn`, `ReflectionMood`, `ReflectionTopic`, `ReflectionInsight`
Insights: `Todo`, `Person`, `PersonMention`

## Environment Variables

Required in `.env.local`:

- `DATABASE_URL` - SQLite path (e.g., `file:./dev.db`)
- `BETTER_AUTH_SECRET` - Auth secret key
- `BETTER_AUTH_URL` - App URL

Optional:

- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` - Google OAuth
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID` - Payments
- `MOCK_PAYMENTS=true` - Skip Stripe in development
- `DEEPGRAM_API_KEY` - Speech-to-text
- `OPENROUTER_API_KEY` - LLM conversations
- `BUNNY_*` - CDN for audio storage
- `FAL_KEY` - Image generation
