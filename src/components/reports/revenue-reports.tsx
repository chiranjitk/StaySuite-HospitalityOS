'use client';

import React, { useState, useEffect } from 'react';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useTimezone } from '@/contexts/TimezoneContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Download,
  Calendar,
  DollarSign,
  CreditCard,
  BarChart3,
  Loader2,
} from 'lucide-react';
import { subDays } from 'date-fns';
import { exportToCSV } from '@/lib/export-utils';

interface RevenueData {
  date: string;
  revenue: number;
  bookings: number;
  taxes: number;
  payments: number;
}

interface RevenueBySource {
  source: string;
  revenue: number;
  bookings: number;
}

interface RevenueByRoomType {
  roomTypeId: string;
  roomTypeName: string;
  revenue: number;
  bookings: number;
}

interface RevenueReport {
  revenueData: RevenueData[];
  summary: {
    totalRevenue: number;
    totalBookings: number;
    totalPayments: number;
    avgDailyRevenue: number;
    revenueChange: number;
  };
  revenueBySource: RevenueBySource[];
  revenueByRoomType: RevenueByRoomType[];
}

const chartConfig = {
  revenue: {
    label: 'Revenue',
    color: '#10b981',
  },
  payments: {
    label: 'Payments',
    color: '#f59e0b',
  },
  bookings: {
    label: 'Bookings',
    color: '#06b6d4',
  },
} satisfies ChartConfig;

const chartColors = [
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ec4899', // pink
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#f43f5e', // rose
];

