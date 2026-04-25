/**
 * WAN Failover API Route
 *
 * GET and PUT for WAN failover configuration.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, resolvePropertyId } from '@/lib/auth/tenant-context';

// GET /api/wifi/network/wan-failover - Get WAN failover config
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const searchParams = request.nextUrl.searchParams;
    const propertyId = await resolvePropertyId(user, searchParams.get('propertyId'));

    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: 'No property found. Please create a property first.' },
        { status: 400 },
      );
    }

    const failover = await db.wanFailover.findUnique({
      where: { propertyId },
      include: {
        primaryWan: { select: { id: true, name: true, status: true } },
        backupWan: { select: { id: true, name: true, status: true } },
      },
    });

    if (!failover || failover.tenantId !== user.tenantId) {
      // Return default config if none exists
      return NextResponse.json({
        success: true,
        data: null,
      });
    }

    return NextResponse.json({ success: true, data: failover });
  } catch (error) {
    console.error('Error fetching WAN failover config:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch WAN failover config' } },
      { status: 500 },
    );
  }
}

// PUT /api/wifi/network/wan-failover - Update WAN failover config
export async function PUT(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const tenantId = user.tenantId;

    const propertyId = await resolvePropertyId(user, body.propertyId);
    const {
      primaryWanId,
      backupWanId,
      healthCheckUrl,
      healthCheckInterval,
      failoverThreshold,
      autoSwitchback,
      switchbackDelay,
      enabled,
    } = body;

    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: 'No property found. Please create a property first.' },
        { status: 400 },
      );
    }

    // Use upsert since there's a unique constraint on propertyId
    const failover = await db.wanFailover.upsert({
      where: { propertyId },
      update: {
        ...(primaryWanId !== undefined && { primaryWanId }),
        ...(backupWanId !== undefined && { backupWanId }),
        ...(healthCheckUrl !== undefined && { healthCheckUrl }),
        ...(healthCheckInterval !== undefined && { healthCheckInterval }),
        ...(failoverThreshold !== undefined && { failoverThreshold }),
        ...(autoSwitchback !== undefined && { autoSwitchback }),
        ...(switchbackDelay !== undefined && { switchbackDelay }),
        ...(enabled !== undefined && { enabled }),
      },
      create: {
        tenantId,
        propertyId,
        primaryWanId: primaryWanId || '',
        backupWanId: backupWanId || '',
        healthCheckUrl: healthCheckUrl || 'https://1.1.1.1',
        healthCheckInterval: healthCheckInterval || 30,
        failoverThreshold: failoverThreshold || 3,
        autoSwitchback: autoSwitchback ?? true,
        switchbackDelay: switchbackDelay || 300,
        enabled: enabled ?? false,
      },
      include: {
        primaryWan: { select: { id: true, name: true, status: true } },
        backupWan: { select: { id: true, name: true, status: true } },
      },
    });

    return NextResponse.json({ success: true, data: failover });
  } catch (error) {
    console.error('Error updating WAN failover config:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update WAN failover config' } },
      { status: 500 },
    );
  }
}
