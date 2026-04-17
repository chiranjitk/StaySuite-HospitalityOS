import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

// GET - List webhook endpoints
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

    const where: Record<string, unknown> = {
      tenantId,
    };

    if (status) {
      where.isActive = status === 'active';
    }

    const endpoints = await db.webhookEndpoint.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    const result = endpoints.map((e) => ({
      id: e.id,
      name: e.name,
      url: e.url,
      secret: e.secret,
      events: JSON.parse(e.events || '[]'),
      status: e.isActive ? 'active' : 'inactive',
      createdAt: e.createdAt.toISOString(),
      lastTriggered: e.lastCalledAt?.toISOString(),
      totalTriggers: e.totalCalls,
      successRate:
        e.totalCalls > 0
          ? parseFloat(((e.totalCalls - e.failedCalls) / e.totalCalls * 100).toFixed(1))
          : 0,
      tenantId: e.tenantId,
    }));

    // Calculate stats
    const stats = {
      total: result.length,
      active: result.filter((e) => e.status === 'active').length,
      totalTriggers: result.reduce((sum, e) => sum + e.totalTriggers, 0),
      avgSuccessRate:
        result.length > 0
          ? (
              result.reduce((sum, e) => sum + e.successRate, 0) /
              result.filter((e) => e.totalTriggers > 0).length || 0
            ).toFixed(1)
          : 0,
    };

    return NextResponse.json({
      success: true,
      data: {
        endpoints: result,
        stats,
      },
    });
  } catch (error) {
    console.error('Error fetching webhook endpoints:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch webhook endpoints' },
      { status: 500 }
    );
  }
}

// POST - Create webhook endpoint
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
    const tenantId = user.tenantId;
    const { name, url, secret, events, status } = body;

    const endpoint = await db.webhookEndpoint.create({
      data: {
        tenantId,
        name,
        url,
        secret: secret || `whsec_${Date.now()}`,
        events: JSON.stringify(events || []),
        isActive: status !== 'inactive',
        totalCalls: 0,
        failedCalls: 0,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: endpoint.id,
        name: endpoint.name,
        url: endpoint.url,
        secret: endpoint.secret,
        events: JSON.parse(endpoint.events || '[]'),
        status: endpoint.isActive ? 'active' : 'inactive',
        createdAt: endpoint.createdAt.toISOString(),
        lastTriggered: null,
        totalTriggers: 0,
        successRate: 0,
        tenantId: endpoint.tenantId,
      },
      message: 'Webhook endpoint created successfully',
    });
  } catch (error) {
    console.error('Error creating webhook endpoint:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create webhook endpoint' },
      { status: 500 }
    );
  }
}

// PUT - Update webhook endpoint
export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 });
    }
    if (!hasAnyPermission(user, ['admin.webhooks', 'admin.*'])) {
      return NextResponse.json({ success: false, error: 'Permission denied' }, { status: 403 });
    }

    const body = await request.json();
    const { id, ...updates } = body;

    const existing = await db.webhookEndpoint.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Webhook endpoint not found' },
        { status: 404 }
      );
    }

    // Verify endpoint belongs to user's tenant
    if (existing.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (updates.name) updateData.name = updates.name;
    if (updates.url) updateData.url = updates.url;
    if (updates.secret) updateData.secret = updates.secret;
    if (updates.events) updateData.events = JSON.stringify(updates.events);
    if (updates.status !== undefined) updateData.isActive = updates.status === 'active';

    const endpoint = await db.webhookEndpoint.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: endpoint.id,
        name: endpoint.name,
        url: endpoint.url,
        secret: endpoint.secret,
        events: JSON.parse(endpoint.events || '[]'),
        status: endpoint.isActive ? 'active' : 'inactive',
        createdAt: endpoint.createdAt.toISOString(),
        lastTriggered: endpoint.lastCalledAt?.toISOString(),
        totalTriggers: endpoint.totalCalls,
        successRate:
          endpoint.totalCalls > 0
            ? parseFloat(((endpoint.totalCalls - endpoint.failedCalls) / endpoint.totalCalls * 100).toFixed(1))
            : 0,
      },
      message: 'Webhook endpoint updated successfully',
    });
  } catch (error) {
    console.error('Error updating webhook endpoint:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update webhook endpoint' },
      { status: 500 }
    );
  }
}

// DELETE - Delete webhook endpoint
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
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Webhook endpoint ID is required' },
        { status: 400 }
      );
    }

    // Verify endpoint belongs to user's tenant
    const existing = await db.webhookEndpoint.findUnique({
      where: { id },
    });

    if (!existing || existing.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: 'Webhook endpoint not found or access denied' },
        { status: 404 }
      );
    }

    await db.webhookEndpoint.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Webhook endpoint deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting webhook endpoint:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete webhook endpoint' },
      { status: 500 }
    );
  }
}
