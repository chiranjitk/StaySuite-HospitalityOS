'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
  ResponsiveContainer,
  Area,
  AreaChart,
  Cell,
} from 'recharts';
import {
  Calendar,
  CalendarDays,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Target,
  Brain,
  BarChart3,
  Zap,
  Download,
  RefreshCw,
  Sun,
  Cloud,
  CloudRain,
  Snowflake,
  Music,
  Users,
  Building2,
  PartyPopper,
  Info,
  Loader2,
} from 'lucide-react';
import { format, addDays, parseISO, eachDayOfInterval } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { exportToCSV } from '@/lib/export-utils';
import { useUIStore } from '@/store';

interface ForecastDataPoint {
  date: string;
  predicted: number;
  actual?: number;
  lowerBound: number;
  upperBound: number;
  confidence: number;
  isWeekend: boolean;
  hasEvent: boolean;
}

interface Insight {
  id: string;
  type: 'opportunity' | 'warning' | 'info';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  date: string;
  action?: string;
}

interface SeasonalTrend {
  season: string;
  avgOccupancy: number;
  trend: number;
  peak: string;
  low: string;
}

interface EventImpact {
  id: string;
  name: string;
  type: string;
  date: string;
  expectedImpact: number;
  confidence: number;
  radius: number; // km
}

interface DemandForecastData {
  forecast: ForecastDataPoint[];
  insights: Insight[];
  seasonalTrends: SeasonalTrend[];
  eventImpacts: EventImpact[];
  metrics: {
    accuracy: number;
    avgPredictedOccupancy: number;
    peakDays: number;
    lowDays: number;
    seasonalFactor: number;
    bookingPace: number;
    pickupRate: number;
  };
}

const chartConfig = {
  predicted: { label: 'Predicted', color: '#10b981' },
  actual: { label: 'Actual', color: '#f59e0b' },
  lowerBound: { label: 'Lower Bound', color: '#10b98150' },
  upperBound: { label: 'Upper Bound', color: '#10b98150' },
} satisfies ChartConfig;

function formatDate(dateStr: string) {
  return format(parseISO(dateStr), 'MMM dd');
}

function formatFullDate(dateStr: string) {
  return format(parseISO(dateStr), 'EEEE, MMMM d, yyyy');
}

const weatherIcons: Record<string, React.ElementType> = {
  sunny: Sun,
  cloudy: Cloud,
  rainy: CloudRain,
  snowy: Snowflake,
};

const eventTypeIcons: Record<string, React.ElementType> = {
  concert: Music,
  conference: Users,
  festival: PartyPopper,
  sports: Target,
  holiday: Building2,
  other: CalendarDays,
};

const DEFAULT_METRICS: DemandForecastData['metrics'] = {
  accuracy: 0,
  avgPredictedOccupancy: 0,
  peakDays: 0,
  lowDays: 0,
  seasonalFactor: 1.0,
  bookingPace: 0,
  pickupRate: 0,
};

