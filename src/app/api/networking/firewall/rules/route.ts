import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = request.nextUrl;
    const propertyId = searchParams.get('propertyId') || 'property-1';
    const zoneId = searchParams.get('zoneId');

    const where: Record<string, unknown> = { tenantId: user.tenantId, propertyId };
    if (zoneId) where.zoneId = zoneId;

    const items = await db.firewallRule.findMany({
      where,
      include: {
        firewallZone: { select: { id: true, name: true } },
      },
      orderBy: { priority: 'asc' },
    });
    return NextResponse.json(items);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch firewall rules' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const item = await db.firewallRule.create({
      data: {
        zoneId: body.zoneId,
        chain: body.chain || 'input',
        protocol: body.protocol,
        sourceIp: body.sourceIp,
        sourcePort: body.sourcePort,
        destIp: body.destIp,
        destPort: body.destPort,
        action: body.action || 'accept',
        jumpTarget: body.jumpTarget,
        logPrefix: body.logPrefix,
        enabled: body.enabled ?? true,
        comment: body.comment,
        priority: body.priority || 0,
        scheduleId: body.scheduleId,
        tenantId: user.tenantId,
        propertyId: body.propertyId || 'property-1',
      },
    });
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create firewall rule' }, { status: 500 });
  }
}
