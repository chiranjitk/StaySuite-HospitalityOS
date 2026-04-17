import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePlatformAdmin } from '@/lib/auth/tenant-context';
import { getPlan, getPlanPrice, getOverageRates, getApiCallLimit, getMessageLimit } from '@/lib/billing/plans';

// GET - Server-side billing calculation from actual usage data
// Replaces client-side billing calculation in usage-billing.tsx
export async function GET(request: NextRequest) {
  try {
    const authResult = await requirePlatformAdmin(request);
    if (authResult instanceof NextResponse) return authResult;

    const searchParams = request.nextUrl.searchParams;
    const tenantId = searchParams.get('tenantId') || authResult.tenantId;
    const period = searchParams.get('period') || 'month';

    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: 'Tenant ID is required' },
        { status: 400 }
      );
    }

    // Fetch tenant with usage data
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId, deletedAt: null },
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
    });

    if (!tenant) {
      return NextResponse.json(
        { success: false, error: 'Tenant not found' },
        { status: 404 }
      );
    }

    // Get plan config from server-side registry (not hardcoded in frontend)
    const planConfig = getPlan(tenant.plan);
    const basePrice = planConfig?.price ?? getPlanPrice(tenant.plan);

    // Fetch actual usage data from database
    const bookingCount = await db.booking.count({ where: { tenantId } });
    const guestCount = await db.guest.count({ where: { tenantId, deletedAt: null } });
    const paymentCount = await db.payment.count({ where: { tenantId } });
    const totalRooms = tenant.properties.reduce((sum, p) => sum + p.totalRooms, 0);

    // Calculate actual API usage (server-side estimation)
    const apiCallsUsed = Math.floor(bookingCount * 10 + guestCount * 5 + paymentCount * 3);
    const apiCallsLimit = getApiCallLimit(tenant.plan);

    // Calculate actual storage usage (from usage summary if available)
    let storageUsed = Math.floor(tenant.storageLimitMb * 0.05);
    try {
      if (db.usageSummary) {
        const summary = await db.usageSummary.findUnique({
          where: { tenantId },
        });
        if (summary) {
          storageUsed = Math.round(summary.storageUsedMb);
        }
      }
    } catch {
      // Usage summary table may not exist — use estimate
    }

    // Calculate message usage
    let messagesUsed = Math.floor(guestCount * 10);
    try {
      if (db.usageSummary) {
        const summary = await db.usageSummary.findUnique({
          where: { tenantId },
        });
        if (summary) {
          messagesUsed = summary.messagesMonth + summary.emailsMonth + summary.smsMonth;
        }
      }
    } catch {
      // Usage summary table may not exist — use estimate
    }

    const messagesLimit = getMessageLimit(tenant.plan);
    const storageLimit = tenant.storageLimitMb;

    // Get server-side overage rates for the plan
    const rates = getOverageRates(tenant.plan);

    // Calculate usage charges (server-side, not client-side)
    const usageCharges = {
      apiCalls: Math.min(apiCallsUsed, apiCallsLimit) * (rates.apiCallOveragePerUnit * 0.1),
      storage: Math.min(storageUsed, storageLimit) * (rates.storageOveragePerMb * 0.1),
      messages: Math.min(messagesUsed, messagesLimit) * (rates.messageOveragePerUnit * 0.1),
    };

    // Calculate overage charges (server-side)
    let overageCharges = 0;
    if (apiCallsUsed > apiCallsLimit) {
      overageCharges += (apiCallsUsed - apiCallsLimit) * rates.apiCallOveragePerUnit;
    }
    if (storageUsed > storageLimit) {
      overageCharges += (storageUsed - storageLimit) * rates.storageOveragePerMb;
    }
    if (messagesUsed > messagesLimit) {
      overageCharges += (messagesUsed - messagesLimit) * rates.messageOveragePerUnit;
    }

    const totalUsageCharges = usageCharges.apiCalls + usageCharges.storage + usageCharges.messages;
    const totalAmount = basePrice + totalUsageCharges + overageCharges;

    // Round to 2 decimal places
    const billing = {
      basePlan: planConfig?.displayName ?? tenant.plan,
      basePrice,
      currency: planConfig?.currency ?? 'USD',
      usageCharges: {
        apiCalls: Math.round(usageCharges.apiCalls * 100) / 100,
        storage: Math.round(usageCharges.storage * 100) / 100,
        messages: Math.round(usageCharges.messages * 100) / 100,
        total: Math.round(totalUsageCharges * 100) / 100,
      },
      overageCharges: Math.round(overageCharges * 100) / 100,
      totalAmount: Math.round(totalAmount * 100) / 100,
      billingPeriod: period === 'year' ? 'Yearly' : 'Monthly',
      // Include raw usage for display
      usage: {
        apiCalls: { used: apiCallsUsed, limit: apiCallsLimit },
        storage: { used: storageUsed, limit: storageLimit },
        messages: { used: messagesUsed, limit: messagesLimit },
        users: { used: tenant._count.users, limit: tenant.maxUsers },
        properties: { used: tenant._count.properties, limit: tenant.maxProperties },
        rooms: { used: totalRooms, limit: tenant.maxRooms },
      },
      // Include rates for display in the rate card
      rates: {
        apiCallOveragePerUnit: rates.apiCallOveragePerUnit,
        storageOveragePerMb: rates.storageOveragePerMb,
        messageOveragePerUnit: rates.messageOveragePerUnit,
      },
    };

    return NextResponse.json({
      success: true,
      data: billing,
    });
  } catch (error) {
    console.error('Error calculating usage billing:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to calculate billing' },
      { status: 500 }
    );
  }
}
