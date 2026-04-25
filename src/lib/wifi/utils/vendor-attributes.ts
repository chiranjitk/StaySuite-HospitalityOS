/**
 * Vendor-Agnostic RADIUS Attribute Utility (Server-Side)
 *
 * StaySuite is a multi-vendor, multi-NAS platform (MikroTik, Cisco, Aruba, Ruckus,
 * Huawei, Juniper, Fortinet, UniFi, pfSense, etc.). RADIUS attributes MUST be
 * set according to the NAS vendor type — never hardcoded to a single vendor.
 *
 * Architecture:
 * ┌────────────┐    query NAS vendors    ┌──────────────────────┐
 * │ PMS / RADIUS│ ──────────────────────→ │ RadiusNAS table (type)│
 * │ Service     │                        └──────────────────────┘
 * └──────┬─────┘                                  │
 *        │                                        │
 *        ▼                                        ▼
 * ┌──────────────────────────────────────────────────────────┐
 * │  generateRadReplyAttributes(vendors, downloadMbps, ...)   │
 * │                                                          │
 * │  For EACH active vendor:                                  │
 * │    1. RFC-standard attrs  (Session-Timeout, WISPr-*)      │
 * │    2. Vendor-specific attrs (determined by vendor profile) │
 * └──────────────────────┬───────────────────────────────────┘
 *                        │
 *                        ▼
 *              Write ALL attrs to radreply
 *              (NAS ignores unrecognized attrs)
 *
 * Reading attributes (display/edit):
 *   - Check ALL known data-limit attribute names per vendor
 *   - Check ALL known bandwidth attribute names per vendor
 *   - RFC-standard WISPr attrs are the universal fallback
 *
 * FREE RADICS VENDOR DICTIONARIES:
 *   FreeRADIUS ships 300+ vendor dictionary files (e.g., /usr/share/freeradius/dictionary.mikrotik)
 *   that define each vendor's VSA names, types, and formats. Our vendor profile system maps
 *   300+ vendor identifiers to 9 canonical profiles and knows which VSAs to use for each.
 *
 *   Pure reading/parsing functions are in attribute-readers.ts (client-safe, no DB import).
 */

import { db } from '@/lib/db';

// ─── Re-export pure readers (client-safe) ────────────────────────────────
export {
  DATA_LIMIT_ATTRIBUTES,
  BANDWIDTH_ATTRIBUTES,
  ALL_VENDOR_SPECIFIC_ATTRIBUTES,
  readDataLimitMB,
  readDataLimitBytes,
  readBandwidthMbps,
  getBandwidthDisplay,
  hasDataLimit,
  getDataLimitDisplay,
  getSessionTimeoutDisplay,
  getValidityDisplay,
} from './attribute-readers';

// ─── Vendor Profile Keys ─────────────────────────────────────────────────

export type VendorProfile =
  | 'mikrotik'
  | 'cisco'
  | 'aruba'
  | 'chillispot'
  | 'fortinet'
  | 'huawei'
  | 'juniper'
  | 'wispr'
  | 'other';

// ─── Normalize Vendor String ─────────────────────────────────────────────

/**
 * Normalize a raw NAS vendor string to a canonical vendor profile key.
 * Mirrors the logic in freeradius-service/index.ts normalizeVendor().
 *
 * Maps 300+ vendor identifiers to one of:
 *   mikrotik, cisco, aruba, chillispot, fortinet, huawei, juniper, wispr, other
 */
