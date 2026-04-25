'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/contexts/CurrencyContext';
import { TrendingUp, TrendingDown, DollarSign, CalendarDays, RefreshCw, ShieldAlert } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

interface RevenueTrendData {
  todayRevenue: number;
  yesterdayRevenue: number;
  weeklyTotal: number;
  changePercent: number;
  dailyData: Array<{ day: string; revenue: number }>;
  currency: string;
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background/95 backdrop-blur-sm px-3 py-2 shadow-xl">
      <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
      <p className="text-sm font-semibold tabular-nums">
        {payload[0].value.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}
      </p>
    </div>
  );
}

function SkeletonView() {
  return (
    <Card className="border border-border/50 shadow-sm">
      <CardHeader className="pb-3">
        <Skeleton className="h-5 w-40" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-[200px] w-full rounded-lg" />
      </CardContent>
    </Card>
  );
}

export function RevenueTrendWidget() {
  const [data, setData] = useState<RevenueTrendData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { formatCurrency } = useCurrency();

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/revenue-trend');
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        setError(null);
      } else {
        setError(json.error?.message || 'Failed to load revenue trend');
      }
    } catch {
      setError('Network error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (isLoading) return <SkeletonView />;
  if (error || !data) {
    return (
      <Card className="border border-border/50 shadow-sm">
        <CardContent className="p-6 flex flex-col items-center justify-center gap-2 text-center">
          <ShieldAlert className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{error || 'Unable to load revenue data'}</p>
          <button onClick={fetchData} className="text-xs text-primary hover:underline flex items-center gap-1 mt-1">
            <RefreshCw className="h-3 w-3" /> Retry
          </button>
        </CardContent>
      </Card>
    );
  }

  const isPositive = data.changePercent > 0;
  const isNegative = data.changePercent < 0;

  const kpis = [
    {
      label: "Today's Revenue",
      value: formatCurrency(data.todayRevenue),
      icon: DollarSign,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-900/40',
      border: 'border-emerald-200/60 dark:border-emerald-800/40',
    },
    {
      label: 'vs Yesterday',
      value: isPositive ? `+${data.changePercent}%` : `${data.changePercent}%`,
      icon: isPositive ? TrendingUp : TrendingDown,
      color: isPositive ? 'text-emerald-600 dark:text-emerald-400' : isNegative ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground',
      bg: isPositive ? 'bg-emerald-50 dark:bg-emerald-900/40' : isNegative ? 'bg-red-50 dark:bg-red-900/40' : 'bg-muted',
      border: isPositive ? 'border-emerald-200/60 dark:border-emerald-800/40' : isNegative ? 'border-red-200/60 dark:border-red-800/40' : 'border-border',
    },
    {
      label: 'Weekly Total',
      value: formatCurrency(data.weeklyTotal),
      icon: CalendarDays,
      color: 'text-teal-600 dark:text-teal-400',
      bg: 'bg-teal-50 dark:bg-teal-900/40',
      border: 'border-teal-200/60 dark:border-teal-800/40',
    },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <Card className="border border-border/50 shadow-sm hover:shadow-md transition-shadow duration-300">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            Revenue Trend — Last 7 Days
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 3 KPI Mini-Cards */}
          <div className="grid grid-cols-3 gap-3">
            {kpis.map((kpi, i) => (
              <div
                key={i}
                className={cn(
                  'p-3 rounded-xl border transition-all hover:shadow-sm',
                  kpi.bg, kpi.border
                )}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <kpi.icon className={cn('h-3.5 w-3.5', kpi.color)} />
                  <span className="text-[11px] text-muted-foreground">{kpi.label}</span>
                </div>
                <p className={cn('text-lg font-bold tabular-nums', kpi.color)}>{kpi.value}</p>
              </div>
            ))}
          </div>

          {/* Area Chart with gradient fill */}
          <div className="h-[200px] w-full -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.dailyData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} dy={8} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} width={52} tickFormatter={(v: number) => v >= 1000 ? `₹${(v / 1000).toFixed(0)}K` : `₹${v}`} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1, strokeDasharray: '4 4' }} />
                <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2.5} fill="url(#revGradient)" dot={false} activeDot={{ r: 5, fill: '#10b981', stroke: 'hsl(var(--background))', strokeWidth: 2 }} animationDuration={1000} animationEasing="ease-out" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
