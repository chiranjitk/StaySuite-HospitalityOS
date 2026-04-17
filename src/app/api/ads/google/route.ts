import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET - Fetch Google Hotel Ads connection
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const tenantId = user.tenantId;
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');

    // Build where clause
    const where: Record<string, unknown> = { tenantId };
    if (propertyId) {
      where.propertyId = propertyId;
    }

    // Get connection(s)
    const connections = await db.googleHotelAdsConnection.findMany({
      where,
      take: propertyId ? 1 : 50,
    });

    if (propertyId) {
      return NextResponse.json({
        success: true,
        data: connections[0] || null,
      });
    }

    return NextResponse.json({
      success: true,
      data: connections,
    });
  } catch (error) {
    console.error('Error fetching Google Hotel Ads connection:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch connection' } },
      { status: 500 }
    );
  }
}

// POST - Create Google Hotel Ads connection
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Check permission
    if (!hasPermission(user, 'ads.manage') && !hasPermission(user, 'settings.manage')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;
    const body = await request.json();
    const {
      propertyId,
      accountId,
      subAccountId,
      hotelId,
      partnerId,
      hotelCenterId,
      connectionMode,
      bidStrategy,
      baseBidModifier,
      autoBidEnabled,
    } = body;

    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Property ID is required' } },
        { status: 400 }
      );
    }

    // Verify property belongs to tenant
    const property = await db.property.findFirst({
      where: { id: propertyId, tenantId },
    });

    if (!property) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Property not found' } },
        { status: 404 }
      );
    }

    // Validate numeric fields
    if (baseBidModifier !== undefined && baseBidModifier < 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'baseBidModifier cannot be negative' } },
        { status: 400 }
      );
    }

    // Validate connection mode
    if (connectionMode && !['live', 'test'].includes(connectionMode)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid connection mode' } },
        { status: 400 }
      );
    }

    // Validate bid strategy
    if (bidStrategy && !['auto', 'manual'].includes(bidStrategy)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid bid strategy' } },
        { status: 400 }
      );
    }

    // Check for existing connection
    const existing = await db.googleHotelAdsConnection.findUnique({
      where: {
        tenantId_propertyId: {
          tenantId,
          propertyId,
        },
      },
    });

    if (existing) {
      // Update existing connection
      const connection = await db.googleHotelAdsConnection.update({
        where: { id: existing.id },
        data: {
          accountId: accountId || null,
          subAccountId: subAccountId || null,
          hotelId: hotelId || null,
          partnerId: partnerId || null,
          hotelCenterId: hotelCenterId || null,
          connectionMode: connectionMode || 'live',
          bidStrategy: bidStrategy || 'auto',
          baseBidModifier: baseBidModifier ?? 1.0,
          autoBidEnabled: autoBidEnabled ?? true,
          status: 'connected',
        },
      });

      return NextResponse.json({
        success: true,
        data: connection,
      });
    }

    // Create new connection
    const connection = await db.googleHotelAdsConnection.create({
      data: {
        tenantId,
        propertyId,
        accountId: accountId || null,
        subAccountId: subAccountId || null,
        hotelId: hotelId || null,
        partnerId: partnerId || null,
        hotelCenterId: hotelCenterId || null,
        connectionMode: connectionMode || 'live',
        bidStrategy: bidStrategy || 'auto',
        baseBidModifier: baseBidModifier ?? 1.0,
        autoBidEnabled: autoBidEnabled ?? true,
        status: 'connected',
      },
    });

    return NextResponse.json({
      success: true,
      data: connection,
    });
  } catch (error) {
    console.error('Error creating Google Hotel Ads connection:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create connection' } },
      { status: 500 }
    );
  }
}

// PUT - Update Google Hotel Ads settings
export async function PUT(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Check permission
    if (!hasPermission(user, 'ads.manage') && !hasPermission(user, 'settings.manage')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;
    const body = await request.json();
    const { id, propertyId, ...updateData } = body;

    // Either id or propertyId is required
    if (!id && !propertyId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Connection ID or Property ID is required' } },
        { status: 400 }
      );
    }

    // Find the connection
    let connection;
    if (id) {
      connection = await db.googleHotelAdsConnection.findUnique({
        where: { id },
      });
    } else if (propertyId) {
      connection = await db.googleHotelAdsConnection.findUnique({
        where: {
          tenantId_propertyId: {
            tenantId,
            propertyId,
          },
        },
      });
    }

    if (!connection) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Connection not found' } },
        { status: 404 }
      );
    }

    // Verify connection belongs to user's tenant
    if (connection.tenantId !== tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }

    // Validate numeric fields
    if (updateData.baseBidModifier !== undefined && updateData.baseBidModifier < 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'baseBidModifier cannot be negative' } },
        { status: 400 }
      );
    }

    // Validate connection mode
    if (updateData.connectionMode && !['live', 'test'].includes(updateData.connectionMode)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid connection mode' } },
        { status: 400 }
      );
    }

    // Validate bid strategy
    if (updateData.bidStrategy && !['auto', 'manual'].includes(updateData.bidStrategy)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid bid strategy' } },
        { status: 400 }
      );
    }

    // Update connection
    const updated = await db.googleHotelAdsConnection.update({
      where: { id: connection.id },
      data: {
        bidStrategy: updateData.bidStrategy || connection.bidStrategy,
        baseBidModifier: updateData.baseBidModifier ?? connection.baseBidModifier,
        autoBidEnabled: updateData.autoBidEnabled ?? connection.autoBidEnabled,
        connectionMode: updateData.connectionMode || connection.connectionMode,
        accountId: updateData.accountId !== undefined ? updateData.accountId : connection.accountId,
        subAccountId: updateData.subAccountId !== undefined ? updateData.subAccountId : connection.subAccountId,
        hotelId: updateData.hotelId !== undefined ? updateData.hotelId : connection.hotelId,
      },
    });

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error('Error updating Google Hotel Ads connection:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update connection' } },
      { status: 500 }
    );
  }
}

// DELETE - Disconnect Google Hotel Ads
export async function DELETE(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Check permission
    if (!hasPermission(user, 'ads.manage') && !hasPermission(user, 'settings.manage')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const propertyId = searchParams.get('propertyId');

    // Either id or propertyId is required
    if (!id && !propertyId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Connection ID or Property ID is required' } },
        { status: 400 }
      );
    }

    // Find the connection
    let connection;
    if (id) {
      connection = await db.googleHotelAdsConnection.findUnique({
        where: { id },
      });
    } else if (propertyId) {
      connection = await db.googleHotelAdsConnection.findUnique({
        where: {
          tenantId_propertyId: {
            tenantId,
            propertyId,
          },
        },
      });
    }

    if (!connection) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Connection not found' } },
        { status: 404 }
      );
    }

    // Verify connection belongs to user's tenant
    if (connection.tenantId !== tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }

    // Delete connection
    await db.googleHotelAdsConnection.delete({
      where: { id: connection.id },
    });

    return NextResponse.json({
      success: true,
      data: { message: 'Disconnected successfully' },
    });
  } catch (error) {
    console.error('Error disconnecting Google Hotel Ads:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to disconnect' } },
      { status: 500 }
    );
  }
}
