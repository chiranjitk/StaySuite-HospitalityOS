/**
 * Bridge Config API Route
 *
 * List and create bridge configurations for a property.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

// GET /api/wifi/network/bridges - List all bridge configs
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (propertyId) where.propertyId = propertyId;

    const bridges = await db.bridgeConfig.findMany({
      where,
      orderBy: [{ name: 'asc' }],
    });

    return NextResponse.json({ success: true, data: bridges });
  } catch (error) {
    console.error('Error fetching bridge configs:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch bridge configs' } },
      { status: 500 },
    );
  }
}

// POST /api/wifi/network/bridges - Create a new bridge config
export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const tenantId = user.tenantId;

    const {
      propertyId,
      name,
      memberInterfaces = '[]',
      stpEnabled = false,
      forwardDelay = 15,
      helloTime = 2,
      maxAge = 20,
      enabled = true,
    } = body;

    if (!propertyId || !name) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: propertyId, name' } },
        { status: 400 },
      );
    }

    // Serialize memberInterfaces if it's an array
    const members = Array.isArray(memberInterfaces)
      ? JSON.stringify(memberInterfaces)
      : memberInterfaces;

    // Check for duplicate name within the property
    const existing = await db.bridgeConfig.findFirst({
      where: { propertyId, name, tenantId },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: { code: 'DUPLICATE_NAME', message: 'A bridge with this name already exists on this property' } },
        { status: 400 },
      );
    }

    const bridge = await db.bridgeConfig.create({
      data: {
        tenantId,
        tenant: { connect: { id: tenantId } },
        property: { connect: { id: propertyId } },
        name,
        memberInterfaces: members,
        stpEnabled,
        forwardDelay,
        helloTime,
        maxAge,
        enabled,
      },
    });

    return NextResponse.json({ success: true, data: bridge }, { status: 201 });
  } catch (error) {
    console.error('Error creating bridge config:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create bridge config' } },
      { status: 500 },
    );
  }
}
