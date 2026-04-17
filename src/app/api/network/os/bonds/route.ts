import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import * as fs from 'fs';
import { db } from '@/lib/db';

/**
 * POST /api/network/os/bonds - Create a bond interface
 * DELETE /api/network/os/bonds - Delete a bond interface
 *
 * Uses `sudo ip link` and `sudo modprobe bonding` commands on Debian 13
 * to manage Linux bonding. Persists to /etc/network/interfaces and
 * BondConfig + BondMember in DB.
 */

function safeExec(cmd: string, timeout = 5000): string {
  try { return execSync(cmd, { encoding: 'utf-8', timeout }); } catch (e: any) { return e.stdout || ''; }
}

const INTERFACES_FILE = process.env.NETWORK_INTERFACES_FILE || '/etc/network/interfaces';
const TENANT_ID = 'tenant-1';
const PROPERTY_ID = 'property-1';

const VALID_NAME = /^[a-zA-Z0-9._-]+$/;

const VALID_BOND_MODES = [
  'active-backup', 'balance-rr', 'balance-xor',
  '802.3ad', 'balance-tlb', 'balance-alb',
];

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
 * Persist bond stanza to /etc/network/interfaces.
 */
function persistBondToFile(
  bondName: string,
  mode: string,
  members: string[],
  miimon: number,
  lacpRate: string,
  primary?: string,
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

    // Find existing stanza for this bond
    let stanzaStart = -1;
    let stanzaEnd = lines.length;

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      const ifaceMatch = trimmed.match(/^iface\s+([a-zA-Z0-9._-]+)\s+inet\s+(\S+)/);
      if (ifaceMatch && ifaceMatch[1] === bondName) {
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

    // Build stanza lines
    const stanzaLines: string[] = [];
    stanzaLines.push(`iface ${bondName} inet manual`);
    stanzaLines.push(`\tbond-mode ${mode}`);
    stanzaLines.push(`\tbond-miimon ${miimon}`);

    if (mode === '802.3ad' && lacpRate) {
      stanzaLines.push(`\tbond-lacp-rate ${lacpRate}`);
    }

    if (primary) {
      stanzaLines.push(`\tbond-primary ${primary}`);
    }

    if (members.length > 0) {
      stanzaLines.push(`\tslaves ${members.join(' ')}`);
    }

    if (ipAddress && netmask) {
      stanzaLines.push(`\taddress ${ipAddress}`);
      stanzaLines.push(`\tnetmask ${netmask}`);
    }

    // Check for existing auto line
    let hasAutoLine = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if ((trimmed.match(/^auto\s+/) || trimmed.match(/^allow-hotplug\s+/)) && trimmed.includes(bondName)) {
        hasAutoLine = true;
        break;
      }
    }

    const resultLines: string[] = [];

    if (stanzaStart !== -1) {
      const before = lines.slice(0, stanzaStart);
      const after = lines.slice(stanzaEnd);
      resultLines.push(...before);
      resultLines.push(...stanzaLines);
      resultLines.push(...after);
    } else {
      resultLines.push(...lines);

      if (resultLines.length > 0 && resultLines[resultLines.length - 1].trim() !== '') {
        resultLines.push('');
      }

      if (!hasAutoLine) {
        resultLines.push(`# STAYSUITE_MANAGED — bond ${bondName}`);
        resultLines.push(`auto ${bondName}`);
      }

      resultLines.push(...stanzaLines);
      resultLines.push('');
    }

    fs.writeFileSync(INTERFACES_FILE, resultLines.join('\n'), 'utf-8');
    return { success: true, message: `Bond stanza persisted to ${INTERFACES_FILE}` };
  } catch (err: any) {
    return { success: false, message: `File write error: ${err.message}` };
  }
}

/**
 * Remove bond stanza from /etc/network/interfaces.
 */
