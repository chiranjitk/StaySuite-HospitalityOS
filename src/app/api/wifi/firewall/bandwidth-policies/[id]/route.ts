import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';
import { applyToNftables } from '@/lib/nftables-helper';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/wifi/firewall/bandwidth-policies/[id] - Get single bandwidth policy
export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(request, 'network.manage');
  if (user instanceof NextResponse) return user;

  try {
    const { id } = await params;

    const policy = await db.bandwidthPolicy.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!policy) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Bandwidth policy not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: policy });
  } catch (error) {
    console.error('Error fetching bandwidth policy:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch bandwidth policy' } },
      { status: 500 }
    );
  }
}

// PUT /api/wifi/firewall/bandwidth-policies/[id] - Update bandwidth policy
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(request, 'network.manage');
  if (user instanceof NextResponse) return user;

  try {
    const { id } = await params;
    const body = await request.json();

    const existingPolicy = await db.bandwidthPolicy.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existingPolicy) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Bandwidth policy not found' } },
        { status: 404 }
      );
    }

    const { name, downloadKbps, uploadKbps, burstDownloadKbps, burstUploadKbps, priority, planId, description, enabled } = body;

    if (downloadKbps !== undefined && downloadKbps < 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'downloadKbps must be non-negative' } },
        { status: 400 }
      );
    }
    if (uploadKbps !== undefined && uploadKbps < 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'uploadKbps must be non-negative' } },
        { status: 400 }
      );
    }
    if (priority !== undefined && (priority < 0 || priority > 10)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Priority must be between 0 (highest) and 10 (lowest)' } },
        { status: 400 }
      );
    }

    const policy = await db.bandwidthPolicy.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(downloadKbps !== undefined && { downloadKbps: parseInt(downloadKbps, 10) }),
        ...(uploadKbps !== undefined && { uploadKbps: parseInt(uploadKbps, 10) }),
        ...(burstDownloadKbps !== undefined && { burstDownloadKbps: burstDownloadKbps ? parseInt(burstDownloadKbps, 10) : null }),
        ...(burstUploadKbps !== undefined && { burstUploadKbps: burstUploadKbps ? parseInt(burstUploadKbps, 10) : null }),
        ...(priority !== undefined && { priority: parseInt(priority, 10) }),
        ...(planId !== undefined && { planId }),
        ...(description !== undefined && { description }),
        ...(enabled !== undefined && { enabled }),
      },
    });

    // Apply to nftables (best effort, non-blocking)
    applyToNftables('/api/bandwidth', 'POST', {
      downloadKbps: policy.downloadKbps,
      uploadKbps: policy.uploadKbps,
    });

    return NextResponse.json({ success: true, data: policy });
  } catch (error) {
    console.error('Error updating bandwidth policy:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update bandwidth policy' } },
      { status: 500 }
    );
  }
}

// DELETE /api/wifi/firewall/bandwidth-policies/[id] - Delete bandwidth policy
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const user = await requirePermission(request, 'network.manage');
  if (user instanceof NextResponse) return user;

  try {
    const { id } = await params;

    const existingPolicy = await db.bandwidthPolicy.findFirst({
      where: { id, tenantId: user.tenantId },
    });

    if (!existingPolicy) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Bandwidth policy not found' } },
        { status: 404 }
      );
    }

    await db.bandwidthPolicy.delete({ where: { id } });

    // Apply to nftables (best effort, non-blocking) — full apply to regenerate rules
    applyToNftables('/api/bandwidth', 'POST', {
      action: 'remove',
      name: existingPolicy.name,
    });

    return NextResponse.json({ success: true, message: 'Bandwidth policy deleted successfully' });
  } catch (error) {
    console.error('Error deleting bandwidth policy:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete bandwidth policy' } },
      { status: 500 }
    );
  }
}
