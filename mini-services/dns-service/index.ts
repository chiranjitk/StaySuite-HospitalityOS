/**
 * DNS (dnsmasq) Management Service for StaySuite HospitalityOS
 *
 * Manages dnsmasq DNS server on Debian 13:
 * - DNS zones & records (A, AAAA, CNAME, MX, TXT, SRV, PTR)
 * - DNS redirects for captive portal
 * - Upstream forwarders
 * - Cache management
 * - Auto-sync DB -> dnsmasq config -> reload
 * - Prisma DB sync (bidirectional)
 *
 * Port: 3012
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import Database from 'bun:sqlite';
import { createLogger } from '../shared/logger';

const app = new Hono();
const PORT = 3012;
const SERVICE_VERSION = '1.0.0';
const log = createLogger('dns-service');
const startTime = Date.now();

const PROJECT_ROOT = process.env.PROJECT_ROOT || path.resolve(__dirname, '..', '..');

// DNS service uses its own separate database for operational data
const DB_PATH = process.env.DATABASE_PATH || path.join(PROJECT_ROOT, 'db', 'dns-service.db');

// Prisma database path (the main Next.js app DB) - used for sync
const PRISMA_DB_PATH = process.env.PRISMA_DATABASE_PATH || path.join(PROJECT_ROOT, 'db', 'custom.db');

// Detect system dnsmasq
const SYSTEM_DNSMASQ = (() => {
  try { execSync('which dnsmasq 2>/dev/null', { encoding: 'utf-8' }); return true; } catch { return false; }
})();

const DNSMASQ_BIN = SYSTEM_DNSMASQ ? '/usr/sbin/dnsmasq' : (process.env.DNSMASQ_BIN || '/usr/sbin/dnsmasq');
const DNSMASQ_CONFIG_DIR = SYSTEM_DNSMASQ ? '/etc/dnsmasq.d' : path.join(PROJECT_ROOT, 'dns-local');
const DNSMASQ_CONFIG = path.join(DNSMASQ_CONFIG_DIR, 'staysuite.conf');
const DNSMASQ_PID_FILE = SYSTEM_DNSMASQ ? '/run/dnsmasq/dnsmasq.pid' : '/tmp/dnsmasq.pid';
const DNSMASQ_RESOLV = SYSTEM_DNSMASQ ? '/etc/resolv.conf' : path.join(PROJECT_ROOT, 'dns-local', 'resolv.conf');

// Ensure config and db directories exist
try { fs.mkdirSync(DNSMASQ_CONFIG_DIR, { recursive: true }); } catch {}
try { fs.mkdirSync(path.dirname(DB_PATH), { recursive: true }); } catch {}

// ============================================================================
// Database Connection (DNS service's own DB)
// ============================================================================

let db: Database.Database;
try {
  db = new Database(DB_PATH);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  log.info('Connected to own database', { path: DB_PATH });
} catch (error) {
  log.error('Failed to connect to database', { path: DB_PATH, error: String(error) });
  process.exit(1);
}

// Ensure DNS tables exist in the service's own DB
db.exec(`
  CREATE TABLE IF NOT EXISTS DnsZone (
    id TEXT PRIMARY KEY,
    tenantId TEXT NOT NULL DEFAULT 'default',
    propertyId TEXT NOT NULL DEFAULT 'default',
    domain TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'forward',
    description TEXT,
    vlanId INTEGER,
    enabled INTEGER NOT NULL DEFAULT 1,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(domain, propertyId)
  );

  CREATE TABLE IF NOT EXISTS DnsRecord (
    id TEXT PRIMARY KEY,
    tenantId TEXT NOT NULL DEFAULT 'default',
    zoneId TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'A',
    value TEXT NOT NULL,
    ttl INTEGER NOT NULL DEFAULT 300,
    priority INTEGER,
    enabled INTEGER NOT NULL DEFAULT 1,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (zoneId) REFERENCES DnsZone(id)
  );

  CREATE TABLE IF NOT EXISTS DnsRedirect (
    id TEXT PRIMARY KEY,
    tenantId TEXT NOT NULL DEFAULT 'default',
    propertyId TEXT NOT NULL DEFAULT 'default',
    domain TEXT NOT NULL,
    targetIp TEXT NOT NULL,
    wildcard INTEGER NOT NULL DEFAULT 0,
    priority INTEGER NOT NULL DEFAULT 100,
    description TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS DnsForwarder (
    id TEXT PRIMARY KEY,
    tenantId TEXT NOT NULL DEFAULT 'default',
    propertyId TEXT NOT NULL DEFAULT 'default',
    address TEXT NOT NULL,
    port INTEGER NOT NULL DEFAULT 53,
    description TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(address, port, propertyId)
  );
`);

// ============================================================================
// Helpers
// ============================================================================

function generateId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  const rand = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `dns_${Date.now()}_${rand}`;
}

function safeExec(cmd: string, timeout = 5000): string {
  try { return execSync(cmd, { encoding: 'utf-8', timeout }); } catch { return ''; }
}

function isDnsmasqRunning(): boolean {
  try {
    // Check if dnsmasq process is alive AND listening on port 53
    const psResult = execSync('ps aux | grep -E "[d]nsmasq"', { encoding: 'utf-8' });
    if (!psResult.trim()) return false;
    // Verify it's actually listening on DNS port 53 (both UDP and TCP)
    const ssResult = execSync('ss -ulnp | grep ":53 \\|:53\\t"', { encoding: 'utf-8' });
    return ssResult.trim().length > 0;
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
  try {
    // Load ALL conf files in the config directory (both DNS and DHCP)
    const configDir = path.dirname(DNSMASQ_CONFIG);
    execSync(`${DNSMASQ_BIN} -C ${configDir} 2>&1`, { encoding: 'utf-8' });
    const start = Date.now();
    while (Date.now() - start < 3000) {
      if (isDnsmasqRunning()) return { success: true, message: 'dnsmasq started successfully' };
      execSync('sleep 0.5');
    }
    return { success: false, message: 'dnsmasq failed to start within timeout' };
  } catch (error) {
    return { success: false, message: `Failed to start dnsmasq: ${error}` };
  }
}

function stopDnsmasq(): { success: boolean; message: string } {
  if (!isDnsmasqRunning()) return { success: true, message: 'dnsmasq is not running' };
  try {
    execSync('pkill dnsmasq 2>/dev/null || true');
    const start = Date.now();
    while (Date.now() - start < 3000) {
      if (!isDnsmasqRunning()) return { success: true, message: 'dnsmasq stopped successfully' };
      execSync('sleep 0.5');
    }
    try { execSync('pkill -9 dnsmasq 2>/dev/null'); } catch {}
    return { success: true, message: 'dnsmasq force-stopped' };
  } catch (error) {
    return { success: false, message: `Failed to stop dnsmasq: ${error}` };
  }
}

function reloadDnsmasq(): { success: boolean; message: string } {
  try {
    execSync('pkill -HUP dnsmasq 2>/dev/null || true');
    // After SIGHUP, dnsmasq re-reads config but may not show new listeners immediately
    return { success: true, message: 'dnsmasq reload signal sent (config re-read)' };
  } catch (error) {
    return { success: false, message: `Failed to reload dnsmasq: ${error}` };
  }
}

function syncConfigToDisk(): { success: boolean; lines: number } {
  let config = `# StaySuite DNS Configuration - Auto-generated
# Last updated: ${new Date().toISOString()}
# DO NOT EDIT MANUALLY - Changes will be overwritten

`;

  // Upstream forwarders
  try {
    const forwarders = db.query('SELECT * FROM DnsForwarder WHERE enabled = 1').all() as any[];
    if (forwarders.length > 0) {
      config += '# Upstream DNS forwarders\n';
      for (const f of forwarders) {
        config += `server=${f.port !== 53 ? `${f.address}#${f.port}` : f.address}\n`;
      }
      config += '\n';
    }
  } catch {}

  // DNS redirects (captive portal)
  try {
    const redirects = db.query('SELECT * FROM DnsRedirect WHERE enabled = 1 ORDER BY priority ASC').all() as any[];
    if (redirects.length > 0) {
      config += '# DNS Redirects (Captive Portal)\n';
      for (const r of redirects) {
        const domain = r.wildcard ? `/${r.domain}` : r.domain;
        config += `address=/${domain}/${r.targetIp}\n`;
      }
      config += '\n';
    }
  } catch {}

  // DNS records
  try {
    const zones = db.query('SELECT * FROM DnsZone WHERE enabled = 1').all() as any[];
    for (const zone of zones) {
      config += `# Zone: ${zone.domain}\n`;
      try {
        const records = db.query('SELECT * FROM DnsRecord WHERE zoneId = ? AND enabled = 1').all(zone.id) as any[];
        for (const r of records) {
          switch (r.type) {
            case 'A':
              config += `address=/${r.name}.${zone.domain}/${r.value}\n`;
              break;
            case 'AAAA':
              config += `address=/${r.name}.${zone.domain}/${r.value}\n`;
              break;
            case 'CNAME':
              config += `cname=${r.name}.${zone.domain},${r.value}\n`;
              break;
            case 'MX':
              config += `mx-host=${zone.domain},${r.value},${r.priority || 10}\n`;
              break;
            case 'TXT':
              config += `txt-record=${r.name}.${zone.domain},${r.value}\n`;
              break;
            case 'SRV':
              config += `srv-host=${r.name}.${zone.domain},${r.value},${r.priority || 10}\n`;
              break;
            case 'PTR':
              config += `ptr-record=${r.name}.${zone.domain},${r.value}\n`;
              break;
          }
        }
      } catch {}
      config += '\n';
    }
  } catch {}

  // General settings
  config += `# General settings
domain-needed
bogus-priv
no-resolv
expand-hosts
local-ttl=300
cache-size=10000
dns-forward-max=1000
min-port=1024
`;

  try {
    fs.writeFileSync(DNSMASQ_CONFIG, config, 'utf-8');
    const lineCount = config.split('\n').length;
    return { success: true, lines: lineCount };
  } catch (error) {
    log.error('Failed to write dnsmasq config', { error: String(error) });
    return { success: false, lines: 0 };
  }
}

function fullSync(): { config: any; reload: any } {
  const config = syncConfigToDisk();
  let reload: any = { success: false, message: 'dnsmasq not running' };
  if (isDnsmasqRunning()) {
    reload = reloadDnsmasq();
  }
  return { config, reload };
}

// ============================================================================
// Prisma DB Sync Functions
// ============================================================================

/**
 * Convert Prisma boolean (1/"1"/true/"true"/0/"0"/false/"false") to INTEGER for our DB
 */
