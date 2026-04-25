/**
 * No-Show Detection Engine
 *
 * Automatically detects confirmed bookings that have passed their check-in deadline
 * without the guest arriving. Processes no-shows by:
 * - Marking booking status as 'no_show'
 * - Applying no-show penalty from cancellation policy
 * - Adding penalty line item to folio
 * - Releasing the room back to available
 * - Creating audit log entries
 */

import { db } from './db';
import { auditLogService } from './services/audit-service';

// =====================================================
// TYPES & INTERFACES
// =====================================================

export interface NoShowResult {
  bookingId: string;
  confirmationCode: string;
  guestName: string;
  roomNumber: string;
  penaltyAmount: number;
  roomId: string;
  propertyId: string;
}

export interface NoShowSkipped {
  bookingId: string;
  reason: string;
}

export interface NoShowBatchResult {
  total: number;
  markedNoShow: NoShowResult[];
  skipped: NoShowSkipped[];
  penaltiesApplied: number;
  roomsReleased: number;
}

interface PropertyWithTimezone {
  id: string;
  tenantId: string;
  checkInTime: string;
  timezone: string;
}

interface BookingWithRelations {
  id: string;
  tenantId: string;
  propertyId: string;
  confirmationCode: string;
  primaryGuestId: string;
  roomId: string | null;
  ratePlanId: string | null;
  checkIn: Date;
  totalAmount: number;
  currency: string;
  status: string;
  actualCheckIn: Date | null;
  primaryGuest: {
    firstName: string;
    lastName: string;
  };
  room?: {
    id: string;
    number: string;
    status: string;
  } | null;
  ratePlan?: {
    id: string;
    cancellationPolicy: string | null;
  } | null;
}

// =====================================================
// NO-SHOW SETTINGS
// =====================================================

export interface NoShowSettings {
  noShowBufferHours: number;
  autoProcessNoShows: boolean;
  noShowNotificationEnabled: boolean;
}

const DEFAULT_NO_SHOW_SETTINGS: NoShowSettings = {
  noShowBufferHours: 1,
  autoProcessNoShows: false,
  noShowNotificationEnabled: true,
};

/**
 * Get no-show settings for a property.
 * Settings are stored in the Property model's noShowSettings JSON field.
 */
export async function getNoShowSettings(
  propertyId: string,
  tenantId: string
): Promise<NoShowSettings> {
  const property = await db.property.findFirst({
    where: { id: propertyId, tenantId },
    select: { noShowSettings: true },
  });

  if (!property) {
    return { ...DEFAULT_NO_SHOW_SETTINGS };
  }

  try {
    const parsed = JSON.parse(property.noShowSettings);
    return {
      noShowBufferHours: typeof parsed.noShowBufferHours === 'number' ? parsed.noShowBufferHours : DEFAULT_NO_SHOW_SETTINGS.noShowBufferHours,
      autoProcessNoShows: typeof parsed.autoProcessNoShows === 'boolean' ? parsed.autoProcessNoShows : DEFAULT_NO_SHOW_SETTINGS.autoProcessNoShows,
      noShowNotificationEnabled: typeof parsed.noShowNotificationEnabled === 'boolean' ? parsed.noShowNotificationEnabled : DEFAULT_NO_SHOW_SETTINGS.noShowNotificationEnabled,
    };
  } catch {
    return { ...DEFAULT_NO_SHOW_SETTINGS };
  }
}

// =====================================================
// TIMEZONE UTILITIES
// =====================================================

/**
 * Get the current date in a property's timezone as a YYYY-MM-DD string.
 */
function getPropertyLocalDate(timezone: string): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now);
}

/**
 * Get the current time in a property's timezone as HH:MM.
 */
function getPropertyLocalTime(timezone: string): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return formatter.format(now);
}

/**
 * Parse a "HH:MM" time string into hours and minutes.
 */
function parseTime(timeStr: string): { hours: number; minutes: number } {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return { hours: hours ?? 0, minutes: minutes ?? 0 };
}

/**
 * Check if the current time in the property's timezone has passed
 * the check-in time + buffer hours.
 */
