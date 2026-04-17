/**
 * Interface Roles API Route
 *
 * List and manage interface role assignments (WAN/LAN/DMZ/Management/WiFi/Unused).
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, getTenantIdFromSession } from '@/lib/auth/tenant-context';

// GET /api/wifi/network/roles - List all interface roles
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (propertyId) where.propertyId = propertyId;

    const roles = await db.interfaceRole.findMany({
      where,
      include: {
        networkInterface: {
          select: { id: true, name: true, type: true, status: true },
        },
      },
      orderBy: [{ priority: 'asc' }],
    });

    return NextResponse.json({ success: true, data: roles });
  } catch (error) {
    console.error('Error fetching interface roles:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch interface roles' } },
      { status: 500 },
    );
  }
}

// POST /api/wifi/network/roles - Create or update an interface role
export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const tenantId = user.tenantId;

    const {
      propertyId,
      interfaceId,
      role = 'lan',
      priority = 0,
      isPrimary = false,
      enabled = true,
    } = body;

    if (!propertyId || !interfaceId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: propertyId, interfaceId' } },
        { status: 400 },
      );
    }

    // Use upsert since there's a unique constraint on (propertyId, interfaceId)
    const roleRecord = await db.interfaceRole.upsert({
      where: {
        propertyId_interfaceId: { propertyId, interfaceId },
      },
      update: {
        role,
        priority,
        isPrimary,
        enabled,
      },
      create: {
        tenantId,
        propertyId,
        interfaceId,
        role,
        priority,
        isPrimary,
        enabled,
      },
      include: {
        networkInterface: {
          select: { id: true, name: true, type: true, status: true },
        },
      },
    });

    return NextResponse.json({ success: true, data: roleRecord }, { status: 201 });
  } catch (error) {
    console.error('Error creating/updating interface role:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create/update interface role' } },
      { status: 500 },
    );
  }
}

// PUT /api/wifi/network/roles - Bulk update role priorities
export async function PUT(request: NextRequest) {
  const tenantId = await getTenantIdFromSession(request);
  if (!tenantId) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { updates } = body as { updates: Array<{ id: string; role?: string; priority?: number; enabled?: boolean }> };

    if (!Array.isArray(updates)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'updates must be an array' } },
        { status: 400 },
      );
    }

    // Verify all roles belong to this tenant
    const roleIds = updates.map(u => u.id);
    const existingRoles = await db.interfaceRole.findMany({
      where: { id: { in: roleIds }, tenantId },
    });

    if (existingRoles.length !== roleIds.length) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'One or more roles not found or not owned by this tenant' } },
        { status: 404 },
      );
    }

    // Apply updates in transaction
    await db.$transaction(
      updates.map(u =>
        db.interfaceRole.update({
          where: { id: u.id },
          data: {
            ...(u.role !== undefined && { role: u.role }),
            ...(u.priority !== undefined && { priority: u.priority }),
            ...(u.enabled !== undefined && { enabled: u.enabled }),
          },
        })
      )
    );

    return NextResponse.json({ success: true, message: 'Roles updated successfully' });
  } catch (error) {
    console.error('Error updating interface roles:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update interface roles' } },
      { status: 500 },
    );
  }
}
