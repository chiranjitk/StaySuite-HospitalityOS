import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST /api/frontdesk/kiosk-checkin - Process express check-in from kiosk
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { bookingId, idVerified, termsAccepted } = body;

    if (!bookingId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'bookingId is required' } },
        { status: 400 }
      );
    }

    if (!idVerified) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'ID verification is required for express check-in' } },
        { status: 400 }
      );
    }

    if (!termsAccepted) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Terms must be accepted to proceed' } },
        { status: 400 }
      );
    }

    // Fetch booking with all needed relations
    const booking = await db.booking.findFirst({
      where: { id: bookingId, status: 'confirmed' },
      include: {
        primaryGuest: { select: { id: true, firstName: true, lastName: true } },
        room: { select: { id: true, number: true, floor: true, status: true } },
        property: { select: { id: true, name: true } },
      },
    });

    if (!booking) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'No confirmed booking found' } },
        { status: 404 }
      );
    }

    if (!booking.room) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_ROOM', message: 'No room assigned to this booking' } },
        { status: 400 }
      );
    }

    // Process everything in a transaction
    const result = await db.$transaction(async (tx) => {
      // 1. Update booking status
      const updatedBooking = await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: 'checked_in',
          actualCheckIn: new Date(),
          checkedInBy: 'kiosk-self-service',
        },
        include: {
          primaryGuest: { select: { id: true, firstName: true, lastName: true, email: true } },
          room: { select: { id: true, number: true, floor: true } },
          roomType: { select: { id: true, name: true } },
          property: { select: { id: true, name: true } },
        },
      });

      // 2. Update room status to occupied
      if (!booking.room) throw new Error('No room assigned');
      await tx.room.update({
        where: { id: booking.room.id },
        data: { status: 'occupied' },
      });

      // 3. Create booking audit log
      await tx.bookingAuditLog.create({
        data: {
          bookingId,
          action: 'express_checkin',
          oldStatus: 'confirmed',
          newStatus: 'checked_in',
          notes: 'Express check-in via self-service kiosk',
          performedBy: 'kiosk-self-service',
        },
      });

      // 4. Auto-provision WiFi
      let wifiCredentials: { username: string; password: string; validUntil: string } | null = null;

      const wifiPlan = await tx.wiFiPlan.findFirst({
        where: {
          tenantId: booking.tenantId,
          status: 'active',
        },
        select: { id: true, name: true, validityDays: true, sessionLimit: true, dataLimit: true },
        orderBy: { createdAt: 'asc' },
      });

      if (wifiPlan) {
        const guest = booking.primaryGuest;
        const username = `guest_${guest.id.slice(-6).toLowerCase()}`;
        const password = Math.random().toString(36).slice(2, 10).toUpperCase();

        // Calculate validUntil: max of checkout+12h and now+validityDays*24h
        const checkoutPlus12h = new Date(booking.checkOut.getTime() + 12 * 60 * 60 * 1000);
        const nowPlusValidity = new Date(Date.now() + (wifiPlan.validityDays || 1) * 24 * 60 * 60 * 1000);
        const validUntil = new Date(Math.max(checkoutPlus12h.getTime(), nowPlusValidity.getTime()));

        // Create WiFi user
        await tx.wiFiUser.create({
          data: {
            tenantId: booking.tenantId,
            propertyId: booking.propertyId,
            username,
            password,
            planId: wifiPlan.id,
            guestId: guest.id,
            bookingId,
            status: 'active',
            validFrom: new Date(),
            validUntil,
            maxSessions: wifiPlan.sessionLimit || 1,
          },
        });

        wifiCredentials = {
          username,
          password,
          validUntil: validUntil.toISOString(),
        };
      }

      return {
        booking: updatedBooking,
        wifiCredentials,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        roomNumber: result.booking.room?.number,
        roomFloor: result.booking.room?.floor,
        roomType: result.booking.roomType?.name,
        propertyName: result.booking.property?.name,
        guestName: `${result.booking.primaryGuest.firstName} ${result.booking.primaryGuest.lastName}`,
        checkInTime: result.booking.actualCheckIn,
        wifiCredentials: result.wifiCredentials,
      },
    });
  } catch (error) {
    console.error('Error processing kiosk check-in:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to process check-in' } },
      { status: 500 }
    );
  }
}
