/**
 * FreeRADIUS Management Service for StaySuite
 *
 * Provides REST API for managing FreeRADIUS server:
 * - NAS Client management (routers, access points) — persisted to SQLite
 * - User management (radcheck, radreply) — persisted to SQLite
 * - Group management (radgroupcheck, radgroupreply) — persisted to SQLite
 * - Configuration management with file sync
 * - Service status and control
 * - RADIUS connectivity testing via radtest
 *
 * Port: 3010
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import Database from 'bun:sqlite';
import { createLogger } from '../shared/logger';

const execAsync = promisify(exec);

const app = new Hono();
const PORT = 3010;
const SERVICE_VERSION = '1.0.0';
const log = createLogger('freeradius-service');
const startTime = Date.now();

// FreeRADIUS configuration paths
const FREERADIUS_CONFIG_PATH = process.env.FREERADIUS_CONFIG_PATH || '/etc/freeradius';
const FREERADIUS_CLIENTS_PATH = path.join(FREERADIUS_CONFIG_PATH, 'clients.conf');
const FREERADIUS_USERS_PATH = path.join(FREERADIUS_CONFIG_PATH, 'users');
const FREERADIUS_MODS_ENABLED_PATH = path.join(FREERADIUS_CONFIG_PATH, 'mods-enabled');
const FREERADIUS_SITES_ENABLED_PATH = path.join(FREERADIUS_CONFIG_PATH, 'sites-enabled');

// Database path for SQLite-based FreeRADIUS (if using SQL module)
const DB_PATH = process.env.FREERADIUS_DB_PATH || '/var/lib/freeradius/radius.db';

// ============================================================================
// SQLite Persistence
// ============================================================================

const SQLITE_DB_PATH = process.env.FREERADIUS_SERVICE_DB_PATH || '/home/z/my-project/db/freeradius-service.db';

// Ensure the db directory exists (sync to avoid top-level await issues with PM2)
const dbDir = path.dirname(SQLITE_DB_PATH);
try {
  fsSync.mkdirSync(dbDir, { recursive: true });
} catch {
  // directory may already exist
}

const db = new Database(SQLITE_DB_PATH, { create: true });
db.exec('PRAGMA journal_mode=WAL;');
db.exec('PRAGMA foreign_keys=ON;');

// Auto-create tables on first start
db.exec(`
  CREATE TABLE IF NOT EXISTS nas_clients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    shared_secret TEXT NOT NULL,
    shortname TEXT,
    type TEXT NOT NULL DEFAULT 'other',
    auth_port INTEGER NOT NULL DEFAULT 1812,
    coa_port INTEGER NOT NULL DEFAULT 3799,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS radius_users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    group_name TEXT,
    attributes TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS radius_groups (
    name TEXT PRIMARY KEY,
    check_attributes TEXT NOT NULL DEFAULT '{}',
    reply_attributes TEXT NOT NULL DEFAULT '{}'
  );
`);

// ============================================================================
// Types
// ============================================================================

interface NASClient {
  id: string;
  name: string;
  ipAddress: string;
  sharedSecret: string;
  shortname?: string;
  type: string;
  ports: {
    auth: number;
    coa: number;
  };
  createdAt: string;
  updatedAt: string;
}

interface RADIUSUser {
  id: string;
  username: string;
  password: string;
  group?: string;
  attributes: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

interface RADIUSGroup {
  name: string;
  checkAttributes: Record<string, string>;
  replyAttributes: Record<string, string>;
}

// In-memory state for service status only
let serviceStatus: 'running' | 'stopped' | 'unknown' = 'unknown';

// ============================================================================
// SQLite Helper Functions
// ============================================================================

function rowToNASClient(row: Record<string, unknown>): NASClient {
  return {
    id: row.id as string,
    name: row.name as string,
    ipAddress: row.ip_address as string,
    sharedSecret: row.shared_secret as string,
    shortname: (row.shortname as string) || undefined,
    type: row.type as string,
    ports: {
      auth: row.auth_port as number,
      coa: row.coa_port as number,
    },
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToRADIUSUser(row: Record<string, unknown>): RADIUSUser {
  const attrsRaw = row.attributes as string;
  let attributes: Record<string, string> = {};
  try {
    attributes = JSON.parse(attrsRaw || '{}');
  } catch {
    attributes = {};
  }
  return {
    id: row.id as string,
    username: row.username as string,
    password: row.password as string,
    group: (row.group_name as string) || undefined,
    attributes,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToRADIUSGroup(row: Record<string, unknown>): RADIUSGroup {
  const checkRaw = row.check_attributes as string;
  const replyRaw = row.reply_attributes as string;
  let checkAttributes: Record<string, string> = {};
  let replyAttributes: Record<string, string> = {};
  try {
    checkAttributes = JSON.parse(checkRaw || '{}');
  } catch {
    checkAttributes = {};
  }
  try {
    replyAttributes = JSON.parse(replyRaw || '{}');
  } catch {
    replyAttributes = {};
  }
  return {
    name: row.name as string,
    checkAttributes,
    replyAttributes,
  };
}

function getAllNASClients(): NASClient[] {
  const rows = db.query('SELECT * FROM nas_clients ORDER BY created_at DESC').all() as Record<string, unknown>[];
  return rows.map(rowToNASClient);
}

function getNASClientById(id: string): NASClient | null {
  const row = db.query('SELECT * FROM nas_clients WHERE id = ?').get(id) as Record<string, unknown> | null;
  return row ? rowToNASClient(row) : null;
}

function createNASClient(client: NASClient): void {
  db.query(
    `INSERT INTO nas_clients (id, name, ip_address, shared_secret, shortname, type, auth_port, coa_port, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    client.id, client.name, client.ipAddress, client.sharedSecret,
    client.shortname || null, client.type, client.ports.auth, client.ports.coa,
    client.createdAt, client.updatedAt
  );
}

function updateNASClient(id: string, updates: Partial<NASClient>): NASClient | null {
  const existing = getNASClientById(id);
  if (!existing) return null;

  const updated: NASClient = {
    ...existing,
    ...updates,
    ports: {
      auth: updates.ports?.auth ?? existing.ports.auth,
      coa: updates.ports?.coa ?? existing.ports.coa,
    },
    updatedAt: new Date().toISOString(),
  };

  db.query(
    `UPDATE nas_clients SET name=?, ip_address=?, shared_secret=?, shortname=?, type=?, auth_port=?, coa_port=?, updated_at=?
     WHERE id=?`
  ).run(
    updated.name, updated.ipAddress, updated.sharedSecret,
    updated.shortname || null, updated.type, updated.ports.auth, updated.ports.coa,
    updated.updatedAt, id
  );
  return updated;
}

function deleteNASClient(id: string): boolean {
  const result = db.query('DELETE FROM nas_clients WHERE id = ?').run(id);
  return result.changes > 0;
}

function getAllRADIUSUsers(): RADIUSUser[] {
  const rows = db.query('SELECT * FROM radius_users ORDER BY created_at DESC').all() as Record<string, unknown>[];
  return rows.map(rowToRADIUSUser);
}

function getRADIUSUserById(id: string): RADIUSUser | null {
  const row = db.query('SELECT * FROM radius_users WHERE id = ?').get(id) as Record<string, unknown> | null;
  return row ? rowToRADIUSUser(row) : null;
}

function createRADIUSUser(user: RADIUSUser): void {
  db.query(
    `INSERT INTO radius_users (id, username, password, group_name, attributes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    user.id, user.username, user.password, user.group || null,
    JSON.stringify(user.attributes), user.createdAt, user.updatedAt
  );
}

function updateRADIUSUser(id: string, updates: Partial<RADIUSUser>): RADIUSUser | null {
  const existing = getRADIUSUserById(id);
  if (!existing) return null;

  const updated: RADIUSUser = {
    ...existing,
    ...updates,
    attributes: updates.attributes ?? existing.attributes,
    updatedAt: new Date().toISOString(),
  };

  db.query(
    `UPDATE radius_users SET username=?, password=?, group_name=?, attributes=?, updated_at=?
     WHERE id=?`
  ).run(
    updated.username, updated.password, updated.group || null,
    JSON.stringify(updated.attributes), updated.updatedAt, id
  );
  return updated;
}

function deleteRADIUSUser(id: string): boolean {
  const result = db.query('DELETE FROM radius_users WHERE id = ?').run(id);
  return result.changes > 0;
}

function getAllRADIUSGroups(): RADIUSGroup[] {
  const rows = db.query('SELECT * FROM radius_groups ORDER BY name ASC').all() as Record<string, unknown>[];
  return rows.map(rowToRADIUSGroup);
}

function createRADIUSGroup(group: RADIUSGroup): void {
  db.query(
    `INSERT INTO radius_groups (name, check_attributes, reply_attributes) VALUES (?, ?, ?)`
  ).run(group.name, JSON.stringify(group.checkAttributes), JSON.stringify(group.replyAttributes));
}

function deleteRADIUSGroup(name: string): boolean {
  const result = db.query('DELETE FROM radius_groups WHERE name = ?').run(name);
  return result.changes > 0;
}

// ============================================================================
// Auth Middleware
// ============================================================================

const AUTH_SECRET = process.env.FREERADIUS_SERVICE_AUTH_SECRET || '';

if (!AUTH_SECRET) {
  log.warn('No FREERADIUS_SERVICE_AUTH_SECRET set - API is open (dev mode). Set env var to enable authentication.');
}

app.use('*', cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Auth middleware — check Bearer token on all /api/* routes except /health
app.use('/api/*', async (c, next) => {
  // If no secret configured, allow access (dev mode) with warning
  if (!AUTH_SECRET) {
    await next();
    return;
  }

  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Missing or invalid Authorization header. Use: Bearer <token>' }, 401);
  }

  const token = authHeader.slice(7);
  if (token !== AUTH_SECRET) {
    return c.json({ success: false, error: 'Invalid authentication token' }, 401);
  }

  await next();
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if FreeRADIUS is installed and running
 */
