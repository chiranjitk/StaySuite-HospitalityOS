/**
 * RADIUS Management Service for StaySuite
 *
 * Provides REST API for managing RADIUS server:
 * - NAS Client management (routers, access points) — persisted to SQLite + clients.conf
 * - User management — FreeRADIUS native SQL schema (radcheck, radreply, radusergroup)
 * - Group management — FreeRADIUS native SQL schema (radgroupcheck, radgroupreply)
 * - Guest provisioning/deprovisioning for check-in/check-out
 * - FreeRADIUS sql module configuration generation
 * - Service status and control
 * - RADIUS connectivity testing via radtest
 * - Accounting session parsing from radacct detail files
 *
 * Port: 3010
 * OS: Rocky Linux 10 (radiusd package, config at /etc/raddb/)
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { exec, execFileSync } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import net from 'net';
import Database from 'bun:sqlite';
import { createLogger } from '../shared/logger';

const execAsync = promisify(exec);

const app = new Hono();
const PORT = 3010;
const SERVICE_VERSION = '2.0.0';
const log = createLogger('radius-service');
const startTime = Date.now();

// RADIUS server configuration paths (Rocky Linux 10: radiusd package)
const RADIUS_CONFIG_PATH = process.env.RADIUS_CONFIG_PATH || '/etc/raddb';
const RADIUS_CLIENTS_PATH = path.join(RADIUS_CONFIG_PATH, 'clients.conf');

// ============================================================================
// SQLite Persistence — SAME database as PMS (Prisma). Single source of truth.
// ============================================================================

const PROJECT_ROOT = process.env.PROJECT_ROOT || path.resolve(__dirname, '..', '..');
const DB_PATH = process.env.RADIUS_DB_PATH || path.join(PROJECT_ROOT, 'db', 'custom.db');
// USE THE SAME DATABASE AS PMS — single SQLite file for everything
const SQLITE_DB_PATH = process.env.RADIUS_SERVICE_DB_PATH || path.join(PROJECT_ROOT, 'db', 'custom.db');

// Ensure the db directory exists (sync to avoid top-level await issues with PM2)
const dbDir = path.dirname(SQLITE_DB_PATH);
try {
  fsSync.mkdirSync(dbDir, { recursive: true });
} catch {
  // directory may already exist
}

const db = new Database(SQLITE_DB_PATH, { create: true });
db.exec('PRAGMA journal_mode=WAL;');
db.exec('PRAGMA wal_autocheckpoint = 1000;');  // Keep WAL file small — prevents long checkpoint locks blocking FreeRADIUS
db.exec('PRAGMA foreign_keys=ON;');
db.exec('PRAGMA busy_timeout = 30000;');  // Wait up to 30s for write lock — avoids SQLITE_BUSY when FreeRADIUS/Prisma write concurrently
db.exec('PRAGMA synchronous = NORMAL;');  // Faster than FULL — WAL mode is crash-safe even with NORMAL; reduces fsync latency that causes SQLITE_BUSY

// =========================================================================
// Ensure FreeRADIUS core tables exist (SQLite).
// These are needed BEFORE the prepared statements below.
// On PostgreSQL, the deploy script creates them. On SQLite (this service),
// we create them here on first startup.
// =========================================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS radcheck (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    username   TEXT    NOT NULL DEFAULT '',
    attribute  TEXT    NOT NULL DEFAULT '',
    op         TEXT    NOT NULL DEFAULT ':=',
    value      TEXT    NOT NULL DEFAULT '',
    isActive   INTEGER NOT NULL DEFAULT 1,
    createdAt  TEXT    NOT NULL DEFAULT (datetime('now')),
    updatedAt  TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS radcheck_username_idx ON radcheck (username);
  CREATE INDEX IF NOT EXISTS radcheck_attribute_idx ON radcheck (attribute);

  CREATE TABLE IF NOT EXISTS radreply (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    username   TEXT    NOT NULL DEFAULT '',
    attribute  TEXT    NOT NULL DEFAULT '',
    op         TEXT    NOT NULL DEFAULT '=',
    value      TEXT    NOT NULL DEFAULT '',
    isActive   INTEGER NOT NULL DEFAULT 1,
    createdAt  TEXT    NOT NULL DEFAULT (datetime('now')),
    updatedAt  TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS radreply_username_idx ON radreply (username);
  CREATE INDEX IF NOT EXISTS radreply_attribute_idx ON radreply (attribute);

  CREATE TABLE IF NOT EXISTS radgroupcheck (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    groupname  TEXT    NOT NULL DEFAULT '',
    attribute  TEXT    NOT NULL DEFAULT '',
    op         TEXT    NOT NULL DEFAULT ':=',
    value      TEXT    NOT NULL DEFAULT ''
  );
  CREATE INDEX IF NOT EXISTS radgroupcheck_groupname_idx ON radgroupcheck (groupname);

  CREATE TABLE IF NOT EXISTS radgroupreply (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    groupname  TEXT    NOT NULL DEFAULT '',
    attribute  TEXT    NOT NULL DEFAULT '',
    op         TEXT    NOT NULL DEFAULT '=',
    value      TEXT    NOT NULL DEFAULT ''
  );
  CREATE INDEX IF NOT EXISTS radgroupreply_groupname_idx ON radgroupreply (groupname);

  CREATE TABLE IF NOT EXISTS radusergroup (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    username   TEXT    NOT NULL DEFAULT '',
    groupname  TEXT    NOT NULL DEFAULT '',
    priority   INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS radusergroup_username_idx ON radusergroup (username);
  CREATE INDEX IF NOT EXISTS radusergroup_groupname_idx ON radusergroup (groupname);

  CREATE TABLE IF NOT EXISTS nas (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    tenantId    TEXT    NOT NULL DEFAULT '',
    propertyId  TEXT    NOT NULL DEFAULT '',
    name        TEXT    NOT NULL DEFAULT '',
    shortname   TEXT    DEFAULT '',
    nasname     TEXT    NOT NULL DEFAULT '',
    type        TEXT    DEFAULT 'other',
    secret      TEXT    NOT NULL DEFAULT '',
    coaEnabled  INTEGER NOT NULL DEFAULT 0,
    coaPort     INTEGER NOT NULL DEFAULT 3799,
    authPort    INTEGER NOT NULL DEFAULT 1812,
    acctPort    INTEGER NOT NULL DEFAULT 1813,
    status      TEXT    DEFAULT 'active',
    createdAt   TEXT    NOT NULL DEFAULT (datetime('now')),
    updatedAt   TEXT    NOT NULL DEFAULT (datetime('now'))
  );
`);

log.info('FreeRADIUS core tables ensured (radcheck, radreply, radgroupcheck, radgroupreply, radusergroup, nas)');

// FreeRADIUS SQL tables — use native lowercase names (matching FreeRADIUS schema)
// These are the SAME tables that the PMS wifi-user-service writes to.
// No sync needed — both services share this single SQLite database.
const insertRadCheck = db.query('INSERT INTO radcheck (username, attribute, op, value, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, 1, datetime("now"), datetime("now"))');
const insertRadReply = db.query('INSERT INTO radreply (username, attribute, op, value, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, 1, datetime("now"), datetime("now"))');
const insertRadGroupCheck = db.query('INSERT INTO radgroupcheck (groupname, attribute, op, value) VALUES (?, ?, ?, ?)');
const insertRadGroupReply = db.query('INSERT INTO radgroupreply (groupname, attribute, op, value) VALUES (?, ?, ?, ?)');
const insertRadUserGroup = db.query('INSERT INTO radusergroup (username, groupname, priority) VALUES (?, ?, ?)');

log.info(`Using shared database: ${SQLITE_DB_PATH}`);

// =========================================================================
// Ensure radacct table exists with correct schema (37 columns)
// This fixes the SQLITE_BUSY issue where FreeRADIUS can't INSERT because
// the table is missing columns or doesn't exist.
// =========================================================================
function ensureRadacctTable(): void {
  try {
    // Create the table if it doesn't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS radacct (
        radacctid           INTEGER PRIMARY KEY AUTOINCREMENT,
        acctsessionid       TEXT NOT NULL DEFAULT '',
        acctuniqueid        TEXT NOT NULL UNIQUE DEFAULT '',
        username            TEXT NOT NULL DEFAULT '',
        realm               TEXT DEFAULT '',
        nasipaddress        TEXT NOT NULL DEFAULT '',
        nasportid           TEXT,
        nasporttype         TEXT,
        acctstarttime       TEXT,
        acctupdatetime      TEXT,
        acctstoptime        TEXT,
        acctinterval        INTEGER,
        acctsessiontime     INTEGER,
        acctauthentic       TEXT,
        connectinfo_start   TEXT,
        connectinfo_stop    TEXT,
        acctinputoctets     INTEGER DEFAULT 0,
        acctoutputoctets    INTEGER DEFAULT 0,
        acctinputgigawords  INTEGER DEFAULT 0,
        acctoutputgigawords INTEGER DEFAULT 0,
        calledstationid     TEXT NOT NULL DEFAULT '',
        callingstationid    TEXT NOT NULL DEFAULT '',
        acctterminatecause  TEXT NOT NULL DEFAULT '',
        servicetype         TEXT,
        framedprotocol      TEXT,
        framedipaddress     TEXT NOT NULL DEFAULT '',
        framedipv6address   TEXT NOT NULL DEFAULT '',
        framedipv6prefix    TEXT NOT NULL DEFAULT '',
        framedinterfaceid   TEXT NOT NULL DEFAULT '',
        delegatedipv6prefix TEXT NOT NULL DEFAULT '',
        class               TEXT,
        acctinputpackets    INTEGER DEFAULT 0,
        acctoutputpackets   INTEGER DEFAULT 0,
        acctstatus          TEXT DEFAULT 'start',
        createdAt           TEXT NOT NULL DEFAULT (datetime('now')),
        updatedAt           TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    // Add any missing columns (for databases created with older schema)
    const requiredColumns: Record<string, string> = {
      acctinputpackets: 'INTEGER DEFAULT 0',
      acctoutputpackets: 'INTEGER DEFAULT 0',
      acctstatus: "TEXT DEFAULT 'start'",
      realm: "TEXT DEFAULT ''",
      acctupdatetime: 'TEXT',
      acctinterval: 'INTEGER',
      acctinputgigawords: 'INTEGER DEFAULT 0',
      acctoutputgigawords: 'INTEGER DEFAULT 0',
      framedipv6prefix: "TEXT DEFAULT ''",
      framedinterfaceid: "TEXT DEFAULT ''",
      delegatedipv6prefix: "TEXT DEFAULT ''",
      class: 'TEXT',
      servicetype: 'TEXT',
      framedprotocol: 'TEXT',
      framedipv6address: "TEXT DEFAULT ''",
      createdAt: "TEXT NOT NULL DEFAULT (datetime('now'))",
      updatedAt: "TEXT NOT NULL DEFAULT (datetime('now'))",
    };

    for (const [col, colDef] of Object.entries(requiredColumns)) {
      try {
        db.exec(`ALTER TABLE radacct ADD COLUMN ${col} ${colDef};`);
      } catch {
        // Column already exists — that's fine
      }
    }

    // Create performance indexes
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_radacct_username ON radacct(username)',
      'CREATE INDEX IF NOT EXISTS idx_radacct_acctstarttime ON radacct(acctstarttime)',
      'CREATE INDEX IF NOT EXISTS idx_radacct_acctstoptime ON radacct(acctstoptime)',
      'CREATE INDEX IF NOT EXISTS idx_radacct_nasipaddress ON radacct(nasipaddress)',
      'CREATE INDEX IF NOT EXISTS idx_radacct_framedipaddress ON radacct(framedipaddress)',
      'CREATE INDEX IF NOT EXISTS idx_radacct_callingstationid ON radacct(callingstationid)',
      'CREATE INDEX IF NOT EXISTS idx_radacct_acctstatus ON radacct(acctstatus)',
      'CREATE INDEX IF NOT EXISTS idx_radacct_composite ON radacct(username, acctstarttime, acctstatus)',
    ];
    for (const idx of indexes) {
      try { db.exec(idx); } catch { /* index already exists */ }
    }

    // Fix bad data: empty strings in DateTime columns cause Prisma P2023 errors
    // Prisma expects NULL or valid datetime strings, NOT empty strings
    db.exec("UPDATE radacct SET acctstoptime = NULL WHERE acctstoptime = '';");
    db.exec("UPDATE radacct SET acctstarttime = NULL WHERE acctstarttime = '';");
    db.exec("UPDATE radacct SET acctupdatetime = NULL WHERE acctupdatetime = '';");

    // Verify with a test INSERT/DELETE
    const nowISO = new Date().toISOString();
    db.query('INSERT INTO radacct (acctsessionid, acctuniqueid, username, nasipaddress, framedipaddress, callingstationid, acctstatus, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run('_verify', '_verify_test', '_verify_user', '10.0.0.1', '10.0.0.2', '00:00:00:00:00:01', 'Start', nowISO, nowISO);
    db.query('DELETE FROM radacct WHERE acctuniqueid = ?').run('_verify_test');

    log.info('radacct table verified: 37 columns, 8 indexes, test INSERT/DELETE passed');
  } catch (err) {
    log.error('Failed to verify/fix radacct table', { error: String(err) });
  }
}

// Run radacct table check on startup
ensureRadacctTable();

// Ensure RadiusEvent table exists for event WiFi management
db.exec(`
  CREATE TABLE IF NOT EXISTS RadiusEvent (
    id TEXT PRIMARY KEY,
    propertyId TEXT,
    name TEXT NOT NULL,
    planId TEXT,
    bandwidthDown INTEGER,
    bandwidthUp INTEGER,
    dataLimitMb INTEGER,
    validHours INTEGER DEFAULT 24,
    organizerName TEXT,
    organizerEmail TEXT,
    organizerCompany TEXT,
    status TEXT DEFAULT 'active',
    createdAt TEXT,
    updatedAt TEXT
  );
`);

// Add organizer columns if they don't exist (for existing databases)
try { db.exec('ALTER TABLE RadiusEvent ADD COLUMN organizerName TEXT'); } catch { /* column exists */ }
try { db.exec('ALTER TABLE RadiusEvent ADD COLUMN organizerEmail TEXT'); } catch { /* column exists */ }
try { db.exec('ALTER TABLE RadiusEvent ADD COLUMN organizerCompany TEXT'); } catch { /* column exists */ }

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
    acct: number;
    coa: number;
  };
  coaEnabled?: boolean;
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
  // PMS metadata (from WiFiUser table)
  tenantId?: string;
  propertyId?: string;
  guestId?: string;
  bookingId?: string;
  status?: string;
  validUntil?: string;
  userType?: string;
  // FUP Policy (from WiFiPlan → FairAccessPolicy linkage)
  fupPolicy?: { id: string; name: string; cycleType: string; dataLimitMb: number; dataLimitUnit: string; applicableOn: string } | null;
}

interface RADIUSGroup {
  name: string;
  checkAttributes: Record<string, string>;
  replyAttributes: Record<string, string>;
}

interface AccountingSession {
  username: string;
  nasIp: string;
  clientMac: string;
  apMac: string;
  ipAddress: string;
  sessionId: string;
  sessionTime: number;
  inputOctets: number;
  outputOctets: number;
  status: 'active' | 'ended' | 'stale';
  startedAt: string;
  lastSeenAt: string;
  terminateCause?: string;
}

// Sessions with no Interim-Update for more than this many minutes are marked "stale"
const STALE_SESSION_THRESHOLD_MINUTES = 10;

// In-memory state for service status only
let serviceStatus: 'running' | 'stopped' | 'unknown' = 'unknown';

// ============================================================================
// SQLite Helper Functions
// ============================================================================

function rowToNASClient(row: Record<string, unknown>): NASClient {
  // nas table uses FreeRADIUS native column names
  return {
    id: String(row.id),
    name: row.name as string,
    ipAddress: row.nasname as string,
    sharedSecret: row.secret as string,
    shortname: (row.shortname as string) || undefined,
    type: row.type as string,
    ports: {
      auth: row.authPort as number,
      acct: (row.acctPort as number) || 1813,
      coa: row.coaPort as number,
    },
    coaEnabled: row.coaEnabled === 1 || row.coaEnabled === true,
    createdAt: row.createdAt as string,
    updatedAt: row.updatedAt as string,
  };
}

function getAllNASClients(): NASClient[] {
  // Use native nas table (FreeRADIUS schema)
  const rows = db.query('SELECT * FROM nas ORDER BY createdAt DESC').all() as Record<string, unknown>[];
  return rows.map(rowToNASClient);
}

function getNASClientById(id: string | number): NASClient | null {
  const row = db.query('SELECT * FROM nas WHERE id = ?').get(Number(id)) as Record<string, unknown> | null;
  return row ? rowToNASClient(row) : null;
}

function createNASClient(client: NASClient): number {
  // Insert into native nas table (FreeRADIUS schema)
  // id is INTEGER PRIMARY KEY AUTOINCREMENT — do NOT pass a value, let SQLite auto-generate
  const result = db.query(
    `INSERT INTO nas (tenantId, propertyId, name, shortname, nasname, type, secret, coaEnabled, coaPort, authPort, acctPort, status, createdAt, updatedAt)
     VALUES ('tenant-1', 'property-1', ?, ?, ?, ?, ?, 1, ?, ?, ?, 'active', ?, ?)`
  ).run(
    client.name, client.shortname || client.name, client.ipAddress, client.type,
    client.sharedSecret, client.ports.coa, client.ports.auth, client.ports.acct,
    client.createdAt, client.updatedAt
  );
  return Number(result.lastInsertRowid);
}

function updateNASClient(id: string | number, updates: Partial<NASClient> & { coaEnabled?: boolean }): NASClient | null {
  const existing = getNASClientById(id);
  if (!existing) return null;

  const updated: NASClient = {
    ...existing,
    ...updates,
    ports: {
      auth: updates.ports?.auth ?? existing.ports.auth,
      acct: updates.ports?.acct ?? existing.ports.acct,
      coa: updates.ports?.coa ?? existing.ports.coa,
    },
    updatedAt: new Date().toISOString(),
  };

  const coaEnabled = (updates as any).coaEnabled !== undefined ? ((updates as any).coaEnabled ? 1 : 0) : undefined;

  if (coaEnabled !== undefined) {
    db.query(
      `UPDATE nas SET name=?, shortname=?, nasname=?, type=?, secret=?, coaEnabled=?, coaPort=?, authPort=?, acctPort=?, updatedAt=?
       WHERE id=?`
    ).run(
      updated.name, updated.shortname || updated.name, updated.ipAddress, updated.type,
      updated.sharedSecret, coaEnabled, updated.ports.coa, updated.ports.auth, updated.ports.acct,
      updated.updatedAt, Number(id)
    );
  } else {
    db.query(
      `UPDATE nas SET name=?, shortname=?, nasname=?, type=?, secret=?, coaPort=?, authPort=?, acctPort=?, updatedAt=?
       WHERE id=?`
    ).run(
      updated.name, updated.shortname || updated.name, updated.ipAddress, updated.type,
      updated.sharedSecret, updated.ports.coa, updated.ports.auth, updated.ports.acct,
      updated.updatedAt, Number(id)
    );
  }
  return updated;
}

function deleteNASClient(id: string | number): boolean {
  const result = db.query('DELETE FROM nas WHERE id = ?').run(Number(id));
  return result.changes > 0;
}

// ---- FreeRADIUS Native SQL User Functions ----

function getRADIUSUserByUsername(username: string): RADIUSUser | null {
  // Query native FreeRADIUS tables (lowercase)
  // NOTE: No isActive filter — FreeRADIUS writes directly to these tables and does not set isActive.
  // Only the PMS sets isActive when creating records; FreeRADIUS-created rows have default (0/false).
  const checkRows = db.query('SELECT * FROM radcheck WHERE username = ?').all(username) as Array<Record<string, unknown>>;
  const replyRows = db.query('SELECT * FROM radreply WHERE username = ?').all(username) as Array<Record<string, unknown>>;
  const groupRows = db.query('SELECT * FROM radusergroup WHERE username = ? ORDER BY priority').all(username) as Array<Record<string, unknown>>;
  // Get PMS WiFiUser metadata for guest/booking info
  const wifiUser = db.query('SELECT * FROM WiFiUser WHERE username = ?').get(username) as Record<string, unknown> | null;

  if (checkRows.length === 0 && replyRows.length === 0 && !wifiUser) return null;

  let password = wifiUser?.password as string || '';
  for (const row of checkRows) {
    if (row.attribute === 'Cleartext-Password') {
      password = row.value as string;
    }
  }

  const attributes: Record<string, string> = {};
  for (const row of replyRows) {
    attributes[row.attribute as string] = row.value as string;
  }

  const group = groupRows.length > 0 ? (groupRows[0].groupname as string) : undefined;

  // Look up FUP policy via: user's group → WiFiPlan (matching plan name to group) → fupPolicyId → FairAccessPolicy
  let fupPolicy: RADIUSUser['fupPolicy'] = undefined;
  if (group) {
    const plan = db.query(
      "SELECT p.id, p.name, p.fupPolicyId FROM WiFiPlan p WHERE REPLACE(LOWER(p.name), ' ', '_') = REPLACE(LOWER(?), ' ', '_') AND p.status = 'active' LIMIT 1"
    ).get(group) as { id: string; name: string; fupPolicyId: string | null } | undefined;
    if (plan?.fupPolicyId) {
      const fap = db.query(
        'SELECT id, name, cycleType, dataLimitMb, dataLimitUnit, applicableOn FROM FairAccessPolicy WHERE id = ? AND isEnabled = 1'
      ).get(plan.fupPolicyId) as { id: string; name: string; cycleType: string; dataLimitMb: number; dataLimitUnit: string; applicableOn: string } | undefined;
      if (fap) {
        fupPolicy = { id: fap.id, name: fap.name, cycleType: fap.cycleType, dataLimitMb: fap.dataLimitMb, dataLimitUnit: fap.dataLimitUnit, applicableOn: fap.applicableOn };
      }
    }
  }

  return {
    id: (wifiUser?.id as string) || generateId('user'),
    username,
    password,
    group,
    attributes,
    createdAt: (wifiUser?.createdAt as string) || new Date().toISOString(),
    updatedAt: (wifiUser?.updatedAt as string) || new Date().toISOString(),
    // Include PMS metadata
    guestId: wifiUser?.guestId as string | undefined,
    bookingId: wifiUser?.bookingId as string | undefined,
    status: (wifiUser?.status as string) || 'active',
    validUntil: wifiUser?.validUntil as string | undefined,
    userType: (wifiUser?.userType as string) || 'guest',
    fupPolicy,
  };
}

function getAllRADIUSUsers(): RADIUSUser[] {
  // Read from PMS WiFiUser table (includes guest check-in users AND manual users)
  const rows = db.query('SELECT username FROM WiFiUser ORDER BY createdAt DESC').all() as Array<{ username: string }>;
  const users = rows.map(r => getRADIUSUserByUsername(r.username)).filter((u): u is RADIUSUser => u !== null);
  return users;
}

function getRADIUSUserById(id: string): RADIUSUser | null {
  // Look up by WiFiUser id (PMS table)
  const wifiUser = db.query('SELECT username FROM WiFiUser WHERE id = ?').get(id) as { username: string } | null;
  if (!wifiUser) return null;
  return getRADIUSUserByUsername(wifiUser.username);
}

function createRADIUSUser(user: RADIUSUser): void {
  const now = new Date().toISOString();
  const id = user.id || generateId('user');

  // Default validUntil to 24 hours from now (NOT now — that would expire immediately).
  // The PMS provisioning-service sets a proper checkout-based validUntil.
  // CRITICAL: validUntil must be stored as millisecond integer (NOT ISO string)
  // for correct comparison in the auto-expiry timer (Date.now() vs numeric).
  const validUntil = user.validUntil || String(Date.now() + 24 * 60 * 60 * 1000);

  // Default tenantId and propertyId for manual user creation from GUI.
  // PMS provisioning-service always passes these explicitly.
  const tenantId = user.tenantId || 'tenant-1';
  const propertyId = user.propertyId || 'property-1';

  // Insert into PMS WiFiUser table (requires tenantId and propertyId — NOT NULL columns)
  db.query(`INSERT OR IGNORE INTO WiFiUser (id, tenantId, propertyId, username, password, status, validFrom, validUntil, radiusSynced, createdAt, updatedAt, guestId, bookingId, userType)
    VALUES (?, ?, ?, ?, ?, 'active', ?, ?, 1, ?, ?, ?, ?, ?)`
  ).run(id, tenantId, propertyId, user.username, user.password, now, validUntil, now, now, user.guestId || null, user.bookingId || null, user.userType || 'guest');

  // Insert password into radcheck (via prepared statement)
  db.query('DELETE FROM radcheck WHERE username = ? AND attribute = ?').run(user.username, 'Cleartext-Password');
  insertRadCheck.run(user.username, 'Cleartext-Password', ':=', user.password);

  // Insert attributes into radreply (via prepared statement)
  db.query('DELETE FROM radreply WHERE username = ?').run(user.username);
  for (const [attr, val] of Object.entries(user.attributes)) {
    insertRadReply.run(user.username, attr, '=', val);
  }

  // Insert group mapping
  if (user.group) {
    db.query('DELETE FROM radusergroup WHERE username = ?').run(user.username);
    insertRadUserGroup.run(user.username, user.group, 0);
  }
}

function updateRADIUSUser(id: string, updates: Partial<RADIUSUser>): RADIUSUser | null {
  const existing = getRADIUSUserById(id);
  if (!existing) return null;

  const username = existing.username;
  const updated: RADIUSUser = {
    ...existing,
    ...updates,
    attributes: updates.attributes ?? existing.attributes,
    updatedAt: new Date().toISOString(),
  };

  // Delete old entries from RADIUS tables
  db.query('DELETE FROM radcheck WHERE username = ?').run(username);
  db.query('DELETE FROM radreply WHERE username = ?').run(username);
  db.query('DELETE FROM radusergroup WHERE username = ?').run(username);

  // Update WiFiUser row (cannot use INSERT OR IGNORE — it won't update existing rows)
  // CRITICAL: validUntil must be stored as millisecond integer (NOT ISO string)
  // for correct comparison in the auto-expiry timer (Date.now() vs numeric).
  const validUntil = updated.validUntil || String(Date.now() + 24 * 60 * 60 * 1000);
  const now = new Date().toISOString();
  db.query(`UPDATE WiFiUser SET password = ?, status = ?, validUntil = ?, radiusSynced = 1, updatedAt = ?, userType = ?
    WHERE id = ?`).run(
    updated.password, 'active', validUntil, now, updated.userType || 'guest', id
  );

  // Re-insert RADIUS auth entries (radcheck, radreply, radusergroup)
  // Insert password into radcheck
  db.query('DELETE FROM radcheck WHERE username = ? AND attribute = ?').run(username, 'Cleartext-Password');
  insertRadCheck.run(username, 'Cleartext-Password', ':=', updated.password);

  // Insert attributes into radreply
  db.query('DELETE FROM radreply WHERE username = ?').run(username);
  for (const [attr, val] of Object.entries(updated.attributes || {})) {
    insertRadReply.run(username, attr, '=', val);
  }

  // Insert group mapping
  if (updated.group) {
    db.query('DELETE FROM radusergroup WHERE username = ?').run(username);
    insertRadUserGroup.run(username, updated.group, 0);
  }

  return updated;
}

function deleteRADIUSUser(id: string): boolean {
  const existing = getRADIUSUserById(id);
  if (!existing) return false;

  const username = existing.username;
  // Delete from all PMS tables
  db.query('DELETE FROM radcheck WHERE username = ?').run(username);
  db.query('DELETE FROM radreply WHERE username = ?').run(username);
  db.query('DELETE FROM radusergroup WHERE username = ?').run(username);
  db.query('DELETE FROM WiFiUser WHERE username = ?').run(username);

  return true;
}

// ---- FreeRADIUS Native SQL Group Functions ----

function getRADIUSGroupByName(name: string): RADIUSGroup | null {
  const checkRows = db.query('SELECT * FROM radgroupcheck WHERE groupname = ?').all(name) as Array<Record<string, unknown>>;
  const replyRows = db.query('SELECT * FROM radgroupreply WHERE groupname = ?').all(name) as Array<Record<string, unknown>>;

  if (checkRows.length === 0 && replyRows.length === 0) return null;

  const checkAttributes: Record<string, string> = {};
  const replyAttributes: Record<string, string> = {};

  for (const row of checkRows) {
    checkAttributes[row.attribute as string] = row.value as string;
  }
  for (const row of replyRows) {
    replyAttributes[row.attribute as string] = row.value as string;
  }

  return { name, checkAttributes, replyAttributes };
}

function getAllRADIUSGroups(): RADIUSGroup[] {
  const rows = db.query('SELECT DISTINCT groupname FROM radgroupcheck UNION SELECT DISTINCT groupname FROM radgroupreply')
    .all() as Array<{ groupname: string }>;
  return rows.map(r => getRADIUSGroupByName(r.groupname)).filter((g): g is RADIUSGroup => g !== null);
}

function createRADIUSGroup(group: RADIUSGroup): void {
  // Delete existing if present (idempotent)
  db.query('DELETE FROM radgroupcheck WHERE groupname = ?').run(group.name);
  db.query('DELETE FROM radgroupreply WHERE groupname = ?').run(group.name);

  for (const [attr, val] of Object.entries(group.checkAttributes)) {
    insertRadGroupCheck.run(group.name, attr, ':=', val);
  }
  for (const [attr, val] of Object.entries(group.replyAttributes)) {
    insertRadGroupReply.run(group.name, attr, '=', val);
  }
}

function deleteRADIUSGroup(name: string): boolean {
  const existing = getRADIUSGroupByName(name);
  if (!existing) return false;

  db.query('DELETE FROM radgroupcheck WHERE groupname = ?').run(name);
  db.query('DELETE FROM radgroupreply WHERE groupname = ?').run(name);

  return true;
}

// ============================================================================
// Auth Middleware
// ============================================================================

const AUTH_SECRET = process.env.RADIUS_SERVICE_AUTH_SECRET || '';