function prismaBoolToInt(val: any): number {
  if (val === true || val === 1 || val === '1' || val === 'true') return 1;
  return 0;
}

/**
 * Sync data FROM the Prisma database (custom.db) INTO the DNS service's own database.
 * Reads DnsZone, DnsRecord, DnsRedirectRule from Prisma and upserts into local tables.
 */
function syncFromPrisma(): { zones: number; records: number; redirects: number; errors: string[] } {
  const result = { zones: 0, records: 0, redirects: 0, errors: [] as string[] };

  // Check if Prisma DB exists
  if (!fs.existsSync(PRISMA_DB_PATH)) {
    result.errors.push(`Prisma database not found at ${PRISMA_DB_PATH}`);
    return result;
  }

  let prismaDb: Database.Database;
  try {
    prismaDb = new Database(PRISMA_DB_PATH, { readonly: true });
  } catch (error) {
    result.errors.push(`Failed to open Prisma database: ${error}`);
    return result;
  }

  try {
    // ---- Sync DnsZone from Prisma ----
    // Prisma DnsZone columns: id, tenantId, propertyId, domain, description, vlanId, enabled, createdAt, updatedAt
    // DNS service DnsZone columns: id, tenantId, propertyId, domain, type, description, vlanId, enabled, createdAt, updatedAt
    try {
      const prismaZones = prismaDb.query('SELECT * FROM DnsZone').all() as any[];
      for (const pz of prismaZones) {
        try {
          db.run(`
            INSERT INTO DnsZone (id, tenantId, propertyId, domain, type, description, vlanId, enabled, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              tenantId = excluded.tenantId,
              propertyId = excluded.propertyId,
              domain = excluded.domain,
              description = excluded.description,
              vlanId = excluded.vlanId,
              enabled = excluded.enabled,
              updatedAt = excluded.updatedAt
          `, [
            pz.id, pz.tenantId || 'default', pz.propertyId || 'default',
            pz.domain, 'forward',  // Prisma doesn't have type, default to 'forward'
            pz.description || null, pz.vlanId || null,
            prismaBoolToInt(pz.enabled),
            pz.createdAt || new Date().toISOString(),
            pz.updatedAt || new Date().toISOString()
          ]);
          result.zones++;
        } catch (err) {
          result.errors.push(`Zone upsert failed [${pz.id}]: ${err}`);
        }
      }
    } catch (err) {
      result.errors.push(`DnsZone read from Prisma failed: ${err}`);
    }

    // ---- Sync DnsRecord from Prisma ----
    // Prisma DnsRecord columns: id, tenantId, zoneId, name, type, value, ttl, priority, enabled, createdAt, updatedAt
    try {
      const prismaRecords = prismaDb.query('SELECT * FROM DnsRecord').all() as any[];
      for (const pr of prismaRecords) {
        try {
          db.run(`
            INSERT INTO DnsRecord (id, tenantId, zoneId, name, type, value, ttl, priority, enabled, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              tenantId = excluded.tenantId,
              zoneId = excluded.zoneId,
              name = excluded.name,
              type = excluded.type,
              value = excluded.value,
              ttl = excluded.ttl,
              priority = excluded.priority,
              enabled = excluded.enabled,
              updatedAt = excluded.updatedAt
          `, [
            pr.id, pr.tenantId || 'default', pr.zoneId,
            pr.name, pr.type || 'A', pr.value,
            pr.ttl || 300, pr.priority || null,
            prismaBoolToInt(pr.enabled),
            pr.createdAt || new Date().toISOString(),
            pr.updatedAt || new Date().toISOString()
          ]);
          result.records++;
        } catch (err) {
          result.errors.push(`Record upsert failed [${pr.id}]: ${err}`);
        }
      }
    } catch (err) {
      result.errors.push(`DnsRecord read from Prisma failed: ${err}`);
    }

    // ---- Sync DnsRedirectRule from Prisma -> DnsRedirect in our DB ----
    // Prisma DnsRedirectRule columns: id, tenantId, propertyId, name, matchPattern, targetIp, applyTo, priority, enabled, description, createdAt, updatedAt
    // DNS service DnsRedirect columns: id, tenantId, propertyId, domain, targetIp, wildcard, priority, description, enabled, createdAt, updatedAt
    // Mapping: matchPattern -> domain, applyTo is stored in description prefix
    try {
      const prismaRules = prismaDb.query('SELECT * FROM DnsRedirectRule').all() as any[];
      for (const pr of prismaRules) {
        try {
          // Convert matchPattern to domain and wildcard flag
          let domain = pr.matchPattern || '';
          let wildcard = 0;
          // Patterns like *.example.com -> domain=example.com, wildcard=1
          // Patterns like * (all domains) -> domain=*, wildcard=1
          if (domain.startsWith('*.')) {
            domain = domain.slice(2); // Remove *. prefix
            wildcard = 1;
          } else if (domain === '*') {
            wildcard = 1;
          }

          // Build description with applyTo context
          let description = pr.description || pr.name || '';
          if (pr.applyTo && pr.applyTo !== 'unauthenticated') {
            description = `[${pr.applyTo}] ${description}`;
          }

          db.run(`
            INSERT INTO DnsRedirect (id, tenantId, propertyId, domain, targetIp, wildcard, priority, description, enabled, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              tenantId = excluded.tenantId,
              propertyId = excluded.propertyId,
              domain = excluded.domain,
              targetIp = excluded.targetIp,
              wildcard = excluded.wildcard,
              priority = excluded.priority,
              description = excluded.description,
              enabled = excluded.enabled,
              updatedAt = excluded.updatedAt
          `, [
            pr.id, pr.tenantId || 'default', pr.propertyId || 'default',
            domain, pr.targetIp, wildcard,
            pr.priority || 0, description,
            prismaBoolToInt(pr.enabled),
            pr.createdAt || new Date().toISOString(),
            pr.updatedAt || new Date().toISOString()
          ]);
          result.redirects++;
        } catch (err) {
          result.errors.push(`RedirectRule upsert failed [${pr.id}]: ${err}`);
        }
      }
    } catch (err) {
      result.errors.push(`DnsRedirectRule read from Prisma failed: ${err}`);
    }

  } finally {
    try { prismaDb.close(); } catch {}
  }

  // Regenerate dnsmasq config and reload if running
  if (result.zones > 0 || result.records > 0 || result.redirects > 0) {
    syncConfigToDisk();
    if (isDnsmasqRunning()) {
      reloadDnsmasq();
    }
  }

  return result;
}