async function checkFreeRADIUSStatus(): Promise<{
  installed: boolean;
  running: boolean;
  version?: string;
  error?: string;
}> {
  try {
    const { stdout: whichOutput } = await execAsync('which freeradius || which radiusd || echo "not_found"');

    if (whichOutput.trim() === 'not_found') {
      return {
        installed: false,
        running: false,
        error: 'FreeRADIUS is not installed on this system'
      };
    }

    let version = '';
    try {
      const { stdout } = await execAsync('freeradius -v 2>&1 | head -1 || radiusd -v 2>&1 | head -1');
      version = stdout.trim();
    } catch {
      version = 'Unknown';
    }

    try {
      const { stdout } = await execAsync('ps aux | grep -E "[f]reeradius|[r]adiusd" | head -1');
      const running = stdout.trim().length > 0;
      serviceStatus = running ? 'running' : 'stopped';
      return { installed: true, running, version };
    } catch {
      serviceStatus = 'stopped';
      return { installed: true, running: false, version };
    }
  } catch (error) {
    return {
      installed: false,
      running: false,
      error: String(error)
    };
  }
}

/**
 * Generate a random shared secret (cryptographically secure)
 */
function generateSharedSecret(length: number = 32): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(bytes[i] % chars.length);
  }
  return result;
}

