/**
 * GET /api/admin/plans/[id]
 * Get a single subscription plan by name from the database.
 * Requires platform admin access.
 *
 * PUT /api/admin/plans/[id]
 * Update a subscription plan in the database.
 * Cascades limit changes to subscribed tenants.
 * Requires platform admin access.
 *
 * DELETE /api/admin/plans/[id]
 * Soft-delete a subscription plan (sets isActive=false).
 * Prevents deletion if tenants are actively subscribed.
 * Requires platform admin access.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePlatformAdmin } from '@/lib/auth/tenant-context';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - Get a single plan by name (id in URL = plan name)
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requirePlatformAdmin(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { id } = await params;
    const plan = await db.subscriptionPlan.findFirst({
      where: { name: id, isActive: true },
    });

    if (!plan) {
      return NextResponse.json(
        { success: false, error: 'Plan not found' },
        { status: 404 }
      );
    }

    // Get subscriber count from database
    const subscriberCount = await db.tenant.count({
      where: { plan: plan.name, deletedAt: null },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: plan.name,
        name: plan.name,
        displayName: plan.displayName,
        description: plan.description,
        price: plan.monthlyPrice,
        yearlyPrice: plan.yearlyPrice,
        currency: plan.currency,
        billingPeriod: 'monthly',
        maxProperties: plan.maxProperties,
        maxUsers: plan.maxUsers,
        maxRooms: plan.maxRooms,
        storageLimitMb: plan.storageLimitMb,
        features: JSON.parse(plan.features || '[]'),
        isPopular: plan.isPopular,
        isCustom: plan.name === 'enterprise',
        sortOrder: plan.sortOrder,
        subscriberCount,
        status: 'active',
      },
    });
  } catch (error) {
    console.error('Error fetching plan:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch plan' },
      { status: 500 }
    );
  }
}

// PUT - Update a plan's configuration in the database
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requirePlatformAdmin(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { id } = await params;
    const body = await request.json();

    // Check plan exists
    const existing = await db.subscriptionPlan.findFirst({
      where: { name: id, isActive: true },
    });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Plan not found' },
        { status: 404 }
      );
    }

    // Validate the update payload
    if (body.displayName !== undefined && (typeof body.displayName !== 'string' || body.displayName.trim().length === 0)) {
      return NextResponse.json(
        { success: false, error: 'displayName must be a non-empty string' },
        { status: 400 }
      );
    }
    if (body.price !== undefined && (typeof body.price !== 'number' || body.price < 0)) {
      return NextResponse.json(
        { success: false, error: 'price must be a non-negative number' },
        { status: 400 }
      );
    }
    if (body.maxProperties !== undefined && (typeof body.maxProperties !== 'number' || body.maxProperties < 1)) {
      return NextResponse.json(
        { success: false, error: 'maxProperties must be at least 1' },
        { status: 400 }
      );
    }
    if (body.maxUsers !== undefined && (typeof body.maxUsers !== 'number' || body.maxUsers < 1)) {
      return NextResponse.json(
        { success: false, error: 'maxUsers must be at least 1' },
        { status: 400 }
      );
    }
    if (body.maxRooms !== undefined && (typeof body.maxRooms !== 'number' || body.maxRooms < 1)) {
      return NextResponse.json(
        { success: false, error: 'maxRooms must be at least 1' },
        { status: 400 }
      );
    }
    if (body.storageLimitMb !== undefined && (typeof body.storageLimitMb !== 'number' || body.storageLimitMb < 100)) {
      return NextResponse.json(
        { success: false, error: 'storageLimitMb must be at least 100' },
        { status: 400 }
      );
    }

    // Build update data with only allowed fields
    const updateData: Record<string, unknown> = {};
    if (body.displayName !== undefined) updateData.displayName = body.displayName;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.price !== undefined) updateData.monthlyPrice = body.price;
    if (body.yearlyPrice !== undefined) updateData.yearlyPrice = body.yearlyPrice;
    if (body.maxProperties !== undefined) updateData.maxProperties = body.maxProperties;
    if (body.maxUsers !== undefined) updateData.maxUsers = body.maxUsers;
    if (body.maxRooms !== undefined) updateData.maxRooms = body.maxRooms;
    if (body.storageLimitMb !== undefined) updateData.storageLimitMb = body.storageLimitMb;
    if (body.features !== undefined) updateData.features = JSON.stringify(body.features);
    if (body.isPopular !== undefined) updateData.isPopular = body.isPopular;

    const updated = await db.subscriptionPlan.update({
      where: { id: existing.id },
      data: updateData,
    });

    // If limits changed, also update all tenants on this plan
    const limitFields = ['maxProperties', 'maxUsers', 'maxRooms', 'storageLimitMb'] as const;
    const hasLimitChanges = limitFields.some(f => updateData[f] !== undefined);

    let updatedTenantCount = 0;
    if (hasLimitChanges) {
      const tenantUpdateData: Record<string, number> = {};
      if (updateData.maxProperties !== undefined) tenantUpdateData.maxProperties = updateData.maxProperties as number;
      if (updateData.maxUsers !== undefined) tenantUpdateData.maxUsers = updateData.maxUsers as number;
      if (updateData.maxRooms !== undefined) tenantUpdateData.maxRooms = updateData.maxRooms as number;
      if (updateData.storageLimitMb !== undefined) tenantUpdateData.storageLimitMb = updateData.storageLimitMb as number;

      const result = await db.tenant.updateMany({
        where: { plan: existing.name, deletedAt: null },
        data: tenantUpdateData,
      });
      updatedTenantCount = result.count;
    }

    return NextResponse.json({
      success: true,
      data: {
        id: updated.name,
        name: updated.name,
        displayName: updated.displayName,
        description: updated.description,
        price: updated.monthlyPrice,
        yearlyPrice: updated.yearlyPrice,
        currency: updated.currency,
        billingPeriod: 'monthly',
        maxProperties: updated.maxProperties,
        maxUsers: updated.maxUsers,
        maxRooms: updated.maxRooms,
        storageLimitMb: updated.storageLimitMb,
        features: JSON.parse(updated.features || '[]'),
        isPopular: updated.isPopular,
        sortOrder: updated.sortOrder,
      },
      message: `Plan updated successfully${updatedTenantCount > 0 ? ` (${updatedTenantCount} tenant(s) limits updated)` : ''}`,
    });
  } catch (error) {
    console.error('Error updating plan:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update plan' },
      { status: 500 }
    );
  }
}

// DELETE - Soft-delete a plan (sets isActive = false)
// Prevents deletion if tenants are actively subscribed
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requirePlatformAdmin(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { id } = await params;

    // Check plan exists
    const existing = await db.subscriptionPlan.findFirst({
      where: { name: id, isActive: true },
    });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Plan not found' },
        { status: 404 }
      );
    }

    // Check if any tenants are on this plan
    const subscriberCount = await db.tenant.count({
      where: { plan: existing.name, deletedAt: null },
    });

    if (subscriberCount > 0) {
      return NextResponse.json(
        { success: false, error: `Cannot delete plan with ${subscriberCount} active subscriber(s). Migrate tenants to another plan first.` },
        { status: 409 }
      );
    }

    // Soft-delete by setting isActive = false
    await db.subscriptionPlan.update({
      where: { id: existing.id },
      data: { isActive: false },
    });

    return NextResponse.json({
      success: true,
      message: `Plan "${existing.displayName}" deleted successfully`,
    });
  } catch (error) {
    console.error('Error deleting plan:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete plan' },
      { status: 500 }
    );
  }
}
