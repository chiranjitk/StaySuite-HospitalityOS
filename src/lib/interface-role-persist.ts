import * as fs from 'fs';
import * as path from 'path';

/**
 * Interface Role Persistence Utility
 *
 * Manages WAN/LAN/DMZ role mappings that persist at the OS level via
 * comment tags in /etc/network/interfaces, providing zero-config
 * role detection on boot independent of the database.
 *
 * Comment tag format:
 *   # STAYSUITE_ROLE: wan
 *   # STAYSUITE_PRIORITY: 1
 *   allow-hotplug eth0
 *   iface eth0 inet dhcp
 */

// ─── Configuration ──────────────────────────────────────────────────────────

const DEFAULT_INTERFACES_FILE = '/etc/network/interfaces';

const INTERFACES_FILE = process.env.NETWORK_INTERFACES_FILE || DEFAULT_INTERFACES_FILE;

const VALID_ROLES = [
  'wan',
  'lan',
  'dmz',
  'management',
  'wifi',
  'guest',
  'iot',
  'unused',
] as const;

export type InterfaceRoleType = (typeof VALID_ROLES)[number];

export interface InterfaceRoleInfo {
  role: string;
  priority: number;
}

// ─── Parsing ────────────────────────────────────────────────────────────────

/**
 * Parses /etc/network/interfaces and extracts all STAYSUITE_ROLE /
 * STAYSUITE_PRIORITY comment tags, returning a Map keyed by interface name.
 */
