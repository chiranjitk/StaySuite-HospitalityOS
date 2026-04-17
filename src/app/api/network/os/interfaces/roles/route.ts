import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  readInterfaceRolesFromOS,
  writeInterfaceRoleToOS,
  removeInterfaceRoleFromOS,
  type InterfaceRoleInfo,
} from '@/lib/interface-role-persist';

/**
 * Bulk Interface Roles API
 *
 * GET  /api/network/os/interfaces/roles — read all roles from OS file
 * PUT  /api/network/os/interfaces/roles — write multiple roles at once (OS + DB)
 */

const VALID_ROLES = ['wan', 'lan', 'dmz', 'management', 'wifi', 'guest', 'iot', 'unused'];

const IFACE_NAME_RE = /^[a-zA-Z0-9._-]+$/;

// Hardcoded tenant/property — will be replaced with auth context later
const TENANT_ID = 'tenant-1';
const PROPERTY_ID = 'property-1';

// ─── GET ────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    // Read from OS file
    const osRoles = readInterfaceRolesFromOS();

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

    // DB entries first (lower priority)
    for (const dbRole of dbRoles) {
      merged.set(dbRole.interfaceId, {
        interfaceName: dbRole.interfaceId,
        role: dbRole.role,
        priority: dbRole.priority,
        isPrimary: dbRole.isPrimary,
        enabled: dbRole.enabled,
        source: 'database',
      });
    }

    // OS entries override DB
    for (const [ifaceName, info] of osRoles) {
      const existing = merged.get(ifaceName);
      merged.set(ifaceName, {
        interfaceName: ifaceName,
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

        // 1. Write to OS
        const osResult = await writeInterfaceRoleToOS(ifaceName, role, priority);

        // 2. Upsert to DB
        let dbSuccess = false;
        try {
          await db.interfaceRole.upsert({
            where: {
              propertyId_interfaceId: {
                propertyId: PROPERTY_ID,
                interfaceId: ifaceName,
              },
            },
            create: {
              tenantId: TENANT_ID,
              propertyId: PROPERTY_ID,
              interfaceId: ifaceName,
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
          persistedToOS: osResult.success,
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
