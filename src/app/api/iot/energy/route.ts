import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET /api/iot/energy - Get energy metrics and analytics
export async function GET(request: NextRequest) {
  try {
    // Authentication check
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Permission check
    if (!hasPermission(user, 'iot.view') && !hasPermission(user, 'energy.view')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;
    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build where clause
    const where: Record<string, unknown> = { tenantId };
    if (propertyId) where.propertyId = propertyId;
    
    if (startDate || endDate) {
      where.date = {} as Record<string, Date>;
      if (startDate) (where.date as Record<string, Date>).gte = new Date(startDate);
      if (endDate) (where.date as Record<string, Date>).lte = new Date(endDate);
    }

    // Get energy metrics
    const metrics = await db.energyMetric.findMany({
      where,
      include: {
        property: { select: { name: true } }
      },
      orderBy: { date: 'asc' }
    });

    // Calculate totals and trends
    const totals = metrics.reduce((acc: any, m) => {
      acc.electricityKwh += Number(m.electricityKwh);
      acc.gasM3 += Number(m.gasM3);
      acc.waterM3 += Number(m.waterM3);
      acc.electricityCost += Number(m.electricityCost);
      acc.gasCost += Number(m.gasCost);
      acc.waterCost += Number(m.waterCost);
      acc.carbonFootprint += Number(m.carbonFootprint);
      return acc;
    }, {
      electricityKwh: 0,
      gasM3: 0,
      waterM3: 0,
      electricityCost: 0,
      gasCost: 0,
      waterCost: 0,
      carbonFootprint: 0
    });

    // Calculate daily averages
    const dailyAvg = metrics.length > 0 ? {
      electricityKwh: totals.electricityKwh / metrics.length,
      gasM3: totals.gasM3 / metrics.length,
      waterM3: totals.waterM3 / metrics.length,
      cost: (totals.electricityCost + totals.gasCost + totals.waterCost) / metrics.length
    } : {
      electricityKwh: 0,
      gasM3: 0,
      waterM3: 0,
      cost: 0
    };

    // Get property breakdown
    const propertyBreakdown = await db.energyMetric.groupBy({
      by: ['propertyId'],
      where: { tenantId },
      _sum: {
        electricityKwh: true,
        gasM3: true,
        waterM3: true,
        electricityCost: true,
        gasCost: true,
        waterCost: true,
        carbonFootprint: true
      }
    });

    // Get properties for names
    const properties = await db.property.findMany({
      where: { tenantId },
      select: { id: true, name: true }
    });

    const propertyMap = properties.reduce((acc: any, p) => {
      acc[p.id] = p.name;
      return acc;
    }, {});

    // Format property breakdown
    const formattedBreakdown = propertyBreakdown.map(pb => ({
      propertyId: pb.propertyId,
      propertyName: propertyMap[pb.propertyId] || 'Unknown',
      electricityKwh: Number(pb._sum.electricityKwh || 0),
      gasM3: Number(pb._sum.gasM3 || 0),
      waterM3: Number(pb._sum.waterM3 || 0),
      totalCost: Number(pb._sum.electricityCost || 0) + 
                 Number(pb._sum.gasCost || 0) + 
                 Number(pb._sum.waterCost || 0),
      carbonFootprint: Number(pb._sum.carbonFootprint || 0)
    }));

    // Calculate monthly trend (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const monthlyTrend = await db.energyMetric.groupBy({
      by: ['propertyId'],
      where: {
        tenantId,
        date: { gte: sixMonthsAgo }
      },
      _sum: {
        electricityKwh: true,
        electricityCost: true
      },
      _avg: {
        electricityKwh: true
      }
    });

    // Get metrics by day for charts
    const dailyMetrics = metrics.map(m => ({
      date: m.date.toISOString().split('T')[0],
      electricityKwh: Number(m.electricityKwh),
      gasM3: Number(m.gasM3),
      waterM3: Number(m.waterM3),
      totalCost: Number(m.electricityCost) + Number(m.gasCost) + Number(m.waterCost),
      carbonFootprint: Number(m.carbonFootprint),
      propertyName: m.property?.name || 'Unknown'
    }));

    // Calculate savings from historical comparison
    const previousMonthStart = new Date();
    previousMonthStart.setMonth(previousMonthStart.getMonth() - 2);
    const previousMonthEnd = new Date();
    previousMonthEnd.setMonth(previousMonthEnd.getMonth() - 1);

    const previousMonthMetrics = await db.energyMetric.findMany({
      where: {
        tenantId,
        date: {
          gte: previousMonthStart,
          lte: previousMonthEnd,
        }
      }
    });

    const previousTotalCost = previousMonthMetrics.reduce((sum: number, m) => 
      sum + Number(m.electricityCost) + Number(m.gasCost) + Number(m.waterCost), 0
    );
    const currentTotalCost = totals.electricityCost + totals.gasCost + totals.waterCost;
    const costSavings = previousTotalCost > 0 
      ? previousTotalCost - currentTotalCost 
      : 0;
    const percentChange = previousTotalCost > 0 
      ? ((currentTotalCost - previousTotalCost) / previousTotalCost) * 100 
      : 0;

    return NextResponse.json({
      metrics,
      dailyMetrics,
      totals: {
        ...totals,
        totalCost: totals.electricityCost + totals.gasCost + totals.waterCost,
      },
      dailyAvg,
      propertyBreakdown: formattedBreakdown,
      monthlyTrend: monthlyTrend.map(mt => ({
        propertyId: mt.propertyId,
        propertyName: propertyMap[mt.propertyId] || 'Unknown',
        totalKwh: Number(mt._sum.electricityKwh || 0),
        avgDailyKwh: Number(mt._avg.electricityKwh || 0)
      })),
      savings: {
        comparedToLastMonth: Math.round(percentChange * 10) / 10,
        costSavings: Math.round(costSavings * 100) / 100,
        carbonReduction: previousTotalCost > 0 && costSavings > 0
          ? Math.round((costSavings / (totals.electricityCost || 1)) * totals.carbonFootprint)
          : 0, // Calculated from proportional cost reduction
      }
    });
  } catch (error) {
    console.error('Error fetching energy metrics:', error);
    return NextResponse.json({ error: 'Failed to fetch energy metrics' }, { status: 500 });
  }
}

