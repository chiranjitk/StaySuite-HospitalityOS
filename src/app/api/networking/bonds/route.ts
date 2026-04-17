import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = request.nextUrl;
    const propertyId = searchParams.get('propertyId') || 'property-1';

    const items = await db.bondConfig.findMany({
      where: { tenantId: user.tenantId, propertyId },
      include: {
        members: {
          include: { networkInterface: { select: { id: true, name: true, status: true } } },
          orderBy: { priority: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(items);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch bonds' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const item = await db.bondConfig.create({
      data: {
        name: body.name,
        mode: body.mode || 'active-backup',
        miimon: body.miimon || 100,
        lacpRate: body.lacpRate || 'slow',
        primaryMember: body.primaryMember,
        enabled: body.enabled ?? true,
        tenantId: user.tenantId,
        propertyId: body.propertyId || 'property-1',
      },
    });
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create bond' }, { status: 500 });
  }
}
