import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import * as fs from 'fs';
import { readInterfaceRolesFromOS } from '@/lib/interface-role-persist';
import { listInterfaces, InterfaceInfo } from '@/lib/network/interface';
import { listRoutes, RouteInfo } from '@/lib/network/route';

/**
 * GET /api/network/os - Get comprehensive OS network data
 * Returns interfaces, system info, routes, DNS config, and ARP table
 *
 * Uses shell script wrappers from @/lib/network for interface listing
 * and route listing. System info, DNS, and ARP are read inline (read-only).
 */

function safeExec(cmd: string, timeout = 5000): string {
  try { return execSync(cmd, { encoding: 'utf-8', timeout }); } catch { return ''; }
}

interface OsInterface {
  name: string;
  type: 'ethernet' | 'wifi' | 'loopback' | 'bridge' | 'bond' | 'vlan' | 'virtual' | 'tunnel' | 'unknown';
  macAddress: string;
  ipv4Addresses: string[];
  ipv6Addresses: string[];
  gateway: string;
  dnsServers: string[];
  mtu: number;
  state: 'up' | 'down' | 'unknown';
  speed: string;
  duplex: string;
  rxBytes: number;
  txBytes: number;
  rxPackets: number;
  txPackets: number;
  rxErrors: number;
  txErrors: number;
  isDefaultRoute: boolean;
  vendor: string;
  driver: string;
  vlans: string[];
  bridgePorts: string[];
  bondMembers: string[];
  role: 'wan' | 'lan' | 'management' | 'guest' | 'iot' | 'unknown';
  dhcpEnabled: boolean;
  createdAt: string;
}

const VALID_ROLE_VALUES: string[] = ['wan', 'lan', 'dmz', 'management', 'wifi', 'guest', 'iot', 'unused'];

const VALID_INTERFACE_TYPES: string[] = ['ethernet', 'wifi', 'loopback', 'bridge', 'bond', 'vlan', 'virtual', 'tunnel', 'unknown'];

interface OsRoute {
  destination: string;
  gateway: string;
  interface: string;
  metric: number;
  scope: string;
  protocol: string;
  isDefault: boolean;
}

interface OsDnsConfig {
  nameservers: string[];
  search: string[];
  source: string;
}

interface OsArpEntry {
  ipAddress: string;
  macAddress: string;
  interface: string;
  state: string;
}

/**
 * Map shell script InterfaceInfo to OsInterface shape.
 * Enriches with OS-persisted role tags and defaults for fields
 * not provided by the wrapper.
 */