export function readInterfaceRolesFromOS(): Map<string, InterfaceRoleInfo> {
  const result = new Map<string, InterfaceRoleInfo>();

  if (!fs.existsSync(INTERFACES_FILE)) {
    console.warn(
      `[interface-role-persist] File not found: ${INTERFACES_FILE} — returning empty map`
    );
    return result;
  }

  let content: string;
  try {
    content = fs.readFileSync(INTERFACES_FILE, 'utf-8');
  } catch (err) {
    console.error(
      `[interface-role-persist] Failed to read ${INTERFACES_FILE}:`,
      err
    );
    return result;
  }

  const lines = content.split('\n');
  let currentRole: string | null = null;
  let currentPriority = 0;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    // Reset on any non-comment, non-empty line that starts a new stanza
    // (iface, auto, allow-hotplug, etc.)
    if (!line.startsWith('#')) {
      if (line.length === 0) {
        // blank line — does not reset context
        continue;
      }

      // If we accumulated a role and hit a stanza header, flush it
      if (currentRole !== null) {
        // We need the interface name from the stanza
        const ifaceMatch = line.match(
          /^(?:auto|allow-hotplug|iface|source)\s+([a-zA-Z0-9._-]+)/
        );
        if (ifaceMatch) {
          const ifaceName = ifaceMatch[1];
          if (!result.has(ifaceName)) {
            result.set(ifaceName, { role: currentRole, priority: currentPriority });
          }
        }
        // Reset — tags belong to the stanza that follows them
        currentRole = null;
        currentPriority = 0;
      }
      continue;
    }

    // Comment line
    const roleMatch = line.match(/^#\s*STAYSUITE_ROLE:\s*(\S+)/i);
    if (roleMatch) {
      currentRole = roleMatch[1].toLowerCase();
      // Validate role
      if (!VALID_ROLES.includes(currentRole as InterfaceRoleType)) {
        console.warn(
          `[interface-role-persist] Unknown role "${currentRole}" in ${INTERFACES_FILE} — skipping`
        );
        currentRole = null;
      }
      continue;
    }

    const priorityMatch = line.match(/^#\s*STAYSUITE_PRIORITY:\s*(\d+)/i);
    if (priorityMatch) {
      currentPriority = parseInt(priorityMatch[1], 10) || 0;
      continue;
    }
  }

  return result;
}

// ─── Writing ────────────────────────────────────────────────────────────────

/**
 * Writes or updates the STAYSUITE_ROLE and STAYSUITE_PRIORITY comment tags
 * for the given interface in /etc/network/interfaces.
 *
 * Strategy:
 *  1. If tags already exist for this interface — replace in-place.
 *  2. If the interface stanza exists but has no tags — insert before the stanza.
 *  3. If the interface stanza doesn't exist at all — append a new stanza.
 */
export async function writeInterfaceRoleToOS(
  ifaceName: string,
  role: string,
  priority: number
): Promise<{ success: boolean; message: string }> {
  // Validate inputs
  if (!/^[a-zA-Z0-9._-]+$/.test(ifaceName)) {
    return {
      success: false,
      message: `Invalid interface name: "${ifaceName}"`,
    };
  }

  const normalisedRole = role.toLowerCase();
  if (!VALID_ROLES.includes(normalisedRole as InterfaceRoleType)) {
    return {
      success: false,
      message: `Invalid role "${role}". Must be one of: ${VALID_ROLES.join(', ')}`,
    };
  }

  if (typeof priority !== 'number' || priority < 0) {
    priority = 0;
  }

  try {
    const content = await ensureFileContent();
    const lines = content.split('\n');

    const modified = injectRoleTags(lines, ifaceName, normalisedRole, priority);

    fs.mkdirSync(path.dirname(INTERFACES_FILE), { recursive: true });
    fs.writeFileSync(INTERFACES_FILE, modified.join('\n'), 'utf-8');

    console.log(
      `[interface-role-persist] Set role=${normalisedRole}, priority=${priority} for ${ifaceName}`
    );

    return { success: true, message: `Role "${normalisedRole}" set for ${ifaceName}` };
  } catch (err: any) {
    console.error(
      `[interface-role-persist] Failed to write role for ${ifaceName}:`,
      err
    );
    return {
      success: false,
      message: `Write failed: ${err.message || String(err)}`,
    };
  }
}

/**
 * Removes STAYSUITE_ROLE and STAYSUITE_PRIORITY comment tags
 * for the given interface from /etc/network/interfaces.
 *
 * The underlying interface stanza is NOT removed — only the tags.
 */
export async function removeInterfaceRoleFromOS(
  ifaceName: string
): Promise<{ success: boolean; message: string }> {
  if (!/^[a-zA-Z0-9._-]+$/.test(ifaceName)) {
    return {
      success: false,
      message: `Invalid interface name: "${ifaceName}"`,
    };
  }

  try {
    const content = await ensureFileContent();
    const lines = content.split('\n');

    const modified = removeRoleTags(lines, ifaceName);

    fs.mkdirSync(path.dirname(INTERFACES_FILE), { recursive: true });
    fs.writeFileSync(INTERFACES_FILE, modified.join('\n'), 'utf-8');

    console.log(
      `[interface-role-persist] Removed role tags for ${ifaceName}`
    );

    return { success: true, message: `Role tags removed for ${ifaceName}` };
  } catch (err: any) {
    console.error(
      `[interface-role-persist] Failed to remove role for ${ifaceName}:`,
      err
    );
    return {
      success: false,
      message: `Remove failed: ${err.message || String(err)}`,
    };
  }
}

// ─── Internal helpers ───────────────────────────────────────────────────────

async function ensureFileContent(): Promise<string> {
  try {
    return fs.readFileSync(INTERFACES_FILE, 'utf-8');
  } catch {
    // File doesn't exist — create a minimal header
    const header = '# /etc/network/interfaces — managed by StaySuite HospitalityOS\n\n';
    fs.mkdirSync(path.dirname(INTERFACES_FILE), { recursive: true });
    fs.writeFileSync(INTERFACES_FILE, header, 'utf-8');
    return header;
  }
}

/**
 * Find the line index of an interface stanza (auto / allow-hotplug / iface)
 * that references the given interface name.
 */
function findIfaceLineIndex(
  lines: string[],
  ifaceName: string
): number {
  // Look for the first mention of the interface in a stanza header
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (
      trimmed.match(
        /^(?:auto|allow-hotplug|iface|source)\s+([a-zA-Z0-9._-]+)/
      )
    ) {
      const match = trimmed.match(
        /^(?:auto|allow-hotplug|iface|source)\s+([a-zA-Z0-9._-]+)/
      );
      if (match && match[1] === ifaceName) {
        return i;
      }
    }
  }
  return -1;
}

