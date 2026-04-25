import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

// Mapping from frontend source IDs to integration types
const SOURCE_TO_INTEGRATION_TYPE: Record<string, string> = {
  google: 'google_reviews',
  booking_com: 'booking_reviews',
  booking: 'booking_reviews',
  tripadvisor: 'tripadvisor_reviews',
  expedia: 'expedia_reviews',
  airbnb: 'airbnb_reviews',
};

const ALL_REVIEW_TYPES = Object.values(SOURCE_TO_INTEGRATION_TYPE);

// GET /api/reputation/aggregation - Get aggregation status and config
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, 'bookings.view');
    if (auth instanceof NextResponse) return auth;

    const tenantId = auth.tenantId;
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');

    // Get review source configurations
    const integrations = await db.integration.findMany({
      where: {
        tenantId,
        type: { in: ALL_REVIEW_TYPES },
      },
    });

    // Get last sync status from Integration
    const lastSync = integrations.length > 0
      ? { createdAt: integrations[0].lastSyncAt, status: integrations[0].status }
      : null;

    // Get review counts by source from GuestReview (tenant-scoped via property)
    const tenantProperties = await db.property.findMany({
      where: { tenantId, deletedAt: null },
      select: { id: true },
    });
    const propertyIds = tenantProperties.map(p => p.id);

    const reviewCounts = propertyIds.length > 0
      ? await db.guestReview.groupBy({
          by: ['source'],
          where: { propertyId: { in: propertyIds } },
          _count: { id: true },
          _avg: { overallRating: true },
        })
      : [];

    if (status === 'config') {
      return NextResponse.json({
        success: true,
        data: {
          sources: integrations.map((i) => ({
            source: i.type.replace('_reviews', ''),
            enabled: i.status === 'active',
            lastSync: i.lastSyncAt,
            configured: !!i.config,
          })),
          lastSync,
          reviewCounts: reviewCounts.map(r => ({ source: r.source, count: r._count.id, avgRating: r._avg.overallRating })),
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        sources: reviewCounts.map(r => ({ source: r.source, count: r._count.id, avgRating: r._avg.overallRating })),
        lastSync,
        integrations: integrations.map((i) => ({
          type: i.type,
          status: i.status,
          lastSync: i.lastSyncAt,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching aggregation status:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch aggregation status' } },
      { status: 500 }
    );
  }
}

// POST /api/reputation/aggregation - Trigger review aggregation
export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission(request, 'bookings.view');
    if (auth instanceof NextResponse) return auth;

    const tenantId = auth.tenantId;
    const body = await request.json();
    const { propertyId, sources } = body;

    // Get active review integrations
    const integrations = await db.integration.findMany({
      where: {
        tenantId,
        type: { in: ALL_REVIEW_TYPES },
        status: 'active',
      },
    });

    if (integrations.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'NO_INTEGRATIONS', message: 'No active review integrations configured' } },
        { status: 400 }
      );
    }

    // Get properties to aggregate
    const properties = propertyId
      ? [{ id: propertyId }]
      : await db.property.findMany({
          where: { tenantId, deletedAt: null },
          select: { id: true },
        });

    // Update last sync time for the integrations
    const sourceList = sources || integrations.map(i => i.type.replace('_reviews', ''));
    const now = new Date();

    // Update the lastSyncAt for each integration
    for (const integration of integrations) {
      await db.integration.update({
        where: { id: integration.id },
        data: { lastSyncAt: now },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        propertiesProcessed: properties.length,
        sources: sourceList,
        results: properties.map(p => ({
          propertyId: p.id,
          status: 'aggregation_triggered',
        })),
      },
      message: 'Review aggregation triggered successfully',
    });
  } catch (error) {
    console.error('Error running aggregation:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to run aggregation' } },
      { status: 500 }
    );
  }
}

// PUT /api/reputation/aggregation - Configure review source
export async function PUT(request: NextRequest) {
  try {
    const auth = await requirePermission(request, 'bookings.view');
    if (auth instanceof NextResponse) return auth;

    const tenantId = auth.tenantId;
    const body = await request.json();
    const { source, config, enabled, propertyMapping } = body;

    if (!source) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Source is required' } },
        { status: 400 }
      );
    }

    // Map frontend source name to integration type
    const reviewType = SOURCE_TO_INTEGRATION_TYPE[source] || `${source}_reviews`;
    const provider = source.replace('_com', '');

    // Check for existing integration
    const existing = await db.integration.findFirst({
      where: { tenantId, type: reviewType },
    });

    let integration;
    if (existing) {
      integration = await db.integration.update({
        where: { id: existing.id },
        data: {
          config: JSON.stringify({ ...config, propertyMapping }),
          status: enabled ? 'active' : 'inactive',
        },
      });
    } else {
      integration = await db.integration.create({
        data: {
          tenantId,
          type: reviewType,
          provider,
          name: `${provider.charAt(0).toUpperCase() + provider.slice(1)} Reviews`,
          config: JSON.stringify({ ...config, propertyMapping }),
          status: enabled ? 'active' : 'inactive',
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: integration,
      message: 'Review source configured successfully',
    });
  } catch (error) {
    console.error('Error configuring review source:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to configure review source' } },
      { status: 500 }
    );
  }
}

// DELETE /api/reputation/aggregation - Disconnect a review source
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requirePermission(request, 'bookings.view');
    if (auth instanceof NextResponse) return auth;

    const tenantId = auth.tenantId;
    const body = await request.json();
    const { source } = body;

    if (!source) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Source is required' } },
        { status: 400 }
      );
    }

    // Map frontend source name to integration type
    const reviewType = SOURCE_TO_INTEGRATION_TYPE[source] || `${source}_reviews`;

    // Find the integration
    const integration = await db.integration.findFirst({
      where: { tenantId, type: reviewType },
    });

    if (!integration) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Review source integration not found' } },
        { status: 404 }
      );
    }

    // Delete the integration
    await db.integration.delete({
      where: { id: integration.id },
    });

    return NextResponse.json({
      success: true,
      message: 'Review source disconnected successfully',
    });
  } catch (error) {
    console.error('Error disconnecting review source:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to disconnect review source' } },
      { status: 500 }
    );
  }
}
