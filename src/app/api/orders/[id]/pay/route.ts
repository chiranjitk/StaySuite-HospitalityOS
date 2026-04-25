import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';
import crypto from 'crypto';

// POST /api/orders/[id]/pay - Process payment for a restaurant order
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission(request, 'restaurant.write');
    if (auth instanceof NextResponse) return auth;

    const { id: orderId } = await params;
    const body = await request.json();
    const {
      paymentMethod = 'cash',
      tipAmount = 0,
      splitCount,
      cardType,
      cardLast4,
    } = body;

    // Verify the order exists and belongs to the tenant
    const order = await db.order.findFirst({
      where: { id: orderId, tenantId: auth.tenantId },
      include: {
        property: {
          select: { id: true, currency: true },
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } },
        { status: 404 }
      );
    }

    // Only allow payment for served or ready orders
    if (!['served', 'ready'].includes(order.status)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_STATUS', message: `Cannot pay for order with status: ${order.status}` } },
        { status: 400 }
      );
    }

    const currency = order.property?.currency || 'USD';
    const paymentAmount = order.totalAmount + (tipAmount || 0);

    // Create or find a Folio for this order
    let folioId = order.folioId;

    if (!folioId) {
      const folio = await db.folio.create({
        data: {
          tenantId: auth.tenantId,
          propertyId: order.propertyId,
          bookingId: order.bookingId || undefined,
          guestId: order.guestId || undefined,
          folioNumber: `FOL-ORD-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`,
          currency,
          subtotal: order.subtotal,
          taxes: order.taxes,
          discount: order.discount,
          totalAmount: paymentAmount,
          balance: paymentAmount,
          status: 'open',
        },
      });
      folioId = folio.id;

      // Link the folio to the order
      await db.order.update({
        where: { id: orderId },
        data: { folioId },
      });
    }

    // Create folio line items for the order items if not already posted
    const existingLineItems = await db.folioLineItem.count({
      where: { folioId, reference: `order-${orderId}` },
    });

    if (existingLineItems === 0) {
      // Create a single line item for the order
      await db.folioLineItem.create({
        data: {
          folioId,
          description: `Restaurant Order ${order.orderNumber}`,
          category: 'restaurant',
          quantity: 1,
          unitPrice: order.subtotal,
          totalAmount: order.subtotal,
          taxRate: order.subtotal > 0 ? (order.taxes / order.subtotal) * 100 : 0,
          taxAmount: order.taxes,
          reference: `order-${orderId}`,
          serviceDate: new Date(),
        },
      });
    }

    // Create tip line item if applicable
    if (tipAmount && tipAmount > 0) {
      await db.folioLineItem.create({
        data: {
          folioId,
          description: `Tip for Order ${order.orderNumber}`,
          category: 'tip',
          quantity: 1,
          unitPrice: tipAmount,
          totalAmount: tipAmount,
          taxRate: 0,
          taxAmount: 0,
          reference: `tip-order-${orderId}`,
          serviceDate: new Date(),
        },
      });
    }

    // Create payment records
    const paymentsToCreate = [];
    if (splitCount && splitCount > 1) {
      // Split payment: first N-1 pay floor share, last pays remainder
      const floorShare = Math.floor((paymentAmount / splitCount) * 100) / 100;
      const lastShare = Math.round((paymentAmount - floorShare * (splitCount - 1)) * 100) / 100;

      for (let i = 0; i < splitCount; i++) {
        paymentsToCreate.push({
          folioId,
          tenantId: auth.tenantId,
          amount: i < splitCount - 1 ? floorShare : lastShare,
          currency,
          method: paymentMethod,
          gateway: paymentMethod === 'card' ? 'manual_pos' : 'cash',
          cardType,
          cardLast4,
          status: 'completed',
          processedAt: new Date(),
          reference: `split-${i + 1}-of-${splitCount}-order-${orderId}`,
          guestId: order.guestId || undefined,
          idempotencyKey: crypto.randomUUID(),
        });
      }
    } else {
      paymentsToCreate.push({
        folioId,
        tenantId: auth.tenantId,
        amount: paymentAmount,
        currency,
        method: paymentMethod,
        gateway: paymentMethod === 'card' ? 'manual_pos' : paymentMethod === 'room_charge' ? 'room_folio' : 'cash',
        cardType,
        cardLast4,
        status: 'completed',
        processedAt: new Date(),
        reference: `order-${orderId}`,
        guestId: order.guestId || undefined,
        idempotencyKey: crypto.randomUUID(),
      });
    }

    await db.payment.createMany({ data: paymentsToCreate });

    // Update folio totals
    const allPayments = await db.payment.findMany({
      where: { folioId, status: 'completed' },
      _sum: { amount: true },
    });
    const totalPaid = allPayments._sum.amount || 0;

    await db.folio.update({
      where: { id: folioId },
      data: {
        paidAmount: totalPaid,
        balance: paymentAmount - totalPaid,
        status: totalPaid >= paymentAmount ? 'closed' : 'open',
        closedAt: totalPaid >= paymentAmount ? new Date() : undefined,
      },
    });

    // Update order status to 'paid'
    const updatedOrder = await db.order.update({
      where: { id: orderId },
      data: {
        status: 'paid',
        completedAt: new Date(),
      },
      include: {
        table: true,
        items: {
          include: {
            menuItem: {
              select: { id: true, name: true, price: true },
            },
          },
        },
      },
    });

    // Update table status if applicable
    if (updatedOrder.tableId) {
      await db.restaurantTable.update({
        where: { id: updatedOrder.tableId },
        data: { status: 'available' },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        order: updatedOrder,
        payment: {
          amount: paymentAmount,
          method: paymentMethod,
          splitCount: splitCount || 1,
          currency,
        },
      },
    });
  } catch (error) {
    console.error('Error processing order payment:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to process payment' } },
      { status: 500 }
    );
  }
}
