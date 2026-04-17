/**
 * nmcli Wrapper for Rocky Linux 10 NetworkManager
 *
 * Modern TypeScript wrapper for all nmcli operations.
 * Replaces shell scripts with direct nmcli commands.
 * All operations use nmcli which auto-manages .nmconnection files.
 *
 * Architecture:
 *   GUI → API Route → nmcli.ts → nmcli command → .nmconnection file
 *   GUI → API Route → nmconnection.ts → scan files → parse [staysuite] nettype
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import { validateIPv4, validateVlanId, validateMtu, validateNetmask, validateBondMode, netmaskToCidr } from './executor';
import { NET_TYPES, NM_CONNECTIONS_DIR, isValidNetType, netTypeToLabel } from './nettypes';
import {
  parseNmConnectionFile,
  writeNmConnectionFile,
  getNetType,
  setNetType,
  getPriority,
  setPriority,
  getConnectionType,
  getInterfaceName,
  getConnectionDescription,
  getPrimaryAddress,
  getSecondaryAddresses,
  getIpv4Gateway,
  getIpv4Method,
  getMtu,
  getVlanInfo,
  getBridgeInfo,
  getBondInfo,
  getMaster,
  isPhysicalInterface,
  isSlavePort,
  isAutoconnect,
  NmConnectionFile,
} from './nmconnection';

// ─── Helpers ────────────────────────────────────────────────────────────

const NMCLI_TIMEOUT = 15000;

function exec(cmd: string, timeout = NMCLI_TIMEOUT): string {
  try {
    return execSync(cmd, { encoding: 'utf-8', timeout, stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (e: any) {
    const msg = e.stderr?.trim() || e.stdout?.trim() || e.message || 'Unknown error';
    throw new Error(msg);
  }
}

function execSafe(cmd: string, timeout = NMCLI_TIMEOUT): { stdout: string; ok: boolean; error: string } {
  try {
    const stdout = execSync(cmd, { encoding: 'utf-8', timeout, stdio: ['pipe', 'pipe', 'pipe'] });
    return { stdout: stdout.trim(), ok: true, error: '' };
  } catch (e: any) {
    const msg = e.stderr?.trim() || e.stdout?.trim() || e.message || 'Unknown error';
    return { stdout: '', ok: false, error: msg };
  }
}

function sanitizeName(name: string): string {
  if (!name || !/^[a-zA-Z0-9._-]+$/.test(name)) {
    throw new Error(`Invalid name: "${name}". Only alphanumeric, dots, dashes, underscores allowed.`);
  }
  return name;
}

function parseNmcliJson(output: string): any {
  try {
    const data = JSON.parse(output);
    // nmcli returns flat key-value with dots, convert to nested
    return nmcliFlatToNested(data);
  } catch {
    return null;
  }
}

/** Convert flat nmcli JSON (key.with.dots) to nested objects */
function nmcliFlatToNested(flat: any): any {
  if (Array.isArray(flat)) return flat.map(item => nmcliFlatToNested(item));
  if (typeof flat !== 'object' || flat === null) return flat;
  const result: any = {};
  for (const [key, value] of Object.entries(flat)) {
    const parts = key.split('.');
    let current = result;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) current[parts[i]] = {};
      current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = value;
  }
  return result;
}

// ─── Connection Types ───────────────────────────────────────────────────

export interface NmConnectionInfo {
  name: string;
  uuid: string;
  type: string;
  deviceName: string;
  state: 'up' | 'down' | 'disconnected' | 'activating' | 'deactivating';
  autoconnect: boolean;
  nettype: number;
  nettypeLabel: string;
  priority: number;
  isPhysical: boolean;
  isSlave: boolean;
  master?: string;
  description?: string;
  // IPv4
  ipv4Method: string;
  ipv4Address?: string;
  ipv4Cidr?: number;
  ipv4Gateway?: string;
  ipv4Dns?: string[];
  secondaryIps: string[];
  mtu: number;
  // VLAN
  vlanParent?: string;
  vlanId?: number;
  // Bridge
  bridgeStp?: boolean;
  bridgeForwardDelay?: number;
  // Bond
  bondMode?: string;
  bondMiimon?: number;
  bondLacpRate?: string;
  // Runtime
  filePath: string;
  // Live system data (augmented from /sys/class/net/)
  mac?: string;
  speed?: number;
  rxBytes?: number;
  txBytes?: number;
}

