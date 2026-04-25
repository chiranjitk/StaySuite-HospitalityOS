'use client';

import React, { Suspense, useEffect, useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
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
  ArrowRight,
  Bed,
  Users,
  LogIn,
  LogOut,
  Building2,
  Zap,
  Radio,
  Coffee,
  Wrench,
  BarChart3,
  MessageSquare,
  Crown,
  type LucideIcon,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { KPICards } from './kpi-cards';
import { QuickActions } from './quick-actions';
import { DashboardCharts } from './charts';
import { UpcomingArrivals } from './upcoming-arrivals';
import { RoomStatusWidget } from './room-status-widget';
import { GuestSatisfactionWidget } from './guest-satisfaction-widget';
import { StaffOnDutyWidget } from './staff-on-duty';
import { RecentActivityFeed } from './recent-activity-feed';
import { TodaysSchedule } from './todays-schedule';
import { UpcomingEventsWidget } from './widgets/upcoming-events';
import { PerformanceScoreWidget } from './widgets/performance-score';
import { RevenueBreakdownWidget } from './widgets/revenue-breakdown';
import GuestFeedbackWidget from './widgets/guest-feedback';
import { DashboardHeader } from './dashboard-header';
import { MiniCalendarWidget } from './widgets/mini-calendar';
import { ShiftSummaryWidget } from './widgets/shift-summary';
import { OperationsBoardWidget } from './widgets/operations-board';
import { MaintenanceTrackerWidget } from './widgets/maintenance-tracker';
import { LoyaltyWidget } from './widgets/loyalty-widget';
import { RatePlanComparisonWidget } from './widgets/rate-plan-comparison';
import { GuestSegmentsWidget } from './widgets/guest-segments';
import { GuestCommunicationWidget } from './widgets/guest-communication';
import StaffPerformanceWidget from './widgets/staff-performance';
import ChannelPerformanceWidget from './widgets/channel-performance';
import { QuickNotesWidget } from './widgets/quick-notes';

const OccupancyHeatmap = React.lazy(() => import('./occupancy-heatmap').then(m => ({ default: m.OccupancyHeatmap })));

// ─── Types ──────────────────────────────────────────────────────────────

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
}

// ─── Count-up animation hook ────────────────────────────────────────────

function useCountUp(target: number, duration: number = 1200) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && !hasStarted) setHasStarted(true); },
      { threshold: 0.1 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [hasStarted]);

  useEffect(() => {
    if (!hasStarted) return;
    const startTime = performance.now();
    const step = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [hasStarted, target, duration]);

  return { count, ref };
}

// ─── Animated background mesh ───────────────────────────────────────────

function MeshBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-gradient-to-br from-emerald-400/12 to-teal-400/8 blur-3xl animate-[float1_8s_ease-in-out_infinite]" />
      <div className="absolute -bottom-16 -left-16 w-60 h-60 rounded-full bg-gradient-to-br from-amber-400/10 to-orange-400/6 blur-3xl animate-[float2_10s_ease-in-out_infinite]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-gradient-to-br from-violet-400/6 to-purple-400/5 blur-3xl animate-[float3_12s_ease-in-out_infinite]" />
    </div>
  );
}

// ─── Greeting Card ──────────────────────────────────────────────────────

