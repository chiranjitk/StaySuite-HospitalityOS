/**
 * Kea DHCP4 Management Service for StaySuite HospitalityOS
 *
 * Uses a Node.js helper subprocess for unix socket communication
 * because Bun's net module has issues with unix domain sockets.
 *
 * Port: 3011 (REST API)
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from '../shared/logger';

// Resolve __dirname safely for Bun (both --hot and normal mode)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = new Hono();
const PORT = 3011;
const log = createLogger('kea-service');
const startTime = Date.now();

// Resolve PROJECT_ROOT from env or walk up from this file's directory
const PROJECT_ROOT = process.env.PROJECT_ROOT || path.resolve(__dirname, '..', '..');

// Detect if Kea is system-installed or local
const SYSTEM_KEA = (() => {
  try {
    execSync('which kea-dhcp4 2>/dev/null', { encoding: 'utf-8' });
    return true;
  } catch { return false; }
})();

const KEA_SOCKET_PATH = process.env.KEA_SOCKET_PATH || (SYSTEM_KEA ? '/run/kea/kea4-ctrl-socket' : '/tmp/kea/kea4-ctrl-socket');
const KEA_CONFIG_PATH = SYSTEM_KEA
  ? (process.env.KEA_CONFIG_PATH || '/etc/kea/kea-dhcp4.conf')
  : (process.env.KEA_CONFIG_PATH || `${PROJECT_ROOT}/kea-local/kea-dhcp4-writable.conf`);
const KEA_BINARY_PATH = SYSTEM_KEA
  ? '/usr/sbin/kea-dhcp4'
  : (process.env.KEA_BINARY_PATH || `${PROJECT_ROOT}/kea-local/extracted/usr/sbin/kea-dhcp4`);
const KEA_LEASES_FILE = SYSTEM_KEA
  ? (process.env.KEA_LEASES_FILE || '/var/lib/kea/kea-leases4.csv')
  : (process.env.KEA_LEASES_FILE || '/tmp/lib/kea/kea-leases4.csv');
const HELPER_PATH = path.join(__dirname, 'kea-helper.mjs');
const LD_LIB = SYSTEM_KEA ? '' : (process.env.KEA_LD_LIB || `${PROJECT_ROOT}/kea-local/extracted/usr/lib/x86_64-linux-gnu`);

// Try to dynamically resolve socket path from config files
function resolveSocketPath(): string {
  if (process.env.KEA_SOCKET_PATH) return process.env.KEA_SOCKET_PATH;
  try {
    const configPaths = ['/etc/kea/kea-ctrl-agent.conf', '/etc/kea/kea-dhcp4.conf', KEA_CONFIG_PATH];
    for (const cfgPath of configPaths) {
      try {
        const content = fs.readFileSync(cfgPath, 'utf-8');
        const match = content.match(/"socket-name"\s*:\s*"([^"]+)"/);
        if (match && match[1]) {
          let sockPath = match[1];
          // Handle relative paths (no leading /)
          if (!sockPath.startsWith('/')) {
            const socketDirs = ['/run/kea', '/var/run/kea', '/tmp/kea', '/run'];
            for (const dir of socketDirs) {
              const candidate = `${dir}/${sockPath}`;
              try {
                fs.accessSync(candidate, fs.constants.R_OK);
                log.info(`Resolved socket from ${cfgPath}: ${sockPath} → ${candidate}`);
                return candidate;
              } catch {}
            }
            sockPath = `/run/kea/${sockPath}`;
          }
          log.info(`Resolved socket from ${cfgPath}: ${match[1]} → ${sockPath}`);
          return sockPath;
        }
      } catch {}
    }
    // Scan filesystem
    const commonPaths = ['/run/kea/kea4-ctrl-socket', '/tmp/kea/kea4-ctrl-socket', '/run/kea-dhcp4/kea4-ctrl-socket', '/run/kea/kea-ctrl-agent-socket'];
    for (const sp of commonPaths) {
      try {
        fs.accessSync(sp, fs.constants.R_OK | fs.constants.W_OK);
        log.info(`Found socket at ${sp}`);
        return sp;
      } catch {}
    }
    // Last resort: find on filesystem
    try {
      const found = execSync('find /run /tmp /var/run -name "*kea*ctrl*socket*" -type S 2>/dev/null | head -1', { encoding: 'utf-8' }).trim();
      if (found) {
        log.info(`Discovered socket via find: ${found}`);
        return found;
      }
    } catch {}
  } catch {}
  return KEA_SOCKET_PATH;
}

// Resolve actual socket and leases path at startup
const RESOLVED_SOCKET_PATH = resolveSocketPath();
log.info('Kea configuration', { systemKea: SYSTEM_KEA, socketPath: RESOLVED_SOCKET_PATH, configPath: KEA_CONFIG_PATH, leasesFile: KEA_LEASES_FILE });

// ============================================================================
// Kea Communication via Node.js Helper
// ============================================================================

function keaPing(): boolean {
  try {
    // Verify helper exists before spawning
    if (!fs.existsSync(HELPER_PATH)) {
      log.warn(`kea-helper.mjs not found at ${HELPER_PATH} — run: git pull`);
      return false;
    }
    const result = execSync(`KEA_SOCKET_PATH="${RESOLVED_SOCKET_PATH}" KEA_LEASES_FILE="${KEA_LEASES_FILE}" node ${HELPER_PATH} ping`, { encoding: 'utf-8', timeout: 8000 });
    const parsed = JSON.parse(result.trim());
    return parsed.success && parsed.reachable === true;
  } catch {
    return false;
  }
}

function keaCommand(command: Record<string, any>): any[] | null {
  try {
    if (!fs.existsSync(HELPER_PATH)) {
      log.warn(`kea-helper.mjs not found at ${HELPER_PATH} — run: git pull`);
      return null;
    }
    const cmdStr = JSON.stringify(command).replace(/'/g, "'\\''");
    const result = execSync(`KEA_SOCKET_PATH="${RESOLVED_SOCKET_PATH}" KEA_LEASES_FILE="${KEA_LEASES_FILE}" node ${HELPER_PATH} command '${cmdStr}'`, { encoding: 'utf-8', timeout: 10000 });
    const parsed = JSON.parse(result.trim());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function keaReadLeases(): any[] {
  try {
    if (!fs.existsSync(HELPER_PATH)) {
      log.warn(`kea-helper.mjs not found at ${HELPER_PATH} — run: git pull`);
      return [];
    }
    const result = execSync(`KEA_SOCKET_PATH="${RESOLVED_SOCKET_PATH}" KEA_LEASES_FILE="${KEA_LEASES_FILE}" node ${HELPER_PATH} leases`, { encoding: 'utf-8', timeout: 5000 });
    const parsed = JSON.parse(result.trim());
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

// ============================================================================
// Cached State
// ============================================================================

let cachedKeaRunning = false;
let cachedKeaVersion = 'Unknown';
let cachedSubnetCount = 0;
let cachedLeaseCount = 0;

async function updateCache() {
  try {
    cachedKeaRunning = keaPing();
    if (cachedKeaRunning) {
      try {
        const resp = keaCommand({ command: 'version-get' });
        if (resp && resp[0]?.result === 0 && resp[0]?.arguments) {
          cachedKeaVersion = resp[0].arguments.extended || resp[0].text || 'Unknown';
        }
      } catch {}

      try {
        const resp = keaCommand({ command: 'config-get' });
        if (resp && resp[0]?.result === 0 && resp[0]?.arguments?.Dhcp4?.subnet4) {
          cachedSubnetCount = resp[0].arguments.Dhcp4.subnet4.length;
        }
      } catch {}

      try {
        const leases = keaReadLeases();
        cachedLeaseCount = leases.filter((l: any) => l.state === 0).length;
      } catch {}
    } else {
      cachedSubnetCount = 0;
      cachedLeaseCount = 0;
    }
  } catch {
    cachedKeaRunning = false;
  }
}

// Initial cache update (async) - also auto-start Kea if not running
(async () => {
  if (!isKeaProcessRunning()) {
    log.info('Kea DHCP4 not running, auto-starting...');
    const result = startKeaServer();
    if (result.success) {
      log.info('Kea DHCP4 auto-started', { pid: result.pid });
    } else {
      log.warn('Kea DHCP4 auto-start failed', { message: result.message });
    }
  }
  await updateCache();
})();
setInterval(updateCache, 30000);

// ============================================================================
// Helper Functions
// ============================================================================

function isKeaProcessRunning(): boolean {
  try {
    const result = execSync('ps aux | grep -E "[k]ea-dhcp4"', { encoding: 'utf-8' });
    return result.trim().length > 0;
  } catch {
    return false;
  }
}

function startKeaServer(): { success: boolean; message: string; pid?: number } {
  if (isKeaProcessRunning()) {
    return { success: true, message: 'Kea DHCP4 is already running' };
  }

  try {
    const ldPrefix = LD_LIB ? `LD_LIBRARY_PATH=${LD_LIB} ` : '';
    const cmd = `${ldPrefix}${KEA_BINARY_PATH} -c ${KEA_CONFIG_PATH}`;
    const proc = Bun.spawn(['sh', '-c', cmd], {
      detached: true,
      stdin: 'ignore',
      stdout: 'ignore',
      stderr: 'ignore',
    });
    proc.unref();

    const startTime = Date.now();
    while (Date.now() - startTime < 8000) {
      if (isKeaProcessRunning()) {
        return { success: true, message: 'Kea DHCP4 started successfully', pid: proc.pid };
      }
      execSync('sleep 0.5');
    }

    return { success: false, message: 'Kea DHCP4 failed to start within timeout' };
  } catch (error) {
    return { success: false, message: `Failed to start Kea DHCP4: ${error}` };
  }
}

function stopKeaServer(): { success: boolean; message: string } {
  if (!isKeaProcessRunning()) {
    return { success: true, message: 'Kea DHCP4 is not running' };
  }
  try {
    execSync('pkill -f kea-dhcp4 2>/dev/null || true');
    const startTime = Date.now();
    while (Date.now() - startTime < 3000) {
      if (!isKeaProcessRunning()) {
        return { success: true, message: 'Kea DHCP4 stopped successfully' };
      }
      execSync('sleep 0.5');
    }
    try { execSync('pkill -9 -f kea-dhcp4 2>/dev/null'); } catch {}
    return { success: true, message: 'Kea DHCP4 force-stopped' };
  } catch (error) {
    return { success: false, message: `Failed to stop Kea DHCP4: ${error}` };
  }
}

function parsePool(poolStr: string): { start: string; end: string } {
  const parts = poolStr.split('-').map(s => s.trim());
  return { start: parts[0] || '', end: parts[1] || '' };
}

function computePoolSize(poolStart: string, poolEnd: string): number {
  try {
    const start = parseInt(poolStart.split('.').pop() || '0', 10);
    const end = parseInt(poolEnd.split('.').pop() || '0', 10);
    return Math.max(0, end - start + 1);
  } catch { return 0; }
}

function findRouterOption(optionData?: Array<{ name: string; data: string }>): string {
  if (!optionData) return '';
  const router = optionData.find(o => o.name === 'routers');
  return router?.data || '';
}

function findDnsOption(optionData?: Array<{ name: string; data: string }>): string[] {
  if (!optionData) return [];
  const dns = optionData.find(o => o.name === 'domain-name-servers');
  if (!dns) return [];
  return dns.data.split(',').map(s => s.trim());
}

function mapLeaseState(state: number): 'active' | 'declined' | 'expired' {
  switch (state) {
    case 0: return 'active';
    case 1: return 'declined';
    case 2: return 'expired';
    default: return 'active';
  }
}

function getSubnetFriendlyName(subnet: string): string {
  const nameMap: Record<string, string> = {
    '192.168.1.0/24': 'Guest WiFi',
    '192.168.2.0/24': 'Staff Network',
    '192.168.10.0/24': 'IoT Network',
    '192.168.100.0/24': 'Management Network',
  };
  return nameMap[subnet] || `Subnet ${subnet}`;
}

// ============================================================================
// Middleware
// ============================================================================

// Auth middleware - check Bearer token, skip for /health endpoint
app.use('*', async (c, next) => {
  if (c.req.path === '/health') return next();

  const authSecret = process.env.SERVICE_AUTH_SECRET;
  if (!authSecret) {
    if (!globalThis.__keaAuthWarningLogged) {
      log.warn('SERVICE_AUTH_SECRET not configured. All requests will be allowed. Set SERVICE_AUTH_SECRET env var for production.');
      globalThis.__keaAuthWarningLogged = true;
    }
    return next();
  }

  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Missing or invalid Authorization header' }, 401);
  }

  const token = authHeader.substring(7);
  if (token !== authSecret) {
    return c.json({ success: false, error: 'Invalid token' }, 403);
  }

  return next();
});

(globalThis as Record<string, unknown>).__keaAuthWarningLogged = false;

app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// ============================================================================
// Health Check
// ============================================================================

app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    service: 'kea-service',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    port: PORT,
    memoryUsage: process.memoryUsage(),
    kea: { running: cachedKeaRunning, socketPath: RESOLVED_SOCKET_PATH, leaseFile: KEA_LEASES_FILE, subnetCount: cachedSubnetCount, leaseCount: cachedLeaseCount }
  });
});

// ============================================================================
// Service Status & Control
// ============================================================================

app.get('/api/status', async (c) => {
  const running = cachedKeaRunning;
  const processRunning = isKeaProcessRunning();

  // Get current interfaces from Kea config
  let currentInterfaces: string[] = ['lo'];
  try {
    const resp = keaCommand({ command: 'config-get' });
    if (resp && resp[0]?.result === 0 && resp[0]?.arguments?.Dhcp4?.['interfaces-config']) {
      currentInterfaces = resp[0].arguments.Dhcp4['interfaces-config'].interfaces || ['lo'];
    }
  } catch {}

  // Get system network interfaces
  let systemInterfaces: Array<{name: string; ip: string; status: string}> = [];
  try {
    const result = execSync("ip -4 addr show | awk '/^[0-9]+:/{iface=$2; gsub(/:/,\"\",iface)} /inet /{split($2,a,\"/\"); print iface\",\"a[1]\",\"(iface==\"lo\"?\"loopback\":\"up\")}'", { encoding: 'utf-8' });
    systemInterfaces = result.trim().split('\n').filter(Boolean).map(line => {
      const [name, ip, status] = line.split(',');
      return { name, ip: ip || '', status };
    });
  } catch {}

  return c.json({
    success: true,
    data: {
      installed: true,
      running,
      processRunning,
      version: cachedKeaVersion,
      mode: running ? 'production' : 'stopped',
      socketPath: RESOLVED_SOCKET_PATH,
      configPath: KEA_CONFIG_PATH,
      leaseFile: KEA_LEASES_FILE,
      subnetCount: cachedSubnetCount,
      leaseCount: cachedLeaseCount,
      currentInterfaces,
      systemInterfaces,
    }
  });
});

app.post('/api/service/start', async (c) => {
  const result = startKeaServer();
  await updateCache();
  return c.json({
    success: result.success,
    message: result.message,
    pid: result.pid,
    status: cachedKeaRunning ? 'running' : 'stopped'
  });
});

app.post('/api/service/stop', async (c) => {
  stopKeaServer();
  await updateCache();
  return c.json({
    success: true,
    message: 'Kea DHCP4 stopped',
    status: cachedKeaRunning ? 'running' : 'stopped'
  });
});

app.post('/api/service/restart', async (c) => {
  stopKeaServer();
  await new Promise(r => setTimeout(r, 1000));
  const result = startKeaServer();
  await updateCache();
  return c.json({
    success: result.success,
    message: result.message,
    pid: result.pid,
    status: cachedKeaRunning ? 'running' : 'stopped'
  });
});

// ============================================================================
// Subnets
// ============================================================================

app.get('/api/subnets', async (c) => {
  try {
    const resp = keaCommand({ command: 'config-get' });
    if (!resp || resp[0]?.result !== 0 || !resp[0]?.arguments?.Dhcp4?.subnet4) {
      return c.json({ success: true, data: [] });
    }

    const config = resp[0].arguments.Dhcp4;
    const subnets4 = config.subnet4;
    const globalValidLifetime = config['valid-lifetime'] || 3600;
    const globalDns = findDnsOption(config['option-data']);

    // Get lease counts from memfile
    const leases = keaReadLeases();
    const leaseCounts: Record<number, number> = {};
    for (const lease of leases) {
      if (lease.state === 0) {
        leaseCounts[lease.subnetId] = (leaseCounts[lease.subnetId] || 0) + 1;
      }
    }

    const subnets = subnets4.map((s: any) => {
      const poolStr = s.pools?.[0]?.pool || '';
      const { start: poolStart, end: poolEnd } = parsePool(poolStr);
      const totalPool = computePoolSize(poolStart, poolEnd);
      const activeLeases = leaseCounts[s.id] || 0;
      const gateway = findRouterOption(s['option-data']);
      const dnsServers = findDnsOption(s['option-data']);
      const validLifetime = s['valid-lifetime'] || globalValidLifetime;

      return {
        id: String(s.id),
        name: getSubnetFriendlyName(s.subnet),
        cidr: s.subnet,
        gateway,
        poolStart,
        poolEnd,
        leaseTime: validLifetime,
        dnsServers: dnsServers.length > 0 ? dnsServers : globalDns,
        vlanId: null,
        activeLeases,
        totalPool,
        reservationCount: s.reservations?.length || 0,
        pools: s.pools?.map((p: any) => p.pool) || [],
        utilization: totalPool > 0 ? Math.round((activeLeases / totalPool) * 100) : 0,
      };
    });

    return c.json({ success: true, data: subnets });
  } catch (error) {
    return c.json({ success: false, error: String(error) });
  }
});

app.post('/api/subnets', async (c) => {
  try {
    const body = await c.req.json();
    const resp = keaCommand({ command: 'config-get' });
    if (!resp || resp[0]?.result !== 0 || !resp[0]?.arguments?.Dhcp4) {
      return c.json({ success: false, error: 'Could not read Kea configuration' });
    }

    const config = JSON.parse(JSON.stringify(resp[0].arguments.Dhcp4)); // Deep clone
    const existingIds = config.subnet4?.map((s: any) => s.id) || [];
    const newId = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;

    const poolStart = body.poolStart || '';
    const poolEnd = body.poolEnd || '';
    const poolStr = poolStart && poolEnd ? `${poolStart} - ${poolEnd}` : '';

    const optionData: Array<{ name: string; data: string }> = [];
    if (body.gateway) {
      optionData.push({ name: 'routers', data: body.gateway });
    }

    const newSubnet: any = {
      id: newId,
      subnet: body.subnet || body.cidr,
      pools: poolStr ? [{ pool: poolStr }] : [],
      'option-data': optionData,
      reservations: [],
    };

    if (body.leaseTime) {
      newSubnet['valid-lifetime'] = body.leaseTime;
    }

    if (!config.subnet4) config.subnet4 = [];
    config.subnet4.push(newSubnet);

    const setResp = keaCommand({ command: 'config-set', arguments: { Dhcp4: config } });
    if (!setResp || setResp[0]?.result !== 0) {
      return c.json({ success: false, error: setResp?.[0]?.text || 'Failed to set config' });
    }

    // Persist to file
    keaCommand({ command: 'config-write' });
    await updateCache();

    return c.json({
      success: true,
      data: { id: String(newId), ...body },
      message: 'Subnet added to Kea DHCP4 configuration'
    });
  } catch (error) {
    return c.json({ success: false, error: String(error) });
  }
});

app.put('/api/subnets/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const body = await c.req.json();
    const subnetId = parseInt(id);
    const resp = keaCommand({ command: 'config-get' });

    if (!resp || resp[0]?.result !== 0 || !resp[0]?.arguments?.Dhcp4?.subnet4) {
      return c.json({ success: false, error: 'Could not read Kea configuration' });
    }

    const config = JSON.parse(JSON.stringify(resp[0].arguments.Dhcp4));
    const subnetIndex = config.subnet4.findIndex((s: any) => s.id === subnetId);
    if (subnetIndex === -1) {
      return c.json({ success: false, error: `Subnet ${id} not found` });
    }

    const subnet = config.subnet4[subnetIndex];
    if (body.subnet || body.cidr) subnet.subnet = body.subnet || body.cidr;
    if (body.poolStart && body.poolEnd) subnet.pools = [{ pool: `${body.poolStart} - ${body.poolEnd}` }];
    if (body.gateway) {
      if (!subnet['option-data']) subnet['option-data'] = [];
      const routerIdx = subnet['option-data'].findIndex((o: any) => o.name === 'routers');
      if (routerIdx >= 0) subnet['option-data'][routerIdx].data = body.gateway;
      else subnet['option-data'].push({ name: 'routers', data: body.gateway });
    }
    if (body.leaseTime) subnet['valid-lifetime'] = body.leaseTime;

    config.subnet4[subnetIndex] = subnet;

    const setResp = keaCommand({ command: 'config-set', arguments: { Dhcp4: config } });
    if (!setResp || setResp[0]?.result !== 0) {
      return c.json({ success: false, error: setResp?.[0]?.text || 'Failed to set config' });
    }

    keaCommand({ command: 'config-write' });

    return c.json({ success: true, data: { id, ...body }, message: 'Subnet updated in Kea DHCP4 configuration' });
  } catch (error) {
    return c.json({ success: false, error: String(error) });
  }
});

app.delete('/api/subnets/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const subnetId = parseInt(id);
    const resp = keaCommand({ command: 'config-get' });

    if (!resp || resp[0]?.result !== 0 || !resp[0]?.arguments?.Dhcp4?.subnet4) {
      return c.json({ success: false, error: 'Could not read Kea configuration' });
    }

    const config = JSON.parse(JSON.stringify(resp[0].arguments.Dhcp4));
    config.subnet4 = config.subnet4.filter((s: any) => s.id !== subnetId);

    const setResp = keaCommand({ command: 'config-set', arguments: { Dhcp4: config } });
    if (!setResp || setResp[0]?.result !== 0) {
      return c.json({ success: false, error: setResp?.[0]?.text || 'Failed to set config' });
    }

    keaCommand({ command: 'config-write' });
    await updateCache();

    return c.json({ success: true, message: `Subnet ${id} removed from Kea DHCP4 configuration` });
  } catch (error) {
    return c.json({ success: false, error: String(error) });
  }
});

// ============================================================================
// Leases (from memfile CSV via helper)
// ============================================================================

app.get('/api/leases', async (c) => {
  try {
    const leases = keaReadLeases();

    // Get subnet map
    let subnetMap: Record<number, { subnet: string; name: string }> = {};
    try {
      const resp = keaCommand({ command: 'config-get' });
      if (resp?.[0]?.result === 0 && resp[0]?.arguments?.Dhcp4?.subnet4) {
        for (const s of resp[0].arguments.Dhcp4.subnet4) {
          subnetMap[s.id] = { subnet: s.subnet, name: getSubnetFriendlyName(s.subnet) };
        }
      }
    } catch {}

    const mappedLeases = leases.map((l: any) => {
      const subnetInfo = subnetMap[l.subnetId] || { subnet: '', name: 'Unknown' };
      const validLft = l.validLifetime || 3600;
      const cltt = l.expire > 0 ? l.expire - validLft : 0;
      const state = mapLeaseState(l.state);

      return {
        id: l.address,
        ipAddress: l.address,
        macAddress: l.hwaddr || '',
        hostname: l.hostname || '',
        clientId: l.clientId || '',
        subnetId: String(l.subnetId),
        subnetName: subnetInfo.name,
        subnetCidr: subnetInfo.subnet,
        leaseStart: cltt > 0 ? new Date(cltt * 1000).toISOString() : '',
        leaseExpires: l.expire > 0 ? new Date(l.expire * 1000).toISOString() : '',
        validLifetime: validLft,
        state,
        lastSeen: cltt > 0 ? new Date(cltt * 1000).toISOString() : '',
      };
    });

    return c.json({ success: true, data: mappedLeases });
  } catch (error) {
    return c.json({ success: false, error: String(error) });
  }
});

app.post('/api/leases/reclaim', async (c) => {
  try {
    const resp = keaCommand({ command: 'leases-reclaim', arguments: { remove: true } });
    if (resp && resp[0]?.result === 0) {
      return c.json({ success: true, message: 'Expired leases reclaimed' });
    } else {
      return c.json({ success: false, error: resp?.[0]?.text || 'Failed to reclaim leases' });
    }
  } catch (error) {
    return c.json({ success: false, error: String(error) });
  }
});

// ============================================================================
// Reservations
// ============================================================================

app.get('/api/reservations', async (c) => {
  try {
    const resp = keaCommand({ command: 'config-get' });
    if (!resp?.[0]?.arguments?.Dhcp4?.subnet4) {
      return c.json({ success: true, data: [] });
    }

    const reservations: any[] = [];
    for (const subnet of resp[0].arguments.Dhcp4.subnet4) {
      if (subnet.reservations && subnet.reservations.length > 0) {
        for (const res of subnet.reservations) {
          reservations.push({
            id: `${subnet.id}-${res['hw-address']}`,
            macAddress: res['hw-address'],
            ipAddress: res['ip-address'],
            hostname: res.hostname || '',
            subnetId: String(subnet.id),
            subnetName: getSubnetFriendlyName(subnet.subnet),
            subnetCidr: subnet.subnet,
          });
        }
      }
    }
    return c.json({ success: true, data: reservations });
  } catch (error) {
    return c.json({ success: false, error: String(error) });
  }
});

app.post('/api/reservations', async (c) => {
  try {
    const body = await c.req.json();
    const resp = keaCommand({ command: 'config-get' });
    if (!resp?.[0]?.arguments?.Dhcp4?.subnet4) {
      return c.json({ success: false, error: 'Could not read Kea configuration' });
    }

    const config = JSON.parse(JSON.stringify(resp[0].arguments.Dhcp4));
    const subnetId = parseInt(body.subnetId);
    const subnet = config.subnet4.find((s: any) => s.id === subnetId);
    if (!subnet) return c.json({ success: false, error: `Subnet ${body.subnetId} not found` });

    if (!subnet.reservations) subnet.reservations = [];
    const existing = subnet.reservations.find((r: any) => r['hw-address'] === body.macAddress);
    if (existing) return c.json({ success: false, error: 'MAC address already has a reservation in this subnet' });

    const newRes: Record<string, any> = { 'hw-address': body.macAddress, 'ip-address': body.ipAddress };
    if (body.hostname) newRes.hostname = body.hostname;
    subnet.reservations.push(newRes);

    const setResp = keaCommand({ command: 'config-set', arguments: { Dhcp4: config } });
    if (!setResp || setResp[0]?.result !== 0) {
      return c.json({ success: false, error: setResp?.[0]?.text || 'Failed to set config' });
    }

    keaCommand({ command: 'config-write' });

    return c.json({ success: true, data: newRes, message: 'Reservation added to Kea DHCP4 configuration' });
  } catch (error) {
    return c.json({ success: false, error: String(error) });
  }
});

app.delete('/api/reservations/:subnetId/:mac', async (c) => {
  try {
    const { subnetId, mac } = c.req.param();
    const resp = keaCommand({ command: 'config-get' });
    if (!resp?.[0]?.arguments?.Dhcp4?.subnet4) {
      return c.json({ success: false, error: 'Could not read Kea configuration' });
    }

    const config = JSON.parse(JSON.stringify(resp[0].arguments.Dhcp4));
    const sid = parseInt(subnetId);
    const subnet = config.subnet4.find((s: any) => s.id === sid);
    if (!subnet) return c.json({ success: false, error: `Subnet ${subnetId} not found` });
    if (!subnet.reservations) return c.json({ success: false, error: 'No reservations in this subnet' });

    const macClean = mac.replace(/-/g, ':');
    const beforeCount = subnet.reservations.length;
    subnet.reservations = subnet.reservations.filter((r: any) => r['hw-address'] !== macClean);
    if (subnet.reservations.length === beforeCount) {
      return c.json({ success: false, error: `Reservation for ${macClean} not found` });
    }

    const setResp = keaCommand({ command: 'config-set', arguments: { Dhcp4: config } });
    if (!setResp || setResp[0]?.result !== 0) {
      return c.json({ success: false, error: setResp?.[0]?.text || 'Failed to set config' });
    }

    keaCommand({ command: 'config-write' });

    return c.json({ success: true, message: `Reservation for ${macClean} removed from subnet ${subnetId}` });
  } catch (error) {
    return c.json({ success: false, error: String(error) });
  }
});

// ============================================================================
// Statistics
// ============================================================================

app.get('/api/stats', async (c) => {
  try {
    const resp = keaCommand({ command: 'statistic-get-all' });
    if (resp && resp[0]?.result === 0) {
      return c.json({ success: true, data: resp[0].arguments || {} });
    }
    return c.json({ success: false, error: 'Could not get statistics' });
  } catch (error) {
    return c.json({ success: false, error: String(error) });
  }
});

// ============================================================================
// Configuration
// ============================================================================

app.get('/api/config', async (c) => {
  try {
    const resp = keaCommand({ command: 'config-get' });
    if (resp && resp[0]?.result === 0) {
      return c.json({ success: true, data: resp[0].arguments || {} });
    }
    return c.json({ success: false, error: 'Could not get configuration' });
  } catch (error) {
    return c.json({ success: false, error: String(error) });
  }
});

app.post('/api/config/reload', async (c) => {
  try {
    const resp = keaCommand({ command: 'config-reload' });
    if (resp && resp[0]?.result === 0) {
      return c.json({ success: true, message: 'Kea configuration reloaded from file' });
    }
    return c.json({ success: false, error: resp?.[0]?.text || 'Failed to reload' });
  } catch (error) {
    return c.json({ success: false, error: String(error) });
  }
});

app.post('/api/config/write', async (c) => {
  try {
    const resp = keaCommand({ command: 'config-write' });
    if (resp && resp[0]?.result === 0) {
      return c.json({ success: true, message: 'Kea running configuration written to file' });
    }
    return c.json({ success: false, error: resp?.[0]?.text || 'Failed to write' });
  } catch (error) {
    return c.json({ success: false, error: String(error) });
  }
});

app.post('/api/interfaces', async (c) => {
  try {
    const body = await c.req.json();
    const interfaces: string[] = body.interfaces;
    if (!interfaces || !Array.isArray(interfaces) || interfaces.length === 0) {
      return c.json({ success: false, error: 'At least one interface is required' });
    }

    const resp = keaCommand({ command: 'config-get' });
    if (!resp || resp[0]?.result !== 0 || !resp[0]?.arguments?.Dhcp4) {
      return c.json({ success: false, error: 'Could not read Kea configuration' });
    }

    const config = JSON.parse(JSON.stringify(resp[0].arguments.Dhcp4));
    config['interfaces-config'] = {
      ...config['interfaces-config'],
      interfaces,
      're-detect': true,
    };

    const setResp = keaCommand({ command: 'config-set', arguments: { Dhcp4: config } });
    if (!setResp || setResp[0]?.result !== 0) {
      return c.json({ success: false, error: setResp?.[0]?.text || 'Failed to set config' });
    }

    keaCommand({ command: 'config-write' });

    return c.json({
      success: true,
      message: `Kea DHCP4 interfaces updated to: ${interfaces.join(', ')}. Restart required for full effect.`,
      data: { interfaces },
    });
  } catch (error) {
    return c.json({ success: false, error: String(error) });
  }
});

// ============================================================================
// DHCP Enable/Disable
// ============================================================================

app.post('/api/dhcp/enable', async (c) => {
  try {
    const resp = keaCommand({ command: 'dhcp-enable', arguments: { 'max-period': 0 } });
    if (resp && resp[0]?.result === 0) {
      return c.json({ success: true, message: 'DHCP service enabled' });
    }
    return c.json({ success: false, error: resp?.[0]?.text || 'Failed to enable' });
  } catch (error) {
    return c.json({ success: false, error: String(error) });
  }
});

app.post('/api/dhcp/disable', async (c) => {
  try {
    const resp = keaCommand({ command: 'dhcp-disable', arguments: { 'max-period': 60 } });
    if (resp && resp[0]?.result === 0) {
      return c.json({ success: true, message: 'DHCP service disabled for 60 seconds' });
    }
    return c.json({ success: false, error: resp?.[0]?.text || 'Failed to disable' });
  } catch (error) {
    return c.json({ success: false, error: String(error) });
  }
});

// ============================================================================
// Sync
// ============================================================================

app.post('/api/sync', async (c) => {
  try {
    const resp = keaCommand({ command: 'config-write' });
    return c.json({
      success: resp?.[0]?.result === 0,
      message: resp?.[0]?.result === 0 ? 'Kea configuration synced' : (resp?.[0]?.text || 'Failed'),
    });
  } catch (error) {
    return c.json({ success: false, error: String(error) });
  }
});

// ============================================================================
// Summary
// ============================================================================

app.get('/api/summary', (c) => {
  const running = cachedKeaRunning;
  const processRunning = isKeaProcessRunning();
  const leases = keaReadLeases();
  const activeLeases = leases.filter((l: any) => l.state === 0).length;

  return c.json({
    success: true,
    data: {
      running,
      processRunning,
      subnetCount: cachedSubnetCount,
      leaseCount: leases.length,
      activeLeases,
      reservationCount: 0,
      version: cachedKeaVersion,
    }
  });
});

// ============================================================================
// OS-Level Network Information (Real System Data)
// ============================================================================

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

interface OsFirewallRule {
  chain: string;
  target: string;
  protocol: string;
  source: string;
  destination: string;
  interface: string;
  rule: string;
}

interface OsArpEntry {
  ipAddress: string;
  macAddress: string;
  interface: string;
  state: string;
}

function safeExec(cmd: string, timeout = 5000): string {
  try { return execSync(cmd, { encoding: 'utf-8', timeout }); } catch { return ''; }
}

function getOsInterfaces(): OsInterface[] {
  const interfaces: OsInterface[] = [];
  
  // Get all interface names from /sys/class/net
  let ifNames: string[] = [];
  try {
    ifNames = fs.readdirSync('/sys/class/net').filter(n => !n.startsWith('.'));
  } catch {
    // Fallback to ip command
    const ipOut = safeExec("ip -o link show | awk -F': ' '{print $2}'");
    ifNames = ipOut.trim().split('\n').filter(Boolean);
  }

  for (const name of ifNames) {
    try {
      // Type detection
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

      // MAC address
      const macAddress = safeExec(`cat /sys/class/net/${name}/address 2>/dev/null`).trim() || '00:00:00:00:00:00';

      // IPv4 addresses
      const ipv4Out = safeExec(`ip -o -4 addr show dev ${name} 2>/dev/null`);
      const ipv4Addresses = ipv4Out.trim().split('\n')
        .filter(Boolean)
        .map(line => { const m = line.match(/inet\s+([^\s]+)/); return m ? m[1] : ''; })
        .filter(Boolean);

      // IPv6 addresses
      const ipv6Out = safeExec(`ip -o -6 addr show dev ${name} 2>/dev/null`);
      const ipv6Addresses = ipv6Out.trim().split('\n')
        .filter(Boolean)
        .map(line => { const m = line.match(/inet6\s+([^\s]+)/); return m ? m[1] : ''; })
        .filter(Boolean);

      // State
      const operState = safeExec(`cat /sys/class/net/${name}/operstate 2>/dev/null`).trim();
      const state: OsInterface['state'] = operState === 'up' || operState === 'UNKNOWN' ? 'up' : operState === 'down' ? 'down' : 'unknown';

      // MTU
      const mtu = parseInt(safeExec(`cat /sys/class/net/${name}/mtu 2>/dev/null`).trim()) || 1500;

      // Speed & Duplex
      const speed = safeExec(`cat /sys/class/net/${name}/speed 2>/dev/null`).trim();
      const duplex = safeExec(`cat /sys/class/net/${name}/duplex 2>/dev/null`).trim();

      // Stats from /sys/class/net/{name}/statistics/
      const readStat = (stat: string) => parseInt(safeExec(`cat /sys/class/net/${name}/statistics/${stat} 2>/dev/null`).trim()) || 0;
      const rxBytes = readStat('rx_bytes');
      const txBytes = readStat('tx_bytes');
      const rxPackets = readStat('rx_packets');
      const txPackets = readStat('tx_packets');
      const rxErrors = readStat('rx_errors');
      const txErrors = readStat('tx_errors');

      // Default route check
      const defaultRoute = safeExec(`ip route show default 2>/dev/null | grep dev\\s${name}`);
      const isDefaultRoute = defaultRoute.includes(`dev ${name}`);

      // Gateway for this interface
      const gwMatch = safeExec(`ip route show dev ${name} 2>/dev/null`).match(/via\s+([^\s]+)/);
      const gateway = gwMatch ? gwMatch[1] : '';

      // Vendor / Driver
      const vendor = safeExec(`cat /sys/class/net/${name}/device/vendor 2>/dev/null`).trim();
      const driver = safeExec(`readlink /sys/class/net/${name}/device/driver 2>/dev/null`).split('/').pop()?.trim() || '';

      // VLANs on this interface
      const vlans: string[] = [];
      if (type === 'bridge') {
        const brif = safeExec(`ls /sys/class/net/${name}/brif/ 2>/dev/null`);
        vlans.push(...brif.trim().split('\n').filter(Boolean));
      }

      // Bridge ports
      const bridgePorts: string[] = type === 'bridge' ? [...vlans] : [];

      // Bond members
      const bondMembers: string[] = [];
      if (type === 'bond') {
        const slaves = safeExec(`cat /sys/class/net/${name}/bonding/slaves 2>/dev/null`).trim();
        bondMembers.push(...slaves.split(/\s+/).filter(Boolean));
      }

      // DHCP enabled check (Debian specific)
      const dhclientPid = safeExec(`pgrep -f "dhclient.*${name}" 2>/dev/null`).trim();
      const networkManagerConn = safeExec(`nmcli -t -f GENERAL.CONNECTION,DEVICE dev show ${name} 2>/dev/null | grep ${name}`).trim();
      const dhcpEnabled = dhclientPid.length > 0 || networkManagerConn.includes('dhcp');

      // DNS servers for this interface
      const dnsServers: string[] = [];

      // Role inference
      let role: OsInterface['role'] = 'unknown';
      if (name === 'lo') role = 'management';
      else if (isDefaultRoute) role = 'wan';
      else if (name.startsWith('eth') || name.startsWith('en')) {
        if (isDefaultRoute) role = 'wan';
        else role = 'lan';
      } else if (name.startsWith('wlan') || name.startsWith('wl')) role = 'guest';
      else if (name.startsWith('br')) role = 'lan';

      interfaces.push({
        name, type, macAddress, ipv4Addresses, ipv6Addresses,
        gateway, dnsServers, mtu, state,
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
        macAddress: parts[4] === 'FAILED' || parts[4] === 'INCOMPLETE' ? '' : parts[4],
        interface: parts[2],
        state: parts[5] || parts[4] || '',
      });
    }
  }
  return entries;
}

function getOsConnectionStats() {
  const tcpEstab = safeExec("ss -t state established 2>/dev/null | wc -l").trim();
  const tcpTimeWait = safeExec("ss -t state time-wait 2>/dev/null | wc -l").trim();
  const tcpClose = safeExec("ss -t state close-wait 2>/dev/null | wc -l").trim();
  const udpConns = safeExec("ss -u 2>/dev/null | wc -l").trim();
  const totalSockets = safeExec("ss -s 2>/dev/null | head -1").trim();
  return {
    tcpEstablished: parseInt(tcpEstab) || 0,
    tcpTimeWait: parseInt(tcpTimeWait) || 0,
    tcpCloseWait: parseInt(tcpClose) || 0,
    udpConnections: parseInt(udpConns) || 0,
    socketSummary: totalSockets,
  };
}

function getOsIptablesRules(): OsFirewallRule[] {
  const rules: OsFirewallRule[] = [];
  // Try iptables first, then nft
  const output = safeExec("iptables -L -n --line-numbers 2>/dev/null || nft list ruleset 2>/dev/null | head -100", 8000);
  let currentChain = '';
  for (const line of output.split('\n')) {
    if (line.startsWith('Chain ')) {
      const m = line.match(/Chain\s+(\S+)/);
      if (m) currentChain = m[1];
    } else if (line && !line.startsWith('num') && currentChain) {
      rules.push({
        chain: currentChain,
        target: '', protocol: '', source: '', destination: '', interface: '',
        rule: line.trim(),
      });
    }
    if (rules.length > 200) break; // Safety limit
  }
  return rules;
}

// ============================================================================
// OS Network API Endpoints
// ============================================================================

app.get('/api/os/interfaces', (c) => {
  const interfaces = getOsInterfaces();
  return c.json({ success: true, data: interfaces });
});

app.get('/api/os/interfaces/:name', (c) => {
  const name = c.req.param('name');
  const interfaces = getOsInterfaces();
  const iface = interfaces.find(i => i.name === name);
  if (!iface) return c.json({ success: false, error: `Interface ${name} not found` });
  return c.json({ success: true, data: iface });
});

app.post('/api/os/interfaces/:name/up', (c) => {
  const name = c.req.param('name');
  const result = safeExec(`ip link set ${name} up 2>&1`);
  return c.json({ success: true, message: `Interface ${name} brought up`, output: result.trim() });
});

app.post('/api/os/interfaces/:name/down', (c) => {
  const name = c.req.param('name');
  const result = safeExec(`ip link set ${name} down 2>&1`);
  return c.json({ success: true, message: `Interface ${name} brought down`, output: result.trim() });
});

app.post('/api/os/interfaces/:name/mtu', async (c) => {
  const name = c.req.param('name');
  const body = await c.req.json();
  const mtu = body.mtu;
  if (!mtu || mtu < 576 || mtu > 9000) return c.json({ success: false, error: 'MTU must be between 576 and 9000' });
  const result = safeExec(`ip link set ${name} mtu ${mtu} 2>&1`);
  return c.json({ success: true, message: `MTU for ${name} set to ${mtu}`, output: result.trim() });
});

app.post('/api/os/interfaces/:name/address', async (c) => {
  const name = c.req.param('name');
  const body = await c.req.json();
  const address = body.address; // e.g. "192.168.1.1/24"
  if (!address) return c.json({ success: false, error: 'Address is required (CIDR format)' });
  const result = safeExec(`ip addr add ${address} dev ${name} 2>&1`);
  return c.json({ success: true, message: `Address ${address} added to ${name}`, output: result.trim() });
});

app.delete('/api/os/interfaces/:name/address', async (c) => {
  const name = c.req.param('name');
  const body = await c.req.json();
  const address = body.address;
  if (!address) return c.json({ success: false, error: 'Address is required' });
  const result = safeExec(`ip addr del ${address} dev ${name} 2>&1`);
  return c.json({ success: true, message: `Address ${address} removed from ${name}`, output: result.trim() });
});

app.get('/api/os/routes', (c) => {
  const routes = getOsRoutes();
  return c.json({ success: true, data: routes });
});

app.post('/api/os/routes', async (c) => {
  const body = await c.req.json();
  if (!body.destination || !body.interface) return c.json({ success: false, error: 'destination and interface are required' });
  const gw = body.gateway ? `via ${body.gateway}` : '';
  const metric = body.metric ? `metric ${body.metric}` : '';
  const result = safeExec(`ip route add ${body.destination} ${gw} dev ${body.interface} ${metric} 2>&1`);
  return c.json({ success: true, message: 'Route added', output: result.trim() });
});

app.delete('/api/os/routes', async (c) => {
  const body = await c.req.json();
  if (!body.destination) return c.json({ success: false, error: 'destination is required' });
  const result = safeExec(`ip route del ${body.destination} 2>&1`);
  return c.json({ success: true, message: 'Route deleted', output: result.trim() });
});

app.get('/api/os/dns', (c) => {
  const dns = getOsDnsConfig();
  return c.json({ success: true, data: dns });
});

app.post('/api/os/dns', async (c) => {
  const body = await c.req.json();
  const nameservers = body.nameservers as string[];
  const search = body.search as string[];
  if (!nameservers || nameservers.length === 0) return c.json({ success: false, error: 'At least one nameserver required' });
  try {
    let content = '# Managed by StaySuite HospitalityOS\n';
    for (const ns of nameservers) content += `nameserver ${ns}\n`;
    if (search && search.length > 0) content += `search ${search.join(' ')}\n`;
    fs.writeFileSync('/etc/resolv.conf', content);
    return c.json({ success: true, message: 'DNS configuration updated' });
  } catch (error) {
    return c.json({ success: false, error: `Failed to write DNS config: ${error}` });
  }
});

app.get('/api/os/arp', (c) => {
  const arp = getOsArpTable();
  return c.json({ success: true, data: arp });
});

app.get('/api/os/connections', (c) => {
  const stats = getOsConnectionStats();
  return c.json({ success: true, data: stats });
});

app.get('/api/os/firewall/rules', (c) => {
  const rules = getOsIptablesRules();
  return c.json({ success: true, data: rules });
});

app.get('/api/os/system-info', (c) => {
  const hostname = safeExec('hostname 2>/dev/null').trim();
  const kernel = safeExec('uname -r 2>/dev/null').trim();
  const osRelease = safeExec('cat /etc/os-release 2>/dev/null | grep PRETTY_NAME').replace('PRETTY_NAME=', '').replace(/"/g, '').trim();
  const uptime = safeExec('cat /proc/uptime 2>/dev/null').split(' ')[0];
  const uptimeSec = parseFloat(uptime || '0');
  const loadAvg = safeExec('cat /proc/loadavg 2>/dev/null').trim().split(' ').slice(0, 3).join(' ');
  const memTotal = parseInt(safeExec("free -b 2>/dev/null | awk '/Mem:/{print $2}'").trim()) || 0;
  const memUsed = parseInt(safeExec("free -b 2>/dev/null | awk '/Mem:/{print $3}'").trim()) || 0;
  const cpuCount = parseInt(safeExec('nproc 2>/dev/null').trim()) || 1;

  return c.json({
    success: true,
    data: {
      hostname, kernel, osRelease,
      uptimeSeconds: uptimeSec,
      uptimeFormatted: formatUptime(uptimeSec),
      loadAverage: loadAvg,
      memory: { total: memTotal, used: memUsed, free: memTotal - memUsed, usagePercent: memTotal > 0 ? Math.round((memUsed / memTotal) * 100) : 0 },
      cpuCount,
    }
  });
});

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

// VLAN management
app.post('/api/os/vlans', async (c) => {
  const body = await c.req.json();
  const { parentInterface, vlanId, ipAddress, name } = body;
  if (!parentInterface || !vlanId) return c.json({ success: false, error: 'parentInterface and vlanId are required' });
  const vlanName = name || `${parentInterface}.${vlanId}`;
  const result1 = safeExec(`ip link add link ${parentInterface} name ${vlanName} type vlan id ${vlanId} 2>&1`);
  const result2 = safeExec(`ip link set ${vlanName} up 2>&1`);
  let result3 = '';
  if (ipAddress) result3 = safeExec(`ip addr add ${ipAddress} dev ${vlanName} 2>&1`);
  return c.json({ success: true, message: `VLAN ${vlanName} created`, output: [result1, result2, result3].join('\n').trim() });
});

app.delete('/api/os/vlans/:name', (c) => {
  const name = c.req.param('name');
  const result = safeExec(`ip link del ${name} 2>&1`);
  return c.json({ success: true, message: `VLAN ${name} deleted`, output: result.trim() });
});

// Bridge management
app.post('/api/os/bridges', async (c) => {
  const body = await c.req.json();
  const { name, ports, ipAddress } = body;
  if (!name) return c.json({ success: false, error: 'Bridge name is required' });
  const r1 = safeExec(`ip link add ${name} type bridge 2>&1`);
  const r2 = safeExec(`ip link set ${name} up 2>&1`);
  const portResults: string[] = [];
  if (ports && Array.isArray(ports)) {
    for (const port of ports) {
      portResults.push(safeExec(`ip link set ${port} master ${name} 2>&1`));
    }
  }
  let r3 = '';
  if (ipAddress) r3 = safeExec(`ip addr add ${ipAddress} dev ${name} 2>&1`);
  return c.json({ success: true, message: `Bridge ${name} created`, output: [r1, r2, ...portResults, r3].join('\n').trim() });
});

app.post('/api/os/bridges/:name/ports', async (c) => {
  const name = c.req.param('name');
  const body = await c.req.json();
  const port = body.port;
  if (!port) return c.json({ success: false, error: 'Port interface name is required' });
  const result = safeExec(`ip link set ${port} master ${name} 2>&1`);
  return c.json({ success: true, message: `Port ${port} added to bridge ${name}`, output: result.trim() });
});

app.delete('/api/os/bridges/:name/ports/:port', (c) => {
  const name = c.req.param('name');
  const port = c.req.param('port');
  const result = safeExec(`ip link set ${port} nomaster 2>&1`);
  return c.json({ success: true, message: `Port ${port} removed from bridge ${name}`, output: result.trim() });
});

app.delete('/api/os/bridges/:name', (c) => {
  const name = c.req.param('name');
  const result = safeExec(`ip link del ${name} 2>&1`);
  return c.json({ success: true, message: `Bridge ${name} deleted`, output: result.trim() });
});

// Bond management
app.post('/api/os/bonds', async (c) => {
  const body = await c.req.json();
  const { name, members, mode, ipAddress } = body;
  if (!name) return c.json({ success: false, error: 'Bond name is required' });
  const bondMode = mode || 'active-backup';
  const r1 = safeExec(`ip link add ${name} type bond mode ${bondMode} 2>&1`);
  const r2 = safeExec(`ip link set ${name} up 2>&1`);
  const memberResults: string[] = [];
  if (members && Array.isArray(members)) {
    for (const member of members) {
      memberResults.push(safeExec(`ip link set ${member} down 2>&1`));
      memberResults.push(safeExec(`ip link set ${member} master ${name} 2>&1`));
    }
  }
  let r3 = '';
  if (ipAddress) r3 = safeExec(`ip addr add ${ipAddress} dev ${name} 2>&1`);
  return c.json({ success: true, message: `Bond ${name} created (mode: ${bondMode})`, output: [r1, r2, ...memberResults, r3].join('\n').trim() });
});

app.delete('/api/os/bonds/:name', (c) => {
  const name = c.req.param('name');
  const result = safeExec(`ip link del ${name} 2>&1`);
  return c.json({ success: true, message: `Bond ${name} deleted`, output: result.trim() });
});

// Port forwarding (iptables NAT)
app.post('/api/os/nat/forward', async (c) => {
  const body = await c.req.json();
  const { protocol, destPort, toDest, interface: iface } = body;
  if (!protocol || !destPort || !toDest) return c.json({ success: false, error: 'protocol, destPort, and toDest are required' });
  const ifaceArg = iface ? `-i ${iface}` : '';
  const r1 = safeExec(`iptables -t nat -A PREROUTING ${ifaceArg} -p ${protocol} --dport ${destPort} -j DNAT --to-destination ${toDest} 2>&1`);
  const r2 = safeExec(`iptables -t nat -A POSTROUTING -j MASQUERADE 2>&1`);
  return c.json({ success: true, message: `Port forward added: ${protocol}/${destPort} → ${toDest}`, output: [r1, r2].join('\n').trim() });
});

app.delete('/api/os/nat/forward', async (c) => {
  const body = await c.req.json();
  const { protocol, destPort, toDest } = body;
  if (!protocol || !destPort) return c.json({ success: false, error: 'protocol and destPort are required' });
  const rule = toDest ? `-j DNAT --to-destination ${toDest}` : '';
  const result = safeExec(`iptables -t nat -D PREROUTING -p ${protocol} --dport ${destPort} ${rule} 2>&1`);
  return c.json({ success: true, message: `Port forward removed`, output: result.trim() });
});

app.get('/api/os/nat/forwards', (c) => {
  const output = safeExec("iptables -t nat -L PREROUTING -n --line-numbers 2>/dev/null", 8000);
  const rules: any[] = [];
  for (const line of output.split('\n')) {
    if (line.includes('DNAT')) {
      rules.push({ rule: line.trim(), parsed: parseNatRule(line) });
    }
  }
  return c.json({ success: true, data: rules });
});

function parseNatRule(line: string): Record<string, string> {
  const parts = line.split(/\s+/);
  return {
    num: parts[0] || '',
    target: parts[1] || '',
    protocol: parts[2] || '',
    source: parts[4] || '',
    destination: parts[5] || '',
    toDestination: parts.find(p => p.startsWith('to:'))?.replace('to:', '') || parts[parts.length - 1] || '',
  };
}

// IP forwarding control
app.get('/api/os/ip-forward', (c) => {
  const val = safeExec('cat /proc/sys/net/ipv4/ip_forward 2>/dev/null').trim();
  return c.json({ success: true, data: { enabled: val === '1', value: val } });
});

app.post('/api/os/ip-forward', async (c) => {
  const body = await c.req.json();
  const enabled = body.enabled !== false;
  const val = enabled ? '1' : '0';
  safeExec(`sysctl -w net.ipv4.ip_forward=${val} 2>&1`);
  try { fs.writeFileSync('/proc/sys/net/ipv4/ip_forward', val); } catch {}
  return c.json({ success: true, message: `IP forwarding ${enabled ? 'enabled' : 'disabled'}` });
});

// ============================================================================
// Start Server
// ============================================================================

log.info('Starting Kea DHCP4 Management Service', { port: PORT });
const server = Bun.serve({
  port: PORT,
  fetch: app.fetch,
});
log.info('Kea DHCP4 Management Service running', { port: PORT, socket: KEA_SOCKET_PATH, config: KEA_CONFIG_PATH, leases: KEA_LEASES_FILE });

// Graceful shutdown
process.on('SIGTERM', () => {
  log.info('Received SIGTERM, shutting down...');
  server.stop(true);
  process.exit(0);
});

process.on('SIGINT', () => {
  log.info('Received SIGINT, shutting down...');
  server.stop(true);
  process.exit(0);
});