export function normalizeVendor(rawVendor: string): VendorProfile {
  const v = (rawVendor || 'other').toLowerCase().trim().replace(/[^a-z0-9]/g, '');

  const profiles: VendorProfile[] = ['mikrotik', 'cisco', 'aruba', 'chillispot', 'fortinet', 'huawei', 'juniper', 'wispr', 'other'];
  if (profiles.includes(v)) return v;

  // ── mikrotik ──
  if (['mikrotik', 'mikrotikrouteros', 'routeros', 'mikrotikswitch', 'crs', 'switchos'].includes(v)) return 'mikrotik';

  // ── cisco ──
  if (['cisco', 'ciscomeraki', 'meraki', 'ciscowlc', 'ciscoios', 'ciscoasa',
    'ciscorevpn', 'ciscovpn', 'ciscoisg', 'ciscomerakims', 'ciscocucm', 'ciscocme'].includes(v)) return 'cisco';

  // ── aruba ──
  if (['aruba', 'arubahpe', 'hpe', 'arubaclearpass', 'clearpass',
    'hpprocurve', 'hpeofficeconnect', 'colubris'].includes(v)) return 'aruba';

  // ── chillispot ──
  if (['coovachilli', 'chilli', 'coova', 'chillispot', 'pfsense', 'opnsense',
    'openwrt', 'ddwrt', 'wifidog', 'wifidogng', 'openmesh', 'cloudtrax',
    'eduroam', 'captiveportal', 'captive', 'untangle', 'smoothwall', 'clearos',
    'endian', 'ipsecgeneric', 'sslvpngeneric', 'openvpn', 'wireguard',
    'mypublicwifi', 'wifisplash', 'guestgate', 'wifigate', 'handlink',
    'wifiplus', 'aquipia', 'velox', 'fon', 'gowex', 'socialwifi',
    'purplewifi', 'cloud4wifi', 'bintec', 'elmeg', 'kerio', 'stonesoft',
    'forcepoint', 'clavister', 'cyberguard', 'sputnik', 'wifika', 'patronsoft',
    'antlabs', 'firstspot', 'wirelesslogic', 'wifiglobal', 'iwire', 'mywifi',
    'nomadix', 'alepo', 'aptilo', 'ipass', 'devicescape', 'boingo', 'deepedge'].includes(v)) return 'chillispot';

  // ── fortinet ──
  if (['fortinet', 'fortigate', 'fortiwifi', 'fortinetvpn', 'forticlient',
    'fortisslvpn', 'sangfor', 'deepsecure', 'hillstone'].includes(v)) return 'fortinet';

  // ── huawei ──
  if (['huawei', 'airengine', 'huaweimea', 'huaweimme', 'huaweiims',
    'huaweime60', 'huaweiugw', 'fiberhome', 'fiberhomean5000'].includes(v)) return 'huawei';

  // ── juniper ──
  if (['juniper', 'junipermist', 'mist', 'junipersrx', 'junipere',
    'juniperive', 'pulsesecure', 'netscreen', 'ive', 'erx'].includes(v)) return 'juniper';

  // ── wispr (native WISPr vendors) ──
  if ([
    'unifi', 'ubiquiti', 'ubiquitiunifi', 'ubiquitiedgerouter',
    'ruckus', 'ruckuscommcope', 'commcope',
    'tplink', 'tplinkomada', 'omada', 'tplinkswitch',
    'netgear', 'netgearinsight', 'orbi', 'netgearswitch',
    'dlink', 'dlinknuclias', 'nuclias',
    'ruijie', 'ruijienetworks', 'reyee',
    'cambium', 'cnpilot', 'emp',
    'grandstream', 'gwn', 'grandstreampbx',
    'engenius', 'zyxel', 'nwa', 'zyxelswitch', 'zyxelnxc',
    'alcatel', 'nokia', 'alcatellucent', 'nokiaips',
    'extreme', 'extremenetworks', 'aerohive', 'hivemanager', 'enterasys',
    'xirrus', 'xirrusarray', 'bluesocket', 'trapeze', 'wavelink', 'telxon',
    'symbol', 'proxim', 'orinoco', 'breezecom', 'breezenet',
    'intellinet', 'nfon', 'buffalo', 'airstation',
    'asus', 'asuswrt', 'merlin',
    'edgecore', 'accton', 'altai', 'wili', 'wilimesh',
    'samsung', 'zte', 'ztemme', 'ztebras', 'ztebrass', 'brocade',
    'motorola', 'draytek', 'peplink', 'speedfusion', 'sophos',
    'avaya', 'avayacmu', 'dell', 'dellforce10', 'force10',
    'foundry', 'smc', 'perle', 'opengear', 'ubiquti', 'mellanox', 'nvidia',
    'arista', 'cumulus', 'alliedtelesis',
    'meru', 'adckentrox',
    'paloalto', 'checkpoint', 'sonicwall', 'watchguard', 'barracuda', 'barracudavpn',
    'redcreek', 'ravlin',
    'f5bigip', 'f5', 'citrix', 'netscaler', 'array', 'avedia',
    'freeradius', 'microsoftnps', 'ciscoacs', 'ciscoise',
    'rsa', 'rsasecurid', 'radiator', 'openradius', 'tacacsgeneric',
    'sierrawireless', 'airlink', 'teltonika', 'moxa', 'nport',
    'digi', 'diginternational', 'lantronix', 'inhand', 'quectel', 'ublox',
    'simcom', 'simtech', 'neoway', 'sequans', 'multitech', 'multiconnect',
    'robustel', 'fourfaith', 'f2x',
    'ericssonmme', 'ericssonse', 'smartedge',
    'nokiamme', 'nsn', 'stm', 'starent', 'staros',
    'broadsoft', 'genband', 'ribbon', 'metaswitch', 'sonus', 'sbc',
    'audiocodes', 'mediant', 'inventel', 'efficientip',
    'vodafone', 'telekom', 'orange', 'att', 'verizon',
    'chinatelecom', 'chinamobile', 'chinaunicom',
    'bsnl', 'jio', 'reliance', 'airtel', 'bharti',
    'sangoma', 'freepbx', 'digium', 'asterisk', 'mitel', 'mivoice', 'yealink',
    'polycom',
    'redback', 'broadband', 'ciscoiosbras', 'ascend', 'lucent',
    'nortel', 'shasta', 'paradigm', 'shiva', 'livingston', 'alcatelisam',
    '3com', 'h3c',
  ].includes(v)) return 'wispr';

  return 'other';
}

