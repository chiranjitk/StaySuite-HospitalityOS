import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/inventory/stock - List all stock items
export async function GET(request: NextRequest) {    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }


    // RBAC check
    if (!hasPermission(user, 'inventory.view') && !hasPermission(user, 'inventory.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

  try {
    const searchParams = request.nextUrl.searchParams;
    const tenantId = user.tenantId;
    const propertyId = searchParams.get('propertyId');
    const category = searchParams.get('category');
    const status = searchParams.get('status');
    const lowStock = searchParams.get('lowStock');
    const search = searchParams.get('search');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    const where: Record<string, unknown> = {
      tenantId,
      deletedAt: null,
    };

    if (propertyId) {
      where.propertyId = propertyId;
    }

    if (category) {
      where.category = category;
    }

    if (status) {
      where.status = status;
    }

    // lowStock filter is handled after fetching by checking isLowStock property
    // (cannot use field reference in Prisma where clause)

    if (search) {
      where.OR = [
        { name: { contains: search,  } },
        { sku: { contains: search,  } },
        { description: { contains: search,  } },
      ];
    }

    const stockItems = await db.stockItem.findMany({
      where,
      include: {
        _count: {
          select: { purchaseOrderItems: true },
        },
      },
      orderBy: [
        { name: 'asc' },
      ],
      ...(limit && { take: parseInt(limit, 10) }),
      ...(offset && { skip: parseInt(offset, 10) }),
    });

    // Calculate low stock status
    const itemsWithStatus = stockItems.map(item => ({
      ...item,
      isLowStock: item.quantity <= item.minQuantity,
      availableQuantity: item.maxQuantity 
        ? item.maxQuantity - item.quantity 
        : null,
    }));

    const total = await db.stockItem.count({ where });

    // Get summary stats
    const stats = await db.stockItem.aggregate({
      where: { tenantId, deletedAt: null },
      _count: true,
      _sum: {
        quantity: true,
        unitCost: true,
      },
    });

    const lowStockCount = itemsWithStatus.filter(item => item.isLowStock).length;

    return NextResponse.json({
      success: true,
      data: itemsWithStatus,
      pagination: {
        total,
        limit: limit ? parseInt(limit, 10) : null,
        offset: offset ? parseInt(offset, 10) : null,
      },
      stats: {
        totalItems: stats._count,
        totalQuantity: stats._sum.quantity || 0,
        lowStockItems: lowStockCount,
      },
    });
  } catch (error) {
    console.error('Error fetching stock items:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch stock items' } },
      { status: 500 }
    );
  }
}

// POST /api/inventory/stock - Create a new stock item
export async function POST(request: NextRequest) {    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }


    // RBAC check
    if (!hasPermission(user, 'inventory.create') && !hasPermission(user, 'inventory.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

  try {
    const body = await request.json();
    const tenantId = user.tenantId;

    const {
      
      propertyId,
      name,
      sku,
      category,
      description,
      unit = 'piece',
      unitCost = 0,
      quantity = 0,
      minQuantity = 0,
      maxQuantity,
      reorderPoint,
      location,
      status = 'active',
      lowStockAlert = true,
    } = body;

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Name is required' } },
        { status: 400 }
      );
    }

    // Check for duplicate SKU within tenant
    if (sku) {
      const existingItem = await db.stockItem.findFirst({
        where: {
          tenantId,
          sku,
          deletedAt: null,
        },
      });

      if (existingItem) {
        return NextResponse.json(
          { success: false, error: { code: 'DUPLICATE_SKU', message: 'An item with this SKU already exists' } },
          { status: 400 }
        );
      }
    }

    const stockItem = await db.stockItem.create({
      data: {
        tenantId,
        propertyId,
        name,
        sku,
        category,
        description,
        unit,
        unitCost,
        quantity,
        minQuantity,
        maxQuantity,
        reorderPoint,
        location,
        status,
        lowStockAlert,
      },
    });

    return NextResponse.json({ 
      success: true, 
      data: {
        ...stockItem,
        isLowStock: stockItem.quantity <= stockItem.minQuantity,
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating stock item:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create stock item' } },
      { status: 500 }
    );
  }
}

// PUT /api/inventory/stock - Bulk update stock items
export async function PUT(request: NextRequest) {    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }


    // RBAC check
    if (!hasPermission(user, 'inventory.update') && !hasPermission(user, 'inventory.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

  try {
    const body = await request.json();
    const tenantId = user.tenantId;
    const { ids, updates } = body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Item IDs are required' } },
        { status: 400 }
      );
    }

    // Verify all items belong to the user's tenant before updating
    const tenantItems = await db.stockItem.findMany({
      where: { id: { in: ids }, tenantId },
    });

    if (tenantItems.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'No matching items found in your tenant' } },
        { status: 404 }
      );
    }

    const validIds = tenantItems.map(item => item.id);
    const results = await Promise.all(
      validIds.map(id =>
        db.stockItem.update({
          where: { id },
          data: updates,
        })
      )
    );

    return NextResponse.json({
      success: true,
      data: results,
      message: `Updated ${results.length} items`,
    });
  } catch (error) {
    console.error('Error updating stock items:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update stock items' } },
      { status: 500 }
    );
  }
}

// DELETE /api/inventory/stock - Soft delete stock items
export async function DELETE(request: NextRequest) {    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }


    // RBAC check
    if (!hasPermission(user, 'inventory.delete') && !hasPermission(user, 'inventory.*') && user.roleName !== 'admin') {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
    }

  try {
    const tenantId = user.tenantId;
    const searchParams = request.nextUrl.searchParams;
    const ids = searchParams.get('ids')?.split(',');

    if (!ids || ids.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Item IDs are required' } },
        { status: 400 }
      );
    }

    const results = await db.stockItem.updateMany({
      where: {
        id: { in: ids },
        tenantId,
      },
      data: {
        deletedAt: new Date(),
        status: 'inactive',
      },
    });

    return NextResponse.json({
      success: true,
      message: `Deleted ${results.count} items`,
    });
  } catch (error) {
    console.error('Error deleting stock items:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete stock items' } },
      { status: 500 }
    );
  }
}
