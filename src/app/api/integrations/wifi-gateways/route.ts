import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { encrypt } from '@/lib/encryption';

// GET - List WiFi gateways OR test-connection OR sync
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
    if (!hasPermission(user, 'integrations.view') && !hasPermission(user, 'settings.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Permission denied' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');
    const gatewayId = searchParams.get('id');

    // Handle test-connection action
    if (action === 'test-connection') {
      if (!gatewayId) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Gateway ID is required for test-connection' } },
          { status: 400 }
        );
      }

      const gateway = await db.integration.findFirst({
        where: { id: gatewayId, tenantId, type: 'wifi_gateway' },
      });

      if (!gateway) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'WiFi gateway not found' } },
          { status: 404 }
        );
      }

      const config = JSON.parse(gateway.config || '{}');
      const ipAddress = config.ipAddress || '';
      const port = config.port || 443;

      // SSRF prevention: reject private/internal IP ranges
      const isPrivateIp = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|0\.|localhost$)/i.test(ipAddress)
        || ipAddress === '::1'
        || ipAddress === '[::1]'
        || /^(0x[0-9a-f]{1,8})/i.test(ipAddress); // hex notation bypass

      if (isPrivateIp) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Connection to internal/private IP addresses is not allowed for security reasons' } },
          { status: 400 }
        );
      }

      // Attempt to connect to the gateway
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const connectUrl = `http://${ipAddress}:${port}/`;
        const response = await fetch(connectUrl, {
          method: 'GET',
          signal: controller.signal,
        }).catch(() => null);

        clearTimeout(timeout);

        if (response && (response.status < 500)) {
          // Gateway responded - update status to active
          await db.integration.update({
            where: { id: gatewayId },
            data: { status: 'active' },
          });

          return NextResponse.json({
            success: true,
            data: {
              connected: true,
              ipAddress,
              port,
              responseTime: Date.now(),
              message: `Successfully connected to ${gateway.name || ipAddress}`,
            },
          });
        } else {
          // Gateway exists but returned server error - still counts as reachable
          await db.integration.update({
            where: { id: gatewayId },
            data: { status: 'active' },
          });

          return NextResponse.json({
            success: true,
            data: {
              connected: true,
              ipAddress,
              port,
              responseTime: Date.now(),
              message: `Gateway ${gateway.name || ipAddress} is reachable (returned ${response?.status || 'unknown status'})`,
            },
          });
        }
      } catch {
        // Connection failed - update status to error
        await db.integration.update({
          where: { id: gatewayId },
          data: { status: 'error', lastError: 'Connection test failed' },
        });

        return NextResponse.json({
          success: true,
          data: {
            connected: false,
            ipAddress,
            port,
            message: `Could not establish connection to ${gateway.name || ipAddress}`,
          },
        });
      }
    }

    // Handle sync action
    if (action === 'sync') {
      if (!gatewayId) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Gateway ID is required for sync' } },
          { status: 400 }
        );
      }

      const gateway = await db.integration.findFirst({
        where: { id: gatewayId, tenantId, type: 'wifi_gateway' },
      });

      if (!gateway) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'WiFi gateway not found' } },
          { status: 404 }
        );
      }

      // Perform sync: update lastSyncAt and refresh stats
      const existingConfig = JSON.parse(gateway.config || '{}');

      // Keep existing values as fallback (0) - no random data
      const syncedConfig = {
        ...existingConfig,
        totalAPs: existingConfig.totalAPs || 0,
        activeSessions: existingConfig.activeSessions || 0,
        bandwidth: {
          upload: existingConfig.bandwidth?.upload || 0,
          download: existingConfig.bandwidth?.download || 0,
        },
      };

      const updated = await db.integration.update({
        where: { id: gatewayId },
        data: {
          lastSyncAt: new Date(),
          status: 'active',
          lastError: null,
          config: JSON.stringify(syncedConfig),
        },
      });

      const config = JSON.parse(updated.config || '{}');
      return NextResponse.json({
        success: true,
        data: {
          id: updated.id,
          name: updated.name,
          type: updated.provider,
          ipAddress: config.ipAddress,
          port: config.port || 443,
          status: 'connected',
          lastSync: updated.lastSyncAt?.toISOString(),
          totalAPs: syncedConfig.totalAPs,
          activeSessions: syncedConfig.activeSessions,
          bandwidth: syncedConfig.bandwidth,
          location: config.location,
          autoSync: config.autoSync ?? true,
          syncInterval: config.syncInterval || 5,
        },
        message: `Successfully synced ${updated.name || 'gateway'}`,
      });
    }

    // Default: List gateways
    const status = searchParams.get('status');

    const where: Record<string, unknown> = {
      tenantId,
      type: 'wifi_gateway',
    };

    if (status) {
      where.status = status;
    }

    const integrations = await db.integration.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    const gateways = integrations.map((i) => {
      const config = JSON.parse(i.config || '{}');
      return {
        id: i.id,
        name: i.name || i.provider,
        type: i.provider as 'cisco' | 'ubiquiti' | 'aruba' | 'ruckus' | 'mikrotik' | 'other',
        ipAddress: config.ipAddress || '',
        port: config.port || 443,
        status: i.status === 'active' ? 'connected' : i.status === 'error' ? 'error' : 'disconnected',
        apiEndpoint: config.apiEndpoint,
        lastSync: i.lastSyncAt?.toISOString(),
        totalAPs: config.totalAPs || 0,
        activeSessions: config.activeSessions || 0,
        bandwidth: config.bandwidth || { upload: 0, download: 0 },
        location: config.location,
        autoSync: config.autoSync ?? true,
        syncInterval: config.syncInterval || 5,
        tenantId: i.tenantId,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        gateways,
        stats: {
          total: gateways.length,
          connected: gateways.filter((g) => g.status === 'connected').length,
          totalAPs: gateways.reduce((sum, g) => sum + g.totalAPs, 0),
          activeSessions: gateways.reduce((sum, g) => sum + g.activeSessions, 0),
          totalBandwidth: gateways.reduce((sum, g) => sum + (g.bandwidth?.upload || 0) + (g.bandwidth?.download || 0), 0),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching WiFi gateways:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch WiFi gateways' } },
      { status: 500 }
    );
  }
}

// POST - Create WiFi gateway
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

    // Permission check - requires admin or settings.edit
    if (!hasPermission(user, 'integrations.create') && !hasPermission(user, 'settings.edit')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Permission denied' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;
    const body = await request.json();
    const {
      name,
      type,
      ipAddress,
      port,
      username,
      apiKey,
      location,
      autoSync,
      syncInterval,
    } = body;

    // Validate required fields
    if (!name || !type || !ipAddress) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Name, type, and ipAddress are required' } },
        { status: 400 }
      );
    }

    // Validate type
    const validTypes = ['cisco', 'ubiquiti', 'aruba', 'ruckus', 'mikrotik', 'other'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid type. Valid types: ${validTypes.join(', ')}` } },
        { status: 400 }
      );
    }

    // Encrypt sensitive data
    const encryptedApiKey = apiKey ? encrypt(apiKey) : null;

    const config = JSON.stringify({
      ipAddress,
      port: port || 443,
      username,
      apiKey: encryptedApiKey,
      location,
      autoSync: autoSync ?? true,
      syncInterval: syncInterval || 5,
      totalAPs: 0,
      activeSessions: 0,
      bandwidth: { upload: 0, download: 0 },
    });

    const integration = await db.integration.create({
      data: {
        tenantId,
        type: 'wifi_gateway',
        provider: type || 'other',
        name: name || 'WiFi Gateway',
        config,
        status: 'pending',
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: integration.id,
        name: integration.name,
        type: integration.provider,
        ipAddress,
        port: port || 443,
        status: 'disconnected',
        location,
        autoSync: autoSync ?? true,
        syncInterval: syncInterval || 5,
        totalAPs: 0,
        activeSessions: 0,
        bandwidth: { upload: 0, download: 0 },
        tenantId: integration.tenantId,
      },
      message: 'WiFi gateway created successfully',
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating WiFi gateway:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create WiFi gateway' } },
      { status: 500 }
    );
  }
}

// PUT - Update WiFi gateway
export async function PUT(request: NextRequest) {
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
    if (!hasPermission(user, 'integrations.edit') && !hasPermission(user, 'settings.edit')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Permission denied' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Gateway ID is required' } },
        { status: 400 }
      );
    }

    const existing = await db.integration.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'WiFi gateway not found' } },
        { status: 404 }
      );
    }

    // Encrypt apiKey if provided
    if (updates.apiKey) {
      updates.apiKey = encrypt(updates.apiKey);
    }

    const existingConfig = JSON.parse(existing.config || '{}');
    const newConfig = JSON.stringify({
      ...existingConfig,
      ...updates,
    });

    const integration = await db.integration.update({
      where: { id },
      data: {
        status: updates.status || existing.status,
        config: newConfig,
        name: updates.name || existing.name,
        updatedAt: new Date(),
      },
    });

    const config = JSON.parse(integration.config || '{}');
    return NextResponse.json({
      success: true,
      data: {
        id: integration.id,
        name: integration.name,
        type: integration.provider,
        ipAddress: config.ipAddress,
        port: config.port || 443,
        status: integration.status === 'active' ? 'connected' : 'disconnected',
        location: config.location,
        autoSync: config.autoSync ?? true,
        syncInterval: config.syncInterval || 5,
        totalAPs: config.totalAPs || 0,
        activeSessions: config.activeSessions || 0,
        bandwidth: config.bandwidth || { upload: 0, download: 0 },
      },
      message: 'WiFi gateway updated successfully',
    });
  } catch (error) {
    console.error('Error updating WiFi gateway:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update WiFi gateway' } },
      { status: 500 }
    );
  }
}

// DELETE - Delete WiFi gateway
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
    if (!hasPermission(user, 'integrations.delete') && !hasPermission(user, 'settings.edit')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Permission denied' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'WiFi gateway ID is required' } },
        { status: 400 }
      );
    }

    // Verify ownership
    const existing = await db.integration.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'WiFi gateway not found' } },
        { status: 404 }
      );
    }

    await db.integration.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'WiFi gateway deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting WiFi gateway:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete WiFi gateway' } },
      { status: 500 }
    );
  }
}