function hasCheckInDeadlinePassed(
  propertyCheckInTime: string,
  bufferHours: number,
  timezone: string
): boolean {
  const currentTime = getPropertyLocalTime(timezone);
  const current = parseTime(currentTime);
  const checkIn = parseTime(propertyCheckInTime);

  // Convert both to total minutes for comparison
  const currentMinutes = current.hours * 60 + current.minutes;
  const deadlineMinutes = (checkIn.hours + bufferHours) * 60 + checkIn.minutes;

  return currentMinutes >= deadlineMinutes;
}

/**
 * Get today's date range for a property's timezone, returned as UTC Date objects.
 */
function getPropertyTodayRange(timezone: string): { start: Date; end: Date } {
  const localDateStr = getPropertyLocalDate(timezone);

  // Start of day in property timezone -> convert to UTC
  const startLocal = new Date(`${localDateStr}T00:00:00`);
  // End of day in property timezone -> convert to UTC
  const endLocal = new Date(`${localDateStr}T23:59:59`);

  return { start: startLocal, end: endLocal };
}

// =====================================================
// CANCELLATION POLICY LOOKUP
// =====================================================

/**
 * Find the applicable cancellation policy for a booking's no-show penalty.
 * Priority: rate-plan specific -> property-specific -> tenant default
 */
async function findNoShowPenaltyPercent(
  tenantId: string,
  propertyId: string,
  ratePlanId: string | null
): Promise<number> {
  // 1. Try rate-plan specific policy
  if (ratePlanId) {
    const ratePlanPolicy = await db.cancellationPolicy.findFirst({
      where: {
        tenantId,
        ratePlanId,
        isActive: true,
      },
      orderBy: { sortOrder: 'asc' },
    });

    if (ratePlanPolicy) {
      return ratePlanPolicy.noShowPenaltyPercent;
    }
  }

  // 2. Try property-specific policy
  const propertyPolicy = await db.cancellationPolicy.findFirst({
    where: {
      tenantId,
      propertyId,
      ratePlanId: null,
      isActive: true,
    },
    orderBy: { sortOrder: 'asc' },
  });

  if (propertyPolicy) {
    return propertyPolicy.noShowPenaltyPercent;
  }

  // 3. Try tenant-level default policy (no property/rate plan filter)
  const tenantPolicy = await db.cancellationPolicy.findFirst({
    where: {
      tenantId,
      propertyId: null,
      ratePlanId: null,
      isActive: true,
    },
    orderBy: { sortOrder: 'asc' },
  });

  if (tenantPolicy) {
    return tenantPolicy.noShowPenaltyPercent;
  }

  // 4. Default: 100% penalty
  return 100;
}

// =====================================================
// CORE NO-SHOW PROCESSING
// =====================================================

/**
 * Process a single no-show booking.
 * - Marks booking as no_show
 * - Applies cancellation policy penalty to folio
 * - Releases room if assigned
 * - Creates audit log entries
 */
