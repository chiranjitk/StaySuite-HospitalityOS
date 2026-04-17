import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import * as fs from 'fs';
import { db } from '@/lib/db';

/**
 * POST /api/network/os/bridges - Create a bridge interface
 * DELETE /api/network/os/bridges - Delete a bridge interface
 *
 * Uses `sudo ip link` commands on Debian 13 to manage Linux bridges.
 * Persists configuration to /etc/network/interfaces and BridgeConfig in DB.
 */

function safeExec(cmd: string, timeout = 5000): string {
  try { return execSync(cmd, { encoding: 'utf-8', timeout }); } catch (e: any) { return e.stdout || ''; }
}

const INTERFACES_FILE = process.env.NETWORK_INTERFACES_FILE || '/etc/network/interfaces';
const TENANT_ID = 'tenant-1';
const PROPERTY_ID = 'property-1';

const VALID_NAME = /^[a-zA-Z0-9._-]+$/;

function isValidIPv4(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  return parts.every(p => { const n = parseInt(p, 10); return !isNaN(n) && n >= 0 && n <= 255 && String(n) === p; });
}

function isValidNetmask(mask: string): boolean {
  if (!isValidIPv4(mask)) return false;
  const num = mask.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
  const inverted = (~num) >>> 0;
  return (inverted & (inverted + 1)) === 0 && num > 0;
}

function netmaskToCidr(mask: string): number {
  const num = mask.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
  let count = 0;
  while (num & (1 << (31 - count))) count++;
  return count;
}

/**
 * Persist bridge stanza to /etc/network/interfaces.
 * Appends or replaces an existing stanza for the bridge.
 */
function persistBridgeToFile(
  bridgeName: string,
  members: string[],
  stpEnabled: boolean,
  ipAddress?: string,
  netmask?: string,
): { success: boolean; message: string } {
  try {
    let content = '';
    try {
      content = fs.readFileSync(INTERFACES_FILE, 'utf-8');
    } catch {
      content = '# /etc/network/interfaces — managed by StaySuite HospitalityOS\n\nsource /etc/network/interfaces.d/*\n\n';
    }

    const lines = content.split('\n');

    // Find existing stanza for this bridge
    let stanzaStart = -1;
    let stanzaEnd = lines.length;

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      const ifaceMatch = trimmed.match(/^iface\s+([a-zA-Z0-9._-]+)\s+inet\s+(\S+)/);
      if (ifaceMatch && ifaceMatch[1] === bridgeName) {
        stanzaStart = i;
        for (let j = i + 1; j < lines.length; j++) {
          const nextTrimmed = lines[j].trim();
          if (nextTrimmed === '' || nextTrimmed.match(/^(?:auto|allow-hotplug|iface|source)\s/)) {
            stanzaEnd = j;
            break;
          }
        }
        break;
      }
    }

    // Build stanza
    const stanzaLines: string[] = [];

    // Look for existing auto/allow-hotplug line
    let hasAutoLine = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if ((trimmed.match(/^auto\s+/) || trimmed.match(/^allow-hotplug\s+/)) && trimmed.includes(bridgeName)) {
        hasAutoLine = true;
        break;
      }
    }

    const resultLines: string[] = [];

    if (stanzaStart !== -1) {
      // Replace existing stanza
      const before = lines.slice(0, stanzaStart);
      const after = lines.slice(stanzaEnd);
      resultLines.push(...before);
    } else {
      resultLines.push(...lines);
    }

    if (!hasAutoLine) {
      if (resultLines.length > 0 && resultLines[resultLines.length - 1].trim() !== '') {
        resultLines.push('');
      }
      resultLines.push(`# STAYSUITE_MANAGED — bridge ${bridgeName}`);
      resultLines.push(`auto ${bridgeName}`);
    }

    stanzaLines.push(`iface ${bridgeName} inet manual`);
    if (stpEnabled) {
      stanzaLines.push(`\tbridge-stp yes`);
    } else {
      stanzaLines.push(`\tbridge-stp no`);
    }

    if (members.length > 0) {
      stanzaLines.push(`\tbridge-ports ${members.join(' ')}`);
    }

    if (ipAddress && netmask) {
      stanzaLines.push(`\taddress ${ipAddress}`);
      stanzaLines.push(`\tnetmask ${netmask}`);
    }

    if (resultLines.length > 0 && resultLines[resultLines.length - 1].trim() !== '' && stanzaStart === -1) {
      resultLines.push('');
    }

    if (stanzaStart !== -1) {
      // Already had the before portion, now add stanza + after
      resultLines.push(...stanzaLines);
      resultLines.push(...lines.slice(stanzaEnd));
    } else {
      resultLines.push(...stanzaLines);
      resultLines.push('');
    }

    fs.writeFileSync(INTERFACES_FILE, resultLines.join('\n'), 'utf-8');
    return { success: true, message: `Bridge stanza persisted to ${INTERFACES_FILE}` };
  } catch (err: any) {
    return { success: false, message: `File write error: ${err.message}` };
  }
}