export default function DemandForecastingPage() {
  const { toast } = useToast();
  const [data, setData] = useState<DemandForecastData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [forecastHorizon, setForecastHorizon] = useState('30');
  const [roomType, setRoomType] = useState('all');
  const [activeTab, setActiveTab] = useState('forecast');

  const metrics = data?.metrics ?? DEFAULT_METRICS;

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/revenue/demand-forecast?horizon=${forecastHorizon}&roomType=${roomType}`);
      const result = await response.json();

      if (result.success) {
        // Ensure metrics always exists even if API omits it
        const raw = result.data ?? {};
        if (!raw.metrics) {
          raw.metrics = { ...DEFAULT_METRICS };
        } else {
          raw.metrics = {
            accuracy: raw.metrics.accuracy ?? 0,
            avgPredictedOccupancy: raw.metrics.avgPredictedOccupancy ?? 0,
            peakDays: raw.metrics.peakDays ?? 0,
            lowDays: raw.metrics.lowDays ?? 0,
            seasonalFactor: raw.metrics.seasonalFactor ?? 1.0,
            bookingPace: raw.metrics.bookingPace ?? 0,
            pickupRate: raw.metrics.pickupRate ?? 0,
          };
        }
        setData(raw);
      } else {
        // No forecast data available — show empty state instead of mock data
        toast({
          title: 'No Forecast Data',
          description: result.error?.message || 'No forecast data available. Historical booking data may be insufficient.',
          variant: 'destructive',
        });
        setData(null);
      }
    } catch (error) {
      console.error('Failed to fetch demand forecast:', error);
      toast({
        title: 'Error',
        description: 'Failed to load demand forecast data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [forecastHorizon, roomType, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-24" />
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

  if (!data) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">Demand Forecasting</h2>
            <p className="text-muted-foreground">AI-powered demand prediction and strategic insights</p>
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
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
        <Card className="border-0 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="p-4 rounded-full bg-muted mb-4">
              <TrendingDown className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-muted-foreground">No Forecast Data Available</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              Insufficient historical booking data to generate a demand forecast. At least 30 bookings are needed for meaningful predictions.
            </p>
            <Button variant="outline" size="sm" className="mt-4" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Demand Forecasting</h2>
          <p className="text-muted-foreground">AI-powered demand prediction and strategic insights</p>
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
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => exportToCSV(
            data.forecast.map(f => ({
              date: f.date,
              predicted: f.predicted,
              actual: f.actual ?? '',
              lowerBound: f.lowerBound,
              upperBound: f.upperBound,
              confidence: f.confidence,
              isWeekend: f.isWeekend,
              hasEvent: f.hasEvent,
            })),
            `demand-forecast-${forecastHorizon}d`,
            [
              { key: 'date', label: 'Date' },
              { key: 'predicted', label: 'Predicted Occupancy (%)' },
              { key: 'actual', label: 'Actual Occupancy (%)' },
              { key: 'lowerBound', label: 'Lower Bound (%)' },
              { key: 'upperBound', label: 'Upper Bound (%)' },
              { key: 'confidence', label: 'Confidence (%)' },
              { key: 'isWeekend', label: 'Weekend' },
              { key: 'hasEvent', label: 'Event' },
            ]
          )}>
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Predicted Occupancy</p>
                <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">{metrics.avgPredictedOccupancy}%</p>
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
                <p className="text-2xl font-bold text-amber-900 dark:text-amber-100">{metrics.accuracy}%</p>
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
                <p className="text-2xl font-bold text-violet-900 dark:text-violet-100">{metrics.peakDays}</p>
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
                <p className="text-sm font-medium text-cyan-700 dark:text-cyan-400">Booking Pace</p>
                <p className="text-2xl font-bold text-cyan-900 dark:text-cyan-100">{metrics.bookingPace}x</p>
                <p className="text-xs text-cyan-600 dark:text-cyan-400 mt-1">
                  vs same period last year
                </p>
              </div>
              <div className="p-3 rounded-full bg-cyan-200 dark:bg-cyan-800">
                <BarChart3 className="h-6 w-6 text-cyan-700 dark:text-cyan-300" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="forecast">Forecast Chart</TabsTrigger>
          <TabsTrigger value="seasonal">Seasonal Trends</TabsTrigger>
          <TabsTrigger value="events">Event Impact</TabsTrigger>
          <TabsTrigger value="insights">AI Insights</TabsTrigger>
        </TabsList>

        {/* Forecast Tab */}
        <TabsContent value="forecast" className="space-y-6">
          {/* Main Forecast Chart */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Demand Forecast</CardTitle>
              <CardDescription>Predicted occupancy with confidence intervals</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[350px] w-full">
                <AreaChart data={data.forecast}>
                  <defs>
                    <linearGradient id="colorConfidence" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDate}
                    className="text-xs"
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    className="text-xs"
                    tickLine={false}
                    axisLine={false}
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <ChartTooltip
                    content={<ChartTooltipContent />}
                    labelFormatter={(label) => formatFullDate(label as string)}
                  />
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

          {/* Daily Forecast */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Daily Forecast Breakdown</CardTitle>
              <CardDescription>Day-by-day occupancy prediction</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-2">
                  {data.forecast.map((day) => (
                    <div
                      key={day.date}
                      className={cn(
                        'flex items-center justify-between p-3 rounded-lg transition-colors',
                        day.isWeekend ? 'bg-violet-50 dark:bg-violet-950/20' : 'bg-muted/30',
                        day.hasEvent && 'border-l-4 border-amber-500'
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-16 text-sm font-medium">
                          {format(parseISO(day.date), 'EEE')}
                        </div>
                        <div className="w-20 text-sm text-muted-foreground">
                          {format(parseISO(day.date), 'MMM dd')}
                        </div>
                        {day.isWeekend && (
                          <Badge variant="secondary" className="text-xs bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                            Weekend
                          </Badge>
                        )}
                        {day.hasEvent && (
                          <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                            Event
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="w-32">
                          <Progress value={day.predicted} className="h-2" />
                        </div>
                        <div className="w-16 text-right">
                          <span
                            className={cn(
                              'text-sm font-medium',
                              day.predicted >= 85
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : day.predicted >= 60
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-orange-600 dark:text-orange-400'
                            )}
                          >
                            {day.predicted}%
                          </span>
                        </div>
                        <div className="w-16 text-right text-xs text-muted-foreground">
                          {day.confidence.toFixed(0)}% conf
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Seasonal Trends Tab */}
        <TabsContent value="seasonal" className="space-y-6">
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
            {/* Seasonal Chart */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Seasonal Occupancy Patterns</CardTitle>
                <CardDescription>Average occupancy by season</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[250px] w-full">
                  <BarChart data={data.seasonalTrends}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" vertical={false} />
                    <XAxis dataKey="season" className="text-xs" tickLine={false} axisLine={false} tickFormatter={(v) => v.split(' ')[0]} />
                    <YAxis className="text-xs" tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="avgOccupancy" radius={[4, 4, 0, 0]}>
                      {data.seasonalTrends.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={chartConfig.predicted.color} fillOpacity={0.6 + index * 0.1} />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Season Details */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Seasonal Details</CardTitle>
                <CardDescription>Trend analysis for each season</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.seasonalTrends.map((season) => (
                    <div key={season.season} className="p-4 rounded-lg bg-muted/30">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{season.season}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold">{season.avgOccupancy}%</span>
                          <Badge variant="secondary" className={season.trend >= 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}>
                            {season.trend >= 0 ? '+' : ''}{season.trend}%
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>Peak: <strong className="text-foreground">{season.peak}</strong></span>
                        <span>Low: <strong className="text-foreground">{season.low}</strong></span>
                      </div>
                      <Progress value={season.avgOccupancy} className="h-2 mt-2" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Seasonal Factor Info */}
          <Card className="border-0 shadow-sm bg-gradient-to-r from-cyan-50 to-teal-50 dark:from-cyan-950 dark:to-teal-950">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-full bg-cyan-200 dark:bg-cyan-800">
                  <Info className="h-6 w-6 text-cyan-700 dark:text-cyan-300" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Current Seasonal Factor: {metrics.seasonalFactor}x</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    This factor indicates how current demand compares to the annual average. A factor above 1.0 suggests above-average demand for this period.
                    Consider adjusting pricing strategies accordingly.
                  </p>
                  <div className="flex items-center gap-4 mt-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Pickup Rate:</span>
                      <Badge variant="secondary">{metrics.pickupRate} rooms/day</Badge>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Events Tab */}
        <TabsContent value="events" className="space-y-6">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <PartyPopper className="h-5 w-5 text-amber-500 dark:text-amber-400" />
                <CardTitle className="text-lg">Upcoming Events Impact</CardTitle>
              </div>
              <CardDescription>Events that may affect demand in your area</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {data.eventImpacts.map((event) => {
                  const EventIcon = eventTypeIcons[event.type] || CalendarDays;
                  return (
                    <Card key={event.id} className="overflow-hidden">
                      <CardContent className="p-0">
                        <div className="flex items-center p-4">
                          <div className="p-3 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                            <EventIcon className="h-5 w-5" />
                          </div>
                          <div className="flex-1 ml-4">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium">{event.name}</h4>
                              <Badge variant="outline" className="capitalize">{event.type}</Badge>
                            </div>
                            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                              <span>{format(parseISO(event.date), 'EEEE, MMMM d')}</span>
                              <span>Within {event.radius} km radius</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                              <TrendingUp className="h-4 w-4" />
                              <span className="font-bold">+{event.expectedImpact}%</span>
                            </div>
                            <p className="text-xs text-muted-foreground">{event.confidence}% confidence</p>
                          </div>
                        </div>
                        <div className="bg-muted/30 px-4 py-2 flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Expected demand increase</span>
                          <Progress value={event.expectedImpact * 2} className="w-24 h-2" />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Insights Tab */}
        <TabsContent value="insights" className="space-y-6">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-amber-500 dark:text-amber-400" />
                <CardTitle className="text-lg">AI-Powered Insights</CardTitle>
              </div>
              <CardDescription>Actionable recommendations based on forecast analysis</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.insights.map((insight) => (
                  <div
                    key={insight.id}
                    className={cn(
                      'p-4 rounded-lg border',
                      insight.type === 'opportunity'
                        ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950 dark:border-emerald-800'
                        : insight.type === 'warning'
                        ? 'bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800'
                        : 'bg-muted/50 border-muted'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          'mt-0.5',
                          insight.type === 'opportunity'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : insight.type === 'warning'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-muted-foreground'
                        )}
                      >
                        {insight.type === 'opportunity' ? (
                          <TrendingUp className="h-5 w-5" />
                        ) : insight.type === 'warning' ? (
                          <AlertTriangle className="h-5 w-5" />
                        ) : (
                          <Info className="h-5 w-5" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-sm">{insight.title}</h4>
                          <Badge
                            variant="secondary"
                            className={cn(
                              'text-xs',
                              insight.impact === 'high'
                                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                : insight.impact === 'medium'
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                : 'bg-muted'
                            )}
                          >
                            {insight.impact} impact
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{insight.description}</p>
                        <div className="flex items-center justify-between mt-2">
                          <p className="text-xs text-muted-foreground">
                            {format(parseISO(insight.date), 'MMM dd, yyyy')}
                          </p>
                          {insight.action && (
                            <Button variant="outline" size="sm" onClick={() => useUIStore.getState().setActiveSection('revenue-ai')}>
                              {insight.action}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
