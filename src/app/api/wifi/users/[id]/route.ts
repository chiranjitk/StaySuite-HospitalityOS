/**
 * WiFi User Individual API Route
 * 
 * GET, PATCH, DELETE for individual WiFi users
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/wifi/users/[id] - Get single WiFi user
export async function GET(request: NextRequest, { params }: RouteParams) {
    const context = await requirePermission(request, 'wifi.view');
    if (context instanceof NextResponse) return context;
    const tenantId = context.tenantId;


  try {
    const { id } = await params;
    
    const wifiUser = await db.wiFiUser.findFirst({
      where: { id, tenantId },
      include: {
        radCheck: {
          where: { isActive: true },
        },
        radReply: {
          where: { isActive: true },
        },
        plan: true,
      },
    });

    if (!wifiUser) {
      return NextResponse.json(
        { success: false, error: 'WiFi user not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: wifiUser,
    });
  } catch (error) {
    console.error('Error fetching WiFi user:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch WiFi user' },
      { status: 500 }
    );
  }
}

// PATCH /api/wifi/users/[id] - Update WiFi user
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    const context = await requirePermission(request, 'wifi.manage');
    if (context instanceof NextResponse) return context;
    const tenantId = context.tenantId;


  try {
    const { id } = await params;
    const body = await request.json();
    const {
      validUntil,
      downloadSpeed,
      uploadSpeed,
      sessionLimit,
      status,
    } = body;

    const existingUser = await db.wiFiUser.findFirst({
      where: { id, tenantId },
    });

    if (!existingUser) {
      return NextResponse.json(
        { success: false, error: 'WiFi user not found' },
        { status: 404 }
      );
    }

    // Update user (include tenantId in where clause for safety)
    // Using updateMany since Prisma update() requires unique field and there's no composite unique on (id, tenantId)
    await db.wiFiUser.updateMany({
      where: { id, tenantId },
      data: {
        validUntil: validUntil ? new Date(validUntil) : undefined,
        status: status || undefined,
        radiusSynced: false,
      },
    });

    // Update bandwidth if provided
    if (downloadSpeed || uploadSpeed) {
      const dlSpeed = downloadSpeed || 10000000;
      const ulSpeed = uploadSpeed || 10000000;

      // Update WISPr attributes
      await db.radReply.updateMany({
        where: {
          wifiUserId: id,
          attribute: 'WISPr-Bandwidth-Max-Down',
        },
        data: { value: String(dlSpeed) },
      });

      await db.radReply.updateMany({
        where: {
          wifiUserId: id,
          attribute: 'WISPr-Bandwidth-Max-Up',
        },
        data: { value: String(ulSpeed) },
      });

      // Update MikroTik rate limit
      const dlMbps = dlSpeed / 1000000;
      const ulMbps = ulSpeed / 1000000;

      await db.radReply.updateMany({
        where: {
          wifiUserId: id,
          attribute: 'Mikrotik-Rate-Limit',
        },
        data: { value: `${dlMbps}M/${ulMbps}M` },
      });
    }

    // Update session timeout
    if (sessionLimit !== undefined) {
      const existingTimeout = await db.radReply.findFirst({
        where: {
          wifiUserId: id,
          attribute: 'Session-Timeout',
        },
      });

      if (existingTimeout) {
        await db.radReply.update({
          where: { id: existingTimeout.id },
          data: { value: String(sessionLimit * 60) },
        });
      } else if (sessionLimit > 0) {
        await db.radReply.create({
          data: {
            wifiUserId: id,
            username: existingUser.username,
            attribute: 'Session-Timeout',
            op: ':=',
            value: String(sessionLimit * 60),
          },
        });
      }
    }

    // Handle status changes
    if (status === 'suspended' || status === 'revoked') {
      await db.radCheck.updateMany({
        where: { wifiUserId: id },
        data: { isActive: false },
      });
      await db.radReply.updateMany({
        where: { wifiUserId: id },
        data: { isActive: false },
      });
    } else if (status === 'active' && existingUser.status !== 'active') {
      await db.radCheck.updateMany({
        where: { wifiUserId: id },
        data: { isActive: true },
      });
      await db.radReply.updateMany({
        where: { wifiUserId: id },
        data: { isActive: true },
      });
    }

    // Mark as synced
    await db.wiFiUser.updateMany({
      where: { id, tenantId },
      data: { radiusSynced: true },
    });

    // Fetch updated record
    const result = await db.wiFiUser.findFirst({
      where: { id, tenantId },
    });

    return NextResponse.json({
      success: true,
      data: result,
      message: 'WiFi user updated successfully',
    });
  } catch (error) {
    console.error('Error updating WiFi user:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update WiFi user' },
      { status: 500 }
    );
  }
}

// DELETE /api/wifi/users/[id] - Delete (deprovision) WiFi user
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    const context = await requirePermission(request, 'wifi.manage');
    if (context instanceof NextResponse) return context;
    const tenantId = context.tenantId;


  try {
    const { id } = await params;
    
    const wifiUser = await db.wiFiUser.findFirst({
      where: { id, tenantId },
    });

    if (!wifiUser) {
      return NextResponse.json(
        { success: false, error: 'WiFi user not found' },
        { status: 404 }
      );
    }

    // Soft delete - mark as revoked and disable RADIUS records
    await db.wiFiUser.update({
      where: { id },
      data: {
        status: 'revoked',
        radiusSynced: false,
      },
    });

    // Disable RadCheck
    await db.radCheck.updateMany({
      where: { wifiUserId: id },
      data: { isActive: false },
    });

    // Disable RadReply
    await db.radReply.updateMany({
      where: { wifiUserId: id },
      data: { isActive: false },
    });

    return NextResponse.json({
      success: true,
      message: 'WiFi user deprovisioned successfully',
    });
  } catch (error) {
    console.error('Error deleting WiFi user:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete WiFi user' },
      { status: 500 }
    );
  }
}
