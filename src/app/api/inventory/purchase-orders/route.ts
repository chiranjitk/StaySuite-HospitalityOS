import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import crypto from 'crypto';

// Helper function to generate order number
function generateOrderNumber(): string {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const random = crypto.randomBytes(4).toString('hex').slice(0, 4);
  return `PO-${year}${month}-${random}`;
}

// GET /api/inventory/purchase-orders - List all purchase orders
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
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to view purchase orders' } },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const vendorId = searchParams.get('vendorId');
    const status = searchParams.get('status');
    const orderDateFrom = searchParams.get('orderDateFrom');
    const orderDateTo = searchParams.get('orderDateTo');
    const search = searchParams.get('search');
    const limitParam = searchParams.get('limit');
    const offset = searchParams.get('offset');

    // Cap limit at 100
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 100) : 100;

    const where: Record<string, unknown> = {
      tenantId: user.tenantId,
    };

    if (vendorId) {
      where.vendorId = vendorId;
    }

    if (status) {
      where.status = status;
    }

    if (orderDateFrom || orderDateTo) {
      where.orderDate = {};
      if (orderDateFrom) {
        (where.orderDate as Record<string, unknown>).gte = new Date(orderDateFrom);
      }
      if (orderDateTo) {
        (where.orderDate as Record<string, unknown>).lte = new Date(orderDateTo);
      }
    }

    if (search) {
      where.OR = [
        { orderNumber: { contains: search } },
        { vendor: { name: { contains: search } } },
        { notes: { contains: search } },
      ];
    }

    const purchaseOrders = await db.purchaseOrder.findMany({
      where,
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            contactPerson: true,
            email: true,
            phone: true,
            type: true,
          },
        },
        items: {
          include: {
            stockItem: {
              select: {
                id: true,
                name: true,
                sku: true,
                unit: true,
                unitCost: true,
              },
            },
          },
        },
        _count: {
          select: { items: true },
        },
      },
      orderBy: [
        { orderDate: 'desc' },
        { createdAt: 'desc' },
      ],
      take: limit,
      ...(offset && { skip: parseInt(offset, 10) }),
    });

    // Calculate item totals
    const transformedOrders = purchaseOrders.map(order => ({
      ...order,
      itemCount: order.items.length,
      totalQuantity: order.items.reduce((sum, item) => sum + item.quantity, 0),
      receivedQuantity: order.items.reduce(
        (sum, item) => sum + (item.receivedQuantity || 0),
        0
      ),
    }));

    const total = await db.purchaseOrder.count({ where });

    // Get status distribution
    const statusDistribution = await db.purchaseOrder.groupBy({
      by: ['status'],
      where: { tenantId: user.tenantId },
      _count: true,
      _sum: {
        totalAmount: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: transformedOrders,
      pagination: {
        total,
        limit,
        offset: offset ? parseInt(offset, 10) : null,
      },
      stats: {
        totalOrders: total,
        statusDistribution: statusDistribution.map(s => ({
          status: s.status,
          count: s._count,
          totalAmount: s._sum.totalAmount || 0,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching purchase orders:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch purchase orders' } },
      { status: 500 }
    );
  }
}

// POST /api/inventory/purchase-orders - Create a new purchase order
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
    if (!hasPermission(user, 'inventory.create')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to create purchase orders' } },
        { status: 403 }
      );
    }

    const body = await request.json();

    const {
      vendorId,
      orderDate = new Date(),
      expectedDate,
      notes,
      items = [],
    } = body;

    // Validate required fields
    if (!vendorId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Vendor ID is required' } },
        { status: 400 }
      );
    }

    if (!items || items.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'At least one item is required' } },
        { status: 400 }
      );
    }

    // Verify vendor exists and belongs to user's tenant
    const vendor = await db.vendor.findFirst({
      where: { id: vendorId, tenantId: user.tenantId },
    });

    if (!vendor) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_VENDOR', message: 'Vendor not found' } },
        { status: 400 }
      );
    }

    // Verify all stock items exist and belong to user's tenant
    const stockItemIds = items.map((item: { stockItemId: string }) => item.stockItemId);
    const stockItems = await db.stockItem.findMany({
      where: { id: { in: stockItemIds }, tenantId: user.tenantId, deletedAt: null },
    });

    if (stockItems.length !== stockItemIds.length) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_ITEMS', message: 'One or more stock items not found' } },
        { status: 400 }
      );
    }

    // Validate item quantities and prices
    for (const item of items) {
      if (item.quantity <= 0) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Item quantity must be greater than 0' } },
          { status: 400 }
        );
      }
      if (item.unitPrice < 0) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Item unit price cannot be negative' } },
          { status: 400 }
        );
      }
    }

    // Calculate totals
    const itemsWithTotals = items.map((item: { stockItemId: string; quantity: number; unitPrice: number }) => ({
      ...item,
      totalAmount: item.quantity * item.unitPrice,
    }));

    const subtotal = itemsWithTotals.reduce((sum: number, item: { totalAmount: number }) => sum + item.totalAmount, 0);
    const taxes = subtotal * 0.1; // Default 10% tax
    const totalAmount = subtotal + taxes;

    // Generate order number
    const orderNumber = generateOrderNumber();

    const purchaseOrder = await db.purchaseOrder.create({
      data: {
        tenantId: user.tenantId,
        vendorId,
        orderNumber,
        orderDate: new Date(orderDate),
        expectedDate: expectedDate ? new Date(expectedDate) : null,
        subtotal,
        taxes,
        totalAmount,
        status: 'draft',
        notes,
        items: {
          create: itemsWithTotals.map((item: { stockItemId: string; quantity: number; unitPrice: number; totalAmount: number }) => ({
            stockItemId: item.stockItemId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalAmount: item.totalAmount,
          })),
        },
      },
      include: {
        vendor: true,
        items: {
          include: {
            stockItem: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, data: purchaseOrder }, { status: 201 });
  } catch (error) {
    console.error('Error creating purchase order:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create purchase order' } },
      { status: 500 }
    );
  }
}

