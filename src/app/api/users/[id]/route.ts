import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

// GET /api/users/[id] - Get single user
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication check
    const currentUser = await getUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id } = await params;

    if (!hasAnyPermission(currentUser, ['users.manage', 'admin.users', 'admin.*'])) {
      // Allow users to view their own profile
      if (currentUser.id !== id) {
        return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
      }
    }

    const user = await db.user.findUnique({
      where: { id },
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
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Permission check - non-platform-admins can only view users in same tenant
    if (!currentUser.isPlatformAdmin && user.tenantId !== currentUser.tenantId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Non-admins can only view their own profile
    if (
      !currentUser.isPlatformAdmin &&
      currentUser.roleName !== 'admin' &&
      !currentUser.permissions.includes('*') &&
      currentUser.id !== id
    ) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 }
    );
  }
}

// PUT /api/users/[id] - Update user
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication check
    const currentUser = await getUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (!hasAnyPermission(currentUser, ['users.manage', 'admin.users', 'admin.*'])) {
      // Allow users to update their own profile
      const { id: targetId } = await params;
      if (currentUser.id !== targetId) {
        return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
      }
    }

    const { id } = await params;
    const body = await request.json();

    // Non-platform-admins cannot assign admin or platform_admin roles
    if (!currentUser.isPlatformAdmin && body.roleId) {
      const targetRole = await db.role.findUnique({
        where: { id: body.roleId },
        select: { name: true },
      });
      if (targetRole && (targetRole.name === 'admin' || targetRole.name === 'platform_admin')) {
        return NextResponse.json(
          { error: 'Permission denied. Cannot assign admin-level roles.' },
          { status: 403 }
        );
      }
    }

    // Check if user exists
    const existingUser = await db.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Permission check - non-platform-admins can only update users in same tenant
    if (!currentUser.isPlatformAdmin && existingUser.tenantId !== currentUser.tenantId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Non-admins can only update their own profile (with limited fields)
    const isAdmin =
      currentUser.isPlatformAdmin ||
      currentUser.roleName === 'admin' ||
      currentUser.permissions.includes('*');
    if (!isAdmin && currentUser.id !== id) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    // If email is being changed, check for duplicates
    if (body.email && body.email !== existingUser.email) {
      const duplicateEmail = await db.user.findFirst({
        where: { email: body.email.toLowerCase() },
      });
      if (duplicateEmail) {
        return NextResponse.json(
          { error: 'Email already in use' },
          { status: 400 }
        );
      }
    }

    // Build update data - non-admins can only update certain fields
    const updateData: Record<string, unknown> = {};

    if (body.email && isAdmin) updateData.email = body.email.toLowerCase();
    if (body.firstName) updateData.firstName = body.firstName;
    if (body.lastName) updateData.lastName = body.lastName;
    if (body.phone !== undefined) updateData.phone = body.phone || null;
    if (body.avatar !== undefined) updateData.avatar = body.avatar || null;

    // Admin-only fields
    if (isAdmin) {
      if (body.jobTitle !== undefined) updateData.jobTitle = body.jobTitle || null;
      if (body.department !== undefined) updateData.department = body.department || null;
      if (body.roleId !== undefined) updateData.roleId = body.roleId || null;
      if (body.status) updateData.status = body.status;
    }

    // SECURITY: isPlatformAdmin can ONLY be set by platform admins
    if (currentUser.isPlatformAdmin && body.isPlatformAdmin !== undefined) {
      updateData.isPlatformAdmin = Boolean(body.isPlatformAdmin);
    }
    // Tenant admins attempting to set isPlatformAdmin: silently ignored (no error,
    // but the field is never included in updateData for non-platform-admins)

    // Update user
    const user = await db.user.update({
      where: { id },
      data: updateData,
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
          tenantId: user.tenantId,
          module: 'admin',
          action: 'update',
          entityType: 'user',
          entityId: user.id,
          oldValue: JSON.stringify({
            email: existingUser.email,
            firstName: existingUser.firstName,
            lastName: existingUser.lastName,
            status: existingUser.status,
            roleId: existingUser.roleId,
            isPlatformAdmin: existingUser.isPlatformAdmin,
          }),
          newValue: JSON.stringify({
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            status: user.status,
            roleId: user.roleId,
            isPlatformAdmin: user.isPlatformAdmin,
          }),
        },
      });
    } catch {
      // Ignore audit log errors
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}

// DELETE /api/users/[id] - Soft delete user
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication check
    const currentUser = await getUserFromRequest(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (!hasAnyPermission(currentUser, ['users.manage', 'admin.users', 'admin.*'])) {
      return NextResponse.json({ error: 'Permission denied. Admin access required.' }, { status: 403 });
    }

    // Permission check - only admins can delete users
    if (
      !currentUser.isPlatformAdmin &&
      currentUser.roleName !== 'admin' &&
      !currentUser.permissions.includes('*')
    ) {
      return NextResponse.json({ error: 'Permission denied. Admin access required.' }, { status: 403 });
    }

    const { id } = await params;

    // Prevent self-deletion
    if (currentUser.id === id) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
    }

    // Check if user exists
    const existingUser = await db.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Permission check - non-platform-admins can only delete users in same tenant
    if (!currentUser.isPlatformAdmin && existingUser.tenantId !== currentUser.tenantId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Soft delete user
    await db.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: 'inactive',
      },
    });

    // Delete all sessions for this user
    await db.session.deleteMany({
      where: { userId: id },
    });

    // Create audit log
    try {
      await db.auditLog.create({
        data: {
          tenantId: existingUser.tenantId,
          module: 'admin',
          action: 'delete',
          entityType: 'user',
          entityId: id,
          oldValue: JSON.stringify({
            email: existingUser.email,
            firstName: existingUser.firstName,
            lastName: existingUser.lastName,
          }),
        },
      });
    } catch {
      // Ignore audit log errors
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    );
  }
}
