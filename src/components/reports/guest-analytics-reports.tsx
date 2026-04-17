'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
  Line,
  LineChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import {
  Download,
  Calendar,
  Users,
  TrendingUp,
  TrendingDown,
  DollarSign,
  MapPin,
  Clock,
  Star,
  Crown,
  Target,
  BarChart3,
  PieChart as PieChartIcon,
  Activity,
  RefreshCw,
} from 'lucide-react';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useTimezone } from '@/contexts/TimezoneContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { exportToCSV } from '@/lib/export-utils';

interface GuestDemographics {
  ageGroups: { range: string; count: number; percentage: number }[];
  nationalities: { country: string; count: number; percentage: number; flag: string }[];
  gender: { type: string; count: number; percentage: number }[];
  travelPurpose: { purpose: string; count: number; percentage: number }[];
}

interface BookingPattern {
  monthlyTrend: { month: string; bookings: number; revenue: number; avgStay: number }[];
  dayOfWeek: { day: string; bookings: number; percentage: number }[];
  leadTime: { range: string; count: number; percentage: number }[];
  seasonality: { quarter: string; bookings: number; growth: number }[];
}

interface SegmentRevenue {
  segments: { name: string; guests: number; revenue: number; avgSpend: number; percentage: number }[];
  totalRevenue: number;
  totalGuests: number;
  avgRevenuePerGuest: number;
}

interface GuestAnalyticsReport {
  overview: {
    totalGuests: number;
    newGuests: number;
    returningGuests: number;
    avgStayLength: number;
    totalRevenue: number;
    avgRevenuePerGuest: number;
    satisfactionScore: number;
  };
  demographics: GuestDemographics;
  bookingPatterns: BookingPattern;
  segmentRevenue: SegmentRevenue;
  topMarkets: { market: string; guests: number; growth: number }[];
  loyaltyStats: { tier: string; members: number; revenue: number; retention: number }[];
}

const chartConfig = {
  bookings: { label: 'Bookings', color: '#10b981' },
  revenue: { label: 'Revenue', color: '#f59e0b' },
  count: { label: 'Count', color: '#8b5cf6' },
  percentage: { label: 'Percentage', color: '#06b6d4' },
} satisfies ChartConfig;

const chartColors = [
  '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#f43f5e', '#84cc16', '#14b8a6',
];

