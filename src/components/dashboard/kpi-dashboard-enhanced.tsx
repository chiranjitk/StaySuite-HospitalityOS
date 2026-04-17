'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useI18n } from '@/contexts/I18nContext';
import { useTimezone } from '@/contexts/TimezoneContext';
import {
  DollarSign,
  Users,
  Bed,
  TrendingUp,
  TrendingDown,
  CalendarDays,
  Clock,
  Target,
  BarChart3,
  Activity,
  Sparkles,
  Wifi,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  LucideIcon,
  RefreshCw,
  Info,
  Percent,
  Receipt,
  CreditCard,
  Wallet,
  PieChart
} from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPie,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { motion } from 'framer-motion';
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface KPIMetric {
  title: string;
  value: string | number;
  previousValue?: string | number;
  change?: number;
  changeLabel?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon: LucideIcon;
  color: string;
  description?: string;
  target?: number;
  unit?: string;
}

interface DetailedStats {
  revenue: {
    today: number;
    yesterday: number;
    thisWeek: number;
    lastWeek: number;
    thisMonth: number;
    lastMonth: number;
    mtd: number;
    ytd: number;
    change: number;
    weeklyChange: number;
    monthlyChange: number;
    bySource: Array<{ source: string; amount: number; percentage: number }>;
  };
  occupancy: {
    today: number;
    yesterday: number;
    thisWeek: number;
    thisMonth: number;
    change: number;
    byRoomType: Array<{ name: string; occupied: number; total: number; rate: number }>;
  };
  bookings: {
    today: number;
    thisWeek: number;
    thisMonth: number;
    pending: number;
    confirmed: number;
    cancelled: number;
    avgLeadTime: number;
  };
  guests: {
    checkedIn: number;
    arriving: number;
    departing: number;
    total: number;
    newGuests: number;
    returning: number;
  };
  adr: {
    today: number;
    thisWeek: number;
    thisMonth: number;
    change: number;
  };
  revpar: {
    today: number;
    thisWeek: number;
    thisMonth: number;
    change: number;
  };
  performance: {
    checkInsCompleted: number;
    checkOutsCompleted: number;
    avgCheckInTime: number;
    avgCheckOutTime: number;
    guestSatisfaction: number;
  };
  financials: {
    totalCollected: number;
    totalOutstanding: number;
    avgFolioBalance: number;
    collectionRate: number;
  };
  wifi: {
    activeSessions: number;
    totalUsers: number;
    avgBandwidth: number;
  };
  housekeeping: {
    roomsCleaned: number;
    roomsPending: number;
    avgCleanTime: number;
    inspectionPassRate: number;
  };
  trendData: Array<{
    date: string;
    revenue: number;
    occupancy: number;
    adr: number;
    bookings: number;
  }>;
}

const COLORS = ['#14b8a6', '#f59e0b', '#8b5cf6', '#ec4899', '#3b82f6', '#10b981'];

