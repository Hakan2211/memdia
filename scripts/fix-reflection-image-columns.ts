/**
 * Idempotent fix: ensure `reflection_session` has the `imageUrl` and
 * `imageStatus` columns required by the reflection image-generation feature.
 *
 * Background: these columns were added to the Prisma schema via `prisma db
 * push` on dev, but were never applied to the production SQLite database. As a
 * result, reflection image generation never worked in production (the column
 * the code writes to does not exist).
 *
 * This script ONLY adds the two columns when they are missing — it never drops
 * or rewrites the table — so it is safe to run against production and safe to
 * run repeatedly. Existing rows get `imageStatus = 'none'`, which the UI treats
 * as "no image expected" (no stuck spinner).
 *
 * Usage (run on the server, with DATABASE_URL pointing at the prod DB):
 *   npx tsx scripts/fix-reflection-image-columns.ts
 */
import { prisma } from '../src/db'

interface ColumnInfo {
  name: string
}

async function logColumns(label: string): Promise<void> {
  const cols = await prisma.$queryRawUnsafe<Array<ColumnInfo>>(
    `PRAGMA table_info("reflection_session")`,
  )
  console.log(`reflection_session columns ${label}:`, cols.map((c) => c.name).join(', '))
}

/**
 * Add a column, treating "already exists" as success. SQLite has no
 * `ADD COLUMN IF NOT EXISTS`, so we rely on the duplicate-column error to make
 * this idempotent regardless of how column metadata is reported.
 */
async function addColumnIfMissing(name: string, ddl: string): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(ddl)
    console.log(`✓ Added column "${name}".`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (/duplicate column name/i.test(message)) {
      console.log(`• Column "${name}" already present — skipping.`)
      return
    }
    throw err
  }
}

async function main(): Promise<void> {
  await logColumns('before')

  await addColumnIfMissing(
    'imageUrl',
    `ALTER TABLE "reflection_session" ADD COLUMN "imageUrl" TEXT`,
  )
  await addColumnIfMissing(
    'imageStatus',
    `ALTER TABLE "reflection_session" ADD COLUMN "imageStatus" TEXT NOT NULL DEFAULT 'none'`,
  )

  await logColumns('after')

  const cols = await prisma.$queryRawUnsafe<Array<ColumnInfo>>(
    `PRAGMA table_info("reflection_session")`,
  )
  const names = cols.map((c) => c.name)
  if (!names.includes('imageUrl') || !names.includes('imageStatus')) {
    throw new Error('Expected columns are still missing after the run.')
  }
  console.log('Done — reflection_session is ready for image generation.')
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Failed to fix reflection image columns:', err)
    process.exit(1)
  })