/**
 * Find existing STAYSUITE_ROLE tag for an interface.
 * Returns { lineIndex, tagBlockStart, tagBlockEnd } or null.
 *
 * The tag block is defined as consecutive STAYSUITE_* comment lines
 * immediately preceding the interface stanza header.
 */
function findExistingTagBlock(
  lines: string[],
  ifaceName: string
): { lineIndex: number; tagBlockStart: number; tagBlockEnd: number } | null {
  const ifaceIdx = findIfaceLineIndex(lines, ifaceName);
  if (ifaceIdx === -1) return null;

  // Walk backwards from the stanza header to collect the tag block
  let blockStart = ifaceIdx;
  while (blockStart > 0) {
    const prev = lines[blockStart - 1].trim();
    if (prev.match(/^#\s*STAYSUITE_/i)) {
      blockStart--;
    } else {
      break;
    }
  }

  // Check if any STAYSUITE_ROLE line exists in the block
  const hasRole = lines
    .slice(blockStart, ifaceIdx)
    .some((l) => l.trim().match(/^#\s*STAYSUITE_ROLE:/i));

  if (!hasRole) return null;

  return {
    lineIndex: ifaceIdx,
    tagBlockStart: blockStart,
    tagBlockEnd: ifaceIdx, // exclusive
  };
}

/**
 * Inject or replace role tags into the lines array.
 */
function injectRoleTags(
  lines: string[],
  ifaceName: string,
  role: string,
  priority: number
): string[] {
  const existing = findExistingTagBlock(lines, ifaceName);

  const newTags = [
    `# STAYSUITE_ROLE: ${role}`,
    `# STAYSUITE_PRIORITY: ${priority}`,
  ];

  if (existing) {
    // Replace the existing tag block
    const before = lines.slice(0, existing.tagBlockStart);
    const after = lines.slice(existing.tagBlockEnd);
    return [...before, ...newTags, ...after];
  }

  // No existing tags — check if the stanza exists at all
  const ifaceIdx = findIfaceLineIndex(lines, ifaceName);

  if (ifaceIdx !== -1) {
    // Insert tags right before the stanza header
    const before = lines.slice(0, ifaceIdx);
    const after = lines.slice(ifaceIdx);
    // Ensure there's a newline separator before the tags if the preceding
    // line isn't blank and isn't already a comment
    const needBlank =
      before.length > 0 &&
      before[before.length - 1].trim() !== '' &&
      !before[before.length - 1].trim().startsWith('#');
    const separator = needBlank ? [''] : [];
    return [...before, ...separator, ...newTags, ...after];
  }

  // Interface stanza doesn't exist — append a new one
  const appended = [
    ...lines,
    '', // blank line separator
    ...newTags,
    `allow-hotplug ${ifaceName}`,
    `iface ${ifaceName} inet dhcp`,
  ];

  // Remove trailing blank lines and ensure exactly one trailing newline
  while (appended.length > 0 && appended[appended.length - 1] === '') {
    appended.pop();
  }
  appended.push('');

  return appended;
}

/**
 * Remove role tags from the lines array.
 */
function removeRoleTags(lines: string[], ifaceName: string): string[] {
  const existing = findExistingTagBlock(lines, ifaceName);
  if (!existing) {
    return lines; // nothing to remove
  }

  const before = lines.slice(0, existing.tagBlockStart);
  const after = lines.slice(existing.tagBlockEnd);

  // Clean up: if the line before the removed block is blank, and the line
  // after (the stanza header) follows, keep the blank; otherwise remove it
  // to avoid double blanks.
  if (
    before.length > 0 &&
    before[before.length - 1].trim() === '' &&
    after.length > 0 &&
    after[0].trim() !== ''
  ) {
    // keep single blank
    return [...before, ...after];
  }

  return [...before, ...after];
}
