/**
 * Multi-WAN Configuration API Route
 *
 * Get, create, update, and delete multi-WAN load balancing/failover configurations
 * including WAN member interfaces.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

// GET /api/wifi/network/multiwan - Get multi-WAN config with members for a property
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');

    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required query parameter: propertyId' } },
        { status: 400 },
      );
    }

    const config = await db.multiWanConfig.findUnique({
      where: { propertyId, tenantId: user.tenantId },
      include: {
        wanMembers: {
          orderBy: [{ isPrimary: 'desc' }, { weight: 'desc' }],
        },
      },
    });

    return NextResponse.json({ success: true, data: config });
  } catch (error) {
    console.error('Error fetching multi-WAN config:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch multi-WAN config' } },
      { status: 500 },
    );
  }
}

// POST /api/wifi/network/multiwan - Create or update (upsert) multi-WAN config
export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const tenantId = user.tenantId;

    const {
      propertyId,
      enabled = false,
      mode = 'weighted',
      healthCheckUrl = 'https://1.1.1.1',
      healthCheckInterval = 10,
      healthCheckTimeout = 3,
      failoverThreshold = 3,
      autoSwitchback = true,
      switchbackDelay = 300,
      flushConnectionsOnFailover = true,
      wanMembers = [],
    } = body;

    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required field: propertyId' } },
        { status: 400 },
      );
    }

    // Upsert the config by propertyId
    const config = await db.multiWanConfig.upsert({
      where: { propertyId },
      update: {
        enabled,
        mode,
        healthCheckUrl,
        healthCheckInterval: parseInt(healthCheckInterval, 10),
        healthCheckTimeout: parseInt(healthCheckTimeout, 10),
        failoverThreshold: parseInt(failoverThreshold, 10),
        autoSwitchback,
        switchbackDelay: parseInt(switchbackDelay, 10),
        flushConnectionsOnFailover,
      },
      create: {
        tenantId,
        propertyId,
        enabled,
        mode,
        healthCheckUrl,
        healthCheckInterval: parseInt(healthCheckInterval, 10),
        healthCheckTimeout: parseInt(healthCheckTimeout, 10),
        failoverThreshold: parseInt(failoverThreshold, 10),
        autoSwitchback,
        switchbackDelay: parseInt(switchbackDelay, 10),
        flushConnectionsOnFailover,
      },
      include: {
        wanMembers: true,
      },
    });

    // Delete existing members before recreating
    await db.multiWanMember.deleteMany({
      where: { multiWanConfigId: config.id },
    });

    // Recreate wan members
    if (Array.isArray(wanMembers) && wanMembers.length > 0) {
      await db.multiWanMember.createMany({
        data: wanMembers.map((member: Record<string, unknown>) => ({
          multiWanConfigId: config.id,
          interfaceName: member.interfaceName,
          interfaceId: member.interfaceId || null,
          weight: typeof member.weight === 'number' ? member.weight : parseInt(String(member.weight), 10) || 1,
          gateway: member.gateway || null,
          enabled: member.enabled !== undefined ? member.enabled : true,
          isPrimary: member.isPrimary || false,
        })),
      });
    }

    // Return the full config with new members
    const result = await db.multiWanConfig.findUnique({
      where: { id: config.id },
      include: {
        wanMembers: {
          orderBy: [{ isPrimary: 'desc' }, { weight: 'desc' }],
        },
      },
    });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    console.error('Error creating/updating multi-WAN config:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create/update multi-WAN config' } },
      { status: 500 },
    );
  }
}

// PUT /api/wifi/network/multiwan - Update existing multi-WAN config
export async function PUT(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const tenantId = user.tenantId;

    const {
      propertyId,
      enabled,
      mode,
      healthCheckUrl,
      healthCheckInterval,
      healthCheckTimeout,
      failoverThreshold,
      autoSwitchback,
      switchbackDelay,
      flushConnectionsOnFailover,
      wanMembers,
    } = body;

    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required field: propertyId' } },
        { status: 400 },
      );
    }

    const existing = await db.multiWanConfig.findUnique({
      where: { propertyId },
    });

    if (!existing || existing.tenantId !== tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Multi-WAN config not found for this property' } },
        { status: 404 },
      );
    }

    const updateData: Record<string, unknown> = {};
    if (enabled !== undefined) updateData.enabled = enabled;
    if (mode !== undefined) updateData.mode = mode;
    if (healthCheckUrl !== undefined) updateData.healthCheckUrl = healthCheckUrl;
    if (healthCheckInterval !== undefined) updateData.healthCheckInterval = parseInt(healthCheckInterval, 10);
    if (healthCheckTimeout !== undefined) updateData.healthCheckTimeout = parseInt(healthCheckTimeout, 10);
    if (failoverThreshold !== undefined) updateData.failoverThreshold = parseInt(failoverThreshold, 10);
    if (autoSwitchback !== undefined) updateData.autoSwitchback = autoSwitchback;
    if (switchbackDelay !== undefined) updateData.switchbackDelay = parseInt(switchbackDelay, 10);
    if (flushConnectionsOnFailover !== undefined) updateData.flushConnectionsOnFailover = flushConnectionsOnFailover;

    await db.multiWanConfig.update({
      where: { propertyId },
      data: updateData,
    });

    // If wanMembers provided, replace all members
    if (Array.isArray(wanMembers)) {
      await db.multiWanMember.deleteMany({
        where: { multiWanConfigId: existing.id },
      });

      if (wanMembers.length > 0) {
        await db.multiWanMember.createMany({
          data: wanMembers.map((member: Record<string, unknown>) => ({
            multiWanConfigId: existing.id,
            interfaceName: member.interfaceName,
            interfaceId: member.interfaceId || null,
            weight: typeof member.weight === 'number' ? member.weight : parseInt(String(member.weight), 10) || 1,
            gateway: member.gateway || null,
            enabled: member.enabled !== undefined ? member.enabled : true,
            isPrimary: member.isPrimary || false,
          })),
        });
      }
    }

    // Return the full updated config
    const result = await db.multiWanConfig.findUnique({
      where: { propertyId },
      include: {
        wanMembers: {
          orderBy: [{ isPrimary: 'desc' }, { weight: 'desc' }],
        },
      },
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Error updating multi-WAN config:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update multi-WAN config' } },
      { status: 500 },
    );
  }
}

// DELETE /api/wifi/network/multiwan - Delete multi-WAN config for a property
export async function DELETE(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');

    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required query parameter: propertyId' } },
        { status: 400 },
      );
    }

    const existing = await db.multiWanConfig.findUnique({
      where: { propertyId },
    });

    if (!existing || existing.tenantId !== user.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Multi-WAN config not found for this property' } },
        { status: 404 },
      );
    }

    // Members will be cascade-deleted via onDelete: Cascade
    await db.multiWanConfig.delete({
      where: { propertyId },
    });

    return NextResponse.json({ success: true, message: 'Multi-WAN config deleted successfully' });
  } catch (error) {
    console.error('Error deleting multi-WAN config:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete multi-WAN config' } },
      { status: 500 },
    );
  }
}
