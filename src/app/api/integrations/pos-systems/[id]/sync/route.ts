import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';// POST /api/integrations/pos-systems/[id]/sync - Sync menu items or orders
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requirePermission(request, 'integrations.manage');
    if (user instanceof NextResponse) return user;

      try {
    const { id: integrationId } = await params;
    const body = await request.json();
    const { syncType = 'full', direction = 'import' } = body;

    // Get integration
    const integration = await db.integration.findUnique({
      where: { id: integrationId },
    });

    if (!integration) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Integration not found' } },
        { status: 404 }
      );
    }

    if (integration.status !== 'active') {
      return NextResponse.json(
        { success: false, error: { code: 'INACTIVE', message: 'Integration is not active' } },
        { status: 400 }
      );
    }

    const config = JSON.parse(integration.config) as Record<string, unknown>;
    const provider = config.provider as string;
    const syncSettings = config.syncSettings as Record<string, unknown> || {};

    const syncResult: Record<string, unknown> = {
      integrationId,
      provider,
      syncType,
      direction,
      startedAt: new Date(),
    };

    try {
      if (syncType === 'menu' || syncType === 'full') {
        const menuSync = await syncMenuItems({ id: integration.id, tenantId: integration.tenantId, propertyId: null, config: integration.config }, direction);
        syncResult.menuSync = menuSync;
      }

      if (syncType === 'orders' || syncType === 'full') {
        const orderSync = await syncOrders({ id: integration.id, tenantId: integration.tenantId, propertyId: null, config: integration.config }, direction);
        syncResult.orderSync = orderSync;
      }

      if (syncType === 'inventory') {
        const inventorySync = await syncInventory({ id: integration.id, tenantId: integration.tenantId, config: integration.config }, direction);
        syncResult.inventorySync = inventorySync;
      }

      // Update last sync time
      await db.integration.update({
        where: { id: integrationId },
        data: { lastSyncAt: new Date() },
      });

      syncResult.status = 'success';
      syncResult.completedAt = new Date();

      return NextResponse.json({
        success: true,
        data: syncResult,
      });
    } catch (syncError) {
      throw syncError;
    }
  } catch (error) {
    console.error('Error syncing POS:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to sync POS' } },
      { status: 500 }
    );
  }
}

/**
 * Sync menu items from/to POS
 */
async function syncMenuItems(
  integration: { id: string; tenantId: string; propertyId: string | null; config: string },
  direction: string
): Promise<{ imported: number; updated: number; skipped: number }> {
  const config = JSON.parse(integration.config) as Record<string, unknown>;
  const provider = config.provider as string;

  if (direction === 'import') {
    // Fetch menu items from POS
    const externalItems = await fetchMenuFromPOS(provider, config);

    let imported = 0;
    let updated = 0;
    let skipped = 0;

    for (const item of externalItems) {
      // Check if item exists by name (no posId field on MenuItem)
      const existing = await db.menuItem.findFirst({
        where: {
          propertyId: integration.propertyId || '',
          name: item.name,
        },
      });

      if (existing) {
        // Update existing item
        await db.menuItem.update({
          where: { id: existing.id },
          data: {
            price: item.price,
            description: item.description || existing.description,
            isAvailable: item.available,
          },
        });
        updated++;
      } else {
        // Create new item - requires categoryId, use a fallback
        const categories = await db.orderCategory.findMany({
          where: { propertyId: integration.propertyId || '' },
          take: 1,
        });

        if (categories.length === 0) {
          skipped++;
          continue;
        }

        await db.menuItem.create({
          data: {
            propertyId: integration.propertyId || '',
            categoryId: categories[0].id,
            name: item.name,
            description: item.description,
            price: item.price,
            isAvailable: item.available,
          },
        });
        imported++;
      }
    }

    return { imported, updated, skipped };
  } else {
    // Export menu items to POS
    const localItems = await db.menuItem.findMany({
      where: { propertyId: integration.propertyId || '' },
    });

    let updated = 0;

    for (const item of localItems) {
      const success = await pushMenuItemToPOS(provider, config, { name: item.name, id: item.id, price: item.price });
      if (success) {
        updated++;
      }
    }

    return { imported: 0, updated, skipped: localItems.length - updated };
  }
}

/**
 * Sync orders from/to POS
 */
