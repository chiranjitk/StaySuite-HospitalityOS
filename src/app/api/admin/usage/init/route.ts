import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePlatformAdmin } from '@/lib/auth/tenant-context';

/**
 * Initialize usage summaries for all tenants that don't have one
 * This can be called once to set up existing tenants
 */
export async function POST(request: NextRequest) {
  try {
    // Require platform admin access
    const authResult = await requirePlatformAdmin(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Get all tenants without usage summaries
    const tenantsWithoutSummary = await db.tenant.findMany({
      where: {
        deletedAt: null,
        usageSummary: null,
      },
      select: { id: true },
    });

    if (tenantsWithoutSummary.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All tenants already have usage summaries',
        created: 0,
      });
    }

    // Create usage summaries for each tenant
    const results = await Promise.all(
      tenantsWithoutSummary.map((tenant) =>
        db.usageSummary.create({
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
        })
      )
    );

    return NextResponse.json({
      success: true,
      message: `Created usage summaries for ${results.length} tenants`,
      created: results.length,
      tenantIds: tenantsWithoutSummary.map((t) => t.id),
    });
  } catch (error) {
    console.error('Error initializing usage summaries:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to initialize usage summaries' },
      { status: 500 }
    );
  }
}
