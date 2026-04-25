/**
 * IP Alias Shell Script Wrapper
 *
 * Provides typed functions for IP alias operations via scripts/network/alias.sh
 */

import {
  executeScript,
  sanitizeInterfaceName,
  validateIPv4,
  validateNetmask,
  netmaskToCidr,
  ScriptResult,
} from './executor';

export interface AliasAddParams {
  interface: string;
  ipAddress: string;
  netmask: string;
}

export interface AliasInfo {
  interface: string;
  ipAddress: string;
  netmask: string;
  cidr: number;
}

export interface AliasListResult {
  aliases: AliasInfo[];
  count: number;
}

export interface AliasResult {
  interface: string;
  ipAddress: string;
  netmask: string;
  cidr: number;
}

/**
 * Add an IP alias to an interface.
 * OS command: ip addr add <ip>/<cidr> dev <interface>
 */
export function addAlias(params: AliasAddParams): ScriptResult<AliasResult> {
  const { interface: iface, ipAddress, netmask } = params;

  sanitizeInterfaceName(iface);
  validateIPv4(ipAddress);
  validateNetmask(netmask);

  return executeScript<AliasResult>('alias.sh', ['add', iface, ipAddress, netmask]);
}

/**
 * Remove an IP alias from an interface.
 * OS command: ip addr del <ip>/<cidr> dev <interface>
 */
export function removeAlias(iface: string, ipAddress: string, netmask: string): ScriptResult<AliasResult> {
  sanitizeInterfaceName(iface);
  validateIPv4(ipAddress);
  validateNetmask(netmask);

  return executeScript<AliasResult>('alias.sh', ['remove', iface, ipAddress, netmask]);
}

/**
 * List IP aliases for an interface.
 */
export function listAliases(iface: string): ScriptResult<AliasListResult> {
  sanitizeInterfaceName(iface);
  return executeScript<AliasListResult>('alias.sh', ['list', iface]);
}
