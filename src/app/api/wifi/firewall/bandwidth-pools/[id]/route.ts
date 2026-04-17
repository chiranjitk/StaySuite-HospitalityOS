import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/wifi/firewall/bandwidth-pools/[id] - Get single bandwidth pool
export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(request, 'network.manage');
  if (user instanceof NextResponse) return user;

  try {
    const { id } = await params;

    const pool = await db.bandwidthPool.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!pool) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Bandwidth pool not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: pool });
  } catch (error) {
    console.error('Error fetching bandwidth pool:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch bandwidth pool' } },
      { status: 500 }
    );
  }
}

// PUT /api/wifi/firewall/bandwidth-pools/[id] - Update bandwidth pool
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(request, 'network.manage');
  if (user instanceof NextResponse) return user;

  try {
    const { id } = await params;
    const body = await request.json();

    const existingPool = await db.bandwidthPool.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existingPool) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Bandwidth pool not found' } },
        { status: 404 }
      );
    }

    const { name, subnet, vlanId, totalDownloadKbps, totalUploadKbps, perUserDownloadKbps, perUserUploadKbps, enabled } = body;

    if (totalDownloadKbps !== undefined && totalDownloadKbps < 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'totalDownloadKbps must be non-negative' } },
        { status: 400 }
      );
    }
    if (totalUploadKbps !== undefined && totalUploadKbps < 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'totalUploadKbps must be non-negative' } },
        { status: 400 }
      );
    }

    const pool = await db.bandwidthPool.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(subnet !== undefined && { subnet }),
        ...(vlanId !== undefined && { vlanId: vlanId ? parseInt(vlanId, 10) : null }),
        ...(totalDownloadKbps !== undefined && { totalDownloadKbps: parseInt(totalDownloadKbps, 10) }),
        ...(totalUploadKbps !== undefined && { totalUploadKbps: parseInt(totalUploadKbps, 10) }),
        ...(perUserDownloadKbps !== undefined && { perUserDownloadKbps: perUserDownloadKbps ? parseInt(perUserDownloadKbps, 10) : null }),
        ...(perUserUploadKbps !== undefined && { perUserUploadKbps: perUserUploadKbps ? parseInt(perUserUploadKbps, 10) : null }),
        ...(enabled !== undefined && { enabled }),
      },
    });

    return NextResponse.json({ success: true, data: pool });
  } catch (error) {
    console.error('Error updating bandwidth pool:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update bandwidth pool' } },
      { status: 500 }
    );
  }
}

// DELETE /api/wifi/firewall/bandwidth-pools/[id] - Delete bandwidth pool
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(request, 'network.manage');
  if (user instanceof NextResponse) return user;

  try {
    const { id } = await params;

    const existingPool = await db.bandwidthPool.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existingPool) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Bandwidth pool not found' } },
        { status: 404 }
      );
    }

    await db.bandwidthPool.delete({ where: { id } });

    return NextResponse.json({ success: true, message: 'Bandwidth pool deleted successfully' });
  } catch (error) {
    console.error('Error deleting bandwidth pool:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete bandwidth pool' } },
      { status: 500 }
    );
  }
}
