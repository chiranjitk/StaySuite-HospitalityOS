import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import crypto from 'crypto';

// Generate discount code using cryptographically secure random bytes
function generateDiscountCode(): string {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

// GET /api/settings/discounts - List all discounts/promotions
export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Permission check
    if (!hasPermission(user, 'settings.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Permission denied' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const search = searchParams.get('search');

    const where: Record<string, unknown> = {
      roomType: {
        property: {
          tenantId,
        },
      },
      OR: [
        { promoCode: { not: null } },
        { discountPercent: { not: null } },
        { discountAmount: { not: null } },
      ],
    };

    if (status) {
      where.status = status;
    }

    if (type) {
      if (type === 'percentage') {
        where.discountPercent = { not: null };
      } else {
        where.discountAmount = { not: null };
      }
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { promoCode: { contains: search } },
      ];
    }

    // Query rate plans with promo codes
    const ratePlans = await db.ratePlan.findMany({
      where,
      include: {
        roomType: {
          select: {
            name: true,
            property: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Transform rate plans into discount format
    const discounts = ratePlans.map((plan) => ({
      id: plan.id,
      code: plan.promoCode || `RATE-${plan.code}`,
      name: plan.name,
      description: plan.description || '',
      discountType: plan.discountPercent ? 'percentage' : 'fixed',
      discountValue: plan.discountPercent || plan.discountAmount || 0,
      maxDiscount: null,
      minBookingValue: null,
      minNights: plan.minStay || 1,
      applicableRoomTypes: [plan.roomType.name],
      property: plan.roomType.property.name,
      startsAt: plan.promoStart?.toISOString() || plan.createdAt.toISOString(),
      endsAt: plan.promoEnd?.toISOString() || null,
      maxUses: null,
      usedCount: 0,
      maxUsesPerUser: null,
      status: plan.status,
      createdAt: plan.createdAt.toISOString(),
      updatedAt: plan.updatedAt.toISOString(),
    }));

    // Calculate stats
    const stats = {
      total: discounts.length,
      active: discounts.filter(d => d.status === 'active').length,
      expired: discounts.filter(d => d.endsAt && new Date(d.endsAt) < new Date()).length,
      totalSavings: discounts.reduce((sum, d) => sum + (d.discountValue * d.usedCount), 0),
    };

    return NextResponse.json({
      success: true,
      data: discounts,
      stats,
    });
  } catch (error) {
    console.error('Error fetching discounts:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch discounts' } },
      { status: 500 }
    );
  }
}

// POST /api/settings/discounts - Create a new discount
export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Permission check
    if (!hasPermission(user, 'settings.edit')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Permission denied' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;
    const body = await request.json();
    const {
      name,
      code,
      description,
      discountType,
      discountValue,
      maxDiscount,
      minBookingValue,
      minNights,
      startsAt,
      endsAt,
      maxUses,
      maxUsesPerUser,
    } = body;

    // Validate required fields
    if (!name || !discountType || !discountValue) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: name, discountType, discountValue' } },
        { status: 400 }
      );
    }

    // Generate code if not provided
    const discountCode = code || generateDiscountCode();

    // Find a room type to associate with
    const roomType = await db.roomType.findFirst({
      where: {
        property: {
          tenantId,
        },
      },
    });

    if (!roomType) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_ROOM_TYPE', message: 'No room type found to associate discount' } },
        { status: 400 }
      );
    }

    // Create rate plan with promo code
    const ratePlan = await db.ratePlan.create({
      data: {
        tenantId: user.tenantId,
        roomTypeId: roomType.id,
        name,
        code: discountCode,
        description,
        basePrice: 0,
        currency: 'USD',
        promoCode: discountCode,
        discountPercent: discountType === 'percentage' ? discountValue : null,
        discountAmount: discountType === 'fixed' ? discountValue : null,
        promoStart: startsAt ? new Date(startsAt) : null,
        promoEnd: endsAt ? new Date(endsAt) : null,
        minStay: minNights || 1,
        status: 'active',
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: ratePlan.id,
        code: ratePlan.promoCode,
        name: ratePlan.name,
        description: ratePlan.description,
        discountType,
        discountValue,
        startsAt: ratePlan.promoStart?.toISOString(),
        endsAt: ratePlan.promoEnd?.toISOString(),
        status: ratePlan.status,
        createdAt: ratePlan.createdAt.toISOString(),
      },
      message: 'Discount created successfully',
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating discount:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create discount' } },
      { status: 500 }
    );
  }
}

// PUT /api/settings/discounts - Update a discount
export async function PUT(request: NextRequest) {
  try {
    // Authentication check
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Permission check
    if (!hasPermission(user, 'settings.edit')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Permission denied' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Discount ID is required' } },
        { status: 400 }
      );
    }

    // Check if rate plan exists and belongs to user's tenant
    const existingPlan = await db.ratePlan.findUnique({
      where: { id },
      include: {
        roomType: {
          select: {
            propertyId: true,
            property: {
              select: { tenantId: true },
            },
          },
        },
      },
    });

    if (!existingPlan) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Discount not found' } },
        { status: 404 }
      );
    }

    // Verify the rate plan belongs to user's tenant
    if (existingPlan.roomType.property.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Cannot update discount from another tenant' } },
        { status: 403 }
      );
    }

    // Update rate plan
    const updateData: Record<string, unknown> = {};
    
    if (updates.name) updateData.name = updates.name;
    if (updates.code) updateData.promoCode = updates.code;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.status) updateData.status = updates.status;
    if (updates.startsAt) updateData.promoStart = new Date(updates.startsAt);
    if (updates.endsAt) updateData.promoEnd = new Date(updates.endsAt);
    if (updates.discountType && updates.discountValue) {
      if (updates.discountType === 'percentage') {
        updateData.discountPercent = updates.discountValue;
        updateData.discountAmount = null;
      } else {
        updateData.discountAmount = updates.discountValue;
        updateData.discountPercent = null;
      }
    }

    const ratePlan = await db.ratePlan.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: ratePlan.id,
        code: ratePlan.promoCode,
        name: ratePlan.name,
        status: ratePlan.status,
        updatedAt: ratePlan.updatedAt.toISOString(),
      },
      message: 'Discount updated successfully',
    });
  } catch (error) {
    console.error('Error updating discount:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update discount' } },
      { status: 500 }
    );
  }
}

// DELETE /api/settings/discounts - Delete a discount
export async function DELETE(request: NextRequest) {
  try {
    // Authentication check
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Permission check
    if (!hasPermission(user, 'settings.edit')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Permission denied' } },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Discount ID is required' } },
        { status: 400 }
      );
    }

    // Check if rate plan exists
    const existingPlan = await db.ratePlan.findUnique({
      where: { id },
    });

    if (!existingPlan) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Discount not found' } },
        { status: 404 }
      );
    }

    // Soft delete by setting status to inactive
    await db.ratePlan.update({
      where: { id },
      data: { status: 'inactive' },
    });

    return NextResponse.json({
      success: true,
      message: 'Discount deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting discount:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete discount' } },
      { status: 500 }
    );
  }
}
