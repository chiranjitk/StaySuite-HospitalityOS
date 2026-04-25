import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hasPermission, getUserFromRequest } from '@/lib/auth-helpers';
import { format, subDays, eachDayOfInterval } from 'date-fns';

// GET /api/revenue/competitor-pricing - Get competitor pricing data
export async function GET(request: NextRequest) {    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 });
    }


  try {
    if (!hasPermission(user, 'revenue:read')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;
    const searchParams = request.nextUrl.searchParams;
    const roomType = searchParams.get('roomType') || 'standard';
    const dateStr = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const date = new Date(dateStr);

    // Get our rate plans and prices
    const ratePlans = await db.ratePlan.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        roomType: { select: { name: true, code: true, id: true } },
      },
    });

    const ourRate = ratePlans.find(rp =>
      rp.roomType?.code?.toLowerCase() === roomType.toLowerCase()
    ) || ratePlans[0];

    const ourPrice = ourRate?.basePrice || 0;

    // Get competitor prices for the selected date
    const competitorPrices = await db.competitorPrice.findMany({
      where: {
        tenantId,
        date: {
          gte: new Date(dateStr),
          lt: new Date(new Date(dateStr).getTime() + 24 * 60 * 60 * 1000),
        },
      },
      orderBy: { competitorName: 'asc' },
    });

    // Group competitors and calculate averages
    const competitorMap = new Map<string, {
      id: string;
      name: string;
      type: 'direct' | 'indirect';
      rating: number;
      prices: number[];
      lastUpdated: string;
    }>();

    for (const cp of competitorPrices) {
      const existing = competitorMap.get(cp.competitorName);
      if (existing) {
        existing.prices.push(cp.price);
      } else {
        competitorMap.set(cp.competitorName, {
          id: cp.id,
          name: cp.competitorName,
          type: cp.competitorType as 'direct' | 'indirect',
          rating: cp.rating || 0,
          prices: [cp.price],
          lastUpdated: cp.updatedAt.toISOString(),
        });
      }
    }

    // Convert to array and calculate averages
    const competitors = Array.from(competitorMap.values()).map(c => ({
      id: c.id,
      name: c.name,
      type: c.type,
      rating: c.rating,
      distance: 0, // Would need location data
      priceIndex: ourPrice > 0 ? Math.round((c.prices.reduce((a, b) => a + b, 0) / c.prices.length / ourPrice) * 100) : 100,
      avgPrice: Math.round(c.prices.reduce((a, b) => a + b, 0) / c.prices.length),
      lastUpdated: c.lastUpdated,
    }));

    // Get historical price data for the last 14 days
    const startDate = subDays(new Date(), 13);
    const endDate = new Date();
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    // Get our price overrides for the period
    const priceOverrides = await db.priceOverride.findMany({
      where: {
        ratePlan: { tenantId },
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    // Get competitor prices for the period
    const historicalCompetitorPrices = await db.competitorPrice.findMany({
      where: {
        tenantId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    // Build price history
    const priceHistory = days.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');

      // Our price for this day (override or base)
      const override = priceOverrides.find(po =>
        format(po.date, 'yyyy-MM-dd') === dayStr && po.ratePlanId === ourRate?.id
      );
      const ourDayPrice = override?.price || ourPrice;

      // Competitor prices for this day
      const dayCompetitorPrices = historicalCompetitorPrices.filter(cp =>
        format(cp.date, 'yyyy-MM-dd') === dayStr
      );

      const competitorAvg = dayCompetitorPrices.length > 0
        ? dayCompetitorPrices.reduce((sum, cp) => sum + cp.price, 0) / dayCompetitorPrices.length
        : ourDayPrice * 0.95; // Fallback if no data

      const minPrice = dayCompetitorPrices.length > 0
        ? Math.min(...dayCompetitorPrices.map(cp => cp.price))
        : ourDayPrice * 0.8;

      const maxPrice = dayCompetitorPrices.length > 0
        ? Math.max(...dayCompetitorPrices.map(cp => cp.price))
        : ourDayPrice * 1.2;

      return {
        date: dayStr,
        ourPrice: ourDayPrice,
        marketAverage: Math.round(competitorAvg * 100) / 100,
        minPrice: Math.round(minPrice * 100) / 100,
        maxPrice: Math.round(maxPrice * 100) / 100,
      };
    });

    // Calculate market position
    const marketAvg = competitors.length > 0
      ? competitors.reduce((sum, c) => sum + c.avgPrice, 0) / competitors.length
      : ourPrice * 0.95;

    const priceDiff = marketAvg > 0 ? ((ourPrice - marketAvg) / marketAvg) * 100 : 0;
    const marketPosition = priceDiff > 5 ? 'above' : priceDiff < -5 ? 'below' : 'at';

    // Generate recommendation based on data
    let recommendedAction = 'Your pricing is competitive with the market.';
    if (competitors.length === 0) {
      recommendedAction = 'No competitor data available. Add competitors to enable pricing recommendations.';
    } else if (priceDiff > 10) {
      recommendedAction = 'Consider a slight price reduction of 5-8% to improve competitiveness while maintaining margin.';
    } else if (priceDiff < -10) {
      recommendedAction = 'Opportunity to increase rates by 5-10% while remaining competitive.';
    }

    return NextResponse.json({
      success: true,
      data: {
        competitors,
        priceHistory,
        ourPrice,
        marketPosition,
        priceDifference: Math.round(priceDiff * 10) / 10,
        recommendedAction,
        hasCompetitorData: competitors.length > 0,
      },
    });
  } catch (error) {
    console.error('Error fetching competitor pricing:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch competitor pricing' } },
      { status: 500 }
    );
  }
}

