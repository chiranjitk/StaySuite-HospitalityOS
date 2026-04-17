/**
 * Prisma Tenant Isolation Middleware (GAP-8)
 *
 * This module provides a defensive utility for automatic tenant isolation on
 * Prisma query arguments. It ensures that even if a developer forgets to add
 * `tenantWhere()` in a query, tenant data won't leak across boundaries.
 *
 * IMPORTANT: This is a safety net, NOT a replacement for explicit tenant scoping.
 * API routes should still use `tenantWhere()` from `@/lib/auth/tenant-context`
 * as the primary pattern. This utility is useful for:
 *
 *   - Wrapping queries in shared/reusable service functions
 *   - Adding defense-in-depth to critical data access paths
 *   - Ensuring tenant isolation in utility/helper functions that accept raw args
 *
 * Platform admins can bypass tenant filtering by passing { skipTenant: true }.
 */

import { TenantContext } from '@/lib/auth/tenant-context';

export interface TenantScopeOptions {
  /**
   * Skip tenant isolation entirely.
   * Only use this for platform admin routes that legitimately need cross-tenant access.
   */
  skipTenant?: boolean;
}

/**
 * Add tenant scoping to Prisma query arguments.
 *
 * This is a defensive utility that ensures tenant isolation by injecting
 * `tenantId` into the `where` clause of Prisma query args.
 *
 * Behavior:
 * - If `args.where` already contains `tenantId`, it is NOT overridden
 *   (the caller knows best for that specific query).
 * - If `context.isPlatformAdmin` and `options.skipTenant` is true, returns args unchanged.
 * - Otherwise, merges `tenantId: context.tenantId` into the existing where clause.
 *
 * @example
 * // Basic usage — auto-inject tenantId
 * const users = await db.user.findMany(
 *   withTenantScope(context, { where: { status: 'active' } })
 * );
 *
 * @example
 * // Platform admin cross-tenant query
 * const allTenants = await db.user.findMany(
 *   withTenantScope(context, {}, { skipTenant: true })
 * );
 *
 * @example
 * // Caller explicitly set tenantId — not overridden
 * const otherTenant = await db.user.findMany(
 *   withTenantScope(context, { where: { tenantId: 'some-other-tenant' } })
 * );
 */
export function withTenantScope<T extends Record<string, unknown>>(
  context: TenantContext,
  args: T = {} as T,
  options: TenantScopeOptions = {}
): T {
  // Platform admins can opt out of tenant scoping
  if (options.skipTenant && context.isPlatformAdmin) {
    return args;
  }

  // If the caller explicitly provides tenantId in where clause, don't override it.
  // This allows platform admins (or any code) to query a specific tenant when needed.
  if (
    args.where &&
    typeof args.where === 'object' &&
    'tenantId' in (args.where as Record<string, unknown>)
  ) {
    return args;
  }

  // Merge tenantId into the where clause
  const existingWhere = (args.where as Record<string, unknown>) || {};
  return {
    ...args,
    where: {
      ...existingWhere,
      tenantId: context.tenantId,
    },
  } as T;
}

/**
 * Helper to create a tenant-scoped Prisma `where` clause for findFirst / findUnique
 * lookups that also verify the result belongs to the correct tenant.
 *
 * This is particularly useful for `findUnique` calls where you want to ensure
 * the record belongs to the current tenant (defense against IDOR):
 *
 * @example
 * const booking = await db.booking.findUnique({
 *   where: {
 *     id: bookingId,
 *     ...tenantScopedWhere(context, 'Booking'),
 *   },
 * });
 */
export function tenantScopedWhere(
  context: TenantContext,
  _model: string,
  options: TenantScopeOptions = {}
): Record<string, unknown> {
  if (options.skipTenant && context.isPlatformAdmin) {
    return {};
  }

  return { tenantId: context.tenantId };
}
