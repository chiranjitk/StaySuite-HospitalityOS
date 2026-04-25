/**
 * Content Filter API Route
 * 
 * CRUD endpoints for managing web content filters on hotel WiFi.
 * GET: list filters for a property
 * POST: create a new filter
 * PUT: update an existing filter
 * DELETE: delete a filter
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, resolvePropertyId } from '@/lib/auth/tenant-context';

// GET /api/wifi/content-filter - List content filters
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const searchParams = request.nextUrl.searchParams;
    const propertyId = await resolvePropertyId(user, searchParams.get('propertyId'));
    const category = searchParams.get('category');
    const enabled = searchParams.get('enabled');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');
    const testUrl = searchParams.get('testUrl');

    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: 'No property found. Please create a property first.' },
        { status: 400 }
      );
    }

    // URL test mode
    if (testUrl) {
      const { contentFilterService } = await import('@/lib/wifi/services/content-filter-service');
      const result = await contentFilterService.testUrl(testUrl, propertyId);
      return NextResponse.json({ success: true, data: result });
    }

    const where: Record<string, unknown> = {
      tenantId: user.tenantId,
      propertyId,
    };

    if (category) where.category = category;
    if (enabled !== null && enabled !== undefined) where.enabled = enabled === 'true';

    const [filters, total] = await Promise.all([
      db.contentFilter.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...(limit && { take: parseInt(limit, 10) }),
        ...(offset && { skip: parseInt(offset, 10) }),
      }),
      db.contentFilter.count({ where }),
    ]);

    // Parse domains from JSON strings
    const parsed = filters.map((f) => ({
      ...f,
      domains: safeJsonParse(f.domains),
    }));

    return NextResponse.json({
      success: true,
      data: parsed,
      pagination: {
        total,
        limit: limit ? parseInt(limit, 10) : null,
        offset: offset ? parseInt(offset, 10) : null,
      },
    });
  } catch (error) {
    console.error('Error fetching content filters:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch content filters' },
      { status: 500 }
    );
  }
}

// POST /api/wifi/content-filter - Create a new content filter
export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const propertyId = await resolvePropertyId(user, body.propertyId);
    const { name, category, domains, enabled, scheduleId } = body;

    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: 'No property found. Please create a property first.' },
        { status: 400 }
      );
    }

    if (!name || !category) {
      return NextResponse.json(
        { success: false, error: 'name and category are required' },
        { status: 400 }
      );
    }

    const validCategories = ['social_media', 'streaming', 'adult', 'gaming', 'malware', 'ads', 'custom'];
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { success: false, error: `Invalid category. Must be one of: ${validCategories.join(', ')}` },
        { status: 400 }
      );
    }

    const filter = await db.contentFilter.create({
      data: {
        tenantId: user.tenantId,
        propertyId,
        name,
        category,
        domains: JSON.stringify(domains || []),
        enabled: enabled ?? true,
        scheduleId,
      },
    });

    return NextResponse.json({ success: true, data: { ...filter, domains: domains || [] } }, { status: 201 });
  } catch (error) {
    console.error('Error creating content filter:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create content filter' },
      { status: 500 }
    );
  }
}

// PUT /api/wifi/content-filter - Update a content filter
export async function PUT(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const { id, name, category, domains, enabled, scheduleId } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Filter ID is required' },
        { status: 400 }
      );
    }

    const existing = await db.contentFilter.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Content filter not found' },
        { status: 404 }
      );
    }

    if (existing.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (category !== undefined) updateData.category = category;
    if (domains !== undefined) updateData.domains = JSON.stringify(domains);
    if (enabled !== undefined) updateData.enabled = enabled;
    if (scheduleId !== undefined) updateData.scheduleId = scheduleId;

    const updated = await db.contentFilter.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: { ...updated, domains: safeJsonParse(updated.domains) },
    });
  } catch (error) {
    console.error('Error updating content filter:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update content filter' },
      { status: 500 }
    );
  }
}

// DELETE /api/wifi/content-filter - Delete a content filter
export async function DELETE(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Filter ID is required' },
        { status: 400 }
      );
    }

    const existing = await db.contentFilter.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Content filter not found' },
        { status: 404 }
      );
    }

    if (existing.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    await db.contentFilter.delete({ where: { id } });

    return NextResponse.json({ success: true, message: 'Content filter deleted' });
  } catch (error) {
    console.error('Error deleting content filter:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete content filter' },
      { status: 500 }
    );
  }
}

/**
 * Safe JSON parse helper
 */
function safeJsonParse(str: string): unknown[] {
  try {
    return JSON.parse(str);
  } catch {
    return [];
  }
}
