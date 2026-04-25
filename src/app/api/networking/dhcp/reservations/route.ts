import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = request.nextUrl;
    const propertyId = searchParams.get('propertyId') || 'property-1';

    const items = await db.dhcpReservation.findMany({
      where: { tenantId: user.tenantId, propertyId },
      include: {
        dhcpSubnet: { select: { id: true, name: true, subnet: true } },
      },
      orderBy: { ipAddress: 'asc' },
    });
    return NextResponse.json(items);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch DHCP reservations' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const item = await db.dhcpReservation.create({
      data: {
        subnetId: body.subnetId,
        macAddress: body.macAddress,
        ipAddress: body.ipAddress,
        hostname: body.hostname,
        leaseTime: body.leaseTime,
        linkedType: body.linkedType,
        linkedId: body.linkedId,
        description: body.description,
        enabled: body.enabled ?? true,
        tenantId: user.tenantId,
        propertyId: body.propertyId || 'property-1',
      },
    });
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create DHCP reservation' }, { status: 500 });
  }
}
