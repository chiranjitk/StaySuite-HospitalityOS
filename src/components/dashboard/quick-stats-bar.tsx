'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  LogIn,
  LogOut,
  DoorOpen,
  DollarSign,
  Star,
  TrendingUp,
  TrendingDown,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/contexts/CurrencyContext';

interface QuickStatsData {
  checkInsToday: number;
  checkOutsToday: number;
  availableRooms: number;
  totalRooms: number;
  revenueToday: number;
  revenueChange: number;
  avgRating: number;
  ratingChange: number;
}

const INITIAL_STATS: QuickStatsData = {
  checkInsToday: 12,
  checkOutsToday: 8,
  availableRooms: 45,
  totalRooms: 120,
  revenueToday: 245000,
  revenueChange: 8.5,
  avgRating: 4.3,
  ratingChange: 0.1,
};

export function QuickStatsBar() {
  const [stats, setStats] = useState<QuickStatsData>(INITIAL_STATS);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const { formatCurrency } = useCurrency();

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/dashboard/quick-stats');
      const result = await response.json();
      if (result.success && result.data) {
        setStats(result.data);
        setLastRefresh(new Date());
      }
    } catch {
      // Keep using existing stats on error
    }
  }, []);

  useEffect(() => {
    const load = () => { void fetchStats(); };
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const statItems = [
    {
      id: 'revenue',
      label: "Today's Revenue",
      value: formatCurrency(stats.revenueToday),
      icon: DollarSign,
      trend: stats.revenueChange >= 0 ? 'up' : 'down',
      trendValue: `${stats.revenueChange >= 0 ? '+' : ''}${stats.revenueChange}%`,
      iconBg: 'bg-gradient-to-br from-emerald-500/15 to-emerald-500/5',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      borderHover: 'hover:border-emerald-200 dark:hover:border-emerald-800',
    },
    {
      id: 'checkins',
      label: "Check-ins Today",
      value: String(stats.checkInsToday),
      icon: LogIn,
      trend: 'neutral',
      trendValue: '',
      iconBg: 'bg-gradient-to-br from-sky-500/15 to-sky-500/5',
      iconColor: 'text-sky-600 dark:text-sky-400',
      borderHover: 'hover:border-sky-200 dark:hover:border-sky-800',
    },
    {
      id: 'checkouts',
      label: "Check-outs Today",
      value: String(stats.checkOutsToday),
      icon: LogOut,
      trend: 'neutral',
      trendValue: '',
      iconBg: 'bg-gradient-to-br from-amber-500/15 to-amber-500/5',
      iconColor: 'text-amber-600 dark:text-amber-400',
      borderHover: 'hover:border-amber-200 dark:hover:border-amber-800',
    },
    {
      id: 'rooms',
      label: 'Available Rooms',
      value: `${stats.availableRooms}/${stats.totalRooms}`,
      icon: DoorOpen,
      trend: 'neutral',
      trendValue: '',
      iconBg: 'bg-gradient-to-br from-violet-500/15 to-violet-500/5',
      iconColor: 'text-violet-600 dark:text-violet-400',
      borderHover: 'hover:border-violet-200 dark:hover:border-violet-800',
    },
    {
      id: 'rating',
      label: 'Avg Rating',
      value: `${stats.avgRating}`,
      icon: Star,
      trend: stats.ratingChange >= 0 ? 'up' : 'down',
      trendValue: `${stats.ratingChange >= 0 ? '+' : ''}${stats.ratingChange}`,
      iconBg: 'bg-gradient-to-br from-rose-500/15 to-rose-500/5',
      iconColor: 'text-rose-600 dark:text-rose-400',
      borderHover: 'hover:border-rose-200 dark:hover:border-rose-800',
    },
  ];

  return (
    <div className="relative">
      <div className="w-full overflow-x-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent -mx-2 sm:-mx-3 lg:-mx-4 px-2 sm:px-3 lg:px-4">
        <div className="flex flex-wrap gap-2 sm:gap-3 min-w-max lg:min-w-0">
          {statItems.map((stat, idx) => (
            <div
              key={stat.id}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl bg-card/80 border border-border/50 shadow-sm',
                stat.borderHover,
                'hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group cursor-default min-w-[150px] sm:min-w-[170px]'
              )}
              style={{ animation: `cardEntrance 0.3s ease-out ${idx * 0.05}s both` }}
            >
              {/* Icon */}
              <div
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-110',
                  stat.iconBg
                )}
              >
                <stat.icon className={cn('h-4 w-4', stat.iconColor)} />
              </div>

              {/* Value + Label */}
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-semibold text-foreground leading-tight truncate" style={{ fontFeatureSettings: 'tnum' }}>
                  {stat.value}
                </span>
                <span className="text-[11px] text-muted-foreground leading-tight truncate">
                  {stat.label}
                </span>
              </div>

              {/* Trend */}
              {stat.trend !== 'neutral' && (
                <span
                  className={cn(
                    'flex items-center gap-0.5 text-[11px] font-medium ml-auto shrink-0',
                    stat.trend === 'up'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-amber-600 dark:text-amber-400'
                  )}
                >
                  {stat.trend === 'up' ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {stat.trendValue}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
      {/* Auto-refresh indicator */}
      <button
        onClick={fetchStats}
        className="absolute top-1 right-1 sm:top-1.5 sm:right-1 p-1 rounded-md text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        title={`Last refreshed: ${lastRefresh.toLocaleTimeString()}`}
      >
        <RefreshCw className="h-3 w-3" />
      </button>
    </div>
  );
}
