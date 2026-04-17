/**
 * DHCP Options API Route
 *
 * List and create DHCP options (global and per-subnet).
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

// GET /api/wifi/dhcp/options - List DHCP options
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');
    const subnetId = searchParams.get('subnetId');
    const code = searchParams.get('code');
    const enabled = searchParams.get('enabled');
    const scope = searchParams.get('scope'); // 'global' or 'subnet'
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    const where: Record<string, unknown> = { tenantId: user.tenantId };

    if (propertyId) where.propertyId = propertyId;
    if (subnetId) where.subnetId = subnetId;
    if (code) where.code = parseInt(code, 10);
    if (enabled !== null) where.enabled = enabled === 'true';

    // Scope filter: 'global' = subnetId is null, 'subnet' = subnetId is not null
    if (scope === 'global') {
      where.subnetId = null;
    } else if (scope === 'subnet') {
      where.subnetId = { not: null };
    }

    const [options, total] = await Promise.all([
      db.dhcpOption.findMany({
        where,
        include: {
          dhcpSubnet: {
            select: { id: true, name: true, subnet: true },
          },
        },
        orderBy: [{ code: 'asc' }, { createdAt: 'desc' }],
        ...(limit && { take: parseInt(limit, 10) }),
        ...(offset && { skip: parseInt(offset, 10) }),
      }),
      db.dhcpOption.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: options,
      pagination: {
        total,
        limit: limit ? parseInt(limit, 10) : null,
        offset: offset ? parseInt(offset, 10) : null,
      },
    });
  } catch (error) {
    console.error('Error fetching DHCP options:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch DHCP options' } },
      { status: 500 },
    );
  }
}

// POST /api/wifi/dhcp/options - Create DHCP option
export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const tenantId = user.tenantId;

    const {
      propertyId,
      subnetId,
      code,
      name,
      value,
      type = 'string',
      enabled = true,
      description,
    } = body;

    if (!propertyId || code === undefined || !name || !value) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Missing required fields: propertyId, code, name, value',
          },
        },
        { status: 400 },
      );
    }

    // If subnet-specific, verify subnet exists
    if (subnetId) {
      const subnet = await db.dhcpSubnet.findFirst({
        where: { id: subnetId, tenantId },
      });
      if (!subnet) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'DHCP subnet not found' } },
          { status: 404 },
        );
      }
    }

    const option = await db.dhcpOption.create({
      data: {
        tenantId,
        propertyId,
        subnetId,
        code: parseInt(code, 10),
        name,
        value,
        type,
        enabled,
        description,
      },
      include: {
        dhcpSubnet: {
          select: { id: true, name: true, subnet: true },
        },
      },
    });

    return NextResponse.json({ success: true, data: option }, { status: 201 });
  } catch (error) {
    console.error('Error creating DHCP option:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create DHCP option' } },
      { status: 500 },
    );
  }
}
