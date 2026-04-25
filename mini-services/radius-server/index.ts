/**
 * RADIUS Protocol Server (Bun)
 * 
 * Implements:
 * - Authentication (Access-Request → Accept/Reject) reading from radcheck/radreply/radusergroup
 * - Accounting (Start/Interim/Stop) writing to radacct
 * - Post-Auth logging to radpostauth
 * - CoA (Change of Authorization) for bandwidth/session changes
 * - Disconnect-Message for session termination
 * 
 * Uses the same SQLite database as the PMS and freeradius-service.
 */

import Database from "bun:sqlite";
import {
  PacketType,
  AttributeType,
  AcctStatusType,
  decodePacket,
  encodePacket,
  createResponse,
  getAttributeString,
  getAttributeNumber,
  getAttribute,
  getVendorAttribute,
  encryptPassword,
  packetSummary,
  makeAttr,
  makeVendorAttr,
  VENDOR_WISPR,
  VENDOR_CHILLISPOT,
  type RadiusPacket,
  type RadiusAttribute,
} from "./radius-protocol";

// ── Configuration ─────────────────────────────────────────────
const CONFIG = {
  authPort: 1812,
  acctPort: 1813,
  dbPath: "/home/z/my-project/db/custom.db",
  secret: "testing123", // Default shared secret for test NAS
  logLevel: "info" as "debug" | "info" | "warn" | "error",
};

// ── Database ──────────────────────────────────────────────────
let db: Database;

function initDatabase() {
  db = new Database(CONFIG.dbPath, { create: true });
  db.exec("PRAGMA journal_mode=WAL;");
  db.exec("PRAGMA wal_autocheckpoint = 1000;");
  db.exec("PRAGMA busy_timeout=30000;");
  db.exec("PRAGMA foreign_keys=ON;");
  
  // Verify tables exist
  const tables = db.query("SELECT name FROM sqlite_master WHERE type='table'").all().map((r: any) => r.name);
  const required = ["radcheck", "radreply", "radgroupcheck", "radgroupreply", "radusergroup", "radacct", "radpostauth", "nas"];
  const missing = required.filter((t) => !tables.includes(t));
  
  if (missing.length > 0) {
    log("warn", `Missing RADIUS tables: ${missing.join(", ")}. Some features may not work.`);
  } else {
    log("info", `All ${required.length} RADIUS tables verified OK`);
  }
}

// ── Logging ───────────────────────────────────────────────────
const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

function log(level: string, message: string, data?: any) {
  const lvl = (level as keyof typeof LOG_LEVELS) || "info";
  if (LOG_LEVELS[lvl] < LOG_LEVELS[CONFIG.logLevel]) return;
  
  const ts = new Date().toISOString();
  const prefix = `[RADIUS ${lvl.toUpperCase()}] ${ts}`;
  
  if (data) {
    console.log(`${prefix} ${message}`, typeof data === "object" ? JSON.stringify(data, null, 2) : data);
  } else {
    console.log(`${prefix} ${message}`);
  }
}

// ── Authentication Engine ─────────────────────────────────────
interface CheckItem {
  attribute: string;
  op: string;
  value: string;
}

