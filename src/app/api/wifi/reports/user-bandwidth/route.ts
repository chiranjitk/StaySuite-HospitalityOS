import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

// GET /api/wifi/reports/user-bandwidth - Per-user bandwidth usage with search/sort
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'reports.view');
  if (user instanceof NextResponse) return user;

  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Query real bandwidth usage sessions grouped by user/IP
    const where: Record<string, unknown> = {
      tenantId: user.tenantId,
    };

    if (search) {
      where.OR = [
        { username: { contains: search } },
        { ipAddress: { contains: search } },
        { macAddress: { contains: search } },
      ];
    }

    // Aggregate bandwidth per user (username + ipAddress combination)
    const bandwidthSessions = await db.bandwidthUsageSession.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      take: 500,
    });

    // Group by username+ip to get per-user aggregates
    const userMap: Record<string, {
      username: string;
      ip: string;
      mac: string;
      sessions: number;
      totalDown: number;
      totalUp: number;
      totalDuration: number;
      lastSeen: Date;
      sessionHistory: Array<{
        id: string;
        start: string;
        end: string;
        download: number;
        upload: number;
        duration: number;
      }>;
    }> = {};

    for (const session of bandwidthSessions) {
      const key = `${session.username || 'unknown'}-${session.ipAddress}`;
      if (!userMap[key]) {
        userMap[key] = {
          username: session.username || 'unknown',
          ip: session.ipAddress,
          mac: session.macAddress || 'unknown',
          sessions: 0,
          totalDown: 0,
          totalUp: 0,
          totalDuration: 0,
          lastSeen: session.startedAt,
          sessionHistory: [],
        };
      }

      const entry = userMap[key];
      entry.sessions++;
      entry.totalDown += session.downloadBytes;
      entry.totalUp += session.uploadBytes;
      entry.totalDuration += session.durationSeconds;
      if (session.startedAt > entry.lastSeen) {
        entry.lastSeen = session.startedAt;
      }

      // Include up to 5 most recent sessions in history
      if (entry.sessionHistory.length < 5) {
        entry.sessionHistory.push({
          id: session.id,
          start: session.startedAt.toISOString(),
          end: session.endedAt ? session.endedAt.toISOString() : new Date().toISOString(),
          download: session.downloadBytes,
          upload: session.uploadBytes,
          duration: session.durationSeconds,
        });
      }
    }

    // Also check WiFi sessions for additional context (users without bandwidth sessions yet)
    const wifiSessions = await db.wiFiSession.findMany({
      where: {
        tenantId: user.tenantId,
        ...(search ? {
          OR: [
            { macAddress: { contains: search } },
            { ipAddress: { contains: search } },
          ],
        } : {}),
      },
      include: {
        plan: { select: { name: true } },
      },
      orderBy: { startTime: 'desc' },
      take: 500,
    });

    // Merge WiFi session data (for users not yet in bandwidth sessions)
    for (const ws of wifiSessions) {
      const key = `${ws.macAddress}-${ws.ipAddress || 'unknown'}`;
      if (!userMap[key]) {
        userMap[key] = {
          username: ws.macAddress,
          ip: ws.ipAddress || 'unknown',
          mac: ws.macAddress,
          sessions: 1,
          totalDown: ws.dataUsed * 1048576, // Convert MB back to bytes for consistency
          totalUp: 0,
          totalDuration: ws.duration,
          lastSeen: ws.startTime,
          sessionHistory: [{
            id: ws.id,
            start: ws.startTime.toISOString(),
            end: ws.endTime ? ws.endTime.toISOString() : new Date().toISOString(),
            download: ws.dataUsed * 1048576,
            upload: 0,
            duration: ws.duration,
          }],
        };
      }
    }

    // Convert to array and format
    const data = Object.values(userMap)
      .map((entry) => ({
        username: entry.username,
        ip: entry.ip,
        mac: entry.mac,
        sessions: entry.sessions,
        totalDown: Math.round(entry.totalDown / 1024), // Convert to KB for readability
        totalUp: Math.round(entry.totalUp / 1024),
        avgDuration: entry.sessions > 0 ? Math.round(entry.totalDuration / entry.sessions) : 0,
        lastSeen: entry.lastSeen.toISOString(),
        sessionHistory: entry.sessionHistory,
      }))
      .sort((a, b) => b.totalDown - a.totalDown) // Sort by total download descending
      .slice(offset, offset + limit);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching user bandwidth report:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch user bandwidth report' } },
      { status: 500 }
    );
  }
}
