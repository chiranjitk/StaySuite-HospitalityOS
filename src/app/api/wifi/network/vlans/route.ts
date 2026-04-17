/**
 * VLANs API Route
 *
 * List and create VLAN configurations.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

// GET /api/wifi/network/vlans - List all VLANs
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');
    const parentInterfaceId = searchParams.get('parentInterfaceId');
    const enabled = searchParams.get('enabled');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    const where: Record<string, unknown> = { tenantId: user.tenantId };

    if (propertyId) where.propertyId = propertyId;
    if (parentInterfaceId) where.parentInterfaceId = parentInterfaceId;
    if (enabled !== null) where.enabled = enabled === 'true';

    const [vlans, total] = await Promise.all([
      db.vlanConfig.findMany({
        where,
        include: {
          parentInterface: {
            select: { id: true, name: true, type: true, status: true },
          },
          dhcpSubnets: {
            include: {
              _count: {
                select: {
                  reservations: true,
                  leases: true,
                },
              },
            },
          },
          _count: {
            select: {
              dhcpSubnets: true,
            },
          },
        },
        orderBy: [{ vlanId: 'asc' }],
        ...(limit && { take: parseInt(limit, 10) }),
        ...(offset && { skip: parseInt(offset, 10) }),
      }),
      db.vlanConfig.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: vlans,
      pagination: {
        total,
        limit: limit ? parseInt(limit, 10) : null,
        offset: offset ? parseInt(offset, 10) : null,
      },
    });
  } catch (error) {
    console.error('Error fetching VLANs:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch VLANs' } },
      { status: 500 },
    );
  }
}

// POST /api/wifi/network/vlans - Create VLAN
export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const tenantId = user.tenantId;

    const {
      propertyId,
      parentInterfaceId,
      parentInterfaceName,
      vlanId,
      subInterface,
      description,
      mtu = 1500,
      enabled = true,
    } = body;

    if (!propertyId || vlanId === undefined || !subInterface) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Missing required fields: propertyId, vlanId, subInterface',
          },
        },
        { status: 400 },
      );
    }

    // Resolve parent interface: try CUID, then by name
    let parentRecord = await db.networkInterface.findFirst({
      where: { id: parentInterfaceId || '', tenantId },
    });

    if (!parentRecord && parentInterfaceId) {
      parentRecord = await db.networkInterface.findFirst({
        where: { name: parentInterfaceId, tenantId },
      });
    }

    if (!parentRecord && parentInterfaceName) {
      parentRecord = await db.networkInterface.findFirst({
        where: { name: parentInterfaceName, tenantId },
      });
    }

    if (!parentRecord) {
      const ifaceName = subInterface.split('.')[0];
      parentRecord = await db.networkInterface.findFirst({
        where: { name: ifaceName, tenantId },
      });
    }

    const parentIfaceName = parentRecord?.name
      || parentInterfaceName
      || (subInterface.includes('.') ? subInterface.split('.')[0] : null)
      || parentInterfaceId;

    if (!parentIfaceName) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Cannot determine parent interface name' } },
        { status: 400 },
      );
    }

    // Check for duplicate VLAN ID within property
    const existingVlanId = await db.vlanConfig.findFirst({
      where: { propertyId, vlanId: parseInt(vlanId, 10), tenantId },
    });

    if (existingVlanId) {
      return NextResponse.json(
        { success: false, error: { code: 'DUPLICATE_VLAN', message: 'A VLAN with this ID already exists on this property' } },
        { status: 400 },
      );
    }

    // Check for duplicate sub-interface name within property
    const existingSub = await db.vlanConfig.findFirst({
      where: { propertyId, subInterface, tenantId },
    });

    if (existingSub) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'DUPLICATE_SUBIF', message: 'A sub-interface with this name already exists on this property' },
        },
        { status: 400 },
      );
    }

    // Create VLAN with connectOrCreate for parent interface
    // NOTE: When using relation connect, do NOT also pass scalar FK fields (tenantId/propertyId)
    const vlan = await db.vlanConfig.create({
      data: {
        tenant: { connect: { id: tenantId } },
        property: { connect: { id: propertyId } },
        parentInterface: {
          connectOrCreate: {
            where: {
              propertyId_name: {
                propertyId,
                name: parentIfaceName,
              },
            },
            create: {
              tenant: { connect: { id: tenantId } },
              property: { connect: { id: propertyId } },
              name: parentIfaceName,
              type: 'ethernet',
              status: 'up',
              hwAddress: '',
              mtu: 1500,
            },
          },
        },
        vlanId: parseInt(vlanId, 10),
        subInterface,
        description,
        mtu: parseInt(mtu, 10),
        enabled,
      },
      include: {
        parentInterface: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json({ success: true, data: vlan }, { status: 201 });
  } catch (error) {
    console.error('Error creating VLAN:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create VLAN' } },
      { status: 500 },
    );
  }
}
