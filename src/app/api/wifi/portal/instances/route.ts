import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

// GET /api/wifi/portal/instances - List all captive portal instances
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');
    const enabled = searchParams.get('enabled');
    const search = searchParams.get('search');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    const where: Record<string, unknown> = { tenantId: user.tenantId };

    if (propertyId) {
      where.propertyId = propertyId;
    }

    if (enabled !== null && enabled !== undefined && enabled !== '') {
      where.enabled = enabled === 'true';
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const instances = await db.captivePortal.findMany({
      where,
      include: {
        _count: {
          select: {
            portalMappings: true,
            authMethods: true,
            portalPages: true,
          },
        },
        property: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      ...(limit && { take: parseInt(limit, 10) }),
      ...(offset && { skip: parseInt(offset, 10) }),
    });

    const total = await db.captivePortal.count({ where });
    const activeCount = await db.captivePortal.count({
      where: { ...where, enabled: true },
    });

    return NextResponse.json({
      success: true,
      data: instances,
      pagination: {
        total,
        limit: limit ? parseInt(limit, 10) : null,
        offset: offset ? parseInt(offset, 10) : null,
      },
      summary: {
        totalInstances: total,
        activeInstances: activeCount,
      },
    });
  } catch (error) {
    console.error('Error fetching portal instances:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch portal instances' } },
      { status: 500 }
    );
  }
}

// POST /api/wifi/portal/instances - Create new portal instance
export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const tenantId = user.tenantId;

    const {
      propertyId,
      name,
      description,
      listenIp = '0.0.0.0',
      listenPort = 80,
      useSsl = false,
      sslCertPath,
      sslKeyPath,
      enabled = true,
      maxConcurrent = 1000,
      sessionTimeout = 86400,
      idleTimeout = 3600,
      redirectUrl,
      successMessage,
      failMessage,
    } = body;

    if (!propertyId || !name) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: propertyId, name' } },
        { status: 400 }
      );
    }

    // Verify property belongs to tenant
    const property = await db.property.findFirst({
      where: { id: propertyId, tenantId },
    });

    if (!property) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Property not found' } },
        { status: 404 }
      );
    }

    const instance = await db.captivePortal.create({
      data: {
        tenantId,
        propertyId,
        name,
        description,
        listenIp,
        listenPort: parseInt(listenPort, 10),
        useSsl,
        sslCertPath,
        sslKeyPath,
        enabled,
        maxConcurrent: parseInt(maxConcurrent, 10),
        sessionTimeout: parseInt(sessionTimeout, 10),
        idleTimeout: parseInt(idleTimeout, 10),
        redirectUrl,
        successMessage,
        failMessage,
      },
    });

    return NextResponse.json({ success: true, data: instance }, { status: 201 });
  } catch (error) {
    console.error('Error creating portal instance:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create portal instance' } },
      { status: 500 }
    );
  }
}
