/**
 * Bridge Shell Script Wrapper
 *
 * Provides typed functions for bridge operations via scripts/network/bridge.sh
 */

import {
  executeScript,
  sanitizeInterfaceName,
  validateIPv4,
  validateNetmask,
  ScriptResult,
} from './executor';

export interface BridgeCreateParams {
  name: string;
  stp?: boolean;
  forwardDelay?: number;
  members?: string[];
  ipAddress?: string;
  netmask?: string;
}

export interface BridgeInfo {
  name: string;
  stp: string;
  forwardDelay: number;
  members: string[];
  state: string;
}

export interface BridgeListResult {
  bridges: BridgeInfo[];
  count: number;
}

export interface BridgeCreateResult {
  name: string;
  stp: boolean;
  forwardDelay: number;
  members: string[];
  state: string;
  ipAddress?: string;
  netmask?: string;
  cidr?: number;
}

export interface BridgeDeleteResult {
  name: string;
  removedMembers: string[];
  removed: boolean;
}

export interface BridgeMemberResult {
  bridge: string;
  member: string;
  action: string;
  success: boolean;
}

/**
 * Create a Linux bridge.
 * OS commands: ip link add name <name> type bridge, ip link set members master <name>
 */
export function createBridge(params: BridgeCreateParams): ScriptResult<BridgeCreateResult> {
  const { name, stp = false, forwardDelay = 15, members = [] } = params;

  sanitizeInterfaceName(name);

  const args = ['create', name];
  if (stp) args.push('--stp', 'on');
  else args.push('--stp', 'off');
  args.push('--forward-delay', String(forwardDelay));

  if (members.length > 0) {
    members.forEach((m) => sanitizeInterfaceName(m));
    args.push('--members', members.join(','));
  }

  if (params.ipAddress) {
    validateIPv4(params.ipAddress);
    args.push('--ip', params.ipAddress);
  }
  if (params.netmask) {
    validateNetmask(params.netmask);
    args.push('--netmask', params.netmask);
  }

  return executeScript<BridgeCreateResult>('bridge.sh', args);
}

/**
 * Delete a Linux bridge.
 * OS commands: ip link set members nomaster, ip link del <name>
 */
export function deleteBridge(name: string): ScriptResult<BridgeDeleteResult> {
  sanitizeInterfaceName(name);
  return executeScript<BridgeDeleteResult>('bridge.sh', ['delete', name]);
}

/**
 * Add a member interface to a bridge.
 * OS command: ip link set <member> master <bridge>
 */
export function addBridgeMember(bridge: string, member: string): ScriptResult<BridgeMemberResult> {
  sanitizeInterfaceName(bridge);
  sanitizeInterfaceName(member);
  return executeScript<BridgeMemberResult>('bridge.sh', ['add-member', bridge, member]);
}

/**
 * Remove a member interface from a bridge.
 * OS command: ip link set <member> nomaster
 */
export function removeBridgeMember(bridge: string, member: string): ScriptResult<BridgeMemberResult> {
  sanitizeInterfaceName(bridge);
  sanitizeInterfaceName(member);
  return executeScript<BridgeMemberResult>('bridge.sh', ['remove-member', bridge, member]);
}

/**
 * List all bridges.
 * OS commands: ip -o link show type bridge, bridge link
 */
export function listBridges(): ScriptResult<BridgeListResult> {
  return executeScript<BridgeListResult>('bridge.sh', ['list']);
}
