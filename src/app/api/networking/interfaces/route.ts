import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = request.nextUrl;
    const propertyId = searchParams.get('propertyId') || 'property-1';

    const items = await db.networkInterface.findMany({
      where: { tenantId: user.tenantId, propertyId },
      include: {
        roles: { orderBy: { priority: 'asc' } },
        vlans: { orderBy: { vlanId: 'asc' } },
        bondMembers: { include: { bondConfig: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(items);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch network interfaces' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const item = await db.networkInterface.create({
      data: {
        name: body.name,
        type: body.type || 'ethernet',
        hwAddress: body.hwAddress,
        mtu: body.mtu || 1500,
        speed: body.speed,
        status: body.status || 'down',
        carrier: body.carrier || false,
        isManagement: body.isManagement || false,
        description: body.description,
        tenantId: user.tenantId,
        propertyId: body.propertyId || 'property-1',
      },
    });
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create network interface' }, { status: 500 });
  }
}
