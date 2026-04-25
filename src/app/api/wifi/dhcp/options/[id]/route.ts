/**
 * DHCP Option by ID API Route
 *
 * GET, PUT, DELETE for individual DHCP options.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTenantIdFromSession } from '@/lib/auth/tenant-context';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/wifi/dhcp/options/[id] - Get single option
export async function GET(request: NextRequest, { params }: RouteParams) {
  const tenantId = await getTenantIdFromSession(request);
  if (!tenantId) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  try {
    const { id } = await params;

    const option = await db.dhcpOption.findFirst({
      where: { id, tenantId },
      include: {
        dhcpSubnet: true,
      },
    });

    if (!option) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'DHCP option not found' } },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: option });
  } catch (error) {
    console.error('Error fetching DHCP option:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch DHCP option' } },
      { status: 500 },
    );
  }
}

// PUT /api/wifi/dhcp/options/[id] - Update option
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const tenantId = await getTenantIdFromSession(request);
  if (!tenantId) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await db.dhcpOption.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'DHCP option not found' } },
        { status: 404 },
      );
    }

    const {
      subnetId, code, name, value, type, enabled, description,
    } = body;

    // If changing subnet, verify it exists
    if (subnetId !== undefined && subnetId !== null) {
      const subnet = await db.dhcpSubnet.findFirst({
        where: { id: subnetId, tenantId },
      });
      if (!subnet) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'DHCP subnet not found' } },
          { status: 404 },
        );
      }
    }

    const updateData: Record<string, unknown> = {};

    if (subnetId !== undefined) updateData.subnetId = subnetId;
    if (code !== undefined) updateData.code = parseInt(code, 10);
    if (name) updateData.name = name;
    if (value) updateData.value = value;
    if (type) updateData.type = type;
    if (enabled !== undefined) updateData.enabled = enabled;
    if (description !== undefined) updateData.description = description;

    const option = await db.dhcpOption.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: option });
  } catch (error) {
    console.error('Error updating DHCP option:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update DHCP option' } },
      { status: 500 },
    );
  }
}

// DELETE /api/wifi/dhcp/options/[id] - Delete option
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const tenantId = await getTenantIdFromSession(request);
  if (!tenantId) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  try {
    const { id } = await params;

    const existing = await db.dhcpOption.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'DHCP option not found' } },
        { status: 404 },
      );
    }

    await db.dhcpOption.delete({ where: { id } });

    return NextResponse.json({ success: true, message: 'DHCP option deleted successfully' });
  } catch (error) {
    console.error('Error deleting DHCP option:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete DHCP option' } },
      { status: 500 },
    );
  }
}