// PUT /api/inventory/purchase-orders - Update a purchase order
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
    if (!hasPermission(user, 'inventory.update')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to update purchase orders' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, status, approvedBy, items, notes, expectedDate, receivedDate } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Purchase order ID is required' } },
        { status: 400 }
      );
    }

    // Get existing order and verify tenant
    const existingOrder = await db.purchaseOrder.findFirst({
      where: { id, tenantId: user.tenantId },
      include: { items: true },
    });

    if (!existingOrder) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Purchase order not found' } },
        { status: 404 }
      );
    }

    // Status transition validation
    const validTransitions: Record<string, string[]> = {
      draft: ['submitted', 'cancelled'],
      submitted: ['approved', 'cancelled'],
      approved: ['received', 'cancelled'],
      received: [],
      cancelled: [],
    };

    if (status && !validTransitions[existingOrder.status]?.includes(status)) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'INVALID_STATUS_TRANSITION', 
            message: `Cannot transition from ${existingOrder.status} to ${status}` 
          } 
        },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (status) {
      updateData.status = status;
    }

    if (approvedBy && status === 'approved') {
      updateData.approvedBy = approvedBy;
      updateData.approvedAt = new Date();
    }

    if (receivedDate) {
      updateData.receivedDate = new Date(receivedDate);
    }

    if (expectedDate) {
      updateData.expectedDate = new Date(expectedDate);
    }

    if (notes !== undefined) {
      updateData.notes = notes;
    }

    // Update items if provided
    if (items && Array.isArray(items)) {
      // Validate item quantities and prices
      for (const item of items) {
        if (item.quantity <= 0) {
          return NextResponse.json(
            { success: false, error: { code: 'VALIDATION_ERROR', message: 'Item quantity must be greater than 0' } },
            { status: 400 }
          );
        }
        if (item.unitPrice < 0) {
          return NextResponse.json(
            { success: false, error: { code: 'VALIDATION_ERROR', message: 'Item unit price cannot be negative' } },
            { status: 400 }
          );
        }
      }

      // Delete existing items and create new ones
      await db.purchaseOrderItem.deleteMany({
        where: { purchaseOrderId: id },
      });

      const itemsWithTotals = items.map((item: { stockItemId: string; quantity: number; unitPrice: number }) => ({
        ...item,
        totalAmount: item.quantity * item.unitPrice,
      }));

      updateData.items = {
        create: itemsWithTotals.map((item: { stockItemId: string; quantity: number; unitPrice: number; totalAmount: number; receivedQuantity?: number }) => ({
          stockItemId: item.stockItemId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalAmount: item.totalAmount,
          receivedQuantity: item.receivedQuantity,
        })),
      };

      // Recalculate totals
      const subtotal = itemsWithTotals.reduce((sum: number, item: { totalAmount: number }) => sum + item.totalAmount, 0);
      const taxes = subtotal * 0.1;
      updateData.subtotal = subtotal;
      updateData.taxes = taxes;
      updateData.totalAmount = subtotal + taxes;
    }

    const purchaseOrder = await db.purchaseOrder.update({
      where: { id },
      data: updateData,
      include: {
        vendor: true,
        items: {
          include: {
            stockItem: true,
          },
        },
      },
    });

    // If order is received, update stock quantities
    if (status === 'received') {
      const orderItems = purchaseOrder.items;
      await Promise.all(
        orderItems.map(item =>
          db.stockItem.update({
            where: { id: item.stockItemId },
            data: {
              quantity: {
                increment: item.receivedQuantity || item.quantity,
              },
            },
          })
        )
      );

      // Create consumption logs for received items
      await Promise.all(
        orderItems.map(item =>
          db.stockConsumption.create({
            data: {
              stockItemId: item.stockItemId,
              quantity: item.receivedQuantity || item.quantity,
              type: 'added',
              reference: purchaseOrder.orderNumber,
              cost: item.totalAmount,
              notes: `Received from PO ${purchaseOrder.orderNumber}`,
            },
          })
        )
      );
    }

    return NextResponse.json({ success: true, data: purchaseOrder });
  } catch (error) {
    console.error('Error updating purchase order:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update purchase order' } },
      { status: 500 }
    );
  }
}

