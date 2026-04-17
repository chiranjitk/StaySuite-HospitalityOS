/**
 * Interface Aliases API Route
 *
 * List and create interface aliases (additional IP addresses on interfaces).
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

// GET /api/wifi/network/aliases - List all interface aliases
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');
    const interfaceId = searchParams.get('interfaceId');
    const interfaceName = searchParams.get('interfaceName');

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (propertyId) where.propertyId = propertyId;
    if (interfaceId) where.interfaceId = interfaceId;
    if (interfaceName) where.interfaceName = interfaceName;

    const aliases = await db.interfaceAlias.findMany({
      where,
      include: {
        networkInterface: { select: { id: true, name: true, type: true } },
      },
      orderBy: [{ interfaceName: 'asc' }, { ipAddress: 'asc' }],
    });

    return NextResponse.json({ success: true, data: aliases });
  } catch (error) {
    console.error('Error fetching interface aliases:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch interface aliases' } },
      { status: 500 },
    );
  }
}

// POST /api/wifi/network/aliases - Create an interface alias (upsert)
export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const tenantId = user.tenantId;

    const {
      propertyId,
      interfaceId,
      interfaceName,
      ipAddress,
      netmask,
      description,
      enabled = true,
    } = body;

    if (!propertyId || !interfaceId || !interfaceName || !ipAddress || !netmask) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: propertyId, interfaceId, interfaceName, ipAddress, netmask' } },
        { status: 400 },
      );
    }

    // Validate interfaceId FK exists in NetworkInterface
    const networkInterface = await db.networkInterface.findFirst({
      where: { id: interfaceId, tenantId },
    });

    if (!networkInterface) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Referenced network interface not found' } },
        { status: 404 },
      );
    }

    // Use upsert to avoid duplicates on unique constraint [propertyId, interfaceId, ipAddress]
    const alias = await db.interfaceAlias.upsert({
      where: {
        propertyId_interfaceId_ipAddress: {
          propertyId,
          interfaceId,
          ipAddress,
        },
      },
      update: {
        interfaceName,
        netmask,
        description,
        enabled,
      },
      create: {
        tenantId,
        propertyId,
        interfaceId,
        interfaceName,
        ipAddress,
        netmask,
        description,
        enabled,
      },
    });

    return NextResponse.json({ success: true, data: alias }, { status: 201 });
  } catch (error) {
    console.error('Error creating interface alias:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create interface alias' } },
      { status: 500 },
    );
  }
}
