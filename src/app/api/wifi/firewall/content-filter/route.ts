import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';
import { applyToNftables } from '@/lib/nftables-helper';

// GET /api/wifi/firewall/content-filter - List content filter categories
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'network.manage');
  if (user instanceof NextResponse) return user;

  try {
    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');
    const category = searchParams.get('category');
    const enabled = searchParams.get('enabled');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    const where: Record<string, unknown> = { tenantId: user.tenantId };

    if (propertyId) where.propertyId = propertyId;
    if (category) where.category = category;
    if (enabled !== null && enabled !== undefined) where.enabled = enabled === 'true';

    const filters = await db.contentFilter.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      ...(limit && { take: parseInt(limit, 10) }),
      ...(offset && { skip: parseInt(offset, 10) }),
    });

    const total = await db.contentFilter.count({ where });

    // Summary by category
    const categorySummary = await db.contentFilter.groupBy({
      by: ['category'],
      where: { tenantId: user.tenantId, propertyId: propertyId || undefined },
      _count: { id: true },
    });

    return NextResponse.json({
      success: true,
      data: filters,
      pagination: {
        total,
        limit: limit ? parseInt(limit, 10) : null,
        offset: offset ? parseInt(offset, 10) : null,
      },
      categorySummary: categorySummary.map((item) => ({
        category: item.category,
        count: item._count.id,
      })),
    });
  } catch (error) {
    console.error('Error fetching content filters:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch content filters' } },
      { status: 500 }
    );
  }
}

// POST /api/wifi/firewall/content-filter - Create a new content filter category
export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'network.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const {
      propertyId,
      name,
      category,
      domains,
      enabled = true,
      scheduleId,
    } = body;

    if (!propertyId || !name || !category) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: propertyId, name, category' } },
        { status: 400 }
      );
    }

    const validCategories = ['social_media', 'streaming', 'adult', 'gaming', 'malware', 'ads', 'custom'];
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid category. Must be one of: ${validCategories.join(', ')}` } },
        { status: 400 }
      );
    }

    const filter = await db.contentFilter.create({
      data: {
        tenantId: user.tenantId,
        propertyId,
        name,
        category,
        domains: domains ? JSON.stringify(domains) : '[]',
        enabled,
        scheduleId,
      },
    });

    // Apply to nftables (best effort, non-blocking)
    // Parse domains and send each to nftables content-filter endpoint
    let domainList: string[] = [];
    try {
      domainList = domains ? JSON.parse(domains) : [];
    } catch {
      domainList = [];
    }
    for (const domain of domainList) {
      applyToNftables('/api/content-filter', 'POST', {
        domain,
        action: 'block',
      });
    }

    return NextResponse.json({ success: true, data: filter }, { status: 201 });
  } catch (error) {
    console.error('Error creating content filter:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create content filter' } },
      { status: 500 }
    );
  }
}
