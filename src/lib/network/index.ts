/**
 * Network Shell Script Library — Barrel Export
 *
 * This module re-exports all network shell script wrappers.
 * All OS-level network operations should go through these typed wrappers.
 *
 * Architecture:
 *   GUI → API Route → This Library → Shell Scripts → OS
 *                                   ↘ If success → Update DB
 *
 * Usage:
 *   import { createVlan, deleteVlan } from '@/lib/network';
 *   import { createBridge, listBridges } from '@/lib/network';
 */

// Executor (core utility)
export {
  executeScript,
  sanitizeInput,
  sanitizeInterfaceName,
  validateIPv4,
  validateVlanId,
  validateMtu,
  validateNetmask,
  validateBondMode,
  validateRole,
  validateMultiWanMode,
  netmaskToCidr,
  buildScriptCommand,
  type ScriptResult,
  type ExecutorOptions,
} from './executor';

// VLAN operations
export {
  createVlan,
  deleteVlan,
  listVlans,
  vlanExists,
  type VlanCreateParams,
  type VlanInfo,
  type VlanListResult,
  type VlanCreateResult,
  type VlanDeleteResult,
} from './vlan';

// Bridge operations
export {
  createBridge,
  deleteBridge,
  addBridgeMember,
  removeBridgeMember,
  listBridges,
  type BridgeCreateParams,
  type BridgeInfo,
  type BridgeListResult,
  type BridgeCreateResult,
  type BridgeDeleteResult,
  type BridgeMemberResult,
} from './bridge';

// Bond operations
export {
  createBond,
  deleteBond,
  listBonds,
  type BondCreateParams,
  type BondInfo,
  type BondListResult,
  type BondCreateResult,
  type BondDeleteResult,
} from './bond';

// IP Alias operations
export {
  addAlias,
  removeAlias,
  listAliases,
  type AliasAddParams,
  type AliasInfo,
  type AliasListResult,
  type AliasResult,
} from './alias';

// IP Configuration operations
export {
  setStaticIP,
  setDHCP,
  flushIPs,
  setMTU,
  interfaceUp,
  interfaceDown,
  type StaticIPParams,
  type IPConfigResult,
  type InterfaceStateResult,
} from './ip-config';

// Static Route operations
export {
  addRoute,
  deleteRoute,
  addDefaultRoute,
  listRoutes,
  type RouteAddParams,
  type RouteInfo,
  type RouteListResult,
  type RouteResult,
} from './route';

// Interface introspection
export {
  listInterfaces,
  getInterfaceInfo,
  getInterfaceStats,
  type InterfaceStats,
  type InterfaceInfo,
  type InterfaceListResult,
} from './interface';

// Persistence to /etc/network/interfaces
export {
  persistBridge,
  removePersistedBridge,
  persistBond,
  removePersistedBond,
  persistIPConfig,
  persistAliasAdd,
  persistAliasRemove,
  persistRouteAdd,
  persistRouteRemove,
  type PersistBridgeParams,
  type PersistBondParams,
  type PersistIPConfigParams,
  type PersistAliasParams,
  type PersistRouteParams,
  type PersistResult,
} from './persist';

// Multi-WAN operations
export {
  applyWeighted,
  applyFailover,
  applyRoundRobin,
  resetMultiWan,
  deployMonitor,
  type WanMember,
  type MultiWanConfig,
  type MultiWanApplyResult,
  type MultiWanResetResult,
  type MultiWanMonitorResult,
} from './multiwan';

// Interface Role operations
export {
  setRole,
  removeRole,
  listRoles,
  type RoleInfo,
  type RoleListResult,
  type RoleResult,
} from './role';
