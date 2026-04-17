import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  readInterfaceRolesFromOS,
  writeInterfaceRoleToOS,
  removeInterfaceRoleFromOS,
} from '@/lib/interface-role-persist';

/**
 * Interface Role API
 *
 * GET    /api/network/os/interfaces/[name]/role  — read role (OS first, DB fallback)
 * PUT    /api/network/os/interfaces/[name]/role  — set role (OS + DB)
 * DELETE /api/network/os/interfaces/[name]/role  — remove role (OS + DB)
 */

const VALID_ROLES = ['wan', 'lan', 'dmz', 'management', 'wifi', 'guest', 'iot', 'unused'];

const IFACE_NAME_RE = /^[a-zA-Z0-9._-]+$/;

// Hardcoded tenant/property — will be replaced with auth context later
const TENANT_ID = 'tenant-1';
const PROPERTY_ID = 'property-1';

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

    // 1. Try OS-persisted role first
    const osRoles = readInterfaceRolesFromOS();
    const osRole = osRoles.get(name);

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

    // 2. Fallback to database — need to find NetworkInterface by name first
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
    const { role, priority, isPrimary } = body;

    if (!role || typeof role !== 'string') {
      return NextResponse.json(
        { success: false, error: { code: 'MISSING_ROLE', message: '"role" is required' } },
        { status: 400 }
      );
    }

    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_ROLE',
            message: `Invalid role "${role}". Must be one of: ${VALID_ROLES.join(', ')}`,
          },
        },
        { status: 400 }
      );
    }

    const safePriority = typeof priority === 'number' && priority >= 0 ? priority : 0;
    const safeIsPrimary = typeof isPrimary === 'boolean' ? isPrimary : false;

    // 1. Persist to OS file
    const osResult = await writeInterfaceRoleToOS(name, role, safePriority);
    if (!osResult.success) {
      console.warn(
        `[Interface Role API] OS write failed for ${name}: ${osResult.message} — continuing with DB only`
      );
    }

    // 2. Upsert to database — ensure NetworkInterface record exists first
    try {
      // Find or create the NetworkInterface record so FK constraint is satisfied
      let dbIface = await db.networkInterface.findUnique({
        where: { propertyId_name: { propertyId: PROPERTY_ID, name } },
      });
      if (!dbIface) {
        dbIface = await db.networkInterface.create({
          data: {
            tenantId: TENANT_ID,
            propertyId: PROPERTY_ID,
            name,
            type: 'ethernet', // default; will be corrected when OS data is synced
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
          priority: safePriority,
          isPrimary: safeIsPrimary,
          enabled: true,
        },
        update: {
          role,
          priority: safePriority,
          isPrimary: safeIsPrimary,
          enabled: true,
        },
      });
    } catch (dbErr: any) {
      console.error(
        `[Interface Role API] DB upsert failed for ${name}:`,
        dbErr
      );
      // OS write succeeded but DB failed — report partial success
      return NextResponse.json({
        success: true,
        warning: 'Role persisted to OS file but database update failed. Role may reset on DB migration.',
        data: {
          interfaceName: name,
          role,
          priority: safePriority,
          isPrimary: safeIsPrimary,
          persistedToOS: osResult.success,
          persistedToDB: false,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        interfaceName: name,
        role,
        priority: safePriority,
        isPrimary: safeIsPrimary,
        persistedToOS: osResult.success,
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

    // 1. Remove from OS file
    const osResult = await removeInterfaceRoleFromOS(name);
    if (!osResult.success) {
      console.warn(
        `[Interface Role API] OS remove failed for ${name}: ${osResult.message} — continuing with DB only`
      );
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
      console.error(
        `[Interface Role API] DB delete failed for ${name}:`,
        dbErr
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        interfaceName: name,
        removedFromOS: osResult.success,
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