// ─── Scan / List ────────────────────────────────────────────────────────

/**
 * Scan .nmconnection files and merge with nmcli runtime state.
 * This is the primary method for the GUI to get all interfaces.
 */
export function scanConnections(): NmConnectionInfo[] {
  const connections: NmConnectionInfo[] = [];

  // 1. Scan .nmconnection files from disk
  if (!fs.existsSync(NM_CONNECTIONS_DIR)) {
    console.warn(`[nmcli] Connections dir not found: ${NM_CONNECTIONS_DIR}`);
    return connections;
  }

  const files = fs.readdirSync(NM_CONNECTIONS_DIR).sort();
  const slaveConnections = new Map<string, string[]>(); // master -> [slaves]

  // First pass: identify all connections and their masters
  const parsedFiles: NmConnectionFile[] = [];
  for (const entry of files) {
    if (!entry.endsWith('.nmconnection')) continue;
    const filePath = `${NM_CONNECTIONS_DIR}/${entry}`;
    try {
      if (!fs.statSync(filePath).isFile()) continue;
      const parsed = parseNmConnectionFile(filePath);
      parsedFiles.push(parsed);
      const master = getMaster(parsed);
      if (master) {
        if (!slaveConnections.has(master)) slaveConnections.set(master, []);
        slaveConnections.get(master)!.push(getInterfaceName(parsed) || parsed.name);
      }
    } catch (err) {
      console.warn(`[nmcli] Failed to parse ${filePath}:`, err);
    }
  }

  // 2. Get device runtime state via nmcli
  const deviceStates = new Map<string, string>();
  try {
    const { stdout } = execSafe('nmcli -t -f DEVICE,STATE device status 2>/dev/null');
    for (const line of stdout.split('\n').filter(Boolean)) {
      const [device, state] = line.split(':');
      if (device && state) {
        deviceStates.set(device, state);
      }
    }
  } catch {
    // nmcli might not be available in dev
  }

  // 3. Build connection info for each file
  for (const parsed of parsedFiles) {
    const ifName = getInterfaceName(parsed);
    const connId = parsed.name || ifName;
    const connType = getConnectionType(parsed);
    const nettype = getNetType(parsed);
    const priority = getPriority(parsed);
    const physical = isPhysicalInterface(parsed);
    const slave = isSlavePort(parsed);
    const master = getMaster(parsed);

    // Skip slave connections from main listing (they appear under their master)
    if (slave) continue;

    const primaryAddr = getPrimaryAddress(parsed);
    const secondaryAddrs = getSecondaryAddresses(parsed);
    const vlanInfo = getVlanInfo(parsed);
    const bridgeInfo = getBridgeInfo(parsed);
    const bondInfo = getBondInfo(parsed);
    const gateway = getIpv4Gateway(parsed);

    // DNS parsing
    let dns: string[] = [];
    const dnsVal = parsed.sections.get('ipv4')?.['dns'];
    if (dnsVal) dns = dnsVal.split(';').filter(Boolean);

    const state = deviceStates.get(ifName) || 'disconnected';
    const stateMap: Record<string, 'up' | 'down' | 'disconnected' | 'activating' | 'deactivating'> = {
      'connected': 'up',
      '100 (connected)': 'up',
      'disconnected': 'down',
      '20 (unmanaged)': 'disconnected',
      '30 (disconnected)': 'disconnected',
      'activated': 'up',
      'activating': 'activating',
      'deactivating': 'deactivating',
    };

    connections.push({
      name: connId,
      uuid: parsed.sections.get('connection')?.['uuid'] || '',
      type: connType,
      deviceName: ifName,
      state: stateMap[state] || (state.includes('connected') ? 'up' : 'down'),
      autoconnect: isAutoconnect(parsed),
      nettype: isValidNetType(nettype) ? nettype : NET_TYPES.UNUSED,
      nettypeLabel: isValidNetType(nettype) ? netTypeToLabel(nettype) : 'Unknown',
      priority,
      isPhysical: physical,
      isSlave: slave,
      master: master || undefined,
      description: getConnectionDescription(parsed) || undefined,
      ipv4Method: getIpv4Method(parsed),
      ipv4Address: primaryAddr?.ip,
      ipv4Cidr: primaryAddr?.cidr,
      ipv4Gateway: gateway || undefined,
      ipv4Dns: dns.length > 0 ? dns : undefined,
      secondaryIps: secondaryAddrs,
      mtu: getMtu(parsed),
      vlanParent: vlanInfo?.parent,
      vlanId: vlanInfo?.id,
      bridgeStp: bridgeInfo?.stp,
      bridgeForwardDelay: bridgeInfo?.forwardDelay,
      bondMode: bondInfo?.mode,
      bondMiimon: bondInfo?.miimon,
      bondLacpRate: bondInfo?.lacpRate,
      filePath: parsed.filePath,
    });
  }

  return connections;
}

