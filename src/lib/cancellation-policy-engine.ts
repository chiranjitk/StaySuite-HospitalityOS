import { db } from './db';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CancellationResult {
  policy: {
    id: string;
    name: string;
    description: string | null;
    freeCancelHoursBefore: number;
    penaltyPercent: number;
    noShowPenaltyPercent: number;
    penaltyType: string;
    penaltyFixedAmount: number | null;
    penaltyNights: number | null;
  };
  isWithinFreeWindow: boolean;
  penaltyAmount: number;
  penaltyType: string;
  hoursUntilCheckIn: number;
  isExempt: boolean;
  exemptReason?: string;
}

export interface ApplyPenaltyResult {
  success: boolean;
  penaltyApplied: number;
  folioId: string;
  lineItemId: string;
  policyName: string;
  isExempt: boolean;
  exemptReason?: string;
}

// ─── Policy Resolution ───────────────────────────────────────────────────────

/**
 * Find the applicable cancellation policy for a booking.
 * Priority order:
 *   1. Policy linked to the booking's ratePlanId
 *   2. Policy linked to the booking's propertyId (no ratePlanId)
 *   3. Tenant-level default policy (no propertyId, no ratePlanId)
 */
async function findApplicablePolicy(params: {
  tenantId: string;
  propertyId: string;
  ratePlanId?: string | null;
}): Promise<{
  id: string;
  name: string;
  description: string | null;
  freeCancelHoursBefore: number;
  penaltyPercent: number;
  noShowPenaltyPercent: number;
  penaltyType: string;
  penaltyFixedAmount: number | null;
  penaltyNights: number | null;
  exceptions: string;
  isActive: boolean;
} | null> {
  const { tenantId, propertyId, ratePlanId } = params;

  // 1. Rate-plan specific policy (highest priority)
  if (ratePlanId) {
    const ratePlanPolicy = await db.cancellationPolicy.findFirst({
      where: {
        tenantId,
        ratePlanId,
        isActive: true,
      },
      orderBy: { sortOrder: 'asc' },
    });
    if (ratePlanPolicy) return ratePlanPolicy;
  }

  // 2. Property-level policy
  const propertyPolicy = await db.cancellationPolicy.findFirst({
    where: {
      tenantId,
      propertyId,
      ratePlanId: null,
      isActive: true,
    },
    orderBy: { sortOrder: 'asc' },
  });
  if (propertyPolicy) return propertyPolicy;

  // 3. Tenant-level default policy (no property, no rate plan)
  const tenantPolicy = await db.cancellationPolicy.findFirst({
    where: {
      tenantId,
      propertyId: null,
      ratePlanId: null,
      isActive: true,
    },
    orderBy: { sortOrder: 'asc' },
  });

  return tenantPolicy;
}

// ─── Exemption Check ─────────────────────────────────────────────────────────

/**
 * Check if the guest qualifies for a penalty exemption based on policy exceptions.
 * Exceptions are stored as JSON: [{type: "loyalty_tier", value: "gold"}, {type: "segment", value: "corporate"}]
 */
function checkExemption(
  exceptionsJson: string,
  guestLoyaltyTier: string,
  guestSegmentIds: string[],
  segmentNameMap: Map<string, string>
): { isExempt: boolean; reason?: string } {
  let exceptions: Array<{ type: string; value: string }>;
  try {
    exceptions = JSON.parse(exceptionsJson);
  } catch {
    return { isExempt: false };
  }

  if (!Array.isArray(exceptions) || exceptions.length === 0) {
    return { isExempt: false };
  }

  for (const exc of exceptions) {
    if (exc.type === 'loyalty_tier') {
      // Normalize for comparison (both lowercase)
      if (guestLoyaltyTier.toLowerCase() === exc.value.toLowerCase()) {
        return { isExempt: true, reason: `Guest loyalty tier (${guestLoyaltyTier}) matches exemption rule` };
      }
    }

    if (exc.type === 'segment') {
      // Check if the guest belongs to a segment matching the exception value
      for (const segId of guestSegmentIds) {
        const segName = segmentNameMap.get(segId);
        if (segName && segName.toLowerCase() === exc.value.toLowerCase()) {
          return { isExempt: true, reason: `Guest segment (${segName}) matches exemption rule` };
        }
      }
    }
  }

  return { isExempt: false };
}

// ─── Evaluate Cancellation Policy ────────────────────────────────────────────