function authenticateUser(packet: RadiusPacket): { accept: boolean; replyAttrs: RadiusAttribute[]; reason: string } {
  const username = getAttributeString(packet, AttributeType.USER_NAME);
  const rawPassword = getAttributeString(packet, AttributeType.USER_PASSWORD);
  const callingStationId = getAttributeString(packet, AttributeType.CALLING_STATION_ID);
  const nasIpAddress = getAttributeString(packet, AttributeType.NAS_IP_ADDRESS);
  const nasIdentifier = getAttributeString(packet, AttributeType.NAS_IDENTIFIER);
  
  if (!username) {
    return { accept: false, replyAttrs: [], reason: "No User-Name attribute" };
  }
  
  log("debug", `Auth attempt: user="${username}" NAS=${nasIpAddress || nasIdentifier || "unknown"}`);
  
  // 1. Fetch radcheck entries for the user
  const checkItems = db
    .query("SELECT attribute, op, value FROM radcheck WHERE username = ? ORDER BY id")
    .all(username) as CheckItem[];
  
  if (checkItems.length === 0) {
    log("info", `Auth REJECT: user="${username}" - no radcheck entries found`);
    return { accept: false, replyAttrs: [], reason: "User not found" };
  }
  
  // 2. Find the password check attribute and verify
  let passwordVerified = false;
  let passwordAttr = "";
  let cleartextPassword = "";
  
  for (const item of checkItems) {
    switch (item.attribute) {
      case "Cleartext-Password":
        if (item.op === ":=" || item.op === "==") {
          if (rawPassword === item.value) {
            passwordVerified = true;
            cleartextPassword = item.value;
          }
          passwordAttr = "Cleartext-Password";
        }
        break;
      case "Calling-Station-Id":
        if (item.op === ":=" || item.op === "==") {
          if (callingStationId.toLowerCase() !== item.value.toLowerCase()) {
            log("info", `Auth REJECT: user="${username}" - Calling-Station-Id mismatch (expected="${item.value}", got="${callingStationId}")`);
            return { accept: false, replyAttrs: [], reason: "MAC address mismatch" };
          }
        }
        break;
      case "Expiration": {
        const expDate = new Date(item.value);
        if (expDate < new Date()) {
          log("info", `Auth REJECT: user="${username}" - account expired (${item.value})`);
          return { accept: false, replyAttrs: [], reason: "Account expired" };
        }
        break;
      }
      // Add more check attributes as needed
    }
  }
  
  if (!passwordVerified && checkItems.some((c) => c.attribute.includes("Password"))) {
    log("info", `Auth REJECT: user="${username}" - invalid password (${passwordAttr})`);
    return { accept: false, replyAttrs: [], reason: "Invalid password" };
  }
  
  if (!passwordVerified && rawPassword) {
    log("info", `Auth REJECT: user="${username}" - password check attribute found but verification failed`);
    return { accept: false, replyAttrs: [], reason: "Password verification failed" };
  }
  
  // 3. If no password attribute at all (MAC-only auth), accept if Calling-Station-Id matched
  if (!passwordVerified && !checkItems.some((c) => c.attribute.includes("Password"))) {
    log("debug", `Auth ACCEPT: user="${username}" - MAC auth (no password required)`);
    passwordVerified = true; // MAC-only auth
  }
  
  if (!passwordVerified) {
    return { accept: false, replyAttrs: [], reason: "No valid credentials" };
  }
  
  // 4. Get reply attributes from radreply
  const replyAttrs: RadiusAttribute[] = [];
  const replyItems = db
    .query("SELECT attribute, value FROM radreply WHERE username = ? ORDER BY id")
    .all(username) as { attribute: string; value: string }[];
  
  for (const item of replyItems) {
    const attr = parseReplyAttribute(item.attribute, item.value);
    if (attr) replyAttrs.push(attr);
  }
  
  // 5. Get group reply attributes from radusergroup → radgroupreply
  const groups = db
    .query("SELECT groupname FROM radusergroup WHERE username = ? ORDER BY priority")
    .all(username) as { groupname: string }[];
  
  for (const group of groups) {
    const groupReplyItems = db
      .query("SELECT attribute, value FROM radgroupreply WHERE groupname = ? ORDER BY id")
      .all(group.groupname) as { attribute: string; value: string }[];
    
    for (const item of groupReplyItems) {
      // Don't override user-specific reply attrs
      if (!replyItems.some((r) => r.attribute === item.attribute)) {
        const attr = parseReplyAttribute(item.attribute, item.value);
        if (attr) replyAttrs.push(attr);
      }
    }
    
    // Check group check items (e.g., Simultaneous-Use)
    const groupCheckItems = db
      .query("SELECT attribute, op, value FROM radgroupcheck WHERE groupname = ? ORDER BY id")
      .all(group.groupname) as CheckItem[];
    
    for (const item of groupCheckItems) {
      if (item.attribute === "Simultaneous-Use") {
        const maxSessions = parseInt(item.value, 10);
        const activeCount = db
          .query("SELECT COUNT(*) as cnt FROM radacct WHERE username = ? AND acctstoptime IS NULL")
          .get(username) as { cnt: number };
        
        if (activeCount.cnt >= maxSessions) {
          log("info", `Auth REJECT: user="${username}" - max concurrent sessions reached (${activeCount.cnt}/${maxSessions})`);
          return { accept: false, replyAttrs: [], reason: "Max concurrent sessions reached" };
        }
      }
    }
  }
  
  log("info", `Auth ACCEPT: user="${username}" with ${replyAttrs.length} reply attributes`);
  return { accept: true, replyAttrs, reason: "OK" };
}