// ─── StaySuite Section Preservation ────────────────────────────────────

/**
 * Backup and restore the [staysuite] section around any nmcli con mod operation.
 *
 * NetworkManager rewrites .nmconnection files on `nmcli con mod`, dropping
 * custom sections like [staysuite]. This wrapper ensures the section survives.
 *
 * Usage:
 *   withStaySuitePreserved('ens192', () => {
 *     exec('sudo nmcli con mod ens192 ipv4.method manual ...');
 *     exec('sudo nmcli con up ens192');
 *   });
 */
export function withStaySuitePreserved(name: string, fn: () => void): void {
  // 1. Backup: read current staysuite data BEFORE nmcli modifies the file
  const filePath = findConnectionFile(name);
  let savedNettype = -1;
  let savedPriority = 0;

  if (filePath) {
    try {
      const parsed = parseNmConnectionFile(filePath);
      savedNettype = getNetType(parsed);
      savedPriority = getPriority(parsed);
    } catch (e: any) {
      console.warn(`[nmcli] Failed to read staysuite before mod: ${e.message}`);
    }
  }

  // 2. Execute the nmcli modification (may rewrite and drop [staysuite])
  fn();

  // 3. Restore: if staysuite data existed, re-write it after nmcli is done
  if (savedNettype >= 0 && filePath) {
    try {
      const restored = parseNmConnectionFile(filePath);
      setNetType(restored, savedNettype);
      setPriority(restored, savedPriority);
      writeNmConnectionFile(filePath, restored);
      // Reload so NM picks up the restored staysuite section
      exec('sudo nmcli con reload', 10000);
    } catch (e: any) {
      console.error(`[nmcli] Failed to restore staysuite after mod: ${e.message}`);
    }
  }
}

// ─── Physical Interface: Read + Update Only ─────────────────────────────

/**
 * Set static IP on an existing interface.
 */
export function setStaticIP(name: string, ip: string, netmask: string, gateway?: string, dns?: string[]): void {
  sanitizeName(name);
  validateIPv4(ip);
  validateNetmask(netmask);
  if (gateway) validateIPv4(gateway);

  withStaySuitePreserved(name, () => {
    const cidr = netmaskToCidr(netmask);
    const args = [
      'con', 'mod', name,
      'ipv4.method', 'manual',
      'ipv4.addresses', `${ip}/${cidr}`,
    ];
    if (gateway) {
      validateIPv4(gateway);
      args.push('ipv4.gateway', gateway);
      args.push('ipv4.never-default', 'no');
    } else {
      args.push('ipv4.never-default', 'yes');
    }
    if (dns && dns.length > 0) {
      args.push('ipv4.dns', dns.join(','));
    }
    exec(`sudo nmcli ${args.join(' ')}`);
    exec(`sudo nmcli con up ${name}`);
  });
}

