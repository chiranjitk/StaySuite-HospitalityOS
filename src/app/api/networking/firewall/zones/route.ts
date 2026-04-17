import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = request.nextUrl;
    const propertyId = searchParams.get('propertyId') || 'property-1';

    const items = await db.firewallZone.findMany({
      where: { tenantId: user.tenantId, propertyId },
      include: {
        rules: { orderBy: { priority: 'asc' } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json(items);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch firewall zones' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const item = await db.firewallZone.create({
      data: {
        name: body.name,
        interfaces: body.interfaces || '[]',
        inputPolicy: body.inputPolicy || 'accept',
        forwardPolicy: body.forwardPolicy || 'accept',
        outputPolicy: body.outputPolicy || 'accept',
        masquerade: body.masquerade || false,
        description: body.description,
        tenantId: user.tenantId,
        propertyId: body.propertyId || 'property-1',
      },
    });
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create firewall zone' }, { status: 500 });
  }
}
