/**
 * Network Interface by ID API Route
 *
 * GET, PUT, DELETE for individual network interfaces.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTenantIdFromSession } from '@/lib/auth/tenant-context';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/wifi/network/interfaces/[id] - Get single interface
export async function GET(request: NextRequest, { params }: RouteParams) {
  const tenantId = await getTenantIdFromSession(request);
  if (!tenantId) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  try {
    const { id } = await params;

    const iface = await db.networkInterface.findFirst({
      where: { id, tenantId },
      include: {
        roles: true,
        vlans: true,
        bondMembers: {
          include: { bondConfig: true },
        },
      },
    });

    if (!iface) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Network interface not found' } },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: iface });
  } catch (error) {
    console.error('Error fetching network interface:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch network interface' } },
      { status: 500 },
    );
  }
}

// PUT /api/wifi/network/interfaces/[id] - Update interface
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const tenantId = await getTenantIdFromSession(request);
  if (!tenantId) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await db.networkInterface.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Network interface not found' } },
        { status: 404 },
      );
    }

    const { name, type, hwAddress, mtu, speed, status, carrier, isManagement, description } = body;

    // Check for duplicate name if renaming
    if (name && name !== existing.name) {
      const duplicate = await db.networkInterface.findFirst({
        where: { propertyId: existing.propertyId, name, tenantId, id: { not: id } },
      });
      if (duplicate) {
        return NextResponse.json(
          { success: false, error: { code: 'DUPLICATE_NAME', message: 'An interface with this name already exists on this property' } },
          { status: 400 },
        );
      }
    }

    const iface = await db.networkInterface.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(type && { type }),
        ...(hwAddress !== undefined && { hwAddress }),
        ...(mtu !== undefined && { mtu: parseInt(mtu, 10) }),
        ...(speed !== undefined && { speed }),
        ...(status && { status }),
        ...(carrier !== undefined && { carrier }),
        ...(isManagement !== undefined && { isManagement }),
        ...(description !== undefined && { description }),
      },
    });

    return NextResponse.json({ success: true, data: iface });
  } catch (error) {
    console.error('Error updating network interface:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update network interface' } },
      { status: 500 },
    );
  }
}

// DELETE /api/wifi/network/interfaces/[id] - Delete interface
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const tenantId = await getTenantIdFromSession(request);
  if (!tenantId) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  try {
    const { id } = await params;

    const existing = await db.networkInterface.findFirst({
      where: { id, tenantId },
      include: {
        _count: {
          select: {
            roles: true,
            vlans: true,
            bondMembers: true,
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Network interface not found' } },
        { status: 404 },
      );
    }

    // Check for active dependencies
    if (existing._count.vlans > 0 || existing._count.bondMembers > 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DEPENDENCY_ERROR',
            message: 'Cannot delete interface with active VLANs or bond memberships. Remove those first.',
          },
        },
        { status: 400 },
      );
    }

    // Delete associated roles
    await db.interfaceRole.deleteMany({ where: { interfaceId: id } });

    await db.networkInterface.delete({ where: { id } });

    return NextResponse.json({ success: true, message: 'Network interface deleted successfully' });
  } catch (error) {
    console.error('Error deleting network interface:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete network interface' } },
      { status: 500 },
    );
  }
}
