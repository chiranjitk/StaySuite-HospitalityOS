import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';
import { applyToNftables, macListTypeToSet } from '@/lib/nftables-helper';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/wifi/firewall/mac-filter/[id] - Get single MAC filter entry
export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(request, 'network.manage');
  if (user instanceof NextResponse) return user;

  try {
    const { id } = await params;

    const entry = await db.macFilter.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!entry) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'MAC filter entry not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: entry });
  } catch (error) {
    console.error('Error fetching MAC filter entry:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch MAC filter entry' } },
      { status: 500 }
    );
  }
}

// PUT /api/wifi/firewall/mac-filter/[id] - Update MAC filter entry
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(request, 'network.manage');
  if (user instanceof NextResponse) return user;

  try {
    const { id } = await params;
    const body = await request.json();

    const existingEntry = await db.macFilter.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existingEntry) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'MAC filter entry not found' } },
        { status: 404 }
      );
    }

    const { action, listType, description, linkedType, linkedId, expiresAt, enabled } = body;

    // Validate listType if provided
    if (listType) {
      const validListTypes = ['whitelist', 'blacklist'];
      if (!validListTypes.includes(listType)) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid listType. Must be one of: ${validListTypes.join(', ')}` } },
          { status: 400 }
        );
      }
    }

    // Validate action if provided
    if (action) {
      const validActions = ['allow', 'deny'];
      if (!validActions.includes(action)) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid action. Must be one of: ${validActions.join(', ')}` } },
          { status: 400 }
        );
      }
    }

    const entry = await db.macFilter.update({
      where: { id },
      data: {
        ...(action !== undefined && { action }),
        ...(listType !== undefined && { listType }),
        ...(description !== undefined && { description }),
        ...(linkedType !== undefined && { linkedType }),
        ...(linkedId !== undefined && { linkedId }),
        ...(expiresAt !== undefined && { expiresAt: expiresAt ? new Date(expiresAt) : null }),
        ...(enabled !== undefined && { enabled }),
      },
    });

    // Apply to nftables (best effort, non-blocking) — remove old entry and re-add with updated data
    if (existingEntry.listType && existingEntry.macAddress) {
      applyToNftables('/api/mac-filter', 'DELETE', {
        set: macListTypeToSet(existingEntry.listType),
        address: existingEntry.macAddress,
      });
    }
    applyToNftables('/api/mac-filter', 'POST', {
      macAddress: entry.macAddress,
      listType: entry.listType,
      action: 'add',
      set: macListTypeToSet(entry.listType),
      address: entry.macAddress,
    });

    return NextResponse.json({ success: true, data: entry });
  } catch (error) {
    console.error('Error updating MAC filter entry:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update MAC filter entry' } },
      { status: 500 }
    );
  }
}

// DELETE /api/wifi/firewall/mac-filter/[id] - Delete MAC filter entry
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(request, 'network.manage');
  if (user instanceof NextResponse) return user;

  try {
    const { id } = await params;

    const existingEntry = await db.macFilter.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existingEntry) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'MAC filter entry not found' } },
        { status: 404 }
      );
    }

    await db.macFilter.delete({ where: { id } });

    // Apply to nftables (best effort, non-blocking)
    applyToNftables('/api/mac-filter', 'DELETE', {
      set: macListTypeToSet(existingEntry.listType),
      address: existingEntry.macAddress,
    });

    return NextResponse.json({ success: true, message: 'MAC filter entry deleted successfully' });
  } catch (error) {
    console.error('Error deleting MAC filter entry:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete MAC filter entry' } },
      { status: 500 }
    );
  }
}
