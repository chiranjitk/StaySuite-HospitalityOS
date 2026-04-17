/**
 * Kea DHCP4 Management Mini-Service
 *
 * Provides a REST API to manage the Kea DHCP4 server via its
 * Unix domain socket control channel.
 *
 * Port: 3011
 */

import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { connect } from "node:net";
import { readFile, writeFile, access, unlink } from "node:fs/promises";
import { execSync, spawn } from "node:child_process";
import * as path from "node:path";

// ─── Constants ────────────────────────────────────────────────────────────────

const PORT = 3011;
const KEA_CTRL_SOCKET = "/tmp/kea/kea4-ctrl-socket";
const KEA_PID_FILE = "/tmp/kea/kea-dhcp4.kea-dhcp4.pid";
const KEA_PID_FILE_ALT = "/home/z/my-project/kea-local/run/kea-dhcp4.pid";
const KEA_CONFIG_FILE = "/home/z/my-project/kea-local/kea-dhcp4.conf";
const KEA_LEASE_FILE = "/tmp/lib/kea/kea-leases4.csv";
const KEA_LOG_FILE = "/tmp/log/kea/kea-dhcp4.log";
const KEA_SBIN = "/home/z/my-project/kea-local/extracted/usr/sbin/kea-dhcp4";
const KEA_LIB = "/home/z/my-project/kea-local/extracted/usr/lib/x86_64-linux-gnu";
const KEA_START_SCRIPT = "/home/z/my-project/kea-local/start-kea.sh";
const DB_PATH = "/home/z/my-project/db/custom.db";

const SOCKET_TIMEOUT_MS = 5000;

// ─── Types ────────────────────────────────────────────────────────────────────

interface KeaResponse {
  result: number;
  arguments?: any;
  text?: string;
}

interface LeaseRecord {
  address: string;
  hwaddr: string;
  client_id: string;
  valid_lft: string;
  expire: string;
  subnet_id: string;
  fqdn_fwd: string;
  fqdn_rev: string;
  hostname: string;
  state: string;
  user_context: string;
  pool_id: string;
}

interface ApiResponse {
  success: boolean;
  data?: any;
  error?: string;
}

interface SubnetInput {
  id: number;
  subnet: string;
  pools: Array<{ pool: string }>;
  "option-data"?: Array<{ name: string; data: string; code?: number }>;
  reservations?: Array<any>;
  "relay"?: any;
  "valid-lifetime"?: number;
  "renew-timer"?: number;
  "rebind-timer"?: number;
  "interface"?: string;
}

interface ReservationInput {
  "hw-address": string;
  "ip-address": string;
  hostname?: string;
  "client-id"?: string;
  description?: string;
  "subnet-id": number;
}

interface DhcpOptionInput {
  code?: number;
  name: string;
  data: string;
  "space"?: string;
  "csv-format"?: boolean;
  "always-send"?: boolean;
}

// ─── Unix Socket Communication ────────────────────────────────────────────────

function sendKeaCommand(cmd: object): Promise<KeaResponse> {
  return new Promise((resolve, reject) => {
    const socket = connect(KEA_CTRL_SOCKET);
    let buffer = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        socket.destroy();
        // If we received some data but haven't resolved yet, try parsing
        if (buffer.trim()) {
          try {
            resolve(JSON.parse(buffer.trim()));
            return;
          } catch {}
        }
        reject(new Error("Socket operation timed out"));
      }
    }, SOCKET_TIMEOUT_MS);

    socket.on("error", (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        socket.destroy();
        reject(err);
      }
    });

    socket.on("data", (data: Buffer) => {
      buffer += data.toString();
      // Kea sends the complete response in one or more data events.
      // After receiving data, schedule socket.end() to signal we're
      // done reading. The small delay ensures we don't cut off
      // additional data chunks.
      setTimeout(() => {
        try {
          if (!settled) socket.end();
        } catch {}
      }, 50);
    });

    socket.on("end", () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        try {
          const response = JSON.parse(buffer.trim());
          resolve(response);
        } catch (e) {
          reject(new Error(`Failed to parse Kea response: ${buffer.substring(0, 200)}`));
        }
      }
    });

    socket.on("close", () => {
      // In case 'end' doesn't fire but we have data
      if (!settled && buffer.trim()) {
        settled = true;
        clearTimeout(timer);
        try {
          const response = JSON.parse(buffer.trim());
          resolve(response);
        } catch (e) {
          reject(new Error(`Failed to parse Kea response on close: ${buffer.substring(0, 200)}`));
        }
      } else if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(new Error("Socket closed without receiving data"));
      }
    });

    socket.on("connect", () => {
      const payload = JSON.stringify(cmd) + "\n";
      const writeResult = socket.write(payload, "utf-8");
      // In Bun, we do NOT call socket.end() after writing.
      // Instead, we wait for the response data and end from
      // the 'data' event handler. This ensures the socket
      // stays open long enough to receive the response.
    });
  });
}

/**
 * Check if Kea DHCP4 server is running by testing socket connectivity
 */
