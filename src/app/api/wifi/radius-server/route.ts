/**
 * RADIUS Server Configuration API Route
 * 
 * Manages FreeRADIUS server configuration per property
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, tenantWhere } from '@/lib/auth/tenant-context';

// GET /api/wifi/radius-server - Get RADIUS server config for property
export async function GET(request: NextRequest) {
  const context = await requirePermission(request, 'wifi.manage');
  if (context instanceof NextResponse) return context;

  try {
    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');

    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: 'propertyId is required' },
        { status: 400 }
      );
    }

    const config = await db.radiusServerConfig.findUnique({
      where: { propertyId },
    });

    if (!config) {
      // Return default config
      return NextResponse.json({
        success: true,
        data: {
          propertyId,
          serverIp: '127.0.0.1',
          authPort: 1812,
          acctPort: 1813,
          coaPort: 3799,
          listenAllInterfaces: true,
          bindAddress: '0.0.0.0',
          maxAuthWait: 30,
          maxAcctWait: 30,
          cleanupSessions: true,
          sessionCleanupInterval: 3600,
          logAuth: true,
          logAuthBadpass: false,
          logAuthGoodpass: false,
          logDestination: 'files',
          logLevel: 'info',
          status: 'active',
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: config,
    });
  } catch (error) {
    console.error('Error fetching RADIUS server config:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch RADIUS server config' },
      { status: 500 }
    );
  }
}

// POST /api/wifi/radius-server - Create or update RADIUS server config
export async function POST(request: NextRequest) {
  const context = await requirePermission(request, 'wifi.manage');
  if (context instanceof NextResponse) return context;

  try {
    const body = await request.json();
    const {
      propertyId,
      serverIp,
      serverHostname,
      authPort,
      acctPort,
      coaPort,
      listenAllInterfaces,
      bindAddress,
      maxAuthWait,
      maxAcctWait,
      cleanupSessions,
      sessionCleanupInterval,
      logAuth,
      logAuthBadpass,
      logAuthGoodpass,
      logDestination,
      logLevel,
    } = body;

    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: 'propertyId is required' },
        { status: 400 }
      );
    }

    const config = await db.radiusServerConfig.upsert({
      where: { propertyId },
      update: {
        serverIp,
        serverHostname,
        authPort,
        acctPort,
        coaPort,
        listenAllInterfaces,
        bindAddress,
        maxAuthWait,
        maxAcctWait,
        cleanupSessions,
        sessionCleanupInterval,
        logAuth,
        logAuthBadpass,
        logAuthGoodpass,
        logDestination,
        logLevel,
      },
      create: {
        tenantId: context.tenantId,
        propertyId,
        serverIp: serverIp || '127.0.0.1',
        serverHostname,
        authPort: authPort || 1812,
        acctPort: acctPort || 1813,
        coaPort: coaPort || 3799,
        listenAllInterfaces: listenAllInterfaces ?? true,
        bindAddress: bindAddress || '0.0.0.0',
        maxAuthWait: maxAuthWait || 30,
        maxAcctWait: maxAcctWait || 30,
        cleanupSessions: cleanupSessions ?? true,
        sessionCleanupInterval: sessionCleanupInterval || 3600,
        logAuth: logAuth ?? true,
        logAuthBadpass: logAuthBadpass ?? false,
        logAuthGoodpass: logAuthGoodpass ?? false,
        logDestination: logDestination || 'files',
        logLevel: logLevel || 'info',
      },
    });

    return NextResponse.json({
      success: true,
      data: config,
      message: 'RADIUS server configuration saved successfully',
    });
  } catch (error) {
    console.error('Error saving RADIUS server config:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save RADIUS server config' },
      { status: 500 }
    );
  }
}

// DELETE /api/wifi/radius-server - Reset to defaults
export async function DELETE(request: NextRequest) {
  const context = await requirePermission(request, 'wifi.manage');
  if (context instanceof NextResponse) return context;

  try {
    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');

    if (!propertyId) {
      return NextResponse.json(
        { success: false, error: 'propertyId is required' },
        { status: 400 }
      );
    }

    await db.radiusServerConfig.delete({
      where: { propertyId },
    });

    return NextResponse.json({
      success: true,
      message: 'RADIUS server configuration reset to defaults',
    });
  } catch (error) {
    console.error('Error resetting RADIUS server config:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to reset RADIUS server config' },
      { status: 500 }
    );
  }
}
