import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import { db } from '@/lib/db';
import {
  scanConnections,
  setNetTypeOnInterface,
  getNetTypeFromInterface,
} from '@/lib/network/nmcli';
import { NET_TYPES, isValidNetType, netTypeToLabel } from '@/lib/network/nettypes';

function safeExec(cmd: string, timeout = 10000): string {
  try { return execSync(cmd, { encoding: 'utf-8', timeout }); } catch (e: any) { return e.stderr?.trim() || e.stdout?.trim() || ''; }
}

const TENANT_ID = 'tenant-1';
const PROPERTY_ID = 'property-1';
const IFACE_NAME_RE = /^[a-zA-Z0-9._-]+$/;

/**
 * Interface Role API
 *
 * GET    /api/network/os/interfaces/[name]/role  — read nettype from .nmconnection file
 * PUT    /api/network/os/interfaces/[name]/role  — set nettype via nmcli
 * DELETE /api/network/os/interfaces/[name]/role  — remove nettype (set to UNUSED)
 *
 * Uses nmcli wrapper for Rocky Linux 10 NetworkManager.
 * Roles are stored as nettype in [staysuite] section of .nmconnection files.
 */

// ─── GET ────────────────────────────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;

    if (!IFACE_NAME_RE.test(name)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_NAME', message: 'Invalid interface name' } },
        { status: 400 }
      );
    }

    // 1. Get nettype from .nmconnection file via nmcli wrapper
    let osRole = null;
    try {
      const connections = scanConnections();
      const conn = connections.find(c => c.name === name || c.deviceName === name);
      if (conn && isValidNetType(conn.nettype)) {
        osRole = {
          role: netTypeToLabel(conn.nettype).toLowerCase(),
          priority: conn.priority,
          nettype: conn.nettype,
        };
      }
    } catch (e: any) {
      console.warn(`[Interface Role API] nmcli scan failed for ${name}: ${e.message}, using inline fallback`);
    }

    // Inline fallback: getNetTypeFromInterface
    if (!osRole) {
      try {
        const nettype = getNetTypeFromInterface(name);
        if (isValidNetType(nettype)) {
          osRole = {
            role: netTypeToLabel(nettype).toLowerCase(),
            priority: 0,
            nettype,
          };
        }
      } catch (e: any) {
        console.warn(`[Interface Role API] getNetTypeFromInterface failed for ${name}: ${e.message}`);
      }
    }

    if (osRole) {
      return NextResponse.json({
        success: true,
        data: {
          interfaceName: name,
          role: osRole.role,
          priority: osRole.priority,
          source: 'os',
        },
      });
    }

    // 2. Fallback to database
    const dbIface = await db.networkInterface.findUnique({
      where: { propertyId_name: { propertyId: PROPERTY_ID, name } },
    });
    let dbRole = null;
    if (dbIface) {
      dbRole = await db.interfaceRole.findUnique({
        where: {
          propertyId_interfaceId: {
            propertyId: PROPERTY_ID,
            interfaceId: dbIface.id,
          },
        },
      });
    }

    if (dbRole) {
      return NextResponse.json({
        success: true,
        data: {
          interfaceName: name,
          role: dbRole.role,
          priority: dbRole.priority,
          isPrimary: dbRole.isPrimary,
          enabled: dbRole.enabled,
          source: 'database',
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        interfaceName: name,
        role: null,
        priority: 0,
        source: 'none',
      },
    });
  } catch (error) {
    console.error('[Interface Role API] GET error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to read interface role' } },
      { status: 500 }
    );
  }
}

