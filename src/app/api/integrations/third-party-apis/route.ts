import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';
import { encrypt } from '@/lib/encryption';

// GET - List third-party APIs
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
    const category = searchParams.get('category');

    const where: Record<string, unknown> = {
      tenantId,
      type: 'third_party_api',
    };

    if (category) {
      where.provider = category;
    }

    const integrations = await db.integration.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    const apis = integrations.map((i) => {
      const config = JSON.parse(i.config || '{}');
      return {
        id: i.id,
        name: i.name || 'API',
        category: config.category || i.provider || 'other',
        status: i.status === 'active' ? 'active' : 'inactive',
        apiKey: config.apiKey ? '****' : '',
        endpoint: config.endpoint || '',
        lastUsed: config.lastUsed || i.lastSyncAt?.toISOString(),
        requestCount: config.requestCount || 0,
        rateLimit: config.rateLimit || { used: 0, limit: 1000, period: 'day' },
        tenantId: i.tenantId,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        apis,
        stats: {
          total: apis.length,
          active: apis.filter((a) => a.status === 'active').length,
          totalRequests: apis.reduce((sum, a) => sum + a.requestCount, 0),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching third-party APIs:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch third-party APIs' } },
      { status: 500 }
    );
  }
}

// POST - Create third-party API
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
    const { name, category, apiKey, endpoint, rateLimit } = body;

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Name is required' } },
        { status: 400 }
      );
    }

    // Validate category
    const validCategories = ['maps', 'weather', 'payment', 'communication', 'analytics', 'crm', 'other'];
    if (category && !validCategories.includes(category)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid category. Valid categories: ${validCategories.join(', ')}` } },
        { status: 400 }
      );
    }

    // Encrypt API key if provided
    const encryptedApiKey = apiKey ? encrypt(apiKey) : null;

    const config = JSON.stringify({
      category: category || 'other',
      apiKey: encryptedApiKey,
      endpoint,
      rateLimit: rateLimit || { used: 0, limit: 1000, period: 'day' },
      requestCount: 0,
      lastUsed: null,
    });

    const integration = await db.integration.create({
      data: {
        tenantId,
        type: 'third_party_api',
        provider: category || 'other',
        name: name || 'Third-Party API',
        config,
        status: 'pending',
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: integration.id,
        name: integration.name,
        category: category || 'other',
        status: 'inactive',
        apiKey: '****',
        endpoint,
        requestCount: 0,
        rateLimit: rateLimit || { used: 0, limit: 1000, period: 'day' },
        tenantId: integration.tenantId,
      },
      message: 'Third-party API created successfully',
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating third-party API:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create third-party API' } },
      { status: 500 }
    );
  }
}

// PUT - Update third-party API
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
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'API ID is required' } },
        { status: 400 }
      );
    }

    const existing = await db.integration.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Third-party API not found' } },
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
        category: config.category || 'other',
        status: integration.status === 'active' ? 'active' : 'inactive',
        endpoint: config.endpoint,
        rateLimit: config.rateLimit || { used: 0, limit: 1000, period: 'day' },
        requestCount: config.requestCount || 0,
      },
      message: 'Third-party API updated successfully',
    });
  } catch (error) {
    console.error('Error updating third-party API:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update third-party API' } },
      { status: 500 }
    );
  }
}

// DELETE - Delete third-party API
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
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Third-party API ID is required' } },
        { status: 400 }
      );
    }

    // Verify ownership
    const existing = await db.integration.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Third-party API not found' } },
        { status: 404 }
      );
    }

    await db.integration.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Third-party API deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting third-party API:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete third-party API' } },
      { status: 500 }
    );
  }
}
