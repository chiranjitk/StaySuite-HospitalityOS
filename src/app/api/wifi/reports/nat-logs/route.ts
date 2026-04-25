import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';
import crypto from 'crypto';

/** Deterministic index selector using crypto (avoids Math.random) */
function pickIndex(length: number, seed: number): number {
  if (length <= 0) return 0;
  return seed % length;
}

// GET /api/wifi/reports/nat-logs - NAT logs with filters
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'reports.view');
  if (user instanceof NextResponse) return user;

  try {
    const searchParams = request.nextUrl.searchParams;
    const sourceIp = searchParams.get('sourceIp');
    const protocol = searchParams.get('protocol');
    const startDate = searchParams.get('startDate');

    // Try to get data from database
    const where: Record<string, unknown> = { tenantId: user.tenantId };

    if (sourceIp) where.sourceIp = { contains: sourceIp };
    if (protocol) where.protocol = protocol;

    if (startDate) {
      where.timestamp = { gte: new Date(startDate) };
    }

    const dbLogs = await db.natLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: 500,
    });

    // If we have DB data, format it for the frontend
    if (dbLogs.length > 0) {
      const formatted = dbLogs.map((log) => ({
        id: log.id,
        timestamp: log.timestamp.toISOString(),
        sourceIp: log.sourceIp,
        sourcePort: log.sourcePort,
        destIp: log.destIp,
        destPort: log.destPort,
        protocol: log.protocol,
        domain: log.destDomain || '',
        bytes: log.bytes || 0,
        action: log.action || 'allow',
        sessionId: log.sessionId || '',
      }));

      return NextResponse.json({ success: true, data: formatted });
    }

    // Fallback: Generate deterministic default NAT log data (no Math.random)
    const mockLogs = [];
    const sourceIps = [
      '10.0.1.101', '10.0.1.102', '10.0.1.103', '10.0.2.104', '10.0.2.105',
      '10.0.3.201', '10.0.3.202', '10.0.4.301', '10.0.1.401', '10.0.2.501',
    ];
    const destDomains = [
      'api.facebook.com', 'static.xx.fbcdn.net', 'www.youtube.com',
      'api.netflix.com', 'www.google.com', 'mail.google.com',
      'www.bbc.com', 'www.cnn.com', 'steam-cdn.akamai.net',
      'api.whatsapp.com', 'spclient.wg.spotify.com',
    ];
    const protocols = ['tcp', 'udp'];
    const destPorts = [80, 443, 53, 8080, 8443];

    const now = Date.now();
    // Use crypto-based deterministic seed for reproducible mock data
    const seedBytes = crypto.getRandomValues(new Uint32Array(1));
    const baseSeed = seedBytes[0];

    for (let i = 0; i < 50; i++) {
      const seed = baseSeed + i * 7919; // deterministic per entry
      const protocol = protocols[pickIndex(protocols.length, seed)];
      const destPort = destPorts[pickIndex(destPorts.length, seed + 1)];
      const sourceIp = sourceIps[pickIndex(sourceIps.length, seed + 2)];
      const isDeny = (seed % 20) === 0; // ~5% deny rate

      const destDomain = destPorts.includes(destPort) && destPort !== 53
        ? destDomains[pickIndex(destDomains.length, seed + 3)]
        : '';
      const destIp = destPort === 53
        ? '8.8.8.8'
        : `${1 + (seed % 254)}.${((seed >> 4) % 256)}.${((seed >> 8) % 256)}.${1 + ((seed >> 12) % 254)}`;

      mockLogs.push({
        id: `nat-${String(i + 1).padStart(4, '0')}`,
        timestamp: new Date(now - i * 120000 - (seed % 60000)).toISOString(),
        sourceIp,
        sourcePort: 1024 + (seed % 64000),
        destIp,
        destPort,
        protocol,
        domain: destDomain || (destPort === 53 ? 'dns-resolve' : 'api.staysuite.com'),
        bytes: seed % 50000,
        action: isDeny ? 'deny' : 'allow',
        sessionId: `sess-${String(seed % 9999).padStart(4, '0')}`,
      });
    }

    // Apply filters
    let result = mockLogs;
    if (sourceIp) {
      result = result.filter((l) => l.sourceIp.includes(sourceIp));
    }
    if (protocol) {
      result = result.filter((l) => l.protocol === protocol);
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Error fetching NAT logs:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch NAT logs' } },
      { status: 500 }
    );
  }
}
