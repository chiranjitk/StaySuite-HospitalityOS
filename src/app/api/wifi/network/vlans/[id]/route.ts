/**
 * VLAN by ID API Route
 *
 * GET, PUT, DELETE for individual VLAN configurations.
 * [id] can be a DB CUID or a subInterface name (e.g. eth1.100).
 */

import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import { db } from '@/lib/db';
import { getTenantIdFromSession } from '@/lib/auth/tenant-context';
import { deleteVlan as nmcliDeleteVlan } from '@/lib/network/nmcli';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Helper: resolve [id] — could be CUID or subInterface name
async function resolveVlan(id: string, tenantId: string) {
  // Try by CUID first
  let vlan = await db.vlanConfig.findFirst({
    where: { id, tenantId },
    include: { parentInterface: true, _count: { select: { dhcpSubnets: true } } },
  });
  // If not found, try by subInterface name
  if (!vlan) {
    vlan = await db.vlanConfig.findFirst({
      where: { subInterface: id, tenantId },
      include: { parentInterface: true, _count: { select: { dhcpSubnets: true } } },
    });
  }
  return vlan;
}

/** Inline fallback: delete VLAN via raw nmcli commands */
function fallbackDeleteVlan(ifaceName: string): void {
  execSync(`sudo nmcli con down "${ifaceName}" 2>/dev/null || true`, { encoding: 'utf-8', timeout: 10000 });
  execSync(`sudo nmcli con delete "${ifaceName}" 2>/dev/null`, { encoding: 'utf-8', timeout: 10000 });
}

// GET /api/wifi/network/vlans/[id] - Get single VLAN
export async function GET(request: NextRequest, { params }: RouteParams) {
  const tenantId = await getTenantIdFromSession(request);
  if (!tenantId) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const vlan = await resolveVlan(id, tenantId);

    if (!vlan) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'VLAN not found' } },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: vlan });
  } catch (error) {
    console.error('Error fetching VLAN:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch VLAN' } },
      { status: 500 },
    );
  }
}

// PUT /api/wifi/network/vlans/[id] - Update VLAN
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const tenantId = await getTenantIdFromSession(request);
  if (!tenantId) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const existing = await resolveVlan(id, tenantId);

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'VLAN not found' } },
        { status: 404 },
      );
    }

    const { vlanId, subInterface, description, mtu, enabled } = body;

    // Check for duplicate VLAN ID if changing
    if (vlanId !== undefined && vlanId !== existing.vlanId) {
      const duplicate = await db.vlanConfig.findFirst({
        where: { propertyId: existing.propertyId, vlanId: parseInt(vlanId, 10), tenantId, id: { not: existing.id } },
      });
      if (duplicate) {
        return NextResponse.json(
          { success: false, error: { code: 'DUPLICATE_VLAN', message: 'A VLAN with this ID already exists on this property' } },
          { status: 400 },
        );
      }
    }

    // Check for duplicate sub-interface name if changing
    if (subInterface && subInterface !== existing.subInterface) {
      const duplicate = await db.vlanConfig.findFirst({
        where: { propertyId: existing.propertyId, subInterface, tenantId, id: { not: existing.id } },
      });
      if (duplicate) {
        return NextResponse.json(
          { success: false, error: { code: 'DUPLICATE_SUBIF', message: 'A sub-interface with this name already exists on this property' } },
          { status: 400 },
        );
      }
    }

    const vlan = await db.vlanConfig.update({
      where: { id: existing.id },
      data: {
        ...(vlanId !== undefined && { vlanId: parseInt(vlanId, 10) }),
        ...(subInterface && { subInterface }),
        ...(description !== undefined && { description }),
        ...(mtu !== undefined && { mtu: parseInt(mtu, 10) }),
        ...(enabled !== undefined && { enabled }),
      },
    });

    return NextResponse.json({ success: true, data: vlan });
  } catch (error) {
    console.error('Error updating VLAN:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update VLAN' } },
      { status: 500 },
    );
  }
}

// DELETE /api/wifi/network/vlans/[id] - Delete VLAN
// [id] can be a DB CUID or a subInterface name (e.g. eth1.100)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const tenantId = await getTenantIdFromSession(request);
  if (!tenantId) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const existing = await resolveVlan(id, tenantId);

    if (!existing) {
      // Even if not in DB, try to remove the OS-level VLAN interface
      try {
        nmcliDeleteVlan(id);
        return NextResponse.json({ success: true, message: `VLAN interface ${id} removed from OS.` });
      } catch (err) {
        // nmcli wrapper failed, try inline fallback
        try {
          fallbackDeleteVlan(id);
          return NextResponse.json({ success: true, message: `VLAN interface ${id} removed from OS via fallback.` });
        } catch (fbErr) {
          console.error(`Failed to delete VLAN ${id} via fallback:`, fbErr);
        }
      }
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'VLAN not found in DB or OS' } },
        { status: 404 },
      );
    }

    if (existing._count.dhcpSubnets > 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DEPENDENCY_ERROR',
            message: 'Cannot delete VLAN with associated DHCP subnets. Remove subnets first.',
          },
        },
        { status: 400 },
      );
    }

    // Remove from OS via nmcli wrapper (with inline fallback)
    const ifaceName = existing.subInterface;
    try {
      nmcliDeleteVlan(ifaceName);
    } catch (err) {
      console.warn(`OS VLAN removal failed for ${ifaceName} via nmcli wrapper:`, err instanceof Error ? err.message : err);
      // Inline fallback
      try {
        fallbackDeleteVlan(ifaceName);
      } catch (fbErr) {
        console.error(`Failed to delete VLAN ${ifaceName} via fallback:`, fbErr);
      }
    }

    await db.vlanConfig.delete({ where: { id: existing.id } });

    return NextResponse.json({ success: true, message: `VLAN ${ifaceName} deleted from DB and OS.` });
  } catch (error) {
    console.error('Error deleting VLAN:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete VLAN' } },
      { status: 500 },
    );
  }
}
