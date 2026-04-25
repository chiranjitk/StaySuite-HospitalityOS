import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';
import { applyToNftables } from '@/lib/nftables-helper';

// GET /api/wifi/firewall/zones - List all firewall zones
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'network.manage');
  if (user instanceof NextResponse) return user;

  try {
    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    const where: Record<string, unknown> = { tenantId: user.tenantId };

    if (propertyId) {
      where.propertyId = propertyId;
    }

    const zones = await db.firewallZone.findMany({
      where,
      include: {
        _count: {
          select: {
            rules: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      ...(limit && { take: parseInt(limit, 10) }),
      ...(offset && { skip: parseInt(offset, 10) }),
    });

    const total = await db.firewallZone.count({ where });

    return NextResponse.json({
      success: true,
      data: zones,
      pagination: {
        total,
        limit: limit ? parseInt(limit, 10) : null,
        offset: offset ? parseInt(offset, 10) : null,
      },
    });
  } catch (error) {
    console.error('Error fetching firewall zones:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch firewall zones' } },
      { status: 500 }
    );
  }
}

// POST /api/wifi/firewall/zones - Create a new firewall zone
export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'network.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const {
      propertyId,
      name,
      interfaces,
      inputPolicy = 'accept',
      forwardPolicy = 'accept',
      outputPolicy = 'accept',
      masquerade = false,
      description,
    } = body;

    if (!propertyId || !name) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: propertyId, name' } },
        { status: 400 }
      );
    }

    // Check for duplicate name within property
    const existingZone = await db.firewallZone.findFirst({
      where: { tenantId: user.tenantId, propertyId, name },
    });

    if (existingZone) {
      return NextResponse.json(
        { success: false, error: { code: 'DUPLICATE_NAME', message: 'A firewall zone with this name already exists for this property' } },
        { status: 400 }
      );
    }

    const zone = await db.firewallZone.create({
      data: {
        tenantId: user.tenantId,
        propertyId,
        name,
        interfaces: interfaces ? JSON.stringify(interfaces) : '[]',
        inputPolicy,
        forwardPolicy,
        outputPolicy,
        masquerade,
        description,
      },
    });

    // Apply to nftables (best effort, non-blocking)
    applyToNftables('/api/zones', 'POST', {
      name,
      inputPolicy,
      forwardPolicy,
      outputPolicy,
      interfaces,
    });

    return NextResponse.json({ success: true, data: zone }, { status: 201 });
  } catch (error) {
    console.error('Error creating firewall zone:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create firewall zone' } },
      { status: 500 }
    );
  }
}