if (!AUTH_SECRET) {
  log.warn('No RADIUS_SERVICE_AUTH_SECRET set - API is open (dev mode). Set env var to enable authentication.');
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
 * Check if RADIUS server is installed and running (Rocky Linux 10: radiusd)
 */
async function checkRadiusStatus(): Promise<{
  installed: boolean;
  running: boolean;
  version?: string;
  error?: string;
}> {
  try {
    const { stdout: whichOutput } = await execAsync('which radiusd || echo "not_found"');

    if (whichOutput.trim() === 'not_found') {
      return {
        installed: false,
        running: false,
        error: 'RADIUS server is not installed on this system'
      };
    }

    let version = '';
    try {
      const { stdout } = await execAsync('radiusd -v 2>&1 | head -1');
      version = stdout.trim();
    } catch {
      version = 'Unknown';
    }

    try {
      // Use ss to check port 1812 (auth) — more reliable than ps aux
      const { stdout } = await execAsync('ss -ulnp 2>/dev/null | grep -F ":1812 " || ss -ulnp 2>/dev/null | grep -F ",1812 "');
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
/**
 * Resolve the RADIUS group name for an event user.
 * Priority:
 * 1. If the event has a planId → look up WiFi plan name → slugify it as group name
 * 2. If no plan or plan not found → fall back to slugified event name
 * 3. Ultimate fallback → 'standard-guests'
 */
function resolveEventGroupFromPlan(eventId: string, eventName: string): string {
  try {
    const event = db.query('SELECT planId FROM RadiusEvent WHERE id = ?').get(eventId) as { planId: string | null } | undefined;
    if (event?.planId) {
      const plan = db.query('SELECT name FROM WiFiPlan WHERE id = ? AND status = ?').get(event.planId, 'active') as { name: string } | undefined;
      if (plan?.name) {
        return plan.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'standard-guests';
      }
    }
  } catch {
    // DB lookup failed, fall through
  }
  // Fallback: use event name slug
  return (eventName || 'event')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '') || 'standard-guests';
}

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
 * Resolve tenantId and propertyId for INSERT operations.
 * Many tables have FK constraints on tenantId → Tenant(id) and propertyId → Property(id).
 * If the client doesn't send these fields, we query the DB for the first available record.
 */
function resolveTenantAndProperty(tenantId?: string, propertyId?: string): { tenantId: string; propertyId: string } {
  let resolvedTenantId = tenantId;
  if (!resolvedTenantId) {
    const firstTenant = db.query("SELECT id FROM Tenant LIMIT 1").get() as { id: string } | undefined;
    resolvedTenantId = firstTenant?.id || 'tenant-1';
  }
  let resolvedPropertyId = propertyId;
  if (!resolvedPropertyId) {
    const firstProp = db.query("SELECT id FROM Property LIMIT 1").get() as { id: string } | undefined;
    resolvedPropertyId = firstProp?.id || 'property-1';
  }
  return { tenantId: resolvedTenantId, propertyId: resolvedPropertyId };
}

/** Shortcut: resolve tenantId only */
function resolveTenantId(tenantId?: string): string {
  if (tenantId) return tenantId;
  const first = db.query("SELECT id FROM Tenant LIMIT 1").get() as { id: string } | undefined;
  return first?.id || 'tenant-1';
}

/**
 * StaySuite managed section markers for clients.conf
 */
const STAYSUITE_CLIENT_BEGIN = '# >>>>>> StaySuite managed NAS clients - DO NOT EDIT BETWEEN MARKERS <<<<<<';
const STAYSUITE_CLIENT_END = '# >>>>>> End StaySuite managed NAS clients <<<<<<';

/**
 * Write all NAS clients to RADIUS clients.conf
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
      if (client.ports.auth !== 1812) {
        managedLines.push(`    auth_port = ${client.ports.auth}`);
      }
      if (client.ports.acct !== 1813) {
        managedLines.push(`    acct_port = ${client.ports.acct}`);
      }
      if (client.ports.coa !== 3799) {
        managedLines.push(`    coa_port = ${client.ports.coa}`);
      }
      managedLines.push(`    nas_type = ${client.type}`);
      // BlastRADIUS protection — MikroTik sends Message-Authenticator, require it
      managedLines.push(`    require_message_authenticator = yes`);
      managedLines.push(`    limit_proxy_state = yes`);
      // CoA/DMR enabled — required for MikroTik bandwidth change, disconnect, etc.
      // Note: coa_server is NOT a boolean in FreeRADIUS 3.x; it expects a home_server name.
      // CoA works by default on the same server. response_window ensures timely CoA responses.
      managedLines.push(`    response_window = 6`);
      managedLines.push(`}`);
    }
    managedLines.push('');
    managedLines.push(STAYSUITE_CLIENT_END);
    const managedSection = managedLines.join('\n');

    // Read existing file or start empty
    let existingContent = '';
    try {
      existingContent = await fs.readFile(RADIUS_CLIENTS_PATH, 'utf-8');
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

    // Write clients.conf using base64+shell to ensure radiusd can read it
    try {
      const b64 = Buffer.from(newContent).toString('base64');
      execFileSync('/bin/sh', ['-c',
        `printf '%s' "${b64}" | base64 -d > "${RADIUS_CLIENTS_PATH}" && `
        + `chown radiusd:radiusd "${RADIUS_CLIENTS_PATH}" && `
        + `chmod 640 "${RADIUS_CLIENTS_PATH}"`
      ]);
    } catch (teeErr) {
      log.error('Failed to write clients.conf via base64+shell, falling back to fs.writeFile', { error: String(teeErr) });
      await fs.writeFile(RADIUS_CLIENTS_PATH, newContent, 'utf-8');
    }
    log.info('Wrote NAS clients to clients.conf', { count: clients.length, path: RADIUS_CLIENTS_PATH });

    // Trigger RADIUS reload
    await reloadRadius();

    return true;
  } catch (error) {
    log.error('Failed to write NAS clients to clients.conf', { error: String(error) });
    return false;
  }
}


/**
 * Reload RADIUS server via systemctl (Rocky Linux 10: radiusd)
 */
async function reloadRadius(): Promise<boolean> {
  // NOTE: Use 'restart' instead of 'reload' (HUP).
  // SIGHUP does NOT reinitialize the SQL module or its SQLite connection.
  // When we change /etc/raddb/mods-available/sql (busy_timeout, pool, queries),
  // a full restart is required for rlm_sql_sqlite to pick up the new settings.
  // Without restart, busy_timeout stays at default (200ms).
  //
  // Try multiple approaches because PM2 may run as root or non-root,
  // and 'sudo' may or may not be available.

  const commands = [
    'systemctl restart radiusd',        // Running as root, no sudo needed
    'systemctl restart radiusd.service', // Explicit service name
    '/usr/bin/systemctl restart radiusd', // Full path
    'sudo systemctl restart radiusd',     // Non-root with sudo
    '/usr/sbin/radiusd -Cxf /etc/raddb/radiusd.conf &', // Direct restart
  ];

  for (const cmd of commands) {
    try {
      await execAsync(`${cmd} 2>&1`, { timeout: 10000 });
      log.info(`RADIUS server RESTARTED via: ${cmd}`);
      return true;
    } catch (err) {
      // Try next approach
    }
  }

  // Last resort: kill and let systemd restart it
  try {
    const { stdout: pid } = await execAsync('cat /var/run/radiusd/radiusd.pid 2>/dev/null');
    if (pid.trim()) {
      await execAsync(`kill ${pid.trim()} 2>/dev/null`);
      log.info(`RADIUS server killed (PID ${pid.trim()}) — systemd should auto-restart`);
      return true;
    }
  } catch {
    // Ignore
  }

  log.error('ALL attempts to restart RADIUS server FAILED — busy_timeout config will NOT take effect until manual restart');
  log.error('Run manually: systemctl restart radiusd');
  return false;
}

// ============================================================================
// Vendor-Aware RADIUS Attribute Generation
// ============================================================================
//
// When a user authenticates, FreeRADIUS returns the attributes in radreply.
// The NAS (router/AP) only processes attributes it recognizes and ignores the rest.
// So we write RFC-standard attributes (work with ANY NAS) PLUS vendor-specific
// attributes based on the NAS vendor type from the nas table.
//
// Architecture:
//   1. RFC-standard attributes are ALWAYS written (Session-Timeout, WISPr-Bandwidth, Idle-Timeout)
//   2. Vendor-specific bandwidth/data-cap attributes are added based on the NAS vendor
//   3. When no vendor is known, we write both Mikrotik + ChilliSpot for maximum compatibility
//   4. The vendor is auto-detected from the first active NAS client in the nas table
//      or can be explicitly passed via the `vendor` field in the API body
// ============================================================================

/**
 * Look up ALL unique vendor types from active NAS clients.
 * Returns an array of distinct vendor types.
 * This is critical for multi-NAS environments where different
 * NAS devices (e.g., MikroTik + Cisco) serve the same users.
 * Each NAS recognizes its own VSAs and ignores others.
 */
function lookupAllNASVendors(): string[] {
  try {
    const rows = db.query("SELECT DISTINCT type FROM nas WHERE status = 'active'").all() as { type: string }[];
    if (!rows || rows.length === 0) return ['other'];
    return rows.map(r => r.type).filter(Boolean);
  } catch {
    return ['other'];
  }
}

/**
 * Look up the vendor type from the NAS table (legacy single-NAS helper).
 * Finds the first active NAS client and returns its type field.
 * Falls back to 'other' if no NAS is configured.
 * NOTE: Prefer lookupAllNASVendors() for multi-NAS environments.
 */
function lookupNASVendor(): string {
  const vendors = lookupAllNASVendors();
  return vendors[0] || 'other';
}

/**
 * Look up a specific NAS vendor by its IP address.
 * Used when the caller knows which NAS a user is connecting through.
 */
function lookupNASVendorByIP(nasIp: string): string {
  try {
    const row = db.query("SELECT type FROM nas WHERE nasname = ? AND status = 'active'").get(nasIp) as { type: string } | null;
    return row?.type || 'other';
  } catch {
    return 'other';
  }
}

/**
 * Normalize vendor string to a canonical attribute profile key.
 * Maps 200+ vendor identifiers to one of these profiles:
 *   mikrotik, cisco, aruba, chillispot, fortinet, huawei, juniper, wispr, other
 *
 * The profile determines which Vendor-Specific Attributes (VSAs) are generated.
 */
function normalizeVendor(vendor: string): string {
  // Strip ALL non-alphanumeric chars so "huawei_mme", "huawei-mme", "huawei mme" all become "huaweimme"
  const v = (vendor || 'other').toLowerCase().trim().replace(/[^a-z0-9]/g, '');

  // Fast-path: if already a canonical profile key, return directly
  const profiles = ['mikrotik', 'cisco', 'aruba', 'chillispot', 'fortinet', 'huawei', 'juniper', 'wispr', 'other'];
  if (profiles.includes(v)) return v;

  // ── Profile: mikrotik ──
  const mikrotik = ['mikrotik', 'mikrotikrouteros', 'routeros', 'mikrotikswitch', 'crs', 'switchos'];
  if (mikrotik.includes(v)) return 'mikrotik';

  // ── Profile: cisco ──
  const cisco = ['cisco', 'ciscomeraki', 'meraki', 'ciscowlc', 'ciscoios', 'ciscoasa',
    'ciscorevpn', 'ciscovpn', 'ciscoisg', 'ciscomerakims', 'ciscocucm', 'ciscocme'];
  if (cisco.includes(v)) return 'cisco';

  // ── Profile: aruba ──
  const aruba = ['aruba', 'arubahpe', 'hpe', 'arubaclearpass', 'clearpass',
    'hpprocurve', 'hpeofficeconnect', 'colubris'];
  if (aruba.includes(v)) return 'aruba';

  // ── Profile: chillispot (CoovaChilli, pfSense, OpenWRT, DD-WRT, WiFiDog, etc.) ──
  const chillispot = ['coovachilli', 'chilli', 'coova', 'chillispot', 'pfsense', 'opnsense',
    'openwrt', 'ddwrt', 'wifidog', 'wifidogng', 'openmesh', 'cloudtrax',
    'eduroam', 'captiveportal', 'captive', 'untangle', 'smoothwall', 'clearos',
    'endian', 'ipsecgeneric', 'sslvpngeneric',
    'openvpn', 'wireguard', 'mypublicwifi', 'wifisplash', 'guestgate', 'wifigate',
    'handlink', 'wifiplus', 'aquipia', 'velox',
    'fon', 'gowex', 'socialwifi', 'purplewifi', 'cloud4wifi',
    'bintec', 'elmeg', 'kerio', 'stonesoft', 'forcepoint', 'clavister', 'cyberguard',
    'sputnik', 'wifika', 'patronsoft', 'antlabs', 'firstspot', 'wirelesslogic',
    'wifiglobal', 'iwire', 'mywifi', 'nomadix',
    'alepo', 'aptilo', 'ipass', 'devicescape', 'boingo', 'deepedge'];
  if (chillispot.includes(v)) return 'chillispot';

  // ── Profile: fortinet ──
  const fortinet = ['fortinet', 'fortigate', 'fortiwifi', 'fortinetvpn',
    'forticlient', 'fortisslvpn', 'sangfor', 'deepsecure', 'hillstone'];
  if (fortinet.includes(v)) return 'fortinet';

  // ── Profile: huawei ──
  const huawei = ['huawei', 'airengine', 'huaweimea', 'huaweimme', 'huaweiims',
    'huaweime60', 'huaweiugw', 'fiberhome', 'fiberhomean5000'];
  if (huawei.includes(v)) return 'huawei';

  // ── Profile: juniper ──
  const juniper = ['juniper', 'junipermist', 'mist', 'junipersrx',
    'junipere', 'juniperive', 'pulsesecure',
    'netscreen', 'ive', 'erx'];
  if (juniper.includes(v)) return 'juniper';

  // ── Profile: wispr (WISPr-native vendors — just use RFC WISPr attributes) ──
  const wispr = [
    // WiFi
    'unifi', 'ubiquiti', 'ubiquitiunifi', 'ubiquitiedgerouter',
    'ruckus', 'ruckuscommcope', 'commcope',
    'tplink', 'tplinkomada', 'omada', 'tplinkswitch',
    'netgear', 'netgearinsight', 'orbi', 'netgearswitch',
    'dlink', 'dlinknuclias', 'nuclias',
    'ruijie', 'ruijienetworks', 'reyee',
    'cambium', 'cnpilot', 'emp',
    'grandstream', 'gwn', 'grandstreampbx',
    'engenius', 'zyxel', 'nwa', 'zyxelswitch', 'zyxelnxc',
    'alcatel', 'nokia', 'alcatellucent', 'nokiaips',
    'extreme', 'extremenetworks', 'aerohive', 'hivemanager', 'enterasys',
    'xirrus', 'xirrusarray', 'bluesocket', 'trapeze', 'wavelink', 'telxon',
    'symbol', 'proxim', 'orinoco', 'breezecom', 'breezenet',
    'intellinet', 'nfon', 'buffalo', 'airstation',
    'asus', 'asuswrt', 'merlin',
    'edgecore', 'accton', 'altai', 'wili', 'wilimesh',
    'samsung', 'zte', 'ztemme', 'ztebras', 'ztebrass', 'brocade',
    'motorola', 'draytek', 'peplink', 'speedfusion', 'sophos',
    'avaya', 'avayacmu', 'dell', 'dellforce10', 'force10',
    'foundry', 'smc', 'perle', 'opengear', 'ubiquti', 'mellanox', 'nvidia',
    'arista', 'cumulus', 'alliedtelesis',
    'meru', 'adckentrox',
    // Firewall
    'paloalto', 'checkpoint', 'sonicwall', 'watchguard', 'barracuda', 'barracudavpn',
    'redcreek', 'ravlin',
    // VPN
    'f5bigip', 'f5', 'citrix', 'netscaler', 'array', 'avedia',
    // RADIUS servers (proxy mode — WISPr passthrough)
    'freeradius', 'microsoftnps', 'ciscoacs', 'ciscoise',
    'rsa', 'rsasecurid', 'radiator', 'openradius', 'tacacsgeneric',
    // IoT
    'sierrawireless', 'airlink', 'teltonika', 'moxa', 'nport',
    'digi', 'diginternational', 'lantronix', 'inhand', 'quectel', 'ublox',
    'simcom', 'simtech', 'neoway', 'sequans', 'multitech', 'multiconnect',
    'robustel', 'fourfaith', 'f2x',
    // Telecom
    'ericssonmme', 'ericssonse', 'smartedge',
    'nokiamme', 'nsn', 'stm', 'starent', 'staros',
    'broadsoft', 'genband', 'ribbon', 'metaswitch', 'sonus', 'sbc',
    'audiocodes', 'mediant', 'inventel', 'efficientip',
    'vodafone', 'telekom', 'orange', 'att', 'verizon',
    'chinatelecom', 'chinamobile', 'chinaunicom',
    'bsnl', 'jio', 'reliance', 'airtel', 'bharti',
    // PBX/VoIP
    'sangoma', 'freepbx', 'digium', 'asterisk', 'mitel', 'mivoice', 'yealink',
    'polycom',
    // ISP/BRAS
    'redback', 'broadband', 'ciscoiosbras', 'ascend', 'lucent',
    'nortel', 'shasta', 'paradigm', 'shiva', 'livingston',
    'alcatelisam',
    '3com', 'h3c',
  ];
  if (wispr.includes(v)) return 'wispr';

  // Fallback
  return 'other';
}

/**
 * Generate vendor-specific bandwidth attributes.
 * RFC-standard WISPr attributes are ALWAYS included.
 * Vendor-specific attributes are added on top.
 *
 * @param downloadBps - Download speed in bits per second
 * @param uploadBps - Upload speed in bits per second
 * @param vendor - Normalized vendor key (mikrotik, cisco, aruba, etc.)
 * @returns Record of RADIUS attribute name → value
 */
function generateBandwidthAttributes(downloadBps: number, uploadBps: number, vendor: string): Record<string, string> {
  const attrs: Record<string, string> = {};

  // RFC-standard WISPr attributes — recognized by most WiFi gateways
  attrs['WISPr-Bandwidth-Max-Down'] = String(downloadBps);
  attrs['WISPr-Bandwidth-Max-Up'] = String(uploadBps);

  const downloadMbps = Math.round(downloadBps / 1000000);
  const uploadMbps = Math.round(uploadBps / 1000000);

  switch (vendor) {
    case 'mikrotik':
      attrs['Mikrotik-Rate-Limit'] = `${downloadMbps}M/${uploadMbps}M`;
      break;

    case 'cisco':
      attrs['Cisco-AVPair'] = `sub:Ingress-Committed-Data-Rate=${uploadBps}\nsub:Egress-Committed-Data-Rate=${downloadBps}`;
      break;

    case 'aruba':
      attrs['Aruba-User-Role'] = 'guest';
      break;

    case 'chillispot':
      attrs['ChilliSpot-Bandwidth-Max-Down'] = String(downloadBps);
      attrs['ChilliSpot-Bandwidth-Max-Up'] = String(uploadBps);
      break;

    case 'fortinet':
      attrs['Fortinet-Group'] = 'guest-wifi';
      break;

    case 'huawei':
      // Huawei AirEngine uses WISPr natively — the WISPr attrs above are sufficient
      break;

    case 'juniper':
      // Juniper uses WISPr natively for wireless
      break;

    case 'wispr':
      // Vendor natively supports WISPr — the WISPr attrs above are sufficient
      break;

    default:
      // Unknown vendor: write ChilliSpot attrs for broad compatibility.
      // Do NOT write Mikrotik-specific attrs — we don't know if the NAS is Mikrotik.
      // WISPr attrs are already included above as the universal baseline.
      attrs['ChilliSpot-Bandwidth-Max-Down'] = String(downloadBps);
      attrs['ChilliSpot-Bandwidth-Max-Up'] = String(uploadBps);
      break;
  }

  return attrs;
}

/**
 * Generate vendor-specific session timeout and data limit attributes.
 * Session-Timeout (RFC 2865) is ALWAYS included.
 * Vendor-specific data cap attributes are added based on vendor.
 *
 * @param timeoutMinutes - Session timeout in minutes (0 = unlimited)
 * @param dataLimitMB - Data limit in MB (0 = unlimited)
 * @param vendor - Normalized vendor key
 * @returns Record of RADIUS attribute name → value
 */
function generateSessionAttributes(timeoutMinutes: number, dataLimitMB: number, vendor: string): Record<string, string> {
  const attrs: Record<string, string> = {};

  // RFC-standard Session-Timeout (RFC 2865) — recognized by ALL NAS devices
  if (timeoutMinutes > 0) {
    attrs['Session-Timeout'] = String(timeoutMinutes * 60);
  }

  // No data limit — nothing more to add
  if (!dataLimitMB || dataLimitMB <= 0) {
    return attrs;
  }

  const dataLimitBytes = dataLimitMB * 1024 * 1024;

  switch (vendor) {
    case 'mikrotik':
      attrs['Mikrotik-Total-Limit'] = String(dataLimitBytes);
      break;

    case 'cisco':
      if (!attrs['Cisco-AVPair']) {
        attrs['Cisco-AVPair'] = '';
      }
      attrs['Cisco-AVPair'] += `sub:quota-in=${dataLimitBytes}\nsub:quota-out=${dataLimitBytes}`;
      break;

    case 'aruba':
      // Aruba data limits enforced via ClearPass policies — no direct data cap VSA
      break;

    case 'chillispot':
      attrs['ChilliSpot-Max-Total-Octets'] = String(dataLimitBytes);
      attrs['ChilliSpot-Max-Input-Octets'] = String(dataLimitBytes);
      attrs['ChilliSpot-Max-Output-Octets'] = String(dataLimitBytes);
      break;

    case 'fortinet':
      attrs['Fortinet-Group'] = 'guest-wifi';
      break;

    case 'huawei':
    case 'juniper':
    case 'wispr':
      // These vendors use WISPr natively or have no specific data cap VSA
      break;

    default:
      // Unknown vendor: write ChilliSpot attrs for broad compatibility.
      // Do NOT write Mikrotik-specific attrs — we don't know if the NAS is Mikrotik.
      attrs['ChilliSpot-Max-Total-Octets'] = String(dataLimitBytes);
      attrs['ChilliSpot-Max-Input-Octets'] = String(dataLimitBytes);
      attrs['ChilliSpot-Max-Output-Octets'] = String(dataLimitBytes);
      break;
  }

  return attrs;
}

/**
 * Generate RADIUS attributes for a SINGLE vendor.
 * Combines bandwidth + session attributes for one vendor profile.
 *
 * @param params - User plan parameters + vendor
 * @returns Record of RADIUS attribute name → value
 */
function generateSingleVendorAttributes(params: {
  downloadBps: number;
  uploadBps: number;
  sessionTimeoutMinutes: number;
  dataLimitMB: number;
  idleTimeoutMinutes?: number;
  vendor: string;
}): Record<string, string> {
  const vendor = normalizeVendor(params.vendor);

  // Generate vendor-specific bandwidth attributes
  const bwAttrs = generateBandwidthAttributes(params.downloadBps, params.uploadBps, vendor);

  // Generate vendor-specific session/data-limit attributes
  const sessionAttrs = generateSessionAttributes(params.sessionTimeoutMinutes, params.dataLimitMB, vendor);

  // Merge
  const merged: Record<string, string> = {};
  for (const [k, v] of Object.entries(sessionAttrs)) {
    merged[k] = v;
  }
  for (const [k, v] of Object.entries(bwAttrs)) {
    if (k === 'Cisco-AVPair' && merged['Cisco-AVPair']) {
      merged[k] = merged[k] + '\n' + v;
    } else {
      merged[k] = v;
    }
  }

  if (params.idleTimeoutMinutes && params.idleTimeoutMinutes > 0) {
    merged['Idle-Timeout'] = String(params.idleTimeoutMinutes * 60);
  }

  return merged;
}

/**
 * Generate all RADIUS reply attributes for a user based on their plan.
 *
 * MULTI-NAS SUPPORT:
 * When multiple NAS clients with different vendors exist (e.g., MikroTik + Cisco),
 * this function generates Vendor-Specific Attributes (VSAs) for EACH active NAS vendor.
 * Each NAS recognizes its own VSAs and ignores attributes it doesn't understand.
 *
 * How it works:
 *   1. RFC-standard attributes (Session-Timeout, WISPr-Bandwidth-Max-*) are ALWAYS included
 *   2. For EACH active NAS vendor type, vendor-specific VSAs are generated:
 *      - MikroTik → Mikrotik-Rate-Limit, Mikrotik-Total-Limit
 *      - Cisco → Cisco-AVPair (bandwidth + quota)
 *      - ChilliSpot → ChilliSpot-Bandwidth-Max-*, ChilliSpot-Max-Total-Octets
 *      - etc.
 *   3. When a user connects to a Cisco NAS, FreeRADIUS sends ALL stored attributes.
 *      Cisco processes Cisco-AVPair and ignores Mikrotik-Total-Limit.
 *      When the same user connects to a MikroTik NAS, MikroTik processes its VSAs and ignores Cisco-AVPair.
 *
 * @param params - User plan parameters
 * @param params.vendor - Optional explicit vendor (single-NAS mode)
 * @param params.nasIp - Optional specific NAS IP (look up that NAS's vendor)
 * @returns Merged Record of all RADIUS attributes
 */
function generateVendorAttributes(params: {
  downloadBps: number;
  uploadBps: number;
  sessionTimeoutMinutes: number;
  dataLimitMB: number;
  idleTimeoutMinutes?: number;
  vendor?: string;
  nasIp?: string;
}): Record<string, string> {
  // Determine which vendor(s) to generate attributes for
  let vendors: string[];

  if (params.nasIp) {
    // Mode 1: Specific NAS IP — generate for that NAS's vendor only
    const nasVendor = lookupNASVendorByIP(params.nasIp);
    vendors = [normalizeVendor(nasVendor)];
  } else if (params.vendor) {
    // Mode 2: Explicit single vendor (legacy / backward compat)
    vendors = [normalizeVendor(params.vendor)];
  } else {
    // Mode 3: Auto-detect ALL active NAS vendors (multi-NAS mode)
    const allNasVendors = lookupAllNASVendors();
    // Deduplicate after normalization
    const seen = new Set<string>();
    vendors = [];
    for (const v of allNasVendors) {
      const normalized = normalizeVendor(v);
      if (!seen.has(normalized)) {
        seen.add(normalized);
        vendors.push(normalized);
      }
    }
    if (vendors.length === 0) vendors = ['other'];
  }

  // Generate and merge attributes for ALL vendors
  // Start with the first vendor (provides the RFC-standard WISPr + Session-Timeout base)
  const merged = generateSingleVendorAttributes({
    ...params,
    vendor: vendors[0],
  });

  // For additional vendors, merge ONLY their vendor-specific VSAs
  // (skip RFC-standard attrs like Session-Timeout and WISPr-Bandwidth-Max-* to avoid duplicates)
  for (let i = 1; i < vendors.length; i++) {
    const extraAttrs = generateSingleVendorAttributes({
      ...params,
      vendor: vendors[i],
    });
    for (const [k, v] of Object.entries(extraAttrs)) {
      // Only add vendor-specific attributes, skip RFC-standard ones
      if (k.startsWith('WISPr-') || k === 'Session-Timeout' || k === 'Idle-Timeout') continue;
      // Special merge for Cisco-AVPair (append instead of overwrite)
      if (k === 'Cisco-AVPair' && merged['Cisco-AVPair']) {
        merged[k] = merged[k] + '\n' + v;
      } else {
        merged[k] = v;
      }
    }
  }

  log.info('Generated multi-vendor RADIUS attributes', {
    vendors,
    vendorCount: vendors.length,
    downloadBps: params.downloadBps,
    uploadBps: params.uploadBps,
    sessionTimeout: params.sessionTimeoutMinutes,
    dataLimitMB: params.dataLimitMB,
    totalAttributes: Object.keys(merged).length,
    attributeNames: Object.keys(merged),
  });

  return merged;
}

// ============================================================================
// Health Check
// ============================================================================

app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    service: 'radius-service',
    version: SERVICE_VERSION,
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    port: PORT,
    memoryUsage: process.memoryUsage(),
  });
});

// SQLite diagnostic — verify WAL mode, busy_timeout, and lock status
app.get('/api/diag/sqlite', (c) => {
  const diags: Record<string, unknown> = {};
  try {
    const journalMode = db.query("PRAGMA journal_mode").get() as { journal_mode: string };
    diags.journal_mode = journalMode?.journal_mode;

    const busyTimeout = db.query("PRAGMA busy_timeout").get() as { busy_timeout: number };
    diags.busy_timeout_ms = busyTimeout?.busy_timeout;

    const walAutocheckpoint = db.query("PRAGMA wal_autocheckpoint").get() as { wal_autocheckpoint: number };
    diags.wal_autocheckpoint = walAutocheckpoint?.wal_autocheckpoint;

    // Check WAL file size
    const walPath = SQLITE_DB_PATH + '-wal';
    const shmPath = SQLITE_DB_PATH + '-shm';
    try {
      const walStat = fsSync.statSync(walPath);
      diags.wal_file_size_bytes = walStat.size;
    } catch {
      diags.wal_file_size_bytes = 0;
    }
    try {
      const shmStat = fsSync.statSync(shmPath);
      diags.shm_file_size_bytes = shmStat.size;
    } catch {
      diags.shm_file_size_bytes = 0;
    }

    // Test write lock by doing a quick read
    const testQuery = db.query("SELECT COUNT(*) as cnt FROM radacct").get() as { cnt: number } | undefined;
    diags.radacct_count = testQuery?.cnt ?? 0;

    // Check for active connections/locks
    const lockedRows = db.query("PRAGMA database_list").all();
    diags.database_list = lockedRows;

    diags.db_path = SQLITE_DB_PATH;
    diags.status = 'ok';
  } catch (err) {
    diags.status = 'error';
    diags.error = String(err);
  }

  return c.json({ success: true, data: diags });
});

// ============================================================================
// Service Status & Control
// ============================================================================

app.get('/api/status', async (c) => {
  const status = await checkRadiusStatus();
  const nasClients = getAllNASClients();
  const radiusUsers = getAllRADIUSUsers();
  const radiusGroups = getAllRADIUSGroups();
  return c.json({
    success: true,
    data: {
      ...status,
      mode: status.installed ? 'production' : 'not_installed',
      nasClientCount: nasClients.length,
      userCount: radiusUsers.length,
      groupCount: radiusGroups.length,
    }
  });
});

