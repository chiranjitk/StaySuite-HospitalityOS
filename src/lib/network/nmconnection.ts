/**
 * .nmconnection File Parser and Writer
 *
 * Parses INI-style .nmconnection files used by NetworkManager on Rocky Linux 10.
 * Handles the [staysuite] custom section for nettype role mapping.
 *
 * File format:
 *   [section-name]
 *   key=value
 *   key=value
 */

import * as fs from 'fs';
import { NM_CONNECTIONS_DIR, NM_CONNECTION_SUFFIX } from './nettypes';

export interface NmConnectionSection {
  [key: string]: string;
}

export interface NmConnectionFile {
  /** File path on disk */
  filePath: string;
  /** Connection profile name (filename without .nmconnection) */
  name: string;
  /** Parsed sections */
  sections: Map<string, NmConnectionSection>;
}

/** Common section keys we care about */
export const SECTION = {
  CONNECTION: 'connection',
  IPV4: 'ipv4',
  IPV6: 'ipv6',
  ETHERNET: 'ethernet',
  VLAN: 'vlan',
  BRIDGE: 'bridge',
  BOND: 'bond',
  STAYSUITE: 'staysuite',
  '802-3-ethernet': '802-3-ethernet',
  'bridge-port': 'bridge-port',
  'bond-port': 'bond-port',
} as const;

// ─── Parser ────────────────────────────────────────────────────────────

/**
 * Parse a .nmconnection file into structured data.
 * Handles comments (# and ;), empty lines, multi-word values.
 */
export function parseNmConnectionFile(filePath: string): NmConnectionFile {
  const content = fs.readFileSync(filePath, 'utf-8');
  return parseNmConnectionContent(content, filePath);
}

/**
 * Parse .nmconnection content string into structured data.
 */
export function parseNmConnectionContent(content: string, filePath: string = ''): NmConnectionFile {
  const lines = content.split('\n');
  const sections = new Map<string, NmConnectionSection>();
  let currentSection = '';

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Skip empty lines and comments
    if (!line || line.startsWith('#') || line.startsWith(';')) continue;

    // Section header
    const sectionMatch = line.match(/^\[(.+)\]$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1].trim();
      if (!sections.has(currentSection)) {
        sections.set(currentSection, {});
      }
      continue;
    }

    // Key=value pair
    const eqIdx = line.indexOf('=');
    if (eqIdx > 0) {
      const key = line.substring(0, eqIdx).trim();
      const value = line.substring(eqIdx + 1).trim();
      if (!currentSection) {
        // Keys before any section — put in a default section
        if (!sections.has('_')) sections.set('_', {});
        sections.get('_')![key] = value;
      } else {
        sections.get(currentSection)![key] = value;
      }
    }
  }

  const name = filePath
    ? filePath.split('/').pop()?.replace(NM_CONNECTION_SUFFIX, '') || ''
    : '';

  return { filePath, name, sections };
}

// ─── Writer ────────────────────────────────────────────────────────────

/**
 * Convert parsed sections back to .nmconnection file content.
 * Preserves section order from the Map.
 */
export function nmConnectionToString(parsed: NmConnectionFile): string {
  const lines: string[] = [];

  for (const [sectionName, keys] of parsed.sections) {
    lines.push('');
    lines.push(`[${sectionName}]`);
    for (const [key, value] of Object.entries(keys)) {
      lines.push(`${key}=${value}`);
    }
  }

  // Add trailing newline
  if (lines.length > 0) lines.push('');
  return lines.join('\n');
}

/**
 * Write an .nmconnection file to disk.
 * Sets permissions to 600 (root-only, as NM requires).
 */
export function writeNmConnectionFile(filePath: string, parsed: NmConnectionFile): void {
  const content = nmConnectionToString(parsed);
  const dir = filePath.substring(0, filePath.lastIndexOf('/'));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf-8');
  // NM requires 600 permissions on connection files
  fs.chmodSync(filePath, 0o600);
}

// ─── Scanner ────────────────────────────────────────────────────────────

/**
 * Scan the NetworkManager connections directory for all .nmconnection files.
 * Returns parsed data for each file.
 */