/**
 * Generate a unique ID
 */
function generateId(prefix: string = 'nas'): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  const rand = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${prefix}_${Date.now()}_${rand}`;
}

/**
 * StaySuite managed section markers for clients.conf
 */
const STAYSUITE_CLIENT_BEGIN = '# >>>>>> StaySuite managed NAS clients - DO NOT EDIT BETWEEN MARKERS <<<<<<';
const STAYSUITE_CLIENT_END = '# >>>>>> End StaySuite managed NAS clients <<<<<<';

/**
 * Write all NAS clients to FreeRADIUS clients.conf
 * Uses section markers so we only overwrite our managed section
 */
async function writeAllNASClientsToConf(): Promise<boolean> {
  try {
    const clients = getAllNASClients();

    // Build our managed section content
    const managedLines: string[] = [STAYSUITE_CLIENT_BEGIN];
    for (const client of clients) {
      managedLines.push('');
      managedLines.push(`# NAS Client: ${client.name}`);
      managedLines.push(`# Created: ${client.createdAt}`);
      managedLines.push(`client ${client.shortname || client.name.replace(/\s+/g, '_')} {`);
      managedLines.push(`    ipaddr = ${client.ipAddress}`);
      managedLines.push(`    secret = "${client.sharedSecret}"`);
      managedLines.push(`    shortname = ${client.shortname || client.name.replace(/\s+/g, '_')}`);
      managedLines.push(`    nas_type = ${client.type}`);
      managedLines.push(`    require_message_authenticator = no`);
      managedLines.push(`}`);
    }
    managedLines.push('');
    managedLines.push(STAYSUITE_CLIENT_END);
    const managedSection = managedLines.join('\n');

    // Read existing file or start empty
    let existingContent = '';
    try {
      existingContent = await fs.readFile(FREERADIUS_CLIENTS_PATH, 'utf-8');
    } catch {
      // File doesn't exist yet — that's OK
    }

    let newContent: string;
    const beginIdx = existingContent.indexOf(STAYSUITE_CLIENT_BEGIN);
    const endIdx = existingContent.indexOf(STAYSUITE_CLIENT_END);

    if (beginIdx !== -1 && endIdx !== -1 && endIdx > beginIdx) {
      // Replace existing managed section
      newContent = existingContent.slice(0, beginIdx) + managedSection + existingContent.slice(endIdx + STAYSUITE_CLIENT_END.length);
    } else {
      // Append managed section
      newContent = existingContent + (existingContent.length > 0 ? '\n' : '') + managedSection + '\n';
    }

    await fs.writeFile(FREERADIUS_CLIENTS_PATH, newContent, 'utf-8');
    log.info('Wrote NAS clients to clients.conf', { count: clients.length, path: FREERADIUS_CLIENTS_PATH });

    // Trigger FreeRADIUS reload
    await reloadFreeRADIUS();

    return true;
  } catch (error) {
    log.error('Failed to write NAS clients to clients.conf', { error: String(error) });
    return false;
  }
}

