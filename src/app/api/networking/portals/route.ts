import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = request.nextUrl;
    const propertyId = searchParams.get('propertyId') || 'property-1';

    const items = await db.captivePortal.findMany({
      where: { tenantId: user.tenantId, propertyId },
      include: {
        portalMappings: { orderBy: { priority: 'asc' } },
        authMethods: { orderBy: { priority: 'asc' } },
        portalPages: { orderBy: { language: 'asc' } },
        vlanConfigs: { select: { id: true, vlanId: true, subInterface: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(items);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch captive portals' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const item = await db.captivePortal.create({
      data: {
        name: body.name,
        description: body.description,
        listenIp: body.listenIp || '0.0.0.0',
        listenPort: body.listenPort || 80,
        useSsl: body.useSsl || false,
        sslCertPath: body.sslCertPath,
        sslKeyPath: body.sslKeyPath,
        enabled: body.enabled ?? true,
        maxConcurrent: body.maxConcurrent || 1000,
        sessionTimeout: body.sessionTimeout || 86400,
        idleTimeout: body.idleTimeout || 3600,
        redirectUrl: body.redirectUrl,
        successMessage: body.successMessage,
        failMessage: body.failMessage,
        tenantId: user.tenantId,
        propertyId: body.propertyId || 'property-1',
      },
    });
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create captive portal' }, { status: 500 });
  }
}