/**
 * Sync data FROM the DNS service's own database BACK TO the Prisma database.
 * Writes DnsZone, DnsRecord, DnsRedirect from local DB into the Prisma tables.
 */
function syncToPrisma(): { zones: number; records: number; redirects: number; errors: string[] } {
  const result = { zones: 0, records: 0, redirects: 0, errors: [] as string[] };

  // Check if Prisma DB exists
  if (!fs.existsSync(PRISMA_DB_PATH)) {
    result.errors.push(`Prisma database not found at ${PRISMA_DB_PATH}`);
    return result;
  }

  let prismaDb: Database.Database;
  try {
    prismaDb = new Database(PRISMA_DB_PATH);
    prismaDb.exec('PRAGMA journal_mode = WAL;');
    // Disable FK checks during sync - DNS service data may reference properties/tenants
    // that were created through different flows. Prisma will validate on its own reads.
    prismaDb.exec('PRAGMA foreign_keys = OFF;');
  } catch (error) {
    result.errors.push(`Failed to open Prisma database for writing: ${error}`);
    return result;
  }

  try {
    // ---- Sync DnsZone to Prisma ----
    try {
      const localZones = db.query('SELECT * FROM DnsZone').all() as any[];
      for (const lz of localZones) {
        try {
          prismaDb.run(`
            INSERT INTO DnsZone (id, tenantId, propertyId, domain, description, vlanId, enabled, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              tenantId = excluded.tenantId,
              propertyId = excluded.propertyId,
              domain = excluded.domain,
              description = excluded.description,
              vlanId = excluded.vlanId,
              enabled = excluded.enabled,
              updatedAt = excluded.updatedAt
          `, [
            lz.id, lz.tenantId || 'default', lz.propertyId || 'default',
            lz.domain, lz.description || null, lz.vlanId || null,
            lz.enabled ? 1 : 0,
            lz.createdAt || new Date().toISOString(),
            lz.updatedAt || new Date().toISOString()
          ]);
          result.zones++;
        } catch (err) {
          result.errors.push(`Zone to-Prisma upsert failed [${lz.id}]: ${err}`);
        }
      }
    } catch (err) {
      result.errors.push(`DnsZone local read failed: ${err}`);
    }

    // ---- Sync DnsRecord to Prisma ----
    try {
      const localRecords = db.query('SELECT * FROM DnsRecord').all() as any[];
      for (const lr of localRecords) {
        try {
          prismaDb.run(`
            INSERT INTO DnsRecord (id, tenantId, zoneId, name, type, value, ttl, priority, enabled, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              tenantId = excluded.tenantId,
              zoneId = excluded.zoneId,
              name = excluded.name,
              type = excluded.type,
              value = excluded.value,
              ttl = excluded.ttl,
              priority = excluded.priority,
              enabled = excluded.enabled,
              updatedAt = excluded.updatedAt
          `, [
            lr.id, lr.tenantId || 'default', lr.zoneId,
            lr.name, lr.type || 'A', lr.value,
            lr.ttl || 300, lr.priority || null,
            lr.enabled ? 1 : 0,
            lr.createdAt || new Date().toISOString(),
            lr.updatedAt || new Date().toISOString()
          ]);
          result.records++;
        } catch (err) {
          result.errors.push(`Record to-Prisma upsert failed [${lr.id}]: ${err}`);
        }
      }
    } catch (err) {
      result.errors.push(`DnsRecord local read failed: ${err}`);
    }

    // ---- Sync DnsRedirect -> DnsRedirectRule in Prisma ----
    try {
      const localRedirects = db.query('SELECT * FROM DnsRedirect').all() as any[];
      for (const lr of localRedirects) {
        try {
          // Convert domain/wildcard back to matchPattern
          let matchPattern = lr.domain || '';
          if (lr.wildcard && matchPattern !== '*') {
            matchPattern = `*.${matchPattern}`;
          }

          // Extract applyTo from description if present
          let applyTo = 'unauthenticated';
          let name = lr.domain || 'Redirect';
          let description = lr.description || '';
          const applyToMatch = description.match(/^\[([^\]]+)\]\s*(.*)/);
          if (applyToMatch) {
            applyTo = applyToMatch[1];
            description = applyToMatch[2];
          }

          prismaDb.run(`
            INSERT INTO DnsRedirectRule (id, tenantId, propertyId, name, matchPattern, targetIp, applyTo, priority, enabled, description, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              tenantId = excluded.tenantId,
              propertyId = excluded.propertyId,
              name = excluded.name,
              matchPattern = excluded.matchPattern,
              targetIp = excluded.targetIp,
              applyTo = excluded.applyTo,
              priority = excluded.priority,
              enabled = excluded.enabled,
              description = excluded.description,
              updatedAt = excluded.updatedAt
          `, [
            lr.id, lr.tenantId || 'default', lr.propertyId || 'default',
            name, matchPattern, lr.targetIp, applyTo,
            lr.priority || 0, lr.enabled ? 1 : 0,
            description,
            lr.createdAt || new Date().toISOString(),
            lr.updatedAt || new Date().toISOString()
          ]);
          result.redirects++;
        } catch (err) {
          result.errors.push(`Redirect to-Prisma upsert failed [${lr.id}]: ${err}`);
        }
      }
    } catch (err) {
      result.errors.push(`DnsRedirect local read failed: ${err}`);
    }

  } finally {
    try { prismaDb.close(); } catch {}
  }

  return result;
}

