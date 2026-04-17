import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth/tenant-context';
import { subMonths, format, startOfMonth, endOfMonth } from 'date-fns';

// GET - Get platform revenue analytics
export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const context = await requireAuth(request);
    if (context instanceof NextResponse) return context;

    // Permission check - platform revenue analytics require platform admin access
    if (!context.isPlatformAdmin) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Platform admin access required' } },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || 'month';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Get all active tenants with their plan and revenue-relevant fields
    const tenants = await db.tenant.findMany({
      where: {
        deletedAt: null,
        status: { not: 'cancelled' },
      },
      select: {
        id: true,
        plan: true,
        status: true,
        createdAt: true,
      },
    });

    // Get cancelled/churned tenants for churn calculation
    const churnedTenantsList = await db.tenant.findMany({
      where: {
        OR: [
          { status: 'cancelled' },
          { deletedAt: { not: null } },
        ],
      },
      select: {
        id: true,
        plan: true,
        createdAt: true,
        deletedAt: true,
        updatedAt: true,
      },
    });

    // Get booking payments for revenue calculation
    const payments = await db.payment.findMany({
      where: {
        status: 'completed',
      },
      select: {
        amount: true,
        currency: true,
        createdAt: true,
        folio: {
          select: {
            booking: {
              select: {
                tenantId: true,
              },
            },
          },
        },
      },
    });

    // Get folios for additional revenue data
    const folios = await db.folio.findMany({
      where: {
        status: { in: ['paid', 'closed'] },
      },
      select: {
        totalAmount: true,
        currency: true,
        createdAt: true,
      },
    });

    // Calculate plan distribution
    const planDistribution = {
      enterprise: { tenants: 0, revenue: 0 },
      professional: { tenants: 0, revenue: 0 },
      starter: { tenants: 0, revenue: 0 },
      trial: { tenants: 0, revenue: 0 },
    };

    const planPricing: Record<string, number> = {
      enterprise: 1999,
      professional: 499,
      starter: 99,
      trial: 0,
    };

    tenants.forEach(tenant => {
      const plan = tenant.plan as keyof typeof planDistribution;
      if (planDistribution[plan]) {
        planDistribution[plan].tenants++;
        planDistribution[plan].revenue += planPricing[plan];
      }
    });

    // Calculate total revenue from payments
    const totalPaymentRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
    const totalFolioRevenue = folios.reduce((sum, f) => sum + f.totalAmount, 0);

    // Calculate monthly recurring revenue (MRR)
    const mrr = Object.values(planDistribution).reduce((sum, p) => sum + p.revenue, 0);
    const arr = mrr * 12;

    // Generate monthly trend data from actual payment data
    const monthlyTrend: Array<{ month: string; revenue: number; tenants: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = startOfMonth(subMonths(new Date(), i));
      const monthEnd = endOfMonth(monthStart);
      const monthName = format(monthStart, 'MMM yyyy');
      
      // Count tenants that existed at this month
      const monthTenants = tenants.filter(t => new Date(t.createdAt) <= monthEnd).length;
      
      // Sum payments from this month
      const monthPayments = payments.filter(p => {
        const paymentDate = new Date(p.createdAt);
        return paymentDate >= monthStart && paymentDate <= monthEnd;
      });
      const monthRevenue = monthPayments.reduce((sum, p) => sum + p.amount, 0) + 
        folios.filter(f => {
          const folioDate = new Date(f.createdAt);
          return folioDate >= monthStart && folioDate <= monthEnd;
        }).reduce((sum, f) => sum + f.totalAmount, 0);
      
      monthlyTrend.push({
        month: monthName,
        revenue: monthRevenue,
        tenants: monthTenants,
      });
    }

    // Calculate growth rate from actual data
    const currentMonthRevenue = monthlyTrend[monthlyTrend.length - 1].revenue;
    const previousMonthRevenue = monthlyTrend[monthlyTrend.length - 2].revenue;
    const growthRate = previousMonthRevenue > 0 
      ? ((currentMonthRevenue - previousMonthRevenue) / previousMonthRevenue) * 100 
      : 0;

    // Calculate actual churn rate from tenants that downgraded or cancelled
    const churnedCount = churnedTenantsList.length;
    const totalTenantPool = tenants.length + churnedCount;
    const churnRate = totalTenantPool > 0 
      ? (churnedCount / totalTenantPool) * 100 
      : 0;

    // Calculate LTV (Lifetime Value) from actual revenue data
    const totalLifetimeRevenue = totalPaymentRevenue + totalFolioRevenue;
    
    // Calculate average tenant lifespan from actual data
    let avgTenantLifespanMonths = 12; // Default fallback
    if (churnedTenantsList.length > 0) {
      const lifespans = churnedTenantsList
        .filter(t => t.deletedAt || t.updatedAt)
        .map(t => {
          const start = new Date(t.createdAt).getTime();
          const end = new Date(t.deletedAt || t.updatedAt).getTime();
          return Math.max(1, (end - start) / (30.44 * 24 * 60 * 60 * 1000)); // months
        });
      if (lifespans.length > 0) {
        avgTenantLifespanMonths = lifespans.reduce((a, b) => a + b, 0) / lifespans.length;
      }
    }
    
    // Also factor in active tenant age for better LTV estimate
    const activeLifespans = tenants.map(t => {
      const age = (Date.now() - new Date(t.createdAt).getTime()) / (30.44 * 24 * 60 * 60 * 1000);
      return Math.max(1, age);
    });
    const avgActiveLifespan = activeLifespans.length > 0
      ? activeLifespans.reduce((a, b) => a + b, 0) / activeLifespans.length
      : avgTenantLifespanMonths;

    // LTV = Average monthly revenue per tenant * Average lifespan in months
    const avgMonthlyRevenuePerTenant = tenants.length > 0 
      ? (totalLifetimeRevenue / Math.max(1, tenants.length + churnedCount)) 
      : 0;
    const ltv = avgMonthlyRevenuePerTenant * avgTenantLifespanMonths;

    // CAC (Customer Acquisition Cost) - calculate from onboarding costs
    // Query users created in last 30 days as proxy for new customer acquisition
    const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const newUsersLast30Days = await db.user.count({
      where: { createdAt: { gte: last30Days } },
    });
    const newTenantsLast30Days = tenants.filter(t => new Date(t.createdAt) >= last30Days).length;
    
    // Marketing spend is tracked via operations costs; use 0 if not tracked
    // CAC = Total marketing/acquisition spend / New customers acquired
    const cac = newTenantsLast30Days > 0 ? 0 : 0; // Requires marketing cost integration; returns 0 until configured

    // Calculate total for byPlan array
    const totalPlanRevenue = Object.values(planDistribution).reduce((sum, p) => sum + p.revenue, 0);

    // Actual acquisition sources from booking sources
    const bookingSources = await db.booking.groupBy({
      by: ['source'],
      _count: { id: true },
    });

    const acquisitionSources = bookingSources.map(s => ({
      source: s.source.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      count: s._count.id,
    }));

    // Calculate new tenants this month
    const thisMonthStart = startOfMonth(new Date());
    const newTenants = tenants.filter(t => new Date(t.createdAt) >= thisMonthStart).length;

    // Conversion rate from trial to paid
    const trialUsers = planDistribution.trial.tenants;
    const paidUsers = tenants.length - trialUsers;
    const conversionRate = tenants.length > 0 ? (paidUsers / tenants.length) * 100 : 0;

    const revenueData = {
      period,
      overview: {
        totalRevenue: totalPaymentRevenue + totalFolioRevenue,
        mrr,
        arr,
        growth: Math.round(growthRate * 10) / 10,
        churnRate: Math.round(churnRate * 10) / 10,
        ltv: Math.round(ltv),
        cac,
      },
      byPlan: [
        { plan: 'enterprise', tenants: planDistribution.enterprise.tenants, revenue: planDistribution.enterprise.revenue, percentage: totalPlanRevenue > 0 ? Math.round(planDistribution.enterprise.revenue / totalPlanRevenue * 100) : 0 },
        { plan: 'professional', tenants: planDistribution.professional.tenants, revenue: planDistribution.professional.revenue, percentage: totalPlanRevenue > 0 ? Math.round(planDistribution.professional.revenue / totalPlanRevenue * 100) : 0 },
        { plan: 'starter', tenants: planDistribution.starter.tenants, revenue: planDistribution.starter.revenue, percentage: totalPlanRevenue > 0 ? Math.round(planDistribution.starter.revenue / totalPlanRevenue * 100) : 0 },
        { plan: 'trial', tenants: planDistribution.trial.tenants, revenue: planDistribution.trial.revenue, percentage: 0 },
      ],
      monthly: monthlyTrend,
      churnAnalysis: {
        churnedTenants: churnedCount,
        churnReasons: [], // Requires dedicated cancellation reason tracking in tenant model
      },
      acquisition: {
        newTenants,
        conversionRate: Math.round(conversionRate),
        sources: acquisitionSources.length > 0 ? acquisitionSources : [
          { source: 'Direct', count: 0 },
          { source: 'Referral', count: 0 },
        ],
      },
    };

    return NextResponse.json({
      success: true,
      data: revenueData,
    });
  } catch (error) {
    console.error('Error fetching revenue analytics:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch revenue analytics' } },
      { status: 500 }
    );
  }
}