async function syncOrders(
  integration: { id: string; tenantId: string; propertyId: string | null; config: string },
  direction: string
): Promise<{ imported: number; exported: number; errors: string[] }> {
  const config = JSON.parse(integration.config) as Record<string, unknown>;
  const provider = config.provider as string;
  const errors: string[] = [];

  if (direction === 'import') {
    // Fetch new orders from POS
    const externalOrders = await fetchOrdersFromPOS(provider, config);
    let imported = 0;

    for (const order of externalOrders) {
      try {
        const orderData = order as Record<string, unknown>;
        // Check if order exists by orderNumber
        const existing = await db.order.findFirst({
          where: {
            orderNumber: (orderData.orderNumber as string) || '',
          },
        });

        if (!existing) {
          // Create order
          await db.order.create({
            data: {
              tenantId: integration.tenantId,
              propertyId: integration.propertyId || '',
              orderNumber: (orderData.orderNumber as string) || `POS-${Date.now()}`,
              orderType: (orderData.orderType as string) || 'dine_in',
              status: (orderData.status as string) || 'pending',
              kitchenStatus: 'pending',
              subtotal: (orderData.subtotal as number) || 0,
              taxes: (orderData.taxes as number) || 0,
              totalAmount: (orderData.totalAmount as number) || 0,
              guestName: (orderData.guestName as string) || null,
            },
          });
          imported++;
        }
      } catch (error) {
        errors.push(`Order: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return { imported, exported: 0, errors };
  } else {
    // Export orders to POS
    const localOrders = await db.order.findMany({
      where: {
        tenantId: integration.tenantId,
        status: { notIn: ['cancelled'] },
      },
      include: { items: true },
    });

    let exported = 0;

    for (const order of localOrders) {
      try {
        const posOrderId = await pushOrderToPOS(provider, config, { id: order.id, orderNumber: order.orderNumber });
        if (posOrderId) {
          exported++;
        }
      } catch (error) {
        errors.push(`Order ${order.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return { imported: 0, exported, errors };
  }
}

/**
 * Sync inventory from/to POS
 */
async function syncInventory(
  integration: { id: string; tenantId: string; config: string },
  direction: string
): Promise<{ updated: number; errors: string[] }> {
  // Simplified inventory sync
  return { updated: 0, errors: [] };
}

/**
 * Fetch menu from POS provider
 */
async function fetchMenuFromPOS(
  provider: string,
  config: Record<string, unknown>
): Promise<Array<{
  externalId: string;
  name: string;
  description?: string;
  price: number;
  category?: string;
  available: boolean;
}>> {
  // In production, this would call the actual POS API
  // For now, return mock data
  console.log(`Fetching menu from ${provider}`);

  return [
    { externalId: 'item-1', name: 'Margherita Pizza', description: 'Classic tomato and mozzarella', price: 15.99, category: 'Pizza', available: true },
    { externalId: 'item-2', name: 'Caesar Salad', description: 'Romaine lettuce, parmesan, croutons', price: 9.99, category: 'Salads', available: true },
    { externalId: 'item-3', name: 'Grilled Salmon', description: 'With seasonal vegetables', price: 24.99, category: 'Main Course', available: true },
    { externalId: 'item-4', name: 'Tiramisu', description: 'Classic Italian dessert', price: 8.99, category: 'Desserts', available: true },
    { externalId: 'item-5', name: 'Espresso', description: 'Double shot', price: 3.99, category: 'Beverages', available: true },
  ];
}

/**
 * Push menu item to POS
 */
async function pushMenuItemToPOS(
  provider: string,
  config: Record<string, unknown>,
  item: Record<string, unknown>
): Promise<boolean> {
  console.log(`Pushing item ${item.name} to ${provider}`);
  return true;
}

/**
 * Fetch orders from POS
 */
async function fetchOrdersFromPOS(
  provider: string,
  config: Record<string, unknown>
): Promise<Array<Record<string, unknown>>> {
  console.log(`Fetching orders from ${provider}`);
  return [];
}

/**
 * Push order to POS
 */
async function pushOrderToPOS(
  provider: string,
  config: Record<string, unknown>,
  order: Record<string, unknown>
): Promise<string | null> {
  console.log(`Pushing order ${order.id} to ${provider}`);
  return `POS-ORDER-${Date.now()}`;
}

// GET /api/integrations/pos-systems/[id]/sync - Get sync history
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requirePermission(request, 'integrations.manage');
    if (user instanceof NextResponse) return user;

      try {
    const { id: integrationId } = await params;

    // Return integration's lastSyncAt as sync history
    const integration = await db.integration.findUnique({
      where: { id: integrationId },
    });

    if (!integration) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Integration not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: [{
        id: integration.id,
        lastSyncAt: integration.lastSyncAt,
        status: integration.status,
        lastError: integration.lastError,
      }],
    });
  } catch (error) {
    console.error('Error fetching sync history:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch sync history' } },
      { status: 500 }
    );
  }
}
