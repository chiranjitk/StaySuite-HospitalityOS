import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import crypto from 'crypto';

// Helper function to generate order number
function generateOrderNumber(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(2).toString('hex').toUpperCase().slice(0, 3);
  return `ORD-${timestamp}-${random}`;
}

// GET /api/orders - List all orders with filtering and pagination
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
    if (!hasPermission(user, 'restaurant.read') && !hasPermission(user, 'restaurant.*')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');
    const tableId = searchParams.get('tableId');
    const status = searchParams.get('status');
    const kitchenStatus = searchParams.get('kitchenStatus');
    const orderType = searchParams.get('orderType');
    const search = searchParams.get('search');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 100);
    const offset = searchParams.get('offset');
    const stats = searchParams.get('stats');

    const where: Record<string, unknown> = { tenantId: user.tenantId };

    // Property scoping
    if (propertyId) {
      // Verify property belongs to user's tenant
      const property = await db.property.findFirst({
        where: { id: propertyId, tenantId: user.tenantId, deletedAt: null },
        select: { id: true },
      });
      if (!property) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_PROPERTY', message: 'Property not found' } },
          { status: 400 }
        );
      }
      where.propertyId = propertyId;
    }

    if (tableId) {
      where.tableId = tableId;
    }

    if (status) {
      const statuses = status.split(',').map((s: string) => s.trim()).filter(Boolean);
      if (statuses.length === 1) {
        where.status = statuses[0];
      } else if (statuses.length > 1) {
        where.status = { in: statuses };
      }
    }

    if (kitchenStatus) {
      const kitchenStatuses = kitchenStatus.split(',').map((s: string) => s.trim()).filter(Boolean);
      if (kitchenStatuses.length === 1) {
        where.kitchenStatus = kitchenStatuses[0];
      } else if (kitchenStatuses.length > 1) {
        where.kitchenStatus = { in: kitchenStatuses };
      }
    }

    if (orderType) {
      where.orderType = orderType;
    }

    if (search) {
      where.OR = [
        { orderNumber: { contains: search } },
        { guestName: { contains: search } },
      ];
    }

    // If stats flag is set, return summary statistics
    if (stats === 'true') {
      const statusCounts = await db.order.groupBy({
        by: ['status'],
        where,
        _count: { id: true },
      });

      const kitchenStatusCounts = await db.order.groupBy({
        by: ['kitchenStatus'],
        where,
        _count: { id: true },
      });

      const totalRevenue = await db.order.aggregate({
        where: { ...where, status: { notIn: ['cancelled'] } },
        _sum: { totalAmount: true },
      });

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const todayOrders = await db.order.count({
        where: {
          ...where,
          createdAt: { gte: todayStart },
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          statusCounts: statusCounts.reduce((acc, item) => {
            acc[item.status] = item._count.id;
            return acc;
          }, {} as Record<string, number>),
          kitchenStatusCounts: kitchenStatusCounts.reduce((acc, item) => {
            acc[item.kitchenStatus] = item._count.id;
            return acc;
          }, {} as Record<string, number>),
          totalRevenue: totalRevenue._sum.totalAmount || 0,
          todayOrders,
        },
      });
    }

    const orders = await db.order.findMany({
      where,
      include: {
        table: {
          select: {
            id: true,
            number: true,
            name: true,
            area: true,
          },
        },
        items: {
          include: {
            menuItem: {
              select: {
                id: true,
                name: true,
                price: true,
                imageUrl: true,
                preparationTime: true,
                kitchenStation: true,
              },
            },
          },
        },
        _count: {
          select: { items: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      ...(offset && { skip: parseInt(offset, 10) }),
    });

    const total = await db.order.count({ where });

    return NextResponse.json({
      success: true,
      data: orders,
      pagination: {
        total,
        limit,
        offset: offset ? parseInt(offset, 10) : null,
      },
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch orders' } },
      { status: 500 }
    );
  }
}

// POST /api/orders - Create a new order
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
    if (!hasPermission(user, 'restaurant.write') && !hasPermission(user, 'restaurant.*')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();

    const {
      propertyId,
      tableId,
      guestId,
      bookingId,
      guestName,
      orderType = 'dine_in',
      notes,
      specialInstructions,
      items,
    } = body;

    // Validate required fields
    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Property ID is required' } },
        { status: 400 }
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Order must have at least one item' } },
        { status: 400 }
      );
    }

    // Verify property belongs to user's tenant
    const property = await db.property.findFirst({
      where: { id: propertyId, tenantId: user.tenantId, deletedAt: null },
      select: { id: true, defaultTaxRate: true, taxComponents: true, serviceChargePercent: true },
    });

    if (!property) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PROPERTY', message: 'Property not found' } },
        { status: 400 }
      );
    }

    // If table is specified, verify it belongs to the property
    if (tableId) {
      const table = await db.restaurantTable.findFirst({
        where: { id: tableId, propertyId },
      });

      if (!table) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_TABLE', message: 'Table not found' } },
          { status: 400 }
        );
      }
    }

    // Get menu items to calculate totals
    const menuItemIds = items.map((item: { menuItemId: string }) => item.menuItemId);
    const menuItems = await db.menuItem.findMany({
      where: { id: { in: menuItemIds }, propertyId, deletedAt: null },
    });

    // Validate all menu items exist and are available
    for (const item of items) {
      const menuItem = menuItems.find(m => m.id === item.menuItemId);
      if (!menuItem) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_MENU_ITEM', message: `Menu item not found: ${item.menuItemId}` } },
          { status: 400 }
        );
      }
      if (!menuItem.isAvailable) {
        return NextResponse.json(
          { success: false, error: { code: 'ITEM_UNAVAILABLE', message: `Menu item is not available: ${menuItem.name}` } },
          { status: 400 }
        );
      }
    }

    // Calculate subtotal and build order items data
    let subtotal = 0;
    const orderItemsData = items.map((item: { menuItemId: string; quantity?: number; notes?: string; options?: string }) => {
      const menuItem = menuItems.find(m => m.id === item.menuItemId)!;
      const quantity = item.quantity || 1;
      const unitPrice = menuItem.price;
      const totalAmount = unitPrice * quantity;
      subtotal += totalAmount;

      return {
        menuItemId: item.menuItemId,
        quantity,
        unitPrice,
        totalAmount,
        notes: item.notes,
        options: item.options,
        status: 'pending',
      };
    });

    // Calculate taxes from property settings
    let taxes = 0;
    
    // Check if property has tax components (multiple taxes)
    if (property.taxComponents) {
      try {
        const taxComponents = JSON.parse(property.taxComponents);
        for (const component of taxComponents) {
          taxes += subtotal * (component.rate / 100);
        }
      } catch {
        // Fallback to default tax rate
        const taxRate = property.defaultTaxRate || 0;
        taxes = subtotal * (taxRate / 100);
      }
    } else {
      // Use default tax rate
      const taxRate = property.defaultTaxRate || 0;
      taxes = subtotal * (taxRate / 100);
    }

    // Add service charge if configured
    let serviceCharge = 0;
    if (property.serviceChargePercent) {
      serviceCharge = subtotal * (property.serviceChargePercent / 100);
    }

    const totalAmount = subtotal + taxes + serviceCharge;

    // Generate order number
    const orderNumber = generateOrderNumber();

    // Create order with items in a transaction
    const order = await db.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          tenantId: user.tenantId,
          propertyId,
          tableId,
          guestId,
          bookingId,
          guestName,
          orderType,
          orderNumber,
          subtotal,
          taxes,
          totalAmount,
          notes,
          specialInstructions,
          status: 'pending',
          kitchenStatus: 'pending',
        },
      });

      // Create order items
      await tx.orderItem.createMany({
        data: orderItemsData.map(item => ({
          ...item,
          orderId: newOrder.id,
        })),
      });

      // Update table status if it's a dine-in order
      if (tableId && orderType === 'dine_in') {
        await tx.restaurantTable.update({
          where: { id: tableId },
          data: { status: 'occupied' },
        });
      }

      return newOrder;
    });

    // Fetch the complete order with items
    const completeOrder = await db.order.findUnique({
      where: { id: order.id },
      include: {
        table: true,
        items: {
          include: {
            menuItem: {
              select: {
                id: true,
                name: true,
                price: true,
                imageUrl: true,
              },
            },
          },
        },
      },
    });

    if (!completeOrder) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    // Notify realtime service via WebSocket
    fetch(`/?XTransformPort=3003`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'kitchen:order',
        data: {
          orderId: completeOrder.id,
          propertyId,
          orderNumber,
          kitchenStatus: 'pending',
          status: 'pending',
          items: completeOrder.items?.map((item: { id: string; menuItemId: string; quantity: number; menuItem?: { name: string } }) => ({
            id: item.id,
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            name: item.menuItem?.name,
          })),
        },
      }),
    }).catch(() => {});

    return NextResponse.json({ success: true, data: completeOrder }, { status: 201 });
  } catch (error) {
    console.error('Error creating order:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create order' } },
      { status: 500 }
    );
  }
}