// DELETE /api/inventory/purchase-orders - Cancel purchase orders
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
    if (!hasPermission(user, 'inventory.delete')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to cancel purchase orders' } },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const ids = searchParams.get('ids')?.split(',');

    if (!ids || ids.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Purchase order IDs are required' } },
        { status: 400 }
      );
    }

    // Check if orders can be cancelled and belong to user's tenant
    const orders = await db.purchaseOrder.findMany({
      where: { id: { in: ids }, tenantId: user.tenantId },
    });

    if (orders.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'No purchase orders found or access denied' } },
        { status: 404 }
      );
    }

    const nonCancellableOrders = orders.filter(
      order => !['draft', 'submitted'].includes(order.status)
    );

    if (nonCancellableOrders.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'CANNOT_CANCEL', 
            message: `Cannot cancel orders in status: ${nonCancellableOrders.map(o => o.status).join(', ')}` 
          } 
        },
        { status: 400 }
      );
    }

    const results = await db.purchaseOrder.updateMany({
      where: {
        id: { in: ids },
        tenantId: user.tenantId,
      },
      data: {
        status: 'cancelled',
      },
    });

    return NextResponse.json({
      success: true,
      message: `Cancelled ${results.count} purchase orders`,
    });
  } catch (error) {
    console.error('Error cancelling purchase orders:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to cancel purchase orders' } },
      { status: 500 }
    );
  }
}
