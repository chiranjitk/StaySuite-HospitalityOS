'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/contexts/CurrencyContext';
import {
  PieChart,
  DollarSign,
  Bed,
  Utensils,
  Car,
  Coffee,
  Wifi,
  Flower2,
  TrendingUp,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface RevenueSegment {
  label: string;
  amount: number;
  percentage: number;
  icon: React.ElementType;
  color: string;
  bg: string;
}

interface RevenueData {
  total: number;
  segments: RevenueSegment[];
  comparedToYesterday: number | null;
  comparedToLastWeek: number | null;
}

function DonutChart({ segments, size = 140 }: { segments: RevenueSegment[]; size?: number }) {
  const strokeWidth = 20;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="relative group">
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/10"
        />
        {/* Segments */}
        {segments.map((segment, i) => {
          const segmentLength = (segment.percentage / 100) * circumference;
          const offset = segments.slice(0, i).reduce((sum, s) => sum + (s.percentage / 100) * circumference, 0);

          return (
            <motion.circle
              key={segment.label}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              strokeWidth={strokeWidth}
              strokeLinecap="butt"
              className={segment.bg.replace('bg-', 'stroke-')}
              strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
              strokeDashoffset={-offset}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            />
          );
        })}
      </svg>
      {/* Center label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <DollarSign className="h-4 w-4 text-muted-foreground/50 mb-0.5" />
        <span className="text-[10px] text-muted-foreground font-medium">Total</span>
      </div>
    </div>
  );
}

export function RevenueBreakdownWidget() {
  const [data, setData] = useState<RevenueData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const { formatCurrency } = useCurrency();

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch('/api/dashboard');
      const result = await response.json();
      if (result.success && result.data) {
        const stats = result.data.stats;
        const charts = result.data.charts;

        if (stats?.revenue) {
          const total = stats.revenue.today || 0;
          const comparedToYesterday = stats.revenue.change != null ? stats.revenue.change : null;

          // Build segments from booking sources if available
          const bookingSources = charts?.bookingSources || [];
          const segments: RevenueSegment[] = bookingSources.map((source: { source?: string; bookings?: number }, index: number) => {
            const colors = [
              { icon: Bed, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500' },
              { icon: Utensils, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500' },
              { icon: Flower2, color: 'text-pink-600 dark:text-pink-400', bg: 'bg-pink-500' },
              { icon: Car, color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-500' },
              { icon: Coffee, color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-500' },
              { icon: Wifi, color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-500' },
            ];
            const c = colors[index % colors.length];
            return {
              label: source.source || 'Other',
              amount: 0,
              percentage: 0,
              ...c,
            };
          });

          // If no booking sources, create a single segment for total revenue
          if (segments.length === 0 && total > 0) {
            segments.push({
              label: 'Room Revenue',
              amount: total,
              percentage: 100,
              icon: Bed,
              color: 'text-emerald-600 dark:text-emerald-400',
              bg: 'bg-emerald-500',
            });
          }

          // Recalculate percentages based on booking counts
          const totalBookings = bookingSources.reduce((sum: number, s: { bookings?: number }) => sum + (s.bookings || 0), 0);
          segments.forEach((seg: RevenueSegment, idx: number) => {
            seg.percentage = totalBookings > 0
              ? Math.round(((bookingSources[idx]?.bookings || 0) / totalBookings) * 100)
              : 0;
          });

          setData({
            total,
            segments,
            comparedToYesterday,
            comparedToLastWeek: null,
          });
        } else {
          setData(null);
        }
      } else {
        setData(null);
      }
    } catch {
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 300000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (isLoading) {
    return (
      <Card className="border border-border/50 shadow-sm rounded-2xl">
        <CardHeader className="pb-3">
          <div className="h-5 w-44 bg-muted/50 animate-pulse rounded" />
        </CardHeader>
        <CardContent className="flex items-center justify-center py-6">
          <div className="h-32 w-32 rounded-full bg-muted/40 animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  if (!data || (data.total === 0 && data.segments.length === 0)) {
    return (
      <Card className="border border-border/50 shadow-sm rounded-2xl overflow-hidden">
        <div className="h-[2px] bg-gradient-to-r from-emerald-400 via-amber-400 to-pink-400" />
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <PieChart className="h-4 w-4 text-primary" />
            Revenue Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="rounded-full bg-emerald-50 dark:bg-emerald-900/40 p-3 mb-3">
              <DollarSign className="h-6 w-6 text-emerald-400 dark:text-emerald-300" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">No revenue data yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Revenue breakdown will appear once bookings are made</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const visibleSegments = expanded ? data.segments : data.segments.slice(0, 4);

  return (
    <Card className="border border-border/50 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 rounded-2xl overflow-hidden">
      {/* Accent bar */}
      <div className="h-[2px] bg-gradient-to-r from-emerald-400 via-amber-400 to-pink-400" />

      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <PieChart className="h-4 w-4 text-primary" />
            Revenue Breakdown
          </CardTitle>
          <div className="flex items-center gap-1.5">
            {data.comparedToYesterday != null && (
              <Badge variant="outline" className="text-[10px] px-2 py-0 h-5 border-emerald-200 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400">
                <TrendingUp className="h-2.5 w-2.5 mr-0.5" /> +{data.comparedToYesterday}%
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Donut + Total */}
        <div className="flex items-center gap-4">
          {data.segments.length > 0 && <DonutChart segments={data.segments} />}
          <div className="space-y-2 flex-1">
            <div>
              <p className="text-[10px] text-muted-foreground font-medium">Today&apos;s Revenue</p>
              <p className="text-xl font-bold tabular-nums">{formatCurrency(data.total)}</p>
            </div>
            {data.comparedToYesterday != null && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">vs Last Week</span>
                  <span className={cn('font-semibold', data.comparedToYesterday >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                    {data.comparedToYesterday >= 0 ? '+' : ''}{data.comparedToYesterday}%
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Segment list */}
        {data.segments.length > 0 && (
          <div className="space-y-2">
            <AnimatePresence>
              {visibleSegments.map((segment, i) => {
                const Icon = segment.icon;
                return (
                  <motion.div
                    key={segment.label}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ delay: i * 0.06 }}
                    className="flex items-center gap-2.5 group"
                  >
                    <div className={cn(
                      'h-7 w-7 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110',
                      segment.color.includes('emerald') ? 'bg-emerald-50 dark:bg-emerald-950/50' :
                      segment.color.includes('amber') ? 'bg-amber-50 dark:bg-amber-950/50' :
                      segment.color.includes('pink') ? 'bg-pink-50 dark:bg-pink-950/50' :
                      segment.color.includes('cyan') ? 'bg-cyan-50 dark:bg-cyan-950/50' :
                      segment.color.includes('violet') ? 'bg-violet-50 dark:bg-violet-950/50' :
                      'bg-slate-50 dark:bg-slate-950/50'
                    )}>
                      <Icon className={cn('h-3.5 w-3.5', segment.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-medium truncate">{segment.label}</span>
                        {segment.amount > 0 && (
                          <span className="text-xs font-bold tabular-nums">{formatCurrency(segment.amount)}</span>
                        )}
                      </div>
                      <div className="relative h-1 bg-muted/40 rounded-full overflow-hidden">
                        <motion.div
                          className={cn('absolute inset-y-0 left-0 rounded-full', segment.bg)}
                          initial={{ width: 0 }}
                          animate={{ width: `${segment.percentage}%` }}
                          transition={{ duration: 0.6, delay: i * 0.08 + 0.3 }}
                        />
                      </div>
                    </div>
                    <span className="text-[10px] font-semibold text-muted-foreground tabular-nums w-10 text-right">
                      {segment.percentage}%
                    </span>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {/* Show more/less toggle */}
            {data.segments.length > 4 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center justify-center gap-1 text-[11px] text-muted-foreground hover:text-foreground py-1 transition-colors"
              >
                {expanded ? (
                  <>Less <ChevronUp className="h-3 w-3" /></>
                ) : (
                  <>+{data.segments.length - 4} more <ChevronDown className="h-3 w-3" /></>
                )}
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
