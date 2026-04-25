import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, hasPermission } from '@/lib/auth/tenant-context';// GET /api/price-overrides - List all price overrides
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'pricing.manage');
    if (user instanceof NextResponse) return user;

      try {
    const tenantId = user.tenantId;
    const searchParams = request.nextUrl.searchParams;
    const ratePlanId = searchParams.get('ratePlanId');
    const roomTypeId = searchParams.get('roomTypeId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 100); // Cap at 100
    const offset = searchParams.get('offset');

    // Get all rate plans for this tenant to filter overrides
    const tenantRatePlans = await db.ratePlan.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true, roomTypeId: true },
    });
    const tenantRatePlanIds = tenantRatePlans.map(rp => rp.id);

    const where: Record<string, unknown> = {
      ratePlanId: { in: tenantRatePlanIds },
    };

    if (ratePlanId) {
      // Verify rate plan belongs to tenant
      if (!tenantRatePlanIds.includes(ratePlanId)) {
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: 'Rate plan not accessible' } },
          { status: 403 }
        );
      }
      where.ratePlanId = ratePlanId;
    }

    // If roomTypeId is provided, get all rate plans for that room type
    if (roomTypeId && !ratePlanId) {
      const ratePlansForRoomType = tenantRatePlans
        .filter(rp => rp.roomTypeId === roomTypeId)
        .map(rp => rp.id);
      where.ratePlanId = { in: ratePlansForRoomType };
    }

    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) {
        (where.date as Record<string, unknown>).gte = new Date(dateFrom);
      }
      if (dateTo) {
        (where.date as Record<string, unknown>).lte = new Date(dateTo);
      }
    }

    const priceOverrides = await db.priceOverride.findMany({
      where,
      include: {
        ratePlan: {
          select: {
            id: true,
            name: true,
            code: true,
            basePrice: true,
            currency: true,
            roomType: {
              select: {
                id: true,
                name: true,
                code: true,
                propertyId: true,
                property: {
                  select: {
                    id: true,
                    name: true,
                    currency: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [
        { date: 'asc' },
      ],
      take: limit,
      ...(offset && { skip: parseInt(offset, 10) }),
    });

    // Calculate price difference from base
    const transformedOverrides = priceOverrides.map(override => ({
      ...override,
      priceDifference: override.price - override.ratePlan.basePrice,
      percentChange: override.ratePlan.basePrice > 0
        ? ((override.price - override.ratePlan.basePrice) / override.ratePlan.basePrice) * 100
        : 0,
    }));

    const total = await db.priceOverride.count({ where });

    return NextResponse.json({
      success: true,
      data: transformedOverrides,
      pagination: {
        total,
        limit,
        offset: offset ? parseInt(offset, 10) : 0,
      },
    });
  } catch (error) {
    console.error('Error fetching price overrides:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch price overrides' } },
      { status: 500 }
    );
  }
}

// POST /api/price-overrides - Create a new price override
export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'pricing.manage');
    if (user instanceof NextResponse) return user;

      if (!hasPermission(user, 'revenue:read')) {
    return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
  }

  try {
    const tenantId = user.tenantId;
    const body = await request.json();

    const {
      ratePlanId,
      date,
      price,
      reason,
      minStay,
      closedToArrival = false,
      closedToDeparture = false,
    } = body;

    // Validate required fields
    if (!ratePlanId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Rate plan ID is required' } },
        { status: 400 }
      );
    }

    if (!date) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Date is required' } },
        { status: 400 }
      );
    }

    if (price === undefined || price < 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Valid price is required (must be non-negative)' } },
        { status: 400 }
      );
    }

    // Verify rate plan exists and belongs to tenant
    const ratePlan = await db.ratePlan.findFirst({
      where: { id: ratePlanId, tenantId, deletedAt: null },
    });

    if (!ratePlan) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_RATE_PLAN', message: 'Rate plan not found or not accessible' } },
        { status: 404 }
      );
    }

    // Validate minStay
    if (minStay !== undefined && minStay !== null && minStay < 1) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Min stay must be at least 1 night' } },
        { status: 400 }
      );
    }

    // Check for existing override on this date
    const existingOverride = await db.priceOverride.findFirst({
      where: { ratePlanId, date: new Date(date) },
    });

    if (existingOverride) {
      return NextResponse.json(
        { success: false, error: { code: 'OVERRIDE_EXISTS', message: 'A price override already exists for this date. Use PUT to update.' } },
        { status: 400 }
      );
    }

    const priceOverride = await db.priceOverride.create({
      data: {
        ratePlanId,
        date: new Date(date),
        price,
        reason,
        minStay,
        closedToArrival,
        closedToDeparture,
      },
      include: {
        ratePlan: {
          select: {
            id: true,
            name: true,
            code: true,
            basePrice: true,
            currency: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, data: priceOverride }, { status: 201 });
  } catch (error) {
    console.error('Error creating price override:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create price override' } },
      { status: 500 }
    );
  }
}

