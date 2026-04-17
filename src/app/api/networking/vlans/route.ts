import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = request.nextUrl;
    const propertyId = searchParams.get('propertyId') || 'property-1';

    const items = await db.vlanConfig.findMany({
      where: { tenantId: user.tenantId, propertyId },
      include: {
        parentInterface: { select: { id: true, name: true, status: true } },
        dhcpSubnets: { orderBy: { subnet: 'asc' } },
        captivePortals: { orderBy: { name: 'asc' } },
      },
      orderBy: { vlanId: 'asc' },
    });
    return NextResponse.json(items);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch VLANs' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const item = await db.vlanConfig.create({
      data: {
        parentInterfaceId: body.parentInterfaceId,
        vlanId: body.vlanId,
        subInterface: body.subInterface,
        description: body.description,
        mtu: body.mtu || 1500,
        enabled: body.enabled ?? true,
        tenantId: user.tenantId,
        propertyId: body.propertyId || 'property-1',
      },
    });
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create VLAN' }, { status: 500 });
  }
}
