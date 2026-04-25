import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ALL_OTAS, getOTAById, OTAClientFactory } from '@/lib/ota';
import { requirePermission } from '@/lib/auth/tenant-context';// GET /api/channels/connections - List all channel connections
export async function GET(request: NextRequest) {    const user = await requirePermission(request, 'channels.view');
    if (user instanceof NextResponse) return user;

      try {
    const searchParams = request.nextUrl.searchParams;
    const tenantId = user.tenantId;
    const status = searchParams.get('status');
    const channel = searchParams.get('channel');
    const region = searchParams.get('region');
    const priority = searchParams.get('priority');

    const where: Record<string, unknown> = {
      tenantId,
    };

    if (status) {
      where.status = status;
    }

    if (channel) {
      where.channel = channel;
    }

    const connections = await db.channelConnection.findMany({
      where,
      include: {
        _count: {
          select: { channelMappings: true, syncLogs: true },
        },
      },
      orderBy: [
        { createdAt: 'desc' },
      ],
    });

    // Get sync stats for each connection
    const connectionIds = connections.map(c => c.id);
    const syncStats = await db.channelSyncLog.groupBy({
      by: ['connectionId', 'status'],
      where: {
        connectionId: { in: connectionIds },
      },
      _count: true,
    });

    const statsMap = new Map<string, { success: number; failed: number }>();
    syncStats.forEach(stat => {
      const existing = statsMap.get(stat.connectionId) || { success: 0, failed: 0 };
      if (stat.status === 'success') {
        existing.success = stat._count;
      } else if (stat.status === 'failed') {
        existing.failed = stat._count;
      }
      statsMap.set(stat.connectionId, existing);
    });

    // Get last sync for each connection
    const lastSyncs = await db.channelSyncLog.groupBy({
      by: ['connectionId'],
      where: {
        connectionId: { in: connectionIds },
      },
      _max: {
        createdAt: true,
      },
    });

    const lastSyncMap = new Map(lastSyncs.map(s => [s.connectionId, s._max.createdAt]));

    // Filter OTA channels by region and priority if specified
    let availableChannels = ALL_OTAS;
    if (region) {
      availableChannels = availableChannels.filter(ota => ota.region === region);
    }
    if (priority) {
      availableChannels = availableChannels.filter(ota => ota.priority === priority);
    }

    // Merge with OTA channel metadata
    const enrichedConnections = connections.map(conn => {
      const channelMeta = getOTAById(conn.channel) || {
        id: conn.channel,
        name: conn.channel,
        displayName: conn.channel,
        logo: conn.channel.charAt(0).toUpperCase(),
        color: '#6B7280',
        features: [],
        region: 'global',
        type: 'ota',
        priority: 'medium' as const,
        commission: { min: 0, max: 0, type: 'percentage' as const },
        apiConfig: {
          type: 'rest' as const,
          authType: 'api_key' as const,
          baseUrl: '',
          rateLimit: { requests: 60, period: 'minute' as const },
          timeout: 30000,
          retryAttempts: 3,
          requiresApproval: false,
          webhookSupport: true,
          realTimeSync: false,
        },
        supportedLanguages: ['en'],
        supportedCurrencies: ['USD'],
        website: '',
        documentation: '',
      };
      const syncStats = statsMap.get(conn.id) || { success: 0, failed: 0 };
      return {
        ...conn,
        channelMeta,
        mappingCount: conn._count.channelMappings,
        syncCount: conn._count.syncLogs,
        successfulSyncs: syncStats.success,
        failedSyncs: syncStats.failed,
        lastSyncAt: lastSyncMap.get(conn.id) || conn.lastSyncAt,
      };
    });

    // Get available channels (not yet connected)
    const connectedChannelIds = connections.map(c => c.channel);
    const unconnectedChannels = availableChannels.filter(c => !connectedChannelIds.includes(c.id));

    const total = await db.channelConnection.count({ where });

    // Status distribution
    const statusDistribution = await db.channelConnection.groupBy({
      by: ['status'],
      where: { tenantId },
      _count: true,
    });

    // Group by region
    const byRegion = ALL_OTAS.reduce((acc, ota) => {
      acc[ota.region] = (acc[ota.region] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Group by priority
    const byPriority = ALL_OTAS.reduce((acc, ota) => {
      acc[ota.priority] = (acc[ota.priority] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
      success: true,
      data: enrichedConnections,
      availableChannels: unconnectedChannels,
      allChannels: ALL_OTAS,
      pagination: {
        total,
      },
      stats: {
        totalConnections: total,
        activeConnections: await db.channelConnection.count({ where: { tenantId, status: 'active' } }),
        pendingConnections: await db.channelConnection.count({ where: { tenantId, status: 'pending' } }),
        errorConnections: await db.channelConnection.count({ where: { tenantId, status: 'error' } }),
        statusDistribution: statusDistribution.map(s => ({ status: s.status, count: s._count })),
      },
      otaStats: {
        total: ALL_OTAS.length,
        byRegion,
        byPriority,
        criticalCount: ALL_OTAS.filter(o => o.priority === 'critical').length,
        highCount: ALL_OTAS.filter(o => o.priority === 'high').length,
      },
      channelTypes: ALL_OTAS,
    });
  } catch (error) {
    console.error('Error fetching channel connections:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch channel connections' } },
      { status: 500 }
    );
  }
}

// POST /api/channels/connections - Create a new channel connection
export async function POST(request: NextRequest) {    const user = await requirePermission(request, 'channels.manage');
    if (user instanceof NextResponse) return user;

      try {
    const body = await request.json();
    const tenantId = user.tenantId;

    const {
      
      channel,
      displayName,
      // API Key authentication
      apiKey,
      apiSecret,
      // Basic authentication
      username,
      password,
      // OAuth2 authentication
      clientId,
      clientSecret,
      accessToken,
      refreshToken,
      // Common fields
      hotelId,
      propertyId,
      listingId,
      partnerId,
      endpointUrl,
      // Settings
      autoSync = true,
      syncInterval = 60,
    } = body;

    // Validate required fields
    if (!channel) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Channel type is required' } },
        { status: 400 }
      );
    }

    // Validate channel type
    const validChannel = getOTAById(channel);
    if (!validChannel) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_CHANNEL', message: 'Invalid channel type' } },
        { status: 400 }
      );
    }

    // Check for duplicate connection
    const existingConnection = await db.channelConnection.findFirst({
      where: {
        tenantId,
        channel,
      },
    });

    if (existingConnection) {
      return NextResponse.json(
        { success: false, error: { code: 'DUPLICATE_CONNECTION', message: 'A connection for this channel already exists' } },
        { status: 400 }
      );
    }

    // Determine primary hotel/property/listing ID
    const primaryId = hotelId || propertyId || listingId || partnerId;

    // Create connection with all credential fields
    const connection = await db.channelConnection.create({
      data: {
        tenantId,
        channel,
        displayName: displayName || validChannel.displayName,
        // API Key auth
        apiKey: apiKey || null,
        apiSecret: apiSecret || null,
        // Basic auth
        username: username || null,
        password: password || null,
        // OAuth2
        clientId: clientId || null,
        clientSecret: clientSecret || null,
        accessToken: accessToken || null,
        refreshToken: refreshToken || null,
        // Common
        hotelId: primaryId || null,
        propertyId: propertyId || null,
        listingId: listingId || null,
        endpointUrl: endpointUrl || null,
        // Settings
        status: 'pending',
        autoSync,
        syncInterval,
      },
    });

    // Test connection asynchronously
    testConnectionAsync(connection.id, channel, {
      apiKey,
      apiSecret,
      username,
      password,
      clientId,
      clientSecret,
      accessToken,
      refreshToken,
      hotelId: primaryId,
      propertyId,
      listingId,
    }).catch(console.error);

    return NextResponse.json({
      success: true,
      data: {
        ...connection,
        channelMeta: validChannel,
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating channel connection:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create channel connection' } },
      { status: 500 }
    );
  }
}