/**
 * Set DHCP on an existing interface.
 */
export function setDHCP(name: string): void {
  sanitizeName(name);
  withStaySuitePreserved(name, () => {
    exec(`sudo nmcli con mod ${name} ipv4.method auto`);
    exec(`sudo nmcli con up ${name}`);
  });
}

/**
 * Disable IP on an interface (flush + down).
 */
export function disableInterface(name: string): void {
  sanitizeName(name);
  withStaySuitePreserved(name, () => {
    exec(`sudo nmcli con mod ${name} ipv4.method disabled`);
    exec(`sudo nmcli con down ${name}`);
  });
}

/**
 * Set MTU on an interface.
 */
export function setMtu(name: string, mtu: number): void {
  sanitizeName(name);
  validateMtu(mtu);
  withStaySuitePreserved(name, () => {
    exec(`sudo nmcli con mod ${name} ethernet.mtu ${mtu}`);
    exec(`sudo nmcli con up ${name}`);
  });
}

/**
 * Bring an interface up.
 */
export function interfaceUp(name: string): void {
  sanitizeName(name);
  exec(`sudo nmcli con up ${name}`);
}

/**
 * Bring an interface down.
 */
export function interfaceDown(name: string): void {
  sanitizeName(name);
  exec(`sudo nmcli con down ${name}`);
}

// ─── Nettype / Role Management ──────────────────────────────────────────

/**
 * Set the nettype (role) on an interface by writing to the .nmconnection file.
 * Also sets it via nmcli connection description for visibility.
 */
export function setNetTypeOnInterface(name: string, nettype: number, priority: number = 0): void {
  sanitizeName(name);
  if (!isValidNetType(nettype)) throw new Error(`Invalid nettype: ${nettype}`);

  // 1. Find and modify the .nmconnection file
  const filePath = findConnectionFile(name);
  if (filePath) {
    const parsed = parseNmConnectionFile(filePath);
    setNetType(parsed, nettype);
    setPriority(parsed, priority);
    writeNmConnectionFile(filePath, parsed);
    // Reload so NM picks up the change
    exec('sudo nmcli con reload', 10000);
  } else {
    // File not found — create via nmcli and write staysuite section
    throw new Error(`Connection file not found for: ${name}`);
  }
}

/**
 * Get the nettype from an interface's .nmconnection file.
 */
export function getNetTypeFromInterface(name: string): number {
  sanitizeName(name);
  const filePath = findConnectionFile(name);
  if (!filePath) return -1;
  const parsed = parseNmConnectionFile(filePath);
  return getNetType(parsed);
}

function findConnectionFile(name: string): string | null {
  const directPath = `${NM_CONNECTIONS_DIR}/${name}.nmconnection`;
  if (fs.existsSync(directPath)) return directPath;

  // Search by connection ID (might differ from interface name)
  if (fs.existsSync(NM_CONNECTIONS_DIR)) {
    const entries = fs.readdirSync(NM_CONNECTIONS_DIR);
    for (const entry of entries) {
      if (!entry.endsWith('.nmconnection')) continue;
      try {
        const parsed = parseNmConnectionFile(`${NM_CONNECTIONS_DIR}/${entry}`);
        const connId = parsed.sections.get('connection')?.['id'];
        const ifName = getInterfaceName(parsed);
        if (connId === name || ifName === name) {
          return `${NM_CONNECTIONS_DIR}/${entry}`;
        }
      } catch { continue; }
    }
  }
  return null;
}

// ─── IP Aliases (Secondary IPs) ─────────────────────────────────────────

/**
 * Add a secondary IP to an interface.
 */
export function addSecondaryIP(name: string, ip: string, cidr: number): void {
  sanitizeName(name);
  validateIPv4(ip);
  withStaySuitePreserved(name, () => {
    exec(`sudo nmcli con mod ${name} +ipv4.addresses ${ip}/${cidr}`);
    exec(`sudo nmcli con up ${name}`);
  });
}

