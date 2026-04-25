'use client';

import React from 'react';
import { useCurrency } from '@/contexts/CurrencyContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp, TrendingDown, ArrowUpRight, Loader2, AlertCircle } from 'lucide-react';

interface RevenueData {
  date: string;
  revenue: number;
  bookings: number;
  occupancy: number;
}

interface OccupancyData {
  name: string;
  value: number;
}

interface BookingSourceData {
  source: string;
  bookings: number;
}

interface HourlyActivityData {
  hour: string;
  checkins: number;
  checkouts: number;
}

interface ChartData {
  revenue: RevenueData[];
  occupancyByRoomType: OccupancyData[];
  bookingSources: BookingSourceData[];
  hourlyActivity: HourlyActivityData[];
}

const chartConfig = {
  revenue: {
    label: 'Revenue',
    color: 'hsl(142, 76%, 36%)', // emerald
  },
  bookings: {
    label: 'Bookings',
    color: 'hsl(173, 80%, 40%)', // teal
  },
  occupancy: {
    label: 'Occupancy',
    color: 'hsl(38, 92%, 50%)', // amber
  },
  checkins: {
    label: 'Check-ins',
    color: 'hsl(142, 76%, 36%)', // emerald
  },
  checkouts: {
    label: 'Check-outs',
    color: 'hsl(38, 92%, 50%)', // amber
  },
} satisfies ChartConfig;

// Color palette for charts (no indigo/blue)
const chartColors = [
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ec4899', // pink
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#f43f5e', // rose
];

// Shared hook: fetches dashboard data once for all charts
function useDashboardData() {
  const [data, setData] = React.useState<ChartData | null>(null);
  const [revenueChange, setRevenueChange] = React.useState<number | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchData = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/dashboard');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      if (result.success) {
        setData(result.data.charts);
        setRevenueChange(result.data.stats.revenue.change);
      } else {
        setError('Failed to load chart data');
      }
    } catch (err) {
      setError('Failed to load chart data');
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, revenueChange, isLoading, error, refetch: fetchData };
}

function ChartSkeleton() {
  return (
    <div className="h-[280px] w-full flex items-center justify-center">
      <div className="space-y-3 w-full px-4">
        <Skeleton className="h-4 w-3/4 mx-auto" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-4 w-1/2 mx-auto" />
      </div>
    </div>
  );
}

function ChartsError({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
      <AlertCircle className="h-10 w-10 text-muted-foreground mb-3" />
      <p className="text-sm text-muted-foreground mb-3">Failed to load chart data</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <Loader2 className="h-3 w-3 mr-1" />
          Retry
        </Button>
      )}
    </div>
  );
}

function ChartsSkeletonGrid() {
  return (
    <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Card className="border border-border/50 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <Skeleton className="h-5 w-32 mb-1" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-8 w-16" />
          </CardHeader>
          <CardContent className="pt-4">
            <ChartSkeleton />
          </CardContent>
        </Card>
      </div>
      <div>
        <Card className="border border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <Skeleton className="h-5 w-36 mb-1" />
            <Skeleton className="h-3 w-28" />
          </CardHeader>
          <CardContent className="pt-4">
            <ChartSkeleton />
          </CardContent>
        </Card>
      </div>
      <div className="lg:col-span-2">
        <Card className="border border-border/50 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <Skeleton className="h-5 w-28 mb-1" />
              <Skeleton className="h-3 w-36" />
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <ChartSkeleton />
          </CardContent>
        </Card>
      </div>
      <div>
        <Card className="border border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <Skeleton className="h-5 w-28 mb-1" />
            <Skeleton className="h-3 w-24" />
          </CardHeader>
          <CardContent className="pt-4">
            <ChartSkeleton />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function RevenueChart({ data, change }: { data: RevenueData[]; change: number | null }) {
  const { currency } = useCurrency();

  const isPositive = change != null && change >= 0;

  return (
    <Card className="border border-border/50 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-base font-semibold">Revenue Overview</CardTitle>
          <CardDescription className="text-xs">Weekly performance</CardDescription>
        </div>
        {change != null && (
          <Button 
            variant="ghost" 
            size="sm" 
            className={`h-8 text-xs gap-1 ${
              isPositive 
                ? 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-400' 
                : 'text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-950 dark:text-red-400'
            }`}
          >
            {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {isPositive ? '+' : ''}{change}%
          </Button>
        )}
      </CardHeader>
      <CardContent className="pt-4">
        <ChartContainer config={chartConfig} className="h-[280px] w-full">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
            <XAxis dataKey="date" className="text-xs" tickLine={false} axisLine={false} />
            <YAxis className="text-xs" tickLine={false} axisLine={false} tickFormatter={(v) => `${currency.symbol}${v/1000}k`} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#10b981"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorRevenue)"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

export function OccupancyChart({ data }: { data: OccupancyData[] }) {
  const chartData = data.map((item, index) => ({
    ...item,
    fill: chartColors[index % chartColors.length],
  }));

  return (
    <Card className="border border-border/50 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Occupancy by Room Type</CardTitle>
        <CardDescription className="text-xs">Current occupancy percentage</CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <ChartContainer config={chartConfig} className="h-[200px] w-full">
          <BarChart data={chartData} layout="vertical" margin={{ left: 80 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" horizontal={true} vertical={false} />
            <XAxis type="number" domain={[0, 100]} className="text-xs" tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
            <YAxis dataKey="name" type="category" className="text-xs" tickLine={false} axisLine={false} width={70} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={24}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

export function BookingSourceChart({ data }: { data: BookingSourceData[] }) {
  const chartData = data.map((item, index) => ({
    ...item,
    fill: chartColors[index % chartColors.length],
  }));

  return (
    <Card className="border border-border/50 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Booking Sources</CardTitle>
        <CardDescription className="text-xs">Distribution by channel</CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <ChartContainer config={chartConfig} className="h-[200px] w-full">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={75}
              dataKey="bookings"
              nameKey="source"
              paddingAngle={2}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <ChartTooltip content={<ChartTooltipContent />} />
          </PieChart>
        </ChartContainer>
        <div className="flex flex-wrap gap-3 mt-2 justify-center">
          {chartData.map((item, index) => (
            <div key={index} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.fill }} />
              <span className="text-xs text-muted-foreground">{item.source}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function HourlyActivityChart({ data }: { data: HourlyActivityData[] }) {
  return (
    <Card className="border border-border/50 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-base font-semibold">Today's Activity</CardTitle>
          <CardDescription className="text-xs">Check-ins vs Check-outs by hour</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <ChartContainer config={chartConfig} className="h-[180px] w-full">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" vertical={false} />
            <XAxis dataKey="hour" className="text-xs" tickLine={false} axisLine={false} />
            <YAxis className="text-xs" tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="checkins" name="Check-ins" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={20} />
            <Bar dataKey="checkouts" name="Check-outs" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={20} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

export function DashboardCharts() {
  const { data, revenueChange, isLoading, error, refetch } = useDashboardData();

  if (isLoading) return <ChartsSkeletonGrid />;
  if (error || !data) return <ChartsError onRetry={refetch} />;

  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      <div className="md:col-span-2 lg:col-span-2">
        <RevenueChart data={data.revenue} change={revenueChange} />
      </div>
      <div>
        <OccupancyChart data={data.occupancyByRoomType} />
      </div>
      <div className="md:col-span-2 lg:col-span-2">
        <HourlyActivityChart data={data.hourlyActivity} />
      </div>
      <div>
        <BookingSourceChart data={data.bookingSources} />
      </div>
    </div>
  );
}
