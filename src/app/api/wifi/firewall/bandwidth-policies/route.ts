import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';
import { applyToNftables } from '@/lib/nftables-helper';

// GET /api/wifi/firewall/bandwidth-policies - List bandwidth policies
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'network.manage');
  if (user instanceof NextResponse) return user;

  try {
    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');
    const planId = searchParams.get('planId');
    const enabled = searchParams.get('enabled');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    const where: Record<string, unknown> = { tenantId: user.tenantId };

    if (propertyId) where.propertyId = propertyId;
    if (planId) where.planId = planId;
    if (enabled !== null && enabled !== undefined) where.enabled = enabled === 'true';

    const policies = await db.bandwidthPolicy.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      ...(limit && { take: parseInt(limit, 10) }),
      ...(offset && { skip: parseInt(offset, 10) }),
    });

    const total = await db.bandwidthPolicy.count({ where });

    return NextResponse.json({
      success: true,
      data: policies,
      pagination: {
        total,
        limit: limit ? parseInt(limit, 10) : null,
        offset: offset ? parseInt(offset, 10) : null,
      },
    });
  } catch (error) {
    console.error('Error fetching bandwidth policies:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch bandwidth policies' } },
      { status: 500 }
    );
  }
}

// POST /api/wifi/firewall/bandwidth-policies - Create a new bandwidth policy
export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'network.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const {
      propertyId,
      name,
      downloadKbps = 10240,
      uploadKbps = 10240,
      burstDownloadKbps,
      burstUploadKbps,
      priority = 5,
      planId,
      description,
      enabled = true,
    } = body;

    if (!propertyId || !name) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: propertyId, name' } },
        { status: 400 }
      );
    }

    if (downloadKbps < 0 || uploadKbps < 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Bandwidth values must be non-negative' } },
        { status: 400 }
      );
    }

    if (priority < 0 || priority > 10) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Priority must be between 0 (highest) and 10 (lowest)' } },
        { status: 400 }
      );
    }

    const policy = await db.bandwidthPolicy.create({
      data: {
        tenantId: user.tenantId,
        propertyId,
        name,
        downloadKbps: parseInt(downloadKbps, 10),
        uploadKbps: parseInt(uploadKbps, 10),
        burstDownloadKbps: burstDownloadKbps ? parseInt(burstDownloadKbps, 10) : null,
        burstUploadKbps: burstUploadKbps ? parseInt(burstUploadKbps, 10) : null,
        priority: parseInt(priority, 10),
        planId,
        description,
        enabled,
      },
    });

    // Apply to nftables (best effort, non-blocking)
    applyToNftables('/api/bandwidth', 'POST', {
      downloadKbps,
      uploadKbps,
    });

    return NextResponse.json({ success: true, data: policy }, { status: 201 });
  } catch (error) {
    console.error('Error creating bandwidth policy:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create bandwidth policy' } },
      { status: 500 }
    );
  }
}
