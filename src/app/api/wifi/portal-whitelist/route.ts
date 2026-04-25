/**
 * Portal Whitelist API Route
 * 
 * CRUD endpoints for managing the captive portal whitelist.
 * Whitelisted domains bypass authentication for guest convenience.
 * GET: list whitelist entries for a property
 * POST: add a whitelist entry
 * PUT: update a whitelist entry
 * DELETE: delete a whitelist entry
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, resolvePropertyId } from '@/lib/auth/tenant-context';

// GET /api/wifi/portal-whitelist - List portal whitelist entries
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const searchParams = request.nextUrl.searchParams;
    const propertyId = await resolvePropertyId(user, searchParams.get('propertyId'));
    const status = searchParams.get('status');
    const protocol = searchParams.get('protocol');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');
    const exportConfig = searchParams.get('export');

    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: 'No property found. Please create a property first.' },
        { status: 400 }
      );
    }

    const where: Record<string, unknown> = { propertyId };

    if (status) where.status = status;
    if (protocol) where.protocol = protocol;

    const [entries, total] = await Promise.all([
      db.portalWhitelist.findMany({
        where,
        orderBy: [{ priority: 'desc' }, { domain: 'asc' }],
        ...(limit && { take: parseInt(limit, 10) }),
        ...(offset && { skip: parseInt(offset, 10) }),
      }),
      db.portalWhitelist.count({ where }),
    ]);

    // Export mode — generate DNS config
    if (exportConfig === 'dns') {
      const { portalWhitelistService } = await import('@/lib/wifi/services/portal-whitelist-service');
      const dnsConfig = await portalWhitelistService.exportAsDnsConfig(propertyId);
      return NextResponse.json({ success: true, data: dnsConfig });
    }

    return NextResponse.json({
      success: true,
      data: entries,
      pagination: {
        total,
        limit: limit ? parseInt(limit, 10) : null,
        offset: offset ? parseInt(offset, 10) : null,
      },
    });
  } catch (error) {
    console.error('Error fetching portal whitelist:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch portal whitelist' },
      { status: 500 }
    );
  }
}

// POST /api/wifi/portal-whitelist - Add a whitelist entry
export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const { domain, path, description, protocol, bypassAuth, priority, status } = body;
    const propertyId = await resolvePropertyId(user, body.propertyId);

    if (!propertyId || !domain) {
      return NextResponse.json(
        { success: false, error: 'No property found. Please create a property first.' },
        { status: 400 }
      );
    }

    // Check for duplicate
    const existing = await db.portalWhitelist.findFirst({
      where: {
        propertyId,
        domain: domain.toLowerCase().trim(),
        path: path || null,
      },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'An entry with this domain and path already exists' },
        { status: 409 }
      );
    }

    const entry = await db.portalWhitelist.create({
      data: {
        propertyId,
        domain: domain.toLowerCase().trim(),
        path: path || null,
        description: description || null,
        protocol: protocol || 'https',
        bypassAuth: bypassAuth ?? true,
        priority: priority || 0,
        status: status || 'active',
      },
    });

    return NextResponse.json({ success: true, data: entry }, { status: 201 });
  } catch (error) {
    console.error('Error creating whitelist entry:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create whitelist entry' },
      { status: 500 }
    );
  }
}

// PUT /api/wifi/portal-whitelist - Update a whitelist entry
export async function PUT(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const { id, domain, path, description, protocol, bypassAuth, priority, status } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Entry ID is required' },
        { status: 400 }
      );
    }

    const existing = await db.portalWhitelist.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Whitelist entry not found' },
        { status: 404 }
      );
    }

    // Verify the entry belongs to a property accessible by this tenant
    const authorizedPropertyId = await resolvePropertyId(user, existing.propertyId);
    if (!authorizedPropertyId) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (domain !== undefined) updateData.domain = domain.toLowerCase().trim();
    if (path !== undefined) updateData.path = path;
    if (description !== undefined) updateData.description = description;
    if (protocol !== undefined) updateData.protocol = protocol;
    if (bypassAuth !== undefined) updateData.bypassAuth = bypassAuth;
    if (priority !== undefined) updateData.priority = priority;
    if (status !== undefined) updateData.status = status;

    const updated = await db.portalWhitelist.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error updating whitelist entry:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update whitelist entry' },
      { status: 500 }
    );
  }
}

// DELETE /api/wifi/portal-whitelist - Delete a whitelist entry
export async function DELETE(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Entry ID is required' },
        { status: 400 }
      );
    }

    const existing = await db.portalWhitelist.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Whitelist entry not found' },
        { status: 404 }
      );
    }

    // Verify the entry belongs to a property accessible by this tenant
    const authorizedPropertyId = await resolvePropertyId(user, existing.propertyId);
    if (!authorizedPropertyId) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    await db.portalWhitelist.delete({ where: { id } });

    return NextResponse.json({ success: true, message: 'Whitelist entry deleted' });
  } catch (error) {
    console.error('Error deleting whitelist entry:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete whitelist entry' },
      { status: 500 }
    );
  }
}
