import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { getUserFromRequest } from '@/lib/auth-helpers';

// Plan limits configuration
const planLimits: Record<string, { properties: number; users: number; rooms: number; storage: number }> = {
  trial: { properties: 1, users: 3, rooms: 50, storage: 500 },
  starter: { properties: 1, users: 5, rooms: 50, storage: 1000 },
  professional: { properties: 5, users: 25, rooms: 500, storage: 5000 },
  enterprise: { properties: 20, users: 100, rooms: 2000, storage: 50000 },
};

// Super admin email domains (in production, this should be from env or database)
const SUPER_ADMIN_DOMAINS = ['staysuite.com', 'admin.staysuite.com'];

function isSuperAdmin(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  return SUPER_ADMIN_DOMAINS.includes(domain);
}

// GET - List tenants (super admin only)
export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Permission check - only super admins can list all tenants
    if (!isSuperAdmin(user.email)) {
      return NextResponse.json(
        { success: false, error: 'Access denied. Super admin privileges required.' },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const plan = searchParams.get('plan');
    const search = searchParams.get('search');

    // Query tenants from database
    const tenants = await db.tenant.findMany({
      where: {
        deletedAt: null,
        ...(status && { status }),
        ...(plan && { plan }),
        ...(search && {
          OR: [
            { name: { contains: search.toLowerCase() } },
            { email: { contains: search.toLowerCase() } },
            { slug: { contains: search.toLowerCase() } },
          ],
        }),
      },
      include: {
        _count: {
          select: {
            properties: true,
            users: true,
          },
        },
        properties: {
          select: {
            totalRooms: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Transform data for the frontend
    const transformedTenants = tenants.map((tenant) => {
      const totalRooms = tenant.properties.reduce((sum, p) => sum + p.totalRooms, 0);
      
      return {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        plan: tenant.plan,
        status: tenant.status,
        email: tenant.email,
        phone: tenant.phone || undefined,
        properties: tenant._count.properties,
        users: tenant._count.users,
        rooms: totalRooms,
        subscriptionStart: tenant.subscriptionStartsAt?.toISOString() || tenant.createdAt.toISOString(),
        subscriptionEnd: tenant.subscriptionEndsAt?.toISOString() || undefined,
        trialEndsAt: tenant.trialEndsAt?.toISOString() || undefined,
        limits: {
          properties: tenant.maxProperties,
          users: tenant.maxUsers,
          rooms: tenant.maxRooms,
          storage: tenant.storageLimitMb,
        },
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        tenants: transformedTenants,
        total: tenants.length,
      },
    });
  } catch (error) {
    console.error('Error fetching tenants:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch tenants' },
      { status: 500 }
    );
  }
}

// In-memory rate limiting for tenant signup
const tenantSignupRateLimitMap = new Map<string, { count: number; resetTime: number }>();
function checkTenantSignupRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxRequests = 3;
  const record = tenantSignupRateLimitMap.get(ip);
  if (!record || now > record.resetTime) {
    tenantSignupRateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
    return { allowed: true };
  }
  if (record.count >= maxRequests) {
    return { allowed: false, retryAfter: Math.ceil((record.resetTime - now) / 1000) };
  }
  record.count++;
  return { allowed: true };
}

// POST - Create new tenant with admin user (for signup - PUBLIC)
export async function POST(request: NextRequest) {
  try {
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
    const rateLimit = checkTenantSignupRateLimit(clientIp);
    if (!rateLimit.allowed) {
      return NextResponse.json({ success: false, error: 'Too many requests. Please try again later.' }, { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } });
    }

    const body = await request.json();
    const { name, slug, email, password, phone, plan } = body;

    // Validate required fields
    if (!name || !slug || !email || !password) {
      return NextResponse.json(
        { success: false, error: 'Name, slug, email, and password are required' },
        { status: 400 }
      );
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Validate password length
    if (password.length < 8) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    // Validate slug format
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json(
        { success: false, error: 'Slug can only contain lowercase letters, numbers, and hyphens' },
        { status: 400 }
      );
    }

    // Check if email already exists (as tenant email or user email)
    const existingTenantByEmail = await db.tenant.findFirst({
      where: { email: email.toLowerCase() },
    });

    if (existingTenantByEmail) {
      return NextResponse.json(
        { success: false, error: 'Email already exists' },
        { status: 400 }
      );
    }

    const existingUser = await db.user.findFirst({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'Email already exists' },
        { status: 400 }
      );
    }

    // Validate plan
    const validPlans = ['trial', 'starter', 'professional', 'enterprise'];
    const selectedPlan = validPlans.includes(plan) ? plan : 'trial';
    const limits = planLimits[selectedPlan];

    // Calculate trial end date
    const trialEndsAt = selectedPlan === 'trial' 
      ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 days
      : null;

    // Hash password securely with bcrypt
    const passwordHash = await hashPassword(password);

    // Create tenant and admin user in a transaction (slug check inside to prevent race condition)
    let result;
    try {
      result = await db.$transaction(async (tx) => {
        // Check slug uniqueness inside transaction to prevent race conditions
        const existingTenantBySlug = await tx.tenant.findUnique({
          where: { slug },
        });

        if (existingTenantBySlug) {
          throw new Error('SLUG_EXISTS');
        }

        // Create tenant
        const tenant = await tx.tenant.create({
        data: {
          name,
          slug,
          email: email.toLowerCase(),
          phone: phone || null,
          plan: selectedPlan,
          status: selectedPlan === 'trial' ? 'trial' : 'active',
          trialEndsAt,
          subscriptionStartsAt: selectedPlan !== 'trial' ? new Date() : null,
          maxProperties: limits.properties,
          maxUsers: limits.users,
          maxRooms: limits.rooms,
          storageLimitMb: limits.storage,
          features: JSON.stringify({
            crm: selectedPlan !== 'trial',
            revenue: selectedPlan === 'professional' || selectedPlan === 'enterprise',
            ai: selectedPlan === 'professional' || selectedPlan === 'enterprise',
            integrations: selectedPlan !== 'trial',
            reports: true,
            pos: true,
            housekeeping: true,
            wifi: true,
            parking: true,
            security: true,
          }),
        },
      });

      // Create default roles for the tenant
      const adminRole = await tx.role.create({
        data: {
          tenantId: tenant.id,
          name: 'admin',
          displayName: 'Administrator',
          description: 'Full access to all features',
          isSystem: true,
          permissions: JSON.stringify(['*']),
        },
      });

      // Create manager role
      await tx.role.create({
        data: {
          tenantId: tenant.id,
          name: 'manager',
          displayName: 'Manager',
          description: 'Manage operations and staff',
          isSystem: true,
          permissions: JSON.stringify([
            'dashboard.view', 'bookings.view', 'bookings.create', 'bookings.edit',
            'guests.view', 'guests.create', 'guests.edit',
            'rooms.view', 'rooms.edit',
            'reports.view', 'staff.view',
          ]),
        },
      });

      // Create front desk role
      await tx.role.create({
        data: {
          tenantId: tenant.id,
          name: 'front_desk',
          displayName: 'Front Desk',
          description: 'Front desk operations',
          isSystem: true,
          permissions: JSON.stringify([
            'dashboard.view', 'bookings.view', 'bookings.create', 'bookings.edit',
            'guests.view', 'guests.create', 'guests.edit',
            'rooms.view', 'checkin', 'checkout',
          ]),
        },
      });

      // Create housekeeping role
      await tx.role.create({
        data: {
          tenantId: tenant.id,
          name: 'housekeeping',
          displayName: 'Housekeeping',
          description: 'Housekeeping staff',
          isSystem: true,
          permissions: JSON.stringify([
            'dashboard.view', 'rooms.view', 'rooms.clean',
            'tasks.view', 'tasks.edit',
          ]),
        },
      });

      // Create admin user
      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: email.toLowerCase(),
          passwordHash,
          firstName: name.split(' ')[0] || 'Admin',
          lastName: name.split(' ').slice(1).join(' ') || 'User',
          phone: phone || null,
          jobTitle: 'Administrator',
          department: 'Administration',
          roleId: adminRole.id,
          status: 'active',
          isVerified: true,
          verifiedAt: new Date(),
        },
      });

        return { tenant, user };
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'SLUG_EXISTS') {
        return NextResponse.json(
          { success: false, error: 'Slug already exists' },
          { status: 400 }
        );
      }
      // Handle Prisma unique constraint violation as fallback
      if (error && typeof error === 'object' && 'code' in error && (error as { code: string }).code === 'P2002') {
        return NextResponse.json(
          { success: false, error: 'Slug already exists' },
          { status: 400 }
        );
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      data: {
        tenant: {
          id: result.tenant.id,
          name: result.tenant.name,
          slug: result.tenant.slug,
          plan: result.tenant.plan,
          status: result.tenant.status,
          email: result.tenant.email,
          trialEndsAt: result.tenant.trialEndsAt?.toISOString() || null,
        },
        user: {
          id: result.user.id,
          email: result.user.email,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
        },
      },
      message: 'Account created successfully',
    });
  } catch (error) {
    console.error('Error creating tenant:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create account' },
      { status: 500 }
    );
  }
}