function parseReplyAttribute(attribute: string, value: string): RadiusAttribute | null {
  switch (attribute) {
    case "Session-Timeout":
      return makeAttr(AttributeType.SESSION_TIMEOUT, parseInt(value, 10) || 0);
    case "Idle-Timeout":
      return makeAttr(AttributeType.IDLE_TIMEOUT, parseInt(value, 10) || 0);
    case "Framed-IP-Address":
      return makeAttr(AttributeType.FRAMED_IP_ADDRESS, value);
    case "Framed-IP-Netmask":
      return makeAttr(AttributeType.FRAMED_IP_NETMASK, value);
    case "Framed-MTU":
      return makeAttr(AttributeType.FRAMED_MTU, parseInt(value, 10) || 0);
    case "Service-Type":
      return makeAttr(AttributeType.SERVICE_TYPE, parseInt(value, 10) || 0);
    case "Port-Limit":
      return makeAttr(AttributeType.PORT_LIMIT, parseInt(value, 10) || 0);
    case "Reply-Message":
      return makeAttr(AttributeType.REPLY_MESSAGE, value);
    case "Class":
      return makeAttr(AttributeType.CLASS, value);
    case "WISPr-Bandwidth-Max-Down":
      return makeVendorAttr(VENDOR_WISPR, 1, parseInt(value, 10) || value);
    case "WISPr-Bandwidth-Max-Up":
      return makeVendorAttr(VENDOR_WISPR, 2, parseInt(value, 10) || value);
    case "WISPr-Session-Terminate-Time":
      return makeVendorAttr(VENDOR_WISPR, 3, value);
    case "ChilliSpot-Bandwidth-Max-Down":
      return makeVendorAttr(VENDOR_CHILLISPOT, 1, parseInt(value, 10) || value);
    case "ChilliSpot-Bandwidth-Max-Up":
      return makeVendorAttr(VENDOR_CHILLISPOT, 2, parseInt(value, 10) || value);
    case "ChilliSpot-Max-Input-Octets":
      return makeVendorAttr(VENDOR_CHILLISPOT, 3, parseInt(value, 10) || value);
    case "ChilliSpot-Max-Output-Octets":
      return makeVendorAttr(VENDOR_CHILLISPOT, 4, parseInt(value, 10) || value);
    case "ChilliSpot-Max-Total-Octets":
      return makeVendorAttr(VENDOR_CHILLISPOT, 5, parseInt(value, 10) || value);
    default:
      log("debug", `Unknown reply attribute: ${attribute}=${value}`);
      return null;
  }
}

// ── Accounting Engine ─────────────────────────────────────────
function processAccounting(packet: RadiusPacket): void {
  const username = getAttributeString(packet, AttributeType.USER_NAME);
  const sessionId = getAttributeString(packet, AttributeType.ACCT_SESSION_ID);
  const statusType = getAttributeNumber(packet, AttributeType.ACCT_STATUS_TYPE);
  const nasIpAddress = getAttributeString(packet, AttributeType.NAS_IP_ADDRESS);
  const nasIdentifier = getAttributeString(packet, AttributeType.NAS_IDENTIFIER);
  const nasPortId = getAttributeString(packet, AttributeType.NAS_PORT_ID) || String(getAttributeNumber(packet, AttributeType.NAS_PORT));
  const calledStationId = getAttributeString(packet, AttributeType.CALLED_STATION_ID);
  const callingStationId = getAttributeString(packet, AttributeType.CALLING_STATION_ID);
  const framedIpAddress = getAttributeString(packet, AttributeType.FRAMED_IP_ADDRESS);
  const acctDelayTime = getAttributeNumber(packet, AttributeType.ACCT_DELAY_TIME);
  const acctSessionTime = getAttributeNumber(packet, AttributeType.ACCT_SESSION_TIME);
  const inputOctets = getAttributeNumber(packet, AttributeType.ACCT_INPUT_OCTETS);
  const outputOctets = getAttributeNumber(packet, AttributeType.ACCT_OUTPUT_OCTETS);
  const inputPackets = getAttributeNumber(packet, AttributeType.ACCT_INPUT_PACKETS);
  const outputPackets = getAttributeNumber(packet, AttributeType.ACCT_OUTPUT_PACKETS);
  const terminateCause = getAttributeNumber(packet, AttributeType.ACCT_TERMINATE_CAUSE);
  
  if (!sessionId) {
    log("warn", `Accounting packet missing Acct-Session-Id, skipping`);
    return;
  }
  
  const now = new Date().toISOString();
  
  switch (statusType) {
    case AcctStatusType.START:
      handleAccountingStart({
        username, sessionId, nasIpAddress, nasIdentifier, nasPortId,
        calledStationId, callingStationId, framedIpAddress, acctDelayTime,
        acctStartTime: now,
      });
      break;
    case AcctStatusType.INTERIM_UPDATE:
      handleAccountingInterim({
        username, sessionId, nasIpAddress, nasIdentifier, nasPortId,
        acctSessionTime, inputOctets, outputOctets, inputPackets, outputPackets,
        updateTime: now,
      });
      break;
    case AcctStatusType.STOP:
      handleAccountingStop({
        username, sessionId, nasIpAddress, nasIdentifier, nasPortId,
        acctSessionTime, inputOctets, outputOctets, inputPackets, outputPackets,
        terminateCause, updateTime: now, stopTime: now,
      });
      break;
    default:
      log("info", `Accounting status type ${statusType} not handled for session "${sessionId}"`);
  }
}

