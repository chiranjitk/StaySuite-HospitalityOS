'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  ResponsiveContainer,
  Legend,
  Area,
  AreaChart,
} from 'recharts';
import {
  Calendar,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Target,
  Brain,
  BarChart3,
  Zap,
  Download,
  RefreshCw,
} from 'lucide-react';
import { format, addDays, eachDayOfInterval } from 'date-fns';
import { toast } from 'sonner';
import { exportToCSV } from '@/lib/export-utils';
import { useTimezone } from '@/contexts/TimezoneContext';

interface ForecastData {
  date: string;
  predicted: number;
  actual?: number;
  lowerBound: number;
  upperBound: number;
  confidence: number;
  isWeekend?: boolean;
  hasEvent?: boolean;
}

interface DemandInsight {
  id: string;
  type: 'opportunity' | 'warning' | 'info';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  date: string;
  action?: string;
}

interface DemandForecastMetrics {
  accuracy: number;
  avgPredictedOccupancy: number;
  peakDays: number;
  lowDays: number;
  seasonalFactor: number;
  bookingPace: number;
  pickupRate: number;
}

interface DemandForecast {
  forecast: ForecastData[];
  insights: DemandInsight[];
  seasonalTrends: Array<{ season: string; avgOccupancy: number; trend: number; peak: string; low: string }>;
  eventImpacts: Array<{ id: string; name: string; type: string; date: string; expectedImpact: number; confidence: number; radius: number }>;
  metrics: DemandForecastMetrics;
}

const chartConfig = {
  predicted: {
    label: 'Predicted',
    color: '#10b981',
  },
  actual: {
    label: 'Actual',
    color: '#f59e0b',
  },
  lowerBound: {
    label: 'Lower Bound',
    color: '#10b98150',
  },
  upperBound: {
    label: 'Upper Bound',
    color: '#10b98150',
  },
} satisfies ChartConfig;

function formatChartDate(dateStr: string) {
  return format(new Date(dateStr), 'MMM dd');
}

