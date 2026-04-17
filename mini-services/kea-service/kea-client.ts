/**
 * Kea DHCP4 Unix Socket Client
 *
 * Communicates with Kea DHCP4 server via its control socket
 * using the Kea Control Agent protocol (JSON over unix domain socket).
 * Also reads lease data directly from the memfile CSV.
 */

import * as net from 'net';
import * as fs from 'fs';

import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = typeof __filename !== 'undefined' ? __filename : fileURLToPath(import.meta.url);
const __dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(__filename);
const PROJECT_ROOT = process.env.PROJECT_ROOT || path.resolve(__dirname, '..', '..');

const KEA_SOCKET_PATH = '/tmp/kea/kea4-ctrl-socket';
const KEA_CONFIG_PATH = path.join(PROJECT_ROOT, 'kea-local', 'kea-dhcp4.conf');
const KEA_BINARY_PATH = path.join(PROJECT_ROOT, 'kea-local', 'extracted', 'usr', 'sbin', 'kea-dhcp4');
const KEA_LEASES_FILE = '/tmp/lib/kea/kea-leases4.csv';
const COMMAND_TIMEOUT = 5000;

export { KEA_SOCKET_PATH, KEA_CONFIG_PATH, KEA_BINARY_PATH, KEA_LEASES_FILE };

export interface KeaResponse {
  result: number;  // 0=success, 1=error, 2=not supported, 3=empty
  text: string;
  arguments?: any;
}

export interface KeaSubnet {
  id: number;
  subnet: string;
  pools: Array<{ pool: string }>;
  'option-data'?: Array<{ name: string; data: string }>;
  reservations?: Array<{
    'hw-address': string;
    'ip-address': string;
    hostname?: string;
    'client-classes'?: string[];
  }>;
  'valid-lifetime'?: number;
  'renew-timer'?: number;
  'rebind-timer'?: number;
}

export interface MemfileLease {
  address: string;
  hwaddr: string;
  clientId: string;
  validLifetime: number;
  expire: number;
  subnetId: number;
  fqdnFwd: boolean;
  fqdnRev: boolean;
  hostname: string;
  state: number;  // 0=default/active, 1=declined, 2=expired-reclaimed
  userContext: string;
  poolId: number;
}

/**
 * Send a command to Kea DHCP4 via unix domain socket
 */
export function sendKeaCommand(command: Record<string, any>): Promise<KeaResponse[]> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      ...command,
      service: command.service || ['dhcp4'],
    });

    const client = net.createConnection(KEA_SOCKET_PATH, () => {
      client.write(payload + '\n');
    });

    let data = '';
    client.on('data', (chunk: Buffer) => {
      data += chunk.toString();
    });

    client.on('end', () => {
      try {
        const response = JSON.parse(data);
        resolve(Array.isArray(response) ? response : [response]);
      } catch (e) {
        reject(new Error(`Failed to parse Kea response: ${data.substring(0, 200)}`));
      }
    });

    client.on('error', (err: Error) => {
      reject(new Error(`Kea socket error: ${err.message}`));
    });

    client.setTimeout(COMMAND_TIMEOUT, () => {
      client.destroy();
      reject(new Error('Kea command timeout'));
    });
  });
}

/**
 * Check if Kea is reachable via its control socket
 */
export async function isKeaReachable(): Promise<boolean> {
  try {
    const response = await sendKeaCommand({ command: 'status-get' });
    return response[0]?.result === 0;
  } catch {
    return false;
  }
}

/**
 * Get Kea version
 */
export async function getKeaVersion(): Promise<string> {
  try {
    const response = await sendKeaCommand({ command: 'version-get' });
    if (response[0]?.result === 0 && response[0]?.arguments) {
      return response[0].arguments.extended || response[0].text || 'Unknown';
    }
    return 'Unknown';
  } catch {
    return 'Unknown';
  }
}

/**
 * Get Kea server status
 */
