import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';
import { applyToNftables } from '@/lib/nftables-helper';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/wifi/firewall/zones/[id] - Get single firewall zone
export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(request, 'network.manage');
  if (user instanceof NextResponse) return user;

  try {
    const { id } = await params;

    const zone = await db.firewallZone.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        rules: {
          orderBy: { priority: 'asc' },
        },
      },
    });

    if (!zone) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Firewall zone not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: zone });
  } catch (error) {
    console.error('Error fetching firewall zone:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch firewall zone' } },
      { status: 500 }
    );
  }
}

// PUT /api/wifi/firewall/zones/[id] - Update firewall zone
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(request, 'network.manage');
  if (user instanceof NextResponse) return user;

  try {
    const { id } = await params;
    const body = await request.json();

    const existingZone = await db.firewallZone.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existingZone) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Firewall zone not found' } },
        { status: 404 }
      );
    }

    const { interfaces, inputPolicy, forwardPolicy, outputPolicy, masquerade, description } = body;

    const zone = await db.firewallZone.update({
      where: { id },
      data: {
        ...(interfaces !== undefined && { interfaces: JSON.stringify(interfaces) }),
        ...(inputPolicy !== undefined && { inputPolicy }),
        ...(forwardPolicy !== undefined && { forwardPolicy }),
        ...(outputPolicy !== undefined && { outputPolicy }),
        ...(masquerade !== undefined && { masquerade }),
        ...(description !== undefined && { description }),
      },
    });

    // Apply to nftables (best effort, non-blocking) — recreate the zone with updated policies
    applyToNftables('/api/zones', 'POST', {
      name: zone.name,
      inputPolicy: zone.inputPolicy,
      forwardPolicy: zone.forwardPolicy,
      outputPolicy: zone.outputPolicy,
    });

    return NextResponse.json({ success: true, data: zone });
  } catch (error) {
    console.error('Error updating firewall zone:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update firewall zone' } },
      { status: 500 }
    );
  }
}

// DELETE /api/wifi/firewall/zones/[id] - Delete firewall zone
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(request, 'network.manage');
  if (user instanceof NextResponse) return user;

  try {
    const { id } = await params;

    const existingZone = await db.firewallZone.findFirst({
      where: { id, tenantId: user.tenantId },
      include: {
        _count: {
          select: { rules: true },
        },
      },
    });

    if (!existingZone) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Firewall zone not found' } },
        { status: 404 }
      );
    }

    if (existingZone._count.rules > 0) {
      return NextResponse.json(
        { success: false, error: { code: 'HAS_DEPENDENTS', message: 'Cannot delete zone with associated rules. Remove or reassign rules first.' } },
        { status: 400 }
      );
    }

    await db.firewallZone.delete({ where: { id } });

    // Apply to nftables (best effort, non-blocking)
    applyToNftables(`/api/zones/${encodeURIComponent(existingZone.name)}`, 'DELETE');

    return NextResponse.json({ success: true, message: 'Firewall zone deleted successfully' });
  } catch (error) {
    console.error('Error deleting firewall zone:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete firewall zone' } },
      { status: 500 }
    );
  }
}
