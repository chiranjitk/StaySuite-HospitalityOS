import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createStripeGateway } from '@/lib/payments/gateways/stripe';
import { createPayPalGateway } from '@/lib/payments/gateways/paypal';
import { createManualGateway } from '@/lib/payments/gateways/manual';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

// GET /api/payments/[id] - Get a single payment
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }
  if (!hasAnyPermission(user, ['payments.manage', 'billing.manage', 'admin.*'])) {
    return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
  }

  try {
    const { id } = await params;

    const payment = await db.payment.findUnique({
      where: { id },
      include: {
        folio: {
          select: {
            id: true,
            folioNumber: true,
            totalAmount: true,
            paidAmount: true,
            balance: true,
            status: true,
            booking: {
              select: {
                id: true,
                confirmationCode: true,
                checkIn: true,
                checkOut: true,
                primaryGuest: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    phone: true,
                  },
                },
              },
            },
          },
        },
        guest: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    if (!payment) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Payment not found' } },
        { status: 404 }
      );
    }

    if (payment.tenantId !== user.tenantId) {
      return NextResponse.json({ success: false, error: 'Payment not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: payment,
    });
  } catch (error) {
    console.error('Error fetching payment:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch payment' } },
      { status: 500 }
    );
  }
}

// PUT /api/payments/[id] - Update a payment (mainly for refunds)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }
  if (!hasAnyPermission(user, ['payments.manage', 'billing.manage', 'admin.*'])) {
    return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();

    const existingPayment = await db.payment.findUnique({
      where: { id },
      include: {
        folio: {
          select: {
            id: true,
            folioNumber: true,
            totalAmount: true,
            paidAmount: true,
            balance: true,
          },
        },
      },
    });

    if (!existingPayment) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Payment not found' } },
        { status: 404 }
      );
    }

    if (existingPayment.tenantId !== user.tenantId) {
      return NextResponse.json({ success: false, error: 'Payment not found' }, { status: 404 });
    }

    const {
      status,
      refundAmount,
      refundReason,
      transactionId,
      reference,
    } = body;

    // Handle refund
    if (refundAmount && refundAmount > 0) {
      if (existingPayment.status === 'refunded') {
        return NextResponse.json(
          { success: false, error: { code: 'ALREADY_REFUNDED', message: 'Payment has already been fully refunded' } },
          { status: 400 }
        );
      }

      const totalRefunded = (existingPayment.refundAmount || 0) + refundAmount;
      if (totalRefunded > existingPayment.amount) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_REFUND', message: 'Refund amount exceeds payment amount' } },
          { status: 400 }
        );
      }

      const newStatus = totalRefunded >= existingPayment.amount ? 'refunded' : 'partially_refunded';

      // Call gateway refund API if payment was made through a gateway
      let gatewayRefundResult: { refundId?: string } | null = null;
      if (existingPayment.gateway && existingPayment.gatewayRef) {
        try {
          gatewayRefundResult = await processGatewayRefund({
            gateway: existingPayment.gateway,
            gatewayRef: existingPayment.gatewayRef,
            amount: refundAmount,
            reason: refundReason,
            transactionId: existingPayment.transactionId || undefined,
          });
        } catch (gatewayError) {
          console.error(`[Payment Refund] Gateway refund failed:`, gatewayError);
        }
      }

      // Process refund in a transaction
      const payment = await db.$transaction(async (tx) => {
        const updatedPayment = await tx.payment.update({
          where: { id },
          data: {
            refundAmount: totalRefunded,
            refundedAt: new Date(),
            refundReason: refundReason || 'Refund processed',
            status: newStatus,
            reference: gatewayRefundResult?.refundId
              ? `Gateway Refund: ${gatewayRefundResult.refundId}`
              : existingPayment.reference,
          },
          include: {
            folio: {
              select: { id: true, folioNumber: true },
            },
          },
        });

        await tx.folio.update({
          where: { id: existingPayment.folioId },
          data: {
            paidAmount: { decrement: refundAmount },
            balance: { increment: refundAmount },
            status: 'partially_paid',
          },
        });

        await tx.auditLog.create({
          data: {
            tenantId: existingPayment.tenantId,
            module: 'payments',
            action: 'refund',
            entityType: 'payment',
            entityId: id,
            newValue: JSON.stringify({
              refundAmount,
              totalRefunded,
              newStatus,
              gatewayRefundId: gatewayRefundResult?.refundId,
              reason: refundReason,
            }),
          },
        });

        return updatedPayment;
      });

      return NextResponse.json({
        success: true,
        data: {
          ...payment,
          gatewayRefund: gatewayRefundResult,
        },
      });
    }

    // Regular update
    const payment = await db.payment.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(transactionId !== undefined && { transactionId }),
        ...(reference !== undefined && { reference }),
      },
      include: {
        folio: { select: { id: true, folioNumber: true } },
        guest: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return NextResponse.json({ success: true, data: payment });
  } catch (error) {
    console.error('Error updating payment:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update payment' } },
      { status: 500 }
    );
  }
}

