import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, hasPermission } from '@/lib/auth/tenant-context';// GET /api/price-overrides/[id] - Get a single price override
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requirePermission(request, 'pricing.manage');
    if (user instanceof NextResponse) return user;

      try {
    const tenantId = user.tenantId;
    const { id } = await params;

    const override = await db.priceOverride.findUnique({
      where: { id },
      include: {
        ratePlan: {
          select: {
            id: true,
            name: true,
            code: true,
            basePrice: true,
            currency: true,
            tenantId: true,
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
    });

    if (!override) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Price override not found' } },
        { status: 404 }
      );
    }

    // Verify override belongs to tenant via rate plan's tenantId
    if (override.ratePlan.tenantId !== tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Price override not accessible' } },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true, data: override });
  } catch (error) {
    console.error('Error fetching price override:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch price override' } },
      { status: 500 }
    );
  }
}

// PUT /api/price-overrides/[id] - Update a price override
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requirePermission(request, 'pricing.manage');
    if (user instanceof NextResponse) return user;

      if (!hasPermission(user, 'revenue:read')) {
    return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
  }

  try {
    const tenantId = user.tenantId;
    const { id } = await params;
    const body = await request.json();

    const existing = await db.priceOverride.findUnique({
      where: { id },
      include: {
        ratePlan: {
          select: {
            tenantId: true,
            roomType: {
              include: {
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
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Price override not found' } },
        { status: 404 }
      );
    }

    // Verify override belongs to tenant via rate plan's tenantId
    if (existing.ratePlan.tenantId !== tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Price override not accessible' } },
        { status: 403 }
      );
    }

    const { price, reason, minStay, closedToArrival, closedToDeparture } = body;

    // Validate price if provided
    if (price !== undefined && price < 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Price cannot be negative' } },
        { status: 400 }
      );
    }

    // Validate minStay if provided
    if (minStay !== undefined && minStay !== null && minStay < 1) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Min stay must be at least 1 night' } },
        { status: 400 }
      );
    }

    const override = await db.priceOverride.update({
      where: { id },
      data: {
        price: price !== undefined ? parseFloat(price) : undefined,
        reason,
        minStay: minStay ? parseInt(minStay) : null,
        closedToArrival,
        closedToDeparture,
      },
      include: {
        ratePlan: {
          include: {
            roomType: {
              include: {
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
    });

    return NextResponse.json({ success: true, data: override });
  } catch (error) {
    console.error('Error updating price override:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update price override' } },
      { status: 500 }
    );
  }
}

// DELETE /api/price-overrides/[id] - Delete a price override
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requirePermission(request, 'pricing.manage');
    if (user instanceof NextResponse) return user;

      if (!hasPermission(user, 'revenue:read')) {
    return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
  }

  try {
    const tenantId = user.tenantId;
    const { id } = await params;

    const existing = await db.priceOverride.findUnique({
      where: { id },
      include: {
        ratePlan: {
          select: { tenantId: true },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Price override not found' } },
        { status: 404 }
      );
    }

    // Verify override belongs to tenant via rate plan's tenantId
    if (existing.ratePlan.tenantId !== tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Price override not accessible' } },
        { status: 403 }
      );
    }

    await db.priceOverride.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Price override deleted successfully' });
  } catch (error) {
    console.error('Error deleting price override:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete price override' } },
      { status: 500 }
    );
  }
}
