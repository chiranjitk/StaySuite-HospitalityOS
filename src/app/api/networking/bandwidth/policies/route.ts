import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = request.nextUrl;
    const propertyId = searchParams.get('propertyId') || 'property-1';

    const items = await db.bandwidthPolicy.findMany({
      where: { tenantId: user.tenantId, propertyId },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(items);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch bandwidth policies' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const item = await db.bandwidthPolicy.create({
      data: {
        name: body.name,
        downloadKbps: body.downloadKbps || 10240,
        uploadKbps: body.uploadKbps || 10240,
        burstDownloadKbps: body.burstDownloadKbps,
        burstUploadKbps: body.burstUploadKbps,
        priority: body.priority ?? 5,
        planId: body.planId,
        description: body.description,
        enabled: body.enabled ?? true,
        tenantId: user.tenantId,
        propertyId: body.propertyId || 'property-1',
      },
    });
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create bandwidth policy' }, { status: 500 });
  }
}