// POST /api/revenue/competitor-pricing - Add competitor price entry
export async function POST(request: NextRequest) {    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 });
    }


  try {
    if (!hasPermission(user, 'revenue:write')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;
    const body = await request.json();
    const {
      propertyId,
      roomTypeId,
      competitorName,
      competitorType = 'direct',
      competitorUrl,
      rating,
      date,
      price,
      currency = 'USD',
      roomTypeName,
      ratePlanName,
      source = 'manual',
    } = body;

    // Validate required fields
    if (!propertyId || !competitorName || !date || price === undefined) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Property ID, competitor name, date, and price are required' } },
        { status: 400 }
      );
    }

    if (price < 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Price cannot be negative' } },
        { status: 400 }
      );
    }

    // Validate competitor type
    if (competitorType !== 'direct' && competitorType !== 'indirect') {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Competitor type must be "direct" or "indirect"' } },
        { status: 400 }
      );
    }

    // Validate rating if provided
    if (rating !== undefined && (rating < 0 || rating > 5)) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Rating must be between 0 and 5' } },
        { status: 400 }
      );
    }

    const competitorPrice = await db.competitorPrice.create({
      data: {
        tenantId,
        propertyId,
        roomTypeId,
        competitorName,
        competitorType,
        competitorUrl,
        rating,
        date: new Date(date),
        price,
        currency,
        roomTypeName,
        ratePlanName,
        source,
      },
    });

    return NextResponse.json({
      success: true,
      data: competitorPrice,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating competitor price:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to create competitor price' } },
      { status: 500 }
    );
  }
}

// DELETE /api/revenue/competitor-pricing - Delete competitor price entries
export async function DELETE(request: NextRequest) {    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } }, { status: 401 });
    }


  try {
    if (!hasPermission(user, 'revenue:write')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 }
      );
    }

    const tenantId = user.tenantId;
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    const competitorName = searchParams.get('competitorName');

    if (!id && !competitorName) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Either ID or competitor name is required' } },
        { status: 400 }
      );
    }

    if (id) {
      // Delete specific entry
      const existing = await db.competitorPrice.findFirst({
        where: { id, tenantId },
      });

      if (!existing) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Competitor price entry not found' } },
          { status: 404 }
        );
      }

      await db.competitorPrice.delete({
        where: { id },
      });
    } else {
      // Delete all entries for a competitor
      const result = await db.competitorPrice.deleteMany({
        where: { tenantId, competitorName: competitorName! },
      });

      return NextResponse.json({
        success: true,
        message: `Deleted ${result.count} competitor price entries`,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Competitor price entry deleted',
    });
  } catch (error) {
    console.error('Error deleting competitor price:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete competitor price' } },
      { status: 500 }
    );
  }
}
