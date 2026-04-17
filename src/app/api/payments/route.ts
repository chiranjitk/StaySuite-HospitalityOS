import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { paymentRouter, initializePaymentRouter } from '@/lib/payments';
import crypto from 'crypto';
import { PaymentRequest } from '@/lib/payments/types';
import { logPayment } from '@/lib/audit';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

// Helper function to generate transaction ID
function generateTransactionId(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `TXN-${timestamp}-${random}`;
}

// GET /api/payments - List all payments with filtering and pagination
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['payments.view', 'billing.manage', 'admin.*'])) {
      return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const folioId = searchParams.get('folioId');
    const guestId = searchParams.get('guestId');
    const status = searchParams.get('status');
    const method = searchParams.get('method');
    const gateway = searchParams.get('gateway');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const search = searchParams.get('search');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    const where: Record<string, unknown> = {
      tenantId: user.tenantId,
    };

    if (folioId) {
      where.folioId = folioId;
    }

    if (guestId) {
      where.guestId = guestId;
    }

    if (status) {
      where.status = status;
    }

    if (method) {
      where.method = method;
    }

    if (gateway) {
      where.gateway = gateway;
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        (where.createdAt as Record<string, unknown>).gte = new Date(dateFrom);
      }
      if (dateTo) {
        (where.createdAt as Record<string, unknown>).lte = new Date(dateTo);
      }
    }

    if (search) {
      where.OR = [
        { transactionId: { contains: search,  } },
        { reference: { contains: search,  } },
        { gatewayRef: { contains: search,  } },
      ];
    }

    const payments = await db.payment.findMany({
      where,
      include: {
        folio: {
          select: {
            id: true,
            folioNumber: true,
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
        },
        guest: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      ...(limit && { take: parseInt(limit, 10) }),
      ...(offset && { skip: parseInt(offset, 10) }),
    });

    const total = await db.payment.count({ where });

    // Calculate summary statistics
    const summary = await db.payment.aggregate({
      where,
      _sum: {
        amount: true,
        refundAmount: true,
        gatewayFee: true,
      },
      _count: {
        id: true,
      },
    });

    // Get gateway breakdown
    const gatewayBreakdown = await db.payment.groupBy({
      by: ['gateway'],
      where,
      _count: { id: true },
      _sum: { amount: true },
    });

    return NextResponse.json({
      success: true,
      data: payments,
      pagination: {
        total,
        limit: limit ? parseInt(limit, 10) : null,
        offset: offset ? parseInt(offset, 10) : null,
      },
      summary: {
        totalAmount: summary._sum.amount || 0,
        totalRefunded: summary._sum.refundAmount || 0,
        totalGatewayFees: summary._sum.gatewayFee || 0,
        count: summary._count.id,
      },
      gatewayBreakdown: gatewayBreakdown.map(g => ({
        gateway: g.gateway || 'manual',
        count: g._count.id,
        amount: g._sum.amount || 0,
      })),
    });
  } catch (error) {
    console.error('Error fetching payments:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch payments' } },
      { status: 500 }
    );
  }
}

