import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { emitRoomStatusChange } from '@/lib/availability-client';
import { logRoom } from '@/lib/audit';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// Room status transition validation
const VALID_TRANSITIONS: Record<string, string[]> = {
  available: ['occupied', 'dirty', 'maintenance', 'out_of_order'],
  occupied: ['dirty', 'available', 'maintenance', 'out_of_order'],
  dirty: ['cleaning', 'maintenance', 'out_of_order'],
  cleaning: ['inspected', 'dirty', 'maintenance', 'available'],
  inspected: ['available', 'dirty'],
  maintenance: ['available', 'dirty', 'out_of_order'],
  out_of_order: ['available', 'maintenance'],
};

// GET /api/rooms/[id] - Get a single room
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // RBAC check
    if (!hasPermission(user, 'rooms.view') && !hasPermission(user, 'rooms.*') && !hasPermission(user, 'housekeeping.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const { id } = await params;
    
    const room = await db.room.findUnique({
      where: { id, deletedAt: null },
      include: {
        roomType: {
          select: {
            id: true,
            name: true,
            code: true,
            basePrice: true,
            currency: true,
            maxAdults: true,
            maxChildren: true,
            maxOccupancy: true,
            amenities: true,
          },
        },
        property: {
          select: {
            id: true,
            name: true,
            currency: true,
            tenantId: true,
          },
        },
        bookings: {
          where: {
            status: {
              in: ['confirmed', 'checked_in'],
            },
          },
          take: 1,
          orderBy: {
            checkIn: 'desc',
          },
          include: {
            primaryGuest: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
              },
            },
          },
        },
      },
    });
    
    if (!room) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Room not found' } },
        { status: 404 }
      );
    }

    // Tenant isolation: verify room belongs to user's tenant via property
    if (room.property?.tenantId && room.property.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        ...room,
        roomType: {
          ...room.roomType,
          amenities: JSON.parse(room.roomType.amenities),
        },
        currentBooking: room.bookings[0] || null,
      },
    });
  } catch (error) {
    console.error('Error fetching room:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch room' } },
      { status: 500 }
    );
  }
}

