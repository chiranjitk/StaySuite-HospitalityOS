/**
 * StaySuite HospitalityOS — Comprehensive Test Data Generator
 * ==========================================================
 * Generates realistic WiFi/RADIUS test data for development and testing.
 *
 * Uses bun:sqlite directly (NOT Prisma) for maximum speed.
 * Database: db/custom.db (same SQLite used by the PMS)
 *
 * Run:  bun run scripts/generate-test-data.ts
 *
 * Generated tables:
 *   1. WiFiUser          — 1,000 users
 *   2. radcheck          — ~1,000 rows (password per user)
 *   3. radreply          — ~4,000 rows (bandwidth attrs per user)
 *   4. radusergroup      — 1,000 rows
 *   5. radacct           — ~20,000 rows (sessions + interim-updates)
 *   6. RadiusAuthLog     — 5,000 rows
 *   7. RadiusCoaLog      — 200 rows
 *   8. RadiusProvisioningLog — 3,000 rows
 *   9. LiveSession       — 300 rows
 *  10. BandwidthUsageDaily — 365 rows per property
 */

import Database from "bun:sqlite";
import { randomUUID } from "crypto";
import { join } from "path";

// ─── Configuration ───────────────────────────────────────────────────────────

const DB_PATH = join(import.meta.dir.replace(/\/scripts$/, ""), "db", "custom.db");

const TOTAL_WIFI_USERS = 1000;
const TOTAL_AUTH_LOGS = 5000;
const TOTAL_COA_LOGS = 200;
const TOTAL_PROVISIONING_LOGS = 3000;
const TOTAL_LIVE_SESSIONS = 300;
const DAILY_AGGREGATE_DAYS = 365;

// User type distribution
const USER_TYPE_WEIGHTS = { guest: 0.85, staff: 0.10, event: 0.05 };
const STATUS_WEIGHTS = { active: 0.80, expired: 0.15, suspended: 0.05 };

// Session parameters
const SESSIONS_PER_USER_MIN = 1;
const SESSIONS_PER_USER_MAX = 30;
const ACTIVE_SESSION_RATIO = 0.30;
const INTERIM_UPDATES_MIN = 3;
const INTERIM_UPDATES_MAX = 10;

// NAS IPs
const NAS_IPS = ["192.168.1.1", "192.168.2.1", "10.0.0.1"];

// MAC OUI prefixes (realistic vendors)
const MAC_OUIS = [
  // Apple
  "A4:B1:C1", "A4:83:E7", "A4:5E:60", "3C:22:FB", "AC:87:A3",
  "DC:A6:32", "FC:E3:99", "68:A8:6D", "F0:18:98", "E0:AC:CB",
  // Samsung
  "F8:A9:D0", "EC:1F:72", "B4:52:0E", "D0:03:EB", "40:D3:5B",
  "AC:5F:3E", "B0:C5:CA", "DC:71:96", "A0:CB:FD", "00:1A:E8",
  // Huawei
  "70:A8:D3", "B0:F1:EC", "78:2B:CB", "20:82:C0", "DC:D9:4C",
  "E4:A7:49", "48:DB:50", "CC:96:A0", "F8:B1:56", "64:52:99",
  // Xiaomi
  "78:11:DC", "9C:B6:D0", "00:9E:C1", "8C:BE:BE", "AC:C1:EE",
  "F8:A4:5F", "28:CF:E9", "64:B4:73", "D8:BB:C1", "5C:CF:7F",
  // Others: OnePlus, Oppo, Vivo, Google
  "E4:93:97", "98:F5:A9", "C0:EE:FB", "A4:77:33", "D4:A3:3D",
];

// Connect-info strings (realistic AP speed reports)
const CONNECT_INFO_START = [
  "CONNECT 54 Mbps 802.11g",
  "CONNECT 72 Mbps 802.11n",
  "CONNECT 144 Mbps 802.11n",
  "CONNECT 300 Mbps 802.11ac",
  "CONNECT 433 Mbps 802.11ac",
  "CONNECT 867 Mbps 802.11ac",
  "CONNECT 1300 Mbps 802.11ac",
  "CONNECT 2402 Mbps 802.11ax",
  "CONNECT 4804 Mbps 802.11ax",
];

// Auth types for RadiusAuthLog
const AUTH_TYPES = ["PAP", "CHAP", "MS-CHAPv2", "EAP"];
const AUTH_TYPE_WEIGHTS = [0.40, 0.20, 0.25, 0.15];

// Terminate causes
const TERMINATE_CAUSES = [
  { value: "User-Request", weight: 0.60 },
  { value: "Idle-Timeout", weight: 0.20 },
  { value: "Admin-Reset", weight: 0.10 },
  { value: "Session-Timeout", weight: 0.10 },
];

// COA action types
const COA_ACTIONS = [
  { value: "disconnect", weight: 0.60 },
  { value: "bandwidth_change", weight: 0.30 },
  { value: "data_cap_disconnect", weight: 0.10 },
];

// COA results
const COA_RESULTS = [
  { value: "success", weight: 0.85 },
  { value: "failed", weight: 0.10 },
  { value: "timeout", weight: 0.05 },
];

// COA trigger sources
const COA_TRIGGERS = [
  { value: "manual", weight: 0.50 },
  { value: "auto", weight: 0.30 },
  { value: "data_cap", weight: 0.15 },
  { value: "checkout", weight: 0.05 },
];

// Provisioning actions
const PROVISION_ACTIONS = [
  { value: "provision", weight: 0.50 },
  { value: "deprovision", weight: 0.30 },
  { value: "suspend", weight: 0.10 },
  { value: "resume", weight: 0.05 },
  { value: "update", weight: 0.05 },
];

// Device types for LiveSession
const DEVICE_TYPES = [
  { value: "mobile", weight: 0.40 },
  { value: "laptop", weight: 0.30 },
  { value: "tablet", weight: 0.15 },
  { value: "other", weight: 0.15 },
];

