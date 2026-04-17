import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

// GET - List webhook deliveries
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
    const endpointId = searchParams.get('endpointId');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');

    // First get all webhook endpoints for this tenant
    const endpoints = await db.webhookEndpoint.findMany({
      where: { tenantId },
      select: { id: true, name: true },
    });

    const endpointIds = endpoints.map((e) => e.id);
    const endpointMap = new Map(endpoints.map((e) => [e.id, e.name]));

    const where: Record<string, unknown> = {};
    if (endpointId) {
      // Verify the requested endpoint belongs to this tenant
      if (!endpointIds.includes(endpointId)) {
        return NextResponse.json(
          { success: false, error: 'Access denied' },
          { status: 403 }
        );
      }
      where.endpointId = endpointId;
    } else if (endpointIds.length > 0) {
      where.endpointId = { in: endpointIds };
    } else {
      // No endpoints, return empty
      return NextResponse.json({
        success: true,
        data: {
          deliveries: [],
          total: 0,
          stats: {
            total: 0,
            success: 0,
            failed: 0,
            pending: 0,
          },
        },
      });
    }

    if (status) {
      where.status = status;
    }

    const deliveries = await db.webhookDeliveryLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const result = deliveries.map((d) => ({
      id: d.id,
      endpointId: d.endpointId,
      endpointName: endpointMap.get(d.endpointId) || 'Unknown',
      event: d.eventType,
      payload: JSON.parse(d.payload || '{}'),
      status: d.status as 'success' | 'failed' | 'pending',
      responseCode: d.statusCode || undefined,
      responseTime: undefined, // Not stored in schema
      attempts: d.attemptCount,
      deliveredAt: d.status === 'success' ? d.createdAt.toISOString() : undefined,
      lastAttemptAt: d.createdAt.toISOString(),
      errorMessage: d.response || undefined,
    }));

    // Calculate stats
    const allDeliveries = await db.webhookDeliveryLog.findMany({
      where: { endpointId: { in: endpointIds } },
      select: { status: true },
    });

    const stats = {
      total: allDeliveries.length,
      success: allDeliveries.filter((d) => d.status === 'success').length,
      failed: allDeliveries.filter((d) => d.status === 'failed').length,
      pending: allDeliveries.filter((d) => d.status === 'pending').length,
    };

    return NextResponse.json({
      success: true,
      data: {
        deliveries: result,
        total: result.length,
        stats,
      },
    });
  } catch (error) {
    console.error('Error fetching webhook deliveries:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch webhook deliveries' },
      { status: 500 }
    );
  }
}