// PUT - Update tenant status/plan (super admin only)
export async function PUT(request: NextRequest) {
  try {
    // Authentication check
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Permission check - only super admins can update tenant settings
    if (!isSuperAdmin(user.email)) {
      return NextResponse.json(
        { success: false, error: 'Access denied. Super admin privileges required.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, status, plan, subscriptionEndsAt } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Tenant ID is required' },
        { status: 400 }
      );
    }

    // Check if tenant exists
    const existingTenant = await db.tenant.findUnique({
      where: { id },
    });

    if (!existingTenant) {
      return NextResponse.json(
        { success: false, error: 'Tenant not found' },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {};
    
    if (status) {
      updateData.status = status;
      
      // Handle status-specific updates
      if (status === 'active' && existingTenant.status === 'trial') {
        updateData.subscriptionStartsAt = new Date();
      }
      if (status === 'cancelled') {
        updateData.subscriptionEndsAt = new Date();
      }
    }
    
    if (plan) {
      updateData.plan = plan;
      const limits = planLimits[plan];
      if (limits) {
        updateData.maxProperties = limits.properties;
        updateData.maxUsers = limits.users;
        updateData.maxRooms = limits.rooms;
        updateData.storageLimitMb = limits.storage;
      }
    }
    
    if (subscriptionEndsAt) {
      updateData.subscriptionEndsAt = new Date(subscriptionEndsAt);
    }

    // Update tenant
    const tenant = await db.tenant.update({
      where: { id },
      data: updateData,
    });

    // Create audit log
    try {
      await db.auditLog.create({
        data: {
          tenantId: tenant.id,
          module: 'admin',
          action: 'update_tenant',
          entityType: 'tenant',
          entityId: tenant.id,
          newValue: JSON.stringify({
            status: tenant.status,
            plan: tenant.plan,
          }),
        },
      });
    } catch {
      // Ignore audit log errors
    }

    return NextResponse.json({
      success: true,
      data: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        plan: tenant.plan,
        status: tenant.status,
        trialEndsAt: tenant.trialEndsAt?.toISOString() || null,
        subscriptionStartsAt: tenant.subscriptionStartsAt?.toISOString() || null,
        subscriptionEndsAt: tenant.subscriptionEndsAt?.toISOString() || null,
        limits: {
          properties: tenant.maxProperties,
          users: tenant.maxUsers,
          rooms: tenant.maxRooms,
          storage: tenant.storageLimitMb,
        },
      },
      message: 'Tenant updated successfully',
    });
  } catch (error) {
    console.error('Error updating tenant:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update tenant' },
      { status: 500 }
    );
  }
}
