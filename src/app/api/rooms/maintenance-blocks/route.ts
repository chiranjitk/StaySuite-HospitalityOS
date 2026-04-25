import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

// GET /api/rooms/maintenance-blocks?propertyId=xxx - List maintenance blocks
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['rooms.manage', 'rooms.view', 'admin.*', 'housekeeping.manage'])) {
      return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
    }
    const tenantId = user.tenantId;

    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');
    const status = searchParams.get('status');

    const where: Record<string, unknown> = { tenantId };

    if (propertyId) where.propertyId = propertyId;
    if (status && status !== 'all') where.status = status;

    const blocks = await db.maintenanceBlock.findMany({
      where,
      include: {
        room: {
          select: {
            id: true,
            number: true,
            name: true,
            floor: true,
            status: true,
            roomType: {
              select: { id: true, name: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: blocks });
  } catch (error) {
    console.error('Error fetching maintenance blocks:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch maintenance blocks' } },
      { status: 500 }
    );
  }
}

// POST /api/rooms/maintenance-blocks - Create maintenance block
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['rooms.manage', 'admin.*', 'housekeeping.manage'])) {
      return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
    }
    const tenantId = user.tenantId;

    const body = await request.json();
    const {
      roomId,
      reason,
      description,
      startDate,
      endDate,
      priority,
      estimatedCost,
      vendorId,
      notes,
    } = body;

    if (!roomId || !reason || !startDate) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: roomId, reason, startDate' } },
        { status: 400 }
      );
    }

    const validReasons = ['maintenance', 'renovation', 'deep_cleaning', 'inspection', 'quarantine'];
    if (!validReasons.includes(reason)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid reason. Must be one of: ${validReasons.join(', ')}` } },
        { status: 400 }
      );
    }

    const validPriorities = ['normal', 'high', 'urgent'];
    if (priority && !validPriorities.includes(priority)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid priority. Must be one of: ${validPriorities.join(', ')}` } },
        { status: 400 }
      );
    }

    // Verify room exists and get property info
    const room = await db.room.findFirst({
      where: { id: roomId },
      include: { property: { select: { id: true, tenantId: true } } },
    });

    if (!room || room.property.tenantId !== tenantId) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Room not found' } }, { status: 404 });
    }

    if (room.status === 'maintenance') {
      return NextResponse.json(
        { success: false, error: { code: 'ALREADY_BLOCKED', message: 'Room is already under maintenance' } },
        { status: 400 }
      );
    }

    // Check for overlapping active blocks
    const overlapping = await db.maintenanceBlock.findFirst({
      where: {
        roomId,
        status: { in: ['scheduled', 'active'] },
        startDate: { lte: endDate ? new Date(endDate) : new Date('2100-01-01') },
        endDate: startDate ? { gte: new Date(startDate) } : undefined,
      },
    });

    if (overlapping) {
      return NextResponse.json(
        { success: false, error: { code: 'OVERLAP', message: 'Room already has an active or scheduled block for this period' } },
        { status: 400 }
      );
    }

    const block = await db.$transaction(async (tx) => {
      const maintenanceBlock = await tx.maintenanceBlock.create({
        data: {
          tenantId,
          propertyId: room.propertyId,
          roomId,
          roomNumber: room.number,
          reason,
          description: description || null,
          startDate: new Date(startDate),
          endDate: endDate ? new Date(endDate) : null,
          blockedBy: user.id,
          status: new Date(startDate) <= new Date() ? 'active' : 'scheduled',
          priority: priority || 'normal',
          vendorId: vendorId || null,
          estimatedCost: estimatedCost ? parseFloat(String(estimatedCost)) : null,
          notes: notes || null,
        },
      });

      // Update room status if block is active
      if (maintenanceBlock.status === 'active') {
        await tx.room.update({
          where: { id: roomId },
          data: { status: 'maintenance' },
        });
      }

      return maintenanceBlock;
    });

    return NextResponse.json({ success: true, data: block }, { status: 201 });
  } catch (error) {
    console.error('Error creating maintenance block:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create maintenance block' } },
      { status: 500 }
    );
  }
}
