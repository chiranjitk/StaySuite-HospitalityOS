'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart';
import {
  Line,
  LineChart,
  Bar,
  BarChart,
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  ResponsiveContainer,
} from 'recharts';
import {
  Calendar,
  TrendingUp,
  TrendingDown,
  Eye,
  MousePointer,
  ShoppingCart,
  DollarSign,
  Target,
  BarChart3,
  RefreshCw,
  Download,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, subDays, eachDayOfInterval } from 'date-fns';
import { useCurrency } from '@/contexts/CurrencyContext';
import { exportToCSV } from '@/lib/export-utils';

interface PerformanceMetric {
  date: string;
  impressions: number;
  clicks: number;
  conversions: number;
  cost: number;
  revenue: number;
  ctr: number;
  cpc: number;
  cpa: number;
  roas: number;
  conversionRate: number;
}

interface PerformanceSummary {
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  totalCost: number;
  totalRevenue: number;
  avgCtr: number;
  avgCpc: number;
  avgCpa: number;
  avgRoas: number;
  avgConversionRate: number;
  impressionsChange: number;
  clicksChange: number;
  conversionsChange: number;
  costChange: number;
  revenueChange: number;
}

interface ConversionData {
  source: string;
  conversions: number;
  revenue: number;
  cost: number;
}

const chartConfig = {
  impressions: {
    label: 'Impressions',
    color: '#10b981',
  },
  clicks: {
    label: 'Clicks',
    color: '#f59e0b',
  },
  conversions: {
    label: 'Conversions',
    color: '#8b5cf6',
  },
  cost: {
    label: 'Cost',
    color: '#ef4444',
  },
  revenue: {
    label: 'Revenue',
    color: '#06b6d4',
  },
} satisfies ChartConfig;

