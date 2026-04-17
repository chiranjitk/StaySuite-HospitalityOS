import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTenantIdFromSession } from '@/lib/auth/tenant-context';

// POST /api/waitlist/auto-process - Auto-process waitlist entries when rooms become available
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const tenantId = await getTenantIdFromSession(request);
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }
    const body = await request.json();
    const { roomTypeId, checkIn, checkOut, propertyId } = body;

    // Validate required fields
    if (!roomTypeId || !checkIn || !checkOut || !propertyId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'roomTypeId, checkIn, checkOut, and propertyId are required' } },
        { status: 400 }
      );
    }

    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    if (checkInDate >= checkOutDate) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Check-out must be after check-in' } },
        { status: 400 }
      );
    }

    // Find waiting entries for this room type where the date range overlaps
    const waitingEntries = await db.waitlistEntry.findMany({
      where: {
        roomTypeId,
        propertyId,
        tenantId,
        status: 'waiting',
        checkIn: { lt: checkOutDate },
        checkOut: { gt: checkInDate },
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' },
      ],
    });

    if (waitingEntries.length === 0) {
      return NextResponse.json({
        success: true,
        data: { processedCount: 0 },
        message: 'No waiting entries found for the specified criteria',
      });
    }

    // Get total available rooms for this room type
    const totalRooms = await db.room.count({
      where: { propertyId, roomTypeId },
    });

    // Count existing bookings that overlap with the date range
    const overlappingBookings = await db.booking.count({
      where: {
        propertyId,
        roomTypeId,
        status: { in: ['confirmed', 'checked_in'] },
        checkIn: { lt: checkOutDate },
        checkOut: { gt: checkInDate },
      },
    });

    // Count already notified waitlist entries (they have "reserved" a spot)
    const notifiedEntries = await db.waitlistEntry.count({
      where: {
        roomTypeId,
        propertyId,
        tenantId,
        status: 'notified',
        checkIn: { lt: checkOutDate },
        checkOut: { gt: checkInDate },
      },
    });

    let availableRooms = Math.max(0, totalRooms - overlappingBookings - notifiedEntries);

    let processedCount = 0;

    for (const entry of waitingEntries) {
      if (availableRooms <= 0) break;

      // Check if this entry's date range can be satisfied
      const entryOverlapBookings = await db.booking.count({
        where: {
          propertyId,
          roomTypeId,
          status: { in: ['confirmed', 'checked_in'] },
          checkIn: { lt: entry.checkOut },
          checkOut: { gt: entry.checkIn },
        },
      });

      const entryOverlapNotified = await db.waitlistEntry.count({
        where: {
          roomTypeId,
          propertyId,
          tenantId,
          status: 'notified',
          checkIn: { lt: entry.checkOut },
          checkOut: { gt: entry.checkIn },
          id: { not: entry.id },
        },
      });

      const entryAvailable = totalRooms - entryOverlapBookings - entryOverlapNotified;

      if (entryAvailable > 0) {
        // Mark as notified
        await db.waitlistEntry.update({
          where: { id: entry.id },
          data: { status: 'notified' },
        });

        // Create a notification for the guest
        await db.notification.create({
          data: {
            tenantId,
            userId: entry.guestId,
            type: 'waitlist',
            category: 'success',
            title: 'Room Available!',
            message: `A ${entry.adults > 0 ? '' : ''}room matching your waitlist request is now available for ${entry.checkIn.toLocaleDateString()} - ${entry.checkOut.toLocaleDateString()}.`,
            priority: 'high',
            actionType: 'view',
            link: `/bookings/new?roomTypeId=${entry.roomTypeId}&checkIn=${entry.checkIn.toISOString().split('T')[0]}&checkOut=${entry.checkOut.toISOString().split('T')[0]}`,
          },
        });

        availableRooms--;
        processedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        processedCount,
        totalWaiting: waitingEntries.length,
        totalRooms,
        overlappingBookings,
        notifiedEntries,
      },
      message: processedCount > 0
        ? `Processed ${processedCount} waitlist entry/entries`
        : 'No entries could be processed - insufficient room availability',
    });
  } catch (error) {
    console.error('Error auto-processing waitlist:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to auto-process waitlist' } },
      { status: 500 }
    );
  }
}
