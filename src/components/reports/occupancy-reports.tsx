'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
  Legend,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Download,
  Calendar,
  Bed,
  Users,
  Building2,
  AlertTriangle,
} from 'lucide-react';
import { subDays } from 'date-fns';
import { useTimezone } from '@/contexts/TimezoneContext';
import { exportToCSV } from '@/lib/export-utils';

interface OccupancyData {
  date: string;
  occupied: number;
  total: number;
  occupancy: number;
}

interface OccupancyByRoomType {
  roomTypeId: string;
  roomTypeName: string;
  total: number;
  occupied: number;
  occupancy: number;
}

interface StatusDistribution {
  status: string;
  count: number;
}

interface OccupancyReport {
  occupancyData: OccupancyData[];
  summary: {
    avgOccupancy: number;
    maxOccupancy: number;
    minOccupancy: number;
    totalRooms: number;
    occupancyChange: number;
  };
  occupancyByRoomType: OccupancyByRoomType[];
  statusDistribution: StatusDistribution[];
  peakDays: string[];
  lowOccupancyDays: string[];
}

const chartConfig = {
  occupancy: {
    label: 'Occupancy %',
    color: '#10b981',
  },
  occupied: {
    label: 'Occupied',
    color: '#f59e0b',
  },
  total: {
    label: 'Total Rooms',
    color: '#8b5cf6',
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

const statusColors: Record<string, string> = {
  available: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
  occupied: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  dirty: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  maintenance: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  out_of_order: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

function getOccupancyColor(occupancy: number): string {
  if (occupancy >= 90) return 'text-emerald-600';
  if (occupancy >= 70) return 'text-amber-600';
  if (occupancy >= 50) return 'text-orange-600';
  return 'text-red-600';
}

function getOccupancyBgColor(occupancy: number): string {
  if (occupancy >= 90) return 'bg-emerald-500';
  if (occupancy >= 70) return 'bg-amber-500';
  if (occupancy >= 50) return 'bg-orange-500';
  return 'bg-red-500';
}

export default function OccupancyReports() {
  const { formatDate: formatDateUtil } = useTimezone();
  const [data, setData] = useState<OccupancyReport | null>(null);
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
        const response = await fetch(`/api/reports/occupancy?${params}`);
        const result = await response.json();
        if (result.success) {
          setData(result.data);
        }
      } catch (err) {
        console.error('Failed to fetch occupancy data:', err);
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

  const { occupancyData, summary, occupancyByRoomType, statusDistribution, peakDays, lowOccupancyDays } = data;

  function formatDate(dateStr: string) {
    if (dateStr.length === 7) {
      return formatDateUtil(new Date(dateStr + '-01'));
    }
    return formatDateUtil(new Date(dateStr));
  }
  const isPositive = summary.occupancyChange >= 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Occupancy Reports</h2>
          <p className="text-muted-foreground">Track room utilization and occupancy trends</p>
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
          <Button variant="outline" size="sm" className="gap-2" onClick={() => exportToCSV(
            occupancyData as unknown as Record<string, unknown>[],
            `occupancy-report-${dateRange}d`,
            [
              { key: 'date', label: 'Date' },
              { key: 'occupied', label: 'Occupied Rooms' },
              { key: 'total', label: 'Total Rooms' },
              { key: 'occupancy', label: 'Occupancy (%)' },
            ]
          )}>
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Avg Occupancy</p>
                <p className={`text-2xl font-bold ${getOccupancyColor(summary.avgOccupancy)}`}>
                  {summary.avgOccupancy.toFixed(1)}%
                </p>
                <div className={`flex items-center gap-1 mt-1 text-xs ${isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
                  {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  <span>{isPositive ? '+' : ''}{summary.occupancyChange.toFixed(1)}% vs prev period</span>
                </div>
              </div>
              <div className="p-3 rounded-full bg-emerald-200 dark:bg-emerald-800">
                <Bed className="h-6 w-6 text-emerald-700 dark:text-emerald-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Total Rooms</p>
                <p className="text-2xl font-bold text-amber-900 dark:text-amber-100">
                  {summary.totalRooms}
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  Across all properties
                </p>
              </div>
              <div className="p-3 rounded-full bg-amber-200 dark:bg-amber-800">
                <Building2 className="h-6 w-6 text-amber-700 dark:text-amber-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-950 dark:to-cyan-900">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-cyan-700 dark:text-cyan-400">Peak Occupancy</p>
                <p className="text-2xl font-bold text-cyan-900 dark:text-cyan-100">
                  {summary.maxOccupancy}%
                </p>
                <p className="text-xs text-cyan-600 dark:text-cyan-400 mt-1">
                  Highest recorded
                </p>
              </div>
              <div className="p-3 rounded-full bg-cyan-200 dark:bg-cyan-800">
                <TrendingUp className="h-6 w-6 text-cyan-700 dark:text-cyan-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-violet-50 to-violet-100 dark:from-violet-950 dark:to-violet-900">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-violet-700 dark:text-violet-400">Low Occupancy</p>
                <p className="text-2xl font-bold text-violet-900 dark:text-violet-100">
                  {summary.minOccupancy}%
                </p>
                <p className="text-xs text-violet-600 dark:text-violet-400 mt-1">
                  Lowest recorded
                </p>
              </div>
              <div className="p-3 rounded-full bg-violet-200 dark:bg-violet-800">
                <TrendingDown className="h-6 w-6 text-violet-700 dark:text-violet-300" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Occupancy Trend Chart */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Occupancy Trend</CardTitle>
          <CardDescription>Room utilization over time</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[160px] sm:h-[250px] lg:h-[300px] w-full">
            <AreaChart data={occupancyData}>
              <defs>
                <linearGradient id="colorOccupancy" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
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
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                type="monotone"
                dataKey="occupancy"
                stroke="#10b981"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorOccupancy)"
              />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Occupancy Breakdown */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        {/* Occupancy by Room Type */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Occupancy by Room Type</CardTitle>
            <CardDescription>Utilization by accommodation category</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {occupancyByRoomType.length > 0 ? (
              occupancyByRoomType.map((item, index) => (
                <div key={item.roomTypeId} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{item.roomTypeName}</span>
                    <span className={`text-sm font-bold ${getOccupancyColor(item.occupancy)}`}>
                      {item.occupancy}%
                    </span>
                  </div>
                  <Progress
                    value={item.occupancy}
                    className="h-2"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{item.occupied} occupied</span>
                    <span>{item.total} total</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Room Status Distribution */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Room Status Distribution</CardTitle>
            <CardDescription>Current room status breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[160px] sm:h-[200px] w-full">
              <PieChart>
                <Pie
                  data={statusDistribution.map((item, index) => ({
                    ...item,
                    fill: chartColors[index % chartColors.length],
                  }))}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  dataKey="count"
                  nameKey="status"
                  paddingAngle={2}
                >
                  {statusDistribution.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                  ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent />} />
              </PieChart>
            </ChartContainer>
            <div className="flex flex-wrap gap-2 mt-4 justify-center">
              {statusDistribution.map((item, index) => (
                <Badge
                  key={item.status}
                  variant="secondary"
                  className={statusColors[item.status] || ''}
                >
                  {item.status.replace('_', ' ')}: {item.count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Peak and Low Days */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-500" />
              <CardTitle className="text-lg">Peak Days</CardTitle>
            </div>
            <CardDescription>Days with 90%+ occupancy</CardDescription>
          </CardHeader>
          <CardContent>
            {peakDays.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {peakDays.map(day => (
                  <Badge key={day} variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                    {formatDateUtil(new Date(day))}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No peak days recorded in this period</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              <CardTitle className="text-lg">Low Occupancy Days</CardTitle>
            </div>
            <CardDescription>Days with less than 50% occupancy</CardDescription>
          </CardHeader>
          <CardContent>
            {lowOccupancyDays.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {lowOccupancyDays.map(day => (
                  <Badge key={day} variant="secondary" className="bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300">
                    {formatDateUtil(new Date(day))}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No low occupancy days recorded in this period</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
