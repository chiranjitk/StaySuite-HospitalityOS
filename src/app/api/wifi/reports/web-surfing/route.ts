import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

// GET /api/wifi/reports/web-surfing - Web surfing / domain access logs
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'reports.view');
  if (user instanceof NextResponse) return user;

  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search');
    const category = searchParams.get('category');

    // Try to get data from database
    const where: Record<string, unknown> = {
      tenantId: user.tenantId,
    };

    if (search) {
      // Use AND to merge search with the not-null constraint
      where.AND = [
        { destDomain: { not: null } },
        { destDomain: { contains: search } },
      ];
    } else {
      where.destDomain = { not: null };
    }

    const dbLogs = await db.natLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: 200,
    });

    // If we have DB data, format it
    if (dbLogs.length > 0) {
      const formatted = dbLogs.map((log) => {
        const domain = log.destDomain || 'unknown';
        const categoryMap: Record<string, string> = {
          'facebook.com': 'social_media', 'instagram.com': 'social_media', 'twitter.com': 'social_media',
          'youtube.com': 'streaming', 'netflix.com': 'streaming', 'spotify.com': 'streaming',
          'cnn.com': 'news', 'bbc.com': 'news', 'reuters.com': 'news',
          'steampowered.com': 'gaming', 'epicgames.com': 'gaming', 'twitch.tv': 'gaming',
        };
        return {
          domain,
          sourceIp: log.sourceIp,
          category: categoryMap[domain] || 'other',
          totalBytes: log.bytes || 0,
          connections: 1,
          lastAccess: log.timestamp.toISOString(),
        };
      });

      // Aggregate by domain
      const aggregated: Record<string, { domain: string; sourceIp: string; category: string; totalBytes: number; connections: number; lastAccess: string }> = {};
      for (const entry of formatted) {
        if (!aggregated[entry.domain]) {
          aggregated[entry.domain] = { ...entry };
        } else {
          aggregated[entry.domain].totalBytes += entry.totalBytes;
          aggregated[entry.domain].connections += entry.connections;
        }
      }

      const result = Object.values(aggregated);
      if (category && category !== 'all') {
        return NextResponse.json({ success: true, data: result.filter((r) => r.category === category) });
      }
      return NextResponse.json({ success: true, data: result });
    }

    // No data found in database
    return NextResponse.json({ success: true, data: [] });
  } catch (error) {
    console.error('Error fetching web surfing logs:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch web surfing logs' } },
      { status: 500 }
    );
  }
}
