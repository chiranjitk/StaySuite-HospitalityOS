import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { gatewayRegistry } from '@/lib/payments';
import { GatewayType } from '@/lib/payments/types';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { encrypt } from '@/lib/encryption';

// GET - List payment gateways with health status
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
    const status = searchParams.get('status');

    const where: Record<string, unknown> = {
      tenantId,
    };

    if (status) {
      where.status = status;
    }

    const dbGateways = await db.paymentGateway.findMany({
      where,
      orderBy: [
        { isPrimary: 'desc' },
        { priority: 'asc' },
      ],
    });

    // Get health statuses from registry
    const healthStatuses = gatewayRegistry.getAllHealthStatuses();
    const healthMap = new Map(healthStatuses.map(h => [h.gatewayType, h]));

    const gateways = dbGateways.map((g) => {
      const health = healthMap.get(g.provider as GatewayType);
      return {
        id: g.id,
        name: g.name,
        provider: g.provider,
        priority: g.priority,
        isPrimary: g.isPrimary,
        status: g.status,
        mode: g.mode,
        apiKey: g.apiKey ? '****' : undefined,
        merchantId: g.merchantId,
        webhookSecret: g.webhookSecret ? '****' : undefined,
        supportedCurrencies: g.supportedCurrencies.split(',').filter(Boolean),
        fees: {
          percentage: g.feePercentage,
          fixed: g.feeFixed,
        },
        lastSync: g.lastSyncAt?.toISOString(),
        totalTransactions: g.totalTransactions,
        totalVolume: g.totalVolume,
        healthStatus: health?.status || 'unknown',
        healthLatency: health?.latency,
        healthUptime: health?.uptime,
        lastHealthCheck: health?.lastCheck?.toISOString(),
        tenantId: g.tenantId,
        createdAt: g.createdAt,
        updatedAt: g.updatedAt,
      };
    });

    // Calculate stats
    const stats = {
      total: gateways.length,
      active: gateways.filter(g => g.status === 'active').length,
      healthy: gateways.filter(g => g.healthStatus === 'healthy').length,
      totalTransactions: gateways.reduce((sum, g) => sum + g.totalTransactions, 0),
      totalVolume: gateways.reduce((sum, g) => sum + g.totalVolume, 0),
    };

    return NextResponse.json({
      success: true,
      data: {
        gateways,
        stats,
      },
    });
  } catch (error) {
    console.error('Error fetching payment gateways:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch payment gateways' } },
      { status: 500 }
    );
  }
}

