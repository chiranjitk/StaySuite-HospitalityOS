/**
 * VLAN Shell Script Wrapper
 *
 * Provides typed functions for VLAN operations via scripts/network/vlan.sh
 * Supports both L2 (interface only) and L3 (interface + IP) VLAN creation.
 *
 * Usage:
 *   import { createVlan, deleteVlan, listVlans } from '@/lib/network/vlan';
 */

import {
  executeScript,
  sanitizeInterfaceName,
  validateVlanId,
  validateMtu,
  validateIPv4,
  validateNetmask,
  netmaskToCidr,
  ScriptResult,
} from './executor';

export interface VlanCreateParams {
  parentInterface: string;
  vlanId: number;
  name?: string;
  mtu?: number;
  /** Optional: IP address to assign (L3 VLAN) */
  ipAddress?: string;
  /** Optional: Netmask for the IP (defaults to 255.255.255.0 /24) */
  netmask?: string;
}

export interface VlanInfo {
  name: string;
  parent: string;
  vlanId: number;
  mtu?: number;
  state?: string;
  /** IP address assigned to the VLAN interface (L3) */
  ipAddress?: string;
  netmask?: string;
  cidr?: number;
}

export interface VlanListResult {
  vlans: VlanInfo[];
  count: number;
}

export interface VlanCreateResult {
  name: string;
  parent: string;
  vlanId: number;
  mtu: number;
  state: string;
  /** IP address assigned (L3 VLAN) */
  ipAddress?: string;
  netmask?: string;
  cidr?: number;
}

export interface VlanDeleteResult {
  name: string;
  removed: boolean;
}

/**
 * Create a VLAN interface (L2 or L3).
 *
 * L2 VLAN (no IP):  ip link add link <parent> name <name> type vlan id <vlanId>
 * L3 VLAN (with IP): Also runs ip addr add <ip>/<cidr> dev <name>
 *
 * OS command: vlan.sh create <parent> <vlanId> [name] [mtu] [--ip IP] [--netmask MASK]
 */
export function createVlan(params: VlanCreateParams): ScriptResult<VlanCreateResult> {
  const { parentInterface, vlanId, name, mtu, ipAddress, netmask } = params;

  sanitizeInterfaceName(parentInterface);
  validateVlanId(vlanId);

  const args = ['create', parentInterface, String(vlanId)];
  if (name) {
    sanitizeInterfaceName(name);
    args.push(name);
  }
  if (mtu !== undefined) {
    validateMtu(mtu);
    args.push(String(mtu));
  }

  // L3: pass IP and netmask flags
  if (ipAddress) {
    validateIPv4(ipAddress);
    args.push('--ip', ipAddress);
  }
  if (netmask) {
    validateNetmask(netmask);
    args.push('--netmask', netmask);
  }

  return executeScript<VlanCreateResult>('vlan.sh', args);
}

/**
 * Delete a VLAN interface.
 * OS command: ip link del <name>
 */
export function deleteVlan(ifaceName: string): ScriptResult<VlanDeleteResult> {
  sanitizeInterfaceName(ifaceName);
  return executeScript<VlanDeleteResult>('vlan.sh', ['delete', ifaceName]);
}

/**
 * List all VLAN interfaces.
 * OS command: ip -o link show type vlan
 */
export function listVlans(): ScriptResult<VlanListResult> {
  return executeScript<VlanListResult>('vlan.sh', ['list']);
}

/**
 * Check if a VLAN interface exists.
 */
export function vlanExists(ifaceName: string): boolean {
  const result = listVlans();
  if (!result.success || !result.data) return false;
  return result.data.vlans.some((v) => v.name === ifaceName);
}
