import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

// GET /api/wifi/portal/mappings - List portal-to-VLAN/SSID mappings
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');
    const portalId = searchParams.get('portalId');
    const ssid = searchParams.get('ssid');
    const enabled = searchParams.get('enabled');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    const where: Record<string, unknown> = { tenantId: user.tenantId };

    if (propertyId) where.propertyId = propertyId;
    if (portalId) where.portalId = portalId;
    if (ssid) where.ssid = { contains: ssid };
    if (enabled !== null && enabled !== undefined && enabled !== '') {
      where.enabled = enabled === 'true';
    }

    const mappings = await db.portalMapping.findMany({
      where,
      include: {
        captivePortal: {
          select: { id: true, name: true },
        },
        property: {
          select: { id: true, name: true },
        },
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
      ...(limit && { take: parseInt(limit, 10) }),
      ...(offset && { skip: parseInt(offset, 10) }),
    });

    const total = await db.portalMapping.count({ where });

    return NextResponse.json({
      success: true,
      data: mappings,
      pagination: {
        total,
        limit: limit ? parseInt(limit, 10) : null,
        offset: offset ? parseInt(offset, 10) : null,
      },
    });
  } catch (error) {
    console.error('Error fetching portal mappings:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch portal mappings' } },
      { status: 500 }
    );
  }
}

// POST /api/wifi/portal/mappings - Create portal mapping
export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const tenantId = user.tenantId;

    const {
      propertyId,
      portalId,
      vlanId,
      vlanConfigId,
      ssid,
      subnet,
      priority = 0,
      fallbackPortalId,
      enabled = true,
    } = body;

    if (!propertyId || !portalId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: propertyId, portalId' } },
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

    // Verify portal belongs to same tenant
    const portal = await db.captivePortal.findFirst({
      where: { id: portalId, tenantId },
    });
    if (!portal) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Portal instance not found' } },
        { status: 404 }
      );
    }

    const mapping = await db.portalMapping.create({
      data: {
        tenantId,
        propertyId,
        portalId,
        vlanId: vlanId ? parseInt(vlanId, 10) : null,
        vlanConfigId,
        ssid,
        subnet,
        priority: parseInt(priority, 10),
        fallbackPortalId,
        enabled,
      },
    });

    return NextResponse.json({ success: true, data: mapping }, { status: 201 });
  } catch (error) {
    console.error('Error creating portal mapping:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create portal mapping' } },
      { status: 500 }
    );
  }
}
