import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import * as fs from 'fs';
import { readInterfaceRolesFromOS } from '@/lib/interface-role-persist';
import { listInterfaces as listInterfacesScript, InterfaceInfo } from '@/lib/network/interface';
import { listRoutes as listRoutesScript, RouteInfo } from '@/lib/network/route';

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
 * Get OS interfaces via shell script wrapper (with inline fallback).
 * Tries shell script first, falls back to inline /sys/class/net/ reading
 * if scripts are not deployed yet.
 */
function getOsInterfaces(): OsInterface[] {
  // Read OS-persisted roles once
  let osPersistedRoles: Map<string, { role: string; priority: number }> | null = null;
  try {
    osPersistedRoles = readInterfaceRolesFromOS();
  } catch {
    osPersistedRoles = null;
  }

  // Try shell script wrapper first
  try {
    const result = listInterfacesScript();
    if (result.success && result.data && Array.isArray(result.data.interfaces)) {
      return result.data.interfaces.map(iface => mapToOsInterface(iface, osPersistedRoles));
    }
    console.warn('[Network OS API] Shell script listInterfaces failed, using inline fallback:', result.error);
  } catch (e) {
    console.warn('[Network OS API] Shell script listInterfaces not available, using inline fallback:', e instanceof Error ? e.message : e);
  }

  // Inline fallback: read from /sys/class/net/ directly
  return getOsInterfacesInline(osPersistedRoles);
}

/**
 * Inline fallback for reading interfaces when shell scripts are not available.
 */
function getOsInterfacesInline(osPersistedRoles: Map<string, { role: string; priority: number }> | null): OsInterface[] {
  const interfaces: OsInterface[] = [];
  let netDirs: string[] = [];
  try {
    netDirs = fs.readdirSync('/sys/class/net/').sort();
  } catch {
    return interfaces;
  }

  for (const ifaceName of netDirs) {
    const basePath = `/sys/class/net/${ifaceName}`;
    try {
      const operstate = safeReadFile(`${basePath}/operstate`).trim();
      const carrier = safeReadFile(`${basePath}/carrier`).trim();
      const isUp = operstate === 'up' || carrier === '1';
      const type = detectInterfaceType(ifaceName, basePath);
      const mac = safeReadFile(`${basePath}/address`).trim() || '00:00:00:00:00:00';
      const mtu = parseInt(safeReadFile(`${basePath}/mtu`).trim()) || 1500;
      const speed = safeReadFile(`${basePath}/speed`).trim();
      const duplex = safeReadFile(`${basePath}/duplex`).trim();

      // Get IPs
      const ipOutput = safeExec(`ip -o -4 addr show dev ${ifaceName} 2>/dev/null`);
      const ipv4Addresses: string[] = [];
      for (const line of ipOutput.trim().split('\n').filter(Boolean)) {
        const match = line.match(/inet\s+([\d./]+)/);
        if (match) ipv4Addresses.push(match[1]);
      }

      const ip6Output = safeExec(`ip -o -6 addr show dev ${ifaceName} 2>/dev/null`);
      const ipv6Addresses: string[] = [];
      for (const line of ip6Output.trim().split('\n').filter(Boolean)) {
        const match = line.match(/inet6\s+([\S]+)/);
        if (match) ipv6Addresses.push(match[1]);
      }

      // Stats
      const rxBytes = parseInt(safeReadFile(`${basePath}/statistics/rx_bytes`).trim()) || 0;
      const txBytes = parseInt(safeReadFile(`${basePath}/statistics/tx_bytes`).trim()) || 0;
      const rxPackets = parseInt(safeReadFile(`${basePath}/statistics/rx_packets`).trim()) || 0;
      const txPackets = parseInt(safeReadFile(`${basePath}/statistics/tx_packets`).trim()) || 0;
      const rxErrors = parseInt(safeReadFile(`${basePath}/statistics/rx_errors`).trim()) || 0;
      const txErrors = parseInt(safeReadFile(`${basePath}/statistics/tx_errors`).trim()) || 0;

      // Bridge ports
      let bridgePorts: string[] = [];
      try {
        const bridgePath = `${basePath}/brif`;
        if (fs.existsSync(bridgePath)) {
          bridgePorts = fs.readdirSync(bridgePath);
        }
      } catch {}

      // Bond members
      let bondMembers: string[] = [];
      try {
        const bondPath = `/sys/class/net/${ifaceName}/bonding/slaves`;
        if (fs.existsSync(bondPath)) {
          bondMembers = safeReadFile(bondPath).trim().split(/\s+/).filter(Boolean);
        }
      } catch {}

      // Role
      let role: OsInterface['role'] = 'unknown';
      if (ifaceName === 'lo') {
        role = 'management';
      } else if (type === 'ethernet') {
        role = 'lan';
      } else if (type === 'wifi' || ifaceName.startsWith('wlan') || ifaceName.startsWith('wl')) {
        role = 'guest';
      } else if (type === 'bridge' || ifaceName.startsWith('br')) {
        role = 'lan';
      }
      if (osPersistedRoles) {
        const persisted = osPersistedRoles.get(ifaceName);
        if (persisted && VALID_ROLE_VALUES.includes(persisted.role)) {
          role = persisted.role as OsInterface['role'];
        }
      }

      interfaces.push({
        name: ifaceName,
        type: type as OsInterface['type'],
        macAddress: mac,
        ipv4Addresses,
        ipv6Addresses,
        gateway: '',
        dnsServers: [],
        mtu,
        state: isUp ? 'up' : 'down',
        speed: speed !== '' ? `${speed} Mbps` : (type === 'loopback' ? '' : 'Unknown'),
        duplex: duplex !== '' ? duplex : (type === 'loopback' ? '' : 'Unknown'),
        rxBytes, txBytes, rxPackets, txPackets, rxErrors, txErrors,
        isDefaultRoute: false,
        vendor: '',
        driver: '',
        vlans: [],
        bridgePorts,
        bondMembers,
        role,
        dhcpEnabled: false,
        createdAt: new Date().toISOString(),
      });
    } catch {
      // Skip this interface if we can't read it
    }
  }

  return interfaces;
}

