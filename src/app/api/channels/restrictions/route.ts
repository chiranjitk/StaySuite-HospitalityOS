import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/channels/restrictions - Get channel restrictions
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
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to view restrictions' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Get channel connections
    const connections = await db.channelConnection.findMany({
      where: { tenantId },
    });

    // Get room types through properties
    const properties = await db.property.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        roomTypes: {
          where: { deletedAt: null },
        },
      },
    });

    const roomTypes = properties.flatMap(p => p.roomTypes);

    // Build date range overlap filter
    // Two date ranges [A_start, A_end] and [B_start, B_end] overlap iff:
    //   A_start <= B_end AND A_end >= B_start
    // Here: A = query filter range, B = restriction's [startDate, endDate]
    const dateOverlapFilter: Record<string, unknown> = {};
    if (startDate || endDate) {
      const overlapWhere: Record<string, unknown> = {};
      if (startDate) {
        // restriction.endDate >= queryStartDate
        overlapWhere.endDate = { gte: new Date(startDate) };
      }
      if (endDate) {
        // restriction.startDate <= queryEndDate
        overlapWhere.startDate = { lte: new Date(endDate) };
      }
      dateOverlapFilter.AND = [overlapWhere];
    }

    // Get existing restrictions
    const restrictions = await db.channelRestriction.findMany({
      where: {
        connection: { tenantId },
        ...dateOverlapFilter,
      },
      orderBy: { startDate: 'asc' },
      include: {
        connection: true,
        roomType: true,
      },
    });

    // Build restriction data
    const restrictionData: Array<{
      id: string;
      connectionId: string;
      roomTypeId: string;
      channelName: string;
      channelType: string;
      roomTypeName: string;
      startDate: Date;
      endDate: Date;
      minStay: number | null;
      maxStay: number | null;
      closedToArrival: boolean;
      closedToDeparture: boolean;
      closed: boolean;
      syncStatus: string;
    }> = [];

    for (const restriction of restrictions) {
      restrictionData.push({
        id: restriction.id,
        connectionId: restriction.connectionId,
        roomTypeId: restriction.roomTypeId,
        channelName: restriction.connection?.displayName || restriction.connection?.channel || 'Unknown',
        channelType: restriction.connection?.channel || 'unknown',
        roomTypeName: restriction.roomType?.name || 'Unknown',
        startDate: restriction.startDate,
        endDate: restriction.endDate,
        minStay: restriction.minStay,
        maxStay: restriction.maxStay,
        closedToArrival: restriction.closedToArrival,
        closedToDeparture: restriction.closedToDeparture,
        closed: restriction.closed,
        syncStatus: restriction.syncStatus,
      });
    }

    // Calculate stats
    const stats = {
      total: restrictionData.length,
      active: restrictionData.filter(r => !r.closed).length,
      closed: restrictionData.filter(r => r.closed).length,
      cta: restrictionData.filter(r => r.closedToArrival).length,
      ctd: restrictionData.filter(r => r.closedToDeparture).length,
      synced: restrictionData.filter(r => r.syncStatus === 'synced').length,
      pending: restrictionData.filter(r => r.syncStatus === 'pending').length,
    };

    return NextResponse.json({
      success: true,
      data: restrictionData,
      stats,
      connections: connections.map(c => ({
        id: c.id,
        name: c.displayName || c.channel,
        type: c.channel,
        status: c.status,
      })),
      roomTypes: roomTypes.map(rt => ({
        id: rt.id,
        name: rt.name,
        code: rt.code,
      })),
    });
  } catch (error) {
    console.error('Error fetching restrictions:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch restrictions' } },
      { status: 500 }
    );
  }
}

// POST /api/channels/restrictions - Create or update restriction
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
    if (!hasPermission(user, 'channels.update')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to manage restrictions' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      connectionId,
      roomTypeId,
      startDate,
      endDate,
      minStay = null,
      maxStay = null,
      minStayArrival = null,
      maxStayArrival = null,
      closedToArrival = false,
      closedToDeparture = false,
      closed = false,
      rateMin = null,
      rateMax = null,
      source = 'manual',
    } = body;

    if (!connectionId || !roomTypeId || !startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Connection ID, room type ID, start date, and end date are required' } },
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

    // Check if restriction exists for this connection, room type, and start date
    const existing = await db.channelRestriction.findUnique({
      where: {
        connectionId_roomTypeId_startDate: {
          connectionId,
          roomTypeId,
          startDate: new Date(startDate),
        },
      },
    });

    let restriction;
    if (existing) {
      restriction = await db.channelRestriction.update({
        where: { id: existing.id },
        data: {
          endDate: new Date(endDate),
          minStay,
          maxStay,
          minStayArrival,
          maxStayArrival,
          closedToArrival,
          closedToDeparture,
          closed,
          rateMin,
          rateMax,
          source,
          syncStatus: 'pending',
        },
      });
    } else {
      restriction = await db.channelRestriction.create({
        data: {
          connectionId,
          roomTypeId,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          minStay,
          maxStay,
          minStayArrival,
          maxStayArrival,
          closedToArrival,
          closedToDeparture,
          closed,
          rateMin,
          rateMax,
          source,
          syncStatus: 'pending',
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: restriction,
    });
  } catch (error) {
    console.error('Error saving restriction:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to save restriction' } },
      { status: 500 }
    );
  }
}

// DELETE /api/channels/restrictions - Delete restriction
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
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to delete restrictions' } },
        { status: 403 }
      );
    }

    const { id } = await request.json();

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Restriction ID is required' } },
        { status: 400 }
      );
    }

    // Verify restriction belongs to user's tenant through connection
    const restriction = await db.channelRestriction.findUnique({
      where: { id },
      include: { connection: { select: { tenantId: true } } },
    });

    if (!restriction) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Restriction not found' } },
        { status: 404 }
      );
    }

    if (restriction.connection.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have access to this restriction' } },
        { status: 403 }
      );
    }

    await db.channelRestriction.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      data: { id },
    });
  } catch (error) {
    console.error('Error deleting restriction:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete restriction' } },
      { status: 500 }
    );
  }
}