export async function processSingleNoShow(
  booking: BookingWithRelations,
  property: PropertyWithTimezone
): Promise<NoShowResult> {
  let penaltyAmount = 0;
  let roomsReleased = 0;

  // 1. Determine no-show penalty
  const penaltyPercent = await findNoShowPenaltyPercent(
    booking.tenantId,
    property.id,
    booking.ratePlanId
  );

  penaltyAmount = (booking.totalAmount * penaltyPercent) / 100;

  // 2. Process within a transaction
  await db.$transaction(async (tx) => {
    // Update booking status to no_show
    await tx.booking.update({
      where: { id: booking.id },
      data: { status: 'no_show' },
    });

    // Create booking audit log
    await tx.bookingAuditLog.create({
      data: {
        bookingId: booking.id,
        action: 'status_change',
        oldStatus: 'confirmed',
        newStatus: 'no_show',
        notes: `Auto-detected no-show. Check-in deadline passed. Penalty: ${penaltyPercent}% ($${penaltyAmount.toFixed(2)})`,
        performedBy: 'system',
      },
    });

    // 3. Apply penalty to folio if penalty > 0
    if (penaltyAmount > 0) {
      // Find the booking's folio
      const folio = await tx.folio.findFirst({
        where: {
          bookingId: booking.id,
          status: { in: ['open', 'partially_paid'] },
        },
      });

      if (folio) {
        // Add penalty line item
        await tx.folioLineItem.create({
          data: {
            folioId: folio.id,
            description: 'No-show penalty',
            category: 'penalty',
            quantity: 1,
            unitPrice: penaltyAmount,
            totalAmount: penaltyAmount,
            serviceDate: new Date(),
            referenceType: 'booking',
            referenceId: booking.id,
            taxRate: 0,
            taxAmount: 0,
            postedBy: 'system',
          },
        });

        // Recalculate folio totals
        const lineItems = await tx.folioLineItem.findMany({
          where: { folioId: folio.id },
        });

        const subtotal = lineItems.reduce((sum, item) => sum + item.totalAmount, 0);
        const taxAmount = lineItems.reduce((sum, item) => sum + item.taxAmount, 0);
        const newTotal = subtotal + taxAmount;
        const newBalance = newTotal - folio.paidAmount;

        await tx.folio.update({
          where: { id: folio.id },
          data: {
            subtotal,
            taxes: taxAmount,
            totalAmount: newTotal,
            balance: newBalance,
            // Move to partially_paid if there are payments, keep open otherwise
            status: folio.paidAmount > 0 ? 'partially_paid' : 'open',
          },
        });
      }
    }

    // 4. Release room if one was assigned
    if (booking.roomId && booking.room) {
      await tx.room.update({
        where: { id: booking.roomId },
        data: {
          status: 'available',
          housekeepingStatus: 'clean',
        },
      });
      roomsReleased = 1;
    }
  });

  // 5. Create system audit log (outside transaction — non-critical)
  try {
    await auditLogService.log({
      tenantId: booking.tenantId,
      module: 'automation',
      action: 'no_show',
      entityType: 'booking',
      entityId: booking.id,
      newValue: {
        confirmationCode: booking.confirmationCode,
        guestName: `${booking.primaryGuest.firstName} ${booking.primaryGuest.lastName}`,
        roomNumber: booking.room?.number || 'unassigned',
        penaltyPercent,
        penaltyAmount,
        propertyId: property.id,
      },
    });
  } catch (error) {
    console.error('[NoShow] Failed to create audit log:', error);
  }

  console.log(
    `[NoShow] Processed booking ${booking.confirmationCode}: penalty=$${penaltyAmount.toFixed(2)}, room released=${roomsReleased > 0}`
  );

  return {
    bookingId: booking.id,
    confirmationCode: booking.confirmationCode,
    guestName: `${booking.primaryGuest.firstName} ${booking.primaryGuest.lastName}`,
    roomNumber: booking.room?.number || 'unassigned',
    penaltyAmount,
    roomId: booking.roomId || '',
    propertyId: property.id,
  };
}

/**
 * Detect and process no-shows across all tenants and properties.
 * Optionally filter by a specific tenantId.
 *
 * For each property:
 * 1. Get the property's check-in time and timezone
 * 2. Check if today's deadline has passed (checkInTime + buffer)
 * 3. Find confirmed bookings for today with no actualCheckIn
 * 4. Process each as a no-show
 */
