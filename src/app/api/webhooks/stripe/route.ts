/**
 * Stripe Webhook Handler
 *
 * Handles incoming webhooks from Stripe for payment events.
 * Events handled: payment_intent.succeeded, payment_intent.payment_failed, charge.refunded
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/db';

type StripeEventType =
  | 'payment_intent.succeeded'
  | 'payment_intent.payment_failed'
  | 'charge.refunded'
  | 'charge.succeeded'
  | 'charge.failed'
  | 'charge.dispute.created';

interface StripeWebhookEvent {
  id: string;
  object: string;
  type: StripeEventType;
  data: {
    object: {
      id: string;
      object: string;
      amount?: number;
      currency?: string;
      status?: string;
      metadata?: Record<string, string>;
      payment_intent?: string;
      reason?: string;
      created?: number;
      amount_refunded?: number;
      refunded?: boolean;
      failure_message?: string;
      failure_code?: string;
    };
  };
  created: number;
}

// POST /api/webhooks/stripe - Handle Stripe webhook events
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const rawBody = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      console.error('[Stripe Webhook] Missing stripe-signature header');
      return NextResponse.json({ success: false, error: 'Missing signature' }, { status: 400 });
    }

    let event: StripeWebhookEvent;
    try {
      event = JSON.parse(rawBody);
    } catch {
      console.error('[Stripe Webhook] Invalid JSON payload');
      return NextResponse.json({ success: false, error: 'Invalid JSON payload' }, { status: 400 });
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('[SECURITY] STRIPE_WEBHOOK_SECRET not configured');
      return NextResponse.json({ success: false, error: 'Webhook not configured' }, { status: 500 });
    }

    const isValidSignature = verifyWebhookSignature(rawBody, signature, webhookSecret);
    if (!isValidSignature) {
      console.error('[Stripe Webhook] Invalid signature');
      return NextResponse.json({ success: false, error: 'Invalid signature' }, { status: 401 });
    }

    const gatewayConfig = await db.paymentGateway.findFirst({
      where: { provider: 'stripe', status: 'active' },
    });

    const result = await handleStripeEvent(event, gatewayConfig);

    await logWebhookEvent({
      gateway: 'stripe',
      eventType: event.type,
      gatewayEventId: event.id,
      payload: JSON.parse(rawBody),
      status: result.success ? 'processed' : 'failed',
      errorMessage: result.error,
      processingTimeMs: Date.now() - startTime,
    });

    if (!result.success) {
      console.error(`[Stripe Webhook] Failed to process event ${event.type}:`, result.error);
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `Event ${event.type} processed successfully`,
      eventId: event.id,
    });
  } catch (error) {
    console.error('[Stripe Webhook] Error processing webhook:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

async function handleStripeEvent(
  event: StripeWebhookEvent,
  _gatewayConfig: { id: string; apiKey?: string | null; webhookSecret?: string | null } | null
): Promise<{ success: boolean; error?: string }> {
  const { type, data } = event;
  const object = data.object;

  switch (type) {
    case 'payment_intent.succeeded':
      return handlePaymentIntentSucceeded(object);
    case 'payment_intent.payment_failed':
      return handlePaymentIntentFailed(object);
    case 'charge.refunded':
      return handleChargeRefunded(object);
    case 'charge.failed':
      return handleChargeFailed(object);
    case 'charge.dispute.created':
      return handleChargeDisputeCreated(object);
    default:
      return { success: true };
  }
}

async function handlePaymentIntentSucceeded(
  paymentIntent: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  try {
    const piId = paymentIntent.id as string;
    const amount = (paymentIntent.amount as number) / 100;
    const currency = (paymentIntent.currency as string)?.toUpperCase() || 'USD';

    const payment = await db.payment.findFirst({ where: { gateway: 'stripe', gatewayRef: piId } });
    if (!payment || payment.status === 'completed') return { success: true };

    await db.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: 'completed', gatewayStatus: 'succeeded', amount, currency, processedAt: new Date(), updatedAt: new Date() },
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
    return { success: false, error: error instanceof Error ? error.message : 'Failed to process payment_intent.succeeded' };
  }
}

async function handlePaymentIntentFailed(
  paymentIntent: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  try {
    const piId = paymentIntent.id as string;
    const lastPaymentError = paymentIntent.last_payment_error as Record<string, unknown> | undefined;
    const errorMessage = (lastPaymentError?.message as string) || 'Payment failed';
    const errorCode = (lastPaymentError?.code as string) || 'PAYMENT_FAILED';

    const payment = await db.payment.findFirst({ where: { gateway: 'stripe', gatewayRef: piId } });
    if (!payment || payment.status === 'completed') return { success: true };

    await db.payment.update({
      where: { id: payment.id },
      data: { status: 'failed', gatewayStatus: 'failed', reference: `Error: ${errorCode} - ${errorMessage}`, updatedAt: new Date() },
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to process payment_intent.payment_failed' };
  }
}

async function handleChargeRefunded(
  charge: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  try {
    const chargeId = charge.id as string;
    const paymentIntentId = charge.payment_intent as string | undefined;
    const amountRefunded = (charge.amount_refunded as number) / 100;

    const payment = await db.payment.findFirst({
      where: { gateway: 'stripe', OR: [{ gatewayRef: chargeId }, { gatewayRef: paymentIntentId || '' }] },
    });

    if (!payment) return { success: true };

    const totalRefunded = (payment.refundAmount || 0) + amountRefunded;
    const isFullRefund = totalRefunded >= payment.amount;
    const newStatus = isFullRefund ? 'refunded' : 'partially_refunded';

    await db.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: newStatus, refundAmount: totalRefunded, refundedAt: new Date(), refundReason: 'Refunded via Stripe', updatedAt: new Date() },
      });

      const folio = await tx.folio.findUnique({ where: { id: payment.folioId } });
      if (folio) {
        const newPaidAmount = Math.max(0, folio.paidAmount - amountRefunded);
        await tx.folio.update({
          where: { id: payment.folioId },
          data: { paidAmount: newPaidAmount, balance: Math.max(0, folio.totalAmount - newPaidAmount), updatedAt: new Date() },
        });
      }
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to process charge.refunded' };
  }
}

async function handleChargeFailed(
  charge: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  try {
    const chargeId = charge.id as string;
    const failureMessage = charge.failure_message as string || 'Charge failed';
    const failureCode = charge.failure_code as string || 'CHARGE_FAILED';

    const payment = await db.payment.findFirst({ where: { gateway: 'stripe', gatewayRef: chargeId } });
    if (!payment) return { success: true };

    await db.payment.update({
      where: { id: payment.id },
      data: { status: 'failed', gatewayStatus: 'failed', reference: `Error: ${failureCode} - ${failureMessage}`, updatedAt: new Date() },
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to process charge.failed' };
  }
}

async function handleChargeDisputeCreated(
  charge: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  try {
    const chargeId = charge.id as string;

    const payment = await db.payment.findFirst({ where: { gateway: 'stripe', OR: [{ gatewayRef: chargeId }] } });
    if (!payment) return { success: true };

    await db.payment.update({
      where: { id: payment.id },
      data: { gatewayStatus: 'disputed', reference: `Dispute created: ${chargeId}`, updatedAt: new Date() },
    });

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to process charge.dispute.created' };
  }
}

function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  if (!signature || !secret) return false;

  const elements = signature.split(',');
  let timestamp = '';
  let sig = '';

  for (const element of elements) {
    const [key, value] = element.split('=');
    if (key === 't') timestamp = value;
    if (key === 'v1') sig = value;
  }

  if (!timestamp || !sig) return false;

  const ts = parseInt(timestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > 300) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const expectedSig = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expectedSig, 'hex'));
  } catch {
    return false;
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
}): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        tenantId: 'system',
        module: 'payments',
        action: 'webhook_received',
        entityType: 'payment_webhook',
        entityId: params.gatewayEventId,
        newValue: JSON.stringify({
          gateway: params.gateway,
          eventType: params.eventType,
          status: params.status,
          errorMessage: params.errorMessage,
          processingTimeMs: params.processingTimeMs,
          timestamp: new Date().toISOString(),
        }),
      },
    });
  } catch (error) {
    console.error('[Stripe Webhook] Failed to log webhook event:', error);
  }
}
