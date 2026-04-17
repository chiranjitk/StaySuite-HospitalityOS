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

export const db = (() => {
  if (!prismaClient) {
    prismaClient = createPrismaClient()
    if (!isProduction) {
      if (process.env.NODE_ENV !== 'production') { console.log('[DB] PrismaClient initialized (development mode with query logging)'); }
    } else {
      if (process.env.NODE_ENV !== 'production') { console.log('[DB] PrismaClient initialized (production mode)'); }
    }
  }
  return prismaClient
})()

export type { PrismaClient as PrismaClientType } from '@prisma/client'

// Re-export tenant isolation utilities for convenient access alongside db
export { withTenantScope, tenantScopedWhere } from '@/lib/db-tenant-middleware'
export type { TenantScopeOptions } from '@/lib/db-tenant-middleware'
