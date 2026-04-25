import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

// POST /api/group-bookings/book-rooms - Book rooms for a group
export async function POST(request: NextRequest) {    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['bookings.manage', 'admin.bookings', 'admin.*'])) {
      return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
    }


  try {
    const body = await request.json();
    const { groupId, roomIds, guestId } = body;

    if (!groupId || !roomIds || !Array.isArray(roomIds) || roomIds.length === 0 || !guestId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields' } },
        { status: 400 }
      );
    }

    // Get the group booking and verify tenant
    const group = await db.groupBooking.findFirst({
      where: { 
        id: groupId,
        tenantId: user.tenantId,
      },
    });

    if (!group) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Group booking not found' } },
        { status: 404 }
      );
    }

    // Verify guest exists
    const guest = await db.guest.findUnique({
      where: { id: guestId },
    });

    if (!guest) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Guest not found' } },
        { status: 404 }
      );
    }

    // Get rooms with their types and verify they belong to same property
    const rooms = await db.room.findMany({
      where: { 
        id: { in: roomIds },
        roomType: { propertyId: group.propertyId },
      },
      include: { roomType: true },
    });

    if (rooms.length !== roomIds.length) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Some rooms not found or not available for this property' } },
        { status: 400 }
      );
    }

    // Check for conflicts
    const existingBookings = await db.booking.findMany({
      where: {
        roomId: { in: roomIds },
        status: { in: ['confirmed', 'checked_in'] },
        OR: [
          {
            AND: [
              { checkIn: { lt: group.checkOut } },
              { checkOut: { gt: group.checkIn } },
            ],
          },
        ],
      },
    });

    if (existingBookings.length > 0) {
      return NextResponse.json(
        { success: false, error: { code: 'CONFLICT', message: 'Some rooms have conflicting bookings' } },
        { status: 409 }
      );
    }

    // FIX 2: Wrap all booking creation + group update in a transaction
    // so that a failure partway through rolls back all created bookings
    const nights = Math.ceil(
      (new Date(group.checkOut).getTime() - new Date(group.checkIn).getTime()) / (1000 * 60 * 60 * 24)
    );

    const bookings = await db.$transaction(async (tx) => {
      const createdBookings: any[] = [];

      for (let i = 0; i < rooms.length; i++) {
        const room = rooms[i];
        const confirmationCode = `GRP-${group.name.substring(0, 3).toUpperCase()}-${Date.now()}-${i}`;

        const booking = await tx.booking.create({
          data: {
            tenantId: group.tenantId,
            propertyId: group.propertyId,
            confirmationCode,
            primaryGuestId: guestId,
            roomId: room.id,
            roomTypeId: room.roomTypeId,
            checkIn: new Date(group.checkIn),
            checkOut: new Date(group.checkOut),
            adults: 1,
            roomRate: room.roomType?.basePrice || 0,
            totalAmount: (room.roomType?.basePrice || 0) * nights,
            source: 'group',
            status: 'confirmed',
            groupId: group.id,
            isGroupLeader: i === 0,
          },
          include: {
            room: { select: { number: true } },
            roomType: { select: { name: true } },
            primaryGuest: { select: { firstName: true, lastName: true } },
          },
        });

        createdBookings.push(booking);
      }

      // Update group's totalRooms if needed
      const currentBookedCount = await tx.booking.count({
        where: { groupId: group.id },
      });

      await tx.groupBooking.update({
        where: { id: groupId },
        data: {
          totalRooms: Math.max(group.totalRooms, currentBookedCount),
        },
      });

      return createdBookings;
    });

    return NextResponse.json({
      success: true,
      data: bookings,
      message: `Successfully booked ${bookings.length} room(s)`,
    });
  } catch (error) {
    console.error('Error booking rooms:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to book rooms' } },
      { status: 500 }
    );
  }
}
