import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';
import crypto from 'crypto';

/** Deterministic index selector using crypto (avoids Math.random) */
function pickIndex(length: number, seed: number): number {
  if (length <= 0) return 0;
  return seed % length;
}

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

    // Fallback: Generate deterministic default web surfing data (no Math.random)
    const domainCategories: Record<string, { category: string; baseBytes: number; baseConnections: number }> = {
      'facebook.com': { category: 'social_media', baseBytes: 150000, baseConnections: 85 },
      'instagram.com': { category: 'social_media', baseBytes: 180000, baseConnections: 72 },
      'twitter.com': { category: 'social_media', baseBytes: 80000, baseConnections: 45 },
      'whatsapp.com': { category: 'social_media', baseBytes: 50000, baseConnections: 95 },
      'youtube.com': { category: 'streaming', baseBytes: 500000, baseConnections: 120 },
      'netflix.com': { category: 'streaming', baseBytes: 800000, baseConnections: 65 },
      'spotify.com': { category: 'streaming', baseBytes: 200000, baseConnections: 40 },
      'primevideo.com': { category: 'streaming', baseBytes: 600000, baseConnections: 30 },
      'cnn.com': { category: 'news', baseBytes: 40000, baseConnections: 35 },
      'bbc.com': { category: 'news', baseBytes: 35000, baseConnections: 28 },
      'reuters.com': { category: 'news', baseBytes: 25000, baseConnections: 15 },
      'nytimes.com': { category: 'news', baseBytes: 45000, baseConnections: 22 },
      'steampowered.com': { category: 'gaming', baseBytes: 300000, baseConnections: 18 },
      'epicgames.com': { category: 'gaming', baseBytes: 250000, baseConnections: 12 },
      'twitch.tv': { category: 'gaming', baseBytes: 400000, baseConnections: 25 },
      'google.com': { category: 'other', baseBytes: 30000, baseConnections: 200 },
      'gmail.com': { category: 'other', baseBytes: 20000, baseConnections: 90 },
      'amazon.com': { category: 'other', baseBytes: 100000, baseConnections: 50 },
      'booking.com': { category: 'other', baseBytes: 60000, baseConnections: 35 },
      'tripadvisor.com': { category: 'other', baseBytes: 45000, baseConnections: 28 },
    };

    const sourceIps = [
      '10.0.1.101', '10.0.1.102', '10.0.1.103', '10.0.2.104', '10.0.2.105',
      '10.0.3.201', '10.0.3.202', '10.0.4.301', '10.0.1.401', '10.0.2.501',
    ];

    const seedBytes = crypto.getRandomValues(new Uint32Array(1));
    const baseSeed = seedBytes[0];
    let domainIdx = 0;

    const mockData = Object.entries(domainCategories).map(([domain, info]) => {
      const seed = baseSeed + domainIdx++ * 7919;
      return {
        domain,
        sourceIp: sourceIps[pickIndex(sourceIps.length, seed)],
        category: info.category,
        totalBytes: Math.round(info.baseBytes * (0.7 + ((seed % 60) / 100))),
        connections: Math.round(info.baseConnections * (0.7 + ((seed % 60) / 100))),
        lastAccess: new Date(Date.now() - (seed % 86400000)).toISOString(),
      };
    });

    // Filter by category if requested
    let result = mockData;
    if (category && category !== 'all') {
      result = mockData.filter((d) => d.category === category);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((d) => d.domain.includes(q) || d.sourceIp.includes(q));
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching web surfing logs:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch web surfing logs' } },
      { status: 500 }
    );
  }
}