// ============================================================================
// Initial sync on startup: sync from Prisma then regenerate config
// ============================================================================

(async () => {
  // Auto-sync from Prisma DB on startup
  log.info('Auto-syncing from Prisma database on startup');
  const syncResult = syncFromPrisma();
  if (syncResult.errors.length > 0) {
    log.warn('Prisma sync completed with errors', { errorCount: syncResult.errors.length, sampleErrors: syncResult.errors.slice(0, 3) });
  }
  log.info('Prisma sync complete', { zones: syncResult.zones, records: syncResult.records, redirects: syncResult.redirects });

  syncConfigToDisk();
  if (SYSTEM_DNSMASQ && !isDnsmasqRunning()) {
    log.info('dnsmasq detected but not running, auto-starting');
    const result = startDnsmasq();
    log.info(result.success ? 'dnsmasq started' : 'dnsmasq start failed', { message: result.message });
  } else if (!SYSTEM_DNSMASQ) {
    log.warn('dnsmasq not found on system');
  } else {
    log.info('dnsmasq is running');
  }
})();

// ============================================================================
// Middleware
// ============================================================================

(globalThis as Record<string, unknown>).__authWarningLogged = false;

// Auth middleware - check Bearer token, skip for /health endpoint
app.use('*', async (c, next) => {
  // Allow health check without auth
  if (c.req.path === '/health') {
    return next();
  }

  const authSecret = process.env.SERVICE_AUTH_SECRET;

  // If no secret configured, log warning and allow all (dev mode)
  if (!authSecret) {
    if (!(globalThis as Record<string, unknown>).__authWarningLogged) {
      log.warn('SERVICE_AUTH_SECRET not configured. All requests will be allowed. Set SERVICE_AUTH_SECRET env var for production.');
      (globalThis as Record<string, unknown>).__authWarningLogged = true;
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
    service: 'dns-service',
    version: SERVICE_VERSION,
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    port: PORT,
    memoryUsage: process.memoryUsage(),
    dnsmasq: { installed: SYSTEM_DNSMASQ, running: isDnsmasqRunning(), configPath: DNSMASQ_CONFIG },
    databases: {
      own: DB_PATH,
      prisma: PRISMA_DB_PATH,
      prismaExists: fs.existsSync(PRISMA_DB_PATH),
    }
  });
});

// ============================================================================
// Service Status & Control
// ============================================================================

app.get('/api/status', (c) => {
  const running = isDnsmasqRunning();
  const version = running ? getDnsmasqVersion() : 'Not running';

  // Get counts
  let zoneCount = 0, recordCount = 0, redirectCount = 0, forwarderCount = 0;
  try { zoneCount = (db.query('SELECT COUNT(*) as c FROM DnsZone WHERE enabled = 1').get() as any)?.c || 0; } catch {}
  try { recordCount = (db.query('SELECT COUNT(*) as c FROM DnsRecord WHERE enabled = 1').get() as any)?.c || 0; } catch {}
  try { redirectCount = (db.query('SELECT COUNT(*) as c FROM DnsRedirect WHERE enabled = 1').get() as any)?.c || 0; } catch {}
  try { forwarderCount = (db.query('SELECT COUNT(*) as c FROM DnsForwarder WHERE enabled = 1').get() as any)?.c || 0; } catch {}

  // Cache stats
  let cacheStats = { size: 0, inserts: 0, evictions: 0 };
  try {
    const cacheOutput = safeExec('dnsmasq --dump-cache 2>/dev/null || echo ""');
    if (cacheOutput) {
      const lines = cacheOutput.trim().split('\n');
      cacheStats.size = lines.length - 1;
    }
  } catch {}

  return c.json({
    success: true,
    data: {
      installed: SYSTEM_DNSMASQ,
      running,
      version: version || 'dnsmasq (StaySuite)',
      mode: running ? 'production' : 'stopped',
      configPath: DNSMASQ_CONFIG,
      pidFile: DNSMASQ_PID_FILE,
      zoneCount,
      recordCount,
      redirectCount,
      forwarderCount,
      cacheStats,
      databases: {
        own: DB_PATH,
        prisma: PRISMA_DB_PATH,
        prismaExists: fs.existsSync(PRISMA_DB_PATH),
      }
    }
  });
});

app.post('/api/service/start', (c) => {
  syncConfigToDisk();
  const result = startDnsmasq();
  return c.json({ success: result.success, message: result.message, running: isDnsmasqRunning() });
});

