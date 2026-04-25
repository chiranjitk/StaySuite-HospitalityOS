/**
 * Permission helpers for API routes
 */

import { getTenantContext, hasPermission as checkPermission, TenantContext } from '@/lib/auth/tenant-context';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Check if user has a specific permission
 */
export async function hasPermission(
  request: NextRequest,
  permission: string
): Promise<boolean> {
  const context = await getTenantContext(request);
  if (!context) return false;
  return checkPermission(context, permission);
}

/**
 * Require a specific permission - returns 403 if not authorized
 */
export async function requirePermission(
  request: NextRequest,
  permission: string
): Promise<TenantContext | NextResponse> {
  const context = await getTenantContext(request);
  
  if (!context) {
    return NextResponse.json(
      { success: false, error: 'Not authenticated' },
      { status: 401 }
    );
  }

  if (!checkPermission(context, permission)) {
    return NextResponse.json(
      { success: false, error: `Permission denied: ${permission}` },
      { status: 403 }
    );
  }

  return context;
}

/**
 * Get user context from request
 */
export async function getUserContext(request: NextRequest): Promise<TenantContext | null> {
  return getTenantContext(request);
}
