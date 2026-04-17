import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import * as fs from 'fs';

/**
 * GET /api/network/os - Get comprehensive OS network data
 * Returns interfaces, system info, routes, DNS config, and ARP table
 * Works without kea-service - reads directly from OS
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

function getOsInterfaces(): OsInterface[] {
  const interfaces: OsInterface[] = [];

  let ifNames: string[] = [];
  try {
    ifNames = fs.readdirSync('/sys/class/net').filter(n => !n.startsWith('.'));
  } catch {
    const ipOut = safeExec("ip -o link show | awk -F': ' '{print $2}'");
    ifNames = ipOut.trim().split('\n').filter(Boolean);
  }

  for (const name of ifNames) {
    try {
      let type: OsInterface['type'] = 'unknown';
      const ifType = safeExec(`cat /sys/class/net/${name}/type 2>/dev/null`).trim();
      if (name === 'lo') type = 'loopback';
      else if (fs.existsSync(`/sys/class/net/${name}/wireless`) || fs.existsSync(`/sys/class/net/${name}/phy80211`)) type = 'wifi';
      else if (fs.existsSync(`/sys/class/net/${name}/bridge`)) type = 'bridge';
      else if (fs.existsSync(`/sys/class/net/${name}/bonding`)) type = 'bond';
      else if (name.includes('.')) type = 'vlan';
      else if (name.startsWith('tun') || name.startsWith('tap') || name.startsWith('wg')) type = 'tunnel';
      else if (name.startsWith('veth') || name.startsWith('docker') || name.startsWith('br-')) type = 'virtual';
      else if (ifType === '1' || name.startsWith('eth') || name.startsWith('en')) type = 'ethernet';

      const macAddress = safeExec(`cat /sys/class/net/${name}/address 2>/dev/null`).trim() || '00:00:00:00:00:00';

      const ipv4Out = safeExec(`ip -o -4 addr show dev ${name} 2>/dev/null`);
      const ipv4Addresses = ipv4Out.trim().split('\n')
        .filter(Boolean)
        .map(line => { const m = line.match(/inet\s+([^\s]+)/); return m ? m[1] : ''; })
        .filter(Boolean);

      const ipv6Out = safeExec(`ip -o -6 addr show dev ${name} 2>/dev/null`);
      const ipv6Addresses = ipv6Out.trim().split('\n')
        .filter(Boolean)
        .map(line => { const m = line.match(/inet6\s+([^\s]+)/); return m ? m[1] : ''; })
        .filter(Boolean);

      const operState = safeExec(`cat /sys/class/net/${name}/operstate 2>/dev/null`).trim();
      const state: OsInterface['state'] = operState === 'up' || operState === 'UNKNOWN' ? 'up' : operState === 'down' ? 'down' : 'unknown';

      const mtu = parseInt(safeExec(`cat /sys/class/net/${name}/mtu 2>/dev/null`).trim()) || 1500;
      const speed = safeExec(`cat /sys/class/net/${name}/speed 2>/dev/null`).trim();
      const duplex = safeExec(`cat /sys/class/net/${name}/duplex 2>/dev/null`).trim();

      const readStat = (stat: string) => parseInt(safeExec(`cat /sys/class/net/${name}/statistics/${stat} 2>/dev/null`).trim()) || 0;
      const rxBytes = readStat('rx_bytes');
      const txBytes = readStat('tx_bytes');
      const rxPackets = readStat('rx_packets');
      const txPackets = readStat('tx_packets');
      const rxErrors = readStat('rx_errors');
      const txErrors = readStat('tx_errors');

      const defaultRoute = safeExec(`ip route show default 2>/dev/null | grep dev\\s${name}`);
      const isDefaultRoute = defaultRoute.includes(`dev ${name}`);

      const gwMatch = safeExec(`ip route show dev ${name} 2>/dev/null`).match(/via\s+([^\s]+)/);
      const gateway = gwMatch ? gwMatch[1] : '';

      const vendor = safeExec(`cat /sys/class/net/${name}/device/vendor 2>/dev/null`).trim();
      const driver = safeExec(`readlink /sys/class/net/${name}/device/driver 2>/dev/null`).split('/').pop()?.trim() || '';

      const bridgePorts: string[] = [];
      if (type === 'bridge') {
        const brif = safeExec(`ls /sys/class/net/${name}/brif/ 2>/dev/null`);
        bridgePorts.push(...brif.trim().split('\n').filter(Boolean));
      }

      const bondMembers: string[] = [];
      if (type === 'bond') {
        const slaves = safeExec(`cat /sys/class/net/${name}/bonding/slaves 2>/dev/null`).trim();
        bondMembers.push(...slaves.split(/\s+/).filter(Boolean));
      }

      const dhclientPid = safeExec(`pgrep -f "dhclient.*${name}" 2>/dev/null`).trim();
      const networkManagerConn = safeExec(`nmcli -t -f GENERAL.CONNECTION,DEVICE dev show ${name} 2>/dev/null | grep ${name}`).trim();
      const dhcpEnabled = dhclientPid.length > 0 || networkManagerConn.includes('dhcp');

      let role: OsInterface['role'] = 'unknown';
      if (name === 'lo') role = 'management';
      else if (isDefaultRoute) role = 'wan';
      else if (name.startsWith('eth') || name.startsWith('en')) {
        role = isDefaultRoute ? 'wan' : 'lan';
      } else if (name.startsWith('wlan') || name.startsWith('wl')) role = 'guest';
      else if (name.startsWith('br')) role = 'lan';

      const vlans: string[] = [];
      if (type === 'bridge') {
        vlans.push(...bridgePorts);
      }

      interfaces.push({
        name, type, macAddress, ipv4Addresses, ipv6Addresses,
        gateway, dnsServers: [], mtu, state,
        speed: speed ? `${speed} Mbps` : (type === 'loopback' ? '' : 'Unknown'),
        duplex: duplex || (type === 'loopback' ? '' : 'Unknown'),
        rxBytes, txBytes, rxPackets, txPackets, rxErrors, txErrors,
        isDefaultRoute, vendor, driver, vlans, bridgePorts, bondMembers,
        role, dhcpEnabled,
        createdAt: new Date().toISOString(),
      });
    } catch { /* skip interface on error */ }
  }

  return interfaces;
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

function getOsRoutes(): OsRoute[] {
  const routes: OsRoute[] = [];
  const output = safeExec("ip -o route show 2>/dev/null");
  for (const line of output.trim().split('\n').filter(Boolean)) {
    const parts = line.split(/\s+/);
    const destination = parts[0] || '';
    const isDefault = destination === 'default';
    const gwIdx = parts.indexOf('via');
    const devIdx = parts.indexOf('dev');
    const metricIdx = parts.indexOf('metric');
    const scopeIdx = parts.indexOf('scope');
    const protoIdx = parts.indexOf('proto');
    routes.push({
      destination: isDefault ? '0.0.0.0/0' : destination,
      gateway: gwIdx >= 0 ? parts[gwIdx + 1] : '',
      interface: devIdx >= 0 ? parts[devIdx + 1] : '',
      metric: metricIdx >= 0 ? parseInt(parts[metricIdx + 1]) || 0 : 0,
      scope: scopeIdx >= 0 ? parts[scopeIdx + 1] : '',
      protocol: protoIdx >= 0 ? parts[protoIdx + 1] : '',
      isDefault,
    });
  }
  return routes;
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