// PUT /api/orders - Update order status
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
    if (!hasPermission(user, 'restaurant.write') && !hasPermission(user, 'restaurant.*')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, status, kitchenStatus, notes } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Order ID is required' } },
        { status: 400 }
      );
    }

    // Verify order exists and belongs to user's tenant
    const existingOrder = await db.order.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existingOrder) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } },
        { status: 404 }
      );
    }

    // Validate status transitions
    const validStatusTransitions: Record<string, string[]> = {
      pending: ['confirmed', 'preparing', 'cancelled'],
      confirmed: ['preparing', 'cancelled'],
      preparing: ['ready', 'cancelled'],
      ready: ['served', 'cancelled'],
      served: [],
      cancelled: [],
    };

    if (status && !validStatusTransitions[existingOrder.status]?.includes(status)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_STATUS_TRANSITION', message: `Cannot transition from ${existingOrder.status} to ${status}` } },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (status) {
      updateData.status = status;

      // Set timestamps based on status
      if (status === 'confirmed') {
        updateData.confirmedAt = new Date();
      } else if (status === 'served') {
        updateData.completedAt = new Date();
      } else if (status === 'cancelled') {
        updateData.cancelledAt = new Date();
      }
    }

    if (kitchenStatus) {
      updateData.kitchenStatus = kitchenStatus;

      if (kitchenStatus === 'cooking') {
        updateData.kitchenStartedAt = new Date();
      } else if (kitchenStatus === 'ready') {
        updateData.kitchenCompletedAt = new Date();
      } else if (kitchenStatus === 'completed') {
        updateData.kitchenCompletedAt = updateData.kitchenCompletedAt || new Date();
        updateData.status = 'served';
        updateData.completedAt = new Date();
      }
    }

    if (notes !== undefined) {
      updateData.notes = notes;
    }

    const order = await db.order.update({
      where: { id },
      data: updateData,
      include: {
        table: true,
        items: {
          include: {
            menuItem: {
              select: {
                id: true,
                name: true,
                price: true,
              },
            },
          },
        },
      },
    });

    // If order is served or cancelled, update table status
    if ((status === 'served' || status === 'cancelled') && order.tableId) {
      await db.restaurantTable.update({
        where: { id: order.tableId },
        data: { status: status === 'served' ? 'cleaning' : 'available' },
      });
    }

    // Notify realtime service via WebSocket
    fetch(`/?XTransformPort=3003`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'kitchen:order',
        data: {
          orderId: order.id,
          propertyId: order.propertyId,
          orderNumber: order.orderNumber,
          kitchenStatus: order.kitchenStatus,
          status: order.status,
          items: order.items?.map((item: { id: string; menuItemId: string; quantity: number; menuItem?: { name: string } }) => ({
            id: item.id,
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            name: item.menuItem?.name,
          })),
        },
      }),
    }).catch(() => {});

    return NextResponse.json({ success: true, data: order });
  } catch (error) {
    console.error('Error updating order:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update order' } },
      { status: 500 }
    );
  }
}

// DELETE /api/orders - Cancel an order
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
    if (!hasPermission(user, 'restaurant.write') && !hasPermission(user, 'restaurant.*')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Order ID is required' } },
        { status: 400 }
      );
    }

    // Verify order exists and belongs to user's tenant
    const existingOrder = await db.order.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existingOrder) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } },
        { status: 404 }
      );
    }

    // Can only cancel orders that are not already served or cancelled
    if (['served', 'cancelled'].includes(existingOrder.status)) {
      return NextResponse.json(
        { success: false, error: { code: 'CANNOT_CANCEL', message: 'Cannot cancel an order that is already served or cancelled' } },
        { status: 400 }
      );
    }

    const order = await db.order.update({
      where: { id },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
      },
    });

    // Update table status if applicable
    if (order.tableId) {
      await db.restaurantTable.update({
        where: { id: order.tableId },
        data: { status: 'available' },
      });
    }

    return NextResponse.json({ success: true, data: order });
  } catch (error) {
    console.error('Error cancelling order:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to cancel order' } },
      { status: 500 }
    );
  }
}