// OS types for LiveSession
const OS_TYPES = ["iOS", "Android", "Windows", "macOS", "Linux"];
const OS_WEIGHTS = [0.35, 0.35, 0.15, 0.10, 0.05];

// Staff first names for staff_ usernames
const STAFF_NAMES = [
  "john", "maria", "raj", "chen", "anna", "mike", "priya", "david",
  "sarah", "ahmed", "lisa", "tom", "yuki", "carlos", "emma", "alex",
  "fatima", "peter", "mei", "james", "sofia", "andrew", "nina", "kevin",
  "aisha", "robert", "diya", "mark", "lena", "daniel",
];

// ─── Utility helpers ─────────────────────────────────────────────────────────

function weightedRandom<T extends { weight: number }>(items: T[]): T {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  let r = Math.random() * totalWeight;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randomDate(daysAgo: number): Date {
  const now = new Date();
  return new Date(now.getTime() - randomInt(0, daysAgo * 86400000));
}

function randomFutureDate(maxDays: number): Date {
  const now = new Date();
  return new Date(now.getTime() + randomInt(0, maxDays * 86400000));
}

function dateBetween(start: Date, end: Date): Date {
  const startTime = start.getTime();
  const endTime = end.getTime();
  return new Date(startTime + Math.random() * (endTime - startTime));
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60000);
}

function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000);
}

function formatSqliteDate(d: Date): string {
  return d.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "");
}

function generateMAC(): string {
  const oui = MAC_OUIS[randomInt(0, MAC_OUIS.length - 1)];
  const hex = () => randomInt(0, 255).toString(16).toUpperCase().padStart(2, "0");
  return `${oui}:${hex()}:${hex()}:${hex()}`;
}

function generateGuestIP(): string {
  return `10.10.${randomInt(0, 255)}.${randomInt(1, 254)}`;
}

function generatePassword(length = 8): string {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars[randomInt(0, chars.length - 1)];
  }
  return result;
}

