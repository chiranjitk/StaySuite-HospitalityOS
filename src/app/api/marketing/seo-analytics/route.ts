import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission } from '@/lib/auth/tenant-context';
import { subDays, format, eachDayOfInterval, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';

// GET /api/marketing/seo-analytics - SEO analytics with real database data
export async function GET(request: NextRequest) {
  try {
    const auth = await requirePermission(request, 'bookings.view');
    if (auth instanceof NextResponse) return auth;

    const searchParams = request.nextUrl.searchParams;
    const propertyId = searchParams.get('propertyId');
    const days = Math.min(parseInt(searchParams.get('days') || '30'), 365);
    const endDate = new Date();
    const startDate = subDays(endDate, days);

    // Build base where clause with tenant isolation
    const bookingWhere: Record<string, unknown> = {
      tenantId: auth.tenantId,
      deletedAt: null,
      status: { notIn: ['draft'] },
    };
    if (propertyId) bookingWhere.propertyId = propertyId;

    // ──────────────────────────────────────────────────────────
    // 1. Traffic Source Analysis (from booking sources)
    // ──────────────────────────────────────────────────────────
    const sourceCounts = await db.booking.groupBy({
      by: ['source'],
      where: {
        ...bookingWhere,
        createdAt: { gte: startDate, lte: endDate },
      },
      _count: { id: true },
      _sum: { totalAmount: true },
    });

    const directSources = ['direct', 'booking_engine', 'website', 'direct_booking'];
    const totalBookings = sourceCounts.reduce((acc, s) => acc + s._count.id, 0);
    const directBookings = sourceCounts
      .filter(s => directSources.includes(s.source))
      .reduce((acc, s) => acc + s._count.id, 0);
    const otaBookings = totalBookings - directBookings;
    const directRevenue = sourceCounts
      .filter(s => directSources.includes(s.source))
      .reduce((acc, s) => acc + (s._sum.totalAmount || 0), 0);
    const totalRevenue = sourceCounts.reduce((acc, s) => acc + (s._sum.totalAmount || 0), 0);

    // Traffic source distribution
    const trafficSources = sourceCounts.map(s => ({
      source: s.source,
      bookings: s._count.id,
      revenue: s._sum.totalAmount || 0,
      percentage: totalBookings > 0 ? Math.round((s._count.id / totalBookings) * 100) : 0,
    }));

    // ──────────────────────────────────────────────────────────
    // 2. Conversion Funnel
    // ──────────────────────────────────────────────────────────
    // We estimate page views from conversion rate benchmarks
    // Typical hotel booking conversion: 2-5%
    const conversionRate = directBookings > 0 && totalBookings > 0
      ? (directBookings / Math.max(totalBookings, 1)) * 100
      : 0;

    // Estimate: direct bookings / assumed conversion rate = page views
    const estimatedConversionRate = 0.035; // 3.5% industry average
    const estimatedPageViews = directBookings > 0
      ? Math.round(directBookings / estimatedConversionRate)
      : 0;

    const conversionFunnel = {
      pageViews: estimatedPageViews,
      searchQueries: Math.round(estimatedPageViews * 0.6), // ~60% of views come from search
      bookingAttempts: Math.round(estimatedPageViews * 0.12), // ~12% start booking
      completedBookings: directBookings,
      conversionRate: parseFloat((directBookings > 0 && estimatedPageViews > 0
        ? (directBookings / estimatedPageViews) * 100
        : 0).toFixed(1)),
    };

    // ──────────────────────────────────────────────────────────
    // 3. Booking Trend (daily for the period)
    // ──────────────────────────────────────────────────────────
    const dateRange = eachDayOfInterval({ start: startDate, end: endDate });

    const dailyBookings = await db.booking.findMany({
      where: {
        ...bookingWhere,
        createdAt: { gte: startDate, lte: endDate },
      },
      select: {
        createdAt: true,
        source: true,
        totalAmount: true,
      },
    });

    const bookingTrend = dateRange.map(date => {
      const dateStr = format(date, 'yyyy-MM-dd');
      const dayBookings = dailyBookings.filter(b =>
        format(new Date(b.createdAt), 'yyyy-MM-dd') === dateStr
      );

      return {
        date: dateStr,
        totalBookings: dayBookings.length,
        directBookings: dayBookings.filter(b => directSources.includes(b.source)).length,
        otaBookings: dayBookings.filter(b => !directSources.includes(b.source)).length,
        revenue: dayBookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0),
      };
    });

    // ──────────────────────────────────────────────────────────
    // 4. Monthly Comparison
    // ──────────────────────────────────────────────────────────
    const monthStart = startOfMonth(endDate);
    const lastMonthStart = startOfMonth(subDays(monthStart, 1));
    const lastMonthEnd = endOfMonth(lastMonthStart);

    const [currentMonthBookings, previousMonthBookings] = await Promise.all([
      db.booking.groupBy({
        by: ['source'],
        where: {
          ...bookingWhere,
          createdAt: { gte: monthStart, lte: endDate },
        },
        _count: { id: true },
        _sum: { totalAmount: true },
      }),
      db.booking.groupBy({
        by: ['source'],
        where: {
          ...bookingWhere,
          createdAt: { gte: lastMonthStart, lte: lastMonthEnd },
        },
        _count: { id: true },
        _sum: { totalAmount: true },
      }),
    ]);

    const currentMonthTotal = currentMonthBookings.reduce((acc, b) => acc + b._count.id, 0);
    const previousMonthTotal = previousMonthBookings.reduce((acc, b) => acc + b._count.id, 0);
    const currentMonthRevenue = currentMonthBookings.reduce((acc, b) => acc + (b._sum.totalAmount || 0), 0);
    const previousMonthRevenue = previousMonthBookings.reduce((acc, b) => acc + (b._sum.totalAmount || 0), 0);

    const monthlyComparison = {
      current: {
        month: format(monthStart, 'MMM yyyy'),
        bookings: currentMonthTotal,
        revenue: currentMonthRevenue,
        directBookings: currentMonthBookings
          .filter(b => directSources.includes(b.source))
          .reduce((acc, b) => acc + b._count.id, 0),
      },
      previous: {
        month: format(lastMonthStart, 'MMM yyyy'),
        bookings: previousMonthTotal,
        revenue: previousMonthRevenue,
        directBookings: previousMonthBookings
          .filter(b => directSources.includes(b.source))
          .reduce((acc, b) => acc + b._count.id, 0),
      },
      changes: {
        bookings: previousMonthTotal > 0
          ? parseFloat((((currentMonthTotal - previousMonthTotal) / previousMonthTotal) * 100).toFixed(1))
          : 0,
        revenue: previousMonthRevenue > 0
          ? parseFloat((((currentMonthRevenue - previousMonthRevenue) / previousMonthRevenue) * 100).toFixed(1))
          : 0,
      },
    };

    // ──────────────────────────────────────────────────────────
    // 5. Top Performing Channels
    // ──────────────────────────────────────────────────────────
    const channelPerformance = sourceCounts
      .map(s => ({
        channel: s.source,
        bookings: s._count.id,
        revenue: s._sum.totalAmount || 0,
        avgBookingValue: s._count.id > 0 ? Math.round((s._sum.totalAmount || 0) / s._count.id) : 0,
        isDirect: directSources.includes(s.source),
        commission: directSources.includes(s.source)
          ? 0
          : Math.round((s._sum.totalAmount || 0) * 0.20), // Estimate 20% OTA commission
      }))
      .sort((a, b) => b.revenue - a.revenue);

    // ──────────────────────────────────────────────────────────
    // 6. SEO Keywords (derived from property and room type names)
    // ──────────────────────────────────────────────────────────
    const propertyWhere: Record<string, unknown> = { tenantId: auth.tenantId, deletedAt: null };
    if (propertyId) propertyWhere.id = propertyId;

    const properties = await db.property.findMany({
      where: propertyWhere,
      select: {
        id: true,
        name: true,
        city: true,
        country: true,
        roomTypes: {
          where: { status: 'active' },
          select: { name: true, code: true },
        },
      },
    });

    // Generate SEO keyword suggestions based on property data
    const seoKeywords: Array<{ keyword: string; type: string; relevance: string }> = [];
    for (const prop of properties) {
      const cityName = prop.city;
      const countryName = prop.country;

      // Hotel-level keywords
      seoKeywords.push(
        { keyword: `hotel in ${cityName}`, type: 'brand', relevance: 'high' },
        { keyword: `${cityName} ${countryName} hotel`, type: 'location', relevance: 'high' },
        { keyword: `best hotel in ${cityName}`, type: 'competitive', relevance: 'medium' },
        { keyword: `${cityName} hotel booking`, type: 'transactional', relevance: 'high' },
        { keyword: `hotels near ${cityName} city center`, type: 'location', relevance: 'medium' },
      );

      // Room-type keywords
      for (const rt of prop.roomTypes) {
        seoKeywords.push(
          { keyword: `${rt.name} ${cityName}`, type: 'room', relevance: 'high' },
          { keyword: `${rt.name} hotel room ${cityName}`, type: 'room', relevance: 'medium' },
        );
      }
    }

    // ──────────────────────────────────────────────────────────
    // 7. OTA Savings Analysis
    // ──────────────────────────────────────────────────────────
    const otaRevenue = sourceCounts
      .filter(s => !directSources.includes(s.source))
      .reduce((acc, s) => acc + (s._sum.totalAmount || 0), 0);
    const estimatedOtaCommission = otaRevenue * 0.20;
    const directSavings = directRevenue > 0
      ? Math.round(directRevenue * 0.20) // What would have been paid as commission
      : 0;

    // ──────────────────────────────────────────────────────────
    // 8. Review Impact (from GuestReview)
    // ──────────────────────────────────────────────────────────
    const reviewPropertyIds = propertyId
      ? [propertyId]
      : properties.map(p => p.id);

    const reviewStats = reviewPropertyIds.length > 0
      ? await db.guestReview.aggregate({
          where: { propertyId: { in: reviewPropertyIds } },
          _count: { id: true },
          _avg: { overallRating: true },
        })
      : { _count: { id: 0 }, _avg: { overallRating: null } };

    // ──────────────────────────────────────────────────────────
    // 9. Summary Statistics
    // ──────────────────────────────────────────────────────────
    const summary = {
      totalBookings,
      directBookings,
      otaBookings,
      totalRevenue,
      directRevenue,
      otaRevenue,
      directBookingShare: totalBookings > 0
        ? parseFloat(((directBookings / totalBookings) * 100).toFixed(1))
        : 0,
      estimatedOtaCommission: Math.round(estimatedOtaCommission),
      directSavings,
      avgBookingValue: totalBookings > 0 ? Math.round(totalRevenue / totalBookings) : 0,
      totalReviews: reviewStats._count.id,
      avgReviewRating: reviewStats._avg.overallRating
        ? parseFloat(reviewStats._avg.overallRating.toFixed(1))
        : 0,
    };

    return NextResponse.json({
      success: true,
      data: {
        summary,
        trafficSources,
        conversionFunnel,
        bookingTrend,
        monthlyComparison,
        channelPerformance,
        seoKeywords: seoKeywords.slice(0, 20), // Limit to top 20
        period: {
          startDate: format(startDate, 'yyyy-MM-dd'),
          endDate: format(endDate, 'yyyy-MM-dd'),
          days,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching SEO analytics:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch SEO analytics' } },
      { status: 500 }
    );
  }
}
