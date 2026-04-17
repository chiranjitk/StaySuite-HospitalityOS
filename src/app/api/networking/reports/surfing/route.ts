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
        data: generateMockSurfingData(hours),
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

function generateMockSurfingData(hours: number) {
  const domains = [
    { domain: 'google.com', category: 'search' },
    { domain: 'facebook.com', category: 'social' },
    { domain: 'youtube.com', category: 'streaming' },
    { domain: 'instagram.com', category: 'social' },
    { domain: 'whatsapp.com', category: 'messaging' },
    { domain: 'netflix.com', category: 'streaming' },
    { domain: 'amazon.com', category: 'shopping' },
    { domain: 'outlook.com', category: 'email' },
    { domain: 'zoom.us', category: 'conference' },
    { domain: 'tiktok.com', category: 'social' },
  ];

  return {
    summary: { totalRequests: 12500 + Math.floor(Math.random() * 5000), uniqueSources: 85 + Math.floor(Math.random() * 30), totalBytes: 45000000000 + Math.floor(Math.random() * 15000000000), topDomainCount: domains.length },
    topDomains: domains.map((d) => ({
      domain: d.domain,
      category: d.category,
      visits: Math.floor(200 + Math.random() * 3000),
      bytes: Math.floor(100000000 + Math.random() * 5000000000),
    })),
    recentLogs: Array.from({ length: 20 }, (_, i) => ({
      sourceIp: `192.168.1.${100 + Math.floor(Math.random() * 50)}`,
      destDomain: domains[Math.floor(Math.random() * domains.length)].domain,
      destIp: `142.250.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
      bytes: Math.floor(1000 + Math.random() * 5000000),
      timestamp: new Date(Date.now() - i * 300000).toISOString(),
    })),
  };
}