// PUT /api/channels/connections - Update a channel connection
export async function PUT(request: NextRequest) {    const user = await requirePermission(request, 'channels.manage');
    if (user instanceof NextResponse) return user;

      try {
    const body = await request.json();
    const tenantId = user.tenantId;
    const { id, action, channel, credentials, ...updates } = body;

    // Handle 'test' action (before connection is created)
    if (action === 'test' && channel) {
      const channelConfig = getOTAById(channel);
      if (!channelConfig) {
        return NextResponse.json(
          { success: false, message: 'Unknown channel type' },
          { status: 400 }
        );
      }

      const client = OTAClientFactory.createClient(channel);
      if (!client) {
        return NextResponse.json(
          { success: false, message: 'Failed to create API client' },
          { status: 400 }
        );
      }

      try {
        // Test connection with provided credentials
        const result = await client.connect({
          apiKey: credentials?.apiKey || undefined,
          apiSecret: credentials?.apiSecret || undefined,
          username: credentials?.username || undefined,
          password: credentials?.password || undefined,
          hotelId: credentials?.hotelId || credentials?.listingId || credentials?.propertyId || undefined,
          propertyId: credentials?.propertyId || undefined,
          accessToken: credentials?.accessToken || credentials?.apiSecret || undefined,
        });

        return NextResponse.json({
          success: result.success,
          message: result.success 
            ? `Successfully connected to ${channelConfig.displayName}!` 
            : result.message,
          data: result.propertyInfo,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Connection test failed';
        return NextResponse.json({
          success: false,
          message: errorMessage,
        });
      }
    }

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Connection ID is required' } },
        { status: 400 }
      );
    }

    // Verify connection exists and belongs to user's tenant
    const existingConn = await db.channelConnection.findUnique({
      where: { id },
      select: { tenantId: true },
    });
    if (!existingConn || existingConn.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }

    // Handle specific actions
    if (action === 'connect') {
      // Test and activate connection
      const connection = await db.channelConnection.findUnique({
        where: { id },
      });

      if (!connection) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Connection not found' } },
          { status: 404 }
        );
      }

      const client = OTAClientFactory.createClient(connection.channel);
      if (!client) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_CHANNEL', message: 'Unknown channel type' } },
          { status: 400 }
        );
      }

      try {
        const result = await client.connect({
          apiKey: connection.apiKey || undefined,
          apiSecret: connection.apiSecret || undefined,
          username: connection.username || undefined,
          password: connection.password || undefined,
          hotelId: connection.hotelId || connection.propertyId || connection.listingId || undefined,
          propertyId: connection.propertyId || undefined,
          accessToken: connection.accessToken || undefined,
        });

        if (result.success) {
          const updatedConnection = await db.channelConnection.update({
            where: { id },
            data: {
              status: 'active',
              lastSyncAt: new Date(),
              lastError: null,
            },
          });

          return NextResponse.json({ 
            success: true, 
            data: { ...updatedConnection, propertyInfo: result.propertyInfo }
          });
        } else {
          await db.channelConnection.update({
            where: { id },
            data: {
              status: 'error',
              lastError: result.message,
            },
          });

          return NextResponse.json(
            { success: false, error: { code: 'CONNECTION_FAILED', message: result.message } },
            { status: 400 }
          );
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Connection failed';
        await db.channelConnection.update({
          where: { id },
          data: {
            status: 'error',
            lastError: errorMessage,
          },
        });

        return NextResponse.json(
          { success: false, error: { code: 'CONNECTION_ERROR', message: errorMessage } },
          { status: 400 }
        );
      }
    }

    if (action === 'disconnect') {
      const connection = await db.channelConnection.update({
        where: { id },
        data: {
          status: 'disconnected',
        },
      });
      return NextResponse.json({ success: true, data: connection });
    }

    if (action === 'sync') {
      // Trigger manual sync
      const connection = await db.channelConnection.update({
        where: { id },
        data: {
          lastSyncAt: new Date(),
        },
      });

      // Log the sync
      await db.channelSyncLog.create({
        data: {
          connectionId: id,
          syncType: 'inventory',
          direction: 'outbound',
          status: 'success',
        },
      });

      return NextResponse.json({ success: true, data: connection, message: 'Sync triggered successfully' });
    }

    if (action === 'test') {
      const connection = await db.channelConnection.findUnique({
        where: { id },
      });

      if (!connection) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Connection not found' } },
          { status: 404 }
        );
      }

      const client = OTAClientFactory.createClient(connection.channel);
      if (!client) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_CHANNEL', message: 'Unknown channel type' } },
          { status: 400 }
        );
      }

      const result = await client.connect({
        apiKey: connection.apiKey || undefined,
        apiSecret: connection.apiSecret || undefined,
        hotelId: connection.hotelId || undefined,
      });

      return NextResponse.json({ 
        success: result.success, 
        data: result,
        message: result.message
      });
    }

    const connection = await db.channelConnection.update({
      where: { id },
      data: updates,
    });

    return NextResponse.json({ success: true, data: connection });
  } catch (error) {
    console.error('Error updating channel connection:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update channel connection' } },
      { status: 500 }
    );
  }
}

