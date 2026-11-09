/**
 * Build long-term memory (UserMemory profile + recent session notes) from past
 * conversations and check-ins, for every user that doesn't have it yet.
 *
 * Not needed in production: the backfill also runs lazily the first time a
 * user opens the conversation page (and before their first post-session
 * memory update). This script is for running it up front locally.
 *
 * Idempotent: users already backfilled are skipped.
 *
 * Usage:
 *   npx tsx scripts/backfill-memory.ts            # all users
 *   npx tsx scripts/backfill-memory.ts <userId>   # one user
 */
import { prisma } from '../src/db'
import { backfillUserMemory } from '../src/server/memory.internal'

async function main(): Promise<void> {
  const onlyUserId = process.argv[2]
  const users = await prisma.user.findMany({
    where: {
      ...(onlyUserId ? { id: onlyUserId } : {}),
      OR: [{ memory: null }, { memory: { backfilledAt: null } }],
    },
    select: { id: true, email: true },
  })

  console.log(`Backfilling memory for ${users.length} user(s)...`)
  for (const user of users) {
    const ok = await backfillUserMemory(user.id)
    console.log(`${ok ? '✓' : '✗'} ${user.email}`)
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
