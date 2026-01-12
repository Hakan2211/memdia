import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '../src/generated/prisma/client.js'
import { hashPassword } from 'better-auth/crypto'

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || 'file:./dev.db',
})

const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('🌱 Seeding database...')

  // Get admin credentials from environment variables
  const adminEmail = process.env.ADMIN_EMAIL
  const adminPassword = process.env.ADMIN_PASSWORD
  const adminName = process.env.ADMIN_NAME || 'Admin'

  if (!adminEmail || !adminPassword) {
    console.log(
      '⚠️  ADMIN_EMAIL or ADMIN_PASSWORD not set, skipping admin creation',
    )
    console.log('   Set these environment variables to create an admin user:')
    console.log('   - ADMIN_EMAIL')
    console.log('   - ADMIN_PASSWORD')
    console.log('   - ADMIN_NAME (optional)')
    return
  }

  // Hash password using better-auth's method
  const hashedPassword = await hashPassword(adminPassword)

  // Upsert admin user
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: adminName,
      role: 'admin',
    },
    create: {
      email: adminEmail,
      name: adminName,
      emailVerified: true,
      role: 'admin',
    },
  })

  // Upsert admin account (for credential login)
  // Find existing account first
  const existingAccount = await prisma.account.findFirst({
    where: {
      userId: admin.id,
      providerId: 'credential',
    },
  })

  if (existingAccount) {
    await prisma.account.update({
      where: { id: existingAccount.id },
      data: { password: hashedPassword },
    })
  } else {
    await prisma.account.create({
      data: {
        userId: admin.id,
        accountId: admin.id,
        providerId: 'credential',
        password: hashedPassword,
      },
    })
  }

  console.log(
    `✅ Admin user created/updated: ${admin.email} (role: ${admin.role})`,
  )
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