/**
 * Remove a secondary IP from an interface.
 */
export function removeSecondaryIP(name: string, ip: string, cidr: number): void {
  sanitizeName(name);
  validateIPv4(ip);
  withStaySuitePreserved(name, () => {
    exec(`sudo nmcli con mod ${name} -ipv4.addresses ${ip}/${cidr}`);
  });
}

// ─── VLAN: Full CRUD ────────────────────────────────────────────────────

export interface VlanCreateParams {
  parentInterface: string;
  vlanId: number;
  name?: string;
  ipAddress?: string;
  netmask?: string;
  gateway?: string;
  mtu?: number;
  nettype?: number;
}

/**
 * Create a VLAN interface via nmcli.
 */
export function createVlan(params: VlanCreateParams): { name: string; success: boolean; error?: string } {
  const {
    parentInterface, vlanId, name: providedName,
    ipAddress, netmask: providedNetmask, gateway, mtu, nettype,
  } = params;

  sanitizeName(parentInterface);
  validateVlanId(vlanId);

  const vlanName = providedName || `${parentInterface}.${vlanId}`;
  sanitizeName(vlanName);

  const args = [
    'con', 'add', 'type', 'vlan',
    'con-name', vlanName,
    'ifname', vlanName,
    'dev', parentInterface,
    'id', String(vlanId),
    'autoconnect', 'yes',
  ];

  if (mtu && mtu !== 1500) {
    args.push('vlan.mtu', String(mtu));
  }

  if (ipAddress) {
    validateIPv4(ipAddress);
    const cidr = providedNetmask ? netmaskToCidr(providedNetmask) : 24;
    args.push('ipv4.method', 'manual');
    args.push('ipv4.addresses', `${ipAddress}/${cidr}`);
    if (gateway) {
      validateIPv4(gateway);
      args.push('ipv4.gateway', gateway);
    }
  }

  try {
    exec(`sudo nmcli ${args.join(' ')}`);
  } catch (e: any) {
    return { name: vlanName, success: false, error: e.message };
  }

  // Set nettype if provided
  if (nettype !== undefined && isValidNetType(nettype)) {
    try {
      setNetTypeOnInterface(vlanName, nettype);
    } catch (e: any) {
      console.warn(`[nmcli] Failed to set nettype on VLAN: ${e.message}`);
    }
  }

  // Bring up
  try { exec(`sudo nmcli con up ${vlanName}`); } catch { /* may fail if parent is down */ }

  return { name: vlanName, success: true };
}

/**
 * Update a VLAN interface.
 */
export function updateVlan(name: string, params: Partial<VlanCreateParams>): void {
  sanitizeName(name);
  withStaySuitePreserved(name, () => {
    if (params.ipAddress) {
      validateIPv4(params.ipAddress);
      const cidr = params.netmask ? netmaskToCidr(params.netmask) : 24;
      exec(`sudo nmcli con mod ${name} ipv4.method manual ipv4.addresses ${params.ipAddress}/${cidr}`);
      if (params.gateway) {
        validateIPv4(params.gateway);
        exec(`sudo nmcli con mod ${name} ipv4.gateway ${params.gateway}`);
      }
    }
    if (params.mtu) {
      validateMtu(params.mtu);
      exec(`sudo nmcli con mod ${name} vlan.mtu ${params.mtu}`);
    }
  });
  if (params.nettype !== undefined && isValidNetType(params.nettype)) {
    setNetTypeOnInterface(name, params.nettype);
  }
  try { exec(`sudo nmcli con up ${name}`); } catch {}
}

/**
 * Delete a VLAN interface.
 */
export function deleteVlan(name: string): void {
  sanitizeName(name);
  exec(`sudo nmcli con down ${name} 2>/dev/null || true`);
  exec(`sudo nmcli con delete ${name}`);
}

