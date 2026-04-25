import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { logInventory } from '@/lib/audit';

/**
 * DEPRECATED: This endpoint routes to db.stockItem (hotel supplies / procurement inventory),
 * NOT room inventory. No PMS page currently calls this endpoint.
 * Room inventory is managed via /api/inventory-locks and /api/inventory (without [id]).
 * If you need room-level inventory operations, use those endpoints instead.
 * TODO: Consider moving this to /api/inventory/stock/[id] for clarity.
 */

// GET /api/inventory/[id] - Get a single stock item by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  // RBAC check
  if (!hasPermission(user, 'inventory.view') && !hasPermission(user, 'inventory.*') && user.roleName !== 'admin') {
    return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
  }

  try {
    const { id } = await params;

    const stockItem = await db.stockItem.findFirst({
      where: {
        id,
        tenantId: user.tenantId,
        deletedAt: null,
      },
      include: {
        _count: {
          select: { purchaseOrderItems: true },
        },
        consumptionLogs: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!stockItem) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Stock item not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        ...stockItem,
        isLowStock: stockItem.quantity <= stockItem.minQuantity,
        availableQuantity: stockItem.maxQuantity
          ? stockItem.maxQuantity - stockItem.quantity
          : null,
      },
    });
  } catch (error) {
    console.error('Error fetching stock item:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch stock item' } },
      { status: 500 }
    );
  }
}

// PATCH /api/inventory/[id] - Update a single stock item
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  // RBAC check
  if (!hasPermission(user, 'inventory.update') && !hasPermission(user, 'inventory.*') && user.roleName !== 'admin') {
    return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();

    const {
      name,
      description,
      category,
      unit,
      unitCost,
      quantity,
      minQuantity,
      maxQuantity,
      reorderPoint,
      location,
      status,
      lowStockAlert,
      sku,
      propertyId,
    } = body;

    // Verify the stock item belongs to the user's tenant and is not deleted
    const existing = await db.stockItem.findFirst({
      where: {
        id,
        tenantId: user.tenantId,
        deletedAt: null,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Stock item not found' } },
        { status: 404 }
      );
    }

    // Check for duplicate SKU if being updated
    if (sku && sku !== existing.sku) {
      const duplicate = await db.stockItem.findFirst({
        where: {
          tenantId: user.tenantId,
          sku,
          deletedAt: null,
          id: { not: id },
        },
      });

      if (duplicate) {
        return NextResponse.json(
          { success: false, error: { code: 'DUPLICATE_SKU', message: 'An item with this SKU already exists' } },
          { status: 400 }
        );
      }
    }

    // Build update data object with only provided fields
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (category !== undefined) updateData.category = category;
    if (unit !== undefined) updateData.unit = unit;
    if (unitCost !== undefined) updateData.unitCost = unitCost;
    if (quantity !== undefined) updateData.quantity = quantity;
    if (minQuantity !== undefined) updateData.minQuantity = minQuantity;
    if (maxQuantity !== undefined) updateData.maxQuantity = maxQuantity;
    if (reorderPoint !== undefined) updateData.reorderPoint = reorderPoint;
    if (location !== undefined) updateData.location = location;
    if (status !== undefined) updateData.status = status;
    if (lowStockAlert !== undefined) updateData.lowStockAlert = lowStockAlert;
    if (sku !== undefined) updateData.sku = sku;
    if (propertyId !== undefined) updateData.propertyId = propertyId;

    // Capture old values for audit log
    const oldValue: Record<string, unknown> = {};
    if (status !== undefined) oldValue.status = existing.status;

    const updatedItem = await db.stockItem.update({
      where: { id },
      data: updateData,
    });

    // If status changed, create an audit log entry
    if (status !== undefined && status !== existing.status) {
      try {
        await logInventory(
          request,
          'update',
          'stock_item',
          id,
          oldValue,
          { status: updatedItem.status, name: updatedItem.name },
          { tenantId: user.tenantId, userId: user.id }
        );
      } catch (auditError) {
        console.error('Audit log failed (non-blocking):', auditError);
        // Continue with response - don't fail the update due to audit failure
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        ...updatedItem,
        isLowStock: updatedItem.quantity <= updatedItem.minQuantity,
        availableQuantity: updatedItem.maxQuantity
          ? updatedItem.maxQuantity - updatedItem.quantity
          : null,
      },
    });
  } catch (error) {
    console.error('Error updating stock item:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update stock item' } },
      { status: 500 }
    );
  }
}
