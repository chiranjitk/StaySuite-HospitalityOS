import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';// GET /api/revenue/pricing-rules - List pricing rules
export async function GET(request: NextRequest) {    const user = await requirePermission(request, 'revenue.manage'); if (user instanceof NextResponse) return user;
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 });
    }


  try {
    const tenantId = user.tenantId;
    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');

    const where: Record<string, unknown> = {};
    if (propertyId) {
      where.propertyId = propertyId;
    }
    // Filter by tenant
    where.tenantId = tenantId;

    const rules = await db.pricingRule.findMany({
      where,
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    // Calculate stats
    const stats = {
      totalRules: rules.length,
      activeRules: rules.filter(r => r.isActive).length,
      avgAdjustment: rules.length > 0
        ? Math.round(rules.reduce((sum, r) => sum + r.value, 0) / rules.length * 10) / 10
        : 0,
      seasonalRules: rules.filter(r => r.type === 'seasonal').length,
    };

    return NextResponse.json({
      success: true,
      data: rules.map(r => ({
        ...r,
        conditions: JSON.parse(r.conditions || '{}'),
        roomTypes: JSON.parse(r.roomTypes || '[]'),
      })),
      stats,
    });
  } catch (error) {
    console.error('Error fetching pricing rules:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch pricing rules' } },
      { status: 500 }
    );
  }
}

// POST /api/revenue/pricing-rules - Create a pricing rule
export async function POST(request: NextRequest) {    const user = await requirePermission(request, 'revenue.manage'); if (user instanceof NextResponse) return user;
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 });
    }


  try {
    const tenantId = user.tenantId;
    const body = await request.json();
    const {
      propertyId,
      name,
      type,
      value,
      valueType = 'percentage',
      conditions = {},
      priority = 1,
      isActive = true,
      effectiveFrom,
      effectiveTo,
      roomTypes = [],
      description,
    } = body;

    if (!name || !type || value === undefined) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Name, type, and value are required' } },
        { status: 400 }
      );
    }

    // Validate type
    const validTypes = ['markup', 'markdown', 'dynamic', 'seasonal', 'discount_percentage', 'discount_fixed', 'surcharge_percentage', 'surcharge_fixed', 'early_bird', 'last_minute', 'long_stay', 'weekend', 'occupancy', 'promo_code'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid rule type' } },
        { status: 400 }
      );
    }

    // Validate value based on type
    if (value < 0 && (type.includes('discount') || type === 'markdown')) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Discount value must be positive' } },
        { status: 400 }
      );
    }

    const rule = await db.pricingRule.create({
      data: {
        tenantId,
        propertyId,
        name,
        type,
        value,
        valueType,
        conditions: JSON.stringify(conditions),
        priority,
        isActive,
        effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : new Date(),
        effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
        roomTypes: JSON.stringify(roomTypes),
        description,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...rule,
        conditions: JSON.parse(rule.conditions || '{}'),
        roomTypes: JSON.parse(rule.roomTypes || '[]'),
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating pricing rule:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create pricing rule' } },
      { status: 500 }
    );
  }
}

// PUT /api/revenue/pricing-rules - Update a pricing rule
export async function PUT(request: NextRequest) {    const user = await requirePermission(request, 'revenue.manage'); if (user instanceof NextResponse) return user;
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 });
    }


  try {
    const tenantId = user.tenantId;
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Rule ID is required' } },
        { status: 400 }
      );
    }

    // Verify rule belongs to tenant
    const existingRule = await db.pricingRule.findFirst({
      where: { id, tenantId },
    });

    if (!existingRule) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Pricing rule not found' } },
        { status: 404 }
      );
    }

    // Explicit allowlist of updatable fields to prevent mass assignment
    const ALLOWED_FIELDS = [
      'name', 'type', 'value', 'valueType', 'conditions', 'priority',
      'isActive', 'effectiveFrom', 'effectiveTo', 'roomTypes', 'description',
    ] as const;

    const data: Record<string, unknown> = {};
    for (const field of ALLOWED_FIELDS) {
      if (updateData[field] !== undefined) {
        data[field] = updateData[field];
      }
    }
    if (data.conditions) {
      data.conditions = JSON.stringify(data.conditions);
    }
    if (data.roomTypes) {
      data.roomTypes = JSON.stringify(data.roomTypes);
    }
    if (data.effectiveFrom) {
      data.effectiveFrom = new Date(data.effectiveFrom as string);
    }
    if (data.effectiveTo) {
      data.effectiveTo = new Date(data.effectiveTo as string);
    }

    const rule = await db.pricingRule.update({
      where: { id },
      data,
    });

    return NextResponse.json({
      success: true,
      data: {
        ...rule,
        conditions: JSON.parse(rule.conditions || '{}'),
        roomTypes: JSON.parse(rule.roomTypes || '[]'),
      },
    });
  } catch (error) {
    console.error('Error updating pricing rule:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update pricing rule' } },
      { status: 500 }
    );
  }
}

// DELETE /api/revenue/pricing-rules - Delete a pricing rule
export async function DELETE(request: NextRequest) {    const user = await requirePermission(request, 'revenue.manage'); if (user instanceof NextResponse) return user;
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 });
    }


  try {
    const tenantId = user.tenantId;
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Rule ID is required' } },
        { status: 400 }
      );
    }

    // Verify rule belongs to tenant
    const existingRule = await db.pricingRule.findFirst({
      where: { id, tenantId },
    });

    if (!existingRule) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Pricing rule not found' } },
        { status: 404 }
      );
    }

    await db.pricingRule.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Pricing rule deleted',
    });
  } catch (error) {
    console.error('Error deleting pricing rule:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete pricing rule' } },
      { status: 500 }
    );
  }
}
