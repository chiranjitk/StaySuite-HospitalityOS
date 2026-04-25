import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = request.nextUrl;
    const propertyId = searchParams.get('propertyId') || 'property-1';

    const items = await db.portForwardRule.findMany({
      where: { tenantId: user.tenantId, propertyId },
      orderBy: { externalPort: 'asc' },
    });
    return NextResponse.json(items);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch port forwarding rules' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const item = await db.portForwardRule.create({
      data: {
        name: body.name,
        protocol: body.protocol || 'tcp',
        externalPort: body.externalPort,
        internalIp: body.internalIp,
        internalPort: body.internalPort,
        interfaceId: body.interfaceId,
        enabled: body.enabled ?? true,
        description: body.description,
        tenantId: user.tenantId,
        propertyId: body.propertyId || 'property-1',
      },
    });
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create port forwarding rule' }, { status: 500 });
  }
}