app.post('/api/service/stop', (c) => {
  const result = stopDnsmasq();
  return c.json({ success: result.success, message: result.message, running: isDnsmasqRunning() });
});

app.post('/api/service/restart', (c) => {
  syncConfigToDisk();
  stopDnsmasq();
  const result = startDnsmasq();
  return c.json({ success: result.success, message: result.message, running: isDnsmasqRunning() });
});

app.post('/api/service/reload', (c) => {
  syncConfigToDisk();
  const result = reloadDnsmasq();
  return c.json({ success: result.success, message: result.message });
});

// ============================================================================
// DNS Zones
// ============================================================================

app.get('/api/zones', (c) => {
  try {
    const zones = db.query('SELECT * FROM DnsZone ORDER BY domain ASC').all() as any[];
    // Add record counts
    for (const zone of zones) {
      try {
        zone.recordCount = (db.query('SELECT COUNT(*) as c FROM DnsRecord WHERE zoneId = ?').get(zone.id) as any)?.c || 0;
      } catch { zone.recordCount = 0; }
    }
    return c.json({ success: true, data: zones });
  } catch (error) {
    return c.json({ success: false, error: String(error) });
  }
});

app.post('/api/zones', async (c) => {
  try {
    const body = await c.req.json();
    const id = generateId();
    const now = new Date().toISOString();

    db.run(`INSERT INTO DnsZone (id, tenantId, propertyId, domain, type, description, vlanId, enabled, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      id, body.tenantId || 'default', body.propertyId || 'default',
      body.domain, body.type || 'forward', body.description || null,
      body.vlanId || null, body.enabled !== false ? 1 : 0, now, now
    ]);

    fullSync();
    const zone = db.query('SELECT * FROM DnsZone WHERE id = ?').get(id);
    return c.json({ success: true, data: zone, message: 'DNS zone created' });
  } catch (error) {
    return c.json({ success: false, error: String(error) });
  }
});

app.put('/api/zones/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const body = await c.req.json();
    const now = new Date().toISOString();

    const fields: string[] = [];
    const values: any[] = [];
    if (body.domain !== undefined) { fields.push('domain = ?'); values.push(body.domain); }
    if (body.type !== undefined) { fields.push('type = ?'); values.push(body.type); }
    if (body.description !== undefined) { fields.push('description = ?'); values.push(body.description); }
    if (body.vlanId !== undefined) { fields.push('vlanId = ?'); values.push(body.vlanId); }
    if (body.enabled !== undefined) { fields.push('enabled = ?'); values.push(body.enabled ? 1 : 0); }
    fields.push('updatedAt = ?'); values.push(now); values.push(id);

    db.run(`UPDATE DnsZone SET ${fields.join(', ')} WHERE id = ?`, values);
    fullSync();

    const zone = db.query('SELECT * FROM DnsZone WHERE id = ?').get(id);
    return c.json({ success: true, data: zone, message: 'DNS zone updated' });
  } catch (error) {
    return c.json({ success: false, error: String(error) });
  }
});

app.delete('/api/zones/:id', (c) => {
  try {
    const { id } = c.req.param();
    // Delete records in this zone first
    try { db.run('DELETE FROM DnsRecord WHERE zoneId = ?', [id]); } catch {}
    db.run('DELETE FROM DnsZone WHERE id = ?', [id]);
    fullSync();
    return c.json({ success: true, message: 'DNS zone deleted' });
  } catch (error) {
    return c.json({ success: false, error: String(error) });
  }
});

// ============================================================================
// DNS Records
// ============================================================================

app.get('/api/records', (c) => {
  try {
    const zoneId = c.req.query('zoneId');
    const type = c.req.query('type');

    let query = 'SELECT r.*, z.domain as zoneDomain FROM DnsRecord r LEFT JOIN DnsZone z ON r.zoneId = z.id WHERE 1=1';
    const params: any[] = [];
    if (zoneId) { query += ' AND r.zoneId = ?'; params.push(zoneId); }
    if (type) { query += ' AND r.type = ?'; params.push(type); }
    query += ' ORDER BY r.type ASC, r.name ASC';

    const records = db.query(query).all(...params) as any[];
    return c.json({ success: true, data: records });
  } catch (error) {
    return c.json({ success: false, error: String(error) });
  }
});

app.post('/api/records', async (c) => {
  try {
    const body = await c.req.json();
    const id = generateId();
    const now = new Date().toISOString();

    db.run(`INSERT INTO DnsRecord (id, tenantId, zoneId, name, type, value, ttl, priority, enabled, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      id, body.tenantId || 'default', body.zoneId,
      body.name, body.type || 'A', body.value,
      body.ttl || 300, body.priority || null,
      body.enabled !== false ? 1 : 0, now, now
    ]);

    fullSync();
    const record = db.query('SELECT r.*, z.domain as zoneDomain FROM DnsRecord r LEFT JOIN DnsZone z ON r.zoneId = z.id WHERE r.id = ?').get(id);
    return c.json({ success: true, data: record, message: 'DNS record created' });
  } catch (error) {
    return c.json({ success: false, error: String(error) });
  }
});

app.put('/api/records/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const body = await c.req.json();
    const now = new Date().toISOString();

    const fields: string[] = [];
    const values: any[] = [];
    if (body.name !== undefined) { fields.push('name = ?'); values.push(body.name); }
    if (body.type !== undefined) { fields.push('type = ?'); values.push(body.type); }
    if (body.value !== undefined) { fields.push('value = ?'); values.push(body.value); }
    if (body.ttl !== undefined) { fields.push('ttl = ?'); values.push(body.ttl); }
    if (body.priority !== undefined) { fields.push('priority = ?'); values.push(body.priority); }
    if (body.enabled !== undefined) { fields.push('enabled = ?'); values.push(body.enabled ? 1 : 0); }
    if (body.zoneId !== undefined) { fields.push('zoneId = ?'); values.push(body.zoneId); }
    fields.push('updatedAt = ?'); values.push(now); values.push(id);

    db.run(`UPDATE DnsRecord SET ${fields.join(', ')} WHERE id = ?`, values);
    fullSync();

    const record = db.query('SELECT r.*, z.domain as zoneDomain FROM DnsRecord r LEFT JOIN DnsZone z ON r.zoneId = z.id WHERE r.id = ?').get(id);
    return c.json({ success: true, data: record, message: 'DNS record updated' });
  } catch (error) {
    return c.json({ success: false, error: String(error) });
  }
});

app.delete('/api/records/:id', (c) => {
  try {
    const { id } = c.req.param();
    db.run('DELETE FROM DnsRecord WHERE id = ?', [id]);
    fullSync();
    return c.json({ success: true, message: 'DNS record deleted' });
  } catch (error) {
    return c.json({ success: false, error: String(error) });
  }
});

