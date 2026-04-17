'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useTimezone } from '@/contexts/TimezoneContext';
import { useUIStore, useAuthStore } from '@/store';
import {
  Sun,
  Moon,
  CloudSun,
  Calendar,
  Clock,
  Bell,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Bed,
  Users,
  DollarSign,
  Sparkles,
  RefreshCw,
  LogIn,
  LogOut,
  Wifi,
  Wrench,
  Package,
  Activity,
  Building2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { KPICards } from './kpi-cards';
import { QuickActions } from './quick-actions';
import { DashboardCharts } from './charts';
import { RecentActivity } from './recent-activity';
import { UpcomingArrivals } from './upcoming-arrivals';
import { PropertyStatusWidget, type RoomStatusCounts } from './property-status-widget';
import { RoomStatusWidget } from './room-status-widget';
import { GuestSatisfactionWidget } from './guest-satisfaction-widget';
import { RevenueTrendWidget } from './revenue-trend-widget';
import { OccupancyForecastWidget } from './occupancy-forecast-widget';
import { StatsBar } from './stats-bar';
import { StaffOnDutyWidget } from './staff-on-duty';
import { RecentActivityFeed } from './recent-activity-feed';
import { WeatherWidget } from './widgets/weather-widget';
import { TodaysSchedule } from './todays-schedule';
import { PropertyComparison } from './property-comparison';
import { GuestSegmentsWidget } from './widgets/guest-segments';
import { MaintenanceTrackerWidget } from './widgets/maintenance-tracker';
import { QuickNotesWidget } from './widgets/quick-notes';
import { MiniCalendarWidget } from './widgets/mini-calendar';
import { ShiftSummaryWidget } from './widgets/shift-summary';
import { RatePlanComparisonWidget } from './widgets/rate-plan-comparison';
import { GuestCommunicationWidget } from './widgets/guest-communication';
import { UpcomingEventsWidget } from './widgets/upcoming-events';
import { PerformanceScoreWidget } from './widgets/performance-score';
import { OperationsBoardWidget } from './widgets/operations-board';
import { LoyaltyWidget } from './widgets/loyalty-widget';
import { RevenueBreakdownWidget } from './widgets/revenue-breakdown';
import StaffPerformanceWidget from './widgets/staff-performance';
import GuestFeedbackWidget from './widgets/guest-feedback';
import ChannelPerformanceWidget from './widgets/channel-performance';
import { DashboardHeader } from './dashboard-header';
import { KeyboardShortcutsWidget } from './widgets/keyboard-shortcuts';

interface TodaySummary {
  date: string;
  dayName: string;
  currentTime: string;
  arrivals: number;
  departures: number;
  inHouse: number;
  availableRooms: number;
  occupancy: number;
  revenue: number;
  alerts: Array<{
    id: string;
    type: 'warning' | 'error' | 'info' | 'success';
    title: string;
    message: string;
    action?: string;
    section?: string;
  }>;
  weather?: {
    temp: number;
    condition: string;
  };
}

interface GreetingCardProps {
  occupancy?: number;
  arrivals?: number;
  alertsCount?: number;
}

// Count-up animation hook
function useCountUp(target: number, duration: number = 1200, startOnView: boolean = true) {
  const [count, setCount] = useState(0);
  const [hasStarted, setHasStarted] = useState(!startOnView);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!startOnView) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasStarted) {
          setHasStarted(true);
        }
      },
      { threshold: 0.1 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [hasStarted, startOnView]);

  useEffect(() => {
    if (!hasStarted) return;
    let start = 0;
    const startTime = performance.now();
    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };
    requestAnimationFrame(step);
  }, [hasStarted, target, duration]);

  return { count, ref };
}

