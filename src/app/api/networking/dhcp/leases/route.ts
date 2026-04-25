import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = request.nextUrl;
    const propertyId = searchParams.get('propertyId') || 'property-1';

    const items = await db.dhcpLease.findMany({
      where: { tenantId: user.tenantId, propertyId, state: 'active' },
      include: {
        subnet: { select: { id: true, name: true, subnet: true } },
      },
      orderBy: { leaseEnd: 'asc' },
    });
    return NextResponse.json(items);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch DHCP leases' }, { status: 500 });
  }
}