/**
 * StaySuite managed section markers for users file
 */
const STAYSUITE_USER_BEGIN = '# >>>>>> StaySuite managed users - DO NOT EDIT BETWEEN MARKERS <<<<<<';
const STAYSUITE_USER_END = '# >>>>>> End StaySuite managed users <<<<<<';

/**
 * Write all RADIUS users to FreeRADIUS users file
 * Uses section markers so we only overwrite our managed section
 */
async function writeAllUsersToFile(): Promise<boolean> {
  try {
    const users = getAllRADIUSUsers();
    const groups = getAllRADIUSGroups();

    const managedLines: string[] = [STAYSUITE_USER_BEGIN];

    // Write group definitions first
    for (const group of groups) {
      managedLines.push('');
      managedLines.push(`# Group: ${group.name}`);

      // Check attributes (radcheck equivalent)
      const checkEntries = Object.entries(group.checkAttributes);
      if (checkEntries.length > 0) {
        managedLines.push(`${group.name}  Check-Value := "group-member"`);
        for (const [attr, val] of checkEntries) {
          managedLines.push(`    ${attr} = "${val}"`);
        }
      }

      // Reply attributes (radreply equivalent)
      const replyEntries = Object.entries(group.replyAttributes);
      if (replyEntries.length > 0) {
        managedLines.push(`${group.name}`);
        for (const [attr, val] of replyEntries) {
          managedLines.push(`    ${attr} = "${val}",`);
        }
        // Remove trailing comma from last attribute
        const lastLine = managedLines[managedLines.length - 1];
        managedLines[managedLines.length - 1] = lastLine.replace(/,$/, '');
      }

      managedLines.push('');  // Blank line separator required by FreeRADIUS users file
    }

    // Write user definitions
    for (const user of users) {
      managedLines.push('');
      managedLines.push(`# User: ${user.username} (Created: ${user.createdAt})`);
      managedLines.push(`${user.username}  Cleartext-Password := "${user.password}"`);

      // Group assignment
      if (user.group) {
        managedLines.push(`    Group := "${user.group}"`);
      }

      // Custom attributes
      for (const [attr, val] of Object.entries(user.attributes)) {
        managedLines.push(`    ${attr} = "${val}"`);
      }

      managedLines.push('');  // Blank line separator
    }

    managedLines.push(STAYSUITE_USER_END);
    const managedSection = managedLines.join('\n');

    // Read existing file or start empty
    let existingContent = '';
    try {
      existingContent = await fs.readFile(FREERADIUS_USERS_PATH, 'utf-8');
    } catch {
      // File doesn't exist yet
    }

    let newContent: string;
    const beginIdx = existingContent.indexOf(STAYSUITE_USER_BEGIN);
    const endIdx = existingContent.indexOf(STAYSUITE_USER_END);

    if (beginIdx !== -1 && endIdx !== -1 && endIdx > beginIdx) {
      newContent = existingContent.slice(0, beginIdx) + managedSection + existingContent.slice(endIdx + STAYSUITE_USER_END.length);
    } else {
      newContent = existingContent + (existingContent.length > 0 ? '\n' : '') + managedSection + '\n';
    }

    await fs.writeFile(FREERADIUS_USERS_PATH, newContent, 'utf-8');
    log.info('Wrote users to users file', { userCount: users.length, groupCount: groups.length, path: FREERADIUS_USERS_PATH });

    // Trigger FreeRADIUS reload
    await reloadFreeRADIUS();

    return true;
  } catch (error) {
    log.error('Failed to write users to users file', { error: String(error) });
    return false;
  }
}

/**
 * Reload FreeRADIUS via systemctl or kill -HUP
 */
async function reloadFreeRADIUS(): Promise<void> {
  try {
    // Try systemctl reload first
    await execAsync('sudo systemctl reload freeradius 2>/dev/null || sudo systemctl reload radiusd 2>/dev/null');
    log.info('FreeRADIUS reloaded via systemctl');
  } catch {
    // Fallback: try kill -HUP on the PID file
    try {
      await execAsync('kill -HUP $(cat /var/run/freeradius/freeradius.pid 2>/dev/null || cat /var/run/radiusd/radiusd.pid 2>/dev/null) 2>/dev/null');
      log.info('FreeRADIUS reloaded via kill -HUP');
    } catch {
      log.info('Could not reload FreeRADIUS - may not be running or no permissions');
    }
  }
}

