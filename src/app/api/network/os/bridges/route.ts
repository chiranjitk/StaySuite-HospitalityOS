import { NextRequest, NextResponse } from 'next/server';
import {
  createBridge,
  deleteBridge,
  listBridges,
  persistBridge,
  removePersistedBridge,
} from '@/lib/network';
import { db } from '@/lib/db';

/**
 * POST   /api/network/os/bridges — Create a bridge interface
 * DELETE /api/network/os/bridges — Delete a bridge interface
 *
 * Uses shell script wrappers from @/lib/network for all OS commands
 * and file persistence. DB operations remain inline.
 */

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

// ──────────────────────────────────────────────
// POST — Create a bridge
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

    // 1. Create the bridge at OS level via shell script
    try {
      const bridgeResult = createBridge({
        name,
        stp: !!stp,
        forwardDelay: forwardDelay ? parseInt(String(forwardDelay), 10) : 15,
        members: safeMembers,
      });

      if (!bridgeResult.success) {
        const errMsg = bridgeResult.error || 'Unknown error';
        if (errMsg.toLowerCase().includes('already exists')) {
          return NextResponse.json(
            { success: false, error: { code: 'EXISTS', message: `Bridge ${name} already exists` } },
            { status: 409 }
          );
        }
        return NextResponse.json(
          { success: false, error: { code: 'OS_ERROR', message: errMsg } },
          { status: 500 }
        );
      }

      results.push({ step: 'create', success: true, message: `Bridge ${name} created` });
    } catch (e: any) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID', message: e.message } },
        { status: 400 }
      );
    }

    // 2. Persist to /etc/network/interfaces via shell script
    try {
      const persistResult = persistBridge({
        name,
        stp: !!stp,
        forwardDelay: forwardDelay ? parseInt(String(forwardDelay), 10) : 15,
        members: safeMembers,
        ipAddress,
        netmask,
      });

      if (!persistResult.success) {
        results.push({ step: 'file-persist', success: false, message: persistResult.error || 'File persistence failed' });
      } else {
        results.push({ step: 'file-persist', success: true, message: `Bridge stanza persisted to /etc/network/interfaces` });
      }
    } catch (e: any) {
      results.push({ step: 'file-persist', success: false, message: e.message });
    }

    // 3. Persist to DB (BridgeConfig)
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
// DELETE — Delete a bridge
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

    // 1. Delete the bridge at OS level via shell script
    try {
      const bridgeResult = deleteBridge(name);

      if (!bridgeResult.success) {
        results.push({ step: 'delete', success: false, message: bridgeResult.error || 'OS deletion failed' });
      } else {
        results.push({ step: 'delete', success: true, message: `Bridge ${name} deleted` });
      }
    } catch (e: any) {
      results.push({ step: 'delete', success: false, message: e.message });
    }

    // 2. Remove from /etc/network/interfaces via shell script
    try {
      const persistResult = removePersistedBridge(name);

      if (!persistResult.success) {
        results.push({ step: 'file-remove', success: false, message: persistResult.error || 'File removal failed' });
      } else {
        results.push({ step: 'file-remove', success: true, message: `Bridge stanza removed from /etc/network/interfaces` });
      }
    } catch (e: any) {
      results.push({ step: 'file-remove', success: false, message: e.message });
    }

    // 3. Remove from DB
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