function GreetingCard({ occupancy = 0, arrivals = 0, alertsCount = 0 }: {
  occupancy?: number; arrivals?: number; alertsCount?: number;
}) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const { formatTime } = useTimezone();
  const { currentProperty } = useAuthStore();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const hour = currentTime.getHours();
  let greeting = 'Good Morning', Icon = Sun;
  let accentColor = 'emerald';
  let gradient = 'from-emerald-500 to-teal-500';
  let iconBg = 'bg-gradient-to-br from-emerald-400 to-teal-600';
  let ringColor = 'ring-emerald-400/40';
  let chipBg = 'bg-emerald-50 dark:bg-emerald-950/40';
  let chipText = 'text-emerald-700 dark:text-emerald-400';
  let clockColor = 'text-emerald-600 dark:text-emerald-400';

  if (hour >= 12 && hour < 17) {
    greeting = 'Good Afternoon'; Icon = CloudSun; accentColor = 'sky';
    gradient = 'from-sky-500 to-cyan-500';
    iconBg = 'bg-gradient-to-br from-sky-400 to-cyan-600';
    ringColor = 'ring-sky-400/40'; chipBg = 'bg-sky-50 dark:bg-sky-950/40';
    chipText = 'text-sky-700 dark:text-sky-400'; clockColor = 'text-sky-600 dark:text-sky-400';
  } else if (hour >= 17 && hour < 21) {
    greeting = 'Good Evening'; Icon = Moon; accentColor = 'violet';
    gradient = 'from-violet-500 to-purple-500';
    iconBg = 'bg-gradient-to-br from-violet-400 to-purple-600';
    ringColor = 'ring-violet-400/40'; chipBg = 'bg-violet-50 dark:bg-violet-950/40';
    chipText = 'text-violet-700 dark:text-violet-400'; clockColor = 'text-violet-600 dark:text-violet-400';
  } else if (hour >= 21 || hour < 5) {
    greeting = 'Good Night'; Icon = Moon; accentColor = 'slate';
    gradient = 'from-slate-600 to-slate-800';
    iconBg = 'bg-gradient-to-br from-slate-500 to-slate-700';
    ringColor = 'ring-slate-400/40'; chipBg = 'bg-slate-100 dark:bg-slate-800/40';
    chipText = 'text-slate-700 dark:text-slate-400'; clockColor = 'text-slate-500 dark:text-slate-400';
  }

  const dayName = currentTime.toLocaleDateString('en-US', { weekday: 'long' });
  const monthDay = currentTime.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className={cn(
        "relative overflow-hidden rounded-xl border border-border/60 shadow-md",
        "bg-card"
      )}>
        <div className={cn("absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r", gradient)} />

        <CardContent className="p-4 sm:p-5 relative z-10">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {/* Icon */}
              <div className={cn("flex items-center justify-center w-10 h-10 rounded-xl shadow-md flex-shrink-0", iconBg)}>
                <Icon className="h-5 w-5 text-white" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                    {greeting}<span className="inline-block animate-[wave_2s_ease-in-out_infinite] origin-[70%_70%]">!</span>
                  </h1>
                  <div className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border text-xs font-mono font-semibold tabular-nums", chipBg, chipText, "border-border/40")}>
                    <div className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                    </div>
                    {formatTime(currentTime.toISOString())}
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-muted-foreground">{dayName}, {monthDay}</span>
                  {currentProperty?.name && (
                    <span className="hidden sm:inline-flex items-center gap-1 text-xs text-muted-foreground/60">
                      <Building2 className="h-3 w-3" />
                      {currentProperty.name}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Status pills */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border", chipBg, chipText, "border-border/40")}>
                <Bed className="h-3 w-3" />
                {occupancy}%
              </span>
              <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border", chipBg, chipText, "border-border/40")}>
                <LogIn className="h-3 w-3" />
                {arrivals}
              </span>
              {alertsCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400 border-red-200/50 dark:border-red-800/40">
                  <Bell className="h-3 w-3" />
                  {alertsCount}
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Live Pulse ─────────────────────────────────────────────────────────

function LivePulse() {
  return (
    <span className="relative flex h-2 w-2 ml-1">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
    </span>
  );
}

// ─── Today's Summary Card ───────────────────────────────────────────────

function TodaySummaryCard({ summary, isLoading }: { summary: TodaySummary | null; isLoading: boolean }) {
  const { setActiveSection } = useUIStore();

  const arrivalsCount = useCountUp(summary?.arrivals || 0);
  const departuresCount = useCountUp(summary?.departures || 0);
  const inHouseCount = useCountUp(summary?.inHouse || 0);
  const availableCount = useCountUp(summary?.availableRooms || 0);

  if (isLoading || !summary) {
    return (
      <Card className="border border-border/60 shadow-md rounded-2xl bg-card">
        <CardContent className="p-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-[88px] rounded-xl" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  const statCards = [
    {
      label: 'Arrivals', count: arrivalsCount, icon: LogIn,
      gradient: 'from-emerald-500 to-emerald-600',
      lightBg: 'bg-emerald-50 dark:bg-emerald-950/50',
      section: 'frontdesk-checkin',
    },
    {
      label: 'Departures', count: departuresCount, icon: LogOut,
      gradient: 'from-amber-500 to-orange-500',
      lightBg: 'bg-amber-50 dark:bg-amber-950/50',
      section: 'frontdesk-checkout',
    },
    {
      label: 'In House', count: inHouseCount, icon: Users,
      gradient: 'from-violet-500 to-purple-500',
      lightBg: 'bg-violet-50 dark:bg-violet-950/50',
      section: 'guests-list',
    },
    {
      label: 'Available', count: availableCount, icon: Bed,
      gradient: 'from-cyan-500 to-teal-500',
      lightBg: 'bg-cyan-50 dark:bg-cyan-950/50',
      section: 'frontdesk-room-grid',
    },
  ];

  return (
    <Card className="border border-border/60 shadow-md rounded-2xl bg-card">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Today&apos;s Overview</h3>
            <LivePulse />
          </div>
          <Badge variant="outline" className="text-[11px] rounded-full border-primary/40 text-primary bg-primary/10 font-medium">
            {summary.dayName}
          </Badge>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {statCards.map((stat, i) => (
            <motion.div
              key={stat.label}
              ref={stat.count.ref as React.RefObject<HTMLDivElement>}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08, duration: 0.4 }}
              whileHover={{ scale: 1.04, y: -3 }}
              className={cn(
                "relative p-4 rounded-xl cursor-pointer transition-all duration-300",
                "bg-card border border-border/40 overflow-hidden group",
                "hover:shadow-lg hover:border-border/60"
              )}
              onClick={() => setActiveSection(stat.section)}
            >
              {/* Subtle gradient background on hover */}
              <div className={cn(
                "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-300",
                stat.lightBg
              )} />

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center bg-gradient-to-br shadow-sm", stat.gradient)}>
                    <stat.icon className="h-4 w-4 text-white" />
                  </div>
                </div>
                <p className="text-[11px] font-medium text-muted-foreground mb-0.5">{stat.label}</p>
                <p className="text-2xl font-extrabold tabular-nums text-foreground" style={{ fontFeatureSettings: 'tnum' }}>
                  {stat.count.count}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
        {summary.arrivals === 0 && summary.departures === 0 && summary.inHouse === 0 && summary.availableRooms === 0 && (
          <p className="text-center text-xs text-muted-foreground/50 mt-3">No activity recorded for today yet</p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Section Divider ────────────────────────────────────────────────────

function SectionLabel({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <div className="flex items-center gap-2.5 py-1">
      <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-primary/10 ring-1 ring-primary/15">
        <Icon className="h-3.5 w-3.5 text-primary" />
      </div>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground/80">{title}</h2>
      <div className="flex-1 h-px bg-border/70" />
    </div>
  );
}

// ─── Alerts Widget ──────────────────────────────────────────────────────

function AlertsWidget({ alerts, isLoading }: { alerts: TodaySummary['alerts']; isLoading: boolean }) {
  const { setActiveSection } = useUIStore();

  if (isLoading) {
    return (
      <Card className="border border-border/60 shadow-md rounded-2xl bg-card">
        <CardContent className="p-5">
          <Skeleton className="h-5 w-28 mb-4" />
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  const alertIcons: Record<string, LucideIcon> = { warning: AlertTriangle, error: AlertTriangle, info: Bell, success: CheckCircle2 };
  const alertStyles: Record<string, { bg: string; iconColor: string; dotColor: string }> = {
    warning: { bg: 'bg-amber-50 dark:bg-amber-950/50', iconColor: 'text-amber-600 dark:text-amber-400', dotColor: 'bg-amber-500' },
    error: { bg: 'bg-red-50 dark:bg-red-950/50', iconColor: 'text-red-600 dark:text-red-400', dotColor: 'bg-red-500' },
    info: { bg: 'bg-sky-50 dark:bg-sky-950/50', iconColor: 'text-sky-600 dark:text-sky-400', dotColor: 'bg-sky-500' },
    success: { bg: 'bg-emerald-50 dark:bg-emerald-950/50', iconColor: 'text-emerald-600 dark:text-emerald-400', dotColor: 'bg-emerald-500' },
  };

  const limitedAlerts = alerts.slice(0, 4);

  return (
    <Card className="border border-border/60 shadow-md rounded-2xl bg-card">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-foreground">Alerts</h3>
          </div>
          {alerts.length > 0 && (
            <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400 text-[11px] font-semibold">
              {alerts.length}
            </Badge>
          )}
        </div>
        {limitedAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="rounded-full bg-emerald-50 dark:bg-emerald-950/50 p-3 mb-2 ring-4 ring-emerald-100 dark:ring-emerald-400/50"
            >
              <CheckCircle2 className="h-7 w-7 text-emerald-500" />
            </motion.div>
            <p className="text-sm font-semibold">All Clear</p>
            <p className="text-xs text-muted-foreground mt-0.5">No pending alerts</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[280px] overflow-y-auto scrollbar-thin scrollbar-thumb-border/50 scrollbar-track-transparent pr-1">
            {limitedAlerts.map((alert, idx) => {
              const Icon = alertIcons[alert.type] || Bell;
              const style = alertStyles[alert.type] || alertStyles.info;
              return (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200",
                    "hover:shadow-sm hover:-translate-y-0.5",
                    style.bg
                  )}
                  onClick={() => alert.section && setActiveSection(alert.section)}
                >
                  <div className={cn("h-2 w-2 rounded-full mt-1.5 flex-shrink-0", style.dotColor)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{alert.title}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{alert.message}</p>
                  </div>
                  <Icon className={cn("h-4 w-4 mt-0.5 flex-shrink-0", style.iconColor)} />
                </motion.div>
              );
            })}
          </div>
        )}
        {alerts.length > 4 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full mt-3 hover:bg-muted/60 transition-colors text-xs font-medium"
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

// ─── Main Overview Dashboard ────────────────────────────────────────────

export default function OverviewDashboard() {
  const [summary, setSummary] = useState<TodaySummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async (showRefreshLoader = false) => {
    if (showRefreshLoader) setIsRefreshing(true);
    try {
      const response = await fetch('/api/dashboard');
      const result = await response.json();
      if (result.success) {
        const alerts: TodaySummary['alerts'] = [];
        if (result.data.alerts) {
          result.data.alerts.forEach((alert: any) => {
            alerts.push({
              id: alert.id,
              type: alert.severity === 'critical' ? 'error' : alert.type === 'room' ? 'info' : 'warning',
              title: alert.title,
              message: alert.message,
              section: alert.type === 'inventory' ? 'inventory-stock' : alert.type === 'service' ? 'experience-requests' : 'housekeeping-status',
              action: 'View',
            });
          });
        }
        setSummary({
          date: new Date().toISOString(),
          dayName: new Date().toLocaleDateString('en-US', { weekday: 'long' }),
          currentTime: new Date().toISOString(),
          arrivals: result.data.guests?.arriving || result.data.stats?.guests?.arriving || 0,
          departures: result.data.guests?.departing || result.data.stats?.guests?.departing || 0,
          inHouse: result.data.stats?.guests?.checkedIn || 0,
          availableRooms: result.data.commandCenter?.rooms?.available || 0,
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

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <>
      <style>{`
        @keyframes float1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(12px, -8px) scale(1.05); }
          66% { transform: translate(-6px, 6px) scale(0.95); }
        }
        @keyframes float2 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(-10px, 8px); }
        }
        @keyframes float3 {
          0%, 100% { transform: translate(-50%, -50%) scale(1); }
          50% { transform: translate(calc(-50% + 15px), calc(-50% - 10px)) scale(1.05); }
        }
        @keyframes wave {
          0% { transform: rotate(0deg); }
          10% { transform: rotate(14deg); }
          20% { transform: rotate(-8deg); }
          30% { transform: rotate(14deg); }
          40% { transform: rotate(-4deg); }
          50% { transform: rotate(10deg); }
          60% { transform: rotate(0deg); }
          100% { transform: rotate(0deg); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="space-y-5 relative">
        <MeshBackground />

        {/* ── Greeting ── */}
        <GreetingCard
          occupancy={summary?.occupancy || 0}
          arrivals={summary?.arrivals || 0}
          alertsCount={summary?.alerts?.length || 0}
        />

        {/* ── Live data bar ── */}
        <div className="flex items-center justify-between relative z-10">
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

        {/* ── KPI Cards ── */}
        <div className="relative z-10">
          <KPICards />
        </div>

        {/* ── Quick Actions ── */}
        <div className="relative z-10">
          <QuickActions />
        </div>

        {/* ── Today's Summary ── */}
        <div className="relative z-10">
          <TodaySummaryCard summary={summary} isLoading={isLoading} />
        </div>

        {/* ── Operations Center ── */}
        <div className="relative z-10 space-y-2 rounded-xl bg-muted/15 px-1 py-3">
          <SectionLabel icon={Radio} title="Operations Center" />
          <div className="grid gap-5 grid-cols-1 lg:grid-cols-3">
            <ShiftSummaryWidget />
            <OperationsBoardWidget />
            <QuickNotesWidget />
          </div>
        </div>

        {/* ── Front Desk & Rooms ── */}
        <div className="relative z-10 space-y-2">
          <SectionLabel icon={Bed} title="Front Desk & Rooms" />
          <div className="grid gap-5 grid-cols-1 lg:grid-cols-2">
            <TodaysSchedule />
            <RoomStatusWidget />
          </div>
        </div>

        {/* ── Alerts, Activity & Staff ── */}
        <div className="relative z-10 space-y-2 rounded-xl bg-muted/15 px-1 py-3">
          <SectionLabel icon={Bell} title="Alerts & Activity" />
          <div className="grid gap-5 grid-cols-1 md:grid-cols-3">
            <AlertsWidget alerts={summary?.alerts || []} isLoading={isLoading} />
            <RecentActivityFeed />
            <StaffOnDutyWidget />
          </div>
        </div>

        {/* ── Maintenance & Guest Insights ── */}
        <div className="relative z-10 space-y-2">
          <SectionLabel icon={Wrench} title="Maintenance & Insights" />
          <div className="grid gap-5 grid-cols-1 lg:grid-cols-2">
            <MaintenanceTrackerWidget />
            <GuestSegmentsWidget />
          </div>
        </div>

        {/* ── Revenue & Performance ── */}
        <div className="relative z-10 space-y-2 rounded-xl bg-muted/15 px-1 py-3">
          <SectionLabel icon={Zap} title="Revenue & Performance" />
          <div className="grid gap-5 grid-cols-1 md:grid-cols-2">
            <PerformanceScoreWidget />
            <RevenueBreakdownWidget />
          </div>
          <RatePlanComparisonWidget />
        </div>

        {/* ── Guest Intelligence ── */}
        <div className="relative z-10 space-y-2">
          <SectionLabel icon={Crown} title="Guest Intelligence" />
          <div className="grid gap-5 grid-cols-1 md:grid-cols-3">
            <LoyaltyWidget />
            <StaffPerformanceWidget />
            <GuestSatisfactionWidget />
          </div>
        </div>

        {/* ── Channel & Communication ── */}
        <div className="relative z-10 space-y-2 rounded-xl bg-muted/15 px-1 py-3">
          <SectionLabel icon={MessageSquare} title="Channel & Communication" />
          <div className="grid gap-5 grid-cols-1 lg:grid-cols-2">
            <ChannelPerformanceWidget />
            <GuestCommunicationWidget />
          </div>
        </div>

        {/* ── Upcoming ── */}
        <div className="relative z-10 space-y-2">
          <SectionLabel icon={Calendar} title="Upcoming" />
          <div className="grid gap-5 grid-cols-1 lg:grid-cols-3">
            <UpcomingArrivals />
            <MiniCalendarWidget />
            <UpcomingEventsWidget />
          </div>
        </div>

        {/* ── Guest Feedback ── */}
        <div className="relative z-10 space-y-2 rounded-xl bg-muted/15 px-1 py-3">
          <SectionLabel icon={Users} title="Guest Feedback" />
          <GuestFeedbackWidget />
        </div>

        {/* ── Analytics ── */}
        <div className="relative z-10 space-y-2">
          <SectionLabel icon={BarChart3} title="Analytics" />
          <DashboardCharts />
        </div>

        {/* ── Occupancy Heatmap ── */}
        <div className="relative z-10">
          <Suspense fallback={<div className="h-48 bg-muted/50 rounded-2xl animate-pulse" />}>
            <OccupancyHeatmap />
          </Suspense>
        </div>

      </div>
    </>
  );
}
