/**
 * GET /api/admin/plans
 * List all SaaS subscription plans from the database with subscriber counts.
 * Requires platform admin access.
 * Auto-seeds default plans if the DB is empty.
 *
 * POST /api/admin/plans
 * Create a new subscription plan in the database.
 * Requires platform admin access.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePlatformAdmin, requireAuth } from '@/lib/auth/tenant-context';

// Default plan definitions used for seeding if DB is empty
const defaultPlanDefs = [
  {
    name: 'trial',
    displayName: 'Trial',
    description: 'Try StaySuite free for 14 days',
    monthlyPrice: 0,
    yearlyPrice: 0,
    maxProperties: 1,
    maxUsers: 3,
    maxRooms: 20,
    storageLimitMb: 500,
    features: JSON.stringify([
      { name: 'Basic PMS features', included: true },
      { name: 'Front Desk operations', included: true },
      { name: 'Guest management', included: true },
      { name: 'Basic reports', included: true },
      { name: 'Channel manager', included: false },
      { name: 'Advanced analytics', included: false },
      { name: 'API access', included: false },
      { name: 'Custom branding', included: false },
    ]),
    sortOrder: 0,
    isPopular: false,
  },
  {
    name: 'starter',
    displayName: 'Starter',
    description: 'Perfect for small properties',
    monthlyPrice: 99,
    yearlyPrice: 990,
    maxProperties: 1,
    maxUsers: 5,
    maxRooms: 50,
    storageLimitMb: 1000,
    features: JSON.stringify([
      { name: 'Full PMS features', included: true },
      { name: 'Front Desk operations', included: true },
      { name: 'Guest management', included: true },
      { name: 'All reports', included: true },
      { name: 'Channel manager', included: true },
      { name: 'Email support', included: true },
      { name: 'Advanced analytics', included: false },
      { name: 'API access', included: false },
      { name: 'Custom branding', included: false },
    ]),
    sortOrder: 1,
    isPopular: false,
  },
  {
    name: 'professional',
    displayName: 'Professional',
    description: 'For growing hospitality businesses',
    monthlyPrice: 499,
    yearlyPrice: 4990,
    maxProperties: 5,
    maxUsers: 25,
    maxRooms: 200,
    storageLimitMb: 5000,
    features: JSON.stringify([
      { name: 'Everything in Starter', included: true },
      { name: 'Multi-property support', included: true },
      { name: 'Advanced analytics', included: true },
      { name: 'API access', included: true },
      { name: 'Custom integrations', included: true },
      { name: 'Priority support', included: true },
      { name: 'Mobile app access', included: true },
      { name: 'Custom branding', included: false },
      { name: 'Dedicated account manager', included: false },
    ]),
    sortOrder: 2,
    isPopular: true,
  },
  {
    name: 'enterprise',
    displayName: 'Enterprise',
    description: 'Custom solutions for large organizations',
    monthlyPrice: 1999,
    yearlyPrice: 19990,
    maxProperties: 999,
    maxUsers: 999,
    maxRooms: 9999,
    storageLimitMb: 50000,
    features: JSON.stringify([
      { name: 'Everything in Professional', included: true },
      { name: 'Unlimited properties', included: true },
      { name: 'Custom branding', included: true },
      { name: 'Dedicated account manager', included: true },
      { name: 'SLA guarantee', included: true },
      { name: 'On-premise option', included: true },
      { name: 'Custom development', included: true },
      { name: '24/7 phone support', included: true },
    ]),
    sortOrder: 3,
    isPopular: false,
  },
];

async function ensurePlansSeeded() {
  const existing = await db.subscriptionPlan.count();
  if (existing === 0) {
    await db.subscriptionPlan.createMany({ data: defaultPlanDefs });
  }
}

// GET - List all subscription plans with subscriber counts
// Any authenticated user can read plans; only writes require platform admin
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Ensure default plans exist
    await ensurePlansSeeded();

    const plans = await db.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    // Get subscriber counts from tenants
    const tenantCounts = await db.tenant.groupBy({
      by: ['plan'],
      where: { deletedAt: null },
      _count: { plan: true },
    });

    const countMap = new Map(tenantCounts.map(t => [t.plan, t._count.plan]));

    const plansWithCounts = plans.map(plan => ({
      id: plan.name,
      name: plan.name,
      displayName: plan.displayName,
      description: plan.description || '',
      price: plan.monthlyPrice,
      yearlyPrice: plan.yearlyPrice,
      currency: plan.currency,
      billingPeriod: 'monthly' as const,
      maxProperties: plan.maxProperties,
      maxUsers: plan.maxUsers,
      maxRooms: plan.maxRooms,
      storageLimitMb: plan.storageLimitMb,
      features: JSON.parse(plan.features || '[]'),
      isPopular: plan.isPopular,
      isCustom: plan.name === 'enterprise',
      sortOrder: plan.sortOrder,
      subscriberCount: countMap.get(plan.name) || 0,
      status: 'active' as const,
    }));

    return NextResponse.json({
      success: true,
      data: plansWithCounts,
    });
  } catch (error) {
    console.error('Error fetching plans:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch plans' },
      { status: 500 }
    );
  }
}

// POST - Create a new subscription plan in the database
export async function POST(request: NextRequest) {
  try {
    const authResult = await requirePlatformAdmin(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body = await request.json();
    const { name, displayName, description, monthlyPrice, yearlyPrice, maxProperties, maxUsers, maxRooms, storageLimitMb, features } = body;

    if (!name || !displayName) {
      return NextResponse.json(
        { success: false, error: 'name and displayName are required' },
        { status: 400 }
      );
    }

    // Check for duplicate plan name
    const existing = await db.subscriptionPlan.findFirst({
      where: { name },
    });
    if (existing) {
      return NextResponse.json(
        { success: false, error: `Plan with name "${name}" already exists` },
        { status: 409 }
      );
    }

    // Get next sort order
    const maxSort = await db.subscriptionPlan.aggregate({
      _max: { sortOrder: true },
    });

    const plan = await db.subscriptionPlan.create({
      data: {
        name,
        displayName,
        description: description || '',
        monthlyPrice: typeof monthlyPrice === 'number' ? monthlyPrice : 0,
        yearlyPrice: typeof yearlyPrice === 'number' ? yearlyPrice : 0,
        maxProperties: typeof maxProperties === 'number' ? maxProperties : 1,
        maxUsers: typeof maxUsers === 'number' ? maxUsers : 5,
        maxRooms: typeof maxRooms === 'number' ? maxRooms : 50,
        storageLimitMb: typeof storageLimitMb === 'number' ? storageLimitMb : 1000,
        features: JSON.stringify(Array.isArray(features) ? features : []),
        sortOrder: (maxSort._max.sortOrder || 0) + 1,
        isPopular: false,
      },
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
        sortOrder: plan.sortOrder,
        subscriberCount: 0,
        status: 'active',
      },
      message: 'Plan created successfully',
    });
  } catch (error) {
    console.error('Error creating plan:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create plan' },
      { status: 500 }
    );
  }
}