// ─── Bridge: Full CRUD ──────────────────────────────────────────────────

export interface BridgeCreateParams {
  name: string;
  stp?: boolean;
  forwardDelay?: number;
  members?: string[];
  ipAddress?: string;
  netmask?: string;
  gateway?: string;
  mtu?: number;
  nettype?: number;
}

/**
 * Create a bridge via nmcli.
 */
export function createBridge(params: BridgeCreateParams): { name: string; success: boolean; error?: string } {
  const { name, stp = false, forwardDelay = 15, members = [], ipAddress, netmask, gateway, mtu, nettype } = params;
  sanitizeName(name);

  const args = [
    'con', 'add', 'type', 'bridge',
    'con-name', name,
    'ifname', name,
    'stp', stp ? 'yes' : 'no',
    'forward-delay', String(forwardDelay),
    'autoconnect', 'yes',
  ];

  if (ipAddress) {
    validateIPv4(ipAddress);
    const cidr = netmask ? netmaskToCidr(netmask) : 24;
    args.push('ipv4.method', 'manual');
    args.push('ipv4.addresses', `${ipAddress}/${cidr}`);
    if (gateway) {
      validateIPv4(gateway);
      args.push('ipv4.gateway', gateway);
    }
  }

  if (mtu && mtu !== 1500) {
    validateMtu(mtu);
    args.push('bridge.mtu', String(mtu));
  }

  try {
    exec(`sudo nmcli ${args.join(' ')}`);
  } catch (e: any) {
    return { name, success: false, error: e.message };
  }

  // Add members
  for (const member of members) {
    try {
      sanitizeName(member);
      exec(`sudo nmcli con add type ethernet con-name ${name}-port-${member} ifname ${member} master ${name}`);
    } catch (e: any) {
      console.warn(`[nmcli] Failed to add member ${member} to bridge ${name}: ${e.message}`);
    }
  }

  // Set nettype
  if (nettype !== undefined && isValidNetType(nettype)) {
    try { setNetTypeOnInterface(name, nettype); } catch {}
  }

  try { exec(`sudo nmcli con up ${name}`); } catch {}

  return { name, success: true };
}

/**
 * Update a bridge.
 */
export function updateBridge(name: string, params: Partial<BridgeCreateParams>): void {
  sanitizeName(name);
  withStaySuitePreserved(name, () => {
    if (params.ipAddress) {
      validateIPv4(params.ipAddress);
      const cidr = params.netmask ? netmaskToCidr(params.netmask) : 24;
      exec(`sudo nmcli con mod ${name} ipv4.method manual ipv4.addresses ${params.ipAddress}/${cidr}`);
      if (params.gateway) {
        validateIPv4(params.gateway);
        exec(`sudo nmcli con mod ${name} ipv4.gateway ${params.gateway}`);
      }
    }
    if (params.stp !== undefined) {
      exec(`sudo nmcli con mod ${name} bridge.stp ${params.stp ? 'yes' : 'no'}`);
    }
  });
  if (params.nettype !== undefined && isValidNetType(params.nettype)) {
    setNetTypeOnInterface(name, params.nettype);
  }
  try { exec(`sudo nmcli con up ${name}`); } catch {}
}

/**
 * Add a member to a bridge.
 */
export function addBridgeMember(bridgeName: string, memberName: string): void {
  sanitizeName(bridgeName);
  sanitizeName(memberName);
  exec(`sudo nmcli con add type ethernet con-name ${bridgeName}-port-${memberName} ifname ${memberName} master ${bridgeName}`);
  exec(`sudo nmcli con up ${bridgeName}-port-${memberName}`);
}

/**
 * Remove a member from a bridge.
 */
export function removeBridgeMember(bridgeName: string, memberName: string): void {
  sanitizeName(bridgeName);
  sanitizeName(memberName);
  const portConName = `${bridgeName}-port-${memberName}`;
  exec(`sudo nmcli con down ${portConName} 2>/dev/null || true`);
  exec(`sudo nmcli con delete ${portConName}`);
}

