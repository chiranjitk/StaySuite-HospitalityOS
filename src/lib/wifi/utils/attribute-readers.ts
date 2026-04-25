/**
 * Client-Safe RADIUS Attribute Readers
 *
 * Pure functions for reading and parsing RADIUS attributes — NO database imports.
 * Can be safely imported in both server and client (React) code.
 *
 * Architecture:
 *   FreeRADIUS ships 300+ vendor dictionary files (e.g., /usr/share/freeradius/dictionary.mikrotik).
 *   Each vendor defines its own VSAs (Vendor-Specific Attributes) for bandwidth, data caps, etc.
 *
 *   StaySuite maps 300+ vendor identifiers to 9 canonical profiles:
 *     mikrotik, cisco, aruba, chillispot, fortinet, huawei, juniper, wispr, other
 *
 *   For each profile, we know which attribute names to READ from radreply.
 *   When WRITING, the vendor-profile system generates the correct attrs per NAS vendor.
 *
 *   This file handles READING only — it checks ALL known attribute names regardless of vendor.
 */

// ─── All Known RADIUS Attribute Names by Purpose ──────────────────────────

/**
 * All known data-limit attribute names across vendors.
 * Used for READING data caps from radreply regardless of vendor.
 *
 * Sources:
 *   - Mikrotik-Total-Limit        → /usr/share/freeradius/dictionary.mikrotik
 *   - ChilliSpot-Max-Total-Octets → /usr/share/freeradius/dictionary.chillispot
 *   - Cisco-AVPair (quota-*)      → /usr/share/freeradius/dictionary.cisco
 */
export const DATA_LIMIT_ATTRIBUTES: string[] = [
  'Mikrotik-Total-Limit',           // MikroTik — total bytes
  'ChilliSpot-Max-Total-Octets',    // CoovaChilli/pfSense — total bytes
  'ChilliSpot-Max-Input-Octets',    // CoovaChilli — input bytes
  'ChilliSpot-Max-Output-Octets',   // CoovaChilli — output bytes
];

/**
 * All known bandwidth attribute names across vendors.
 * Used for READING bandwidth from radreply.
 */
export const BANDWIDTH_ATTRIBUTES: string[] = [
  'Mikrotik-Rate-Limit',             // MikroTik — "50M/25M"
  'ChilliSpot-Bandwidth-Max-Down',   // CoovaChilli — bps
  'ChilliSpot-Bandwidth-Max-Up',     // CoovaChilli — bps
  'WISPr-Bandwidth-Max-Down',        // RFC WISPr — bps (universal)
  'WISPr-Bandwidth-Max-Up',          // RFC WISPr — bps (universal)
];

/**
 * All vendor-specific bandwidth + data-limit attribute names combined.
 * Used for deleting old vendor attrs before writing new ones.
 */
export const ALL_VENDOR_SPECIFIC_ATTRIBUTES: string[] = [
  ...DATA_LIMIT_ATTRIBUTES,
  ...BANDWIDTH_ATTRIBUTES.filter(a => !a.startsWith('WISPr')), // WISPr is RFC-standard, always kept
  'Cisco-AVPair',                   // Cisco — multipurpose VSA
];

// ─── Reading Functions (vendor-agnostic) ─────────────────────────────────

/**
 * Read data limit from a user's radreply attributes.
 * Checks ALL known data-limit attribute names (priority order).
 *
 * @param attributes - User's radreply attributes (Record<string, string>)
 * @returns Data limit in MB, or null if unlimited
 */
export function readDataLimitMB(attributes: Record<string, string> | undefined): number | null {
  if (!attributes) return null;

  // Check each known data-limit attribute (priority: most specific first)
  for (const attr of DATA_LIMIT_ATTRIBUTES) {
    const val = attributes[attr];
    if (val && Number(val) > 0) {
      return Math.round(Number(val) / (1024 * 1024));
    }
  }

  return null;
}

/**
 * Read data limit in bytes from a user's radreply attributes.
 * Checks ALL known vendor data-limit attribute names.
 *
 * @param attributes - User's radreply attributes
 * @returns Data limit in bytes, or 0 if unlimited
 */
export function readDataLimitBytes(attributes: Record<string, string> | undefined): number {
  if (!attributes) return 0;

  for (const attr of DATA_LIMIT_ATTRIBUTES) {
    const val = attributes[attr];
    if (val && Number(val) > 0) return Number(val);
  }

  return 0;
}

/**
 * Read bandwidth (download/upload in Mbps) from user's radreply attributes.
 * Checks vendor-specific attributes first, falls back to WISPr.
 *
 * Priority:
 *   1. Mikrotik-Rate-Limit ("50M/25M" format)
 *   2. WISPr-Bandwidth-Max-Down/Up (bps)
 *   3. ChilliSpot-Bandwidth-Max-Down/Up (bps)
 *
 * @param attributes - User's radreply attributes
 * @returns { downloadMbps, uploadMbps }
 */
