import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import crypto from 'crypto';
import { emitBookingCreated, emitBookingCancelled } from '@/lib/availability-client';
import { logBooking } from '@/lib/audit';
import { calculatePrice, type PriceBreakdown } from '@/lib/pricing';
import { getTodayInTimezone } from '@/lib/timezone';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

// Helper function to generate confirmation code
function generateConfirmationCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const bytes = crypto.randomBytes(6);
  let code = 'SS-';
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

// GET /api/bookings - List all bookings
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['bookings.view', 'admin.bookings', 'admin.*'])) {
      return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const propertyId = searchParams.get('propertyId');
    const guestId = searchParams.get('guestId');
    const checkInFrom = searchParams.get('checkInFrom');
    const checkInTo = searchParams.get('checkInTo');
    const search = searchParams.get('search');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');
    
    const where: Record<string, unknown> = {
      tenantId: user.tenantId,
      deletedAt: null,
    };
    
    if (status) {
      where.status = status;
    }
    
    if (propertyId) {
      where.propertyId = propertyId;
    }
    
    if (guestId) {
      where.primaryGuestId = guestId;
    }
    
    if (checkInFrom || checkInTo) {
      where.checkIn = {};
      if (checkInFrom) {
        (where.checkIn as Record<string, unknown>).gte = new Date(checkInFrom);
      }
      if (checkInTo) {
        (where.checkIn as Record<string, unknown>).lte = new Date(checkInTo);
      }
    }
    
    if (search) {
      where.OR = [
        { confirmationCode: { contains: search,  } },
        { primaryGuest: { firstName: { contains: search,  } } },
        { primaryGuest: { lastName: { contains: search,  } } },
        { primaryGuest: { email: { contains: search,  } } },
      ];
    }
    
    // Get bookings with room info through room relation
    const bookings = await db.booking.findMany({
      where,
      include: {
        primaryGuest: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            isVip: true,
          },
        },
        room: {
          select: {
            id: true,
            number: true,
            floor: true,
            roomTypeId: true,
          },
        },
      },
      orderBy: [
        { checkIn: 'asc' },
        { createdAt: 'desc' },
      ],
      ...(limit && { take: parseInt(limit, 10) }),
      ...(offset && { skip: parseInt(offset, 10) }),
    });
    
    // Get all room types for bookings
    const roomTypeIds = [...new Set(bookings.map(b => b.roomTypeId).filter(Boolean))];
    const roomTypes = await db.roomType.findMany({
      where: { id: { in: roomTypeIds } },
      select: { id: true, name: true, code: true, basePrice: true },
    });
    const roomTypeMap = new Map(roomTypes.map(rt => [rt.id, rt]));
    
    // Get all room types through room relation for occupied rooms
    const roomIdsWithTypes = bookings
      .map(b => b.room?.roomTypeId)
      .filter((id): id is string => !!id);
    const roomRoomTypes = await db.roomType.findMany({
      where: { id: { in: roomIdsWithTypes } },
      select: { id: true, name: true, code: true, basePrice: true },
    });
    roomRoomTypes.forEach(rt => roomTypeMap.set(rt.id, rt));
    
    // Get all properties
    const propertyIds = [...new Set(bookings.map(b => b.propertyId).filter(Boolean))];
    const properties = await db.property.findMany({
      where: { id: { in: propertyIds } },
      select: { id: true, name: true, currency: true },
    });
    const propertyMap = new Map(properties.map(p => [p.id, p]));
    
    // Transform bookings to include roomType and property
    const transformedBookings = bookings.map(booking => ({
      ...booking,
      roomType: roomTypeMap.get(booking.roomTypeId) || null,
      property: propertyMap.get(booking.propertyId) || null,
    }));
    
    const total = await db.booking.count({ where });
    
    return NextResponse.json({
      success: true,
      data: transformedBookings,
      pagination: {
        total,
        limit: limit ? parseInt(limit, 10) : null,
        offset: offset ? parseInt(offset, 10) : null,
      },
    });
  } catch (error) {
    console.error('Error fetching bookings:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch bookings' } },
      { status: 500 }
    );
  }
}

