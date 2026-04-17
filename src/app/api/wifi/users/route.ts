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

    const where: any = {};
    where.tenantId = user.tenantId;
    
    if (propertyId) where.propertyId = propertyId;
    if (guestId) where.guestId = guestId;
    if (bookingId) where.bookingId = bookingId;
    if (status) where.status = status;

    const [users, total] = await Promise.all([
      db.wiFiUser.findMany({
        where,
        include: {
          radCheck: {
            where: { isActive: true },
          },
          radReply: {
            where: { isActive: true },
          },
          plan: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.wiFiUser.count({ where }),
    ]);

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
      sessionLimit,
      dataLimit,
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
      const dlSpeed = downloadSpeed || 10000000; // 10 Mbps default
      const ulSpeed = uploadSpeed || 10000000;

      // WISPr attributes
      await tx.radReply.create({
        data: {
          wifiUserId: wifiUser.id,
          username: finalUsername,
          attribute: 'WISPr-Bandwidth-Max-Down',
          op: ':=',
          value: String(dlSpeed),
        },
      });

      await tx.radReply.create({
        data: {
          wifiUserId: wifiUser.id,
          username: finalUsername,
          attribute: 'WISPr-Bandwidth-Max-Up',
          op: ':=',
          value: String(ulSpeed),
        },
      });

      // MikroTik rate limit
      const dlMbps = dlSpeed / 1000000;
      const ulMbps = ulSpeed / 1000000;

      await tx.radReply.create({
        data: {
          wifiUserId: wifiUser.id,
          username: finalUsername,
          attribute: 'Mikrotik-Rate-Limit',
          op: ':=',
          value: `${dlMbps}M/${ulMbps}M`,
        },
      });

      // Session timeout
      if (sessionLimit) {
        await tx.radReply.create({
          data: {
            wifiUserId: wifiUser.id,
            username: finalUsername,
            attribute: 'Session-Timeout',
            op: ':=',
            value: String(sessionLimit * 60),
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
