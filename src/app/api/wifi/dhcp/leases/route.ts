/**
 * DHCP Leases API Route
 *
 * List and expire/release DHCP leases.
 * Leases are synced from the DHCP server (Kea) and are read-mostly.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

// GET /api/wifi/dhcp/leases - List leases
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');
    const subnetId = searchParams.get('subnetId');
    const state = searchParams.get('state');
    const macAddress = searchParams.get('macAddress');
    const ipAddress = searchParams.get('ipAddress');
    const hostname = searchParams.get('hostname');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    const where: Record<string, unknown> = { tenantId: user.tenantId };

    if (propertyId) where.propertyId = propertyId;
    if (subnetId) where.subnetId = subnetId;
    if (state) where.state = state;
    if (macAddress) where.macAddress = { contains: macAddress };
    if (ipAddress) where.ipAddress = { contains: ipAddress };
    if (hostname) where.hostname = { contains: hostname };

    const [leases, total] = await Promise.all([
      db.dhcpLease.findMany({
        where,
        include: {
          subnet: {
            select: { id: true, name: true, subnet: true },
          },
        },
        orderBy: [{ leaseEnd: 'asc' }],
        ...(limit && { take: parseInt(limit, 10) }),
        ...(offset && { skip: parseInt(offset, 10) }),
      }),
      db.dhcpLease.count({ where }),
    ]);

    // Summary statistics
    const activeCount = state === 'active' ? total : await db.dhcpLease.count({
      where: { ...where, state: 'active' },
    });

    const expiredCount = state === 'expired' ? total : await db.dhcpLease.count({
      where: { ...where, state: 'expired' },
    });

    // Expiring soon (within next hour)
    const now = new Date();
    const oneHour = new Date(now.getTime() + 60 * 60 * 1000);
    const expiringSoonCount = await db.dhcpLease.count({
      where: {
        tenantId: user.tenantId,
        state: 'active',
        leaseEnd: { gt: now, lte: oneHour },
        ...(propertyId && { propertyId }),
        ...(subnetId && { subnetId }),
      },
    });

    return NextResponse.json({
      success: true,
      data: leases,
      pagination: {
        total,
        limit: limit ? parseInt(limit, 10) : null,
        offset: offset ? parseInt(offset, 10) : null,
      },
      summary: {
        total,
        active: activeCount,
        expired: expiredCount,
        expiringSoon: expiringSoonCount,
      },
    });
  } catch (error) {
    console.error('Error fetching DHCP leases:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch DHCP leases' } },
      { status: 500 },
    );
  }
}

// DELETE /api/wifi/dhcp/leases - Expire/release leases (bulk)
export async function DELETE(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const searchParams = request.nextUrl.searchParams;
    const ids = searchParams.get('ids');
    const subnetId = searchParams.get('subnetId');
    const state = searchParams.get('state');
    const propertyId = searchParams.get('propertyId');

    // Determine what to delete
    const where: Record<string, unknown> = { tenantId: user.tenantId };

    if (ids) {
      // Delete specific leases by ID
      const idList = ids.split(',');
      where.id = { in: idList };
    } else if (subnetId) {
      // Delete all leases in a subnet (optionally filtered by state)
      where.subnetId = subnetId;
      if (state) where.state = state;
    } else if (state && propertyId) {
      // Delete all leases of a state for a property
      where.propertyId = propertyId;
      where.state = state;
    } else {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Provide either ids, or (subnetId + optional state), or (propertyId + state) to delete leases',
          },
        },
        { status: 400 },
      );
    }

    const count = await db.dhcpLease.count({ where });

    if (count === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'No matching leases found' } },
        { status: 404 },
      );
    }

    await db.dhcpLease.deleteMany({ where });

    return NextResponse.json({
      success: true,
      message: `${count} lease(s) released successfully`,
      data: { deletedCount: count },
    });
  } catch (error) {
    console.error('Error releasing DHCP leases:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to release DHCP leases' } },
      { status: 500 },
    );
  }
}