// POST /api/payments - Create a new payment using gateway router
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['payments.manage', 'billing.manage', 'admin.*'])) {
      return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
    }

    const body = await request.json();
    const tenantId = user.tenantId;

    const {
      folioId,
      guestId,
      amount,
      currency = 'USD',
      method,
      gateway: preferredGateway,
      cardData,
      token,
      cardType: inputCardType,
      cardLast4: inputCardLast4,
      cardExpiry,
      reference,
      idempotencyKey,
      description,
    } = body;

    // Validate required fields
    if (!folioId || !amount || !method) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: folioId, amount, method' } },
        { status: 400 }
      );
    }

    // Validate amount
    if (amount <= 0) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_AMOUNT', message: 'Amount must be greater than 0' } },
        { status: 400 }
      );
    }

    // Verify folio exists
    const folio = await db.folio.findUnique({
      where: { id: folioId },
      include: {
        booking: {
          select: {
            id: true,
            confirmationCode: true,
          },
        },
      },
    });

    if (!folio) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_FOLIO', message: 'Folio not found' } },
        { status: 400 }
      );
    }

    // Check for idempotency
    if (idempotencyKey) {
      const existingPayment = await db.payment.findUnique({
        where: { idempotencyKey },
      });

      if (existingPayment) {
        return NextResponse.json({ success: true, data: existingPayment });
      }
    }

    // Initialize payment router
    await initializePaymentRouter(tenantId);

    let paymentResult;
    let gateway = preferredGateway;
    let gatewayRef: string | null = null;
    let gatewayFee: number | null = null;
    let gatewayStatus: string | null = null;
    let retryCount = 0;
    let failoverTo: string | null = null;
    let routingDecision: string | null = null;
    let cardType = inputCardType;
    let cardLast4 = inputCardLast4;

    // Process through gateway router if card payment
    if (method === 'card' && (cardData || token)) {
      const paymentRequest: PaymentRequest = {
        amount,
        currency,
        description: description || `Payment for folio ${folio.folioNumber}`,
        token,
        cardData,
        guestId,
        folioId,
        bookingId: folio.bookingId,
        idempotencyKey,
      };

      // Process payment through router
      paymentResult = await paymentRouter.processPayment(paymentRequest);

      // Extract gateway details
      gateway = paymentResult.success ? paymentResult.metadata?.gateway : undefined;
      gatewayRef = paymentResult.gatewayRef || null;
      gatewayFee = paymentResult.gatewayFee || null;
      gatewayStatus = paymentResult.status;
      
      if (paymentResult.metadata?.attemptCount) {
        retryCount = parseInt(paymentResult.metadata.attemptCount, 10) - 1;
      }
      
      if (paymentResult.metadata?.failoverFrom) {
        failoverTo = paymentResult.metadata.failoverFrom;
      }
      
      if (paymentResult.metadata?.routingDecision) {
        routingDecision = JSON.stringify({
          reason: paymentResult.metadata.routingDecision,
        });
      }

      cardType = paymentResult.cardType || cardType;
      cardLast4 = paymentResult.last4 || cardLast4;

      if (!paymentResult.success) {
        // Record failed payment attempt
        await db.payment.create({
          data: {
            tenantId,
            folioId,
            guestId,
            amount,
            currency,
            method,
            gateway,
            gatewayRef,
            gatewayStatus: 'failed',
            retryCount,
            failoverTo,
            routingDecision,
            cardType,
            cardLast4,
            cardExpiry,
            transactionId: generateTransactionId(),
            reference,
            status: 'failed',
            idempotencyKey,
          },
        });

        return NextResponse.json(
          {
            success: false,
            error: {
              code: paymentResult.errorCode || 'PAYMENT_FAILED',
              message: paymentResult.errorMessage || 'Payment processing failed',
              gateway,
              retryCount,
            },
          },
          { status: 400 }
        );
      }
    } else {
      // Non-card payments (cash, bank_transfer, etc.)
      gateway = method === 'cash' ? 'manual' : gateway;
      gatewayStatus = 'completed';
    }

    // Generate transaction ID
    const transactionId = paymentResult?.transactionId || generateTransactionId();

    // Create payment in a transaction to update folio balance
    const payment = await db.$transaction(async (tx) => {
      const newPayment = await tx.payment.create({
        data: {
          tenantId,
          folioId,
          guestId,
          amount,
          currency,
          method,
          gateway,
          gatewayRef,
          gatewayFee,
          gatewayStatus,
          retryCount,
          failoverTo,
          routingDecision,
          cardType,
          cardLast4,
          cardExpiry,
          transactionId,
          reference,
          status: 'completed',
          processedAt: new Date(),
          idempotencyKey,
        },
        include: {
          folio: {
            select: {
              id: true,
              folioNumber: true,
            },
          },
          guest: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      // Update folio paid amount and balance
      const updatedFolio = await tx.folio.update({
        where: { id: folioId },
        data: {
          paidAmount: { increment: amount },
          balance: { decrement: amount },
        },
      });

      // Update folio status if fully paid
      if (updatedFolio.balance <= 0) {
        await tx.folio.update({
          where: { id: folioId },
          data: {
            status: 'paid',
            closedAt: new Date(),
          },
        });
      } else if (updatedFolio.paidAmount > 0) {
        await tx.folio.update({
          where: { id: folioId },
          data: { status: 'partially_paid' },
        });
      }

      // Update gateway statistics if used
      if (gateway && gateway !== 'manual') {
        await tx.paymentGateway.updateMany({
          where: {
            tenantId,
            provider: gateway,
          },
          data: {
            totalTransactions: { increment: 1 },
            totalVolume: { increment: amount },
            lastSyncAt: new Date(),
          },
        });
      }

      return newPayment;
    });

    // Log payment to audit log
    try {
      await logPayment(request, 'payment', payment.id, {
        amount,
        currency,
        method,
        gateway,
        transactionId,
        folioNumber: payment.folio?.folioNumber,
        guestName: payment.guest ? `${payment.guest.firstName} ${payment.guest.lastName}` : undefined,
      }, { tenantId: user.tenantId, userId: user.id });
    } catch (auditError) {
      console.error('Audit log failed (non-blocking):', auditError);
    }

    return NextResponse.json({ 
      success: true, 
      data: payment,
      gatewayDetails: {
        gateway,
        gatewayRef,
        gatewayFee,
        retryCount,
        routingDecision: routingDecision ? JSON.parse(routingDecision) : null,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating payment:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create payment' } },
      { status: 500 }
    );
  }
}