/**
 * Delete a bridge.
 */
export function deleteBridge(name: string): void {
  sanitizeName(name);
  // First remove all ports
  const { stdout, ok } = execSafe(`nmcli -t -f NAME,TYPE con show 2>/dev/null`);
  if (ok) {
    for (const line of stdout.split('\n').filter(Boolean)) {
      const [conName, conType] = line.split(':');
      if (conName.startsWith(`${name}-port-`) && conType === '802-3-ethernet') {
        exec(`sudo nmcli con delete ${conName} 2>/dev/null || true`);
      }
    }
  }
  exec(`sudo nmcli con down ${name} 2>/dev/null || true`);
  exec(`sudo nmcli con delete ${name}`);
}

// ─── Bond: Full CRUD ────────────────────────────────────────────────────

export interface BondCreateParams {
  name: string;
  mode?: string;
  miimon?: number;
  lacpRate?: string;
  primary?: string;
  members?: string[];
  ipAddress?: string;
  netmask?: string;
  gateway?: string;
  mtu?: number;
  nettype?: number;
}

/**
 * Create a bond via nmcli.
 */
export function createBond(params: BondCreateParams): { name: string; success: boolean; error?: string } {
  const {
    name, mode = 'active-backup', miimon = 100, lacpRate = 'slow',
    primary, members = [], ipAddress, netmask, gateway, mtu, nettype,
  } = params;
  sanitizeName(name);
  validateBondMode(mode);

  const args = [
    'con', 'add', 'type', 'bond',
    'con-name', name,
    'ifname', name,
    'mode', mode,
    'miimon', String(miimon),
    'autoconnect', 'yes',
  ];

  if (mode === '802.3ad' || mode === 'balance-xor') {
    args.push('lacp-rate', lacpRate);
  }
  if (primary) {
    args.push('+bond.primary', primary);
  }

  if (ipAddress) {
    validateIPv4(ipAddress);
    const cidr = netmask ? netmaskToCidr(netmask) : 24;
    args.push('ipv4.method', 'manual');
    args.push('ipv4.addresses', `${ipAddress}/${cidr}`);
    if (gateway) {
      validateIPv4(gateway);
      args.push('ipv4.gateway', gateway);
    }
  }

  if (mtu && mtu !== 1500) {
    validateMtu(mtu);
    args.push('bond.mtu', String(mtu));
  }

  try {
    exec(`sudo nmcli ${args.join(' ')}`);
  } catch (e: any) {
    return { name, success: false, error: e.message };
  }

  // Add members
  for (const member of members) {
    try {
      sanitizeName(member);
      exec(`sudo nmcli con add type ethernet con-name ${name}-slave-${member} ifname ${member} master ${name}`);
    } catch (e: any) {
      console.warn(`[nmcli] Failed to add member ${member} to bond ${name}: ${e.message}`);
    }
  }

  // Set nettype
  if (nettype !== undefined && isValidNetType(nettype)) {
    try { setNetTypeOnInterface(name, nettype); } catch {}
  }

  try { exec(`sudo nmcli con up ${name}`); } catch {}

  return { name, success: true };
}

/**
 * Update a bond.
 */
export function updateBond(name: string, params: Partial<BondCreateParams>): void {
  sanitizeName(name);
  withStaySuitePreserved(name, () => {
    if (params.ipAddress) {
      validateIPv4(params.ipAddress);
      const cidr = params.netmask ? netmaskToCidr(params.netmask) : 24;
      exec(`sudo nmcli con mod ${name} ipv4.method manual ipv4.addresses ${params.ipAddress}/${cidr}`);
      if (params.gateway) {
        validateIPv4(params.gateway);
        exec(`sudo nmcli con mod ${name} ipv4.gateway ${params.gateway}`);
      }
    }
    if (params.mode) {
      validateBondMode(params.mode);
      exec(`sudo nmcli con mod ${name} bond.mode ${params.mode}`);
    }
  });
  if (params.nettype !== undefined && isValidNetType(params.nettype)) {
    setNetTypeOnInterface(name, params.nettype);
  }
  try { exec(`sudo nmcli con up ${name}`); } catch {}
}