/**
 * Generate RADIUS attribute value pairs for bandwidth control
 */
function generateBandwidthAttributes(downloadKbps: number, uploadKbps: number): Record<string, string> {
  return {
    'WISPr-Bandwidth-Max-Down': String(downloadKbps),
    'WISPr-Bandwidth-Max-Up': String(uploadKbps),
    'Mikrotik-Rate-Limit': `${downloadKbps}k/${uploadKbps}k`,
    'Cisco-AVPair': `bps-rate=${downloadKbps}`,
  };
}

/**
 * Generate session timeout attributes
 */
function generateSessionAttributes(timeoutMinutes: number, dataLimitMB: number): Record<string, string> {
  const dataLimitOctets = dataLimitMB > 0 ? String(dataLimitMB * 1024 * 1024) : '0';

  const attrs: Record<string, string> = {
    'Session-Timeout': String(timeoutMinutes * 60),
    'WISPr-Session-Terminate-Time': new Date(Date.now() + timeoutMinutes * 60 * 1000).toISOString(),
  };

  if (dataLimitMB > 0) {
    attrs['ChilliSpot-Max-Data-Octets'] = dataLimitOctets;
  }

  return attrs;
}

// ============================================================================
// Health Check
// ============================================================================

app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    service: 'freeradius-service',
    version: SERVICE_VERSION,
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    port: PORT,
    memoryUsage: process.memoryUsage(),
  });
});

// ============================================================================
// Service Status & Control
// ============================================================================

app.get('/api/status', async (c) => {
  const status = await checkFreeRADIUSStatus();
  const nasClients = getAllNASClients();
  const radiusUsers = getAllRADIUSUsers();
  const radiusGroups = getAllRADIUSGroups();
  return c.json({
    success: true,
    data: {
      ...status,
      mode: status.installed ? 'production' : 'demo',
      nasClientCount: nasClients.length,
      userCount: radiusUsers.length,
      groupCount: radiusGroups.length,
    }
  });
});

app.post('/api/service/start', async (c) => {
  try {
    const status = await checkFreeRADIUSStatus();
    if (!status.installed) {
      return c.json({
        success: false,
        error: 'FreeRADIUS is not installed. Running in demo mode.',
        mode: 'demo'
      });
    }

    await execAsync('sudo systemctl start freeradius || sudo systemctl start radiusd');
    serviceStatus = 'running';

    return c.json({
      success: true,
      message: 'FreeRADIUS service started',
      status: 'running'
    });
  } catch (error) {
    return c.json({
      success: false,
      error: String(error)
    });
  }
});

app.post('/api/service/stop', async (c) => {
  try {
    const status = await checkFreeRADIUSStatus();
    if (!status.installed) {
      return c.json({
        success: false,
        error: 'FreeRADIUS is not installed. Running in demo mode.',
        mode: 'demo'
      });
    }

    await execAsync('sudo systemctl stop freeradius || sudo systemctl stop radiusd');
    serviceStatus = 'stopped';

    return c.json({
      success: true,
      message: 'FreeRADIUS service stopped',
      status: 'stopped'
    });
  } catch (error) {
    return c.json({
      success: false,
      error: String(error)
    });
  }
});

app.post('/api/service/restart', async (c) => {
  try {
    const status = await checkFreeRADIUSStatus();
    if (!status.installed) {
      return c.json({
        success: false,
        error: 'FreeRADIUS is not installed. Running in demo mode.',
        mode: 'demo'
      });
    }

    await execAsync('sudo systemctl restart freeradius || sudo systemctl restart radiusd');
    serviceStatus = 'running';

    return c.json({
      success: true,
      message: 'FreeRADIUS service restarted',
      status: 'running'
    });
  } catch (error) {
    return c.json({
      success: false,
      error: String(error)
    });
  }
});

// ============================================================================
// NAS Clients (Routers, Access Points)
// ============================================================================

app.get('/api/nas', (c) => {
  const nasClients = getAllNASClients();
  return c.json({
    success: true,
    data: nasClients
  });
});

app.get('/api/nas/:id', (c) => {
  const { id } = c.req.param();
  const client = getNASClientById(id);

  if (!client) {
    return c.json({ success: false, error: 'NAS client not found' }, 404);
  }

  return c.json({ success: true, data: client });
});

