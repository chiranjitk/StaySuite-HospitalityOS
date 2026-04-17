import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import { scanConnections, getDeviceStatus } from '@/lib/network/nmcli';
import { NET_TYPES, NET_TYPE_LABELS, netTypeToLabel } from '@/lib/network/nettypes';
import { parseNmConnectionFile, getRoutes, getInterfaceName } from '@/lib/network/nmconnection';
import { NM_CONNECTIONS_DIR } from '@/lib/network/nettypes';
import type { NmConnectionInfo } from '@/lib/network/nmcli';

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

/**
 * Augment an interface with live system data from /sys/class/net/{name}/.
 * Reads MAC address, link speed, and traffic counters.
 */
function augmentWithSysData(iface: NmConnectionInfo): NmConnectionInfo {
  const ifName = iface.deviceName || iface.name;
  const sysPath = `/sys/class/net/${ifName}`;
  if (!fs.existsSync(sysPath)) return iface;

  try {
    // MAC address
    const macPath = `${sysPath}/address`;
    if (fs.existsSync(macPath)) {
      const mac = fs.readFileSync(macPath, 'utf-8').trim();
      if (mac && mac !== '00:00:00:00:00:00') {
        iface.mac = mac;
      }
    }
  } catch { /* ignore */ }

  try {
    // Link speed (Mbps)
    const speedPath = `${sysPath}/speed`;
    if (fs.existsSync(speedPath)) {
      const speedVal = parseInt(fs.readFileSync(speedPath, 'utf-8').trim(), 10);
      if (!isNaN(speedVal) && speedVal > 0) {
        iface.speed = speedVal;
      }
    }
  } catch { /* ignore */ }

  try {
    // RX bytes
    const rxPath = `${sysPath}/statistics/rx_bytes`;
    if (fs.existsSync(rxPath)) {
      const rxVal = parseInt(fs.readFileSync(rxPath, 'utf-8').trim(), 10);
      if (!isNaN(rxVal)) {
        iface.rxBytes = rxVal;
      }
    }
  } catch { /* ignore */ }

  try {
    // TX bytes
    const txPath = `${sysPath}/statistics/tx_bytes`;
    if (fs.existsSync(txPath)) {
      const txVal = parseInt(fs.readFileSync(txPath, 'utf-8').trim(), 10);
      if (!isNaN(txVal)) {
        iface.txBytes = txVal;
      }
    }
  } catch { /* ignore */ }

  return iface;
}

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

    if (section === 'routes') {
      return NextResponse.json({ success: true, data: getRoutesFromSystem() });
    }

    // Scan .nmconnection files
    const interfaces = scanConnections();

    // Augment each interface with live system data (MAC, speed, traffic)
    for (let i = 0; i < interfaces.length; i++) {
      interfaces[i] = augmentWithSysData(interfaces[i]);
    }

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
      osRelease = execSync("cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d'\"' -f2", { encoding: 'utf-8' }).trim();
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

/**
 * Get all routes from the system.
 * Reads routes from:
 *   1. .nmconnection files (ipv4.routes = semicolon-separated "dest gw [metric]" entries)
 *   2. Live OS routing table via nmcli/ip route
 * Returns a merged, deduplicated list.
 */
function getRoutesFromSystem(): Array<{
  destination: string;
  gateway: string;
  interface: string;
  metric: number;
  protocol: string;
  isDefault: boolean;
}> {
  const routeMap = new Map<string, any>(); // key = dest+gw → route

  // 1. Read routes from .nmconnection files (configured static routes)
  if (fs.existsSync(NM_CONNECTIONS_DIR)) {
    try {
      const entries = fs.readdirSync(NM_CONNECTIONS_DIR).sort();
      for (const entry of entries) {
        if (!entry.endsWith('.nmconnection')) continue;
        const filePath = `${NM_CONNECTIONS_DIR}/${entry}`;
        try {
          const parsed = parseNmConnectionFile(filePath);
          const ifName = getInterfaceName(parsed) || parsed.name;
          const routeStrings = getRoutes(parsed);
          for (const routeStr of routeStrings) {
            // nmcli routes format: "dest gw" or "dest gw metric"
            const parts = routeStr.trim().split(/\s+/);
            if (parts.length >= 2) {
              const dest = parts[0];
              const gw = parts[1];
              const metricMatch = routeStr.match(/metric\s+(\d+)/);
              const metric = metricMatch ? parseInt(metricMatch[1], 10) : 0;
              const isDefault = dest === '0.0.0.0/0' || dest === 'default';
              const key = `${dest}:${gw}`;
              if (!routeMap.has(key)) {
                routeMap.set(key, {
                  destination: dest,
                  gateway: gw,
                  interface: ifName,
                  metric,
                  protocol: 'static',
                  isDefault,
                });
              }
            }
          }
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
  }

  // 2. Read live OS routing table via nmcli -j route show (or ip route fallback)
  try {
    const output = execSync('nmcli -j route show 2>/dev/null', { encoding: 'utf-8', timeout: 5000 });
    if (output) {
      const parsed = JSON.parse(output);
      if (Array.isArray(parsed)) {
        for (const route of parsed) {
          const dest = route.dst || '';
          const gw = route.gw || '';
          const dev = route.dev || '';
          const metric = parseInt(route.metric, 10) || 0;
          const proto = route.proto || 'kernel';
          if (dest && gw) {
            const key = `${dest}:${gw}`;
            // OS routes override config routes for live data (has dev name)
            if (!routeMap.has(key)) {
              routeMap.set(key, {
                destination: dest,
                gateway: gw,
                interface: dev,
                metric,
                protocol: proto,
                isDefault: dest === '0.0.0.0/0' || dest === 'default',
              });
            } else {
              // Update interface name from live data
              const existing = routeMap.get(key);
              if (dev && !existing.interface) existing.interface = dev;
            }
          }
        }
      }
    }
  } catch {
    // Fallback to ip route
    try {
      const output = execSync('ip -4 route show 2>/dev/null', { encoding: 'utf-8', timeout: 5000 });
      for (const line of output.trim().split('\n').filter(Boolean)) {
        const parts = line.split(/\s+/);
        if (parts.length >= 3) {
          const dest = parts[0] || 'unknown';
          const gw = parts.find((p, i) => parts[i - 1] === 'via') || '';
          const dev = parts.find((p, i) => parts[i - 1] === 'dev') || '';
          const metricMatch = line.match(/metric\s+(\d+)/);
          const metric = metricMatch ? parseInt(metricMatch[1], 10) : 0;
          if (dest && gw) {
            const key = `${dest}:${gw}`;
            if (!routeMap.has(key)) {
              routeMap.set(key, {
                destination: dest === 'default' ? '0.0.0.0/0' : dest,
                gateway: gw,
                interface: dev,
                metric,
                protocol: 'kernel',
                isDefault: dest === 'default',
              });
            }
          }
        }
      }
    } catch { /* skip */ }
  }

  return Array.from(routeMap.values());
}
