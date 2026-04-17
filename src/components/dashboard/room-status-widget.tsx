'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/store';
import {
  DoorOpen,
  BedDouble,
  ShieldAlert,
  Paintbrush,
  XCircle,
  LogIn,
  LogOut,
  ArrowRight,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface RoomStatusCounts {
  available: number;
  occupied: number;
  maintenance: number;
  dirty: number;
  out_of_order: number;
}

interface RoomStatusData {
  statusCounts: RoomStatusCounts;
  totalRooms: number;
  occupancyRate: number;
  todaysArrivals: number;
  todaysDepartures: number;
}

/* ------------------------------------------------------------------ */
/*  Status config                                                      */
/* ------------------------------------------------------------------ */

interface StatusItem {
  key: keyof RoomStatusCounts;
  label: string;
  icon: LucideIcon;
  bg: string;
  text: string;
  ring: string;
  bar: string;
  tooltip: string;
}

const statusItems: StatusItem[] = [
  {
    key: 'available',
    label: 'Available',
    icon: DoorOpen,
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
    text: 'text-emerald-700 dark:text-emerald-400',
    ring: 'ring-emerald-500/30',
    bar: 'bg-emerald-500',
    tooltip: 'Ready for check-in — clean and vacant',
  },
  {
    key: 'occupied',
    label: 'Occupied',
    icon: BedDouble,
    bg: 'bg-violet-100 dark:bg-violet-900/30',
    text: 'text-violet-700 dark:text-violet-400',
    ring: 'ring-violet-500/30',
    bar: 'bg-violet-500',
    tooltip: 'Currently in use by a checked-in guest',
  },
  {
    key: 'dirty',
    label: 'Dirty',
    icon: Paintbrush,
    bg: 'bg-orange-100 dark:bg-orange-900/30',
    text: 'text-orange-700 dark:text-orange-400',
    ring: 'ring-orange-500/30',
    bar: 'bg-orange-500',
    tooltip: 'Needs housekeeping before next guest',
  },
  {
    key: 'maintenance',
    label: 'Maintenance',
    icon: ShieldAlert,
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    text: 'text-amber-700 dark:text-amber-400',
    ring: 'ring-amber-500/30',
    bar: 'bg-amber-500',
    tooltip: 'Under repair or scheduled maintenance',
  },
  {
    key: 'out_of_order',
    label: 'Out of Order',
    icon: XCircle,
    bg: 'bg-slate-100 dark:bg-slate-800/60',
    text: 'text-slate-600 dark:text-slate-400',
    ring: 'ring-slate-400/30',
    bar: 'bg-slate-500',
    tooltip: 'Temporarily unavailable — pending resolution',
  },
];

/* ------------------------------------------------------------------ */
/*  Animated circular ring                                             */
/* ------------------------------------------------------------------ */

function OccupancyRing({ value, size = 100 }: { value: number; size?: number }) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (value / 100) * circumference;
  const center = size / 2;

  // Determine ring color based on occupancy level
  const ringColor =
    value >= 90
      ? 'text-red-500'
      : value >= 70
        ? 'text-amber-500'
        : value >= 40
          ? 'text-emerald-500'
          : 'text-teal-500';

  const gradientId = 'occupancyGrad';
  const stopColor1 =
    value >= 90
      ? '#ef4444'
      : value >= 70
        ? '#f59e0b'
        : value >= 40
          ? '#10b981'
          : '#14b8a6';
  const stopColor2 =
    value >= 90
      ? '#dc2626'
      : value >= 70
        ? '#d97706'
        : value >= 40
          ? '#059669'
          : '#0d9488';

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={stopColor1} />
            <stop offset="100%" stopColor={stopColor2} />
          </linearGradient>
        </defs>
        {/* Background ring */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          className="text-muted/40"
        />
        {/* Progress ring */}
        <motion.circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.2, ease: 'easeOut', delay: 0.2 }}
        />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className={cn('text-xl font-bold tabular-nums', ringColor)}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          {value}%
        </motion.span>
        <span className="text-[10px] text-muted-foreground leading-none mt-0.5">Occupancy</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Stacked horizontal bar chart                                       */
/* ------------------------------------------------------------------ */