app.post('/api/nas', async (c) => {
  try {
    const body = await c.req.json();

    const client: NASClient = {
      id: generateId('nas'),
      name: body.name,
      ipAddress: body.ipAddress,
      sharedSecret: body.sharedSecret || generateSharedSecret(),
      shortname: body.shortname || body.name.replace(/\s+/g, '_').toLowerCase(),
      type: body.type || 'other',
      ports: {
        auth: body.authPort || 1812,
        coa: body.coaPort || 3799
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Persist to SQLite
    createNASClient(client);

    // Write to FreeRADIUS clients.conf
    await writeAllNASClientsToConf();

    return c.json({
      success: true,
      data: client,
      message: 'NAS client added successfully'
    });
  } catch (error) {
    return c.json({
      success: false,
      error: String(error)
    });
  }
});

app.put('/api/nas/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const body = await c.req.json();

    const updated = updateNASClient(id, body);
    if (!updated) {
      return c.json({ success: false, error: 'NAS client not found' }, 404);
    }

    // Write updated clients to FreeRADIUS clients.conf
    await writeAllNASClientsToConf();

    return c.json({
      success: true,
      data: updated,
      message: 'NAS client updated successfully'
    });
  } catch (error) {
    return c.json({
      success: false,
      error: String(error)
    });
  }
});

app.delete('/api/nas/:id', async (c) => {
  const { id } = c.req.param();
  const deleted = deleteNASClient(id);

  if (!deleted) {
    return c.json({ success: false, error: 'NAS client not found' }, 404);
  }

  // Write updated clients to FreeRADIUS clients.conf
  await writeAllNASClientsToConf();

  return c.json({
    success: true,
    message: 'NAS client deleted successfully'
  });
});

app.post('/api/nas/generate-secret', (c) => {
  return c.json({
    success: true,
    data: {
      secret: generateSharedSecret(32)
    }
  });
});

// ============================================================================
// RADIUS Users (radcheck, radreply)
// ============================================================================

app.get('/api/users', (c) => {
  const radiusUsers = getAllRADIUSUsers();
  return c.json({
    success: true,
    data: radiusUsers
  });
});

app.get('/api/users/:id', (c) => {
  const { id } = c.req.param();
  const user = getRADIUSUserById(id);

  if (!user) {
    return c.json({ success: false, error: 'User not found' }, 404);
  }

  return c.json({ success: true, data: user });
});

app.post('/api/users', async (c) => {
  try {
    const body = await c.req.json();

    const user: RADIUSUser = {
      id: generateId('user'),
      username: body.username,
      password: body.password,
      group: body.group,
      attributes: body.attributes || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Add bandwidth attributes if provided
    if (body.downloadSpeed || body.uploadSpeed) {
      user.attributes = {
        ...user.attributes,
        ...generateBandwidthAttributes(
          (body.downloadSpeed || 10) * 1000, // Convert Mbps to Kbps
          (body.uploadSpeed || 10) * 1000
        )
      };
    }

    // Add session attributes if provided
    if (body.sessionTimeout || body.dataLimit) {
      user.attributes = {
        ...user.attributes,
        ...generateSessionAttributes(
          body.sessionTimeout || 1440,
          body.dataLimit || 1000
        )
      };
    }

    // Persist to SQLite
    createRADIUSUser(user);

    // Sync to FreeRADIUS users file
    await writeAllUsersToFile();

    return c.json({
      success: true,
      data: user,
      message: 'RADIUS user created successfully'
    });
  } catch (error) {
    return c.json({
      success: false,
      error: String(error)
    });
  }
});

app.put('/api/users/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const body = await c.req.json();

    const updated = updateRADIUSUser(id, body);
    if (!updated) {
      return c.json({ success: false, error: 'User not found' }, 404);
    }

    // Sync to FreeRADIUS users file
    await writeAllUsersToFile();

    return c.json({
      success: true,
      data: updated,
      message: 'RADIUS user updated successfully'
    });
  } catch (error) {
    return c.json({
      success: false,
      error: String(error)
    });
  }
});

app.delete('/api/users/:id', async (c) => {
  const { id } = c.req.param();
  const deleted = deleteRADIUSUser(id);

  if (!deleted) {
    return c.json({ success: false, error: 'User not found' }, 404);
  }

  // Sync to FreeRADIUS users file
  await writeAllUsersToFile();

  return c.json({
    success: true,
    message: 'RADIUS user deleted successfully'
  });
});

// ============================================================================
// RADIUS Groups (radgroupcheck, radgroupreply)
// ============================================================================

