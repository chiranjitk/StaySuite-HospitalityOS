import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/iot/devices - List all IoT devices
export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Permission check
    if (!hasPermission(user, 'iot.view') && !hasPermission(user, 'devices.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;
    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');
    const roomId = searchParams.get('roomId');
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 100);

    const where: Record<string, unknown> = { tenantId };
    if (propertyId) where.propertyId = propertyId;
    if (roomId) where.roomId = roomId;
    if (type) where.type = type;
    if (status) where.status = status;

    const devices = await db.ioTDevice.findMany({
      where,
      include: {
        property: {
          select: { name: true }
        },
        room: {
          select: { number: true, name: true }
        },
        _count: {
          select: { readings: true, commands: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Get stats
    const stats = await db.ioTDevice.groupBy({
      by: ['status'],
      where: { tenantId },
      _count: true
    });

    const typeStats = await db.ioTDevice.groupBy({
      by: ['type'],
      where: { tenantId },
      _count: true
    });

    return NextResponse.json({
      devices: devices.map(d => ({
        ...d,
        roomName: d.room ? `${d.room.number}${d.room.name ? ` - ${d.room.name}` : ''}` : null,
        currentState: d.currentState ? JSON.parse(d.currentState) : {},
        config: d.config ? JSON.parse(d.config) : {}
      })),
      stats: {
        byStatus: stats.reduce((acc: any, s) => {
          acc[s.status] = s._count;
          return acc;
        }, {}),
        byType: typeStats.reduce((acc: any, t) => {
          acc[t.type] = t._count;
          return acc;
        }, {}),
        total: devices.length,
        online: stats.find(s => s.status === 'online')?._count || 0,
        offline: stats.find(s => s.status === 'offline')?._count || 0,
        error: stats.find(s => s.status === 'error')?._count || 0
      }
    });
  } catch (error) {
    console.error('Error fetching IoT devices:', error);
    return NextResponse.json({ error: 'Failed to fetch IoT devices' }, { status: 500 });
  }
}

// POST /api/iot/devices - Create a new IoT device
export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Permission check
    if (!hasPermission(user, 'iot.manage') && !hasPermission(user, 'devices.manage')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const data = await request.json();
    const {
      propertyId,
      roomId,
      name,
      type,
      manufacturer,
      model,
      serialNumber,
      protocol = 'wifi',
      ipAddress,
      macAddress,
      config = {}
    } = data;

    if (!propertyId || !name || !type) {
      return NextResponse.json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Property ID, name, and type are required' }
      }, { status: 400 });
    }

    // Verify property belongs to user's tenant
    const property = await db.property.findFirst({
      where: { id: propertyId, tenantId: user.tenantId, deletedAt: null },
    });

    if (!property) {
      return NextResponse.json({
        success: false,
        error: { code: 'INVALID_PROPERTY', message: 'Property not found' }
      }, { status: 400 });
    }

    const device = await db.ioTDevice.create({
      data: {
        tenantId: user.tenantId,
        propertyId,
        roomId: roomId || null,
        name,
        type,
        manufacturer,
        model,
        serialNumber,
        protocol,
        ipAddress,
        macAddress,
        config: JSON.stringify(config),
        currentState: JSON.stringify({}),
        status: 'offline'
      },
      include: {
        property: { select: { name: true } },
        room: { select: { number: true, name: true } }
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        ...device,
        currentState: {},
        config
      }
    });
  } catch (error) {
    console.error('Error creating IoT device:', error);
    return NextResponse.json({ error: 'Failed to create IoT device' }, { status: 500 });
  }
}
