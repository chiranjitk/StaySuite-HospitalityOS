/**
 * GET /api/admin/billing/subscriptions/[id]
 * Get a single subscription by ID.
 * Requires platform admin access.
 *
 * PUT /api/admin/billing/subscriptions/[id]
 * Update a subscription (plan change, billing cycle change).
 * Requires platform admin access.
 *
 * DELETE /api/admin/billing/subscriptions/[id]
 * Cancel a subscription (sets status to 'cancelled').
 * Requires platform admin access.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePlatformAdmin } from '@/lib/auth/tenant-context';
import crypto from 'crypto';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Get a single subscription
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requirePlatformAdmin(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { id } = await params;
    const subscription = await db.subscription.findUnique({
      where: { id },
      include: {
        invoices: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!subscription) {
      return NextResponse.json(
        { success: false, error: 'Subscription not found' },
        { status: 404 }
      );
    }

    // Get tenant info
    const tenant = await db.tenant.findUnique({
      where: { id: subscription.tenantId },
      select: { id: true, name: true, slug: true, email: true },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: subscription.id,
        tenantId: subscription.tenantId,
        tenant: tenant ? { name: tenant.name, slug: tenant.slug, email: tenant.email } : null,
        planId: subscription.planId,
        planName: subscription.planName,
        billingCycle: subscription.billingCycle,
        amount: subscription.amount,
        currency: subscription.currency,
        status: subscription.status,
        currentPeriodStart: subscription.currentPeriodStart.toISOString(),
        currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
        cancelledAt: subscription.cancelledAt?.toISOString() || null,
        createdAt: subscription.createdAt.toISOString(),
        updatedAt: subscription.updatedAt.toISOString(),
        invoices: subscription.invoices.map(inv => ({
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          amount: inv.amount,
          currency: inv.currency,
          status: inv.status,
          issuedAt: inv.issuedAt?.toISOString() || null,
          dueAt: inv.dueAt?.toISOString() || null,
          paidAt: inv.paidAt?.toISOString() || null,
          pdfUrl: inv.pdfUrl,
          createdAt: inv.createdAt.toISOString(),
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching subscription:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch subscription' },
      { status: 500 }
    );
  }
}

// PUT - Update a subscription (plan change, billing cycle change)
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requirePlatformAdmin(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { id } = await params;
    const body = await request.json();
    const { planName, billingCycle, status } = body;

    const subscription = await db.subscription.findUnique({
      where: { id },
    });
    if (!subscription) {
      return NextResponse.json(
        { success: false, error: 'Subscription not found' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {};

    // Plan change
    if (planName && planName !== subscription.planName) {
      const plan = await db.subscriptionPlan.findFirst({
        where: { name: planName, isActive: true },
      });
      if (!plan) {
        return NextResponse.json(
          { success: false, error: `Plan "${planName}" not found` },
          { status: 404 }
        );
      }

      const cycle = billingCycle === 'yearly' ? 'yearly' : subscription.billingCycle;
      const amount = cycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;

      updateData.planId = plan.id;
      updateData.planName = plan.name;
      updateData.amount = amount;

      // Reset billing period
      const now = new Date();
      const periodEnd = new Date(now);
      if (cycle === 'yearly') {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }
      updateData.currentPeriodStart = now;
      updateData.currentPeriodEnd = periodEnd;

      // Update tenant plan and limits
      await db.tenant.update({
        where: { id: subscription.tenantId },
        data: {
          plan: plan.name,
          maxProperties: plan.maxProperties,
          maxUsers: plan.maxUsers,
          maxRooms: plan.maxRooms,
          storageLimitMb: plan.storageLimitMb,
          subscriptionStartsAt: now,
          subscriptionEndsAt: periodEnd,
        },
      });

      // Generate proration invoice for plan change
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
    }

    // Billing cycle change
    if (billingCycle && billingCycle !== subscription.billingCycle) {
      const cycle = billingCycle === 'yearly' ? 'yearly' : 'monthly';
      updateData.billingCycle = cycle;

      // Recalculate amount based on new cycle
      const currentPlanName = (updateData.planName as string) || subscription.planName;
      const plan = await db.subscriptionPlan.findFirst({
        where: { name: currentPlanName, isActive: true },
      });
      if (plan) {
        updateData.amount = cycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;

        const now = new Date();
        const periodEnd = new Date(now);
        if (cycle === 'yearly') {
          periodEnd.setFullYear(periodEnd.getFullYear() + 1);
        } else {
          periodEnd.setMonth(periodEnd.getMonth() + 1);
        }
        if (!updateData.currentPeriodStart) {
          updateData.currentPeriodStart = now;
          updateData.currentPeriodEnd = periodEnd;
        }
      }
    }

    // Status change (e.g., reactivate)
    if (status && status !== subscription.status) {
      if (status === 'active' && subscription.status === 'cancelled') {
        updateData.cancelledAt = null;
      }
      updateData.status = status;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No changes provided' },
        { status: 400 }
      );
    }

    const updated = await db.subscription.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        tenantId: updated.tenantId,
        planId: updated.planId,
        planName: updated.planName,
        billingCycle: updated.billingCycle,
        amount: updated.amount,
        currency: updated.currency,
        status: updated.status,
        currentPeriodStart: updated.currentPeriodStart.toISOString(),
        currentPeriodEnd: updated.currentPeriodEnd.toISOString(),
        cancelledAt: updated.cancelledAt?.toISOString() || null,
      },
      message: 'Subscription updated successfully',
    });
  } catch (error) {
    console.error('Error updating subscription:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update subscription' },
      { status: 500 }
    );
  }
}

// DELETE - Cancel a subscription
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requirePlatformAdmin(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { id } = await params;

    const subscription = await db.subscription.findUnique({
      where: { id },
    });
    if (!subscription) {
      return NextResponse.json(
        { success: false, error: 'Subscription not found' },
        { status: 404 }
      );
    }

    if (subscription.status === 'cancelled') {
      return NextResponse.json(
        { success: false, error: 'Subscription is already cancelled' },
        { status: 400 }
      );
    }

    const now = new Date();

    // Cancel subscription
    await db.subscription.update({
      where: { id },
      data: {
        status: 'cancelled',
        cancelledAt: now,
      },
    });

    // Update tenant status
    await db.tenant.update({
      where: { id: subscription.tenantId },
      data: {
        status: 'cancelled',
        subscriptionEndsAt: now,
      },
    });

    // Mark any pending invoices as void
    await db.subscriptionInvoice.updateMany({
      where: {
        subscriptionId: subscription.id,
        status: { in: ['draft', 'issued'] },
      },
      data: {
        status: 'void',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Subscription cancelled successfully',
    });
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to cancel subscription' },
      { status: 500 }
    );
  }
}