function handleAccountingStart(data: {
  username: string; sessionId: string; nasIpAddress: string; nasIdentifier: string;
  nasPortId: string; calledStationId: string; callingStationId: string;
  framedIpAddress: string; acctDelayTime: number; acctStartTime: string;
}) {
  // Check if session already exists (duplicate start)
  const existing = db
    .query("SELECT acctuniqueid FROM radacct WHERE acctsessionid = ? AND acctstoptime IS NULL")
    .get(data.sessionId) as any;
  
  if (existing) {
    log("warn", `Duplicate Accounting-Start for session "${data.sessionId}" - updating existing record`);
    db.prepare(`
      UPDATE radacct SET 
        username = ?, nasipaddress = ?, nasportid = ?,
        calledstationid = ?, callingstationid = ?, framedipaddress = ?,
        acctstarttime = ?, acctupdatetime = datetime('now'), updatedAt = datetime('now')
      WHERE acctsessionid = ? AND acctstoptime IS NULL
    `).run(
      data.username, data.nasIpAddress, data.nasPortId,
      data.calledStationId, data.callingStationId, data.framedIpAddress,
      data.acctStartTime, data.sessionId
    );
    return;
  }
  
  // Insert new session
  const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  
  try {
    db.prepare(`
      INSERT INTO radacct (
        acctsessionid, acctuniqueid, username, nasipaddress,
        nasportid, calledstationid, callingstationid, framedipaddress,
        acctstarttime, acctupdatetime, acctsessiontime,
        acctauthentic, acctinputoctets, acctoutputoctets,
        acctterminatecause, servicetype, createdAt, updatedAt
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), 0,
        'RADIUS', 0, 0, '', 'Framed-User', datetime('now'), datetime('now')
      )
    `).run(
      data.sessionId, uniqueId, data.username, data.nasIpAddress,
      data.nasPortId, data.calledStationId, data.callingStationId,
      data.framedIpAddress, data.acctStartTime
    );
    
    log("info", `Accounting START: user="${data.username}" session="${data.sessionId}" IP=${data.framedIpAddress}`);
    
    // Also create/update post-auth log
    upsertPostAuth(data.username, "Accept", data.nasIpAddress, data.callingStationId, "OK");

    // Also create PMS LiveSession record for GUI Active Users tab
    try {
      // Get WiFiUser and plan info for enrichment
      const wifiUser = db.query("SELECT id, planId, propertyId FROM WiFiUser WHERE username = ? LIMIT 1").get(data.username) as any;
      const liveId = `ls_${data.sessionId}`;
      
      // Get bandwidth from radreply for this user
      const bwDown = db.query("SELECT value FROM radreply WHERE username = ? AND attribute LIKE '%Bandwidth-Max-Down%'").get(data.username) as any;
      const bwUp = db.query("SELECT value FROM radreply WHERE username = ? AND attribute LIKE '%Bandwidth-Max-Up%'").get(data.username) as any;
      const sessionTimeout = db.query("SELECT value FROM radreply WHERE username = ? AND attribute = 'Session-Timeout'").get(data.username) as any;

      db.prepare(`
        INSERT OR REPLACE INTO LiveSession (
          id, tenantId, propertyId, acctSessionId, username, userId,
          planId, nasIpAddress, framedIpAddress, macAddress,
          bandwidthDown, bandwidthUp, sessionTimeout,
          currentInputBytes, currentOutputBytes, currentSessionTime,
          status, startedAt, updatedAt, lastInterimUpdate
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?, ?, ?)
      `).run(
        liveId,
        "tenant-1",
        wifiUser?.propertyId || "property-1",
        data.sessionId,
        data.username,
        wifiUser?.id || null,
        wifiUser?.planId || null,
        data.nasIpAddress,
        data.framedIpAddress,
        data.callingStationId || "",
        bwDown ? Math.round(parseInt(bwDown.value) / 1000000) : null,
        bwUp ? Math.round(parseInt(bwUp.value) / 1000000) : null,
        sessionTimeout ? parseInt(sessionTimeout.value) : null,
        "active",
        data.acctStartTime,
        data.acctStartTime,
        data.acctStartTime
      );
    } catch (e: any) {
      log("error", `Failed to insert LiveSession on START: ${e.message}`);
    }
    
  } catch (err: any) {
    log("error", `Failed to insert accounting start: ${err.message}`);
    
    // Fallback: try update if insert fails (race condition)
    db.prepare(`
      UPDATE radacct SET 
        username = ?, nasipaddress = ?, nasportid = ?, 
        calledstationid = ?, callingstationid = ?, framedipaddress = ?,
        acctstarttime = ?, acctupdatetime = datetime('now'), updatedAt = datetime('now')
      WHERE acctsessionid = ? AND acctstoptime IS NULL
    `).run(
      data.username, data.nasIpAddress, data.nasPortId,
      data.calledStationId, data.callingStationId, data.framedIpAddress,
      data.acctStartTime, data.sessionId
    );
  }
}