app.post('/api/service/start', async (c) => {
  try {
    const status = await checkRadiusStatus();
    if (!status.installed) {
      return c.json({
        success: false,
        error: 'FreeRADIUS is not installed. Install it with: dnf install -y freeradius freeradius-utils',
        mode: 'not_installed'
      });
    }

    await execAsync('sudo systemctl start radiusd');
    serviceStatus = 'running';

    return c.json({
      success: true,
      message: 'RADIUS service started',
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
    const status = await checkRadiusStatus();
    if (!status.installed) {
      return c.json({
        success: false,
        error: 'FreeRADIUS is not installed. Install it with: dnf install -y freeradius freeradius-utils',
        mode: 'not_installed'
      });
    }

    await execAsync('sudo systemctl stop radiusd');
    serviceStatus = 'stopped';

    return c.json({
      success: true,
      message: 'RADIUS service stopped',
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
    const status = await checkRadiusStatus();
    if (!status.installed) {
      return c.json({
        success: false,
        error: 'FreeRADIUS is not installed. Install it with: dnf install -y freeradius freeradius-utils',
        mode: 'not_installed'
      });
    }

    await execAsync('sudo systemctl restart radiusd');
    serviceStatus = 'running';

    return c.json({
      success: true,
      message: 'RADIUS service restarted',
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
      id: '', // placeholder — will be set after auto-increment
      name: body.name,
      ipAddress: body.ipAddress,
      sharedSecret: body.sharedSecret || generateSharedSecret(),
      shortname: body.shortname || body.name.replace(/\s+/g, '_').toLowerCase(),
      type: body.type || 'other',
      ports: {
        auth: body.authPort || 1812,
        acct: body.acctPort || 1813,
        coa: body.coaPort || 3799
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Persist to SQLite — returns auto-generated integer ID
    const newId = createNASClient(client);
    client.id = String(newId);

    // Write to RADIUS clients.conf
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

    // Write updated clients to RADIUS clients.conf
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

  // Write updated clients to RADIUS clients.conf
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

    // Build vendor-aware RADIUS attributes
    // Multi-NAS mode: If no specific vendor/nasIp is provided, auto-detects ALL active
    // NAS vendors and generates VSAs for each. Each NAS recognizes its own attributes
    // and ignores the rest, so one user works across all NAS types simultaneously.
    const vendorAttrs = generateVendorAttributes({
      downloadBps: (body.downloadSpeed || 10) * 1000000,
      uploadBps: (body.uploadSpeed || 10) * 1000000,
      sessionTimeoutMinutes: body.sessionTimeout ?? 1440,
      dataLimitMB: body.dataLimit ?? 0,
      idleTimeoutMinutes: body.idleTimeout,
      // If a specific NAS IP or vendor is provided, use single-vendor mode
      // Otherwise, multi-NAS mode auto-detects all active NAS vendors
      nasIp: body.nasIp,
      vendor: body.vendor || body.nasVendor || undefined,
    });

    const user: RADIUSUser = {
      id: generateId('user'),
      username: body.username,
      password: body.password,
      group: body.group,
      attributes: { ...body.attributes, ...vendorAttrs },
      tenantId: body.tenantId || 'tenant-1',
      propertyId: body.propertyId || 'property-1',
      validUntil: body.validUntil,
      guestId: body.guestId,
      bookingId: body.bookingId,
      userType: body.userType || 'guest',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Persist to SQLite
    createRADIUSUser(user);

    return c.json({
      success: true,
      data: user,
      message: 'RADIUS user created successfully',
      attributes: Object.keys(user.attributes),
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

    const existing = getRADIUSUserById(id);
    if (!existing) {
      return c.json({ success: false, error: 'User not found' }, 404);
    }

    // Detect vendor and rebuild attributes from form fields
    // Multi-NAS mode: Auto-detects ALL active NAS vendors and generates VSAs for each
    const vendorAttrs = generateVendorAttributes({
      downloadBps: (body.downloadSpeed || 10) * 1000000,
      uploadBps: (body.uploadSpeed || 10) * 1000000,
      sessionTimeoutMinutes: body.sessionTimeout ?? 1440,
      dataLimitMB: body.dataLimit ?? 0,
      idleTimeoutMinutes: body.idleTimeout,
      nasIp: body.nasIp,
      vendor: body.vendor || body.nasVendor || undefined,
    });

    const updated = updateRADIUSUser(id, {
      ...body,
      attributes: vendorAttrs,
    });
    if (!updated) {
      return c.json({ success: false, error: 'User not found' }, 404);
    }

    return c.json({
      success: true,
      data: updated,
      message: 'RADIUS user updated successfully',
      attributes: Object.keys(vendorAttrs),
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


  return c.json({
    success: true,
    message: 'RADIUS user deleted successfully'
  });
});

// ============================================================================
// RADIUS Groups (radgroupcheck, radgroupreply)
// ============================================================================

app.get('/api/groups', (c) => {
  // Default groups for hospitality — uses RFC-standard WISPr attributes only
  // Vendor-specific attributes are added at user creation time based on the active NAS vendor
  const defaultGroups: RADIUSGroup[] = [
    {
      name: 'premium-guests',
      checkAttributes: {
        'Auth-Type': 'Local'
      },
      replyAttributes: {
        'WISPr-Bandwidth-Max-Down': '51200000', // 50 Mbps in bps
        'WISPr-Bandwidth-Max-Up': '25600000',   // 25 Mbps
        'Session-Timeout': '86400',             // 24 hours
        'Idle-Timeout': '1800',                // 30 min idle
      }
    },
    {
      name: 'standard-guests',
      checkAttributes: {
        'Auth-Type': 'Local'
      },
      replyAttributes: {
        'WISPr-Bandwidth-Max-Down': '10000000', // 10 Mbps in bps
        'WISPr-Bandwidth-Max-Up': '5000000',    // 5 Mbps
        'Session-Timeout': '86400',             // 24 hours
        'Idle-Timeout': '1800',                // 30 min idle
      }
    },
    {
      name: 'basic-guests',
      checkAttributes: {
        'Auth-Type': 'Local'
      },
      replyAttributes: {
        'WISPr-Bandwidth-Max-Down': '2000000',  // 2 Mbps in bps
        'WISPr-Bandwidth-Max-Up': '1000000',    // 1 Mbps
        'Session-Timeout': '86400',             // 24 hours
        'Idle-Timeout': '1800',                // 30 min idle
      }
    },
    {
      name: 'staff',
      checkAttributes: {
        'Auth-Type': 'Local'
      },
      replyAttributes: {
        'WISPr-Bandwidth-Max-Down': '100000000', // 100 Mbps in bps
        'WISPr-Bandwidth-Max-Up': '50000000',    // 50 Mbps
        'Session-Timeout': '0',                 // No limit
        'Idle-Timeout': '0',                    // No idle limit
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

    // Try actual radtest command first (use execFileSync with array args to prevent shell injection)
    try {
      // Validate inputs to prevent command injection
      const safeUsername = String(username || 'test').replace(/[^a-zA-Z0-9_.@-]/g, '');
      const safePassword = String(password || 'test').replace(/[^a-zA-Z0-9_.@!#$%^&*()-]/g, '');
      const safeNasIp = String(nasIp || '127.0.0.1').replace(/[^0-9.:a-fA-F]/g, '');
      const safePort = Number(authPort) || 1812;
      const safeSecret = String(sharedSecret || 'testing123').replace(/[^a-zA-Z0-9_.@!#$%^&*()-]/g, '');

      const { stdout, stderr } = await execAsync(
        `radtest ${safeUsername} ${safePassword} ${safeNasIp}:${safePort} 0 ${safeSecret} 2>&1`,
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
      db.query('DELETE FROM nas').run();
      for (const n of body.nas as NASClient[]) {
        const client: NASClient = {
          ...n,
          updatedAt: new Date().toISOString()
        };
        createNASClient(client);
      }
    }

    if (body.users) {
      // Clear existing user data from all related tables
      db.query('DELETE FROM radcheck').run();
      db.query('DELETE FROM radreply').run();
      db.query('DELETE FROM radusergroup').run();
      // Only delete from tables that exist
      try { db.query('DELETE FROM user_metadata').run(); } catch { /* table may not exist */ }
      for (const u of body.users as RADIUSUser[]) {
        const user: RADIUSUser = {
          ...u,
          updatedAt: new Date().toISOString()
        };
        createRADIUSUser(user);
      }
    }

    if (body.groups) {
      // Clear existing group data
      db.query('DELETE FROM radgroupcheck').run();
      db.query('DELETE FROM radgroupreply').run();
      for (const g of body.groups as RADIUSGroup[]) {
        createRADIUSGroup(g);
      }
    }

    await writeAllNASClientsToConf();

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
// Config Sync — force regeneration of all RADIUS config files
// ============================================================================

/**
 * Sync all RADIUS config files from SQLite database.
 * Called on startup and available via /api/sync endpoint.
 */
async function syncAllConfigFiles(): Promise<void> {
  log.info('Starting RADIUS config sync from SQLite database');
  const clientResult = await writeAllNASClientsToConf();
  log.info('RADIUS config sync complete', { clients: clientResult });
}

app.post('/api/sync', async (c) => {
  try {
    await syncAllConfigFiles();
    // Also re-run SQL setup to ensure FreeRADIUS config is current
    const sqlResult = await setupFreeRadiusSQL();
    return c.json({
      success: true,
      message: 'RADIUS config files synced from database',
      sqlSetup: sqlResult.success ? sqlResult.details : sqlResult.error,
    });
  } catch (error) {
    return c.json({
      success: false,
      error: String(error)
    }, 500);
  }
});

// ============================================================================
// Guest Provisioning (auto-provision for check-in/check-out)
// ============================================================================

app.post('/api/provision', async (c) => {
  try {
    const body = await c.req.json();
    const { username, password, group, downloadSpeed, uploadSpeed, sessionTimeout, dataLimit, guestId, bookingId, validUntil } = body;

    if (!username || !password) {
      return c.json({ success: false, error: 'username and password are required' }, 400);
    }

    // Check if user already exists
    const existing = getRADIUSUserByUsername(username);
    if (existing) {
      return c.json({ success: false, error: 'User already exists', data: existing }, 409);
    }

    const now = new Date().toISOString();
    const attributes: Record<string, string> = {};

    // Add bandwidth + session attributes via vendor-aware generator
    if (downloadSpeed || uploadSpeed || sessionTimeout || dataLimit) {
      const vendorAttrs = generateVendorAttributes({
        downloadBps: (downloadSpeed || 10) * 1000000,
        uploadBps: (uploadSpeed || 10) * 1000000,
        sessionTimeoutMinutes: sessionTimeout || 1440,
        dataLimitMB: dataLimit || 1000,
      });
      Object.assign(attributes, vendorAttrs);
    }

    const user: RADIUSUser = {
      id: generateId('user'),
      username,
      password,
      group: group || 'standard-guests',
      attributes,
      validUntil: validUntil ? String(new Date(validUntil).getTime()) : undefined,
      guestId: guestId || undefined,
      bookingId: bookingId || undefined,
      createdAt: now,
      updatedAt: now,
    };

    createRADIUSUser(user);

    return c.json({
      success: true,
      data: {
        ...user,
        provisionedAt: now,
      },
      message: 'RADIUS user provisioned successfully',
    });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

app.delete('/api/provision/:username', async (c) => {
  try {
    const { username } = c.req.param();

    // Find user by username and delete all entries (hard delete)
    const existing = getRADIUSUserByUsername(username);
    if (!existing) {
      return c.json({ success: false, error: 'User not found' }, 404);
    }

    // Use native lowercase table names (matching FreeRADIUS schema)
    // but being explicit avoids issues on case-sensitive filesystems.
    db.query('DELETE FROM radcheck WHERE username = ?').run(username);
    db.query('DELETE FROM radreply WHERE username = ?').run(username);
    db.query('DELETE FROM radusergroup WHERE username = ?').run(username);
    db.query('DELETE FROM WiFiUser WHERE username = ?').run(username);

    log.info(`Deprovisioned RADIUS user: ${username}`);

    return c.json({
      success: true,
      message: 'RADIUS user deprovisioned successfully',
      data: { username, deprovisionedAt: new Date().toISOString() },
    });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ============================================================================
// FreeRADIUS SQL Module Configuration
// ============================================================================

app.get('/api/config/sql-mod', (c) => {
  const sqlModConfig = `sql {
    driver = "rlm_sql_sqlite"
    sqlite {
        filename = "${SQLITE_DB_PATH}"
        # Wait up to 30 seconds for write lock — avoids SQLITE_BUSY when
        # the Bun freeradius-service or Prisma hold a concurrent write transaction.
        busy_timeout = 30000
    }
    dialect = "sqlite"

    # SQLite is single-writer — MUST use a single connection.
    # Multiple connections fight for the write lock, causing SQLITE_BUSY,
    # and the pool manager destroys active connections mid-query.
    pool {
        start = 1
        min = 1
        max = 1
        spare = 0
        uses = 0
        lifetime = 0
        idle_timeout = 0
        connect_timeout = 30.0
    }

    sql_user_name = "%{User-Name}"

    # NOTE: No AND isActive = 1 filter — deprovisioning DELETES records instead of soft-deleting.
    # This allows guests to disconnect/reconnect from hotspot without re-provisioning.
    authorize_check_query = "SELECT id, username, attribute, value, op FROM radcheck WHERE username = '%{SQL-User-Name}' ORDER BY id"
    authorize_reply_query = "SELECT id, username, attribute, value, op FROM radreply WHERE username = '%{SQL-User-Name}' ORDER BY id"
    group_membership_query = "SELECT groupname, priority FROM radusergroup WHERE username = '%{SQL-User-Name}' ORDER BY priority"
    authorize_group_check_query = "SELECT id, groupname, attribute, value, op FROM radgroupcheck WHERE groupname = '%{Sql-Group}' ORDER BY id"
    authorize_group_reply_query = "SELECT id, groupname, attribute, value, op FROM radgroupreply WHERE groupname = '%{Sql-Group}' ORDER BY id"

    simul_count_query = "SELECT COUNT(*) FROM radacct WHERE username = '%{SQL-User-Name}' AND acctstoptime IS NULL"
    simul_verify_query = "SELECT radacctid, acctsessionid, username, nasipaddress, framedipaddress, calledstationid, callingstationid FROM radacct WHERE username = '%{SQL-User-Name}' AND acctstoptime IS NULL"

    accounting {
        # radacctid is now INTEGER PRIMARY KEY AUTOINCREMENT — no explicit value needed.
        # Uses acctupdatetime (native FreeRADIUS) instead of updatedAt.
        # Includes all native FreeRADIUS columns plus PMS extras.
        query = "INSERT INTO radacct (acctsessionid, acctuniqueid, username, realm, nasipaddress, nasportid, nasporttype, acctstarttime, acctupdatetime, acctsessiontime, acctinterval, connectinfo_start, servicetype, framedprotocol, framedipaddress, framedipv6prefix, framedinterfaceid, delegatedipv6prefix, calledstationid, callingstationid, acctinputoctets, acctoutputoctets, acctinputpackets, acctoutputpackets, acctinputgigawords, acctoutputgigawords, class, acctstoptime, acctterminatecause, acctstatus, createdAt, updatedAt) VALUES ('%{Acct-Session-Id}', '%{Acct-Unique-Session-Id}', '%{SQL-User-Name}', '%{Realm}', '%{NAS-IP-Address}', '%{%{NAS-Port-ID}:-%{NAS-Port}}', '%{NAS-Port-Type}', '%S', '%S', %{%{Acct-Session-Time}:-0}, %{%{Acct-Interim-Interval}:-0}, '%{Connect-Info}', '%{Service-Type}', '%{Framed-Protocol}', '%{Framed-IP-Address}', '%{Framed-IPv6-Prefix}', '%{Framed-Interface-Id}', '%{Delegated-IPv6-Prefix}', '%{Called-Station-Id}', '%{Calling-Station-Id}', %{%{Acct-Input-Octets}:-0}, %{%{Acct-Output-Octets}:-0}, %{%{Acct-Input-Packets}:-0}, %{%{Acct-Output-Packets}:-0}, %{%{Acct-Input-Gigawords}:-0}, %{%{Acct-Output-Gigawords}:-0}, '%{Class}', CASE WHEN '%{Acct-Status-Type}' = 'Stop' THEN '%S' ELSE NULL END, CASE WHEN '%{Acct-Status-Type}' = 'Stop' THEN '%{Acct-Terminate-Cause}' ELSE '' END, '%{Acct-Status-Type}', '%S', '%S') ON CONFLICT(acctuniqueid) DO UPDATE SET acctupdatetime = '%S', acctsessiontime = %{%{Acct-Session-Time}:-0}, acctinterval = %{%{Acct-Interim-Interval}:-0}, framedipaddress = '%{Framed-IP-Address}', acctinputoctets = %{%{Acct-Input-Octets}:-0}, acctoutputoctets = %{%{Acct-Output-Octets}:-0}, acctinputpackets = %{%{Acct-Input-Packets}:-0}, acctoutputpackets = %{%{Acct-Output-Packets}:-0}, acctinputgigawords = %{%{Acct-Input-Gigawords}:-0}, acctoutputgigawords = %{%{Acct-Output-Gigawords}:-0}, acctstoptime = CASE WHEN '%{Acct-Status-Type}' = 'Stop' THEN '%S' ELSE acctstoptime END, acctterminatecause = CASE WHEN '%{Acct-Status-Type}' = 'Stop' THEN '%{Acct-Terminate-Cause}' ELSE acctterminatecause END, acctstatus = '%{Acct-Status-Type}', updatedAt = '%S'"
    }

    session {
        query = "SELECT * FROM radacct WHERE acctuniqueid = '%{Acct-Unique-Session-Id}' AND acctstoptime IS NULL"
    }
}
`;

  return c.json({
    success: true,
    data: {
      config: sqlModConfig,
      dbPath: SQLITE_DB_PATH,
      tables: {
        radcheck: 'User check attributes (password, etc.)',
        radreply: 'User reply attributes (bandwidth, session timeout)',
        radgroupcheck: 'Group check attributes',
        radgroupreply: 'Group reply attributes',
        radusergroup: 'User-to-group mapping',
        radacct: 'Accounting sessions (FreeRADIUS native)',
        nas: 'NAS clients (FreeRADIUS native)',
        radpostauth: 'Post-authentication logs (FreeRADIUS native)',
      },
    },
  });
});

// ============================================================================
// FreeRADIUS SQL Auto-Setup — configure radiusd to read from shared SQLite DB
// ============================================================================

/**
 * Verify that FreeRADIUS native tables exist in the database.
 *
 * Tables now use lowercase names matching FreeRADIUS schema.sql.
 * This function just verifies the tables exist and logs the status.
 */
function verifyRadiusTables(): void {
  const tables = [
    'radcheck',
    'radreply',
    'radgroupcheck',
    'radgroupreply',
    'radusergroup',
    'radacct',
    'nas',
    'radpostauth',
  ];

  for (const tableName of tables) {
    try {
      const src = db.query("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(tableName);
      if (src) {
        log.info(`RADIUS table OK: ${tableName}`);
      } else {
        log.warn(`RADIUS table MISSING: ${tableName} — FreeRADIUS will not find it`);
      }
    } catch (err) {
      log.warn(`Failed to verify RADIUS table ${tableName}`, { error: String(err) });
    }
  }
}

// State tracking for SQL setup
let sqlSetupDone = false;
let sqlSetupStatus: { enabled: boolean; dbPath: string; error?: string } = {
  enabled: false,
  dbPath: SQLITE_DB_PATH,
};

/**
 * Configure FreeRADIUS to use the shared SQLite database via rlm_sql.
 *
 * Steps:
 * 1. Verify tables exist (native lowercase: radcheck, radreply, etc.)
 * 2. Write /etc/raddb/mods-available/sql with SQLite config
 * 3. Enable the sql module (symlink to mods-enabled/)
 * 4. Update /etc/raddb/sites-available/default to use sql module
 * 5. Reload radiusd
 *
 * This function is idempotent — safe to call multiple times.
 */
async function setupFreeRadiusSQL(): Promise<{ success: boolean; error?: string; details: string[] }> {
  const details: string[] = [];

  try {
    // Step 1: Ensure radacct table exists with correct schema
    // This MUST run before setupFreeRadiusSQL so FreeRADIUS can INSERT
    ensureRadacctTable();
    details.push('Verified radacct table exists with 37 columns and indexes');

    // Step 1b: Verify all RADIUS tables are accessible
    verifyRadiusTables();
    details.push('Verified RADIUS tables (native lowercase schema: radcheck, radreply, etc.)');

    // Step 1c: Ensure WAL mode is set on the database (critical for SQLITE_BUSY fix)
    try {
      const walResult = db.query('PRAGMA journal_mode').get() as { journal_mode: string } | undefined;
      if (walResult?.journal_mode !== 'wal') {
        db.exec('PRAGMA journal_mode=WAL;');
        details.push('Enabled WAL mode on database');
      } else {
        details.push('WAL mode already enabled');
      }
      db.exec('PRAGMA busy_timeout=30000;');
      db.exec('PRAGMA wal_autocheckpoint=1000;');
      db.exec('PRAGMA synchronous=NORMAL;');
      details.push('Set busy_timeout=30000, wal_autocheckpoint=1000, synchronous=NORMAL');
    } catch (e) {
      details.push(`WARN: Could not set WAL pragmas: ${String(e)}`);
    }

    // Step 2: Write the sql module config
    const sqlModDir = `${RADIUS_CONFIG_PATH}/mods-available`;
    const sqlModPath = `${sqlModDir}/sql`;

    // Ensure the directory exists
    try {
      await fs.mkdir(sqlModDir, { recursive: true });
    } catch {
      // already exists
    }

    // Generate the sql module config
    const sqlConfig = `# StaySuite auto-generated — FreeRADIUS SQL module config
# Points to the SAME SQLite database as the PMS (Prisma)
# Last updated: ${new Date().toISOString()}

sql {
    driver = "rlm_sql_sqlite"
    sqlite {
        filename = "${SQLITE_DB_PATH}"
        # Wait up to 30 seconds for write lock — avoids SQLITE_BUSY when
        # the Bun freeradius-service or Prisma hold a concurrent write transaction.
        busy_timeout = 30000
    }
    dialect = "sqlite"

    # Map the incoming User-Name to SQL-User-Name for use in queries
    # Without this, %{SQL-User-Name} expands to empty string!
    sql_user_name = "%{User-Name}"

    # SQLite is single-writer — MUST use a single connection.
    # Multiple connections fight for the write lock, causing SQLITE_BUSY,
    # and the pool manager destroys active connections mid-query.
    pool {
        start = 1
        min = 1
        max = 1
        spare = 0
        uses = 0
        lifetime = 0
        idle_timeout = 0
        connect_timeout = 30.0
    }

    # Read user check attributes (password, etc.)
    # NOTE: No AND isActive = 1 filter — deprovisioning DELETES records instead of soft-deleting.
    # This allows guests to disconnect/reconnect from hotspot without re-provisioning.
    authorize_check_query = "SELECT id, username, attribute, value, op FROM radcheck WHERE username = '%{SQL-User-Name}' ORDER BY id"

    # Read user reply attributes (bandwidth, session timeout, etc.)
    authorize_reply_query = "SELECT id, username, attribute, value, op FROM radreply WHERE username = '%{SQL-User-Name}' ORDER BY id"

    # Read user groups
    group_membership_query = "SELECT groupname, priority FROM radusergroup WHERE username = '%{SQL-User-Name}' ORDER BY priority"

    # Group check attributes
    authorize_group_check_query = "SELECT id, groupname, attribute, value, op FROM radgroupcheck WHERE groupname = '%{Sql-Group}' ORDER BY id"

    # Group reply attributes
    authorize_group_reply_query = "SELECT id, groupname, attribute, value, op FROM radgroupreply WHERE groupname = '%{Sql-Group}' ORDER BY id"

    # Simultaneous session check
    simul_count_query = "SELECT COUNT(*) FROM radacct WHERE username = '%{SQL-User-Name}' AND acctstoptime IS NULL"
    simul_verify_query = "SELECT radacctid, acctsessionid, username, nasipaddress, framedipaddress, calledstationid, callingstationid FROM radacct WHERE username = '%{SQL-User-Name}' AND acctstoptime IS NULL"

    # Accounting — single UPSERT query handles Start/Interim-Update/Stop
    # FreeRADIUS 3.2.x rlm_sql does NOT support reference/sub-section pattern for accounting.
    # Uses SQLite INSERT ... ON CONFLICT(acctuniqueid) DO UPDATE (UPSERT).
    # radacctid is now INTEGER PRIMARY KEY AUTOINCREMENT — no explicit value needed.
    # Uses acctupdatetime (native FreeRADIUS) instead of updatedAt.
    # Includes all native FreeRADIUS columns plus PMS extras.
    accounting {
        query = "INSERT INTO radacct (acctsessionid, acctuniqueid, username, realm, nasipaddress, nasportid, nasporttype, acctstarttime, acctupdatetime, acctsessiontime, acctinterval, connectinfo_start, servicetype, framedprotocol, framedipaddress, framedipv6prefix, framedinterfaceid, delegatedipv6prefix, calledstationid, callingstationid, acctinputoctets, acctoutputoctets, acctinputpackets, acctoutputpackets, acctinputgigawords, acctoutputgigawords, class, acctstoptime, acctterminatecause, acctstatus, createdAt, updatedAt) VALUES ('%{Acct-Session-Id}', '%{Acct-Unique-Session-Id}', '%{SQL-User-Name}', '%{Realm}', '%{NAS-IP-Address}', '%{%{NAS-Port-ID}:-%{NAS-Port}}', '%{NAS-Port-Type}', '%S', '%S', %{%{Acct-Session-Time}:-0}, %{%{Acct-Interim-Interval}:-0}, '%{Connect-Info}', '%{Service-Type}', '%{Framed-Protocol}', '%{Framed-IP-Address}', '%{Framed-IPv6-Prefix}', '%{Framed-Interface-Id}', '%{Delegated-IPv6-Prefix}', '%{Called-Station-Id}', '%{Calling-Station-Id}', %{%{Acct-Input-Octets}:-0}, %{%{Acct-Output-Octets}:-0}, %{%{Acct-Input-Packets}:-0}, %{%{Acct-Output-Packets}:-0}, %{%{Acct-Input-Gigawords}:-0}, %{%{Acct-Output-Gigawords}:-0}, '%{Class}', CASE WHEN '%{Acct-Status-Type}' = 'Stop' THEN '%S' ELSE NULL END, CASE WHEN '%{Acct-Status-Type}' = 'Stop' THEN '%{Acct-Terminate-Cause}' ELSE '' END, '%{Acct-Status-Type}', '%S', '%S') ON CONFLICT(acctuniqueid) DO UPDATE SET acctupdatetime = '%S', acctsessiontime = %{%{Acct-Session-Time}:-0}, acctinterval = %{%{Acct-Interim-Interval}:-0}, framedipaddress = '%{Framed-IP-Address}', acctinputoctets = %{%{Acct-Input-Octets}:-0}, acctoutputoctets = %{%{Acct-Output-Octets}:-0}, acctinputpackets = %{%{Acct-Input-Packets}:-0}, acctoutputpackets = %{%{Acct-Output-Packets}:-0}, acctinputgigawords = %{%{Acct-Input-Gigawords}:-0}, acctoutputgigawords = %{%{Acct-Output-Gigawords}:-0}, acctstoptime = CASE WHEN '%{Acct-Status-Type}' = 'Stop' THEN '%S' ELSE acctstoptime END, acctterminatecause = CASE WHEN '%{Acct-Status-Type}' = 'Stop' THEN '%{Acct-Terminate-Cause}' ELSE acctterminatecause END, acctstatus = '%{Acct-Status-Type}', updatedAt = '%S'"
    }

    # Session: check for existing active session
    session {
        query = "SELECT * FROM radacct WHERE acctuniqueid = '%{Acct-Unique-Session-Id}' AND acctstoptime IS NULL"
    }
}
`;

    // Write sql module config using base64+shell (same pattern as clients.conf)
    try {
      const b64 = Buffer.from(sqlConfig).toString('base64');
      execFileSync('/bin/sh', ['-c',
        `printf '%s' "${b64}" | base64 -d > "${sqlModPath}" && `
        + `chown radiusd:radiusd "${sqlModPath}" && `
        + `chmod 640 "${sqlModPath}"`
      ]);
      details.push(`Wrote sql module config to ${sqlModPath}`);
    } catch (writeErr) {
      // Fallback: try fs.writeFile
      try {
        await fs.writeFile(sqlModPath, sqlConfig, 'utf-8');
        details.push(`Wrote sql module config (fallback) to ${sqlModPath}`);
      } catch (fallbackErr) {
        details.push(`WARNING: Could not write sql module config: ${String(fallbackErr)}`);
      }
    }

    // Step 3: Enable the sql module
    const modsEnabledDir = `${RADIUS_CONFIG_PATH}/mods-enabled`;
    const sqlSymlink = `${modsEnabledDir}/sql`;

    try {
      await fs.mkdir(modsEnabledDir, { recursive: true });
    } catch {
      // already exists
    }

    try {
      // Check if symlink already exists and points to correct target
      const existingTarget = await fs.readlink(sqlSymlink).catch(() => null);
      if (existingTarget === `${RADIUS_CONFIG_PATH}/mods-available/sql`) {
        details.push('SQL module already enabled (symlink exists)');
      } else {
        // Remove old symlink/file and create new one
        await fs.unlink(sqlSymlink).catch(() => {});
        await fs.symlink(`${RADIUS_CONFIG_PATH}/mods-available/sql`, sqlSymlink);
        details.push('SQL module enabled (symlink created)');
      }
    } catch (symErr) {
      details.push(`WARNING: Could not enable sql module: ${String(symErr)}`);
    }

    // Step 4: Update sites-available/default to use sql module
    const sitesDefaultPath = `${RADIUS_CONFIG_PATH}/sites-available/default`;
    try {
      let sitesContent = await fs.readFile(sitesDefaultPath, 'utf-8');

      // CLEANUP: Remove previously injected broken 'Auth-Type SQL { sql }' blocks
      // (from older version that didn't support FreeRADIUS 3.x)
      if (sitesContent.includes('Auth-Type SQL')) {
        sitesContent = sitesContent.replace(/\n\t#\s*StaySuite:.*?SQL.*?\n\tAuth-Type SQL \{[^}]*\}/g, '');
        details.push('Removed broken Auth-Type SQL block (FreeRADIUS 3.x incompatible)');
      }

      // Add sql to authorize section (before -sql if it exists as negative)
      // We want sql to be checked for user lookup
      if (!sitesContent.includes('-sql')) {
        // Add -sql before files if not present (to prevent double lookups)
        if (!sitesContent.includes('sql')) {
          // Add 'sql' to the authorize section
          sitesContent = sitesContent.replace(
            /authorize\s*\{/,
            'authorize {\n\t# StaySuite: Use SQL for user authentication\n\tsql'
          );
          details.push('Added sql to authorize section');
        }
      }

      // NOTE: Do NOT add sql to authenticate section in FreeRADIUS 3.x
      // In v3, password verification (PAP/CHAP/MS-CHAP) happens automatically
      // when the sql module finds Cleartext-Password in radcheck during authorize.
      // Adding 'Auth-Type SQL { sql }' causes: "sql modules aren't allowed in 'authenticate' sections"
      details.push('Skipped authenticate section (FreeRADIUS 3.x auto-verifies from authorize)');

      // Add sql to post-auth section (to send reply attributes)
      const postAuthSection = sitesContent.match(/post-auth\s*\{([^}]*)\}/);
      if (postAuthSection && !postAuthSection[1].includes('sql')) {
        sitesContent = sitesContent.replace(
          /post-auth\s*\{/,
          'post-auth {\n\t# StaySuite: Send RADIUS reply attributes (bandwidth, session timeout)\n\tsql'
        );
        details.push('Added sql to post-auth section');
      }

      // Add sql to accounting section
      const acctSection = sitesContent.match(/accounting\s*\{([^}]*)\}/);
      if (acctSection && !acctSection[1].includes('sql')) {
        sitesContent = sitesContent.replace(
          /accounting\s*\{/,
          'accounting {\n\t# StaySuite: Log accounting to SQLite\n\tsql'
        );
        details.push('Added sql to accounting section');
      }

      // Add sql to session section (for Simultaneous-Use check)
      const sessSection = sitesContent.match(/session\s*\{([^}]*)\}/);
      if (sessSection && !sessSection[1].includes('sql')) {
        sitesContent = sitesContent.replace(
          /session\s*\{/,
          'session {\n\t# StaySuite: Check simultaneous sessions\n\tsql'
        );
        details.push('Added sql to session section');
      }

      // Write back using base64+shell
      const b64 = Buffer.from(sitesContent).toString('base64');
      execFileSync('/bin/sh', ['-c',
        `printf '%s' "${b64}" | base64 -d > "${sitesDefaultPath}" && `
        + `chown radiusd:radiusd "${sitesDefaultPath}" && `
        + `chmod 640 "${sitesDefaultPath}"`
      ]);
      details.push('Updated sites-available/default with sql module');
    } catch (sitesErr) {
      details.push(`WARNING: Could not update sites config: ${String(sitesErr)}`);
    }

    // Step 5: Also update sites-available/inner-tunnel if it exists (for EAP/TTLS)
    const innerTunnelPath = `${RADIUS_CONFIG_PATH}/sites-available/inner-tunnel`;
    try {
      let innerContent = await fs.readFile(innerTunnelPath, 'utf-8');

      // CLEANUP: Remove previously injected broken 'Auth-Type SQL { sql }' blocks
      if (innerContent.includes('Auth-Type SQL')) {
        innerContent = innerContent.replace(/\n\tAuth-Type SQL \{[^}]*\}/g, '');
        details.push('Removed broken Auth-Type SQL block from inner-tunnel');
      }

      const needsUpdate =
        !innerContent.match(/authorize\s*\{[^}]*sql/) || innerContent.includes('Auth-Type SQL');

      if (needsUpdate) {
        // Add sql to authorize
        innerContent = innerContent.replace(
          /authorize\s*\{/,
          'authorize {\n\tsql'
        );
        // NOTE: Do NOT add sql to authenticate in FreeRADIUS 3.x (same reason as above)
        // SQL password verification is automatic from the authorize section
        // Add sql to post-auth
        innerContent = innerContent.replace(
          /post-auth\s*\{/,
          'post-auth {\n\tsql'
        );
        // Add sql to session
        innerContent = innerContent.replace(
          /session\s*\{/,
          'session {\n\tsql'
        );

        const b64 = Buffer.from(innerContent).toString('base64');
        execFileSync('/bin/sh', ['-c',
          `printf '%s' "${b64}" | base64 -d > "${innerTunnelPath}" && `
          + `chown radiusd:radiusd "${innerTunnelPath}" && `
          + `chmod 640 "${innerTunnelPath}"`
        ]);
        details.push('Updated inner-tunnel with sql module');
      }
    } catch {
      // inner-tunnel may not exist — that's OK
    }

    // Step 6: Fix database file permissions for radiusd user
    // CRITICAL: radiusd runs as user 'radiusd' and MUST have read+write access
    // to the SQLite database file. Without this, FreeRADIUS gets SQLITE_BUSY
    // (or SQLITE_READONLY) when trying to INSERT accounting records.
    try {
      const dbDir = path.dirname(SQLITE_DB_PATH);
      execFileSync('/bin/sh', ['-c',
        `chown -R radiusd:radiusd "${dbDir}" 2>/dev/null; `
        + `chmod 770 "${dbDir}" 2>/dev/null; `
        + `chmod 660 "${SQLITE_DB_PATH}" 2>/dev/null; `
        + `chmod 660 "${SQLITE_DB_PATH}-wal" 2>/dev/null; `
        + `chmod 660 "${SQLITE_DB_PATH}-shm" 2>/dev/null`
      ]);
      details.push(`Fixed database permissions for radiusd user: ${dbDir}`);
    } catch (permErr) {
      details.push(`WARNING: Could not fix database permissions: ${String(permErr)}`);
    }

    // Step 7: Restart radiusd (full restart, not reload)
    const restarted = await reloadRadius();
    details.push(restarted ? 'Restarted FreeRADIUS server' : 'FAILED to restart FreeRADIUS — run: systemctl restart radiusd');

    sqlSetupDone = true;
    sqlSetupStatus = { enabled: true, dbPath: SQLITE_DB_PATH };

    return { success: true, details };
  } catch (error) {
    const errMsg = String(error);
    sqlSetupStatus = { enabled: false, dbPath: SQLITE_DB_PATH, error: errMsg };
    return { success: false, error: errMsg, details };
  }
}

// API endpoint to trigger SQL setup manually
app.post('/api/config/enable-sql', async (c) => {
  const result = await setupFreeRadiusSQL();
  return c.json({
    success: result.success,
    ...(result.error && { error: result.error }),
    data: {
      details: result.details,
      dbPath: SQLITE_DB_PATH,
    },
  });
});

// API endpoint to check SQL setup status
app.get('/api/config/sql-status', (c) => {
  // Check if the sql module config exists
  const sqlModPath = `${RADIUS_CONFIG_PATH}/mods-available/sql`;
  const sqlEnabledPath = `${RADIUS_CONFIG_PATH}/mods-enabled/sql`;

  let configExists = false;
  let moduleEnabled = false;

  try {
    fsSync.accessSync(sqlModPath);
    configExists = true;
  } catch {}

  try {
    fsSync.accessSync(sqlEnabledPath);
    moduleEnabled = true;
  } catch {}

  return c.json({
    success: true,
    data: {
      configExists,
      moduleEnabled,
      dbPath: SQLITE_DB_PATH,
      setupDone: sqlSetupDone,
      status: sqlSetupStatus,
      radiusConfigPath: RADIUS_CONFIG_PATH,
    },
  });
});

// ============================================================================
// RADIUS Accounting — parse radacct detail files
// ============================================================================

// Possible radacct log directories (order of preference)
const RADACCT_PATHS = ['/var/log/radius/radacct', '/var/log/raddb/radacct', '/var/log/freeradius/radacct'];

// In-memory cache with 30-second TTL to avoid re-parsing on every request
let accountingCache: { data: AccountingSession[] | null; timestamp: number; ttl: number } = {
  data: null,
  timestamp: 0,
  ttl: 30000,
};

/**
 * Parse FreeRADIUS radacct detail files to extract accounting sessions.
 *
 * Detail file format (FreeRADIUS "detail" module output):
 *   Wed Jun 18 10:30:00 2025        <-- timestamp line
 *           Acct-Status-Type = Start
 *           User-Name = "testguest"
 *           NAS-IP-Address = 192.168.88.1
 *           ...
 *   (blank line separates entries)
 *
 * Returns all sessions grouped by Acct-Session-Id with latest values.
 * Active = has Start but no Stop for the same session ID.
 */
async function parseRadacctDetailFiles(forceRefresh: boolean = false): Promise<AccountingSession[]> {
  // Return cached data if still fresh
  if (!forceRefresh && accountingCache.data !== null && (Date.now() - accountingCache.timestamp) < accountingCache.ttl) {
    return accountingCache.data;
  }

  const sessions: AccountingSession[] = [];

  // Find the first existing radacct directory
  let radacctBase: string | null = null;
  for (const p of RADACCT_PATHS) {
    try {
      const stat = await fs.stat(p);
      if (stat.isDirectory()) {
        radacctBase = p;
        break;
      }
    } catch {
      // directory doesn't exist, try next
    }
  }

  if (!radacctBase) {
    log.debug('No radacct directory found — returning empty sessions (no RADIUS server)', { searched: RADACCT_PATHS });
    accountingCache = { data: [], timestamp: Date.now(), ttl: accountingCache.ttl };
    return [];
  }

  // Build list of date strings to check (today + last 3 days for multi-day sessions)
  const dateStrings: string[] = [];
  for (let d = 0; d < 4; d++) {
    const day = new Date();
    day.setDate(day.getDate() - d);
    dateStrings.push(`${String(day.getFullYear())}${String(day.getMonth() + 1).padStart(2, '0')}${String(day.getDate()).padStart(2, '0')}`);
  }

  try {
    // List NAS IP directories
    const nasDirs = await fs.readdir(radacctBase);

    for (const nasDir of nasDirs) {
      const nasDirPath = path.join(radacctBase, nasDir);
      let nasDirStat;
      try {
        nasDirStat = await fs.stat(nasDirPath);
      } catch {
        continue;
      }
      if (!nasDirStat.isDirectory()) continue;

      // Find detail file(s) — may be named detail-YYYYMMDD or detail
      // Read last 4 days to capture multi-day sessions
      let detailFiles: string[] = [];
      try {
        const files = await fs.readdir(nasDirPath);
        detailFiles = files.filter(f =>
          f.startsWith('detail') && (f === 'detail' || dateStrings.some(ds => f.includes(ds)))
        );
      } catch {
        continue;
      }

      for (const detailFile of detailFiles) {
        const detailPath = path.join(nasDirPath, detailFile);
        let content: string;
        try {
          content = await fs.readFile(detailPath, 'utf-8');
        } catch {
          continue;
        }

        // Parse entries: split by double newlines (blank line separator)
        const entries = content.split(/\n\n+/);

        for (const entry of entries) {
          const lines = entry.trim().split('\n');
          if (lines.length === 0) continue;

          // Extract timestamp from first line (e.g., "Wed Jun 18 10:30:00 2025")
          let entryTimestamp = '';
          const timestampMatch = lines[0].match(/^([A-Z][a-z]{2}\s+[A-Z][a-z]{2}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}\s+\d{4})/);
          if (timestampMatch) {
            const parsed = new Date(timestampMatch[1]);
            if (!isNaN(parsed.getTime())) {
              entryTimestamp = parsed.toISOString();
            }
          }

          // Extract attribute key-value pairs from remaining lines
          let acctStatusType = '';
          let userName = '';
          let nasIpAddress = '';
          let calledStationId = '';
          let callingStationId = '';
          let framedIpAddress = '';
          let acctSessionId = '';
          let acctSessionTime = 0;
          let acctInputOctets = 0;
          let acctOutputOctets = 0;
          let acctTerminateCause = '';

          for (const line of lines) {
            // Match lines like:  Attribute-Name = Value  or  Attribute-Name = "Value"
            const attrMatch = line.match(/^\s+(\S+)\s*=\s*(.+)/);
            if (!attrMatch) continue;

            const attrName = attrMatch[1];
            let attrValue = attrMatch[2].trim();
            // Remove surrounding quotes from value
            if (attrValue.startsWith('"') && attrValue.endsWith('"')) {
              attrValue = attrValue.slice(1, -1);
            }

            switch (attrName) {
              case 'Acct-Status-Type':
                acctStatusType = attrValue;
                break;
              case 'User-Name':
                userName = attrValue;
                break;
              case 'NAS-IP-Address':
                nasIpAddress = attrValue;
                break;
              case 'Called-Station-Id':
                calledStationId = attrValue;
                break;
              case 'Calling-Station-Id':
                callingStationId = attrValue;
                break;
              case 'Framed-IP-Address':
                framedIpAddress = attrValue;
                break;
              case 'Acct-Session-Id':
                acctSessionId = attrValue;
                break;
              case 'Acct-Session-Time':
                acctSessionTime = parseInt(attrValue, 10) || 0;
                break;
              case 'Acct-Input-Octets':
              case 'Acct-Input-Gigawords': {
                const val = parseInt(attrValue, 10) || 0;
                if (attrName === 'Acct-Input-Gigawords') {
                  acctInputOctets += val * 4294967296; // 2^32
                } else {
                  acctInputOctets = val;
                }
                break;
              }
              case 'Acct-Output-Octets':
              case 'Acct-Output-Gigawords': {
                const val = parseInt(attrValue, 10) || 0;
                if (attrName === 'Acct-Output-Gigawords') {
                  acctOutputOctets += val * 4294967296; // 2^32
                } else {
                  acctOutputOctets = val;
                }
                break;
              }
              case 'Acct-Terminate-Cause':
                acctTerminateCause = attrValue;
                break;
            }
          }

          // Skip entries without session ID or status type
          if (!acctSessionId || !acctStatusType) continue;

          // Check if we already have an entry for this session ID
          const existingIdx = sessions.findIndex(s => s.sessionId === acctSessionId);

          const sessionRecord: AccountingSession = {
            username: userName || 'unknown',
            nasIp: nasIpAddress || nasDir, // fallback to directory name
            clientMac: callingStationId,
            apMac: calledStationId,
            ipAddress: framedIpAddress,
            sessionId: acctSessionId,
            sessionTime: acctSessionTime,
            inputOctets: acctInputOctets,
            outputOctets: acctOutputOctets,
            status: acctStatusType === 'Stop' ? 'ended' : 'active',
            startedAt: entryTimestamp,
            lastSeenAt: entryTimestamp,
            terminateCause: acctTerminateCause || undefined,
          };

          if (existingIdx !== -1) {
            const existing = sessions[existingIdx];

            if (acctStatusType === 'Stop') {
              // Stop record: always replace, mark as ended, use latest counters
              sessionRecord.startedAt = existing.startedAt;
              sessionRecord.status = 'ended';
              sessions[existingIdx] = sessionRecord;
            } else if (acctStatusType === 'Interim-Update' || acctStatusType === 'Alive') {
              // Interim-Update: update counters if newer (higher session time)
              if (acctSessionTime >= existing.sessionTime) {
                sessionRecord.startedAt = existing.startedAt;
                sessionRecord.status = 'active';
                sessions[existingIdx] = sessionRecord;
              }
            } else if (acctStatusType === 'Start') {
              // Start: only set if no existing Start record
              if (existing.status === 'ended') {
                // Don't overwrite a stopped session with a new start
                // This is a new session with same ID (unlikely but possible)
                sessions.push(sessionRecord);
              }
              // else: keep existing start record
            }
          } else {
            sessions.push(sessionRecord);
          }
        }
      }
    }
  } catch (error) {
    log.error('Failed to parse radacct detail files', { error: String(error) });
    accountingCache = { data: [], timestamp: Date.now(), ttl: accountingCache.ttl };
    return [];
  }

  // Mark stale sessions: active sessions with no update for STALE_SESSION_THRESHOLD_MINUTES
  const now = Date.now();
  const staleThreshold = STALE_SESSION_THRESHOLD_MINUTES * 60 * 1000;
  for (const session of sessions) {
    if (session.status === 'active' && session.lastSeenAt) {
      const lastSeen = new Date(session.lastSeenAt).getTime();
      if (lastSeen && (now - lastSeen) > staleThreshold) {
        session.status = 'stale';
      }
    }
  }

  // Update cache
  accountingCache = { data: sessions, timestamp: Date.now(), ttl: accountingCache.ttl };
  log.debug('Parsed radacct detail files', {
    sessionCount: sessions.length,
    activeCount: sessions.filter(s => s.status === 'active').length,
    staleCount: sessions.filter(s => s.status === 'stale').length,
    endedCount: sessions.filter(s => s.status === 'ended').length,
  });
  return sessions;
}

// --- GET /api/sessions/active --- Live Active Sessions (active + stale)
app.get('/api/sessions/active', async (c) => {
  try {
    const allSessions = await parseRadacctDetailFiles();
    // Return both active and stale (still connected, just idle)
    const connectedSessions = allSessions.filter(s => s.status === 'active' || s.status === 'stale');
    return c.json({
      success: true,
      data: connectedSessions,
      count: connectedSessions.length,
    });
  } catch (error) {
    log.error('Failed to get active sessions', { error: String(error) });
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// --- GET /api/accounting --- Accounting Sessions (filtered by status)
/**
 * Read accounting sessions from the radacct database table.
 * Used as fallback when no FreeRADIUS detail files exist (e.g., dev/sandbox environments).
 * Maps FreeRADIUS radacct columns to the AccountingSession interface.
 */
function getAccountingSessionsFromDB(): AccountingSession[] {
  try {
    const rows = db.query(`
      SELECT acctsessionid, username, nasipaddress, callingstationid, calledstationid,
             framedipaddress, acctstarttime, acctupdatetime, acctstoptime,
             acctsessiontime, acctinputoctets, acctoutputoctets, acctterminatecause, acctstatus
      FROM radacct
      ORDER BY acctstarttime DESC
    `).all() as Array<Record<string, unknown>>;

    return rows.map(row => {
      const stopTime = row.acctstoptime as string | null;
      const updateTime = row.acctupdatetime as string | null;
      const now = new Date();
      const isStopped = !!stopTime;
      const lastSeen = stopTime || updateTime || (row.acctstarttime as string);

      // Determine status: active (no stop time), stale (no stop but stale), ended (has stop time)
      let status: 'active' | 'ended' | 'stale' = 'ended';
      if (!isStopped) {
        const lastSeenDate = lastSeen ? new Date(lastSeen) : now;
        const minsSinceUpdate = (now.getTime() - lastSeenDate.getTime()) / 60000;
        status = minsSinceUpdate > STALE_SESSION_THRESHOLD_MINUTES ? 'stale' : 'active';
      }

      return {
        sessionId: (row.acctsessionid as string) || '',
        username: (row.username as string) || '',
        nasIp: (row.nasipaddress as string) || '',
        clientMac: (row.callingstationid as string) || '',
        apMac: (row.calledstationid as string) || '',
        ipAddress: (row.framedipaddress as string) || '',
        sessionTime: (row.acctsessiontime as number) || 0,
        inputOctets: (row.acctinputoctets as number) || 0,
        outputOctets: (row.acctoutputoctets as number) || 0,
        status,
        startedAt: (row.acctstarttime as string) || '',
        lastSeenAt: lastSeen || '',
        terminateCause: (row.acctterminatecause as string) || undefined,
      };
    });
  } catch (error) {
    log.error('Failed to read accounting sessions from DB', { error: String(error) });
    return [];
  }
}

app.get('/api/accounting', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '100', 10) || 100;
    const offset = parseInt(c.req.query('offset') || '0', 10) || 0;
    const usernameFilter = c.req.query('username') || '';
    const nasIpFilter = c.req.query('nasIp') || '';
    const statusFilter = c.req.query('status') || ''; // active, stale, ended, all

    // Try filesystem detail files first (real FreeRADIUS), fall back to DB table
    let allSessions = await parseRadacctDetailFiles();
    const usedFallback = allSessions.length === 0;
    if (usedFallback) {
      allSessions = getAccountingSessionsFromDB();
    }

    // Apply status filter
    let filtered = allSessions;
    if (statusFilter === 'active') {
      filtered = filtered.filter(s => s.status === 'active');
    } else if (statusFilter === 'stale') {
      filtered = filtered.filter(s => s.status === 'stale');
    } else if (statusFilter === 'ended') {
      filtered = filtered.filter(s => s.status === 'ended');
    }
    // 'all' or empty = no status filter (return everything)

    if (usernameFilter) {
      filtered = filtered.filter(s => s.username.toLowerCase().includes(usernameFilter.toLowerCase()));
    }
    if (nasIpFilter) {
      filtered = filtered.filter(s => s.nasIp === nasIpFilter);
    }

    // Sort by lastSeenAt descending
    filtered.sort((a, b) => (b.lastSeenAt || '').localeCompare(a.lastSeenAt || ''));

    const total = filtered.length;
    const paged = filtered.slice(offset, offset + limit);

    // Compute summary (always from all sessions)
    const activeSessions = allSessions.filter(s => s.status === 'active');
    const staleSessions = allSessions.filter(s => s.status === 'stale');
    const summary = {
      activeSessions: activeSessions.length,
      staleSessions: staleSessions.length,
      totalInputBytes: allSessions.reduce((sum, s) => sum + s.inputOctets, 0),
      totalOutputBytes: allSessions.reduce((sum, s) => sum + s.outputOctets, 0),
      totalSessionTime: allSessions.reduce((sum, s) => sum + s.sessionTime, 0),
    };

    return c.json({
      success: true,
      data: paged,
      total,
      summary,
      _source: usedFallback ? 'database' : 'detail-files',
    });
  } catch (error) {
    log.error('Failed to get accounting history', { error: String(error) });
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// --- GET /api/accounting/active --- Quick Active + Stale Count
app.get('/api/accounting/active', async (c) => {
  try {
    // Try filesystem detail files first, fall back to DB table
    let allSessions = await parseRadacctDetailFiles();
    if (allSessions.length === 0) {
      allSessions = getAccountingSessionsFromDB();
    }
    const activeSessions = allSessions.filter(s => s.status === 'active');
    const staleSessions = allSessions.filter(s => s.status === 'stale');
    const connectedSessions = [...activeSessions, ...staleSessions];
    const totalInputBytes = connectedSessions.reduce((sum, s) => sum + s.inputOctets, 0);
    const totalOutputBytes = connectedSessions.reduce((sum, s) => sum + s.outputOctets, 0);

    return c.json({
      success: true,
      data: {
        activeSessions,
        staleSessions,
        connectedSessions,
        count: connectedSessions.length,
        activeCount: activeSessions.length,
        staleCount: staleSessions.length,
        totalInputBytes,
        totalOutputBytes,
      },
    });
  } catch (error) {
    log.error('Failed to get active accounting summary', { error: String(error) });
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// --- POST /api/accounting/refresh --- Force Re-read Detail Files
app.post('/api/accounting/refresh', async (c) => {
  try {
    const allSessions = await parseRadacctDetailFiles(true);
    const activeSessions = allSessions.filter(s => s.status === 'active');
    const totalInputBytes = allSessions.reduce((sum, s) => sum + s.inputOctets, 0);
    const totalOutputBytes = allSessions.reduce((sum, s) => sum + s.outputOctets, 0);

    return c.json({
      success: true,
      message: 'Accounting data refreshed',
      data: {
        totalSessions: allSessions.length,
        activeCount: activeSessions.length,
        totalInputBytes,
        totalOutputBytes,
      },
    });
  } catch (error) {
    log.error('Failed to refresh accounting data', { error: String(error) });
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// --- GET /api/accounting/status --- Diagnostic: check radacct directory
app.get('/api/accounting/status', async (c) => {
  try {
    const results: { path: string; exists: boolean; isDirectory: boolean; fileCount?: number; nasDirs?: string[] }[] = [];

    for (const p of RADACCT_PATHS) {
      try {
        const stat = await fs.stat(p);
        const isDir = stat.isDirectory();
        let fileCount = 0;
        let nasDirs: string[] = [];

        if (isDir) {
          const dirs = await fs.readdir(p);
          nasDirs = dirs;
          for (const nasDir of dirs) {
            const nasDirPath = path.join(p, nasDir);
            try {
              const nasStat = await fs.stat(nasDirPath);
              if (nasStat.isDirectory()) {
                const files = await fs.readdir(nasDirPath);
                fileCount += files.filter(f => f.startsWith('detail')).length;
              }
            } catch {
              // skip
            }
          }
        }

        results.push({ path: p, exists: true, isDirectory: isDir, fileCount, nasDirs });
      } catch {
        results.push({ path: p, exists: false, isDirectory: false });
      }
    }

    const activeRadacctPath = results.find(r => r.exists && r.isDirectory);
    const allSessions = await parseRadacctDetailFiles();

    return c.json({
      success: true,
      data: {
        radacctPaths: results,
        activePath: activeRadacctPath?.path || null,
        nasDirectories: activeRadacctPath?.nasDirs || [],
        totalDetailFiles: activeRadacctPath?.fileCount || 0,
        cachedSessions: allSessions.length,
        cachedActiveSessions: allSessions.filter(s => s.status === 'active').length,
        accountingEnabled: (activeRadacctPath?.fileCount || 0) > 0,
      },
    });
  } catch (error) {
    log.error('Failed to check accounting status', { error: String(error) });
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ============================================================================
// Auth Logs Endpoints
// ============================================================================

app.get('/api/auth-logs', (c) => {
  try {
    const limit = Math.min(parseInt(c.req.query('limit') || '100', 10) || 100, 1000);
    const offset = parseInt(c.req.query('offset') || '0', 10) || 0;
    const username = c.req.query('username') || '';
    const result = c.req.query('result') || '';
    const startDate = c.req.query('startDate') || '';
    const endDate = c.req.query('endDate') || '';

    let sql = 'SELECT * FROM RadiusAuthLog WHERE 1=1';
    const params: unknown[] = [];

    if (username) {
      sql += ' AND username LIKE ?';
      params.push(`%${username}%`);
    }
    if (result) {
      sql += ' AND authResult = ?';
      params.push(result);
    }
    if (startDate) {
      sql += ' AND timestamp >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND timestamp <= ?';
      params.push(endDate + 'T23:59:59');
    }

    // Get total count
    const countRow = db.query(sql.replace('SELECT *', 'SELECT COUNT(*) as cnt')).get(...params) as { cnt: number } | undefined;
    const total = countRow?.cnt || 0;

    sql += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = db.query(sql).all(...params) as Record<string, unknown>[];
    return c.json({ success: true, data: rows, total });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

app.post('/api/auth-logs', async (c) => {
  try {
    const body = await c.req.json();
    const id = generateId('alog');
    const now = new Date().toISOString();

    db.query(
      `INSERT INTO RadiusAuthLog (id, propertyId, username, authResult, authType, nasIpAddress, nasIdentifier, callingStationId, calledStationId, clientIpAddress, replyMessage, terminateReason, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      body.propertyId || null,
      body.username || '',
      body.authResult || 'Accept',
      body.authType || 'PAP',
      body.nasIpAddress || null,
      body.nasIdentifier || null,
      body.callingStationId || null,
      body.calledStationId || null,
      body.clientIpAddress || null,
      body.replyMessage || null,
      body.terminateReason || null,
      body.timestamp || now,
    );

    // Also write to radpostauth for FreeRADIUS compatibility
    try {
      db.query(
        `INSERT INTO radpostauth (username, pass, reply, authdate, class, propertyId, nasIpAddress)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        body.username || '',
        '',  // FreeRADIUS does not store cleartext passwords in radpostauth
        body.authResult || 'Accept',
        body.timestamp || now,
        body.class || null,
        body.propertyId || null,
        body.nasIpAddress || null,
      );
    } catch (postAuthErr) {
      // Non-critical: radpostauth insert failure should not break auth logging
      log.debug('Failed to write to radpostauth', { error: String(postAuthErr) });
    }

    return c.json({ success: true, data: { id }, message: 'Auth log entry created' });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

app.delete('/api/auth-logs', async (c) => {
  try {
    const before = c.req.query('before') || '';
    if (!before) {
      return c.json({ success: false, error: '?before=YYYY-MM-DD query parameter is required' }, 400);
    }

    const result = db.query("DELETE FROM RadiusAuthLog WHERE timestamp < ?").run(before + 'T00:00:00');
    return c.json({ success: true, deleted: result.changes });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

app.get('/api/auth-logs/stats', (c) => {
  try {
    // Match both RADIUS standard values (Access-Accept/Reject) and short form (Accept/Reject)
    const totalAccept = (db.query("SELECT COUNT(*) as c FROM RadiusAuthLog WHERE authResult IN ('Accept', 'Access-Accept')").get() as { c: number })?.c || 0;
    const totalReject = (db.query("SELECT COUNT(*) as c FROM RadiusAuthLog WHERE authResult IN ('Reject', 'Access-Reject')").get() as { c: number })?.c || 0;
    const total = totalAccept + totalReject;

    // Last hour
    const lastHour = (db.query("SELECT COUNT(*) as c FROM RadiusAuthLog WHERE timestamp >= datetime('now', '-1 hour') AND authResult IN ('Accept', 'Access-Accept')").get() as { c: number })?.c || 0;
    const lastHourReject = (db.query("SELECT COUNT(*) as c FROM RadiusAuthLog WHERE timestamp >= datetime('now', '-1 hour') AND authResult IN ('Reject', 'Access-Reject')").get() as { c: number })?.c || 0;

    // Today
    const todayAccept = (db.query("SELECT COUNT(*) as c FROM RadiusAuthLog WHERE timestamp >= datetime('now', 'start of day') AND authResult IN ('Accept', 'Access-Accept')").get() as { c: number })?.c || 0;
    const todayReject = (db.query("SELECT COUNT(*) as c FROM RadiusAuthLog WHERE timestamp >= datetime('now', 'start of day') AND authResult IN ('Reject', 'Access-Reject')").get() as { c: number })?.c || 0;

    return c.json({
      success: true,
      data: {
        totalAuths: total,
        acceptCount: totalAccept,
        rejectCount: totalReject,
        successRate: total > 0 ? Math.round((totalAccept / total) * 100) : 0,
        last24hTrend: lastHour - lastHourReject,
        totalAccept,
        totalReject,
        total,
        lastHour: { accept: lastHour, reject: lastHourReject },
        today: { accept: todayAccept, reject: todayReject },
      },
    });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ============================================================================
// CoA (Change of Authorization) Endpoints
// ============================================================================

/**
 * Look up NAS client by IP address, or fall back to the first NAS client.
 */
function lookupNAS(nasIp?: string): { ip: string; secret: string; coaPort: number } | null {
  const clients = getAllNASClients();
  if (nasIp) {
    const nas = clients.find(c => c.ipAddress === nasIp);
    if (nas) return { ip: nas.ipAddress, secret: nas.sharedSecret, coaPort: nas.ports.coa };
  }
  if (clients.length > 0) {
    const first = clients[0];
    return { ip: first.ipAddress, secret: first.sharedSecret, coaPort: first.ports.coa };
  }
  return null;
}

/**
 * Execute a radclient command for CoA or Disconnect.
 */
async function executeRadclient(
  nasIp: string,
  nasPort: number,
  command: string,
  sharedSecret: string,
  attributes: string,
): Promise<{ success: boolean; output: string; error?: string }> {
  try {
    // Sanitize all inputs to prevent command injection
    const safeNasIp = String(nasIp).replace(/[^0-9.:a-fA-F]/g, '');
    const safePort = Number(nasPort) || 3799;
    const safeCommand = command === 'coa' ? 'coa' : 'disconnect';
    const safeSecret = String(sharedSecret).replace(/[^a-zA-Z0-9_.@!#$%^&*()-]/g, '');
    const escaped = attributes.replace(/'/g, "'\\''");

    // Check radclient availability before attempting execution
    let radclientAvailable = false;
    try {
      const { stdout: whichOutput } = await execAsync('which radclient 2>/dev/null && radclient -v 2>&1 | head -1 || echo "not_found"', { timeout: 3000 });
      radclientAvailable = whichOutput.trim() !== 'not_found' && whichOutput.trim().length > 0;
    } catch {
      radclientAvailable = false;
    }

    if (!radclientAvailable) {
      const errMsg = 'radclient is not installed on this system. CoA/Disconnect requires the FreeRADIUS client tools (freeradius-utils package on Debian/Ubuntu, freeradius on RHEL/CentOS). In production, ensure radclient is installed and accessible in PATH.';
      log.warn('radclient not found — CoA/Disconnect will fail', { nasIp: safeNasIp, command: safeCommand });
      return { success: false, output: '', error: errMsg };
    }

    const cmd = `echo '${escaped}' | radclient -x ${safeNasIp}:${safePort} ${safeCommand} ${safeSecret} 2>&1`;
    log.info(`Executing radclient: cmd=${safeCommand} nas=${safeNasIp}:${safePort}`);

    const { stdout } = await execAsync(cmd, { timeout: 10000 });
    const success = stdout.toLowerCase().includes('coa-ack') ||
                    stdout.toLowerCase().includes('disconnect-ack') ||
                    stdout.toLowerCase().includes('received');
    if (success) {
      log.info(`radclient ${safeCommand} succeeded for nas=${safeNasIp}`);
    } else {
      log.warn(`radclient ${safeCommand} failed for nas=${safeNasIp}`, { output: stdout.trim() });
    }
    return { success, output: stdout.trim() };
  } catch (error: any) {
    const errMsg = String(error?.message || error);
    log.error(`radclient execution error`, { nasIp, command, error: errMsg });
    return { success: false, output: '', error: errMsg };
  }
}

/**
 * Log a CoA action to RadiusCoaLog.
 */
function logCoaAction(params: {
  propertyId?: string; action: string; username: string;
  sessionId?: string; nasIpAddress?: string; sharedSecret?: string;
  attributes?: string; result: string; responseCode?: string;
  errorMessage?: string; triggeredBy?: string; triggeredById?: string;
}): void {
  try {
    db.query(
      `INSERT INTO RadiusCoaLog (id, propertyId, action, username, sessionId, nasIpAddress, sharedSecret, attributes, result, responseCode, errorMessage, triggeredBy, triggeredById, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      generateId('coa'),
      params.propertyId || null,
      params.action,
      params.username,
      params.sessionId || null,
      params.nasIpAddress || null,
      params.sharedSecret || null,
      params.attributes || null,
      params.result,
      params.responseCode || null,
      params.errorMessage || null,
      params.triggeredBy || 'api',
      params.triggeredById || null,
      new Date().toISOString(),
    );
  } catch {
    // non-critical: logging failure should not break CoA
  }
}

app.post('/api/coa/disconnect', async (c) => {
  try {
    const body = await c.req.json();
    const { username, sessionId, nasIp: bodyNasIp } = body;

    if (!username) {
      return c.json({ success: false, error: 'username is required' }, 400);
    }

    const nas = lookupNAS(bodyNasIp);
    if (!nas) {
      return c.json({ success: false, error: 'No NAS client configured' }, 400);
    }

    // Find active session from radacct if sessionId not provided
    let targetSessionId = sessionId || '';
    if (!targetSessionId) {
      const session = db.query(
        "SELECT acctsessionid FROM radacct WHERE username = ? AND acctstoptime IS NULL ORDER BY acctstarttime DESC LIMIT 1"
      ).get(username) as { acctsessionid: string } | undefined;
      targetSessionId = session?.acctsessionid || '';
    }

    const attrs = `User-Name="${username}"${targetSessionId ? `\nAcct-Session-Id="${targetSessionId}"` : ''}`;
    const radResult = await executeRadclient(nas.ip, nas.coaPort, 'disconnect', nas.secret, attrs);

    logCoaAction({
      action: 'disconnect', username, sessionId: targetSessionId,
      nasIpAddress: nas.ip, sharedSecret: nas.secret, attributes: attrs,
      result: radResult.success ? 'success' : 'failed',
      errorMessage: radResult.error,
    });

    return c.json({
      success: radResult.success,
      data: { username, sessionId: targetSessionId, nasIp: nas.ip, output: radResult.output },
      message: radResult.success ? 'Disconnect sent successfully' : 'Disconnect failed',
    });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

app.post('/api/coa/bandwidth', async (c) => {
  try {
    const body = await c.req.json();
    const { username, downloadMbps, uploadMbps, nasIp: bodyNasIp } = body;

    if (!username) {
      return c.json({ success: false, error: 'username is required' }, 400);
    }
    if (!downloadMbps && !uploadMbps) {
      return c.json({ success: false, error: 'downloadMbps and/or uploadMbps is required' }, 400);
    }

    const nas = lookupNAS(bodyNasIp);
    if (!nas) {
      return c.json({ success: false, error: 'No NAS client configured' }, 400);
    }

    // Vendor-aware CoA: generate attributes based on NAS vendor type
    const vendor = normalizeVendor(nas.type);
    const dlMbps = downloadMbps || 0;
    const ulMbps = uploadMbps || 0;
    const rateLimit = `${dlMbps}M/${ulMbps}M`;
    const dlBps = dlMbps * 1000000;
    const ulBps = ulMbps * 1000000;

    // Build radclient attributes string — vendor-specific
    let coaAttrs = `User-Name="${username}"`;
    switch (vendor) {
      case 'mikrotik':
        coaAttrs += `\nMikrotik-Rate-Limit="${rateLimit}"`;
        break;
      case 'cisco':
        coaAttrs += `\nCisco-AVPair="sub:Ingress-Committed-Data-Rate=${ulBps}"\nCisco-AVPair="sub:Egress-Committed-Data-Rate=${dlBps}"`;
        break;
      case 'chillispot':
        coaAttrs += `\nChilliSpot-Bandwidth-Max-Down=${dlBps}\nChilliSpot-Bandwidth-Max-Up=${ulBps}`;
        break;
      default:
        // Unknown vendor: send WISPr + ChilliSpot for max compatibility
        // Do NOT send Mikrotik-specific attrs
        coaAttrs += `\nWISPr-Bandwidth-Max-Down=${dlBps}\nWISPr-Bandwidth-Max-Up=${ulBps}\nChilliSpot-Bandwidth-Max-Down=${dlBps}\nChilliSpot-Bandwidth-Max-Up=${ulBps}`;
        break;
    }

    const radResult = await executeRadclient(nas.ip, nas.coaPort, 'coa', nas.secret, coaAttrs);

    logCoaAction({
      action: 'bandwidth', username,
      nasIpAddress: nas.ip, sharedSecret: nas.secret, attributes: coaAttrs,
      result: radResult.success ? 'success' : 'failed',
      errorMessage: radResult.error,
    });

    // Also update radreply to persist the new bandwidth (vendor-aware)
    if (radResult.success) {
      try {
        // Delete ALL known bandwidth attributes for this user
        const bwAttrs = ['Mikrotik-Rate-Limit', 'WISPr-Bandwidth-Max-Down', 'WISPr-Bandwidth-Max-Up',
          'ChilliSpot-Bandwidth-Max-Down', 'ChilliSpot-Bandwidth-Max-Up', 'Cisco-AVPair'];
        for (const attr of bwAttrs) {
          db.query("DELETE FROM radreply WHERE username = ? AND attribute = ?").run(username, attr);
        }
        // Write vendor-appropriate attributes (same as generateBandwidthAttributes)
        const allVendors = lookupAllNASVendors().map(v => normalizeVendor(v));
        // For multi-NAS: merge attributes from all vendors (deduplicated)
        const seen = new Set<string>();
        const uniqueVendors = [...new Set(allVendors)];
        for (const v of uniqueVendors) {
          const vAttrs = generateBandwidthAttributes(dlBps, ulBps, v);
          for (const [attr, val] of Object.entries(vAttrs)) {
            if (!seen.has(attr)) {
              seen.add(attr);
              insertRadReply.run(username, attr, '=', val);
            }
          }
        }
      } catch {
        // non-critical
      }
    }

    return c.json({
      success: radResult.success,
      data: { username, rateLimit, nasIp: nas.ip, output: radResult.output },
      message: radResult.success ? 'Bandwidth updated via CoA' : 'Bandwidth CoA failed',
    });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

app.post('/api/coa/disconnect-all', async (c) => {
  try {
    const body = await c.req.json();
    const { username } = body;

    if (!username) {
      return c.json({ success: false, error: 'username is required' }, 400);
    }

    // Find ALL active sessions for this user across all NAS
    const sessions = db.query(
      "SELECT acctsessionid, nasipaddress FROM radacct WHERE username = ? AND acctstoptime IS NULL"
    ).all(username) as Array<{ acctsessionid: string; nasipaddress: string }>;

    if (sessions.length === 0) {
      return c.json({ success: true, message: 'No active sessions found', disconnected: 0 });
    }

    let successCount = 0;
    let failCount = 0;
    const results: Array<{ sessionId: string; nasIp: string; success: boolean }> = [];

    for (const session of sessions) {
      const nas = lookupNAS(session.nasipaddress);
      if (!nas) {
        failCount++;
        results.push({ sessionId: session.acctsessionid, nasIp: session.nasipaddress, success: false });
        continue;
      }

      const attrs = `User-Name="${username}"\nAcct-Session-Id="${session.acctsessionid}"`;
      const radResult = await executeRadclient(nas.ip, nas.coaPort, 'disconnect', nas.secret, attrs);

      logCoaAction({
        action: 'disconnect-all', username, sessionId: session.acctsessionid,
        nasIpAddress: nas.ip, sharedSecret: nas.secret, attributes: attrs,
        result: radResult.success ? 'success' : 'failed',
        errorMessage: radResult.error,
      });

      if (radResult.success) {
        successCount++;
      } else {
        failCount++;
      }
      results.push({ sessionId: session.acctsessionid, nasIp: nas.ip, success: radResult.success });
    }

    return c.json({
      success: true,
      data: { username, disconnected: successCount, failed: failCount, results },
      message: `Disconnected ${successCount} of ${sessions.length} sessions`,
    });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

app.get('/api/coa/logs', (c) => {
  try {
    const limit = Math.min(parseInt(c.req.query('limit') || '100', 10) || 100, 1000);
    const offset = parseInt(c.req.query('offset') || '0', 10) || 0;

    const totalRow = db.query('SELECT COUNT(*) as c FROM RadiusCoaLog').get() as { c: number } | undefined;
    const total = totalRow?.c || 0;

    const rows = db.query('SELECT * FROM RadiusCoaLog ORDER BY timestamp DESC LIMIT ? OFFSET ?').all(limit, offset) as Record<string, unknown>[];
    return c.json({ success: true, data: rows, total });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ============================================================================
// Data Cap Enforcement
// ============================================================================

app.get('/api/data-cap/check', (c) => {
  try {
    const username = c.req.query('username') || '';
    if (!username) {
      return c.json({ success: false, error: 'username query parameter is required' }, 400);
    }

    // Get data cap from radreply (vendor-agnostic — check all known data-limit attributes)
    const capRow = db.query(
      "SELECT value FROM radreply WHERE username = ? AND attribute IN ('Mikrotik-Total-Limit', 'ChilliSpot-Max-Total-Octets', 'ChilliSpot-Max-Input-Octets', 'ChilliSpot-Max-Output-Octets', 'WISPr-Volume-Total-Octets', 'Delegated-Session-Timeout', 'Session-Timeout') LIMIT 1"
    ).get(username) as { value: string } | undefined;
    // For time-based caps (Session-Timeout), convert seconds to bytes equivalent isn't meaningful,
    // so only treat byte-oriented attributes as data caps
    const capAttrRow = db.query(
      "SELECT attribute, value FROM radreply WHERE username = ? AND attribute IN ('Mikrotik-Total-Limit', 'ChilliSpot-Max-Total-Octets', 'ChilliSpot-Max-Input-Octets', 'ChilliSpot-Max-Output-Octets', 'WISPr-Volume-Total-Octets') LIMIT 1"
    ).get(username) as { attribute: string; value: string } | undefined;
    let dataCapBytes = 0;
    if (capAttrRow) {
      dataCapBytes = parseInt(capAttrRow.value, 10) || 0;
      // If only input/output caps are set, sum them for total
      if (capAttrRow.attribute === 'ChilliSpot-Max-Input-Octets' || capAttrRow.attribute === 'ChilliSpot-Max-Output-Octets') {
        const otherAttr = capAttrRow.attribute === 'ChilliSpot-Max-Input-Octets' ? 'ChilliSpot-Max-Output-Octets' : 'ChilliSpot-Max-Input-Octets';
        const otherRow = db.query("SELECT value FROM radreply WHERE username = ? AND attribute = ?").get(username, otherAttr) as { value: string } | undefined;
        dataCapBytes += parseInt(otherRow?.value || '0', 10) || 0;
      }
    }

    // Get total usage from active radacct sessions
    const usageRow = db.query(
      "SELECT COALESCE(SUM(acctinputoctets + acctoutputoctets), 0) as total_bytes FROM radacct WHERE username = ? AND acctstoptime IS NULL"
    ).get(username) as { total_bytes: number } | undefined;
    const usedBytes = usageRow?.total_bytes || 0;

    const usedMB = Math.round(usedBytes / (1024 * 1024) * 100) / 100;
    const capMB = Math.round(dataCapBytes / (1024 * 1024) * 100) / 100;
    const percentage = dataCapBytes > 0 ? Math.round((usedBytes / dataCapBytes) * 100) / 100 : 0;

    return c.json({
      success: true,
      data: {
        username,
        usedBytes,
        usedMB,
        capBytes: dataCapBytes,
        capMB,
        percentage,
        exceeded: dataCapBytes > 0 && usedBytes >= dataCapBytes,
        hasCap: dataCapBytes > 0,
      },
    });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

app.post('/api/data-cap/enforce', async (c) => {
  try {
    const body = await c.req.json();
    const { username, action } = body;

    if (!username || !action) {
      return c.json({ success: false, error: 'username and action are required' }, 400);
    }

    const nas = lookupNAS();
    if (!nas) {
      return c.json({ success: false, error: 'No NAS client configured' }, 400);
    }

    // Find active sessions
    const sessions = db.query(
      "SELECT acctsessionid FROM radacct WHERE username = ? AND acctstoptime IS NULL"
    ).all(username) as Array<{ acctsessionid: string }>;

    if (sessions.length === 0) {
      return c.json({ success: true, message: 'No active sessions to enforce', enforced: 0 });
    }

    if (action === 'disconnect') {
      let successCount = 0;
      for (const session of sessions) {
        const attrs = `User-Name="${username}"\nAcct-Session-Id="${session.acctsessionid}"`;
        const radResult = await executeRadclient(nas.ip, nas.coaPort, 'disconnect', nas.secret, attrs);
        if (radResult.success) successCount++;

        // Always close session locally (regardless of radclient success)
        // This ensures the session is terminated in the DB even if CoA to NAS fails
        db.query("UPDATE radacct SET acctstoptime = datetime('now'), acctterminatecause = 'Data-Cap-Exceeded', acctupdatetime = datetime('now'), updatedAt = datetime('now') WHERE username = ? AND acctsessionid = ? AND acctstoptime IS NULL")
          .run(username, session.acctsessionid);
        db.query("UPDATE LiveSession SET status = 'ended', updatedAt = datetime('now') WHERE username = ? AND status = 'active'")
          .run(username);

        logCoaAction({
          action: 'data-cap-disconnect', username, sessionId: session.acctsessionid,
          nasIpAddress: nas.ip, sharedSecret: nas.secret, attributes: attrs,
          result: radResult.success ? 'success' : 'failed-local',
          errorMessage: radResult.error, triggeredBy: 'data-cap-enforce',
        });
      }
      return c.json({ success: true, enforced: successCount, total: sessions.length, action: 'disconnect' });
    }

    if (action === 'throttle') {
      // Vendor-aware throttle: use vendor-specific bandwidth attribute
      const vendor = normalizeVendor(nas.type);
      let throttleAttrs = `User-Name="${username}"`;
      switch (vendor) {
        case 'mikrotik':
          throttleAttrs += '\nMikrotik-Rate-Limit="256k/128k"';
          break;
        case 'cisco':
          throttleAttrs += '\nCisco-AVPair="sub:Ingress-Committed-Data-Rate=128000"\nCisco-AVPair="sub:Egress-Committed-Data-Rate=256000"';
          break;
        case 'chillispot':
          throttleAttrs += '\nChilliSpot-Bandwidth-Max-Down=256000\nChilliSpot-Bandwidth-Max-Up=128000';
          break;
        default:
          // Unknown vendor: use WISPr + ChilliSpot for throttle
          throttleAttrs += '\nWISPr-Bandwidth-Max-Down=256000\nWISPr-Bandwidth-Max-Up=128000\nChilliSpot-Bandwidth-Max-Down=256000\nChilliSpot-Bandwidth-Max-Up=128000';
          break;
      }
      let successCount = 0;
      for (const session of sessions) {
        const attrs = throttleAttrs + `\nAcct-Session-Id="${session.acctsessionid}"`;
        const radResult = await executeRadclient(nas.ip, nas.coaPort, 'coa', nas.secret, attrs);
        if (radResult.success) successCount++;
        logCoaAction({
          action: 'data-cap-throttle', username, sessionId: session.acctsessionid,
          nasIpAddress: nas.ip, sharedSecret: nas.secret, attributes: attrs,
          result: radResult.success ? 'success' : 'failed',
          errorMessage: radResult.error, triggeredBy: 'data-cap-enforce',
        });
      }
      return c.json({ success: true, enforced: successCount, total: sessions.length, action: 'throttle' });
    }

    return c.json({ success: false, error: 'Invalid action. Use "disconnect" or "throttle"' }, 400);
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

app.post('/api/data-cap/check-all', async (c) => {
  try {
    // Find all users with data caps (vendor-agnostic — check ALL known data-limit attributes)
    const cappedUsers = db.query(
      "SELECT DISTINCT username, attribute, value as cap_bytes FROM radreply WHERE attribute IN ('Mikrotik-Total-Limit', 'ChilliSpot-Max-Total-Octets', 'ChilliSpot-Max-Input-Octets', 'ChilliSpot-Max-Output-Octets', 'WISPr-Volume-Total-Octets') AND value IS NOT NULL AND CAST(value AS INTEGER) > 0"
    ).all() as Array<{ username: string; attribute: string; cap_bytes: string }>;

    const overCap: Array<{
      username: string; usedBytes: number; capBytes: number;
      usedMB: number; capMB: number; percentage: number;
      activeSessions: number;
    }> = [];

    for (const u of cappedUsers) {
      const capBytes = parseInt(u.cap_bytes, 10) || 0;
      if (capBytes <= 0) continue;

      const usageRow = db.query(
        "SELECT COALESCE(SUM(acctinputoctets + acctoutputoctets), 0) as total_bytes, COUNT(*) as sessions FROM radacct WHERE username = ? AND acctstoptime IS NULL"
      ).get(u.username) as { total_bytes: number; sessions: number } | undefined;

      const usedBytes = usageRow?.total_bytes || 0;
      if (usedBytes >= capBytes) {
        overCap.push({
          username: u.username,
          usedBytes,
          capBytes,
          usedMB: Math.round(usedBytes / (1024 * 1024) * 100) / 100,
          capMB: Math.round(capBytes / (1024 * 1024) * 100) / 100,
          percentage: Math.round((usedBytes / capBytes) * 100) / 100,
          activeSessions: usageRow?.sessions || 0,
        });
      }
    }

    return c.json({
      success: true,
      data: {
        cappedUsers: cappedUsers.length,
        overCapCount: overCap.length,
        overCap,
      },
    });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ============================================================================
// MAC Authentication
// ============================================================================

app.get('/api/mac-auth', (c) => {
  try {
    const propertyId = c.req.query('propertyId') || '';
    const status = c.req.query('status') || '';

    let sql = 'SELECT * FROM RadiusMacAuth WHERE 1=1';
    const params: unknown[] = [];

    if (propertyId) {
      sql += ' AND propertyId = ?';
      params.push(propertyId);
    }
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    sql += ' ORDER BY createdAt DESC';

    const rows = db.query(sql).all(...params) as Record<string, unknown>[];
    return c.json({ success: true, data: rows, total: rows.length });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

app.post('/api/mac-auth', async (c) => {
  try {
    const body = await c.req.json();
    const { macAddress, propertyId, username, guestId, description, autoLogin, validFrom, validUntil } = body;

    if (!macAddress) {
      return c.json({ success: false, error: 'macAddress is required' }, 400);
    }

    // Normalize MAC format
    const normalizedMac = macAddress.toLowerCase().replace(/[:-]/g, '');
    const macForRadius = normalizedMac.replace(/(.{2})(?=.)/g, '$1-'); // AA-BB-CC-DD-EE-FF

    const id = generateId('mac');
    const now = new Date().toISOString();

    // Default propertyId for manual MAC auth creation from GUI.
    // PMS provisioning always passes this explicitly.
    const resolvedPropertyId = propertyId || 'property-1';

    // Auto-calculate validUntil from sessionTimeout if not provided
    let resolvedValidUntil = validUntil || null;
    const sessionTimeout = body.sessionTimeout ? parseInt(body.sessionTimeout, 10) : null;
    if (!resolvedValidUntil && sessionTimeout && sessionTimeout > 0) {
      const ms = sessionTimeout * 60 * 1000;
      resolvedValidUntil = new Date(Date.now() + ms).toISOString();
    }

    db.query(
      `INSERT INTO RadiusMacAuth (id, propertyId, macAddress, username, guestId, description, autoLogin, validFrom, validUntil, lastSeenAt, loginCount, status, createdAt, updatedAt, guestName, bandwidthDown, bandwidthUp, sessionTimeout, dataLimitMB, groupName, planId)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id, resolvedPropertyId, macForRadius, username || macForRadius,
      guestId || null, description || null, autoLogin ? 1 : 0,
      validFrom || now, resolvedValidUntil, null, 0, 'active', now, now,
      body.guestName || null,
      body.bandwidthDown ? parseInt(body.bandwidthDown, 10) : null,
      body.bandwidthUp ? parseInt(body.bandwidthUp, 10) : null,
      sessionTimeout,
      body.dataLimitMB ? parseInt(body.dataLimitMB, 10) : null,
      body.groupName || null,
      body.planId || null,
    );

    // Also create radcheck entry for auto-auth via Calling-Station-Id
    if (autoLogin) {
      try {
        db.query("DELETE FROM radcheck WHERE username = ? AND attribute = 'Calling-Station-Id'").run(macForRadius);
        insertRadCheck.run(macForRadius, 'Calling-Station-Id', ':=', macForRadius);
        // Set a known password for the MAC user
        db.query("DELETE FROM radcheck WHERE username = ? AND attribute = 'Cleartext-Password'").run(macForRadius);
        insertRadCheck.run(macForRadius, 'Cleartext-Password', ':=', macForRadius);
      } catch {
        // non-critical
      }
    }

    return c.json({ success: true, data: { id, macAddress: macForRadius }, message: 'MAC address registered' });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

app.put('/api/mac-auth/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const body = await c.req.json();

    const existing = db.query('SELECT * FROM RadiusMacAuth WHERE id = ?').get(id) as Record<string, unknown> | null;
    if (!existing) {
      return c.json({ success: false, error: 'MAC auth entry not found' }, 404);
    }

    const now = new Date().toISOString();
    const fields: string[] = [];
    const params: unknown[] = [];

    if (body.macAddress !== undefined) {
      fields.push('macAddress = ?');
      params.push(body.macAddress.toLowerCase().replace(/[:-]/g, '').replace(/(.{2})(?=.)/g, '$1-'));
    }
    if (body.description !== undefined) { fields.push('description = ?'); params.push(body.description); }
    if (body.autoLogin !== undefined) { fields.push('autoLogin = ?'); params.push(body.autoLogin ? 1 : 0); }
    if (body.status !== undefined) { fields.push('status = ?'); params.push(body.status); }
    if (body.validFrom !== undefined) { fields.push('validFrom = ?'); params.push(body.validFrom); }
    if (body.validUntil !== undefined) { fields.push('validUntil = ?'); params.push(body.validUntil); }
    if (body.username !== undefined) { fields.push('username = ?'); params.push(body.username); }
    if (body.guestName !== undefined) { fields.push('guestName = ?'); params.push(body.guestName); }
    if (body.bandwidthDown !== undefined) { fields.push('bandwidthDown = ?'); params.push(parseInt(body.bandwidthDown, 10) || null); }
    if (body.bandwidthUp !== undefined) { fields.push('bandwidthUp = ?'); params.push(parseInt(body.bandwidthUp, 10) || null); }
    if (body.sessionTimeout !== undefined) { fields.push('sessionTimeout = ?'); params.push(parseInt(body.sessionTimeout, 10) || null); }
    if (body.dataLimitMB !== undefined) { fields.push('dataLimitMB = ?'); params.push(parseInt(body.dataLimitMB, 10) || null); }
    if (body.groupName !== undefined) { fields.push('groupName = ?'); params.push(body.groupName); }
    if (body.planId !== undefined) { fields.push('planId = ?'); params.push(body.planId); }

    if (fields.length === 0) {
      return c.json({ success: false, error: 'No fields to update' }, 400);
    }

    fields.push("updatedAt = ?");
    params.push(now, id);

    db.query(`UPDATE RadiusMacAuth SET ${fields.join(', ')} WHERE id = ?`).run(...params);

    return c.json({ success: true, message: 'MAC auth entry updated' });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

app.delete('/api/mac-auth/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const existing = db.query('SELECT * FROM RadiusMacAuth WHERE id = ?').get(id) as Record<string, unknown> | null;
    if (!existing) {
      return c.json({ success: false, error: 'MAC auth entry not found' }, 404);
    }

    // Remove radcheck entries for this MAC
    const mac = existing.macAddress as string;
    db.query("DELETE FROM radcheck WHERE username = ? AND attribute = 'Calling-Station-Id'").run(mac);
    db.query("DELETE FROM radcheck WHERE username = ? AND attribute = 'Cleartext-Password'").run(mac);

    db.query('DELETE FROM RadiusMacAuth WHERE id = ?').run(id);
    return c.json({ success: true, message: 'MAC auth entry deleted' });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

app.post('/api/mac-auth/check', async (c) => {
  try {
    const body = await c.req.json();
    const { macAddress } = body;

    if (!macAddress) {
      return c.json({ success: false, error: 'macAddress is required' }, 400);
    }

    const normalizedMac = macAddress.toLowerCase().replace(/[:-]/g, '').replace(/(.{2})(?=.)/g, '$1-');
    const now = new Date().toISOString();

    const entry = db.query(
      "SELECT * FROM RadiusMacAuth WHERE macAddress = ? AND status = 'active' ORDER BY createdAt DESC LIMIT 1"
    ).get(normalizedMac) as Record<string, unknown> | null;

    if (!entry) {
      return c.json({ success: true, data: { allowed: false, reason: 'MAC not found or inactive' } });
    }

    // Check validity period
    const validFrom = entry.validFrom as string;
    const validUntil = entry.validUntil as string;
    if (validFrom && now < validFrom) {
      return c.json({ success: true, data: { allowed: false, reason: 'Not yet valid', entry } });
    }
    if (validUntil && now > validUntil) {
      return c.json({ success: true, data: { allowed: false, reason: 'Expired', entry } });
    }

    // Update last seen
    db.query('UPDATE RadiusMacAuth SET lastSeenAt = ?, loginCount = loginCount + 1 WHERE id = ?').run(now, entry.id);
    db.query('UPDATE RadiusMacAuth SET updatedAt = ? WHERE id = ?').run(now, entry.id);

    return c.json({ success: true, data: { allowed: true, entry } });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Bulk import MAC auth entries
app.post('/api/mac-auth/import', async (c) => {
  try {
    const body = await c.req.json();
    const { macs } = body as { macs?: Array<{ macAddress: string; description?: string; username?: string }> };

    if (!macs || !Array.isArray(macs) || macs.length === 0) {
      return c.json({ success: false, error: 'macs array is required' }, 400);
    }

    let imported = 0;
    let skipped = 0;

    for (const item of macs) {
      const mac = item.macAddress?.toUpperCase().trim();
      if (!mac || !/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(mac)) {
        skipped++;
        continue;
      }

      const existing = db.query('SELECT id FROM RadiusMacAuth WHERE macAddress = ?').get(mac);
      if (existing) { skipped++; continue; }

      const id = `mac_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const macForRadius = mac.replace(/(.{2})(?=.)/g, '$1-'); // AA:BB:CC:DD:EE:FF → AA-BB-CC-DD-EE-FF
      db.query(
        `INSERT INTO RadiusMacAuth (id, propertyId, macAddress, username, description, autoLogin, validFrom, validUntil, status, createdAt, updatedAt)
         VALUES (?, 'property-1', ?, ?, ?, 1, datetime('now'), NULL, 'active', datetime('now'), datetime('now'))`
      ).run(id, macForRadius, macForRadius, item.description || null);

      // Create radcheck entries matching the main MAC auth flow (username = macForRadius)
      const insertRadCheck = db.query(
        `INSERT INTO radcheck (username, attribute, op, value, isActive, createdAt, updatedAt)
         VALUES (?, ?, ':=', ?, 1, datetime('now'), datetime('now'))`
      );
      insertRadCheck.run(macForRadius, 'Calling-Station-Id', macForRadius);
      insertRadCheck.run(macForRadius, 'Cleartext-Password', macForRadius);

      imported++;
    }

    return c.json({ success: true, imported, skipped, total: macs.length });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ============================================================================
// Event/Conference Users
// ============================================================================

// Create a new event (persist to RadiusEvent table)
app.post('/api/event-users/event', async (c) => {
  try {
    const body = await c.req.json();
    const { name, planId, bandwidthDown, bandwidthUp, dataLimitMb, validHours, propertyId, organizerName, organizerEmail, organizerCompany } = body as {
      name: string; planId?: string; bandwidthDown?: number; bandwidthUp?: number; dataLimitMb?: number; validHours?: number; propertyId?: string;
      organizerName?: string; organizerEmail?: string; organizerCompany?: string;
    };

    if (!name) {
      return c.json({ success: false, error: 'Event name is required' }, 400);
    }

    const id = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    // Persist to RadiusEvent table
    db.query(
      `INSERT INTO RadiusEvent (id, propertyId, name, planId, bandwidthDown, bandwidthUp, dataLimitMb, validHours, organizerName, organizerEmail, organizerCompany, status, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`
    ).run(
      id,
      propertyId || null,
      name,
      planId || null,
      bandwidthDown || null,
      bandwidthUp || null,
      dataLimitMb || null,
      validHours || 24,
      organizerName || null,
      organizerEmail || null,
      organizerCompany || null,
      now.toISOString(),
      now.toISOString(),
    );

    return c.json({
      success: true,
      data: { id, name, planId, bandwidthDown: bandwidthDown || 5, bandwidthUp: bandwidthUp || 2, dataLimitMb, validHours, organizerName, organizerEmail, organizerCompany, status: 'active', createdAt: now.toISOString() },
    });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

app.get('/api/event-users', (c) => {
  try {
    const eventId = c.req.query('eventId') || '';
    const status = c.req.query('status') || '';

    let sql = 'SELECT * FROM RadiusEventUser WHERE status != ?';
    const params: unknown[] = ['event_meta'];

    if (eventId) {
      sql += ' AND eventId = ?';
      params.push(eventId);
    }
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    sql += ' ORDER BY createdAt DESC';

    const rows = db.query(sql).all(...params) as Record<string, unknown>[];

    // Derive events list from unique eventId in user rows
    const eventMap = new Map<string, Record<string, unknown>>();
    for (const row of rows) {
      const eid = row.eventId as string;
      if (eid && !eventMap.has(eid)) {
        eventMap.set(eid, {
          id: eid,
          name: (row.eventName as string) || eid,
          planId: row.planId || '',
          bandwidthDown: row.bandwidthDown || 0,
          bandwidthUp: row.bandwidthUp || 0,
          dataLimitMb: row.dataLimitMb || 0,
          validHours: 24,
          status: (row.status as string) || 'active',
          createdAt: (row.createdAt as string) || '',
        });
      }
    }

    // Also query RadiusEvent table — merge with derived events (explicit take priority)
    let explicitEvents: Record<string, unknown>[] = [];
    try {
      explicitEvents = db.query('SELECT * FROM RadiusEvent ORDER BY createdAt DESC').all() as Record<string, unknown>[];
    } catch { /* table may not exist yet */ }

    // Merge: explicit events override derived events with same id
    for (const evt of explicitEvents) {
      const eid = evt.id as string;
      eventMap.set(eid, {
        id: eid,
        name: (evt.name as string) || eid,
        planId: evt.planId || '',
        bandwidthDown: evt.bandwidthDown || 0,
        bandwidthUp: evt.bandwidthUp || 0,
        dataLimitMb: evt.dataLimitMb || 0,
        validHours: evt.validHours || 24,
        organizerName: evt.organizerName || '',
        organizerEmail: evt.organizerEmail || '',
        organizerCompany: evt.organizerCompany || '',
        status: (evt.status as string) || 'active',
        createdAt: (evt.createdAt as string) || '',
      });
    }

    const mergedEvents = Array.from(eventMap.values())
      .filter(e => (e.status as string) !== 'event_meta');

    return c.json({
      success: true,
      data: {
        events: mergedEvents,
        users: rows,
      },
      total: rows.length,
    });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

app.post('/api/event-users/bulk', async (c) => {
  try {
    const body = await c.req.json();
    const { eventId, eventName, count, bandwidthDown, bandwidthUp, dataLimitMb, validHours, propertyId } = body;

    if (!eventId || !count) {
      return c.json({ success: false, error: 'eventId and count are required' }, 400);
    }

    const bulkCount = Math.min(parseInt(String(count), 10) || 0, 500);
    if (bulkCount <= 0) {
      return c.json({ success: false, error: 'count must be between 1 and 500' }, 400);
    }

    const now = new Date().toISOString();
    const validFrom = now;
    const validUntil = String(Date.now() + (parseInt(String(validHours), 10) || 24) * 3600 * 1000);
    const createdUsers: Array<{ id: string; username: string; password: string }> = [];

    // Generate a short event code from eventId (last 6 chars)
    const shortCode = eventId.slice(-6).toUpperCase();
    const startNum = Math.floor(Math.random() * 90) + 10; // 10-99 to avoid leading zeros

    for (let i = 1; i <= bulkCount; i++) {
      const num = String(startNum + i - 1).padStart(3, '0');
      const username = `EV${shortCode}-${num}`;
      const password = generateSharedSecret(8);
      const id = generateId('evu');

      db.query(
        `INSERT INTO RadiusEventUser (id, propertyId, eventId, eventName, username, password, planId, bandwidthDown, bandwidthUp, dataLimitMb, validFrom, validUntil, maxSessions, status, firstUsedAt, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        id, propertyId || 'property-1', eventId, eventName || '', username, password,
        null,
        bandwidthDown || 5, bandwidthUp || 2,
        dataLimitMb || null,
        validFrom, validUntil, 1, 'active', null, now, now,
      );

      // Create RADIUS user (radcheck + radreply) via vendor-aware generator
      const attrs: Record<string, string> = {};
      if (bandwidthDown || dataLimitMb) {
        const vendorAttrs = generateVendorAttributes({
          downloadBps: (parseInt(String(bandwidthDown), 10) || 10) * 1000000,
          uploadBps: (parseInt(String(bandwidthUp), 10) || parseInt(String(bandwidthDown), 10) || 10) * 1000000,
          sessionTimeoutMinutes: parseInt(String(validHours), 10) * 60 || 1440,
          dataLimitMB: parseInt(String(dataLimitMb), 10) || 0,
        });
        Object.assign(attrs, vendorAttrs);
      }

      // Resolve RADIUS group from WiFi plan linked to the event (not the event name)
      const groupName = resolveEventGroupFromPlan(eventId, eventName);

      const user: RADIUSUser = {
        id, username, password,
        group: groupName,
        attributes: attrs,
        createdAt: now, updatedAt: now,
        validUntil,
      };
      createRADIUSUser(user);

      createdUsers.push({ id, username, password });
    }

    return c.json({
      success: true,
      data: {
        eventId, eventName, created: createdUsers.length,
        users: createdUsers,
        validFrom, validUntil,
      },
      message: `Created ${createdUsers.length} event users`,
    });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

app.post('/api/event-users/:id/revoke', async (c) => {
  try {
    const { id } = c.req.param();

    const existing = db.query('SELECT * FROM RadiusEventUser WHERE id = ?').get(id) as Record<string, unknown> | null;
    if (!existing) {
      return c.json({ success: false, error: 'Event user not found' }, 404);
    }

    const username = existing.username as string;
    const now = new Date().toISOString();

    db.query("UPDATE RadiusEventUser SET status = 'revoked', updatedAt = ? WHERE id = ?").run(now, id);

    // Remove RADIUS user
    db.query('DELETE FROM radcheck WHERE username = ?').run(username);
    db.query('DELETE FROM radreply WHERE username = ?').run(username);
    db.query('DELETE FROM radusergroup WHERE username = ?').run(username);
    db.query('DELETE FROM WiFiUser WHERE username = ?').run(username);

    return c.json({ success: true, message: 'Event user revoked' });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

app.delete('/api/event-users/bulk', async (c) => {
  try {
    const body = await c.req.json();
    const { eventUserIds } = body;

    if (!Array.isArray(eventUserIds) || eventUserIds.length === 0) {
      return c.json({ success: false, error: 'eventUserIds array is required' }, 400);
    }

    let deletedCount = 0;
    for (const uid of eventUserIds) {
      const existing = db.query('SELECT username FROM RadiusEventUser WHERE id = ?').get(uid) as { username: string } | null;
      if (existing) {
        db.query('DELETE FROM radcheck WHERE username = ?').run(existing.username);
        db.query('DELETE FROM radreply WHERE username = ?').run(existing.username);
        db.query('DELETE FROM radusergroup WHERE username = ?').run(existing.username);
        db.query('DELETE FROM WiFiUser WHERE username = ?').run(existing.username);
      }
      const result = db.query('DELETE FROM RadiusEventUser WHERE id = ?').run(uid);
      deletedCount += result.changes;
    }

    return c.json({ success: true, deleted: deletedCount, message: `Deleted ${deletedCount} event users` });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Create a single event attendee with guest details (guestName, guestEmail, guestCompany)
app.post('/api/event-users/attendee', async (c) => {
  try {
    const body = await c.req.json();
    const { eventId, eventName, guestName, guestEmail, guestCompany, bandwidthDown, bandwidthUp, dataLimitMb, validHours, propertyId } = body;

    if (!eventId || !guestName) {
      return c.json({ success: false, error: 'eventId and guestName are required' }, 400);
    }

    // Look up the event to get its config
    const event = db.query('SELECT * FROM RadiusEvent WHERE id = ?').get(eventId) as Record<string, unknown> | null;
    const effectiveEventName = eventName || (event?.name as string) || eventId;
    const effectivePlanId = event?.planId as string || null;
    const effectiveBwDown = bandwidthDown || (event?.bandwidthDown as number) || 10;
    const effectiveBwUp = bandwidthUp || (event?.bandwidthUp as number) || Math.round(effectiveBwDown * 0.4);
    const effectiveDataLimit = dataLimitMb || (event?.dataLimitMb as number) || null;
    const effectiveValidHours = validHours || (event?.validHours as number) || 24;

    // Generate short username: first 3 chars of name + 4 random chars
    const nameSlug = guestName.toLowerCase().replace(/[^a-z]/g, '').slice(0, 3);
    const rnd = Math.random().toString(36).substring(2, 6);
    const username = `EV${nameSlug}${rnd}`;
    const password = generateSharedSecret(8);
    const id = generateId('evu');

    const now = new Date().toISOString();
    const validFrom = now;
    const validUntil = String(Date.now() + effectiveValidHours * 3600 * 1000);

    db.query(
      `INSERT INTO RadiusEventUser (id, propertyId, eventId, eventName, username, password, planId, bandwidthDown, bandwidthUp, dataLimitMb, validFrom, validUntil, maxSessions, status, firstUsedAt, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id, propertyId || 'default', eventId, effectiveEventName, username, password,
      effectivePlanId,
      effectiveBwDown, effectiveBwUp,
      effectiveDataLimit,
      validFrom, validUntil, 1, 'active', null, now, now,
    );

    // Also set guest details
    try {
      db.query('UPDATE RadiusEventUser SET guestName = ?, guestEmail = ?, guestCompany = ? WHERE id = ?')
        .run(guestName || null, guestEmail || null, guestCompany || null, id);
    } catch { /* columns may not exist yet */ }

    // Create RADIUS user
    const attrs: Record<string, string> = {};
    if (effectiveBwDown || effectiveDataLimit) {
      const vendorAttrs = generateVendorAttributes({
        downloadBps: effectiveBwDown * 1000000,
        uploadBps: effectiveBwUp * 1000000,
        sessionTimeoutMinutes: effectiveValidHours * 60,
        dataLimitMB: effectiveDataLimit || 0,
      });
      Object.assign(attrs, vendorAttrs);
    }

    // Resolve RADIUS group from WiFi plan linked to the event (not the event name)
    const groupName = resolveEventGroupFromPlan(eventId, effectiveEventName);
    const user: RADIUSUser = {
      id, username, password,
      group: groupName,
      attributes: attrs,
      createdAt: now, updatedAt: now,
      validUntil,
    };
    createRADIUSUser(user);

    return c.json({
      success: true,
      data: { id, eventId, username, password, guestName, guestEmail, guestCompany, validUntil },
      message: 'Attendee created successfully',
    });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Delete an event and all its associated users
app.delete('/api/event-users/event/:eventId', async (c) => {
  try {
    const { eventId } = c.req.param();

    // 1. Get all users for this event
    const eventUsers = db.query('SELECT username, id FROM RadiusEventUser WHERE eventId = ?').all(eventId) as { username: string; id: string }[];

    // 2. Remove all RADIUS users
    for (const eu of eventUsers) {
      db.query('DELETE FROM radcheck WHERE username = ?').run(eu.username);
      db.query('DELETE FROM radreply WHERE username = ?').run(eu.username);
      db.query('DELETE FROM radusergroup WHERE username = ?').run(eu.username);
      db.query('DELETE FROM WiFiUser WHERE username = ?').run(eu.username);
    }

    // 3. Delete all event users
    db.query('DELETE FROM RadiusEventUser WHERE eventId = ?').run(eventId);

    // 4. Delete the event itself
    db.query('DELETE FROM RadiusEvent WHERE id = ?').run(eventId);

    return c.json({
      success: true,
      deleted: eventUsers.length,
      message: `Deleted event and ${eventUsers.length} associated users`,
    });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

app.get('/api/event-users/:id/credentials', async (c) => {
  try {
    const { id } = c.req.param();

    const row = db.query(
      'SELECT id, username, password, eventName, eventId, validFrom, validUntil, status, guestName, guestEmail, guestCompany FROM RadiusEventUser WHERE id = ?'
    ).get(id) as Record<string, unknown> | null;

    if (!row) {
      return c.json({ success: false, error: 'Event user not found' }, 404);
    }

    return c.json({
      success: true,
      data: {
        ...row,
        printLabel: `${row.eventName || 'Event'} — WiFi Access`,
        networkName: 'Hotel WiFi',
        portalUrl: 'http://1.1.1.1/login',
      },
    });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ============================================================================
// Portal Whitelist
// ============================================================================

app.get('/api/portal-whitelist', (c) => {
  try {
    const propertyId = c.req.query('propertyId') || '';

    let sql = 'SELECT * FROM PortalWhitelist WHERE 1=1';
    const params: unknown[] = [];

    if (propertyId) {
      sql += ' AND propertyId = ?';
      params.push(propertyId);
    }
    sql += ' ORDER BY priority ASC, createdAt DESC';

    const rows = db.query(sql).all(...params) as Record<string, unknown>[];
    return c.json({ success: true, data: rows, total: rows.length });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

app.post('/api/portal-whitelist', async (c) => {
  try {
    const body = await c.req.json();
    const { domain, path, description, protocol, bypassAuth, priority, propertyId, status } = body;

    if (!domain) {
      return c.json({ success: false, error: 'domain is required' }, 400);
    }

    const id = generateId('wl');
    const now = new Date().toISOString();

    db.query(
      `INSERT INTO PortalWhitelist (id, propertyId, domain, path, description, protocol, bypassAuth, priority, status, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id, propertyId || null, domain, path || null, description || null,
      protocol || 'https', bypassAuth ? 1 : 0,
      priority || 0, status || 'active', now, now,
    );

    return c.json({ success: true, data: { id, domain }, message: 'Whitelist entry created' });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

app.put('/api/portal-whitelist/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const body = await c.req.json();

    const existing = db.query('SELECT * FROM PortalWhitelist WHERE id = ?').get(id) as Record<string, unknown> | null;
    if (!existing) {
      return c.json({ success: false, error: 'Whitelist entry not found' }, 404);
    }

    const now = new Date().toISOString();
    const fields: string[] = [];
    const params: unknown[] = [];

    if (body.domain !== undefined) { fields.push('domain = ?'); params.push(body.domain); }
    if (body.path !== undefined) { fields.push('path = ?'); params.push(body.path); }
    if (body.description !== undefined) { fields.push('description = ?'); params.push(body.description); }
    if (body.protocol !== undefined) { fields.push('protocol = ?'); params.push(body.protocol); }
    if (body.bypassAuth !== undefined) { fields.push('bypassAuth = ?'); params.push(body.bypassAuth ? 1 : 0); }
    if (body.priority !== undefined) { fields.push('priority = ?'); params.push(body.priority); }
    if (body.status !== undefined) { fields.push('status = ?'); params.push(body.status); }
    if (body.propertyId !== undefined) { fields.push('propertyId = ?'); params.push(body.propertyId); }

    if (fields.length === 0) {
      return c.json({ success: false, error: 'No fields to update' }, 400);
    }

    fields.push("updatedAt = ?");
    params.push(now, id);

    db.query(`UPDATE PortalWhitelist SET ${fields.join(', ')} WHERE id = ?`).run(...params);
    return c.json({ success: true, message: 'Whitelist entry updated' });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

app.delete('/api/portal-whitelist/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const result = db.query('DELETE FROM PortalWhitelist WHERE id = ?').run(id);
    if (result.changes === 0) {
      return c.json({ success: false, error: 'Whitelist entry not found' }, 404);
    }
    return c.json({ success: true, message: 'Whitelist entry deleted' });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

app.get('/api/portal-whitelist/export', (c) => {
  try {
    const rows = db.query(
      "SELECT * FROM PortalWhitelist WHERE status = 'active' ORDER BY priority ASC"
    ).all() as Array<Record<string, unknown>>;

    // Generate DNS config format
    const lines: string[] = [
      '# StaySuite Portal Whitelist — DNS Configuration',
      '# Generated: ' + new Date().toISOString(),
      '# Add these domains to your captive portal bypass list',
      '',
    ];

    for (const row of rows) {
      const domain = row.domain as string;
      const path = row.path as string;
      const protocol = row.protocol as string;
      const bypass = row.bypassAuth as number;
      lines.push(`${protocol || 'https'}://${domain}${path || ''}  # bypass=${bypass ? 'yes' : 'no'}`);
    }

    return c.json({
      success: true,
      data: {
        entries: rows,
        dnsConfig: lines.join('\n'),
        count: rows.length,
      },
    });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ============================================================================
// Sync Users/Groups (fix broken proxy endpoints)
// ============================================================================

app.post('/api/sync/users', async (c) => {
  try {
    const startTimeMs = Date.now();
    const wifiUsers = db.query('SELECT * FROM WiFiUser WHERE status = ? AND radiusSynced = 0', ['active']).all() as Array<Record<string, unknown>>;
    let syncedCount = 0;

    for (const wu of wifiUsers) {
      try {
        const username = wu.username as string;
        const password = wu.password as string;

        // Check if radcheck entry already exists
        const existing = db.query("SELECT id FROM radcheck WHERE username = ? AND attribute = 'Cleartext-Password'").get(username);
        if (!existing) {
          db.query("DELETE FROM radcheck WHERE username = ? AND attribute = 'Cleartext-Password'").run(username);
          insertRadCheck.run(username, 'Cleartext-Password', ':=', password);
        }

        // Copy reply attributes from WiFiUser bandwidth fields
        const downloadSpeed = wu.downloadSpeed || wu.downloadBandwidth;
        const uploadSpeed = wu.uploadSpeed || wu.uploadBandwidth;

        if (downloadSpeed || uploadSpeed) {
          const vendorAttrs = generateVendorAttributes({
            downloadBps: parseInt(String(downloadSpeed), 10) * 1000000,
            uploadBps: parseInt(String(uploadSpeed || downloadSpeed), 10) * 1000000,
            sessionTimeoutMinutes: parseInt(String(wu.sessionTimeout), 10) || 1440,
            dataLimitMB: parseInt(String(wu.dataLimitMb || wu.dataLimit), 10) || 0,
          });
          for (const [attr, val] of Object.entries(vendorAttrs)) {
            db.query("DELETE FROM radreply WHERE username = ? AND attribute = ?").run(username, attr);
            insertRadReply.run(username, attr, '=', val);
          }
        }

        // Set data limit if configured (vendor-aware)
        const dataLimitMb = wu.dataLimitMb || wu.dataLimit;
        if (dataLimitMb) {
          const dataLimitBytes = parseInt(String(dataLimitMb), 10) * 1024 * 1024;
          // Delete ALL known data-limit attributes
          const dlAttrs = ['Mikrotik-Total-Limit', 'ChilliSpot-Max-Total-Octets', 'ChilliSpot-Max-Input-Octets', 'ChilliSpot-Max-Output-Octets'];
          for (const attr of dlAttrs) {
            db.query("DELETE FROM radreply WHERE username = ? AND attribute = ?").run(username, attr);
          }
          // Write vendor-appropriate data limit attributes
          const allVendors = lookupAllNASVendors().map(v => normalizeVendor(v));
          for (const v of [...new Set(allVendors)]) {
            const dlAttrsGenerated = generateSessionAttributes(0, parseInt(String(dataLimitMb), 10), v);
            for (const [attr, val] of Object.entries(dlAttrsGenerated)) {
              if (attr !== 'Session-Timeout') { // skip session-timeout, only data-limit attrs
                db.query("DELETE FROM radreply WHERE username = ? AND attribute = ?").run(username, attr);
                insertRadReply.run(username, attr, '=', val);
              }
            }
          }
        }

        // Set session timeout if configured
        const sessionTimeout = wu.sessionTimeout;
        if (sessionTimeout) {
          db.query("DELETE FROM radreply WHERE username = ? AND attribute = 'Session-Timeout'").run(username);
          insertRadReply.run(username, 'Session-Timeout', '=', String(parseInt(String(sessionTimeout), 10) * 60));
        }

        // Set group
        const group = wu.planName || wu.groupName || 'standard-guests';
        db.query("DELETE FROM radusergroup WHERE username = ?").run(username);
        insertRadUserGroup.run(username, group, 0);

        // Mark as synced
        db.query('UPDATE WiFiUser SET radiusSynced = 1, updatedAt = datetime("now") WHERE id = ?').run(wu.id);
        syncedCount++;
      } catch (err) {
        log.error('Failed to sync WiFiUser to RADIUS', { username: wu.username, error: String(err) });
      }
    }

    // Log provisioning
    if (syncedCount > 0) {
      db.query(
        `INSERT INTO RadiusProvisioningLog (id, propertyId, action, username, result, details, durationMs, timestamp)
         VALUES (?, null, 'sync-users', ?, ?, ?, ?, ?)`
      ).run(
        generateId('plog'), `batch-${syncedCount}`, 'success',
        `Synced ${syncedCount} users from WiFiUser to RADIUS`,
        Date.now() - startTimeMs, new Date().toISOString(),
      );
    }

    const duration = Date.now() - startTimeMs;
    return c.json({
      success: true,
      data: { syncedCount, totalPending: wifiUsers.length, durationMs: duration },
      message: `Synced ${syncedCount} users to RADIUS`,
    });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

app.post('/api/sync/clients', async (c) => {
  try {
    const result = await writeAllNASClientsToConf();
    return c.json({
      success: result,
      message: result ? 'clients.conf re-written from nas table' : 'Failed to write clients.conf',
    });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ============================================================================
// Service Logs (fix broken proxy endpoint)
// ============================================================================

app.get('/api/logs', async (c) => {
  try {
    const lines = Math.min(parseInt(c.req.query('lines') || '50', 10) || 50, 500);

    // Try journalctl first (systemd)
    try {
      const { stdout } = await execAsync(`journalctl -u radiusd --no-pager -n ${lines} 2>/dev/null`);
      if (stdout.trim().length > 0) {
        return c.json({
          success: true,
          data: {
            source: 'journalctl',
            lines: stdout.trim().split('\n'),
            count: stdout.trim().split('\n').length,
          },
        });
      }
    } catch {
      // journalctl not available
    }

    // Fallback: try log files
    const logPaths = ['/var/log/radiusd/radius.log', '/var/log/raddb/radius.log', '/var/log/freeradius/radius.log'];
    for (const logPath of logPaths) {
      try {
        const { stdout } = await execAsync(`tail -n ${lines} "${logPath}" 2>/dev/null`);
        if (stdout.trim().length > 0) {
          return c.json({
            success: true,
            data: {
              source: logPath,
              lines: stdout.trim().split('\n'),
              count: stdout.trim().split('\n').length,
            },
          });
        }
      } catch {
        // file doesn't exist
      }
    }

    return c.json({
      success: true,
      data: { source: 'none', lines: [], count: 0, message: 'No RADIUS log files found' },
    });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ============================================================================
// Simultaneous-Use Enforcement Helper
// ============================================================================

/**
 * Set Simultaneous-Use limit in radgroupcheck for a group.
 * This controls how many concurrent RADIUS sessions a group member can have.
 *
 * @param groupName - The RADIUS group name
 * @param maxSessions - Maximum concurrent sessions (0 = unlimited)
 */
function setSimultaneousUse(groupName: string, maxSessions: number): void {
  if (maxSessions <= 0) {
    // Remove the limit (unlimited)
    db.query("DELETE FROM radgroupcheck WHERE groupname = ? AND attribute = 'Simultaneous-Use'").run(groupName);
    log.info(`Removed Simultaneous-Use limit for group "${groupName}"`);
  } else {
    // Upsert the limit
    db.query("DELETE FROM radgroupcheck WHERE groupname = ? AND attribute = 'Simultaneous-Use'").run(groupName);
    db.query('INSERT INTO radgroupcheck (groupname, attribute, op, value) VALUES (?, ?, ?, ?)')
      .run(groupName, 'Simultaneous-Use', ':=', String(maxSessions));
    log.info(`Set Simultaneous-Use=${maxSessions} for group "${groupName}"`);
  }
}

/**
 * Set Simultaneous-Use for all known groups at once.
 * @param limits - Map of groupName → maxSessions
 */
function setAllSimultaneousUse(limits: Record<string, number>): void {
  for (const [group, max] of Object.entries(limits)) {
    setSimultaneousUse(group, max);
  }
}

// ============================================================================
// Accounting from radacct table (SQL-based)
// ============================================================================

app.get('/api/accounting/db', (c) => {
  try {
    const limit = Math.min(parseInt(c.req.query('limit') || '100', 10) || 100, 1000);
    const offset = parseInt(c.req.query('offset') || '0', 10) || 0;
    const username = c.req.query('username') || '';
    const nasIp = c.req.query('nasIp') || '';
    const status = c.req.query('status') || '';
    const startDate = c.req.query('startDate') || '';
    const endDate = c.req.query('endDate') || '';

    let sql = 'SELECT * FROM radacct WHERE 1=1';
    const params: unknown[] = [];

    if (username) {
      sql += ' AND username LIKE ?';
      params.push(`%${username}%`);
    }
    if (nasIp) {
      sql += ' AND nasipaddress = ?';
      params.push(nasIp);
    }
    if (status === 'active') {
      sql += ' AND acctstoptime IS NULL';
    } else if (status === 'stopped') {
      sql += ' AND acctstoptime IS NOT NULL';
    }
    if (startDate) {
      sql += ' AND acctstarttime >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND acctstarttime <= ?';
      params.push(endDate + 'T23:59:59');
    }

    // Get total count
    const countRow = db.query(sql.replace('SELECT *', 'SELECT COUNT(*) as cnt')).get(...params) as { cnt: number } | undefined;
    const total = countRow?.cnt || 0;

    sql += ' ORDER BY acctstarttime DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = db.query(sql).all(...params) as Record<string, unknown>[];

    // Summary stats
    const activeRow = db.query("SELECT COUNT(*) as c FROM radacct WHERE acctstoptime IS NULL").get() as { c: number } | undefined;
    const activeSessions = activeRow?.c || 0;

    const bytesRow = db.query(
      "SELECT COALESCE(SUM(acctinputoctets), 0) as inp, COALESCE(SUM(acctoutputoctets), 0) as out FROM radacct"
    ).get() as { inp: number; out: number } | undefined;

    return c.json({
      success: true,
      data: rows,
      total,
      summary: {
        totalRecords: total,
        activeSessions,
        totalInputBytes: bytesRow?.inp || 0,
        totalOutputBytes: bytesRow?.out || 0,
      },
    });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ============================================================================
// User Usage Summary & Detail Endpoints (SQL aggregation on radacct)
// ============================================================================

/**
 * GET /api/user-usage/summary
 *
 * Aggregates per-user usage from the radacct table.
 *
 * Query params:
 *   limit     — max users to return (default 20, max 500)
 *   sort      — 'download' (default) or 'session_time'
 *   startDate — ISO date filter (e.g. 2025-01-01)
 *   endDate   — ISO date filter (e.g. 2025-06-30)
 *
 * Returns:
 *   users[]       — per-user aggregation
 *   overallStats  — totalUsers, totalBandwidth, topUser
 */
app.get('/api/user-usage/summary', (c) => {
  try {
    const limit = Math.min(Math.max(parseInt(c.req.query('limit') || '20', 10) || 20, 1), 500);
    const sort = c.req.query('sort') || 'download';
    const startDate = c.req.query('startDate') || '';
    const endDate = c.req.query('endDate') || '';

    // ---- Build WHERE clause for date filtering ----
    const whereParts: string[] = [];
    const whereParams: unknown[] = [];

    if (startDate) {
      whereParts.push('acctstarttime >= ?');
      whereParams.push(startDate);
    }
    if (endDate) {
      whereParts.push('acctstarttime <= ?');
      whereParams.push(endDate + 'T23:59:59');
    }
    const whereClause = whereParts.length > 0 ? 'WHERE ' + whereParts.join(' AND ') : '';

    // ---- Per-user aggregation ----
    const orderBy = sort === 'session_time'
      ? 'totalSessionTime DESC'
      : 'totalDownloadBytes DESC';

    // Use v_user_usage view for enriched per-user usage data
    const viewWhereClause = whereClause.replace(/acctstarttime/g, 'last_session_start');

    const summarySql = `
      SELECT
        username,
        total_sessions        AS totalSessions,
        active_sessions      AS activeSessions,
        total_download_bytes AS totalDownloadBytes,
        total_upload_bytes AS totalUploadBytes,
        total_session_time   AS totalSessionTime,
        last_session_start   AS lastSeen,
        guest_first_name,
        guest_last_name,
        guest_email,
        room_number,
        property_name,
        plan_name,
        plan_download_speed AS downloadSpeed,
        plan_upload_speed   AS uploadSpeed,
        dataLimit
      FROM v_user_usage ${viewWhereClause}
      GROUP BY username
      ORDER BY ${orderBy}
      LIMIT ?
    `;
    const summaryRows = db.query(summarySql).all(...whereParams, limit) as Array<Record<string, unknown>>;

    const users = summaryRows.map(row => ({
      username:             row.username as string,
      totalSessions:        Number(row.totalSessions),
      totalUploadBytes:     Number(row.totalUploadBytes),
      totalDownloadBytes:   Number(row.totalDownloadBytes),
      totalSessionTime:     Number(row.totalSessionTime),
      lastSeen:             row.lastSeen as string || null,
      activeSessions:       Number(row.activeSessions),
      guestName:           [row.guest_first_name, row.guest_last_name].filter(Boolean).join(' ') || '',
      guestEmail:          row.guest_email || '',
      roomNumber:          row.room_number || '',
      propertyName:        row.property_name || '',
      planName:            row.plan_name || '',
      downloadSpeed:       row.downloadSpeed || null,
      uploadSpeed:         row.uploadSpeed || null,
      dataLimit:           row.dataLimit || null,
    }));

    // ---- Overall stats ----
    const totalUsersRow = db.query(
      `SELECT COUNT(*) AS cnt FROM v_user_usage ${viewWhereClause}`
    ).get(...whereParams) as { cnt: number } | undefined;

    const bandwidthRow = db.query(
      `SELECT
        COALESCE(SUM(total_upload_bytes), 0) AS totalUpload,
        COALESCE(SUM(total_download_bytes), 0) AS totalDownload
      FROM v_user_usage ${viewWhereClause}`
    ).get(...whereParams) as { totalUpload: number; totalDownload: number } | undefined;

    const topUserRow = db.query(
      `SELECT username, total_download_bytes AS totalDownload
       FROM v_user_usage ${viewWhereClause}
       GROUP BY username
       ORDER BY totalDownload DESC
       LIMIT 1`
    ).get(...whereParams) as { username: string; totalDownload: number } | undefined;

    const totalUploadBytes = Number(bandwidthRow?.totalUpload ?? 0);
    const totalDownloadBytes = Number(bandwidthRow?.totalDownload ?? 0);

    return c.json({
      success: true,
      data: {
        users,
        overallStats: {
          totalUsers: Number(totalUsersRow?.cnt ?? 0),
          totalBandwidth: totalUploadBytes + totalDownloadBytes,
          totalUploadBytes,
          totalDownloadBytes,
          topUser: topUserRow
            ? { username: topUserRow.username, totalDownloadBytes: topUserRow.totalDownload }
            : null,
        },
      },
    });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

/**
 * GET /api/user-usage/:username
 *
 * Returns detailed usage for a single user:
 *   - All their sessions from radacct
 *   - Daily usage breakdown for the last 7 days
 */
app.get('/api/user-usage/:username', (c) => {
  try {
    const username = c.req.param('username');
    const startDate = c.req.query('startDate') || '';
    const endDate = c.req.query('endDate') || '';

    // ---- All sessions for this user (most recent first, up to 200) ----
    const sessions = db.query(
      `SELECT * FROM radacct WHERE username = ? ORDER BY acctstarttime DESC LIMIT 200`
    ).all(username) as Array<Record<string, unknown>>;

    const sessionList = sessions.map(row => ({
      radacctid:           Number(row.radacctid),
      acctsessionid:       row.acctsessionid as string,
      acctuniqueid:        row.acctuniqueid as string,
      nasipaddress:        row.nasipaddress as string,
      nasporttype:         row.nasporttype as string || null,
      acctstarttime:       row.acctstarttime as string || null,
      acctstoptime:        row.acctstoptime as string || null,
      acctsessiontime:     row.acctsessiontime != null ? Number(row.acctsessiontime) : null,
      acctinputoctets:     Number(row.acctinputoctets) || 0,
      acctoutputoctets:    Number(row.acctoutputoctets) || 0,
      callingstationid:    row.callingstationid as string || null,
      framedipaddress:     row.framedipaddress as string || null,
      acctterminatecause:  row.acctterminatecause as string || null,
      status:              row.acctstoptime === null ? 'active' : 'ended',
    }));

    // ---- Daily usage breakdown ----
    // Use provided date range, or default to last 30 days for broader coverage
    const dailyWhereParts: string[] = ["username = ?"];
    const dailyParams: unknown[] = [username];
    if (startDate) {
      dailyWhereParts.push('acctstarttime >= ?');
      dailyParams.push(startDate);
    } else {
      dailyWhereParts.push("acctstarttime >= datetime('now', '-30 days')");
    }
    if (endDate) {
      dailyWhereParts.push('acctstarttime <= ?');
      dailyParams.push(endDate + 'T23:59:59');
    }
    const dailyWhereClause = dailyWhereParts.join(' AND ');

    const dailyBreakdown = db.query(
      `SELECT
        DATE(acctstarttime) AS date,
        COUNT(*)                                AS sessions,
        COALESCE(SUM(acctinputoctets), 0)       AS uploadBytes,
        COALESCE(SUM(acctoutputoctets), 0)      AS downloadBytes,
        COALESCE(SUM(acctsessiontime), 0)       AS sessionTime
      FROM radacct
      WHERE ${dailyWhereClause}
      GROUP BY DATE(acctstarttime)
      ORDER BY date ASC`
    ).all(...dailyParams) as Array<Record<string, unknown>>;

    const dailyUsage = dailyBreakdown.map(row => ({
      date:              row.date as string,
      sessions:          Number(row.sessions),
      uploadBytes:       Number(row.uploadBytes),
      downloadBytes:     Number(row.downloadBytes),
      sessionTime:       Number(row.sessionTime),
    }));

    // ---- Summary totals for this user ----
    const totalsRow = db.query(
      `SELECT
        COUNT(*)                                AS totalSessions,
        COALESCE(SUM(acctinputoctets), 0)       AS totalUploadBytes,
        COALESCE(SUM(acctoutputoctets), 0)      AS totalDownloadBytes,
        COALESCE(SUM(acctsessiontime), 0)       AS totalSessionTime,
        SUM(CASE WHEN acctstoptime IS NULL THEN 1 ELSE 0 END) AS activeSessions
      FROM radacct
      WHERE username = ?`
    ).get(username) as Record<string, unknown> | undefined;

    return c.json({
      success: true,
      data: {
        username,
        summary: {
          totalSessions:     Number(totalsRow?.totalSessions || 0),
          totalUploadBytes:  Number(totalsRow?.totalUploadBytes || 0),
          totalDownloadBytes:Number(totalsRow?.totalDownloadBytes || 0),
          totalSessionTime:  Number(totalsRow?.totalSessionTime || 0),
          activeSessions:    Number(totalsRow?.activeSessions || 0),
        },
        sessions: sessionList,
        dailyUsage,
      },
    });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ============================================================================
// Background Timers
// ============================================================================

// --- 10. Auto-cleanup expired users (every 5 minutes) ---
// DELETES RADIUS credentials (hard delete) instead of soft-deleting (isActive=0).
// This ensures FreeRADIUS simply can't find expired users, while WiFiUser record
// is preserved for audit. Guests who just logged out from hotspot are NOT affected
// because their WiFiUser.validUntil is still in the future.
setInterval(() => {
  try {
    // CRITICAL: validUntil is stored as millisecond integer (Prisma DateTime → SQLite integer),
    // NOT as ISO string. Using new Date().toISOString() would cause string comparison
    // ("1777263123615" < "2026-04-22T...") which always evaluates TRUE → every user expired!
    const nowMs = Date.now();
    const nowISO = new Date().toISOString();

    // Mark expired users in WiFiUser (preserves audit trail)
    const result = db.query(
      "UPDATE WiFiUser SET status = 'expired', updatedAt = ? WHERE status = 'active' AND validUntil IS NOT NULL AND validUntil < ?"
    ).run(nowISO, nowMs);

    if (result.changes > 0) {
      log.info(`Auto-expired ${result.changes} WiFi users — deleting RADIUS credentials`);

      // HARD DELETE RADIUS credentials — FreeRADIUS will return 'User not found' for expired users
      const justExpired = db.query(
        "SELECT username FROM WiFiUser WHERE status = 'expired' AND radiusSynced = 1"
      ).all() as Array<{ username: string }>;

      for (const u of justExpired) {
        try {
          db.query('DELETE FROM radcheck WHERE username = ?').run(u.username);
          db.query('DELETE FROM radreply WHERE username = ?').run(u.username);
          db.query('DELETE FROM radusergroup WHERE username = ?').run(u.username);
          db.query('UPDATE WiFiUser SET radiusSynced = 0 WHERE username = ?').run(u.username);
          log.info(`Deleted RADIUS credentials for expired user: ${u.username}`);
        } catch {
          // non-critical
        }
      }

      // Send CoA disconnect for any active sessions of expired users
      for (const u of justExpired) {
        try {
          const activeSessions = db.query(
            "SELECT acctsessionid, nasipaddress FROM radacct WHERE username = ? AND acctstoptime IS NULL"
          ).all(u.username) as Array<{ acctsessionid: string; nasipaddress: string }>;

          for (const s of activeSessions) {
            const nasInfo = lookupNAS(s.nasipaddress);
            if (nasInfo) {
              executeRadclient(nasInfo.ip, nasInfo.coaPort || 3799, 'disconnect', nasInfo.secret,
                `User-Name="${u.username}"\nAcct-Session-Id="${s.acctsessionid}"`);
              log.info(`CoA disconnect for expired user ${u.username} session ${s.acctsessionid}`);
            }
          }
        } catch { /* non-critical */ }
      }
    }
  } catch (err) {
    log.error('Auto-cleanup expired users failed', { error: String(err) });
  }
}, 5 * 60 * 1000); // Every 5 minutes

// --- 12. Data Cap Background Checker (every 60 seconds) ---
setInterval(() => {
  try {
    // Find all users with data caps (vendor-agnostic — check ALL known data-limit attributes)
    const cappedUsers = db.query(
      "SELECT DISTINCT username, attribute, value as cap_bytes FROM radreply WHERE attribute IN ('Mikrotik-Total-Limit', 'ChilliSpot-Max-Total-Octets', 'ChilliSpot-Max-Input-Octets', 'ChilliSpot-Max-Output-Octets', 'WISPr-Volume-Total-Octets') AND value IS NOT NULL AND CAST(value AS INTEGER) > 0"
    ).all() as Array<{ username: string; attribute: string; cap_bytes: string }>;

    for (const u of cappedUsers) {
      let capBytes = parseInt(u.cap_bytes, 10) || 0;
      if (capBytes <= 0) continue;
      // For per-direction caps (input/output), sum with the opposite direction
      if (u.attribute === 'ChilliSpot-Max-Input-Octets' || u.attribute === 'ChilliSpot-Max-Output-Octets') {
        const otherAttr = u.attribute === 'ChilliSpot-Max-Input-Octets' ? 'ChilliSpot-Max-Output-Octets' : 'ChilliSpot-Max-Input-Octets';
        const otherRow = db.query("SELECT value FROM radreply WHERE username = ? AND attribute = ?").get(u.username, otherAttr) as { value: string } | undefined;
        capBytes += parseInt(otherRow?.value || '0', 10) || 0;
      }

      // Check usage
      const usageRow = db.query(
        "SELECT COALESCE(SUM(acctinputoctets + acctoutputoctets), 0) as total_bytes FROM radacct WHERE username = ? AND acctstoptime IS NULL"
      ).get(u.username) as { total_bytes: number } | undefined;

      const usedBytes = usageRow?.total_bytes || 0;

      if (usedBytes >= capBytes) {
        // Check if we already enforced for this user recently (avoid spamming)
        const recentCoa = db.query(
          "SELECT id FROM RadiusCoaLog WHERE username = ? AND action = 'data-cap-disconnect' AND timestamp > datetime('now', '-5 minutes') LIMIT 1"
        ).get(u.username);

        if (!recentCoa) {
          log.info(`Data cap exceeded for ${u.username}: ${usedBytes}/${capBytes} bytes — triggering disconnect`);

          const nas = lookupNAS();
          if (nas) {
            const sessions = db.query(
              "SELECT acctsessionid FROM radacct WHERE username = ? AND acctstoptime IS NULL"
            ).all(u.username) as Array<{ acctsessionid: string }>;

            for (const session of sessions) {
              const attrs = `User-Name="${u.username}"\nAcct-Session-Id="${session.acctsessionid}"`;
              executeRadclient(nas.ip, nas.coaPort, 'disconnect', nas.secret, attrs).then(radResult => {
                // Always close session locally regardless of radclient result
                db.query("UPDATE radacct SET acctstoptime = datetime('now'), acctterminatecause = 'Data-Cap-Exceeded', acctupdatetime = datetime('now'), updatedAt = datetime('now') WHERE username = ? AND acctsessionid = ? AND acctstoptime IS NULL")
                  .run(u.username, session.acctsessionid);
                db.query("UPDATE LiveSession SET status = 'ended', updatedAt = datetime('now') WHERE username = ? AND status = 'active'")
                  .run(u.username);

                logCoaAction({
                  action: 'data-cap-disconnect', username: u.username, sessionId: session.acctsessionid,
                  nasIpAddress: nas.ip, sharedSecret: nas.secret, attributes: attrs,
                  result: radResult.success ? 'success' : 'failed-local',
                  errorMessage: radResult.error, triggeredBy: 'background-checker',
                });
              }).catch(() => {
                // Even on exception, close locally
                db.query("UPDATE radacct SET acctstoptime = datetime('now'), acctterminatecause = 'Data-Cap-Exceeded', acctupdatetime = datetime('now'), updatedAt = datetime('now') WHERE username = ? AND acctsessionid = ? AND acctstoptime IS NULL")
                  .run(u.username, session.acctsessionid);
                db.query("UPDATE LiveSession SET status = 'ended', updatedAt = datetime('now') WHERE username = ? AND status = 'active'")
                  .run(u.username);
              });
            }
          }
        }
      }
    }
  } catch (err) {
    log.error('Data cap background checker failed', { error: String(err) });
  }
}, 60 * 1000); // Every 60 seconds

// ============================================================================
// Concurrent Session Enforcement API
// ============================================================================

app.get('/api/concurrent-sessions', (c) => {
  try {
    const groups = db.query('SELECT groupname FROM radgroupcheck WHERE attribute = ?', ['Simultaneous-Use']).all() as Array<{ groupname: string }>;
    const result: Record<string, number> = {};
    for (const g of groups) {
      const row = db.query("SELECT value FROM radgroupcheck WHERE groupname = ? AND attribute = 'Simultaneous-Use'").get(g.groupname) as { value: string } | undefined;
      if (row) result[g.groupname] = parseInt(row.value, 10) || 0;
    }
    // Also get all groups
    const allGroups = db.query('SELECT DISTINCT groupname FROM radgroupcheck').all() as Array<{ groupname: string }>;
    for (const g of allGroups) {
      if (!(g.groupname in result)) result[g.groupname] = 0; // 0 = unlimited
    }
    return c.json({ success: true, data: result });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

app.post('/api/concurrent-sessions', async (c) => {
  try {
    // Support both query params (GET-like) and JSON body
    const queryGroup = c.req.query('groupName');
    if (queryGroup) {
      const groupName = queryGroup as string;
      const maxSessions = parseInt(c.req.query('maxSessions') || '1', 10);
      setSimultaneousUse(groupName, maxSessions);
      return c.json({ success: true, data: { groupName, maxSessions }, message: `Set Simultaneous-Use=${maxSessions} for group "${groupName}"` });
    }

    const body = await c.req.json();
    const { groupName, maxSessions } = body as { groupName?: string; maxSessions?: number };
    if (!groupName || typeof maxSessions !== 'number' || maxSessions < 0) {
      return c.json({ success: false, error: 'groupName and maxSessions required' }, 400);
    }
    setSimultaneousUse(groupName, maxSessions);
    return c.json({ success: true, data: { groupName, maxSessions }, message: `Set Simultaneous-Use=${maxSessions} for group "${groupName}"` });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

app.post('/api/concurrent-sessions/bulk', async (c) => {
  try {
    const body = await c.req.json();
    const { limits } = body as { limits: Record<string, number> };
    if (!limits || typeof limits !== 'object') {
      return c.json({ success: false, error: 'limits object required (e.g. { "group1": 2, "group2": 3 })' }, 400);
    }
    setAllSimultaneousUse(limits);
    return c.json({ success: true, data: limits, message: `Applied concurrent session limits for ${Object.keys(limits).length} groups` });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Check concurrent session violations
app.get('/api/concurrent-sessions/violations', (c) => {
  try {
    // Find users with active sessions exceeding their Simultaneous-Use limit
    const groups = db.query("SELECT groupname, value FROM radgroupcheck WHERE attribute = 'Simultaneous-Use'").all() as Array<{ groupname: string; value: string }>;
    const violations: Array<{ username: string; group: string; maxSessions: number; activeSessions: number; sessions: Array<{ acctsessionid: string; nasipaddress: string }> }> = [];

    for (const g of groups) {
      const maxSessions = parseInt(g.value, 10);
      if (maxSessions <= 0) continue;

      // Find users in this group with active sessions
      const members = db.query(
        `SELECT rug.username, rug.groupname, ra.acctsessionid, ra.nasipaddress
         FROM radusergroup rug
         JOIN radacct ra ON rug.username = ra.username AND ra.acctstoptime IS NULL
         WHERE rug.groupname = ?`
      ).all(g.groupname) as Array<{ username: string; groupname: string; acctsessionid: string; nasipaddress: string }>;

      // Group by username
      const byUser: Record<string, Array<{ acctsessionid: string; nasipaddress: string }>> = {};
      for (const m of members) {
        if (!byUser[m.username]) byUser[m.username] = [];
        byUser[m.username].push({ acctsessionid: m.acctsessionid, nasipaddress: m.nasipaddress });
      }

      for (const [username, sessions] of Object.entries(byUser)) {
        if (sessions.length > maxSessions) {
          violations.push({ username, group: g.groupname, maxSessions, activeSessions: sessions.length, sessions });
        }
      }
    }

    return c.json({ success: true, data: violations, total: violations.length });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ============================================================================
// Provisioning Logs API (Read)
// ============================================================================

app.get('/api/provisioning-logs', (c) => {
  try {
    const limit = Math.min(parseInt(c.req.query('limit') || '50', 10) || 50, 500);
    const offset = parseInt(c.req.query('offset') || '0', 10) || 0;
    const action = c.req.query('action') || '';
    const result = c.req.query('result') || '';
    const username = c.req.query('username') || '';

    let sql = 'SELECT * FROM RadiusProvisioningLog WHERE 1=1';
    const params: unknown[] = [];

    if (action) { sql += ' AND action = ?'; params.push(action); }
    if (result) { sql += ' AND result = ?'; params.push(result); }
    if (username) { sql += ' AND username LIKE ?'; params.push(`%${username}%`); }

    const countRow = db.query(sql.replace('SELECT *', 'SELECT COUNT(*) as cnt')).get(...params) as { cnt: number } | undefined;
    const total = countRow?.cnt || 0;

    sql += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const rows = db.query(sql).all(...params) as Record<string, unknown>[];
    return c.json({ success: true, data: rows, total, limit, offset });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

app.get('/api/provisioning-logs/stats', (c) => {
  try {
    const successCount = (db.query("SELECT COUNT(*) as cnt FROM RadiusProvisioningLog WHERE result = 'success'").get() as { cnt: number } | undefined)?.cnt || 0;
    const failCount = (db.query("SELECT COUNT(*) as cnt FROM RadiusProvisioningLog WHERE result != 'success'").get() as { cnt: number } | undefined)?.cnt || 0;
    const total = successCount + failCount;
    const lastLog = db.query('SELECT * FROM RadiusProvisioningLog ORDER BY timestamp DESC LIMIT 1').get() as Record<string, unknown> | undefined;

    // Action breakdown
    const actions = db.query('SELECT action, COUNT(*) as cnt FROM RadiusProvisioningLog GROUP BY action ORDER BY cnt DESC').all() as Array<{ action: string; cnt: number }>;

    return c.json({
      success: true,
      data: { successCount, failCount, total, lastLog, actions },
    });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ============================================================================
// Content Filter API
// ============================================================================

app.get('/api/content-filter', (c) => {
  try {
    const propertyId = c.req.query('propertyId') || '';
    const category = c.req.query('category') || '';
    const enabled = c.req.query('enabled') || '';

    let sql = 'SELECT * FROM ContentFilter WHERE 1=1';
    const params: unknown[] = [];

    if (propertyId) { sql += ' AND propertyId = ?'; params.push(propertyId); }
    if (category) { sql += ' AND category = ?'; params.push(category); }
    if (enabled !== '') { sql += ' AND enabled = ?'; params.push(parseInt(enabled, 10)); }
    sql += ' ORDER BY createdAt DESC';

    const rows = db.query(sql).all(...params) as Record<string, unknown>[];
    return c.json({ success: true, data: rows, total: rows.length });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

app.post('/api/content-filter', async (c) => {
  try {
    const body = await c.req.json();
    const { propertyId, tenantId, name, category, domains, enabled } = body as {
      propertyId?: string; tenantId?: string; name: string; category?: string;
      domains?: string[]; enabled?: boolean;
    };

    if (!name) {
      return c.json({ success: false, error: 'name is required' }, 400);
    }

    const id = generateId('cf');
    const now = new Date().toISOString();
    const { tenantId: resolvedTenantId, propertyId: resolvedPropertyId } = resolveTenantAndProperty(tenantId, propertyId);
    db.query(
      `INSERT INTO ContentFilter (id, tenantId, propertyId, name, category, domains, enabled, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id, resolvedTenantId, resolvedPropertyId, name,
      category || 'custom', JSON.stringify(domains || []), enabled !== false ? 1 : 0, now, now,
    );

    return c.json({ success: true, data: { id, name, category: category || 'custom', domains: domains || [] }, message: 'Content filter rule created' });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

app.put('/api/content-filter/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const now = new Date().toISOString();

    const existing = db.query('SELECT * FROM ContentFilter WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!existing) return c.json({ success: false, error: 'Content filter not found' }, 404);

    const updates: string[] = [];
    const params: unknown[] = [];
    if (body.name !== undefined) { updates.push('name = ?'); params.push(body.name); }
    if (body.category !== undefined) { updates.push('category = ?'); params.push(body.category); }
    if (body.domains !== undefined) { updates.push('domains = ?'); params.push(JSON.stringify(body.domains)); }
    if (body.enabled !== undefined) { updates.push('enabled = ?'); params.push(body.enabled ? 1 : 0); }
    updates.push("updatedAt = ?");
    params.push(now);

    if (updates.length === 1) return c.json({ success: false, error: 'No fields to update' }, 400);

    params.push(id);
    db.query(`UPDATE ContentFilter SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    return c.json({ success: true, message: 'Content filter rule updated' });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

app.delete('/api/content-filter/:id', (c) => {
  try {
    const id = c.req.param('id');
    db.query('DELETE FROM ContentFilter WHERE id = ?').run(id);
    return c.json({ success: true, message: 'Content filter rule deleted' });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Export content filter rules as dnsmasq-compatible blocklist
app.get('/api/content-filter/export', (c) => {
  try {
    const rows = db.query('SELECT name, category, domains FROM ContentFilter WHERE enabled = 1').all() as Array<{ name: string; category: string; domains: string }>;
    const allDomains: string[] = [];
    for (const row of rows) {
      try {
        const domains = JSON.parse(row.domains || '[]') as string[];
        allDomains.push(...domains);
      } catch {}
    }
    const lines = [
      '# StaySuite Content Filter - Auto-generated',
      `# Generated: ${new Date().toISOString()}`,
      `# Total blocked domains: ${allDomains.length}`,
      '',
      ...allDomains.map(d => `address=/${d}/0.0.0.0`),
    ];
    return c.json({ success: true, data: { format: 'dnsmasq', domains: allDomains, total: allDomains.length, config: lines.join('\n') } });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Apply content filter preset (ads, malware, social, etc.)
app.post('/api/content-filter/preset', async (c) => {
  try {
    const body = await c.req.json();
    const { preset } = body as { preset: string };

    const presets: Record<string, Array<{ name: string; category: string; domains: string[] }>> = {
      'ads': [
        { name: 'Block Ads', category: 'advertising', domains: ['doubleclick.net', 'googlesyndication.com', 'googleadservices.com', 'adnxs.com', 'ads.yahoo.com', 'amazon-adsystem.com', 'facebook.net'] },
      ],
      'malware': [
        { name: 'Block Malware', category: 'security', domains: ['malware-site.example.com'] },
      ],
      'social': [
        { name: 'Block Social Media', category: 'social', domains: ['facebook.com', 'instagram.com', 'twitter.com', 'x.com', 'tiktok.com', 'snapchat.com'] },
      ],
      'adult': [
        { name: 'Block Adult Content', category: 'adult', domains: ['adultsite.example.com'] },
      ],
      'gaming': [
        { name: 'Block Gaming', category: 'gaming', domains: ['steam.com', 'epicgames.com'] },
      ],
    };

    const rules = presets[preset];
    if (!rules) {
      return c.json({ success: false, error: `Unknown preset: ${preset}. Available: ${Object.keys(presets).join(', ')}` }, 400);
    }

    let created = 0;
    for (const rule of rules) {
      const id = `cf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      db.query(
        `INSERT INTO ContentFilter (id, tenantId, propertyId, name, category, domains, enabled, createdAt, updatedAt)
         VALUES (?, 'tenant-1', 'property-1', ?, ?, ?, 1, datetime('now'), datetime('now'))`
      ).run(id, rule.name, rule.category, JSON.stringify(rule.domains));
      created++;
    }

    return c.json({ success: true, created, preset });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Test a URL against content filter rules
app.get('/api/content-filter/test', (c) => {
  try {
    const url = c.req.query('url');
    if (!url) {
      return c.json({ success: false, error: 'url query parameter is required' }, 400);
    }

    // Extract domain from URL
    let domain = url.replace(/^https?:\/\//, '').split('/')[0].split(':')[0].toLowerCase();

    const rules = db.query('SELECT name, category, domains FROM ContentFilter WHERE enabled = 1').all() as Array<{ name: string; category: string; domains: string }>;

    for (const rule of rules) {
      try {
        const blockedDomains = JSON.parse(rule.domains || '[]') as string[];
        for (const blocked of blockedDomains) {
          if (domain === blocked.toLowerCase() || domain.endsWith('.' + blocked.toLowerCase())) {
            return c.json({ success: true, data: { blocked: true, domain, rule: rule.name, category: rule.category } });
          }
        }
      } catch {}
    }

    return c.json({ success: true, data: { blocked: false, domain } });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ============================================================================
// Guest ↔ WiFi Linking API
// ============================================================================

app.get('/api/guest-wifi-link', (c) => {
  try {
    const guestId = c.req.query('guestId') || '';
    const wifiUsername = c.req.query('username') || '';

    if (guestId) {
      const guest = db.query('SELECT id, firstName, lastName, roomNumber, checkinStatus FROM Guest WHERE id = ?').get(guestId) as Record<string, unknown> | undefined;
      if (!guest) return c.json({ success: false, error: 'Guest not found' }, 404);

      const wifiLink = db.query('SELECT * FROM WiFiUser WHERE guestId = ?').get(guestId) as Record<string, unknown> | undefined;
      const radCheck = wifiLink ? db.query('SELECT * FROM radcheck WHERE username = ?').get(wifiLink.username) as Record<string, unknown> | undefined : null;
      const activeSession = wifiLink ? db.query('SELECT * FROM radacct WHERE username = ? AND acctstoptime IS NULL ORDER BY acctstarttime DESC LIMIT 1').get(wifiLink.username) as Record<string, unknown> | undefined : null;

      return c.json({
        success: true,
        data: {
          guest: { id: guest.id, name: `${guest.firstName} ${guest.lastName}`, room: guest.roomNumber, status: guest.checkinStatus },
          wifiUser: wifiLink || null,
          radiusCreds: radCheck || null,
          activeSession: activeSession || null,
          linked: !!wifiLink,
        },
      });
    }

    if (wifiUsername) {
      const wifiUser = db.query('SELECT * FROM WiFiUser WHERE username = ?').get(wifiUsername) as Record<string, unknown> | undefined;
      if (!wifiUser || !wifiUser.guestId) {
        return c.json({ success: true, data: { linked: false, wifiUser: wifiUser || null, guest: null } });
      }

      const guest = db.query('SELECT id, firstName, lastName, roomNumber, checkinStatus FROM Guest WHERE id = ?').get(wifiUser.guestId) as Record<string, unknown> | undefined;
      return c.json({
        success: true,
        data: {
          guest: guest || null,
          wifiUser,
          linked: !!guest,
        },
      });
    }

    // Return all guest-wifi links
    const links = db.query(
      `SELECT wu.id, wu.username, wu.guestId, wu.status,
              g.firstName, g.lastName, g.roomNumber, g.checkinStatus
       FROM WiFiUser wu
       LEFT JOIN Guest g ON wu.guestId = g.id
       WHERE wu.guestId IS NOT NULL
       ORDER BY wu.createdAt DESC`
    ).all() as Record<string, unknown>[];

    return c.json({ success: true, data: links, total: links.length });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

app.post('/api/guest-wifi-link', async (c) => {
  try {
    const body = await c.req.json();
    const { guestId, wifiUsername, wifiPassword, planId } = body as {
      guestId: string; wifiUsername?: string; wifiPassword?: string; planId?: string;
    };

    if (!guestId) {
      return c.json({ success: false, error: 'guestId is required' }, 400);
    }

    // Check guest exists (include tenantId for WiFiUser)
    const guest = db.query('SELECT id, firstName, lastName, roomNumber, checkinStatus, tenantId FROM Guest WHERE id = ?').get(guestId) as Record<string, unknown> | undefined;
    if (!guest) return c.json({ success: false, error: 'Guest not found' }, 404);

    const guestTenantId = (guest.tenantId as string) || 'tenant-1';

    // Try to find propertyId from guest's active booking, fallback to 'property-1'
    const booking = db.query(
      `SELECT propertyId FROM Booking WHERE primaryGuestId = ? AND status IN ('confirmed', 'checked_in') ORDER BY checkIn DESC LIMIT 1`
    ).get(guestId) as Record<string, unknown> | undefined;
    const guestPropertyId = (booking?.propertyId as string) || 'property-1';

    const username = wifiUsername || `guest_${guest.roomNumber || guestId}_${Date.now()}`;
    const password = wifiPassword || generateSharedSecret(8);

    // Create WiFiUser if not exists
    const existing = db.query('SELECT * FROM WiFiUser WHERE guestId = ?').get(guestId) as Record<string, unknown> | undefined;
    if (existing) {
      return c.json({ success: false, error: 'Guest already linked to a WiFi account', data: { existingUsername: existing.username } }, 409);
    }

    const now = new Date().toISOString();
    const wifiId = generateId('wfu');

    db.query(
      `INSERT INTO WiFiUser (id, tenantId, propertyId, username, password, guestId, bookingId, planId, status, validFrom, validUntil, radiusSynced, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, null, ?, 'active', ?, ?, 0, ?, ?)`
    ).run(wifiId, guestTenantId, guestPropertyId, username, password, guestId, planId || null, now, now, now, now);

    // Create RADIUS credentials
    const user: RADIUSUser = {
      id: wifiId, username, password,
      group: 'standard-guests',
      attributes: {},
      createdAt: now, updatedAt: now,
      guestId: guestId as string,
    };
    createRADIUSUser(user);

    // Log provisioning
    db.query(
      `INSERT INTO RadiusProvisioningLog (id, propertyId, action, username, result, details, durationMs, timestamp)
       VALUES (?, null, 'guest-wifi-link', ?, 'success', ?, 0, ?)`
    ).run(generateId('plog'), username, `Linked guest ${guest.firstName} ${guest.lastName} (room ${guest.roomNumber}) to WiFi user "${username}"`, now);

    return c.json({
      success: true,
      data: { id: wifiId, username, password, guestId },
      message: `Guest linked to WiFi account "${username}"`,
    });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

app.delete('/api/guest-wifi-link/:guestId', (c) => {
  try {
    const guestId = c.req.param('guestId');
    const wifiUser = db.query('SELECT * FROM WiFiUser WHERE guestId = ?').get(guestId) as Record<string, unknown> | undefined;

    if (wifiUser) {
      const username = wifiUser.username as string;

      // Disconnect active sessions via CoA
      try {
        const nas = lookupNAS();
        if (nas) {
          const sessions = db.query("SELECT acctsessionid FROM radacct WHERE username = ? AND acctstoptime IS NULL").all(username) as Array<{ acctsessionid: string }>;
          for (const session of sessions) {
            const attrs = `User-Name="${username}"\nAcct-Session-Id="${session.acctsessionid}"`;
            executeRadclient(nas.ip, nas.coaPort, 'disconnect', nas.secret, attrs).catch(() => {});
          }
        }
      } catch {}

      // Remove RADIUS credentials
      db.query('DELETE FROM radcheck WHERE username = ?').run(username);
      db.query('DELETE FROM radreply WHERE username = ?').run(username);
      db.query('DELETE FROM radusergroup WHERE username = ?').run(username);

      // Remove WiFiUser link
      db.query('DELETE FROM WiFiUser WHERE guestId = ?').run(guestId);

      // Log
      db.query(
        `INSERT INTO RadiusProvisioningLog (id, propertyId, action, username, result, details, durationMs, timestamp)
         VALUES (?, null, 'guest-wifi-unlink', ?, 'success', ?, 0, ?)`
      ).run(generateId('plog'), username, `Unlinked WiFi user "${username}" from guest`, new Date().toISOString());

      return c.json({ success: true, message: `WiFi account "${username}" unlinked and cleaned up` });
    }

    return c.json({ success: false, error: 'No WiFi link found for this guest' }, 404);
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ============================================================================
// Scheduled Bandwidth Policies API
// ============================================================================

// ============================================================================
// Bandwidth Schedules — CRUD + Enforcement
// ============================================================================

/**
 * Convert JS getDay() (0=Sun..6=Sat) to schedule format (1=Mon..7=Sun).
 */
function jsDayToScheduleDay(jsDay: number): number {
  return jsDay === 0 ? 7 : jsDay;
}

/**
 * Convert schedule day (1=Mon..7=Sun) to JS getDay() (0=Sun..6=Sat).
 */
function scheduleDayToJsDay(scheduleDay: number): number {
  return scheduleDay === 7 ? 0 : scheduleDay;
}

/**
 * Convert frontend's dayOfWeek (0=Sun..6=Sat) to daysOfWeek string (1=Mon..7=Sun).
 */
function dayOfWeekToDaysOfWeek(dayOfWeek: number): string {
  const scheduleDay = jsDayToScheduleDay(dayOfWeek);
  return String(scheduleDay);
}

/**
 * Convert daysOfWeek string to frontend's dayOfWeek (0=Sun..6=Sat).
 * Returns the first day if multiple days are selected.
 */
function daysOfWeekToDayOfWeek(daysOfWeekStr: string): number {
  const days = String(daysOfWeekStr || '1').split(',').map(d => parseInt(d.trim(), 10));
  return scheduleDayToJsDay(days[0] || 1);
}

/**
 * Convert { startHour, startMinute } to "HH:MM" string.
 */
function hourMinuteToTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/**
 * Convert "HH:MM" string to { hour, minute }.
 */
function timeToHourMinute(timeStr: string): { hour: number; minute: number } {
  const parts = String(timeStr || '00:00').split(':');
  return { hour: parseInt(parts[0], 10) || 0, minute: parseInt(parts[1], 10) || 0 };
}

/**
 * Transform a ScheduleAccess DB row to frontend-expected format.
 */
function transformScheduleToFrontend(row: Record<string, unknown>): Record<string, unknown> {
  const { hour: startHour, minute: startMinute } = timeToHourMinute(row.startTime as string);
  const { hour: endHour, minute: endMinute } = timeToHourMinute(row.endTime as string);
  return {
    id: row.id,
    propertyId: row.propertyId,
    name: row.name,
    daysOfWeek: row.daysOfWeek,
    dayOfWeek: daysOfWeekToDayOfWeek(row.daysOfWeek as string),
    startHour,
    startMinute,
    endHour,
    endMinute,
    startTime: row.startTime,
    endTime: row.endTime,
    downloadMbps: row.downloadMbps || 0,
    uploadMbps: row.uploadMbps || 0,
    applyTo: row.applyTo || 'all',
    planId: row.applyToPlanId || null,
    action: row.action || 'limit',
    enabled: row.enabled === 1 || row.enabled === true,
    description: row.description,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ─── GET: List all bandwidth schedules ─────────────────────────────────────

app.get('/api/bandwidth-schedules', (c) => {
  try {
    const propertyId = c.req.query('propertyId') || '';
    const enabled = c.req.query('enabled') || '';

    let sql = 'SELECT * FROM ScheduleAccess WHERE 1=1';
    const params: unknown[] = [];

    if (propertyId) { sql += ' AND propertyId = ?'; params.push(propertyId); }
    if (enabled !== '') { sql += ' AND enabled = ?'; params.push(parseInt(enabled, 10)); }
    sql += ' ORDER BY createdAt DESC';

    const rows = db.query(sql).all(...params) as Record<string, unknown>[];
    const transformed = rows.map(transformScheduleToFrontend);
    return c.json({ success: true, data: transformed, total: transformed.length });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ─── POST: Create a bandwidth schedule ─────────────────────────────────────

app.post('/api/bandwidth-schedules', async (c) => {
  try {
    const body = await c.req.json();
    const {
      propertyId, tenantId, name,
      dayOfWeek, daysOfWeek: bodyDaysOfWeek,
      startHour, startMinute, endHour, endMinute,
      startTime: bodyStartTime, endTime: bodyEndTime,
      downloadMbps, uploadMbps,
      applyTo, applyToPlanId, bandwidthPolicyId, scheduleAction, description, enabled,
    } = body as {
      propertyId?: string; tenantId?: string; name: string;
      dayOfWeek?: number; daysOfWeek?: string;
      startHour?: number; startMinute?: number; endHour?: number; endMinute?: number;
      startTime?: string; endTime?: string;
      downloadMbps?: number; uploadMbps?: number;
      applyTo?: string; applyToPlanId?: string; bandwidthPolicyId?: string;
      scheduleAction?: string; action?: string; description?: string; enabled?: boolean;
    };

    if (!name) {
      return c.json({ success: false, error: 'name is required' }, 400);
    }

    // Build daysOfWeek: accept either dayOfWeek (single) or daysOfWeek (string)
    const finalDaysOfWeek = bodyDaysOfWeek || (dayOfWeek !== undefined ? dayOfWeekToDaysOfWeek(dayOfWeek) : '1,2,3,4,5,6,7');

    // Build startTime/endTime: accept either hour/minute or time string
    const finalStartTime = bodyStartTime || (startHour !== undefined ? hourMinuteToTime(startHour, startMinute || 0) : '00:00');
    const finalEndTime = bodyEndTime || (endHour !== undefined ? hourMinuteToTime(endHour, endMinute || 0) : '23:59');

    const { tenantId: resolvedTenantId, propertyId: resolvedPropertyId } = resolveTenantAndProperty(tenantId, propertyId);
    const id = generateId('bws');
    const now = new Date().toISOString();

    // Ensure downloadMbps/uploadMbps columns exist (add if missing)
    try { db.query('ALTER TABLE ScheduleAccess ADD COLUMN downloadMbps INTEGER DEFAULT 0').run(); } catch { /* column exists */ }
    try { db.query('ALTER TABLE ScheduleAccess ADD COLUMN uploadMbps INTEGER DEFAULT 0').run(); } catch { /* column exists */ }

    db.query(
      `INSERT INTO ScheduleAccess (id, tenantId, propertyId, name, daysOfWeek, startTime, endTime, downloadMbps, uploadMbps, applyTo, applyToPlanId, bandwidthPolicyId, action, description, enabled, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id, resolvedTenantId, resolvedPropertyId, name,
      finalDaysOfWeek, finalStartTime, finalEndTime,
      downloadMbps || 0, uploadMbps || 0,
      applyTo || 'all', applyToPlanId || null, bandwidthPolicyId || null,
      scheduleAction || action || 'limit', description || null,
      enabled !== false ? 1 : 0, now, now,
    );

    const created = db.query('SELECT * FROM ScheduleAccess WHERE id = ?').get(id) as Record<string, unknown>;
    return c.json({
      success: true,
      data: transformScheduleToFrontend(created),
      message: 'Schedule created successfully',
    });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ─── PUT: Update a bandwidth schedule ──────────────────────────────────────

app.put('/api/bandwidth-schedules/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const now = new Date().toISOString();

    const existing = db.query('SELECT * FROM ScheduleAccess WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!existing) return c.json({ success: false, error: 'Schedule not found' }, 404);

    // Handle frontend field transformations before update
    const updatePayload: Record<string, unknown> = { ...body };

    // dayOfWeek → daysOfWeek conversion
    if (body.dayOfWeek !== undefined) {
      updatePayload.daysOfWeek = dayOfWeekToDaysOfWeek(body.dayOfWeek);
      delete updatePayload.dayOfWeek;
    }

    // scheduleAction → action (frontend sends scheduleAction to avoid conflicting with proxy action)
    if (body.scheduleAction !== undefined) {
      updatePayload.action = body.scheduleAction;
      delete updatePayload.scheduleAction;
    }

    // startHour/startMinute → startTime conversion
    if (body.startHour !== undefined || body.endHour !== undefined) {
      const sH = body.startHour ?? timeToHourMinute(existing.startTime as string).hour;
      const sM = body.startMinute ?? timeToHourMinute(existing.startTime as string).minute;
      updatePayload.startTime = hourMinuteToTime(sH, sM);
      delete updatePayload.startHour;
      delete updatePayload.startMinute;
    }

    // endHour/endMinute → endTime conversion
    if (body.endHour !== undefined || body.endMinute !== undefined) {
      const eH = body.endHour ?? timeToHourMinute(existing.endTime as string).hour;
      const eM = body.endMinute ?? timeToHourMinute(existing.endTime as string).minute;
      updatePayload.endTime = hourMinuteToTime(eH, eM);
      delete updatePayload.endHour;
      delete updatePayload.endMinute;
    }

    const updates: string[] = [];
    const params: unknown[] = [];
    const allowedFields = ['name', 'daysOfWeek', 'startTime', 'endTime', 'downloadMbps', 'uploadMbps', 'applyTo', 'applyToPlanId', 'bandwidthPolicyId', 'action', 'description', 'enabled', 'propertyId'];
    for (const field of allowedFields) {
      if (updatePayload[field] !== undefined) {
        updates.push(`${field} = ?`);
        params.push(updatePayload[field] === true ? 1 : updatePayload[field] === false ? 0 : updatePayload[field]);
      }
    }
    if (updates.length === 0) return c.json({ success: false, error: 'No fields to update' }, 400);
    updates.push("updatedAt = ?");
    params.push(now);

    params.push(id);
    db.query(`UPDATE ScheduleAccess SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    const updated = db.query('SELECT * FROM ScheduleAccess WHERE id = ?').get(id) as Record<string, unknown>;
    return c.json({
      success: true,
      data: transformScheduleToFrontend(updated),
      message: 'Schedule updated successfully',
    });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ─── DELETE: Remove a bandwidth schedule ───────────────────────────────────

app.delete('/api/bandwidth-schedules/:id', (c) => {
  try {
    const id = c.req.param('id');
    db.query('DELETE FROM ScheduleAccess WHERE id = ?').run(id);
    return c.json({ success: true, message: 'Schedule deleted' });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ─── POST: Manually enforce a bandwidth schedule (one-time trigger) ────────

app.post('/api/bandwidth-schedules/enforce', async (c) => {
  try {
    const body = await c.req.json();
    const { scheduleId, propertyId } = body as { scheduleId?: string; propertyId?: string };

    let schedules: Record<string, unknown>[];

    if (scheduleId) {
      const row = db.query('SELECT * FROM ScheduleAccess WHERE id = ? AND enabled = 1').get(scheduleId) as Record<string, unknown> | undefined;
      if (!row) return c.json({ success: false, error: 'Schedule not found or disabled' }, 404);
      schedules = [row];
    } else {
      schedules = db.query(
        `SELECT * FROM ScheduleAccess WHERE enabled = 1${propertyId ? ' AND propertyId = ?' : ''}`
      ).all(...(propertyId ? [propertyId] : [])) as Record<string, unknown>[];
    }

    const results = await enforceBandwidthSchedules(schedules);
    return c.json({ success: true, data: results, message: 'Enforcement complete' });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ============================================================================
// Scheduled Bandwidth Background Enforcer (runs every 60 seconds)
// ============================================================================

function parseTimeToMinutes(timeStr: string): number {
  const parts = String(timeStr || '00:00').split(':');
  return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
}

function isDayMatch(daysOfWeekStr: string, currentDay: number): boolean {
  const days = String(daysOfWeekStr || '1,2,3,4,5,6,7').split(',').map(d => parseInt(d.trim(), 10));
  // JS getDay: 0=Sun, schedule uses: 1=Mon, 7=Sun
  const scheduleDay = currentDay === 0 ? 7 : currentDay;
  return days.includes(scheduleDay);
}

/**
 * Check if a time falls within a schedule window.
 * Handles overnight schedules (e.g., 22:00 – 06:00).
 */
function isTimeInScheduleWindow(currentMinutes: number, startMin: number, endMin: number): boolean {
  if (endMin <= startMin) {
    // Overnight schedule (e.g., 22:00 – 06:00)
    return currentMinutes >= startMin || currentMinutes < endMin;
  }
  return currentMinutes >= startMin && currentMinutes < endMin;
}

/**
 * Send a bandwidth CoA to a specific active session.
 * Returns true if the CoA was sent (regardless of result).
 */
async function applyBandwidthCoA(
  username: string,
  nasIpAddress: string,
  downloadMbps: number,
  uploadMbps: number,
  reason: string,
  scheduleId?: string,
  session?: Record<string, unknown>,
): Promise<{ sent: boolean; success: boolean; error?: string }> {
  const nas = lookupNAS(nasIpAddress);
  if (!nas) {
    return { sent: false, success: false, error: 'No NAS client configured' };
  }

  const vendor = normalizeVendor(nas.type);
  const dlMbps = downloadMbps || 0;
  const ulMbps = uploadMbps || 0;
  const dlBps = dlMbps * 1000000;
  const ulBps = ulMbps * 1000000;

  // Build vendor-specific CoA attributes
  let coaAttrs = `User-Name="${username}"`;
  switch (vendor) {
    case 'mikrotik':
      coaAttrs += `\nMikrotik-Rate-Limit="${dlMbps}M/${ulMbps}M"`;
      break;
    case 'cisco':
      coaAttrs += `\nCisco-AVPair="sub:Ingress-Committed-Data-Rate=${ulBps}"\nCisco-AVPair="sub:Egress-Committed-Data-Rate=${dlBps}"`;
      break;
    case 'chillispot':
      coaAttrs += `\nChilliSpot-Bandwidth-Max-Down=${dlBps}\nChilliSpot-Bandwidth-Max-Up=${ulBps}`;
      break;
    default:
      coaAttrs += `\nWISPr-Bandwidth-Max-Down=${dlBps}\nWISPr-Bandwidth-Max-Up=${ulBps}\nChilliSpot-Bandwidth-Max-Down=${dlBps}\nChilliSpot-Bandwidth-Max-Up=${ulBps}`;
      break;
  }

  const radResult = await executeRadclient(nas.ip, nas.coaPort, 'coa', nas.secret, coaAttrs);

  logCoaAction({
    action: 'bw-schedule',
    username,
    nasIpAddress: nas.ip,
    sharedSecret: nas.secret,
    attributes: coaAttrs,
    result: radResult.success ? 'success' : 'failed',
    errorMessage: radResult.error,
    triggeredBy: reason,
    triggeredById: scheduleId,
  });

  // Update radreply to persist the new bandwidth
  if (radResult.success) {
    try {
      const bwAttrs = ['Mikrotik-Rate-Limit', 'WISPr-Bandwidth-Max-Down', 'WISPr-Bandwidth-Max-Up',
        'ChilliSpot-Bandwidth-Max-Down', 'ChilliSpot-Bandwidth-Max-Up', 'Cisco-AVPair'];
      for (const attr of bwAttrs) {
        db.query("DELETE FROM radreply WHERE username = ? AND attribute = ?").run(username, attr);
      }
      const allVendors = lookupAllNASVendors().map(v => normalizeVendor(v));
      const seen = new Set<string>();
      for (const v of [...new Set(allVendors)]) {
        const vAttrs = generateBandwidthAttributes(dlBps, ulBps, v);
        for (const [attr, val] of Object.entries(vAttrs)) {
          if (!seen.has(attr)) {
            seen.add(attr);
            insertRadReply.run(username, attr, '=', val);
          }
        }
      }
    } catch {
      // non-critical — CoA already applied, radreply is just persistence
    }
  }

  return { sent: true, success: radResult.success, error: radResult.error };
}

/**
 * Main enforcement function: applies or reverts bandwidth schedules for active sessions.
 * Called by both the background enforcer and the manual enforce endpoint.
 */
async function enforceBandwidthSchedules(
  schedules: Array<Record<string, unknown>>,
): Promise<{ applied: number; reverted: number; errors: number; details: Array<{ username: string; action: string; scheduleName: string; success: boolean }> }> {
  const now = new Date();
  const currentDay = now.getDay();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  let applied = 0;
  let reverted = 0;
  let errors = 0;
  const details: Array<{ username: string; action: string; scheduleName: string; success: boolean }> = [];

  // Get all active sessions — JOIN with WiFiUser to get userType for guest/staff filtering
  const activeSessions = db.query(
    `SELECT ls.*, wu.userType AS sessionUserType
     FROM LiveSession ls
     LEFT JOIN WiFiUser wu ON wu.username = ls.username
     WHERE ls.status = 'active'`
  ).all() as Array<Record<string, unknown>>;

  if (activeSessions.length === 0) {
    return { applied: 0, reverted: 0, errors: 0, details: [] };
  }

  for (const schedule of schedules) {
    const daysOfWeek = schedule.daysOfWeek as string;
    const scheduleId = schedule.id as string;
    const scheduleName = schedule.name as string;
    const schedulePropertyId = schedule.propertyId as string;
    const scheduleApplyTo = (schedule.applyTo as string) || 'all';
    const scheduleApplyToPlanId = schedule.applyToPlanId as string | null;
    const scheduleAction = (schedule.action as string) || 'limit';
    const downloadMbps = (schedule.downloadMbps as number) || 0;
    const uploadMbps = (schedule.uploadMbps as number) || 0;

    const startMin = parseTimeToMinutes(schedule.startTime as string);
    const endMin = parseTimeToMinutes(schedule.endTime as string);
    const isActive = isDayMatch(daysOfWeek, currentDay) && isTimeInScheduleWindow(currentMinutes, startMin, endMin);

    for (const session of activeSessions) {
      const sessionUsername = session.username as string;
      const sessionNasIp = session.nasIpAddress as string;
      const sessionPropertyId = session.propertyId as string;
      const sessionPlanId = session.planId as string | null;
      const sessionUserType = (session.sessionUserType as string) || 'guest';

      // Skip sessions from different properties
      if (sessionPropertyId !== schedulePropertyId) continue;

      // Check applyTo criteria
      if (scheduleApplyTo === 'specific_plan') {
        if (sessionPlanId !== scheduleApplyToPlanId) continue;
      } else if (scheduleApplyTo === 'guest') {
        // Only apply to guest users (userType = 'guest' or users with a bookingId)
        if (sessionUserType !== 'guest' && !session.bookingId) continue;
      } else if (scheduleApplyTo === 'staff') {
        // Only apply to staff users (userType = 'staff')
        if (sessionUserType !== 'staff') continue;
      }
      // 'all' applies to every session in the property

      if (isActive) {
        // Schedule is active — apply the bandwidth policy
        if (scheduleAction === 'limit' && (downloadMbps > 0 || uploadMbps > 0)) {
          // Check if we already enforced this schedule recently (within 2 min) to avoid duplicate CoA
          const recentCoa = db.query(
            "SELECT id FROM RadiusCoaLog WHERE username = ? AND action = 'bw-schedule' AND triggeredById = ? AND result = 'success' AND timestamp > datetime('now', '-2 minutes') LIMIT 1"
          ).get(sessionUsername, scheduleId) as { id: string } | undefined;

          if (!recentCoa) {
            log.info(`BW Schedule "${scheduleName}": Applying ${downloadMbps}Mbps↓/${uploadMbps}Mbps↑ to ${sessionUsername}`);
            const result = await applyBandwidthCoA(
              sessionUsername, sessionNasIp,
              downloadMbps, uploadMbps,
              'bw-schedule-enforcer', scheduleId, session,
            );
            if (result.sent && result.success) {
              applied++;
              details.push({ username: sessionUsername, action: 'apply', scheduleName, success: true });
            } else if (result.sent) {
              errors++;
              details.push({ username: sessionUsername, action: 'apply', scheduleName, success: false });
            }
          }
        } else if (scheduleAction === 'deny') {
          // Disconnect the user
          const nas = lookupNAS(sessionNasIp);
          if (nas) {
            const recentCoa = db.query(
              "SELECT id FROM RadiusCoaLog WHERE username = ? AND action = 'bw-schedule' AND triggeredById = ? AND timestamp > datetime('now', '-2 minutes') LIMIT 1"
            ).get(sessionUsername, scheduleId) as { id: string } | undefined;

            if (!recentCoa) {
              log.info(`BW Schedule "${scheduleName}": Disconnecting ${sessionUsername} (deny action)`);
              const attrs = `User-Name="${sessionUsername}"\nAcct-Session-Id="${session.acctSessionId}"`;
              const radResult = await executeRadclient(nas.ip, nas.coaPort, 'disconnect', nas.secret, attrs);
              logCoaAction({
                action: 'bw-schedule', username: sessionUsername, nasIpAddress: nas.ip,
                sharedSecret: nas.secret, attributes: attrs,
                result: radResult.success ? 'success' : 'failed', errorMessage: radResult.error,
                triggeredBy: 'bw-schedule-deny', triggeredById: scheduleId,
              });
              if (radResult.success) applied++;
              else errors++;
              details.push({ username: sessionUsername, action: 'deny', scheduleName, success: radResult.success });
            }
          }
        }
        // 'allow' action does nothing — user keeps their plan bandwidth
      } else {
        // Schedule is NOT active — check if it was recently active and revert
        // Look for a recent successful CoA from this schedule
        const recentApplyCoa = db.query(
          "SELECT id, timestamp FROM RadiusCoaLog WHERE username = ? AND action = 'bw-schedule' AND triggeredById = ? AND result = 'success' ORDER BY timestamp DESC LIMIT 1"
        ).get(sessionUsername, scheduleId) as { id: string; timestamp: string } | undefined;

        if (recentApplyCoa) {
          // Check if the last apply was within the last enforcement cycle (2 min)
          // If so, this schedule just expired and we need to revert the user's bandwidth
          const coaTime = new Date(recentApplyCoa.timestamp);
          const timeSinceCoA = (now.getTime() - coaTime.getTime()) / 1000;

          // Only revert if the CoA was sent within the last 5 minutes
          // (to avoid reverting stale entries from days ago)
          if (timeSinceCoA <= 300) {
            // Check if we already reverted recently
            const recentRevert = db.query(
              "SELECT id FROM RadiusCoaLog WHERE username = ? AND action = 'bw-schedule-revert' AND triggeredById = ? AND result = 'success' AND timestamp > datetime('now', '-2 minutes') LIMIT 1"
            ).get(sessionUsername, scheduleId) as { id: string } | undefined;

            if (!recentRevert) {
              // Revert to plan's default bandwidth
              let planDownloadMbps = 10;
              let planUploadMbps = 5;

              if (sessionPlanId) {
                const plan = db.query('SELECT downloadSpeed, uploadSpeed FROM WiFiPlan WHERE id = ?').get(sessionPlanId) as { downloadSpeed: number; uploadSpeed: number } | undefined;
                if (plan) {
                  planDownloadMbps = plan.downloadSpeed || 10;
                  planUploadMbps = plan.uploadSpeed || 5;
                }
              }

              // Use the session's stored bandwidth if available (from provisioning)
              if ((session.bandwidthDown as number) > 0) {
                planDownloadMbps = Math.round((session.bandwidthDown as number) / 1000000);
              }
              if ((session.bandwidthUp as number) > 0) {
                planUploadMbps = Math.round((session.bandwidthUp as number) / 1000000);
              }

              log.info(`BW Schedule "${scheduleName}" expired: Reverting ${sessionUsername} to plan default ${planDownloadMbps}Mbps↓/${planUploadMbps}Mbps↑`);
              const result = await applyBandwidthCoA(
                sessionUsername, sessionNasIp,
                planDownloadMbps, planUploadMbps,
                'bw-schedule-revert', scheduleId, session,
              );

              if (result.sent && result.success) {
                reverted++;
                details.push({ username: sessionUsername, action: 'revert', scheduleName, success: true });
              } else if (result.sent) {
                errors++;
                details.push({ username: sessionUsername, action: 'revert', scheduleName, success: false });
              }
            }
          }
        }
      }
    }
  }

  if (applied > 0 || reverted > 0 || errors > 0) {
    log.info(`BW Schedule enforcer: applied ${applied}, reverted ${reverted}, errors ${errors}`);
  }

  return { applied, reverted, errors, details };
}

// Background enforcer — runs every 60 seconds
setInterval(() => {
  try {
    const schedules = db.query(
      'SELECT * FROM ScheduleAccess WHERE enabled = 1'
    ).all() as Array<Record<string, unknown>>;

    if (schedules.length === 0) return;

    enforceBandwidthSchedules(schedules).catch(err => {
      log.error('BW Schedule enforcement async failed', { error: String(err) });
    });
  } catch (err) {
    log.error('Scheduled bandwidth enforcer failed', { error: String(err) });
  }
}, 60000); // Every 60 seconds (more responsive for bandwidth scheduling)

// ============================================================================
// Start Server
// ============================================================================

log.info('RADIUS Management Service starting', {
  port: PORT,
  version: SERVICE_VERSION,
  dbPath: SQLITE_DB_PATH,
});

// ============================================================================
// ACCSIUM GAP APIs — 7 New Models
// ============================================================================

// ============================================================================
// 1. LiveSession — O(1) active session tracking (Accsium tblliveuser)
// ============================================================================

app.get('/api/live-sessions', (c) => {
  try {
    const propertyId = c.req.query('propertyId') || '';
    const nasIpAddress = c.req.query('nasIpAddress') || '';
    const status = c.req.query('status') || '';
    const search = c.req.query('search') || '';
    const limit = Math.min(parseInt(c.req.query('limit') || '100', 10) || 100, 500);
    const offset = parseInt(c.req.query('offset') || '0', 10) || 0;

    // Default to active-only unless explicitly requesting all or a specific status
    const effectiveStatus = status || 'active';

    let sql = 'SELECT * FROM LiveSession WHERE 1=1';
    const params: unknown[] = [];

    if (propertyId) { sql += ' AND propertyId = ?'; params.push(propertyId); }
    if (nasIpAddress) { sql += ' AND nasIpAddress = ?'; params.push(nasIpAddress); }
    if (effectiveStatus === 'active' || effectiveStatus === 'ended' || effectiveStatus === 'idle' || effectiveStatus === 'stale') {
      sql += ' AND status = ?'; params.push(effectiveStatus);
    } else if (status && status !== 'all') {
      sql += ' AND status = ?'; params.push(status);
    }
    if (search) { sql += ' AND username LIKE ?'; params.push(`%${search}%`); }

    const countRow = db.query(sql.replace('SELECT *', 'SELECT COUNT(*) as cnt')).get(...params) as { cnt: number } | undefined;
    const total = countRow?.cnt || 0;

    sql += ' ORDER BY startedAt DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    const rows = db.query(sql).all(...params) as Record<string, unknown>[];

    return c.json({ success: true, data: rows, total, limit, offset });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// NOTE: /stats MUST come before /:username to avoid "stats" being captured as username param
app.get('/api/live-sessions/stats', (c) => {
  try {
    const propertyId = c.req.query('propertyId') || '';
    const where = propertyId ? ' WHERE propertyId = ?' : '';
    const andWhere = propertyId ? ' AND' : ' WHERE';
    const params: unknown[] = propertyId ? [propertyId] : [];

    const totalActive = (db.query(`SELECT COUNT(*) as c FROM LiveSession${where}${andWhere} status = 'active'`).get(...params) as { c: number } | undefined)?.c || 0;
    const totalStale = (db.query(`SELECT COUNT(*) as c FROM LiveSession${where}${andWhere} status = 'stale'`).get(...params) as { c: number } | undefined)?.c || 0;

    const nasCounts = db.query(
      `SELECT nasIpAddress, COUNT(*) as cnt FROM LiveSession${where}${andWhere} status = 'active' GROUP BY nasIpAddress ORDER BY cnt DESC`
    ).all(...params) as Array<{ nasIpAddress: string; cnt: number }>;

    const totalDown = (db.query(`SELECT COALESCE(SUM(currentOutputBytes), 0) as t FROM LiveSession${where}${andWhere} status = 'active'`).get(...params) as { t: number } | undefined)?.t || 0;
    const totalUp = (db.query(`SELECT COALESCE(SUM(currentInputBytes), 0) as t FROM LiveSession${where}${andWhere} status = 'active'`).get(...params) as { t: number } | undefined)?.t || 0;

    return c.json({
      success: true,
      data: { totalActive, totalStale, totalSessions: totalActive + totalStale, nasCounts, totalDownloadBytes: totalDown, totalUploadBytes: totalUp },
    });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

app.get('/api/live-sessions/:username', (c) => {
  try {
    const username = c.req.param('username');
    const row = db.query('SELECT * FROM LiveSession WHERE username = ?').get(username) as Record<string, unknown> | undefined;
    if (!row) return c.json({ success: false, error: 'Live session not found' }, 404);
    return c.json({ success: true, data: row });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

app.post('/api/live-sessions', async (c) => {
  try {
    const body = await c.req.json();
    const { tenantId, propertyId, acctSessionId, username, userId, planId, nasIpAddress, nasIdentifier, nasPortType,
      framedIpAddress, macAddress, clientIpAddress, deviceType, operatingSystem, manufacturer,
      bandwidthPolicyId, bandwidthDown, bandwidthUp, maxInputOctets, maxOutputOctets, maxTotalOctets,
      sessionTimeout, idleTimeout, roomNo, hotelId, urlFilterPolicy, authMethod } = body;
    const now = new Date().toISOString();

    if (!username) return c.json({ success: false, error: 'username is required' }, 400);

    const id = generateId('ls');
    db.query(
      `INSERT INTO LiveSession (id, tenantId, propertyId, acctSessionId, username, userId, planId, nasIpAddress, nasIdentifier, nasPortType,
        framedIpAddress, macAddress, clientIpAddress, deviceType, operatingSystem, manufacturer,
        bandwidthPolicyId, bandwidthDown, bandwidthUp, maxInputOctets, maxOutputOctets, maxTotalOctets,
        sessionTimeout, idleTimeout, lastInterimUpdate, currentInputBytes, currentOutputBytes, currentSessionTime,
        status, roomNo, hotelId, urlFilterPolicy, authMethod, startedAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 'active', ?, ?, ?, ?, ?, ?)`
    ).run(
      id, resolveTenantAndProperty(tenantId, propertyId).tenantId, resolveTenantAndProperty(tenantId, propertyId).propertyId, acctSessionId || id, username, userId || null, planId || null,
      nasIpAddress || '', nasIdentifier || null, nasPortType || null,
      framedIpAddress || '', macAddress || '', clientIpAddress || '', deviceType || null, operatingSystem || null, manufacturer || null,
      bandwidthPolicyId || null, bandwidthDown || 0, bandwidthUp || 0, maxInputOctets || 0, maxOutputOctets || 0, maxTotalOctets || 0,
      sessionTimeout || 0, idleTimeout || 0, now,
      roomNo || null, hotelId || null, urlFilterPolicy || null, authMethod || 'radius', now, now
    );

    return c.json({ success: true, data: { id, username, status: 'active' }, message: 'Live session created' });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

app.put('/api/live-sessions/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const now = new Date().toISOString();

    const existing = db.query('SELECT * FROM LiveSession WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!existing) return c.json({ success: false, error: 'Live session not found' }, 404);

    const updates: string[] = [];
    const params: unknown[] = [];
    const allowedFields = ['currentInputBytes', 'currentOutputBytes', 'currentSessionTime', 'status', 'framedIpAddress', 'bandwidthDown', 'bandwidthUp'];
    for (const f of allowedFields) {
      if (body[f] !== undefined) { updates.push(`${f} = ?`); params.push(body[f]); }
    }
    updates.push('lastInterimUpdate = ?'); params.push(now);
    updates.push('updatedAt = ?'); params.push(now);

    if (params.length <= 2) return c.json({ success: false, error: 'No fields to update' }, 400);

    params.push(id);
    db.query(`UPDATE LiveSession SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    return c.json({ success: true, message: 'Live session updated' });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

app.delete('/api/live-sessions/:id', (c) => {
  try {
    const id = c.req.param('id');
    const result = db.query("DELETE FROM LiveSession WHERE id = ?").run(id);
    if (result.changes === 0) return c.json({ success: false, error: 'Live session not found' }, 404);
    return c.json({ success: true, message: 'Live session ended' });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// POST /api/live-sessions/end-local — Mark LiveSession as ended locally (fallback when CoA fails)
// Also updates radacct to set acctstoptime so the session disappears from all views.
app.post('/api/live-sessions/end-local', async (c) => {
  try {
    const body = await c.req.json();
    const { sessionId, acctSessionId, username } = body;
    const now = new Date().toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');

    // Try by exact id first, then by acctSessionId
    let changes = 0;
    let matchedAcctSessionId = '';
    let matchedUsername = username || '';

    // 1. Find the LiveSession to get the acctSessionId and username
    let liveSession: Record<string, unknown> | null = null;
    if (sessionId) {
      liveSession = db.query('SELECT id, acctSessionId, username FROM LiveSession WHERE id = ? AND status = \'active\'').get(sessionId) as Record<string, unknown> | null;
    }
    if (!liveSession && acctSessionId) {
      liveSession = db.query('SELECT id, acctSessionId, username FROM LiveSession WHERE acctSessionId = ? AND status = \'active\'').get(acctSessionId) as Record<string, unknown> | null;
    }
    if (!liveSession && sessionId && sessionId.startsWith('ls_')) {
      const bareId = sessionId.slice(3);
      liveSession = db.query('SELECT id, acctSessionId, username FROM LiveSession WHERE acctSessionId = ? AND status = \'active\'').get(bareId) as Record<string, unknown> | null;
    }

    if (liveSession) {
      matchedAcctSessionId = (liveSession.acctSessionId as string) || '';
      matchedUsername = matchedUsername || (liveSession.username as string) || '';

      // Mark LiveSession as ended
      const r = db.query("UPDATE LiveSession SET status = 'ended', updatedAt = datetime('now') WHERE id = ?").run(liveSession.id);
      changes += r.changes;
    }

    // 2. Also close the radacct record so it doesn't appear as active
    if (matchedAcctSessionId || matchedUsername) {
      try {
        if (matchedAcctSessionId) {
          db.query(
            "UPDATE radacct SET acctstoptime = ?, acctterminatecause = 'Admin-Reset', acctsessiontime = COALESCE(CAST((julianday(?) - julianday(acctstarttime)) * 86400 AS INTEGER), acctsessiontime) WHERE acctstoptime IS NULL AND acctsessionid = ?"
          ).run(now, now, matchedAcctSessionId);
        } else if (matchedUsername) {
          db.query(
            "UPDATE radacct SET acctstoptime = ?, acctterminatecause = 'Admin-Reset', acctsessiontime = COALESCE(CAST((julianday(?) - julianday(acctstarttime)) * 86400 AS INTEGER), acctsessiontime) WHERE acctstoptime IS NULL AND username = ?"
          ).run(now, now, matchedUsername);
        }
      } catch (acctErr) {
        log.warn('Failed to close radacct record', { error: String(acctErr), matchedAcctSessionId, matchedUsername });
      }
    }

    return c.json({
      success: changes > 0,
      message: changes > 0 ? 'Session ended locally' : 'No active session found',
      changes,
    });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ============================================================================
// 2. CoaSessionDetail — CoA audit trail (Accsium tblcoawiseusersession)
// ============================================================================

app.get('/api/coa-audit', (c) => {
  try {
    const propertyId = c.req.query('propertyId') || '';
    const username = c.req.query('username') || '';
    const coaType = c.req.query('coaType') || '';
    const result = c.req.query('result') || '';
    const startDate = c.req.query('startDate') || '';
    const endDate = c.req.query('endDate') || '';
    const limit = Math.min(parseInt(c.req.query('limit') || '50', 10) || 50, 500);
    const offset = parseInt(c.req.query('offset') || '0', 10) || 0;

    let sql = 'SELECT * FROM CoaSessionDetail WHERE 1=1';
    const params: unknown[] = [];

    if (propertyId) { sql += ' AND propertyId = ?'; params.push(propertyId); }
    if (username) { sql += ' AND username LIKE ?'; params.push(`%${username}%`); }
    if (coaType) { sql += ' AND coaType = ?'; params.push(coaType); }
    if (result) { sql += ' AND result = ?'; params.push(result); }
    if (startDate) { sql += ' AND createdAt >= ?'; params.push(startDate); }
    if (endDate) { sql += ' AND createdAt <= ?'; params.push(endDate + 'T23:59:59'); }

    const countRow = db.query(sql.replace('SELECT *', 'SELECT COUNT(*) as cnt')).get(...params) as { cnt: number } | undefined;
    const total = countRow?.cnt || 0;

    sql += ' ORDER BY createdAt DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    const rows = db.query(sql).all(...params) as Record<string, unknown>[];

    return c.json({ success: true, data: rows, total, limit, offset });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

app.post('/api/coa-audit', async (c) => {
  try {
    const body = await c.req.json();
    const { tenantId, propertyId, sessionId, username, userId, coaType, policyName, bandwidthPercent,
      triggeredBy, nasIpAddress, actualSessionTime, effectiveSessionTime,
      actualDownloadBytes, actualUploadBytes, effectiveDownloadBytes, effectiveUploadBytes } = body;

    const id = generateId('coa');
    db.query(
      `INSERT INTO CoaSessionDetail (id, tenantId, propertyId, sessionId, username, userId, coaType, policyName, bandwidthPercent,
        triggeredBy, nasIpAddress, actualSessionTime, effectiveSessionTime,
        actualDownloadBytes, actualUploadBytes, effectiveDownloadBytes, effectiveUploadBytes,
        result, errorMessage, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NULL, datetime('now'))`
    ).run(
      id, tenantId || 'tenant-1', propertyId || 'property-1', sessionId || '', username || '', userId || null,
      coaType || 'bw-change', policyName || null, bandwidthPercent ?? null,
      triggeredBy || 'system', nasIpAddress || null,
      actualSessionTime || 0, effectiveSessionTime || 0,
      actualDownloadBytes || 0, actualUploadBytes || 0, effectiveDownloadBytes || 0, effectiveUploadBytes || 0
    );

    return c.json({ success: true, data: { id, coaType, result: 'pending' }, message: 'CoA audit entry created' });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

app.put('/api/coa-audit/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();

    const existing = db.query('SELECT * FROM CoaSessionDetail WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!existing) return c.json({ success: false, error: 'CoA audit entry not found' }, 404);

    const updates: string[] = [];
    const params: unknown[] = [];
    if (body.result !== undefined) { updates.push('result = ?'); params.push(body.result); }
    if (body.errorMessage !== undefined) { updates.push('errorMessage = ?'); params.push(body.errorMessage); }
    if (updates.length === 0) return c.json({ success: false, error: 'No fields to update' }, 400);

    params.push(id);
    db.query(`UPDATE CoaSessionDetail SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    return c.json({ success: true, message: 'CoA audit entry updated' });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

app.get('/api/coa-audit/stats', (c) => {
  try {
    const propertyId = c.req.query('propertyId') || '';
    const whereClause = propertyId ? ' WHERE propertyId = ?' : '';
    const params = propertyId ? [propertyId] : [];
    const andClause = propertyId ? ' AND' : ' WHERE';

    const total = (db.query(`SELECT COUNT(*) as c FROM CoaSessionDetail${whereClause}`).get(...(params as unknown[])) as { c: number } | undefined)?.c || 0;
    const success = (db.query(`SELECT COUNT(*) as c FROM CoaSessionDetail${whereClause}${andClause} result = 'success'`).get(...(params as unknown[])) as { c: number } | undefined)?.c || 0;
    const failed = (db.query(`SELECT COUNT(*) as c FROM CoaSessionDetail${whereClause}${andClause} result = 'failed'`).get(...(params as unknown[])) as { c: number } | undefined)?.c || 0;
    const pending = (db.query(`SELECT COUNT(*) as c FROM CoaSessionDetail${whereClause}${andClause} result = 'pending'`).get(...(params as unknown[])) as { c: number } | undefined)?.c || 0;

    const byType = db.query(
      `SELECT coaType, result, COUNT(*) as cnt FROM CoaSessionDetail${whereClause} GROUP BY coaType, result ORDER BY cnt DESC`
    ).all(...(params as unknown[])) as Array<{ coaType: string; result: string; cnt: number }>;

    return c.json({
      success: true, data: { total, success, failed, pending, successRate: total > 0 ? ((success / total) * 100).toFixed(1) : '0', byType },
    });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ============================================================================
// 3. FairAccessPolicy (FAP) — Data cap → BW throttle (Accsium tblfapdetails)
// ============================================================================

app.get('/api/fap-policies', (c) => {
  try {
    const propertyId = c.req.query('propertyId') || '';
    const isEnabled = c.req.query('isEnabled') || '';

    let sql = 'SELECT * FROM FairAccessPolicy WHERE 1=1';
    const params: unknown[] = [];
    if (propertyId) { sql += ' AND propertyId = ?'; params.push(propertyId); }
    if (isEnabled !== '') { sql += ' AND isEnabled = ?'; params.push(parseInt(isEnabled, 10)); }
    sql += ' ORDER BY priority ASC';

    const rows = db.query(sql).all(...params) as Record<string, unknown>[];
    return c.json({ success: true, data: rows, total: rows.length });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

app.post('/api/fap-policies', async (c) => {
  try {
    const body = await c.req.json();
    const { tenantId, propertyId, name, description, cycleType, limitType, dataLimitMb, dataLimitUnit,
      switchOverBwPolicyId, cycleResetHour, cycleResetMinute, applicableOn, isEnabled, priority } = body;

    if (!name) return c.json({ success: false, error: 'name is required' }, 400);

    const { tenantId: resolvedTenantId, propertyId: resolvedPropertyId } = resolveTenantAndProperty(tenantId, propertyId);

    const id = generateId('fap');
    db.query(
      `INSERT INTO FairAccessPolicy (id, tenantId, propertyId, name, description, cycleType, limitType, dataLimitMb, dataLimitUnit,
        switchOverBwPolicyId, cycleResetHour, cycleResetMinute, applicableOn, isEnabled, priority, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
    ).run(
      id, resolvedTenantId, resolvedPropertyId, name, description || null, cycleType || 'daily', limitType || 'total',
      dataLimitMb || 0, dataLimitUnit || 'mb', switchOverBwPolicyId || null,
      cycleResetHour ?? 23, cycleResetMinute ?? 59, applicableOn || 'total', isEnabled !== false ? 1 : 0, priority || 0
    );

    return c.json({ success: true, data: { id, name }, message: 'FAP policy created' });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

app.put('/api/fap-policies/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const allowedFields = ['name', 'description', 'cycleType', 'limitType', 'dataLimitMb', 'dataLimitUnit',
      'switchOverBwPolicyId', 'cycleResetHour', 'cycleResetMinute', 'applicableOn', 'isEnabled', 'priority'];

    const existing = db.query('SELECT * FROM FairAccessPolicy WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!existing) return c.json({ success: false, error: 'FAP policy not found' }, 404);

    const updates: string[] = [];
    const params: unknown[] = [];
    for (const f of allowedFields) {
      if (body[f] !== undefined) {
        updates.push(`${f} = ?`);
        params.push(f === 'isEnabled' ? (body[f] ? 1 : 0) : body[f]);
      }
    }
    updates.push("updatedAt = datetime('now')");
    if (updates.length === 1) return c.json({ success: false, error: 'No fields to update' }, 400);

    params.push(id);
    db.query(`UPDATE FairAccessPolicy SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    return c.json({ success: true, message: 'FAP policy updated' });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

app.delete('/api/fap-policies/:id', (c) => {
  try {
    const id = c.req.param('id');
    const result = db.query('DELETE FROM FairAccessPolicy WHERE id = ?').run(id);
    if (result.changes === 0) return c.json({ success: false, error: 'FAP policy not found' }, 404);
    return c.json({ success: true, message: 'FAP policy deleted' });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

app.post('/api/fap-policies/:id/check', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const { username, currentUploadMb, currentDownloadMb } = body;

    const policy = db.query('SELECT * FROM FairAccessPolicy WHERE id = ? AND isEnabled = 1').get(id) as Record<string, unknown> | undefined;
    if (!policy) return c.json({ success: false, error: 'FAP policy not found or disabled' }, 404);

    // Convert dataLimitMb to MB based on dataLimitUnit (gb → multiply by 1024)
    let limitMb = policy.dataLimitMb as number;
    if ((policy.dataLimitUnit as string) === 'gb') limitMb *= 1024;
    let usedMb = 0;
    if (policy.applicableOn === 'download') usedMb = currentDownloadMb || 0;
    else if (policy.applicableOn === 'upload') usedMb = currentUploadMb || 0;
    else usedMb = (currentUploadMb || 0) + (currentDownloadMb || 0);

    const exceeded = usedMb >= limitMb;
    const percentUsed = limitMb > 0 ? ((usedMb / limitMb) * 100).toFixed(1) : '0';

    return c.json({
      success: true,
      data: { policyId: id, policyName: policy.name, limitMb, usedMb, percentUsed, exceeded, applicableOn: policy.applicableOn },
      message: exceeded ? 'Data limit exceeded — switch-over BW policy should be applied' : 'Within data limit',
    });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

app.post('/api/fap-policies/enforce-all', async (c) => {
  try {
    const body = await c.req.json();
    const propertyId = body.propertyId || '';
    let enforced = 0;
    let skipped = 0;

    const activeSessions = db.query(
      `SELECT * FROM LiveSession WHERE status = 'active' ${propertyId ? 'AND propertyId = ?' : ''}`
    ).all(...(propertyId ? [propertyId] : [])) as Array<Record<string, unknown>>;

    for (const session of activeSessions) {
      const fapPolicies = db.query(
        'SELECT * FROM FairAccessPolicy WHERE isEnabled = 1 AND propertyId = ? ORDER BY priority ASC LIMIT 1'
      ).all(session.propertyId) as Array<Record<string, unknown>>;

      if (fapPolicies.length === 0) { skipped++; continue; }

      const policy = fapPolicies[0];
      // Convert dataLimitMb to MB based on dataLimitUnit (gb → multiply by 1024)
      let limitMb = policy.dataLimitMb as number;
      if ((policy.dataLimitUnit as string) === 'gb') limitMb *= 1024;
      let usedMb = 0;
      if (policy.applicableOn === 'download') usedMb = session.currentOutputBytes ? Number(session.currentOutputBytes) / (1024 * 1024) : 0;
      else if (policy.applicableOn === 'upload') usedMb = session.currentInputBytes ? Number(session.currentInputBytes) / (1024 * 1024) : 0;
      else usedMb = ((session.currentInputBytes || 0) + (session.currentOutputBytes || 0)) / (1024 * 1024);

      if (usedMb >= limitMb && policy.switchOverBwPolicyId) {
        // Log CoA action
        db.query(
          `INSERT INTO CoaSessionDetail (id, tenantId, propertyId, sessionId, username, userId, coaType, policyName,
            triggeredBy, nasIpAddress, actualSessionTime, actualDownloadBytes, actualUploadBytes,
            result, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'fap-enforcer', ?, ?, ?, ?, ?, ?, 'success', datetime('now'))`
        ).run(
          generateId('coa'), resolveTenantId(session.tenantId as string), session.propertyId, session.acctSessionId,
          session.username, session.userId || null, 'fap-throttle', policy.name,
          session.nasIpAddress, session.currentSessionTime || 0,
          session.currentOutputBytes || 0, session.currentInputBytes || 0
        );
        enforced++;
      } else {
        skipped++;
      }
    }

    log.info(`FAP enforce-all: ${enforced} throttled, ${skipped} within limit, ${activeSessions.length} total sessions`);
    return c.json({
      success: true, data: { enforced, skipped, totalChecked: activeSessions.length },
      message: `FAP enforcement complete: ${enforced} sessions throttled`,
    });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ============================================================================
// 4. WebCategory + WebCategorySchedule — Category-based content filtering
// ============================================================================

app.get('/api/web-categories', (c) => {
  try {
    const propertyId = c.req.query('propertyId') || '';
    const categoryType = c.req.query('categoryType') || '';
    const enabled = c.req.query('enabled') || '';

    let sql = 'SELECT * FROM WebCategory WHERE 1=1';
    const params: unknown[] = [];
    if (propertyId) { sql += ' AND propertyId = ?'; params.push(propertyId); }
    if (categoryType) { sql += ' AND categoryType = ?'; params.push(categoryType); }
    if (enabled !== '') { sql += ' AND enabled = ?'; params.push(parseInt(enabled, 10)); }
    sql += ' ORDER BY sortOrder ASC';

    const rows = db.query(sql).all(...params) as Record<string, unknown>[];
    return c.json({ success: true, data: rows, total: rows.length });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

app.post('/api/web-categories', async (c) => {
  try {
    const body = await c.req.json();
    const { tenantId, propertyId, name, description, categoryType, isUploadRestricted, isDefault, implementationOn, sortOrder, enabled } = body;
    if (!name) return c.json({ success: false, error: 'name is required' }, 400);

    const id = generateId('wcat');
    db.query(
      `INSERT INTO WebCategory (id, tenantId, propertyId, name, description, categoryType, isUploadRestricted, isDefault, implementationOn, sortOrder, enabled, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
    ).run(
      id, resolveTenantAndProperty(tenantId, propertyId).tenantId, resolveTenantAndProperty(tenantId, propertyId).propertyId, name, description || null,
      categoryType || 'custom', isUploadRestricted ? 1 : 0, isDefault ? 1 : 0, implementationOn || 'block', sortOrder || 0, enabled !== false ? 1 : 0
    );

    return c.json({ success: true, data: { id, name }, message: 'Web category created' });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

app.put('/api/web-categories/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const existing = db.query('SELECT * FROM WebCategory WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!existing) return c.json({ success: false, error: 'Web category not found' }, 404);

    const updates: string[] = [];
    const params: unknown[] = [];
    const allowedFields = ['name', 'description', 'categoryType', 'isUploadRestricted', 'isDefault', 'implementationOn', 'sortOrder', 'enabled'];
    for (const f of allowedFields) {
      if (body[f] !== undefined) {
        updates.push(`${f} = ?`);
        params.push(f === 'enabled' || f === 'isUploadRestricted' || f === 'isDefault' ? (body[f] ? 1 : 0) : body[f]);
      }
    }
    updates.push("updatedAt = datetime('now')");
    if (updates.length === 1) return c.json({ success: false, error: 'No fields to update' }, 400);

    params.push(id);
    db.query(`UPDATE WebCategory SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    return c.json({ success: true, message: 'Web category updated' });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

app.delete('/api/web-categories/:id', (c) => {
  try {
    const id = c.req.param('id');
    db.query('DELETE FROM WebCategorySchedule WHERE webCategoryId = ?').run(id);
    const result = db.query('DELETE FROM WebCategory WHERE id = ?').run(id);
    if (result.changes === 0) return c.json({ success: false, error: 'Web category not found' }, 404);
    return c.json({ success: true, message: 'Web category deleted' });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

app.get('/api/web-categories/:id/schedules', (c) => {
  try {
    const webCategoryId = c.req.param('id');
    const rows = db.query('SELECT * FROM WebCategorySchedule WHERE webCategoryId = ? ORDER BY orderIndex ASC').all(webCategoryId) as Record<string, unknown>[];
    return c.json({ success: true, data: rows, total: rows.length });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

app.post('/api/web-categories/:id/schedules', async (c) => {
  try {
    const webCategoryId = c.req.param('id');
    const body = await c.req.json();
    const { tenantId, propertyId, scheduleAccessId, isAllow, orderIndex, startTime, endTime, daysOfWeek, enabled } = body;

    const id = generateId('wcs');
    db.query(
      `INSERT INTO WebCategorySchedule (id, tenantId, propertyId, webCategoryId, scheduleAccessId, isAllow, orderIndex, startTime, endTime, daysOfWeek, enabled, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
    ).run(
      id, resolveTenantAndProperty(tenantId, propertyId).tenantId, resolveTenantAndProperty(tenantId, propertyId).propertyId, webCategoryId, scheduleAccessId || null,
      isAllow ? 1 : 0, orderIndex || 0, startTime || '00:00', endTime || '23:59', daysOfWeek || '1,2,3,4,5,6,7', enabled !== false ? 1 : 0
    );

    return c.json({ success: true, data: { id }, message: 'Web category schedule added' });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

app.put('/api/web-categories/schedules/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const existing = db.query('SELECT * FROM WebCategorySchedule WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!existing) return c.json({ success: false, error: 'Schedule not found' }, 404);

    const updates: string[] = [];
    const params: unknown[] = [];
    const allowedFields = ['scheduleAccessId', 'isAllow', 'orderIndex', 'startTime', 'endTime', 'daysOfWeek', 'enabled'];
    for (const f of allowedFields) {
      if (body[f] !== undefined) {
        updates.push(`${f} = ?`);
        params.push(f === 'isAllow' || f === 'enabled' ? (body[f] ? 1 : 0) : body[f]);
      }
    }
    updates.push("updatedAt = datetime('now')");
    if (updates.length === 1) return c.json({ success: false, error: 'No fields to update' }, 400);

    params.push(id);
    db.query(`UPDATE WebCategorySchedule SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    return c.json({ success: true, message: 'Web category schedule updated' });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

app.delete('/api/web-categories/schedules/:id', (c) => {
  try {
    const id = c.req.param('id');
    const result = db.query('DELETE FROM WebCategorySchedule WHERE id = ?').run(id);
    if (result.changes === 0) return c.json({ success: false, error: 'Schedule not found' }, 404);
    return c.json({ success: true, message: 'Web category schedule deleted' });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ============================================================================
// 5. WiFiUserStatusHistory — User status audit trail (Accsium tbluserstatushistory)
// ============================================================================

app.get('/api/user-status-history', (c) => {
  try {
    const propertyId = c.req.query('propertyId') || '';
    const username = c.req.query('username') || '';
    const startDate = c.req.query('startDate') || '';
    const endDate = c.req.query('endDate') || '';
    const limit = Math.min(parseInt(c.req.query('limit') || '50', 10) || 50, 500);
    const offset = parseInt(c.req.query('offset') || '0', 10) || 0;

    let sql = 'SELECT * FROM WiFiUserStatusHistory WHERE 1=1';
    const params: unknown[] = [];

    if (propertyId) { sql += ' AND propertyId = ?'; params.push(propertyId); }
    if (username) { sql += ' AND username LIKE ?'; params.push(`%${username}%`); }
    if (startDate) { sql += ' AND createdAt >= ?'; params.push(startDate); }
    if (endDate) { sql += ' AND createdAt <= ?'; params.push(endDate + 'T23:59:59'); }

    const countRow = db.query(sql.replace('SELECT *', 'SELECT COUNT(*) as cnt')).get(...params) as { cnt: number } | undefined;
    const total = countRow?.cnt || 0;

    sql += ' ORDER BY createdAt DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    const rows = db.query(sql).all(...params) as Record<string, unknown>[];

    return c.json({ success: true, data: rows, total, limit, offset });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

app.post('/api/user-status-history', async (c) => {
  try {
    const body = await c.req.json();
    const { tenantId, propertyId, username, userId, oldStatus, newStatus, changedBy, changeReason, ipAddress } = body;
    if (!newStatus) return c.json({ success: false, error: 'newStatus is required' }, 400);

    const id = generateId('ush');
    db.query(
      `INSERT INTO WiFiUserStatusHistory (id, tenantId, propertyId, username, userId, oldStatus, newStatus, changedBy, changeReason, ipAddress, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    ).run(
      id, resolveTenantAndProperty(tenantId, propertyId).tenantId, resolveTenantAndProperty(tenantId, propertyId).propertyId, username || '', userId || null,
      oldStatus || null, newStatus, changedBy || null, changeReason || null, ipAddress || null
    );

    return c.json({ success: true, data: { id, newStatus }, message: 'Status history entry created' });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ============================================================================
// 6. NasHealthLog — NAS health monitoring (Accsium tblnasconnectivity)
// ============================================================================

app.get('/api/nas-health', (c) => {
  try {
    const propertyId = c.req.query('propertyId') || '';
    const nasIpAddress = c.req.query('nasIpAddress') || '';
    const isOnline = c.req.query('isOnline') || '';
    const startDate = c.req.query('startDate') || '';
    const endDate = c.req.query('endDate') || '';
    const limit = Math.min(parseInt(c.req.query('limit') || '100', 10) || 100, 500);
    const offset = parseInt(c.req.query('offset') || '0', 10) || 0;

    let sql = 'SELECT * FROM NasHealthLog WHERE 1=1';
    const params: unknown[] = [];

    if (propertyId) { sql += ' AND propertyId = ?'; params.push(propertyId); }
    if (nasIpAddress) { sql += ' AND nasIpAddress = ?'; params.push(nasIpAddress); }
    if (isOnline !== '') { sql += ' AND isOnline = ?'; params.push(parseInt(isOnline, 10)); }
    if (startDate) { sql += ' AND createdAt >= ?'; params.push(startDate); }
    if (endDate) { sql += ' AND createdAt <= ?'; params.push(endDate + 'T23:59:59'); }

    const countRow = db.query(sql.replace('SELECT *', 'SELECT COUNT(*) as cnt')).get(...params) as { cnt: number } | undefined;
    const total = countRow?.cnt || 0;

    sql += ' ORDER BY createdAt DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    const rows = db.query(sql).all(...params) as Record<string, unknown>[];

    return c.json({ success: true, data: rows, total, limit, offset });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

app.get('/api/nas-health/current', (c) => {
  try {
    const propertyId = c.req.query('propertyId') || '';
    const whereClause = propertyId ? ' WHERE propertyId = ?' : '';
    const params = propertyId ? [propertyId] : [];
    const andClause = propertyId ? ' AND' : ' WHERE';

    // Get the latest health log for each NAS IP
    const rows = db.query(
      `SELECT * FROM NasHealthLog${whereClause}${andClause} nasIpAddress IN (
        SELECT nasIpAddress FROM NasHealthLog${whereClause} GROUP BY nasIpAddress
      ) ORDER BY nasIpAddress, createdAt DESC`
    ).all(...(params as unknown[])) as Record<string, unknown>[];

    // Deduplicate: take only the latest per NAS
    const seen = new Set<string>();
    const current: Record<string, unknown>[] = [];
    for (const row of rows) {
      const ip = row.nasIpAddress as string;
      if (!seen.has(ip)) { seen.add(ip); current.push(row); }
    }

    return c.json({ success: true, data: current, total: current.length });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

app.post('/api/nas-health/check', async (c) => {
  try {
    const body = await c.req.json();
    const { propertyId, nasIpAddress, nasName } = body;
    if (!nasIpAddress) return c.json({ success: false, error: 'nasIpAddress is required' }, 400);

    // Validate nasIpAddress is a valid IP address (prevent command injection)
    const ipRegex = /^(?:\d{1,3}\.){3}\d{1,3}$|^[a-fA-F0-9:]+$/;
    if (!ipRegex.test(nasIpAddress)) {
      return c.json({ success: false, error: 'Invalid nasIpAddress format' }, 400);
    }

    // Check NAS connectivity using Node.js TCP socket (no shell injection risk)
    let isOnline = false;
    let avgLatencyMs: number | null = null;

    const nasClient = db.query('SELECT * FROM nas WHERE nasname = ?').get(nasIpAddress) as Record<string, unknown> | undefined;
    const port = nasClient ? (nasClient.authPort as number) : 1812;

    try {
      isOnline = await new Promise<boolean>((resolve) => {
        const start = Date.now();
        const socket = new net.Socket();
        socket.setTimeout(3000);
        socket.on('connect', () => {
          avgLatencyMs = Date.now() - start;
          socket.destroy();
          resolve(true);
        });
        socket.on('timeout', () => { socket.destroy(); resolve(false); });
        socket.on('error', () => { socket.destroy(); resolve(false); });
        socket.connect(port, nasIpAddress);
      });
    } catch {
      isOnline = false;
    }

    // Count live users from this NAS
    const liveCount = (db.query("SELECT COUNT(*) as c FROM LiveSession WHERE nasIpAddress = ? AND status = 'active'").get(nasIpAddress) as { c: number } | undefined)?.c || 0;

    const id = generateId('nhl');
    db.query(
      `INSERT INTO NasHealthLog (id, tenantId, propertyId, nasIpAddress, nasName, isOnline, liveUsers, totalAuths, totalAccts, avgLatencyMs, lastSeenAt, checkIntervalSec, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, datetime('now'), 60, datetime('now'), datetime('now'))`
    ).run(
      id, 'default', propertyId || 'property-1', nasIpAddress, nasName || null,
      isOnline ? 1 : 0, liveCount, avgLatencyMs
    );

    return c.json({
      success: true,
      data: { id, nasIpAddress, isOnline, avgLatencyMs, liveUsers: liveCount },
      message: isOnline ? 'NAS is online' : 'NAS is offline',
    });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

app.get('/api/nas-health/stats', (c) => {
  try {
    const propertyId = c.req.query('propertyId') || '';
    const where = propertyId ? ' WHERE propertyId = ?' : '';
    const andWhere = propertyId ? ' AND' : ' WHERE';

    const params: unknown[] = propertyId ? [propertyId] : [];

    const total = (db.query(`SELECT COUNT(*) as c FROM NasHealthLog${where}`).get(...params) as { c: number } | undefined)?.c || 0;
    const online = (db.query(`SELECT COUNT(DISTINCT nasIpAddress) as c FROM NasHealthLog${where}${andWhere} isOnline = 1`).get(...params) as { c: number } | undefined)?.c || 0;
    const offline = (db.query(`SELECT COUNT(DISTINCT nasIpAddress) as c FROM NasHealthLog${where}${andWhere} isOnline = 0`).get(...params) as { c: number } | undefined)?.c || 0;
    const avgLatency = (db.query(`SELECT AVG(avgLatencyMs) as a FROM NasHealthLog${where}${andWhere} isOnline = 1 AND avgLatencyMs IS NOT NULL`).get(...params) as { a: number } | undefined)?.a || 0;

    return c.json({
      success: true,
      data: { totalLogs: total, onlineNas: online, offlineNas: offline, avgLatencyMs: Math.round(avgLatency * 100) / 100 },
    });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ============================================================================
// 7. BandwidthPolicyDetail — Enhanced BW policies with guaranteed BW, burst
// ============================================================================

app.get('/api/bw-policy-details', (c) => {
  try {
    const bandwidthPolicyId = c.req.query('bandwidthPolicyId') || '';
    if (!bandwidthPolicyId) return c.json({ success: false, error: 'bandwidthPolicyId is required' }, 400);

    const rows = db.query('SELECT * FROM BandwidthPolicyDetail WHERE bandwidthPolicyId = ? ORDER BY priority ASC').all(bandwidthPolicyId) as Record<string, unknown>[];
    return c.json({ success: true, data: rows, total: rows.length });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

app.post('/api/bw-policy-details', async (c) => {
  try {
    const body = await c.req.json();
    const { tenantId, bandwidthPolicyId, scheduleAccessId, downloadLimitBps, uploadLimitBps,
      guaranteedDownBps, guaranteedUpBps, burstTimeSeconds, burstThresholdBytes, burstUpTimeSeconds,
      burstUpThresholdBytes, contentionRatio, priority, isEnabled } = body;

    if (!bandwidthPolicyId) return c.json({ success: false, error: 'bandwidthPolicyId is required' }, 400);

    const id = generateId('bpd');
    db.query(
      `INSERT INTO BandwidthPolicyDetail (id, tenantId, bandwidthPolicyId, scheduleAccessId, downloadLimitBps, uploadLimitBps,
        guaranteedDownBps, guaranteedUpBps, burstTimeSeconds, burstThresholdBytes, burstUpTimeSeconds,
        burstUpThresholdBytes, contentionRatio, priority, isEnabled, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))`
    ).run(
      id, resolveTenantId(tenantId), bandwidthPolicyId, scheduleAccessId || null,
      downloadLimitBps || 0, uploadLimitBps || 0, guaranteedDownBps || 0, guaranteedUpBps || 0,
      burstTimeSeconds || 0, burstThresholdBytes || 0, burstUpTimeSeconds || 0, burstUpThresholdBytes || 0,
      contentionRatio || 1, priority || 0, isEnabled !== false ? 1 : 0
    );

    return c.json({ success: true, data: { id }, message: 'BW policy detail created' });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

app.put('/api/bw-policy-details/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const existing = db.query('SELECT * FROM BandwidthPolicyDetail WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!existing) return c.json({ success: false, error: 'BW policy detail not found' }, 404);

    const updates: string[] = [];
    const params: unknown[] = [];
    const allowedFields = ['scheduleAccessId', 'downloadLimitBps', 'uploadLimitBps', 'guaranteedDownBps', 'guaranteedUpBps',
      'burstTimeSeconds', 'burstThresholdBytes', 'burstUpTimeSeconds', 'burstUpThresholdBytes', 'contentionRatio', 'priority', 'isEnabled'];
    for (const f of allowedFields) {
      if (body[f] !== undefined) {
        updates.push(`${f} = ?`);
        params.push(f === 'isEnabled' ? (body[f] ? 1 : 0) : body[f]);
      }
    }
    updates.push("updatedAt = datetime('now')");
    if (updates.length === 1) return c.json({ success: false, error: 'No fields to update' }, 400);

    params.push(id);
    db.query(`UPDATE BandwidthPolicyDetail SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    return c.json({ success: true, message: 'BW policy detail updated' });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

app.delete('/api/bw-policy-details/:id', (c) => {
  try {
    const id = c.req.param('id');
    const result = db.query('DELETE FROM BandwidthPolicyDetail WHERE id = ?').run(id);
    if (result.changes === 0) return c.json({ success: false, error: 'BW policy detail not found' }, 404);
    return c.json({ success: true, message: 'BW policy detail deleted' });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ============================================================================
// FAP Background Enforcer (every 3 minutes)
// ============================================================================

setInterval(() => {
  try {
    log.info('FAP background enforcer: running...');

    // Get all active sessions that haven't been checked recently
    const activeSessions = db.query(
      "SELECT * FROM LiveSession WHERE status = 'active'"
    ).all() as Array<Record<string, unknown>>;

    let enforced = 0;
    let checked = 0;

    for (const session of activeSessions) {
      checked++;

      // Find applicable FAP policy for this session's property
      const fapPolicies = db.query(
        'SELECT * FROM FairAccessPolicy WHERE isEnabled = 1 AND propertyId = ? ORDER BY priority ASC LIMIT 1'
      ).all(session.propertyId) as Array<Record<string, unknown>>;

      if (fapPolicies.length === 0) continue;

      const policy = fapPolicies[0];
      // CRITICAL: Convert dataLimitMb to MB based on dataLimitUnit (gb → multiply by 1024)
      let limitMb = policy.dataLimitMb as number;
      if ((policy.dataLimitUnit as string) === 'gb') {
        limitMb *= 1024;
      }
      if (limitMb <= 0) continue;

      // Calculate used data in MB
      let usedMb = 0;
      if (policy.applicableOn === 'download') {
        usedMb = (session.currentOutputBytes || 0) / (1024 * 1024);
      } else if (policy.applicableOn === 'upload') {
        usedMb = (session.currentInputBytes || 0) / (1024 * 1024);
      } else {
        usedMb = ((session.currentInputBytes || 0) + (session.currentOutputBytes || 0)) / (1024 * 1024);
      }

      if (usedMb >= limitMb && policy.switchOverBwPolicyId) {
        // Check if we already throttled this session recently (avoid duplicate CoA)
        const recentCoa = db.query(
          "SELECT id FROM CoaSessionDetail WHERE username = ? AND coaType = 'fap-throttle' AND result = 'success' AND createdAt > datetime('now', '-5 minutes') LIMIT 1"
        ).get(session.username) as { id: string } | undefined;

        if (!recentCoa) {
          // Look up the switch-over bandwidth policy instead of hardcoding
          const bwPolicy = db.query('SELECT * FROM BandwidthPolicy WHERE id = ?').get(policy.switchOverBwPolicyId) as Record<string, unknown> | undefined;
          const throttleDown = ((bwPolicy?.downloadKbps as number) || 1000); // default 1 Mbps
          const throttleUp = ((bwPolicy?.uploadKbps as number) || 512);    // default 512 kbps

          log.info(`FAP: Throttling user ${session.username} — used ${usedMb.toFixed(1)}MB / ${limitMb}MB (${policy.name}) → ${throttleDown}/${throttleUp} kbps`);

          // Log the CoA action
          db.query(
            `INSERT INTO CoaSessionDetail (id, tenantId, propertyId, sessionId, username, userId, coaType, policyName,
              triggeredBy, nasIpAddress, actualSessionTime, actualDownloadBytes, actualUploadBytes,
              result, errorMessage, createdAt)
             VALUES (?, ?, ?, ?, ?, ?, 'fap-throttle', ?, 'fap-enforcer', ?, ?, ?, ?, 'success', NULL, datetime('now'))`
          ).run(
            generateId('coa'), resolveTenantId(session.tenantId as string), session.propertyId, session.acctSessionId,
            session.username, session.userId || null, policy.name, session.nasIpAddress,
            session.currentSessionTime || 0, session.currentOutputBytes || 0, session.currentInputBytes || 0
          );

          // Send CoA to throttle — vendor-aware (use NAS vendor type)
          const nas = lookupNAS(session.nasIpAddress as string);
          if (nas) {
            const vendor = normalizeVendor(nas.type);
            const downBps = throttleDown * 1000; // kbps to bps
            const upBps = throttleUp * 1000;
            let attrs = `User-Name="${session.username}"`;
            switch (vendor) {
              case 'mikrotik':
                attrs += `\nMikrotik-Rate-Limit="${throttleDown}k/${throttleUp}k"`;
                break;
              case 'cisco':
                attrs += `\nCisco-AVPair="sub:Ingress-Committed-Data-Rate=${upBps}"\nCisco-AVPair="sub:Egress-Committed-Data-Rate=${downBps}"`;
                break;
              case 'chillispot':
                attrs += `\nChilliSpot-Bandwidth-Max-Down=${downBps}\nChilliSpot-Bandwidth-Max-Up=${upBps}`;
                break;
              default:
                attrs += `\nWISPr-Bandwidth-Max-Down=${downBps}\nWISPr-Bandwidth-Max-Up=${upBps}\nChilliSpot-Bandwidth-Max-Down=${downBps}\nChilliSpot-Bandwidth-Max-Up=${upBps}`;
                break;
            }
            executeRadclient(nas.ip, nas.coaPort, 'coa', nas.secret, attrs).then(radResult => {
              if (!radResult.success) {
                db.query("UPDATE CoaSessionDetail SET result = 'failed', errorMessage = ? WHERE id = (SELECT id FROM CoaSessionDetail WHERE username = ? AND coaType = 'fap-throttle' ORDER BY createdAt DESC LIMIT 1)")
                  .run(radResult.error?.substring(0, 500), session.username);
              }
            }).catch(() => {});
          }

          enforced++;
        }
      }
    }

    if (enforced > 0 || checked > 0) {
      log.info(`FAP enforcer: checked ${checked}, throttled ${enforced}`);
    }
  } catch (err) {
    log.error('FAP background enforcer failed', { error: String(err) });
  }
}, 3 * 60 * 1000); // Every 3 minutes

// ============================================================================
// Startup
// ============================================================================

// Check RADIUS server status on startup
checkRadiusStatus().then(status => {
  if (!status.installed) {
    log.warn('FreeRADIUS not installed - management UI active but no live auth/accounting', { status });
  } else {
    log.info('RADIUS server status', { installed: status.installed, running: status.running, version: status.version });
  }
});

// Sync config files from database on startup (regenerates clients.conf)
syncAllConfigFiles().catch(err => {
  log.error('Startup config sync failed', { error: String(err) });
});

// Auto-setup FreeRADIUS SQL module on startup (configure radiusd to read from shared SQLite DB)
setupFreeRadiusSQL().then(result => {
  if (result.success) {
    log.info('FreeRADIUS SQL auto-setup completed', { details: result.details });
  } else {
    log.warn('FreeRADIUS SQL auto-setup failed (non-critical)', { error: result.error });
  }
}).catch(err => {
  log.warn('FreeRADIUS SQL auto-setup error (non-critical)', { error: String(err) });
});

Bun.serve({
  port: PORT,
  fetch: app.fetch,
});

log.info('RADIUS Service HTTP server listening', { port: PORT });

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
