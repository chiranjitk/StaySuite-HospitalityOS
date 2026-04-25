/**
 * Static Route Shell Script Wrapper
 *
 * Provides typed functions for static route operations via scripts/network/route.sh
 */

import {
  executeScript,
  sanitizeInterfaceName,
  validateIPv4,
  ScriptResult,
} from './executor';

export interface RouteAddParams {
  destination: string;
  gateway: string;
  metric?: number;
  interface?: string;
}

export interface RouteInfo {
  destination: string;
  gateway: string;
  metric: number;
  interface: string;
  protocol: string;
}

export interface RouteListResult {
  routes: RouteInfo[];
  count: number;
}

export interface RouteResult {
  destination: string;
  gateway: string;
  metric?: number;
  interface?: string;
}

/**
 * Add a static route.
 * OS command: ip route add <destination> via <gateway> [dev <iface>] [metric <N>]
 */
export function addRoute(params: RouteAddParams): ScriptResult<RouteResult> {
  const { destination, gateway, metric, interface: iface } = params;

  // Allow CIDR in destination (e.g., 192.168.0.0/24)
  sanitizeInput(destination, 'destination');
  validateIPv4(gateway.split('/')[0] || gateway);

  const args = ['add', destination, gateway];
  if (metric !== undefined) args.push(String(metric));
  if (iface) {
    sanitizeInterfaceName(iface);
    args.push(iface);
  }

  return executeScript<RouteResult>('route.sh', args);
}

/**
 * Delete a static route.
 * OS command: ip route del <destination> via <gateway>
 */
export function deleteRoute(destination: string, gateway: string): ScriptResult<RouteResult> {
  sanitizeInput(destination, 'destination');
  validateIPv4(gateway.split('/')[0] || gateway);

  return executeScript<RouteResult>('route.sh', ['delete', destination, gateway]);
}

/**
 * Add a default route.
 * OS command: ip route add default via <gateway> [dev <iface>]
 */
export function addDefaultRoute(gateway: string, iface?: string): ScriptResult<RouteResult> {
  validateIPv4(gateway);
  const args = ['add-default', gateway];
  if (iface) {
    sanitizeInterfaceName(iface);
    args.push(iface);
  }
  return executeScript<RouteResult>('route.sh', args);
}

/**
 * List all routes.
 * OS command: ip -o route show
 */
export function listRoutes(): ScriptResult<RouteListResult> {
  return executeScript<RouteListResult>('route.sh', ['list']);
}

// Re-export sanitizeInput for local use
import { sanitizeInput } from './executor';
