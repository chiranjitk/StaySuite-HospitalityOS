import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

// GET /api/rate-plans/bulk-rates - Get rates for a date range + room type
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'pricing.manage');
  if (user instanceof NextResponse) return user;
  const tenantId = user.tenantId;

  try {
    const searchParams = request.nextUrl.searchParams;
    const roomTypeId = searchParams.get('roomTypeId');
    const propertyId = searchParams.get('propertyId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!roomTypeId || !startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'roomTypeId, startDate, and endDate are required' } },
        { status: 400 }
      );
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid date range' } },
        { status: 400 }
      );
    }

    // Verify room type exists and belongs to tenant
    const roomType = await db.roomType.findFirst({
      where: { id: roomTypeId, deletedAt: null, property: { tenantId } },
      select: {
        id: true,
        name: true,
        code: true,
        basePrice: true,
        currency: true,
        propertyId: true,
        totalRooms: true,
        property: { select: { id: true, name: true, currency: true, checkInTime: true, checkOutTime: true } },
      },
    });

    if (!roomType) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Room type not found' } },
        { status: 404 }
      );
    }

    if (propertyId && roomType.propertyId !== propertyId) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Room type does not belong to this property' } },
        { status: 403 }
      );
    }

    // Get all rate plans for this room type (tenant-scoped)
    const ratePlans = await db.ratePlan.findMany({
      where: { roomTypeId, tenantId, deletedAt: null, status: 'active' },
      select: { id: true, name: true, code: true, basePrice: true, currency: true },
      orderBy: { name: 'asc' },
    });

    // Get price overrides for the date range
    const overrides = await db.priceOverride.findMany({
      where: {
        ratePlanId: { in: ratePlans.map(rp => rp.id) },
        date: { gte: start, lte: end },
      },
      select: {
        ratePlanId: true,
        date: true,
        price: true,
        closedToArrival: true,
        closedToDeparture: true,
        minStay: true,
      },
    });

    // Get inventory locks for the date range (tenant-scoped)
    const inventoryLocks = await db.inventoryLock.findMany({
      where: {
        roomTypeId,
        tenantId,
        startDate: { lte: end },
        endDate: { gte: start },
      },
      select: { startDate: true, endDate: true, lockType: true, reason: true },
    });

    // Build date-by-date data
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const rates: Array<{
      date: string;
      dayName: string;
      ratePlanId: string;
      ratePlanName: string;
      baseRate: number;
      overrideRate: number | null;
      closedToArrival: boolean;
      closedToDeparture: boolean;
      minStay: number | null;
      available: boolean;
      locked: boolean;
      lockReason: string | null;
    }> = [];

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const dayName = dayNames[d.getDay()];

      // Check for inventory locks on this date
      const activeLock = inventoryLocks.find(
        lock => new Date(lock.startDate) <= d && new Date(lock.endDate) >= d
      );

      for (const plan of ratePlans) {
        const override = overrides.find(
          o => o.ratePlanId === plan.id && o.date.toISOString().split('T')[0] === dateStr
        );

        const isLocked = !!activeLock;
        const isRestricted = override?.closedToArrival || override?.closedToDeparture;

        let availabilityStatus: 'available' | 'restricted' | 'soldout' = 'available';
        if (isLocked && activeLock?.lockType === 'soldout') {
          availabilityStatus = 'soldout';
        } else if (isLocked || isRestricted) {
          availabilityStatus = 'restricted';
        }

        rates.push({
          date: dateStr,
          dayName,
          ratePlanId: plan.id,
          ratePlanName: plan.name,
          baseRate: plan.basePrice,
          overrideRate: override?.price ?? null,
          closedToArrival: override?.closedToArrival ?? false,
          closedToDeparture: override?.closedToDeparture ?? false,
          minStay: override?.minStay ?? null,
          available: availabilityStatus === 'available',
          locked: isLocked,
          lockReason: activeLock?.reason ?? null,
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        roomType,
        ratePlans,
        rates,
        dateRange: { startDate, endDate },
      },
    });
  } catch (error) {
    console.error('Error fetching bulk rates:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch rates' } },
      { status: 500 }
    );
  }
}

// POST /api/rate-plans/bulk-rates - Set rates for a date range
export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'pricing.manage');
  if (user instanceof NextResponse) return user;
  const tenantId = user.tenantId;

  try {
    const body = await request.json();
    const { roomTypeId, ratePlanId, startDate, endDate, rates, reason } = body;

    if (!roomTypeId || !ratePlanId || !startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'roomTypeId, ratePlanId, startDate, and endDate are required' } },
        { status: 400 }
      );
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid date range' } },
        { status: 400 }
      );
    }

    // Verify rate plan exists and belongs to this room type and tenant
    const ratePlan = await db.ratePlan.findFirst({
      where: { id: ratePlanId, roomTypeId, tenantId, deletedAt: null },
      select: { id: true, name: true, basePrice: true },
    });

    if (!ratePlan) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Rate plan not found for this room type' } },
        { status: 404 }
      );
    }

    // Process rates - rates is a map of { date: price }
    let created = 0;
    let updated = 0;

    if (rates && typeof rates === 'object') {
      for (const [dateStr, price] of Object.entries(rates)) {
        const priceVal = Number(price);
        if (isNaN(priceVal) || priceVal < 0) continue;

        const date = new Date(dateStr);
        if (date < start || date > end) continue;

        // Upsert: create or update the override
        const existing = await db.priceOverride.findUnique({
          where: { ratePlanId_date: { ratePlanId, date } },
        });

        if (existing) {
          await db.priceOverride.update({
            where: { ratePlanId_date: { ratePlanId, date } },
            data: { price: priceVal, reason: reason || existing.reason },
          });
          updated++;
        } else {
          await db.priceOverride.create({
            data: {
              ratePlanId,
              date,
              price: priceVal,
              reason: reason || 'Manual rate update',
            },
          });
          created++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: { created, updated, ratePlanName: ratePlan.name },
      message: `Created ${created} and updated ${updated} rate overrides`,
    });
  } catch (error) {
    console.error('Error setting bulk rates:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to set rates' } },
      { status: 500 }
    );
  }
}