function mapToOsInterface(iface: InterfaceInfo, osPersistedRoles: Map<string, { role: string; priority: number }> | null): OsInterface {
  const safeType = VALID_INTERFACE_TYPES.includes(iface.type) ? iface.type as OsInterface['type'] : 'unknown';

  // Determine role: OS-persisted tag takes priority, otherwise heuristic
  let role: OsInterface['role'] = 'unknown';
  if (iface.name === 'lo') {
    role = 'management';
  } else if (safeType === 'ethernet') {
    role = 'lan';
  } else if (safeType === 'wifi' || iface.name.startsWith('wlan') || iface.name.startsWith('wl')) {
    role = 'guest';
  } else if (safeType === 'bridge' || iface.name.startsWith('br')) {
    role = 'lan';
  }

  if (osPersistedRoles) {
    const persisted = osPersistedRoles.get(iface.name);
    if (persisted && VALID_ROLE_VALUES.includes(persisted.role)) {
      role = persisted.role as OsInterface['role'];
    }
  }

  return {
    name: iface.name,
    type: safeType,
    macAddress: iface.hwAddress || '00:00:00:00:00:00',
    ipv4Addresses: iface.ipv4Addresses || [],
    ipv6Addresses: iface.ipv6Addresses || [],
    gateway: '',
    dnsServers: [],
    mtu: iface.mtu || 1500,
    state: iface.state === 'up' || iface.state === 'UNKNOWN' ? 'up' : iface.state === 'down' ? 'down' : 'unknown',
    speed: iface.speed || (safeType === 'loopback' ? '' : 'Unknown'),
    duplex: iface.duplex || (safeType === 'loopback' ? '' : 'Unknown'),
    rxBytes: iface.stats?.rxBytes || 0,
    txBytes: iface.stats?.txBytes || 0,
    rxPackets: iface.stats?.rxPackets || 0,
    txPackets: iface.stats?.txPackets || 0,
    rxErrors: iface.stats?.rxErrors || 0,
    txErrors: iface.stats?.txErrors || 0,
    isDefaultRoute: false,
    vendor: '',
    driver: '',
    vlans: [],
    bridgePorts: [],
    bondMembers: [],
    role,
    dhcpEnabled: false,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Get OS interfaces via shell script wrapper, enriched with role data.
 */
function getOsInterfaces(): OsInterface[] {
  // Read OS-persisted roles once
  let osPersistedRoles: Map<string, { role: string; priority: number }> | null = null;
  try {
    osPersistedRoles = readInterfaceRolesFromOS();
  } catch {
    osPersistedRoles = null;
  }

  // Call shell script wrapper
  const result = listInterfaces();
  if (!result.success || !result.data) {
    console.warn('[Network OS API] listInterfaces script failed:', result.error);
    return [];
  }

  return result.data.interfaces.map(iface => mapToOsInterface(iface, osPersistedRoles));
}

/**
 * Get OS routes via shell script wrapper, mapped to OsRoute shape.
 */
function getOsRoutes(): OsRoute[] {
  const result = listRoutes();
  if (!result.success || !result.data) {
    console.warn('[Network OS API] listRoutes script failed:', result.error);
    return [];
  }

  return result.data.routes.map((r: RouteInfo) => ({
    destination: r.destination === 'default' ? '0.0.0.0/0' : r.destination,
    gateway: r.gateway || '',
    interface: r.interface || '',
    metric: r.metric || 0,
    scope: '',
    protocol: r.protocol || '',
    isDefault: r.destination === 'default',
  }));
}

function getOsSystemInfo() {
  const hostname = safeExec('hostname 2>/dev/null').trim() || 'unknown';
  const kernel = safeExec('uname -r 2>/dev/null').trim() || 'unknown';
  const osRelease = safeExec('cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d= -f2 | tr -d \'"\'').trim() || 'Linux';

  // Uptime
  let uptimeFormatted = '';
  try {
    const uptimeSec = parseFloat(fs.readFileSync('/proc/uptime', 'utf-8').split(' ')[0]);
    const days = Math.floor(uptimeSec / 86400);
    const hours = Math.floor((uptimeSec % 86400) / 3600);
    const mins = Math.floor((uptimeSec % 3600) / 60);
    uptimeFormatted = days > 0 ? `${days}d ${hours}h ${mins}m` : `${hours}h ${mins}m`;
  } catch { uptimeFormatted = 'Unknown'; }

  // Load average
  let loadAverage = '';
  try {
    loadAverage = fs.readFileSync('/proc/loadavg', 'utf-8').split(' ').slice(0, 3).join(', ');
  } catch { loadAverage = 'Unknown'; }

  // Memory
  let memory = { total: 0, used: 0, usagePercent: 0 };
  try {
    const memInfo = fs.readFileSync('/proc/meminfo', 'utf-8');
    const totalMatch = memInfo.match(/MemTotal:\s+(\d+)/);
    const availMatch = memInfo.match(/MemAvailable:\s+(\d+)/);
    const total = totalMatch ? parseInt(totalMatch[1]) * 1024 : 0;
    const available = availMatch ? parseInt(availMatch[1]) * 1024 : 0;
    const used = total - available;
    memory = { total, used, usagePercent: total > 0 ? Math.round((used / total) * 100) : 0 };
  } catch {}

  // CPU count
  let cpuCount = 0;
  try {
    cpuCount = fs.readFileSync('/proc/cpuinfo', 'utf-8')
      .split('\n')
      .filter(line => line.startsWith('processor')).length;
  } catch { cpuCount = 1; }

  return { hostname, kernel, osRelease, uptimeFormatted, loadAverage, memory, cpuCount };
}

function getOsDnsConfig(): OsDnsConfig {
  const nameservers: string[] = [];
  const search: string[] = [];
  let source = 'unknown';

  try {
    const resolvConf = fs.readFileSync('/etc/resolv.conf', 'utf-8');
    for (const line of resolvConf.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('nameserver')) nameservers.push(trimmed.split(/\s+/)[1]);
      if (trimmed.startsWith('search')) search.push(...trimmed.split(/\s+/).slice(1));
    }
    source = '/etc/resolv.conf';
  } catch {}

  return { nameservers, search, source };
}

function getOsArpTable(): OsArpEntry[] {
  const entries: OsArpEntry[] = [];
  const output = safeExec("ip -o neigh show 2>/dev/null");
  for (const line of output.trim().split('\n').filter(Boolean)) {
    const parts = line.split(/\s+/);
    if (parts.length >= 4) {
      entries.push({
        ipAddress: parts[0],
        macAddress: parts[4] === 'FAILED' || parts[4] === '' ? '' : parts[4],
        interface: parts[2],
        state: parts[5] || parts[4] || 'unknown',
      });
    }
  }
  return entries;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const section = searchParams.get('section'); // interfaces, system-info, routes, dns, arp, all

    if (section === 'interfaces') {
      return NextResponse.json({ success: true, data: getOsInterfaces() });
    }

    if (section === 'system-info') {
      return NextResponse.json({ success: true, data: getOsSystemInfo() });
    }

    if (section === 'routes') {
      return NextResponse.json({ success: true, data: getOsRoutes() });
    }

    if (section === 'dns') {
      return NextResponse.json({ success: true, data: getOsDnsConfig() });
    }

    if (section === 'arp') {
      return NextResponse.json({ success: true, data: getOsArpTable() });
    }

    // Default: return all data
    return NextResponse.json({
      success: true,
      data: {
        interfaces: getOsInterfaces(),
        systemInfo: getOsSystemInfo(),
        routes: getOsRoutes(),
        dns: getOsDnsConfig(),
        arp: getOsArpTable(),
      },
    });
  } catch (error) {
    console.error('[Network OS API] Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'OS_ERROR', message: 'Failed to read OS network data' } },
      { status: 500 }
    );
  }
}
