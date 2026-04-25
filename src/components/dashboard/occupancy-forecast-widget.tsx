'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { BarChart3, ShieldAlert, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

interface ForecastDay {
  date: string;
  day: string;
  isToday: boolean;
  occupancy: number;
}

interface OccupancyForecastData {
  forecastData: ForecastDay[];
  avgOccupancy: number;
  totalRooms: number;
}

function getBarColor(occupancy: number): string {
  if (occupancy >= 85) return '#ef4444';   // red — near-full
  if (occupancy >= 60) return '#f59e0b';   // amber — moderate
  return '#10b981';                         // green — available
}

function getBarBg(occupancy: number): string {
  if (occupancy >= 85) return 'bg-red-50 dark:bg-red-900/40';
  if (occupancy >= 60) return 'bg-amber-50 dark:bg-amber-900/40';
  return 'bg-emerald-50 dark:bg-emerald-900/40';
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const val = payload[0].value;
  return (
    <div className="rounded-lg border bg-background/95 backdrop-blur-sm px-3 py-2 shadow-xl">
      <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
      <p className="text-sm font-semibold tabular-nums">{val}% occupied</p>
    </div>
  );
}

function SkeletonView() {
  return (
    <Card className="border border-border/50 shadow-sm">
      <CardHeader className="pb-3">
        <Skeleton className="h-5 w-44" />
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-[200px] w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
      </CardContent>
    </Card>
  );
}

export function OccupancyForecastWidget() {
  const [data, setData] = useState<OccupancyForecastData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/occupancy-forecast');
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        setError(null);
      } else {
        setError(json.error?.message || 'Failed to load occupancy forecast');
      }
    } catch {
      setError('Network error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (isLoading) return <SkeletonView />;
  if (error || !data) {
    return (
      <Card className="border border-border/50 shadow-sm">
        <CardContent className="p-6 flex flex-col items-center justify-center gap-2 text-center">
          <ShieldAlert className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{error || 'Unable to load forecast'}</p>
          <button onClick={fetchData} className="text-xs text-primary hover:underline flex items-center gap-1 mt-1">
            <RefreshCw className="h-3 w-3" /> Retry
          </button>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
      <Card className="border border-border/50 shadow-sm hover:shadow-md transition-shadow duration-300">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            Occupancy Forecast — Next 7 Days
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Bar Chart */}
          <div className="h-[200px] w-full -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.forecastData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="day"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  dy={8}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  width={36}
                  domain={[0, 100]}
                  tickFormatter={(v: number) => `${v}%`}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'hsl(var(--muted-foreground) / 0.05)' }} />
                <Bar dataKey="occupancy" radius={[6, 6, 0, 0]} animationDuration={800} animationEasing="ease-out">
                  {data.forecastData.map((entry, idx) => (
                    <Cell key={idx} fill={getBarColor(entry.occupancy)} opacity={entry.isToday ? 1 : 0.75} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Percentage labels row */}
          <div className="flex justify-between px-1">
            {data.forecastData.map((d, i) => (
              <div key={i} className="flex flex-col items-center gap-0.5 min-w-[38px]">
                <span
                  className={cn(
                    'text-xs font-bold tabular-nums',
                    d.occupancy >= 85 ? 'text-red-600 dark:text-red-400' :
                    d.occupancy >= 60 ? 'text-amber-600 dark:text-amber-400' :
                    'text-emerald-600 dark:text-emerald-400'
                  )}
                >
                  {d.occupancy}%
                </span>
                {d.isToday && (
                  <span className="text-[9px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded-full leading-none">Today</span>
                )}
              </div>
            ))}
          </div>

          {/* Divider */}
          <div className="h-px bg-border" />

          {/* Summary row */}
          <div className="flex items-center justify-between rounded-xl bg-muted/50 p-3">
            <div className="flex items-center gap-2">
              <div className={cn(
                'h-2 w-2 rounded-full',
                data.avgOccupancy >= 85 ? 'bg-red-500' :
                data.avgOccupancy >= 60 ? 'bg-amber-500' :
                'bg-emerald-500'
              )} />
              <span className="text-xs text-muted-foreground">Avg. Forecast Occupancy</span>
            </div>
            <span className={cn(
              'text-sm font-bold tabular-nums',
              data.avgOccupancy >= 85 ? 'text-red-600 dark:text-red-400' :
              data.avgOccupancy >= 60 ? 'text-amber-600 dark:text-amber-400' :
              'text-emerald-600 dark:text-emerald-400'
            )}>
              {data.avgOccupancy}%
            </span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
