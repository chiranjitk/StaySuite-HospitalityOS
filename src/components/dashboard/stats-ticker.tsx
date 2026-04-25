'use client';

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useTimezone } from '@/contexts/TimezoneContext';
import {
  Calendar,
  LogIn,
  LogOut,
  Users,
  Bed,
  DollarSign,
  TrendingUp,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface DashboardData {
  stats: {
    revenue: { today: number; thisWeek: number; thisMonth: number; change: number | null };
    occupancy: { today: number; thisWeek: number; thisMonth: number; change: number };
    bookings: { today: number; thisWeek: number; thisMonth: number; pending: number };
    guests: { checkedIn: number; arriving: number; departing: number; total: number };
    adr: number;
    revpar: number;
  };
  commandCenter: {
    rooms: {
      available: number;
      occupied: number;
      maintenance: number;
      dirty: number;
      out_of_order: number;
    };
    totalRooms: number;
    upcomingCheckIns: number;
    staffOnDuty: number;
  };
}

interface TickerMetric {
  id: string;
  icon: React.ElementType;
  label: string;
  value: string;
  iconColor: string;
}

/* ------------------------------------------------------------------ */
/*  Skeleton fallback                                                  */
/* ------------------------------------------------------------------ */

function TickerSkeleton() {
  return (
    <div className="relative flex items-center gap-0 overflow-hidden rounded-xl border border-border bg-card px-1 py-2.5">
      {/* Left gradient bar */}
      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl bg-gradient-to-b from-[var(--gradient-start)] to-[var(--gradient-end)]" />
      <div className="flex items-center gap-5 overflow-x-auto px-3 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent no-scrollbar">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2 flex-shrink-0">
            <Skeleton className="h-5 w-5 rounded-md" />
            <div className="flex flex-col gap-1">
              <Skeleton className="h-2.5 w-14" />
              <Skeleton className="h-3.5 w-10" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Single metric pill                                                 */
/* ------------------------------------------------------------------ */

function MetricPill({
  metric,
  index,
  isLast,
}: {
  metric: TickerMetric;
  index: number;
  isLast: boolean;
}) {
  const Icon = metric.icon;

  return (
    <div className="flex items-center gap-2">
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.04, duration: 0.35, ease: 'easeOut' }}
        className="group flex items-center gap-2 rounded-lg px-2.5 py-1.5 transition-colors duration-200 hover:bg-[oklch(from_var(--muted)_l_c_h_/_0.6)]"
      >
        {/* Icon */}
        <div
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-md transition-transform duration-200 group-hover:scale-110',
            metric.iconColor
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </div>

        {/* Text */}
        <div className="flex flex-col leading-none">
          <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">
            {metric.label}
          </span>
          <span className="text-xs font-bold tabular-nums text-foreground whitespace-nowrap">
            {metric.value}
          </span>
        </div>
      </motion.div>

      {/* Divider */}
      {!isLast && (
        <div
          className="mx-1 h-5 w-px flex-shrink-0 bg-border/60"
          aria-hidden="true"
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function StatsTicker() {
  const { formatCurrency } = useCurrency();
  const { settings } = useTimezone();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ---- Fetch data ---- */
  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
        setError(false);
      } else {
        throw new Error('Invalid response');
      }
    } catch (err) {
      console.error('[StatsTicker] Failed to fetch dashboard data:', err);
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /* ---- Initial fetch + auto-refresh every 5 min ---- */
  useEffect(() => {
    fetchDashboard();
    intervalRef.current = setInterval(fetchDashboard, 5 * 60 * 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchDashboard]);

  /* ---- Format today's date nicely using the timezone context ---- */
  const formattedDate = useMemo(() => {
    const now = new Date();
    try {
      return now.toLocaleDateString('en-US', {
        timeZone: settings.timezone,
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return now.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      });
    }
  }, [settings.timezone]);

  /* ---- Build metric list from data ---- */
  const metrics = useMemo((): TickerMetric[] => {
    if (!data) return [];

    const { stats, commandCenter } = data;

    return [
      {
        id: 'date',
        icon: Calendar,
        label: 'Today',
        value: formattedDate,
        iconColor:
          'bg-[oklch(from_var(--gradient-start)_l_c_h_/_0.12)] text-[var(--gradient-start)]',
      },
      {
        id: 'arrivals',
        icon: LogIn,
        label: 'Arrivals',
        value: String(stats.guests.arriving),
        iconColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      },
      {
        id: 'departures',
        icon: LogOut,
        label: 'Departures',
        value: String(stats.guests.departing),
        iconColor: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
      },
      {
        id: 'inhouse',
        icon: Users,
        label: 'In-House',
        value: String(commandCenter.rooms.occupied),
        iconColor: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
      },
      {
        id: 'available',
        icon: Bed,
        label: 'Available',
        value: `${commandCenter.rooms.available}/${commandCenter.totalRooms}`,
        iconColor: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
      },
      {
        id: 'revenue',
        icon: DollarSign,
        label: "Today's Revenue",
        value: formatCurrency(stats.revenue.today),
        iconColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
      },
      {
        id: 'occupancy',
        icon: TrendingUp,
        label: 'Occupancy',
        value: `${stats.occupancy.today}%`,
        iconColor: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
      },
    ];
  }, [data, formattedDate, formatCurrency]);

  /* ---- Render states ---- */
  if (isLoading) return <TickerSkeleton />;

  if (error || !data) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border border-dashed border-border bg-card px-4 py-3"
        role="status"
      >
        <span className="text-xs text-muted-foreground">
          Unable to load today&apos;s operations
        </span>
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="ticker"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="relative flex items-center overflow-hidden rounded-xl border border-border bg-card"
      >
        {/* ---- Left gradient accent bar ---- */}
        <div className="absolute left-0 top-0 bottom-0 w-1 flex-shrink-0 bg-gradient-to-b from-[var(--gradient-start)] to-[var(--gradient-end)]" />

        {/* ---- Scrolling metrics row ---- */}
        <div className="flex items-center gap-0 overflow-x-auto px-3 py-2.5 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent scroll-smooth">
          {metrics.map((metric, i) => (
            <MetricPill
              key={metric.id}
              metric={metric}
              index={i}
              isLast={i === metrics.length - 1}
            />
          ))}
        </div>

        {/* ---- Right fade mask on scroll hint ---- */}
        <div
          className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[var(--card)] to-transparent"
          aria-hidden="true"
        />
      </motion.div>
    </AnimatePresence>
  );
}