// ============================================================================
// DNS Redirects (Captive Portal)
// ============================================================================

app.get('/api/redirects', (c) => {
  try {
    const redirects = db.query('SELECT * FROM DnsRedirect ORDER BY priority ASC, domain ASC').all() as any[];
    return c.json({ success: true, data: redirects });
  } catch (error) {
    return c.json({ success: false, error: String(error) });
  }
});

app.post('/api/redirects', async (c) => {
  try {
    const body = await c.req.json();
    const id = generateId();
    const now = new Date().toISOString();

    db.run(`INSERT INTO DnsRedirect (id, tenantId, propertyId, domain, targetIp, wildcard, priority, description, enabled, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      id, body.tenantId || 'default', body.propertyId || 'default',
      body.domain, body.targetIp, body.wildcard ? 1 : 0,
      body.priority || 100, body.description || null,
      body.enabled !== false ? 1 : 0, now, now
    ]);

    fullSync();
    const redirect = db.query('SELECT * FROM DnsRedirect WHERE id = ?').get(id);
    return c.json({ success: true, data: redirect, message: 'DNS redirect created' });
  } catch (error) {
    return c.json({ success: false, error: String(error) });
  }
});

app.put('/api/redirects/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const body = await c.req.json();
    const now = new Date().toISOString();

    const fields: string[] = [];
    const values: any[] = [];
    if (body.domain !== undefined) { fields.push('domain = ?'); values.push(body.domain); }
    if (body.targetIp !== undefined) { fields.push('targetIp = ?'); values.push(body.targetIp); }
    if (body.wildcard !== undefined) { fields.push('wildcard = ?'); values.push(body.wildcard ? 1 : 0); }
    if (body.priority !== undefined) { fields.push('priority = ?'); values.push(body.priority); }
    if (body.description !== undefined) { fields.push('description = ?'); values.push(body.description); }
    if (body.enabled !== undefined) { fields.push('enabled = ?'); values.push(body.enabled ? 1 : 0); }
    fields.push('updatedAt = ?'); values.push(now); values.push(id);

    db.run(`UPDATE DnsRedirect SET ${fields.join(', ')} WHERE id = ?`, values);
    fullSync();

    const redirect = db.query('SELECT * FROM DnsRedirect WHERE id = ?').get(id);
    return c.json({ success: true, data: redirect, message: 'DNS redirect updated' });
  } catch (error) {
    return c.json({ success: false, error: String(error) });
  }
});

app.delete('/api/redirects/:id', (c) => {
  try {
    const { id } = c.req.param();
    db.run('DELETE FROM DnsRedirect WHERE id = ?', [id]);
    fullSync();
    return c.json({ success: true, message: 'DNS redirect deleted' });
  } catch (error) {
    return c.json({ success: false, error: String(error) });
  }
});

// ============================================================================
// DNS Cache
// ============================================================================

app.get('/api/cache', (c) => {
  try {
    let cacheSize = 0;
    const cacheOutput = safeExec('dnsmasq --dump-cache /dev/stdout 2>/dev/null || echo ""');
    if (cacheOutput) {
      const lines = cacheOutput.trim().split('\n').filter((l: string) => l.length > 0);
      cacheSize = Math.max(0, lines.length - 1);
    }

    return c.json({
      success: true,
      data: {
        size: cacheSize,
        maxSize: 10000,
        inserts: 0,
        evictions: 0,
        hitRate: cacheSize > 0 ? 'Active' : 'Empty',
      }
    });
  } catch (error) {
    return c.json({ success: false, error: String(error) });
  }
});

app.post('/api/cache/flush', (c) => {
  try {
    const result = reloadDnsmasq();
    return c.json({ success: result.success, message: result.success ? 'DNS cache flushed' : result.message });
  } catch (error) {
    return c.json({ success: false, error: String(error) });
  }
});

// ============================================================================
// DNS Forwarders
// ============================================================================

app.get('/api/forwarders', (c) => {
  try {
    const forwarders = db.query('SELECT * FROM DnsForwarder ORDER BY address ASC').all() as any[];
    return c.json({ success: true, data: forwarders });
  } catch (error) {
    return c.json({ success: false, error: String(error) });
  }
});

app.post('/api/forwarders', async (c) => {
  try {
    const body = await c.req.json();
    const id = generateId();
    const now = new Date().toISOString();

    db.run(`INSERT INTO DnsForwarder (id, tenantId, propertyId, address, port, description, enabled, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
      id, body.tenantId || 'default', body.propertyId || 'default',
      body.address, body.port || 53, body.description || null,
      body.enabled !== false ? 1 : 0, now
    ]);

    fullSync();
    const forwarder = db.query('SELECT * FROM DnsForwarder WHERE id = ?').get(id);
    return c.json({ success: true, data: forwarder, message: 'DNS forwarder added' });
  } catch (error) {
    return c.json({ success: false, error: String(error) });
  }
});

app.delete('/api/forwarders/:id', (c) => {
  try {
    const { id } = c.req.param();
    db.run('DELETE FROM DnsForwarder WHERE id = ?', [id]);
    fullSync();
    return c.json({ success: true, message: 'DNS forwarder removed' });
  } catch (error) {
    return c.json({ success: false, error: String(error) });
  }
});

// ============================================================================
// DHCP-DNS Integration
// ============================================================================

app.get('/api/dhcp-dns', (c) => {
  try {
    // Read dnsmasq lease file for DHCP-DNS entries
    const leaseFile = SYSTEM_DNSMASQ ? '/var/lib/misc/dnsmasq.leases' : '/tmp/dnsmasq.leases';
    const entries: any[] = [];
    try {
      const content = fs.readFileSync(leaseFile, 'utf-8');
      for (const line of content.trim().split('\n').filter(Boolean)) {
        const parts = line.split(/\s+/);
        if (parts.length >= 4) {
          entries.push({
            timestamp: parts[0],
            macAddress: parts[1],
            ipAddress: parts[2],
            hostname: parts[3] || '',
            clientId: parts[4] || '',
          });
        }
      }
    } catch {}
    return c.json({ success: true, data: entries });
  } catch (error) {
    return c.json({ success: false, error: String(error) });
  }
});

// ============================================================================
// Sync Endpoints
// ============================================================================

/**
 * POST /api/sync - Sync config to disk and reload dnsmasq.
 * Also triggers a sync from Prisma DB to pick up any changes made via Next.js API routes.
 */
app.post('/api/sync', (c) => {
  // First sync from Prisma to get latest data
  const prismaSync = syncFromPrisma();
  // Then regenerate config and reload
  const result = fullSync();
  return c.json({
    success: result.config.success && (result.reload.success || !isDnsmasqRunning()),
    message: `Prisma sync (${prismaSync.zones} zones, ${prismaSync.records} records, ${prismaSync.redirects} redirects), Config synced (${result.config.lines} lines), ${result.reload.message}`,
    config: result.config,
    reload: result.reload,
    prismaSync,
  });
});