/**
 * Add a member to a bond.
 */
export function addBondMember(bondName: string, memberName: string): void {
  sanitizeName(bondName);
  sanitizeName(memberName);
  exec(`sudo nmcli con add type ethernet con-name ${bondName}-slave-${memberName} ifname ${memberName} master ${bondName}`);
  exec(`sudo nmcli con up ${bondName}-slave-${memberName}`);
}

/**
 * Remove a member from a bond.
 */
export function removeBondMember(bondName: string, memberName: string): void {
  sanitizeName(bondName);
  sanitizeName(memberName);
  const slaveConName = `${bondName}-slave-${memberName}`;
  exec(`sudo nmcli con down ${slaveConName} 2>/dev/null || true`);
  exec(`sudo nmcli con delete ${slaveConName}`);
}

/**
 * Delete a bond.
 */
export function deleteBond(name: string): void {
  sanitizeName(name);
  // First remove all slaves
  const { stdout, ok } = execSafe(`nmcli -t -f NAME,TYPE con show 2>/dev/null`);
  if (ok) {
    for (const line of stdout.split('\n').filter(Boolean)) {
      const [conName, conType] = line.split(':');
      if (conName.startsWith(`${name}-slave-`) && conType === '802-3-ethernet') {
        exec(`sudo nmcli con delete ${conName} 2>/dev/null || true`);
      }
    }
  }
  exec(`sudo nmcli con down ${name} 2>/dev/null || true`);
  exec(`sudo nmcli con delete ${name}`);
}

// ─── Routes ─────────────────────────────────────────────────────────────

/**
 * Add a static route to an interface.
 */
export function addRoute(name: string, destination: string, gateway: string, metric?: number): void {
  sanitizeName(name);
  const metricArg = metric !== undefined ? ` ${metric}` : '';
  withStaySuitePreserved(name, () => {
    exec(`sudo nmcli con mod ${name} +ipv4.routes "${destination} ${gateway}${metricArg}"`);
    // Bring the connection up so the route becomes active immediately
    try { exec(`sudo nmcli con up ${name}`); } catch {}
  });
}

/**
 * Remove a static route from an interface.
 */
export function removeRoute(name: string, destination: string, gateway: string): void {
  sanitizeName(name);
  withStaySuitePreserved(name, () => {
    exec(`sudo nmcli con mod ${name} -ipv4.routes "${destination} ${gateway}"`);
  });
}

// ─── Multi-WAN ──────────────────────────────────────────────────────────

/**
 * Set route metric for WAN interface priority (lower = higher priority).
 */
export function setRouteMetric(name: string, metric: number): void {
  sanitizeName(name);
  withStaySuitePreserved(name, () => {
    exec(`sudo nmcli con mod ${name} ipv4.route-metric ${metric}`);
  });
}

// ─── Device Status ──────────────────────────────────────────────────────

/**
 * Get all device statuses from nmcli.
 */
export function getDeviceStatus(): Array<{ device: string; type: string; state: string; connection: string }> {
  const { stdout, ok } = execSafe('nmcli -t -f DEVICE,TYPE,STATE,CONNECTION device status 2>/dev/null');
  if (!ok) return [];
  return stdout.split('\n').filter(Boolean).map(line => {
    const [device, type, state, connection] = line.split(':');
    return { device, type, state, connection: connection || '--' };
  });
}

// ─── Connection Reload ──────────────────────────────────────────────────

/**
 * Reload all connection profiles (pick up .nmconnection file changes).
 */
export function reloadConnections(): void {
  exec('sudo nmcli con reload', 10000);
}

/**
 * Reload a specific connection.
 */
export function reloadConnection(name: string): void {
  sanitizeName(name);
  reloadConnections();
  try { exec(`sudo nmcli con up ${name}`); } catch {}
}
