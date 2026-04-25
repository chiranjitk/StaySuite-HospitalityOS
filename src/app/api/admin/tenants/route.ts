import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePlatformAdmin } from '@/lib/auth/tenant-context';

// GET - List tenants (Platform Admin only)
export async function GET(request: NextRequest) {
  try {
    // Require platform admin access
    const authResult = await requirePlatformAdmin(request);
    if (authResult instanceof NextResponse) {
      return authResult;
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

    // Transform data for the frontend with real usage data
    const transformedTenants = await Promise.all(tenants.map(async (tenant) => {
      const totalRooms = tenant.properties.reduce((sum, p) => sum + p.totalRooms, 0);
      
      // Get real usage data - try to use UsageSummary/UsageLog if available
      let usage = {
        storage: 0,
        apiCalls: 0,
        messages: 0,
      };

      try {
        if (db.usageSummary) {
          const summary = await db.usageSummary.findUnique({
            where: { tenantId: tenant.id },
          });

          if (summary) {
            usage = {
              storage: Math.round(summary.storageUsedMb),
              apiCalls: summary.apiCallsMonth,
              messages: summary.messagesMonth + summary.emailsMonth + summary.smsMonth,
            };
          } else {
            // Calculate from usage logs if no summary exists
            const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            
            if (db.usageLog) {
              const [apiCallsCount, messagesCount, storageSum] = await Promise.all([
                db.usageLog.count({
                  where: {
                    tenantId: tenant.id,
                    type: 'api_call',
                    createdAt: { gte: last30Days },
                  },
                }),
                db.usageLog.count({
                  where: {
                    tenantId: tenant.id,
                    type: { in: ['message', 'email', 'sms'] },
                    createdAt: { gte: last30Days },
                  },
                }),
                db.usageLog.aggregate({
                  where: {
                    tenantId: tenant.id,
                    type: 'storage_upload',
                  },
                  _sum: { dataSize: true },
                }),
              ]);

              usage = {
                storage: Math.round((storageSum._sum.dataSize || 0) / (1024 * 1024)),
                apiCalls: apiCallsCount,
                messages: messagesCount,
              };
            }
          }
        }
      } catch (usageError) {
        // Usage tracking tables may not exist yet - use defaults
        console.log('Usage tracking not available for tenant:', tenant.id);
      }
      
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
        monthlyRevenue: calculateMonthlyRevenue(tenant.plan),
        usage,
        limits: {
          properties: tenant.maxProperties,
          users: tenant.maxUsers,
          rooms: tenant.maxRooms,
          storage: tenant.storageLimitMb,
        },
      };
    }));

    // Calculate stats
    const stats = {
      total: tenants.length,
      active: tenants.filter(t => t.status === 'active').length,
      trial: tenants.filter(t => t.status === 'trial').length,
      suspended: tenants.filter(t => t.status === 'suspended').length,
      totalRevenue: transformedTenants.reduce((sum, t) => sum + t.monthlyRevenue, 0),
    };

    return NextResponse.json({
      success: true,
      data: {
        tenants: transformedTenants,
        stats,
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

// Helper function to estimate monthly revenue based on plan
function calculateMonthlyRevenue(plan: string): number {
  const revenueMap: Record<string, number> = {
    trial: 0,
    starter: 99,
    professional: 499,
    enterprise: 1999,
  };
  return revenueMap[plan] || 0;
}

// POST - Create tenant (Platform Admin only)
export async function POST(request: NextRequest) {
  try {
    // Require platform admin access
    const authResult = await requirePlatformAdmin(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body = await request.json();
    const { name, slug, plan, email, phone, limits, status } = body;

    // Validate required fields
    if (!name || !slug || !email) {
      return NextResponse.json(
        { success: false, error: 'Name, slug, and email are required' },
        { status: 400 }
      );
    }

    // Check if slug already exists and create tenant atomically to prevent race conditions
    let tenant;
    try {
      tenant = await db.$transaction(async (tx) => {
        // Check slug uniqueness inside transaction
        const existingTenant = await tx.tenant.findUnique({
          where: { slug },
        });

        if (existingTenant) {
          throw new Error('SLUG_EXISTS');
        }

        // Create tenant in database
        const newTenant = await tx.tenant.create({
          data: {
            name,
            slug,
            plan: plan || 'starter',
            status: status || 'trial',
            email,
            phone: phone || null,
            maxProperties: limits?.properties || 1,
            maxUsers: limits?.users || 5,
            maxRooms: limits?.rooms || 50,
            storageLimitMb: limits?.storage || 1000,
            trialEndsAt: status === 'trial' ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) : null,
          },
        });

        // Create default role for the tenant
        await tx.role.create({
          data: {
            tenantId: newTenant.id,
            name: 'admin',
            displayName: 'Administrator',
            description: 'Full access to all features',
            isSystem: true,
            permissions: JSON.stringify(['*']),
          },
        });

        return newTenant;
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

    // Try to create initial usage summary (may fail if table doesn't exist)
    try {
      if (db.usageSummary) {
        await db.usageSummary.create({
          data: {
            tenantId: tenant.id,
            apiCalls: 0,
            apiCallsMonth: 0,
            messagesSent: 0,
            messagesMonth: 0,
            emailsSent: 0,
            emailsMonth: 0,
            smsSent: 0,
            smsMonth: 0,
            storageUsedMb: 0,
            storageFiles: 0,
            webhooksSent: 0,
            webhooksMonth: 0,
          },
        });
      }
    } catch (usageError) {
      // Usage summary table may not exist yet - ignore
      console.log('Could not create usage summary for new tenant');
    }

    return NextResponse.json({
      success: true,
      data: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        plan: tenant.plan,
        status: tenant.status,
        email: tenant.email,
        phone: tenant.phone || undefined,
        properties: 0,
        users: 0,
        rooms: 0,
        subscriptionStart: tenant.createdAt.toISOString(),
        trialEndsAt: tenant.trialEndsAt?.toISOString() || undefined,
        monthlyRevenue: 0,
        usage: { storage: 0, apiCalls: 0, messages: 0 },
        limits: {
          properties: tenant.maxProperties,
          users: tenant.maxUsers,
          rooms: tenant.maxRooms,
          storage: tenant.storageLimitMb,
        },
      },
      message: 'Tenant created successfully',
    });
  } catch (error) {
    console.error('Error creating tenant:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create tenant' },
      { status: 500 }
    );
  }
}

// PUT - Update tenant (Platform Admin only)
export async function PUT(request: NextRequest) {
  try {
    // Require platform admin access
    const authResult = await requirePlatformAdmin(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body = await request.json();
    const { id, ...updates } = body;

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
    
    if (updates.name) updateData.name = updates.name;
    if (updates.slug) updateData.slug = updates.slug;
    if (updates.email) updateData.email = updates.email;
    if (updates.phone !== undefined) updateData.phone = updates.phone || null;
    if (updates.plan) updateData.plan = updates.plan;
    if (updates.status) updateData.status = updates.status;
    if (updates.limits) {
      if (updates.limits.properties) updateData.maxProperties = updates.limits.properties;
      if (updates.limits.users) updateData.maxUsers = updates.limits.users;
      if (updates.limits.rooms) updateData.maxRooms = updates.limits.rooms;
      if (updates.limits.storage) updateData.storageLimitMb = updates.limits.storage;
    }

    // Update tenant
    const tenant = await db.tenant.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        plan: tenant.plan,
        status: tenant.status,
        email: tenant.email,
        phone: tenant.phone || undefined,
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

// DELETE - Delete tenant (Platform Admin only)
export async function DELETE(request: NextRequest) {
  try {
    // Require platform admin access
    const authResult = await requirePlatformAdmin(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

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

    // Soft delete tenant and cascade to users/sessions
    await db.$transaction([
      db.tenant.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          status: 'cancelled',
        },
      }),
      db.user.updateMany({
        where: { tenantId: id },
        data: { deletedAt: new Date(), status: 'inactive' },
      }),
      db.session.deleteMany({
        where: { user: { tenantId: id } },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: 'Tenant deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting tenant:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete tenant' },
      { status: 500 }
    );
  }
}