export async function detectAndProcessNoShows(
  tenantId?: string
): Promise<NoShowBatchResult> {
  const result: NoShowBatchResult = {
    total: 0,
    markedNoShow: [],
    skipped: [],
    penaltiesApplied: 0,
    roomsReleased: 0,
  };

  try {
    // 1. Get all tenants (optionally filtered)
    const tenants = await db.tenant.findMany({
      where: tenantId ? { id: tenantId } : undefined,
      select: { id: true, name: true },
    });

    for (const tenant of tenants) {
      // 2. Get all active properties for this tenant
      const properties = await db.property.findMany({
        where: {
          tenantId: tenant.id,
          status: 'active',
          deletedAt: null,
        },
        select: {
          id: true,
          tenantId: true,
          checkInTime: true,
          timezone: true,
        },
      });

      for (const property of properties) {
        try {
          const propertyResult = await processPropertyNoShows(property);
          result.total += propertyResult.total;
          result.markedNoShow.push(...propertyResult.markedNoShow);
          result.skipped.push(...propertyResult.skipped);
          result.penaltiesApplied += propertyResult.penaltiesApplied;
          result.roomsReleased += propertyResult.roomsReleased;
        } catch (error) {
          console.error(
            `[NoShow] Error processing property ${property.id}:`,
            error
          );
          result.skipped.push({
            bookingId: '',
            reason: `Property ${property.id} processing error: ${error instanceof Error ? error.message : 'Unknown'}`,
          });
        }
      }
    }

    // Update last execution status
    lastExecutionStatus = {
      timestamp: new Date().toISOString(),
      ...result,
    };

    console.log(
      `[NoShow] Batch complete: ${result.markedNoShow.length} no-shows, ${result.penaltiesApplied} penalties, ${result.roomsReleased} rooms released`
    );
  } catch (error) {
    console.error('[NoShow] Batch detection failed:', error);
    throw error;
  }

  return result;
}

/**
 * Process no-shows for a single property.
 */
async function processPropertyNoShows(
  property: PropertyWithTimezone
): Promise<NoShowBatchResult> {
  const result: NoShowBatchResult = {
    total: 0,
    markedNoShow: [],
    skipped: [],
    penaltiesApplied: 0,
    roomsReleased: 0,
  };

  // Get no-show settings for this property
  const settings = await getNoShowSettings(property.id, property.tenantId);

  // If auto-process is disabled, skip this property
  if (!settings.autoProcessNoShows) {
    return result;
  }

  // Check if the check-in deadline has passed
  if (!hasCheckInDeadlinePassed(property.checkInTime, settings.noShowBufferHours, property.timezone)) {
    return result;
  }

  // Get today's date range in property timezone
  const { start, end } = getPropertyTodayRange(property.timezone);

  // Find all confirmed bookings for today that haven't checked in
  const bookings = await db.booking.findMany({
    where: {
      tenantId: property.tenantId,
      propertyId: property.id,
      status: 'confirmed',
      checkIn: {
        gte: start,
        lte: end,
      },
      actualCheckIn: null,
    },
    include: {
      primaryGuest: {
        select: { firstName: true, lastName: true },
      },
      room: {
        select: { id: true, number: true, status: true },
      },
      ratePlan: {
        select: { id: true, cancellationPolicy: true },
      },
    },
  });

  result.total = bookings.length;

  if (bookings.length === 0) {
    return result;
  }

  // Process each booking
  for (const booking of bookings) {
    try {
      const noShowResult = await processSingleNoShow(booking, property);
      result.markedNoShow.push(noShowResult);

      if (noShowResult.penaltyAmount > 0) {
        result.penaltiesApplied++;
      }
      if (noShowResult.roomId && noShowResult.roomNumber !== 'unassigned') {
        result.roomsReleased++;
      }
    } catch (error) {
      console.error(
        `[NoShow] Failed to process booking ${booking.confirmationCode}:`,
        error
      );
      result.skipped.push({
        bookingId: booking.id,
        reason: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return result;
}

// =====================================================
// EXECUTION STATUS (in-memory for GET endpoint)
// =====================================================

export interface LastExecutionStatus {
  timestamp: string;
  total: number;
  markedNoShow: NoShowResult[];
  skipped: NoShowSkipped[];
  penaltiesApplied: number;
  roomsReleased: number;
}

let lastExecutionStatus: LastExecutionStatus | null = null;

export function getLastExecutionStatus(): LastExecutionStatus | null {
  return lastExecutionStatus;
}

export function getNextScheduledRun(): string {
  // The no-show detection should run every hour.
  // Return the next hour boundary as the estimated next run.
  const now = new Date();
  const nextHour = new Date(now);
  nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
  return nextHour.toISOString();
}