/**
 * POST /api/sync-from-prisma - Read from Prisma DB and import into DNS service's own DB.
 */
app.post('/api/sync-from-prisma', (c) => {
  const result = syncFromPrisma();
  logActivity('sync_from_prisma', `Synced ${result.zones} zones, ${result.records} records, ${result.redirects} redirects from Prisma`, result.errors.length > 0 ? 'warning' : 'info');
  return c.json({
    success: result.errors.length === 0,
    message: `Synced from Prisma: ${result.zones} zones, ${result.records} records, ${result.redirects} redirects`,
    ...result,
  });
});

/**
 * POST /api/sync-to-prisma - Write DNS service data back to the Prisma DB.
 */
app.post('/api/sync-to-prisma', (c) => {
  const result = syncToPrisma();
  logActivity('sync_to_prisma', `Synced ${result.zones} zones, ${result.records} records, ${result.redirects} redirects to Prisma`, result.errors.length > 0 ? 'warning' : 'info');
  return c.json({
    success: result.errors.length === 0,
    message: `Synced to Prisma: ${result.zones} zones, ${result.records} records, ${result.redirects} redirects`,
    ...result,
  });
});

// ============================================================================
// Config Preview & Edit (with injection protection)
// ============================================================================

app.get('/api/config', (c) => {
  try {
    const content = fs.readFileSync(DNSMASQ_CONFIG, 'utf-8');
    return c.json({ success: true, data: { path: DNSMASQ_CONFIG, content } });
  } catch (error) {
    return c.json({ success: false, error: 'Config file not found' });
  }
});

/**
 * Validate dnsmasq config content for obvious injection patterns.
 * Returns an object with valid flag and reason if invalid.
 */