/**
 * Remove bridge stanza from /etc/network/interfaces.
 */
function removeBridgeFromFile(bridgeName: string): { success: boolean; message: string } {
  try {
    let content = '';
    try {
      content = fs.readFileSync(INTERFACES_FILE, 'utf-8');
    } catch {
      return { success: true, message: 'No interfaces file to update' };
    }

    const lines = content.split('\n');
    const resultLines: string[] = [];

    let i = 0;
    while (i < lines.length) {
      const trimmed = lines[i].trim();
      const ifaceMatch = trimmed.match(/^iface\s+([a-zA-Z0-9._-]+)\s+inet\s+(\S+)/);
      if (ifaceMatch && ifaceMatch[1] === bridgeName) {
        // Skip this stanza until the next blank line or next stanza
        i++;
        while (i < lines.length) {
          const nextTrimmed = lines[i].trim();
          if (nextTrimmed === '' || nextTrimmed.match(/^(?:auto|allow-hotplug|iface|source)\s/)) {
            break;
          }
          i++;
        }
        continue;
      }

      // Also remove auto/allow-hotplug lines for this bridge
      if ((trimmed.match(/^auto\s+/) || trimmed.match(/^allow-hotplug\s+/)) && trimmed.includes(bridgeName)) {
        i++;
        continue;
      }

      // Remove STAYSUITE_MANAGED comment for this bridge
      if (trimmed.match(/^#\s*STAYSUITE_MANAGED/) && trimmed.includes(bridgeName)) {
        i++;
        continue;
      }

      resultLines.push(lines[i]);
      i++;
    }

    fs.writeFileSync(INTERFACES_FILE, resultLines.join('\n'), 'utf-8');
    return { success: true, message: `Bridge stanza removed from ${INTERFACES_FILE}` };
  } catch (err: any) {
    return { success: false, message: `File write error: ${err.message}` };
  }
}

// ──────────────────────────────────────────────
// POST /api/network/os/bridges — Create a bridge
// ──────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, members, stp, forwardDelay, ipAddress, netmask, description } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: 'Bridge name is required' } },
        { status: 400 }
      );
    }

    if (!VALID_NAME.test(name)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_NAME', message: 'Invalid bridge name. Use only alphanumeric, dots, hyphens, underscores.' } },
        { status: 400 }
      );
    }

    if (ipAddress && !isValidIPv4(ipAddress)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_IP', message: 'Invalid IPv4 address' } },
        { status: 400 }
      );
    }

    if (netmask && !isValidNetmask(netmask)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_NETMASK', message: 'Invalid netmask' } },
        { status: 400 }
      );
    }

    const safeMembers: string[] = Array.isArray(members)
      ? members.filter((m: string) => typeof m === 'string' && VALID_NAME.test(m))
      : [];

    const results: { step: string; success: boolean; message: string }[] = [];

    // 1. Create the bridge at OS level
    const createOutput = safeExec(`sudo ip link add name ${name} type bridge 2>&1`);
    if (createOutput.includes('Error') || createOutput.includes('already exists')) {
      if (createOutput.includes('already exists')) {
        return NextResponse.json(
          { success: false, error: { code: 'EXISTS', message: `Bridge ${name} already exists` } },
          { status: 409 }
        );
      }
      results.push({ step: 'create', success: false, message: createOutput.trim() });
    } else {
      results.push({ step: 'create', success: true, message: `Bridge ${name} created` });
    }

    // 2. Set STP
    if (stp !== undefined) {
      const stpState = stp ? '1' : '0';
      const stpOutput = safeExec(`sudo ip link set ${name} type bridge stp_state ${stpState} 2>&1`);
      results.push({ step: 'stp', success: true, message: stpOutput.trim() });
    }

    // 3. Set forward delay if provided
    if (forwardDelay !== undefined) {
      const fd = parseInt(String(forwardDelay), 10);
      if (!isNaN(fd) && fd >= 2 && fd <= 30) {
        safeExec(`sudo ip link set ${name} type bridge forward_delay ${fd} 2>&1`);
        results.push({ step: 'forward-delay', success: true, message: `Forward delay set to ${fd}` });
      }
    }

    // 4. Add member interfaces
    for (const member of safeMembers) {
      const memberOutput = safeExec(`sudo ip link set ${member} master ${name} 2>&1`);
      results.push({ step: `member-${member}`, success: true, message: memberOutput.trim() });
    }

    // 5. Set bridge IP if provided
    if (ipAddress && netmask) {
      const cidr = netmaskToCidr(netmask);
      const ipOutput = safeExec(`sudo ip addr add ${ipAddress}/${cidr} dev ${name} 2>&1`);
      results.push({ step: 'ip-address', success: true, message: ipOutput.trim() });
    }

    // 6. Bring bridge up
    const upOutput = safeExec(`sudo ip link set ${name} up 2>&1`);
    results.push({ step: 'up', success: true, message: upOutput.trim() });

    // 7. Persist to /etc/network/interfaces
    const fileResult = persistBridgeToFile(name, safeMembers, !!stp, ipAddress, netmask);
    results.push({ step: 'file-persist', ...fileResult });

    // 8. Persist to DB (BridgeConfig)
    try {
      await db.bridgeConfig.create({
        data: {
          tenantId: TENANT_ID,
          propertyId: PROPERTY_ID,
          name,
          memberInterfaces: JSON.stringify(safeMembers),
          stpEnabled: !!stp,
          forwardDelay: forwardDelay ? parseInt(String(forwardDelay), 10) : 15,
        },
      });
      results.push({ step: 'database', success: true, message: 'Bridge config saved to database' });
    } catch (dbErr: any) {
      console.warn(`[Network OS API] DB create failed for bridge ${name}:`, dbErr);
      results.push({ step: 'database', success: false, message: dbErr.message });
    }

    return NextResponse.json({
      success: true,
      message: `Bridge ${name} created successfully`,
      results,
      data: {
        name,
        members: safeMembers,
        stp: !!stp,
        forwardDelay,
        ipAddress: ipAddress || undefined,
        netmask: netmask || undefined,
      },
    });
  } catch (error) {
    console.error('[Network OS API] Bridge create error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'OS_ERROR', message: 'Failed to create bridge' } },
      { status: 500 }
    );
  }
}

