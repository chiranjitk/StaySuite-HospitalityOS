/**
 * StaySuite Network Type Constants
 *
 * Maps nettype values to network interface roles.
 * Stored in [staysuite] section of .nmconnection files.
 * Scan all .nmconnection files → filter by nettype → get roles.
 */

export const NET_TYPES = {
  LAN: 0,
  WAN: 1,
  VLAN: 2,
  BRIDGE: 3,
  BOND: 4,
  MANAGEMENT: 5,
  GUEST: 6,
  IOT: 7,
  UNUSED: 8,
  DMZ: 9,
  WIFI: 10,
} as const;

export type NetType = (typeof NET_TYPES)[keyof typeof NET_TYPES];

export const NET_TYPE_LABELS: Record<NetType, string> = {
  [NET_TYPES.LAN]: 'LAN',
  [NET_TYPES.WAN]: 'WAN',
  [NET_TYPES.VLAN]: 'VLAN',
  [NET_TYPES.BRIDGE]: 'Bridge',
  [NET_TYPES.BOND]: 'Bond',
  [NET_TYPES.MANAGEMENT]: 'Management',
  [NET_TYPES.GUEST]: 'Guest',
  [NET_TYPES.IOT]: 'IoT',
  [NET_TYPES.UNUSED]: 'Unused',
  [NET_TYPES.DMZ]: 'DMZ',
  [NET_TYPES.WIFI]: 'WiFi',
};

export const NET_TYPE_COLORS: Record<NetType, string> = {
  [NET_TYPES.LAN]: 'bg-emerald-500',
  [NET_TYPES.WAN]: 'bg-orange-500',
  [NET_TYPES.VLAN]: 'bg-purple-500',
  [NET_TYPES.BRIDGE]: 'bg-cyan-500',
  [NET_TYPES.BOND]: 'bg-pink-500',
  [NET_TYPES.MANAGEMENT]: 'bg-slate-500',
  [NET_TYPES.GUEST]: 'bg-amber-500',
  [NET_TYPES.IOT]: 'bg-teal-500',
  [NET_TYPES.UNUSED]: 'bg-gray-400',
  [NET_TYPES.DMZ]: 'bg-red-500',
  [NET_TYPES.WIFI]: 'bg-blue-500',
};

/** Reverse lookup: label → nettype number */
export const NET_TYPE_FROM_LABEL: Record<string, NetType> = Object.fromEntries(
  Object.entries(NET_TYPE_LABELS).map(([, label], key) => [label.toLowerCase(), key as NetType])
) as Record<string, NetType>;

/** Reverse lookup: nettype number → label string */
export function netTypeToLabel(nettype: number): string {
  return NET_TYPE_LABELS[nettype as NetType] || 'Unknown';
}

/** Validate a nettype number */
export function isValidNetType(nettype: number): boolean {
  return nettype in NET_TYPE_LABELS;
}

/** Map nettype to NM connection type */
export function netTypeToConnectionType(nettype: number): string {
  switch (nettype) {
    case NET_TYPES.VLAN: return 'vlan';
    case NET_TYPES.BRIDGE: return 'bridge';
    case NET_TYPES.BOND: return 'bond';
    default: return 'ethernet';
  }
}

/** Config directory for NetworkManager on Rocky Linux 10 */
export const NM_CONNECTIONS_DIR = '/etc/NetworkManager/system-connections';
export const NM_CONNECTION_SUFFIX = '.nmconnection';
