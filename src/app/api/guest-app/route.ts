import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/guest-app - Get guest app data by portal token
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Token is required' } },
        { status: 400 }
      );
    }

    // Find booking by portal token
    const booking = await db.booking.findFirst({
      where: {
        portalToken: token,
        status: { in: ['confirmed', 'checked_in'] },
      },
      include: {
        primaryGuest: true,
        room: {
          include: {
            roomType: {
              select: {
                id: true,
                name: true,
                description: true,
                amenities: true,
                basePrice: true,
              },
            },
          },
        },
        roomType: {
          include: {
            property: {
              select: {
                id: true,
                name: true,
                logo: true,
                primaryColor: true,
                secondaryColor: true,
                address: true,
                city: true,
                country: true,
                phone: true,
                email: true,
                checkInTime: true,
                checkOutTime: true,
                timezone: true,
                currency: true,
              },
            },
          },
        },
        folios: {
          where: { status: { in: ['open', 'partially_paid'] } },
          include: {
            lineItems: {
              orderBy: { createdAt: 'desc' },
              take: 20,
            },
            payments: {
              where: { status: 'completed' },
              orderBy: { createdAt: 'desc' },
            },
          },
        },
        guestStays: {
          include: {
            guest: {
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

    if (!booking) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Invalid or expired token' } },
        { status: 404 }
      );
    }

    // Check token expiration
    if (booking.portalTokenExpires && new Date() > booking.portalTokenExpires) {
      return NextResponse.json(
        { success: false, error: { code: 'TOKEN_EXPIRED', message: 'Portal link has expired' } },
        { status: 410 }
      );
    }

    // Calculate stay info
    const now = new Date();
    const checkIn = new Date(booking.checkIn);
    const checkOut = new Date(booking.checkOut);
    const totalNights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
    let nightsRemaining = Math.ceil((checkOut.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (nightsRemaining < 0) nightsRemaining = 0;

    // Calculate bill totals
    const folio = booking.folios[0];
    const totalCharges = folio?.lineItems.reduce((sum, item) => sum + item.totalAmount, 0) || 0;
    const totalPaid = folio?.payments.reduce((sum, payment) => sum + payment.amount, 0) || 0;
    const balanceDue = totalCharges - totalPaid;

    // Get service requests for this booking
    const serviceRequests = await db.serviceRequest.findMany({
      where: {
        bookingId: booking.id,
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    // Parse preferences
    let preferences = {};
    try {
      preferences = booking.preferences ? JSON.parse(booking.preferences) : {};
    } catch {
      preferences = {};
    }

    // Parse amenities
    let amenities: string[] = [];
    try {
      amenities = booking.roomType?.amenities ? JSON.parse(booking.roomType.amenities) : [];
    } catch {
      amenities = [];
    }

    const guestAppData = {
      booking: {
        id: booking.id,
        confirmationCode: booking.confirmationCode,
        status: booking.status,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        checkInTime: booking.roomType?.property?.checkInTime || '14:00',
        checkOutTime: booking.roomType?.property?.checkOutTime || '11:00',
        adults: booking.adults,
        children: booking.children,
        infants: booking.infants,
        totalNights,
        nightsRemaining,
        specialRequests: booking.specialRequests,
      },
      guest: {
        id: booking.primaryGuest.id,
        firstName: booking.primaryGuest.firstName,
        lastName: booking.primaryGuest.lastName,
        email: booking.primaryGuest.email,
        phone: booking.primaryGuest.phone,
        nationality: booking.primaryGuest.nationality,
        loyaltyTier: booking.primaryGuest.loyaltyTier,
        loyaltyPoints: booking.primaryGuest.loyaltyPoints,
        isVip: booking.primaryGuest.isVip,
        preferences,
      },
      room: booking.room ? {
        id: booking.room.id,
        number: booking.room.number,
        floor: booking.room.floor,
        status: booking.room.status,
        digitalKeyEnabled: booking.room.digitalKeyEnabled,
        digitalKeyAvailable: !!booking.room.digitalKeySecret,
      } : null,
      roomType: {
        id: booking.roomType?.id,
        name: booking.roomType?.name,
        description: booking.roomType?.description,
        amenities,
        basePrice: booking.roomType?.basePrice,
      },
      property: booking.roomType?.property ? {
        id: booking.roomType.property.id,
        name: booking.roomType.property.name,
        logo: booking.roomType.property.logo,
        primaryColor: booking.roomType.property.primaryColor,
        secondaryColor: booking.roomType.property.secondaryColor,
        address: booking.roomType.property.address,
        city: booking.roomType.property.city,
        country: booking.roomType.property.country,
        phone: booking.roomType.property.phone,
        email: booking.roomType.property.email,
        timezone: booking.roomType.property.timezone,
        currency: booking.roomType.property.currency,
      } : null,
      bill: {
        totalCharges,
        totalPaid,
        balanceDue,
        currency: booking.roomType?.property?.currency || 'USD',
        recentCharges: folio?.lineItems.slice(0, 5).map(item => ({
          id: item.id,
          description: item.description,
          category: item.category,
          amount: item.totalAmount,
          date: item.serviceDate,
        })) || [],
      },
      recentRequests: serviceRequests.map(req => ({
        id: req.id,
        type: req.type,
        subject: req.subject,
        status: req.status,
        createdAt: req.createdAt,
      })),
      additionalGuests: booking.guestStays
        .filter(stay => stay.guestId !== booking.primaryGuestId)
        .map(stay => stay.guest),
    };

    return NextResponse.json({
      success: true,
      data: guestAppData,
    });
  } catch (error) {
    console.error('Error fetching guest app data:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch guest app data' } },
      { status: 500 }
    );
  }
}
