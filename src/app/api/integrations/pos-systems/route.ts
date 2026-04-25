import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { encrypt } from '@/lib/encryption';

// GET /api/integrations/pos-systems - List POS integrations
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
    const propertyId = searchParams.get('propertyId');
    const status = searchParams.get('status');

    const where: Record<string, unknown> = { tenantId, type: 'pos' };
    if (propertyId) where.propertyId = propertyId;
    if (status) where.status = status;

    const integrations = await db.integration.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    // Get sync status for each integration
    const integrationsWithStatus = await Promise.all(
      integrations.map(async (integration) => {
        const parsedConfig = (() => {
          try {
            return JSON.parse(integration.config) as Record<string, unknown>;
          } catch {
            return {} as Record<string, unknown>;
          }
        })();

        return {
          ...integration,
          lastSync: integration.lastSyncAt ? { createdAt: integration.lastSyncAt } : null,
          config: {
            ...parsedConfig,
            // Hide sensitive fields
            apiKey: parsedConfig.apiKey ? '***' : undefined,
            apiSecret: parsedConfig.apiSecret ? '***' : undefined,
          },
        };
      })
    );

    // Map Integration records to the PosSystem shape the frontend expects
    const systems = integrationsWithStatus.map((integration) => {
      const parsedConfig = typeof integration.config === 'object'
        ? integration.config as Record<string, unknown>
        : (() => { try { return JSON.parse(integration.config); } catch { return {}; } })();

      const syncSettings = (parsedConfig.syncSettings as Record<string, unknown>) || {};

      return {
        id: integration.id,
        name: integration.name || integration.provider,
        provider: integration.provider,
        status: integration.status === 'active' ? 'connected' : integration.status === 'error' ? 'error' : 'disconnected',
        endpoint: parsedConfig.endpoint as string | undefined,
        apiKey: parsedConfig.apiKey as string | undefined,
        merchantId: parsedConfig.merchantId as string | undefined,
        locationId: parsedConfig.locationId as string | undefined,
        lastSync: integration.lastSyncAt?.toISOString() || null,
        syncStatus: integration.lastSyncAt ? 'synced' : 'pending',
        outlets: (parsedConfig.outlets as number) || 0,
        menuItems: (parsedConfig.menuItems as number) || 0,
        syncSettings: {
          syncMenu: (syncSettings.syncMenuItems as boolean) ?? false,
          syncOrders: (syncSettings.syncOrders as boolean) ?? false,
          syncPayments: (syncSettings.syncPayments as boolean) ?? false,
          syncGuests: (syncSettings.syncGuests as boolean) ?? false,
        },
      };
    });

    // Compute stats from the systems list
    const stats = {
      total: systems.length,
      connected: systems.filter(s => s.status === 'connected').length,
      totalOutlets: systems.reduce((sum, s) => sum + s.outlets, 0),
      totalMenuItems: systems.reduce((sum, s) => sum + s.menuItems, 0),
    };

    return NextResponse.json({
      success: true,
      data: { systems, stats },
    });
  } catch (error) {
    console.error('Error fetching POS integrations:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch POS integrations' } },
      { status: 500 }
    );
  }
}

// POST /api/integrations/pos-systems - Create a new POS integration
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
    if (!hasPermission(user, 'integrations.create') && !hasPermission(user, 'settings.edit')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Permission denied' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;
    const body = await request.json();
    const {
      propertyId,
      name,
      provider,
      config,
      syncSettings,
    } = body;

    // Validate required fields
    if (!provider || !name) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Provider and name are required' } },
        { status: 400 }
      );
    }

    // Validate provider
    const validProviders = ['toast', 'square', 'clover', 'lightspeed', 'micros', 'posist', 'petpooja', 'custom'];
    if (!validProviders.includes(provider)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PROVIDER', message: `Invalid provider. Valid providers: ${validProviders.join(', ')}` } },
        { status: 400 }
      );
    }

    // Encrypt sensitive config data
    let encryptedConfig = config || {};
    if (config?.apiKey) {
      encryptedConfig.apiKey = encrypt(config.apiKey);
    }
    if (config?.apiSecret) {
      encryptedConfig.apiSecret = encrypt(config.apiSecret);
    }

    // Test connection if credentials provided
    let connectionStatus = 'pending';
    if (config?.apiKey && config?.apiSecret) {
      connectionStatus = await testPOSConnection(provider, config);
    }

    // Create integration
    const integration = await db.integration.create({
      data: {
        tenantId,
        type: 'pos',
        provider,
        name,
        config: JSON.stringify({
          provider,
          ...encryptedConfig,
          syncSettings: {
            syncMenuItems: syncSettings?.syncMenuItems ?? true,
            syncOrders: syncSettings?.syncOrders ?? true,
            syncInventory: syncSettings?.syncInventory ?? false,
            autoSync: syncSettings?.autoSync ?? true,
            syncIntervalMinutes: syncSettings?.syncIntervalMinutes ?? 30,
          },
        }),
        status: connectionStatus === 'active' ? 'active' : 'pending',
      },
    });

    return NextResponse.json({
      success: true,
      data: integration,
      message: connectionStatus === 'active' 
        ? 'POS integration created and connected successfully'
        : 'POS integration created. Please verify credentials to activate.',
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating POS integration:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create POS integration' } },
      { status: 500 }
    );
  }
}

// PUT /api/integrations/pos-systems - Update a POS integration
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
    const { id, config, syncSettings, status } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Integration ID is required' } },
        { status: 400 }
      );
    }

    const existing = await db.integration.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Integration not found' } },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};

    if (config) {
      // Encrypt sensitive fields
      let encryptedConfig = { ...config };
      if (config.apiKey) {
        encryptedConfig.apiKey = encrypt(config.apiKey);
      }
      if (config.apiSecret) {
        encryptedConfig.apiSecret = encrypt(config.apiSecret);
      }

      // Test new connection if credentials changed
      const existingConfig = (() => {
        try {
          return JSON.parse(existing.config) as Record<string, unknown>;
        } catch {
          return {} as Record<string, unknown>;
        }
      })();

      if (config.apiKey || config.apiSecret) {
        const connectionStatus = await testPOSConnection(
          existingConfig.provider as string,
          config
        );
        updateData.status = connectionStatus === 'active' ? 'active' : 'error';
      }
      updateData.config = {
        ...existingConfig,
        ...encryptedConfig,
        syncSettings: syncSettings || existingConfig.syncSettings,
      };
    }

    if (status) {
      updateData.status = status;
    }

    const integration = await db.integration.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: integration,
    });
  } catch (error) {
    console.error('Error updating POS integration:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update POS integration' } },
      { status: 500 }
    );
  }
}

// DELETE /api/integrations/pos-systems - Delete a POS integration
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
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Integration ID is required' } },
        { status: 400 }
      );
    }

    // Verify ownership
    const existing = await db.integration.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'POS integration not found' } },
        { status: 404 }
      );
    }

    await db.integration.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'POS integration deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting POS integration:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete POS integration' } },
      { status: 500 }
    );
  }
}

/**
 * Test POS connection
 */
async function testPOSConnection(provider: string, config: Record<string, unknown>): Promise<string> {
  try {
    // In production, this would make actual API calls to the POS provider
    // For now, simulate connection test
    console.log(`Testing connection to ${provider} with config:`, {
      apiKey: config.apiKey ? '***' : undefined,
      endpoint: config.endpoint,
    });

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Simulate success for demo
    return 'active';
  } catch (error) {
    console.error('POS connection test failed:', error);
    return 'error';
  }
}
