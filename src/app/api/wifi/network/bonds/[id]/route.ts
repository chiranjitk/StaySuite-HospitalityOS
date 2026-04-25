/**
 * Bond Config by ID API Route
 *
 * PUT and DELETE for individual bond configurations.
 */

import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import { db } from '@/lib/db';
import { getTenantIdFromSession } from '@/lib/auth/tenant-context';
import { deleteBond as nmcliDeleteBond } from '@/lib/network/nmcli';

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

/** Inline fallback: delete bond via raw nmcli commands */
function fallbackDeleteBond(name: string): void {
  // Remove all slave connections first
  try {
    const stdout = execSync(`nmcli -t -f NAME,TYPE con show 2>/dev/null`, { encoding: 'utf-8', timeout: 5000 });
    for (const line of stdout.split('\n').filter(Boolean)) {
      const [conName, conType] = line.split(':');
      if (conName.startsWith(`${name}-slave-`) && conType === '802-3-ethernet') {
        execSync(`sudo nmcli con delete "${conName}" 2>/dev/null || true`, { encoding: 'utf-8', timeout: 10000 });
      }
    }
  } catch { /* ignore */ }
  execSync(`sudo nmcli con down "${name}" 2>/dev/null || true`, { encoding: 'utf-8', timeout: 10000 });
  execSync(`sudo nmcli con delete "${name}" 2>/dev/null`, { encoding: 'utf-8', timeout: 10000 });
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

    // Execute OS-level bond deletion via nmcli wrapper (with inline fallback)
    try {
      nmcliDeleteBond(existing.name);
    } catch (err) {
      console.warn(`OS bond removal failed for ${existing.name} via nmcli wrapper:`, err instanceof Error ? err.message : err);
      // Inline fallback
      try {
        fallbackDeleteBond(existing.name);
      } catch (fbErr) {
        console.error(`Failed to delete bond ${existing.name} via fallback:`, fbErr);
      }
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