// POST /api/bookings - Create a new booking with concurrency control
export async function POST(request: NextRequest) {
  let body: any;
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['bookings.manage', 'admin.bookings', 'admin.*'])) {
      return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
    }

    body = await request.json();
    const tenantId = user.tenantId;

    const {
      propertyId,
      primaryGuestId,
      roomId,
      roomTypeId,
      checkIn,
      checkOut,
      adults = 1,
      children = 0,
      infants = 0,
      roomRate = 0,
      taxes = 0,
      fees = 0,
      discount = 0,
      totalAmount = 0,
      currency = 'USD',
      ratePlanId,
      promoCode,
      source = 'direct',
      channelId,
      status = 'confirmed',
      specialRequests,
      notes,
      internalNotes,
      groupId,
      isGroupLeader = false,
      idempotencyKey,
      lockSessionId, // Session ID from the lock (if booking from a locked session)
      skipLockCheck = false, // Skip lock check for internal operations
      usePricingEngine = false, // Use pricing engine to calculate prices
    } = body;

    // Validate required fields
    if (!propertyId || !primaryGuestId || !roomTypeId || !checkIn || !checkOut) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields' } },
        { status: 400 }
      );
    }

    // Validate dates
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    // Prepare pricing data
    let finalRoomRate = roomRate;
    let finalTaxes = taxes;
    let finalFees = fees;
    let finalDiscount = discount;
    let finalTotalAmount = totalAmount;
    let finalCurrency = currency;
    let pricingBreakdown: PriceBreakdown | null = null;

    // Calculate pricing using the pricing engine if requested or if pricing not provided
    if (usePricingEngine || (roomRate === 0 && totalAmount === 0)) {
      try {
        const roomType = await db.roomType.findUnique({
          where: { id: roomTypeId },
          select: { basePrice: true, propertyId: true },
        });

        if (roomType) {
          pricingBreakdown = await calculatePrice({
            roomTypeId,
            propertyId: roomType.propertyId,
            tenantId: user.tenantId,
            checkIn: checkInDate,
            checkOut: checkOutDate,
            basePrice: roomType.basePrice,
            adults,
            children,
            promoCode,
            ratePlanId,
            bookingChannel: source,
          });

          finalRoomRate = pricingBreakdown.subtotal;
          finalTaxes = pricingBreakdown.taxes;
          finalFees = pricingBreakdown.fees;
          finalTotalAmount = pricingBreakdown.totalAmount;
          finalCurrency = pricingBreakdown.currency;
        }
      } catch (pricingError) {
        console.error('Error calculating pricing:', pricingError);
        // Fall back to provided values
      }
    }
    
    // FIX 5: Idempotency check moved inside the transaction (was at line 254-263 outside tx)

    if (checkInDate >= checkOutDate) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_DATES', message: 'Check-out must be after check-in' } },
        { status: 400 }
      );
    }

    // Validate minimum stay requirement from rate plan
    if (ratePlanId) {
      const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
      const ratePlan = await db.ratePlan.findUnique({
        where: { id: ratePlanId, deletedAt: null },
        select: { minStay: true, name: true },
      });
      if (ratePlan && ratePlan.minStay && nights < ratePlan.minStay) {
        return NextResponse.json(
          { 
            success: false, 
            error: { 
              code: 'MIN_STAY_NOT_MET', 
              message: `Rate plan "${ratePlan.name}" requires a minimum stay of ${ratePlan.minStay} night(s). Your booking is for ${nights} night(s).` 
            } 
          },
          { status: 400 }
        );
      }
    }
    
    // Verify property belongs to tenant
    const propCheck = await db.property.findFirst({
      where: { id: propertyId, tenantId },
      select: { id: true },
    });
    if (!propCheck) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Property not found for this tenant' } }, { status: 400 });
    }

    // Get tenant's timezone for timezone-aware date validation
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      select: { timezone: true },
    });
    const tenantTimezone = tenant?.timezone || 'Asia/Kolkata';
    
    // Compare dates using tenant's timezone to avoid timezone issues
    // The client can send checkInLocalDate/checkOutLocalDate (YYYY-MM-DD) for timezone-aware validation
    // This ensures that a user selecting "today" in their local timezone is not rejected
    const checkInLocalDate = body.checkInLocalDate || checkIn.split('T')[0];
    const todayInTenantTz = getTodayInTimezone(tenantTimezone);
    
    if (checkInLocalDate < todayInTenantTz) {
      return NextResponse.json(
        { success: false, error: { code: 'PAST_CHECKIN', message: 'Check-in date cannot be in the past' } },
        { status: 400 }
      );
    }

    // Use transaction for atomic booking creation with conflict checking
    const booking = await db.$transaction(async (tx) => {
      // FIX 5: Idempotency check inside the transaction to prevent race conditions
      if (idempotencyKey) {
        const existingBooking = await tx.booking.findUnique({
          where: { idempotencyKey },
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
            room: {
              select: {
                id: true,
                number: true,
                roomType: {
                  select: {
                    id: true,
                    name: true,
                    code: true,
                  },
                },
              },
            },
          },
        });

        if (existingBooking) {
          // Return existing booking for idempotent requests
          return existingBooking;
        }
      }

      // Clean up expired session locks
      await tx.inventoryLock.deleteMany({
        where: {
          lockType: 'booking_session',
          expiresAt: { lt: new Date() },
        },
      });

      // If we have a lock session, verify it exists and matches the booking
      if (lockSessionId) {
        const sessionLocks = await tx.inventoryLock.findMany({
          where: {
            sessionId: lockSessionId,
            lockType: 'booking_session',
            expiresAt: { gt: new Date() },
          },
        });

        if (sessionLocks.length === 0) {
          throw new Error('LOCK_EXPIRED');
        }

        // Verify the lock matches the booking details
        const matchingLock = sessionLocks.find(lock => 
          lock.propertyId === propertyId &&
          lock.startDate.getTime() === checkInDate.getTime() &&
          lock.endDate.getTime() === checkOutDate.getTime() &&
          (lock.roomId === roomId || lock.roomTypeId === roomTypeId)
        );

        if (!matchingLock) {
          throw new Error('LOCK_MISMATCH');
        }
      } else if (!skipLockCheck) {
        // Check for conflicting session locks (another user is booking this)
        const lockQuery: Prisma.InventoryLockWhereInput = {
          lockType: 'booking_session',
          expiresAt: { gt: new Date() },
          AND: [
            { startDate: { lt: checkOutDate } },
            { endDate: { gt: checkInDate } },
          ],
        };

        if (roomId) lockQuery.roomId = roomId;
        if (roomTypeId) lockQuery.roomTypeId = roomTypeId;

        const conflictingLocks = await tx.inventoryLock.findMany({
          where: lockQuery,
        });

        if (conflictingLocks.length > 0) {
          throw new Error('LOCK_CONFLICT');
        }
      }

      // Verify room type exists
      const roomType = await tx.roomType.findFirst({
        where: {
          id: roomTypeId,
          propertyId,
          deletedAt: null,
        },
      });
      
      if (!roomType) {
        throw new Error('INVALID_ROOM_TYPE');
      }

      // Validate max occupancy
      const totalGuests = (adults || 1) + (children || 0) + (infants || 0);
      if (roomType.maxOccupancy && totalGuests > roomType.maxOccupancy) {
        throw new Error('OCCUPANCY_EXCEEDED');
      }
      if (roomType.maxAdults && (adults || 1) > roomType.maxAdults) {
        throw new Error('ADULT_OCCUPANCY_EXCEEDED');
      }

      // Overbooking prevention: if overbooking is not enabled, check available room count
      if (!roomType.overbookingEnabled) {
        const overlappingBookings = await tx.booking.count({
          where: {
            roomTypeId,
            propertyId,
            status: { in: ['confirmed', 'checked_in'] },
            deletedAt: null,
            AND: [
              { checkIn: { lt: checkOutDate } },
              { checkOut: { gt: checkInDate } },
            ],
          },
        });

        const totalRooms = await tx.room.count({
          where: { roomTypeId, propertyId },
        });

        if (overlappingBookings >= totalRooms) {
          throw new Error('SOLD_OUT');
        }
      }
      
      // Verify guest exists
      const guest = await tx.guest.findUnique({
        where: { id: primaryGuestId, deletedAt: null },
      });
      
      if (!guest) {
        throw new Error('INVALID_GUEST');
      }
      
      // Check for conflicting bookings
      if (roomId) {
        const conflictingBookings = await tx.booking.findMany({
          where: {
            roomId,
            status: { in: ['confirmed', 'checked_in'] },
            deletedAt: null,
            AND: [
              { checkIn: { lt: checkOutDate } },
              { checkOut: { gt: checkInDate } },
            ],
          },
        });
        
        if (conflictingBookings.length > 0) {
          throw new Error('BOOKING_CONFLICT');
        }
      }

      // Check for maintenance locks
      const maintenanceQuery: Prisma.InventoryLockWhereInput = {
        lockType: { in: ['maintenance', 'event', 'overbooking'] },
        AND: [
          { startDate: { lt: checkOutDate } },
          { endDate: { gt: checkInDate } },
        ],
      };

      if (roomId) maintenanceQuery.roomId = roomId;
      if (roomTypeId) maintenanceQuery.roomTypeId = roomTypeId;

      const maintenanceLocks = await tx.inventoryLock.findMany({
        where: maintenanceQuery,
      });

      if (maintenanceLocks.length > 0) {
        throw new Error('MAINTENANCE_CONFLICT');
      }
      
      // Generate confirmation code
      const confirmationCode = generateConfirmationCode();
      
      // Create the booking
      const newBooking = await tx.booking.create({
        data: {
          tenantId,
          propertyId,
          confirmationCode,
          primaryGuestId,
          roomId,
          roomTypeId,
          checkIn: checkInDate,
          checkOut: checkOutDate,
          adults,
          children,
          infants,
          roomRate: finalRoomRate,
          taxes: finalTaxes,
          fees: finalFees,
          discount: finalDiscount,
          totalAmount: finalTotalAmount,
          currency: finalCurrency,
          ratePlanId,
          promoCode,
          source,
          channelId,
          status,
          specialRequests,
          notes,
          internalNotes,
          groupId,
          isGroupLeader,
          idempotencyKey,
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
          room: {
            select: {
              id: true,
              number: true,
              roomType: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                },
              },
            },
          },
        },
      });
      
      // Auto-create folio for the booking
      const folio = await tx.folio.create({
        data: {
          tenantId,
          propertyId,
          bookingId: newBooking.id,
          guestId: primaryGuestId,
          folioNumber: `FOL-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
          currency: finalCurrency || currency,
          status: 'open',
        },
      });

      // Auto-create initial room charge line item
      const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));

      // When the pricing engine runs, finalRoomRate is the total for the stay (subtotal),
      // not the per-night rate. Use pricePerNight from the breakdown to calculate correctly.
      const perNightRate = pricingBreakdown
        ? pricingBreakdown.pricePerNight
        : (finalRoomRate > 0 ? finalRoomRate : 0);
      const roomChargeTotal = pricingBreakdown
        ? pricingBreakdown.subtotal
        : (finalRoomRate * nights);

      await tx.folioLineItem.create({
        data: {
          folioId: folio.id,
          description: `Room ${newBooking.room?.number || roomTypeId} - ${nights} night(s)`,
          category: 'room_charge',
          quantity: nights,
          unitPrice: perNightRate,
          totalAmount: roomChargeTotal,
          serviceDate: checkInDate,
          taxRate: roomChargeTotal > 0 ? (finalTaxes / roomChargeTotal) * 100 : 0,
          taxAmount: finalTaxes,
        },
      });

      // Update folio totals
      await tx.folio.update({
        where: { id: folio.id },
        data: {
          subtotal: roomChargeTotal,
          taxes: finalTaxes,
          discount: finalDiscount,
          totalAmount: finalTotalAmount,
          balance: finalTotalAmount,
        },
      });

      // Auto-create GuestStay record for stay history tracking
      await tx.guestStay.create({
        data: {
          guestId: primaryGuestId,
          bookingId: newBooking.id,
          totalAmount: finalTotalAmount || 0,
          roomNights: nights,
        },
      });

      // Create booking-specific audit log
      await tx.bookingAuditLog.create({
        data: {
          bookingId: newBooking.id,
          action: 'created',
          newStatus: status,
          notes: lockSessionId ? 'Booking created from locked session' : 'Booking created',
        },
      });

      // If we had a lock, release it now
      if (lockSessionId) {
        await tx.inventoryLock.deleteMany({
          where: {
            sessionId: lockSessionId,
            lockType: 'booking_session',
          },
        });
      }
      
      return newBooking;
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
    
    // Transform booking to include roomType
    const transformedBooking = {
      ...booking,
      roomType: booking.room?.roomType || null,
    };
    
    // Emit WebSocket event for booking created
    try {
      emitBookingCreated({
        bookingId: booking.id,
        propertyId: booking.propertyId,
        tenantId: booking.tenantId,
        roomTypeId: booking.roomTypeId,
        roomId: booking.roomId || undefined,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        guestName: `${booking.primaryGuest.firstName} ${booking.primaryGuest.lastName}`,
        confirmationCode: booking.confirmationCode,
      });
    } catch (wsError) {
      // Don't fail the request if WebSocket emission fails
      console.error('Failed to emit booking created event:', wsError);
    }
    
    // Log booking creation to main audit log (non-blocking)
    try {
      await logBooking(request, 'create', booking.id, undefined, {
        confirmationCode: booking.confirmationCode,
        guestName: `${booking.primaryGuest.firstName} ${booking.primaryGuest.lastName}`,
        roomNumber: booking.room?.number,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        totalAmount: booking.totalAmount,
        status: booking.status,
        source: booking.source,
      }, { tenantId: user.tenantId, userId: user.id });
    } catch (auditError) {
      // Don't fail the booking if audit logging fails
      console.error('Failed to log booking creation to audit log:', auditError);
    }
    
    return NextResponse.json({ success: true, data: transformedBooking }, { status: 201 });
  } catch (error) {
    console.error('Error creating booking:', error);
    
    if (error instanceof Error) {
      if (error.message === 'LOCK_EXPIRED') {
        return NextResponse.json(
          { 
            success: false, 
            error: { 
              code: 'LOCK_EXPIRED', 
              message: 'Your booking session has expired. Please try again.' 
            } 
          },
          { status: 410 }
        );
      }
      if (error.message === 'LOCK_MISMATCH') {
        return NextResponse.json(
          { 
            success: false, 
            error: { 
              code: 'LOCK_MISMATCH', 
              message: 'Booking details do not match the locked session.' 
            } 
          },
          { status: 400 }
        );
      }
      if (error.message === 'LOCK_CONFLICT') {
        return NextResponse.json(
          { 
            success: false, 
            error: { 
              code: 'LOCK_CONFLICT', 
              message: 'Another user is currently booking this room. Please try again in a few minutes.' 
            } 
          },
          { status: 409 }
        );
      }
      if (error.message === 'BOOKING_CONFLICT') {
        return NextResponse.json(
          { 
            success: false, 
            error: { 
              code: 'BOOKING_CONFLICT', 
              message: 'This room is already booked for the selected dates.' 
            } 
          },
          { status: 409 }
        );
      }
      if (error.message === 'MAINTENANCE_CONFLICT') {
        return NextResponse.json(
          { 
            success: false, 
            error: { 
              code: 'MAINTENANCE_CONFLICT', 
              message: 'This room is under maintenance for the selected dates.' 
            } 
          },
          { status: 409 }
        );
      }
      if (error.message === 'INVALID_ROOM_TYPE') {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_ROOM_TYPE', message: 'Room type not found' } },
          { status: 400 }
        );
      }
      if (error.message === 'SOLD_OUT') {
        return NextResponse.json(
          { 
            success: false, 
            error: { 
              code: 'SOLD_OUT', 
              message: 'This room type is fully booked for the selected dates. No rooms are available.' 
            } 
          },
          { status: 409 }
        );
      }
      if (error.message === 'INVALID_GUEST') {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_GUEST', message: 'Guest not found' } },
          { status: 400 }
        );
      }
      if (error.message === 'OCCUPANCY_EXCEEDED') {
        const totalGuests = (body.adults || 1) + (body.children || 0) + (body.infants || 0);
        return NextResponse.json(
          { success: false, error: { code: 'OCCUPANCY_EXCEEDED', message: `Total guests (${totalGuests}) exceeds room type maximum occupancy` } },
          { status: 400 }
        );
      }
      if (error.message === 'ADULT_OCCUPANCY_EXCEEDED') {
        return NextResponse.json(
          { success: false, error: { code: 'ADULT_OCCUPANCY_EXCEEDED', message: `Number of adults (${body.adults}) exceeds maximum` } },
          { status: 400 }
        );
      }
    }
    
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create booking' } },
      { status: 500 }
    );
  }
}
