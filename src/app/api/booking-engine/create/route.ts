import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import crypto, { randomBytes } from 'crypto';
import { calculatePrice } from '@/lib/pricing';
import { emailService } from '@/lib/services/email-service';

// In-memory rate limiting (5 bookings per IP per 15 minutes)
const bookingRateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkBookingRateLimit(identifier: string, maxAttempts: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = bookingRateLimitMap.get(identifier);
  if (!entry || now > entry.resetAt) {
    bookingRateLimitMap.set(identifier, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxAttempts) {
    return false;
  }
  entry.count++;
  return true;
}

function getBookingRateLimitReset(identifier: string): number | null {
  const entry = bookingRateLimitMap.get(identifier);
  if (!entry) return null;
  return Math.ceil((entry.resetAt - Date.now()) / 1000);
}

// Helper function to generate confirmation code
function generateConfirmationCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(crypto.randomInt(0, chars.length));
  }
  return code;
}

// Helper function to generate secure token
function generateSecureToken(): string {
  return randomBytes(32).toString('hex');
}

// POST - Public booking creation (no auth required)
export async function POST(request: NextRequest) {
  try {
    // Rate limit check (5 bookings per IP per 15 minutes)
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                     request.headers.get('x-real-ip') || 'unknown';
    if (!checkBookingRateLimit(clientIp, 5, 15 * 60 * 1000)) {
      const retryAfter = getBookingRateLimitReset(clientIp) || 900;
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please try again later.', retryAfter },
        { status: 429, headers: { 'Retry-After': String(retryAfter) } }
      );
    }

    const body = await request.json();
    const {
      propertyId,
      roomTypeId,
      ratePlanId,
      checkIn,
      checkOut,
      adults,
      children,
      infants,
      guestDetails,
      specialRequests,
      paymentMethod,
      idempotencyKey,
    } = body;

    // Validate required fields
    if (!propertyId || !roomTypeId || !checkIn || !checkOut || !guestDetails) {
      return NextResponse.json(
        { error: 'Missing required fields: propertyId, roomTypeId, checkIn, checkOut, guestDetails' },
        { status: 400 }
      );
    }

    // Validate guest details
    const { firstName, lastName, email, phone } = guestDetails;
    if (!firstName || !lastName || !email) {
      return NextResponse.json(
        { error: 'Guest details must include firstName, lastName, and email' },
        { status: 400 }
      );
    }

    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    // Validate dates
    if (checkInDate >= checkOutDate) {
      return NextResponse.json(
        { error: 'Check-out date must be after check-in date' },
        { status: 400 }
      );
    }

    if (checkInDate < new Date()) {
      return NextResponse.json(
        { error: 'Check-in date cannot be in the past' },
        { status: 400 }
      );
    }

    // Get property
    const property = await db.property.findUnique({
      where: { id: propertyId },
    });

    if (!property) {
      return NextResponse.json(
        { error: 'Property not found' },
        { status: 404 }
      );
    }

    // Get room type
    const roomType = await db.roomType.findUnique({
      where: { id: roomTypeId },
      include: {
        rooms: {
          where: { status: 'available' },
        },
      },
    });

    if (!roomType) {
      return NextResponse.json(
        { error: 'Room type not found' },
        { status: 404 }
      );
    }

    // Check capacity
    const totalGuests = (adults || 1) + (children || 0);
    if (totalGuests > roomType.maxOccupancy) {
      return NextResponse.json(
        { error: `Maximum occupancy for this room type is ${roomType.maxOccupancy}` },
        { status: 400 }
      );
    }

    // Get rate plan or use default pricing
    let pricePerNight = roomType.basePrice;
    let mealPlan = 'room_only';
    let cancellationPolicy: string | null = null;

    if (ratePlanId) {
      const ratePlan = await db.ratePlan.findUnique({
        where: { id: ratePlanId },
      });
      if (ratePlan && ratePlan.roomTypeId === roomTypeId) {
        pricePerNight = ratePlan.basePrice;
        mealPlan = ratePlan.mealPlan;
        cancellationPolicy = ratePlan.cancellationPolicy;
      }
    }

    // Calculate nights
    const nights = Math.ceil(
      (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Calculate pricing using the pricing engine
    let roomRate: number;
    let taxes: number;
    let serviceCharge: number;
    let totalAmount: number;
    let taxBreakdown: Array<{ name: string; rate: number; amount: number }> = [];

    try {
      const pricingResult = await calculatePrice({
        roomTypeId,
        propertyId,
        tenantId: property.tenantId,
        checkIn: checkInDate,
        checkOut: checkOutDate,
        basePrice: pricePerNight,
        adults: adults || 1,
        children: children || 0,
      });

      roomRate = pricingResult.subtotal;
      taxes = pricingResult.taxes;
      serviceCharge = pricingResult.fees;
      totalAmount = pricingResult.totalAmount;

      // Extract tax breakdown from adjustments if available
      for (const adjustment of pricingResult.adjustments) {
        if (adjustment.type === 'tax' || adjustment.type.includes('tax')) {
          taxBreakdown.push({
            name: adjustment.ruleName,
            rate: adjustment.value,
            amount: adjustment.amount,
          });
        }
      }
    } catch (pricingError) {
      console.error('Error calculating pricing, using fallback:', pricingError);

      // Fallback to manual calculation
      roomRate = pricePerNight * nights;

      // Use property's tax settings
      const taxRate = property.defaultTaxRate || 0;
      taxes = roomRate * (taxRate / 100);

      // Apply tax components if defined
      if (property.taxComponents) {
        try {
          const components = JSON.parse(property.taxComponents);
          if (Array.isArray(components) && components.length > 0) {
            taxes = 0;
            for (const component of components) {
              const componentAmount = roomRate * (component.rate / 100);
              taxes += componentAmount;
              taxBreakdown.push({
                name: component.name || 'Tax',
                rate: component.rate,
                amount: componentAmount,
              });
            }
          }
        } catch {
          // If parsing fails, use defaultTaxRate
        }
      }

      // Add service charge if configured
      serviceCharge = property.serviceChargePercent && property.serviceChargePercent > 0
        ? roomRate * (property.serviceChargePercent / 100)
        : 0;

      totalAmount = roomRate + taxes + serviceCharge;
    }

    // Create or find guest (outside transaction — guest creation is not part of the race condition)
    let guest = await db.guest.findFirst({
      where: {
        email: email.toLowerCase(),
        tenantId: property.tenantId,
      },
    });

    if (!guest) {
      guest = await db.guest.create({
        data: {
          tenantId: property.tenantId,
          firstName,
          lastName,
          email: email.toLowerCase(),
          phone,
          source: 'direct',
          preferences: JSON.stringify({}),
          tags: JSON.stringify([]),
        },
      });
    } else {
      // Update guest info
      await db.guest.update({
        where: { id: guest.id },
        data: {
          firstName,
          lastName,
          phone: phone || guest.phone,
        },
      });
    }

    // Generate confirmation code and portal token
    const confirmationCode = generateConfirmationCode();
    const portalToken = generateSecureToken();
    const portalTokenExpires = new Date();
    portalTokenExpires.setDate(portalTokenExpires.getDate() + 7); // Valid for 7 days

    // ──────────────────────────────────────────────────────────
    // FIX 1: Use serializable transaction for atomic availability
    // check + booking creation to prevent race conditions
    // ──────────────────────────────────────────────────────────
    let idempotentBooking: Awaited<ReturnType<typeof db.booking.findFirst>> | null = null;

    const booking = await db.$transaction(async (tx) => {
      // Idempotency check inside the transaction
      if (idempotencyKey) {
        const existingBooking = await tx.booking.findFirst({
          where: { idempotencyKey },
          include: {
            primaryGuest: true,
            room: true,
            roomType: true,
          },
        });
        if (existingBooking) {
          // Store for later return outside the transaction
          idempotentBooking = existingBooking;
          // Return a minimal stub to exit the transaction cleanly
          return existingBooking;
        }
      }

      // Find existing bookings for the same room type overlapping the requested dates
      const existingBookings = await tx.booking.findMany({
        where: {
          propertyId,
          status: { in: ['confirmed', 'checked_in'] },
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

      const bookedRoomIds = new Set(existingBookings.map(b => b.roomId));

      // Get inventory locks
      const inventoryLocks = await tx.inventoryLock.findMany({
        where: {
          propertyId,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          AND: [
            { startDate: { lt: checkOutDate } },
            { endDate: { gt: checkInDate } },
          ],
        },
        select: { roomId: true },
      });

      const lockedRoomIds = new Set(inventoryLocks.map(l => l.roomId));

      // Find first available room
      const availableRoom = roomType.rooms.find(
        room => !bookedRoomIds.has(room.id) && !lockedRoomIds.has(room.id)
      );

      if (!availableRoom) {
        throw new Error('NO_ROOMS_AVAILABLE');
      }

      // Create the booking
      const newBooking = await tx.booking.create({
        data: {
          tenantId: property.tenantId,
          propertyId,
          confirmationCode,
          primaryGuestId: guest.id,
          roomId: availableRoom.id,
          roomTypeId,
          checkIn: checkInDate,
          checkOut: checkOutDate,
          adults: adults || 1,
          children: children || 0,
          infants: infants || 0,
          roomRate,
          taxes,
          fees: serviceCharge,
          discount: 0,
          totalAmount,
          currency: property.currency,
          ratePlanId,
          source: 'direct',
          status: 'confirmed',
          specialRequests,
          portalToken,
          portalTokenExpires,
          idempotencyKey,
          kycRequired: true,
          kycCompleted: false,
          preferences: JSON.stringify({}),
        },
        include: {
          primaryGuest: true,
          room: true,
          roomType: true,
        },
      });

      // Create a folio for the booking
      await tx.folio.create({
        data: {
          tenantId: property.tenantId,
          propertyId,
          bookingId: newBooking.id,
          folioNumber: `FOL-${confirmationCode}`,
          guestId: guest.id,
          subtotal: roomRate,
          taxes,
          discount: 0,
          totalAmount,
          paidAmount: 0,
          balance: totalAmount,
          currency: property.currency,
          status: 'open',
        },
      });

      // Create audit log
      await tx.bookingAuditLog.create({
        data: {
          bookingId: newBooking.id,
          action: 'created',
          oldStatus: null,
          newStatus: 'confirmed',
          notes: 'Booking created via direct booking engine',
          performedBy: null,
        },
      });

      // Create guest stay record
      await tx.guestStay.create({
        data: {
          guestId: guest.id,
          bookingId: newBooking.id,
          totalAmount,
          roomNights: nights,
        },
      });

      // Update guest stats
      await tx.guest.update({
        where: { id: guest.id },
        data: {
          totalStays: { increment: 1 },
          totalSpent: { increment: totalAmount },
        },
      });

      return newBooking;
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });

    // If this was an idempotent return, respond accordingly
    if (idempotentBooking) {
      return NextResponse.json({
        booking: idempotentBooking,
        message: 'Booking already exists for this request',
      });
    }

    // Send booking confirmation email
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000';
      if (guest?.email) {
        await emailService.send({
          to: guest.email,
          subject: 'Booking Confirmed - StaySuite',
          variables: {
            guestName: guest.firstName || 'Guest',
            bookingId: booking.id,
            propertyName: property?.name || 'Hotel',
            checkIn: booking.checkIn.toLocaleDateString(),
            checkOut: booking.checkOut.toLocaleDateString(),
            roomType: booking.roomType?.name || roomType?.name || 'Standard',
            confirmationLink: `${appUrl}/portal?token=${portalToken}`,
            totalAmount: (booking.totalAmount || 0).toFixed(2),
            currency: booking.currency || 'USD',
          },
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: #1a1a2e; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
                <h1 style="margin: 0;">Booking Confirmed!</h1>
              </div>
              <div style="padding: 20px; border: 1px solid #eee; border-top: none; border-radius: 0 0 8px 8px;">
                <p>Hello {{guestName}},</p>
                <p>Your booking has been confirmed. Here are the details:</p>
                <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                  <tr><td style="padding: 8px; border: 1px solid #eee;"><strong>Booking ID</strong></td><td style="padding: 8px; border: 1px solid #eee;">{{bookingId}}</td></tr>
                  <tr><td style="padding: 8px; border: 1px solid #eee;"><strong>Property</strong></td><td style="padding: 8px; border: 1px solid #eee;">{{propertyName}}</td></tr>
                  <tr><td style="padding: 8px; border: 1px solid #eee;"><strong>Room</strong></td><td style="padding: 8px; border: 1px solid #eee;">{{roomType}}</td></tr>
                  <tr><td style="padding: 8px; border: 1px solid #eee;"><strong>Check-in</strong></td><td style="padding: 8px; border: 1px solid #eee;">{{checkIn}}</td></tr>
                  <tr><td style="padding: 8px; border: 1px solid #eee;"><strong>Check-out</strong></td><td style="padding: 8px; border: 1px solid #eee;">{{checkOut}}</td></tr>
                  <tr><td style="padding: 8px; border: 1px solid #eee;"><strong>Total</strong></td><td style="padding: 8px; border: 1px solid #eee;">{{currency}} {{totalAmount}}</td></tr>
                </table>
                <p><a href="{{confirmationLink}}" style="display: inline-block; padding: 12px 24px; background-color: #1a1a2e; color: white; text-decoration: none; border-radius: 6px;">View Booking Details</a></p>
                <p style="color: #888; font-size: 12px;">StaySuite Hotel Management System</p>
              </div>
            </div>
          `,
          text: `Hello {{guestName}},\n\nYour booking has been confirmed!\n\nBooking ID: {{bookingId}}\nProperty: {{propertyName}}\nRoom: {{roomType}}\nCheck-in: {{checkIn}}\nCheck-out: {{checkOut}}\nTotal: {{currency}} {{totalAmount}}\n\nView your booking: {{confirmationLink}}\n\nStaySuite Hotel Management System`,
          tags: { type: 'booking_confirmation', bookingId: booking.id },
        });
      }
    } catch (emailError) {
      console.error('[Booking] Failed to send confirmation email:', emailError);
      // Don't fail the booking if email fails
    }

    return NextResponse.json({
      success: true,
      booking: {
        id: booking.id,
        confirmationCode: booking.confirmationCode,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        adults: booking.adults,
        children: booking.children,
        totalAmount: booking.totalAmount,
        currency: booking.currency,
        status: booking.status,
        room: {
          number: booking.room?.number,
          type: booking.roomType?.name,
        },
        guest: {
          firstName: booking.primaryGuest.firstName,
          lastName: booking.primaryGuest.lastName,
          email: booking.primaryGuest.email,
        },
        portalToken,
        portalUrl: `/portal?token=${portalToken}`,
      },
      pricing: {
        nights,
        pricePerNight,
        roomRate,
        taxes,
        taxBreakdown: taxBreakdown.length > 0 ? taxBreakdown : undefined,
        taxRate: taxBreakdown.length > 0 ? undefined : (property.defaultTaxRate || 0),
        serviceCharge,
        fees: serviceCharge,
        totalAmount,
        mealPlan,
        cancellationPolicy,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating booking:', error);

    if (error instanceof Error && error.message === 'NO_ROOMS_AVAILABLE') {
      return NextResponse.json(
        { error: 'No rooms available for the selected dates' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create booking' },
      { status: 500 }
    );
  }
}
