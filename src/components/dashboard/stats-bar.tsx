'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrency } from '@/contexts/CurrencyContext';
import {
  LogIn,
  LogOut,
  BedDouble,
  IndianRupee,
  Star,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { motion } from 'framer-motion';

interface QuickStat {
  id: string;
  label: string;
  value: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  icon: React.ElementType;
  gradient: string;
  iconBg: string;
  iconColor: string;
  borderHover: string;
}

export function StatsBar() {
  const [stats, setStats] = useState<QuickStat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { formatCurrency } = useCurrency();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/dashboard/quick-stats');
        const data = await res.json();
        if (data.success) {
          const d = data.data;
          setStats([
            {
              id: 'checkins',
              label: "Today's Check-ins",
              value: String(d.checkInsToday),
              trend: d.checkInsToday > 0 ? 'up' : 'neutral',
              trendValue: d.checkInsToday > 0 ? `+${d.checkInsToday}` : '0',
              icon: LogIn,
              gradient: 'from-emerald-500/10 to-teal-500/5',
              iconBg: 'bg-emerald-500/10',
              iconColor: 'text-emerald-600 dark:text-emerald-400',
              borderHover: 'hover:border-emerald-300/50 dark:hover:border-emerald-700/50',
            },
            {
              id: 'checkouts',
              label: "Today's Check-outs",
              value: String(d.checkOutsToday),
              trend: d.checkOutsToday > 0 ? 'down' : 'neutral',
              trendValue: d.checkOutsToday > 0 ? `-${d.checkOutsToday}` : '0',
              icon: LogOut,
              gradient: 'from-orange-500/10 to-amber-500/5',
              iconBg: 'bg-orange-500/10',
              iconColor: 'text-orange-600 dark:text-orange-400',
              borderHover: 'hover:border-orange-300/50 dark:hover:border-orange-700/50',
            },
            {
              id: 'rooms',
              label: 'Available Rooms',
              value: `${d.availableRooms}/${d.totalRooms}`,
              icon: BedDouble,
              gradient: 'from-violet-500/10 to-purple-500/5',
              iconBg: 'bg-violet-500/10',
              iconColor: 'text-violet-600 dark:text-violet-400',
              borderHover: 'hover:border-violet-300/50 dark:hover:border-violet-700/50',
            },
            {
              id: 'revenue',
              label: 'Revenue Today',
              value: formatCurrency(d.revenueToday),
              trend: d.revenueChange >= 0 ? 'up' : 'down',
              trendValue: `${d.revenueChange >= 0 ? '+' : ''}${d.revenueChange}%`,
              icon: IndianRupee,
              gradient: 'from-teal-500/10 to-cyan-500/5',
              iconBg: 'bg-teal-500/10',
              iconColor: 'text-teal-600 dark:text-teal-400',
              borderHover: 'hover:border-teal-300/50 dark:hover:border-teal-700/50',
            },
            {
              id: 'rating',
              label: 'Avg Rating',
              value: `${d.avgRating} ★`,
              trend: d.ratingChange >= 0 ? 'up' : 'down',
              trendValue: `${d.ratingChange >= 0 ? '+' : ''}${d.ratingChange}`,
              icon: Star,
              gradient: 'from-amber-500/10 to-yellow-500/5',
              iconBg: 'bg-amber-500/10',
              iconColor: 'text-amber-600 dark:text-amber-400',
              borderHover: 'hover:border-amber-300/50 dark:hover:border-amber-700/50',
            },
          ]);
        }
      } catch (err) {
        console.error('Failed to fetch quick stats:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchStats();
  }, [formatCurrency]);

  if (isLoading) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-[76px] min-w-[180px] flex-shrink-0 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="relative group/stats">
      {/* Gradient fade edges on scroll */}
      <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none opacity-0 group-hover/stats:opacity-100 transition-opacity" />
      <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none opacity-0 group-hover/stats:opacity-100 transition-opacity" />

      <div className="flex gap-3 overflow-x-auto pb-1 snap-x snap-mandatory scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent hover:scrollbar-thumb-muted-foreground/40">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.3 }}
            className="snap-start flex-shrink-0"
          >
            <div
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-xl border border-transparent',
                'bg-gradient-to-br transition-all duration-200',
                'hover:shadow-md hover:-translate-y-0.5 cursor-default min-w-[170px]',
                stat.gradient,
                stat.borderHover,
                'hover:border-opacity-50'
              )}
            >
              {/* Gradient icon container */}
              <div className={cn(
                'flex h-10 w-10 items-center justify-center rounded-xl flex-shrink-0',
                'bg-gradient-to-br shadow-sm transition-transform duration-200 hover:scale-110',
                stat.iconBg
              )}>
                <stat.icon className={cn('h-5 w-5', stat.iconColor)} />
              </div>

              {/* Value + trend */}
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground font-medium leading-none mb-1">
                  {stat.label}
                </p>
                <p className="text-base font-bold tabular-nums leading-none truncate">
                  {stat.value}
                </p>
                {stat.trend && stat.trendValue && stat.trend !== 'neutral' && (
                  <div className={cn(
                    'flex items-center gap-0.5 mt-0.5 text-[10px] font-semibold tabular-nums',
                    stat.trend === 'up' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
                  )}>
                    {stat.trend === 'up' ? (
                      <TrendingUp className="h-2.5 w-2.5" />
                    ) : (
                      <TrendingDown className="h-2.5 w-2.5" />
                    )}
                    <span>{stat.trendValue}</span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
