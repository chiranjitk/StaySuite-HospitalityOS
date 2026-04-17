import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { setRole, listRoles } from '@/lib/network/role';
import { writeInterfaceRoleToOS, readInterfaceRolesFromOS } from '@/lib/interface-role-persist';

/**
 * Bulk Interface Roles API
 *
 * GET  /api/network/os/interfaces/roles — read all roles (OS first, DB fills gaps)
 * PUT  /api/network/os/interfaces/roles — write multiple roles at once (OS + DB)
 *
 * Uses shell script wrappers for OS commands and file persistence.
 */

const VALID_ROLES = ['wan', 'lan', 'dmz', 'management', 'wifi', 'guest', 'iot', 'unused'];

const IFACE_NAME_RE = /^[a-zA-Z0-9._-]+$/;

// Hardcoded tenant/property — will be replaced with auth context later
const TENANT_ID = 'tenant-1';
const PROPERTY_ID = 'property-1';

// ─── GET ────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    // Read from OS via shell script wrapper (with inline fallback)
    let osRolesList: Array<{ interface: string; role: string; priority: number }> = [];
    try {
      const osResult = listRoles();
      if (osResult.success && osResult.data) {
        osRolesList = osResult.data.roles;
      }
    } catch (e: any) {
      console.warn(`[Bulk Roles API] Shell script listRoles failed: ${e.message}, using inline fallback`);
    }

    // Inline fallback: read roles directly from /etc/network/interfaces
    if (osRolesList.length === 0) {
      try {
        const rolesMap = readInterfaceRolesFromOS();
        for (const [ifaceName, info] of rolesMap) {
          osRolesList.push({ interface: ifaceName, role: info.role, priority: info.priority });
        }
      } catch (e: any) {
        console.warn(`[Bulk Roles API] Inline role read failed: ${e.message}`);
      }
    }

    // Also read from DB to merge
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

    // DB entries first (lower priority) — include the interface name from the relation
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

      if (!VALID_ROLES.includes(entry.role)) {
        errors.push(`roles[${i}].role "${entry.role}" is invalid`);
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

        // 1. Write to OS via shell script wrapper (with inline fallback)
        let osOk = false;
        try {
          const osResult = setRole(ifaceName, role, priority);
          if (osResult.success) osOk = true;
        } catch { /* continue to fallback */ }

        if (!osOk) {
          try {
            const fb = await writeInterfaceRoleToOS(ifaceName, role, priority);
            if (fb.success) osOk = true;
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
          console.error(
            `[Bulk Roles API] DB upsert failed for ${ifaceName}:`,
            dbErr
          );
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
