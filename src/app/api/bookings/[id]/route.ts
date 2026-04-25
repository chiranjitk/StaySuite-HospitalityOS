import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { emitBookingCancelled as emitBookingCancelledWS, emitRoomStatusChange, emitBookingCheckedIn as emitBookingCheckedInWS, emitBookingCheckedOut as emitBookingCheckedOutWS } from '@/lib/availability-client';
import crypto from 'crypto';
import { logBooking } from '@/lib/audit';
import { emitBookingCheckedIn, emitBookingCheckedOut, emitBookingCancelled as emitBookingCancelledEvent } from '@/lib/events/booking-events';
import { markRoomDirtyAfterCheckout } from '@/lib/housekeeping-automation';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';
import { evaluateCancellationPolicy } from '@/lib/cancellation-policy-engine';
import type { CancellationResult } from '@/lib/cancellation-policy-engine';
import { emailService } from '@/lib/services/email-service';

// Helper: auto-close folio and generate invoice on checkout (must be called within a transaction)
async function autoCloseFolioAndGenerateInvoice(bookingId: string, tx: Parameters<Parameters<typeof db.$transaction>[0]>[0]) {
  // 1. Set actualCheckOut if not already set
  const booking = await tx.booking.findUnique({ where: { id: bookingId } });
  if (booking && !booking.actualCheckOut) {
    await tx.booking.update({
      where: { id: bookingId },
      data: { actualCheckOut: new Date() },
    });
  }

  // 2. Close the open or partially-paid folio
  //    Payments may have already moved the folio to 'partially_paid', so we must
  //    find folios that are still open OR partially paid to close them on checkout.
  const folio = await tx.folio.findFirst({ where: { bookingId, status: { in: ['open', 'partially_paid'] } } });
  if (!folio) return;

  await tx.folio.update({
    where: { id: folio.id },
    data: { status: 'closed', closedAt: new Date() },
  });

  // 3. Auto-generate invoice
  const bookingWithGuest = await tx.booking.findUnique({
    where: { id: bookingId },
    include: { primaryGuest: true, room: { include: { roomType: true } } },
  });

  const invoiceNumber = `INV-${new Date().getFullYear().toString().slice(-2)}${(new Date().getMonth() + 1).toString().padStart(2, '0')}-${crypto.randomBytes(4).toString('hex').slice(0, 4)}`;

  await tx.invoice.create({
    data: {
      tenantId: folio.tenantId,
      invoiceNumber,
      folioId: folio.id,
      customerName: bookingWithGuest?.primaryGuest ? `${bookingWithGuest.primaryGuest.firstName} ${bookingWithGuest.primaryGuest.lastName}` : 'Guest',
      customerEmail: bookingWithGuest?.primaryGuest?.email,
      customerAddress: bookingWithGuest?.primaryGuest ? [bookingWithGuest.primaryGuest.city, bookingWithGuest.primaryGuest.country].filter(Boolean).join(', ') : undefined,
      subtotal: folio.subtotal,
      taxes: folio.taxes,
      totalAmount: folio.totalAmount,
      currency: folio.currency,
      issuedAt: new Date(),
      dueAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      status: 'issued',
      pdfUrl: `/api/invoices/${folio.id}/pdf`,
    },
  });

  // Update folio with invoice info
  await tx.folio.update({
    where: { id: folio.id },
    data: { invoiceNumber, invoiceIssuedAt: new Date() },
  });
}

// Helper: auto-process waitlist entries when a booking is cancelled
async function processWaitlistOnCancellation(
  _cancelledBookingId: string,
  tenantId: string,
  propertyId: string,
  roomTypeId: string,
  cancelledCheckIn: Date,
  cancelledCheckOut: Date,
) {
  // Find the highest-priority waiting entry for the same room type and overlapping dates
  const waitlistEntries = await db.waitlistEntry.findMany({
    where: {
      tenantId,
      propertyId,
      roomTypeId,
      status: 'waiting',
      // Check for date overlap: waitlist checkIn < cancelledCheckOut AND waitlist checkOut > cancelledCheckIn
      checkIn: { lt: cancelledCheckOut },
      checkOut: { gt: cancelledCheckIn },
    },
    orderBy: { priority: 'desc' }, // Higher priority first (lower number = higher priority)
    take: 1,
  });

  if (waitlistEntries.length === 0) {
    return;
  }

  const entry = waitlistEntries[0];

  // Notify the highest-priority waitlisted guest
  await db.waitlistEntry.update({
    where: { id: entry.id },
    data: {
      status: 'notified',
    },
  });

  if (process.env.NODE_ENV !== 'production') {
    console.log(
      `[Waitlist] Notified waitlist entry ${entry.id} (guest: ${entry.guestId}) for room type ${roomTypeId} — a cancelled booking freed up availability.`
    );
  }
}

// GET /api/bookings/[id] - Get a single booking
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['bookings.manage', 'admin.bookings', 'admin.*'])) {
      return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
    }


  try {
    const { id } = await params;
    
    const booking = await db.booking.findUnique({
      where: { id, deletedAt: null },
      include: {
        primaryGuest: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            isVip: true,
            loyaltyTier: true,
          },
        },
        room: {
          select: {
            id: true,
            number: true,
            floor: true,
            status: true,
          },
        },
        roomType: {
          select: {
            id: true,
            name: true,
            code: true,
            basePrice: true,
            maxAdults: true,
            maxChildren: true,
          },
        },
        folios: {
          include: {
            lineItems: {
              orderBy: { createdAt: 'desc' },
              take: 20,
            },
            payments: {
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
              },
            },
          },
        },
      },
    });
    
    if (!booking) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Booking not found' } },
        { status: 404 }
      );
    }

    if (booking.tenantId !== user.tenantId) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Not found' } }, { status: 404 });
    }
    
    return NextResponse.json({
      success: true,
      data: booking,
    });
  } catch (error) {
    console.error('Error fetching booking:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch booking' } },
      { status: 500 }
    );
  }
}