// ─── Query NAS Vendors from Database ─────────────────────────────────────

/**
 * Get all unique, active NAS vendor types from the RadiusNAS table.
 * Returns normalized vendor profile keys.
 *
 * Example: ['mikrotik', 'cisco'] — means the property uses both
 * MikroTik and Cisco NAS devices, so attributes for BOTH must be written.
 */
export async function getActiveNASVendors(propertyId?: string): Promise<VendorProfile[]> {
  try {
    const where = propertyId ? { propertyId, status: 'active' as const } : { status: 'active' as const };
    const nasEntries = await db.radiusNAS.findMany({
      where,
      select: { type: true },
      distinct: ['type'],
    });

    if (!nasEntries || nasEntries.length === 0) return ['other'];
    return nasEntries.map(n => normalizeVendor(n.type));
  } catch {
    return ['other'];
  }
}

// ─── Generate Vendor-Specific Attributes ─────────────────────────────────

/**
 * Generate bandwidth-related RADIUS reply attributes for one or more vendors.
 *
 * RFC-standard WISPr attributes are ALWAYS included (recognized by most NAS).
 * Vendor-specific attributes are added based on each vendor profile.
 *
 * @param vendors - Array of normalized vendor profiles
 * @param downloadMbps - Download speed in Mbps
 * @param uploadMbps - Upload speed in Mbps
 * @returns Array of { attribute, value } pairs to write to radreply
 */
export function generateBandwidthAttributes(
  vendors: VendorProfile[],
  downloadMbps: number,
  uploadMbps: number,
): Array<{ attribute: string; value: string }> {
  const attrs: Array<{ attribute: string; value: string }> = [];
  const downloadBps = downloadMbps * 1000000;
  const uploadBps = uploadMbps * 1000000;

  // RFC-standard WISPr attributes — recognized by virtually all WiFi gateways
  attrs.push(
    { attribute: 'WISPr-Bandwidth-Max-Down', value: String(downloadBps) },
    { attribute: 'WISPr-Bandwidth-Max-Up', value: String(uploadBps) },
  );

  // Vendor-specific attributes (deduplicated by attribute name)
  const seen = new Set<string>();
  for (const vendor of vendors) {
    const vendorAttrs = getVendorBandwidthAttrs(vendor, downloadMbps, uploadMbps, downloadBps, uploadBps);
    for (const va of vendorAttrs) {
      if (!seen.has(va.attribute)) {
        seen.add(va.attribute);
        attrs.push(va);
      }
    }
  }

  return attrs;
}

/**
 * Generate session timeout and data limit attributes for one or more vendors.
 *
 * Session-Timeout (RFC 2865) is ALWAYS included when timeoutMinutes > 0.
 * Vendor-specific data cap attributes are added based on each vendor profile.
 *
 * @param vendors - Array of normalized vendor profiles
 * @param timeoutMinutes - Session timeout in minutes (0 = no limit)
 * @param dataLimitMB - Data cap in MB (0/undefined = unlimited)
 * @returns Array of { attribute, value } pairs to write to radreply
 */
export function generateSessionAttributes(
  vendors: VendorProfile[],
  timeoutMinutes: number,
  dataLimitMB?: number,
): Array<{ attribute: string; value: string }> {
  const attrs: Array<{ attribute: string; value: string }> = [];

  // RFC-standard Session-Timeout (RFC 2865) — recognized by ALL NAS devices
  if (timeoutMinutes > 0) {
    attrs.push({ attribute: 'Session-Timeout', value: String(timeoutMinutes * 60) });
  }

  // No data limit — nothing more to add
  if (!dataLimitMB || dataLimitMB <= 0) return attrs;

  const dataLimitBytes = dataLimitMB * 1024 * 1024;

  // Vendor-specific data cap attributes (deduplicated)
  const seen = new Set<string>();
  for (const vendor of vendors) {
    const vendorAttrs = getVendorDataLimitAttrs(vendor, dataLimitBytes);
    for (const va of vendorAttrs) {
      if (!seen.has(va.attribute)) {
        seen.add(va.attribute);
        attrs.push(va);
      }
    }
  }

  return attrs;
}

// ─── Vendor-Specific Attribute Generators ────────────────────────────────