async function isKeaRunning(): Promise<boolean> {
  try {
    const result = await sendKeaCommand({ command: "status-get" });
    return result.result === 0;
  } catch {
    return false;
  }
}

/**
 * Read the PID file (tries multiple locations)
 */
async function readPidFile(): Promise<number | null> {
  // Try primary path first, then alternative
  for (const pidFile of [KEA_PID_FILE, KEA_PID_FILE_ALT]) {
    try {
      const data = await readFile(pidFile, "utf-8");
      const pid = parseInt(data.trim(), 10);
      if (!isNaN(pid)) return pid;
    } catch {}
  }
  return null;
}

/**
 * Check if a process with given PID is alive
 */
function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// ─── Lease CSV Parsing ────────────────────────────────────────────────────────

async function parseLeaseFile(): Promise<LeaseRecord[]> {
  let content: string;
  try {
    content = await readFile(KEA_LEASE_FILE, "utf-8");
  } catch {
    return [];
  }

  const lines = content.trim().split("\n");
  if (lines.length === 0) return [];

  // Find the header line (starts with #)
  let headerLineIdx = -1;
  let headerFields: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("#")) {
      headerLineIdx = i;
      headerFields = line
        .substring(1)
        .split(",")
        .map((f) => f.trim());
      break;
    }
  }

  if (headerLineIdx === -1 || headerFields.length === 0) return [];

  const leases: LeaseRecord[] = [];

  for (let i = headerLineIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith("#")) continue;

    const values = parseCSVLine(line);
    if (values.length < headerFields.length) continue;

    const record: any = {};
    for (let j = 0; j < headerFields.length; j++) {
      record[headerFields[j]] = values[j] || "";
    }

    leases.push(record as LeaseRecord);
  }

  return leases;
}