// PUT /api/price-overrides - Update a price override
export async function PUT(request: NextRequest) {
  const user = await requirePermission(request, 'pricing.manage');
    if (user instanceof NextResponse) return user;

      if (!hasPermission(user, 'revenue:read')) {
    return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
  }

  try {
    const tenantId = user.tenantId;
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Price override ID is required' } },
        { status: 400 }
      );
    }

    // Verify override exists and belongs to tenant via rate plan
    const existingOverride = await db.priceOverride.findFirst({
      where: { id },
      include: {
        ratePlan: {
          select: { tenantId: true },
        },
      },
    });

    if (!existingOverride) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Price override not found' } },
        { status: 404 }
      );
    }

    if (existingOverride.ratePlan.tenantId !== tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Price override not accessible' } },
        { status: 403 }
      );
    }

    // Handle date field
    if (updates.date) {
      updates.date = new Date(updates.date);
    }

    // Validate price if provided
    if (updates.price !== undefined && updates.price < 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Price cannot be negative' } },
        { status: 400 }
      );
    }

    // Validate minStay if provided
    if (updates.minStay !== undefined && updates.minStay !== null && updates.minStay < 1) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Min stay must be at least 1 night' } },
        { status: 400 }
      );
    }

    const priceOverride = await db.priceOverride.update({
      where: { id },
      data: updates,
      include: {
        ratePlan: {
          select: {
            id: true,
            name: true,
            code: true,
            basePrice: true,
            currency: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, data: priceOverride });
  } catch (error) {
    console.error('Error updating price override:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update price override' } },
      { status: 500 }
    );
  }
}

// DELETE /api/price-overrides - Delete price overrides
export async function DELETE(request: NextRequest) {
  const user = await requirePermission(request, 'pricing.manage');
    if (user instanceof NextResponse) return user;

      if (!hasPermission(user, 'revenue:read')) {
    return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
  }

  try {
    const tenantId = user.tenantId;
    const searchParams = request.nextUrl.searchParams;
    const ids = searchParams.get('ids')?.split(',');

    if (!ids || ids.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Price override IDs are required' } },
        { status: 400 }
      );
    }

    // Verify all overrides belong to tenant via rate plans
    const overrides = await db.priceOverride.findMany({
      where: { id: { in: ids } },
      include: {
        ratePlan: {
          select: { tenantId: true },
        },
      },
    });

    const nonAccessibleOverrides = overrides.filter(o => o.ratePlan.tenantId !== tenantId);
    if (nonAccessibleOverrides.length > 0) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Some price overrides are not accessible' } },
        { status: 403 }
      );
    }

    const results = await db.priceOverride.deleteMany({
      where: {
        id: { in: ids },
      },
    });

    return NextResponse.json({
      success: true,
      message: `Deleted ${results.count} price overrides`,
    });
  } catch (error) {
    console.error('Error deleting price overrides:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete price overrides' } },
      { status: 500 }
    );
  }
}