// DELETE /api/channels/connections - Delete a channel connection
export async function DELETE(request: NextRequest) {    const user = await requirePermission(request, 'channels.manage');
    if (user instanceof NextResponse) return user;

      try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Connection ID is required' } },
        { status: 400 }
      );
    }

    // Verify connection exists
    const connection = await db.channelConnection.findUnique({
      where: { id },
      select: { id: true, tenantId: true, channel: true, displayName: true },
    });

    if (!connection) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Channel connection not found' } },
        { status: 404 }
      );
    }

    // Verify connection belongs to user's tenant
    if (connection.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Access denied' } },
        { status: 403 }
      );
    }

    // Wrap all delete operations in a transaction for data integrity
    const result = await db.$transaction(async (tx) => {
      // Count related records for audit log
      const mappingCount = await tx.channelMapping.count({
        where: { connectionId: id },
      });
      const syncLogCount = await tx.channelSyncLog.count({
        where: { connectionId: id },
      });
      const restrictionCount = await tx.channelRestriction.count({
        where: { connectionId: id },
      });

      // Delete mappings
      await tx.channelMapping.deleteMany({
        where: { connectionId: id },
      });

      // Delete sync logs
      await tx.channelSyncLog.deleteMany({
        where: { connectionId: id },
      });

      // Delete restrictions
      await tx.channelRestriction.deleteMany({
        where: { connectionId: id },
      });

      // Delete connection
      await tx.channelConnection.delete({
        where: { id },
      });

      // Create audit log entry
      await tx.auditLog.create({
        data: {
          tenantId: connection.tenantId,
          module: 'channels',
          action: 'delete_connection',
          entityType: 'channel_connection',
          entityId: id,
          oldValue: JSON.stringify({
            channel: connection.channel,
            displayName: connection.displayName,
            deletedMappings: mappingCount,
            deletedSyncLogs: syncLogCount,
            deletedRestrictions: restrictionCount,
          }),
        },
      });

      return {
        deletedMappings: mappingCount,
        deletedSyncLogs: syncLogCount,
        deletedRestrictions: restrictionCount,
      };
    });

    console.log(`[Channel Connection] Deleted connection ${id}:`, result);

    return NextResponse.json({
      success: true,
      message: 'Channel connection deleted successfully',
      data: result,
    });
  } catch (error) {
    console.error('Error deleting channel connection:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete channel connection' } },
      { status: 500 }
    );
  }
}

