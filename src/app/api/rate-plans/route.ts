import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';// GET /api/rate-plans - List all rate plans
export async function GET(request: NextRequest) {    const user = await requirePermission(request, 'pricing.manage');
    if (user instanceof NextResponse) return user;

      try {
    const searchParams = request.nextUrl.searchParams;
    const roomTypeId = searchParams.get('roomTypeId');
    const status = searchParams.get('status');
    const mealPlan = searchParams.get('mealPlan');
    const search = searchParams.get('search');
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    const where: Record<string, unknown> = { tenantId: user.tenantId };

    if (!includeInactive) {
      where.deletedAt = null;
    }

    if (roomTypeId) {
      where.roomTypeId = roomTypeId;
    }

    if (status) {
      where.status = status;
    }

    if (mealPlan) {
      where.mealPlan = mealPlan;
    }

    if (search) {
      where.OR = [
        { name: { contains: search,  } },
        { code: { contains: search,  } },
        { description: { contains: search,  } },
      ];
    }

    const ratePlans = await db.ratePlan.findMany({
      where,
      include: {
        roomType: {
          select: {
            id: true,
            name: true,
            code: true,
            basePrice: true,
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
        _count: {
          select: { priceOverrides: true, channelMappings: true },
        },
      },
      orderBy: [
        { roomType: { name: 'asc' } },
        { name: 'asc' },
      ],
      ...(limit && { take: parseInt(limit, 10) }),
      ...(offset && { skip: parseInt(offset, 10) }),
    });

    // Check for active promotions
    const now = new Date();
    const transformedPlans = ratePlans.map(plan => {
      const hasActivePromo = plan.promoStart && plan.promoEnd &&
        now >= plan.promoStart && now <= plan.promoEnd;
      
      const effectivePrice = hasActivePromo
        ? plan.discountPercent
          ? plan.basePrice * (1 - plan.discountPercent / 100)
          : plan.discountAmount
          ? plan.basePrice - plan.discountAmount
          : plan.basePrice
        : plan.basePrice;

      return {
        ...plan,
        hasActivePromo,
        effectivePrice,
        discountDisplay: plan.discountPercent
          ? `${plan.discountPercent}% off`
          : plan.discountAmount
          ? `$${plan.discountAmount} off`
          : null,
      };
    });

    const total = await db.ratePlan.count({ where });

    // Get meal plan distribution
    const mealPlanDistribution = await db.ratePlan.groupBy({
      by: ['mealPlan'],
      where: { deletedAt: null, tenantId: user.tenantId },
      _count: true,
    });

    return NextResponse.json({
      success: true,
      data: transformedPlans,
      pagination: {
        total,
        limit: limit ? parseInt(limit, 10) : null,
        offset: offset ? parseInt(offset, 10) : null,
      },
      stats: {
        totalPlans: total,
        activePlans: await db.ratePlan.count({ where: { status: 'active', deletedAt: null, tenantId: user.tenantId } }),
        mealPlanDistribution: mealPlanDistribution.map(m => ({
          mealPlan: m.mealPlan,
          count: m._count,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching rate plans:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch rate plans' } },
      { status: 500 }
    );
  }
}

// POST /api/rate-plans - Create a new rate plan
export async function POST(request: NextRequest) {    const user = await requirePermission(request, 'pricing.manage');
    if (user instanceof NextResponse) return user;

      try {
    const body = await request.json();

    const {
      roomTypeId,
      name,
      code,
      description,
      basePrice,
      currency = 'USD',
      mealPlan = 'room_only',
      minStay = 1,
      maxStay,
      advanceBookingDays,
      cancellationPolicy,
      cancellationHours,
      bookingStartDays,
      bookingEndDays,
      promoCode,
      discountPercent,
      discountAmount,
      promoStart,
      promoEnd,
      status = 'active',
    } = body;

    // Validate required fields
    if (!roomTypeId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Room type ID is required' } },
        { status: 400 }
      );
    }

    if (!name || !code) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Name and code are required' } },
        { status: 400 }
      );
    }

    if (basePrice === undefined || basePrice < 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Valid base price is required' } },
        { status: 400 }
      );
    }

    // Verify room type exists
    const roomType = await db.roomType.findFirst({
      where: { id: roomTypeId, deletedAt: null },
    });

    if (!roomType) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ROOM_TYPE', message: 'Room type not found' } },
        { status: 400 }
      );
    }

    // Check for duplicate code within room type
    const existingPlan = await db.ratePlan.findFirst({
      where: {
        roomTypeId,
        code: code,
        deletedAt: null,
      },
    });

    if (existingPlan) {
      return NextResponse.json(
        { success: false, error: { code: 'DUPLICATE_CODE', message: 'A rate plan with this code already exists for this room type' } },
        { status: 400 }
      );
    }

    // Validate discount values
    if (discountPercent && (discountPercent < 0 || discountPercent > 100)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_DISCOUNT', message: 'Discount percent must be between 0 and 100' } },
        { status: 400 }
      );
    }

    if (discountAmount && discountAmount < 0) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_DISCOUNT', message: 'Discount amount cannot be negative' } },
        { status: 400 }
      );
    }

    // Validate promo dates
    if (promoStart && promoEnd && new Date(promoStart) >= new Date(promoEnd)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PROMO_DATES', message: 'Promo end date must be after start date' } },
        { status: 400 }
      );
    }

    const ratePlan = await db.ratePlan.create({
      data: {
        tenantId: user.tenantId,
        roomTypeId,
        name,
        code,
        description,
        basePrice,
        currency,
        mealPlan,
        minStay,
        maxStay,
        advanceBookingDays,
        cancellationPolicy,
        cancellationHours,
        bookingStartDays,
        bookingEndDays,
        promoCode,
        discountPercent,
        discountAmount,
        promoStart: promoStart ? new Date(promoStart) : null,
        promoEnd: promoEnd ? new Date(promoEnd) : null,
        status,
      },
      include: {
        roomType: {
          select: {
            id: true,
            name: true,
            code: true,
            basePrice: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, data: ratePlan }, { status: 201 });
  } catch (error) {
    console.error('Error creating rate plan:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create rate plan' } },
      { status: 500 }
    );
  }
}

