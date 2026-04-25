import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = request.nextUrl;
    const propertyId = searchParams.get('propertyId') || 'property-1';

    // Check if we have real health data in the database
    const health = await db.systemNetworkHealth.findUnique({
      where: { propertyId },
    });

    if (health) {
      return NextResponse.json({
        hostname: health.hostname,
        kernel: health.kernelVersion,
        uptime: health.uptime,
        cpuUsage: health.cpuUsage,
        ramTotal: health.ramTotal,
        ramUsed: health.ramUsed,
        diskTotal: health.diskTotal,
        diskUsed: health.diskUsed,
        cpuTemperature: health.cpuTemperature,
        services: JSON.parse(health.services),
        lastUpdated: health.lastUpdated,
      });
    }

    // Return mock system health data
    return NextResponse.json({
      hostname: 'staysuite-gateway',
      kernel: '6.1.0-17-amd64',
      uptime: Math.floor(process.uptime()),
      cpuUsage: 23.5,
      ramTotal: 8192,
      ramUsed: 3072,
      diskTotal: 256000,
      diskUsed: 89000,
      cpuTemperature: 52.3,
      services: {
        freeradius: { running: true, pid: 1234 },
        kea: { running: true, pid: 2345 },
        dnsmasq: { running: true, pid: 3456 },
        nftables: { running: true },
        captivePortal: { running: true, pid: 4567 },
        nginx: { running: true, pid: 5678 },
        cron: { running: true, pid: 6789 },
      },
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch system health' }, { status: 500 });
  }
}