// DELETE /api/payments/[id] - Void a payment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }
  if (!hasAnyPermission(user, ['payments.manage', 'billing.manage', 'admin.*'])) {
    return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
  }

  try {
    const { id } = await params;

    const existingPayment = await db.payment.findUnique({ where: { id } });

    if (!existingPayment) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Payment not found' } },
        { status: 404 }
      );
    }

    if (existingPayment.tenantId !== user.tenantId) {
      return NextResponse.json({ success: false, error: 'Payment not found' }, { status: 404 });
    }

    if (!['pending', 'failed'].includes(existingPayment.status)) {
      return NextResponse.json(
        { success: false, error: { code: 'CANNOT_VOID', message: 'Can only void pending or failed payments' } },
        { status: 400 }
      );
    }

    const payment = await db.payment.update({
      where: { id },
      data: { status: 'failed' },
    });

    return NextResponse.json({
      success: true,
      data: payment,
      message: 'Payment voided successfully',
    });
  } catch (error) {
    console.error('Error voiding payment:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to void payment' } },
      { status: 500 }
    );
  }
}

async function processGatewayRefund(params: {
  gateway: string;
  gatewayRef: string;
  amount: number;
  reason?: string;
  transactionId?: string;
}): Promise<{ success: boolean; refundId?: string; amount?: number; status?: string; error?: string }> {
  const { gateway, gatewayRef, amount, reason, transactionId } = params;

  try {
    const gatewayConfig = await db.paymentGateway.findFirst({
      where: { provider: gateway, status: 'active' },
    });

    switch (gateway.toLowerCase()) {
      case 'stripe': {
        const stripeGateway = createStripeGateway({
          id: gatewayConfig?.id,
          apiKey: gatewayConfig?.apiKey || process.env.STRIPE_SECRET_KEY || '',
          webhookSecret: gatewayConfig?.webhookSecret ?? undefined,
          feePercentage: gatewayConfig?.feePercentage,
          feeFixed: gatewayConfig?.feeFixed,
        });
        const result = await stripeGateway.refundPayment({
          transactionId: transactionId || '',
          gatewayRef,
          amount,
          reason: reason || 'requested_by_customer',
        });
        return { success: result.success, refundId: result.refundId, amount: result.amount, status: result.status, error: result.errorMessage };
      }
      case 'paypal': {
        const paypalGateway = createPayPalGateway({
          id: gatewayConfig?.id,
          apiKey: gatewayConfig?.apiKey || process.env.PAYPAL_CLIENT_ID || '',
          secretKey: gatewayConfig?.secretKey || process.env.PAYPAL_CLIENT_SECRET || '',
          feePercentage: gatewayConfig?.feePercentage,
          feeFixed: gatewayConfig?.feeFixed,
        });
        const result = await paypalGateway.refundPayment({ transactionId: transactionId || '', gatewayRef, amount, reason });
        return { success: result.success, refundId: result.refundId, amount: result.amount, status: result.status, error: result.errorMessage };
      }
      case 'manual': {
        const manualGateway = createManualGateway({ id: gatewayConfig?.id || 'manual-default' });
        const result = await manualGateway.refundPayment({ transactionId: transactionId || '', gatewayRef, amount, reason });
        return { success: result.success, refundId: result.refundId, amount: result.amount, status: result.status, error: result.errorMessage };
      }
      default:
        return { success: false, error: `Unknown gateway: ${gateway}` };
    }
  } catch (error) {
    return { success: false, error: 'Gateway refund processing failed' };
  }
}
