import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = request.nextUrl;
    const propertyId = searchParams.get('propertyId') || 'property-1';
    const hours = parseInt(searchParams.get('hours') || '24', 10);
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const logs = await db.natLog.findMany({
      where: {
        tenantId: user.tenantId,
        propertyId,
        timestamp: { gte: since },
        destDomain: { not: null },
      },
      orderBy: { timestamp: 'desc' },
      take: 500,
    });

    if (logs.length === 0) {
      return NextResponse.json({
        summary: { totalRequests: 0, uniqueSources: 0, totalBytes: 0, topDomainCount: 0 },
        topDomains: [],
        recentLogs: [],
      });
    }

    const topDomains = logs
      .reduce<Record<string, { visits: number; bytes: number }>>((acc, log) => {
        const domain = log.destDomain || 'unknown';
        if (!acc[domain]) acc[domain] = { visits: 0, bytes: 0 };
        acc[domain].visits++;
        acc[domain].bytes += log.bytes;
        return acc;
      }, {});

    const sortedDomains = Object.entries(topDomains)
      .map(([domain, stats]) => ({ domain, ...stats }))
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 50);

    const uniqueSources = new Set(logs.map((l) => l.sourceIp)).size;
    const totalBytes = logs.reduce((sum, l) => sum + l.bytes, 0);

    return NextResponse.json({
      summary: { totalRequests: logs.length, uniqueSources, totalBytes, topDomainCount: sortedDomains.length },
      topDomains: sortedDomains,
      recentLogs: logs.slice(0, 20).map((l) => ({
        sourceIp: l.sourceIp,
        destDomain: l.destDomain,
        destIp: l.destIp,
        bytes: l.bytes,
        timestamp: l.timestamp,
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch surfing report' }, { status: 500 });
  }
}

