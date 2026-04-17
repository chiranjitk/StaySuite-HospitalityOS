import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import * as os from 'os';
import { scanConnections, getDeviceStatus } from '@/lib/network/nmcli';
import { NET_TYPES, NET_TYPE_LABELS, netTypeToLabel } from '@/lib/network/nettypes';

/**
 * GET /api/network/os — Scan .nmconnection files and return all network interfaces
 *
 * On Rocky Linux 10, this scans /etc/NetworkManager/system-connections/*.nmconnection
 * files, parses the [staysuite] section for nettype (role mapping), and merges with
 * nmcli device status for runtime state.
 *
 * Query params:
 *   ?section=interfaces    → Only interfaces
 *   ?section=device-status → Only device runtime status
 *   ?section=all           → Everything (default)
 */

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const section = searchParams.get('section');

    if (section === 'device-status') {
      return NextResponse.json({ success: true, data: getDeviceStatus() });
    }

    if (section === 'system-info') {
      return NextResponse.json({ success: true, data: getSystemInfo() });
    }

    // Scan .nmconnection files
    const interfaces = scanConnections();

    // Group by nettype
    const byNetType: Record<string, typeof interfaces> = {};
    for (const iface of interfaces) {
      const label = iface.nettypeLabel;
      if (!byNetType[label]) byNetType[label] = [];
      byNetType[label].push(iface);
    }

    // Filter types
    const physical = interfaces.filter(i => i.isPhysical);
    const virtual = interfaces.filter(i => !i.isPhysical);
    const vlans = interfaces.filter(i => i.type === 'vlan');
    const bridges = interfaces.filter(i => i.type === 'bridge');
    const bonds = interfaces.filter(i => i.type === 'bond');

    if (section === 'interfaces') {
      return NextResponse.json({ success: true, data: interfaces });
    }

    return NextResponse.json({
      success: true,
      data: {
        interfaces,
        byNetType,
        physical,
        virtual,
        vlans,
        bridges,
        bonds,
        deviceStatus: getDeviceStatus(),
        netTypes: Object.fromEntries(
          Object.entries(NET_TYPES).map(([k, v]) => [k, { value: v, label: NET_TYPE_LABELS[v] }])
        ),
      },
    });
  } catch (error) {
    console.error('[Network OS API] Scan error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'SCAN_ERROR', message: 'Failed to scan network connections' } },
      { status: 500 }
    );
  }
}

/**
 * Get system info: hostname, kernel, memory, CPU, uptime, load average.
 * Works in sandbox (Node.js os module) and on Rocky 10 (real OS commands).
 */
function getSystemInfo() {
  try {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const usagePercent = totalMem > 0 ? Math.round((usedMem / totalMem) * 100) : 0;

    let hostname = os.hostname();
    let kernel = '';
    let osRelease = '';
    let uptimeFormatted = '';
    let loadAverage = '';

    // Try reading from /proc on Linux (Rocky 10)
    try {
      kernel = execSync('uname -r', { encoding: 'utf-8' }).trim();
    } catch { /* fallback: leave empty */ }

    try {
      osRelease = execSync('cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d\"\" -f2', { encoding: 'utf-8' }).trim();
    } catch {
      osRelease = `Node.js ${process.version}`;
    }

    try {
      const uptimeSec = os.uptime();
      const days = Math.floor(uptimeSec / 86400);
      const hours = Math.floor((uptimeSec % 86400) / 3600);
      const mins = Math.floor((uptimeSec % 3600) / 60);
      uptimeFormatted = days > 0 ? `${days}d ${hours}h ${mins}m` : `${hours}h ${mins}m`;
    } catch { uptimeFormatted = 'unknown'; }

    try {
      loadAverage = os.loadavg().map(l => l.toFixed(2)).join(', ');
    } catch { loadAverage = '0, 0, 0'; }

    return {
      hostname,
      kernel,
      osRelease,
      uptimeFormatted,
      loadAverage,
      memory: {
        total: totalMem,
        used: usedMem,
        usagePercent,
      },
      cpuCount: os.cpus().length,
    };
  } catch (error) {
    console.error('[Network OS API] System info error:', error);
    return null;
  }
}
