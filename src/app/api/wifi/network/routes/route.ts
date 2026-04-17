/**
 * Static Routes API Route
 *
 * List, create, update, and delete static routes for a property.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';
import { addRoute, addDefaultRoute, deleteRoute, persistRouteAdd, persistRouteRemove } from '@/lib/network';

// GET /api/wifi/network/routes - List all static routes
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');
    const isDefault = searchParams.get('isDefault');
    const enabled = searchParams.get('enabled');

    const where: Record<string, unknown> = { tenantId: user.tenantId };
    if (propertyId) where.propertyId = propertyId;
    if (isDefault !== null) {
      where.isDefault = isDefault === 'true';
    }
    if (enabled !== null) {
      where.enabled = enabled === 'true';
    }

    const routes = await db.staticRoute.findMany({
      where,
      orderBy: [{ isDefault: 'desc' }, { metric: 'asc' }, { name: 'asc' }],
    });

    return NextResponse.json({ success: true, data: routes });
  } catch (error) {
    console.error('Error fetching static routes:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch static routes' } },
      { status: 500 },
    );
  }
}

// POST /api/wifi/network/routes - Create a new static route
export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const tenantId = user.tenantId;

    const {
      propertyId,
      name,
      destination,
      gateway,
      metric = 100,
      interfaceName,
      protocol = 'static',
      isDefault = false,
      description,
    } = body;

    if (!propertyId || !name || !destination || !gateway) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: propertyId, name, destination, gateway' } },
        { status: 400 },
      );
    }

    // Execute OS-level route creation via shell script
    try {
      let osResult;
      if (isDefault) {
        osResult = addDefaultRoute(gateway, interfaceName || undefined);
      } else {
        osResult = addRoute({
          destination,
          gateway,
          metric: parseInt(String(metric), 10),
          interface: interfaceName || undefined,
        });
      }
      if (!osResult.success) {
        return NextResponse.json(
          { success: false, error: { code: 'OS_ERROR', message: `Failed to add route at OS level: ${osResult.error}` } },
          { status: 500 },
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        { success: false, error: { code: 'OS_ERROR', message: `Failed to add route at OS level: ${msg}` } },
        { status: 500 },
      );
    }

    // Persist route to /etc/network/interfaces
    if (interfaceName) {
      try {
        const persistResult = persistRouteAdd({
          interface: interfaceName,
          destination: isDefault ? 'default' : destination,
          gateway,
        });
        if (!persistResult.success) {
          console.warn(`Route persistence warning:`, persistResult.error);
        }
      } catch (err) {
        console.warn(`Route persistence error:`, err instanceof Error ? err.message : err);
      }
    }

    const route = await db.staticRoute.create({
      data: {
        tenant: { connect: { id: tenantId } },
        property: { connect: { id: propertyId } },
        name,
        destination,
        gateway,
        metric: parseInt(metric, 10),
        interfaceName,
        protocol,
        isDefault,
        enabled: true,
        description,
      },
    });

    return NextResponse.json({ success: true, data: route }, { status: 201 });
  } catch (error) {
    console.error('Error creating static route:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create static route' } },
      { status: 500 },
    );
  }
}

// PUT /api/wifi/network/routes - Update one or many static routes
export async function PUT(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const tenantId = user.tenantId;

    // Bulk update: { routes: [{ id, ...fields }, ...] }
    if (body.routes && Array.isArray(body.routes)) {
      const results = await Promise.all(
        body.routes.map(async (item: Record<string, unknown>) => {
          const { id, ...fields } = item;
          if (!id) return null;

          const existing = await db.staticRoute.findFirst({
            where: { id: id as string, tenantId },
          });
          if (!existing) return null;

          const updateData: Record<string, unknown> = {};
          if (fields.name !== undefined) updateData.name = fields.name;
          if (fields.destination !== undefined) updateData.destination = fields.destination;
          if (fields.gateway !== undefined) updateData.gateway = fields.gateway;
          if (fields.metric !== undefined) updateData.metric = typeof fields.metric === 'number' ? fields.metric : parseInt(String(fields.metric), 10);
          if (fields.interfaceName !== undefined) updateData.interfaceName = fields.interfaceName;
          if (fields.protocol !== undefined) updateData.protocol = fields.protocol;
          if (fields.isDefault !== undefined) updateData.isDefault = fields.isDefault;
          if (fields.enabled !== undefined) updateData.enabled = fields.enabled;
          if (fields.description !== undefined) updateData.description = fields.description;

          return db.staticRoute.update({
            where: { id: id as string },
            data: updateData,
          });
        }),
      );

      const updated = results.filter(Boolean);
      return NextResponse.json({
        success: true,
        data: updated,
        message: `Updated ${updated.length} route(s)`,
      });
    }

    // Single update: { id, ...fields }
    const { id, ...fields } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required field: id' } },
        { status: 400 },
      );
    }

    const existing = await db.staticRoute.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Static route not found' } },
        { status: 404 },
      );
    }

    const updateData: Record<string, unknown> = {};
    if (fields.name !== undefined) updateData.name = fields.name;
    if (fields.destination !== undefined) updateData.destination = fields.destination;
    if (fields.gateway !== undefined) updateData.gateway = fields.gateway;
    if (fields.metric !== undefined) updateData.metric = typeof fields.metric === 'number' ? fields.metric : parseInt(String(fields.metric), 10);
    if (fields.interfaceName !== undefined) updateData.interfaceName = fields.interfaceName;
    if (fields.protocol !== undefined) updateData.protocol = fields.protocol;
    if (fields.isDefault !== undefined) updateData.isDefault = fields.isDefault;
    if (fields.enabled !== undefined) updateData.enabled = fields.enabled;
    if (fields.description !== undefined) updateData.description = fields.description;

    const route = await db.staticRoute.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: route });
  } catch (error) {
    console.error('Error updating static route:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update static route' } },
      { status: 500 },
    );
  }
}

// DELETE /api/wifi/network/routes - Delete a static route by id
export async function DELETE(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required query parameter: id' } },
        { status: 400 },
      );
    }

    const existing = await db.staticRoute.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Static route not found' } },
        { status: 404 },
      );
    }

    // Execute OS-level route deletion via shell script
    try {
      const osResult = deleteRoute(existing.destination, existing.gateway);
      if (!osResult.success) {
        console.warn(`OS route removal failed:`, osResult.error);
      }
    } catch (err) {
      console.warn(`OS route removal error:`, err instanceof Error ? err.message : err);
    }

    // Remove persisted route from /etc/network/interfaces
    if (existing.interfaceName) {
      try {
        persistRouteRemove(existing.interfaceName, existing.destination, existing.gateway);
      } catch (err) {
        console.warn(`Route persistence removal error:`, err instanceof Error ? err.message : err);
      }
    }

    await db.staticRoute.delete({ where: { id } });

    return NextResponse.json({ success: true, message: 'Static route deleted successfully' });
  } catch (error) {
    console.error('Error deleting static route:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete static route' } },
      { status: 500 },
    );
  }
}