function removeBondFromFile(bondName: string): { success: boolean; message: string } {
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
      if (ifaceMatch && ifaceMatch[1] === bondName) {
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

      if ((trimmed.match(/^auto\s+/) || trimmed.match(/^allow-hotplug\s+/)) && trimmed.includes(bondName)) {
        i++;
        continue;
      }

      if (trimmed.match(/^#\s*STAYSUITE_MANAGED/) && trimmed.includes(bondName)) {
        i++;
        continue;
      }

      resultLines.push(lines[i]);
      i++;
    }

    fs.writeFileSync(INTERFACES_FILE, resultLines.join('\n'), 'utf-8');
    return { success: true, message: `Bond stanza removed from ${INTERFACES_FILE}` };
  } catch (err: any) {
    return { success: false, message: `File write error: ${err.message}` };
  }
}

// ────────────────────────────────────────────
// POST /api/network/os/bonds — Create a bond
// ────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, mode, members, miimon, lacpRate, primary, ipAddress, netmask } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: 'Bond name is required' } },
        { status: 400 }
      );
    }

    if (!VALID_NAME.test(name)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_NAME', message: 'Invalid bond name' } },
        { status: 400 }
      );
    }

    const bondMode = mode || 'active-backup';
    if (!VALID_BOND_MODES.includes(bondMode)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_MODE', message: `Invalid bond mode. Must be one of: ${VALID_BOND_MODES.join(', ')}` } },
        { status: 400 }
      );
    }

    if (!Array.isArray(members) || members.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: 'At least one member interface is required' } },
        { status: 400 }
      );
    }

    const safeMembers: string[] = members.filter((m: string) => typeof m === 'string' && VALID_NAME.test(m));
    if (safeMembers.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: 'No valid member interface names provided' } },
        { status: 400 }
      );
    }

    if (primary && !VALID_NAME.test(String(primary))) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PRIMARY', message: 'Invalid primary interface name' } },
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

    const bondMiimon = miimon ? parseInt(String(miimon), 10) : 100;
    const bondLacpRate = lacpRate || 'slow';

    const results: { step: string; success: boolean; message: string }[] = [];

    // 1. Load bonding kernel module
    const modprobeOutput = safeExec('sudo modprobe bonding 2>&1');
    results.push({ step: 'modprobe', success: true, message: modprobeOutput.trim() });

    // 2. Create bond interface
    const createOutput = safeExec(`sudo ip link add name ${name} type bond mode ${bondMode} miimon ${bondMiimon} 2>&1`);
    if (createOutput.includes('already exists')) {
      return NextResponse.json(
        { success: false, error: { code: 'EXISTS', message: `Bond ${name} already exists` } },
        { status: 409 }
      );
    }
    results.push({ step: 'create', success: true, message: createOutput.trim() });

    // 3. Set LACP rate for 802.3ad mode
    if (bondMode === '802.3ad') {
      const lacpOutput = safeExec(`sudo ip link set ${name} type bond lacp_rate ${bondLacpRate} 2>&1`);
      results.push({ step: 'lacp-rate', success: true, message: lacpOutput.trim() });
    }

    // 4. Set primary member if specified
    if (primary) {
      const primaryOutput = safeExec(`sudo ip link set ${name} type bond primary ${primary} 2>&1`);
      results.push({ step: 'primary', success: true, message: primaryOutput.trim() });
    }

    // 5. Add member interfaces
    for (const member of safeMembers) {
      const memberOutput = safeExec(`sudo ip link set ${member} master ${name} 2>&1`);
      results.push({ step: `member-${member}`, success: true, message: memberOutput.trim() });
    }

    // 6. Set bond IP if provided
    if (ipAddress && netmask) {
      const cidr = netmaskToCidr(netmask);
      const ipOutput = safeExec(`sudo ip addr add ${ipAddress}/${cidr} dev ${name} 2>&1`);
      results.push({ step: 'ip-address', success: true, message: ipOutput.trim() });
    }

    // 7. Bring bond up
    const upOutput = safeExec(`sudo ip link set ${name} up 2>&1`);
    results.push({ step: 'up', success: true, message: upOutput.trim() });

    // 8. Persist to /etc/network/interfaces
    const fileResult = persistBondToFile(
      name, bondMode, safeMembers, bondMiimon, bondLacpRate,
      primary, ipAddress, netmask,
    );
    results.push({ step: 'file-persist', ...fileResult });

    // 9. Persist to DB (BondConfig + BondMember)
    try {
      const bondConfig = await db.bondConfig.create({
        data: {
          tenantId: TENANT_ID,
          propertyId: PROPERTY_ID,
          name,
          mode: bondMode,
          miimon: bondMiimon,
          lacpRate: bondLacpRate,
          primaryMember: primary || null,
        },
      });

      // Create BondMember records — ensure NetworkInterface exists
      for (const member of safeMembers) {
        let netIface = await db.networkInterface.findUnique({
          where: { propertyId_name: { propertyId: PROPERTY_ID, name: member } },
        });
        if (!netIface) {
          netIface = await db.networkInterface.create({
            data: {
              tenantId: TENANT_ID,
              propertyId: PROPERTY_ID,
              name: member,
              type: 'ethernet',
              status: 'up',
            },
          });
        }

        await db.bondMember.create({
          data: {
            bondConfigId: bondConfig.id,
            interfaceId: netIface.id,
          },
        });
      }

      results.push({ step: 'database', success: true, message: 'Bond config and members saved to database' });
    } catch (dbErr: any) {
      console.warn(`[Network OS API] DB create failed for bond ${name}:`, dbErr);
      results.push({ step: 'database', success: false, message: dbErr.message });
    }

    return NextResponse.json({
      success: true,
      message: `Bond ${name} created successfully`,
      results,
      data: {
        name,
        mode: bondMode,
        members: safeMembers,
        miimon: bondMiimon,
        lacpRate: bondLacpRate,
        primary: primary || undefined,
        ipAddress: ipAddress || undefined,
        netmask: netmask || undefined,
      },
    });
  } catch (error) {
    console.error('[Network OS API] Bond create error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'OS_ERROR', message: 'Failed to create bond' } },
      { status: 500 }
    );
  }
}

