import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { requirePermission } from '@/lib/auth/tenant-context';
import crypto from 'crypto';// GET /api/bookings/conflicts - Detect and list booking conflicts
export async function GET(request: NextRequest) {    const user = await requirePermission(request, 'bookings.view');
    if (user instanceof NextResponse) return user;

      try {
    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const includeLocks = searchParams.get('includeLocks') !== 'false';

    // Base query for active bookings
    const where: Record<string, unknown> = {
      status: { in: ['confirmed', 'checked_in'] },
      deletedAt: null,
      tenantId: user.tenantId,
    };

    if (propertyId) {
      where.propertyId = propertyId;
    }

    // Get all active bookings with rooms
    const bookings = await db.booking.findMany({
      where,
      include: {
        room: {
          select: {
            id: true,
            number: true,
          },
        },
        roomType: {
          select: {
            id: true,
            name: true,
          },
        },
        primaryGuest: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        checkIn: 'asc',
      },
    });

    // Find overlapping bookings for the same room
    const conflicts: Array<{
      id: string;
      type: string;
      severity: string;
      bookings: typeof bookings;
      roomId: string | null;
      roomNumber: string | null;
      overlappingDates: { start: Date; end: Date };
      description: string;
    }> = [];

    // Group bookings by room
    const roomBookings = new Map<string, typeof bookings>();

    for (const booking of bookings) {
      if (booking.roomId) {
        if (!roomBookings.has(booking.roomId)) {
          roomBookings.set(booking.roomId, []);
        }
        const entries = roomBookings.get(booking.roomId);
        if (entries) entries.push(booking);
        else roomBookings.set(booking.roomId, [booking]);
      }
    }

    // Check for overlaps within each room
    for (const [roomId, roomBookingList] of roomBookings) {
      // Sort by check-in date
      roomBookingList.sort((a, b) => new Date(a.checkIn).getTime() - new Date(b.checkIn).getTime());

      for (let i = 0; i < roomBookingList.length; i++) {
        for (let j = i + 1; j < roomBookingList.length; j++) {
          const booking1 = roomBookingList[i];
          const booking2 = roomBookingList[j];

          // Check if there's an overlap
          const checkIn1 = new Date(booking1.checkIn);
          const checkOut1 = new Date(booking1.checkOut);
          const checkIn2 = new Date(booking2.checkIn);
          const checkOut2 = new Date(booking2.checkOut);

          // Overlap condition: booking2 starts before booking1 ends
          if (checkIn2 < checkOut1) {
            const overlapStart = checkIn2;
            const overlapEnd = checkOut1 < checkOut2 ? checkOut1 : checkOut2;

            conflicts.push({
              id: `conflict_${roomId}_${i}_${j}`,
              type: 'double_booking',
              severity: 'critical',
              bookings: [booking1, booking2],
              roomId,
              roomNumber: booking1.room?.number || null,
              overlappingDates: {
                start: overlapStart,
                end: overlapEnd,
              },
              description: `Double booking detected for room ${booking1.room?.number}. Guests: ${booking1.primaryGuest.firstName} ${booking1.primaryGuest.lastName} and ${booking2.primaryGuest.firstName} ${booking2.primaryGuest.lastName}`,
            });
          }
        }
      }
    }

    // Check for room type overbooking
    const roomTypeStats = new Map<string, { total: number; bookings: typeof bookings }>();

    // Get room counts per room type (RoomType doesn't have tenantId directly, filter through property)
    const roomTypes = await db.roomType.findMany({
      where: {
        property: {
          tenantId: user.tenantId,
        },
      },
      include: {
        _count: {
          select: { rooms: true },
        },
      },
    });

    const roomTypeCountMap = new Map(roomTypes.map(rt => [rt.id, rt._count.rooms]));

    for (const booking of bookings) {
      const rtId = booking.roomTypeId;
      if (!roomTypeStats.has(rtId)) {
        roomTypeStats.set(rtId, { total: 0, bookings: [] });
      }
      const rtEntries = roomTypeStats.get(rtId);
      if (rtEntries) rtEntries.bookings.push(booking);
      else roomTypeStats.set(rtId, { total: 0, bookings: [booking] });
    }

    // Group bookings by date for each room type
    const overbookings: Array<{
      id: string;
      type: string;
      severity: string;
      roomTypeId: string;
      roomTypeName: string;
      totalRooms: number;
      bookedRooms: number;
      date: Date;
      bookings: typeof bookings;
      description: string;
    }> = [];

    for (const [rtId, stats] of roomTypeStats) {
      const totalRooms = roomTypeCountMap.get(rtId) || 0;
      const rtName = roomTypes.find(rt => rt.id === rtId)?.name || 'Unknown';

      // Create a map of date -> count
      const dateCounts = new Map<string, typeof bookings>();

      for (const booking of stats.bookings) {
        const checkInDt = new Date(booking.checkIn);
        const checkOutDt = new Date(booking.checkOut);

        // Mark each day of the stay
        const current = new Date(checkInDt);
        while (current < checkOutDt) {
          const dateKey = current.toISOString().split('T')[0];
          if (!dateCounts.has(dateKey)) {
            dateCounts.set(dateKey, []);
          }
          const dateEntries = dateCounts.get(dateKey);
          if (dateEntries) dateEntries.push(booking);
          else dateCounts.set(dateKey, [booking]);
          current.setDate(current.getDate() + 1);
        }
      }

      // Find dates where bookings exceed capacity
      for (const [dateKey, dateBookings] of dateCounts) {
        if (dateBookings.length > totalRooms) {
          overbookings.push({
            id: `overbooking_${rtId}_${dateKey}`,
            type: 'overbooking',
            severity: 'warning',
            roomTypeId: rtId,
            roomTypeName: rtName,
            totalRooms,
            bookedRooms: dateBookings.length,
            date: new Date(dateKey),
            bookings: dateBookings,
            description: `Overbooking detected for ${rtName} on ${dateKey}. ${dateBookings.length} bookings for ${totalRooms} rooms.`,
          });
        }
      }
    }

    // Get inventory locks that may conflict
    const locks = await db.inventoryLock.findMany({
      where: {
        tenantId: user.tenantId,
        ...(propertyId && { propertyId }),
        endDate: { gte: new Date() },
      },
      include: {
        room: {
          select: {
            id: true,
            number: true,
          },
        },
      },
    });

    // Check for bookings conflicting with locks
    if (includeLocks) {
      for (const lock of locks) {
        if (lock.roomId) {
          const conflictingBookings = bookings.filter(b => {
            if (b.roomId !== lock.roomId) return false;
            const checkInDt = new Date(b.checkIn);
            const checkOutDt = new Date(b.checkOut);
            const lockStart = new Date(lock.startDate);
            const lockEnd = new Date(lock.endDate);
            return checkInDt < lockEnd && checkOutDt > lockStart;
          });

          if (conflictingBookings.length > 0) {
            conflicts.push({
              id: `lock_conflict_${lock.id}`,
              type: 'lock_conflict',
              severity: 'warning',
              bookings: conflictingBookings,
              roomId: lock.roomId,
              roomNumber: lock.room?.number || null,
              overlappingDates: {
                start: new Date(lock.startDate),
                end: new Date(lock.endDate),
              },
              description: `Booking conflict with ${lock.lockType} lock on room ${lock.room?.number}. Reason: ${lock.reason}`,
            });
          }
        }
      }
    }

    // Get active session locks that might indicate pending bookings
    const sessionLocks = await db.inventoryLock.findMany({
      where: {
        tenantId: user.tenantId,
        lockType: 'booking_session',
        expiresAt: { gt: new Date() },
        ...(propertyId && { propertyId }),
      },
      include: {
        room: {
          select: {
            id: true,
            number: true,
          },
        },
        roomType: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Summary stats
    const stats = {
      totalConflicts: conflicts.length + overbookings.length,
      criticalConflicts: conflicts.filter(c => c.severity === 'critical').length,
      warnings: conflicts.filter(c => c.severity === 'warning').length + overbookings.length,
      doubleBookings: conflicts.filter(c => c.type === 'double_booking').length,
      overbookings: overbookings.length,
      lockConflicts: conflicts.filter(c => c.type === 'lock_conflict').length,
      activeSessionLocks: sessionLocks.length,
    };

    return NextResponse.json({
      success: true,
      data: {
        conflicts,
        overbookings,
        sessionLocks: includeLocks ? sessionLocks : [],
      },
      stats,
    });
  } catch (error) {
    console.error('Error detecting conflicts:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to detect conflicts' } },
      { status: 500 }
    );
  }
}

// POST /api/bookings/conflicts - Resolve a conflict with specified action
export async function POST(request: NextRequest) {    const user = await requirePermission(request, 'bookings.manage');
    if (user instanceof NextResponse) return user;

      try {
    const body = await request.json();
    const {
      conflictId,
      conflictType,
      bookingIds,
      resolution,
      targetRoomId,
      newCheckIn,
      newCheckOut,
      splitDate, // Date to split the booking at
      cancellationReason,
      notifyGuest = true,
    } = body;

    if (!conflictId || !conflictType || !bookingIds || bookingIds.length < 1 || !resolution) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Conflict ID, type, booking IDs, and resolution are required' } },
        { status: 400 }
      );
    }

    const results: any[] = [];

    // Use transaction for atomic resolution
    await db.$transaction(async (tx) => {
      switch (resolution) {
        case 'move_room': {
          // Move the last booking to a different room
          if (!targetRoomId) {
            throw new Error('TARGET_ROOM_REQUIRED');
          }

          const bookingToMove = bookingIds[bookingIds.length - 1];

          // Verify booking belongs to user's tenant
          const moveBookingCheck = await tx.booking.findUnique({ where: { id: bookingToMove } });
          if (!moveBookingCheck || moveBookingCheck.tenantId !== user.tenantId) {
            throw new Error('BOOKING_NOT_FOUND');
          }

          // Check if target room is available
          const booking = await tx.booking.findUnique({
            where: { id: bookingToMove },
          });

          if (!booking) {
            throw new Error('BOOKING_NOT_FOUND');
          }

          // Check for conflicts in target room
          const targetConflicts = await tx.booking.findMany({
            where: {
              roomId: targetRoomId,
              status: { in: ['confirmed', 'checked_in'] },
              deletedAt: null,
              AND: [
                { checkIn: { lt: booking.checkOut } },
                { checkOut: { gt: booking.checkIn } },
              ],
            },
          });

          if (targetConflicts.length > 0) {
            throw new Error('TARGET_ROOM_UNAVAILABLE');
          }

          // Verify target room has the same room type as the original booking
          const targetRoom = await tx.room.findUnique({
            where: { id: targetRoomId },
            select: { id: true, roomTypeId: true },
          });

          if (!targetRoom) {
            throw new Error('TARGET_ROOM_NOT_FOUND');
          }

          if (targetRoom.roomTypeId !== booking.roomTypeId) {
            throw new Error('ROOM_TYPE_MISMATCH');
          }

          // Update the booking
          const updatedBooking = await tx.booking.update({
            where: { id: bookingToMove },
            data: { roomId: targetRoomId },
          });

          // Create audit log
          await tx.bookingAuditLog.create({
            data: {
              bookingId: bookingToMove,
              action: 'room_change',
              notes: `Room changed to ${targetRoomId} to resolve conflict ${conflictId}`,
            },
          });

          results.push(updatedBooking);
          break;
        }

        case 'cancel': {
          // Cancel specified bookings
          for (const bookingId of bookingIds.slice(1)) {
            // Verify booking belongs to user's tenant
            const cancelBookingCheck = await tx.booking.findUnique({ where: { id: bookingId } });
            if (!cancelBookingCheck || cancelBookingCheck.tenantId !== user.tenantId) {
              throw new Error('BOOKING_NOT_FOUND');
            }

            const booking = await tx.booking.update({
              where: { id: bookingId },
              data: {
                status: 'cancelled',
                cancelledAt: new Date(),
                cancellationReason: cancellationReason || 'Cancelled due to booking conflict',
              },
            });

            await tx.bookingAuditLog.create({
              data: {
                bookingId,
                action: 'cancelled',
                newStatus: 'cancelled',
                notes: `Cancelled to resolve conflict ${conflictId}`,
              },
            });

            results.push(booking);
          }
          break;
        }

        case 'modify_dates': {
          // Modify dates of a booking
          if (!newCheckIn || !newCheckOut) {
            throw new Error('DATES_REQUIRED');
          }

          const bookingId = bookingIds[bookingIds.length - 1];

          // Verify booking belongs to user's tenant
          const modifyBookingCheck = await tx.booking.findUnique({ where: { id: bookingId } });
          if (!modifyBookingCheck || modifyBookingCheck.tenantId !== user.tenantId) {
            throw new Error('BOOKING_NOT_FOUND');
          }

          const newCheckInDate = new Date(newCheckIn);
          const newCheckOutDate = new Date(newCheckOut);

          if (newCheckInDate >= newCheckOutDate) {
            throw new Error('INVALID_DATES');
          }

          const booking = await tx.booking.update({
            where: { id: bookingId },
            data: {
              checkIn: newCheckInDate,
              checkOut: newCheckOutDate,
            },
          });

          await tx.bookingAuditLog.create({
            data: {
              bookingId,
              action: 'date_change',
              notes: `Dates modified to resolve conflict ${conflictId}. New dates: ${newCheckIn} to ${newCheckOut}`,
            },
          });

          results.push(booking);
          break;
        }

        case 'split_stay': {
          // Split a stay into two bookings
          const bookingId = bookingIds[0];
          if (!bookingId) {
            throw new Error('BOOKING_ID_REQUIRED');
          }

          // Verify booking belongs to user's tenant
          const splitBookingCheck = await tx.booking.findUnique({ where: { id: bookingId } });
          if (!splitBookingCheck || splitBookingCheck.tenantId !== user.tenantId) {
            throw new Error('BOOKING_NOT_FOUND');
          }

          // Get the original booking
          const originalBooking = await tx.booking.findUnique({
            where: { id: bookingId },
            include: {
              roomType: true,
              property: true,
            },
          });

          if (!originalBooking) {
            throw new Error('BOOKING_NOT_FOUND');
          }

          // Determine split date - use provided splitDate or the middle of the stay
          const splitDateValue = splitDate
            ? new Date(splitDate)
            : new Date((originalBooking.checkIn.getTime() + originalBooking.checkOut.getTime()) / 2);

          // Validate split date
          if (splitDateValue <= originalBooking.checkIn || splitDateValue >= originalBooking.checkOut) {
            throw new Error('INVALID_SPLIT_DATE');
          }

          // Calculate pricing for each part
          const originalNights = Math.ceil(
            (originalBooking.checkOut.getTime() - originalBooking.checkIn.getTime()) / (1000 * 60 * 60 * 24)
          );
          const firstNights = Math.ceil(
            (splitDateValue.getTime() - originalBooking.checkIn.getTime()) / (1000 * 60 * 60 * 24)
          );
          const secondNights = originalNights - firstNights;

          const pricePerNight = originalBooking.roomRate / originalNights;
          const firstRoomRate = pricePerNight * firstNights;
          const secondRoomRate = pricePerNight * secondNights;

          // Calculate tax proportion
          const taxPerNight = originalBooking.taxes / originalNights;
          const firstTaxes = taxPerNight * firstNights;
          const secondTaxes = taxPerNight * secondNights;

          // Calculate fee and discount proportion
          const feePerNight = originalBooking.fees / originalNights;
          const firstFees = feePerNight * firstNights;
          const secondFees = feePerNight * secondNights;
          const discountPerNight = originalBooking.discount / originalNights;
          const firstDiscount = discountPerNight * firstNights;
          const secondDiscount = discountPerNight * secondNights;

          // Generate confirmation codes
          const generateCode = () => {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            const bytes = crypto.randomBytes(6);
            let code = 'SS-';
            for (let i = 0; i < 6; i++) {
              code += chars[bytes[i] % chars.length];
            }
            return code;
          };

          // Check if target room is available for the second part
          let secondRoomId = targetRoomId || originalBooking.roomId;

          if (targetRoomId) {
            const targetConflicts = await tx.booking.findMany({
              where: {
                roomId: targetRoomId,
                status: { in: ['confirmed', 'checked_in'] },
                deletedAt: null,
                AND: [
                  { checkIn: { lt: originalBooking.checkOut } },
                  { checkOut: { gt: splitDateValue } },
                ],
              },
            });

            if (targetConflicts.length > 0) {
              throw new Error('TARGET_ROOM_UNAVAILABLE');
            }
          }

          // Try to find an available room if target room not provided
          if (!targetRoomId) {
            const availableRooms = await tx.room.findMany({
              where: {
                roomTypeId: originalBooking.roomTypeId,
                status: 'available',
                id: { not: originalBooking.roomId || undefined },
              },
            });

            // Check each room for availability during second period
            for (const room of availableRooms) {
              const conflicts = await tx.booking.findMany({
                where: {
                  roomId: room.id,
                  status: { in: ['confirmed', 'checked_in'] },
                  deletedAt: null,
                  AND: [
                    { checkIn: { lt: originalBooking.checkOut } },
                    { checkOut: { gt: splitDateValue } },
                  ],
                },
              });

              if (conflicts.length === 0) {
                secondRoomId = room.id;
                break;
              }
            }
          }

          // Create first booking (original checkIn to split date)
          const firstBooking = await tx.booking.create({
            data: {
              tenantId: originalBooking.tenantId,
              propertyId: originalBooking.propertyId,
              confirmationCode: generateCode(),
              primaryGuestId: originalBooking.primaryGuestId,
              roomId: originalBooking.roomId,
              roomTypeId: originalBooking.roomTypeId,
              checkIn: originalBooking.checkIn,
              checkOut: splitDateValue,
              adults: originalBooking.adults,
              children: originalBooking.children,
              infants: originalBooking.infants,
              roomRate: firstRoomRate,
              taxes: firstTaxes,
              fees: firstFees,
              discount: firstDiscount,
              totalAmount: firstRoomRate + firstTaxes + firstFees - firstDiscount,
              currency: originalBooking.currency,
              source: originalBooking.source,
              status: originalBooking.status,
              specialRequests: originalBooking.specialRequests,
              notes: `Split from booking ${originalBooking.confirmationCode}`,
              kycRequired: originalBooking.kycRequired,
              kycCompleted: originalBooking.kycCompleted,
              preferences: originalBooking.preferences,
            },
          });

          // Create second booking (split date to original checkOut)
          const secondBooking = await tx.booking.create({
            data: {
              tenantId: originalBooking.tenantId,
              propertyId: originalBooking.propertyId,
              confirmationCode: generateCode(),
              primaryGuestId: originalBooking.primaryGuestId,
              roomId: secondRoomId,
              roomTypeId: originalBooking.roomTypeId,
              checkIn: splitDateValue,
              checkOut: originalBooking.checkOut,
              adults: originalBooking.adults,
              children: originalBooking.children,
              infants: originalBooking.infants,
              roomRate: secondRoomRate,
              taxes: secondTaxes,
              fees: secondFees,
              discount: secondDiscount,
              totalAmount: secondRoomRate + secondTaxes + secondFees - secondDiscount,
              currency: originalBooking.currency,
              source: originalBooking.source,
              status: 'confirmed',
              specialRequests: originalBooking.specialRequests,
              notes: `Split from booking ${originalBooking.confirmationCode}. Room changed to ${secondRoomId !== originalBooking.roomId ? 'different room' : 'same room'}`,
              kycRequired: originalBooking.kycRequired,
              kycCompleted: originalBooking.kycCompleted,
              preferences: originalBooking.preferences,
            },
          });

          // Update original booking status to cancelled
          await tx.booking.update({
            where: { id: bookingId },
            data: {
              status: 'cancelled',
              cancelledAt: new Date(),
              cancellationReason: 'split_stay',
              internalNotes: `Split into bookings ${firstBooking.confirmationCode} and ${secondBooking.confirmationCode}`,
            },
          });

          // Create audit logs
          await tx.bookingAuditLog.create({
            data: {
              bookingId,
              action: 'cancelled',
              oldStatus: originalBooking.status,
              newStatus: 'cancelled',
              notes: `Booking split due to conflict ${conflictId}. Created ${firstBooking.confirmationCode} and ${secondBooking.confirmationCode}`,
            },
          });

          await tx.bookingAuditLog.create({
            data: {
              bookingId: firstBooking.id,
              action: 'created',
              newStatus: originalBooking.status,
              notes: `Created from split of booking ${originalBooking.confirmationCode}`,
            },
          });

          await tx.bookingAuditLog.create({
            data: {
              bookingId: secondBooking.id,
              action: 'created',
              newStatus: 'confirmed',
              notes: `Created from split of booking ${originalBooking.confirmationCode}`,
            },
          });

          // Create folios for the new bookings
          await tx.folio.create({
            data: {
              tenantId: originalBooking.tenantId,
              propertyId: originalBooking.propertyId,
              bookingId: firstBooking.id,
              folioNumber: `FOL-${firstBooking.confirmationCode}`,
              guestId: originalBooking.primaryGuestId,
              subtotal: firstRoomRate,
              taxes: firstTaxes,
              totalAmount: firstRoomRate + firstTaxes,
              paidAmount: 0,
              balance: firstRoomRate + firstTaxes,
              currency: originalBooking.currency,
              status: 'open',
            },
          });

          await tx.folio.create({
            data: {
              tenantId: originalBooking.tenantId,
              propertyId: originalBooking.propertyId,
              bookingId: secondBooking.id,
              folioNumber: `FOL-${secondBooking.confirmationCode}`,
              guestId: originalBooking.primaryGuestId,
              subtotal: secondRoomRate,
              taxes: secondTaxes,
              totalAmount: secondRoomRate + secondTaxes,
              paidAmount: 0,
              balance: secondRoomRate + secondTaxes,
              currency: originalBooking.currency,
              status: 'open',
            },
          });

          results.push({
            firstBooking: {
              id: firstBooking.id,
              confirmationCode: firstBooking.confirmationCode,
              checkIn: firstBooking.checkIn,
              checkOut: firstBooking.checkOut,
              roomId: firstBooking.roomId,
            },
            secondBooking: {
              id: secondBooking.id,
              confirmationCode: secondBooking.confirmationCode,
              checkIn: secondBooking.checkIn,
              checkOut: secondBooking.checkOut,
              roomId: secondBooking.roomId,
            },
          });
          break;
        }

        case 'keep_both': {
          // Mark conflict as acknowledged but keep both bookings
          // Used when overbooking is intentional
          for (const bookingId of bookingIds) {
            // Verify booking belongs to user's tenant
            const keepBookingCheck = await tx.booking.findUnique({ where: { id: bookingId } });
            if (!keepBookingCheck || keepBookingCheck.tenantId !== user.tenantId) {
              throw new Error('BOOKING_NOT_FOUND');
            }
            await tx.bookingAuditLog.create({
              data: {
                bookingId,
                action: 'conflict_acknowledged',
                notes: `Conflict ${conflictId} acknowledged - both bookings retained`,
              },
            });
          }
          break;
        }

        default:
          throw new Error('INVALID_RESOLUTION');
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        resolution,
        affectedBookings: results.length,
        bookings: results,
      },
      message: 'Conflict resolved successfully',
    });
  } catch (error) {
    console.error('Error resolving conflict:', error);

    if (error instanceof Error) {
      if (error.message === 'TARGET_ROOM_REQUIRED') {
        return NextResponse.json(
          { success: false, error: { code: 'TARGET_ROOM_REQUIRED', message: 'Target room ID is required for this resolution' } },
          { status: 400 }
        );
      }
      if (error.message === 'TARGET_ROOM_UNAVAILABLE') {
        return NextResponse.json(
          { success: false, error: { code: 'TARGET_ROOM_UNAVAILABLE', message: 'Target room is not available for the booking dates' } },
          { status: 400 }
        );
      }
      if (error.message === 'TARGET_ROOM_NOT_FOUND') {
        return NextResponse.json(
          { success: false, error: { code: 'TARGET_ROOM_NOT_FOUND', message: 'Target room not found' } },
          { status: 400 }
        );
      }
      if (error.message === 'ROOM_TYPE_MISMATCH') {
        return NextResponse.json(
          { success: false, error: { code: 'ROOM_TYPE_MISMATCH', message: 'Target room must be the same room type as the original booking' } },
          { status: 400 }
        );
      }
      if (error.message === 'BOOKING_NOT_FOUND') {
        return NextResponse.json(
          { success: false, error: { code: 'BOOKING_NOT_FOUND', message: 'Booking not found' } },
          { status: 404 }
        );
      }
      if (error.message === 'DATES_REQUIRED') {
        return NextResponse.json(
          { success: false, error: { code: 'DATES_REQUIRED', message: 'New check-in and check-out dates are required' } },
          { status: 400 }
        );
      }
      if (error.message === 'INVALID_DATES') {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_DATES', message: 'Check-out must be after check-in' } },
          { status: 400 }
        );
      }
      if (error.message === 'INVALID_RESOLUTION') {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_RESOLUTION', message: 'Unknown resolution type' } },
          { status: 400 }
        );
      }
      if (error.message === 'BOOKING_ID_REQUIRED') {
        return NextResponse.json(
          { success: false, error: { code: 'BOOKING_ID_REQUIRED', message: 'Booking ID is required for split stay' } },
          { status: 400 }
        );
      }
      if (error.message === 'INVALID_SPLIT_DATE') {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_SPLIT_DATE', message: 'Split date must be between check-in and check-out dates' } },
          { status: 400 }
        );
      }
      if (error.message === 'NOT_IMPLEMENTED') {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_IMPLEMENTED', message: 'This resolution type is not yet implemented' } },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to resolve conflict' } },
      { status: 500 }
    );
  }
}

