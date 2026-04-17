/**
 * Bridge Config by ID API Route
 *
 * PUT and DELETE for individual bridge configurations.
 */

import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import { db } from '@/lib/db';
import { getTenantIdFromSession } from '@/lib/auth/tenant-context';
import { deleteBridge as nmcliDeleteBridge } from '@/lib/network/nmcli';

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

/** Inline fallback: delete bridge via raw nmcli commands */
function fallbackDeleteBridge(name: string): void {
  // Remove all port connections first
  try {
    const stdout = execSync(`nmcli -t -f NAME,TYPE con show 2>/dev/null`, { encoding: 'utf-8', timeout: 5000 });
    for (const line of stdout.split('\n').filter(Boolean)) {
      const [conName, conType] = line.split(':');
      if (conName.startsWith(`${name}-port-`) && conType === '802-3-ethernet') {
        execSync(`sudo nmcli con delete "${conName}" 2>/dev/null || true`, { encoding: 'utf-8', timeout: 10000 });
      }
    }
  } catch { /* ignore */ }
  execSync(`sudo nmcli con down "${name}" 2>/dev/null || true`, { encoding: 'utf-8', timeout: 10000 });
  execSync(`sudo nmcli con delete "${name}" 2>/dev/null`, { encoding: 'utf-8', timeout: 10000 });
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

    // Execute OS-level bridge deletion via nmcli wrapper (with inline fallback)
    try {
      nmcliDeleteBridge(existing.name);
    } catch (err) {
      console.warn(`OS bridge removal failed for ${existing.name} via nmcli wrapper:`, err instanceof Error ? err.message : err);
      // Inline fallback
      try {
        fallbackDeleteBridge(existing.name);
      } catch (fbErr) {
        console.error(`Failed to delete bridge ${existing.name} via fallback:`, fbErr);
      }
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