// PUT /api/rooms/[id] - Update a room
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }
    if (!hasPermission(user, 'rooms.manage') && !hasPermission(user, 'rooms.*') && user.roleName !== 'admin') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    
    const existingRoom = await db.room.findUnique({
      where: { id, deletedAt: null },
    });
    
    if (!existingRoom) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Room not found' } },
        { status: 404 }
      );
    }

    // Tenant isolation: verify room belongs to user's tenant via property
    const roomProperty = await db.property.findUnique({
      where: { id: existingRoom.propertyId },
      select: { tenantId: true },
    });
    if (roomProperty && roomProperty.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Not found' } },
        { status: 404 }
      );
    }

    // Capture old values for audit
    const oldValue = {
      number: existingRoom.number,
      floor: existingRoom.floor,
      status: existingRoom.status,
      roomTypeId: existingRoom.roomTypeId,
    };
    
    const {
      roomTypeId,
      number,
      name,
      floor,
      isAccessible,
      isSmoking,
      hasBalcony,
      hasSeaView,
      hasMountainView,
      status,
      digitalKeyEnabled,
      smartRoomConfig,
      images,
    } = body;

    // Validate room status transition
    if (status && status !== existingRoom.status) {
      const allowed = VALID_TRANSITIONS[existingRoom.status];
      if (!allowed || !allowed.includes(status)) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_STATUS_TRANSITION', message: `Cannot transition room status from '${existingRoom.status}' to '${status}'` } },
          { status: 400 }
        );
      }
    }

    // If number is being changed, check for conflicts
    if (number && number !== existingRoom.number) {
      const numberConflict = await db.room.findUnique({
        where: {
          propertyId_number: {
            propertyId: existingRoom.propertyId,
            number,
          },
        },
      });
      
      if (numberConflict) {
        return NextResponse.json(
          { success: false, error: { code: 'DUPLICATE_NUMBER', message: 'A room with this number already exists' } },
          { status: 400 }
        );
      }
    }
    
    // If roomTypeId is being changed, verify it exists and belongs to this property
    if (roomTypeId && roomTypeId !== existingRoom.roomTypeId) {
      const roomType = await db.roomType.findFirst({
        where: {
          id: roomTypeId,
          propertyId: existingRoom.propertyId,
          deletedAt: null,
        },
      });
      
      if (!roomType) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_ROOM_TYPE', message: 'Room type not found or does not belong to this property' } },
          { status: 400 }
        );
      }
      
      // Update room counts
      await db.roomType.update({
        where: { id: existingRoom.roomTypeId },
        data: { totalRooms: { decrement: 1 } },
      });
      
      await db.roomType.update({
        where: { id: roomTypeId },
        data: { totalRooms: { increment: 1 } },
      });
    }
    
    const room = await db.room.update({
      where: { id },
      data: {
        ...(roomTypeId && { roomTypeId }),
        ...(number && { number }),
        ...(name !== undefined && { name }),
        ...(floor !== undefined && { floor }),
        ...(isAccessible !== undefined && { isAccessible }),
        ...(isSmoking !== undefined && { isSmoking }),
        ...(hasBalcony !== undefined && { hasBalcony }),
        ...(hasSeaView !== undefined && { hasSeaView }),
        ...(hasMountainView !== undefined && { hasMountainView }),
        ...(status && { status }),
        ...(digitalKeyEnabled !== undefined && { digitalKeyEnabled }),
        ...(smartRoomConfig !== undefined && { smartRoomConfig }),
        ...(images !== undefined && { images }),
      },
      include: {
        roomType: {
          select: {
            id: true,
            name: true,
            code: true,
            basePrice: true,
            currency: true,
          },
        },
        property: {
          select: {
            id: true,
            name: true,
            currency: true,
            tenantId: true,
          },
        },
      },
    });
    
    // Log room update (non-blocking)
    const auditAction = status && status !== existingRoom.status ? 'status_change' : 'update';
    try {
      await logRoom(request, auditAction, room.id, oldValue, {
        number: room.number,
        floor: room.floor,
        status: room.status,
        roomTypeId: room.roomTypeId,
        previousStatus: existingRoom.status,
      }, { tenantId: user.tenantId, userId: user.id });
    } catch (auditError) {
      console.error('Audit log failed (non-blocking):', auditError);
    }
    
    // Emit WebSocket event if status changed
    if (status && status !== existingRoom.status) {
      try {
        // Get tenant ID from the room's property
        const tenantId = room.property.tenantId;
        
        emitRoomStatusChange({
          roomId: id,
          propertyId: room.property.id,
          tenantId: tenantId,
          status: status,
          previousStatus: existingRoom.status,
        });
      } catch (wsError) {
        // Don't fail the request if WebSocket emission fails
        console.error('Failed to emit room status change:', wsError);
      }
    }
    
    return NextResponse.json({ success: true, data: room });
  } catch (error) {
    console.error('Error updating room:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update room' } },
      { status: 500 }
    );
  }
}

// DELETE /api/rooms/[id] - Soft delete a room
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }
    if (!hasPermission(user, 'rooms.manage') && !hasPermission(user, 'rooms.*') && user.roleName !== 'admin') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const { id } = await params;
    
    const existingRoom = await db.room.findUnique({
      where: { id, deletedAt: null },
      include: {
        bookings: {
          where: {
            status: {
              in: ['confirmed', 'checked_in'],
            },
          },
        },
      },
    });
    
    if (!existingRoom) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Room not found' } },
        { status: 404 }
      );
    }

    // Tenant isolation
    const delProperty = await db.property.findUnique({
      where: { id: existingRoom.propertyId },
      select: { tenantId: true },
    });
    if (delProperty && delProperty.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Not found' } },
        { status: 404 }
      );
    }

    // Check if room has active bookings
    if (existingRoom.bookings.length > 0) {
      return NextResponse.json(
        { success: false, error: { code: 'HAS_BOOKINGS', message: 'Cannot delete room with active bookings' } },
        { status: 400 }
      );
    }
    
    // Capture old values for audit
    const oldValue = {
      number: existingRoom.number,
      floor: existingRoom.floor,
      status: existingRoom.status,
    };
    
    // Soft delete
    await db.room.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    
    // Atomically update counts on room type and property
    await db.$transaction([
      db.roomType.update({
        where: { id: existingRoom.roomTypeId },
        data: { totalRooms: { decrement: 1 } },
      }),
      db.property.update({
        where: { id: existingRoom.propertyId },
        data: { totalRooms: { decrement: 1 } },
      }),
    ]);
    
    // Log room deletion (non-blocking)
    try {
      await logRoom(request, 'delete', id, oldValue, undefined, { tenantId: user.tenantId, userId: user.id });
    } catch (auditError) {
      console.error('Audit log failed (non-blocking):', auditError);
    }
    
    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error('Error deleting room:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete room' } },
      { status: 500 }
    );
  }
}