// PUT /api/rate-plans - Update a rate plan
export async function PUT(request: NextRequest) {    const user = await requirePermission(request, 'pricing.manage');
    if (user instanceof NextResponse) return user;

      try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Rate plan ID is required' } },
        { status: 400 }
      );
    }

    // Handle date fields
    if (updates.promoStart) {
      updates.promoStart = new Date(updates.promoStart);
    }
    if (updates.promoEnd) {
      updates.promoEnd = new Date(updates.promoEnd);
    }

    // Validate discount values if provided
    if (updates.discountPercent !== undefined && (updates.discountPercent < 0 || updates.discountPercent > 100)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_DISCOUNT', message: 'Discount percent must be between 0 and 100' } },
        { status: 400 }
      );
    }

    if (updates.discountAmount !== undefined && updates.discountAmount < 0) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_DISCOUNT', message: 'Discount amount cannot be negative' } },
        { status: 400 }
      );
    }

    const ratePlan = await db.ratePlan.update({
      where: { id },
      data: updates,
      include: {
        roomType: {
          select: {
            id: true,
            name: true,
            code: true,
            basePrice: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, data: ratePlan });
  } catch (error) {
    console.error('Error updating rate plan:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update rate plan' } },
      { status: 500 }
    );
  }
}

// DELETE /api/rate-plans - Soft delete rate plans
export async function DELETE(request: NextRequest) {    const user = await requirePermission(request, 'pricing.manage');
    if (user instanceof NextResponse) return user;

      try {
    const searchParams = request.nextUrl.searchParams;
    const ids = searchParams.get('ids')?.split(',');

    if (!ids || ids.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Rate plan IDs are required' } },
        { status: 400 }
      );
    }

    // Check if any rate plans are in use
    const bookingsCount = await db.booking.count({
      where: {
        ratePlanId: { in: ids },
        status: { in: ['confirmed', 'checked_in'] },
      },
    });

    if (bookingsCount > 0) {
      return NextResponse.json(
        { success: false, error: { code: 'RATE_PLAN_IN_USE', message: 'Cannot delete rate plans that are in use by active bookings' } },
        { status: 400 }
      );
    }

    const results = await db.ratePlan.updateMany({
      where: {
        id: { in: ids },
      },
      data: {
        deletedAt: new Date(),
        status: 'inactive',
      },
    });

    return NextResponse.json({
      success: true,
      message: `Deleted ${results.count} rate plans`,
    });
  } catch (error) {
    console.error('Error deleting rate plans:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete rate plans' } },
      { status: 500 }
    );
  }
}
