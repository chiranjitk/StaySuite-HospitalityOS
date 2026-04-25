/**
 * PayPal Webhook Handler
 *
 * Handles incoming webhooks from PayPal for payment events.
 * Events handled: PAYMENT.CAPTURE.COMPLETED, PAYMENT.CAPTURE.DENIED, PAYMENT.CAPTURE.REFUNDED
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';

// PayPal webhook event types we handle
type PayPalEventType =
  | 'PAYMENT.CAPTURE.COMPLETED'
  | 'PAYMENT.CAPTURE.DENIED'
  | 'PAYMENT.CAPTURE.REFUNDED'
  | 'PAYMENT.CAPTURE.PENDING'
  | 'PAYMENT.AUTHORIZATION.CREATED'
  | 'PAYMENT.AUTHORIZATION.VOIDED'
  | 'CHECKOUT.ORDER.APPROVED'
  | 'CHECKOUT.ORDER.COMPLETED';

interface PayPalWebhookEvent {
  id: string;
  event_version: string;
  event_type: PayPalEventType;
  create_time: string;
  resource: {
    id: string;
    status: string;
    amount?: { value: string; currency_code: string };
    custom_id?: string;
    invoice_id?: string;
    parent_payment?: string;
    refund_reason?: string;
    refund_amount?: { value: string; currency_code: string };
    create_time?: string;
    update_time?: string;
  };
  summary?: string;
  links?: Array<{ href: string; rel: string; method: string }>;
}

// POST /api/webhooks/paypal - Handle PayPal webhook events
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const rawBody = await request.text();

    const transmissionId = request.headers.get('paypal-transmission-id');
    const transmissionTime = request.headers.get('paypal-transmission-time');
    const transmissionSig = request.headers.get('paypal-transmission-sig');
    const certUrl = request.headers.get('paypal-cert-url');
    const authAlgo = request.headers.get('paypal-auth-algo');

    if (!transmissionId || !transmissionSig) {
      console.error('[PayPal Webhook] Missing required PayPal signature headers');
      return NextResponse.json({ success: false, error: 'Missing signature headers' }, { status: 400 });
    }

    let event: PayPalWebhookEvent;
    try {
      event = JSON.parse(rawBody);
    } catch {
      console.error('[PayPal Webhook] Invalid JSON payload');
      return NextResponse.json({ success: false, error: 'Invalid JSON payload' }, { status: 400 });
    }

    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    if (!webhookId) {
      console.error('[SECURITY] PAYPAL_WEBHOOK_ID not configured');
      return NextResponse.json({ success: false, error: 'Webhook not configured' }, { status: 500 });
    }

    const result = await handlePayPalEvent(event);

    // tenantId will be resolved from payment record in the handler if available
    await logWebhookEvent({
      gateway: 'paypal',
      eventType: event.event_type,
      gatewayEventId: event.id,
      payload: JSON.parse(rawBody),
      status: result.success ? 'processed' : 'failed',
      errorMessage: result.error,
      processingTimeMs: Date.now() - startTime,
    });

    if (!result.success) {
      console.error(`[PayPal Webhook] Failed to process event ${event.event_type}:`, result.error);
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `Event ${event.event_type} processed successfully`,
      eventId: event.id,
    });
  } catch (error) {
    console.error('[PayPal Webhook] Error processing webhook:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

async function handlePayPalEvent(
  event: PayPalWebhookEvent
): Promise<{ success: boolean; error?: string }> {
  const { event_type, resource } = event;

  switch (event_type) {
    case 'PAYMENT.CAPTURE.COMPLETED':
      return handlePaymentCaptureCompleted(resource);
    case 'PAYMENT.CAPTURE.DENIED':
      return handlePaymentCaptureDenied(resource);
    case 'PAYMENT.CAPTURE.REFUNDED':
      return handlePaymentCaptureRefunded(resource);
    case 'PAYMENT.CAPTURE.PENDING':
      return handlePaymentCapturePending(resource);
    case 'PAYMENT.AUTHORIZATION.VOIDED':
      return handlePaymentAuthorizationVoided(resource);
    case 'CHECKOUT.ORDER.APPROVED':
    case 'CHECKOUT.ORDER.COMPLETED':
      return { success: true };
    default:
      return { success: true };
  }
}

async function handlePaymentCaptureCompleted(
  resource: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  try {
    const captureId = resource.id as string;
    const amount = parseFloat((resource.amount as Record<string, string>)?.value || '0');
    const currency = (resource.amount as Record<string, string>)?.currency_code || 'USD';

    const payment = await db.payment.findFirst({
      where: { gateway: 'paypal', OR: [{ gatewayRef: captureId }, { transactionId: captureId }] },
    });

    if (!payment || payment.status === 'completed') return { success: true };

    await db.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: 'completed', gatewayStatus: 'COMPLETED', amount, currency, processedAt: new Date(), updatedAt: new Date() },
      });

      const folio = await tx.folio.findUnique({ where: { id: payment.folioId } });
      if (folio) {
        const newPaidAmount = folio.paidAmount + amount;
        const newBalance = folio.totalAmount - newPaidAmount;
        let newStatus = folio.status;
        if (newBalance <= 0) newStatus = 'paid';
        else if (newPaidAmount > 0) newStatus = 'partially_paid';

        await tx.folio.update({
          where: { id: payment.folioId },
          data: { paidAmount: newPaidAmount, balance: Math.max(0, newBalance), status: newStatus, updatedAt: new Date() },
        });
      }
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to process PAYMENT.CAPTURE.COMPLETED' };
  }
}

async function handlePaymentCaptureDenied(
  resource: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  try {
    const captureId = resource.id as string;
    const payment = await db.payment.findFirst({
      where: { gateway: 'paypal', OR: [{ gatewayRef: captureId }, { transactionId: captureId }] },
    });

    if (!payment || payment.status === 'completed') return { success: true };

    await db.payment.update({
      where: { id: payment.id },
      data: { status: 'failed', gatewayStatus: 'DENIED', updatedAt: new Date() },
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to process PAYMENT.CAPTURE.DENIED' };
  }
}

async function handlePaymentCaptureRefunded(
  resource: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  try {
    const captureId = resource.id as string;
    const parentPayment = resource.parent_payment as string | undefined;
    const refundAmount = parseFloat((resource.refund_amount as Record<string, string>)?.value || '0');

    const payment = await db.payment.findFirst({
      where: { gateway: 'paypal', OR: [{ gatewayRef: captureId }, { gatewayRef: parentPayment || '' }, { transactionId: captureId }] },
    });

    if (!payment) return { success: true };

    const totalRefunded = (payment.refundAmount || 0) + refundAmount;
    const isFullRefund = totalRefunded >= payment.amount;
    const newStatus = isFullRefund ? 'refunded' : 'partially_refunded';

    await db.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: newStatus, refundAmount: totalRefunded, refundedAt: new Date(), refundReason: (resource.refund_reason as string) || 'Refunded via PayPal', updatedAt: new Date() },
      });

      const folio = await tx.folio.findUnique({ where: { id: payment.folioId } });
      if (folio) {
        await tx.folio.update({
          where: { id: payment.folioId },
          data: { paidAmount: Math.max(0, folio.paidAmount - refundAmount), balance: Math.max(0, folio.totalAmount - Math.max(0, folio.paidAmount - refundAmount)), updatedAt: new Date() },
        });
      }
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to process PAYMENT.CAPTURE.REFUNDED' };
  }
}

async function handlePaymentCapturePending(
  resource: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  try {
    const captureId = resource.id as string;
    const payment = await db.payment.findFirst({
      where: { gateway: 'paypal', OR: [{ gatewayRef: captureId }, { transactionId: captureId }] },
    });
    if (!payment) return { success: true };

    await db.payment.update({ where: { id: payment.id }, data: { status: 'processing', gatewayStatus: 'PENDING', updatedAt: new Date() } });
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to process PAYMENT.CAPTURE.PENDING' };
  }
}

async function handlePaymentAuthorizationVoided(
  resource: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  try {
    const authorizationId = resource.id as string;
    const payment = await db.payment.findFirst({
      where: { gateway: 'paypal', OR: [{ gatewayRef: authorizationId }, { transactionId: authorizationId }] },
    });
    if (!payment) return { success: true };

    await db.payment.update({ where: { id: payment.id }, data: { status: 'cancelled', gatewayStatus: 'VOIDED', updatedAt: new Date() } });
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to process PAYMENT.AUTHORIZATION.VOIDED' };
  }
}

async function logWebhookEvent(params: {
  gateway: string;
  eventType: string;
  gatewayEventId: string;
  payload: Record<string, unknown>;
  status: string;
  errorMessage?: string;
  processingTimeMs: number;
  tenantId?: string; // Optional: must be a valid UUID for PostgreSQL
}): Promise<void> {
  try {
    if (!params.tenantId) {
      console.warn('[PayPal Webhook] Skipping audit log: no tenantId available');
      return;
    }
    await db.auditLog.create({
      data: {
        tenantId: params.tenantId,
        module: 'payments',
        action: 'webhook_received',
        entityType: 'payment_webhook',
        // NOTE: gatewayEventId (e.g. 'WH-xxx') is NOT a UUID — store in newValue
        entityId: undefined,
        newValue: JSON.stringify({
          gateway: params.gateway,
          gatewayEventId: params.gatewayEventId,
          eventType: params.eventType,
          status: params.status,
          errorMessage: params.errorMessage,
          processingTimeMs: params.processingTimeMs,
          timestamp: new Date().toISOString(),
        }),
      },
    });
  } catch (error) {
    console.error('[PayPal Webhook] Failed to log webhook event:', error);
  }
}
