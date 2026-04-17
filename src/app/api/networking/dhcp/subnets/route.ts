import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = request.nextUrl;
    const propertyId = searchParams.get('propertyId') || 'property-1';

    const items = await db.dhcpSubnet.findMany({
      where: { tenantId: user.tenantId, propertyId },
      include: {
        reservations: { orderBy: { ipAddress: 'asc' } },
        leases: { where: { state: 'active' }, orderBy: { ipAddress: 'asc' } },
        vlanConfig: { select: { id: true, vlanId: true, subInterface: true } },
      },
      orderBy: { subnet: 'asc' },
    });
    return NextResponse.json(items);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch DHCP subnets' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const item = await db.dhcpSubnet.create({
      data: {
        name: body.name,
        subnet: body.subnet,
        gateway: body.gateway,
        poolStart: body.poolStart,
        poolEnd: body.poolEnd,
        leaseTime: body.leaseTime || 3600,
        vlanId: body.vlanId,
        vlanConfigId: body.vlanConfigId,
        domainName: body.domainName,
        dnsServers: body.dnsServers || '[]',
        ntpServers: body.ntpServers || '[]',
        bootFileName: body.bootFileName,
        nextServer: body.nextServer,
        enabled: body.enabled ?? true,
        description: body.description,
        tenantId: user.tenantId,
        propertyId: body.propertyId || 'property-1',
      },
    });
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create DHCP subnet' }, { status: 500 });
  }
}
