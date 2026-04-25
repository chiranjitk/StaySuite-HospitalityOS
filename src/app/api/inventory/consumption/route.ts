import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/inventory/consumption - List all consumption logs
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
    if (!hasPermission(user, 'inventory.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to view consumption logs' } },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const stockItemId = searchParams.get('stockItemId');
    const type = searchParams.get('type');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const limitParam = searchParams.get('limit');
    const offset = searchParams.get('offset');

    // Cap limit at 100
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 100) : 100;

    // Build where clause for stock items - scoped to tenant
    const stockItemWhere: Record<string, unknown> = {
      tenantId: user.tenantId,
      deletedAt: null,
    };

    if (stockItemId) {
      stockItemWhere.id = stockItemId;
    }

    // Get stock items first
    const stockItems = await db.stockItem.findMany({
      where: stockItemWhere,
      select: { id: true, name: true, sku: true, unit: true },
    });

    const stockItemIds = stockItems.map(item => item.id);

    // Build where clause for consumption logs
    const consumptionWhere: Record<string, unknown> = {
      stockItemId: { in: stockItemIds },
    };

    if (type) {
      consumptionWhere.type = type;
    }

    if (dateFrom || dateTo) {
      consumptionWhere.createdAt = {};
      if (dateFrom) {
        (consumptionWhere.createdAt as Record<string, unknown>).gte = new Date(dateFrom);
      }
      if (dateTo) {
        (consumptionWhere.createdAt as Record<string, unknown>).lte = new Date(dateTo);
      }
    }

    const consumptionLogs = await db.stockConsumption.findMany({
      where: consumptionWhere,
      include: {
        stockItem: {
          select: {
            id: true,
            name: true,
            sku: true,
            unit: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      ...(offset && { skip: parseInt(offset, 10) }),
    });

    const total = await db.stockConsumption.count({ where: consumptionWhere });

    // Get summary stats
    const stats = await db.stockConsumption.aggregate({
      where: { stockItemId: { in: stockItemIds } },
      _count: true,
      _sum: {
        quantity: true,
        cost: true,
      },
    });

    // Get type distribution
    const typeDistribution = await db.stockConsumption.groupBy({
      by: ['type'],
      where: { stockItemId: { in: stockItemIds } },
      _count: true,
      _sum: { quantity: true },
    });

    return NextResponse.json({
      success: true,
      data: consumptionLogs,
      pagination: {
        total,
        limit,
        offset: offset ? parseInt(offset, 10) : null,
      },
      stats: {
        totalLogs: stats._count,
        totalQuantity: stats._sum.quantity || 0,
        totalCost: stats._sum.cost || 0,
        typeDistribution: typeDistribution.map(t => ({
          type: t.type,
          count: t._count,
          quantity: t._sum.quantity || 0,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching consumption logs:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch consumption logs' } },
      { status: 500 }
    );
  }
}

// POST /api/inventory/consumption - Create a consumption log
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
    if (!hasPermission(user, 'inventory.update')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to record consumption' } },
        { status: 403 }
      );
    }

    const body = await request.json();

    const {
      stockItemId,
      quantity,
      type = 'consumed',
      reference,
      cost,
      notes,
    } = body;

    // Validate required fields
    if (!stockItemId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Stock item ID is required' } },
        { status: 400 }
      );
    }

    if (quantity === undefined || quantity === null) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Quantity is required' } },
        { status: 400 }
      );
    }

    if (quantity <= 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Quantity must be greater than 0' } },
        { status: 400 }
      );
    }

    // Validate type
    const validTypes = ['consumed', 'added', 'returned', 'adjusted', 'wasted'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid type. Must be one of: ${validTypes.join(', ')}` } },
        { status: 400 }
      );
    }

    // Verify stock item exists and belongs to user's tenant
    const stockItem = await db.stockItem.findFirst({
      where: { id: stockItemId, tenantId: user.tenantId, deletedAt: null },
    });

    if (!stockItem) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Stock item not found' } },
        { status: 404 }
      );
    }

    // Create consumption log
    const consumptionLog = await db.stockConsumption.create({
      data: {
        stockItemId,
        quantity,
        type,
        reference,
        cost,
        notes,
        recordedBy: user.id,
      },
      include: {
        stockItem: {
          select: {
            id: true,
            name: true,
            sku: true,
            unit: true,
          },
        },
      },
    });

    // Update stock quantity
    const quantityChange = type === 'consumed' || type === 'adjusted' || type === 'wasted'
      ? -Math.abs(quantity) 
      : type === 'added' || type === 'returned'
        ? Math.abs(quantity)
        : quantity;

    await db.stockItem.update({
      where: { id: stockItemId },
      data: {
        quantity: Math.max(0, stockItem.quantity + quantityChange),
      },
    });

    return NextResponse.json({ success: true, data: consumptionLog }, { status: 201 });
  } catch (error) {
    console.error('Error creating consumption log:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create consumption log' } },
      { status: 500 }
    );
  }
}

// DELETE /api/inventory/consumption - Delete a consumption log
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
    if (!hasPermission(user, 'inventory.update')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to delete consumption logs' } },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Consumption log ID is required' } },
        { status: 400 }
      );
    }

    // Get the log first to reverse the stock change
    const log = await db.stockConsumption.findUnique({
      where: { id },
      include: { stockItem: true },
    });

    if (!log) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Consumption log not found' } },
        { status: 404 }
      );
    }

    // Verify stock item belongs to user's tenant
    if (log.stockItem.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }

    // Compute the quantity reversal
    const quantityChange = log.type === 'consumed' || log.type === 'adjusted' || log.type === 'wasted'
      ? Math.abs(log.quantity)
      : log.type === 'added' || log.type === 'returned'
        ? -Math.abs(log.quantity)
        : -log.quantity;

    // Reverse stock change and delete log atomically
    await db.$transaction(async (tx) => {
      // Reverse the stock change
      await tx.stockItem.update({
        where: { id: log.stockItemId },
        data: {
          quantity: Math.max(0, log.stockItem.quantity + quantityChange),
        },
      });

      // Delete the log
      await tx.stockConsumption.delete({
        where: { id },
      });
    });

    return NextResponse.json({
      success: true,
      message: 'Consumption log deleted',
    });
  } catch (error) {
    console.error('Error deleting consumption log:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete consumption log' } },
      { status: 500 }
    );
  }
}