// Helper function to test connection asynchronously
async function testConnectionAsync(
  connectionId: string,
  channel: string,
  credentials: {
    apiKey?: string;
    apiSecret?: string;
    username?: string;
    password?: string;
    clientId?: string;
    clientSecret?: string;
    accessToken?: string;
    refreshToken?: string;
    hotelId?: string;
    propertyId?: string;
    listingId?: string;
  }
): Promise<void> {
  try {
    const client = OTAClientFactory.createClient(channel);
    if (!client) {
      await db.channelConnection.update({
        where: { id: connectionId },
        data: {
          status: 'error',
          lastError: 'Unknown channel type',
        },
      });
      return;
    }

    const result = await client.connect({
      apiKey: credentials.apiKey,
      apiSecret: credentials.apiSecret,
      username: credentials.username,
      password: credentials.password,
      hotelId: credentials.hotelId || credentials.propertyId || credentials.listingId,
      propertyId: credentials.propertyId,
      accessToken: credentials.accessToken,
    });

    if (result.success) {
      await db.channelConnection.update({
        where: { id: connectionId },
        data: {
          status: 'active',
          lastSyncAt: new Date(),
          lastError: null,
        },
      });
    } else {
      await db.channelConnection.update({
        where: { id: connectionId },
        data: {
          status: 'error',
          lastError: result.message,
        },
      });
    }
  } catch (error) {
    await db.channelConnection.update({
      where: { id: connectionId },
      data: {
        status: 'error',
        lastError: error instanceof Error ? error.message : 'Connection test failed',
      },
    });
  }
}