app.get('/api/groups', (c) => {
  // Default groups for hospitality
  const defaultGroups: RADIUSGroup[] = [
    {
      name: 'premium-guests',
      checkAttributes: {
        'Auth-Type': 'Local'
      },
      replyAttributes: {
        'WISPr-Bandwidth-Max-Down': '51200', // 50 Mbps in Kbps
        'WISPr-Bandwidth-Max-Up': '25600',   // 25 Mbps
        'Session-Timeout': '86400',           // 24 hours
        'Mikrotik-Rate-Limit': '51200k/25600k'
      }
    },
    {
      name: 'standard-guests',
      checkAttributes: {
        'Auth-Type': 'Local'
      },
      replyAttributes: {
        'WISPr-Bandwidth-Max-Down': '10240', // 10 Mbps
        'WISPr-Bandwidth-Max-Up': '5120',    // 5 Mbps
        'Session-Timeout': '86400',
        'Mikrotik-Rate-Limit': '10240k/5120k'
      }
    },
    {
      name: 'basic-guests',
      checkAttributes: {
        'Auth-Type': 'Local'
      },
      replyAttributes: {
        'WISPr-Bandwidth-Max-Down': '2048',  // 2 Mbps
        'WISPr-Bandwidth-Max-Up': '1024',    // 1 Mbps
        'Session-Timeout': '86400',
        'Mikrotik-Rate-Limit': '2048k/1024k'
      }
    },
    {
      name: 'staff',
      checkAttributes: {
        'Auth-Type': 'Local'
      },
      replyAttributes: {
        'WISPr-Bandwidth-Max-Down': '102400', // 100 Mbps
        'WISPr-Bandwidth-Max-Up': '51200',    // 50 Mbps
        'Session-Timeout': '0',                // No limit
        'Mikrotik-Rate-Limit': '102400k/51200k'
      }
    }
  ];

  const customGroups = getAllRADIUSGroups();
  const allGroups = [...defaultGroups, ...customGroups];

  return c.json({
    success: true,
    data: allGroups
  });
});

app.post('/api/groups', async (c) => {
  try {
    const body = await c.req.json();

    const group: RADIUSGroup = {
      name: body.name,
      checkAttributes: body.checkAttributes || {},
      replyAttributes: body.replyAttributes || {}
    };

    // Persist to SQLite
    createRADIUSGroup(group);

    // Sync to FreeRADIUS users file
    await writeAllUsersToFile();

    return c.json({
      success: true,
      data: group,
      message: 'RADIUS group created successfully'
    });
  } catch (error) {
    return c.json({
      success: false,
      error: String(error)
    });
  }
});

app.delete('/api/groups/:name', async (c) => {
  const { name } = c.req.param();
  const deleted = deleteRADIUSGroup(name);

  if (!deleted) {
    return c.json({ success: false, error: 'Group not found' }, 404);
  }

  // Sync to FreeRADIUS users file
  await writeAllUsersToFile();

  return c.json({
    success: true,
    message: 'RADIUS group deleted successfully'
  });
});

// ============================================================================
// RADIUS Connection Test — uses real radtest
// ============================================================================

