import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';
import { fullApplyToNftables } from '@/lib/nftables-helper';

// GET /api/wifi/firewall/rules - List firewall rules with filters
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'network.manage');
  if (user instanceof NextResponse) return user;

  try {
    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');
    const zoneId = searchParams.get('zoneId');
    const chain = searchParams.get('chain');
    const protocol = searchParams.get('protocol');
    const action = searchParams.get('action');
    const enabled = searchParams.get('enabled');
    const limit = searchParams.get('limit');
    const offset = searchParams.get('offset');

    const where: Record<string, unknown> = { tenantId: user.tenantId };

    if (propertyId) where.propertyId = propertyId;
    if (zoneId) where.zoneId = zoneId;
    if (chain) where.chain = chain;
    if (protocol) where.protocol = protocol;
    if (action) where.action = action;
    if (enabled !== null && enabled !== undefined) where.enabled = enabled === 'true';

    const rules = await db.firewallRule.findMany({
      where,
      include: {
        firewallZone: {
          select: { id: true, name: true },
        },
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
      ...(limit && { take: parseInt(limit, 10) }),
      ...(offset && { skip: parseInt(offset, 10) }),
    });

    const total = await db.firewallRule.count({ where });

    return NextResponse.json({
      success: true,
      data: rules,
      pagination: {
        total,
        limit: limit ? parseInt(limit, 10) : null,
        offset: offset ? parseInt(offset, 10) : null,
      },
    });
  } catch (error) {
    console.error('Error fetching firewall rules:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch firewall rules' } },
      { status: 500 }
    );
  }
}

// POST /api/wifi/firewall/rules - Create a new firewall rule
export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'network.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const {
      propertyId,
      zoneId,
      chain = 'input',
      protocol,
      sourceIp,
      sourcePort,
      destIp,
      destPort,
      action = 'accept',
      jumpTarget,
      logPrefix,
      enabled = true,
      comment,
      priority = 0,
      scheduleId,
    } = body;

    if (!propertyId || !zoneId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: propertyId, zoneId' } },
        { status: 400 }
      );
    }

    // Validate zone exists and belongs to tenant
    const zone = await db.firewallZone.findFirst({
      where: { id: zoneId, tenantId: user.tenantId, propertyId },
    });

    if (!zone) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Firewall zone not found' } },
        { status: 404 }
      );
    }

    const validChains = ['input', 'forward', 'output', 'prerouting', 'postrouting'];
    if (!validChains.includes(chain)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid chain. Must be one of: ${validChains.join(', ')}` } },
        { status: 400 }
      );
    }

    const validActions = ['accept', 'drop', 'reject', 'log', 'jump'];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: `Invalid action. Must be one of: ${validActions.join(', ')}` } },
        { status: 400 }
      );
    }

    if (action === 'jump' && !jumpTarget) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'jumpTarget is required when action is "jump"' } },
        { status: 400 }
      );
    }

    const rule = await db.firewallRule.create({
      data: {
        tenantId: user.tenantId,
        propertyId,
        zoneId,
        chain,
        protocol,
        sourceIp,
        sourcePort: sourcePort !== undefined ? parseInt(sourcePort, 10) : null,
        destIp,
        destPort: destPort !== undefined ? parseInt(destPort, 10) : null,
        action,
        jumpTarget,
        logPrefix,
        enabled,
        comment,
        priority: parseInt(priority, 10),
        scheduleId,
      },
    });

    // Apply to nftables (best effort, non-blocking) — full apply to regenerate all rules
    fullApplyToNftables(user.tenantId);

    return NextResponse.json({ success: true, data: rule }, { status: 201 });
  } catch (error) {
    console.error('Error creating firewall rule:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create firewall rule' } },
      { status: 500 }
    );
  }
}
