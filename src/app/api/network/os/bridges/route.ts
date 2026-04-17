import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import { db } from '@/lib/db';
import {
  scanConnections,
  createBridge,
  deleteBridge,
} from '@/lib/network/nmcli';

function safeExec(cmd: string, timeout = 15000): string {
  try { return execSync(cmd, { encoding: 'utf-8', timeout }); } catch (e: any) { return e.stderr?.trim() || e.stdout?.trim() || ''; }
}

const TENANT_ID = 'tenant-1';
const PROPERTY_ID = 'property-1';
const VALID_NAME = /^[a-zA-Z0-9._-]+$/;

function isValidIPv4(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  return parts.every(p => { const n = parseInt(p, 10); return !isNaN(n) && n >= 0 && n <= 255 && String(n) === p; });
}

/**
 * GET    /api/network/os/bridges — List bridges from nmcli scanConnections
 * POST   /api/network/os/bridges — Create a bridge via nmcli
 * DELETE /api/network/os/bridges — Delete a bridge via nmcli
 *
 * Uses nmcli wrapper for Rocky Linux 10 NetworkManager.
 */

// ──────────────────────────────────────────────
// GET — List bridges from scanConnections()
// ──────────────────────────────────────────────
export async function GET() {
  try {
    const connections = scanConnections();
    const bridges = connections.filter(c => c.type === 'bridge');

    return NextResponse.json({
      success: true,
      data: bridges,
    });
  } catch (error: any) {
    console.error('[Network OS API] Bridge list error:', error);

    // Inline fallback: nmcli -t -f
    try {
      const output = safeExec('nmcli -t -f NAME,TYPE,DEVICE con show 2>/dev/null');
      const bridges: Array<{ name: string; type: string }> = [];
      for (const line of output.trim().split('\n').filter(Boolean)) {
        const parts = line.split(':');
        if (parts[1] === 'bridge') {
          bridges.push({ name: parts[0], type: 'bridge' });
        }
      }
      return NextResponse.json({ success: true, data: bridges });
    } catch {
      return NextResponse.json(
        { success: false, error: { code: 'OS_ERROR', message: 'Failed to list bridges' } },
        { status: 500 }
      );
    }
  }
}

// ──────────────────────────────────────────────
// POST — Create a bridge via nmcli
// ──────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, members, stp, forwardDelay, ipAddress, netmask, gateway } = body;

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

    const safeMembers: string[] = Array.isArray(members)
      ? members.filter((m: string) => typeof m === 'string' && VALID_NAME.test(m))
      : [];

    const results: { step: string; success: boolean; message: string }[] = [];

    // 1. Create the bridge via nmcli wrapper
    let bridgeResult: { name: string; success: boolean; error?: string };
    try {
      bridgeResult = createBridge({
        name,
        stp: !!stp,
        forwardDelay: forwardDelay ? parseInt(String(forwardDelay), 10) : 15,
        members: safeMembers,
        ipAddress,
        netmask,
        gateway: gateway || undefined,
      });
    } catch (e: any) {
      return NextResponse.json(
        { success: false, error: { code: 'OS_ERROR', message: `Failed to create bridge: ${e.message}` } },
        { status: 500 }
      );
    }

    if (!bridgeResult.success) {
      const errMsg = bridgeResult.error || 'Unknown error';
      if (errMsg.toLowerCase().includes('already exists')) {
        return NextResponse.json(
          { success: false, error: { code: 'EXISTS', message: `Bridge ${name} already exists` } },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { success: false, error: { code: 'OS_ERROR', message: `Failed to create bridge: ${errMsg}` } },
        { status: 500 }
      );
    }

    results.push({ step: 'create', success: true, message: `Bridge ${name} created via nmcli` });

    // 2. Persist to DB (BridgeConfig)
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
// DELETE — Delete a bridge via nmcli
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

    // 1. Delete the bridge via nmcli wrapper (with inline fallback)
    try {
      deleteBridge(name);
      results.push({ step: 'delete', success: true, message: `Bridge ${name} deleted via nmcli` });
    } catch (e: any) {
      console.warn(`[Network OS API] nmcli deleteBridge failed for ${name}: ${e.message}, trying inline fallback`);
      safeExec(`sudo nmcli con down "${name}" 2>/dev/null || true`);
      safeExec(`sudo nmcli con delete "${name}" 2>/dev/null`);
      results.push({ step: 'delete', success: true, message: `Bridge ${name} deleted (inline fallback)` });
    }

    // 2. Remove from DB
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
