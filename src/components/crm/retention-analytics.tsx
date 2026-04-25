'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useTimezone } from '@/contexts/TimezoneContext';
import { 
  TrendingUp, TrendingDown, Users, UserPlus, UserMinus, RefreshCw,
  Calendar, Star, DollarSign, Target, AlertTriangle, CheckCircle,
  BarChart3, PieChart, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { useUIStore } from '@/store';

interface RetentionMetric {
  label: string;
  value: number;
  change: number | null;
  trend: 'up' | 'down' | 'neutral';
}

interface AtRiskGuest {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  lastStay: string | null;
  totalStays: number;
  totalSpent: number;
  loyaltyTier: string;
  riskScore: number;
  riskFactors: string[];
}

interface LifetimeValue {
  tier: string;
  avgLTV: number;
  avgStays: number;
  avgSpend: number;
  memberCount: number;
}

interface CohortData {
  month: string;
  newGuests: number;
  retained: number[];
  retentionRate: number;
}

interface FunnelData {
  label: string;
  percentage: number;
  count: number;
}

interface InsightData {
  label: string;
  description: string;
  value: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  valueColor: string;
}

interface GuestRecord {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  totalStays: number;
  totalSpent: number;
  loyaltyTier: string;
  createdAt: string;
  [key: string]: unknown;
}

export default function RetentionAnalytics() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<RetentionMetric[]>([]);
  const [cohortData, setCohortData] = useState<CohortData[]>([]);
  const [atRiskGuests, setAtRiskGuests] = useState<AtRiskGuest[]>([]);
  const [lifetimeValues, setLifetimeValues] = useState<LifetimeValue[]>([]);
  const [funnelData, setFunnelData] = useState<FunnelData[]>([]);
  const [insightData, setInsightData] = useState<InsightData[]>([]);
  const { formatCurrency } = useCurrency();
  const { formatDate } = useTimezone();

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      
      // Fetch guests data for analytics
      const guestsResponse = await fetch('/api/guests');
      const guestsData = await guestsResponse.json();

      // Safely extract guests array
      const guests: GuestRecord[] = guestsData?.data?.guests || guestsData?.guests || [];
      
      if (guestsData.success || guests.length > 0) {
        // Calculate metrics from real data
        const totalGuests = guests.length;
        const repeatGuests = guests.filter((g) => g.totalStays > 1).length;
        const retentionRate = totalGuests > 0 ? Math.round((repeatGuests / totalGuests) * 100) : 0;
        
        const avgSpent = guests.length > 0
          ? guests.reduce((acc, g) => acc + (g.totalSpent || 0), 0) / guests.length
          : 0;

        // change values are null because we have no historical comparison data
        setMetrics([
          {
            label: 'Retention Rate',
            value: retentionRate,
            change: null,
            trend: 'neutral',
          },
          {
            label: 'Repeat Guests',
            value: repeatGuests,
            change: null,
            trend: 'neutral',
          },
          {
            label: 'Avg. Guest Value',
            value: Math.round(avgSpent),
            change: null,
            trend: 'neutral',
          },
          {
            label: 'Churn Rate',
            value: 100 - retentionRate,
            change: null,
            trend: 'neutral',
          },
        ]);

        // Calculate LTV by tier
        const tierGroups: Record<string, { count: number; totalSpent: number; totalStays: number }> = {};
        guests.forEach((g) => {
          const tier = g.loyaltyTier || 'bronze';
          if (!tierGroups[tier]) {
            tierGroups[tier] = { count: 0, totalSpent: 0, totalStays: 0 };
          }
          tierGroups[tier].count++;
          tierGroups[tier].totalSpent += g.totalSpent || 0;
          tierGroups[tier].totalStays += g.totalStays || 0;
        });

        const ltvData: LifetimeValue[] = Object.entries(tierGroups).map(([tier, data]) => ({
          tier,
          avgLTV: data.count > 0 ? Math.round(data.totalSpent / data.count) : 0,
          avgStays: data.count > 0 ? Math.round(data.totalStays / data.count * 10) / 10 : 0,
          avgSpend: data.count > 0 ? Math.round(data.totalSpent / data.count) : 0,
          memberCount: data.count,
        }));

        setLifetimeValues(ltvData);

        // Calculate at-risk guests based on real data
        // Risk factors derived from actual guest patterns
        const avgTotalSpent = guests.length > 0
          ? guests.reduce((acc, g) => acc + (g.totalSpent || 0), 0) / guests.length
          : 0;

        const atRisk: AtRiskGuest[] = guests
          .filter((g) => g.totalStays > 0)
          .map((g) => {
            // Calculate risk score from real data
            const spendRatio = avgTotalSpent > 0 ? (g.totalSpent || 0) / avgTotalSpent : 1;
            let riskScore = 0;

            // Single-stay guests are higher risk
            if (g.totalStays === 1) riskScore += 40;
            else if (g.totalStays === 2) riskScore += 20;

            // Below-average spend is a risk signal
            if (spendRatio < 0.5) riskScore += 30;
            else if (spendRatio < 0.8) riskScore += 15;

            // Days since registration (proxy for recency)
            const daysSinceCreation = Math.floor(
              (Date.now() - new Date(g.createdAt).getTime()) / (1000 * 60 * 60 * 24)
            );
            if (daysSinceCreation > 90 && g.totalStays <= 2) riskScore += 20;
            else if (daysSinceCreation > 180 && g.totalStays <= 3) riskScore += 15;

            riskScore = Math.min(100, Math.max(0, riskScore));

            // Derive risk factors from real data
            const factors: string[] = [];
            if (g.totalStays === 1) factors.push('Single-visit guest');
            if (spendRatio < 0.5) factors.push('Below-average spending');
            if (daysSinceCreation > 90 && g.totalStays <= 2) factors.push('No recent activity');
            if (daysSinceCreation > 180) factors.push('Long inactive period');

            return {
              id: g.id,
              firstName: g.firstName,
              lastName: g.lastName,
              email: g.email,
              // We don't have lastStay from the list API — show N/A
              lastStay: null,
              totalStays: g.totalStays,
              totalSpent: g.totalSpent || 0,
              loyaltyTier: g.loyaltyTier || 'bronze',
              riskScore,
              riskFactors: factors.length > 0 ? factors : ['Monitoring'],
            };
          })
          .filter((g) => g.riskScore >= 40) // Only show guests with meaningful risk
          .sort((a, b) => b.riskScore - a.riskScore)
          .slice(0, 10);
        
        setAtRiskGuests(atRisk);

        // Build cohort data from real guest creation dates
        const monthBuckets: Record<string, { count: number; guests: GuestRecord[] }> = {};
        guests.forEach((g) => {
          const created = new Date(g.createdAt);
          const key = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}`;
          if (!monthBuckets[key]) {
            monthBuckets[key] = { count: 0, guests: [] };
          }
          monthBuckets[key].count++;
          monthBuckets[key].guests.push(g);
        });

        const sortedMonths = Object.keys(monthBuckets).sort().slice(-6);
        
        if (sortedMonths.length === 0) {
          setCohortData([]);
        } else {
          // Calculate actual retention: what % of each cohort has totalStays > 1 (returned)
          // Since we don't have month-by-month booking data, retention rate = % of cohort with 2+ stays
          const cohorts: CohortData[] = sortedMonths.map((key) => {
            const bucket = monthBuckets[key];
            const returnedGuests = bucket.guests.filter((g) => g.totalStays > 1).length;
            const retentionRate = bucket.count > 0 ? Math.round((returnedGuests / bucket.count) * 100) : 0;

            const [year, month] = key.split('-');
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const label = `${monthNames[parseInt(month) - 1]} ${year}`;

            return {
              month: label,
              newGuests: bucket.count,
              retained: [100, retentionRate], // Month 1 = 100%, subsequent = actual retention
              retentionRate,
            };
          });
          setCohortData(cohorts);
        }

        // Calculate funnel data from real guest stay counts
        if (totalGuests > 0) {
          const singleStay = guests.filter((g) => g.totalStays >= 1).length;
          const twoPlus = guests.filter((g) => g.totalStays >= 2).length;
          const threePlus = guests.filter((g) => g.totalStays >= 3).length;
          const fivePlus = guests.filter((g) => g.totalStays >= 5).length;

          setFunnelData([
            {
              label: 'First-time Guests',
              percentage: singleStay > 0 ? Math.round((singleStay / totalGuests) * 100) : 0,
              count: singleStay,
            },
            {
              label: 'Returned (2+ stays)',
              percentage: singleStay > 0 ? Math.round((twoPlus / singleStay) * 100) : 0,
              count: twoPlus,
            },
            {
              label: 'Loyal (3+ stays)',
              percentage: singleStay > 0 ? Math.round((threePlus / singleStay) * 100) : 0,
              count: threePlus,
            },
            {
              label: 'Advocates (5+ stays)',
              percentage: singleStay > 0 ? Math.round((fivePlus / singleStay) * 100) : 0,
              count: fivePlus,
            },
          ]);
        } else {
          setFunnelData([]);
        }

        // Calculate insights from real data
        const insights: InsightData[] = [];

        // Repeat guest rate insight
        if (totalGuests > 0) {
          insights.push({
            label: 'Repeat Guest Rate',
            description: 'Guests who returned for 2+ stays',
            value: `${retentionRate}%`,
            icon: CheckCircle,
            iconBg: 'bg-emerald-100 dark:bg-emerald-900',
            iconColor: 'text-emerald-600 dark:text-emerald-400',
            valueColor: 'text-emerald-600 dark:text-emerald-400',
          });
        }

        // Loyalty member breakdown
        const loyaltyMembers = guests.filter((g) => {
          const tier = (g.loyaltyTier || 'bronze').toLowerCase();
          return tier !== 'bronze';
        }).length;
        if (totalGuests > 0) {
          const loyaltyRate = Math.round((loyaltyMembers / totalGuests) * 100);
          insights.push({
            label: 'Loyalty Program',
            description: `${loyaltyMembers} members enrolled (${loyaltyRate}%)`,
            value: loyaltyMembers > 0 ? `${loyaltyRate}% enrolled` : 'No members',
            icon: Star,
            iconBg: 'bg-amber-100 dark:bg-amber-900',
            iconColor: 'text-amber-600 dark:text-amber-400',
            valueColor: 'text-amber-600 dark:text-amber-400',
          });
        }

        // Average spend insight
        if (totalGuests > 0) {
          insights.push({
            label: 'Average Guest Spend',
            description: `Across ${totalGuests} guests`,
            value: formatCurrency(Math.round(avgSpent)),
            icon: RefreshCw,
            iconBg: 'bg-cyan-100 dark:bg-cyan-900',
            iconColor: 'text-cyan-600 dark:text-cyan-400',
            valueColor: 'text-cyan-600 dark:text-cyan-400',
          });
        }

        setInsightData(insights);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error('Failed to fetch analytics');
    } finally {
      setLoading(false);
    }
  };

  const getTierColor = (tier: string) => {
    const colors: Record<string, string> = {
      bronze: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
      silver: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
      gold: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
      platinum: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
    };
    return colors[tier.toLowerCase()] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
  };

  const getRiskColor = (score: number) => {
    if (score >= 80) return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900';
    if (score >= 60) return 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900';
    return 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900';
  };

  const getCohortColor = (value: number) => {
    if (value >= 70) return 'bg-emerald-500';
    if (value >= 50) return 'bg-amber-500';
    if (value >= 30) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Retention Analytics</h1>
        <p className="text-muted-foreground">
          Monitor guest retention, lifetime value, and identify at-risk guests
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        {metrics.map((metric, index) => (
          <Card key={index}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{metric.label}</p>
                  <p className="text-2xl font-bold">
                    {metric.label.includes('Rate') ? `${metric.value}%` : metric.value.toLocaleString()}
                  </p>
                </div>
                {metric.change !== null ? (
                  <div className={`flex items-center gap-1 text-sm ${
                    metric.trend === 'up' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                  }`}>
                    {metric.trend === 'up' ? (
                      <TrendingUp className="h-4 w-4" />
                    ) : (
                      <TrendingDown className="h-4 w-4" />
                    )}
                    {Math.abs(metric.change)}%
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground/50">
                    <Calendar className="h-4 w-4" />
                    <span>current</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="cohorts">Cohort Analysis</TabsTrigger>
          <TabsTrigger value="atrisk">At-Risk Guests</TabsTrigger>
          <TabsTrigger value="ltv">Lifetime Value</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
            {/* Retention Funnel */}
            <Card>
              <CardHeader>
                <CardTitle>Guest Journey Funnel</CardTitle>
                <CardDescription>Conversion through guest lifecycle stages</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {loading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : funnelData.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <PieChart className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                    <p className="text-sm">No guest data available for funnel analysis</p>
                  </div>
                ) : (
                  funnelData.map((stage, i) => (
                    <div key={i} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>{stage.label}</span>
                        <span className="font-medium">{stage.percentage}% <span className="text-muted-foreground font-normal">({stage.count})</span></span>
                      </div>
                      <Progress
                        value={stage.percentage}
                        className={cn(
                          'h-3',
                          i === 0 ? 'bg-emerald-100' : i === 1 ? '' : i === 2 ? 'bg-amber-500' : 'bg-purple-500'
                        )}
                      />
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Retention Insights */}
            <Card>
              <CardHeader>
                <CardTitle>Retention Insights</CardTitle>
                <CardDescription>Key metrics derived from guest data</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {loading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : insightData.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <BarChart3 className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                    <p className="text-sm">Insights require guest data</p>
                  </div>
                ) : (
                  insightData.map((insight, i) => {
                    const Icon = insight.icon;
                    return (
                      <div key={i} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className={cn('rounded-full p-2', insight.iconBg)}>
                            <Icon className={cn('h-4 w-4', insight.iconColor)} />
                          </div>
                          <div>
                            <p className="font-medium">{insight.label}</p>
                            <p className="text-sm text-muted-foreground">{insight.description}</p>
                          </div>
                        </div>
                        <span className={cn('font-bold text-sm', insight.valueColor)}>{insight.value}</span>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Retention Activity</CardTitle>
              <CardDescription>Current guest retention metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
                <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-950 rounded-lg">
                  <UserPlus className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <p className="font-bold text-2xl">{metrics.find(m => m.label === 'Repeat Guests')?.value || 0}</p>
                    <p className="text-sm text-muted-foreground">Total repeat guests</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-950 rounded-lg">
                  <Target className="h-8 w-8 text-amber-600 dark:text-amber-400" />
                  <div>
                    <p className="font-bold text-2xl">{metrics.find(m => m.label === 'Retention Rate')?.value || 0}%</p>
                    <p className="text-sm text-muted-foreground">Overall retention rate</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-950 rounded-lg">
                  <UserMinus className="h-8 w-8 text-red-600 dark:text-red-400" />
                  <div>
                    <p className="font-bold text-2xl">{metrics.find(m => m.label === 'Churn Rate')?.value || 0}%</p>
                    <p className="text-sm text-muted-foreground">Overall churn rate</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cohort Analysis Tab */}
        <TabsContent value="cohorts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Cohort Retention Analysis</CardTitle>
              <CardDescription>Track guest retention by acquisition month</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : cohortData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <Calendar className="h-10 w-10 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground font-medium">Cohort analysis requires historical data</p>
                  <p className="text-xs text-muted-foreground/60 text-center max-w-[300px]">
                    Guests with multiple stays across different months are needed to calculate cohort retention.
                    This view will populate as your guest database grows.
                  </p>
                </div>
              ) : (
                <ScrollArea className="w-full">
                  <div className="min-w-[600px]">
                    {/* Header */}
                    <div className="grid grid-cols-7 gap-2 mb-2 text-sm font-medium text-muted-foreground">
                      <div>Cohort</div>
                      <div>Month 1</div>
                      <div>Month 2</div>
                      <div>Month 3</div>
                      <div>Month 4</div>
                      <div>Month 5</div>
                      <div>Rate</div>
                    </div>
                    
                    {/* Rows */}
                    {cohortData.map((cohort, index) => (
                      <div key={index} className="grid grid-cols-7 gap-2 mb-2">
                        <div className="text-sm font-medium">{cohort.month}</div>
                        {cohort.retained.map((value, i) => (
                          <div
                            key={i}
                            className={`h-8 rounded flex items-center justify-center text-xs font-medium text-white ${getCohortColor(value)}`}
                          >
                            {value}%
                          </div>
                        ))}
                        {/* Fill remaining columns */}
                        {Array.from({ length: 5 - cohort.retained.length }).map((_, i) => (
                          <div key={`empty-${i}`} className="h-8 rounded bg-muted" />
                        ))}
                        <div className="h-8 rounded flex items-center justify-center text-sm font-bold">
                          {cohort.retentionRate}%
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
              
              {/* Legend */}
              <div className="flex gap-4 mt-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 rounded bg-emerald-500" />
                  <span>70%+ retention</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 rounded bg-amber-500" />
                  <span>50-70% retention</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 rounded bg-orange-500" />
                  <span>30-50% retention</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 rounded bg-red-500" />
                  <span>&lt;30% retention</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* At-Risk Guests Tab */}
        <TabsContent value="atrisk" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>At-Risk Guests</CardTitle>
                  <CardDescription>Guests with high churn probability requiring attention</CardDescription>
                </div>
                <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => useUIStore.getState().setActiveSection('crm-campaigns')}>
                  <Target className="h-4 w-4 mr-2" />
                  Create Retention Campaign
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : atRiskGuests.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-10 w-10 mx-auto mb-2 text-emerald-500 dark:text-emerald-400/50" />
                  <p className="font-medium">No at-risk guests identified</p>
                  <p className="text-sm text-muted-foreground/60 mt-1">
                    All guests show healthy engagement patterns
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {atRiskGuests.map((guest) => (
                    <div key={guest.id} className="flex items-center justify-between p-4 bg-muted rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <div className="h-12 w-12 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-medium">
                            {guest.firstName[0]}{guest.lastName[0]}
                          </div>
                          <div className={`absolute -bottom-1 -right-1 h-5 w-5 rounded-full flex items-center justify-center text-xs font-bold ${getRiskColor(guest.riskScore)}`}>
                            {guest.riskScore}
                          </div>
                        </div>
                        <div>
                          <p className="font-medium">{guest.firstName} {guest.lastName}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Badge className={getTierColor(guest.loyaltyTier)}>
                              {guest.loyaltyTier}
                            </Badge>
                            <span>{guest.totalStays} stays</span>
                            <span>•</span>
                            <span>
                              {guest.lastStay
                                ? `Last: ${formatDate(new Date(guest.lastStay))}`
                                : 'Last stay: N/A'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-bold">{formatCurrency(guest.totalSpent)}</p>
                          <p className="text-sm text-muted-foreground">Lifetime Value</p>
                        </div>
                        <div className="flex flex-col gap-1">
                          {guest.riskFactors.slice(0, 2).map((factor, i) => (
                            <div key={i} className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                              <AlertTriangle className="h-3 w-3" />
                              {factor}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Lifetime Value Tab */}
        <TabsContent value="ltv" className="space-y-6">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : lifetimeValues.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No lifetime value data available</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
                {lifetimeValues.map((ltv) => (
                  <Card key={ltv.tier}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <Badge className={getTierColor(ltv.tier)}>
                          {ltv.tier.charAt(0).toUpperCase() + ltv.tier.slice(1)}
                        </Badge>
                        <span className="text-sm text-muted-foreground">{ltv.memberCount} members</span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div>
                          <p className="text-3xl font-bold">{formatCurrency(ltv.avgLTV)}</p>
                          <p className="text-sm text-muted-foreground">Average Lifetime Value</p>
                        </div>
                        <Separator />
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <p className="font-medium">{ltv.avgStays}</p>
                            <p className="text-muted-foreground">Avg Stays</p>
                          </div>
                          <div>
                            <p className="font-medium">{formatCurrency(ltv.avgSpend)}</p>
                            <p className="text-muted-foreground">Avg Spend</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>LTV by Loyalty Tier</CardTitle>
                  <CardDescription>Comparison of average lifetime value across tiers</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {lifetimeValues.length > 0 && (() => {
                      const maxLTV = Math.max(...lifetimeValues.map(l => l.avgLTV), 1);
                      return lifetimeValues.map((ltv) => (
                        <div key={ltv.tier} className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <Badge className={getTierColor(ltv.tier)}>
                                {ltv.tier.charAt(0).toUpperCase() + ltv.tier.slice(1)}
                              </Badge>
                              <span className="font-medium">{formatCurrency(ltv.avgLTV)}</span>
                            </div>
                            <span className="text-muted-foreground">{ltv.memberCount} members</span>
                          </div>
                          <div className="h-6 bg-muted rounded-md overflow-hidden">
                            <div
                              className="h-full rounded-md bg-gradient-to-r from-emerald-400 to-teal-500 transition-all duration-500"
                              style={{ width: `${(ltv.avgLTV / maxLTV) * 100}%` }}
                            />
                          </div>
                        </div>
                      ));
                    })()}
                    {lifetimeValues.length === 0 && (
                      <p className="text-center text-muted-foreground py-4">No LTV data available</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