export default function GuestAnalyticsReports() {
  const { formatCurrency } = useCurrency();
  const { formatDate } = useTimezone();
  const [data, setData] = useState<GuestAnalyticsReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30');
  const [propertyId, setPropertyId] = useState('all');
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/guests/analytics?dateRange=${dateRange}&propertyId=${propertyId}`);
        const result = await response.json();

        if (result.success) {
          // Transform API data into report format
          const analyticsData = result.data;

          const report: GuestAnalyticsReport = {
            overview: {
              totalGuests: analyticsData.totalGuests || 0,
              newGuests: analyticsData.newGuests || 0,
              returningGuests: analyticsData.returningGuests || 0,
              avgStayLength: analyticsData.avgStayLength || 0,
              totalRevenue: analyticsData.totalRevenue || 0,
              avgRevenuePerGuest: analyticsData.totalGuests > 0 ? (analyticsData.totalRevenue || 0) / analyticsData.totalGuests : 0,
              satisfactionScore: analyticsData.satisfactionScore || 0,
            },
            demographics: analyticsData.demographics || {
              ageGroups: [],
              nationalities: [],
              gender: [],
              travelPurpose: [],
            },
            bookingPatterns: analyticsData.bookingPatterns || {
              monthlyTrend: [],
              dayOfWeek: [],
              leadTime: [],
              seasonality: [],
            },
            segmentRevenue: analyticsData.segmentRevenue || {
              segments: [],
              totalRevenue: 0,
              totalGuests: 0,
              avgRevenuePerGuest: 0,
            },
            topMarkets: analyticsData.topMarkets || [],
            loyaltyStats: analyticsData.loyaltyStats || [],
          };

          setData(report);
        } else {
          throw new Error('Failed to load analytics data');
        }
      } catch (error) {
        console.error('Failed to fetch guest analytics reports:', error);
        toast.error('Failed to load guest analytics reports');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [dateRange, propertyId]);

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-32" />
          </div>
        </div>
        <div className="grid gap-4 grid-cols-1 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="border-0 shadow-sm">
              <CardContent className="pt-6">
                <Skeleton className="h-24 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const returningRate = data.overview.totalGuests > 0
    ? (data.overview.returningGuests / data.overview.totalGuests) * 100
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Guest Analytics Reports</h2>
          <p className="text-muted-foreground">Comprehensive guest insights and performance metrics</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-36">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Select value={propertyId} onValueChange={setPropertyId}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Property" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Properties</SelectItem>
              <SelectItem value="p1">Grand Hotel</SelectItem>
              <SelectItem value="p2">Beach Resort</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => exportToCSV(
            data.segmentRevenue.segments.map(s => ({
              segment: s.name,
              guests: s.guests,
              revenue: s.revenue,
              avgSpend: s.avgSpend,
              percentage: s.percentage,
            })),
            `guest-analytics-${dateRange}d`,
            [
              { key: 'segment', label: 'Segment' },
              { key: 'guests', label: 'Guests' },
              { key: 'revenue', label: 'Revenue ($)' },
              { key: 'avgSpend', label: 'Avg Spend ($)' },
              { key: 'percentage', label: 'Revenue Share (%)' },
            ]
          )}>
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full overflow-x-auto flex sm:inline-grid sm:grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="demographics">Demographics</TabsTrigger>
          <TabsTrigger value="bookings">Booking Patterns</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Summary Cards */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Total Guests</p>
                    <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">{data.overview.totalGuests}</p>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                      +{data.overview.newGuests} new this period
                    </p>
                  </div>
                  <div className="p-3 rounded-full bg-emerald-200 dark:bg-emerald-800">
                    <Users className="h-6 w-6 text-emerald-700 dark:text-emerald-300" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Returning Rate</p>
                    <p className="text-2xl font-bold text-amber-900 dark:text-amber-100">{returningRate.toFixed(1)}%</p>
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                      {data.overview.returningGuests} repeat guests
                    </p>
                  </div>
                  <div className="p-3 rounded-full bg-amber-200 dark:bg-amber-800">
                    <TrendingUp className="h-6 w-6 text-amber-700 dark:text-amber-300" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm bg-gradient-to-br from-violet-50 to-violet-100 dark:from-violet-950 dark:to-violet-900">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-violet-700 dark:text-violet-400">Total Revenue</p>
                    <p className="text-2xl font-bold text-violet-900 dark:text-violet-100">{formatCurrency(data.overview.totalRevenue)}</p>
                    <p className="text-xs text-violet-600 dark:text-violet-400 mt-1">
                      {formatCurrency(data.overview.avgRevenuePerGuest)} per guest
                    </p>
                  </div>
                  <div className="p-3 rounded-full bg-violet-200 dark:bg-violet-800">
                    <DollarSign className="h-6 w-6 text-violet-700 dark:text-violet-300" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-950 dark:to-cyan-900">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-cyan-700 dark:text-cyan-400">Satisfaction</p>
                    <p className="text-2xl font-bold text-cyan-900 dark:text-cyan-100">{data.overview.satisfactionScore}/5</p>
                    <p className="text-xs text-cyan-600 dark:text-cyan-400 mt-1">
                      {data.overview.avgStayLength.toFixed(1)} nights avg stay
                    </p>
                  </div>
                  <div className="p-3 rounded-full bg-cyan-200 dark:bg-cyan-800">
                    <Star className="h-6 w-6 text-cyan-700 dark:text-cyan-300" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
            {/* Monthly Trend */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Monthly Booking Trend</CardTitle>
                <CardDescription>Guest bookings over the past year</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[160px] sm:h-[250px] w-full">
                  <AreaChart data={data.bookingPatterns.monthlyTrend}>
                    <defs>
                      <linearGradient id="colorBookings" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
                    <XAxis dataKey="month" tickFormatter={(v) => formatDate(new Date(v))} className="text-xs" tickLine={false} axisLine={false} />
                    <YAxis className="text-xs" tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area type="monotone" dataKey="bookings" stroke="#10b981" fill="url(#colorBookings)" strokeWidth={2} />
                  </AreaChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Segment Revenue */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Revenue by Segment</CardTitle>
                <CardDescription>Guest segment contribution</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[160px] sm:h-[250px] w-full">
                  <PieChart>
                    <Pie
                      data={data.segmentRevenue.segments}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      dataKey="revenue"
                      nameKey="name"
                      paddingAngle={2}
                    >
                      {data.segmentRevenue.segments.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </PieChart>
                </ChartContainer>
                <div className="flex flex-wrap gap-2 mt-4 justify-center">
                  {data.segmentRevenue.segments.map((seg, index) => (
                    <Badge key={seg.name} style={{ backgroundColor: chartColors[index % chartColors.length] + '20', color: chartColors[index % chartColors.length] }}>
                      {seg.name}: {seg.percentage}%
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top Markets & Loyalty */}
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-emerald-500" />
                  <CardTitle className="text-lg">Top Markets</CardTitle>
                </div>
                <CardDescription>Guest origin by market</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.topMarkets.map((market, i) => (
                  <div key={market.market} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 flex items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 text-sm font-medium">
                        {i + 1}
                      </span>
                      <span className="font-medium">{market.market}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">{market.guests} guests</span>
                      <Badge variant="secondary" className={market.growth >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>
                        {market.growth >= 0 ? '+' : ''}{market.growth}%
                      </Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-amber-500" />
                  <CardTitle className="text-lg">Loyalty Program</CardTitle>
                </div>
                <CardDescription>Member tier breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.loyaltyStats.map((tier) => (
                    <div key={tier.tier} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium capitalize">{tier.tier}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{tier.members} members</span>
                          <span className="text-xs text-muted-foreground">|</span>
                          <span className="text-sm font-medium">{tier.retention}% retention</span>
                        </div>
                      </div>
                      <Progress value={tier.retention} className="h-2" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Demographics Tab */}
        <TabsContent value="demographics" className="space-y-6">
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
            {/* Age Distribution */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Age Distribution</CardTitle>
                <CardDescription>Guest age groups breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[160px] sm:h-[200px] w-full">
                  <BarChart data={data.demographics.ageGroups} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" horizontal={false} />
                    <XAxis type="number" className="text-xs" tickLine={false} axisLine={false} />
                    <YAxis dataKey="range" type="category" className="text-xs" tickLine={false} axisLine={false} width={50} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={24}>
                      {data.demographics.ageGroups.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Nationalities */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-emerald-500" />
                  <CardTitle className="text-lg">Top Nationalities</CardTitle>
                </div>
                <CardDescription>Guest origin countries</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {data.demographics.nationalities.map((nat) => {
                  const maxCount = data.demographics.nationalities[0]?.count || 1;
                  const percentage = (nat.count / maxCount) * 100;
                  return (
                    <div key={nat.country} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium flex items-center gap-2">
                          <span>{nat.flag}</span>
                          {nat.country}
                        </span>
                        <span className="text-muted-foreground">{nat.percentage}%</span>
                      </div>
                      <Progress value={percentage} className="h-2" />
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Gender */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Gender Distribution</CardTitle>
                <CardDescription>Guest gender breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[160px] sm:h-[200px] w-full">
                  <PieChart>
                    <Pie
                      data={data.demographics.gender}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      dataKey="count"
                      nameKey="type"
                      paddingAngle={2}
                    >
                      {data.demographics.gender.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </PieChart>
                </ChartContainer>
                <div className="flex flex-wrap gap-2 mt-4 justify-center">
                  {data.demographics.gender.map((g, index) => (
                    <Badge key={g.type} style={{ backgroundColor: chartColors[index % chartColors.length] + '20', color: chartColors[index % chartColors.length] }}>
                      {g.type}: {g.percentage}%
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Travel Purpose */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Travel Purpose</CardTitle>
                <CardDescription>Reason for visit</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[160px] sm:h-[200px] w-full">
                  <BarChart data={data.demographics.travelPurpose}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" vertical={false} />
                    <XAxis dataKey="purpose" className="text-xs" tickLine={false} axisLine={false} />
                    <YAxis className="text-xs" tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {data.demographics.travelPurpose.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Booking Patterns Tab */}
        <TabsContent value="bookings" className="space-y-6">
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
            {/* Day of Week */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-violet-500" />
                  <CardTitle className="text-lg">Day of Week Distribution</CardTitle>
                </div>
                <CardDescription>Booking patterns by day</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[160px] sm:h-[200px] w-full">
                  <BarChart data={data.bookingPatterns.dayOfWeek}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" vertical={false} />
                    <XAxis dataKey="day" className="text-xs" tickLine={false} axisLine={false} />
                    <YAxis className="text-xs" tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="bookings" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Lead Time */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-amber-500" />
                  <CardTitle className="text-lg">Lead Time Distribution</CardTitle>
                </div>
                <CardDescription>How far in advance guests book</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[160px] sm:h-[200px] w-full">
                  <BarChart data={data.bookingPatterns.leadTime}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" vertical={false} />
                    <XAxis dataKey="range" className="text-xs" tickLine={false} axisLine={false} />
                    <YAxis className="text-xs" tickLine={false} axisLine={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Seasonality */}
            <Card className="border-0 shadow-sm lg:col-span-2">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-cyan-500" />
                  <CardTitle className="text-lg">Seasonality Trends</CardTitle>
                </div>
                <CardDescription>Quarterly booking patterns</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-4">
                  {data.bookingPatterns.seasonality.map((quarter) => (
                    <Card key={quarter.quarter} className="bg-muted/30">
                      <CardContent className="p-4 text-center">
                        <p className="text-lg font-bold">{quarter.quarter}</p>
                        <p className="text-2xl font-bold text-emerald-600">{quarter.bookings}</p>
                        <p className="text-sm text-muted-foreground">bookings</p>
                        <Badge variant="secondary" className={cn('mt-2', quarter.growth >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700')}>
                          {quarter.growth >= 0 ? '+' : ''}{quarter.growth}%
                        </Badge>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Revenue Tab */}
        <TabsContent value="revenue" className="space-y-6">
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
            <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Total Revenue</p>
                  <p className="text-3xl font-bold text-emerald-900 dark:text-emerald-100">{formatCurrency(data.segmentRevenue.totalRevenue)}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm bg-gradient-to-br from-violet-50 to-violet-100 dark:from-violet-950 dark:to-violet-900">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm font-medium text-violet-700 dark:text-violet-400">Total Guests</p>
                  <p className="text-3xl font-bold text-violet-900 dark:text-violet-100">{data.segmentRevenue.totalGuests}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Avg Revenue/Guest</p>
                  <p className="text-3xl font-bold text-amber-900 dark:text-amber-100">{formatCurrency(data.segmentRevenue.avgRevenuePerGuest)}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Segment Breakdown */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-violet-500" />
                <CardTitle className="text-lg">Revenue by Guest Segment</CardTitle>
              </div>
              <CardDescription>Detailed segment analysis</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.segmentRevenue.segments.map((segment, index) => (
                  <div key={segment.name} className="p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: chartColors[index % chartColors.length] }}
                        />
                        <span className="font-semibold">{segment.name}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-muted-foreground">{segment.guests} guests</span>
                        <span className="font-medium">{segment.percentage}% of revenue</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span>Total Revenue</span>
                      <span className="font-bold text-emerald-600">{formatCurrency(segment.revenue)}</span>
                    </div>
                    <Progress value={segment.percentage} className="h-2" />
                    <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
                      <span>Avg spend per guest</span>
                      <span>{formatCurrency(segment.avgSpend)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Revenue Trend */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Revenue Trend</CardTitle>
              <CardDescription>Monthly revenue over the past year</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[160px] sm:h-[250px] w-full">
                <AreaChart data={data.bookingPatterns.monthlyTrend}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
                  <XAxis dataKey="month" tickFormatter={(v) => formatDate(new Date(v))} className="text-xs" tickLine={false} axisLine={false} />
                  <YAxis className="text-xs" tickLine={false} axisLine={false} tickFormatter={(v) => `$${v / 1000}k`} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area type="monotone" dataKey="revenue" stroke="#f59e0b" fill="url(#colorRevenue)" strokeWidth={2} />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
