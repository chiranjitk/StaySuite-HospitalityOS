/**
 * Network Persistence Shell Script Wrapper
 *
 * Provides typed functions for persisting network config to /etc/network/interfaces
 * via scripts/network/persist.sh
 */

import {
  executeScript,
  sanitizeInterfaceName,
  validateIPv4,
  validateNetmask,
  ScriptResult,
} from './executor';

export interface PersistBridgeParams {
  name: string;
  stp: boolean;
  forwardDelay: number;
  members: string[];
  ipAddress?: string;
  netmask?: string;
  gateway?: string;
}

export interface PersistBondParams {
  name: string;
  mode: string;
  miimon: number;
  lacpRate: string;
  primary?: string;
  members: string[];
}

export interface PersistIPConfigParams {
  interface: string;
  mode: 'static' | 'dhcp' | 'manual';
  ipAddress?: string;
  netmask?: string;
  gateway?: string;
  dnsPrimary?: string;
  dnsSecondary?: string;
}

export interface PersistAliasParams {
  interface: string;
  ipAddress: string;
  netmask: string;
}

export interface PersistRouteParams {
  interface: string;
  destination: string;
  gateway: string;
}

export interface PersistResult {
  file: string;
  action: string;
  backupCreated: boolean;
  backupPath?: string;
}

/**
 * Persist a bridge configuration to /etc/network/interfaces.
 */
export function persistBridge(params: PersistBridgeParams): ScriptResult<PersistResult> {
  const { name, stp, forwardDelay, members, ipAddress, netmask, gateway } = params;
  sanitizeInterfaceName(name);
  members.forEach((m) => sanitizeInterfaceName(m));

  const args = ['bridge', name, stp ? 'on' : 'off', String(forwardDelay), JSON.stringify(members)];
  if (ipAddress) {
    validateIPv4(ipAddress);
    args.push(ipAddress || '');
  }
  if (netmask) {
    validateNetmask(netmask);
    args.push(netmask || '');
  }
  if (gateway) {
    validateIPv4(gateway);
    args.push(gateway);
  }

  return executeScript<PersistResult>('persist.sh', args);
}

/**
 * Remove a bridge configuration from /etc/network/interfaces.
 */
export function removePersistedBridge(name: string): ScriptResult<PersistResult> {
  sanitizeInterfaceName(name);
  return executeScript<PersistResult>('persist.sh', ['remove-bridge', name]);
}

/**
 * Persist a bond configuration to /etc/network/interfaces.
 */
export function persistBond(params: PersistBondParams): ScriptResult<PersistResult> {
  const { name, mode, miimon, lacpRate, primary, members } = params;
  sanitizeInterfaceName(name);
  members.forEach((m) => sanitizeInterfaceName(m));

  const args = [
    'bond', name, mode, String(miimon), lacpRate,
    primary || '',
    JSON.stringify(members),
  ];

  return executeScript<PersistResult>('persist.sh', args);
}

/**
 * Remove a bond configuration from /etc/network/interfaces.
 */
export function removePersistedBond(name: string): ScriptResult<PersistResult> {
  sanitizeInterfaceName(name);
  return executeScript<PersistResult>('persist.sh', ['remove-bond', name]);
}

/**
 * Persist an IP configuration to /etc/network/interfaces.
 */
export function persistIPConfig(params: PersistIPConfigParams): ScriptResult<PersistResult> {
  const { interface: iface, mode, ipAddress, netmask, gateway, dnsPrimary, dnsSecondary } = params;
  sanitizeInterfaceName(iface);

  if (ipAddress) validateIPv4(ipAddress);
  if (netmask) validateNetmask(netmask);
  if (gateway) validateIPv4(gateway);

  const args = [
    'ip-config', iface, mode,
    ipAddress || '',
    netmask || '',
    gateway || '',
    dnsPrimary || '',
    dnsSecondary || '',
  ];

  return executeScript<PersistResult>('persist.sh', args);
}

/**
 * Add an alias to an interface stanza in /etc/network/interfaces.
 */
export function persistAliasAdd(params: PersistAliasParams): ScriptResult<PersistResult> {
  const { interface: iface, ipAddress, netmask } = params;
  sanitizeInterfaceName(iface);
  validateIPv4(ipAddress);
  validateNetmask(netmask);

  return executeScript<PersistResult>('persist.sh', ['alias-add', iface, ipAddress, netmask]);
}

/**
 * Remove an alias from an interface stanza in /etc/network/interfaces.
 */
export function persistAliasRemove(iface: string, ipAddress: string): ScriptResult<PersistResult> {
  sanitizeInterfaceName(iface);
  validateIPv4(ipAddress);

  return executeScript<PersistResult>('persist.sh', ['alias-remove', iface, ipAddress]);
}

/**
 * Add a route to an interface stanza in /etc/network/interfaces.
 */
export function persistRouteAdd(params: PersistRouteParams): ScriptResult<PersistResult> {
  const { interface: iface, destination, gateway } = params;
  sanitizeInterfaceName(iface);
  validateIPv4(gateway);

  return executeScript<PersistResult>('persist.sh', ['route-add', iface, destination, gateway]);
}

/**
 * Remove a route from an interface stanza in /etc/network/interfaces.
 */
export function persistRouteRemove(iface: string, destination: string, gateway: string): ScriptResult<PersistResult> {
  sanitizeInterfaceName(iface);
  validateIPv4(gateway);

  return executeScript<PersistResult>('persist.sh', ['route-remove', iface, destination, gateway]);
}
