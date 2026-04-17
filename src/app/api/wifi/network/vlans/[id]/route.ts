/**
 * VLAN by ID API Route
 *
 * GET, PUT, DELETE for individual VLAN configurations.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTenantIdFromSession } from '@/lib/auth/tenant-context';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/wifi/network/vlans/[id] - Get single VLAN
export async function GET(request: NextRequest, { params }: RouteParams) {
  const tenantId = await getTenantIdFromSession(request);
  if (!tenantId) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  try {
    const { id } = await params;

    const vlan = await db.vlanConfig.findFirst({
      where: { id, tenantId },
      include: {
        parentInterface: true,
        dhcpSubnets: {
          include: {
            _count: {
              select: {
                reservations: true,
                leases: true,
              },
            },
          },
        },
      },
    });

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

    const existing = await db.vlanConfig.findFirst({
      where: { id, tenantId },
    });

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
        where: { propertyId: existing.propertyId, vlanId: parseInt(vlanId, 10), tenantId, id: { not: id } },
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
        where: { propertyId: existing.propertyId, subInterface, tenantId, id: { not: id } },
      });
      if (duplicate) {
        return NextResponse.json(
          {
            success: false,
            error: { code: 'DUPLICATE_SUBIF', message: 'A sub-interface with this name already exists on this property' },
          },
          { status: 400 },
        );
      }
    }

    const vlan = await db.vlanConfig.update({
      where: { id },
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
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const tenantId = await getTenantIdFromSession(request);
  if (!tenantId) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  try {
    const { id } = await params;

    const existing = await db.vlanConfig.findFirst({
      where: { id, tenantId },
      include: {
        _count: {
          select: {
            dhcpSubnets: true,
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'VLAN not found' } },
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

    await db.vlanConfig.delete({ where: { id } });

    return NextResponse.json({ success: true, message: 'VLAN deleted successfully' });
  } catch (error) {
    console.error('Error deleting VLAN:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete VLAN' } },
      { status: 500 },
    );
  }
}