function handleAccountingInterim(data: {
  username: string; sessionId: string; nasIpAddress: string; nasIdentifier: string;
  nasPortId: string; acctSessionTime: number; inputOctets: number;
  outputOctets: number; inputPackets: number; outputPackets: number; updateTime: string;
}) {
  const session = db
    .query("SELECT acctuniqueid, acctstarttime FROM radacct WHERE acctsessionid = ? AND acctstoptime IS NULL")
    .get(data.sessionId) as any;
  
  if (!session) {
    log("warn", `Accounting Interim for unknown/stoppped session "${data.sessionId}" - inserting as new`);
    // Insert as a new start + interim combined
    handleAccountingStart({
      username: data.username, sessionId: data.sessionId,
      nasIpAddress: data.nasIpAddress, nasIdentifier: data.nasIdentifier,
      nasPortId: data.nasPortId, calledStationId: "", callingStationId: "",
      framedIpAddress: "", acctDelayTime: 0, acctStartTime: data.updateTime,
    });
    return;
  }
  
  db.prepare(`
    UPDATE radacct SET
      acctsessiontime = ?,
      acctinputoctets = ?,
      acctoutputoctets = ?,
      acctinputpackets = ?,
      acctoutputpackets = ?,
      acctupdatetime = datetime('now'),
      updatedAt = datetime('now')
    WHERE acctsessionid = ? AND acctstoptime IS NULL
  `).run(
    data.acctSessionTime, data.inputOctets, data.outputOctets,
    data.inputPackets, data.outputPackets,
    data.sessionId
  );
  
  log("debug", `Accounting INTERIM: user="${data.username}" session="${data.sessionId}" in=${formatBytes(data.inputOctets)} out=${formatBytes(data.outputOctets)} time=${data.acctSessionTime}s`);

  // Also update PMS LiveSession for GUI Active Users tab
  try {
    db.prepare(`
      UPDATE LiveSession SET
        currentInputBytes = ?,
        currentOutputBytes = ?,
        currentSessionTime = ?,
        status = 'active',
        lastInterimUpdate = datetime('now'),
        updatedAt = datetime('now')
      WHERE acctSessionId = ? AND status = 'active'
    `).run(data.inputOctets, data.outputOctets, data.acctSessionTime, data.sessionId);
  } catch (e: any) {
    log("error", `Failed to update LiveSession on INTERIM: ${e.message}`);
  }
}

function handleAccountingStop(data: {
  username: string; sessionId: string; nasIpAddress: string; nasIdentifier: string;
  nasPortId: string; acctSessionTime: number; inputOctets: number;
  outputOctets: number; inputPackets: number; outputPackets: number;
  terminateCause: number; updateTime: string; stopTime: string;
}) {
  const session = db
    .query("SELECT acctuniqueid FROM radacct WHERE acctsessionid = ? AND acctstoptime IS NULL")
    .get(data.sessionId) as any;
  
  if (!session) {
    log("warn", `Accounting STOP for unknown/stopped session "${data.sessionId}" - inserting as closed record`);
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    try {
      db.prepare(`
        INSERT INTO radacct (
          acctsessionid, acctuniqueid, username, nasipaddress,
          nasportid, framedipaddress, acctstarttime, acctstoptime,
          acctsessiontime, acctinputoctets, acctoutputoctets,
          acctinputpackets, acctoutputpackets, acctterminatecause,
          acctauthentic, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, 'RADIUS', datetime('now'), datetime('now'))
      `).run(
        data.sessionId, uniqueId, data.username, data.nasIpAddress,
        data.nasPortId,
        data.updateTime, data.stopTime,
        data.acctSessionTime, data.inputOctets, data.outputOctets,
        data.inputPackets, data.outputPackets, data.terminateCause
      );
    } catch (e: any) {
      log("error", `Failed to insert orphan stop record: ${e.message}`);
    }
    return;
  }
  
  db.prepare(`
    UPDATE radacct SET
      acctstoptime = ?,
      acctsessiontime = ?,
      acctinputoctets = ?,
      acctoutputoctets = ?,
      acctinputpackets = ?,
      acctoutputpackets = ?,
      acctterminatecause = ?,
      acctupdatetime = datetime('now'),
      updatedAt = datetime('now')
    WHERE acctsessionid = ? AND acctstoptime IS NULL
  `).run(
    data.stopTime,
    data.acctSessionTime, data.inputOctets, data.outputOctets,
    data.inputPackets, data.outputPackets, data.terminateCause,
    data.sessionId
  );
  
  log("info", `Accounting STOP: user="${data.username}" session="${data.sessionId}" cause=${data.terminateCause} total_in=${formatBytes(data.inputOctets)} total_out=${formatBytes(data.outputOctets)}`);

  // Also update PMS LiveSession for GUI (mark as ended)
  try {
    db.prepare(`
      UPDATE LiveSession SET
        currentInputBytes = ?,
        currentOutputBytes = ?,
        currentSessionTime = ?,
        status = 'ended',
        updatedAt = datetime('now')
      WHERE acctSessionId = ?
    `).run(data.inputOctets, data.outputOctets, data.acctSessionTime, data.sessionId);
  } catch (e: any) {
    log("error", `Failed to update LiveSession on STOP: ${e.message}`);
  }
}

