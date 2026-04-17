import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/iot/devices/[id] - Get a single IoT device
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    const device = await db.ioTDevice.findUnique({
      where: { id },
      include: {
        property: { select: { id: true, name: true } },
        room: { 
          select: { id: true, number: true, name: true, roomType: { select: { name: true } } }
        },
        readings: {
          orderBy: { timestamp: 'desc' },
          take: 100
        },
        commands: {
          orderBy: { createdAt: 'desc' },
          take: 50
        }
      }
    });

    if (!device) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Device not found' } }, { status: 404 });
    }

    // Verify device belongs to user's tenant
    if (device.tenantId !== user.tenantId) {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } }, { status: 403 });
    }

    return NextResponse.json({
      ...device,
      currentState: device.currentState ? JSON.parse(device.currentState) : {},
      config: device.config ? JSON.parse(device.config) : {},
      readings: device.readings.map(r => ({
        ...r,
        value: Number(r.value)
      })),
      commands: device.commands.map(c => ({
        ...c,
        parameters: c.parameters ? JSON.parse(c.parameters) : {}
      }))
    });
  } catch (error) {
    console.error('Error fetching IoT device:', error);
    return NextResponse.json({ error: 'Failed to fetch IoT device' }, { status: 500 });
  }
}

// PUT /api/iot/devices/[id] - Update an IoT device
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const data = await request.json();

    // Verify device belongs to user's tenant
    const existingDevice = await db.ioTDevice.findUnique({
      where: { id },
    });

    if (!existingDevice) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Device not found' } }, { status: 404 });
    }

    if (existingDevice.tenantId !== user.tenantId) {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } }, { status: 403 });
    }

    const updateData: Record<string, unknown> = {};
    
    if (data.name !== undefined) updateData.name = data.name;
    if (data.roomId !== undefined) updateData.roomId = data.roomId;
    if (data.manufacturer !== undefined) updateData.manufacturer = data.manufacturer;
    if (data.model !== undefined) updateData.model = data.model;
    if (data.serialNumber !== undefined) updateData.serialNumber = data.serialNumber;
    if (data.protocol !== undefined) updateData.protocol = data.protocol;
    if (data.ipAddress !== undefined) updateData.ipAddress = data.ipAddress;
    if (data.macAddress !== undefined) updateData.macAddress = data.macAddress;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.firmwareVersion !== undefined) updateData.firmwareVersion = data.firmwareVersion;
    if (data.lastHeartbeat !== undefined) updateData.lastHeartbeat = new Date(data.lastHeartbeat);
    if (data.config !== undefined) updateData.config = JSON.stringify(data.config);
    if (data.currentState !== undefined) updateData.currentState = JSON.stringify(data.currentState);

    const device = await db.ioTDevice.update({
      where: { id },
      data: updateData,
      include: {
        property: { select: { name: true } },
        room: { select: { number: true, name: true } }
      }
    });

    return NextResponse.json({
      ...device,
      currentState: device.currentState ? JSON.parse(device.currentState) : {},
      config: device.config ? JSON.parse(device.config) : {}
    });
  } catch (error) {
    console.error('Error updating IoT device:', error);
    return NextResponse.json({ error: 'Failed to update IoT device' }, { status: 500 });
  }
}

// DELETE /api/iot/devices/[id] - Delete an IoT device
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    // Verify device belongs to user's tenant
    const device = await db.ioTDevice.findUnique({
      where: { id },
    });

    if (!device) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Device not found' } }, { status: 404 });
    }

    if (device.tenantId !== user.tenantId) {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } }, { status: 403 });
    }

    // Delete associated readings first (cascade)
    await db.ioTReading.deleteMany({
      where: { deviceId: id }
    });

    // Delete associated commands
    await db.ioTCommand.deleteMany({
      where: { deviceId: id }
    });

    // Delete the device
    await db.ioTDevice.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting IoT device:', error);
    return NextResponse.json({ error: 'Failed to delete IoT device' }, { status: 500 });
  }
}
