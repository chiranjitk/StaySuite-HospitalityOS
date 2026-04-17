/**
 * WiFi Quotas API Route
 *
 * GET  /api/wifi/quotas?propertyId=... — Get quota status for all users
 * POST /api/wifi/quotas?propertyId=... — Enforce data limits on all active sessions
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';
import { checkAllActiveSessions } from '@/lib/wifi/utils/data-limits';

// GET /api/wifi/quotas — Quota dashboard data for all WiFi users
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const propertyId = request.nextUrl.searchParams.get('propertyId');
    if (!propertyId) {
      return NextResponse.json({ success: false, error: 'propertyId required' }, { status: 400 });
    }

    // ── WiFi users for this property ────────────────────────────────────
    const wifiUsers = await db.wiFiUser.findMany({
      where: { propertyId, tenantId: user.tenantId },
      include: {
        plan: {
          select: {
            name: true,
            dataLimit: true,
            sessionLimit: true,
            downloadSpeed: true,
            uploadSpeed: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // ── Resolve guest names (WiFiUser has guestId but no direct relation) ─
    const guestIds = [...new Set(wifiUsers.map((u) => u.guestId).filter(Boolean) as string[])];
    let guestMap = new Map<string, string>();
    if (guestIds.length > 0) {
      const guests = await db.guest.findMany({
        where: { id: { in: guestIds } },
        select: { id: true, firstName: true, lastName: true },
      });
      for (const g of guests) {
        guestMap.set(g.id, `${g.firstName} ${g.lastName}`);
      }
    }

    // ── Active sessions for data-usage aggregation ─────────────────────
    const activeSessions = await db.wiFiSession.findMany({
      where: { status: 'active', tenantId: user.tenantId },
      include: { plan: { select: { dataLimit: true } } },
    });

    // Build a map keyed by guestId (primary) or planId (fallback)
    const sessionDataMap = new Map<string, { dataUsed: number; activeSessions: number }>();
    for (const session of activeSessions) {
      const key = session.guestId || session.planId || 'unknown';
      const existing = sessionDataMap.get(key) || { dataUsed: 0, activeSessions: 0 };
      existing.dataUsed += session.dataUsed || 0;
      existing.activeSessions += 1;
      sessionDataMap.set(key, existing);
    }

    // ── Enrich each user with quota info ───────────────────────────────
    const enrichedUsers = wifiUsers.map((u) => {
      const key = u.guestId || u.planId || 'unknown';
      const sessionData = sessionDataMap.get(key) || { dataUsed: 0, activeSessions: 0 };
      const dataLimit = u.plan?.dataLimit || null;
      const sessionLimit = u.plan?.sessionLimit || null;
      const percentUsed = dataLimit ? Math.min(100, Math.round((sessionData.dataUsed / dataLimit) * 100)) : 0;
      const overQuota = dataLimit ? sessionData.dataUsed >= dataLimit : false;

      return {
        id: u.id,
        username: u.username,
        guestName: u.guestId ? guestMap.get(u.guestId) || null : null,
        planName: u.plan?.name || 'No Plan',
        dataUsed: sessionData.dataUsed,
        dataLimit,
        percentUsed,
        activeSessions: sessionData.activeSessions,
        sessionLimit,
        maxSessions: u.maxSessions,
        status: u.status,
        overQuota,
        createdAt: u.createdAt,
      };
    });

    // ── Summary ────────────────────────────────────────────────────────
    const summary = {
      totalUsers: enrichedUsers.length,
      activeUsers: enrichedUsers.filter((u) => u.status === 'active').length,
      overQuotaUsers: enrichedUsers.filter((u) => u.overQuota).length,
      suspendedUsers: enrichedUsers.filter((u) => u.status === 'suspended').length,
      totalDataUsedMB: enrichedUsers.reduce((sum, u) => sum + u.dataUsed, 0),
      avgUsagePerUser:
        enrichedUsers.length > 0
          ? Math.round(enrichedUsers.reduce((sum, u) => sum + u.dataUsed, 0) / enrichedUsers.length)
          : 0,
    };

    return NextResponse.json({ success: true, data: enrichedUsers, summary });
  } catch (error) {
    console.error('Error fetching quotas:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch quota data' }, { status: 500 });
  }
}

// POST /api/wifi/quotas — Enforce data limits on all active sessions
export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'wifi.manage');
  if (user instanceof NextResponse) return user;

  try {
    const propertyId = request.nextUrl.searchParams.get('propertyId');
    if (!propertyId) {
      return NextResponse.json({ success: false, error: 'propertyId required' }, { status: 400 });
    }

    const result = await checkAllActiveSessions();

    return NextResponse.json({
      success: true,
      data: result,
      message: `Checked ${result.checked} sessions, found ${result.exceeded.length} over limit`,
    });
  } catch (error) {
    console.error('Error enforcing quotas:', error);
    return NextResponse.json({ success: false, error: 'Failed to enforce quotas' }, { status: 500 });
  }
}