// POST - Create payment gateway
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
      provider,
      apiKey,
      secretKey,
      merchantId,
      webhookSecret,
      mode = 'test',
      priority = 1,
      isPrimary = false,
      feePercentage = 0,
      feeFixed = 0,
      supportedCurrencies = ['USD'],
    } = body;

    // Validate required fields
    if (!name || !provider) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Name and provider are required' } },
        { status: 400 }
      );
    }

    // Validate provider
    const validProviders = ['stripe', 'paypal', 'manual'];
    if (!validProviders.includes(provider)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid provider. Valid providers: ${validProviders.join(', ')}` } },
        { status: 400 }
      );
    }

    // Check if gateway already exists
    const existing = await db.paymentGateway.findFirst({
      where: {
        tenantId,
        provider,
      },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: { code: 'DUPLICATE_PROVIDER', message: 'Gateway with this provider already exists' } },
        { status: 400 }
      );
    }

    // Encrypt sensitive data
    const encryptedApiKey = apiKey ? encrypt(apiKey) : null;
    const encryptedSecretKey = secretKey ? encrypt(secretKey) : null;
    const encryptedWebhookSecret = webhookSecret ? encrypt(webhookSecret) : null;

    // If setting as primary, unset other primary gateways
    if (isPrimary) {
      await db.paymentGateway.updateMany({
        where: {
          tenantId,
          isPrimary: true,
        },
        data: {
          isPrimary: false,
        },
      });
    }

    // Create gateway in database
    const gateway = await db.paymentGateway.create({
      data: {
        tenantId,
        name: name || provider,
        provider,
        priority,
        isPrimary,
        status: 'inactive',
        mode,
        apiKey: encryptedApiKey,
        secretKey: encryptedSecretKey,
        merchantId,
        webhookSecret: encryptedWebhookSecret,
        feePercentage,
        feeFixed,
        supportedCurrencies: supportedCurrencies.join(','),
        totalTransactions: 0,
        totalVolume: 0,
      },
    });

    // Register gateway in registry
    const config = {
      id: gateway.id,
      name: gateway.name,
      type: gateway.provider as GatewayType,
      priority: gateway.priority,
      isActive: gateway.status === 'active',
      isPrimary: gateway.isPrimary,
      mode: gateway.mode as 'live' | 'test',
      apiKey: apiKey || '',
      secretKey: secretKey || undefined,
      merchantId: gateway.merchantId || undefined,
      webhookSecret: webhookSecret || undefined,
      feePercentage: gateway.feePercentage,
      feeFixed: gateway.feeFixed,
      supportedCurrencies: gateway.supportedCurrencies.split(',').filter(Boolean),
      supportedCardTypes: ['visa', 'mastercard', 'amex', 'discover'],
      supportsRefunds: true,
      supportsPartialRefunds: true,
      supportsTokenization: provider === 'stripe',
      supportsRecurring: true,
      healthStatus: 'unknown' as const,
      consecutiveFailures: 0,
      totalTransactions: gateway.totalTransactions,
      successfulTransactions: 0,
      failedTransactions: 0,
      totalVolume: gateway.totalVolume,
      createdAt: gateway.createdAt,
      updatedAt: gateway.updatedAt,
    };

    // Register appropriate gateway
    try {
      await gatewayRegistry.registerGateway(config);
    } catch (error) {
      console.warn('Failed to register gateway in registry:', error);
    }

    return NextResponse.json({
      success: true,
      data: {
        id: gateway.id,
        name: gateway.name,
        provider: gateway.provider,
        priority: gateway.priority,
        isPrimary: gateway.isPrimary,
        status: gateway.status,
        mode: gateway.mode,
        supportedCurrencies,
        fees: { percentage: feePercentage, fixed: feeFixed },
        totalTransactions: 0,
        totalVolume: 0,
        tenantId: gateway.tenantId,
      },
      message: 'Payment gateway created successfully',
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating payment gateway:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create payment gateway' } },
      { status: 500 }
    );
  }
}

// PUT - Update payment gateway
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
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Gateway ID is required' } },
        { status: 400 }
      );
    }

    const existing = await db.paymentGateway.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Payment gateway not found' } },
        { status: 404 }
      );
    }

    // Whitelist allowed update fields to prevent mass-assignment
    const {
      status,
      name,
      priority,
      isPrimary,
      mode,
      apiKey,
      secretKey,
      merchantId,
      webhookSecret,
      feePercentage,
      feeFixed,
      supportedCurrencies,
    } = body;

    // Encrypt sensitive fields if provided
    const encryptedApiKey = apiKey ? encrypt(apiKey) : undefined;
    const encryptedSecretKey = secretKey ? encrypt(secretKey) : undefined;
    const encryptedWebhookSecret = webhookSecret ? encrypt(webhookSecret) : undefined;

    // If setting as primary, unset other primary gateways
    if (isPrimary) {
      await db.paymentGateway.updateMany({
        where: {
          tenantId,
          isPrimary: true,
          id: { not: id },
        },
        data: {
          isPrimary: false,
        },
      });
    }

    // Prepare update data (only whitelisted fields)
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (status !== undefined) updateData.status = status;
    if (name !== undefined) updateData.name = name;
    if (priority !== undefined) updateData.priority = priority;
    if (isPrimary !== undefined) updateData.isPrimary = isPrimary;
    if (mode !== undefined) updateData.mode = mode;
    if (encryptedApiKey !== undefined) updateData.apiKey = encryptedApiKey;
    if (encryptedSecretKey !== undefined) updateData.secretKey = encryptedSecretKey;
    if (merchantId !== undefined) updateData.merchantId = merchantId;
    if (encryptedWebhookSecret !== undefined) updateData.webhookSecret = encryptedWebhookSecret;
    if (feePercentage !== undefined) updateData.feePercentage = parseFloat(feePercentage);
    if (feeFixed !== undefined) updateData.feeFixed = parseFloat(feeFixed);
    if (supportedCurrencies !== undefined) {
      updateData.supportedCurrencies = Array.isArray(supportedCurrencies)
        ? supportedCurrencies.join(',')
        : supportedCurrencies;
    }

    const gateway = await db.paymentGateway.update({
      where: { id },
      data: updateData,
    });

    // Update registry
    await gatewayRegistry.updateGatewayConfig(gateway.provider as GatewayType, {
      isActive: gateway.status === 'active',
      isPrimary: gateway.isPrimary,
      priority: gateway.priority,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: gateway.id,
        name: gateway.name,
        provider: gateway.provider,
        priority: gateway.priority,
        isPrimary: gateway.isPrimary,
        status: gateway.status,
        mode: gateway.mode,
        supportedCurrencies: gateway.supportedCurrencies.split(',').filter(Boolean),
        fees: {
          percentage: gateway.feePercentage,
          fixed: gateway.feeFixed,
        },
        totalTransactions: gateway.totalTransactions,
        totalVolume: gateway.totalVolume,
      },
      message: 'Payment gateway updated successfully',
    });
  } catch (error) {
    console.error('Error updating payment gateway:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update payment gateway' } },
      { status: 500 }
    );
  }
}

// DELETE - Delete payment gateway
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
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Payment gateway ID is required' } },
        { status: 400 }
      );
    }

    const gateway = await db.paymentGateway.findFirst({
      where: { id, tenantId },
    });

    if (!gateway) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Payment gateway not found' } },
        { status: 404 }
      );
    }

    // Unregister from registry
    gatewayRegistry.unregisterGateway(gateway.provider as GatewayType);

    // Delete from database
    await db.paymentGateway.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Payment gateway deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting payment gateway:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete payment gateway' } },
      { status: 500 }
    );
  }
}
