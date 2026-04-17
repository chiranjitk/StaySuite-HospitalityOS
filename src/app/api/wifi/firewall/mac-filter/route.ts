import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';
import { applyToNftables, macListTypeToSet } from '@/lib/nftables-helper';

// GET /api/wifi/firewall/mac-filter - List MAC filter entries
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'network.manage');
  if (user instanceof NextResponse) return user;

  try {
    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');
    const listType = searchParams.get('listType');
    const action = searchParams.get('action');
    const enabled = searchParams.get('enabled');
    const search = searchParams.get('search');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    const where: Record<string, unknown> = { tenantId: user.tenantId };

    if (propertyId) where.propertyId = propertyId;
    if (listType) where.listType = listType;
    if (action) where.action = action;
    if (enabled !== null && enabled !== undefined) where.enabled = enabled === 'true';
    if (search) {
      where.OR = [
        { macAddress: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const entries = await db.macFilter.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      ...(limit && { take: parseInt(limit, 10) }),
      ...(offset && { skip: parseInt(offset, 10) }),
    });

    const total = await db.macFilter.count({ where });

    // Summary stats
    const summary = await db.macFilter.groupBy({
      by: ['listType'],
      where: { tenantId: user.tenantId, propertyId: propertyId || undefined },
      _count: { id: true },
    });

    return NextResponse.json({
      success: true,
      data: entries,
      pagination: {
        total,
        limit: limit ? parseInt(limit, 10) : null,
        offset: offset ? parseInt(offset, 10) : null,
      },
      summary: summary.reduce((acc: Record<string, number>, item) => {
        acc[item.listType] = item._count.id;
        return acc;
      }, {}),
    });
  } catch (error) {
    console.error('Error fetching MAC filter entries:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch MAC filter entries' } },
      { status: 500 }
    );
  }
}

// POST /api/wifi/firewall/mac-filter - Add a MAC filter entry
export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'network.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const {
      propertyId,
      macAddress,
      action = 'allow',
      listType = 'blacklist',
      description,
      linkedType,
      linkedId,
      expiresAt,
      enabled = true,
    } = body;

    if (!propertyId || !macAddress) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: propertyId, macAddress' } },
        { status: 400 }
      );
    }

    // Normalize MAC address format
    const normalizedMac = macAddress.trim().toLowerCase();
    const macRegex = /^([0-9a-f]{2}[:-]){5}([0-9a-f]{2})$/;
    if (!macRegex.test(normalizedMac)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid MAC address format. Use XX:XX:XX:XX:XX:XX or XX-XX-XX-XX-XX-XX' } },
        { status: 400 }
      );
    }

    // Validate listType
    const validListTypes = ['whitelist', 'blacklist'];
    if (!validListTypes.includes(listType)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid listType. Must be one of: ${validListTypes.join(', ')}` } },
        { status: 400 }
      );
    }

    // Validate action
    const validActions = ['allow', 'deny'];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid action. Must be one of: ${validActions.join(', ')}` } },
        { status: 400 }
      );
    }

    // Check for duplicate MAC within property
    const existingEntry = await db.macFilter.findFirst({
      where: { tenantId: user.tenantId, propertyId, macAddress: normalizedMac },
    });

    if (existingEntry) {
      return NextResponse.json(
        { success: false, error: { code: 'DUPLICATE_MAC', message: 'A MAC filter entry for this address already exists on this property' } },
        { status: 400 }
      );
    }

    const entry = await db.macFilter.create({
      data: {
        tenantId: user.tenantId,
        propertyId,
        macAddress: normalizedMac,
        action,
        listType,
        description,
        linkedType,
        linkedId,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        enabled,
      },
    });

    // Apply to nftables (best effort, non-blocking)
    applyToNftables('/api/mac-filter', 'POST', {
      macAddress: normalizedMac,
      listType,
      action: 'add',
      set: macListTypeToSet(listType),
      address: normalizedMac,
    });

    return NextResponse.json({ success: true, data: entry }, { status: 201 });
  } catch (error) {
    console.error('Error creating MAC filter entry:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create MAC filter entry' } },
      { status: 500 }
    );
  }
}
