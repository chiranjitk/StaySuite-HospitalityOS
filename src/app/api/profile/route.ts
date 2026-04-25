import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hash, compare } from 'bcryptjs';

// GET /api/profile - Get current user profile
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('session_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const session = await db.session.findUnique({
      where: { token },
      include: {
        user: {
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
                slug: true,
                plan: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!session || session.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Session expired' }, { status: 401 });
    }

    const user = session.user;

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar,
        phone: user.phone,
        jobTitle: user.jobTitle,
        department: user.department,
        twoFactorEnabled: user.twoFactorEnabled,
        preferences: user.preferences ? JSON.parse(user.preferences) : {},
        role: user.role,
        tenant: user.tenant,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
      },
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}

// PUT /api/profile - Update current user profile
export async function PUT(request: NextRequest) {
  try {
    const token = request.cookies.get('session_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const session = await db.session.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Session expired' }, { status: 401 });
    }

    const body = await request.json();
    const userId = session.user.id;

    // If email is being changed, check for duplicates
    if (body.email && body.email !== session.user.email) {
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

    // If changing password, verify current password
    if (body.newPassword) {
      if (!body.currentPassword) {
        return NextResponse.json(
          { error: 'Current password is required to change password' },
          { status: 400 }
        );
      }

      const isValidPassword = await compare(
        body.currentPassword,
        session.user.passwordHash
      );

      if (!isValidPassword) {
        return NextResponse.json(
          { error: 'Current password is incorrect' },
          { status: 400 }
        );
      }

      if (body.newPassword.length < 8) {
        return NextResponse.json(
          { error: 'New password must be at least 8 characters' },
          { status: 400 }
        );
      }

      if (body.newPassword !== body.confirmPassword) {
        return NextResponse.json(
          { error: 'Passwords do not match' },
          { status: 400 }
        );
      }
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    
    if (body.firstName !== undefined) updateData.firstName = body.firstName;
    if (body.lastName !== undefined) updateData.lastName = body.lastName;
    if (body.email !== undefined) updateData.email = body.email.toLowerCase();
    if (body.phone !== undefined) updateData.phone = body.phone || null;
    if (body.jobTitle !== undefined) updateData.jobTitle = body.jobTitle || null;
    if (body.department !== undefined) updateData.department = body.department || null;
    if (body.avatar !== undefined) updateData.avatar = body.avatar || null;
    
    // Hash new password if provided
    if (body.newPassword) {
      updateData.passwordHash = await hash(body.newPassword, 12);
      updateData.passwordChangedAt = new Date();
    }

    // Update user
    const user = await db.user.update({
      where: { id: userId },
      data: updateData,
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
            slug: true,
            plan: true,
            status: true,
          },
        },
      },
    });

    // Invalidate all sessions if password was changed
    if (body.newPassword) {
      await db.session.deleteMany({ where: { userId } });
    }

    // Create audit log
    try {
      await db.auditLog.create({
        data: {
          tenantId: user.tenantId,
          module: 'profile',
          action: 'update',
          entityType: 'user',
          entityId: user.id,
          newValue: JSON.stringify({
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phone: user.phone,
            jobTitle: user.jobTitle,
          }),
        },
      });
    } catch {
      // Ignore audit log errors
    }

    // Parse permissions
    let permissions: string[] = [];
    if (user.role?.permissions) {
      try {
        permissions = JSON.parse(user.role.permissions);
      } catch {
        permissions = [];
      }
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar,
        phone: user.phone,
        jobTitle: user.jobTitle,
        department: user.department,
        twoFactorEnabled: user.twoFactorEnabled,
        roleId: user.roleId,
        roleName: user.role?.name || 'staff',
        permissions,
        tenantId: user.tenantId,
        tenant: user.tenant,
      },
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
