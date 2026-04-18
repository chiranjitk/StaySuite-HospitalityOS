/**
 * DHCP (dnsmasq) Management Service for StaySuite HospitalityOS
 *
 * Manages dnsmasq DHCP server on Rocky Linux 10 / Debian:
 * - DHCP subnets (dhcp-range + dhcp-option per interface/tag)
 * - MAC reservations (dhcp-host)
 * - Lease monitoring (reads /var/lib/dnsmasq/dnsmasq.leases)
 * - Config generation → /etc/dnsmasq.d/staysuite-dhcp.conf
 * - Zero-downtime reload via SIGHUP
 *
 * Works alongside dns-service (port 3012) which manages DNS records.
 * Both write separate config files; dnsmasq reads /etc/dnsmasq.d/*
 *
 * Port: 3011 (same as old kea-service — drop-in replacement)
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import Database from 'bun:sqlite';
import { createLogger } from '../shared/logger';

const app = new Hono();
const PORT = 3011;
const SERVICE_VERSION = '2.0.0';
const log = createLogger('dhcp-service');
const startTime = Date.now();

const PROJECT_ROOT = process.env.PROJECT_ROOT || path.resolve(__dirname, '..', '..');
const DB_PATH = process.env.DATABASE_PATH || path.join(PROJECT_ROOT, 'db', 'custom.db');

// ─────────────────────────────────────────────────────────────────────────────
// Paths — detect Rocky Linux vs Debian
// ─────────────────────────────────────────────────────────────────────────────

const SYSTEM_DNSMASQ = (() => {
  try { execSync('which dnsmasq 2>/dev/null', { encoding: 'utf-8' }); return true; } catch { return false; }
})();

const DNSMASQ_BIN = SYSTEM_DNSMASQ ? '/usr/sbin/dnsmasq' : (process.env.DNSMASQ_BIN || '/usr/sbin/dnsmasq');

// Config directory and our managed file
const DNSMASQ_CONF_DIR = SYSTEM_DNSMASQ
  ? (process.env.DNSMASQ_CONF_DIR || '/etc/dnsmasq.d')
  : path.join(PROJECT_ROOT, 'dhcp-local');
const DNSMASQ_CONF_FILE = path.join(DNSMASQ_CONF_DIR, 'staysuite-dhcp.conf');

// Leases file location
const DNSMASQ_LEASES = SYSTEM_DNSMASQ
  ? (process.env.DNSMASQ_LEASES || '/var/lib/dnsmasq/dnsmasq.leases')
  : '/tmp/dnsmasq-dhcp.leases';

// Ensure directories exist
try { fs.mkdirSync(DNSMASQ_CONF_DIR, { recursive: true }); } catch {}
try { fs.mkdirSync(path.dirname(DB_PATH), { recursive: true }); } catch {}

// ─────────────────────────────────────────────────────────────────────────────
// SQLite Database
// ─────────────────────────────────────────────────────────────────────────────

let db: Database.Database;
try {
  db = new Database(DB_PATH);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  log.info('Connected to database', { path: DB_PATH });
} catch (error) {
  log.error('Failed to connect to database', { path: DB_PATH, error: String(error) });
  process.exit(1);
}

// The service reads from the shared Prisma-managed database (custom.db).
// DhcpSubnet / DhcpReservation tables are managed by Prisma schema.
// Column mapping (Prisma → dnsmasq):
//   subnet → cidr,  no 'interface' (per-VLAN),  no 'tag' (generated from id/name)
// We do NOT create tables here — Prisma schema owns them.

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function generateId(prefix = 'id'): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  const rand = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${prefix}_${Date.now()}_${rand}`;
}

function safeExec(cmd: string, timeout = 5000): string {
  try { return execSync(cmd, { encoding: 'utf-8', timeout }); } catch { return ''; }
}

function parseDnsList(val: unknown): string[] {
  if (typeof val === 'string') {
    try { const arr = JSON.parse(val); return Array.isArray(arr) ? arr : []; }
    catch { return val ? val.split(',').map((s: string) => s.trim()).filter(Boolean) : []; }
  }
  return [];
}

function leaseSecondsToDisplay(seconds: number): string {
  if (seconds <= 0) return 'infinite';
  if (seconds >= 86400 && seconds % 86400 === 0) return `${seconds / 86400}d`;
  if (seconds >= 3600 && seconds % 3600 === 0) return `${seconds / 3600}h`;
  if (seconds >= 60 && seconds % 60 === 0) return `${seconds / 60}m`;
  return `${seconds}s`;
}

function displayToLeaseSeconds(val: string | number): number {
  if (val === 'infinite' || val === 0) return 0;
  if (typeof val === 'number') return val;
  const s = String(val);
  const match = s.match(/^(\d+)([dhms])$/);
  if (!match) return parseInt(s) || 0;
  const n = parseInt(match[1]);
  switch (match[2]) {
    case 'd': return n * 86400;
    case 'h': return n * 3600;
    case 'm': return n * 60;
    default: return n;
  }
}

function computePoolSize(start: string, end: string): number {
  try {
    const s = parseInt(start.split('.').pop() || '0', 10);
    const e = parseInt(end.split('.').pop() || '0', 10);
    return Math.max(0, e - s + 1);
  } catch { return 0; }
}

function subnetToCidr(subnet: string): string {
  // Prisma stores '192.168.1.0/24' format
  return subnet || '192.168.1.0/24';
}

function subnetToNetwork(subnet: string): string {
  return (subnet || '192.168.1.0/24').split('/')[0];
}

function subnetToPrefix(subnet: string): number {
  return parseInt((subnet || '192.168.1.0/24').split('/')[1]) || 24;
}

function prefixToNetmask(prefix: number): string {
  if (prefix === 16) return '255.255.0.0';
  if (prefix === 24) return '255.255.255.0';
  if (prefix === 8) return '255.0.0.0';
  return '255.255.255.0';
}

function generateTag(name: string, id: string): string {
  return (name || id).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16) || 'default';
}

function ipToSubnetId(ip: string, subnets: any[]): string {
  // Find which subnet an IP belongs to
  for (const sub of subnets) {
    const network = subnetToNetwork(sub.subnet);
    const prefix = subnetToPrefix(sub.subnet);
    const mask = prefixToNetmask(prefix);
    if (ipInSubnet(ip, network, mask)) return sub.id;
  }
  return 'unknown';
}

function ipInSubnet(ip: string, network: string, mask: string): boolean {
  try {
    const ipParts = ip.split('.').map(Number);
    const netParts = network.split('.').map(Number);
    const maskParts = mask.split('.').map(Number);
    for (let i = 0; i < 4; i++) {
      if ((ipParts[i] & maskParts[i]) !== (netParts[i] & maskParts[i])) return false;
    }
    return true;
  } catch { return false; }
}

// ─────────────────────────────────────────────────────────────────────────────
// dnsmasq Service Control
// ─────────────────────────────────────────────────────────────────────────────

function isDnsmasqRunning(): boolean {
  try {
    const result = execSync('ps aux | grep -E "[d]nsmasq"', { encoding: 'utf-8' });
    return result.trim().length > 0;
  } catch { return false; }
}

function getDnsmasqVersion(): string {
  try {
    const result = execSync(`${DNSMASQ_BIN} -v 2>&1 | head -1`, { encoding: 'utf-8' });
    return result.trim();
  } catch { return 'Unknown'; }
}

function startDnsmasq(): { success: boolean; message: string } {
  if (isDnsmasqRunning()) return { success: true, message: 'dnsmasq is already running' };

  // Generate config first
  const gen = generateConfig();
  if (!gen.success) return { success: false, message: gen.message };

  try {
    // Try systemctl first (Rocky Linux / systemd)
    const sysctl = safeExec('systemctl start dnsmasq 2>&1');
    if (sysctl.includes('not found') || sysctl.includes('not loaded')) {
      // Fall back to direct start
      execSync(`${DNSMASQ_BIN} -C ${DNSMASQ_CONF_DIR} --keep-in-foreground=false 2>&1`, { encoding: 'utf-8' });
    }

    const waitStart = Date.now();
    while (Date.now() - waitStart < 5000) {
      if (isDnsmasqRunning()) return { success: true, message: 'dnsmasq started successfully' };
      execSync('sleep 0.5');
    }
    return { success: false, message: 'dnsmasq failed to start within 5s' };
  } catch (error) {
    return { success: false, message: `Failed to start dnsmasq: ${error}` };
  }
}

function stopDnsmasq(): { success: boolean; message: string } {
  if (!isDnsmasqRunning()) return { success: true, message: 'dnsmasq is not running' };
  try {
    safeExec('systemctl stop dnsmasq 2>/dev/null || pkill dnsmasq 2>/dev/null || true');
    const waitStart = Date.now();
    while (Date.now() - waitStart < 3000) {
      if (!isDnsmasqRunning()) return { success: true, message: 'dnsmasq stopped' };
      execSync('sleep 0.5');
    }
    try { execSync('pkill -9 dnsmasq 2>/dev/null'); } catch {}
    return { success: true, message: 'dnsmasq force-stopped' };
  } catch (error) {
    return { success: false, message: `Failed to stop dnsmasq: ${error}` };
  }
}

function reloadDnsmasq(): { success: boolean; message: string } {
  if (!isDnsmasqRunning()) {
    // Not running — start it
    return startDnsmasq();
  }
  try {
    // Generate config first
    const gen = generateConfig();
    if (!gen.success) return { success: false, message: gen.message };

    // Try systemctl reload first, then SIGHUP
    const sysctl = safeExec('systemctl reload dnsmasq 2>&1');
    if (sysctl.includes('not found') || sysctl.includes('not loaded')) {
      execSync('pkill -HUP dnsmasq 2>/dev/null || true');
    }
    return { success: true, message: 'dnsmasq reloaded (zero downtime)' };
  } catch (error) {
    return { success: false, message: `Failed to reload: ${error}` };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Config Generation — DB → /etc/dnsmasq.d/staysuite-dhcp.conf
// ─────────────────────────────────────────────────────────────────────────────

function generateConfig(): { success: boolean; message: string; lines: number } {
  try {
    const subnets = db.query('SELECT * FROM DhcpSubnet WHERE enabled = 1 ORDER BY name ASC').all() as any[];
    const reservations = db.query('SELECT r.*, s.name as subnetName, s.subnet as subnetCidr FROM DhcpReservation r LEFT JOIN DhcpSubnet s ON r.subnetId = s.id WHERE r.enabled = 1').all() as any[];

    let config = `# StaySuite DHCP Configuration - Auto-generated\n`;
    config += `# Last updated: ${new Date().toISOString()}\n`;
    config += `# DO NOT EDIT MANUALLY - Managed by StaySuite dhcp-service\n\n`;

    // DHCP subnets
    if (subnets.length > 0) {
      config += `# ─────────────────────────────────────────────\n`;
      config += `# DHCP Subnets\n`;
      config += `# ─────────────────────────────────────────────\n\n`;

      for (const sub of subnets) {
        const tag = generateTag(sub.name, sub.id);
        const cidr = subnetToCidr(sub.subnet);
        const netmask = prefixToNetmask(subnetToPrefix(cidr));
        config += `# Subnet: ${sub.name} (${cidr})\n`;
        config += `# ID: ${sub.id}\n`;

        // dhcp-range: set:<tag>,<start>,<end>,<netmask>,<lease>
        const leaseDisplay = leaseSecondsToDisplay(sub.leaseTime || 3600);
        config += `dhcp-range=set:${tag},${sub.poolStart},${sub.poolEnd},${netmask},${leaseDisplay}\n`;

        // Gateway (router option)
        if (sub.gateway) {
          config += `dhcp-option=set:${tag},option:router,${sub.gateway}\n`;
        }

        // DNS servers
        const dns = parseDnsList(sub.dnsServers);
        if (dns.length > 0) {
          config += `dhcp-option=set:${tag},option:dns-server,${dns.join(',')}\n`;
        }

        // Domain name
        if (sub.domainName) {
          config += `dhcp-option=set:${tag},option:domain-name,${sub.domainName}\n`;
        }

        config += `\n`;
      }
    }

    // Reservations grouped by subnet
    if (reservations.length > 0) {
      config += `# ─────────────────────────────────────────────\n`;
      config += `# MAC Reservations\n`;
      config += `# ─────────────────────────────────────────────\n\n`;

      for (const res of reservations) {
        config += `# ID: ${res.id}`;
        if (res.description) config += ` | ${res.description}`;
        config += `\n`;

        // dhcp-host: <mac>,<ip>,<hostname>,[lease-time]
        let hostLine = `dhcp-host=${res.macAddress},${res.ipAddress}`;
        if (res.hostname) hostLine += `,${res.hostname}`;
        if (res.leaseTime) hostLine += `,${res.leaseTime}`;
        config += `${hostLine}\n`;
      }
    }

    // Interface bindings are managed by NetworkManager / .nmconnection files
    // dnsmasq listens on all interfaces by default; VLAN interfaces are created by NM

    fs.writeFileSync(DNSMASQ_CONF_FILE, config, 'utf-8');
    const lineCount = config.split('\n').filter((l: string) => l.trim() && !l.startsWith('#')).length;
    log.info(`Config generated: ${DNSMASQ_CONF_FILE} (${lineCount} directives, ${subnets.length} subnets, ${reservations.length} reservations)`);
    return { success: true, message: 'Config generated', lines: lineCount };
  } catch (error) {
    const msg = `Failed to generate config: ${error}`;
    log.error(msg);
    return { success: false, message: msg, lines: 0 };
  }
}

// Full sync: generate config + reload dnsmasq
function fullSync(): { config: ReturnType<typeof generateConfig>; reload: ReturnType<typeof reloadDnsmasq> } {
  const config = generateConfig();
  let reload: ReturnType<typeof reloadDnsmasq> = { success: false, message: 'not attempted' };
  if (config.success && isDnsmasqRunning()) {
    reload = reloadDnsmasq();
  }
  return { config, reload };
}

// ─────────────────────────────────────────────────────────────────────────────
// Lease Parsing — read /var/lib/dnsmasq/dnsmasq.leases
// ─────────────────────────────────────────────────────────────────────────────

function parseLeasesFile(): any[] {
  const leasePaths = [
    DNSMASQ_LEASES,
    '/var/lib/dnsmasq/dnsmasq.leases',
    '/var/lib/misc/dnsmasq.leases',
  ];

  for (const lp of leasePaths) {
    try {
      if (!fs.existsSync(lp)) continue;
      const content = fs.readFileSync(lp, 'utf-8');
      const lines = content.trim().split('\n').filter((l: string) => l.trim());
      if (lines.length === 0) continue;

      // Get subnets for mapping
      const subnets = db.query('SELECT id, name, subnet FROM DhcpSubnet WHERE enabled = 1').all() as any[];

      return lines.map((line: string) => {
        const parts = line.split(/\s+/);
        // Format: <type> <expiry> <mac> <ip> <hostname> <client-id>
        const type = parts[0] === '1' ? 'static' : 'dynamic';
        const expiry = parseInt(parts[1]) || 0;
        const mac = parts[2] || '';
        const ip = parts[3] || '';
        const hostname = parts[4] || '';
        const clientId = parts[5] || '';

        const sub = subnets.find((s: any) => {
          const network = subnetToNetwork(s.subnet);
          const mask = prefixToNetmask(subnetToPrefix(s.subnet));
          return ipInSubnet(ip, network, mask);
        });

        const validLifetime = expiry > 0 ? 14400 : 0; // default 4h
        const cltt = expiry > 0 ? expiry - validLifetime : 0;

        let state = 'active';
        const now = Math.floor(Date.now() / 1000);
        if (expiry > 0 && expiry < now) state = 'expired';

        return {
          id: ip,
          ipAddress: ip,
          macAddress: mac,
          hostname,
          clientId,
          subnetId: sub?.id || 'unknown',
          subnetName: sub?.name || 'Unknown',
          leaseStart: cltt > 0 ? new Date(cltt * 1000).toISOString() : '',
          leaseExpires: expiry > 0 ? new Date(expiry * 1000).toISOString() : '',
          validLifetime,
          state,
          type,
          lastSeen: cltt > 0 ? new Date(cltt * 1000).toISOString() : '',
        };
      });
    } catch (error) {
      log.warn(`Failed to read leases from ${lp}: ${error}`);
    }
  }

  return [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Startup
// ─────────────────────────────────────────────────────────────────────────────

(async () => {
  log.info('StaySuite DHCP Service starting', {
    port: PORT,
    systemDnsmasq: SYSTEM_DNSMASQ,
    configFile: DNSMASQ_CONF_FILE,
    leasesFile: DNSMASQ_LEASES,
  });

  // Generate initial config
  generateConfig();

  // Auto-start dnsmasq if installed but not running
  if (SYSTEM_DNSMASQ && !isDnsmasqRunning()) {
    log.info('dnsmasq installed but not running, auto-starting...');
    const result = startDnsmasq();
    log.info(result.success ? 'dnsmasq auto-started' : 'dnsmasq auto-start failed', { message: result.message });
  } else if (SYSTEM_DNSMASQ) {
    log.info('dnsmasq is already running');
  } else {
    log.warn('dnsmasq not found on system — install with: dnf install dnsmasq (Rocky) or apt install dnsmasq (Debian)');
  }
})();

// ─────────────────────────────────────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────────────────────────────────────

(globalThis as Record<string, unknown>).__authWarningLogged = false;

app.use('*', async (c, next) => {
  if (c.req.path === '/health') return next();
  const authSecret = process.env.SERVICE_AUTH_SECRET;
  if (!authSecret) {
    if (!(globalThis as Record<string, unknown>).__authWarningLogged) {
      log.warn('SERVICE_AUTH_SECRET not configured. All requests will be allowed.');
      (globalThis as Record<string, unknown>).__authWarningLogged = true;
    }
    return next();
  }
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Missing Authorization header' }, 401);
  }
  if (authHeader.substring(7) !== authSecret) {
    return c.json({ success: false, error: 'Invalid token' }, 403);
  }
  return next();
});

app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// ─────────────────────────────────────────────────────────────────────────────
// Health Check
// ─────────────────────────────────────────────────────────────────────────────

app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    service: 'dhcp-service',
    version: SERVICE_VERSION,
    backend: 'dnsmasq',
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    port: PORT,
    memoryUsage: process.memoryUsage(),
    dnsmasq: {
      installed: SYSTEM_DNSMASQ,
      running: isDnsmasqRunning(),
      version: getDnsmasqVersion(),
      configFile: DNSMASQ_CONF_FILE,
      leasesFile: DNSMASQ_LEASES,
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Service Status & Control
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/status', (c) => {
  const running = isDnsmasqRunning();
  const version = running ? getDnsmasqVersion() : 'Not running';

  let subnetCount = 0, reservationCount = 0, leaseCount = 0, activeLeases = 0;
  try { subnetCount = (db.query('SELECT COUNT(*) as c FROM DhcpSubnet WHERE enabled = 1').get() as any)?.c || 0; } catch {}
  try { reservationCount = (db.query('SELECT COUNT(*) as c FROM DhcpReservation WHERE enabled = 1').get() as any)?.c || 0; } catch {}

  const leases = parseLeasesFile();
  leaseCount = leases.length;
  activeLeases = leases.filter((l: any) => l.state === 'active').length;

  const subnets = db.query('SELECT id, name, subnet FROM DhcpSubnet WHERE enabled = 1').all() as any[];
  const currentInterfaces: string[] = [];

  // System interfaces
  let systemInterfaces: Array<{ name: string; ip: string; status: string }> = [];
  try {
    const result = safeExec("ip -4 addr show | awk '/^[0-9]+:/{iface=$2; gsub(/:/,\"\",iface)} /inet /{split($2,a,\"/\"); print iface\",\"a[1]\",\"(iface==\"lo\"?\"loopback\":\"up\")}'");
    systemInterfaces = result.trim().split('\n').filter(Boolean).map((line: string) => {
      const [name, ip, status] = line.split(',');
      return { name, ip: ip || '', status };
    });
  } catch {}

  return c.json({
    success: true,
    data: {
      installed: SYSTEM_DNSMASQ,
      running,
      processRunning: running,
      version,
      mode: running ? 'production' : 'stopped',
      backend: 'dnsmasq',
      configFile: DNSMASQ_CONF_FILE,
      leasesFile: DNSMASQ_LEASES,
      subnetCount,
      leaseCount,
      activeLeases,
      reservationCount,
      currentInterfaces,
      systemInterfaces,
    }
  });
});

app.post('/api/service/start', (c) => {
  const gen = generateConfig();
  const result = startDnsmasq();
  return c.json({
    success: result.success,
    message: result.message,
    running: isDnsmasqRunning(),
    status: isDnsmasqRunning() ? 'running' : 'stopped',
  });
});

app.post('/api/service/stop', (c) => {
  const result = stopDnsmasq();
  return c.json({
    success: result.success,
    message: result.message,
    running: isDnsmasqRunning(),
    status: isDnsmasqRunning() ? 'running' : 'stopped',
  });
});

app.post('/api/service/restart', (c) => {
  stopDnsmasq();
  execSync('sleep 1');
  const gen = generateConfig();
  const result = startDnsmasq();
  return c.json({
    success: result.success,
    message: result.message,
    running: isDnsmasqRunning(),
    status: isDnsmasqRunning() ? 'running' : 'stopped',
  });
});

app.post('/api/service/reload', (c) => {
  const result = reloadDnsmasq();
  return c.json({
    success: result.success,
    message: result.message,
    running: isDnsmasqRunning(),
  });
});

app.post('/api/sync', (c) => {
  const result = fullSync();
  return c.json({
    success: result.config.success,
    message: `Config generated (${result.config.lines} directives), dnsmasq ${result.reload.success ? 'reloaded' : result.reload.message}`,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DHCP Subnets
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/subnets', (c) => {
  try {
    const subnets = db.query('SELECT * FROM DhcpSubnet ORDER BY vlanId ASC, name ASC').all() as any[];
    const leases = parseLeasesFile();

    const enriched = subnets.map((sub: any) => {
      const dns = parseDnsList(sub.dnsServers);
      const activeLeases = leases.filter((l: any) => l.subnetId === sub.id && l.state === 'active').length;
      const cidr = subnetToCidr(sub.subnet);
      const netmask = prefixToNetmask(subnetToPrefix(cidr));
      return {
        id: sub.id,
        name: sub.name,
        interface: '',
        tag: generateTag(sub.name, sub.id),
        cidr,
        gateway: sub.gateway || '',
        poolStart: sub.poolStart,
        poolEnd: sub.poolEnd,
        netmask,
        leaseTime: sub.leaseTime,
        leaseDisplay: leaseSecondsToDisplay(sub.leaseTime),
        dnsServers: dns,
        domainName: sub.domainName || '',
        vlanId: sub.vlanId,
        enabled: !!sub.enabled,
        activeLeases,
        totalPool: computePoolSize(sub.poolStart, sub.poolEnd),
        utilization: computePoolSize(sub.poolStart, sub.poolEnd) > 0
          ? Math.round((activeLeases / computePoolSize(sub.poolStart, sub.poolEnd)) * 100)
          : 0,
      };
    });

    return c.json({ success: true, data: enriched });
  } catch (error) {
    return c.json({ success: false, error: String(error) });
  }
});

app.post('/api/subnets', async (c) => {
  try {
    const body = await c.req.json();
    const id = generateId('subnet');
    const now = new Date().toISOString();

    // Generate tag from name
    const tag = (body.name || 'default').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16) || 'default';

    // Validate subnet
    const subnetCidr = body.subnet || body.cidr || '192.168.1.0/24';

    const dnsStr = Array.isArray(body.dnsServers) ? JSON.stringify(body.dnsServers) : (body.dnsServers || '[]');
    const leaseSec = displayToLeaseSeconds(body.leaseTime ?? 3600);

    db.run(`INSERT INTO DhcpSubnet (id, tenantId, propertyId, name, subnet, gateway, poolStart, poolEnd, leaseTime, dnsServers, domainName, vlanId, enabled, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      id,
      body.tenantId || 'tenant-1',
      body.propertyId || 'property-1',
      body.name || 'Default',
      subnetCidr,
      body.gateway || '',
      body.poolStart || '', body.poolEnd || '',
      leaseSec, dnsStr, body.domainName || '',
      body.vlanId ? parseInt(body.vlanId) : null,
      body.enabled !== false ? 1 : 0, now, now,
    ]);

    fullSync();
    return c.json({ success: true, data: { id, ...body }, message: 'DHCP subnet created and applied', persisted: true });
  } catch (error) {
    return c.json({ success: false, error: String(error) });
  }
});

app.put('/api/subnets/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const body = await c.req.json();
    const now = new Date().toISOString();

    const fields: string[] = [];
    const values: any[] = [];
    if (body.name !== undefined) { fields.push('name = ?'); values.push(body.name); }
    if (body.subnet !== undefined || body.cidr !== undefined) { fields.push('subnet = ?'); values.push(body.subnet || body.cidr); }
    if (body.gateway !== undefined) { fields.push('gateway = ?'); values.push(body.gateway); }
    if (body.poolStart !== undefined) { fields.push('poolStart = ?'); values.push(body.poolStart); }
    if (body.poolEnd !== undefined) { fields.push('poolEnd = ?'); values.push(body.poolEnd); }
    if (body.netmask !== undefined) { fields.push('netmask = ?'); values.push(body.netmask); }
    if (body.leaseTime !== undefined) { fields.push('leaseTime = ?'); values.push(displayToLeaseSeconds(body.leaseTime)); }
    if (body.dnsServers !== undefined) {
      fields.push('dnsServers = ?');
      values.push(Array.isArray(body.dnsServers) ? JSON.stringify(body.dnsServers) : body.dnsServers);
    }
    if (body.domainName !== undefined) { fields.push('domainName = ?'); values.push(body.domainName); }
    if (body.vlanId !== undefined) { fields.push('vlanId = ?'); values.push(body.vlanId ? parseInt(body.vlanId) : null); }
    if (body.enabled !== undefined) { fields.push('enabled = ?'); values.push(body.enabled ? 1 : 0); }
    fields.push('updatedAt = ?'); values.push(now); values.push(id);

    db.run(`UPDATE DhcpSubnet SET ${fields.join(', ')} WHERE id = ?`, values);
    fullSync();
    return c.json({ success: true, data: { id, ...body }, message: 'DHCP subnet updated and applied', persisted: true });
  } catch (error) {
    return c.json({ success: false, error: String(error) });
  }
});

app.delete('/api/subnets/:id', (c) => {
  try {
    const { id } = c.req.param();
    // Delete associated reservations first
    try { db.run('DELETE FROM DhcpReservation WHERE subnetId = ?', [id]); } catch {}
    db.run('DELETE FROM DhcpSubnet WHERE id = ?', [id]);
    fullSync();
    return c.json({ success: true, message: `DHCP subnet ${id} deleted`, persisted: true });
  } catch (error) {
    return c.json({ success: false, error: String(error) });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DHCP Reservations
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/reservations', (c) => {
  try {
    const reservations = db.query(`SELECT r.*, s.name as subnetName, s.subnet as subnetCidr
      FROM DhcpReservation r LEFT JOIN DhcpSubnet s ON r.subnetId = s.id
      ORDER BY r.macAddress ASC`).all() as any[];

    return c.json({
      success: true,
      data: reservations.map((r: any) => ({
        id: r.id,
        macAddress: r.macAddress,
        ipAddress: r.ipAddress,
        hostname: r.hostname || '',
        subnetId: r.subnetId,
        subnetName: r.subnetName || 'Unknown',
        leaseTime: r.leaseTime || '',
        description: r.description || '',
        enabled: !!r.enabled,
      })),
    });
  } catch (error) {
    return c.json({ success: false, error: String(error) });
  }
});

app.post('/api/reservations', async (c) => {
  try {
    const body = await c.req.json();
    const id = generateId('res');
    const now = new Date().toISOString();

    // Check for duplicate MAC in same subnet
    const existing = db.query('SELECT id FROM DhcpReservation WHERE macAddress = ? AND subnetId = ?', [body.macAddress, body.subnetId]).get() as any;
    if (existing) {
      return c.json({ success: false, error: `MAC ${body.macAddress} already has a reservation in this subnet` });
    }

    db.run(`INSERT INTO DhcpReservation (id, subnetId, macAddress, ipAddress, hostname, leaseTime, description, enabled, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      id, body.subnetId, body.macAddress, body.ipAddress,
      body.hostname || '', body.leaseTime || '', body.description || '',
      body.enabled !== false ? 1 : 0, now, now,
    ]);

    fullSync();
    return c.json({ success: true, data: { id, ...body }, message: 'MAC reservation added and applied', persisted: true });
  } catch (error) {
    return c.json({ success: false, error: String(error) });
  }
});

app.put('/api/reservations/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const body = await c.req.json();
    const now = new Date().toISOString();

    const fields: string[] = [];
    const values: any[] = [];
    if (body.macAddress !== undefined) { fields.push('macAddress = ?'); values.push(body.macAddress); }
    if (body.ipAddress !== undefined) { fields.push('ipAddress = ?'); values.push(body.ipAddress); }
    if (body.hostname !== undefined) { fields.push('hostname = ?'); values.push(body.hostname); }
    if (body.subnetId !== undefined) { fields.push('subnetId = ?'); values.push(body.subnetId); }
    if (body.leaseTime !== undefined) { fields.push('leaseTime = ?'); values.push(body.leaseTime); }
    if (body.description !== undefined) { fields.push('description = ?'); values.push(body.description); }
    if (body.enabled !== undefined) { fields.push('enabled = ?'); values.push(body.enabled ? 1 : 0); }
    fields.push('updatedAt = ?'); values.push(now); values.push(id);

    db.run(`UPDATE DhcpReservation SET ${fields.join(', ')} WHERE id = ?`, values);
    fullSync();
    return c.json({ success: true, data: { id, ...body }, message: 'MAC reservation updated and applied', persisted: true });
  } catch (error) {
    return c.json({ success: false, error: String(error) });
  }
});

app.delete('/api/reservations/:subnetId/:mac', (c) => {
  try {
    const { subnetId, mac } = c.req.param();
    const macClean = mac.replace(/-/g, ':');
    db.run('DELETE FROM DhcpReservation WHERE subnetId = ? AND macAddress = ?', [subnetId, macClean]);
    fullSync();
    return c.json({ success: true, message: `Reservation for ${macClean} removed`, persisted: true });
  } catch (error) {
    return c.json({ success: false, error: String(error) });
  }
});

app.delete('/api/reservations/:id', (c) => {
  try {
    const { id } = c.req.param();
    db.run('DELETE FROM DhcpReservation WHERE id = ?', [id]);
    fullSync();
    return c.json({ success: true, message: 'Reservation deleted', persisted: true });
  } catch (error) {
    return c.json({ success: false, error: String(error) });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Leases (read from flat file)
// ─────────────────────────────────────────────────────────────────────────────

app.get('/api/leases', (c) => {
  try {
    const leases = parseLeasesFile();
    return c.json({ success: true, data: leases });
  } catch (error) {
    return c.json({ success: false, error: String(error) });
  }
});

app.post('/api/leases/reclaim', (c) => {
  // dnsmasq doesn't have a reclaim command like Kea
  // Instead, we reload which triggers lease cleanup
  const result = reloadDnsmasq();
  return c.json({ success: result.success, message: result.success ? 'dnsmasq reloaded (leases refreshed)' : result.message });
});

// ─────────────────────────────────────────────────────────────────────────────
// Config write & interfaces
// ─────────────────────────────────────────────────────────────────────────────

app.post('/api/config/write', (c) => {
  const result = generateConfig();
  return c.json({ success: result.success, message: result.message, lines: result.lines });
});

app.post('/api/interfaces', async (c) => {
  try {
    const body = await c.req.json();
    const interfaces: string[] = body.interfaces;
    if (!interfaces || !Array.isArray(interfaces) || interfaces.length === 0) {
      return c.json({ success: false, error: 'At least one interface is required' });
    }

    // Update all subnets' interfaces — NOTE: this is unusual for dnsmasq,
    // normally each subnet maps to its own interface. This endpoint exists
    // for API compatibility with the frontend.
    const result = fullSync();
    return c.json({
      success: true,
      message: `dnsmasq DHCP interfaces managed per-subnet. Active: ${interfaces.join(', ')}`,
      data: { interfaces },
    });
  } catch (error) {
    return c.json({ success: false, error: String(error) });
  }
});

app.post('/api/dhcp/enable', (c) => {
  const result = startDnsmasq();
  return c.json({ success: result.success, message: result.message });
});

app.post('/api/dhcp/disable', (c) => {
  const result = stopDnsmasq();
  return c.json({ success: result.success, message: result.message });
});

// ─────────────────────────────────────────────────────────────────────────────
// Start Server
// ─────────────────────────────────────────────────────────────────────────────

log.info(`DHCP service listening on port ${PORT}`);
export default app;

Bun.serve({ port: PORT, fetch: app.fetch });