export async function getKeaStatus(): Promise<any> {
  try {
    const response = await sendKeaCommand({ command: 'status-get' });
    if (response[0]?.result === 0) {
      return response[0].arguments || {};
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Get full running configuration
 */
export async function getKeaConfig(): Promise<any> {
  try {
    const response = await sendKeaCommand({ command: 'config-get' });
    if (response[0]?.result === 0) {
      return response[0].arguments || {};
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Set full configuration (requires complete Dhcp4 object)
 */
export async function setKeaConfig(dhcp4Config: any): Promise<KeaResponse> {
  const response = await sendKeaCommand({
    command: 'config-set',
    arguments: { Dhcp4: dhcp4Config },
  });
  return response[0];
}

/**
 * Read leases directly from the memfile CSV
 */
export function readLeasesFromMemfile(): MemfileLease[] {
  try {
    const content = fs.readFileSync(KEA_LEASES_FILE, 'utf-8');
    const lines = content.trim().split('\n');
    if (lines.length <= 1) return []; // Only header

    const header = lines[0].split(',');
    const leases: MemfileLease[] = [];

    for (let i = 1; i < lines.length; i++) {
      const fields = lines[i].split(',');
      if (fields.length < 10) continue;

      leases.push({
        address: fields[0] || '',
        hwaddr: fields[1] || '',
        clientId: fields[2] || '',
        validLifetime: parseInt(fields[3]) || 3600,
        expire: parseInt(fields[4]) || 0,
        subnetId: parseInt(fields[5]) || 0,
        fqdnFwd: fields[6] === '1',
        fqdnRev: fields[7] === '1',
        hostname: fields[8] || '',
        state: parseInt(fields[9]) || 0,
        userContext: fields[10] || '',
        poolId: parseInt(fields[11]) || 0,
      });
    }

    return leases;
  } catch {
    return [];
  }
}

/**
 * Get lease counts per subnet from statistics or memfile
 */
export async function getLeaseCountsBySubnet(): Promise<Record<number, number>> {
  // Try memfile first
  const leases = readLeasesFromMemfile();
  if (leases.length > 0) {
    const counts: Record<number, number> = {};
    for (const lease of leases) {
      if (lease.state === 0) { // Only active leases
        counts[lease.subnetId] = (counts[lease.subnetId] || 0) + 1;
      }
    }
    return counts;
  }

  // Fallback: try statistics
  try {
    const response = await sendKeaCommand({ command: 'statistic-get-all' });
    if (response[0]?.result === 0 && response[0]?.arguments) {
      const stats = response[0].arguments;
      const counts: Record<number, number> = {};

      // Look for per-subnet assigned addresses stats
      for (const [key, value] of Object.entries(stats)) {
        if (key.startsWith('subnet[id') && key.includes('].assigned-addresses')) {
          const match = key.match(/subnet\[id=(\d+)\]/);
          if (match) {
            const subnetId = parseInt(match[1]);
            const val = value as Array<[string, string]>;
            if (val && val.length > 0 && val[0]) {
              counts[subnetId] = parseInt(val[0][1]) || 0;
            }
          }
        }
      }
      return counts;
    }
  } catch {}

  return {};
}

/**
 * Reload configuration from file
 */
export async function reloadConfig(): Promise<KeaResponse> {
  const response = await sendKeaCommand({ command: 'config-reload' });
  return response[0];
}

/**
 * Write running configuration to file
 */
export async function writeConfig(): Promise<KeaResponse> {
  const response = await sendKeaCommand({ command: 'config-write' });
  return response[0];
}

/**
 * Enable DHCP service
 */
export async function enableDhcp(): Promise<KeaResponse> {
  const response = await sendKeaCommand({
    command: 'dhcp-enable',
    arguments: { 'max-period': 0 },
  });
  return response[0];
}

/**
 * Disable DHCP service
 */
export async function disableDhcp(): Promise<KeaResponse> {
  const response = await sendKeaCommand({
    command: 'dhcp-disable',
    arguments: { 'max-period': 60 },
  });
  return response[0];
}

/**
 * Reclaim expired leases
 */
export async function reclaimLeases(): Promise<KeaResponse> {
  const response = await sendKeaCommand({
    command: 'leases-reclaim',
    arguments: { remove: true },
  });
  return response[0];
}

/**
 * Shutdown Kea server
 */
export async function shutdownKea(): Promise<KeaResponse> {
  const response = await sendKeaCommand({
    command: 'shutdown',
    arguments: { exit: 0 },
  });
  return response[0];
}

/**
 * Get all statistics
 */
export async function getAllStats(): Promise<any> {
  try {
    const response = await sendKeaCommand({ command: 'statistic-get-all' });
    if (response[0]?.result === 0) {
      return response[0].arguments || {};
    }
    return {};
  } catch {
    return {};
  }
}

/**
 * Get a specific statistic
 */
export async function getStat(name: string): Promise<any> {
  try {
    const response = await sendKeaCommand({
      command: 'statistic-get',
      arguments: { name },
    });
    if (response[0]?.result === 0) {
      return response[0].arguments || {};
    }
    return {};
  } catch {
    return {};
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Parse a pool string like "192.168.1.100 - 192.168.1.254" into start and end
 */
export function parsePool(poolStr: string): { start: string; end: string } {
  const parts = poolStr.split('-').map(s => s.trim());
  return { start: parts[0] || '', end: parts[1] || '' };
}

/**
 * Compute pool size from start and end IPs
 */
export function computePoolSize(poolStart: string, poolEnd: string): number {
  try {
    const start = parseInt(poolStart.split('.').pop() || '0', 10);
    const end = parseInt(poolEnd.split('.').pop() || '0', 10);
    return Math.max(0, end - start + 1);
  } catch {
    return 0;
  }
}

/**
 * Find the router (gateway) option in a subnet's option-data
 */
export function findRouterOption(optionData?: Array<{ name: string; data: string }>): string {
  if (!optionData) return '';
  const router = optionData.find(o => o.name === 'routers');
  return router?.data || '';
}

/**
 * Find DNS servers option in a subnet's option-data
 */
export function findDnsOption(optionData?: Array<{ name: string; data: string }>): string[] {
  if (!optionData) return [];
  const dns = optionData.find(o => o.name === 'domain-name-servers');
  if (!dns) return [];
  return dns.data.split(',').map(s => s.trim());
}

/**
 * Map lease state code to string
 */
export function mapLeaseState(state: number): 'active' | 'declined' | 'expired' {
  switch (state) {
    case 0: return 'active';
    case 1: return 'declined';
    case 2: return 'expired';
    default: return 'active';
  }
}

/**
 * Friendly names for subnets based on their subnet CIDR
 */
export function getSubnetFriendlyName(subnet: string): string {
  const nameMap: Record<string, string> = {
    '192.168.1.0/24': 'Guest WiFi',
    '192.168.2.0/24': 'Staff Network',
    '192.168.10.0/24': 'IoT Network',
    '192.168.100.0/24': 'Management Network',
  };
  return nameMap[subnet] || `Subnet ${subnet}`;
}