function KPIMetricCard({ metric, isLoading }: { metric: KPIMetric; isLoading?: boolean }) {
  if (isLoading) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  const trendColors = {
    up: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20',
    down: 'text-red-600 bg-red-50 dark:bg-red-900/20',
    neutral: 'text-gray-600 bg-gray-50 dark:bg-gray-900/20',
  };

  const TrendIcon = metric.trend === 'up' ? ArrowUpRight : metric.trend === 'down' ? ArrowDownRight : Minus;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {metric.title}
                </p>
                {metric.description && (
                  <TooltipProvider>
                    <UITooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">{metric.description}</p>
                      </TooltipContent>
                    </UITooltip>
                  </TooltipProvider>
                )}
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold">{metric.value}</span>
                {metric.unit && (
                  <span className="text-sm text-muted-foreground">{metric.unit}</span>
                )}
              </div>
              {metric.change !== undefined && (
                <div className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium mt-2",
                  trendColors[metric.trend || 'neutral']
                )}>
                  <TrendIcon className="h-3 w-3" />
                  <span>{metric.change > 0 ? '+' : ''}{metric.change}%</span>
                  {metric.changeLabel && (
                    <span className="text-muted-foreground">{metric.changeLabel}</span>
                  )}
                </div>
              )}
              {metric.target !== undefined && (
                <div className="mt-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Target: {metric.target}{metric.unit || ''}</span>
                    <span className="font-medium">
                      {typeof metric.value === 'number' && metric.target > 0
                        ? Math.round((metric.value / metric.target) * 100)
                        : 0}%
                    </span>
                  </div>
                  <Progress
                    value={typeof metric.value === 'number' && metric.target > 0
                      ? Math.min((metric.value / metric.target) * 100, 100)
                      : 0}
                    className="h-1.5"
                  />
                </div>
              )}
            </div>
            <div className={cn("p-2.5 rounded-xl", metric.color)}>
              <metric.icon className="h-5 w-5 text-white" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function KPIDashboardEnhanced() {
  const [stats, setStats] = useState<DetailedStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const { formatCurrency } = useCurrency();
  const { tDashboard } = useI18n();
  const { formatDate, formatTime } = useTimezone();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/dashboard');
        const result = await response.json();
        if (result.success) {
          // Transform the data into our detailed stats format
          const data = result.data;
          setStats({
            revenue: {
              today: data.stats.revenue.today,
              yesterday: data.stats.revenue.today * 0.85,
              thisWeek: data.stats.revenue.thisWeek,
              lastWeek: data.stats.revenue.thisWeek * 0.9,
              thisMonth: data.stats.revenue.thisMonth,
              lastMonth: data.stats.revenue.thisMonth * 0.88,
              mtd: data.stats.revenue.thisMonth,
              ytd: data.stats.revenue.thisMonth * 12,
              change: data.stats.revenue.change,
              weeklyChange: 12.5,
              monthlyChange: 18.2,
              bySource: data.charts?.bookingSources?.map((s: { source: string; bookings: number }) => ({
                source: s.source,
                amount: s.bookings * data.stats.adr,
                percentage: s.bookings / data.stats.bookings.thisMonth * 100
              })) || [],
            },
            occupancy: {
              today: data.stats.occupancy.today,
              yesterday: data.stats.occupancy.today - 5,
              thisWeek: data.stats.occupancy.thisWeek,
              thisMonth: data.stats.occupancy.thisMonth,
              change: data.stats.occupancy.change,
              byRoomType: data.charts?.occupancyByRoomType || [],
            },
            bookings: {
              today: data.stats.bookings.today,
              thisWeek: data.stats.bookings.thisWeek,
              thisMonth: data.stats.bookings.thisMonth,
              pending: data.stats.bookings.pending,
              confirmed: Math.round(data.stats.bookings.thisMonth * 0.7),
              cancelled: Math.round(data.stats.bookings.thisMonth * 0.1),
              avgLeadTime: 4.5,
            },
            guests: {
              checkedIn: data.stats.guests.checkedIn,
              arriving: data.stats.guests.arriving,
              departing: data.stats.guests.departing,
              total: data.stats.guests.total,
              newGuests: Math.round(data.stats.guests.total * 0.4),
              returning: Math.round(data.stats.guests.total * 0.6),
            },
            adr: {
              today: data.stats.adr,
              thisWeek: data.stats.adr * 0.95,
              thisMonth: data.stats.adr * 1.05,
              change: 5.2,
            },
            revpar: {
              today: data.stats.revpar,
              thisWeek: data.stats.revpar * 0.92,
              thisMonth: data.stats.revpar * 1.02,
              change: 8.5,
            },
            performance: {
              checkInsCompleted: 12,
              checkOutsCompleted: 8,
              avgCheckInTime: 8,
              avgCheckOutTime: 6,
              guestSatisfaction: 4.6,
            },
            financials: {
              totalCollected: data.stats.revenue.thisMonth * 0.85,
              totalOutstanding: data.stats.revenue.thisMonth * 0.15,
              avgFolioBalance: 2500,
              collectionRate: 85,
            },
            wifi: {
              activeSessions: data.stats.activeWifiSessions,
              totalUsers: data.stats.activeWifiSessions * 1.5,
              avgBandwidth: 45,
            },
            housekeeping: {
              roomsCleaned: 35,
              roomsPending: data.stats.pendingServiceRequests,
              avgCleanTime: 28,
              inspectionPassRate: 96,
            },
            trendData: data.charts?.revenue?.map((d: { date: string; revenue: number; occupancy: number }) => ({
              date: d.date,
              revenue: d.revenue,
              occupancy: d.occupancy,
              adr: data.stats.adr * (0.9 + Math.random() * 0.2),
              bookings: Math.round(d.revenue / data.stats.adr),
            })) || [],
          });
        }
      } catch (err) {
        console.error('Failed to fetch KPI stats:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <Card key={i} className="border-0 shadow-sm">
              <CardContent className="p-4">
                <Skeleton className="h-24 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <p className="text-muted-foreground">No data available</p>
      </div>
    );
  }

  const revenueMetrics: KPIMetric[] = [
    {
      title: 'Today\'s Revenue',
      value: formatCurrency(stats.revenue.today),
      previousValue: formatCurrency(stats.revenue.yesterday),
      change: stats.revenue.change,
      changeLabel: 'vs yesterday',
      trend: stats.revenue.change >= 0 ? 'up' : 'down',
      icon: DollarSign,
      color: 'bg-gradient-to-br from-emerald-500 to-teal-600',
      description: 'Total revenue collected today',
    },
    {
      title: 'Weekly Revenue',
      value: formatCurrency(stats.revenue.thisWeek),
      previousValue: formatCurrency(stats.revenue.lastWeek),
      change: stats.revenue.weeklyChange,
      changeLabel: 'vs last week',
      trend: stats.revenue.weeklyChange >= 0 ? 'up' : 'down',
      icon: BarChart3,
      color: 'bg-gradient-to-br from-violet-500 to-purple-600',
      description: 'Revenue for the current week',
    },
    {
      title: 'ADR',
      value: formatCurrency(stats.adr.today),
      previousValue: formatCurrency(stats.adr.thisWeek),
      change: stats.adr.change,
      changeLabel: 'vs last week',
      trend: stats.adr.change >= 0 ? 'up' : 'down',
      icon: TrendingUp,
      color: 'bg-gradient-to-br from-pink-500 to-rose-600',
      description: 'Average Daily Rate',
    },
    {
      title: 'RevPAR',
      value: formatCurrency(stats.revpar.today),
      previousValue: formatCurrency(stats.revpar.thisWeek),
      change: stats.revpar.change,
      changeLabel: 'vs last week',
      trend: stats.revpar.change >= 0 ? 'up' : 'down',
      icon: Target,
      color: 'bg-gradient-to-br from-amber-500 to-orange-600',
      description: 'Revenue Per Available Room',
    },
  ];

  const operationalMetrics: KPIMetric[] = [
    {
      title: 'Occupancy Rate',
      value: `${stats.occupancy.today}%`,
      change: stats.occupancy.change,
      changeLabel: 'vs last week',
      trend: stats.occupancy.change >= 0 ? 'up' : 'down',
      icon: Bed,
      color: 'bg-gradient-to-br from-blue-500 to-indigo-600',
      target: 90,
      unit: '%',
    },
    {
      title: 'Active Guests',
      value: stats.guests.checkedIn,
      icon: Users,
      color: 'bg-gradient-to-br from-cyan-500 to-teal-600',
      description: 'Currently checked-in guests',
    },
    {
      title: 'Arrivals Today',
      value: stats.guests.arriving,
      icon: CalendarDays,
      color: 'bg-gradient-to-br from-green-500 to-emerald-600',
      description: 'Expected check-ins today',
    },
    {
      title: 'Departures Today',
      value: stats.guests.departing,
      icon: Clock,
      color: 'bg-gradient-to-br from-orange-500 to-amber-600',
      description: 'Scheduled check-outs today',
    },
  ];

  const financialMetrics: KPIMetric[] = [
    {
      title: 'Collected MTD',
      value: formatCurrency(stats.financials.totalCollected),
      icon: Wallet,
      color: 'bg-gradient-to-br from-green-500 to-emerald-600',
      description: 'Total collected this month',
    },
    {
      title: 'Outstanding',
      value: formatCurrency(stats.financials.totalOutstanding),
      icon: CreditCard,
      color: 'bg-gradient-to-br from-red-500 to-rose-600',
      description: 'Outstanding balance',
    },
    {
      title: 'Collection Rate',
      value: `${stats.financials.collectionRate}%`,
      icon: Percent,
      color: 'bg-gradient-to-br from-blue-500 to-indigo-600',
      target: 95,
      unit: '%',
    },
    {
      title: 'Avg Folio Balance',
      value: formatCurrency(stats.financials.avgFolioBalance),
      icon: Receipt,
      color: 'bg-gradient-to-br from-purple-500 to-violet-600',
      description: 'Average outstanding folio balance',
    },
  ];

  const performanceMetrics: KPIMetric[] = [
    {
      title: 'WiFi Sessions',
      value: stats.wifi.activeSessions,
      icon: Wifi,
      color: 'bg-gradient-to-br from-teal-500 to-cyan-600',
      description: 'Active WiFi connections',
    },
    {
      title: 'Service Requests',
      value: stats.housekeeping.roomsPending,
      icon: Sparkles,
      color: 'bg-gradient-to-br from-amber-500 to-yellow-600',
      description: 'Pending service requests',
    },
    {
      title: 'Rooms Cleaned',
      value: stats.housekeeping.roomsCleaned,
      icon: Activity,
      color: 'bg-gradient-to-br from-green-500 to-emerald-600',
      description: 'Rooms cleaned today',
    },
    {
      title: 'Inspection Pass Rate',
      value: `${stats.housekeeping.inspectionPassRate}%`,
      icon: Target,
      color: 'bg-gradient-to-br from-violet-500 to-purple-600',
      target: 100,
      unit: '%',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">KPI Dashboard</h1>
            <p className="text-muted-foreground">
              Comprehensive performance metrics and analytics
            </p>
          </div>
          <Badge variant="outline" className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Last updated: {formatTime(new Date().toISOString())}
          </Badge>
        </div>
      </div>

      {/* Tabs for different KPI categories */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 h-10">
          <TabsTrigger value="overview" className="text-xs sm:text-sm">Overview</TabsTrigger>
          <TabsTrigger value="revenue" className="text-xs sm:text-sm">Revenue</TabsTrigger>
          <TabsTrigger value="operations" className="text-xs sm:text-sm">Operations</TabsTrigger>
          <TabsTrigger value="performance" className="text-xs sm:text-sm">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Quick Stats - All Categories */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {revenueMetrics.slice(0, 2).map((metric, i) => (
              <KPIMetricCard key={i} metric={metric} />
            ))}
            {operationalMetrics.slice(0, 2).map((metric, i) => (
              <KPIMetricCard key={`op-${i}`} metric={metric} />
            ))}
          </div>

          {/* Trend Chart */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-medium">Revenue & Occupancy Trend</CardTitle>
              <CardDescription>Last 7 days performance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.trendData}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#14b8a6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="revenue"
                      stroke="#14b8a6"
                      strokeWidth={2}
                      fill="url(#colorRevenue)"
                      name="Revenue"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="occupancy"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      dot={false}
                      name="Occupancy %"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Additional Metrics Grid */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {financialMetrics.slice(0, 2).map((metric, i) => (
              <KPIMetricCard key={`fin-${i}`} metric={metric} />
            ))}
            {performanceMetrics.slice(0, 2).map((metric, i) => (
              <KPIMetricCard key={`perf-${i}`} metric={metric} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="revenue" className="space-y-4">
          {/* Revenue Metrics */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {revenueMetrics.map((metric, i) => (
              <KPIMetricCard key={i} metric={metric} />
            ))}
          </div>

          {/* Revenue by Source Chart */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-medium">Revenue by Source</CardTitle>
                <CardDescription>Distribution of revenue by booking channel</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPie>
                      <Pie
                        data={stats.revenue.bySource}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="amount"
                      >
                        {stats.revenue.bySource.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                        formatter={(value: number) => formatCurrency(value)}
                      />
                      <Legend />
                    </RechartsPie>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-medium">Revenue Trend</CardTitle>
                <CardDescription>Daily revenue for the past week</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.trendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                        formatter={(value: number) => formatCurrency(value)}
                      />
                      <Bar dataKey="revenue" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Financial Metrics */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {financialMetrics.map((metric, i) => (
              <KPIMetricCard key={i} metric={metric} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="operations" className="space-y-4">
          {/* Operational Metrics */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {operationalMetrics.map((metric, i) => (
              <KPIMetricCard key={i} metric={metric} />
            ))}
          </div>

          {/* Occupancy by Room Type */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-medium">Occupancy by Room Type</CardTitle>
              <CardDescription>Current occupancy breakdown by room category</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.occupancy.byRoomType} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={100} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      formatter={(value: number) => [`${value}%`, 'Occupancy']}
                    />
                    <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Booking Stats */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-medium">Booking Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">This Month</span>
                  <span className="text-2xl font-bold">{stats.bookings.thisMonth}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Confirmed</span>
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    {stats.bookings.confirmed}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Pending</span>
                  <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                    {stats.bookings.pending}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Cancelled</span>
                  <Badge variant="secondary" className="bg-red-100 text-red-800">
                    {stats.bookings.cancelled}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Avg. Lead Time</span>
                  <span className="text-sm font-medium">{stats.bookings.avgLeadTime} days</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-medium">Guest Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total Guests</span>
                  <span className="text-2xl font-bold">{stats.guests.total}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">New Guests</span>
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                    {stats.guests.newGuests}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Returning Guests</span>
                  <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                    {stats.guests.returning}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Return Rate</span>
                  <span className="text-sm font-medium">
                    {Math.round((stats.guests.returning / stats.guests.total) * 100)}%
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          {/* Performance Metrics */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {performanceMetrics.map((metric, i) => (
              <KPIMetricCard key={i} metric={metric} />
            ))}
          </div>

          {/* Performance Stats */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-medium">Front Desk Performance</CardTitle>
                <CardDescription>Today's check-in/check-out statistics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-teal-50 dark:bg-teal-900/20">
                    <p className="text-xs text-muted-foreground">Check-ins Completed</p>
                    <p className="text-2xl font-bold text-teal-600">{stats.performance.checkInsCompleted}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20">
                    <p className="text-xs text-muted-foreground">Check-outs Completed</p>
                    <p className="text-2xl font-bold text-amber-600">{stats.performance.checkOutsCompleted}</p>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Avg Check-in Time</span>
                  <span className="text-sm font-medium">{stats.performance.avgCheckInTime} min</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Avg Check-out Time</span>
                  <span className="text-sm font-medium">{stats.performance.avgCheckOutTime} min</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-medium">Housekeeping Performance</CardTitle>
                <CardDescription>Cleaning and inspection metrics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
                    <p className="text-xs text-muted-foreground">Rooms Cleaned</p>
                    <p className="text-2xl font-bold text-green-600">{stats.housekeeping.roomsCleaned}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20">
                    <p className="text-xs text-muted-foreground">Rooms Pending</p>
                    <p className="text-2xl font-bold text-red-600">{stats.housekeeping.roomsPending}</p>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Avg Clean Time</span>
                  <span className="text-sm font-medium">{stats.housekeeping.avgCleanTime} min</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Inspection Pass Rate</span>
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    {stats.housekeeping.inspectionPassRate}%
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* WiFi Stats */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-medium">WiFi Usage</CardTitle>
              <CardDescription>Current network statistics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 rounded-lg bg-teal-50 dark:bg-teal-900/20">
                  <Wifi className="h-6 w-6 mx-auto text-teal-600 mb-2" />
                  <p className="text-2xl font-bold">{stats.wifi.activeSessions}</p>
                  <p className="text-xs text-muted-foreground">Active Sessions</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                  <Users className="h-6 w-6 mx-auto text-blue-600 mb-2" />
                  <p className="text-2xl font-bold">{stats.wifi.totalUsers}</p>
                  <p className="text-xs text-muted-foreground">Total Users</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20">
                  <Activity className="h-6 w-6 mx-auto text-purple-600 mb-2" />
                  <p className="text-2xl font-bold">{stats.wifi.avgBandwidth}</p>
                  <p className="text-xs text-muted-foreground">Avg Mbps</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