// PUT /api/bookings/[id] - Update a booking
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['bookings.manage', 'admin.bookings', 'admin.*'])) {
      return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
    }


  try {
    const { id } = await params;
    const body = await request.json();
    
    const existingBooking = await db.booking.findUnique({
      where: { id, deletedAt: null },
      include: {
        primaryGuest: true,
        roomType: true,
        room: true,
      },
    });
    
    if (!existingBooking) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Booking not found' } },
        { status: 404 }
      );
    }

    if (existingBooking.tenantId !== user.tenantId) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Not found' } }, { status: 404 });
    }
    
    const {
      roomId,
      roomTypeId,
      checkIn,
      checkOut,
      adults,
      children,
      infants,
      roomRate,
      taxes,
      fees,
      discount,
      totalAmount,
      ratePlanId,
      promoCode,
      status,
      specialRequests,
      notes,
      internalNotes,
      actualCheckIn,
      actualCheckOut,
      checkedInBy,
      checkedOutBy,
      cancelledAt,
      cancelledBy,
      cancellationReason,
      preArrivalSent,
      preArrivalCompleted,
      kycCompleted,
    } = body;
    
    // Capture old values for audit
    const oldValue = {
      status: existingBooking.status,
      confirmationCode: existingBooking.confirmationCode,
      roomId: existingBooking.roomId,
      checkIn: existingBooking.checkIn,
      checkOut: existingBooking.checkOut,
      totalAmount: existingBooking.totalAmount,
    };
    
    // Handle status transitions
    if (status && status !== existingBooking.status) {
      const validTransitions: Record<string, string[]> = {
        draft: ['confirmed', 'cancelled'],
        confirmed: ['checked_in', 'cancelled', 'no_show'],
        checked_in: ['checked_out'],
        checked_out: [],
        cancelled: [],
        no_show: [],
      };
      
      if (!validTransitions[existingBooking.status]?.includes(status)) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_STATUS_TRANSITION', message: `Cannot transition from ${existingBooking.status} to ${status}` } },
          { status: 400 }
        );
      }
    }
    
    // If dates are being changed, validate
    const newCheckIn = checkIn ? new Date(checkIn) : existingBooking.checkIn;
    const newCheckOut = checkOut ? new Date(checkOut) : existingBooking.checkOut;
    
    if (newCheckIn >= newCheckOut) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_DATES', message: 'Check-out must be after check-in' } },
        { status: 400 }
      );
    }
    
    // If room is being changed, check availability
    if (roomId && roomId !== existingBooking.roomId) {
      const conflictingBookings = await db.booking.findMany({
        where: {
          roomId,
          id: { not: id },
          status: { in: ['confirmed', 'checked_in'] },
          deletedAt: null,
          OR: [
            {
              checkIn: { lt: newCheckOut },
              checkOut: { gt: newCheckIn },
            },
          ],
        },
      });
      
      if (conflictingBookings.length > 0) {
        return NextResponse.json(
          { success: false, error: { code: 'ROOM_UNAVAILABLE', message: 'Room is not available for the selected dates' } },
          { status: 400 }
        );
      }
    }
    
    // Validate max occupancy if adults/children counts are being updated
    if (adults !== undefined || children !== undefined || infants !== undefined) {
      const effectiveRoomTypeId = roomTypeId || existingBooking.roomTypeId;
      const roomTypeForOccupancy = existingBooking.roomType?.id === effectiveRoomTypeId
        ? existingBooking.roomType
        : await db.roomType.findUnique({ where: { id: effectiveRoomTypeId } });
      if (roomTypeForOccupancy) {
        const effectiveAdults = adults !== undefined ? adults : existingBooking.adults;
        const effectiveChildren = children !== undefined ? children : existingBooking.children;
        const effectiveInfants = infants !== undefined ? infants : existingBooking.infants;
        const totalGuests = (effectiveAdults || 1) + (effectiveChildren || 0) + (effectiveInfants || 0);
        if (roomTypeForOccupancy.maxOccupancy && totalGuests > roomTypeForOccupancy.maxOccupancy) {
          return NextResponse.json(
            { success: false, error: { code: 'OCCUPANCY_EXCEEDED', message: `Total guests (${totalGuests}) exceeds room type maximum occupancy (${roomTypeForOccupancy.maxOccupancy})` } },
            { status: 400 }
          );
        }
        if (roomTypeForOccupancy.maxAdults && (effectiveAdults || 1) > roomTypeForOccupancy.maxAdults) {
          return NextResponse.json(
            { success: false, error: { code: 'ADULT_OCCUPANCY_EXCEEDED', message: `Number of adults (${effectiveAdults}) exceeds maximum (${roomTypeForOccupancy.maxAdults})` } },
            { status: 400 }
          );
        }
      }
    }
    
    const booking = await db.booking.update({
      where: { id },
      data: {
        ...(roomId !== undefined && { roomId }),
        ...(roomTypeId && { roomTypeId }),
        ...(checkIn && { checkIn: new Date(checkIn) }),
        ...(checkOut && { checkOut: new Date(checkOut) }),
        ...(adults !== undefined && { adults }),
        ...(children !== undefined && { children }),
        ...(infants !== undefined && { infants }),
        ...(roomRate !== undefined && { roomRate }),
        ...(taxes !== undefined && { taxes }),
        ...(fees !== undefined && { fees }),
        ...(discount !== undefined && { discount }),
        ...(totalAmount !== undefined && { totalAmount }),
        ...(ratePlanId !== undefined && { ratePlanId }),
        ...(promoCode !== undefined && { promoCode }),
        ...(status && { status }),
        ...(specialRequests !== undefined && { specialRequests }),
        ...(notes !== undefined && { notes }),
        ...(internalNotes !== undefined && { internalNotes }),
        ...(actualCheckIn !== undefined && { actualCheckIn: actualCheckIn ? new Date(actualCheckIn) : null }),
        ...(actualCheckOut !== undefined && { actualCheckOut: actualCheckOut ? new Date(actualCheckOut) : null }),
        ...(checkedInBy !== undefined && { checkedInBy }),
        ...(checkedOutBy !== undefined && { checkedOutBy }),
        ...(cancelledAt !== undefined && { cancelledAt: cancelledAt ? new Date(cancelledAt) : null }),
        ...(cancelledBy !== undefined && { cancelledBy }),
        ...(cancellationReason !== undefined && { cancellationReason }),
        ...(preArrivalSent !== undefined && { preArrivalSent }),
        ...(preArrivalCompleted !== undefined && { preArrivalCompleted }),
        ...(kycCompleted !== undefined && { kycCompleted }),
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
          },
        },
        roomType: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });
    
    // Create audit log for status changes
    if (status && status !== existingBooking.status) {
      await db.bookingAuditLog.create({
        data: {
          bookingId: booking.id,
          action: 'status_change',
          oldStatus: existingBooking.status,
          newStatus: status,
          notes: `Status changed from ${existingBooking.status} to ${status}`,
        },
      });
      
      // Log to main audit log
      let auditAction: 'check_in' | 'check_out' | 'cancel' | 'confirm' | 'no_show' | 'modify' = 'modify';
      if (status === 'checked_in') auditAction = 'check_in';
      else if (status === 'checked_out') auditAction = 'check_out';
      else if (status === 'cancelled') auditAction = 'cancel';
      else if (status === 'confirmed') auditAction = 'confirm';
      else if (status === 'no_show') auditAction = 'no_show';
      
      try {
        await logBooking(request, auditAction, booking.id, oldValue, {
          confirmationCode: booking.confirmationCode,
          guestName: `${booking.primaryGuest.firstName} ${booking.primaryGuest.lastName}`,
          status: booking.status,
          roomNumber: booking.room?.number,
        }, { tenantId: user.tenantId, userId: user.id });
      } catch (auditError) {
        console.error('Failed to log booking status change to audit log:', auditError);
      }
    } else {
      // Log general update
      try {
        await logBooking(request, 'modify', booking.id, oldValue, {
          confirmationCode: booking.confirmationCode,
          guestName: `${booking.primaryGuest.firstName} ${booking.primaryGuest.lastName}`,
          status: booking.status,
          roomNumber: booking.room?.number,
        }, { tenantId: user.tenantId, userId: user.id });
      } catch (auditError) {
        console.error('Failed to log booking update to audit log:', auditError);
      }
    }
    
    // WiFi credentials to return (for check-in)
    let wifiCredentials: { username: string; password: string; validUntil: Date } | null = null;
    let wifiDeprovisioned = false;
    
    // Update room status based on booking status
    const effectiveRoomId = roomId || existingBooking.roomId;
    
    if (status === 'checked_in' && effectiveRoomId) {
      await db.room.update({
        where: { id: effectiveRoomId },
        data: { status: 'occupied' },
      });
      
      // Create or update GuestStay record for stay history
      const nights = Math.ceil((booking.checkOut.getTime() - booking.checkIn.getTime()) / (1000 * 60 * 60 * 24));
      await db.guestStay.upsert({
        where: {
          guestId_bookingId: {
            guestId: booking.primaryGuestId,
            bookingId: booking.id,
          },
        },
        update: {
          totalAmount: booking.totalAmount,
          roomNights: nights,
        },
        create: {
          guestId: booking.primaryGuestId,
          bookingId: booking.id,
          totalAmount: booking.totalAmount,
          roomNights: nights,
        },
      });
      
      // Emit room status change
      const room = await db.room.findUnique({
        where: { id: effectiveRoomId },
        include: { property: { select: { tenantId: true } } }
      });
      if (room) {
        emitRoomStatusChange({
          roomId: effectiveRoomId,
          propertyId: room.propertyId,
          tenantId: room.property.tenantId,
          status: 'occupied',
          previousStatus: 'available',
        });
      }
      
      // WiFi provisioning + emit event
      try {
        // Check autoProvisionOnCheckin flag before provisioning
        const aaaConfig = await db.wiFiAAAConfig.findUnique({
          where: { propertyId: booking.propertyId },
          select: { autoProvisionOnCheckin: true },
        });

        if (aaaConfig?.autoProvisionOnCheckin !== false) {
          // Directly provision WiFi (not via event — avoids duplicate provisioning)
          const { wifiProvisioningService } = await import('@/lib/wifi/services/provisioning-service');
          const provisionResult = await wifiProvisioningService.provisionWiFiForBooking({
            bookingId: booking.id,
            tenantId: booking.tenantId,
            propertyId: booking.propertyId,
            guestId: booking.primaryGuestId,
            guestName: `${booking.primaryGuest.firstName} ${booking.primaryGuest.lastName}`,
            roomTypeId: booking.roomTypeId,
            roomTypeName: existingBooking.roomType.name,
            checkIn: booking.checkIn,
            checkOut: booking.checkOut,
            roomNumber: booking.room?.number,
          });

          if (provisionResult.success) {
            console.log(`[Check-in] WiFi provisioned: ${provisionResult.username} for booking ${booking.confirmationCode}`);
            wifiCredentials = {
              username: provisionResult.username!,
              password: provisionResult.password!,
              validUntil: provisionResult.validUntil!,
            };
          } else {
            console.error(`[Check-in] WiFi provisioning failed for booking ${booking.confirmationCode}: ${provisionResult.error}`);
          }
        } else {
          console.log(`[Check-in] WiFi auto-provisioning disabled for property ${booking.propertyId}`);
        }

        // Emit event for other consumers (realtime, notifications, etc.)
        // NOTE: WiFi provisioning is done directly above, NOT via this event handler
        await emitBookingCheckedIn({
          bookingId: booking.id,
          tenantId: booking.tenantId,
          propertyId: booking.propertyId,
          confirmationCode: booking.confirmationCode,
          guestId: booking.primaryGuestId,
          guestName: `${booking.primaryGuest.firstName} ${booking.primaryGuest.lastName}`,
          guestEmail: booking.primaryGuest.email ?? undefined,
          guestPhone: booking.primaryGuest.phone ?? undefined,
          roomTypeId: booking.roomTypeId,
          roomTypeName: existingBooking.roomType.name,
          roomId: effectiveRoomId,
          roomNumber: booking.room?.number,
          checkIn: booking.checkIn,
          checkOut: booking.checkOut,
          actualCheckIn: actualCheckIn ? new Date(actualCheckIn) : new Date(),
          assignedRoomId: effectiveRoomId,
          assignedRoomNumber: booking.room?.number || '',
          performedBy: checkedInBy,
        });
      } catch (wifiError) {
        console.error('Failed to provision WiFi on check-in:', wifiError);
        // Don't fail the check-in if WiFi provisioning fails
      }
    } else if (status === 'checked_out' && effectiveRoomId) {
      // Wrap ALL checkout database side-effects in a single transaction for data integrity.
      // This ensures room status, folio close, invoice generation, WiFi fees, and loyalty
      // points either all succeed or all roll back — no partial/ghost state.
      try {
        await db.$transaction(async (tx) => {
          // 1. Update room status to 'dirty'
          await tx.room.update({
            where: { id: effectiveRoomId },
            data: { status: 'dirty' },
          });

          // 2. Auto-close folio and generate invoice
          await autoCloseFolioAndGenerateInvoice(booking.id, tx);

          // 3. Post WiFi usage fees to folio
          const activeWifiSessions = await tx.wiFiSession.findMany({
            where: {
              OR: [
                { bookingId: booking.id },
                { guestId: booking.primaryGuestId },
              ],
              status: 'active',
            },
            include: { plan: true },
          });

          if (activeWifiSessions.length > 0) {
            let totalWifiFee = 0;
            const planDetails: string[] = [];

            for (const session of activeWifiSessions) {
              if (session.plan && session.plan.price > 0) {
                totalWifiFee += session.plan.price;
                planDetails.push(session.plan.name);
              }
            }

            if (totalWifiFee > 0) {
              // Close any active WiFi sessions
              await tx.wiFiSession.updateMany({
                where: {
                  id: { in: activeWifiSessions.map(s => s.id) },
                },
                data: {
                  status: 'disconnected',
                  endTime: new Date(),
                },
              });

              // Find or create folio for the booking
              let wifiFolio = await tx.folio.findFirst({
                where: { bookingId: booking.id, tenantId: booking.tenantId, status: { in: ['open', 'partially_paid'] } },
              });

              if (!wifiFolio) {
                wifiFolio = await tx.folio.findFirst({
                  where: { bookingId: booking.id, tenantId: booking.tenantId },
                });
              }

              if (wifiFolio) {
                await tx.folioLineItem.create({
                  data: {
                    folioId: wifiFolio.id,
                    description: `WiFi Usage Charges (${planDetails.join(', ')})`,
                    category: 'wifi',
                    quantity: 1,
                    unitPrice: totalWifiFee,
                    totalAmount: totalWifiFee,
                    serviceDate: new Date(),
                    postedBy: user.id,
                  },
                });

                // Recalculate folio totals
                const allLineItems = await tx.folioLineItem.findMany({ where: { folioId: wifiFolio.id } });
                const newSubtotal = allLineItems.reduce((sum, li) => sum + li.totalAmount, 0);
                await tx.folio.update({
                  where: { id: wifiFolio.id },
                  data: {
                    subtotal: newSubtotal,
                    totalAmount: newSubtotal + wifiFolio.taxes - wifiFolio.discount,
                    balance: Math.max(0, newSubtotal - wifiFolio.paidAmount),
                  },
                });

                if (process.env.NODE_ENV !== 'production') {
                  console.log(`[WiFi] Posted WiFi usage fee of ${totalWifiFee} to folio ${wifiFolio.id} for booking ${booking.confirmationCode}`);
                }
              }
            }
          }

          // 4. Auto-award loyalty points (atomic increment to avoid TOCTOU race)
          const guest = await tx.guest.findUnique({ where: { id: booking.primaryGuestId } });
          if (guest) {
            // Points = totalAmount / 100 (1 point per currency unit)
            const pointsToAward = Math.floor(booking.totalAmount / 100);
            if (pointsToAward > 0) {
              // Atomic increment — avoids read-then-write race condition
              const updatedGuest = await tx.guest.update({
                where: { id: guest.id },
                data: { loyaltyPoints: { increment: pointsToAward } },
              });
              await tx.loyaltyPointTransaction.create({
                data: {
                  tenantId: booking.tenantId,
                  guestId: guest.id,
                  points: pointsToAward,
                  balance: updatedGuest.loyaltyPoints,
                  type: 'earn',
                  source: 'stay_completion',
                  referenceId: booking.id,
                  referenceType: 'booking',
                  description: `Points earned from stay ${booking.confirmationCode}`,
                }
              });
              if (process.env.NODE_ENV !== 'production') {
                console.log(`[Loyalty] Awarded ${pointsToAward} points to guest ${guest.id} for booking ${booking.confirmationCode}`);
              }
            }
          }
        });
      } catch (checkoutTxError) {
        console.error('Checkout transaction failed, rolling back all side-effects:', checkoutTxError);
        // The checkout status was already written above; re-throw to return 500
        // so the caller knows the side-effects did not complete.
        throw checkoutTxError;
      }
      
      // Non-transactional side-effects (notifications, events — safe to retry independently)
      
      // Emit room status change
      const room = await db.room.findUnique({
        where: { id: effectiveRoomId },
        include: { property: { select: { tenantId: true } } }
      });
      if (room) {
        emitRoomStatusChange({
          roomId: effectiveRoomId,
          propertyId: room.propertyId,
          tenantId: room.property.tenantId,
          status: 'dirty',
          previousStatus: 'occupied',
        });
      }

      // Auto-trigger housekeeping: mark room dirty + create checkout cleaning task
      try {
        await markRoomDirtyAfterCheckout(effectiveRoomId, booking.tenantId, booking.id);
      } catch (hkError) {
        console.error('Failed to auto-trigger housekeeping on checkout:', hkError);
        // Don't fail the checkout if housekeeping automation fails
      }
      
      // Emit booking checked-out event (triggers WiFi deprovisioning)
      try {
        // Get folio information for total/paid amounts
        const folio = await db.folio.findFirst({
          where: { bookingId: booking.id },
          select: { totalAmount: true, paidAmount: true },
        });
        
        await emitBookingCheckedOut({
          bookingId: booking.id,
          tenantId: booking.tenantId,
          propertyId: booking.propertyId,
          confirmationCode: booking.confirmationCode,
          guestId: booking.primaryGuestId,
          guestName: `${booking.primaryGuest.firstName} ${booking.primaryGuest.lastName}`,
          guestEmail: booking.primaryGuest.email ?? undefined,
          guestPhone: booking.primaryGuest.phone ?? undefined,
          roomTypeId: booking.roomTypeId,
          roomTypeName: existingBooking.roomType.name,
          roomId: effectiveRoomId,
          roomNumber: booking.room?.number,
          checkIn: booking.checkIn,
          checkOut: booking.checkOut,
          actualCheckOut: actualCheckOut ? new Date(actualCheckOut) : new Date(),
          totalAmount: folio?.totalAmount || booking.totalAmount,
          paidAmount: folio?.paidAmount || 0,
          performedBy: checkedOutBy,
        });
        
        wifiDeprovisioned = true;
      } catch (wifiError) {
        console.error('Failed to deprovision WiFi on check-out:', wifiError);
        // Don't fail the check-out if WiFi deprovisioning fails
      }
    }
    
    // Emit WebSocket event for booking cancelled
    if (status === 'cancelled' && existingBooking.status !== 'cancelled') {
      try {
        emitBookingCancelledWS({
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
        
        // Emit booking cancelled event (triggers WiFi deprovisioning)
        await emitBookingCancelledEvent({
          bookingId: booking.id,
          tenantId: booking.tenantId,
          propertyId: booking.propertyId,
          confirmationCode: booking.confirmationCode,
          guestId: booking.primaryGuestId,
          guestName: `${booking.primaryGuest.firstName} ${booking.primaryGuest.lastName}`,
          guestEmail: booking.primaryGuest.email ?? undefined,
          guestPhone: booking.primaryGuest.phone ?? undefined,
          roomTypeId: booking.roomTypeId,
          roomTypeName: existingBooking.roomType.name,
          roomId: booking.roomId || undefined,
          roomNumber: booking.room?.number,
          checkIn: booking.checkIn,
          checkOut: booking.checkOut,
          cancellationReason,
          cancelledAt: cancelledAt ? new Date(cancelledAt) : new Date(),
          performedBy: cancelledBy,
        });
      } catch (wsError) {
        console.error('Failed to emit booking cancelled event:', wsError);
      }

      // Auto-process waitlist on booking cancellation (PUT)
      try {
        await processWaitlistOnCancellation(booking.id, booking.tenantId, booking.propertyId, booking.roomTypeId, booking.checkIn, booking.checkOut);
      } catch (wlError) {
        console.error('Failed to process waitlist on cancellation:', wlError);
      }
    }
    
    // Cancellation policy integration — evaluate and apply penalty
    let cancellationResult: CancellationResult | null = null;
    if (status === 'cancelled' && existingBooking.status !== 'cancelled') {
      try {
        cancellationResult = await evaluateCancellationPolicy({
          bookingId: booking.id,
          tenantId: booking.tenantId,
        });

        if (cancellationResult.penaltyAmount > 0) {
          // Find or create folio and add penalty line item
          let folio = await db.folio.findFirst({
            where: { bookingId: booking.id, tenantId: booking.tenantId },
          });

          if (!folio) {
            const folioCount = await db.folio.count({ where: { tenantId: booking.tenantId } });
            folio = await db.folio.create({
              data: {
                tenantId: booking.tenantId,
                propertyId: booking.propertyId,
                bookingId: booking.id,
                folioNumber: `FOL-${(folioCount + 1).toString().padStart(5, '0')}`,
                guestId: booking.primaryGuestId,
                subtotal: 0,
                taxes: 0,
                discount: 0,
                totalAmount: 0,
                paidAmount: 0,
                balance: 0,
                currency: booking.currency,
              },
            });
          }

          await db.folioLineItem.create({
            data: {
              folioId: folio.id,
              description: `Cancellation penalty - ${cancellationResult.policy.name}`,
              category: 'penalty',
              quantity: 1,
              unitPrice: cancellationResult.penaltyAmount,
              totalAmount: cancellationResult.penaltyAmount,
              serviceDate: new Date(),
              referenceType: 'cancellation_policy',
              referenceId: cancellationResult.policy.id !== 'none' ? cancellationResult.policy.id : null,
              postedBy: user.id,
            },
          });

          // Update folio totals
          const allLineItems = await db.folioLineItem.findMany({
            where: { folioId: folio.id },
          });
          const newSubtotal = allLineItems.reduce((sum, li) => sum + li.totalAmount, 0);
          const newBalance = newSubtotal - folio.paidAmount;
          await db.folio.update({
            where: { id: folio.id },
            data: {
              subtotal: newSubtotal,
              totalAmount: newSubtotal + folio.taxes - folio.discount,
              balance: Math.max(0, newBalance),
            },
          });
        }
      } catch (penaltyError) {
        console.error('Failed to apply cancellation penalty:', penaltyError);
        // Don't fail the cancellation if penalty application fails
      }
    }

    return NextResponse.json({ 
      success: true, 
      data: booking,
      // Include cancellation policy result if applicable
      ...(cancellationResult && {
        cancellation: {
          isWithinFreeWindow: cancellationResult.isWithinFreeWindow,
          penaltyAmount: cancellationResult.penaltyAmount,
          penaltyType: cancellationResult.penaltyType,
          policyName: cancellationResult.policy.name,
          hoursUntilCheckIn: cancellationResult.hoursUntilCheckIn,
          isExempt: cancellationResult.isExempt,
          exemptReason: cancellationResult.exemptReason,
        },
      }),
      // Include WiFi info in response
      ...(wifiCredentials && { wifi: { credentials: wifiCredentials } }),
      ...(wifiDeprovisioned && { wifi: { deprovisioned: true } }),
    });
  } catch (error) {
    console.error('Error updating booking:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update booking' } },
      { status: 500 }
    );
  }
}

