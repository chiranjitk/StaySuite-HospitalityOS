/**
 * Tenant Context Helper
 * 
 * This module provides helper functions to get tenant context from authenticated sessions.
 * All APIs should use these helpers instead of hardcoded tenantId values.
 * 
 * Multi-Tenant Architecture:
 * - Each user belongs to ONE tenant (via user.tenantId)
 * - Session contains user info including tenantId
 * - Platform admins can access all tenants (isPlatformAdmin = true)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export interface TenantContext {
  userId: string;
  tenantId: string;
  isPlatformAdmin: boolean;
  role: string;
  permissions: string[];
}

/**
 * Get tenant context from session
 * Returns null if not authenticated
 */
export async function getTenantContext(request: NextRequest): Promise<TenantContext | null> {
  const token = request.cookies.get('session_token')?.value;
  
  if (!token) {
    return null;
  }

  const session = await db.session.findUnique({
    where: { token },
    include: {
      user: {
        select: {
          id: true,
          tenantId: true,
          roleId: true,
          isPlatformAdmin: true,
          role: {
            select: {
              name: true,
              permissions: true,
            },
          },
          tenant: {
            select: {
              id: true,
              name: true,
              slug: true,
              plan: true,
              status: true,
            },
          },
        },
      },
    },
  });

  if (!session || session.expiresAt < new Date()) {
    return null;
  }

  // Parse permissions
  let permissions: string[] = [];
  if (session.user.role?.permissions) {
    try {
      permissions = JSON.parse(session.user.role.permissions);
    } catch {
      permissions = [];
    }
  }

  // Check if platform admin (has isPlatformAdmin flag set to true)
  const isPlatformAdmin = session.user.isPlatformAdmin === true;

  return {
    userId: session.user.id,
    tenantId: session.user.tenantId,
    isPlatformAdmin,
    role: session.user.role?.name || 'staff',
    permissions,
  };
}

/**
 * Get tenantId from session
 * Use this for simple cases where you just need the tenant ID
 */
export async function getTenantIdFromSession(request: NextRequest): Promise<string | null> {
  const context = await getTenantContext(request);
  return context?.tenantId || null;
}

/**
 * Require authentication - returns 401 if not authenticated
 * Use this at the start of API routes
 */
export async function requireAuth(request: NextRequest): Promise<TenantContext | NextResponse> {
  const context = await getTenantContext(request);
  
  if (!context) {
    return NextResponse.json(
      { success: false, error: 'Not authenticated' },
      { status: 401 }
    );
  }

  return context;
}

/**
 * Require platform admin - returns 403 if not platform admin
 * Use this for admin-only routes like tenant management
 */
export async function requirePlatformAdmin(request: NextRequest): Promise<TenantContext | NextResponse> {
  const context = await getTenantContext(request);
  
  if (!context) {
    return NextResponse.json(
      { success: false, error: 'Not authenticated' },
      { status: 401 }
    );
  }

  if (!context.isPlatformAdmin) {
    return NextResponse.json(
      { success: false, error: 'Platform admin access required' },
      { status: 403 }
    );
  }

  return context;
}

/**
 * Check if user has a specific permission
 */
export function hasPermission(context: TenantContext, permission: string): boolean {
  if (context.isPlatformAdmin) return true;
  if (context.permissions.includes('*')) return true;
  
  // Check for wildcard module permission (e.g., 'bookings.*')
  const [module] = permission.split('.');
  if (context.permissions.includes(`${module}.*`)) return true;
  
  return context.permissions.includes(permission);
}

/**
 * Require a specific permission - returns 403 if not authorized
 */
export async function requirePermission(
  request: NextRequest, 
  permission: string
): Promise<TenantContext | NextResponse> {
  const context = await requireAuth(request);
  
  if (context instanceof NextResponse) {
    return context;
  }

  if (!hasPermission(context, permission)) {
    // TODO (GAP-18): Consider logging permission-denied attempts for security monitoring
    // e.g., await logAudit(context.tenantId, 'permission_denied', 'system', null, { permission, userId: context.userId });
    return NextResponse.json(
      { success: false, error: `Permission denied: ${permission}` },
      { status: 403 }
    );
  }

  return context;
}

/**
 * Build a where clause with tenant isolation
 * Use this for all database queries that should be tenant-scoped
 */
export function tenantWhere(
  context: TenantContext, 
  additionalWhere: Record<string, unknown> = {}
): Record<string, unknown> {
  // Platform admins can see all tenants' data if they explicitly request it
  // But by default, they still see their own tenant's data
  return {
    tenantId: context.tenantId,
    ...additionalWhere,
  };
}

/**
 * For admin APIs that need to query across tenants
 * Only platform admins can use this
 */
export async function getOptionalTenantFilter(
  request: NextRequest,
  context: TenantContext
): Promise<string> {
  // If platform admin and tenantId is provided in query, use that
  if (context.isPlatformAdmin) {
    const searchParams = request.nextUrl.searchParams;
    const requestedTenantId = searchParams.get('tenantId');
    if (requestedTenantId) {
      return requestedTenantId;
    }
  }
  
  // Otherwise, use the user's tenant
  return context.tenantId;
}

/**
 * Resolve propertyId for an API request.
 * Uses the provided value if present; otherwise auto-detects the first
 * property belonging to the tenant. Returns null only if no property exists.
 */
export async function resolvePropertyId(
  context: TenantContext,
  explicitId?: string | null,
): Promise<string | null> {
  if (explicitId) return explicitId;
  const prop = await db.property.findFirst({
    where: { tenantId: context.tenantId },
    select: { id: true },
  });
  return prop?.id ?? null;
}
