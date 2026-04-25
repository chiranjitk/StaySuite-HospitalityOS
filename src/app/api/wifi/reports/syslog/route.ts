import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';

// GET /api/wifi/reports/syslog - List syslog server configurations
export async function GET(request: NextRequest) {
  const user = await requirePermission(request, 'network.manage');
  if (user instanceof NextResponse) return user;

  try {
    // Try to get from database
    const dbServers = await db.syslogServer.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { createdAt: 'desc' },
    });

    if (dbServers.length > 0) {
      // Format DB data for the frontend
      const servers = dbServers.map((s) => {
        let categories: string[] = [];
        try {
          categories = JSON.parse(s.categories || '[]');
        } catch { /* ignore */ }

        return {
          id: s.id,
          name: s.name,
          host: s.host,
          port: s.port,
          protocol: s.protocol,
          format: s.format === 'ietf' ? 'RFC5424' : s.format === 'bsd' ? 'RFC3164' : s.format.toUpperCase(),
          facility: s.facility,
          severity: s.severity,
          categories,
          status: s.enabled ? 'connected' : 'disconnected',
          tlsVerify: s.tlsVerify,
        };
      });

      // Generate sample syslog entries
      const entries = generateSyslogEntries(servers.filter((s) => s.status === 'connected'));

      return NextResponse.json({
        success: true,
        data: { servers, entries },
      });
    }

    // Fallback: Return mock syslog servers
    const mockServers: {
      id: string;
      name: string;
      host: string;
      port: number;
      protocol: string;
      format: string;
      facility: string;
      severity: string;
      categories: string[];
      status: string;
      tlsVerify: boolean;
    }[] = [
      {
        id: 'syslog-1',
        name: 'SIEM Collector',
        host: '10.10.1.50',
        port: 514,
        protocol: 'udp',
        format: 'RFC5424',
        facility: 'local1',
        severity: 'info',
        categories: ['auth', 'firewall', 'radius'],
        status: 'connected',
        tlsVerify: false,
      },
      {
        id: 'syslog-2',
        name: 'Log Aggregator',
        host: '10.10.1.51',
        port: 6514,
        protocol: 'tls',
        format: 'RFC5424',
        facility: 'local0',
        severity: 'warning',
        categories: ['dhcp', 'dns', 'system'],
        status: 'connected',
        tlsVerify: true,
      },
      {
        id: 'syslog-3',
        name: 'Compliance Archive',
        host: '10.10.2.100',
        port: 514,
        protocol: 'tcp',
        format: 'RFC3164',
        facility: 'auth',
        severity: 'notice',
        categories: ['auth', 'portal'],
        status: 'disconnected',
        tlsVerify: false,
      },
    ];

    const entries = generateSyslogEntries(mockServers.filter((s) => s.status === 'connected'));

    return NextResponse.json({
      success: true,
      data: { servers: mockServers, entries },
    });
  } catch (error) {
    console.error('Error fetching syslog servers:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch syslog servers' } },
      { status: 500 }
    );
  }
}

// POST /api/wifi/reports/syslog - Create syslog server configuration
export async function POST(request: NextRequest) {
  const user = await requirePermission(request, 'network.manage');
  if (user instanceof NextResponse) return user;

  try {
    const body = await request.json();
    const tenantId = user.tenantId;

    const {
      propertyId,
      name,
      protocol = 'udp',
      host,
      port = 514,
      format = 'ietf',
      facility = 'local1',
      severity = 'info',
      categories = [],
      enabled = false,
      tlsCertPath,
      tlsVerify = true,
    } = body;

    if (!name || !host) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: name, host' } },
        { status: 400 }
      );
    }

    // Find first property for this tenant if not specified
    let propId = propertyId;
    if (!propId) {
      const firstProperty = await db.property.findFirst({
        where: { tenantId },
      });
      propId = firstProperty?.id;
    }

    if (!propId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'No property found for this tenant' } },
        { status: 404 }
      );
    }

    const server = await db.syslogServer.create({
      data: {
        tenantId,
        propertyId: propId,
        name,
        protocol,
        host,
        port: parseInt(String(port), 10) || 514,
        format,
        facility,
        severity,
        categories: typeof categories === 'string' ? categories : JSON.stringify(categories),
        enabled,
        tlsCertPath,
        tlsVerify,
      },
    });

    return NextResponse.json({ success: true, data: server }, { status: 201 });
  } catch (error) {
    console.error('Error creating syslog server:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create syslog server' } },
      { status: 500 }
    );
  }
}

// Helper: Generate sample syslog entries
function generateSyslogEntries(activeServers: { name: string; host: string; port: number; format: string; facility: string; severity: string }[]): string[] {
  const now = new Date();
  const entries: string[] = [];

  const logTemplates = [
    '<{pri}>1 {timestamp} {hostname} freeradius {pid} - - Auth request received from 10.0.1.101',
    '<{pri}>1 {timestamp} {hostname} kea-dhcp4 {pid} - - DHCPDISCOVER from AA:BB:CC:01:01:01',
    '<{pri}>1 {timestamp} {hostname} captive-portal {pid} - - Guest guest-101 authenticated via voucher',
    '<{pri}>1 {timestamp} {hostname} iptables {pid} - - NAT: 10.0.1.101:54321 -> 142.250.80.46:443 ALLOW',
    '<{pri}>1 {timestamp} {hostname} dns-resolver {pid} - - Query: A youtube.com from 10.0.2.104',
  ];

  const severityMap: Record<string, number> = {
    emerg: 0, alert: 1, crit: 2, error: 3, warning: 4, notice: 5, info: 6, debug: 7,
  };
  const facilityMap: Record<string, number> = {
    local0: 128, local1: 136, auth: 16, daemon: 24, syslog: 40, kern: 0, user: 8,
  };

  for (let i = 0; i < 5; i++) {
    const template = logTemplates[i % logTemplates.length];
    const server = activeServers[i % activeServers.length] || { facility: 'local1', severity: 'info' };
    const facility = facilityMap[server.facility] ?? 136;
    const severity = severityMap[server.severity] ?? 6;
    const pri = facility + severity;
    const ts = new Date(now.getTime() - i * 60000);
    const timestamp = ts.toISOString();

    entries.push(
      template
        .replace('{pri}', String(pri))
        .replace('{timestamp}', timestamp)
        .replace('{hostname}', 'staysuite-gw-01')
        .replace('{pid}', String(1000 + i * 234))
    );
  }

  return entries;
}
