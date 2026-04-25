/**
 * Auth Helper Functions
 *
 * DEPRECATED: Use @/lib/auth/tenant-context as the canonical source for
 * authentication and permission logic. This module is kept for backward
 * compatibility and delegates to tenant-context internally.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from './db';
import {
  getTenantContext,
  getTenantIdFromSession,
  requireAuth,
  hasPermission as tcHasPermission,
  TenantContext,
} from '@/lib/auth/tenant-context';

// Re-export TenantContext type for convenience
export type { TenantContext };

/**
 * Get tenant ID from the request session
 * Delegates to getTenantIdFromSession from tenant-context
 */
export const getTenantFromRequest = getTenantIdFromSession;

/**
 * Alias for getTenantFromRequest - Get tenant ID from request
 */
export const getTenantId = getTenantIdFromSession;

/**
 * Check if user has a specific permission
 * Delegates to tenant-context's hasPermission
 */
export function hasPermission(
  user: { permissions: string[]; roleName: string; isPlatformAdmin?: boolean },
  permission: string
): boolean {
  return tcHasPermission(user as unknown as TenantContext, permission);
}

/**
 * Check if user has any of the specified permissions
 */
export function hasAnyPermission(
  user: { permissions: string[]; roleName: string; isPlatformAdmin?: boolean },
  permissions: string[]
): boolean {
  if (user.isPlatformAdmin) return true;
  if (user.roleName === 'admin' || user.permissions.includes('*')) return true;
  return permissions.some(p => hasPermission(user, p));
}

/**
 * Get the full user from the request session
 * This extends TenantContext with additional user profile fields
 * needed by downstream API routes (email, name, avatar, tenant, etc.)
 */
export async function getUserFromRequest(request: NextRequest) {
  try {
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
            email: true,
            firstName: true,
            lastName: true,
            avatar: true,
            roleId: true,
            tenantId: true,
            status: true,
            deletedAt: true,
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

    const user = session.user;

    // Check if user is still active
    if (user.status !== 'active' || user.deletedAt) {
      return null;
    }

    // Parse permissions from role
    let permissions: string[] = [];
    if (user.role?.permissions) {
      try {
        permissions = JSON.parse(user.role.permissions);
      } catch {
        permissions = [];
      }
    }

    return {
      id: user.id,
      email: user.email,
      name: `${user.firstName} ${user.lastName}`,
      firstName: user.firstName,
      lastName: user.lastName,
      avatar: user.avatar,
      roleId: user.roleId,
      roleName: user.role?.name || 'staff',
      permissions,
      tenantId: user.tenantId,
      tenant: user.tenant,
      isPlatformAdmin: user.isPlatformAdmin || false,
    };
  } catch (error) {
    console.error('Error getting user from request:', error);
    return null;
  }
}
