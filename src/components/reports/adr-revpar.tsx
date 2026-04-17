'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
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
  Legend,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Download,
  Calendar,
  DollarSign,
  BarChart3,
  Target,
  Calculator,
} from 'lucide-react';
import { subDays } from 'date-fns';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useTimezone } from '@/contexts/TimezoneContext';
import { exportToCSV } from '@/lib/export-utils';

interface ADRRevPARData {
  date: string;
  adr: number;
  revpar: number;
  occupancy: number;
  revenue: number;
  availableRooms: number;
  soldRooms: number;
}

interface MetricCardProps {
  title: string;
  value: string;
  change: number;
  icon: React.ReactNode;
  colorClass: string;
}

function MetricCard({ title, value, change, icon, colorClass }: MetricCardProps) {
  const isPositive = change >= 0;
  return (
    <Card className={`border-0 shadow-sm ${colorClass}`}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium opacity-70">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            <div className={`flex items-center gap-1 mt-1 text-xs ${isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
              {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              <span>{isPositive ? '+' : ''}{change.toFixed(1)}% vs prev</span>
            </div>
          </div>
          <div className="p-3 rounded-full bg-white/50 dark:bg-black/20">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const chartConfig = {
  adr: {
    label: 'ADR',
    color: '#10b981',
  },
  revpar: {
    label: 'RevPAR',
    color: '#f59e0b',
  },
  occupancy: {
    label: 'Occupancy %',
    color: '#06b6d4',
  },
} satisfies ChartConfig;

export default function ADRRevPAR() {
  const { formatCurrency } = useCurrency();
  const { formatDate: formatDateUtil } = useTimezone();

  function formatDate(dateStr: string) {
    if (dateStr.length === 7) {
      return formatDateUtil(new Date(dateStr + '-01'));
    }
    return formatDateUtil(new Date(dateStr));
  }
  const [data, setData] = useState<ADRRevPARData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30');
  const [granularity, setGranularity] = useState('daily');

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const end = new Date();
        const start = subDays(end, parseInt(dateRange));

        // Fetch revenue data
        const revenueParams = new URLSearchParams({
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          granularity,
        });
        const revenueResponse = await fetch(`/api/reports/revenue?${revenueParams}`);
        const revenueResult = await revenueResponse.json();

        // Fetch occupancy data
        const occupancyParams = new URLSearchParams({
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          granularity,
        });
        const occupancyResponse = await fetch(`/api/reports/occupancy?${occupancyParams}`);
        const occupancyResult = await occupancyResponse.json();

        if (revenueResult.success && occupancyResult.success) {
          // Combine revenue and occupancy data
          const combinedData: ADRRevPARData[] = revenueResult.data.revenueData.map((rev: { date: string; revenue: number; bookings: number }) => {
            const occ = occupancyResult.data.occupancyData.find(
              (o: { date: string }) => o.date === rev.date
            ) || { occupied: 0, total: 100, occupancy: 0 };

            const soldRooms = occ.occupied;
            const availableRooms = occ.total;
            const occupancy = occ.occupancy;

            // ADR = Room Revenue / Number of Rooms Sold
            const adr = soldRooms > 0 ? rev.revenue / soldRooms : 0;

            // RevPAR = Total Room Revenue / Total Available Rooms
            const revpar = availableRooms > 0 ? rev.revenue / availableRooms : 0;

            return {
              date: rev.date,
              adr: Math.round(adr * 100) / 100,
              revpar: Math.round(revpar * 100) / 100,
              occupancy,
              revenue: rev.revenue,
              availableRooms,
              soldRooms,
            };
          });

          setData(combinedData);
        }
      } catch (err) {
        console.error('Failed to fetch ADR/RevPAR data:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [dateRange, granularity]);

  if (isLoading) {
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

  // Calculate summary stats
  const avgADR = data.length > 0
    ? data.reduce((sum, d) => sum + d.adr, 0) / data.length
    : 0;
  const avgRevPAR = data.length > 0
    ? data.reduce((sum, d) => sum + d.revpar, 0) / data.length
    : 0;
  const avgOccupancy = data.length > 0
    ? data.reduce((sum, d) => sum + d.occupancy, 0) / data.length
    : 0;
  const totalRevenue = data.reduce((sum, d) => sum + d.revenue, 0);

  // Calculate changes by comparing first half vs second half of current data
  const midPoint = Math.floor(data.length / 2);
  const firstHalf = data.slice(0, midPoint);
  const secondHalf = data.slice(midPoint);

  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
  const calcChange = (current: number, previous: number) =>
    previous > 0 ? ((current - previous) / previous) * 100 : 0;

  const adrChange = calcChange(avg(secondHalf.map(d => d.adr)), avg(firstHalf.map(d => d.adr)));
  const revparChange = calcChange(avg(secondHalf.map(d => d.revpar)), avg(firstHalf.map(d => d.revpar)));
  const occupancyChange = calcChange(avg(secondHalf.map(d => d.occupancy)), avg(firstHalf.map(d => d.occupancy)));
  const revenueChange = calcChange(
    secondHalf.reduce((s, d) => s + d.revenue, 0),
    firstHalf.reduce((s, d) => s + d.revenue, 0)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">ADR & RevPAR Analytics</h2>
          <p className="text-muted-foreground">Key revenue performance indicators</p>
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
            data as unknown as Record<string, unknown>[],
            `adr-revpar-${dateRange}d`,
            [
              { key: 'date', label: 'Date' },
              { key: 'adr', label: 'ADR ($)' },
              { key: 'revpar', label: 'RevPAR ($)' },
              { key: 'occupancy', label: 'Occupancy (%)' },
              { key: 'revenue', label: 'Revenue ($)' },
              { key: 'availableRooms', label: 'Available Rooms' },
              { key: 'soldRooms', label: 'Sold Rooms' },
            ]
          )}>
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Average Daily Rate (ADR)"
          value={formatCurrency(avgADR)}
          change={adrChange}
          icon={<DollarSign className="h-6 w-6 text-emerald-700" />}
          colorClass="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900"
        />
        <MetricCard
          title="Revenue Per Available Room"
          value={formatCurrency(avgRevPAR)}
          change={revparChange}
          icon={<Target className="h-6 w-6 text-amber-700" />}
          colorClass="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900"
        />
        <MetricCard
          title="Average Occupancy"
          value={`${avgOccupancy.toFixed(1)}%`}
          change={occupancyChange}
          icon={<BarChart3 className="h-6 w-6 text-cyan-700" />}
          colorClass="bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-950 dark:to-cyan-900"
        />
        <MetricCard
          title="Total Revenue"
          value={formatCurrency(totalRevenue)}
          change={revenueChange}
          icon={<Calculator className="h-6 w-6 text-violet-700" />}
          colorClass="bg-gradient-to-br from-violet-50 to-violet-100 dark:from-violet-950 dark:to-violet-900"
        />
      </div>

      {/* ADR & RevPAR Trend Chart */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">ADR & RevPAR Trend</CardTitle>
          <CardDescription>Key metrics over time</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <LineChart data={data}>
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
                tickFormatter={(v) => `$${v}`}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend />
              <Line
                type="monotone"
                dataKey="adr"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="revpar"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Occupancy vs ADR Correlation */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Occupancy vs ADR</CardTitle>
            <CardDescription>Relationship between occupancy and pricing</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[250px] w-full">
              <BarChart data={data.slice(-14)}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  className="text-xs"
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  yAxisId="left"
                  className="text-xs"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `$${v}`}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  className="text-xs"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${v}%`}
                  domain={[0, 100]}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend />
                <Bar yAxisId="left" dataKey="adr" name="ADR" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={30} />
                <Bar yAxisId="right" dataKey="occupancy" name="Occupancy %" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={30} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Performance Summary Table */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Performance Summary</CardTitle>
            <CardDescription>Key metrics by period</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">ADR</TableHead>
                  <TableHead className="text-right">RevPAR</TableHead>
                  <TableHead className="text-right">Occupancy</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.slice(-7).map((row) => (
                  <TableRow key={row.date}>
                    <TableCell className="font-medium">{formatDate(row.date)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.adr)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.revpar)}</TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant="secondary"
                        className={
                          row.occupancy >= 90
                            ? 'bg-emerald-100 text-emerald-700'
                            : row.occupancy >= 70
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-orange-100 text-orange-700'
                        }
                      >
                        {row.occupancy}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Formulas Info */}
      <Card className="border-0 shadow-sm bg-muted/30">
        <CardHeader>
          <CardTitle className="text-lg">Understanding the Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            <div className="space-y-2">
              <h4 className="font-semibold text-emerald-700">Average Daily Rate (ADR)</h4>
              <p className="text-sm text-muted-foreground">
                ADR = Room Revenue ÷ Number of Rooms Sold
              </p>
              <p className="text-sm text-muted-foreground">
                Measures the average price at which rooms are sold. Higher ADR indicates stronger pricing power.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-amber-700">Revenue Per Available Room (RevPAR)</h4>
              <p className="text-sm text-muted-foreground">
                RevPAR = Room Revenue ÷ Total Available Rooms
              </p>
              <p className="text-sm text-muted-foreground">
                Combines occupancy and ADR to show overall revenue efficiency. The gold standard for hotel performance.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