export async function evaluateCancellationPolicy(params: {
  bookingId: string;
  tenantId: string;
}): Promise<CancellationResult> {
  const { bookingId, tenantId } = params;

  // 1. Find the booking with guest and folio info
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: {
      primaryGuest: {
        select: {
          id: true,
          loyaltyTier: true,
        },
      },
    },
  });

  if (!booking) {
    throw new Error('BOOKING_NOT_FOUND');
  }

  if (booking.tenantId !== tenantId) {
    throw new Error('TENANT_MISMATCH');
  }

  // 2. Find applicable policy
  const policy = await findApplicablePolicy({
    tenantId,
    propertyId: booking.propertyId,
    ratePlanId: booking.ratePlanId,
  });

  // No policy found — no penalty
  if (!policy) {
    const hoursUntilCheckIn = Math.max(
      0,
      (booking.checkIn.getTime() - Date.now()) / (1000 * 60 * 60)
    );

    return {
      policy: {
        id: 'none',
        name: 'No Policy',
        description: null,
        freeCancelHoursBefore: 0,
        penaltyPercent: 0,
        noShowPenaltyPercent: 0,
        penaltyType: 'none',
        penaltyFixedAmount: null,
        penaltyNights: null,
      },
      isWithinFreeWindow: true,
      penaltyAmount: 0,
      penaltyType: 'none',
      hoursUntilCheckIn: Math.round(hoursUntilCheckIn * 100) / 100,
      isExempt: false,
    };
  }

  // 3. Calculate hours until check-in
  const hoursUntilCheckIn = Math.max(
    0,
    (booking.checkIn.getTime() - Date.now()) / (1000 * 60 * 60)
  );

  // 4. Check free cancellation window
  const isWithinFreeWindow = hoursUntilCheckIn >= policy.freeCancelHoursBefore;

  // 5. Check guest exemptions
  const guestSegmentMemberships = await db.segmentMembership.findMany({
    where: { guestId: booking.primaryGuestId },
    include: { segment: { select: { id: true, name: true } } },
  });

  const segmentNameMap = new Map<string, string>();
  for (const mem of guestSegmentMemberships) {
    segmentNameMap.set(mem.segment.id, mem.segment.name);
  }

  const { isExempt, reason } = checkExemption(
    policy.exceptions,
    booking.primaryGuest.loyaltyTier,
    guestSegmentMemberships.map((m) => m.segment.id),
    segmentNameMap
  );

  // 6. Calculate penalty amount
  let penaltyAmount = 0;

  if (!isWithinFreeWindow && !isExempt) {
    switch (policy.penaltyType) {
      case 'percentage': {
        // penaltyPercent of the booking totalAmount
        penaltyAmount = (policy.penaltyPercent * booking.totalAmount) / 100;
        break;
      }
      case 'fixed_nights': {
        // roomRate * penaltyNights
        const nights = policy.penaltyNights || 1;
        penaltyAmount = booking.roomRate * nights;
        break;
      }
      case 'first_night': {
        // roomRate * min(penaltyNights, 1) — defaults to 1 night
        const nights = Math.min(policy.penaltyNights || 1, 1);
        penaltyAmount = booking.roomRate * nights;
        break;
      }
      case 'fixed': {
        // Fixed penalty amount
        penaltyAmount = policy.penaltyFixedAmount || 0;
        break;
      }
      default:
        break;
    }
  }

  return {
    policy: {
      id: policy.id,
      name: policy.name,
      description: policy.description,
      freeCancelHoursBefore: policy.freeCancelHoursBefore,
      penaltyPercent: policy.penaltyPercent,
      noShowPenaltyPercent: policy.noShowPenaltyPercent,
      penaltyType: policy.penaltyType,
      penaltyFixedAmount: policy.penaltyFixedAmount,
      penaltyNights: policy.penaltyNights,
    },
    isWithinFreeWindow,
    penaltyAmount: Math.round(penaltyAmount * 100) / 100,
    penaltyType: policy.penaltyType,
    hoursUntilCheckIn: Math.round(hoursUntilCheckIn * 100) / 100,
    isExempt,
    exemptReason: reason,
  };
}

// ─── Apply Cancellation Penalty ──────────────────────────────────────────────

export async function applyCancellationPenalty(params: {
  bookingId: string;
  tenantId: string;
  performedBy: string;
  reason?: string;
}): Promise<ApplyPenaltyResult> {
  const { bookingId, tenantId, performedBy, reason } = params;

  // 1. Evaluate the policy
  const evaluation = await evaluateCancellationPolicy({ bookingId, tenantId });

  // 2. Find or create a folio for this booking
  let folio = await db.folio.findFirst({
    where: { bookingId, tenantId },
  });

  if (!folio) {
    const booking = await db.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new Error('BOOKING_NOT_FOUND');

    const folioCount = await db.folio.count({ where: { tenantId } });
    folio = await db.folio.create({
      data: {
        tenantId,
        propertyId: booking.propertyId,
        bookingId,
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

  // 3. If penalty > 0, add line item to folio
  let lineItemId = '';
  if (evaluation.penaltyAmount > 0) {
    const lineItem = await db.folioLineItem.create({
      data: {
        folioId: folio.id,
        description: `Cancellation penalty - ${evaluation.policy.name}`,
        category: 'penalty',
        quantity: 1,
        unitPrice: evaluation.penaltyAmount,
        totalAmount: evaluation.penaltyAmount,
        serviceDate: new Date(),
        referenceType: 'cancellation_policy',
        referenceId: evaluation.policy.id !== 'none' ? evaluation.policy.id : null,
        postedBy: performedBy,
      },
    });
    lineItemId = lineItem.id;

    // 4. Update folio totals
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

  // 5. Update booking status to 'cancelled'
  await db.booking.update({
    where: { id: bookingId },
    data: {
      status: 'cancelled',
      cancelledAt: new Date(),
      cancelledBy: performedBy,
      cancellationReason: reason || `Cancelled with penalty policy: ${evaluation.policy.name}`,
    },
  });

  // 6. Release room if assigned
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: { roomId: true },
  });

  if (booking?.roomId) {
    await db.room.update({
      where: { id: booking.roomId },
      data: { status: 'available' },
    });
  }

  return {
    success: true,
    penaltyApplied: evaluation.penaltyAmount,
    folioId: folio.id,
    lineItemId,
    policyName: evaluation.policy.name,
    isExempt: evaluation.isExempt,
    exemptReason: evaluation.exemptReason,
  };
}