app.post('/api/test', async (c) => {
  try {
    const body = await c.req.json();
    const { nasIp, sharedSecret, username, password, authPort = 1812 } = body;

    const startTime = Date.now();

    // Try actual radtest command first
    try {
      const { stdout, stderr } = await execAsync(
        `radtest ${username || 'test'} ${password || 'test'} ${nasIp || '127.0.0.1'}:${authPort} 0 ${sharedSecret || 'testing123'} 2>&1`,
        { timeout: 10000 }
      );

      const latency = Date.now() - startTime;
      const output = (stdout || '') + (stderr || '');
      const success = output.toLowerCase().includes('access-accept');

      return c.json({
        success: true,
        data: {
          success,
          response: output.trim(),
          latency,
          method: 'radtest'
        },
        timestamp: new Date().toISOString()
      });
    } catch (radtestError) {
      const latency = Date.now() - startTime;

      // radtest not available — fallback to basic connectivity check
      const nasClients = getAllNASClients();
      const nas = nasClients.find(n => n.ipAddress === nasIp);

      if (!nas && body.checkNas !== false) {
        return c.json({
          success: false,
          error: 'NAS client not configured',
          hint: 'Add this NAS to the clients configuration first'
        });
      }

      const radiusUsers = getAllRADIUSUsers();
      const user = radiusUsers.find(u => u.username === username);

      return c.json({
        success: true,
        data: {
          success: false,
          response: `radtest not available: ${radtestError instanceof Error ? radtestError.message : String(radtestError)}`,
          latency,
          method: 'fallback',
          tests: {
            connectivity: {
              status: nas ? 'pass' : 'unknown',
              message: nas
                ? `NAS ${nasIp} found in database`
                : `NAS ${nasIp} not found in database`,
              latency
            },
            authentication: username ? {
              status: user ? 'pass' : 'skip',
              message: user
                ? `User '${username}' found in database`
                : `User '${username}' not found - skipping auth test`
            } : undefined
          }
        },
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    return c.json({
      success: false,
      error: String(error)
    });
  }
});

// ============================================================================
// Configuration Export
// ============================================================================

app.get('/api/config/export', (c) => {
  const nasClients = getAllNASClients();
  const radiusUsers = getAllRADIUSUsers();
  const radiusGroups = getAllRADIUSGroups();

  const config = {
    nas: nasClients,
    users: radiusUsers,
    groups: radiusGroups,
    exportedAt: new Date().toISOString(),
    version: '1.0'
  };

  return c.json({
    success: true,
    data: config
  });
});

app.post('/api/config/import', async (c) => {
  try {
    const body = await c.req.json();

    if (body.nas) {
      // Clear existing and import
      db.query('DELETE FROM nas_clients').run();
      for (const n of body.nas as NASClient[]) {
        const client: NASClient = {
          ...n,
          updatedAt: new Date().toISOString()
        };
        createNASClient(client);
      }
    }

    if (body.users) {
      db.query('DELETE FROM radius_users').run();
      for (const u of body.users as RADIUSUser[]) {
        const user: RADIUSUser = {
          ...u,
          updatedAt: new Date().toISOString()
        };
        createRADIUSUser(user);
      }
    }

    if (body.groups) {
      db.query('DELETE FROM radius_groups').run();
      for (const g of body.groups as RADIUSGroup[]) {
        createRADIUSGroup(g);
      }
    }

    // Sync to FreeRADIUS config files
    await writeAllNASClientsToConf();
    await writeAllUsersToFile();

    const nasClients = getAllNASClients();
    const radiusUsers = getAllRADIUSUsers();
    const radiusGroups = getAllRADIUSGroups();

    return c.json({
      success: true,
      message: 'Configuration imported successfully',
      stats: {
        nas: nasClients.length,
        users: radiusUsers.length,
        groups: radiusGroups.length
      }
    });
  } catch (error) {
    return c.json({
      success: false,
      error: String(error)
    });
  }
});

// ============================================================================
// Statistics & Monitoring
// ============================================================================

app.get('/api/stats', (c) => {
  const nasClients = getAllNASClients();
  const radiusUsers = getAllRADIUSUsers();
  const radiusGroups = getAllRADIUSGroups();

  return c.json({
    success: true,
    data: {
      nasClients: nasClients.length,
      users: radiusUsers.length,
      groups: radiusGroups.length,
      serviceStatus,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      dbPath: SQLITE_DB_PATH
    }
  });
});

// ============================================================================
// Default AAA Configuration
// ============================================================================

app.get('/api/config/default', (c) => {
  return c.json({
    success: true,
    data: {
      authentication: {
        methods: ['pap', 'chap', 'mschapv2'],
        defaultMethod: 'pap',
        allowMacAuth: false,
        macAuthPassword: 'password'
      },
      authorization: {
        defaultPlan: 'standard-guests',
        maxConcurrentSessions: 3,
        sessionTimeoutPolicy: 'hard'
      },
      accounting: {
        enabled: true,
        syncInterval: 5,
        interimInterval: 300,
        retentionDays: 90
      },
      captivePortal: {
        enabled: true,
        title: 'Hotel WiFi',
        redirectUrl: 'https://www.google.com',
        termsUrl: '/terms',
        brandColor: '#0d9488'
      },
      server: {
        authPort: 1812,
        acctPort: 1813,
        coaPort: 3799,
        listenIp: '0.0.0.0'
      }
    }
  });
});

// ============================================================================
// Start Server
// ============================================================================

log.info('FreeRADIUS Management Service starting', {
  port: PORT,
  version: SERVICE_VERSION,
  dbPath: SQLITE_DB_PATH,
});

// Check FreeRADIUS status on startup
checkFreeRADIUSStatus().then(status => {
  if (!status.installed) {
    log.warn('FreeRADIUS not installed - running in DEMO mode', { status });
  } else {
    log.info('FreeRADIUS status', { installed: status.installed, running: status.running, version: status.version });
  }
});

Bun.serve({
  port: PORT,
  fetch: app.fetch,
});

log.info('FreeRADIUS Service HTTP server listening', { port: PORT });

// Graceful shutdown
process.on('SIGTERM', () => {
  log.info('SIGTERM received, shutting down');
  try { db.close(); } catch {}
  process.exit(0);
});

process.on('SIGINT', () => {
  log.info('SIGINT received, shutting down');
  try { db.close(); } catch {}
  process.exit(0);
});
