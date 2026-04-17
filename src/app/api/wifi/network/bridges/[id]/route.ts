/**
 * Bridge Config by ID API Route
 *
 * PUT and DELETE for individual bridge configurations.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTenantIdFromSession } from '@/lib/auth/tenant-context';
import { deleteBridge, removePersistedBridge } from '@/lib/network';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PUT /api/wifi/network/bridges/[id] - Update bridge config
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const tenantId = await getTenantIdFromSession(request);
  if (!tenantId) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await db.bridgeConfig.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Bridge config not found' } },
        { status: 404 },
      );
    }

    const {
      name,
      memberInterfaces,
      stpEnabled,
      forwardDelay,
      helloTime,
      maxAge,
      enabled,
    } = body;

    // Serialize memberInterfaces if it's an array
    const members = memberInterfaces !== undefined
      ? (Array.isArray(memberInterfaces) ? JSON.stringify(memberInterfaces) : memberInterfaces)
      : undefined;

    const bridge = await db.bridgeConfig.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(members !== undefined && { memberInterfaces: members }),
        ...(stpEnabled !== undefined && { stpEnabled }),
        ...(forwardDelay !== undefined && { forwardDelay }),
        ...(helloTime !== undefined && { helloTime }),
        ...(maxAge !== undefined && { maxAge }),
        ...(enabled !== undefined && { enabled }),
      },
    });

    return NextResponse.json({ success: true, data: bridge });
  } catch (error) {
    console.error('Error updating bridge config:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update bridge config' } },
      { status: 500 },
    );
  }
}

// DELETE /api/wifi/network/bridges/[id] - Delete bridge config
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const tenantId = await getTenantIdFromSession(request);
  if (!tenantId) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  try {
    const { id } = await params;

    const existing = await db.bridgeConfig.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Bridge config not found' } },
        { status: 404 },
      );
    }

    // Execute OS-level bridge deletion via shell script
    try {
      const osResult = deleteBridge(existing.name);
      if (!osResult.success) {
        console.warn(`OS bridge removal failed for ${existing.name}:`, osResult.error);
      }
    } catch (err) {
      console.warn(`OS bridge removal error for ${existing.name}:`, err instanceof Error ? err.message : err);
    }

    // Remove persisted bridge config from /etc/network/interfaces
    try {
      removePersistedBridge(existing.name);
    } catch (err) {
      console.warn(`Remove persisted bridge error for ${existing.name}:`, err instanceof Error ? err.message : err);
    }

    await db.bridgeConfig.delete({ where: { id } });

    return NextResponse.json({ success: true, message: 'Bridge config deleted successfully' });
  } catch (error) {
    console.error('Error deleting bridge config:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete bridge config' } },
      { status: 500 },
    );
  }
}
