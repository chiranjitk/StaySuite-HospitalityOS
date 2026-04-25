/**
 * WiFi Users API Route
 * 
 * Manages WiFi users for RADIUS authentication.
 * PMS = source of truth for user data.
 * 
 * Architecture: PMS → DB (radcheck/radreply) → FreeRADIUS → Gateway
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';import crypto from 'crypto';
import {
  getActiveNASVendors,
  generateBandwidthAttributes,
  generateSessionAttributes,
  BANDWIDTH_ATTRIBUTES,
} from '@/lib/wifi/utils/vendor-attributes';

// Helper to generate random password using cryptographically secure random bytes
function generatePassword(length: number = 8): string {
  return crypto.randomBytes(length).toString('base64url').slice(0, length);
}

// Helper to generate username using cryptographically secure random bytes
function generateUsername(propertyId: string): string {
  const random = crypto.randomBytes(4).toString('hex');
  return `guest_${propertyId.slice(-4)}_${random}`;
}

// GET /api/wifi/users - List WiFi users
export async function GET(request: NextRequest) {    const user = await requirePermission(request, 'wifi.manage');
    if (user instanceof NextResponse) return user;

      try {
    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');
    const guestId = searchParams.get('guestId');
    const bookingId = searchParams.get('bookingId');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Build SQL conditions on the v_wifi_users view
    const conditions: string[] = ['tenantId = ?'];
    const sqlParams: unknown[] = [user.tenantId];

    if (propertyId) { conditions.push(`propertyId = ?`); sqlParams.push(propertyId); }
    if (guestId) { conditions.push(`guestId = ?`); sqlParams.push(guestId); }
    if (bookingId) { conditions.push(`bookingId = ?`); sqlParams.push(bookingId); }
    if (status) { conditions.push(`status = ?`); sqlParams.push(status); }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    const offset = (page - 1) * limit;

    // Count total
    const totalResult = await db.$queryRawUnsafe<{ c: number }[]>(
      `SELECT COUNT(*) as c FROM v_wifi_users ${whereClause}`,
      ...sqlParams
    );
    const total = totalResult[0]?.c ?? 0;

    // Fetch paginated users from the view
    sqlParams.push(limit, offset);
    const rows = await db.$queryRawUnsafe<Record<string, unknown>[]>(`
      SELECT id, tenantId, propertyId, guestId, bookingId, username, planId,
             status, authMethod, macAddress, validFrom, validUntil,
             totalBytesIn, totalBytesOut, sessionCount, lastSeenAt,
             createdAt, updatedAt,
             radius_password, radius_group,
             guest_first_name, guest_last_name, guest_email, guest_phone,
             guest_loyalty_tier, guest_is_vip,
             room_number, room_name, room_floor,
             property_name, plan_name,
             plan_download_speed, plan_upload_speed, plan_data_limit,
             booking_code, booking_status, booking_check_in, booking_check_out
      FROM v_wifi_users ${whereClause}
      ORDER BY createdAt DESC
      LIMIT ? OFFSET ?
    `, ...sqlParams);

    // Reconstruct the nested format to maintain backward compatibility
    const users = rows.map((row) => ({
      id: row.id,
      tenantId: row.tenantId,
      propertyId: row.propertyId,
      guestId: row.guestId,
      bookingId: row.bookingId,
      username: row.username,
      planId: row.planId,
      status: row.status,
      authMethod: row.authMethod,
      macAddress: row.macAddress,
      validFrom: row.validFrom,
      validUntil: row.validUntil,
      totalBytesIn: row.totalBytesIn,
      totalBytesOut: row.totalBytesOut,
      sessionCount: row.sessionCount,
      lastSeenAt: row.lastSeenAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      // Reconstruct radCheck from view columns
      radCheck: row.radius_password ? [{
        username: row.username,
        attribute: 'Cleartext-Password',
        op: ':=',
        value: row.radius_password,
        isActive: true,
      }] : [],
      // Reconstruct radReply from plan columns
      radReply: row.planId ? [
        { username: row.username, attribute: 'WISPr-Bandwidth-Max-Down', op: ':=', value: String(row.plan_download_speed || 0), isActive: true },
        { username: row.username, attribute: 'WISPr-Bandwidth-Max-Up', op: ':=', value: String(row.plan_upload_speed || 0), isActive: true },
      ] : [],
      // Reconstruct plan relation from view columns
      plan: row.planId ? {
        id: row.planId,
        name: row.plan_name,
        downloadSpeed: row.plan_download_speed,
        uploadSpeed: row.plan_upload_speed,
        dataLimit: row.plan_data_limit,
      } : null,
      // Enriched fields from view
      radius_group: row.radius_group,
      guest_first_name: row.guest_first_name,
      guest_last_name: row.guest_last_name,
      guest_email: row.guest_email,
      guest_phone: row.guest_phone,
      guest_loyalty_tier: row.guest_loyalty_tier,
      guest_is_vip: row.guest_is_vip,
      room_number: row.room_number,
      room_name: row.room_name,
      room_floor: row.room_floor,
      property_name: row.property_name,
      booking_code: row.booking_code,
      booking_status: row.booking_status,
      booking_check_in: row.booking_check_in,
      booking_check_out: row.booking_check_out,
    }));

    return NextResponse.json({
      success: true,
      data: users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching WiFi users:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch WiFi users' },
      { status: 500 }
    );
  }
}

// POST /api/wifi/users - Create WiFi user
export async function POST(request: NextRequest) {    const user = await requirePermission(request, 'wifi.manage');
    if (user instanceof NextResponse) return user;

      try {
    const body = await request.json();
    const tenantId = user.tenantId;

    const {
      propertyId,
      guestId,
      bookingId,
      planId,
      username,
      password,
      validFrom,
      validUntil,
      userType,
      downloadSpeed,
      uploadSpeed,
      sessionTimeoutMinutes, // RADIUS Session-Timeout in minutes
      sessionLimit, // Max concurrent sessions
      dataLimit, // Data cap in MB
    } = body;

    // Validate required fields
    if (!propertyId || !validFrom || !validUntil) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const finalUsername = username || generateUsername(propertyId);
    const finalPassword = password || generatePassword();

    // Create WiFi user with RADIUS records in transaction
    const result = await db.$transaction(async (tx) => {
      // 1. Create WiFiUser
      const wifiUser = await tx.wiFiUser.create({
        data: {
          tenantId,
          propertyId,
          username: finalUsername,
          password: finalPassword,
          guestId,
          bookingId,
          planId,
          validFrom: new Date(validFrom),
          validUntil: new Date(validUntil),
          userType: userType || 'guest',
          status: 'active',
          radiusSynced: false,
        },
      });

      // 2. Create RadCheck (authentication)
      await tx.radCheck.create({
        data: {
          wifiUserId: wifiUser.id,
          username: finalUsername,
          attribute: 'Cleartext-Password',
          op: ':=',
          value: finalPassword,
        },
      });

      // 3. Create RadReply (authorization policies)
      // Vendor-aware: generate attrs based on active NAS types
      const vendors = await getActiveNASVendors(propertyId);
      const dlMbps = downloadSpeed ? downloadSpeed / 1000000 : 10;
      const ulMbps = uploadSpeed ? uploadSpeed / 1000000 : 10;

      const bwAttrs = generateBandwidthAttributes(vendors, dlMbps, ulMbps);
      const sessionAttrs = generateSessionAttributes(
        vendors,
        sessionTimeoutMinutes || 0,
        dataLimit || 0,
      );

      // Write all vendor-appropriate reply attributes
      for (const reply of [...bwAttrs, ...sessionAttrs]) {
        await tx.radReply.create({
          data: {
            wifiUserId: wifiUser.id,
            username: finalUsername,
            attribute: reply.attribute,
            op: ':=',
            value: reply.value,
          },
        });
      }

      // Simultaneous-Use (max concurrent sessions — goes in radcheck)
      if (sessionLimit && sessionLimit > 0) {
        await tx.radCheck.create({
          data: {
            wifiUserId: wifiUser.id,
            username: finalUsername,
            attribute: 'Simultaneous-Use',
            op: ':=',
            value: String(sessionLimit),
          },
        });
      }

      // Update sync status
      await tx.wiFiUser.update({
        where: { id: wifiUser.id },
        data: {
          radiusSynced: true,
        },
      });

      return wifiUser;
    });

    return NextResponse.json({
      success: true,
      data: {
        user: result,
        credentials: {
          username: finalUsername,
          password: finalPassword,
          validFrom,
          validUntil,
        },
      },
      message: 'WiFi user provisioned successfully',
    });
  } catch (error) {
    console.error('Error creating WiFi user:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create WiFi user' },
      { status: 500 }
    );
  }
}
