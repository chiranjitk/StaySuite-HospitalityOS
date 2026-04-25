import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// POST /api/orders/[id]/post-to-folio - Post order charges to a folio
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

  // Permission check for folio operations
  if (!hasPermission(user, 'billing.write')) {
    return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Permission denied' } }, { status: 403 });
  }


  try {
    const { id: orderId } = await params;
    const body = await request.json();
    const { folioId, bookingId, chargeToRoom } = body;

    // Get the order with items
    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
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
        property: {
          select: {
            id: true,
            name: true,
            currency: true,
            taxType: true,
            defaultTaxRate: true,
            taxComponents: true,
            serviceChargePercent: true,
            includeTaxInPrice: true,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } },
        { status: 404 }
      );
    }

    if (order.status === 'cancelled') {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_STATUS', message: 'Cannot post cancelled order to folio' } },
        { status: 400 }
      );
    }

    // Check if already posted
    if (order.folioId) {
      return NextResponse.json(
        { success: false, error: { code: 'ALREADY_POSTED', message: 'Order already posted to folio' } },
        { status: 400 }
      );
    }

    let targetFolioId = folioId;

    // If bookingId is provided but no folioId, find or create folio for the booking
    if (!targetFolioId && bookingId) {
      const booking = await db.booking.findUnique({
        where: { id: bookingId },
        include: {
          folios: {
            where: { status: { in: ['open', 'partially_paid'] } },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });

      if (!booking) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Booking not found' } },
          { status: 404 }
        );
      }

      if (booking.folios.length > 0) {
        targetFolioId = booking.folios[0].id;
      } else {
        // Create a new folio for the booking
        const newFolio = await db.folio.create({
          data: {
            tenantId: order.tenantId,
            propertyId: booking.propertyId,
            bookingId,
            guestId: booking.primaryGuestId,
            folioNumber: `FOL-${Date.now().toString(36).toUpperCase()}`,
            status: 'open',
            subtotal: 0,
            taxes: 0,
            totalAmount: 0,
            paidAmount: 0,
            balance: 0,
          },
        });
        targetFolioId = newFolio.id;
      }
    }

    if (!targetFolioId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Either folioId or bookingId is required' } },
        { status: 400 }
      );
    }

    // Get the target folio
    const folio = await db.folio.findUnique({
      where: { id: targetFolioId },
      include: {
        booking: {
          select: {
            id: true,
            roomId: true,
            room: {
              select: { number: true },
            },
          },
        },
      },
    });

    if (!folio) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Folio not found' } },
        { status: 404 }
      );
    }

    // Determine tax rate from property settings
    const property = order.property;
    let taxRate = 0;
    if (property) {
      // Check taxComponents first (JSON array of {name, rate, type})
      try {
        const taxComponents = JSON.parse(property.taxComponents || '[]');
        if (Array.isArray(taxComponents) && taxComponents.length > 0) {
          taxRate = taxComponents.reduce((sum: number, tc: { rate: number }) => sum + (tc.rate || 0), 0) / 100;
        } else {
          taxRate = (property.defaultTaxRate || 0) / 100;
        }
      } catch {
        taxRate = (property.defaultTaxRate || 0) / 100;
      }
    }

    // Create folio line items for each order item
    const result = await db.$transaction(async (tx) => {
      // Create line items for each order item
      const lineItemsData = order.items.map((item) => ({
        tenantId: order.tenantId,
        folioId: targetFolioId,
        description: `${item.menuItem.name}${item.notes ? ` (${item.notes})` : ''}`,
        category: 'restaurant',
        subcategory: order.orderType,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalAmount: item.totalAmount,
        taxAmount: Math.round(item.totalAmount * taxRate * 100) / 100,
        serviceDate: order.createdAt,
        referenceType: 'order_item',
        referenceId: item.id,
        postedBy: 'system',
      }));

      await tx.folioLineItem.createMany({ data: lineItemsData });

      // Update folio totals
      const existingLineItems = await tx.folioLineItem.findMany({
        where: { folioId: targetFolioId },
      });

      const newSubtotal = existingLineItems.reduce((sum, item) => sum + item.totalAmount, 0);
      const newTaxes = existingLineItems.reduce((sum, item) => sum + item.taxAmount, 0);
      const newTotal = newSubtotal + newTaxes - (folio.discount || 0);

      await tx.folio.update({
        where: { id: targetFolioId },
        data: {
          subtotal: newSubtotal,
          taxes: newTaxes,
          totalAmount: newTotal,
          balance: newTotal - folio.paidAmount,
        },
      });

      // Link order to folio
      await tx.order.update({
        where: { id: orderId },
        data: {
          folioId: targetFolioId,
          bookingId: folio.bookingId,
        },
      });

      // Create audit log
      await tx.bookingAuditLog.create({
        data: {
          bookingId: folio.bookingId,
          action: 'charge_added',
          notes: JSON.stringify({
            orderId,
            folioId: targetFolioId,
            amount: order.totalAmount,
            description: `Restaurant order ${order.orderNumber} posted to folio`,
          }),
          performedBy: 'system',
        },
      });

      return { folioId: targetFolioId, lineItemCount: lineItemsData.length };
    });

    // Fetch updated folio
    const updatedFolio = await db.folio.findUnique({
      where: { id: targetFolioId },
      include: {
        lineItems: {
          orderBy: { serviceDate: 'desc' },
        },
        booking: {
          select: {
            id: true,
            confirmationCode: true,
            primaryGuest: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        order: { id: orderId, folioId: targetFolioId },
        folio: updatedFolio,
        postedItems: result.lineItemCount,
      },
      message: `Order charges posted to folio successfully`,
    });
  } catch (error) {
    console.error('Error posting order to folio:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to post order to folio' } },
      { status: 500 }
    );
  }
}

// DELETE /api/orders/[id]/post-to-folio - Remove order charges from folio
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

  // Permission check for folio operations
  if (!hasPermission(user, 'billing.write')) {
    return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Permission denied' } }, { status: 403 });
  }


  try {
    const { id: orderId } = await params;

    const order = await db.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
      },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } },
        { status: 404 }
      );
    }

    if (!order.folioId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_POSTED', message: 'Order is not posted to any folio' } },
        { status: 400 }
      );
    }

    const folioId = order.folioId;

    // Remove line items and update folio
    await db.$transaction(async (tx) => {
      // Remove line items for this order
      await tx.folioLineItem.deleteMany({
        where: {
          folioId,
          referenceType: 'order_item',
          referenceId: { in: order.items.map((item) => item.id) },
        },
      });

      // Unlink order from folio
      await tx.order.update({
        where: { id: orderId },
        data: {
          folioId: null,
        },
      });

      // Recalculate folio totals
      const remainingLineItems = await tx.folioLineItem.findMany({
        where: { folioId },
      });

      const newSubtotal = remainingLineItems.reduce((sum, item) => sum + item.totalAmount, 0);
      const newTaxes = remainingLineItems.reduce((sum, item) => sum + item.taxAmount, 0);
      const folio = await tx.folio.findUnique({ where: { id: folioId } });

      if (folio) {
        const newTotal = newSubtotal + newTaxes - (folio.discount || 0);

        await tx.folio.update({
          where: { id: folioId },
          data: {
            subtotal: newSubtotal,
            taxes: newTaxes,
            totalAmount: newTotal,
            balance: newTotal - folio.paidAmount,
          },
        });
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Order charges removed from folio',
    });
  } catch (error) {
    console.error('Error removing order from folio:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to remove order from folio' } },
      { status: 500 }
    );
  }
}
