'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
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
  Pie,
  PieChart,
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Cell,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
  RefreshCw,
  Download,
  Loader2,
  Calendar,
  Target,
  Zap,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, subDays } from 'date-fns';
import { useCurrency } from '@/contexts/CurrencyContext';
import { exportToCSV } from '@/lib/export-utils';

interface ROIData {
  date: string;
  spend: number;
  revenue: number;
  roas: number;
  profit: number;
}

interface ChannelComparison {
  channel: string;
  spend: number;
  revenue: number;
  roas: number;
  conversions: number;
  percentage: number;
}

interface ROISummary {
  totalSpend: number;
  totalRevenue: number;
  totalProfit: number;
  avgRoas: number;
  avgCpa: number;
  spendChange: number;
  revenueChange: number;
  roasChange: number;
}

interface TrendInsight {
  type: 'positive' | 'negative' | 'neutral';
  title: string;
  description: string;
  value: number;
  trend: string;
}

const chartConfig = {
  spend: {
    label: 'Spend',
    color: '#ef4444',
  },
  revenue: {
    label: 'Revenue',
    color: '#10b981',
  },
  profit: {
    label: 'Profit',
    color: '#06b6d4',
  },
} satisfies ChartConfig;

const COLORS = ['#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899'];

const dateRanges = [
  { value: '7', label: 'Last 7 days' },
  { value: '14', label: 'Last 14 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '60', label: 'Last 60 days' },
  { value: '90', label: 'Last 90 days' },
];

export default function ROIAnalytics() {
  const { formatCurrency } = useCurrency();
  const [roiData, setRoiData] = useState<ROIData[]>([]);
  const [channelData, setChannelData] = useState<ChannelComparison[]>([]);
  const [summary, setSummary] = useState<ROISummary | null>(null);
  const [insights, setInsights] = useState<TrendInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ days: dateRange });
      const response = await fetch(`/api/ads/performance?${params}&roi=true`);
      const data = await response.json();

      if (data.success) {
        setRoiData(data.data.roi || []);
        setChannelData(data.data.channels || []);
        setSummary(data.data.roiSummary || null);
        setInsights(data.data.insights || []);
      } else {
        toast.error('Failed to load ROI analytics');
      }
    } catch (error) {
      console.error('Error fetching ROI data:', error);
      toast.error('Failed to load ROI analytics');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), 'MMM dd');
  };

  const getChangeIcon = (value: number) => {
    if (value > 0) return <ArrowUpRight className="h-3 w-3 text-emerald-600" />;
    if (value < 0) return <ArrowDownRight className="h-3 w-3 text-red-600" />;
    return null;
  };

  const getChangeColor = (value: number) => {
    if (value > 0) return 'text-emerald-600';
    if (value < 0) return 'text-red-600';
    return 'text-gray-500';
  };

  if (loading && !summary) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="border-0 shadow-sm">
              <CardContent className="pt-6">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">ROI Analytics</h2>
          <p className="text-muted-foreground">
            Track return on ad spend and revenue analysis
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-36">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {dateRanges.map((r) => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportToCSV(
            roiData as unknown as Record<string, unknown>[],
            `roi-analytics-${dateRange}d`,
            [
              { key: 'date', label: 'Date' },
              { key: 'spend', label: 'Ad Spend ($)' },
              { key: 'revenue', label: 'Revenue ($)' },
              { key: 'roas', label: 'ROAS' },
              { key: 'profit', label: 'Profit ($)' },
            ]
          )}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950 dark:to-teal-950">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="h-5 w-5 text-emerald-600" />
                {getChangeIcon(summary.revenueChange)}
              </div>
              <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">{formatCurrency(summary.totalRevenue)}</p>
              <p className="text-sm text-emerald-700 dark:text-emerald-400">Total Revenue</p>
              <p className={`text-xs mt-1 ${getChangeColor(summary.revenueChange)}`}>
                {summary.revenueChange > 0 ? '+' : ''}{summary.revenueChange.toFixed(1)}% vs previous
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950 dark:to-rose-950">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <Target className="h-5 w-5 text-red-600" />
                {getChangeIcon(summary.spendChange)}
              </div>
              <p className="text-2xl font-bold text-red-900 dark:text-red-100">{formatCurrency(summary.totalSpend)}</p>
              <p className="text-sm text-red-700 dark:text-red-400">Total Spend</p>
              <p className={`text-xs mt-1 ${getChangeColor(-summary.spendChange)}`}>
                {summary.spendChange > 0 ? '+' : ''}{summary.spendChange.toFixed(1)}% vs previous
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm bg-gradient-to-br from-cyan-50 to-sky-50 dark:from-cyan-950 dark:to-sky-950">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <TrendingUp className="h-5 w-5 text-cyan-600" />
                {getChangeIcon(summary.roasChange)}
              </div>
              <p className="text-2xl font-bold text-cyan-900 dark:text-cyan-100">{summary.avgRoas.toFixed(2)}x</p>
              <p className="text-sm text-cyan-700 dark:text-cyan-400">Avg ROAS</p>
              <p className={`text-xs mt-1 ${getChangeColor(summary.roasChange)}`}>
                {summary.roasChange > 0 ? '+' : ''}{summary.roasChange.toFixed(1)}% vs previous
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950 dark:to-purple-950">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <BarChart3 className="h-5 w-5 text-violet-600" />
              </div>
              <p className="text-2xl font-bold text-violet-900 dark:text-violet-100">{formatCurrency(summary.totalProfit)}</p>
              <p className="text-sm text-violet-700 dark:text-violet-400">Net Profit</p>
              <p className="text-xs mt-1 text-muted-foreground">
                Revenue minus spend
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Revenue vs Spend Chart */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Revenue vs Spend</CardTitle>
          <CardDescription>Compare ad spend against revenue generated</CardDescription>
        </CardHeader>
        <CardContent>
          {roiData.length > 0 ? (
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <AreaChart data={roiData}>
                <defs>
                  <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
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
                  tickFormatter={(v) => formatCurrency(v)}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#10b981"
                  fill="url(#colorRevenue)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="spend"
                  stroke="#ef4444"
                  fill="url(#colorSpend)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
              <BarChart3 className="h-12 w-12 mb-2" />
              <p>No revenue vs spend data available</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ROAS Trend & Channel Comparison */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* ROAS Trend */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">ROAS Trend</CardTitle>
            <CardDescription>Return on ad spend over time</CardDescription>
          </CardHeader>
          <CardContent>
            {roiData.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[250px] w-full">
                <LineChart data={roiData}>
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
                    tickFormatter={(v) => `${v}x`}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line
                    type="monotone"
                    dataKey="roas"
                    stroke="#06b6d4"
                    strokeWidth={2}
                    dot={{ r: 4, fill: '#06b6d4' }}
                  />
                </LineChart>
              </ChartContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-[250px] text-muted-foreground">
                <TrendingUp className="h-12 w-12 mb-2" />
                <p>No ROAS trend data available</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Channel Comparison */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Channel Comparison</CardTitle>
            <CardDescription>Performance by advertising channel</CardDescription>
          </CardHeader>
          <CardContent>
            {channelData.length > 0 ? (
              <div className="space-y-4">
                {channelData.map((channel, index) => (
                  <div key={channel.channel} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="font-medium capitalize">{channel.channel}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-semibold">{channel.roas.toFixed(2)}x</span>
                        <span className="text-sm text-muted-foreground ml-2">
                          {formatCurrency(channel.revenue)}
                        </span>
                      </div>
                    </div>
                    <Progress value={channel.percentage} className="h-2" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
                <BarChart3 className="h-12 w-12 mb-2" />
                <p>No channel data available</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Trend Analysis */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            <CardTitle className="text-lg">Trend Insights</CardTitle>
          </div>
          <CardDescription>Key observations and recommendations</CardDescription>
        </CardHeader>
        <CardContent>
          {insights.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {insights.map((insight, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg border ${
                    insight.type === 'positive'
                      ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950 dark:border-emerald-800'
                      : insight.type === 'negative'
                      ? 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800'
                      : 'bg-muted/50 border-muted'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 ${
                      insight.type === 'positive' ? 'text-emerald-600' : 
                      insight.type === 'negative' ? 'text-red-600' : 'text-muted-foreground'
                    }`}>
                      {insight.type === 'positive' ? (
                        <TrendingUp className="h-5 w-5" />
                      ) : insight.type === 'negative' ? (
                        <AlertTriangle className="h-5 w-5" />
                      ) : (
                        <BarChart3 className="h-5 w-5" />
                      )}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">{insight.title}</h4>
                      <p className="text-sm text-muted-foreground mt-1">{insight.description}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge
                          variant="secondary"
                          className={
                            insight.type === 'positive'
                              ? 'bg-emerald-100 text-emerald-700'
                              : insight.type === 'negative'
                              ? 'bg-red-100 text-red-700'
                              : ''
                          }
                        >
                          {insight.trend}
                        </Badge>
                        <span className="text-sm font-medium">
                          {typeof insight.value === 'number' && insight.value < 100
                            ? `${insight.value.toFixed(1)}%`
                            : formatCurrency(insight.value)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Zap className="h-12 w-12 mb-2" />
              <p>No trend insights available</p>
              <p className="text-sm">Insights will appear as more data is collected</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Profit Trend */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Profit Trend</CardTitle>
          <CardDescription>Net profit (revenue - spend) over time</CardDescription>
        </CardHeader>
        <CardContent>
          {roiData.length > 0 ? (
            <ChartContainer config={chartConfig} className="h-[250px] w-full">
              <BarChart data={roiData}>
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
                  tickFormatter={(v) => formatCurrency(v)}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar
                  dataKey="profit"
                  fill="#06b6d4"
                  radius={[4, 4, 0, 0]}
                >
                  {roiData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.profit >= 0 ? '#10b981' : '#ef4444'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-[250px] text-muted-foreground">
              <BarChart3 className="h-12 w-12 mb-2" />
              <p>No profit trend data available</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