// PATCH /api/bookings/[id] - Partial update a booking
// This method supports partial updates - only provided fields will be updated
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['bookings.manage', 'admin.bookings', 'admin.*'])) {
      return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
    }


  try {
    const { id } = await params;
    const body = await request.json();

    // Validate that at least one field is provided
    const allowedFields = [
      'roomId', 'roomTypeId', 'checkIn', 'checkOut', 'adults', 'children', 'infants',
      'roomRate', 'taxes', 'fees', 'discount', 'totalAmount', 'ratePlanId', 'promoCode',
      'status', 'specialRequests', 'notes', 'internalNotes', 'actualCheckIn', 'actualCheckOut',
      'checkedInBy', 'checkedOutBy', 'cancelledAt', 'cancelledBy', 'cancellationReason',
      'preArrivalSent', 'preArrivalCompleted', 'kycCompleted'
    ];

    const providedFields = Object.keys(body).filter(key => allowedFields.includes(key));
    if (providedFields.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'No valid fields provided for update' } },
        { status: 400 }
      );
    }

    const existingBooking = await db.booking.findUnique({
      where: { id, deletedAt: null },
      include: {
        primaryGuest: true,
        roomType: true,
        room: true,
      },
    });

    if (!existingBooking) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Booking not found' } },
        { status: 404 }
      );
    }

    if (existingBooking.tenantId !== user.tenantId) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Not found' } }, { status: 404 });
    }

    const {
      roomId,
      roomTypeId,
      checkIn,
      checkOut,
      adults,
      children,
      infants,
      roomRate,
      taxes,
      fees,
      discount,
      totalAmount,
      ratePlanId,
      promoCode,
      status,
      specialRequests,
      notes,
      internalNotes,
      actualCheckIn,
      actualCheckOut,
      checkedInBy,
      checkedOutBy,
      cancelledAt,
      cancelledBy,
      cancellationReason,
      preArrivalSent,
      preArrivalCompleted,
      kycCompleted,
    } = body;

    // Capture old values for audit
    const oldValue = {
      status: existingBooking.status,
      confirmationCode: existingBooking.confirmationCode,
      roomId: existingBooking.roomId,
      checkIn: existingBooking.checkIn,
      checkOut: existingBooking.checkOut,
      totalAmount: existingBooking.totalAmount,
    };

    // Handle status transitions if status is being updated
    if (status !== undefined && status !== existingBooking.status) {
      const validTransitions: Record<string, string[]> = {
        draft: ['confirmed', 'cancelled'],
        confirmed: ['checked_in', 'cancelled', 'no_show'],
        checked_in: ['checked_out'],
        checked_out: [],
        cancelled: [],
        no_show: [],
      };

      if (!validTransitions[existingBooking.status]?.includes(status)) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_STATUS_TRANSITION', message: `Cannot transition from ${existingBooking.status} to ${status}` } },
          { status: 400 }
        );
      }
    }

    // If dates are being changed, validate
    const newCheckIn = checkIn !== undefined ? new Date(checkIn) : existingBooking.checkIn;
    const newCheckOut = checkOut !== undefined ? new Date(checkOut) : existingBooking.checkOut;

    if (newCheckIn >= newCheckOut) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_DATES', message: 'Check-out must be after check-in' } },
        { status: 400 }
      );
    }

    // If room is being changed, check availability
    if (roomId !== undefined && roomId !== existingBooking.roomId) {
      const conflictingBookings = await db.booking.findMany({
        where: {
          roomId,
          id: { not: id },
          status: { in: ['confirmed', 'checked_in'] },
          deletedAt: null,
          OR: [
            {
              checkIn: { lt: newCheckOut },
              checkOut: { gt: newCheckIn },
            },
          ],
        },
      });

      if (conflictingBookings.length > 0) {
        return NextResponse.json(
          { success: false, error: { code: 'ROOM_UNAVAILABLE', message: 'Room is not available for the selected dates' } },
          { status: 400 }
        );
      }
    }

    // Validate max occupancy if adults/children counts are being updated
    if (adults !== undefined || children !== undefined || infants !== undefined) {
      const effectiveRoomTypeId = roomTypeId || existingBooking.roomTypeId;
      const roomTypeForOccupancy = await db.roomType.findUnique({ where: { id: effectiveRoomTypeId } });
      if (roomTypeForOccupancy) {
        const effectiveAdults = adults !== undefined ? adults : existingBooking.adults;
        const effectiveChildren = children !== undefined ? children : existingBooking.children;
        const effectiveInfants = infants !== undefined ? infants : existingBooking.infants;
        const totalGuests = (effectiveAdults || 1) + (effectiveChildren || 0) + (effectiveInfants || 0);
        if (roomTypeForOccupancy.maxOccupancy && totalGuests > roomTypeForOccupancy.maxOccupancy) {
          return NextResponse.json(
            { success: false, error: { code: 'OCCUPANCY_EXCEEDED', message: `Total guests (${totalGuests}) exceeds room type maximum occupancy (${roomTypeForOccupancy.maxOccupancy})` } },
            { status: 400 }
          );
        }
        if (roomTypeForOccupancy.maxAdults && (effectiveAdults || 1) > roomTypeForOccupancy.maxAdults) {
          return NextResponse.json(
            { success: false, error: { code: 'ADULT_OCCUPANCY_EXCEEDED', message: `Number of adults (${effectiveAdults}) exceeds maximum (${roomTypeForOccupancy.maxAdults})` } },
            { status: 400 }
          );
        }
      }
    }

    // Build update data with only provided fields
    const updateData: Record<string, unknown> = {};
    if (roomId !== undefined) updateData.roomId = roomId;
    if (roomTypeId !== undefined) updateData.roomTypeId = roomTypeId;
    if (checkIn !== undefined) updateData.checkIn = new Date(checkIn);
    if (checkOut !== undefined) updateData.checkOut = new Date(checkOut);
    if (adults !== undefined) updateData.adults = adults;
    if (children !== undefined) updateData.children = children;
    if (infants !== undefined) updateData.infants = infants;
    if (roomRate !== undefined) updateData.roomRate = roomRate;
    if (taxes !== undefined) updateData.taxes = taxes;
    if (fees !== undefined) updateData.fees = fees;
    if (discount !== undefined) updateData.discount = discount;
    if (totalAmount !== undefined) updateData.totalAmount = totalAmount;
    if (ratePlanId !== undefined) updateData.ratePlanId = ratePlanId;
    if (promoCode !== undefined) updateData.promoCode = promoCode;
    if (status !== undefined) updateData.status = status;
    if (specialRequests !== undefined) updateData.specialRequests = specialRequests;
    if (notes !== undefined) updateData.notes = notes;
    if (internalNotes !== undefined) updateData.internalNotes = internalNotes;
    if (actualCheckIn !== undefined) updateData.actualCheckIn = actualCheckIn ? new Date(actualCheckIn) : null;
    if (actualCheckOut !== undefined) updateData.actualCheckOut = actualCheckOut ? new Date(actualCheckOut) : null;
    if (checkedInBy !== undefined) updateData.checkedInBy = checkedInBy;
    if (checkedOutBy !== undefined) updateData.checkedOutBy = checkedOutBy;
    if (cancelledAt !== undefined) updateData.cancelledAt = cancelledAt ? new Date(cancelledAt) : null;
    if (cancelledBy !== undefined) updateData.cancelledBy = cancelledBy;
    if (cancellationReason !== undefined) updateData.cancellationReason = cancellationReason;
    if (preArrivalSent !== undefined) updateData.preArrivalSent = preArrivalSent;
    if (preArrivalCompleted !== undefined) updateData.preArrivalCompleted = preArrivalCompleted;
    if (kycCompleted !== undefined) updateData.kycCompleted = kycCompleted;

    const booking = await db.booking.update({
      where: { id },
      data: updateData,
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
          },
        },
        roomType: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    // Create audit log for status changes
    if (status !== undefined && status !== existingBooking.status) {
      await db.bookingAuditLog.create({
        data: {
          bookingId: booking.id,
          action: 'status_change',
          oldStatus: existingBooking.status,
          newStatus: status,
          notes: `Status changed from ${existingBooking.status} to ${status} (PATCH)`,
        },
      });

      // Log to main audit log
      let auditAction: 'check_in' | 'check_out' | 'cancel' | 'confirm' | 'no_show' | 'modify' = 'modify';
      if (status === 'checked_in') auditAction = 'check_in';
      else if (status === 'checked_out') auditAction = 'check_out';
      else if (status === 'cancelled') auditAction = 'cancel';
      else if (status === 'confirmed') auditAction = 'confirm';
      else if (status === 'no_show') auditAction = 'no_show';

      try {
        await logBooking(request, auditAction, booking.id, oldValue, {
          confirmationCode: booking.confirmationCode,
          guestName: `${booking.primaryGuest.firstName} ${booking.primaryGuest.lastName}`,
          status: booking.status,
          roomNumber: booking.room?.number,
        }, { tenantId: user.tenantId, userId: user.id });
      } catch (auditError) {
        console.error('Failed to log booking status change to audit log:', auditError);
      }
    } else {
      // Log general update
      try {
        await logBooking(request, 'modify', booking.id, oldValue, {
          confirmationCode: booking.confirmationCode,
          guestName: `${booking.primaryGuest.firstName} ${booking.primaryGuest.lastName}`,
          status: booking.status,
          roomNumber: booking.room?.number,
        }, { tenantId: user.tenantId, userId: user.id });
      } catch (auditError) {
        console.error('Failed to log booking update to audit log:', auditError);
      }
    }

    // Send status change notification email
    if (status !== undefined && status !== existingBooking.status && ['confirmed', 'checked_in', 'checked_out', 'cancelled'].includes(status)) {
      try {
        const guest = await db.guest.findFirst({
          where: { id: existingBooking.primaryGuestId, deletedAt: null },
        });

        if (guest?.email) {
          const statusMessages: Record<string, { subject: string; body: string }> = {
            confirmed: { subject: 'Booking Confirmed', body: 'Your booking has been confirmed.' },
            checked_in: { subject: 'Welcome! You have checked in', body: 'You have been successfully checked in. We hope you enjoy your stay!' },
            checked_out: { subject: 'Thank you for your stay', body: 'You have been checked out. Thank you for choosing us!' },
            cancelled: { subject: 'Booking Cancelled', body: 'Your booking has been cancelled as requested.' },
          };

          const msg = statusMessages[status];
          if (msg) {
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || '';
            await emailService.send({
              to: guest.email,
              subject: `${msg.subject} - StaySuite`,
              variables: {
                guestName: guest.firstName || 'Guest',
                bookingId: existingBooking.id,
                message: msg.body,
                portalLink: appUrl ? `${appUrl}/portal?token=${existingBooking.portalToken || ''}` : '',
              },
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <h2 style="color: #1a1a2e;">${msg.subject}</h2>
                  <p>Hello {{guestName}},</p>
                  <p>{{message}}</p>
                  <p>Booking ID: <strong>{{bookingId}}</strong></p>
                  ${status !== 'cancelled' && '<p><a href="{{portalLink}}" style="display: inline-block; padding: 12px 24px; background-color: #1a1a2e; color: white; text-decoration: none; border-radius: 6px;">Manage Your Booking</a></p>'}
                  <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                  <p style="color: #888; font-size: 12px;">StaySuite Hotel Management System</p>
                </div>
              `,
              text: `Hello {{guestName}},\n\n{{message}}\n\nBooking ID: {{bookingId}}\n\nStaySuite Hotel Management System`,
              tags: { type: 'booking_status_change', bookingId: existingBooking.id, status },
            });
          }
        }
      } catch (emailError) {
        console.error('[Booking] Failed to send status change email:', emailError);
      }
    }

    // FIX 3: WiFi credentials to return (for check-in)
    let patchWifiCredentials: { username: string; password: string; validUntil: Date } | null = null;
    let patchWifiDeprovisioned = false;

    // Update room status based on booking status
    const effectivePatchRoomId = roomId !== undefined ? roomId : existingBooking.roomId;

    if (status === 'checked_in' && effectivePatchRoomId) {
      await db.room.update({
        where: { id: effectivePatchRoomId },
        data: { status: 'occupied' },
      });

      // Create or update GuestStay record for stay history
      const nights = Math.ceil((booking.checkOut.getTime() - booking.checkIn.getTime()) / (1000 * 60 * 60 * 24));
      await db.guestStay.upsert({
        where: {
          guestId_bookingId: {
            guestId: booking.primaryGuestId,
            bookingId: booking.id,
          },
        },
        update: {
          totalAmount: booking.totalAmount,
          roomNights: nights,
        },
        create: {
          guestId: booking.primaryGuestId,
          bookingId: booking.id,
          totalAmount: booking.totalAmount,
          roomNights: nights,
        },
      }).catch(() => {
        // Ignore errors if upsert fails (e.g., unique constraint)
      });

      const room = await db.room.findUnique({
        where: { id: effectivePatchRoomId },
        include: { property: { select: { tenantId: true } } }
      });
      if (room) {
        emitRoomStatusChange({
          roomId: effectivePatchRoomId,
          propertyId: room.propertyId,
          tenantId: room.property.tenantId,
          status: 'occupied',
          previousStatus: 'available',
        });
      }

      // WiFi provisioning + emit event (PATCH handler)
      try {
        // Directly provision WiFi (not via event — event fires before handler is registered)
        const { wifiProvisioningService } = await import('@/lib/wifi/services/provisioning-service');
        const provisionResult = await wifiProvisioningService.provisionWiFiForBooking({
          bookingId: booking.id,
          tenantId: booking.tenantId,
          propertyId: booking.propertyId,
          guestId: booking.primaryGuestId,
          guestName: `${booking.primaryGuest.firstName} ${booking.primaryGuest.lastName}`,
          roomTypeId: booking.roomTypeId,
          roomTypeName: existingBooking.roomType.name,
          checkIn: booking.checkIn,
          checkOut: booking.checkOut,
          roomNumber: booking.room?.number,
        });

        if (provisionResult.success) {
          console.log(`[Check-in PATCH] WiFi provisioned: ${provisionResult.username} for booking ${booking.confirmationCode}`);
          patchWifiCredentials = {
            username: provisionResult.username!,
            password: provisionResult.password!,
            validUntil: provisionResult.validUntil!,
          };
        } else {
          console.error(`[Check-in PATCH] WiFi provisioning failed for booking ${booking.confirmationCode}: ${provisionResult.error}`);
        }

        // Also emit event for any other consumers (realtime, notifications, etc.)
        await emitBookingCheckedIn({
          bookingId: booking.id,
          tenantId: booking.tenantId,
          propertyId: booking.propertyId,
          confirmationCode: booking.confirmationCode,
          guestId: booking.primaryGuestId,
          guestName: `${booking.primaryGuest.firstName} ${booking.primaryGuest.lastName}`,
          guestEmail: booking.primaryGuest.email ?? undefined,
          guestPhone: booking.primaryGuest.phone ?? undefined,
          roomTypeId: booking.roomTypeId,
          roomTypeName: existingBooking.roomType.name,
          roomId: effectivePatchRoomId,
          roomNumber: booking.room?.number,
          checkIn: booking.checkIn,
          checkOut: booking.checkOut,
          actualCheckIn: actualCheckIn ? new Date(actualCheckIn) : new Date(),
          assignedRoomId: effectivePatchRoomId,
          assignedRoomNumber: booking.room?.number || '',
          performedBy: checkedInBy,
        });
      } catch (wifiError) {
        console.error('Failed to provision WiFi on check-in (PATCH):', wifiError);
        // Don't fail the check-in if WiFi provisioning fails
      }
    } else if (status === 'checked_out' && effectivePatchRoomId) {
      // Wrap ALL checkout database side-effects in a single transaction for data integrity.
      try {
        await db.$transaction(async (tx) => {
          // 1. Update room status to 'dirty'
          await tx.room.update({
            where: { id: effectivePatchRoomId },
            data: { status: 'dirty' },
          });

          // 2. Auto-close folio and generate invoice
          await autoCloseFolioAndGenerateInvoice(booking.id, tx);

          // 3. Post WiFi usage fees to folio
          const activeWifiSessions = await tx.wiFiSession.findMany({
            where: {
              OR: [
                { bookingId: booking.id },
                { guestId: booking.primaryGuestId },
              ],
              status: 'active',
            },
            include: { plan: true },
          });

          if (activeWifiSessions.length > 0) {
            let totalWifiFee = 0;
            const planDetails: string[] = [];

            for (const session of activeWifiSessions) {
              if (session.plan && session.plan.price > 0) {
                totalWifiFee += session.plan.price;
                planDetails.push(session.plan.name);
              }
            }

            if (totalWifiFee > 0) {
              await tx.wiFiSession.updateMany({
                where: { id: { in: activeWifiSessions.map(s => s.id) } },
                data: { status: 'disconnected', endTime: new Date() },
              });

              let wifiFolio = await tx.folio.findFirst({
                where: { bookingId: booking.id, tenantId: booking.tenantId, status: { in: ['open', 'partially_paid'] } },
              });

              if (!wifiFolio) {
                wifiFolio = await tx.folio.findFirst({
                  where: { bookingId: booking.id, tenantId: booking.tenantId },
                });
              }

              if (wifiFolio) {
                await tx.folioLineItem.create({
                  data: {
                    folioId: wifiFolio.id,
                    description: `WiFi Usage Charges (${planDetails.join(', ')})`,
                    category: 'wifi',
                    quantity: 1,
                    unitPrice: totalWifiFee,
                    totalAmount: totalWifiFee,
                    serviceDate: new Date(),
                    postedBy: user.id,
                  },
                });

                const allLineItems = await tx.folioLineItem.findMany({ where: { folioId: wifiFolio.id } });
                const newSubtotal = allLineItems.reduce((sum, li) => sum + li.totalAmount, 0);
                await tx.folio.update({
                  where: { id: wifiFolio.id },
                  data: {
                    subtotal: newSubtotal,
                    totalAmount: newSubtotal + wifiFolio.taxes - wifiFolio.discount,
                    balance: Math.max(0, newSubtotal - wifiFolio.paidAmount),
                  },
                });

                if (process.env.NODE_ENV !== 'production') {
                  console.log(`[WiFi] Posted WiFi usage fee of ${totalWifiFee} to folio ${wifiFolio.id} for booking ${booking.confirmationCode} (PATCH)`);
                }
              }
            }
          }

          // 4. Auto-award loyalty points (atomic increment to avoid TOCTOU race)
          const guest = await tx.guest.findUnique({ where: { id: booking.primaryGuestId } });
          if (guest) {
            const pointsToAward = Math.floor(booking.totalAmount / 100);
            if (pointsToAward > 0) {
              // Atomic increment — avoids read-then-write race condition
              const updatedGuest = await tx.guest.update({
                where: { id: guest.id },
                data: { loyaltyPoints: { increment: pointsToAward } },
              });
              await tx.loyaltyPointTransaction.create({
                data: {
                  tenantId: booking.tenantId,
                  guestId: guest.id,
                  points: pointsToAward,
                  balance: updatedGuest.loyaltyPoints,
                  type: 'earn',
                  source: 'stay_completion',
                  referenceId: booking.id,
                  referenceType: 'booking',
                  description: `Points earned from stay ${booking.confirmationCode}`,
                }
              });
              if (process.env.NODE_ENV !== 'production') {
                console.log(`[Loyalty] Awarded ${pointsToAward} points to guest ${guest.id} for booking ${booking.confirmationCode}`);
              }
            }
          }
        });
      } catch (checkoutTxError) {
        console.error('Checkout transaction failed (PATCH), rolling back all side-effects:', checkoutTxError);
        throw checkoutTxError;
      }

      // Non-transactional side-effects (notifications, events — safe to retry independently)

      const room = await db.room.findUnique({
        where: { id: effectivePatchRoomId },
        include: { property: { select: { tenantId: true } } }
      });
      if (room) {
        emitRoomStatusChange({
          roomId: effectivePatchRoomId,
          propertyId: room.propertyId,
          tenantId: room.property.tenantId,
          status: 'dirty',
          previousStatus: 'occupied',
        });
      }

      // Auto-trigger housekeeping: mark room dirty + create checkout cleaning task
      try {
        await markRoomDirtyAfterCheckout(effectivePatchRoomId, booking.tenantId, booking.id);
      } catch (hkError) {
        console.error('Failed to auto-trigger housekeeping on checkout (PATCH):', hkError);
      }

      // Emit booking checked-out event (triggers WiFi deprovisioning)
      try {
        // Get folio information for total/paid amounts
        const checkoutFolio = await db.folio.findFirst({
          where: { bookingId: booking.id },
          select: { totalAmount: true, paidAmount: true },
        });

        await emitBookingCheckedOut({
          bookingId: booking.id,
          tenantId: booking.tenantId,
          propertyId: booking.propertyId,
          confirmationCode: booking.confirmationCode,
          guestId: booking.primaryGuestId,
          guestName: `${booking.primaryGuest.firstName} ${booking.primaryGuest.lastName}`,
          guestEmail: booking.primaryGuest.email ?? undefined,
          guestPhone: booking.primaryGuest.phone ?? undefined,
          roomTypeId: booking.roomTypeId,
          roomTypeName: existingBooking.roomType.name,
          roomId: effectivePatchRoomId,
          roomNumber: booking.room?.number,
          checkIn: booking.checkIn,
          checkOut: booking.checkOut,
          actualCheckOut: actualCheckOut ? new Date(actualCheckOut) : new Date(),
          totalAmount: checkoutFolio?.totalAmount || booking.totalAmount,
          paidAmount: checkoutFolio?.paidAmount || 0,
          performedBy: checkedOutBy,
        });

        patchWifiDeprovisioned = true;
      } catch (wifiError) {
        console.error('Failed to deprovision WiFi on check-out (PATCH):', wifiError);
        // Don't fail the check-out if WiFi deprovisioning fails
      }
    }

    // Emit WebSocket event for booking cancelled
    if (status === 'cancelled' && existingBooking.status !== 'cancelled') {
      try {
        emitBookingCancelledWS({
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

        // FIX 3: Emit booking cancelled event (triggers WiFi deprovisioning) — matching PUT handler
        await emitBookingCancelledEvent({
          bookingId: booking.id,
          tenantId: booking.tenantId,
          propertyId: booking.propertyId,
          confirmationCode: booking.confirmationCode,
          guestId: booking.primaryGuestId,
          guestName: `${booking.primaryGuest.firstName} ${booking.primaryGuest.lastName}`,
          guestEmail: booking.primaryGuest.email ?? undefined,
          guestPhone: booking.primaryGuest.phone ?? undefined,
          roomTypeId: booking.roomTypeId,
          roomTypeName: existingBooking.roomType.name,
          roomId: booking.roomId || undefined,
          roomNumber: booking.room?.number,
          checkIn: booking.checkIn,
          checkOut: booking.checkOut,
          cancellationReason,
          cancelledAt: cancelledAt ? new Date(cancelledAt) : new Date(),
          performedBy: cancelledBy,
        });
      } catch (wsError) {
        console.error('Failed to emit booking cancelled event:', wsError);
      }

      // Auto-process waitlist on booking cancellation (PATCH)
      try {
        await processWaitlistOnCancellation(booking.id, booking.tenantId, booking.propertyId, booking.roomTypeId, booking.checkIn, booking.checkOut);
      } catch (wlError) {
        console.error('Failed to process waitlist on cancellation:', wlError);
      }
    }

    // Cancellation policy integration (PATCH) — evaluate and apply penalty
    let patchCancellationResult: CancellationResult | null = null;
    if (status === 'cancelled' && existingBooking.status !== 'cancelled') {
      try {
        patchCancellationResult = await evaluateCancellationPolicy({
          bookingId: booking.id,
          tenantId: booking.tenantId,
        });

        if (patchCancellationResult.penaltyAmount > 0) {
          let penaltyFolio = await db.folio.findFirst({
            where: { bookingId: booking.id, tenantId: booking.tenantId },
          });

          if (!penaltyFolio) {
            const folioCount = await db.folio.count({ where: { tenantId: booking.tenantId } });
            penaltyFolio = await db.folio.create({
              data: {
                tenantId: booking.tenantId,
                propertyId: booking.propertyId,
                bookingId: booking.id,
                folioNumber: `FOL-${(folioCount + 1).toString().padStart(5, '0')}`,
                guestId: booking.primaryGuestId,
                subtotal: 0,
                taxes: 0,
                discount: 0,
                totalAmount: 0,
                paidAmount: 0,
                balance: 0,
                currency: booking.currency,
              },
            });
          }

          await db.folioLineItem.create({
            data: {
              folioId: penaltyFolio.id,
              description: `Cancellation penalty - ${patchCancellationResult.policy.name}`,
              category: 'penalty',
              quantity: 1,
              unitPrice: patchCancellationResult.penaltyAmount,
              totalAmount: patchCancellationResult.penaltyAmount,
              serviceDate: new Date(),
              referenceType: 'cancellation_policy',
              referenceId: patchCancellationResult.policy.id !== 'none' ? patchCancellationResult.policy.id : null,
              postedBy: user.id,
            },
          });

          const penaltyLineItems = await db.folioLineItem.findMany({
            where: { folioId: penaltyFolio.id },
          });
          const penaltySubtotal = penaltyLineItems.reduce((sum, li) => sum + li.totalAmount, 0);
          const penaltyBalance = penaltySubtotal - penaltyFolio.paidAmount;
          await db.folio.update({
            where: { id: penaltyFolio.id },
            data: {
              subtotal: penaltySubtotal,
              totalAmount: penaltySubtotal + penaltyFolio.taxes - penaltyFolio.discount,
              balance: Math.max(0, penaltyBalance),
            },
          });
        }
      } catch (penaltyError) {
        console.error('Failed to apply cancellation penalty (PATCH):', penaltyError);
        // Don't fail the cancellation if penalty application fails
      }
    }

    return NextResponse.json({
      success: true,
      data: booking,
      patchedFields: providedFields,
      // Include cancellation policy result if applicable
      ...(patchCancellationResult && {
        cancellation: {
          isWithinFreeWindow: patchCancellationResult.isWithinFreeWindow,
          penaltyAmount: patchCancellationResult.penaltyAmount,
          penaltyType: patchCancellationResult.penaltyType,
          policyName: patchCancellationResult.policy.name,
          hoursUntilCheckIn: patchCancellationResult.hoursUntilCheckIn,
          isExempt: patchCancellationResult.isExempt,
          exemptReason: patchCancellationResult.exemptReason,
        },
      }),
      // FIX 3: Include WiFi info in response — matching PUT handler
      ...(patchWifiCredentials && { wifi: { credentials: patchWifiCredentials } }),
      ...(patchWifiDeprovisioned && { wifi: { deprovisioned: true } }),
    });
  } catch (error) {
    console.error('Error patching booking:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to patch booking' } },
      { status: 500 }
    );
  }
}

// DELETE /api/bookings/[id] - Delete a booking (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }


  try {
    const { id } = await params;
    
    const existingBooking = await db.booking.findUnique({
      where: { id, deletedAt: null },
      include: {
        primaryGuest: true,
        room: true,
      },
    });
    
    if (!existingBooking) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Booking not found' } },
        { status: 404 }
      );
    }

    if (existingBooking.tenantId !== user.tenantId) {
      return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Not found' } }, { status: 404 });
    }
    
    // FIX 4: Allow deleting bookings in 'draft' or 'confirmed' status (not in-progress)
    if (!['draft', 'confirmed'].includes(existingBooking.status)) {
      return NextResponse.json(
        { success: false, error: { code: 'CANNOT_DELETE', message: 'Only draft or confirmed bookings can be deleted' } },
        { status: 400 }
      );
    }
    
    // Soft delete the booking
    await db.booking.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    
    // Log the deletion
    try {
      await logBooking(request, 'delete', id, {
        confirmationCode: existingBooking.confirmationCode,
        status: existingBooking.status,
        guestName: `${existingBooking.primaryGuest.firstName} ${existingBooking.primaryGuest.lastName}`,
      }, { tenantId: user.tenantId, userId: user.id });
    } catch (auditError) {
      console.error('Failed to log booking deletion to audit log:', auditError);
    }
    
    return NextResponse.json({
      success: true,
      message: 'Booking deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting booking:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete booking' } },
      { status: 500 }
    );
  }
}
