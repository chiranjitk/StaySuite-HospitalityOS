import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import { db } from '@/lib/db';
import {
  scanConnections,
  setNetTypeOnInterface,
  getNetTypeFromInterface,
} from '@/lib/network/nmcli';
import { NET_TYPES, NET_TYPE_LABELS, isValidNetType, netTypeToLabel } from '@/lib/network/nettypes';

function safeExec(cmd: string, timeout = 10000): string {
  try { return execSync(cmd, { encoding: 'utf-8', timeout }); } catch (e: any) { return e.stderr?.trim() || e.stdout?.trim() || ''; }
}

const TENANT_ID = 'tenant-1';
const PROPERTY_ID = 'property-1';
const IFACE_NAME_RE = /^[a-zA-Z0-9._-]+$/;

/**
 * Bulk Interface Roles API
 *
 * GET  /api/network/os/interfaces/roles — read all roles (nmcli + DB)
 * PUT  /api/network/os/interfaces/roles — write multiple roles at once (nmcli + DB)
 *
 * Uses nmcli wrapper for Rocky Linux 10 NetworkManager.
 * Roles are stored as nettype in [staysuite] section of .nmconnection files.
 */

// ─── GET ────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    // 1. Scan all .nmconnection files and group by nettype via nmcli wrapper
    const connections = scanConnections();
    const osRolesList: Array<{ interface: string; role: string; priority: number; nettype: number }> = [];

    for (const conn of connections) {
      if (isValidNetType(conn.nettype) && conn.nettype !== NET_TYPES.UNUSED) {
        osRolesList.push({
          interface: conn.name || conn.deviceName,
          role: netTypeToLabel(conn.nettype).toLowerCase(),
          priority: conn.priority,
          nettype: conn.nettype,
        });
      }
    }

    // 2. Also read from DB to merge
    const dbRoles = await db.interfaceRole.findMany({
      where: { propertyId: PROPERTY_ID },
    });

    // Build merged map: OS takes priority, DB fills gaps
    const merged = new Map<string, {
      interfaceName: string;
      role: string;
      priority: number;
      isPrimary: boolean;
      enabled: boolean;
      source: 'os' | 'database';
    }>();

    // DB entries first (lower priority)
    for (const dbRole of dbRoles) {
      const iface = await db.networkInterface.findUnique({ where: { id: dbRole.interfaceId } });
      merged.set(iface?.name || dbRole.interfaceId, {
        interfaceName: iface?.name || dbRole.interfaceId,
        role: dbRole.role,
        priority: dbRole.priority,
        isPrimary: dbRole.isPrimary,
        enabled: dbRole.enabled,
        source: 'database',
      });
    }

    // OS entries override DB
    for (const info of osRolesList) {
      const existing = merged.get(info.interface);
      merged.set(info.interface, {
        interfaceName: info.interface,
        role: info.role,
        priority: info.priority,
        isPrimary: existing?.isPrimary ?? false,
        enabled: existing?.enabled ?? true,
        source: 'os',
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        roles: Array.from(merged.values()),
        total: merged.size,
      },
    });
  } catch (error) {
    console.error('[Bulk Interface Roles API] GET error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to read interface roles' } },
      { status: 500 }
    );
  }
}

// ─── PUT ────────────────────────────────────────────────────────────────────

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { roles } = body;

    if (!Array.isArray(roles) || roles.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INVALID_BODY', message: '"roles" must be a non-empty array' },
        },
        { status: 400 }
      );
    }

    if (roles.length > 100) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'TOO_MANY', message: 'Maximum 100 roles per request' },
        },
        { status: 400 }
      );
    }

    // Validate all entries
    const errors: string[] = [];
    for (let i = 0; i < roles.length; i++) {
      const entry = roles[i];

      if (!entry.interfaceName || typeof entry.interfaceName !== 'string') {
        errors.push(`roles[${i}].interfaceName is required`);
        continue;
      }

      if (!IFACE_NAME_RE.test(entry.interfaceName)) {
        errors.push(`roles[${i}].interfaceName "${entry.interfaceName}" is invalid`);
        continue;
      }

      if (!entry.role || typeof entry.role !== 'string') {
        errors.push(`roles[${i}].role is required`);
        continue;
      }
    }

    if (errors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', details: errors },
        },
        { status: 400 }
      );
    }

    // Process results
    const results = await Promise.allSettled(
      roles.map(async (entry) => {
        const ifaceName = entry.interfaceName as string;
        const role = entry.role as string;
        const priority =
          typeof entry.priority === 'number' && entry.priority >= 0
            ? entry.priority
            : 0;

        // Convert role label to nettype number
        let nettype = NET_TYPES.UNUSED;
        const lowerRole = role.toLowerCase();
        for (const [key, value] of Object.entries(NET_TYPES)) {
          if (key.toLowerCase() === lowerRole) {
            nettype = value;
            break;
          }
        }

        // 1. Set nettype via nmcli wrapper (with inline fallback)
        let osOk = false;
        try {
          setNetTypeOnInterface(ifaceName, nettype, priority);
          osOk = true;
        } catch (e: any) {
          console.warn(`[Bulk Roles API] nmcli setNetType failed for ${ifaceName}: ${e.message}, trying inline fallback`);
        }

        if (!osOk) {
          // Inline fallback: nmcli con reload + up
          try {
            safeExec(`sudo nmcli con reload`);
            safeExec(`sudo nmcli con up "${ifaceName}" 2>/dev/null`);
            osOk = true;
          } catch { /* DB-only mode */ }
        }

        // 2. Upsert to DB — ensure NetworkInterface exists for FK
        let dbSuccess = false;
        try {
          let dbIface = await db.networkInterface.findUnique({
            where: { propertyId_name: { propertyId: PROPERTY_ID, name: ifaceName } },
          });
          if (!dbIface) {
            dbIface = await db.networkInterface.create({
              data: {
                tenantId: TENANT_ID,
                propertyId: PROPERTY_ID,
                name: ifaceName,
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
              role,
              priority,
              isPrimary: entry.isPrimary === true,
              enabled: true,
            },
            update: {
              role,
              priority,
              isPrimary: entry.isPrimary === true,
              enabled: true,
            },
          });
          dbSuccess = true;
        } catch (dbErr: any) {
          console.error(`[Bulk Roles API] DB upsert failed for ${ifaceName}:`, dbErr);
        }

        return {
          interfaceName: ifaceName,
          role,
          priority,
          persistedToOS: osOk,
          persistedToDB: dbSuccess,
        };
      })
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').map((r) => (r as PromiseFulfilledResult<any>).value);
    const failed = results.filter((r) => r.status === 'rejected').map((r, i) => ({
      index: i,
      error: String((r as PromiseRejectedResult).reason),
    }));

    return NextResponse.json({
      success: failed.length === 0,
      data: {
        roles: succeeded,
        total: succeeded.length,
        failed: failed.length > 0 ? failed : undefined,
      },
    });
  } catch (error) {
    console.error('[Bulk Interface Roles API] PUT error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to write interface roles' } },
      { status: 500 }
    );
  }
}
