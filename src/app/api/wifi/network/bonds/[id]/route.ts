/**
 * Bond Config by ID API Route
 *
 * PUT and DELETE for individual bond configurations.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTenantIdFromSession } from '@/lib/auth/tenant-context';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PUT /api/wifi/network/bonds/[id] - Update bond config
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const tenantId = await getTenantIdFromSession(request);
  if (!tenantId) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await db.bondConfig.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Bond config not found' } },
        { status: 404 },
      );
    }

    const {
      name,
      mode,
      miimon,
      lacpRate,
      primaryMember,
      enabled,
      members,
    } = body;

    // If members array is provided, replace all members
    if (Array.isArray(members)) {
      await db.bondMember.deleteMany({ where: { bondConfigId: id } });
      await db.bondMember.createMany({
        data: members.map((ifaceId: string, idx: number) => ({
          bondConfigId: id,
          interfaceId: ifaceId,
          priority: idx,
        })),
      });
    }

    const bond = await db.bondConfig.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(mode !== undefined && { mode }),
        ...(miimon !== undefined && { miimon }),
        ...(lacpRate !== undefined && { lacpRate }),
        ...(primaryMember !== undefined && { primaryMember }),
        ...(enabled !== undefined && { enabled }),
      },
      include: {
        members: {
          include: {
            networkInterface: { select: { id: true, name: true } },
          },
        },
      },
    });

    return NextResponse.json({ success: true, data: bond });
  } catch (error) {
    console.error('Error updating bond config:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update bond config' } },
      { status: 500 },
    );
  }
}

// DELETE /api/wifi/network/bonds/[id] - Delete bond config
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const tenantId = await getTenantIdFromSession(request);
  if (!tenantId) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  try {
    const { id } = await params;

    const existing = await db.bondConfig.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Bond config not found' } },
        { status: 404 },
      );
    }

    // Members will be cascade-deleted
    await db.bondConfig.delete({ where: { id } });

    return NextResponse.json({ success: true, message: 'Bond config deleted successfully' });
  } catch (error) {
    console.error('Error deleting bond config:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete bond config' } },
      { status: 500 },
    );
  }
}