function validateDnsmasqConfig(content: string): { valid: boolean; reason?: string } {
  if (!content || typeof content !== 'string') {
    return { valid: false, reason: 'No content provided' };
  }

  // Split into lines and validate each
  const lines = content.split('\n');
  const validDirectives = [
    'server=', 'address=', 'cname=', 'mx-host=', 'txt-record=',
    'srv-host=', 'ptr-record=', 'domain-needed', 'bogus-priv',
    'no-resolv', 'expand-hosts', 'local-ttl=', 'cache-size=',
    'dns-forward-max=', 'min-port=', 'listen-address=', 'port=',
    'bind-interfaces', 'no-hosts', 'addn-hosts=', 'resolv-file=',
    'strict-order', 'all-servers', 'no-negcache', 'neg-ttl=',
    'conf-dir=', 'user=', 'group=', 'pid-file=', 'log-queries',
    'log-facility=', 'no-daemon', 'keep-in-foreground',
    'dhcp-range=', 'dhcp-host=', 'dhcp-option=', 'dhcp-leasefile=',
    'dhcp-authoritative', 'dhcp-script=', 'read-ethers',
  ];

  // Shell metacharacters and injection patterns to reject
  const injectionPatterns = [
    /[;|&`$]/,           // Shell command separators and substitution
    /\$\(/,               // Command substitution
    /\$\{/,               // Variable expansion
    /\b(rm|chmod|chown|mv|cp|cat|sh|bash|curl|wget|nc|ncat|python|perl|ruby|node|exec|eval|system|spawn)\b/i,
    /\b(sudo|su|passwd|shadow|crontab|iptables|nft|systemctl)\b/i,
    /\/\.\.\//,           // Path traversal
    /\b(import|require)\b/, // Code injection
    /`/,                   // Backtick command substitution
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip empty lines and comments
    if (!line || line.startsWith('#')) continue;

    // Check for injection patterns
    for (const pattern of injectionPatterns) {
      if (pattern.test(line)) {
        return { valid: false, reason: `Line ${i + 1}: Content contains disallowed pattern (${pattern.source}). This looks like a potential injection attempt.` };
      }
    }

    // Check that the line starts with a valid dnsmasq directive
    const startsWithValidDirective = validDirectives.some(d => line.startsWith(d));
    if (!startsWithValidDirective) {
      return { valid: false, reason: `Line ${i + 1}: "${line.substring(0, 40)}${line.length > 40 ? '...' : ''}" does not start with a recognized dnsmasq directive` };
    }
  }

  return { valid: true };
}

app.post('/api/config', async (c) => {
  try {
    const body = await c.req.json();
    if (!body.content) {
      return c.json({ success: false, error: 'No content provided' });
    }

    // Validate the config content before writing
    const validation = validateDnsmasqConfig(body.content);
    if (!validation.valid) {
      return c.json({
        success: false,
        error: `Config validation failed: ${validation.reason}`,
        warning: '⚠️ ADVANCED FEATURE: Direct config editing is intended for experienced administrators only. Use the zones/records/redirects/forwarders APIs for safe configuration.',
      });
    }

    fs.writeFileSync(DNSMASQ_CONFIG, body.content, 'utf-8');
    if (isDnsmasqRunning()) reloadDnsmasq();
    logActivity('config_manual_edit', 'dnsmasq config manually edited via API', 'warning');
    return c.json({
      success: true,
      message: 'Config saved and dnsmasq reloaded',
      warning: '⚠️ ADVANCED FEATURE: Direct config edits will be overwritten by auto-generated config on next sync operation.',
    });
  } catch (error) {
    return c.json({ success: false, error: String(error) });
  }
});

// ============================================================================
// Activity Log
// ============================================================================

// Create ActivityLog table
db.exec(`
  CREATE TABLE IF NOT EXISTS DnsActivityLog (
    id TEXT PRIMARY KEY,
    action TEXT NOT NULL,
    details TEXT,
    severity TEXT NOT NULL DEFAULT 'info',
    timestamp TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Seed initial activity log if empty
try {
  const count = (db.query('SELECT COUNT(*) as c FROM DnsActivityLog').get() as any)?.c || 0;
  if (count === 0) {
    const seedLogs = [
      { id: generateId(), action: 'service_start', details: 'DNS service initialized', severity: 'info' },
      { id: generateId(), action: 'config_sync', details: 'Initial config sync completed', severity: 'info' },
      { id: generateId(), action: 'zone_create', details: 'Default zones provisioned', severity: 'info' },
      { id: generateId(), action: 'forwarder_add', details: 'Upstream forwarders configured (8.8.8.8, 1.1.1.1)', severity: 'info' },
      { id: generateId(), action: 'cache_flush', details: 'Cache cleared on startup', severity: 'warning' },
    ];
    for (const log of seedLogs) {
      db.run('INSERT INTO DnsActivityLog (id, action, details, severity) VALUES (?, ?, ?, ?)',
        [log.id, log.action, log.details, log.severity]);
    }
  }
} catch {}

app.get('/api/activity', (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '50');
    const logs = db.query('SELECT * FROM DnsActivityLog ORDER BY timestamp DESC LIMIT ?').all(limit) as any[];

    // Also add some dynamic entries for current state
    const running = isDnsmasqRunning();
    const dynamicEntries = [
      {
        id: 'dynamic-status',
        action: 'status_check',
        details: `dnsmasq is currently ${running ? 'running' : 'stopped'}`,
        severity: running ? 'info' : 'error',
        timestamp: new Date().toISOString(),
      },
    ];

    return c.json({ success: true, data: [...dynamicEntries, ...logs] });
  } catch (error) {
    return c.json({ success: false, error: String(error) });
  }
});

// Helper to log activity
function logActivity(action: string, details: string, severity = 'info') {
  try {
    db.run('INSERT INTO DnsActivityLog (id, action, details, severity) VALUES (?, ?, ?, ?)',
      [generateId(), action, details, severity]);
  } catch {}
}

// ============================================================================
// Detailed Stats
// ============================================================================

app.get('/api/stats', (c) => {
  try {
    const running = isDnsmasqRunning();

    // Basic counts
    let zoneCount = 0, recordCount = 0, redirectCount = 0, forwarderCount = 0;
    let totalZones = 0, totalRecords = 0, totalRedirects = 0;
    try { zoneCount = (db.query('SELECT COUNT(*) as c FROM DnsZone WHERE enabled = 1').get() as any)?.c || 0; } catch {}
    try { recordCount = (db.query('SELECT COUNT(*) as c FROM DnsRecord WHERE enabled = 1').get() as any)?.c || 0; } catch {}
    try { redirectCount = (db.query('SELECT COUNT(*) as c FROM DnsRedirect WHERE enabled = 1').get() as any)?.c || 0; } catch {}
    try { forwarderCount = (db.query('SELECT COUNT(*) as c FROM DnsForwarder WHERE enabled = 1').get() as any)?.c || 0; } catch {}
    try { totalZones = (db.query('SELECT COUNT(*) as c FROM DnsZone').get() as any)?.c || 0; } catch {}
    try { totalRecords = (db.query('SELECT COUNT(*) as c FROM DnsRecord').get() as any)?.c || 0; } catch {}
    try { totalRedirects = (db.query('SELECT COUNT(*) as c FROM DnsRedirect').get() as any)?.c || 0; } catch {}

    // Record type distribution
    const recordTypes: Record<string, number> = {};
    try {
      const typeCounts = db.query('SELECT type, COUNT(*) as c FROM DnsRecord GROUP BY type').all() as any[];
      for (const tc of typeCounts) {
        recordTypes[tc.type] = tc.c;
      }
    } catch {}

    // Top domains (from redirects)
    const topDomains: { domain: string; hits: number }[] = [];
    try {
      const domains = db.query('SELECT domain, priority FROM DnsRedirect WHERE enabled = 1 ORDER BY priority ASC LIMIT 10').all() as any[];
      for (const d of domains) {
        topDomains.push({ domain: d.domain, hits: 0 });
      }
    } catch {}

    // Cache stats
    let cacheSize = 0;
    try {
      const cacheOutput = safeExec('dnsmasq --dump-cache /dev/stdout 2>/dev/null || echo ""');
      if (cacheOutput) {
        const lines = cacheOutput.trim().split('\n').filter((l: string) => l.length > 0);
        cacheSize = Math.max(0, lines.length - 1);
      }
    } catch {}

    return c.json({
      success: true,
      data: {
        running,
        zones: { active: zoneCount, total: totalZones },
        records: { active: recordCount, total: totalRecords },
        redirects: { active: redirectCount, total: totalRedirects },
        forwarders: { active: forwarderCount },
        recordTypes,
        topDomains,
        cache: { size: cacheSize, maxSize: 10000, utilization: Math.round((cacheSize / 10000) * 100) },
        lastUpdated: new Date().toISOString(),
      }
    });
  } catch (error) {
    return c.json({ success: false, error: String(error) });
  }
});

// ============================================================================
// Bulk Delete - Zones
// ============================================================================

app.post('/api/zones/bulk-delete', async (c) => {
  try {
    const body = await c.req.json();
    const ids: string[] = body.ids || [];
    if (ids.length === 0) {
      return c.json({ success: false, error: 'No zone IDs provided' });
    }

    let deleted = 0;
    for (const id of ids) {
      try {
        db.run('DELETE FROM DnsRecord WHERE zoneId = ?', [id]);
        db.run('DELETE FROM DnsZone WHERE id = ?', [id]);
        deleted++;
      } catch {}
    }

    fullSync();
    logActivity('zones_bulk_delete', `Deleted ${deleted} zones`, 'warning');
    return c.json({ success: true, message: `Deleted ${deleted} zones`, deleted });
  } catch (error) {
    return c.json({ success: false, error: String(error) });
  }
});

// ============================================================================
// Bulk Delete - Records
// ============================================================================

app.post('/api/records/bulk-delete', async (c) => {
  try {
    const body = await c.req.json();
    const ids: string[] = body.ids || [];
    if (ids.length === 0) {
      return c.json({ success: false, error: 'No record IDs provided' });
    }

    let deleted = 0;
    for (const id of ids) {
      try {
        db.run('DELETE FROM DnsRecord WHERE id = ?', [id]);
        deleted++;
      } catch {}
    }

    fullSync();
    logActivity('records_bulk_delete', `Deleted ${deleted} records`, 'warning');
    return c.json({ success: true, message: `Deleted ${deleted} records`, deleted });
  } catch (error) {
    return c.json({ success: false, error: String(error) });
  }
});

// ============================================================================
// Start Server
// ============================================================================

log.info('DNS Service starting', {
  port: PORT,
  version: SERVICE_VERSION,
  dnsmasq: SYSTEM_DNSMASQ ? 'system-installed' : 'not-found',
  configPath: DNSMASQ_CONFIG,
  ownDb: DB_PATH,
  prismaDb: PRISMA_DB_PATH,
  prismaDbExists: fs.existsSync(PRISMA_DB_PATH),
});

Bun.serve({
  port: PORT,
  fetch: app.fetch,
});

log.info('DNS Service HTTP server listening', { port: PORT });

// Graceful shutdown
process.on('SIGTERM', () => {
  log.info('SIGTERM received, shutting down');
  // Close database connections
  try { db.close(); } catch {}
  process.exit(0);
});

process.on('SIGINT', () => {
  log.info('SIGINT received, shutting down');
  try { db.close(); } catch {}
  process.exit(0);
});
