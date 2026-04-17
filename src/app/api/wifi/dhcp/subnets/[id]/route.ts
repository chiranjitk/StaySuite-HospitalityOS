/**
 * DHCP Subnet by ID API Route
 *
 * GET, PUT, DELETE for individual DHCP subnets.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTenantIdFromSession } from '@/lib/auth/tenant-context';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/wifi/dhcp/subnets/[id] - Get single subnet
export async function GET(request: NextRequest, { params }: RouteParams) {
  const tenantId = await getTenantIdFromSession(request);
  if (!tenantId) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  try {
    const { id } = await params;

    const subnet = await db.dhcpSubnet.findFirst({
      where: { id, tenantId },
      include: {
        vlanConfig: true,
        reservations: {
          where: { enabled: true },
          orderBy: { ipAddress: 'asc' },
        },
        leases: {
          where: { state: 'active' },
          orderBy: { leaseEnd: 'asc' },
        },
        _count: {
          select: {
            reservations: true,
            leases: true,
          },
        },
      },
    });

    if (!subnet) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'DHCP subnet not found' } },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, data: subnet });
  } catch (error) {
    console.error('Error fetching DHCP subnet:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch DHCP subnet' } },
      { status: 500 },
    );
  }
}

// PUT /api/wifi/dhcp/subnets/[id] - Update subnet
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const tenantId = await getTenantIdFromSession(request);
  if (!tenantId) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await db.dhcpSubnet.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'DHCP subnet not found' } },
        { status: 404 },
      );
    }

    const {
      name, subnet, gateway, poolStart, poolEnd, leaseTime,
      vlanId, vlanConfigId, domainName, dnsServers, ntpServers,
      bootFileName, nextServer, enabled, description,
    } = body;

    const updateData: Record<string, unknown> = {};

    if (name) updateData.name = name;
    if (subnet) updateData.subnet = subnet;
    if (gateway !== undefined) updateData.gateway = gateway;
    if (poolStart) updateData.poolStart = poolStart;
    if (poolEnd) updateData.poolEnd = poolEnd;
    if (leaseTime !== undefined) updateData.leaseTime = parseInt(leaseTime, 10);
    if (vlanId !== undefined) updateData.vlanId = vlanId ? parseInt(vlanId, 10) : null;
    if (vlanConfigId !== undefined) updateData.vlanConfigId = vlanConfigId;
    if (domainName !== undefined) updateData.domainName = domainName;
    if (dnsServers !== undefined) updateData.dnsServers = typeof dnsServers === 'string' ? dnsServers : JSON.stringify(dnsServers);
    if (ntpServers !== undefined) updateData.ntpServers = typeof ntpServers === 'string' ? ntpServers : JSON.stringify(ntpServers);
    if (bootFileName !== undefined) updateData.bootFileName = bootFileName;
    if (nextServer !== undefined) updateData.nextServer = nextServer;
    if (enabled !== undefined) updateData.enabled = enabled;
    if (description !== undefined) updateData.description = description;

    const updatedSubnet = await db.dhcpSubnet.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: updatedSubnet });
  } catch (error) {
    console.error('Error updating DHCP subnet:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update DHCP subnet' } },
      { status: 500 },
    );
  }
}

// DELETE /api/wifi/dhcp/subnets/[id] - Delete subnet
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const tenantId = await getTenantIdFromSession(request);
  if (!tenantId) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  try {
    const { id } = await params;

    const existing = await db.dhcpSubnet.findFirst({
      where: { id, tenantId },
      include: {
        _count: {
          select: {
            reservations: true,
            leases: true,
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'DHCP subnet not found' } },
        { status: 404 },
      );
    }

    if (existing._count.reservations > 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'DEPENDENCY_ERROR',
            message: 'Cannot delete subnet with existing reservations. Remove reservations first.',
          },
        },
        { status: 400 },
      );
    }

    // Delete associated leases first
    await db.dhcpLease.deleteMany({ where: { subnetId: id } });

    await db.dhcpSubnet.delete({ where: { id } }).catch(() => {
      // Record may not exist in DB (e.g., managed only by Kea, not our DB)
    });

    return NextResponse.json({ success: true, message: 'DHCP subnet deleted successfully' });
  } catch (error) {
    console.error('Error deleting DHCP subnet:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete DHCP subnet' } },
      { status: 500 },
    );
  }
}
