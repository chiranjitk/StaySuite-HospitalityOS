import { PrismaClient } from '@prisma/client'

const isProduction = process.env.NODE_ENV === 'production';

const createPrismaClient = () => {
  return new PrismaClient({
    log: ['error', 'warn'],
    ...(isProduction ? {
      datasources: process.env.DATABASE_URL_UNPOOLED ? {
        db: { url: process.env.DATABASE_URL_UNPOOLED }
      } : undefined,
    } : {}),
  })
}

let prismaClient: PrismaClient | undefined = undefined
let prismaInitialized = false

export const db = (() => {
  if (!prismaClient) {
    prismaClient = createPrismaClient()
    if (!isProduction) {
      console.log('[DB] PrismaClient initialized (development mode with query logging)')
    } else {
      console.log('[DB] PrismaClient initialized (production mode)')
    }

    // SQLite pragmas (only for dev with SQLite, PostgreSQL ignores these safely)
    if (!prismaInitialized) {
      prismaInitialized = true
      const isPostgres = (process.env.DATABASE_URL || '').startsWith('postgresql')
      if (!isPostgres) {
        prismaClient.$executeRawUnsafe('PRAGMA busy_timeout = 5000').catch(() => {})
        prismaClient.$queryRawUnsafe('PRAGMA journal_mode = WAL').catch(() => {})
        prismaClient.$queryRawUnsafe('PRAGMA synchronous = NORMAL').catch(() => {})
      }
    }
  }
  return prismaClient
})()

export type { PrismaClient as PrismaClientType } from '@prisma/client'

// Re-export tenant isolation utilities for convenient access alongside db
export { withTenantScope, tenantScopedWhere } from '@/lib/db-tenant-middleware'
export type { TenantScopeOptions } from '@/lib/db-tenant-middleware'