const dateRanges = [
  { value: '7', label: 'Last 7 days' },
  { value: '14', label: 'Last 14 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '60', label: 'Last 60 days' },
  { value: '90', label: 'Last 90 days' },
];

export default function PerformanceTracking() {
  const { formatCurrency } = useCurrency();
  const [performanceData, setPerformanceData] = useState<PerformanceMetric[]>([]);
  const [summary, setSummary] = useState<PerformanceSummary | null>(null);
  const [conversionData, setConversionData] = useState<ConversionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30');
  const [campaignFilter, setCampaignFilter] = useState('all');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        days: dateRange,
        campaign: campaignFilter,
      });

      const response = await fetch(`/api/ads/performance?${params}`);
      const data = await response.json();

      if (data.success) {
        setPerformanceData(data.data.performance);
        setSummary(data.data.summary);
        setConversionData(data.data.conversions || []);
      } else {
        toast.error('Failed to load performance data');
      }
    } catch (error) {
      console.error('Error fetching performance:', error);
      toast.error('Failed to load performance data');
    } finally {
      setLoading(false);
    }
  }, [dateRange, campaignFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      notation: 'compact',
      compactDisplay: 'short',
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), 'MMM dd');
  };

  const getChangeIcon = (value: number) => {
    if (value > 0) return <ArrowUpRight className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />;
    if (value < 0) return <ArrowDownRight className="h-3 w-3 text-red-600 dark:text-red-400" />;
    return null;
  };

  const getChangeColor = (value: number) => {
    if (value > 0) return 'text-emerald-600 dark:text-emerald-400';
    if (value < 0) return 'text-red-600 dark:text-red-400';
    return 'text-gray-500 dark:text-gray-400';
  };

  if (loading && !summary) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-24" />
          </div>
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
          <h2 className="text-2xl font-bold">Performance Tracking</h2>
          <p className="text-muted-foreground">
            Monitor ad impressions, clicks, and conversions
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
          <Select value={campaignFilter} onValueChange={setCampaignFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Campaign" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Campaigns</SelectItem>
              <SelectItem value="google">Google</SelectItem>
              <SelectItem value="meta">Meta</SelectItem>
              <SelectItem value="tripadvisor">TripAdvisor</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportToCSV(
            performanceData as unknown as Record<string, unknown>[],
            `ad-performance-${dateRange}d`,
            [
              { key: 'date', label: 'Date' },
              { key: 'impressions', label: 'Impressions' },
              { key: 'clicks', label: 'Clicks' },
              { key: 'conversions', label: 'Conversions' },
              { key: 'cost', label: 'Cost ($)' },
              { key: 'revenue', label: 'Revenue ($)' },
              { key: 'ctr', label: 'CTR (%)' },
              { key: 'cpc', label: 'CPC ($)' },
              { key: 'cpa', label: 'CPA ($)' },
              { key: 'roas', label: 'ROAS' },
              { key: 'conversionRate', label: 'Conv. Rate (%)' },
            ]
          )}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <Eye className="h-4 w-4 text-muted-foreground" />
                {getChangeIcon(summary.impressionsChange)}
              </div>
              <p className="text-2xl font-bold">{formatNumber(summary.totalImpressions)}</p>
              <p className="text-xs text-muted-foreground">Impressions</p>
              <p className={`text-xs mt-1 ${getChangeColor(summary.impressionsChange)}`}>
                {summary.impressionsChange > 0 ? '+' : ''}{summary.impressionsChange.toFixed(1)}%
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <MousePointer className="h-4 w-4 text-muted-foreground" />
                {getChangeIcon(summary.clicksChange)}
              </div>
              <p className="text-2xl font-bold">{formatNumber(summary.totalClicks)}</p>
              <p className="text-xs text-muted-foreground">Clicks</p>
              <p className={`text-xs mt-1 ${getChangeColor(summary.clicksChange)}`}>
                {summary.clicksChange > 0 ? '+' : ''}{summary.clicksChange.toFixed(1)}%
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                {getChangeIcon(summary.conversionsChange)}
              </div>
              <p className="text-2xl font-bold">{summary.totalConversions}</p>
              <p className="text-xs text-muted-foreground">Conversions</p>
              <p className={`text-xs mt-1 ${getChangeColor(summary.conversionsChange)}`}>
                {summary.conversionsChange > 0 ? '+' : ''}{summary.conversionsChange.toFixed(1)}%
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                {getChangeIcon(summary.costChange)}
              </div>
              <p className="text-2xl font-bold">{formatCurrency(summary.totalCost)}</p>
              <p className="text-xs text-muted-foreground">Cost</p>
              <p className={`text-xs mt-1 ${getChangeColor(summary.costChange)}`}>
                {summary.costChange > 0 ? '+' : ''}{summary.costChange.toFixed(1)}%
              </p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                {getChangeIcon(summary.revenueChange)}
              </div>
              <p className="text-2xl font-bold">{formatCurrency(summary.totalRevenue)}</p>
              <p className="text-xs text-muted-foreground">Revenue</p>
              <p className={`text-xs mt-1 ${getChangeColor(summary.revenueChange)}`}>
                {summary.revenueChange > 0 ? '+' : ''}{summary.revenueChange.toFixed(1)}%
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Key Metrics */}
      {summary && (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground">Avg CTR</p>
            <p className="text-lg font-semibold">{summary.avgCtr.toFixed(2)}%</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground">Avg CPC</p>
            <p className="text-lg font-semibold">{formatCurrency(summary.avgCpc)}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground">Avg CPA</p>
            <p className="text-lg font-semibold">{formatCurrency(summary.avgCpa)}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground">Avg ROAS</p>
            <p className="text-lg font-semibold">{summary.avgRoas.toFixed(2)}x</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50">
            <p className="text-xs text-muted-foreground">Conv. Rate</p>
            <p className="text-lg font-semibold">{summary.avgConversionRate.toFixed(2)}%</p>
          </div>
        </div>
      )}

      {/* Charts */}
      <Tabs defaultValue="trend" className="space-y-4">
        <TabsList>
          <TabsTrigger value="trend">Trend</TabsTrigger>
          <TabsTrigger value="comparison">Comparison</TabsTrigger>
          <TabsTrigger value="conversions">Conversions</TabsTrigger>
        </TabsList>

        <TabsContent value="trend" className="space-y-4">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Performance Trend</CardTitle>
              <CardDescription>Daily metrics over time</CardDescription>
            </CardHeader>
            <CardContent>
              {performanceData.length > 0 ? (
                <ChartContainer config={chartConfig} className="h-[350px] w-full">
                  <AreaChart data={performanceData}>
                    <defs>
                      <linearGradient id="colorImpressions" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
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
                      tickFormatter={formatNumber}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area
                      type="monotone"
                      dataKey="impressions"
                      stroke="#10b981"
                      fill="url(#colorImpressions)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="clicks"
                      stroke="#f59e0b"
                      fill="url(#colorClicks)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ChartContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-[350px] text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mb-2" />
                  <p>No performance data available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comparison" className="space-y-4">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Cost vs Revenue</CardTitle>
              <CardDescription>Compare spend against revenue generated</CardDescription>
            </CardHeader>
            <CardContent>
              {performanceData.length > 0 ? (
                <ChartContainer config={chartConfig} className="h-[350px] w-full">
                  <BarChart data={performanceData}>
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
                    <Bar dataKey="cost" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="revenue" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-[350px] text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mb-2" />
                  <p>No comparison data available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conversions" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Conversion Trend</CardTitle>
                <CardDescription>Daily conversions over time</CardDescription>
              </CardHeader>
              <CardContent>
                {performanceData.length > 0 ? (
                  <ChartContainer config={chartConfig} className="h-[250px] w-full">
                    <LineChart data={performanceData}>
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
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line
                        type="monotone"
                        dataKey="conversions"
                        stroke="#8b5cf6"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                      />
                    </LineChart>
                  </ChartContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[250px] text-muted-foreground">
                    <Target className="h-12 w-12 mb-2" />
                    <p>No conversion data available</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Conversion by Source</CardTitle>
                <CardDescription>Breakdown by advertising platform</CardDescription>
              </CardHeader>
              <CardContent>
                {conversionData.length > 0 ? (
                  <ScrollArea className="h-[250px]">
                    <div className="space-y-3">
                      {conversionData.map((item, index) => (
                        <div
                          key={item.source}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{
                                backgroundColor: ['#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'][index % 5],
                              }}
                            />
                            <span className="font-medium capitalize">{item.source}</span>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">{item.conversions} conv.</p>
                            <p className="text-xs text-muted-foreground">{formatCurrency(item.revenue)} revenue</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[250px] text-muted-foreground">
                    <Target className="h-12 w-12 mb-2" />
                    <p>No conversion breakdown available</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Daily Breakdown */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Daily Breakdown</CardTitle>
          <CardDescription>Detailed metrics for each day</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-2">
              {performanceData.length > 0 ? (
                performanceData.map((day) => (
                  <div
                    key={day.date}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="w-24">
                      <p className="font-medium">{format(new Date(day.date), 'EEE')}</p>
                      <p className="text-sm text-muted-foreground">{formatDate(day.date)}</p>
                    </div>
                    <div className="grid grid-cols-6 gap-4 text-sm text-center flex-1">
                      <div>
                        <p className="font-semibold">{formatNumber(day.impressions)}</p>
                        <p className="text-xs text-muted-foreground">Impr.</p>
                      </div>
                      <div>
                        <p className="font-semibold">{formatNumber(day.clicks)}</p>
                        <p className="text-xs text-muted-foreground">Clicks</p>
                      </div>
                      <div>
                        <p className="font-semibold">{day.conversions}</p>
                        <p className="text-xs text-muted-foreground">Conv.</p>
                      </div>
                      <div>
                        <p className="font-semibold">{day.ctr.toFixed(2)}%</p>
                        <p className="text-xs text-muted-foreground">CTR</p>
                      </div>
                      <div>
                        <p className="font-semibold">{formatCurrency(day.cost)}</p>
                        <p className="text-xs text-muted-foreground">Cost</p>
                      </div>
                      <div>
                        <p className="font-semibold">{formatCurrency(day.revenue)}</p>
                        <p className="text-xs text-muted-foreground">Revenue</p>
                      </div>
                    </div>
                    <div className="w-20 text-right">
                      <Badge variant={day.roas >= 1 ? 'default' : 'secondary'}>
                        {day.roas.toFixed(2)}x
                      </Badge>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No daily breakdown available
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