export function DemandForecasting() {
  const { formatDate } = useTimezone();
  const [data, setData] = useState<DemandForecast | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [forecastHorizon, setForecastHorizon] = useState('30');
  const [roomType, setRoomType] = useState('all');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        horizon: forecastHorizon,
        roomType: roomType,
      });
      
      const response = await fetch(`/api/revenue/demand-forecast?${params}`);
      const result = await response.json();
      
      if (result.success) {
        const raw = result.data ?? {};
        // Ensure metrics always exists even if API omits it
        if (!raw.metrics) {
          raw.metrics = { accuracy: 0, avgPredictedOccupancy: 0, peakDays: 0, lowDays: 0, seasonalFactor: 1.0, bookingPace: 0, pickupRate: 0 };
        }
        // Support both field names for backward compatibility
        if (!raw.forecast && raw.forecastData) {
          raw.forecast = raw.forecastData;
        }
        setData(raw);
      } else {
        toast.error('Failed to load demand forecast');
      }
    } catch (error) {
      console.error('Error fetching demand forecast:', error);
      toast.error('Failed to load demand forecast');
    } finally {
      setIsLoading(false);
    }
  }, [forecastHorizon, roomType]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Demand Forecasting</h2>
          <p className="text-muted-foreground">AI-powered demand prediction and insights</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={forecastHorizon} onValueChange={setForecastHorizon}>
            <SelectTrigger className="w-36">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 days</SelectItem>
              <SelectItem value="14">14 days</SelectItem>
              <SelectItem value="30">30 days</SelectItem>
              <SelectItem value="60">60 days</SelectItem>
              <SelectItem value="90">90 days</SelectItem>
            </SelectContent>
          </Select>
          <Select value={roomType} onValueChange={setRoomType}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Rooms</SelectItem>
              <SelectItem value="standard">Standard</SelectItem>
              <SelectItem value="deluxe">Deluxe</SelectItem>
              <SelectItem value="suite">Suite</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="gap-2" onClick={fetchData}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => exportToCSV(
            (data.forecast ?? []).map(f => ({
              date: f.date,
              predicted: f.predicted,
              actual: f.actual ?? '',
              lowerBound: f.lowerBound,
              upperBound: f.upperBound,
              confidence: f.confidence,
            })),
            `demand-forecast-${forecastHorizon}d`,
            [
              { key: 'date', label: 'Date' },
              { key: 'predicted', label: 'Predicted (%)' },
              { key: 'actual', label: 'Actual (%)' },
              { key: 'lowerBound', label: 'Lower Bound (%)' },
              { key: 'upperBound', label: 'Upper Bound (%)' },
              { key: 'confidence', label: 'Confidence (%)' },
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
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Predicted Occupancy</p>
                <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">{data.metrics.avgPredictedOccupancy}%</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                  Average for next {forecastHorizon} days
                </p>
              </div>
              <div className="p-3 rounded-full bg-emerald-200 dark:bg-emerald-800">
                <Target className="h-6 w-6 text-emerald-700 dark:text-emerald-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Forecast Accuracy</p>
                <p className="text-2xl font-bold text-amber-900 dark:text-amber-100">{data.metrics.accuracy}%</p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  Based on historical data
                </p>
              </div>
              <div className="p-3 rounded-full bg-amber-200 dark:bg-amber-800">
                <Brain className="h-6 w-6 text-amber-700 dark:text-amber-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-violet-50 to-violet-100 dark:from-violet-950 dark:to-violet-900">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-violet-700 dark:text-violet-400">Peak Demand Days</p>
                <p className="text-2xl font-bold text-violet-900 dark:text-violet-100">{data.metrics.peakDays}</p>
                <p className="text-xs text-violet-600 dark:text-violet-400 mt-1">
                  Days with 85%+ occupancy
                </p>
              </div>
              <div className="p-3 rounded-full bg-violet-200 dark:bg-violet-800">
                <TrendingUp className="h-6 w-6 text-violet-700 dark:text-violet-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-950 dark:to-cyan-900">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-cyan-700 dark:text-cyan-400">Seasonal Factor</p>
                <p className="text-2xl font-bold text-cyan-900 dark:text-cyan-100">{data.metrics.seasonalFactor}x</p>
                <p className="text-xs text-cyan-600 dark:text-cyan-400 mt-1">
                  Current period adjustment
                </p>
              </div>
              <div className="p-3 rounded-full bg-cyan-200 dark:bg-cyan-800">
                <BarChart3 className="h-6 w-6 text-cyan-700 dark:text-cyan-300" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Forecast Chart */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Demand Forecast</CardTitle>
          <CardDescription>Predicted occupancy with confidence intervals</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <AreaChart data={data.forecast ?? []}>
              <defs>
                <linearGradient id="colorConfidence" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
              <XAxis
                dataKey="date"
                tickFormatter={formatChartDate}
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
                dataKey="upperBound"
                stackId="1"
                stroke="none"
                fill="url(#colorConfidence)"
              />
              <Area
                type="monotone"
                dataKey="lowerBound"
                stackId="2"
                stroke="none"
                fill="white"
              />
              <Line
                type="monotone"
                dataKey="predicted"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="actual"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={false}
                strokeDasharray="5 5"
              />
            </AreaChart>
          </ChartContainer>
          <div className="flex justify-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-sm text-muted-foreground">Predicted</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <span className="text-sm text-muted-foreground">Actual</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-emerald-200" />
              <span className="text-sm text-muted-foreground">Confidence Interval</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Insights and Day-by-Day Breakdown */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        {/* AI Insights */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500 dark:text-amber-400" />
              <CardTitle className="text-lg">AI Insights</CardTitle>
            </div>
            <CardDescription>Actionable recommendations based on forecast</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.insights.map((insight) => (
              <div
                key={insight.id}
                className={`p-3 rounded-lg border ${
                  insight.type === 'opportunity'
                    ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950 dark:border-emerald-800'
                    : insight.type === 'warning'
                    ? 'bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800'
                    : 'bg-muted/50 border-muted'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 ${
                    insight.type === 'opportunity' ? 'text-emerald-600 dark:text-emerald-400' : 
                    insight.type === 'warning' ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'
                  }`}>
                    {insight.type === 'opportunity' ? (
                      <TrendingUp className="h-5 w-5" />
                    ) : insight.type === 'warning' ? (
                      <AlertTriangle className="h-5 w-5" />
                    ) : (
                      <BarChart3 className="h-5 w-5" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-sm">{insight.title}</h4>
                      <Badge
                        variant="secondary"
                        className={`text-xs ${
                          insight.impact === 'high'
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            : insight.impact === 'medium'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                            : 'bg-muted'
                        }`}
                      >
                        {insight.impact} impact
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{insight.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDate(new Date(insight.date))}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Daily Forecast */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Daily Forecast</CardTitle>
            <CardDescription>Day-by-day occupancy prediction</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-[350px] overflow-y-auto space-y-2 pr-2">
              {(data.forecast ?? []).slice(0, 14).map((day) => (
                <div
                  key={day.date}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 text-sm font-medium">
                      {format(new Date(day.date), 'EEE')}
                    </div>
                    <div className="w-16 text-sm text-muted-foreground">
                      {formatChartDate(day.date)}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-24">
                      <Progress
                        value={day.predicted}
                        className="h-2"
                      />
                    </div>
                    <div className="w-12 text-right">
                      <span
                        className={`text-sm font-medium ${
                          day.predicted >= 85
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : day.predicted >= 60
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-orange-600 dark:text-orange-400'
                        }`}
                      >
                        {day.predicted}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