function DistributionBar({
  statusCounts,
  totalRooms,
}: {
  statusCounts: RoomStatusCounts;
  totalRooms: number;
}) {
  const segments = statusItems.map((s) => ({
    key: s.key,
    bar: s.bar,
    pct: totalRooms > 0 ? (statusCounts[s.key] / totalRooms) * 100 : 0,
    count: statusCounts[s.key],
  }));

  return (
    <div className="space-y-2">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
        <AnimatePresence>
          {segments.map((seg) => (
            <motion.div
              key={seg.key}
              className={cn('h-full', seg.bar)}
              initial={{ width: 0 }}
              animate={{ width: `${seg.pct}%` }}
              transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
            />
          ))}
        </AnimatePresence>
      </div>
      {/* Legend row */}
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {segments.map((seg) => {
          const config = statusItems.find((s) => s.key === seg.key)!;
          return (
            <div key={seg.key} className="flex items-center gap-1.5">
              <span className={cn('inline-block h-2 w-2 rounded-full', seg.bar)} />
              <span className="text-[11px] text-muted-foreground leading-none">
                {config.label}{' '}
                <span className="font-medium tabular-nums">{seg.count}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Skeleton                                                           */
/* ------------------------------------------------------------------ */

function RoomStatusSkeleton() {
  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-5 w-16" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-5">
          <Skeleton className="h-[100px] w-[100px] rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-full rounded-full" />
            <div className="flex gap-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-6 w-14 rounded-full" />
              ))}
            </div>
          </div>
        </div>
        <Skeleton className="h-3 w-full rounded-full" />
        <div className="flex gap-3">
          <Skeleton className="h-12 flex-1 rounded-lg" />
          <Skeleton className="h-12 flex-1 rounded-lg" />
        </div>
        <Skeleton className="h-8 w-full rounded-lg" />
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Main widget                                                        */
/* ------------------------------------------------------------------ */

export function RoomStatusWidget() {
  const { setActiveSection } = useUIStore();
  const [data, setData] = useState<RoomStatusData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/room-status');
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        setError(null);
      } else {
        setError(json.error?.message || 'Failed to load room status');
      }
    } catch {
      setError('Network error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (isLoading) return <RoomStatusSkeleton />;

  if (error || !data) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6 flex flex-col items-center justify-center gap-2 text-center">
          <ShieldAlert className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{error || 'Unable to load room data'}</p>
          <Button variant="outline" size="sm" onClick={fetchData} className="mt-1">
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <Card className="border-0 shadow-sm hover:shadow-md transition-shadow duration-300">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <DoorOpen className="h-4 w-4 text-teal-600" />
              Room Status Overview
            </CardTitle>
            <Badge variant="outline" className="text-xs font-normal gap-1">
              <BedDouble className="h-3 w-3" />
              {data.totalRooms} rooms
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Top section: occupancy ring + status badges */}
          <div className="flex items-center gap-5">
            {/* Occupancy ring */}
            <OccupancyRing value={data.occupancyRate} size={100} />

            {/* Status count badges */}
            <div className="flex-1 space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {statusItems.map((s) => {
                  const count = data.statusCounts[s.key];
                  const Icon = s.icon;
                  return (
                    <Tooltip key={s.key}>
                      <TooltipTrigger asChild>
                        <div
                          className={cn(
                            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium cursor-default transition-transform hover:scale-105',
                            s.bg,
                            s.text
                          )}
                        >
                          <Icon className="h-3 w-3" />
                          <span className="tabular-nums">{count}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs max-w-[220px]">
                        <p className="font-medium">{s.label}</p>
                        <p className="text-muted-foreground">{s.tooltip}</p>
                        <p className="mt-0.5 tabular-nums">
                          {data.totalRooms > 0
                            ? Math.round((count / data.totalRooms) * 100)
                            : 0}
                          % of all rooms
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>

              {/* Quick occupied/available summary */}
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-violet-500" />
                  <span className="tabular-nums">{data.statusCounts.occupied}</span> occupied
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span className="tabular-nums">{data.statusCounts.available}</span> available
                </span>
              </div>
            </div>
          </div>

          {/* Distribution bar */}
          <DistributionBar statusCounts={data.statusCounts} totalRooms={data.totalRooms} />

          {/* Divider */}
          <div className="h-px bg-border" />

          {/* Today's arrivals & departures */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/15 dark:to-emerald-900/15 border border-green-200/50 dark:border-green-800/40">
              <div className="p-1.5 rounded-md bg-green-100 dark:bg-green-900/40">
                <LogIn className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground leading-none">Arrivals</p>
                <p className="text-lg font-bold text-green-600 dark:text-green-400 tabular-nums leading-tight">
                  {data.todaysArrivals}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/15 dark:to-amber-900/15 border border-orange-200/50 dark:border-orange-800/40">
              <div className="p-1.5 rounded-md bg-orange-100 dark:bg-orange-900/40">
                <LogOut className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground leading-none">Departures</p>
                <p className="text-lg font-bold text-orange-600 dark:text-orange-400 tabular-nums leading-tight">
                  {data.todaysDepartures}
                </p>
              </div>
            </div>
          </div>

          {/* View Room Grid button */}
          <Button
            variant="outline"
            className="w-full h-8 text-xs gap-1.5 hover:bg-muted/60 transition-colors"
            onClick={() => setActiveSection('frontdesk-room-grid')}
          >
            <DoorOpen className="h-3.5 w-3.5" />
            View Room Grid
            <ArrowRight className="h-3 w-3 ml-auto" />
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}
