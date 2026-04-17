/**
 * GET /api/admin/billing/subscriptions
 * List all subscriptions with tenant and plan details.
 * Requires platform admin access.
 *
 * POST /api/admin/billing/subscriptions
 * Create a new subscription for a tenant.
 * Requires platform admin access.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePlatformAdmin } from '@/lib/auth/tenant-context';
import crypto from 'crypto';

// GET - List all subscriptions
export async function GET(request: NextRequest) {
  try {
    const authResult = await requirePlatformAdmin(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const tenantId = searchParams.get('tenantId');

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (tenantId) where.tenantId = tenantId;

    const subscriptions = await db.subscription.findMany({
      where,
      include: {
        invoices: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Enrich with tenant name
    const tenantIds = [...new Set(subscriptions.map(s => s.tenantId))];
    const tenants = await db.tenant.findMany({
      where: { id: { in: tenantIds } },
      select: { id: true, name: true, slug: true, email: true, plan: true, status: true },
    });
    const tenantMap = new Map(tenants.map(t => [t.id, t]));

    const enriched = subscriptions.map(sub => ({
      id: sub.id,
      tenantId: sub.tenantId,
      tenantName: tenantMap.get(sub.tenantId)?.name || 'Unknown',
      tenantSlug: tenantMap.get(sub.tenantId)?.slug || '',
      tenantEmail: tenantMap.get(sub.tenantId)?.email || '',
      planId: sub.planId,
      planName: sub.planName,
      billingCycle: sub.billingCycle,
      amount: sub.amount,
      currency: sub.currency,
      status: sub.status,
      currentPeriodStart: sub.currentPeriodStart.toISOString(),
      currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
      cancelledAt: sub.cancelledAt?.toISOString() || null,
      createdAt: sub.createdAt.toISOString(),
      updatedAt: sub.updatedAt.toISOString(),
      invoiceCount: sub.invoices.length,
      recentInvoices: sub.invoices.map(inv => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        amount: inv.amount,
        status: inv.status,
        issuedAt: inv.issuedAt?.toISOString() || null,
        dueAt: inv.dueAt?.toISOString() || null,
      })),
    }));

    // Stats
    const stats = {
      total: enriched.length,
      active: enriched.filter(s => s.status === 'active').length,
      cancelled: enriched.filter(s => s.status === 'cancelled').length,
      pastDue: enriched.filter(s => s.status === 'past_due').length,
      totalMrr: enriched
        .filter(s => s.status === 'active')
        .reduce((sum, s) => sum + (s.billingCycle === 'yearly' ? s.amount / 12 : s.amount), 0),
    };

    return NextResponse.json({
      success: true,
      data: {
        subscriptions: enriched,
        stats,
      },
    });
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch subscriptions' },
      { status: 500 }
    );
  }
}

// POST - Create a new subscription for a tenant
export async function POST(request: NextRequest) {
  try {
    const authResult = await requirePlatformAdmin(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body = await request.json();
    const { tenantId, planName, billingCycle } = body;

    if (!tenantId || !planName) {
      return NextResponse.json(
        { success: false, error: 'tenantId and planName are required' },
        { status: 400 }
      );
    }

    // Verify tenant exists
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId, deletedAt: null },
    });
    if (!tenant) {
      return NextResponse.json(
        { success: false, error: 'Tenant not found' },
        { status: 404 }
      );
    }

    // Get plan details from DB
    const plan = await db.subscriptionPlan.findFirst({
      where: { name: planName, isActive: true },
    });
    if (!plan) {
      return NextResponse.json(
        { success: false, error: `Plan "${planName}" not found` },
        { status: 404 }
      );
    }

    // Check if tenant already has an active subscription
    const existingSub = await db.subscription.findFirst({
      where: { tenantId, status: 'active' },
    });
    if (existingSub) {
      return NextResponse.json(
        { success: false, error: 'Tenant already has an active subscription. Cancel or update the existing one first.' },
        { status: 409 }
      );
    }

    const cycle = billingCycle === 'yearly' ? 'yearly' : 'monthly';
    const amount = cycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
    const now = new Date();
    const periodEnd = new Date(now);
    if (cycle === 'yearly') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    // Create subscription
    const subscription = await db.subscription.create({
      data: {
        tenantId,
        planId: plan.id,
        planName: plan.name,
        billingCycle: cycle,
        amount,
        currency: plan.currency,
        status: 'active',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
    });

    // Also update tenant plan and subscription dates
    await db.tenant.update({
      where: { id: tenantId },
      data: {
        plan: planName,
        status: 'active',
        maxProperties: plan.maxProperties,
        maxUsers: plan.maxUsers,
        maxRooms: plan.maxRooms,
        storageLimitMb: plan.storageLimitMb,
        subscriptionStartsAt: now,
        subscriptionEndsAt: periodEnd,
      },
    });

    // Auto-generate first invoice
    const invoiceNumber = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + 30);

    await db.subscriptionInvoice.create({
      data: {
        subscriptionId: subscription.id,
        invoiceNumber,
        amount,
        currency: plan.currency,
        status: 'issued',
        issuedAt: now,
        dueAt: dueDate,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: subscription.id,
        tenantId: subscription.tenantId,
        planId: subscription.planId,
        planName: subscription.planName,
        billingCycle: subscription.billingCycle,
        amount: subscription.amount,
        currency: subscription.currency,
        status: subscription.status,
        currentPeriodStart: subscription.currentPeriodStart.toISOString(),
        currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
        createdAt: subscription.createdAt.toISOString(),
      },
      message: `Subscription created for tenant "${tenant.name}" on ${planName} plan`,
    });
  } catch (error) {
    console.error('Error creating subscription:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create subscription' },
      { status: 500 }
    );
  }
}