export default function RevenueReports() {
  const { formatCurrency } = useCurrency();
  const { formatDate: formatDateUtil } = useTimezone();

  function formatDate(dateStr: string) {
    if (dateStr.length === 7) {
      // Monthly format YYYY-MM
      return formatDateUtil(new Date(dateStr + '-01'));
    }
    return formatDateUtil(new Date(dateStr));
  }
  const [data, setData] = useState<RevenueReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30');
  const [granularity, setGranularity] = useState('daily');

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const end = new Date();
        const start = subDays(end, parseInt(dateRange));
        const params = new URLSearchParams({
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          granularity,
        });
        const response = await fetch(`/api/reports/revenue?${params}`);
        const result = await response.json();
        if (result.success) {
          setData(result.data);
        }
      } catch (err) {
        console.error('Failed to fetch revenue data:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [dateRange, granularity]);

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
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="border-0 shadow-sm">
              <CardContent className="pt-6">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6">
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const { revenueData, summary, revenueBySource, revenueByRoomType } = data;
  const isPositive = summary.revenueChange >= 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Revenue Reports</h2>
          <p className="text-muted-foreground">Analyze revenue performance and trends</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-32">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="180">Last 6 months</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Select value={granularity} onValueChange={setGranularity}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="gap-2 hover:shadow-md hover:bg-gradient-to-r hover:from-emerald-50 hover:to-emerald-100 dark:hover:from-emerald-950 dark:hover:to-emerald-900 transition-all duration-300" onClick={() => exportToCSV(
            revenueData as unknown as Record<string, unknown>[],
            `revenue-report-${dateRange}d`,
            [
              { key: 'date', label: 'Date' },
              { key: 'revenue', label: 'Revenue ($)' },
              { key: 'bookings', label: 'Bookings' },
              { key: 'taxes', label: 'Taxes ($)' },
              { key: 'payments', label: 'Payments ($)' },
            ]
          )}>
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900 rounded-xl">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Total Revenue</p>
                <p className="text-2xl font-bold bg-gradient-to-r from-emerald-700 to-emerald-500 bg-clip-text text-transparent dark:from-emerald-200 dark:to-emerald-400">
                  {formatCurrency(summary.totalRevenue)}
                </p>
                <div className={`flex items-center gap-1 mt-1 text-xs ${isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
                  {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  <span>{isPositive ? '+' : ''}{summary.revenueChange}% vs prev period</span>
                </div>
              </div>
              <div className="p-3 rounded-full bg-emerald-200 dark:bg-emerald-800">
                <DollarSign className="h-6 w-6 text-emerald-700 dark:text-emerald-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900 rounded-xl">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Total Bookings</p>
                <p className="text-2xl font-bold text-amber-900 dark:text-amber-100">
                  {summary.totalBookings}
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  Avg Daily Rate: {formatCurrency(summary.avgDailyRevenue)}
                </p>
              </div>
              <div className="p-3 rounded-full bg-amber-200 dark:bg-amber-800">
                <BarChart3 className="h-6 w-6 text-amber-700 dark:text-amber-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-950 dark:to-cyan-900 rounded-xl">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-cyan-700 dark:text-cyan-400">Payments Collected</p>
                <p className="text-2xl font-bold text-cyan-900 dark:text-cyan-100">
                  {formatCurrency(summary.totalPayments)}
                </p>
                <p className="text-xs text-cyan-600 dark:text-cyan-400 mt-1">
                  Collection rate: {summary.totalRevenue > 0 ? Math.round((summary.totalPayments / summary.totalRevenue) * 100) : 0}%
                </p>
              </div>
              <div className="p-3 rounded-full bg-cyan-200 dark:bg-cyan-800">
                <CreditCard className="h-6 w-6 text-cyan-700 dark:text-cyan-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-violet-50 to-violet-100 dark:from-violet-950 dark:to-violet-900 rounded-xl">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-violet-700 dark:text-violet-400">Avg Booking Value</p>
                <p className="text-2xl font-bold text-violet-900 dark:text-violet-100">
                  {formatCurrency(summary.totalBookings > 0 ? summary.totalRevenue / summary.totalBookings : 0)}
                </p>
                <p className="text-xs text-violet-600 dark:text-violet-400 mt-1">
                  Per booking
                </p>
              </div>
              <div className="p-3 rounded-full bg-violet-200 dark:bg-violet-800">
                <DollarSign className="h-6 w-6 text-violet-700 dark:text-violet-300" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Trend Chart */}
      <Card className="border-0 shadow-sm rounded-xl overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            Revenue Trend
          </CardTitle>
          <CardDescription>Revenue and payments over time</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[160px] sm:h-[250px] lg:h-[300px] w-full">
            <AreaChart data={revenueData}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorPayments" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                className="text-xs"
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                className="text-xs"
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `$${v / 1000}k`}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#10b981"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorRevenue)"
              />
              <Area
                type="monotone"
                dataKey="payments"
                stroke="#f59e0b"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorPayments)"
              />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Revenue Breakdown Charts */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        {/* Revenue by Source */}
        <Card className="border-0 shadow-sm rounded-xl overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Revenue by Source</CardTitle>
            <CardDescription>Booking channel distribution</CardDescription>
          </CardHeader>
          <CardContent>
            {revenueBySource.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[160px] sm:h-[250px] w-full">
                <PieChart>
                  <Pie
                    data={revenueBySource.map((item, index) => ({
                      ...item,
                      fill: chartColors[index % chartColors.length],
                    }))}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    dataKey="revenue"
                    nameKey="source"
                    paddingAngle={2}
                  >
                    {revenueBySource.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                </PieChart>
              </ChartContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Revenue by Room Type */}
        <Card className="border-0 shadow-sm rounded-xl overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Revenue by Room Type</CardTitle>
            <CardDescription>Performance by accommodation category</CardDescription>
          </CardHeader>
          <CardContent>
            {revenueByRoomType.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[160px] sm:h-[250px] w-full">
                <BarChart data={revenueByRoomType} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" horizontal vertical={false} />
                  <XAxis type="number" className="text-xs" tickLine={false} axisLine={false} tickFormatter={(v) => `$${v / 1000}k`} />
                  <YAxis
                    dataKey="roomTypeName"
                    type="category"
                    className="text-xs"
                    tickLine={false}
                    axisLine={false}
                    width={100}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="revenue" radius={[0, 4, 4, 0]} maxBarSize={28}>
                    {revenueByRoomType.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
