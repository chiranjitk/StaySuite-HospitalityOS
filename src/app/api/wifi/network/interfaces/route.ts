/**
 * Network Interfaces API Route
 *
 * List and create network interfaces for a property.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

// GET /api/wifi/network/interfaces - List all network interfaces
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const role = searchParams.get('role');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    const where: Record<string, unknown> = { tenantId: user.tenantId };

    if (propertyId) where.propertyId = propertyId;
    if (status) where.status = status;
    if (type) where.type = type;

    // If role filter, find interface IDs that have that role assigned
    if (role) {
      const roleRecords = await db.interfaceRole.findMany({
        where: { tenantId: user.tenantId, role, enabled: true },
        select: { interfaceId: true },
      });
      const interfaceIds = roleRecords.map((r) => r.interfaceId);
      where.id = { in: interfaceIds };
    }

    const [interfaces, total] = await Promise.all([
      db.networkInterface.findMany({
        where,
        include: {
          roles: true,
          vlans: true,
          bondMembers: {
            include: { bondConfig: true },
          },
          _count: {
            select: {
              roles: true,
              vlans: true,
              bondMembers: true,
            },
          },
        },
        orderBy: [{ name: 'asc' }],
        ...(limit && { take: parseInt(limit, 10) }),
        ...(offset && { skip: parseInt(offset, 10) }),
      }),
      db.networkInterface.count({ where }),
    ]);

    // Count by status and type for summary
    const statusCounts = await db.networkInterface.groupBy({
      by: ['status'],
      where: { tenantId: user.tenantId, ...(propertyId && { propertyId }) },
      _count: { status: true },
    });

    const typeCounts = await db.networkInterface.groupBy({
      by: ['type'],
      where: { tenantId: user.tenantId, ...(propertyId && { propertyId }) },
      _count: { type: true },
    });

    return NextResponse.json({
      success: true,
      data: interfaces,
      pagination: {
        total,
        limit: limit ? parseInt(limit, 10) : null,
        offset: offset ? parseInt(offset, 10) : null,
      },
      summary: {
        total,
        byStatus: statusCounts.map((s) => ({ status: s.status, count: s._count.status })),
        byType: typeCounts.map((t) => ({ type: t.type, count: t._count.type })),
      },
    });
  } catch (error) {
    console.error('Error fetching network interfaces:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch network interfaces' } },
      { status: 500 },
    );
  }
}

// POST /api/wifi/network/interfaces - Create a new network interface
export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const tenantId = user.tenantId;

    const {
      propertyId,
      name,
      type = 'ethernet',
      hwAddress,
      mtu = 1500,
      speed,
      status = 'down',
      carrier = false,
      isManagement = false,
      description,
    } = body;

    if (!propertyId || !name) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: propertyId, name' } },
        { status: 400 },
      );
    }

    // Check for duplicate name within the property
    const existing = await db.networkInterface.findFirst({
      where: { propertyId, name, tenantId },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: { code: 'DUPLICATE_NAME', message: 'An interface with this name already exists on this property' } },
        { status: 400 },
      );
    }

    const iface = await db.networkInterface.create({
      data: {
        tenant: { connect: { id: tenantId } },
        property: { connect: { id: propertyId } },
        name,
        type,
        hwAddress,
        mtu: parseInt(mtu, 10),
        speed,
        status,
        carrier,
        isManagement,
        description,
      },
    });

    return NextResponse.json({ success: true, data: iface }, { status: 201 });
  } catch (error) {
    console.error('Error creating network interface:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create network interface' } },
      { status: 500 },
    );
  }
}