// ──────────────────────────────────────────────
// DELETE /api/network/os/bridges — Delete a bridge
// ──────────────────────────────────────────────
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    // Accept name from query param
    let name = searchParams.get('name');

    // Also try to parse from body if not in query
    if (!name) {
      try {
        const body = await request.json();
        name = body.name;
      } catch {
        // No body
      }
    }

    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: 'Bridge name is required (query param or body)' } },
        { status: 400 }
      );
    }

    if (!VALID_NAME.test(name)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_NAME', message: 'Invalid bridge name' } },
        { status: 400 }
      );
    }

    const results: { step: string; success: boolean; message: string }[] = [];

    // 1. Get current members from the bridge
    const linkOutput = safeExec(`ip -o link show master ${name} 2>/dev/null`);
    const currentMembers: string[] = [];
    for (const line of linkOutput.trim().split('\n').filter(Boolean)) {
      const match = line.match(/:\s*(\S+):/);
      if (match) {
        currentMembers.push(match[1]);
      }
    }

    // 2. Remove members from the bridge
    for (const member of currentMembers) {
      const memberOutput = safeExec(`sudo ip link set ${member} nomaster 2>&1`);
      results.push({ step: `remove-member-${member}`, success: true, message: memberOutput.trim() });
    }

    // 3. Bring bridge down
    const downOutput = safeExec(`sudo ip link set ${name} down 2>&1`);
    results.push({ step: 'down', success: true, message: downOutput.trim() });

    // 4. Delete the bridge
    const delOutput = safeExec(`sudo ip link del ${name} 2>&1`);
    results.push({ step: 'delete', success: true, message: delOutput.trim() });

    // 5. Remove from /etc/network/interfaces
    const fileResult = removeBridgeFromFile(name);
    results.push({ step: 'file-remove', ...fileResult });

    // 6. Remove from DB
    try {
      await db.bridgeConfig.deleteMany({
        where: { propertyId: PROPERTY_ID, name },
      });
      results.push({ step: 'database', success: true, message: 'Bridge config removed from database' });
    } catch (dbErr: any) {
      console.warn(`[Network OS API] DB delete failed for bridge ${name}:`, dbErr);
      results.push({ step: 'database', success: false, message: dbErr.message });
    }

    return NextResponse.json({
      success: true,
      message: `Bridge ${name} deleted successfully`,
      results,
    });
  } catch (error) {
    console.error('[Network OS API] Bridge delete error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'OS_ERROR', message: 'Failed to delete bridge' } },
      { status: 500 }
    );
  }
}
