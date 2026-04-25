import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, validatePasswordStrength } from '@/lib/auth';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

// GET /api/users - List all users (tenant-scoped or platform-wide)
export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const currentUser = await getUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (!hasAnyPermission(currentUser, ['users.view', 'admin.users', 'admin.*'])) {
      return NextResponse.json(
        { error: 'Permission denied' },
        { status: 403 }
      );
    }

    // Permission check - admins, or users with tasks/housekeeping permissions can list users
    const canListUsers =
      currentUser.isPlatformAdmin ||
      currentUser.roleName === 'admin' ||
      currentUser.permissions.includes('*') ||
      currentUser.permissions.includes('tasks.*') ||
      currentUser.permissions.includes('tasks.view') ||
      currentUser.permissions.includes('housekeeping.*') ||
      currentUser.permissions.includes('housekeeping.view');

    if (!canListUsers) {
      return NextResponse.json(
        { error: 'Permission denied.' },
        { status: 403 }
      );
    }

    // Parse query parameters for filtering
    const searchParams = request.nextUrl.searchParams;
    const filterRole = searchParams.get('role');
    const filterDepartment = searchParams.get('department');
    const filterPermission = searchParams.get('permission');
    const filterStatus = searchParams.get('status');
    const filterTenantId = searchParams.get('tenantId');

    // Build where clause with filters
    // Platform admins can optionally filter by tenantId, otherwise see all tenants
    // Tenant admins ONLY see their own tenant
    const where: Record<string, unknown> = {
      deletedAt: null,
    };

    if (currentUser.isPlatformAdmin) {
      // Platform admin: optionally filter by tenant, or show all
      if (filterTenantId) {
        where.tenantId = filterTenantId;
      }
      // If no tenantId filter, show all tenants (no tenantId constraint)
    } else {
      // Non-platform-admin: ALWAYS scope to own tenant (security critical)
      where.tenantId = currentUser.tenantId;
    }

    if (filterRole) {
      where.role = {
        name: filterRole,
      };
    }

    // Department filter: SQLite doesn't support mode:'insensitive', so we
    // skip it in the Prisma where-clause and post-filter after the query.
    // (filterDepartment is handled via post-filter below)

    if (filterStatus) {
      where.status = filterStatus;
    }

    // Permission-based filtering: fetch users whose role has the specified permission
    let users;
    if (filterPermission) {
      const allUsers = await db.user.findMany({
        where,
        include: {
          role: {
            select: {
              id: true,
              name: true,
              displayName: true,
              permissions: true,
            },
          },
          tenant: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      // Filter users whose role has the required permission or wildcard
      users = allUsers.filter((u) => {
        if (!u.role?.permissions) return false;
        try {
          const perms: string[] = JSON.parse(u.role.permissions);
          return (
            perms.includes('*') ||
            perms.includes(filterPermission) ||
            perms.some((p) => filterPermission.startsWith(p.replace('.*', '')) && p.endsWith('.*'))
          );
        } catch {
          return false;
        }
      });
    } else {
      users = await db.user.findMany({
        where,
        include: {
          role: {
            select: {
              id: true,
              name: true,
              displayName: true,
            },
          },
          tenant: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    }

    // Post-filter: case-insensitive department match (SQLite compatibility)
    if (filterDepartment) {
      const deptLower = filterDepartment.toLowerCase();
      users = users.filter((u) =>
        u.department?.toLowerCase().includes(deptLower)
      );
    }

    return NextResponse.json({ success: true, users, data: users });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

// POST /api/users - Create new user
export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const currentUser = await getUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (!hasAnyPermission(currentUser, ['users.view', 'admin.users', 'admin.*'])) {
      return NextResponse.json(
        { error: 'Permission denied' },
        { status: 403 }
      );
    }

    // Permission check - only admins can create users
    if (
      !currentUser.isPlatformAdmin &&
      currentUser.roleName !== 'admin' &&
      !currentUser.permissions.includes('*')
    ) {
      return NextResponse.json(
        { error: 'Permission denied. Admin access required.' },
        { status: 403 }
      );
    }

    const body = await request.json();

    const {
      email,
      firstName,
      lastName,
      phone,
      jobTitle,
      department,
      roleId,
      status,
      password,
      tenantId: requestedTenantId,
      isPlatformAdmin: requestedIsPlatformAdmin,
    } = body;

    // Non-platform-admins cannot assign admin or platform_admin roles
    if (!currentUser.isPlatformAdmin && roleId) {
      const targetRole = await db.role.findUnique({
        where: { id: roleId },
        select: { name: true },
      });
      if (targetRole && (targetRole.name === 'admin' || targetRole.name === 'platform_admin')) {
        return NextResponse.json(
          { error: 'Permission denied. Cannot assign admin-level roles.' },
          { status: 403 }
        );
      }
    }

    // Determine the target tenant
    // Platform admin can specify tenantId; tenant admin always uses their own
    let tenantId: string;
    if (currentUser.isPlatformAdmin && requestedTenantId) {
      // Platform admin: validate the requested tenant exists
      const targetTenant = await db.tenant.findUnique({
        where: { id: requestedTenantId },
      });
      if (!targetTenant) {
        return NextResponse.json(
          { error: 'Specified tenant not found' },
          { status: 400 }
        );
      }
      tenantId = requestedTenantId;
    } else if (currentUser.isPlatformAdmin) {
      // Platform admin without explicit tenantId: use their own tenant
      tenantId = currentUser.tenantId;
    } else {
      // Non-platform-admin: ALWAYS use their own tenant (security critical)
      tenantId = currentUser.tenantId;
    }

    // Determine isPlatformAdmin
    // Only platform admins can set isPlatformAdmin on new users
    let newIsPlatformAdmin = false;
    if (currentUser.isPlatformAdmin && requestedIsPlatformAdmin === true) {
      newIsPlatformAdmin = true;
    }
    // Tenant admin: isPlatformAdmin is ALWAYS false (not even read from request)

    // Validate required fields
    if (!email || !firstName || !lastName || !password) {
      return NextResponse.json(
        { error: 'Email, first name, last name, and password are required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingUser = await db.user.findFirst({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      );
    }

    // Validate password strength
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { error: { message: passwordValidation.errors.join(', ') } },
        { status: 400 }
      );
    }

    // Hash password securely with bcrypt
    const passwordHash = await hashPassword(password);

    // Create user
    const user = await db.user.create({
      data: {
        tenantId,
        email: email.toLowerCase(),
        passwordHash,
        firstName,
        lastName,
        phone: phone || null,
        jobTitle: jobTitle || null,
        department: department || null,
        roleId: roleId || null,
        status: status || 'active',
        isVerified: false,
        isPlatformAdmin: newIsPlatformAdmin,
      },
      include: {
        role: {
          select: {
            id: true,
            name: true,
            displayName: true,
          },
        },
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Create audit log
    try {
      await db.auditLog.create({
        data: {
          tenantId,
          module: 'admin',
          action: 'create',
          entityType: 'user',
          entityId: user.id,
          newValue: JSON.stringify({
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            roleId: user.roleId,
            isPlatformAdmin: user.isPlatformAdmin,
          }),
        },
      });
    } catch {
      // Ignore audit log errors
    }

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}
