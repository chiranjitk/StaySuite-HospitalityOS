/**
 * VLAN by ID API Route
 *
 * GET, PUT, DELETE for individual VLAN configurations.
 * [id] can be a DB CUID or a subInterface name (e.g. eth1.100).
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTenantIdFromSession } from '@/lib/auth/tenant-context';
import { deleteVlan } from '@/lib/network';

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
        const osResult = deleteVlan(id);
        if (osResult.success) {
          return NextResponse.json({ success: true, message: `VLAN interface ${id} removed from OS.` });
        }
      } catch {
        // Validation error or script failure
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

    // Remove from OS first via shell script
    const ifaceName = existing.subInterface;
    try {
      const osResult = deleteVlan(ifaceName);
      if (!osResult.success) {
        console.warn(`OS VLAN removal failed for ${ifaceName}:`, osResult.error);
      }
    } catch (err) {
      console.warn(`OS VLAN removal error for ${ifaceName}:`, err instanceof Error ? err.message : err);
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
