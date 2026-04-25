/**
 * IP Configuration Shell Script Wrapper
 *
 * Provides typed functions for interface IP configuration via scripts/network/ip-config.sh
 */

import {
  executeScript,
  sanitizeInterfaceName,
  validateIPv4,
  validateNetmask,
  validateMtu,
  ScriptResult,
} from './executor';

export interface StaticIPParams {
  interface: string;
  ipAddress: string;
  netmask: string;
  gateway?: string;
  dnsPrimary?: string;
  dnsSecondary?: string;
}

export interface IPConfigResult {
  interface: string;
  mode: string;
  ipAddress?: string;
  netmask?: string;
  gateway?: string;
  cidr?: number;
}

export interface InterfaceStateResult {
  interface: string;
  state: string;
}

/**
 * Set a static IP configuration on an interface.
 * OS commands: ip addr flush, ip addr add, ip route add default via
 */
export function setStaticIP(params: StaticIPParams): ScriptResult<IPConfigResult> {
  const { interface: iface, ipAddress, netmask, gateway, dnsPrimary, dnsSecondary } = params;

  sanitizeInterfaceName(iface);
  validateIPv4(ipAddress);
  validateNetmask(netmask);
  if (gateway) validateIPv4(gateway);
  if (dnsPrimary) validateIPv4(dnsPrimary);
  if (dnsSecondary) validateIPv4(dnsSecondary);

  const args = ['set-static', iface, ipAddress, netmask];
  if (gateway) args.push(gateway);
  if (dnsPrimary) args.push(dnsPrimary);
  if (dnsSecondary) args.push(dnsSecondary);

  return executeScript<IPConfigResult>('ip-config.sh', args);
}

/**
 * Enable DHCP on an interface.
 * OS command: dhclient <interface> or systemctl restart networking
 */
export function setDHCP(iface: string): ScriptResult<IPConfigResult> {
  sanitizeInterfaceName(iface);
  return executeScript<IPConfigResult>('ip-config.sh', ['set-dhcp', iface]);
}

/**
 * Flush all IP addresses on an interface.
 * OS command: ip addr flush dev <interface>
 */
export function flushIPs(iface: string): ScriptResult<IPConfigResult> {
  sanitizeInterfaceName(iface);
  return executeScript<IPConfigResult>('ip-config.sh', ['flush', iface]);
}

/**
 * Set MTU on an interface.
 * OS command: ip link set <interface> mtu <mtu>
 */
export function setMTU(iface: string, mtu: number): ScriptResult<InterfaceStateResult> {
  sanitizeInterfaceName(iface);
  validateMtu(mtu);
  return executeScript<InterfaceStateResult>('ip-config.sh', ['set-mtu', iface, String(mtu)]);
}

/**
 * Bring an interface up.
 * OS command: ip link set <interface> up
 */
export function interfaceUp(iface: string): ScriptResult<InterfaceStateResult> {
  sanitizeInterfaceName(iface);
  return executeScript<InterfaceStateResult>('ip-config.sh', ['up', iface]);
}

/**
 * Bring an interface down.
 * OS command: ip link set <interface> down
 */
export function interfaceDown(iface: string): ScriptResult<InterfaceStateResult> {
  sanitizeInterfaceName(iface);
  return executeScript<InterfaceStateResult>('ip-config.sh', ['down', iface]);
}