// ────────────────────────────────────────────
// DELETE /api/network/os/bonds — Delete a bond
// ────────────────────────────────────────────
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    let name = searchParams.get('name');

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
        { success: false, error: { code: 'VALIDATION', message: 'Bond name is required (query param or body)' } },
        { status: 400 }
      );
    }

    if (!VALID_NAME.test(name)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_NAME', message: 'Invalid bond name' } },
        { status: 400 }
      );
    }

    const results: { step: string; success: boolean; message: string }[] = [];

    // 1. Get current members from the bond
    const linkOutput = safeExec(`ip -o link show master ${name} 2>/dev/null`);
    const currentMembers: string[] = [];
    for (const line of linkOutput.trim().split('\n').filter(Boolean)) {
      const match = line.match(/:\s*(\S+):/);
      if (match) {
        currentMembers.push(match[1]);
      }
    }

    // 2. Remove members from the bond
    for (const member of currentMembers) {
      const memberOutput = safeExec(`sudo ip link set ${member} nomaster 2>&1`);
      results.push({ step: `remove-member-${member}`, success: true, message: memberOutput.trim() });
    }

    // 3. Bring bond down
    const downOutput = safeExec(`sudo ip link set ${name} down 2>&1`);
    results.push({ step: 'down', success: true, message: downOutput.trim() });

    // 4. Delete the bond
    const delOutput = safeExec(`sudo ip link del ${name} 2>&1`);
    results.push({ step: 'delete', success: true, message: delOutput.trim() });

    // 5. Remove from /etc/network/interfaces
    const fileResult = removeBondFromFile(name);
    results.push({ step: 'file-remove', ...fileResult });

    // 6. Remove from DB
    try {
      // Delete BondMember records first
      const bondConfig = await db.bondConfig.findFirst({
        where: { propertyId: PROPERTY_ID, name },
      });

      if (bondConfig) {
        await db.bondMember.deleteMany({
          where: { bondConfigId: bondConfig.id },
        });
        await db.bondConfig.delete({
          where: { id: bondConfig.id },
        });
      }

      results.push({ step: 'database', success: true, message: 'Bond config removed from database' });
    } catch (dbErr: any) {
      console.warn(`[Network OS API] DB delete failed for bond ${name}:`, dbErr);
      results.push({ step: 'database', success: false, message: dbErr.message });
    }

    return NextResponse.json({
      success: true,
      message: `Bond ${name} deleted successfully`,
      results,
    });
  } catch (error) {
    console.error('[Network OS API] Bond delete error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'OS_ERROR', message: 'Failed to delete bond' } },
      { status: 500 }
    );
  }
}
