import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { subDays, eachDayOfInterval, format } from 'date-fns';
import { getUserFromRequest, hasPermission } from '@/lib/auth-helpers';

// GET - Fetch performance data
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const tenantId = user.tenantId;
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');
    const campaignId = searchParams.get('campaign') || '';
    const roi = searchParams.get('roi') === 'true';

    // Limit days to prevent excessive data retrieval
    const maxDays = 365;
    const effectiveDays = Math.min(days, maxDays);

    // Calculate date range
    const endDate = new Date();
    const startDate = subDays(endDate, effectiveDays);

    // Build where clause for campaigns
    const campaignWhere: Record<string, unknown> = { tenantId };
    if (campaignId && campaignId !== 'all') {
      if (campaignId === 'google' || campaignId === 'meta' || campaignId === 'tripadvisor') {
        campaignWhere.platform = campaignId;
      } else {
        campaignWhere.id = campaignId;
      }
    }

    // Get campaigns
    const campaigns = await db.adCampaign.findMany({
      where: campaignWhere,
      include: {
        performance: {
          where: {
            date: {
              gte: startDate,
              lte: endDate,
            },
          },
          orderBy: { date: 'asc' },
        },
      },
    });

    // Generate date range for filling gaps
    const dateRange = eachDayOfInterval({ start: startDate, end: endDate });

    // Aggregate performance by date
    const performanceByDate = dateRange.map(date => {
      const dateStr = format(date, 'yyyy-MM-dd');
      const dayData = campaigns.flatMap(c => c.performance).filter(p => 
        format(new Date(p.date), 'yyyy-MM-dd') === dateStr
      );

      return {
        date: dateStr,
        impressions: dayData.reduce((sum, p) => sum + p.impressions, 0),
        clicks: dayData.reduce((sum, p) => sum + p.clicks, 0),
        conversions: dayData.reduce((sum, p) => sum + p.conversions, 0),
        cost: dayData.reduce((sum, p) => sum + p.cost, 0),
        revenue: dayData.reduce((sum, p) => sum + p.revenue, 0),
        ctr: 0,
        cpc: 0,
        cpa: 0,
        roas: 0,
        conversionRate: 0,
      };
    }).map(d => ({
      ...d,
      ctr: d.clicks > 0 ? (d.clicks / d.impressions) * 100 : 0,
      cpc: d.clicks > 0 ? d.cost / d.clicks : 0,
      cpa: d.conversions > 0 ? d.cost / d.conversions : 0,
      roas: d.cost > 0 ? d.revenue / d.cost : 0,
      conversionRate: d.clicks > 0 ? (d.conversions / d.clicks) * 100 : 0,
    }));

    // Calculate summary
    const summary = {
      totalImpressions: performanceByDate.reduce((sum, d) => sum + d.impressions, 0),
      totalClicks: performanceByDate.reduce((sum, d) => sum + d.clicks, 0),
      totalConversions: performanceByDate.reduce((sum, d) => sum + d.conversions, 0),
      totalCost: performanceByDate.reduce((sum, d) => sum + d.cost, 0),
      totalRevenue: performanceByDate.reduce((sum, d) => sum + d.revenue, 0),
      avgCtr: 0,
      avgCpc: 0,
      avgCpa: 0,
      avgRoas: 0,
      avgConversionRate: 0,
      // Changes - calculated from actual data
      impressionsChange: 0,
      clicksChange: 0,
      conversionsChange: 0,
      costChange: 0,
      revenueChange: 0,
    };

    summary.avgCtr = summary.totalClicks > 0 
      ? (summary.totalClicks / summary.totalImpressions) * 100 
      : 0;
    summary.avgCpc = summary.totalClicks > 0 
      ? summary.totalCost / summary.totalClicks 
      : 0;
    summary.avgCpa = summary.totalConversions > 0 
      ? summary.totalCost / summary.totalConversions 
      : 0;
    summary.avgRoas = summary.totalCost > 0 
      ? summary.totalRevenue / summary.totalCost 
      : 0;
    summary.avgConversionRate = summary.totalClicks > 0 
      ? (summary.totalConversions / summary.totalClicks) * 100 
      : 0;

    // Calculate period-over-period changes
    const halfLength = Math.floor(performanceByDate.length / 2);
    if (halfLength > 0) {
      const firstHalf = performanceByDate.slice(0, halfLength);
      const secondHalf = performanceByDate.slice(halfLength);

      const firstImpressions = firstHalf.reduce((sum, d) => sum + d.impressions, 0);
      const secondImpressions = secondHalf.reduce((sum, d) => sum + d.impressions, 0);
      summary.impressionsChange = firstImpressions > 0 
        ? ((secondImpressions - firstImpressions) / firstImpressions) * 100 
        : 0;

      const firstClicks = firstHalf.reduce((sum, d) => sum + d.clicks, 0);
      const secondClicks = secondHalf.reduce((sum, d) => sum + d.clicks, 0);
      summary.clicksChange = firstClicks > 0 
        ? ((secondClicks - firstClicks) / firstClicks) * 100 
        : 0;

      const firstConversions = firstHalf.reduce((sum, d) => sum + d.conversions, 0);
      const secondConversions = secondHalf.reduce((sum, d) => sum + d.conversions, 0);
      summary.conversionsChange = firstConversions > 0 
        ? ((secondConversions - firstConversions) / firstConversions) * 100 
        : 0;

      const firstCost = firstHalf.reduce((sum, d) => sum + d.cost, 0);
      const secondCost = secondHalf.reduce((sum, d) => sum + d.cost, 0);
      summary.costChange = firstCost > 0 
        ? ((secondCost - firstCost) / firstCost) * 100 
        : 0;

      const firstRevenue = firstHalf.reduce((sum, d) => sum + d.revenue, 0);
      const secondRevenue = secondHalf.reduce((sum, d) => sum + d.revenue, 0);
      summary.revenueChange = firstRevenue > 0 
        ? ((secondRevenue - firstRevenue) / firstRevenue) * 100 
        : 0;
    }

    // Conversion by source - calculated from actual campaigns
    const conversions = campaigns.map(c => ({
      source: c.platform,
      conversions: c.performance.reduce((sum, p) => sum + p.conversions, 0),
      revenue: c.performance.reduce((sum, p) => sum + p.revenue, 0),
      cost: c.performance.reduce((sum, p) => sum + p.cost, 0),
    }));

    // ROI specific data
    if (roi) {
      const roiData = performanceByDate.map(d => ({
        date: d.date,
        spend: d.cost,
        revenue: d.revenue,
        roas: d.roas,
        profit: d.revenue - d.cost,
      }));

      const roiSummary = {
        totalSpend: summary.totalCost,
        totalRevenue: summary.totalRevenue,
        totalProfit: summary.totalRevenue - summary.totalCost,
        avgRoas: summary.avgRoas,
        avgCpa: summary.avgCpa,
        spendChange: summary.costChange,
        revenueChange: summary.revenueChange,
        roasChange: 0, // Calculate from actual data
      };

      // Calculate ROAS change
      if (halfLength > 0) {
        const firstHalf = performanceByDate.slice(0, halfLength);
        const secondHalf = performanceByDate.slice(halfLength);

        const firstRoas = firstHalf.reduce((sum, d) => sum + d.revenue, 0) / 
          (firstHalf.reduce((sum, d) => sum + d.cost, 0) || 1);
        const secondRoas = secondHalf.reduce((sum, d) => sum + d.revenue, 0) / 
          (secondHalf.reduce((sum, d) => sum + d.cost, 0) || 1);

        roiSummary.roasChange = firstRoas > 0 
          ? ((secondRoas - firstRoas) / firstRoas) * 100 
          : 0;
      }

      // Channels from actual campaign data
      const channels = campaigns.map(c => ({
        channel: c.platform,
        spend: c.performance.reduce((sum, p) => sum + p.cost, 0),
        revenue: c.performance.reduce((sum, p) => sum + p.revenue, 0),
        roas: c.roas,
        conversions: c.performance.reduce((sum, p) => sum + p.conversions, 0),
        percentage: summary.totalConversions > 0 
          ? (c.performance.reduce((sum, p) => sum + p.conversions, 0) / summary.totalConversions) * 100 
          : 0,
      }));

      // Generate insights from actual data
      const insights: Array<{
        type: 'positive' | 'negative' | 'neutral';
        title: string;
        description: string;
        value: number;
        trend: string;
      }> = [];

      if (summary.revenueChange > 5) {
        insights.push({
          type: 'positive',
          title: 'Revenue Growth',
          description: 'Revenue has increased over the comparison period',
          value: summary.revenueChange,
          trend: 'Growing',
        });
      }

      if (summary.revenueChange < -5) {
        insights.push({
          type: 'negative',
          title: 'Revenue Decline',
          description: 'Revenue has decreased over the comparison period',
          value: summary.revenueChange,
          trend: 'Needs Attention',
        });
      }

      if (summary.avgRoas > 2) {
        insights.push({
          type: 'positive',
          title: 'Strong ROAS',
          description: 'Return on ad spend is above the typical benchmark of 2.0',
          value: summary.avgRoas,
          trend: 'Above Target',
        });
      }

      if (summary.costChange > 10 && summary.conversionsChange < 0) {
        insights.push({
          type: 'negative',
          title: 'Cost Increase',
          description: 'Ad spend increased while conversions decreased',
          value: summary.costChange,
          trend: 'Needs Attention',
        });
      }

      return NextResponse.json({
        success: true,
        data: {
          performance: performanceByDate,
          summary,
          conversions,
          roi: roiData,
          roiSummary,
          channels,
          insights,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        performance: performanceByDate,
        summary,
        conversions,
      },
    });
  } catch (error) {
    console.error('Error fetching performance data:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch performance data' } },
      { status: 500 }
    );
  }
}
