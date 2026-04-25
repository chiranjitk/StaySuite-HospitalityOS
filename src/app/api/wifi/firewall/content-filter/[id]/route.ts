import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';
import { applyToNftables } from '@/lib/nftables-helper';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/wifi/firewall/content-filter/[id] - Get single content filter
export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(request, 'network.manage');
  if (user instanceof NextResponse) return user;

  try {
    const { id } = await params;

    const filter = await db.contentFilter.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!filter) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Content filter not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: filter });
  } catch (error) {
    console.error('Error fetching content filter:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch content filter' } },
      { status: 500 }
    );
  }
}

// PUT /api/wifi/firewall/content-filter/[id] - Update content filter
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(request, 'network.manage');
  if (user instanceof NextResponse) return user;

  try {
    const { id } = await params;
    const body = await request.json();

    const existingFilter = await db.contentFilter.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existingFilter) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Content filter not found' } },
        { status: 404 }
      );
    }

    const { name, category, domains, enabled, scheduleId } = body;

    // Validate category if provided
    if (category) {
      const validCategories = ['social_media', 'streaming', 'adult', 'gaming', 'malware', 'ads', 'custom'];
      if (!validCategories.includes(category)) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid category. Must be one of: ${validCategories.join(', ')}` } },
          { status: 400 }
        );
      }
    }

    const filter = await db.contentFilter.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(category !== undefined && { category }),
        ...(domains !== undefined && { domains: JSON.stringify(domains) }),
        ...(enabled !== undefined && { enabled }),
        ...(scheduleId !== undefined && { scheduleId }),
      },
    });

    // Apply to nftables (best effort, non-blocking) — re-add updated domains
    let newDomains: string[] = [];
    try {
      newDomains = filter.domains ? JSON.parse(filter.domains) : [];
    } catch {
      newDomains = [];
    }
    // Remove old domains first, then add new ones
    let oldDomains: string[] = [];
    try {
      oldDomains = existingFilter.domains ? JSON.parse(existingFilter.domains) : [];
    } catch {
      oldDomains = [];
    }
    for (const domain of oldDomains) {
      applyToNftables('/api/content-filter', 'DELETE', { domain });
    }
    for (const domain of newDomains) {
      applyToNftables('/api/content-filter', 'POST', { domain, action: 'block' });
    }

    return NextResponse.json({ success: true, data: filter });
  } catch (error) {
    console.error('Error updating content filter:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update content filter' } },
      { status: 500 }
    );
  }
}

// DELETE /api/wifi/firewall/content-filter/[id] - Delete content filter
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(request, 'network.manage');
  if (user instanceof NextResponse) return user;

  try {
    const { id } = await params;

    const existingFilter = await db.contentFilter.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existingFilter) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Content filter not found' } },
        { status: 404 }
      );
    }

    await db.contentFilter.delete({ where: { id } });

    // Apply to nftables (best effort, non-blocking) — remove domains from nftables
    let oldDomains: string[] = [];
    try {
      oldDomains = existingFilter.domains ? JSON.parse(existingFilter.domains) : [];
    } catch {
      oldDomains = [];
    }
    for (const domain of oldDomains) {
      applyToNftables('/api/content-filter', 'DELETE', { domain });
    }

    return NextResponse.json({ success: true, message: 'Content filter deleted successfully' });
  } catch (error) {
    console.error('Error deleting content filter:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete content filter' } },
      { status: 500 }
    );
  }
}
