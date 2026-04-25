import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = request.nextUrl;
    const propertyId = searchParams.get('propertyId') || 'property-1';
    const listType = searchParams.get('listType');

    const where: Record<string, unknown> = { tenantId: user.tenantId, propertyId };
    if (listType) where.listType = listType;

    const items = await db.macFilter.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(items);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch MAC filters' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const item = await db.macFilter.create({
      data: {
        macAddress: body.macAddress,
        action: body.action || 'allow',
        listType: body.listType || 'blacklist',
        description: body.description,
        linkedType: body.linkedType,
        linkedId: body.linkedId,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        enabled: body.enabled ?? true,
        tenantId: user.tenantId,
        propertyId: body.propertyId || 'property-1',
      },
    });
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create MAC filter' }, { status: 500 });
  }
}
