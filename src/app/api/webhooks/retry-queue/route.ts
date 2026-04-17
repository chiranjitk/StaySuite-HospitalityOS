import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

// GET - List webhook retry queue
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['admin.webhooks', 'admin.*'])) {
      return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const tenantId = user.tenantId;
    const status = searchParams.get('status');

    // Get all webhook endpoints for this tenant
    const endpoints = await db.webhookEndpoint.findMany({
      where: { tenantId },
      select: { id: true, name: true },
    });

    const endpointIds = endpoints.map((e) => e.id);
    const endpointMap = new Map(endpoints.map((e) => [e.id, e.name]));

    // Get failed/pending webhook delivery logs that need retry
    const where: Record<string, unknown> = {
      endpointId: { in: endpointIds },
      status: 'failed',
      attemptCount: { lt: 5 }, // Max attempts
    };

    if (status) {
      where.status = status;
    }

    const failedDeliveries = await db.webhookDeliveryLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    const queue = failedDeliveries.map((d, index) => ({
      id: `retry-${d.id}`,
      deliveryId: d.id,
      endpointId: d.endpointId,
      endpointName: endpointMap.get(d.endpointId) || 'Unknown',
      event: d.eventType,
      payload: JSON.parse(d.payload || '{}'),
      status: d.attemptCount >= 5 ? 'failed' : 'pending',
      attempts: d.attemptCount,
      maxAttempts: 5,
      nextRetryAt: d.nextRetryAt?.toISOString() || new Date(Date.now() + (index + 1) * 3600000).toISOString(),
      lastError: d.response || 'Unknown error',
      createdAt: d.createdAt.toISOString(),
      tenantId,
    }));

    // Calculate stats
    const stats = {
      total: queue.length,
      pending: queue.filter((q) => q.status === 'pending').length,
      failed: queue.filter((q) => q.status === 'failed').length,
      nextRetry: queue.filter((q) => q.status === 'pending').sort((a, b) =>
        new Date(a.nextRetryAt || '').getTime() - new Date(b.nextRetryAt || '').getTime()
      )[0]?.nextRetryAt || null,
    };

    return NextResponse.json({
      success: true,
      data: {
        queue,
        stats,
      },
    });
  } catch (error) {
    console.error('Error fetching webhook retry queue:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch webhook retry queue' },
      { status: 500 }
    );
  }
}

// POST - Retry webhook
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['admin.webhooks', 'admin.*'])) {
      return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
    }

    const body = await request.json();
    const { retryId } = body;

    // Extract the delivery ID from retryId
    const deliveryId = retryId?.replace('retry-', '');

    if (!deliveryId) {
      return NextResponse.json(
        { success: false, error: 'Retry ID is required' },
        { status: 400 }
      );
    }

    // Verify delivery belongs to user's tenant via its endpoint
    const delivery = await db.webhookDeliveryLog.findUnique({
      where: { id: deliveryId },
      include: { endpoint: { select: { tenantId: true } } },
    });
    if (!delivery || delivery.endpoint?.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: 'Delivery not found or access denied' },
        { status: 404 }
      );
    }

    // Update the delivery log to reset for retry
    await db.webhookDeliveryLog.update({
      where: { id: deliveryId },
      data: {
        attemptCount: { increment: 1 },
        nextRetryAt: new Date(Date.now() + 60000), // Retry in 1 minute
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Webhook retry initiated',
    });
  } catch (error) {
    console.error('Error retrying webhook:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retry webhook' },
      { status: 500 }
    );
  }
}

// DELETE - Cancel retry
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['admin.webhooks', 'admin.*'])) {
      return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const retryId = searchParams.get('retryId');

    // Extract the delivery ID from retryId
    const deliveryId = retryId?.replace('retry-', '');

    if (!deliveryId) {
      return NextResponse.json(
        { success: false, error: 'Retry ID is required' },
        { status: 400 }
      );
    }

    // Verify delivery belongs to user's tenant via its endpoint
    const delivery = await db.webhookDeliveryLog.findUnique({
      where: { id: deliveryId },
      include: { endpoint: { select: { tenantId: true } } },
    });
    if (!delivery || delivery.endpoint?.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: 'Delivery not found or access denied' },
        { status: 404 }
      );
    }

    // Mark as permanently failed
    await db.webhookDeliveryLog.update({
      where: { id: deliveryId },
      data: {
        status: 'failed',
        attemptCount: 5, // Max attempts reached
        nextRetryAt: null,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Webhook retry cancelled',
    });
  } catch (error) {
    console.error('Error cancelling webhook retry:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to cancel webhook retry' },
      { status: 500 }
    );
  }
}