function safeReadFile(path: string): string {
  try { return fs.readFileSync(path, 'utf-8'); } catch { return ''; }
}

function detectInterfaceType(name: string, basePath: string): string {
  if (name === 'lo') return 'loopback';
  if (fs.existsSync(`${basePath}/bridge`)) return 'bridge';
  if (fs.existsSync(`${basePath}/bonding`)) return 'bond';
  if (name.includes('.')) return 'vlan';
  if (name.startsWith('wlan') || name.startsWith('wl')) return 'wifi';
  if (name.startsWith('br')) return 'bridge';
  if (name.startsWith('bond')) return 'bond';
  if (name.startsWith('veth') || name.startsWith('docker') || name.startsWith('virbr')) return 'virtual';
  return 'ethernet';
}

/**
 * Get OS routes via shell script wrapper (with inline fallback).
 */
function getOsRoutes(): OsRoute[] {
  // Try shell script wrapper first
  try {
    const result = listRoutesScript();
    if (result.success && result.data && Array.isArray(result.data.routes)) {
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
    console.warn('[Network OS API] Shell script listRoutes failed, using inline fallback:', result.error);
  } catch (e) {
    console.warn('[Network OS API] Shell script listRoutes not available, using inline fallback:', e instanceof Error ? e.message : e);
  }

  // Inline fallback: parse `ip route show` directly
  return getOsRoutesInline();
}

/**
 * Inline fallback for reading routes when shell scripts are not available.
 */
function getOsRoutesInline(): OsRoute[] {
  const routes: OsRoute[] = [];
  const output = safeExec('ip -o route show 2>/dev/null');
  for (const line of output.trim().split('\n').filter(Boolean)) {
    try {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 1) continue;
      const destination = parts[0] === 'default' ? '0.0.0.0/0' : parts[0];
      const viaIdx = parts.indexOf('via');
      const devIdx = parts.indexOf('dev');
      const metricIdx = parts.indexOf('metric');
      routes.push({
        destination,
        gateway: viaIdx >= 0 ? (parts[viaIdx + 1] || '') : '',
        interface: devIdx >= 0 ? (parts[devIdx + 1] || '') : '',
        metric: metricIdx >= 0 ? parseInt(parts[metricIdx + 1]) || 0 : 0,
        scope: parts.includes('link') ? 'link' : 'global',
        protocol: '',
        isDefault: parts[0] === 'default',
      });
    } catch {
      // Skip malformed lines
    }
  }
  return routes;
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
