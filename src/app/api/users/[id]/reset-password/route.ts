import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { getUserFromRequest, hasAnyPermission } from '@/lib/auth-helpers';

// POST /api/users/[id]/reset-password - Reset user password
export async function POST(
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
      const { id: targetId } = await params;
      if (currentUser.id !== targetId) {
        return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
      }
    }

    const { id } = await params;
    const body = await request.json();
    const { password } = body;

    // Validate password
    if (!password || password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    // Check if user exists
    const existingUser = await db.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Permission check - can only reset passwords for users in same tenant
    if (existingUser.tenantId !== currentUser.tenantId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Permission check - admins can reset any password, users can only reset their own
    const isAdmin = currentUser.roleName === 'admin' || currentUser.permissions.includes('*');
    if (!isAdmin && currentUser.id !== id) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    // Hash password securely with bcrypt
    const passwordHash = await hashPassword(password);

    // Update password and reset lock status
    await db.user.update({
      where: { id },
      data: {
        passwordHash,
        failedAttempts: 0,
        lockedUntil: null,
        passwordChangedAt: new Date(),
      },
    });

    // Delete all existing sessions for this user (force re-login)
    await db.session.deleteMany({
      where: { userId: id },
    });

    // Create audit log
    try {
      await db.auditLog.create({
        data: {
          tenantId: existingUser.tenantId,
          module: 'admin',
          action: 'reset_password',
          entityType: 'user',
          entityId: id,
        },
      });
    } catch {
      // Ignore audit log errors
    }

    return NextResponse.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    console.error('Error resetting password:', error);
    return NextResponse.json(
      { error: 'Failed to reset password' },
      { status: 500 }
    );
  }
}