// ── Post-Auth Logging ─────────────────────────────────────────
function upsertPostAuth(username: string, reply: string, nasIp: string, callingStationId: string, reason?: string, extra?: { nasIdentifier?: string; calledStationId?: string; clientIpAddress?: string }) {
  const now = new Date().toISOString();
  
  // 1. Write to raw FreeRADIUS table (radpostauth)
  try {
    db.prepare(`
      INSERT INTO radpostauth (username, pass, reply, authdate, nasipaddress, propertyId)
      VALUES (?, '', ?, ?, ?, 'property-1')
    `).run(username, reply, now, nasIp);
  } catch (e: any) {
    log("error", `Failed to insert radpostauth: ${e.message}`);
  }

  // 2. Also write to PMS application table (RadiusAuthLog) so GUI can display it
  try {
    db.prepare(`
      INSERT INTO RadiusAuthLog (id, propertyId, username, authResult, authType, nasIpAddress, nasIdentifier, callingStationId, calledStationId, clientIpAddress, replyMessage, timestamp)
      VALUES (?, 'property-1', ?, ?, 'RADIUS', ?, ?, ?, ?, ?, ?, ?)
    `).run(
      `ral_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      username, reply, nasIp,
      extra?.nasIdentifier || null,
      callingStationId,
      extra?.calledStationId || null,
      extra?.clientIpAddress || null,
      reason || reply, now
    );
  } catch (e: any) {
    log("error", `Failed to insert RadiusAuthLog: ${e.message}`);
  }
}

// ── Format Helpers ────────────────────────────────────────────
function formatBytes(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(2)} GB`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(2)} MB`;
  if (bytes >= 1_024) return `${(bytes / 1_024).toFixed(2)} KB`;
  return `${bytes} B`;
}

// ── NAS Secret Lookup ─────────────────────────────────────────
function getNasSecret(nasIp: string, nasIdentifier: string): string {
  // Check NAS table for configured secret
  const nas = db
    .query("SELECT secret FROM nas WHERE nasname = ? OR nasname = ? LIMIT 1")
    .get(nasIp, nasIdentifier) as { secret: string } | undefined;
  
  if (nas) return nas.secret;
  
  // Default to configured secret for testing
  return CONFIG.secret;
}

// ── UDP Server ────────────────────────────────────────────────
function startServer() {
  initDatabase();
  
  log("info", `Database: ${CONFIG.dbPath}`);
  log("info", `Default shared secret: "${CONFIG.secret}"`);
  
  // Bun UDP server for auth (port 1812) - uses data callback
  const authServer = Bun.udpSocket({
    hostname: "0.0.0.0",
    port: CONFIG.authPort,
    data(socket: any, buffer: Buffer, sourcePort: number, sourceAddress: string) {
      handleAuthPacket(buffer, { address: sourceAddress, port: sourcePort }, socket);
    },
    error(socket: any, error: Error) {
      log("error", `Auth socket error: ${error.message}`);
    },
  });
  
  // Bun UDP server for accounting (port 1813) - uses data callback
  const acctServer = Bun.udpSocket({
    hostname: "0.0.0.0",
    port: CONFIG.acctPort,
    data(socket: any, buffer: Buffer, sourcePort: number, sourceAddress: string) {
      handleAcctPacket(buffer, { address: sourceAddress, port: sourcePort }, socket);
    },
    error(socket: any, error: Error) {
      log("error", `Acct socket error: ${error.message}`);
    },
  });
  
  log("info", `RADIUS Auth server listening on 0.0.0.0:${CONFIG.authPort}`);
  log("info", `RADIUS Acct server listening on 0.0.0.0:${CONFIG.acctPort}`);
  log("info", "Ready to process RADIUS packets");
}

function handleAuthPacket(data: Buffer, rinfo: { address: string; port: number }, socket: any) {
  const sendData = (buf: Buffer) => {
    try { socket.send(buf, rinfo.port, rinfo.address); } catch(e: any) { log("error", `Send error: ${e.message}`); }
  };
  try {
    // First decode without secret to get NAS info
    const tempPacket = decodePacket(data);
    const nasIp = getAttributeString(tempPacket, AttributeType.NAS_IP_ADDRESS) || rinfo.address;
    const nasId = getAttributeString(tempPacket, AttributeType.NAS_IDENTIFIER);
    const secret = getNasSecret(nasIp, nasId);
    
    // Re-decode with correct secret to decrypt password
    const packet = decodePacket(data, secret);
    
    log("info", `${packetSummary(packet)} from ${rinfo.address}:${rinfo.port}`);
    
    // Authenticate
    const result = authenticateUser(packet);
    
    // Build response
    const response = createResponse(
      packet,
      result.accept ? PacketType.ACCESS_ACCEPT : PacketType.ACCESS_REJECT,
      result.replyAttrs,
      secret
    );
    
    // Log post-auth with full packet context
    upsertPostAuth(
      getAttributeString(packet, AttributeType.USER_NAME),
      result.accept ? "Accept" : "Reject",
      nasIp,
      getAttributeString(packet, AttributeType.CALLING_STATION_ID),
      result.reason,
      {
        nasIdentifier: getAttributeString(packet, AttributeType.NAS_IDENTIFIER) || undefined,
        calledStationId: getAttributeString(packet, AttributeType.CALLED_STATION_ID) || undefined,
      }
    );
    
    // Send response
    const responseBuf = encodePacket(response, secret);
    sendData(responseBuf);
    
    log("info", `→ Sent ${result.accept ? "Access-Accept" : "Access-Reject"} for user="${getAttributeString(packet, AttributeType.USER_NAME)}" (reason: ${result.reason})`);
    
  } catch (err: any) {
    log("error", `Auth packet error: ${err.message}`);
  }
}

function handleAcctPacket(data: Buffer, rinfo: { address: string; port: number }, socket: any) {
  const sendData = (buf: Buffer) => {
    try { socket.send(buf, rinfo.port, rinfo.address); } catch(e: any) { log("error", `Send error: ${e.message}`); }
  };
  try {
    const tempPacket = decodePacket(data);
    const nasIp = getAttributeString(tempPacket, AttributeType.NAS_IP_ADDRESS) || rinfo.address;
    const nasId = getAttributeString(tempPacket, AttributeType.NAS_IDENTIFIER);
    const secret = getNasSecret(nasIp, nasId);
    
    const packet = decodePacket(data, secret);
    
    log("info", `${packetSummary(packet)} from ${rinfo.address}:${rinfo.port}`);
    
    // Process accounting
    processAccounting(packet);
    
    // Always send Accounting-Response
    const response = createResponse(packet, PacketType.ACCOUNTING_RESPONSE, [], secret);
    const responseBuf = encodePacket(response, secret);
    sendData(responseBuf);
    
    log("debug", `→ Sent Accounting-Response`);
    
  } catch (err: any) {
    log("error", `Acct packet error: ${err.message}`);
  }
}

// ── HTTP API for Control & Testing ────────────────────────────
import { Hono } from "hono";

const app = new Hono();

app.get("/health", (c) => {
  return c.json({
    status: "running",
    authPort: CONFIG.authPort,
    acctPort: CONFIG.acctPort,
    db: CONFIG.dbPath,
    uptime: process.uptime(),
  });
});

app.get("/status", (c) => {
  const activeSessions = (db.query("SELECT COUNT(*) as cnt FROM radacct WHERE acctstoptime IS NULL").get() as any)?.cnt || 0;
  const totalSessions = (db.query("SELECT COUNT(*) as cnt FROM radacct").get() as any)?.cnt || 0;
  const totalAuth = (db.query("SELECT COUNT(*) as cnt FROM radpostauth").get() as any)?.cnt || 0;
  const acceptCount = (db.query("SELECT COUNT(*) as cnt FROM radpostauth WHERE reply = 'Accept'").get() as any)?.cnt || 0;
  const rejectCount = (db.query("SELECT COUNT(*) as cnt FROM radpostauth WHERE reply = 'Reject'").get() as any)?.cnt || 0;
  
  return c.json({
    running: true,
    ports: { auth: CONFIG.authPort, acct: CONFIG.acctPort },
    database: {
      activeSessions,
      totalSessions,
      totalAuth,
      acceptCount,
      rejectCount,
    },
    uptime: process.uptime(),
  });
});

// Simulate auth + accounting for testing
app.post("/api/simulate-auth", async (c) => {
  const body = await c.req.json();
  const { username, password, nasIp = "127.0.0.1", callingStationId = "", sessionId } = body;
  
  if (!username) return c.json({ error: "username required" }, 400);
  
  const secret = getNasSecret(nasIp, "");
  const sid = sessionId || `test-${Date.now()}`;
  
  // Simulate auth by checking database directly
  const checkItems = db.query("SELECT attribute, op, value FROM radcheck WHERE username = ?").all(username) as CheckItem[];
  
  if (checkItems.length === 0) {
    upsertPostAuth(username, "Reject", nasIp, callingStationId, "User not found");
    return c.json({ success: false, message: "User not found in radcheck" });
  }
  
  // Verify password
  let accepted = false;
  for (const item of checkItems) {
    if (item.attribute === "Cleartext-Password") {
      if (password && password === item.value) accepted = true;
    }
  }
  
  // MAC-only auth
  if (!accepted && !password && checkItems.some((c) => c.attribute === "Calling-Station-Id")) {
    accepted = true;
  }
  
  if (!accepted && !checkItems.some((c) => c.attribute.includes("Password"))) {
    accepted = true; // No password configured
  }
  
  if (accepted) {
    upsertPostAuth(username, "Accept", nasIp, callingStationId, "OK");
    
    // Create accounting start
    handleAccountingStart({
      username, sessionId: sid, nasIpAddress: nasIp, nasIdentifier: "",
      nasPortId: "0", calledStationId: "", callingStationId,
      framedIpAddress: `10.0.0.${Math.floor(Math.random() * 254) + 1}`,
      acctDelayTime: 0,
      acctStartTime: new Date().toISOString(),
    });
    
    return c.json({ success: true, message: "Access-Accept", sessionId: sid });
  } else {
    upsertPostAuth(username, "Reject", nasIp, callingStationId, "Invalid password");
    return c.json({ success: false, message: "Access-Reject (invalid password)" });
  }
});

// Simulate accounting update
app.post("/api/simulate-accounting", async (c) => {
  const body = await c.req.json();
  const { sessionId, inputOctets = 0, outputOctets = 0, sessionTime = 60, stop = false } = body;
  
  if (!sessionId) return c.json({ error: "sessionId required" }, 400);
  
  const session = db.query("SELECT username FROM radacct WHERE acctsessionid = ? AND acctstoptime IS NULL").get(sessionId) as any;
  if (!session) return c.json({ error: "No active session found" }, 404);
  
  const now = new Date().toISOString();
  
  if (stop) {
    handleAccountingStop({
      username: session.username, sessionId, nasIpAddress: "", nasIdentifier: "",
      nasPortId: "", acctSessionTime: sessionTime, inputOctets, outputOctets,
      inputPackets: Math.floor(inputOctets / 1500), outputPackets: Math.floor(outputOctets / 1500),
      terminateCause: 1, // User-Request
      updateTime: now, stopTime: now,
    });
    return c.json({ success: true, message: "Session stopped", username: session.username });
  } else {
    handleAccountingInterim({
      username: session.username, sessionId, nasIpAddress: "", nasIdentifier: "",
      nasPortId: "", acctSessionTime: sessionTime, inputOctets, outputOctets,
      inputPackets: Math.floor(inputOctets / 1500), outputPackets: Math.floor(outputOctets / 1500),
      updateTime: now,
    });
    return c.json({ success: true, message: "Interim update recorded", username: session.username });
  }
});

// ── Start ─────────────────────────────────────────────────────
const HTTP_PORT = 3012;

console.log("=".repeat(60));
console.log("  RADIUS Protocol Server v1.0 (Bun/TypeScript)");
console.log("  Authentication: RFC 2865 | Accounting: RFC 2866");
console.log("=".repeat(60));

startServer();

// Start HTTP API
Bun.serve({
  port: HTTP_PORT,
  fetch: app.fetch,
});
console.log(`[RADIUS INFO] HTTP API listening on 0.0.0.0:${HTTP_PORT}`);
console.log("[RADIUS INFO] All systems ready");