export function readBandwidthMbps(attributes: Record<string, string> | undefined): { downloadMbps: number; uploadMbps: number } {
  if (!attributes) return { downloadMbps: 0, uploadMbps: 0 };

  // Try Mikrotik-Rate-Limit first ("50M/25M" format)
  const mkRate = attributes['Mikrotik-Rate-Limit'];
  if (mkRate) {
    const parts = mkRate.match(/(\d+)M\/(\d+)M/i);
    if (parts) {
      return { downloadMbps: parseInt(parts[1]), uploadMbps: parseInt(parts[2]) };
    }
  }

  // Try WISPr attributes (bps → Mbps)
  const wisprDown = attributes['WISPr-Bandwidth-Max-Down'];
  const wisprUp = attributes['WISPr-Bandwidth-Max-Up'];
  if (wisprDown && wisprUp && Number(wisprDown) > 0) {
    return {
      downloadMbps: Math.round(Number(wisprDown) / 1000000),
      uploadMbps: Math.round(Number(wisprUp) / 1000000),
    };
  }

  // Try ChilliSpot attributes (bps → Mbps)
  const chilliDown = attributes['ChilliSpot-Bandwidth-Max-Down'];
  const chilliUp = attributes['ChilliSpot-Bandwidth-Max-Up'];
  if (chilliDown && chilliUp && Number(chilliDown) > 0) {
    return {
      downloadMbps: Math.round(Number(chilliDown) / 1000000),
      uploadMbps: Math.round(Number(chilliUp) / 1000000),
    };
  }

  return { downloadMbps: 0, uploadMbps: 0 };
}

/**
 * Get bandwidth display string from user attributes.
 * Returns formatted string like "50M/25M" or "N/A" if not set.
 */
export function getBandwidthDisplay(attributes: Record<string, string> | undefined): string {
  if (!attributes) return 'N/A';
  const { downloadMbps, uploadMbps } = readBandwidthMbps(attributes);
  if (downloadMbps === 0 && uploadMbps === 0) return 'N/A';
  return `${downloadMbps}M/${uploadMbps}M`;
}

/**
 * Check if a user has ANY data limit attribute set.
 * Used for displaying "Unlimited" vs a specific cap.
 */
export function hasDataLimit(attributes: Record<string, string> | undefined): boolean {
  if (!attributes) return false;
  return DATA_LIMIT_ATTRIBUTES.some(attr => {
    const val = attributes[attr];
    return val && Number(val) > 0;
  });
}

/**
 * Get human-readable data limit string.
 * Returns "Unlimited", "5.0 GB", or "500 MB".
 */
export function getDataLimitDisplay(attributes: Record<string, string> | undefined, fallbackMB?: number): string {
  const bytes = readDataLimitBytes(attributes);
  if (bytes > 0) {
    if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    return `${Math.round(bytes / (1024 * 1024))} MB`;
  }
  const mb = fallbackMB || 0;
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return mb > 0 ? `${mb} MB` : 'Unlimited';
}

/**
 * Get session timeout display string.
 * Returns "30d", "2.5d", "4h", "45m", or "N/A".
 */
export function getSessionTimeoutDisplay(sessionTimeoutSec?: string, fallbackMin?: number): string {
  let minutes = fallbackMin || 0;
  if (sessionTimeoutSec) {
    minutes = Math.round(Number(sessionTimeoutSec) / 60);
  }
  if (minutes <= 0) return 'N/A';
  if (minutes >= 1440) {
    const days = minutes / 1440;
    return days % 1 === 0 ? `${days}d` : `${days.toFixed(1)}d`;
  }
  if (minutes >= 60) return `${Math.round(minutes / 60)}h`;
  return `${minutes}m`;
}

/**
 * Get valid-until relative display.
 * Returns human-readable remaining time with appropriate granularity.
 */
export function getValidityDisplay(validUntil?: string): { text: string; className: string } {
  if (!validUntil) return { text: 'N/A', className: 'text-muted-foreground' };
  const diffMs = new Date(validUntil).getTime() - Date.now();
  if (diffMs <= 0) return { text: 'Expired', className: 'text-red-500 font-medium' };

  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const days = Math.floor(hours / 24);

  if (days > 0) {
    const remainingHours = hours % 24;
    if (days <= 3) return { text: `${days}d ${remainingHours}h left`, className: 'text-amber-600' };
    if (days <= 7) return { text: `${days}d left`, className: 'text-emerald-600' };
    return { text: `${days}d left`, className: 'text-muted-foreground' };
  }
  if (hours > 0) {
    return { text: `${hours}h ${minutes}m left`, className: 'text-amber-500 font-medium' };
  }
  return { text: `${minutes}m left`, className: 'text-red-500 font-medium' };
}