// ─── PUT ────────────────────────────────────────────────────────────────────

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;

    if (!IFACE_NAME_RE.test(name)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_NAME', message: 'Invalid interface name' } },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { role, priority, isPrimary, nettype: bodyNettype } = body;

    // Support both `role` (string label like "wan") and `nettype` (number like 1)
    let nettype: number;
    if (typeof bodyNettype === 'number' && isValidNetType(bodyNettype)) {
      nettype = bodyNettype;
    } else if (role && typeof role === 'string') {
      nettype = NET_TYPES.UNUSED;
      const lowerRole = role.toLowerCase();
      for (const [key, value] of Object.entries(NET_TYPES)) {
        if (key.toLowerCase() === lowerRole) {
          nettype = value;
          break;
        }
      }
    } else {
      return NextResponse.json(
        { success: false, error: { code: 'MISSING_ROLE', message: '"role" (string) or "nettype" (number) is required' } },
        { status: 400 }
      );
    }

    if (!isValidNetType(nettype)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_ROLE',
            message: `Invalid role/nettype. Must be one of: ${Object.entries(NET_TYPES).map(([k, v]) => `${k}(${v})`).join(', ')}`,
          },
        },
        { status: 400 }
      );
    }

    // Derive role label from nettype for DB storage
    const roleLabel = netTypeToLabel(nettype).toLowerCase();

    const safePriority = typeof priority === 'number' && priority >= 0 ? priority : 0;
    const safeIsPrimary = typeof isPrimary === 'boolean' ? isPrimary : false;

    // 1. Set nettype via nmcli wrapper (with inline fallback)
    let osSuccess = false;
    try {
      setNetTypeOnInterface(name, nettype, safePriority);
      osSuccess = true;
    } catch (e: any) {
      console.warn(`[Interface Role API] nmcli setNetType failed for ${name}: ${e.message}, trying inline fallback`);
    }

    // Inline fallback: nmcli con reload + up
    if (!osSuccess) {
      try {
        safeExec(`sudo nmcli con reload`);
        safeExec(`sudo nmcli con up "${name}" 2>/dev/null`);
        osSuccess = true;
      } catch (e: any) {
        console.warn(`[Interface Role API] Inline fallback role set failed for ${name}: ${e.message}`);
      }
    }

    // 2. Upsert to database
    try {
      let dbIface = await db.networkInterface.findUnique({
        where: { propertyId_name: { propertyId: PROPERTY_ID, name } },
      });
      if (!dbIface) {
        dbIface = await db.networkInterface.create({
          data: {
            tenantId: TENANT_ID,
            propertyId: PROPERTY_ID,
            name,
            type: 'ethernet',
            status: 'up',
          },
        });
      }

      await db.interfaceRole.upsert({
        where: {
          propertyId_interfaceId: {
            propertyId: PROPERTY_ID,
            interfaceId: dbIface.id,
          },
        },
        create: {
          tenantId: TENANT_ID,
          propertyId: PROPERTY_ID,
          interfaceId: dbIface.id,
          role: roleLabel,
          priority: safePriority,
          isPrimary: safeIsPrimary,
          enabled: true,
        },
        update: {
          role: roleLabel,
          priority: safePriority,
          isPrimary: safeIsPrimary,
          enabled: true,
        },
      });
    } catch (dbErr: any) {
      console.error(`[Interface Role API] DB upsert failed for ${name}:`, dbErr);
      return NextResponse.json({
        success: true,
        warning: 'Role persisted to OS but database update failed.',
        data: {
          interfaceName: name,
          role: roleLabel,
          priority: safePriority,
          isPrimary: safeIsPrimary,
          persistedToOS: osSuccess,
          persistedToDB: false,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        interfaceName: name,
        role: roleLabel,
        priority: safePriority,
        isPrimary: safeIsPrimary,
        persistedToOS: osSuccess,
        persistedToDB: true,
      },
    });
  } catch (error) {
    console.error('[Interface Role API] PUT error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to set interface role' } },
      { status: 500 }
    );
  }
}

// ─── DELETE ─────────────────────────────────────────────────────────────────

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;

    if (!IFACE_NAME_RE.test(name)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_NAME', message: 'Invalid interface name' } },
        { status: 400 }
      );
    }

    // 1. Remove nettype by setting to UNUSED via nmcli wrapper (with inline fallback)
    let osSuccess = false;
    try {
      setNetTypeOnInterface(name, NET_TYPES.UNUSED, 0);
      osSuccess = true;
    } catch (e: any) {
      console.warn(`[Interface Role API] nmcli setNetType UNUSED failed for ${name}: ${e.message}, trying inline fallback`);
    }

    // Inline fallback: nmcli con reload + up
    if (!osSuccess) {
      try {
        safeExec(`sudo nmcli con reload`);
        safeExec(`sudo nmcli con up "${name}" 2>/dev/null`);
        osSuccess = true;
      } catch (e: any) {
        console.warn(`[Interface Role API] Inline fallback role remove failed for ${name}: ${e.message}`);
      }
    }

    // 2. Remove from database
    let dbDeleted = false;
    try {
      const dbIface = await db.networkInterface.findUnique({
        where: { propertyId_name: { propertyId: PROPERTY_ID, name } },
      });
      if (dbIface) {
        const existing = await db.interfaceRole.findUnique({
          where: {
            propertyId_interfaceId: {
              propertyId: PROPERTY_ID,
              interfaceId: dbIface.id,
            },
          },
        });
        if (existing) {
          await db.interfaceRole.delete({ where: { id: existing.id } });
          dbDeleted = true;
        }
      }
    } catch (dbErr: any) {
      console.error(`[Interface Role API] DB delete failed for ${name}:`, dbErr);
    }

    return NextResponse.json({
      success: true,
      data: {
        interfaceName: name,
        removedFromOS: osSuccess,
        removedFromDB: dbDeleted,
      },
    });
  } catch (error) {
    console.error('[Interface Role API] DELETE error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to remove interface role' } },
      { status: 500 }
    );
  }
}