function getVendorBandwidthAttrs(
  vendor: VendorProfile,
  downloadMbps: number,
  uploadMbps: number,
  downloadBps: number,
  uploadBps: number,
): Array<{ attribute: string; value: string }> {
  const attrs: Array<{ attribute: string; value: string }> = [];

  switch (vendor) {
    case 'mikrotik':
      attrs.push({ attribute: 'Mikrotik-Rate-Limit', value: `${downloadMbps}M/${uploadMbps}M` });
      break;
    case 'cisco':
      attrs.push({
        attribute: 'Cisco-AVPair',
        value: `sub:Ingress-Committed-Data-Rate=${downloadBps}\nsub:Egress-Committed-Data-Rate=${uploadBps}`,
      });
      break;
    case 'aruba':
      attrs.push({ attribute: 'Aruba-User-Role', value: 'guest' });
      break;
    case 'chillispot':
      attrs.push(
        { attribute: 'ChilliSpot-Bandwidth-Max-Down', value: String(downloadBps) },
        { attribute: 'ChilliSpot-Bandwidth-Max-Up', value: String(uploadBps) },
      );
      break;
    case 'fortinet':
      attrs.push({ attribute: 'Fortinet-Group', value: 'guest-wifi' });
      break;
    case 'huawei':
    case 'juniper':
    case 'wispr':
      // These vendors use WISPr natively — WISPr attrs already added above
      break;
    default:
      // Unknown/other vendor: write ChilliSpot attrs for broad compatibility.
      // Do NOT write Mikrotik-specific attrs — we don't know if the NAS is Mikrotik.
      // WISPr attrs are already included above as the universal baseline.
      attrs.push(
        { attribute: 'ChilliSpot-Bandwidth-Max-Down', value: String(downloadBps) },
        { attribute: 'ChilliSpot-Bandwidth-Max-Up', value: String(uploadBps) },
      );
      break;
  }

  return attrs;
}

function getVendorDataLimitAttrs(
  vendor: VendorProfile,
  dataLimitBytes: number,
): Array<{ attribute: string; value: string }> {
  const attrs: Array<{ attribute: string; value: string }> = [];

  switch (vendor) {
    case 'mikrotik':
      attrs.push({ attribute: 'Mikrotik-Total-Limit', value: String(dataLimitBytes) });
      break;
    case 'cisco':
      attrs.push({
        attribute: 'Cisco-AVPair',
        value: `sub:quota-in=${dataLimitBytes}\nsub:quota-out=${dataLimitBytes}`,
      });
      break;
    case 'aruba':
      // Aruba data limits enforced via ClearPass policies — no direct data cap VSA
      break;
    case 'chillispot':
      attrs.push(
        { attribute: 'ChilliSpot-Max-Total-Octets', value: String(dataLimitBytes) },
        { attribute: 'ChilliSpot-Max-Input-Octets', value: String(dataLimitBytes) },
        { attribute: 'ChilliSpot-Max-Output-Octets', value: String(dataLimitBytes) },
      );
      break;
    case 'fortinet':
      attrs.push({ attribute: 'Fortinet-Group', value: 'guest-wifi' });
      break;
    case 'huawei':
    case 'juniper':
    case 'wispr':
      // These use WISPr natively or have no specific data cap VSA
      break;
    default:
      // Unknown/other vendor: write ChilliSpot attrs for broad compatibility.
      // Do NOT write Mikrotik-specific attrs — we don't know if the NAS is Mikrotik.
      attrs.push(
        { attribute: 'ChilliSpot-Max-Total-Octets', value: String(dataLimitBytes) },
        { attribute: 'ChilliSpot-Max-Input-Octets', value: String(dataLimitBytes) },
        { attribute: 'ChilliSpot-Max-Output-Octets', value: String(dataLimitBytes) },
      );
      break;
  }

  return attrs;
}

/**
 * Get all known data-limit attribute names that have a value set.
 * Used for deleting old vendor attrs before writing new ones.
 */
export function getActiveDataLimitAttrs(attributes: Record<string, string> | undefined): string[] {
  if (!attributes) return [];
  return ['Mikrotik-Total-Limit', 'ChilliSpot-Max-Total-Octets', 'ChilliSpot-Max-Input-Octets', 'ChilliSpot-Max-Output-Octets'].filter(attr => {
    const val = attributes[attr];
    return val && Number(val) > 0;
  });
}

/**
 * Get all known bandwidth attribute names that have a value set.
 * Used for deleting old vendor attrs before writing new ones.
 */
export function getActiveBandwidthAttrs(attributes: Record<string, string> | undefined): string[] {
  if (!attributes) return [];
  return ['Mikrotik-Rate-Limit', 'ChilliSpot-Bandwidth-Max-Down', 'ChilliSpot-Bandwidth-Max-Up',
    'WISPr-Bandwidth-Max-Down', 'WISPr-Bandwidth-Max-Up', 'Cisco-AVPair'].filter(attr => {
    const val = attributes[attr];
    return val && val.length > 0;
  });
}
