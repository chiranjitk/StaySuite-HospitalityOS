/**
 * WiFi User Individual API Route
 * 
 * GET, PATCH, DELETE for individual WiFi users
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';
import {
  getActiveNASVendors,
  generateBandwidthAttributes,
  BANDWIDTH_ATTRIBUTES,
} from '@/lib/wifi/utils/vendor-attributes';

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
export async function PATCH(request: NextRequest, params: RouteParams) {
  return handleUpdate(request, params);
}

async function handleUpdate(request: NextRequest, { params }: RouteParams) {
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
      sessionTimeoutMinutes,
      status,
      action,
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

    // Handle "reset_usage" action — reset data counters
    if (action === 'reset_usage') {
      // Reset user's byte counters
      await db.wiFiUser.updateMany({
        where: { id, tenantId },
        data: {
          totalBytesIn: 0,
          totalBytesOut: 0,
          sessionCount: 0,
          radiusSynced: false,
        },
      });

      // Reset active sessions for this user's guest (if linked)
      if (existingUser.guestId) {
        await db.wiFiSession.updateMany({
          where: {
            tenantId,
            guestId: existingUser.guestId,
            status: 'active',
          },
          data: { dataUsed: 0, duration: 0 },
        });
      }
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
    // Vendor-aware: delete ALL old bandwidth attrs, write new vendor-appropriate ones
    if (downloadSpeed || uploadSpeed) {
      const vendors = await getActiveNASVendors(existingUser.propertyId);
      const dlMbps = downloadSpeed ? downloadSpeed / 1000000 : 10;
      const ulMbps = uploadSpeed ? uploadSpeed / 1000000 : 10;

      // Delete all known bandwidth attributes
      for (const attr of BANDWIDTH_ATTRIBUTES) {
        await db.radReply.deleteMany({ where: { wifiUserId: id, attribute: attr } });
      }

      // Write new vendor-appropriate attributes
      const bwAttrs = generateBandwidthAttributes(vendors, dlMbps, ulMbps);
      for (const reply of bwAttrs) {
        await db.radReply.create({
          data: {
            wifiUserId: id,
            username: existingUser.username,
            attribute: reply.attribute,
            op: ':=',
            value: reply.value,
          },
        });
      }
    }

    // Update session timeout (max session duration in seconds)
    // sessionTimeoutMinutes is the user-facing field; Session-Timeout is in seconds
    if (sessionTimeoutMinutes !== undefined) {
      const existingTimeout = await db.radReply.findFirst({
        where: {
          wifiUserId: id,
          attribute: 'Session-Timeout',
        },
      });

      if (existingTimeout) {
        if (sessionTimeoutMinutes > 0) {
          await db.radReply.update({
            where: { id: existingTimeout.id },
            data: { value: String(sessionTimeoutMinutes * 60) },
          });
        } else {
          await db.radReply.delete({ where: { id: existingTimeout.id } });
        }
      } else if (sessionTimeoutMinutes > 0) {
        await db.radReply.create({
          data: {
            wifiUserId: id,
            username: existingUser.username,
            attribute: 'Session-Timeout',
            op: ':=',
            value: String(sessionTimeoutMinutes * 60),
          },
        });
      }
    }

    // Update simultaneous-use (max concurrent sessions) — stored in radcheck
    if (sessionLimit !== undefined) {
      const existingSimUse = await db.radCheck.findFirst({
        where: {
          wifiUserId: id,
          attribute: 'Simultaneous-Use',
        },
      });

      if (existingSimUse) {
        if (sessionLimit > 0) {
          await db.radCheck.update({
            where: { id: existingSimUse.id },
            data: { value: String(sessionLimit) },
          });
        } else {
          await db.radCheck.delete({ where: { id: existingSimUse.id } });
        }
      } else if (sessionLimit > 0) {
        await db.radCheck.create({
          data: {
            wifiUserId: id,
            username: existingUser.username,
            attribute: 'Simultaneous-Use',
            op: ':=',
            value: String(sessionLimit),
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

// PUT /api/wifi/users/[id] - Update WiFi user (alias for PATCH)
export async function PUT(request: NextRequest, params: RouteParams) {
  return handleUpdate(request, params);
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
