import { NextRequest, NextResponse } from 'next/server';
import {
  createBond,
  deleteBond,
  listBonds,
  persistBond,
  removePersistedBond,
} from '@/lib/network';
import { db } from '@/lib/db';

/**
 * POST   /api/network/os/bonds — Create a bond interface
 * DELETE /api/network/os/bonds — Delete a bond interface
 *
 * Uses shell script wrappers from @/lib/network for all OS commands
 * and file persistence. DB operations remain inline.
 */

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

// ──────────────────────────────────────────────
// POST — Create a bond
// ──────────────────────────────────────────────
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

    // 1. Create the bond at OS level via shell script
    try {
      const bondResult = createBond({
        name,
        mode: bondMode,
        miimon: bondMiimon,
        lacpRate: bondLacpRate as 'slow' | 'fast',
        primary: primary || undefined,
        members: safeMembers,
      });

      if (!bondResult.success) {
        const errMsg = bondResult.error || 'Unknown error';
        if (errMsg.toLowerCase().includes('already exists')) {
          return NextResponse.json(
            { success: false, error: { code: 'EXISTS', message: `Bond ${name} already exists` } },
            { status: 409 }
          );
        }
        return NextResponse.json(
          { success: false, error: { code: 'OS_ERROR', message: errMsg } },
          { status: 500 }
        );
      }

      results.push({ step: 'create', success: true, message: `Bond ${name} created` });
    } catch (e: any) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID', message: e.message } },
        { status: 400 }
      );
    }

    // 2. Persist to /etc/network/interfaces via shell script
    try {
      const persistResult = persistBond({
        name,
        mode: bondMode,
        miimon: bondMiimon,
        lacpRate: bondLacpRate,
        primary: primary || undefined,
        members: safeMembers,
      });

      if (!persistResult.success) {
        results.push({ step: 'file-persist', success: false, message: persistResult.error || 'File persistence failed' });
      } else {
        results.push({ step: 'file-persist', success: true, message: `Bond stanza persisted to /etc/network/interfaces` });
      }
    } catch (e: any) {
      results.push({ step: 'file-persist', success: false, message: e.message });
    }

    // 3. Persist to DB (BondConfig + BondMember)
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

// ──────────────────────────────────────────────
// DELETE — Delete a bond
// ──────────────────────────────────────────────
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
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

    // 1. Delete the bond at OS level via shell script
    try {
      const bondResult = deleteBond(name);

      if (!bondResult.success) {
        results.push({ step: 'delete', success: false, message: bondResult.error || 'OS deletion failed' });
      } else {
        results.push({ step: 'delete', success: true, message: `Bond ${name} deleted` });
      }
    } catch (e: any) {
      results.push({ step: 'delete', success: false, message: e.message });
    }

    // 2. Remove from /etc/network/interfaces via shell script
    try {
      const persistResult = removePersistedBond(name);

      if (!persistResult.success) {
        results.push({ step: 'file-remove', success: false, message: persistResult.error || 'File removal failed' });
      } else {
        results.push({ step: 'file-remove', success: true, message: `Bond stanza removed from /etc/network/interfaces` });
      }
    } catch (e: any) {
      results.push({ step: 'file-remove', success: false, message: e.message });
    }

    // 3. Remove from DB
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