export function scanNmConnectionDir(dir: string = NM_CONNECTIONS_DIR): NmConnectionFile[] {
  const files: NmConnectionFile[] = [];
  if (!fs.existsSync(dir)) return files;

  const entries = fs.readdirSync(dir).sort();
  for (const entry of entries) {
    if (!entry.endsWith(NM_CONNECTION_SUFFIX)) continue;
    const filePath = `${dir}/${entry}`;
    try {
      const parsed = parseNmConnectionFile(filePath);
      files.push(parsed);
    } catch (err) {
      console.warn(`[NmConnection] Failed to parse ${filePath}:`, err);
    }
  }
  return files;
}

// ─── Section Helpers ────────────────────────────────────────────────────

/** Get a section value by section name and key. Returns empty string if not found. */
export function getSectionValue(parsed: NmConnectionFile, section: string, key: string): string {
  return parsed.sections.get(section)?.[key] || '';
}

/** Set a section value. Creates section if it doesn't exist. */
export function setSectionValue(
  parsed: NmConnectionFile,
  section: string,
  key: string,
  value: string,
): void {
  if (!parsed.sections.has(section)) {
    parsed.sections.set(section, {});
  }
  parsed.sections.get(section)![key] = value;
}

/** Remove a key from a section. */
export function removeSectionKey(
  parsed: NmConnectionFile,
  section: string,
  key: string,
): void {
  const sec = parsed.sections.get(section);
  if (sec) delete sec[key];
}

// ─── StaySuite Helpers ─────────────────────────────────────────────────

/** Read the nettype from the [staysuite] section. Returns -1 if not set. */
export function getNetType(parsed: NmConnectionFile): number {
  const val = getSectionValue(parsed, SECTION.STAYSUITE, 'nettype');
  const num = parseInt(val, 10);
  return isNaN(num) ? -1 : num;
}

/** Set the nettype in the [staysuite] section. */
export function setNetType(parsed: NmConnectionFile, nettype: number): void {
  setSectionValue(parsed, SECTION.STAYSUITE, 'nettype', String(nettype));
}

/** Read the priority from [staysuite] section. Returns 0 if not set. */
export function getPriority(parsed: NmConnectionFile): number {
  const val = getSectionValue(parsed, SECTION.STAYSUITE, 'priority');
  const num = parseInt(val, 10);
  return isNaN(num) ? 0 : num;
}

/** Set the priority in the [staysuite] section. */
export function setPriority(parsed: NmConnectionFile, priority: number): void {
  setSectionValue(parsed, SECTION.STAYSUITE, 'priority', String(priority));
}

// ─── Connection Type Helpers ────────────────────────────────────────────

/** Get the connection type (e.g., 'ethernet', 'vlan', 'bridge', 'bond'). */
export function getConnectionType(parsed: NmConnectionFile): string {
  return getSectionValue(parsed, SECTION.CONNECTION, 'type');
}

/** Get the interface name. */
export function getInterfaceName(parsed: NmConnectionFile): string {
  return getSectionValue(parsed, SECTION.CONNECTION, 'interface-name');
}

/** Get the connection description from [connection] section. */
export function getConnectionDescription(parsed: NmConnectionFile): string {
  return getSectionValue(parsed, SECTION.CONNECTION, 'description');
}

/** Get the connection ID. */
export function getConnectionId(parsed: NmConnectionFile): string {
  return getSectionValue(parsed, SECTION.CONNECTION, 'id');
}

/** Check if autoconnect is enabled. */
export function isAutoconnect(parsed: NmConnectionFile): boolean {
  const val = getSectionValue(parsed, SECTION.CONNECTION, 'autoconnect');
  return val === 'true';
}

/** Get IPv4 method ('manual', 'auto', 'disabled', 'shared'). */
export function getIpv4Method(parsed: NmConnectionFile): string {
  return getSectionValue(parsed, SECTION.IPV4, 'method');
}

/** Get all IPv4 addresses from address1, address2, etc. */
export function getIpv4Addresses(parsed: NmConnectionFile): string[] {
  const addresses: string[] = [];
  const sec = parsed.sections.get(SECTION.IPV4);
  if (!sec) return addresses;
  let i = 1;
  while (sec[`address${i}`]) {
    addresses.push(sec[`address${i}`]);
    i++;
  }
  return addresses;
}

/** Get primary IPv4 address (address1) as { ip, cidr } or null. */
export function getPrimaryAddress(parsed: NmConnectionFile): { ip: string; cidr: number } | null {
  const addr = getSectionValue(parsed, SECTION.IPV4, 'address1');
  if (!addr) return null;
  const slashIdx = addr.indexOf('/');
  if (slashIdx < 0) return { ip: addr, cidr: 24 };
  return {
    ip: addr.substring(0, slashIdx),
    cidr: parseInt(addr.substring(slashIdx + 1), 10) || 24,
  };
}

