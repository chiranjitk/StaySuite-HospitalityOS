import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';// GET /api/rooms/available - Get available rooms for date range
export async function GET(request: NextRequest) {
  try {
    const user = await requirePermission(request, 'rooms.view');
    if (user instanceof NextResponse) return user;

    

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');
    const checkIn = searchParams.get('checkIn');
    const checkOut = searchParams.get('checkOut');

    if (!propertyId || !checkIn || !checkOut) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required parameters' } },
        { status: 400 }
      );
    }

    // Verify property belongs to tenant before querying rooms
    const property = await db.property.findFirst({ where: { id: propertyId, tenantId } });
    if (!property) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Property not found' } },
        { status: 404 }
      );
    }

    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    // Get all rooms for the property that are not out of order or under maintenance
    const allRooms = await db.room.findMany({
      where: {
        propertyId,
        deletedAt: null,
      },
      include: {
        roomType: {
          select: { id: true, name: true, basePrice: true, code: true },
        },
      },
    });

    // Get room IDs that have overlapping bookings
    const overlappingBookings = await db.booking.findMany({
      where: {
        propertyId,
        status: { notIn: ['cancelled', 'checked_out', 'no_show'] },
        roomId: { not: null },
        OR: [
          {
            AND: [
              { checkIn: { lt: checkOutDate } },
              { checkOut: { gt: checkInDate } },
            ],
          },
        ],
      },
      select: { roomId: true },
    });

    const bookedRoomIds = new Set(
      overlappingBookings.map(b => b.roomId).filter(Boolean) as string[]
    );

    // Filter to get available rooms
    // A room is available if:
    // 1. It's not in bookedRoomIds
    // 2. Its status is not 'out_of_order' or 'maintenance'
    const availableRooms = allRooms.filter(room => 
      !bookedRoomIds.has(room.id) &&
      room.status !== 'out_of_order' &&
      room.status !== 'maintenance'
    );

    return NextResponse.json({
      success: true,
      data: availableRooms,
      meta: {
        totalRooms: allRooms.length,
        bookedRooms: bookedRoomIds.size,
        availableRooms: availableRooms.length,
      },
    });
  } catch (error) {
    console.error('Error fetching available rooms:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch available rooms' } },
      { status: 500 }
    );
  }
}