/**
 * Parse a CSV line respecting quoted fields
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
  }
  result.push(current);
  return result;
}

// ─── Config Helpers ───────────────────────────────────────────────────────────

async function getRunningConfig(): Promise<any> {
  const response = await sendKeaCommand({ command: "config-get" });
  if (response.result !== 0) {
    throw new Error(response.text || "Failed to get config from Kea");
  }
  return response.arguments?.Dhcp4;
}

async function setRunningConfig(dhcp4Config: any): Promise<void> {
  const response = await sendKeaCommand({
    command: "config-set",
    arguments: { Dhcp4: dhcp4Config },
  });
  if (response.result !== 0) {
    throw new Error(response.text || "Failed to set config in Kea");
  }
}

async function writeConfigToFile(): Promise<void> {
  // Get the current running config
  const config = await getRunningConfig();
  const configJson = JSON.stringify({ Dhcp4: config }, null, 2);

  // Try writing to the original config file first, then fallback paths
  const writePaths = [
    KEA_CONFIG_FILE,
    "/tmp/kea/kea-dhcp4.conf",
  ];

  for (const filePath of writePaths) {
    try {
      await writeFile(filePath, configJson, "utf-8");
      return; // Success
    } catch {
      continue; // Try next path
    }
  }

  throw new Error("Failed to write config file to any writable location");
}

// ─── HTTP Helpers ─────────────────────────────────────────────────────────────

function sendJson(res: ServerResponse, statusCode: number, body: ApiResponse) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });
  res.end(JSON.stringify(body));
}

function sendSuccess(res: ServerResponse, data: any, statusCode = 200) {
  sendJson(res, statusCode, { success: true, data });
}

function sendError(res: ServerResponse, error: string, statusCode = 500) {
  sendJson(res, statusCode, { success: false, error });
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk.toString()));
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

// ─── Route Handlers ──────────────────────────────────────────────────────────

// --- Status & Health ---

async function handleGetStatus(_req: IncomingMessage, res: ServerResponse) {
  try {
    const running = await isKeaRunning();
    const pid = await readPidFile();

    let version: any = null;
    let status: any = null;
    let subnetsCount = 0;

    if (running) {
      try {
        const versionResp = await sendKeaCommand({ command: "version-get" });
        if (versionResp.result === 0) version = versionResp.arguments;
      } catch {}

      try {
        const statusResp = await sendKeaCommand({ command: "status-get" });
        if (statusResp.result === 0) status = statusResp.arguments;
      } catch {}

      try {
        const config = await getRunningConfig();
        subnetsCount = config?.subnet4?.length || 0;
      } catch {}
    }

    sendSuccess(res, {
      running,
      pid: running ? pid : null,
      version,
      status,
      subnetsCount,
      pidFile: KEA_PID_FILE,
      ctrlSocket: KEA_CTRL_SOCKET,
      configFile: KEA_CONFIG_FILE,
      leaseFile: KEA_LEASE_FILE,
      logFile: KEA_LOG_FILE,
    });
  } catch (err: any) {
    sendError(res, err.message || "Failed to get Kea status");
  }
}

async function handleGetVersion(_req: IncomingMessage, res: ServerResponse) {
  try {
    const response = await sendKeaCommand({ command: "version-get" });
    if (response.result !== 0) {
      sendError(res, response.text || "Failed to get version", 502);
      return;
    }
    sendSuccess(res, response.arguments);
  } catch (err: any) {
    sendError(res, err.message || "Failed to get Kea version");
  }
}

async function handleStartKea(_req: IncomingMessage, res: ServerResponse) {
  try {
    const running = await isKeaRunning();
    if (running) {
      sendSuccess(res, { message: "Kea DHCP4 is already running", pid: await readPidFile() });
      return;
    }

    // Check if there's a stale PID
    const oldPid = await readPidFile();
    if (oldPid !== null && isProcessAlive(oldPid)) {
      sendError(res, `Process ${oldPid} is already running but not responding to socket commands`, 409);
      return;
    }

    // Clean up stale PID and socket
    for (const pidFile of [KEA_PID_FILE, KEA_PID_FILE_ALT]) {
      try { await unlink(pidFile); } catch {}
    }
    try { await unlink(KEA_CTRL_SOCKET); } catch {}

    // Ensure required directories exist
    execSync("mkdir -p /tmp/kea /tmp/lib/kea /tmp/log/kea", { stdio: "pipe" });

    // Start Kea using the start script
    const child = spawn("bash", [KEA_START_SCRIPT], {
      detached: true,
      stdio: "ignore",
      env: { ...process.env, LD_LIBRARY_PATH: KEA_LIB },
    });
    child.unref();

    // Wait and verify
    await new Promise((r) => setTimeout(r, 3000));

    const nowRunning = await isKeaRunning();
    if (nowRunning) {
      const pid = await readPidFile();
      sendSuccess(res, { message: "Kea DHCP4 started successfully", pid });
    } else {
      sendError(res, "Kea DHCP4 failed to start. Check logs.", 500);
    }
  } catch (err: any) {
    sendError(res, err.message || "Failed to start Kea DHCP4");
  }
}

async function handleStopKea(_req: IncomingMessage, res: ServerResponse) {
  try {
    const running = await isKeaRunning();
    if (!running) {
      // Try to kill via PID file
      const pid = await readPidFile();
      if (pid !== null && isProcessAlive(pid)) {
        try {
          process.kill(pid, "SIGTERM");
          await new Promise((r) => setTimeout(r, 2000));
        } catch {}
      }
      // Clean up
      for (const pidFile of [KEA_PID_FILE, KEA_PID_FILE_ALT]) {
        try { await unlink(pidFile); } catch {}
      }
      try { await unlink(KEA_CTRL_SOCKET); } catch {}
      sendSuccess(res, { message: "Kea DHCP4 was not running (cleaned up stale files)" });
      return;
    }

    const response = await sendKeaCommand({ command: "shutdown" });
    if (response.result !== 0) {
      // Fallback: kill via PID
      const pid = await readPidFile();
      if (pid !== null) {
        try {
          process.kill(pid, "SIGTERM");
        } catch {}
      }
    }

    // Wait and clean up
    await new Promise((r) => setTimeout(r, 2000));
    for (const pidFile of [KEA_PID_FILE, KEA_PID_FILE_ALT]) {
      try { await unlink(pidFile); } catch {}
    }
    try { await unlink(KEA_CTRL_SOCKET); } catch {}

    sendSuccess(res, { message: "Kea DHCP4 stopped successfully" });
  } catch (err: any) {
    sendError(res, err.message || "Failed to stop Kea DHCP4");
  }
}

async function handleRestartKea(_req: IncomingMessage, res: ServerResponse) {
  try {
    // Stop
    const running = await isKeaRunning();
    if (running) {
      const response = await sendKeaCommand({ command: "shutdown" });
      if (response.result !== 0) {
        const pid = await readPidFile();
        if (pid !== null) {
          try { process.kill(pid, "SIGTERM"); } catch {}
        }
      }
      await new Promise((r) => setTimeout(r, 2000));
    }

    // Clean up
    for (const pidFile of [KEA_PID_FILE, KEA_PID_FILE_ALT]) {
      try { await unlink(pidFile); } catch {}
    }
    try { await unlink(KEA_CTRL_SOCKET); } catch {}

    // Start
    execSync("mkdir -p /tmp/kea /tmp/lib/kea /tmp/log/kea", { stdio: "pipe" });

    const child = spawn("bash", [KEA_START_SCRIPT], {
      detached: true,
      stdio: "ignore",
      env: { ...process.env, LD_LIBRARY_PATH: KEA_LIB },
    });
    child.unref();

    await new Promise((r) => setTimeout(r, 3000));

    const nowRunning = await isKeaRunning();
    if (nowRunning) {
      const pid = await readPidFile();
      sendSuccess(res, { message: "Kea DHCP4 restarted successfully", pid });
    } else {
      sendError(res, "Kea DHCP4 failed to restart. Check logs.", 500);
    }
  } catch (err: any) {
    sendError(res, err.message || "Failed to restart Kea DHCP4");
  }
}

// --- Subnets ---

async function handleGetSubnets(_req: IncomingMessage, res: ServerResponse) {
  try {
    const config = await getRunningConfig();
    const subnets = config?.subnet4 || [];
    sendSuccess(res, subnets);
  } catch (err: any) {
    sendError(res, err.message || "Failed to get subnets");
  }
}

async function handleAddSubnet(req: IncomingMessage, res: ServerResponse) {
  try {
    const body = JSON.parse(await readBody(req));
    const { id, subnet, pools, option_data, reservations, valid_lifetime, renew_timer, rebind_timer, relay } = body;

    if (!subnet || !pools || !Array.isArray(pools) || pools.length === 0) {
      sendError(res, "Missing required fields: subnet, pools", 400);
      return;
    }

    const config = await getRunningConfig();
    if (!config.subnet4) config.subnet4 = [];

    // Check for duplicate ID
    const existingIds = config.subnet4.map((s: any) => s.id);
    const newId = id || (existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1);

    if (existingIds.includes(newId)) {
      sendError(res, `Subnet with id ${newId} already exists`, 409);
      return;
    }

    // Check for duplicate subnet
    if (config.subnet4.some((s: any) => s.subnet === subnet)) {
      sendError(res, `Subnet ${subnet} already exists`, 409);
      return;
    }

    const newSubnet: any = {
      id: newId,
      subnet,
      pools: pools.map((p: any) => ({ pool: typeof p === "string" ? p : p.pool })),
    };

    if (option_data && Array.isArray(option_data)) {
      newSubnet["option-data"] = option_data;
    }
    if (reservations && Array.isArray(reservations)) {
      newSubnet.reservations = reservations;
    } else {
      newSubnet.reservations = [];
    }
    if (valid_lifetime) newSubnet["valid-lifetime"] = valid_lifetime;
    if (renew_timer) newSubnet["renew-timer"] = renew_timer;
    if (rebind_timer) newSubnet["rebind-timer"] = rebind_timer;
    if (relay) newSubnet.relay = relay;

    config.subnet4.push(newSubnet);

    await setRunningConfig(config);
    await writeConfigToFile();

    sendSuccess(res, newSubnet, 201);
  } catch (err: any) {
    sendError(res, err.message || "Failed to add subnet");
  }
}

async function handleUpdateSubnet(req: IncomingMessage, res: ServerResponse, subnetId: string) {
  try {
    const body = JSON.parse(await readBody(req));
    const config = await getRunningConfig();

    const id = parseInt(subnetId, 10);
    const idx = config?.subnet4?.findIndex((s: any) => s.id === id);
    if (idx === -1 || idx === undefined) {
      sendError(res, `Subnet with id ${id} not found`, 404);
      return;
    }

    const existing = config.subnet4[idx];

    // Merge updates
    if (body.subnet) existing.subnet = body.subnet;
    if (body.pools) existing.pools = body.pools.map((p: any) => ({ pool: typeof p === "string" ? p : p.pool }));
    if (body.option_data) existing["option-data"] = body.option_data;
    if (body.reservations !== undefined) existing.reservations = body.reservations;
    if (body.valid_lifetime) existing["valid-lifetime"] = body.valid_lifetime;
    if (body.renew_timer) existing["renew-timer"] = body.renew_timer;
    if (body.rebind_timer) existing["rebind-timer"] = body.rebind_timer;
    if (body.relay) existing.relay = body.relay;

    config.subnet4[idx] = existing;

    await setRunningConfig(config);
    await writeConfigToFile();

    sendSuccess(res, existing);
  } catch (err: any) {
    sendError(res, err.message || "Failed to update subnet");
  }
}

async function handleDeleteSubnet(req: IncomingMessage, res: ServerResponse, subnetId: string) {
  try {
    const config = await getRunningConfig();
    const id = parseInt(subnetId, 10);

    const idx = config?.subnet4?.findIndex((s: any) => s.id === id);
    if (idx === -1 || idx === undefined) {
      sendError(res, `Subnet with id ${id} not found`, 404);
      return;
    }

    const removed = config.subnet4.splice(idx, 1)[0];

    await setRunningConfig(config);
    await writeConfigToFile();

    sendSuccess(res, removed);
  } catch (err: any) {
    sendError(res, err.message || "Failed to delete subnet");
  }
}

// --- Reservations ---

async function handleGetReservations(_req: IncomingMessage, res: ServerResponse) {
  try {
    const config = await getRunningConfig();
    const subnets = config?.subnet4 || [];

    const reservations: Array<{
      "hw-address": string;
      "ip-address": string;
      hostname?: string;
      "client-id"?: string;
      description?: string;
      "subnet-id": number;
      "subnet": string;
    }> = [];

    for (const subnet of subnets) {
      const subnetReservations = subnet.reservations || [];
      for (const r of subnetReservations) {
        reservations.push({
          ...r,
          "subnet-id": subnet.id,
          subnet: subnet.subnet,
        });
      }
    }

    sendSuccess(res, reservations);
  } catch (err: any) {
    sendError(res, err.message || "Failed to get reservations");
  }
}

async function handleAddReservation(req: IncomingMessage, res: ServerResponse) {
  try {
    const body: ReservationInput = JSON.parse(await readBody(req));
    const { "hw-address": hwAddress, "ip-address": ipAddress, hostname, "client-id": clientId, description, "subnet-id": subnetId } = body;

    if (!hwAddress || !ipAddress || !subnetId) {
      sendError(res, "Missing required fields: hw-address, ip-address, subnet-id", 400);
      return;
    }

    const config = await getRunningConfig();
    const subnetIdx = config?.subnet4?.findIndex((s: any) => s.id === subnetId);
    if (subnetIdx === -1 || subnetIdx === undefined) {
      sendError(res, `Subnet with id ${subnetId} not found`, 404);
      return;
    }

    const subnet = config.subnet4[subnetIdx];
    if (!subnet.reservations) subnet.reservations = [];

    // Check for duplicate hw-address
    if (subnet.reservations.some((r: any) => r["hw-address"] === hwAddress)) {
      sendError(res, `Reservation with hw-address ${hwAddress} already exists in subnet ${subnetId}`, 409);
      return;
    }

    const newReservation: any = {
      "hw-address": hwAddress,
      "ip-address": ipAddress,
    };

    if (hostname) newReservation.hostname = hostname;
    if (clientId) newReservation["client-id"] = clientId;
    if (description) newReservation.description = description;

    subnet.reservations.push(newReservation);
    config.subnet4[subnetIdx] = subnet;

    await setRunningConfig(config);
    await writeConfigToFile();

    sendSuccess(res, { ...newReservation, "subnet-id": subnetId }, 201);
  } catch (err: any) {
    sendError(res, err.message || "Failed to add reservation");
  }
}

async function handleUpdateReservation(req: IncomingMessage, res: ServerResponse) {
  try {
    const body = JSON.parse(await readBody(req));
    const { "hw-address": hwAddress, "subnet-id": subnetId } = body;

    if (!hwAddress) {
      sendError(res, "Missing required field: hw-address", 400);
      return;
    }

    const config = await getRunningConfig();

    // Find the reservation across all subnets
    let found = false;
    for (const subnet of config?.subnet4 || []) {
      const reservations = subnet.reservations || [];
      const resIdx = reservations.findIndex((r: any) => r["hw-address"] === hwAddress);

      if (resIdx !== -1) {
        // If subnet-id is specified and different, move it
        if (subnetId !== undefined && subnet.id !== subnetId) {
          const [removed] = reservations.splice(resIdx, 1);
          const targetSubnet = config.subnet4.find((s: any) => s.id === subnetId);
          if (!targetSubnet) {
            sendError(res, `Target subnet with id ${subnetId} not found`, 404);
            return;
          }
          if (!targetSubnet.reservations) targetSubnet.reservations = [];
          // Update fields
          if (body["ip-address"]) removed["ip-address"] = body["ip-address"];
          if (body.hostname !== undefined) removed.hostname = body.hostname;
          if (body["client-id"] !== undefined) removed["client-id"] = body["client-id"];
          if (body.description !== undefined) removed.description = body.description;
          targetSubnet.reservations.push(removed);
        } else {
          // Update in place
          const reservation = reservations[resIdx];
          if (body["ip-address"]) reservation["ip-address"] = body["ip-address"];
          if (body.hostname !== undefined) reservation.hostname = body.hostname;
          if (body["client-id"] !== undefined) reservation["client-id"] = body["client-id"];
          if (body.description !== undefined) reservation.description = body.description;
        }
        found = true;
        break;
      }
    }

    if (!found) {
      sendError(res, `Reservation with hw-address ${hwAddress} not found`, 404);
      return;
    }

    await setRunningConfig(config);
    await writeConfigToFile();

    sendSuccess(res, { message: "Reservation updated" });
  } catch (err: any) {
    sendError(res, err.message || "Failed to update reservation");
  }
}

async function handleDeleteReservation(req: IncomingMessage, res: ServerResponse) {
  try {
    const body = JSON.parse(await readBody(req));
    const { "hw-address": hwAddress, "subnet-id": subnetId } = body;

    if (!hwAddress) {
      sendError(res, "Missing required field: hw-address", 400);
      return;
    }

    const config = await getRunningConfig();
    let found = false;

    if (subnetId !== undefined) {
      // Delete from specific subnet
      const subnet = config?.subnet4?.find((s: any) => s.id === subnetId);
      if (!subnet) {
        sendError(res, `Subnet with id ${subnetId} not found`, 404);
        return;
      }
      const reservations = subnet.reservations || [];
      const resIdx = reservations.findIndex((r: any) => r["hw-address"] === hwAddress);
      if (resIdx !== -1) {
        const removed = reservations.splice(resIdx, 1)[0];
        found = true;
      }
    } else {
      // Delete from any subnet that has this reservation
      for (const subnet of config?.subnet4 || []) {
        const reservations = subnet.reservations || [];
        const resIdx = reservations.findIndex((r: any) => r["hw-address"] === hwAddress);
        if (resIdx !== -1) {
          reservations.splice(resIdx, 1);
          found = true;
          break;
        }
      }
    }

    if (!found) {
      sendError(res, `Reservation with hw-address ${hwAddress} not found`, 404);
      return;
    }

    await setRunningConfig(config);
    await writeConfigToFile();

    sendSuccess(res, { message: "Reservation deleted" });
  } catch (err: any) {
    sendError(res, err.message || "Failed to delete reservation");
  }
}

// --- Leases ---

async function handleGetLeases(_req: IncomingMessage, res: ServerResponse) {
  try {
    const leases = await parseLeaseFile();
    sendSuccess(res, leases);
  } catch (err: any) {
    sendError(res, err.message || "Failed to read leases");
  }
}

// --- Statistics ---

async function handleGetStatistics(_req: IncomingMessage, res: ServerResponse) {
  try {
    const response = await sendKeaCommand({ command: "statistic-get-all" });
    if (response.result !== 0) {
      sendError(res, response.text || "Failed to get statistics", 502);
      return;
    }
    sendSuccess(res, response.arguments);
  } catch (err: any) {
    sendError(res, err.message || "Failed to get Kea statistics");
  }
}

// --- Sync ---

async function handleGetSyncStatus(_req: IncomingMessage, res: ServerResponse) {
  try {
    let keaSubnets: any[] = [];
    let keaReservations: any[] = [];

    try {
      const config = await getRunningConfig();
      keaSubnets = config?.subnet4 || [];
      for (const subnet of keaSubnets) {
        for (const r of subnet.reservations || []) {
          keaReservations.push({ ...r, "subnet-id": subnet.id, "subnet": subnet.subnet });
        }
      }
    } catch {
      // Kea might not be running
    }

    sendSuccess(res, {
      keaOnline: await isKeaRunning(),
      keaSubnetCount: keaSubnets.length,
      keaReservationCount: keaReservations.length,
      keaSubnets: keaSubnets.map((s: any) => ({ id: s.id, subnet: s.subnet })),
    });
  } catch (err: any) {
    sendError(res, err.message || "Failed to get sync status");
  }
}

async function handleSyncFromDatabase(req: IncomingMessage, res: ServerResponse) {
  try {
    const body = JSON.parse(await readBody(req) || "{}");
    const { propertyId = "property-1" } = body;

    // Read from the SQLite database using Bun's built-in SQLite
    let dbSubnets: any[] = [];
    let dbReservations: any[] = [];

    try {
      // @ts-ignore - Bun built-in SQLite
      const sqlite = require("bun:sqlite");
      const db = new sqlite.Database(DB_PATH, { readonly: true });

      // Read subnets
      const subnetRows = db
        .query(
          `SELECT id, name, subnet, gateway, poolStart, poolEnd, leaseTime, vlanId,
                  domainName, dnsServers, ntpServers, bootFileName, nextServer, enabled
           FROM DhcpSubnet WHERE propertyId = ?`
        )
        .all(propertyId) as any[];

      dbSubnets = subnetRows || [];

      // Read reservations
      const reservationRows = db
        .query(
          `SELECT r.id, r.subnetId, r.macAddress, r.ipAddress, r.hostname,
                  r.leaseTime, r.description, r.enabled, s.subnet as subnetAddress
           FROM DhcpReservation r
           JOIN DhcpSubnet s ON r.subnetId = s.id
           WHERE r.propertyId = ? AND r.enabled = 1`
        )
        .all(propertyId) as any[];

      dbReservations = reservationRows || [];

      db.close();
    } catch (dbErr: any) {
      // If we can't read the database, just proceed with empty arrays
      console.warn("Could not read from database:", dbErr.message);
    }

    if (dbSubnets.length === 0) {
      sendSuccess(res, {
        message: "No subnets found in database to sync",
        syncedSubnets: 0,
        syncedReservations: 0,
      });
      return;
    }

    // Get current Kea config
    const config = await getRunningConfig();

    // Build new subnet4 config from database
    // We need to determine subnet IDs. Since Kea uses integer IDs,
    // we'll map database cuid IDs to sequential integers starting from a high number.
    const subnetIdMap = new Map<string, number>();
    let nextKeaId = 1;

    // First, find the max existing kea subnet id
    if (config.subnet4 && config.subnet4.length > 0) {
      nextKeaId = Math.max(...config.subnet4.map((s: any) => s.id)) + 1;
    }

    // Map database subnet IDs to Kea integer IDs
    for (const dbSubnet of dbSubnets) {
      if (!dbSubnet.enabled) continue;
      subnetIdMap.set(dbSubnet.id, nextKeaId++);
    }

    // Build Kea subnet4 array
    const newSubnets: any[] = [];

    for (const dbSubnet of dbSubnets) {
      if (!dbSubnet.enabled) continue;

      const keaId = subnetIdMap.get(dbSubnet.id);
      if (!keaId) continue;

      const keaSubnet: any = {
        id: keaId,
        subnet: dbSubnet.subnet,
        pools: [{ pool: `${dbSubnet.poolStart} - ${dbSubnet.poolEnd}` }],
        reservations: [],
      };

      // Add gateway as routers option
      const options: any[] = [];
      if (dbSubnet.gateway) {
        options.push({ name: "routers", data: dbSubnet.gateway });
      }

      // Add DNS servers
      if (dbSubnet.dnsServers) {
        try {
          const dnsServers = JSON.parse(dbSubnet.dnsServers);
          if (Array.isArray(dnsServers) && dnsServers.length > 0) {
            options.push({ name: "domain-name-servers", data: dnsServers.join(", ") });
          }
        } catch {}
      }

      // Add domain name
      if (dbSubnet.domainName) {
        options.push({ name: "domain-name", data: dbSubnet.domainName });
      }

      // Add NTP servers
      if (dbSubnet.ntpServers) {
        try {
          const ntpServers = JSON.parse(dbSubnet.ntpServers);
          if (Array.isArray(ntpServers) && ntpServers.length > 0) {
            options.push({ name: "ntp-servers", data: ntpServers.join(", ") });
          }
        } catch {}
      }

      if (options.length > 0) {
        keaSubnet["option-data"] = options;
      }

      // Set lease time if different from global
      if (dbSubnet.leaseTime && dbSubnet.leaseTime !== config["valid-lifetime"]) {
        keaSubnet["valid-lifetime"] = dbSubnet.leaseTime;
      }

      // Add reservations for this subnet
      const subnetReservations = dbReservations.filter((r: any) => r.subnetId === dbSubnet.id);
      for (const dbRes of subnetReservations) {
        const keaReservation: any = {
          "hw-address": dbRes.macAddress,
          "ip-address": dbRes.ipAddress,
        };
        if (dbRes.hostname) keaReservation.hostname = dbRes.hostname;
        if (dbRes.description) keaReservation.description = dbRes.description;
        keaSubnet.reservations.push(keaReservation);
      }

      newSubnets.push(keaSubnet);
    }

    // Replace subnet4 in config
    config.subnet4 = newSubnets;

    await setRunningConfig(config);
    await writeConfigToFile();

    sendSuccess(res, {
      message: "Synced subnets and reservations from database to Kea",
      syncedSubnets: newSubnets.length,
      syncedReservations: dbReservations.length,
      subnetMapping: Object.fromEntries(subnetIdMap),
    });
  } catch (err: any) {
    sendError(res, err.message || "Failed to sync from database");
  }
}

// --- DHCP Options ---

async function handleGetOptions(_req: IncomingMessage, res: ServerResponse) {
  try {
    const config = await getRunningConfig();
    const globalOptions = config?.["option-data"] || [];
    const subnetOptions: Array<{
      subnetId: number;
      subnet: string;
      options: any[];
    }> = [];

    for (const subnet of config?.subnet4 || []) {
      if (subnet["option-data"] && subnet["option-data"].length > 0) {
        subnetOptions.push({
          subnetId: subnet.id,
          subnet: subnet.subnet,
          options: subnet["option-data"],
        });
      }
    }

    sendSuccess(res, { globalOptions, subnetOptions });
  } catch (err: any) {
    sendError(res, err.message || "Failed to get DHCP options");
  }
}

async function handleSetOption(req: IncomingMessage, res: ServerResponse) {
  try {
    const body = JSON.parse(await readBody(req));
    const { name, data, code, space, subnetId, csv_format, always_send } = body;

    if (!name || !data) {
      sendError(res, "Missing required fields: name, data", 400);
      return;
    }

    const config = await getRunningConfig();

    const newOption: any = { name, data };
    if (code) newOption.code = code;
    if (space) newOption.space = space;
    if (csv_format !== undefined) newOption["csv-format"] = csv_format;
    if (always_send !== undefined) newOption["always-send"] = always_send;

    if (subnetId !== undefined) {
      // Subnet-level option
      const subnet = config?.subnet4?.find((s: any) => s.id === subnetId);
      if (!subnet) {
        sendError(res, `Subnet with id ${subnetId} not found`, 404);
        return;
      }
      if (!subnet["option-data"]) subnet["option-data"] = [];

      // Update existing or add new
      const existingIdx = subnet["option-data"].findIndex((o: any) => o.name === name);
      if (existingIdx !== -1) {
        subnet["option-data"][existingIdx] = { ...subnet["option-data"][existingIdx], ...newOption };
      } else {
        subnet["option-data"].push(newOption);
      }
    } else {
      // Global option
      if (!config["option-data"]) config["option-data"] = [];

      const existingIdx = config["option-data"].findIndex((o: any) => o.name === name);
      if (existingIdx !== -1) {
        config["option-data"][existingIdx] = { ...config["option-data"][existingIdx], ...newOption };
      } else {
        config["option-data"].push(newOption);
      }
    }

    await setRunningConfig(config);
    await writeConfigToFile();

    sendSuccess(res, { message: "DHCP option set successfully", option: newOption, subnetId });
  } catch (err: any) {
    sendError(res, err.message || "Failed to set DHCP option");
  }
}

// ─── Router ───────────────────────────────────────────────────────────────────

async function handleRequest(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url || "/", `http://localhost:${PORT}`);
  const pathname = url.pathname;
  const method = req.method || "GET";

  // ─── Auth middleware ───────────────────────────────────────────────────
  // Skip auth for /api/kea/status (acts as health check) and OPTIONS
  if (pathname !== "/api/kea/status" && method !== "OPTIONS") {
    const authSecret = process.env.SERVICE_AUTH_SECRET;
    if (authSecret) {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        sendJson(res, 401, { success: false, error: "Missing or invalid Authorization header" });
        return;
      }
      const token = authHeader.substring(7);
      if (token !== authSecret) {
        sendJson(res, 403, { success: false, error: "Invalid token" });
        return;
      }
    } else if (!globalThis.__keaAuthWarningLogged) {
      console.warn("⚠️ SERVICE_AUTH_SECRET not configured. All requests will be allowed. Set SERVICE_AUTH_SECRET env var for production.");
      globalThis.__keaAuthWarningLogged = true;
    }
  }

  // Handle CORS preflight
  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    });
    res.end();
    return;
  }

  try {
    // --- Status & Health ---
    if (pathname === "/api/kea/status" && method === "GET") {
      return await handleGetStatus(req, res);
    }
    if (pathname === "/api/kea/version" && method === "GET") {
      return await handleGetVersion(req, res);
    }
    if (pathname === "/api/kea/start" && method === "POST") {
      return await handleStartKea(req, res);
    }
    if (pathname === "/api/kea/stop" && method === "POST") {
      return await handleStopKea(req, res);
    }
    if (pathname === "/api/kea/restart" && method === "POST") {
      return await handleRestartKea(req, res);
    }

    // --- Subnets ---
    if (pathname === "/api/kea/subnets" && method === "GET") {
      return await handleGetSubnets(req, res);
    }
    if (pathname === "/api/kea/subnets" && method === "POST") {
      return await handleAddSubnet(req, res);
    }
    if (pathname.match(/^\/api\/kea\/subnets\/\d+$/) && method === "PUT") {
      const id = pathname.split("/").pop()!;
      return await handleUpdateSubnet(req, res, id);
    }
    if (pathname.match(/^\/api\/kea\/subnets\/\d+$/) && method === "DELETE") {
      const id = pathname.split("/").pop()!;
      return await handleDeleteSubnet(req, res, id);
    }

    // --- Reservations ---
    if (pathname === "/api/kea/reservations" && method === "GET") {
      return await handleGetReservations(req, res);
    }
    if (pathname === "/api/kea/reservations" && method === "POST") {
      return await handleAddReservation(req, res);
    }
    if (pathname === "/api/kea/reservations" && method === "PUT") {
      return await handleUpdateReservation(req, res);
    }
    if (pathname === "/api/kea/reservations" && method === "DELETE") {
      return await handleDeleteReservation(req, res);
    }

    // --- Leases ---
    if (pathname === "/api/kea/leases" && method === "GET") {
      return await handleGetLeases(req, res);
    }

    // --- Statistics ---
    if (pathname === "/api/kea/statistics" && method === "GET") {
      return await handleGetStatistics(req, res);
    }

    // --- Sync ---
    if (pathname === "/api/kea/sync" && method === "GET") {
      return await handleGetSyncStatus(req, res);
    }
    if (pathname === "/api/kea/sync" && method === "POST") {
      return await handleSyncFromDatabase(req, res);
    }

    // --- DHCP Options ---
    if (pathname === "/api/kea/options" && method === "GET") {
      return await handleGetOptions(req, res);
    }
    if (pathname === "/api/kea/options" && method === "POST") {
      return await handleSetOption(req, res);
    }

    // --- 404 ---
    sendError(res, "Not found", 404);
  } catch (err: any) {
    console.error("Unhandled error:", err);
    sendError(res, err.message || "Internal server error", 500);
  }
}

// ─── Start Server ─────────────────────────────────────────────────────────────

const server = createServer(handleRequest);

server.listen(PORT, () => {
  console.log(`[kea-service] Listening on port ${PORT}`);
  console.log(`[kea-service] Kea control socket: ${KEA_CTRL_SOCKET}`);
  console.log(`[kea-service] Kea config file: ${KEA_CONFIG_FILE}`);
  console.log(`[kea-service] Kea lease file: ${KEA_LEASE_FILE}`);
});

server.on("error", (err: any) => {
  if (err.code === "EADDRINUSE") {
    console.error(`[kea-service] Port ${PORT} is already in use`);
    process.exit(1);
  }
  console.error(`[kea-service] Server error:`, err);
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("[kea-service] Shutting down...");
  server.close(() => {
    process.exit(0);
  });
});

process.on("SIGTERM", () => {
  console.log("[kea-service] Shutting down...");
  server.close(() => {
    process.exit(0);
  });
});

process.on("uncaughtException", (err) => {
  console.error("[kea-service] Uncaught exception:", err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("[kea-service] Unhandled rejection:", reason);
});