function generateRoomNumber(): string {
  const floor = randomInt(1, 5);
  const room = randomInt(1, 99);
  return `${floor}${room.toString().padStart(2, "0")}`;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickWeighted(map: Record<string, number>): string {
  const entries = Object.entries(map).map(([value, weight]) => ({ value, weight }));
  return weightedRandom(entries).value;
}

function generateUUID(): string {
  // UUID-style string (no dashes for compact session IDs)
  const hex = () =>
    Math.floor(Math.random() * 0xffff)
      .toString(16)
      .padStart(4, "0");
  return `${hex()}${hex()}${hex()}${hex()}${hex()}${hex()}${hex()}${hex()}`;
}

// ─── Seeded pseudo-random for reproducibility (optional) ─────────────────────

// We use Math.random() for speed; the seed is informational only.
const SEED = Date.now();

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const totalStart = performance.now();
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║  StaySuite HospitalityOS — Test Data Generator               ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log(`  Database: ${DB_PATH}`);
  console.log(`  Seed:     ${SEED}`);
  console.log(`  Started:  ${new Date().toISOString()}`);
  console.log();

  // Open database
  const db = new Database(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA synchronous = NORMAL");
  db.exec("PRAGMA cache_size = -64000"); // 64 MB cache
  db.exec("PRAGMA temp_store = MEMORY");
  db.exec("PRAGMA mmap_size = 268435456"); // 256 MB mmap

  // ── Fetch existing reference data ───────────────────────────────────────

  const tenants = db
    .query("SELECT id FROM Tenant")
    .all() as { id: string }[];
  const properties = db
    .query("SELECT id, tenantId FROM Property")
    .all() as { id: string; tenantId: string }[];
  const wifiPlans = db
    .query("SELECT id, name, downloadSpeed, uploadSpeed FROM WiFiPlan")
    .all() as { id: string; name: string; downloadSpeed: number; uploadSpeed: number }[];

  if (tenants.length === 0 || properties.length === 0 || wifiPlans.length === 0) {
    console.error(
      "ERROR: Database must have at least one Tenant, Property, and WiFiPlan."
    );
    console.error(
      "Run `bun run prisma/db seed` or the application's seed script first."
    );
    db.close();
    process.exit(1);
  }

  const defaultTenantId = tenants[0].id;
  const defaultPropertyId = properties[0].id;
  const planIds = wifiPlans.map((p) => p.id);

  console.log(
    `  Reference data: ${tenants.length} tenants, ${properties.length} properties, ${wifiPlans.length} WiFi plans`
  );
  console.log();

  // ── Track statistics ────────────────────────────────────────────────────

  const stats: Record<string, { count: number; timeMs: number }> = {};

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 1: Generate 1,000 WiFi Users
  // ═══════════════════════════════════════════════════════════════════════

  console.log("━━━ Step 1: Generating WiFi Users ━━━");
  let stepStart = performance.now();

  // Clear existing WiFiUsers first (to allow re-running)
  db.exec("DELETE FROM WiFiUser");
  db.exec("DELETE FROM radcheck WHERE wifiUserId IS NOT NULL");
  db.exec("DELETE FROM radreply WHERE wifiUserId IS NOT NULL");
  db.exec("DELETE FROM radusergroup");
  db.exec("DELETE FROM radacct");
  db.exec("DELETE FROM RadiusAuthLog");
  db.exec("DELETE FROM RadiusCoaLog");
  db.exec("DELETE FROM RadiusProvisioningLog");
  db.exec("DELETE FROM LiveSession");
  db.exec("DELETE FROM BandwidthUsageDaily");

  const wifiUsers: {
    id: string;
    username: string;
    password: string;
    userType: string;
    status: string;
    roomNo: string;
    planId: string;
    validFrom: Date;
    validUntil: Date;
    propertyId: string;
  }[] = [];

  const now = new Date();
  const oneYearAgo = new Date(now.getTime() - 365 * 86400000);

  for (let i = 0; i < TOTAL_WIFI_USERS; i++) {
    const userType = pickWeighted(USER_TYPE_WEIGHTS);
    const status = pickWeighted(STATUS_WEIGHTS);
    const roomNo = generateRoomNumber();
    const rand = generateUUID().slice(0, 4).toLowerCase();
    const planId = pick(planIds);
    const propertyId = pick(properties).id;

    let username: string;
    switch (userType) {
      case "staff": {
        const name = pick(STAFF_NAMES);
        username = `staff_${name}_${rand}`;
        break;
      }
      case "event": {
        const eventId = randomInt(100, 999);
        username = `event_${eventId}_${rand}`;
        break;
      }
      default:
        username = `guest_${roomNo}_${rand}`;
    }

    const validFrom = dateBetween(oneYearAgo, now);
    let validUntil: Date;
    if (status === "expired") {
      // Expired: validUntil is in the past
      validUntil = addDays(validFrom, randomInt(1, 30));
      if (validUntil > now) validUntil = new Date(now.getTime() - randomInt(1, 30) * 86400000);
    } else {
      validUntil = randomFutureDate(90);
    }

    const password = generatePassword();

    wifiUsers.push({
      id: `wifuser-${i + 1}`,
      username,
      password,
      userType,
      status,
      roomNo,
      planId,
      validFrom,
      validUntil,
      propertyId,
    });
  }

  // Insert WiFiUsers in transaction
  db.exec("BEGIN TRANSACTION");
  const insertWiFiUser = db.prepare(`
    INSERT INTO WiFiUser (id, tenantId, propertyId, username, password, userType, planId, validFrom, validUntil, maxSessions, sessionCount, totalBytesIn, totalBytesOut, status, radiusSynced, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, 0, 0, ?, 1, datetime('now'), datetime('now'))
  `);

  for (const user of wifiUsers) {
    insertWiFiUser.run(
      user.id,
      defaultTenantId,
      user.propertyId,
      user.username,
      user.password,
      user.userType,
      user.planId,
      formatSqliteDate(user.validFrom),
      formatSqliteDate(user.validUntil),
      user.status
    );
  }
  db.exec("COMMIT");

  stats["WiFiUser"] = {
    count: TOTAL_WIFI_USERS,
    timeMs: performance.now() - stepStart,
  };
  console.log(`  ✓ Inserted ${TOTAL_WIFI_USERS} WiFiUser rows`);

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 2: Generate RADIUS Credentials (radcheck, radreply, radusergroup)
  // ═══════════════════════════════════════════════════════════════════════

  console.log("━━━ Step 2: Generating RADIUS Credentials ━━━");
  stepStart = performance.now();

  db.exec("BEGIN TRANSACTION");

  const insertRadCheck = db.prepare(`
    INSERT INTO radcheck (wifiUserId, username, attribute, op, value, isActive, createdAt, updatedAt)
    VALUES (?, ?, 'Cleartext-Password', '==', ?, 1, datetime('now'), datetime('now'))
  `);

  const insertRadReply = db.prepare(`
    INSERT INTO radreply (wifiUserId, username, attribute, op, value, isActive, createdAt, updatedAt)
    VALUES (?, ?, ?, '=', ?, 1, datetime('now'), datetime('now'))
  `);

  const insertRadUserGroup = db.prepare(`
    INSERT INTO radusergroup (username, groupname, priority, createdAt)
    VALUES (?, ?, 1, datetime('now'))
  `);

  let radCheckCount = 0;
  let radReplyCount = 0;
  let radUserGroupCount = 0;

  for (const user of wifiUsers) {
    const plan = wifiPlans.find((p) => p.id === user.planId) || wifiPlans[0];
    const groupName =
      user.userType === "staff" ? "staff-users" : "guest-users";

    // radcheck: Cleartext-Password
    insertRadCheck.run(user.id, user.username, user.password);
    radCheckCount++;

    // radreply: bandwidth attributes
    const replyAttrs = [
      {
        attribute: "WISPr-Bandwidth-Max-Down",
        value: String(plan.downloadSpeed * 1024 * 1024), // bps
      },
      {
        attribute: "WISPr-Bandwidth-Max-Up",
        value: String(plan.uploadSpeed * 1024 * 1024),
      },
      {
        attribute: "Mikrotik-Rate-Limit",
        value: `${plan.uploadSpeed}M/${plan.downloadSpeed}M`,
      },
      {
        attribute: "Session-Timeout",
        value: String(randomInt(3600, 86400)),
      },
    ];

    for (const attr of replyAttrs) {
      insertRadReply.run(
        user.id,
        user.username,
        attr.attribute,
        attr.value
      );
      radReplyCount++;
    }

    // radusergroup
    insertRadUserGroup.run(user.username, groupName);
    radUserGroupCount++;
  }

  db.exec("COMMIT");

  stats["radcheck"] = {
    count: radCheckCount,
    timeMs: performance.now() - stepStart,
  };
  stats["radreply"] = {
    count: radReplyCount,
    timeMs: performance.now() - stepStart,
  };
  stats["radusergroup"] = {
    count: radUserGroupCount,
    timeMs: performance.now() - stepStart,
  };
  console.log(
    `  ✓ Inserted ${radCheckCount} radcheck, ${radReplyCount} radreply, ${radUserGroupCount} radusergroup rows`
  );

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 3: Generate RADIUS Accounting Data (radacct)
  // ═══════════════════════════════════════════════════════════════════════

  console.log("━━━ Step 3: Generating RADIUS Accounting Data ━━━");
  stepStart = performance.now();

  db.exec("BEGIN TRANSACTION");

  const insertRadAcct = db.prepare(`
    INSERT INTO radacct (
      acctsessionid, acctuniqueid, username, realm, nasipaddress, nasportid,
      nasporttype, acctstarttime, acctupdatetime, acctstoptime, acctinterval,
      acctsessiontime, acctauthentic, connectinfo_start, connectinfo_stop,
      acctinputoctets, acctoutputoctets, calledstationid, callingstationid,
      acctterminatecause, servicetype, framedprotocol, framedipaddress,
      framedipv6address, framedipv6prefix, framedinterfaceid, delegatedipv6prefix,
      "class", acctinputpackets, acctoutputpackets, acctstatus, createdAt, updatedAt
    ) VALUES (
      ?, ?, ?, '', ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?, ?,
      '', '', '', '',
      ?, 0, 0, ?, datetime('now'), datetime('now')
    )
  `);

  let totalRadAcctRows = 0;
  let activeSessionCount = 0;
  let endedSessionCount = 0;
  let totalDownloadBytes = 0;
  let totalUploadBytes = 0;
  let peakUsageDay = "";
  let peakUsageBytes = 0;
  const dailyUsageMap: Record<string, { download: number; upload: number }> = {};

  for (const user of wifiUsers) {
    const numSessions = randomInt(SESSIONS_PER_USER_MIN, SESSIONS_PER_USER_MAX);

    for (let s = 0; s < numSessions; s++) {
      const isActive = Math.random() < ACTIVE_SESSION_RATIO;
      const mac = generateMAC();
      const ip = generateGuestIP();
      const nasIp = pick(NAS_IPS);
      const nasPortType = Math.random() < 0.9 ? "Wireless-802.11" : "Ethernet";
      const acctAuthentic = Math.random() < 0.7 ? "RADIUS" : "PAP";
      const connectInfo = pick(CONNECT_INFO_START);
      const calledStationId = `AP-Floor${randomInt(1, 5)}`;

      // Session start time: random within last 365 days
      const sessionStart = dateBetween(oneYearAgo, now);
      const acctSessionId = `acct_${generateUUID().slice(0, 12)}`;

      let acctStopTime: string | null = null;
      let acctSessionTime: number | null = null;
      let acctUpdateTime: string | null = null;
      let acctTerminateCause = "";
      let acctStatus = "start";
      let inputOctets = 0;
      let outputOctets = 0;

      if (isActive) {
        // Active session: stop time is null
        acctStatus = Math.random() < 0.5 ? "interim-update" : "start";
        acctUpdateTime = formatSqliteDate(
          addMinutes(sessionStart, randomInt(1, 300))
        );
        acctSessionTime = randomInt(60, 7200); // 1min to 2hrs so far
        inputOctets = randomInt(10 * 1024 * 1024, 500 * 1024 * 1024); // 10MB-500MB
        outputOctets = randomInt(1 * 1024 * 1024, 50 * 1024 * 1024); // 1MB-50MB
        activeSessionCount++;
      } else {
        // Ended session
        const durationMinutes = randomInt(5, 480); // 5min to 8hrs
        const sessionEnd = addMinutes(sessionStart, durationMinutes);
        acctStopTime = formatSqliteDate(sessionEnd);
        acctUpdateTime = formatSqliteDate(sessionEnd);
        acctSessionTime = durationMinutes * 60;
        acctTerminateCause = weightedRandom(TERMINATE_CAUSES).value;
        acctStatus = "stop";

        // Realistic bandwidth: download 10MB-2GB, upload 1MB-500MB
        inputOctets = randomInt(10 * 1024 * 1024, 2 * 1024 * 1024 * 1024);
        outputOctets = randomInt(1 * 1024 * 1024, 500 * 1024 * 1024);
        endedSessionCount++;

        totalDownloadBytes += inputOctets;
        totalUploadBytes += outputOctets;

        // Track daily usage
        const dayKey = sessionStart.toISOString().slice(0, 10);
        if (!dailyUsageMap[dayKey]) {
          dailyUsageMap[dayKey] = { download: 0, upload: 0 };
        }
        dailyUsageMap[dayKey].download += inputOctets;
        dailyUsageMap[dayKey].upload += outputOctets;
      }

      const acctUniqueId = `unique_${generateUUID()}`;

      insertRadAcct.run(
        acctSessionId,
        acctUniqueId,
        user.username,
        nasIp,
        String(randomInt(0, 65535)),
        nasPortType,
        formatSqliteDate(sessionStart),
        acctUpdateTime,
        acctStopTime,
        null,
        acctSessionTime,
        acctAuthentic,
        connectInfo,
        isActive ? null : connectInfo,
        inputOctets,
        outputOctets,
        calledStationId,
        mac,
        acctTerminateCause,
        "Framed-User",
        "PPP",
        ip,
        null,
        acctStatus
      );
      totalRadAcctRows++;
    }
  }

  db.exec("COMMIT");

  // Find peak usage day
  for (const [day, usage] of Object.entries(dailyUsageMap)) {
    const total = usage.download + usage.upload;
    if (total > peakUsageBytes) {
      peakUsageBytes = total;
      peakUsageDay = day;
    }
  }

  stats["radacct"] = {
    count: totalRadAcctRows,
    timeMs: performance.now() - stepStart,
  };
  console.log(
    `  ✓ Inserted ${totalRadAcctRows} radacct rows (${activeSessionCount} active, ${endedSessionCount} ended)`
  );

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 4: Generate Interim-Update Records for Active Sessions
  // ═══════════════════════════════════════════════════════════════════════

  console.log("━━━ Step 4: Generating Interim-Update Records ━━━");
  stepStart = performance.now();

  db.exec("BEGIN TRANSACTION");

  // Get active sessions from the radacct table we just inserted
  const activeSessions = db
    .query(
      `SELECT acctsessionid, username, nasipaddress, callingstationid, framedipaddress,
              acctstarttime, acctinputoctets, acctoutputoctets
       FROM radacct WHERE acctstoptime IS NULL AND acctstatus != 'stop'`
    )
    .all() as {
    acctsessionid: string;
    username: string;
    nasipaddress: string;
    callingstationid: string;
    framedipaddress: string;
    acctstarttime: string;
    acctinputoctets: number;
    acctoutputoctets: number;
  }[];

  let interimCount = 0;

  for (const session of activeSessions) {
    const startTime = new Date(session.acctstarttime);
    const numInterims = randomInt(INTERIM_UPDATES_MIN, INTERIM_UPDATES_MAX);
    const maxSessionSeconds = randomInt(300, 7200); // 5min to 2hrs total session length
    const intervalSeconds = Math.max(
      30,
      Math.floor(maxSessionSeconds / (numInterims + 1))
    );

    let cumulInput = session.acctinputoctets || 0;
    let cumulOutput = session.acctoutputoctets || 0;

    for (let i = 0; i < numInterims; i++) {
      const elapsed = intervalSeconds * (i + 1);
      const updateTime = addSeconds(startTime, elapsed);

      if (updateTime > now) break; // Don't create future records

      // Increment octets incrementally
      const deltaInput = randomInt(1 * 1024 * 1024, 50 * 1024 * 1024);
      const deltaOutput = randomInt(100 * 1024, 5 * 1024 * 1024);
      cumulInput += deltaInput;
      cumulOutput += deltaOutput;

      const interimUniqueId = `unique_interim_${generateUUID()}`;

      insertRadAcct.run(
        session.acctsessionid,
        interimUniqueId,
        session.username,
        session.nasipaddress,
        String(randomInt(0, 65535)),
        "Wireless-802.11",
        formatSqliteDate(startTime),
        formatSqliteDate(updateTime),
        null,
        intervalSeconds,
        elapsed,
        "RADIUS",
        pick(CONNECT_INFO_START),
        null,
        cumulInput,
        cumulOutput,
        `AP-Floor${randomInt(1, 5)}`,
        session.callingstationid,
        "",
        "Framed-User",
        "PPP",
        session.framedipaddress,
        null,
        "interim-update"
      );
      interimCount++;
    }
  }

  db.exec("COMMIT");

  stats["radacct_interim"] = {
    count: interimCount,
    timeMs: performance.now() - stepStart,
  };
  console.log(`  ✓ Inserted ${interimCount} interim-update records`);

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 5: Generate RadiusAuthLog Entries
  // ═══════════════════════════════════════════════════════════════════════

  console.log("━━━ Step 5: Generating RadiusAuthLog Entries ━━━");
  stepStart = performance.now();

  db.exec("BEGIN TRANSACTION");

  const insertAuthLog = db.prepare(`
    INSERT INTO RadiusAuthLog (id, propertyId, username, authResult, authType, nasIpAddress, nasIdentifier, callingStationId, calledStationId, clientIpAddress, replyMessage, terminateReason, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let authLogAccept = 0;
  let authLogReject = 0;

  for (let i = 0; i < TOTAL_AUTH_LOGS; i++) {
    const isAccept = Math.random() < 0.80;
    const user = pick(wifiUsers);
    const timestamp = dateBetween(oneYearAgo, now);

    // Pick auth type based on weights
    let cumulativeWeight = 0;
    let authType = AUTH_TYPES[0];
    for (let j = 0; j < AUTH_TYPES.length; j++) {
      cumulativeWeight += AUTH_TYPE_WEIGHTS[j];
      if (Math.random() * 1.0 <= cumulativeWeight) {
        authType = AUTH_TYPES[j];
        break;
      }
    }

    const nasIp = pick(NAS_IPS);
    const mac = generateMAC();

    insertAuthLog.run(
      `authlog-${i + 1}`,
      pick(properties).id,
      user.username,
      isAccept ? "Access-Accept" : "Access-Reject",
      authType,
      nasIp,
      `nas-${nasIp.replace(/\./g, "-")}`,
      mac,
      `AP-Floor${randomInt(1, 5)}`,
      `10.10.${randomInt(0, 255)}.${randomInt(1, 254)}`,
      isAccept ? null : pick(["Invalid password", "User not found", "Account expired", "Too many sessions"]),
      isAccept ? null : pick(["bad_password", "not_found", "expired", "max_sessions"]),
      formatSqliteDate(timestamp)
    );

    if (isAccept) authLogAccept++;
    else authLogReject++;
  }

  db.exec("COMMIT");

  stats["RadiusAuthLog"] = {
    count: TOTAL_AUTH_LOGS,
    timeMs: performance.now() - stepStart,
  };
  console.log(
    `  ✓ Inserted ${TOTAL_AUTH_LOGS} auth logs (${authLogAccept} Accept, ${authLogReject} Reject)`
  );

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 6: Generate RadiusCoaLog Entries
  // ═══════════════════════════════════════════════════════════════════════

  console.log("━━━ Step 6: Generating RadiusCoaLog Entries ━━━");
  stepStart = performance.now();

  db.exec("BEGIN TRANSACTION");

  const insertCoaLog = db.prepare(`
    INSERT INTO RadiusCoaLog (id, propertyId, action, username, sessionId, nasIpAddress, sharedSecret, attributes, result, responseCode, errorMessage, triggeredBy, triggeredById, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (let i = 0; i < TOTAL_COA_LOGS; i++) {
    const user = pick(wifiUsers);
    const action = weightedRandom(COA_ACTIONS).value;
    const result = weightedRandom(COA_RESULTS).value;
    const triggeredBy = weightedRandom(COA_TRIGGERS).value;
    const timestamp = dateBetween(oneYearAgo, now);

    let attributes: string;
    let errorMessage: string | null = null;
    let responseCode: string;

    switch (action) {
      case "disconnect":
        attributes = JSON.stringify({ "User-Name": user.username, "Termination-Action": "RADIUS-Request" });
        responseCode = result === "success" ? "Disconnect-ACK" : "Disconnect-NAK";
        if (result === "failed") errorMessage = "Session not found on NAS";
        if (result === "timeout") errorMessage = "No response from NAS within 5s";
        break;
      case "bandwidth_change":
        attributes = JSON.stringify({
          "User-Name": user.username,
          "Mikrotik-Rate-Limit": `${randomInt(1, 10)}M/${randomInt(5, 50)}M`,
        });
        responseCode = result === "success" ? "CoA-ACK" : "CoA-NAK";
        if (result === "failed") errorMessage = "Unsupported attribute";
        if (result === "timeout") errorMessage = "CoA request timed out";
        break;
      case "data_cap_disconnect":
        attributes = JSON.stringify({
          "User-Name": user.username,
          "Termination-Action": "RADIUS-Request",
          "Reply-Message": "Data cap exceeded",
        });
        responseCode = result === "success" ? "Disconnect-ACK" : "Disconnect-NAK";
        if (result === "failed") errorMessage = "Session already terminated";
        if (result === "timeout") errorMessage = "No response from NAS";
        break;
      default:
        attributes = "{}";
        responseCode = result === "success" ? "CoA-ACK" : "CoA-NAK";
    }

    insertCoaLog.run(
      `coalog-${i + 1}`,
      pick(properties).id,
      action,
      user.username,
      `acct_${generateUUID().slice(0, 12)}`,
      pick(NAS_IPS),
      "sharedsecret123",
      attributes,
      result,
      responseCode,
      errorMessage,
      triggeredBy,
      triggeredBy === "manual" ? "staff-001" : null,
      formatSqliteDate(timestamp)
    );
  }

  db.exec("COMMIT");

  stats["RadiusCoaLog"] = {
    count: TOTAL_COA_LOGS,
    timeMs: performance.now() - stepStart,
  };
  console.log(`  ✓ Inserted ${TOTAL_COA_LOGS} CoA log entries`);

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 7: Generate RadiusProvisioningLog Entries
  // ═══════════════════════════════════════════════════════════════════════

  console.log("━━━ Step 7: Generating RadiusProvisioningLog Entries ━━━");
  stepStart = performance.now();

  db.exec("BEGIN TRANSACTION");

  const insertProvLog = db.prepare(`
    INSERT INTO RadiusProvisioningLog (id, propertyId, action, username, guestId, bookingId, userId, result, details, error, durationMs, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (let i = 0; i < TOTAL_PROVISIONING_LOGS; i++) {
    const user = pick(wifiUsers);
    const action = weightedRandom(PROVISION_ACTIONS).value;
    const timestamp = dateBetween(oneYearAgo, now);
    const resultRoll = Math.random();

    let result: string;
    let error: string | null = null;

    if (resultRoll < 0.90) {
      result = "success";
    } else if (resultRoll < 0.97) {
      result = "failed";
      error = pick([
        "RADIUS server unreachable",
        "User already exists",
        "Invalid attribute value",
        "Database constraint violation",
        "Timeout waiting for NAS response",
      ]);
    } else {
      result = "skipped";
    }

    const details = JSON.stringify({
      planId: user.planId,
      roomNo: user.roomNo,
      userType: user.userType,
      syncMethod: "direct",
    });

    insertProvLog.run(
      `provlog-${i + 1}`,
      pick(properties).id,
      action,
      user.username,
      null,
      null,
      action === "provision" || action === "deprovision" ? "staff-001" : null,
      result,
      details,
      error,
      randomInt(10, 2000),
      formatSqliteDate(timestamp)
    );
  }

  db.exec("COMMIT");

  stats["RadiusProvisioningLog"] = {
    count: TOTAL_PROVISIONING_LOGS,
    timeMs: performance.now() - stepStart,
  };
  console.log(`  ✓ Inserted ${TOTAL_PROVISIONING_LOGS} provisioning log entries`);

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 8: Generate LiveSession Entries
  // ═══════════════════════════════════════════════════════════════════════

  console.log("━━━ Step 8: Generating LiveSession Entries ━━━");
  stepStart = performance.now();

  db.exec("BEGIN TRANSACTION");

  const insertLiveSession = db.prepare(`
    INSERT INTO LiveSession (
      id, tenantId, propertyId, acctSessionId, username, userId, planId,
      nasIpAddress, nasIdentifier, nasPortType, framedIpAddress, macAddress,
      clientIpAddress, deviceType, operatingSystem, manufacturer,
      bandwidthPolicyId, bandwidthDown, bandwidthUp, maxInputOctets, maxOutputOctets,
      maxTotalOctets, sessionTimeout, idleTimeout, lastInterimUpdate,
      currentInputBytes, currentOutputBytes, currentSessionTime,
      status, roomNo, hotelId, urlFilterPolicy, authMethod, startedAt, updatedAt
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?,
      'active', ?, ?, ?, ?, ?, ?
    )
  `);

  // Shuffle and pick unique users for live sessions (username has UNIQUE constraint)
  const shuffledUsers = [...wifiUsers].sort(() => Math.random() - 0.5);
  const liveUsers = shuffledUsers.slice(0, TOTAL_LIVE_SESSIONS);

  for (let i = 0; i < TOTAL_LIVE_SESSIONS; i++) {
    const user = liveUsers[i];
    const plan = wifiPlans.find((p) => p.id === user.planId) || wifiPlans[0];
    const mac = generateMAC();
    const ip = generateGuestIP();
    const deviceType = weightedRandom(DEVICE_TYPES).value;

    // Pick OS based on weights
    let osRandom = Math.random();
    let operatingSystem = "Android";
    let cumulative = 0;
    for (let j = 0; j < OS_TYPES.length; j++) {
      cumulative += OS_WEIGHTS[j];
      if (osRandom <= cumulative) {
        operatingSystem = OS_TYPES[j];
        break;
      }
    }

    // Manufacturer based on MAC OUI
    const macPrefix = mac.slice(0, 8);
    let manufacturer = "Unknown";
    if (
      ["A4:B1:C1", "A4:83:E7", "A4:5E:60", "3C:22:FB", "AC:87:A3", "DC:A6:32", "FC:E3:99", "68:A8:6D", "F0:18:98"].includes(macPrefix)
    ) {
      manufacturer = "Apple";
    } else if (
      ["F8:A9:D0", "EC:1F:72", "B4:52:0E", "D0:03:EB", "40:D3:5B", "AC:5F:3E", "B0:C5:CA", "DC:71:96", "A0:CB:FD", "00:1A:E8"].includes(macPrefix)
    ) {
      manufacturer = "Samsung";
    } else if (
      ["70:A8:D3", "B0:F1:EC", "78:2B:CB", "20:82:C0", "DC:D9:4C", "E4:A7:49", "48:DB:50", "CC:96:A0", "F8:B1:56", "64:52:99"].includes(macPrefix)
    ) {
      manufacturer = "Huawei";
    } else if (
      ["78:11:DC", "9C:B6:D0", "00:9E:C1", "8C:BE:BE", "AC:C1:EE", "F8:A4:5F", "28:CF:E9", "64:B4:73", "D8:BB:C1", "5C:CF:7F"].includes(macPrefix)
    ) {
      manufacturer = "Xiaomi";
    }

    const sessionStart = addMinutes(now, -randomInt(5, 1440)); // Started 5min to 24hrs ago
    const currentSessionTime = Math.floor(
      (now.getTime() - sessionStart.getTime()) / 1000
    );
    const currentInputBytes = randomInt(10 * 1024 * 1024, 2 * 1024 * 1024 * 1024);
    const currentOutputBytes = randomInt(1 * 1024 * 1024, 200 * 1024 * 1024);

    insertLiveSession.run(
      `livesession-${i + 1}`,
      defaultTenantId,
      user.propertyId,
      `live_acct_${generateUUID().slice(0, 12)}`,
      user.username,
      null,
      user.planId,
      pick(NAS_IPS),
      `nas-${pick(NAS_IPS).replace(/\./g, "-")}`,
      Math.random() < 0.9 ? "Wireless-802.11" : "Ethernet",
      ip,
      mac,
      `10.10.${randomInt(0, 255)}.${randomInt(1, 254)}`,
      deviceType,
      operatingSystem,
      manufacturer,
      null,
      plan.downloadSpeed * 1024, // convert Mbps to Kbps
      plan.uploadSpeed * 1024,
      plan.dataLimit ? plan.dataLimit * 1024 * 1024 : 0, // MB to bytes
      plan.dataLimit ? Math.floor(plan.dataLimit * 0.7 * 1024 * 1024) : 0,
      plan.dataLimit ? plan.dataLimit * 1024 * 1024 : 0,
      randomInt(3600, 86400),
      randomInt(300, 1800),
      formatSqliteDate(addMinutes(now, -randomInt(0, 5))),
      currentInputBytes,
      currentOutputBytes,
      currentSessionTime,
      user.roomNo,
      null,
      null,
      pick(["PAP", "CHAP", "MS-CHAPv2", "EAP"]),
      formatSqliteDate(sessionStart),
      formatSqliteDate(now)
    );
  }

  db.exec("COMMIT");

  stats["LiveSession"] = {
    count: TOTAL_LIVE_SESSIONS,
    timeMs: performance.now() - stepStart,
  };
  console.log(`  ✓ Inserted ${TOTAL_LIVE_SESSIONS} live session entries`);

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 9: Generate BandwidthUsageDaily Aggregates
  // ═══════════════════════════════════════════════════════════════════════

  console.log("━━━ Step 9: Generating BandwidthUsageDaily Aggregates ━━━");
  stepStart = performance.now();

  db.exec("BEGIN TRANSACTION");

  const insertBandwidthDaily = db.prepare(`
    INSERT OR REPLACE INTO BandwidthUsageDaily (id, tenantId, propertyId, date, totalDownloadMb, totalUploadMb, uniqueUsers, peakUsers, peakTime, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `);

  let dailyCount = 0;

  for (const property of properties) {
    for (let d = DAILY_AGGREGATE_DAYS - 1; d >= 0; d--) {
      const date = new Date(now.getTime() - d * 86400000);
      const dayOfWeek = date.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      // Realistic usage patterns:
      // - Higher on weekends (hotel occupancy higher)
      // - Higher in recent months (growing property)
      // - Summer peaks (travel season)
      const month = date.getMonth();
      const isSummer = month >= 5 && month <= 8; // Jun-Sep
      const isHolidaySeason = month === 11 || month === 0; // Dec, Jan

      const baseMultiplier = isWeekend ? 1.3 : 1.0;
      const seasonMultiplier = isSummer ? 1.4 : isHolidaySeason ? 1.2 : 1.0;
      const recencyMultiplier = 0.7 + (d < 90 ? 0.3 * (1 - d / 90) : 0); // more recent = more usage

      const totalMultiplier = baseMultiplier * seasonMultiplier * recencyMultiplier;

      // Base: 50-200 users per day, 5-50 GB download, 1-10 GB upload
      const uniqueUsers = Math.floor(randomInt(50, 200) * totalMultiplier);
      const peakUsers = Math.floor(uniqueUsers * randomFloat(0.5, 0.8));
      const totalDownloadMb = Math.floor(
        randomFloat(5000, 50000) * totalMultiplier
      );
      const totalUploadMb = Math.floor(
        randomFloat(1000, 10000) * totalMultiplier
      );

      // Peak time: typically evening hours (18:00-22:00)
      const peakHour = randomInt(18, 22);
      const peakMinute = randomInt(0, 59);
      const peakTime = `${peakHour.toString().padStart(2, "0")}:${peakMinute.toString().padStart(2, "0")}`;

      const dateStr = date.toISOString().slice(0, 10);

      insertBandwidthDaily.run(
        `bw-daily-${property.id}-${dateStr}`,
        defaultTenantId,
        property.id,
        `${dateStr} 00:00:00`,
        totalDownloadMb,
        totalUploadMb,
        uniqueUsers,
        peakUsers,
        peakTime
      );
      dailyCount++;
    }
  }

  db.exec("COMMIT");

  stats["BandwidthUsageDaily"] = {
    count: dailyCount,
    timeMs: performance.now() - stepStart,
  };
  console.log(
    `  ✓ Inserted ${dailyCount} daily bandwidth aggregates (${DAILY_AGGREGATE_DAYS} days × ${properties.length} properties)`
  );

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 10: Create Compound Indexes on radacct
  // ═══════════════════════════════════════════════════════════════════════

  console.log("━━━ Step 10: Creating Indexes ━━━");
  stepStart = performance.now();

  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_radacct_composite ON radacct(username, acctstarttime, acctstatus)`
  );
  db.exec(
    `CREATE INDEX IF NOT EXISTS idx_radacct_property ON radacct(nasipaddress, acctstarttime)`
  );

  console.log("  ✓ Created composite indexes on radacct");

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 11: Vacuum & Analyze for optimal query planning
  // ═══════════════════════════════════════════════════════════════════════

  console.log("━━━ Step 11: Vacuum & Analyze ━━━");
  stepStart = performance.now();
  db.exec("ANALYZE");
  console.log("  ✓ Analyzed database (skipping VACUUM in WAL mode)");

  // ═══════════════════════════════════════════════════════════════════════
  // FINAL SUMMARY
  // ═══════════════════════════════════════════════════════════════════════

  const totalTime = performance.now() - totalStart;

  // Fetch actual counts from database for verification
  const actualCounts: Record<string, number> = {};
  const tableNames = [
    "WiFiUser",
    "radcheck",
    "radreply",
    "radusergroup",
    "radacct",
    "RadiusAuthLog",
    "RadiusCoaLog",
    "RadiusProvisioningLog",
    "LiveSession",
    "BandwidthUsageDaily",
  ];

  for (const tableName of tableNames) {
    try {
      const row = db.query(`SELECT COUNT(*) as c FROM "${tableName}"`).get() as {
        c: number;
      };
      actualCounts[tableName] = row.c;
    } catch {
      actualCounts[tableName] = -1;
    }
  }

  // Calculate totals
  const totalRadacct = actualCounts["radacct"] || 0;
  const totalInputBytes = (
    db.query("SELECT COALESCE(SUM(acctinputoctets), 0) as total FROM radacct").get() as { total: number }
  ).total;
  const totalOutputBytes = (
    db.query("SELECT COALESCE(SUM(acctoutputoctets), 0) as total FROM radacct").get() as { total: number }
  ).total;

  // Date range
  const dateRange = db
    .query(
      `SELECT MIN(acctstarttime) as minDate, MAX(acctstarttime) as maxDate FROM radacct`
    )
    .get() as { minDate: string; maxDate: string };

  // Active vs ended sessions
  const sessionStats = db
    .query(
      `SELECT
         COUNT(*) as total,
         SUM(CASE WHEN acctstoptime IS NULL THEN 1 ELSE 0 END) as active,
         SUM(CASE WHEN acctstoptime IS NOT NULL THEN 1 ELSE 0 END) as ended
       FROM radacct
       WHERE acctstatus IN ('start', 'stop')`
    )
    .get() as { total: number; active: number; ended: number };

  // Close database
  db.close();

  // Print summary
  console.log();
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║  TEST DATA GENERATION COMPLETE                              ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  console.log();
  console.log("  ┌─ Row Counts ──────────────────────────────────────────────┐");
  console.log("  │ Table                    │ Generated   │ Actual (DB)      │");
  console.log("  ├──────────────────────────┼─────────────┼──────────────────┤");
  for (const tableName of tableNames) {
    const genCount =
      stats[tableName]?.count ?? stats[`${tableName}_interim`]?.count ?? "—";
    const actCount = actualCounts[tableName] ?? "—";
    const name = tableName.padEnd(24);
    const gen = String(genCount).padStart(11);
    const act = String(actCount).padStart(16);
    console.log(`  │ ${name} │ ${gen} │ ${act} │`);
  }
  console.log("  └──────────────────────────┴─────────────┴──────────────────┘");
  console.log();

  console.log("  ┌─ Session Statistics ──────────────────────────────────────┐");
  console.log(`  │ Total sessions:           ${String(sessionStats?.total ?? totalRadacct).padEnd(32)}│`);
  console.log(`  │ Active sessions:          ${String(sessionStats?.active ?? activeSessionCount).padEnd(32)}│`);
  console.log(`  │ Ended sessions:           ${String(sessionStats?.ended ?? endedSessionCount).padEnd(32)}│`);
  console.log(`  │ Date range:               ${(dateRange?.minDate || "N/A") + " → " + (dateRange?.maxDate || "N/A")}`);
  console.log("  └───────────────────────────────────────────────────────────┘");
  console.log();

  console.log("  ┌─ Bandwidth Statistics ────────────────────────────────────┐");
  console.log(
    `  │ Total download:  ${formatBytes(totalInputBytes).padEnd(44)}│`
  );
  console.log(
    `  │ Total upload:    ${formatBytes(totalOutputBytes).padEnd(44)}│`
  );
  console.log(
    `  │ Total traffic:   ${formatBytes(totalInputBytes + totalOutputBytes).padEnd(44)}│`
  );
  if (peakUsageDay) {
    console.log(
      `  │ Peak usage day:  ${peakUsageDay} (${formatBytes(peakUsageBytes)})`
    );
  }
  console.log("  └───────────────────────────────────────────────────────────┘");
  console.log();

  console.log("  ┌─ Timing ──────────────────────────────────────────────────┐");
  for (const [name, data] of Object.entries(stats)) {
    const label = name.padEnd(28);
    const ms = `${data.timeMs.toFixed(0)}ms`.padStart(10);
    const rows = `${data.count.toLocaleString()} rows`.padStart(16);
    console.log(`  │ ${label} │ ${ms} │ ${rows} │`);
  }
  console.log(`  │ ${"".padEnd(28)} │ ${"".padEnd(10)} │ ${"".padEnd(16)} │`);
  const totalLabel = "TOTAL".padEnd(28);
  const totalMs = `${totalTime.toFixed(0)}ms`.padStart(10);
  console.log(`  │ ${totalLabel} │ ${totalMs} │                │`);
  console.log("  └───────────────────────────────────────────────────────────┘");
  console.log();
  console.log(`  Finished at: ${new Date().toISOString()}`);
  console.log();
}

// ─── Helper: format bytes to human readable ─────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = bytes / Math.pow(k, i);
  return `${val.toFixed(i > 1 ? 2 : 0)} ${sizes[i]}`;
}

// ─── Helper: add days ───────────────────────────────────────────────────────

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86400000);
}

// Run
main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