// PUT /api/bookings/conflicts - Legacy endpoint (redirects to POST)
export async function PUT(request: NextRequest) {    const user = await requirePermission(request, 'bookings.manage');
    if (user instanceof NextResponse) return user;

      try {
    const body = await request.json();
    const { conflictType, bookingIds, resolution, targetRoomId } = body;

    if (!conflictType || !bookingIds || bookingIds.length < 1) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Conflict type and booking IDs are required' } },
        { status: 400 }
      );
    }

    const results: any[] = [];

    switch (resolution) {
      case 'move_room':
        // Move the second booking to a different room
        if (targetRoomId && bookingIds.length >= 1) {
          const booking = await db.booking.update({
            where: { id: bookingIds[bookingIds.length - 1] },
            data: { roomId: targetRoomId },
          });

          // Create audit log
          await db.bookingAuditLog.create({
            data: {
              bookingId: booking.id,
              action: 'room_change',
              notes: `Room changed to resolve conflict. New room: ${targetRoomId}`,
            },
          });

          results.push(booking);
        }
        break;

      case 'cancel':
        // Cancel one of the conflicting bookings
        for (let i = 1; i < bookingIds.length; i++) {
          const booking = await db.booking.update({
            where: { id: bookingIds[i] },
            data: {
              status: 'cancelled',
              cancelledAt: new Date(),
              cancellationReason: 'Cancelled due to booking conflict',
            },
          });

          await db.bookingAuditLog.create({
            data: {
              bookingId: booking.id,
              action: 'cancelled',
              newStatus: 'cancelled',
              notes: 'Cancelled to resolve booking conflict',
            },
          });

          results.push(booking);
        }
        break;

      case 'modify_dates':
        // This would require additional date parameters
        return NextResponse.json(
          { success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Date modification requires additional parameters' } },
          { status: 400 }
        );

      default:
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_RESOLUTION', message: 'Unknown resolution type' } },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      data: results,
      message: 'Conflict resolved successfully',
    });
  } catch (error) {
    console.error('Error resolving conflict:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to resolve conflict' } },
      { status: 500 }
    );
  }
}