/** Get secondary IPs (address2, address3, ...). */
export function getSecondaryAddresses(parsed: NmConnectionFile): string[] {
  return getIpv4Addresses(parsed).slice(1);
}

/** Get IPv4 gateway. */
export function getIpv4Gateway(parsed: NmConnectionFile): string {
  return getSectionValue(parsed, SECTION.IPV4, 'gateway');
}

/** Get DNS servers (semicolon-separated in nmcli format). */
export function getDnsServers(parsed: NmConnectionFile): string[] {
  const dns = getSectionValue(parsed, SECTION.IPV4, 'dns');
  if (!dns) return [];
  return dns.split(';').filter(Boolean);
}

/** Get MTU from ethernet section. */
export function getMtu(parsed: NmConnectionFile): number {
  // Check both 'ethernet' and '802-3-ethernet' sections
  const mtu = getSectionValue(parsed, SECTION.ETHERNET, 'mtu')
    || getSectionValue(parsed, SECTION['802-3-ethernet'], 'mtu');
  return parseInt(mtu, 10) || 1500;
}

/** Get VLAN parent and ID. */
export function getVlanInfo(parsed: NmConnectionFile): { parent: string; id: number } | null {
  const type = getConnectionType(parsed);
  if (type !== 'vlan') return null;
  const parent = getSectionValue(parsed, SECTION.VLAN, 'parent');
  const id = parseInt(getSectionValue(parsed, SECTION.VLAN, 'id'), 10);
  if (!parent || isNaN(id)) return null;
  return { parent, id };
}

/** Get Bridge STP and forward-delay. */
export function getBridgeInfo(parsed: NmConnectionFile): { stp: boolean; forwardDelay: number } | null {
  const type = getConnectionType(parsed);
  if (type !== 'bridge') return null;
  const stp = getSectionValue(parsed, SECTION.BRIDGE, 'stp') === 'true';
  const forwardDelay = parseInt(getSectionValue(parsed, SECTION.BRIDGE, 'forward-delay'), 10) || 15;
  return { stp, forwardDelay };
}

/** Get Bond mode, miimon, lacp-rate. */
export function getBondInfo(parsed: NmConnectionFile): { mode: string; miimon: number; lacpRate: string } | null {
  const type = getConnectionType(parsed);
  if (type !== 'bond') return null;
  const mode = getSectionValue(parsed, SECTION.BOND, 'mode');
  const miimon = parseInt(getSectionValue(parsed, SECTION.BOND, 'miimon'), 10) || 100;
  const lacpRate = getSectionValue(parsed, SECTION.BOND, 'lacp-rate') || 'slow';
  if (!mode) return null;
  return { mode, miimon, lacpRate };
}

/** Get master (bridge or bond) from bridge-port or bond-port section. */
export function getMaster(parsed: NmConnectionFile): string | null {
  return getSectionValue(parsed, SECTION['bridge-port'], 'master')
    || getSectionValue(parsed, SECTION['bond-port'], 'master')
    || null;
}

/** Get static routes from ipv4 routes key (semicolon-separated). */
export function getRoutes(parsed: NmConnectionFile): string[] {
  const routes = getSectionValue(parsed, SECTION.IPV4, 'routes');
  if (!routes) return [];
  return routes.split(';').filter(Boolean);
}

/** Check if this is a slave/port connection (belongs to a bridge or bond). */
export function isSlavePort(parsed: NmConnectionFile): boolean {
  return parsed.sections.has(SECTION['bridge-port']) || parsed.sections.has(SECTION['bond-port']);
}

/** Determine if a connection represents a physical interface. */
export function isPhysicalInterface(parsed: NmConnectionFile): boolean {
  const type = getConnectionType(parsed);
  const ifName = getInterfaceName(parsed);
  if (type !== 'ethernet') return false;
  if (isSlavePort(parsed)) return false;
  // Physical interfaces don't have . in name (that's VLAN) and don't start with br/bond
  if (ifName.includes('.')) return false;
  if (ifName.startsWith('br') || ifName.startsWith('bond')) return false;
  if (ifName === 'lo') return false;
  return true;
}
