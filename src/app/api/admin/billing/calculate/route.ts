/**
 * POST /api/admin/billing/calculate
 * Server-side billing calculation with proper auth, tenant isolation, and currency standardization.
 * Requires platform admin access.
 *
 * Body:
 *   - tenantId (optional, defaults to auth user's tenant)
 *   - billingPeriod: 'monthly' | 'yearly'
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePlatformAdmin } from '@/lib/auth/tenant-context';

// Plan-based pricing lookup (aligned with SubscriptionPlan table)
const planPricing: Record<string, { monthly: number; yearly: number }> = {
  trial: { monthly: 0, yearly: 0 },
  starter: { monthly: 99, yearly: 990 },
  professional: { monthly: 499, yearly: 4990 },
  enterprise: { monthly: 1999, yearly: 19990 },
};

// Overage rates (USD)
const overageRates = {
  apiCalls: 0.001,    // per call over limit
  storage: 0.10,      // per MB over limit
  messages: 0.01,     // per message over limit
};

// Usage rates (USD) for metered usage within limits
const usageRates = {
  apiCalls: 0.0001,
  storage: 0.01,
  messages: 0.001,
};

export async function POST(request: NextRequest) {
  try {
    const authResult = await requirePlatformAdmin(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body = await request.json();
    const tenantId = body.tenantId || authResult.tenantId;
    const billingPeriod: 'monthly' | 'yearly' = body.billingPeriod || 'monthly';

    // Fetch tenant data
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId, deletedAt: null },
      include: {
        _count: { select: { properties: true, users: true } },
        properties: { select: { totalRooms: true } },
      },
    });

    if (!tenant) {
      return NextResponse.json(
        { success: false, error: 'Tenant not found' },
        { status: 404 }
      );
    }

    // Fetch usage data
    let apiCallsUsed = 0;
    let storageUsed = 0;
    let messagesUsed = 0;

    try {
      const summary = await db.usageSummary.findUnique({
        where: { tenantId },
      });
      if (summary) {
        apiCallsUsed = summary.apiCallsMonth;
        storageUsed = Math.round(summary.storageUsedMb);
        messagesUsed = summary.messagesMonth + summary.emailsMonth + summary.smsMonth;
      }
    } catch {
      // UsageSummary may not exist yet
    }

    // Get plan limits
    const plan = tenant.plan || 'trial';
    const apiCallsLimit = plan === 'enterprise' ? 500000 :
                          plan === 'professional' ? 100000 :
                          plan === 'starter' ? 25000 : 5000;
    const messagesLimit = plan === 'enterprise' ? 100000 :
                          plan === 'professional' ? 50000 :
                          plan === 'starter' ? 10000 : 2000;

    // Base price from plan (standardized to USD)
    const pricing = planPricing[plan] || planPricing.trial;
    const basePrice = billingPeriod === 'yearly' ? pricing.yearly / 12 : pricing.monthly;

    // Usage charges (within limit)
    const usageCharges = {
      apiCalls: Math.min(apiCallsUsed, apiCallsLimit) * usageRates.apiCalls,
      storage: Math.min(storageUsed, tenant.storageLimitMb) * usageRates.storage,
      messages: Math.min(messagesUsed, messagesLimit) * usageRates.messages,
    };

    const totalUsageCharges = usageCharges.apiCalls + usageCharges.storage + usageCharges.messages;

    // Overage charges
    let overageCharges = 0;
    if (apiCallsUsed > apiCallsLimit) {
      overageCharges += (apiCallsUsed - apiCallsLimit) * overageRates.apiCalls;
    }
    if (storageUsed > tenant.storageLimitMb) {
      overageCharges += (storageUsed - tenant.storageLimitMb) * overageRates.storage;
    }
    if (messagesUsed > messagesLimit) {
      overageCharges += (messagesUsed - messagesLimit) * overageRates.messages;
    }

    // Total = base + usage charges + overage (FIX: previously usage charges were computed but not added)
    const totalAmount = basePrice + totalUsageCharges + overageCharges;

    return NextResponse.json({
      success: true,
      data: {
        tenantId,
        plan,
        billingPeriod,
        currency: 'USD',
        basePrice: Math.round(basePrice * 100) / 100,
        usageCharges: {
          apiCalls: Math.round(usageCharges.apiCalls * 100) / 100,
          storage: Math.round(usageCharges.storage * 100) / 100,
          messages: Math.round(usageCharges.messages * 100) / 100,
          total: Math.round(totalUsageCharges * 100) / 100,
        },
        overageCharges: Math.round(overageCharges * 100) / 100,
        totalAmount: Math.round(totalAmount * 100) / 100,
        usage: {
          apiCalls: { used: apiCallsUsed, limit: apiCallsLimit },
          storage: { used: storageUsed, limit: tenant.storageLimitMb },
          messages: { used: messagesUsed, limit: messagesLimit },
          users: { used: tenant._count.users, limit: tenant.maxUsers },
          properties: { used: tenant._count.properties, limit: tenant.maxProperties },
          rooms: {
            used: tenant.properties.reduce((sum, p) => sum + p.totalRooms, 0),
            limit: tenant.maxRooms,
          },
        },
      },
    });
  } catch (error) {
    console.error('Error calculating billing:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to calculate billing' },
      { status: 500 }
    );
  }
}
