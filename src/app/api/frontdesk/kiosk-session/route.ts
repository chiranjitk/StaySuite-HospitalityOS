import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/frontdesk/kiosk-session - Verify booking code for kiosk check-in
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Booking confirmation code is required' } },
        { status: 400 }
      );
    }

    // Find booking by confirmation code
    const booking = await db.booking.findFirst({
      where: {
        confirmationCode: code.toUpperCase().trim(),
        status: 'confirmed',
      },
      include: {
        primaryGuest: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            nationality: true,
            idType: true,
            idNumber: true,
            isVip: true,
          },
        },
        room: {
          select: { id: true, number: true, floor: true, housekeepingStatus: true },
        },
        roomType: {
          select: { id: true, name: true, code: true, basePrice: true },
        },
        property: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            checkInTime: true,
            checkOutTime: true,
          },
        },
        ratePlan: {
          select: { id: true, name: true },
        },
      },
    });

    if (!booking) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'No confirmed booking found with this code' } },
        { status: 404 }
      );
    }

    // Check if check-in date is valid (today or past due check-in)
    const now = new Date();
    const checkInDate = new Date(booking.checkIn);
    const checkOutDate = new Date(booking.checkOut);
    checkInDate.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);

    // Allow check-in from 1 day before check-in date up to check-out date
    const oneDayBeforeCheckIn = new Date(checkInDate);
    oneDayBeforeCheckIn.setDate(oneDayBeforeCheckIn.getDate() - 1);

    if (now < oneDayBeforeCheckIn) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'TOO_EARLY',
            message: 'Check-in is not yet available for this booking',
            checkInDate: booking.checkIn,
          },
        },
        { status: 400 }
      );
    }

    if (now > checkOutDate) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'EXPIRED',
            message: 'This booking has already expired',
          },
        },
        { status: 400 }
      );
    }

    // Check if room is assigned
    if (!booking.room) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NO_ROOM',
            message: 'Room has not been assigned yet. Please visit the front desk.',
          },
        },
        { status: 400 }
      );
    }

    // Get WiFi plan for auto-provisioning info
    const wifiPlan = await db.wiFiPlan.findFirst({
      where: {
        tenantId: booking.tenantId,
        status: 'active',
      },
      select: { id: true, name: true, validityDays: true },
      orderBy: { createdAt: 'asc' },
    });

    const nights = Math.ceil(
      (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    return NextResponse.json({
      success: true,
      data: {
        bookingId: booking.id,
        confirmationCode: booking.confirmationCode,
        guest: booking.primaryGuest,
        room: booking.room,
        roomType: booking.roomType,
        property: booking.property,
        ratePlan: booking.ratePlan,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        nights,
        adults: booking.adults,
        children: booking.children,
        totalAmount: booking.totalAmount,
        currency: booking.currency,
        specialRequests: booking.specialRequests,
        wifiPlan: wifiPlan ? { name: wifiPlan.name, validityDays: wifiPlan.validityDays } : null,
      },
    });
  } catch (error) {
    console.error('Error verifying kiosk session:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to verify booking' } },
      { status: 500 }
    );
  }
}
