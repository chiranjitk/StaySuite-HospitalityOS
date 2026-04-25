import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/channels/mapping - Get channel mappings
export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Permission check
    if (!hasPermission(user, 'channels.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to view channel mappings' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;

    // Get channel connections
    const connections = await db.channelConnection.findMany({
      where: { tenantId },
    });

    // Get properties for this tenant
    const properties = await db.property.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        roomTypes: {
          where: { deletedAt: null },
        },
      },
    });

    const roomTypes = properties.flatMap(p => p.roomTypes);

    // Get rate plans
    const ratePlans = await db.ratePlan.findMany({
      where: { 
        roomType: { property: { tenantId } },
        deletedAt: null 
      },
    });

    // Get existing mappings
    const mappings = await db.channelMapping.findMany({
      where: {
        connection: { tenantId },
      },
    });

    // Build mapping data
    const mappingData = mappings.map(m => {
      const connection = connections.find(c => c.id === m.connectionId);
      const roomType = roomTypes.find(rt => rt.id === m.roomTypeId);
      const ratePlan = ratePlans.find(rp => rp.id === m.ratePlanId);

      return {
        id: m.id,
        connectionId: m.connectionId,
        channelName: connection?.displayName || connection?.channel || 'Unknown',
        channelType: connection?.channel || 'unknown',
        roomTypeId: m.roomTypeId,
        roomTypeName: roomType?.name || 'Unknown',
        ratePlanId: m.ratePlanId,
        ratePlanName: ratePlan?.name || null,
        externalRoomId: m.externalRoomId,
        externalRoomName: m.externalRoomName || '',
        externalRateId: m.externalRateId,
        externalRateName: m.externalRateName || null,
        syncInventory: m.syncInventory,
        syncRates: m.syncRates,
        syncRestrictions: m.syncRestrictions,
        status: m.status,
      };
    });

    // If no mappings, create default suggestions
    if (mappings.length === 0) {
      for (const connection of connections.slice(0, 3)) {
        for (const roomType of roomTypes.slice(0, 3)) {
          const ratePlan = ratePlans.find(rp => rp.roomTypeId === roomType.id);
          
          mappingData.push({
            id: `suggestion-${connection.id}-${roomType.id}`,
            connectionId: connection.id,
            channelName: connection.displayName || connection.channel,
            channelType: connection.channel,
            roomTypeId: roomType.id,
            roomTypeName: roomType.name,
            ratePlanId: ratePlan?.id || null,
            ratePlanName: ratePlan?.name || null,
            externalRoomId: '',
            externalRoomName: '',
            externalRateId: null,
            externalRateName: null,
            syncInventory: true,
            syncRates: true,
            syncRestrictions: true,
            status: 'pending',
          });
        }
      }
    }

    // Calculate stats
    const stats = {
      total: mappingData.length,
      active: mappingData.filter(m => m.status === 'active').length,
      syncedInventory: mappingData.filter(m => m.syncInventory).length,
      syncedRates: mappingData.filter(m => m.syncRates).length,
    };

    return NextResponse.json({
      success: true,
      data: mappingData,
      roomTypes: roomTypes.map(rt => ({ id: rt.id, name: rt.name, code: rt.code })),
      ratePlans: ratePlans.map(rp => ({ id: rp.id, name: rp.name, code: rp.code, roomTypeId: rp.roomTypeId })),
      stats,
    });
  } catch (error) {
    console.error('Error fetching channel mappings:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch channel mappings' } },
      { status: 500 }
    );
  }
}

// POST /api/channels/mapping - Create a mapping
export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Permission check
    if (!hasPermission(user, 'channels.create')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to create channel mappings' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      connectionId,
      roomTypeId,
      ratePlanId,
      externalRoomId,
      externalRoomName,
      externalRateId,
      externalRateName,
      syncInventory = true,
      syncRates = true,
      syncRestrictions = true,
    } = body;

    if (!connectionId || !roomTypeId || !externalRoomId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Connection ID, room type ID, and external room ID are required' } },
        { status: 400 }
      );
    }

    // Verify connection belongs to user's tenant
    const connection = await db.channelConnection.findFirst({
      where: { id: connectionId, tenantId: user.tenantId },
    });

    if (!connection) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Channel connection not found or access denied' } },
        { status: 404 }
      );
    }

    // Verify room type belongs to user's tenant through property
    const roomType = await db.roomType.findFirst({
      where: { 
        id: roomTypeId, 
        property: { tenantId: user.tenantId }
      },
    });

    if (!roomType) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Room type not found or access denied' } },
        { status: 404 }
      );
    }

    const mapping = await db.channelMapping.create({
      data: {
        connectionId,
        roomTypeId,
        ratePlanId,
        externalRoomId,
        externalRoomName,
        externalRateId,
        externalRateName,
        syncInventory,
        syncRates,
        syncRestrictions,
        status: 'active',
      },
    });

    return NextResponse.json({
      success: true,
      data: mapping,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating mapping:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create mapping' } },
      { status: 500 }
    );
  }
}

// DELETE /api/channels/mapping - Delete a mapping
export async function DELETE(request: NextRequest) {
  try {
    // Authentication check
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Permission check
    if (!hasPermission(user, 'channels.delete')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to delete channel mappings' } },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Mapping ID is required' } },
        { status: 400 }
      );
    }

    // Verify mapping belongs to user's tenant through connection
    const mapping = await db.channelMapping.findUnique({
      where: { id },
      include: { connection: { select: { tenantId: true } } },
    });

    if (!mapping) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Mapping not found' } },
        { status: 404 }
      );
    }

    if (mapping.connection.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have access to this mapping' } },
        { status: 403 }
      );
    }

    await db.channelMapping.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Mapping deleted',
    });
  } catch (error) {
    console.error('Error deleting mapping:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete mapping' } },
      { status: 500 }
    );
  }
}