// Mini sparkline SVG component
function MiniSparkline({ trend, color }: { trend: 'up' | 'down' | 'flat'; color: string }) {
  const points = trend === 'up'
    ? 'M2,14 L6,10 L10,12 L14,6 L18,4'
    : trend === 'down'
      ? 'M2,4 L6,8 L10,6 L14,12 L18,14'
      : 'M2,9 L6,9 L10,10 L14,9 L18,9';

  return (
    <svg width="20" height="18" viewBox="0 0 20 18" className="flex-shrink-0">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GreetingCard({ occupancy = 0, arrivals = 0, alertsCount = 0 }: GreetingCardProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const { formatDate, formatTime } = useTimezone();
  const { currentProperty } = useAuthStore();

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const hour = currentTime.getHours();
  let greeting = 'Good Morning';
  let Icon = Sun;
  let gradient = 'from-amber-500 to-orange-500';
  let bgGradient = 'from-amber-500/10 via-orange-400/5 to-amber-600/10';
  let orbColor1 = 'bg-amber-400';
  let orbColor2 = 'bg-orange-400';
  let orbColor3 = 'bg-amber-300';
  let textGradient = 'from-amber-600 via-orange-500 to-amber-700';

  if (hour >= 5 && hour < 12) {
    greeting = 'Good Morning';
    Icon = Sun;
    gradient = 'from-amber-500 to-orange-500';
    bgGradient = 'from-amber-500/10 via-orange-400/5 to-amber-600/10';
    orbColor1 = 'bg-amber-400';
    orbColor2 = 'bg-orange-400';
    orbColor3 = 'bg-amber-300';
    textGradient = 'from-amber-600 via-orange-500 to-amber-700';
  } else if (hour >= 12 && hour < 17) {
    greeting = 'Good Afternoon';
    Icon = CloudSun;
    gradient = 'from-sky-500 to-blue-500';
    bgGradient = 'from-sky-500/10 via-blue-400/5 to-sky-600/10';
    orbColor1 = 'bg-sky-400';
    orbColor2 = 'bg-blue-400';
    orbColor3 = 'bg-sky-300';
    textGradient = 'from-sky-600 via-blue-500 to-sky-700';
  } else if (hour >= 17 && hour < 21) {
    greeting = 'Good Evening';
    Icon = Moon;
    gradient = 'from-violet-500 to-purple-500';
    bgGradient = 'from-violet-500/10 via-purple-400/5 to-violet-600/10';
    orbColor1 = 'bg-violet-400';
    orbColor2 = 'bg-purple-400';
    orbColor3 = 'bg-violet-300';
    textGradient = 'from-violet-600 via-purple-500 to-violet-700';
  } else {
    greeting = 'Good Night';
    Icon = Moon;
    gradient = 'from-indigo-500 to-slate-700';
    bgGradient = 'from-indigo-500/10 via-slate-500/5 to-indigo-700/10';
    orbColor1 = 'bg-indigo-400';
    orbColor2 = 'bg-slate-500';
    orbColor3 = 'bg-indigo-300';
    textGradient = 'from-indigo-600 via-slate-500 to-indigo-700';
  }

  // Format date parts for enhanced display
  const dayName = currentTime.toLocaleDateString('en-US', { weekday: 'long' });
  const monthDay = currentTime.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className={cn(
        "border border-border/50 shadow-sm overflow-hidden relative rounded-2xl",
        "hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300",
        "bg-gradient-to-br", bgGradient
      )}>
        {/* Animated gradient accent line at top */}
        <div className={cn("absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r opacity-70", gradient)} />
        <div
          className={cn("absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r opacity-0 hover:opacity-100", gradient)}
          style={{
            backgroundSize: '200% 100%',
            animation: 'overviewShimmer 3s ease-in-out infinite'
          }}
        />

        {/* Floating decorative orbs */}
        <div className={cn("absolute top-8 right-16 w-24 h-24 rounded-full opacity-[0.07] blur-xl", orbColor1)}
          style={{ animation: 'floatOrb1 6s ease-in-out infinite' }} />
        <div className={cn("absolute bottom-4 right-32 w-16 h-16 rounded-full opacity-[0.05] blur-lg", orbColor2)}
          style={{ animation: 'floatOrb2 8s ease-in-out infinite' }} />
        <div className={cn("absolute top-4 left-1/2 w-20 h-20 rounded-full opacity-[0.04] blur-xl", orbColor3)}
          style={{ animation: 'floatOrb3 7s ease-in-out infinite' }} />

        {/* Decorative corner accent */}
        <div className="absolute top-0 right-0 w-32 h-32 opacity-[0.04] pointer-events-none">
          <Icon className="w-full h-full" />
        </div>
        <CardContent className="p-6 sm:p-7 relative z-10">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-2">
              <h1 className={cn(
                "text-3xl sm:text-4xl font-extrabold tracking-tight",
                "bg-gradient-to-r bg-clip-text text-transparent",
                textGradient
              )}>
                {greeting}!
              </h1>
              <p className="text-muted-foreground text-sm">
                {dayName}, {monthDay}
              </p>
              <div className="flex items-center gap-1 text-xs text-muted-foreground/70">
                <Building2 className="h-3 w-3" />
                <span>{currentProperty?.name || 'Property'}</span>
              </div>
              {/* Prominent live clock */}
              <div className="flex items-center gap-2 pt-1">
                <div className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </div>
                <span className="text-lg font-mono font-bold tabular-nums tracking-wider text-foreground/80">
                  {formatTime(currentTime.toISOString())}
                </span>
                <Clock className="h-3.5 w-3.5 text-muted-foreground/50" />
              </div>
              {/* Quick status chips */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted/50 text-muted-foreground">
                  🟢 {occupancy}% Occupancy
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted/50 text-muted-foreground">
                  📅 {arrivals} Arrivals
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted/50 text-muted-foreground">
                  🔔 {alertsCount} Alerts
                </span>
              </div>
            </div>
            <div className={cn(
              "p-4 rounded-2xl bg-gradient-to-br shadow-lg transition-all duration-500 hover:scale-110 hover:shadow-xl",
              gradient
            )}>
              <Icon className="h-8 w-8 text-white" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Live pulse indicator component
function LivePulse() {
  return (
    <span className="relative flex h-2 w-2 ml-1">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
    </span>
  );
}

function TodaySummaryCard({ summary, isLoading }: { summary: TodaySummary | null; isLoading: boolean }) {
  const { formatCurrency } = useCurrency();
  const { formatTime } = useTimezone();
  const { setActiveSection } = useUIStore();

  const arrivalsCount = useCountUp(summary?.arrivals || 0);
  const departuresCount = useCountUp(summary?.departures || 0);
  const inHouseCount = useCountUp(summary?.inHouse || 0);
  const availableCount = useCountUp(summary?.availableRooms || 0);

  if (isLoading || !summary) {
    return (
      <Card className="border border-border/50 shadow-sm rounded-2xl bg-gradient-to-br from-white/50 to-transparent dark:from-card/50 dark:to-transparent">
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const statCards = [
    {
      label: 'Arrivals',
      value: arrivalsCount.count,
      ref: arrivalsCount.ref,
      icon: LogIn,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50 dark:bg-emerald-950/30',
      iconBg: 'bg-emerald-500/15',
      borderLeft: 'border-l-4 border-l-emerald-500',
      hoverBorder: 'hover:border-emerald-200 dark:hover:border-emerald-800',
      section: 'frontdesk-checkin',
    },
    {
      label: 'Departures',
      value: departuresCount.count,
      ref: departuresCount.ref,
      icon: LogOut,
      color: 'text-amber-600',
      bg: 'bg-amber-50 dark:bg-amber-950/30',
      iconBg: 'bg-amber-500/15',
      borderLeft: 'border-l-4 border-l-amber-500',
      hoverBorder: 'hover:border-amber-200 dark:hover:border-amber-800',
      section: 'frontdesk-checkout',
    },
    {
      label: 'In House',
      value: inHouseCount.count,
      ref: inHouseCount.ref,
      icon: Users,
      color: 'text-blue-600',
      bg: 'bg-blue-50 dark:bg-blue-950/30',
      iconBg: 'bg-blue-500/15',
      borderLeft: 'border-l-4 border-l-blue-500',
      hoverBorder: 'hover:border-blue-200 dark:hover:border-blue-800',
      section: 'guests-list',
    },
    {
      label: 'Available',
      value: availableCount.count,
      ref: availableCount.ref,
      icon: Bed,
      color: 'text-violet-600',
      bg: 'bg-violet-50 dark:bg-violet-950/30',
      iconBg: 'bg-violet-500/15',
      borderLeft: 'border-l-4 border-l-violet-500',
      hoverBorder: 'hover:border-violet-200 dark:hover:border-violet-800',
      section: 'frontdesk-room-grid',
    },
  ];

  return (
    <Card className="border border-border/50 shadow-sm rounded-2xl hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-white/50 to-transparent dark:from-card/50 dark:to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Today's Summary
            <LivePulse />
          </CardTitle>
          <Badge variant="outline" className="text-xs rounded-full border-primary/20 text-primary bg-primary/5">
            {summary.dayName}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {statCards.map((stat) => (
            <motion.div
              key={stat.label}
              ref={stat.ref as React.RefObject<HTMLDivElement>}
              whileHover={{ scale: 1.03, y: -2 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              className={cn(
                "p-3.5 rounded-xl cursor-pointer transition-all duration-300",
                "bg-gradient-to-br from-white/80 to-white/40 dark:from-card/80 dark:to-card/40",
                "border border-border/30",
                stat.borderLeft,
                stat.hoverBorder,
                "hover:shadow-lg"
              )}
              onClick={() => setActiveSection(stat.section)}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center", stat.iconBg)}>
                  <stat.icon className={cn("h-4 w-4", stat.color)} />
                </div>
                <span className="text-xs text-muted-foreground font-medium">{stat.label}</span>
              </div>
              <p className={cn("text-3xl font-bold tabular-nums", stat.color)} style={{ fontFeatureSettings: 'tnum' }}>
                {stat.value}
              </p>
            </motion.div>
          ))}
        </div>
        {summary.arrivals === 0 && summary.departures === 0 && summary.inHouse === 0 && summary.availableRooms === 0 && (
          <div className="mt-3 text-center">
            <p className="text-xs text-muted-foreground/60">No activity recorded for today yet</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AlertsWidget({ alerts, isLoading }: { alerts: TodaySummary['alerts']; isLoading: boolean }) {
  const { setActiveSection } = useUIStore();

  if (isLoading) {
    return (
      <Card className="border border-border/50 shadow-sm rounded-2xl bg-gradient-to-br from-white/50 to-transparent dark:from-card/50 dark:to-transparent">
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-24" />
        </CardHeader>
        <CardContent className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const alertIcons = {
    warning: AlertTriangle,
    error: AlertTriangle,
    info: Bell,
    success: CheckCircle2,
  };

  const alertColors = {
    warning: 'bg-amber-50 border-l-4 border-l-amber-400 dark:bg-amber-900/20',
    error: 'bg-red-50 border-l-4 border-l-red-400 dark:bg-red-900/20',
    info: 'bg-blue-50 border-l-4 border-l-blue-400 dark:bg-blue-900/20',
    success: 'bg-green-50 border-l-4 border-l-green-400 dark:bg-green-900/20',
  };

  const iconColors = {
    warning: 'text-amber-600',
    error: 'text-red-600',
    info: 'text-blue-600',
    success: 'text-green-600',
  };

  const limitedAlerts = alerts.slice(0, 4);

  return (
    <Card className="border border-border/50 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 rounded-2xl bg-gradient-to-br from-white/50 to-transparent dark:from-card/50 dark:to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Bell className="h-4 w-4 text-amber-600" />
            Alerts & Notifications
          </CardTitle>
          {alerts.length > 0 && (
            <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
              {alerts.length}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {limitedAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="relative mb-2">
              <div className="rounded-full bg-emerald-50 dark:bg-emerald-900/20 p-2.5 ring-3 ring-emerald-100 dark:ring-emerald-900/30">
                <CheckCircle2 className="h-7 w-7 text-emerald-500" />
              </div>
              <div className="absolute inset-[-3px] rounded-full border-2 border-emerald-300 dark:border-emerald-700 animate-ping opacity-15" />
            </div>
            <p className="text-sm font-medium">All Clear!</p>
            <p className="text-xs text-muted-foreground">No pending alerts</p>
          </div>
        ) : (
          <div className="space-y-2">
            {limitedAlerts.map((alert) => {
              const Icon = alertIcons[alert.type];
              return (
                <div
                  key={alert.id}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg cursor-pointer",
                    "transition-all duration-200",
                    "hover:shadow-sm hover:-translate-y-0.5",
                    alertColors[alert.type]
                  )}
                  onClick={() => alert.section && setActiveSection(alert.section)}
                >
                  <Icon className={cn("h-4 w-4 mt-0.5 flex-shrink-0", iconColors[alert.type])} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{alert.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{alert.message}</p>
                  </div>
                  {alert.action && (
                    <Button variant="ghost" size="sm" className="h-7 text-xs hover:bg-muted">
                      {alert.action}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {alerts.length > 4 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full mt-2 hover:bg-muted/60 transition-colors"
            onClick={() => setActiveSection('dashboard-alerts')}
          >
            View All Alerts ({alerts.length})
            <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function QuickStatsRow({ stats, isLoading }: { stats: any; isLoading: boolean }) {
  const { formatCurrency } = useCurrency();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    );
  }

  const quickStats = [
    {
      label: 'Revenue Today',
      value: formatCurrency(stats?.revenue?.today || 0),
      change: stats?.revenue?.change || 0,
      icon: DollarSign,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50 dark:bg-emerald-900/20',
      border: 'hover:border-emerald-200 dark:hover:border-emerald-800',
      glowColor: 'rgba(16, 185, 129, 0.15)',
    },
    {
      label: 'Occupancy',
      value: `${stats?.occupancy?.today || 0}%`,
      change: stats?.occupancy?.change || 0,
      icon: Bed,
      color: 'text-violet-600',
      bg: 'bg-violet-50 dark:bg-violet-900/20',
      border: 'hover:border-violet-200 dark:hover:border-violet-800',
      glowColor: 'rgba(139, 92, 246, 0.15)',
    },
    {
      label: 'WiFi Sessions',
      value: stats?.activeWifiSessions || 0,
      change: 5,
      icon: Wifi,
      color: 'text-cyan-600',
      bg: 'bg-cyan-50 dark:bg-cyan-900/20',
      border: 'hover:border-cyan-200 dark:hover:border-cyan-800',
      glowColor: 'rgba(6, 182, 212, 0.15)',
    },
    {
      label: 'Service Requests',
      value: stats?.pendingServiceRequests || 0,
      change: -3,
      icon: Sparkles,
      color: 'text-amber-600',
      bg: 'bg-amber-50 dark:bg-amber-900/20',
      border: 'hover:border-amber-200 dark:hover:border-amber-800',
      glowColor: 'rgba(245, 158, 11, 0.15)',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {quickStats.map((stat, i) => {
        const trend = stat.change >= 0 ? 'up' : 'down';
        const trendColor = stat.change >= 0 ? '#16a34a' : '#dc2626';

        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className={cn(
              "border border-border/50 shadow-sm transition-all duration-300 rounded-2xl",
              "hover:shadow-lg hover:-translate-y-0.5",
              "bg-gradient-to-br from-white/50 to-transparent dark:from-card/50 dark:to-transparent",
              stat.border
            )}>
              <CardContent className="p-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-muted-foreground">{stat.label}</p>
                    <p className="text-xl font-bold tabular-nums mt-0.5" style={{ fontFeatureSettings: 'tnum' }}>{stat.value}</p>
                    {stat.change != null && stat.change !== 0 && (
                      <div className={cn(
                        "flex items-center gap-1 text-xs font-semibold mt-0.5",
                        stat.change >= 0 ? 'text-green-600' : 'text-red-600'
                      )}>
                        {stat.change >= 0 ? (
                          <TrendingUp className="h-3.5 w-3.5" />
                        ) : (
                          <TrendingDown className="h-3.5 w-3.5" />
                        )}
                        <span>{Math.abs(stat.change)}%</span>
                        <MiniSparkline trend={trend} color={trendColor} />
                      </div>
                    )}
                  </div>
                  <div
                    className={cn("p-2.5 rounded-xl transition-transform duration-200 group-hover:scale-110 relative", stat.bg)}
                    style={{ boxShadow: `0 0 12px ${stat.glowColor}` }}
                  >
                    <stat.icon className={cn("h-4 w-4", stat.color)} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}

// Section header with icon, title, animated gradient underline, and icon pill
function DashboardSectionHeader({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10 relative">
        <Icon className="h-4 w-4 text-primary" />
        {/* Subtle glow behind icon */}
        <div className="absolute inset-0 rounded-lg bg-primary/5 blur-sm" />
      </div>
      <div className="flex-1 min-w-0">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="flex-1 h-[2px] relative overflow-hidden rounded-full bg-border/50">
        <div
          className="absolute inset-0 bg-gradient-to-r from-primary/40 via-primary/20 to-transparent"
          style={{
            backgroundSize: '200% 100%',
            animation: 'headerShimmer 3s ease-in-out infinite'
          }}
        />
      </div>
    </div>
  );
}

export default function OverviewDashboard() {
  const [summary, setSummary] = useState<TodaySummary | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [roomStatusCounts, setRoomStatusCounts] = useState<RoomStatusCounts | null>(null);
  const [totalRooms, setTotalRooms] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async (showRefreshLoader = false) => {
    if (showRefreshLoader) setIsRefreshing(true);
    try {
      const response = await fetch('/api/dashboard');
      const result = await response.json();
      if (result.success) {
        setStats(result.data.stats);

        // Extract room status data
        if (result.data.commandCenter?.rooms) {
          setRoomStatusCounts(result.data.commandCenter.rooms);
          setTotalRooms(result.data.commandCenter.totalRooms || null);
        }

        // Build alerts from the data
        const alerts: TodaySummary['alerts'] = [];

        // Low stock alerts
        if (result.data.alerts) {
          result.data.alerts.forEach((alert: any) => {
            if (alert.type === 'inventory') {
              alerts.push({
                id: alert.id,
                type: alert.severity === 'critical' ? 'error' : 'warning',
                title: alert.title,
                message: alert.message,
                section: 'inventory-stock',
                action: 'View',
              });
            } else if (alert.type === 'service') {
              alerts.push({
                id: alert.id,
                type: 'warning',
                title: alert.title,
                message: alert.message,
                section: 'experience-requests',
                action: 'View',
              });
            } else if (alert.type === 'room') {
              alerts.push({
                id: alert.id,
                type: 'info',
                title: alert.title,
                message: alert.message,
                section: 'housekeeping-status',
                action: 'View',
              });
            }
          });
        }

        // Calculate available rooms
        const availableRooms = result.data.commandCenter?.rooms?.available || 0;

        setSummary({
          date: new Date().toISOString(),
          dayName: new Date().toLocaleDateString('en-US', { weekday: 'long' }),
          currentTime: new Date().toISOString(),
          arrivals: result.data.guests?.arriving || result.data.stats?.guests?.arriving || 0,
          departures: result.data.guests?.departing || result.data.stats?.guests?.departing || 0,
          inHouse: result.data.stats?.guests?.checkedIn || 0,
          availableRooms,
          occupancy: result.data.stats?.occupancy?.today || 0,
          revenue: result.data.stats?.revenue?.today || 0,
          alerts,
        });
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      setLastUpdated(new Date());
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <>
      {/* Keyframes for overview animations */}
      <style>{`
        @keyframes overviewShimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes cardEntrance {
          from { opacity: 0; transform: translateY(12px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes headerShimmer {
          0% { background-position: -200% 0; }
          50% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes floatOrb1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(8px, -6px) scale(1.05); }
          50% { transform: translate(-4px, 8px) scale(0.95); }
          75% { transform: translate(6px, 4px) scale(1.02); }
        }
        @keyframes floatOrb2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-6px, 4px) scale(1.03); }
          66% { transform: translate(4px, -8px) scale(0.97); }
        }
        @keyframes floatOrb3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(10px, -10px) scale(1.08); }
        }
      `}</style>
    <div className="space-y-6" style={{ animation: 'cardEntrance 0.4s ease-out' }}>
      {/* Greeting Card */}
      <GreetingCard
        occupancy={summary?.occupancy || 0}
        arrivals={summary?.arrivals || 0}
        alertsCount={summary?.alerts?.length || 0}
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/50">
          <div className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-40" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
          </div>
          <span>Live data</span>
        </div>
        <DashboardHeader
          onRefresh={() => fetchData(true)}
          isRefreshing={isRefreshing}
          lastUpdated={lastUpdated || undefined}
        />
      </div>

      {/* Quick Stats Bar */}
      <StatsBar />

      {/* Quick Stats Row */}
      <QuickStatsRow stats={stats} isLoading={isLoading} />

      {/* Today's Summary */}
      <TodaySummaryCard summary={summary} isLoading={isLoading} />

      {/* Quick Actions */}
      <QuickActions />

      {/* Section: Performance & KPIs */}
      <DashboardSectionHeader icon={Activity} title="Performance & KPIs" subtitle="Key metrics and performance indicators" />

      {/* Main Content Grid */}
      <div className="grid gap-5 grid-cols-1 xl:grid-cols-3">
        <div className="xl:col-span-2 space-y-5">
          {/* Performance Score + Revenue Breakdown row */}
          <div className="grid gap-5 grid-cols-1 md:grid-cols-2">
            <PerformanceScoreWidget />
            <RevenueBreakdownWidget />
          </div>

          {/* Today's Schedule + Staff + Shift Summary row */}
          <div className="grid gap-5 grid-cols-1 md:grid-cols-3">
            <TodaysSchedule />
            <StaffOnDutyWidget />
            <ShiftSummaryWidget />
          </div>

          {/* Section: Rooms & Guests */}
          <DashboardSectionHeader icon={Bed} title="Rooms & Guests" subtitle="Room status and guest insights" />

          {/* Room Status + Guest Segments row */}
          <div className="grid gap-5 grid-cols-1 md:grid-cols-2">
            <RoomStatusWidget />
            <GuestSegmentsWidget />
          </div>

          {/* Section: Revenue & Trends */}
          <DashboardSectionHeader icon={DollarSign} title="Revenue & Trends" subtitle="Financial performance and forecasting" />

          <RevenueTrendWidget />

          {/* Guest Satisfaction + Feedback + Upcoming Events row */}
          <div className="grid gap-5 grid-cols-1 md:grid-cols-3">
            <GuestSatisfactionWidget />
            <GuestFeedbackWidget />
            <UpcomingEventsWidget />
          </div>

          {/* Section: Operations */}
          <DashboardSectionHeader icon={Wrench} title="Operations" subtitle="Daily operations and maintenance" />

          <OperationsBoardWidget />

          {/* Guest Communication + Quick Notes row */}
          <div className="grid gap-5 grid-cols-1 md:grid-cols-2">
            <GuestCommunicationWidget />
            <QuickNotesWidget />
          </div>

          <RatePlanComparisonWidget />
          <MaintenanceTrackerWidget />
          <StaffPerformanceWidget />
          <DashboardCharts />
          <UpcomingArrivals />
        </div>
        <div className="xl:col-span-1 space-y-5">
          {/* Section: Quick Insights */}
          <DashboardSectionHeader icon={Sparkles} title="Quick Insights" subtitle="At-a-glance property overview" />

          <LoyaltyWidget />
          <PropertyComparison />
          <ChannelPerformanceWidget />
          <WeatherWidget />
          <MiniCalendarWidget />
          <KeyboardShortcutsWidget />

          {/* Section: Activity & Alerts */}
          <DashboardSectionHeader icon={Bell} title="Activity & Alerts" subtitle="Recent activity and notifications" />

          <RecentActivityFeed />
          <OccupancyForecastWidget />
          <AlertsWidget alerts={summary?.alerts || []} isLoading={isLoading} />
          <PropertyStatusWidget
            roomStatusCounts={roomStatusCounts}
            totalRooms={totalRooms}
            isLoading={isLoading}
          />
          <RecentActivity />
        </div>
      </div>
    </div>
    </>
  );
}
