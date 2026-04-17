/**
 * DHCP Reservations API Route
 *
 * List and create DHCP reservations with search by MAC/IP/hostname.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

// GET /api/wifi/dhcp/reservations - List reservations
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');
    const subnetId = searchParams.get('subnetId');
    const search = searchParams.get('search');
    const linkedType = searchParams.get('linkedType');
    const enabled = searchParams.get('enabled');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    const where: Record<string, unknown> = { tenantId: user.tenantId };

    if (propertyId) where.propertyId = propertyId;
    if (subnetId) where.subnetId = subnetId;
    if (linkedType) where.linkedType = linkedType;
    if (enabled !== null) where.enabled = enabled === 'true';

    if (search) {
      where.OR = [
        { macAddress: { contains: search } },
        { ipAddress: { contains: search } },
        { hostname: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const [reservations, total] = await Promise.all([
      db.dhcpReservation.findMany({
        where,
        include: {
          dhcpSubnet: {
            select: { id: true, name: true, subnet: true },
          },
        },
        orderBy: [{ ipAddress: 'asc' }],
        ...(limit && { take: parseInt(limit, 10) }),
        ...(offset && { skip: parseInt(offset, 10) }),
      }),
      db.dhcpReservation.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: reservations,
      pagination: {
        total,
        limit: limit ? parseInt(limit, 10) : null,
        offset: offset ? parseInt(offset, 10) : null,
      },
    });
  } catch (error) {
    console.error('Error fetching DHCP reservations:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch DHCP reservations' } },
      { status: 500 },
    );
  }
}

// POST /api/wifi/dhcp/reservations - Create reservation
export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const tenantId = user.tenantId;

    const {
      propertyId,
      subnetId,
      macAddress,
      ipAddress,
      hostname,
      leaseTime,
      linkedType,
      linkedId,
      description,
      enabled = true,
    } = body;

    if (!propertyId || !subnetId || !macAddress || !ipAddress) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Missing required fields: propertyId, subnetId, macAddress, ipAddress',
          },
        },
        { status: 400 },
      );
    }

    // Normalize MAC address
    const normalizedMac = macAddress.toLowerCase().trim();

    // Check for duplicate MAC in the same subnet
    const existingMac = await db.dhcpReservation.findFirst({
      where: { subnetId, macAddress: normalizedMac, tenantId },
    });

    if (existingMac) {
      return NextResponse.json(
        { success: false, error: { code: 'DUPLICATE_MAC', message: 'A reservation with this MAC address already exists in this subnet' } },
        { status: 400 },
      );
    }

    // Check for duplicate IP in the same subnet
    const existingIp = await db.dhcpReservation.findFirst({
      where: { subnetId, ipAddress, tenantId },
    });

    if (existingIp) {
      return NextResponse.json(
        { success: false, error: { code: 'DUPLICATE_IP', message: 'A reservation with this IP address already exists in this subnet' } },
        { status: 400 },
      );
    }

    // Verify subnet exists
    const subnet = await db.dhcpSubnet.findFirst({
      where: { id: subnetId, tenantId },
    });

    if (!subnet) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'DHCP subnet not found' } },
        { status: 404 },
      );
    }

    const reservation = await db.dhcpReservation.create({
      data: {
        tenantId,
        propertyId,
        subnetId,
        macAddress: normalizedMac,
        ipAddress,
        hostname,
        leaseTime: leaseTime ? parseInt(leaseTime, 10) : null,
        linkedType,
        linkedId,
        description,
        enabled,
      },
    });

    return NextResponse.json({ success: true, data: reservation }, { status: 201 });
  } catch (error) {
    console.error('Error creating DHCP reservation:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create DHCP reservation' } },
      { status: 500 },
    );
  }
}