// POST /api/iot/energy - Create energy metric record
export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    // Permission check
    if (!hasPermission(user, 'iot.manage') && !hasPermission(user, 'energy.manage')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const data = await request.json();
    const {
      propertyId,
      date,
      electricityKwh = 0,
      gasM3 = 0,
      waterM3 = 0,
      electricityCost = 0,
      gasCost = 0,
      waterCost = 0,
      carbonFootprint = 0
    } = data;

    if (!propertyId || !date) {
      return NextResponse.json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Property ID and date are required' }
      }, { status: 400 });
    }

    // Verify property belongs to user's tenant
    const property = await db.property.findFirst({
      where: { id: propertyId, tenantId: user.tenantId, deletedAt: null },
    });

    if (!property) {
      return NextResponse.json({
        success: false,
        error: { code: 'INVALID_PROPERTY', message: 'Property not found' }
      }, { status: 400 });
    }

    // Validate numeric fields are non-negative
    if (electricityKwh < 0 || gasM3 < 0 || waterM3 < 0 || electricityCost < 0 || gasCost < 0 || waterCost < 0 || carbonFootprint < 0) {
      return NextResponse.json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Energy values must be non-negative' }
      }, { status: 400 });
    }

    const metric = await db.energyMetric.create({
      data: {
        tenantId: user.tenantId,
        propertyId,
        date: new Date(date),
        electricityKwh,
        gasM3,
        waterM3,
        electricityCost,
        gasCost,
        waterCost,
        carbonFootprint
      }
    });

    return NextResponse.json({ success: true, data: metric });
  } catch (error) {
    console.error('Error creating energy metric:', error);
    return NextResponse.json({ error: 'Failed to create energy metric' }, { status: 500 });
  }
}
