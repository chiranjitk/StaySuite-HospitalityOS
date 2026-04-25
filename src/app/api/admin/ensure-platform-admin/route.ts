import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { requireAuth } from '@/lib/auth/tenant-context';

// POST /api/admin/ensure-platform-admin
// Ensures the platform admin user exists with correct credentials
// This is a setup/maintenance endpoint
export async function POST(request: NextRequest) {
  try {
    const context = await requireAuth(request);
    if (context instanceof NextResponse) return context;

    // Only existing platform admins can create or update other platform admins
    if (!context.isPlatformAdmin) {
      return NextResponse.json({ error: 'Forbidden: Platform admin access required' }, { status: 403 });
    }

    const { email, password } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    if (!password) {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }

    const adminEmail = email;
    const adminPassword = password;

    // Check if platform admin already exists
    const existingAdmin = await db.user.findFirst({
      where: { email: adminEmail },
    });

    if (existingAdmin) {
      // Update existing user to be platform admin with new password
      const hashedPassword = await hashPassword(adminPassword);
      
      const updatedUser = await db.user.update({
        where: { id: existingAdmin.id },
        data: {
          isPlatformAdmin: true,
          passwordHash: hashedPassword,
          status: 'active',
          isVerified: true,
          verifiedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Platform admin updated successfully. Please logout and login again.',
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          isPlatformAdmin: updatedUser.isPlatformAdmin,
        },
      });
    }

    // Get or create a tenant for the platform admin
    let tenant = await db.tenant.findFirst({
      where: { slug: 'platform' },
    });

    if (!tenant) {
      // Check if there's any existing tenant
      const existingTenant = await db.tenant.findFirst();
      if (existingTenant) {
        tenant = existingTenant;
      } else {
        // Create a platform tenant
        tenant = await db.tenant.create({
          data: {
            id: 'tenant-platform',
            name: 'Platform Administration',
            slug: 'platform',
            email: adminEmail,
            plan: 'enterprise',
            status: 'active',
          },
        });
      }
    }

    // Get or create admin role
    let adminRole = await db.role.findFirst({
      where: { 
        tenantId: tenant.id,
        name: 'admin',
      },
    });

    if (!adminRole) {
      adminRole = await db.role.create({
        data: {
          tenantId: tenant.id,
          name: 'admin',
          displayName: 'Administrator',
          description: 'Full system access',
          permissions: JSON.stringify(['*']),
          isSystem: true,
        },
      });
    }

    // Hash the password with bcrypt
    const hashedPassword = await hashPassword(adminPassword);

    // Create the platform admin user
    const platformAdmin = await db.user.create({
      data: {
        email: adminEmail,
        passwordHash: hashedPassword,
        firstName: 'Platform',
        lastName: 'Admin',
        jobTitle: 'Platform Administrator',
        department: 'Platform',
        tenantId: tenant.id,
        roleId: adminRole.id,
        isPlatformAdmin: true,
        status: 'active',
        isVerified: true,
        verifiedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Platform admin created successfully. You can now login with these credentials.',
      user: {
        id: platformAdmin.id,
        email: platformAdmin.email,
        firstName: platformAdmin.firstName,
        lastName: platformAdmin.lastName,
        isPlatformAdmin: platformAdmin.isPlatformAdmin,
      },
    });
  } catch (error) {
    console.error('Error ensuring platform admin:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to ensure platform admin' },
      { status: 500 }
    );
  }
}

// GET /api/admin/ensure-platform-admin
// Check if platform admin exists
export async function GET(request: NextRequest) {
  try {
    const context = await requireAuth(request);
    if (context instanceof NextResponse) return context;

    // Only platform admins can query this endpoint
    if (!context.isPlatformAdmin) {
      return NextResponse.json({ error: 'Forbidden: Platform admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email') || 'platform@staysuite.com';

    const user = await db.user.findFirst({
      where: { email },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isPlatformAdmin: true,
        status: true,
        isVerified: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({
        exists: false,
        message: `User ${email} not found in database`,
        hint: 'Use POST /api/admin/ensure-platform-admin to create the user',
      });
    }

    return NextResponse.json({
      exists: true,
      user,
      canAccessTenantManagement: user.isPlatformAdmin,
      hint: user.isPlatformAdmin 
        ? 'User has platform admin access' 
        : 'User exists but isPlatformAdmin is false. Use POST endpoint to fix.',
    });
  } catch (error) {
    console.error('Error checking platform admin:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check platform admin' },
      { status: 500 }
    );
  }
}
