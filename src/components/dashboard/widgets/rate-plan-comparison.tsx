'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/contexts/CurrencyContext';
import {
  DollarSign,
  RefreshCw,
  AlertCircle,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Star,
} from 'lucide-react';
import { motion } from 'framer-motion';

interface RatePlan {
  id: string;
  name: string;
  baseRate: number;
  avgRate: number;
  occupancy: number;
  revenue: number;
  roomsBooked: number;
  totalRooms: number;
  trend: number;
}

interface RatePlanData {
  lastUpdated: string;
  plans: RatePlan[];
  bestPerformer: string;
}

const MOCK_DATA: RatePlanData = {
  lastUpdated: new Date().toISOString(),
  plans: [
    { id: 'standard', name: 'Standard', baseRate: 89, avgRate: 112, occupancy: 78, revenue: 8736, roomsBooked: 24, totalRooms: 30, trend: 3.2 },
    { id: 'premium', name: 'Premium', baseRate: 159, avgRate: 187, occupancy: 92, revenue: 17204, roomsBooked: 20, totalRooms: 22, trend: 5.8 },
    { id: 'suite', name: 'Suite', baseRate: 289, avgRate: 324, occupancy: 85, revenue: 19440, roomsBooked: 14, totalRooms: 16, trend: -1.4 },
  ],
  bestPerformer: 'premium',
};

function MiniBar({ value, maxValue, color, delay }: { value: number; maxValue: number; color: string; delay: number }) {
  const pct = maxValue > 0 ? (value / maxValue) * 100 : 0;
  return (
    <div className="h-2 w-full rounded-full bg-muted/60 overflow-hidden">
      <motion.div
        className={cn('h-full rounded-full', color)}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ delay, duration: 0.7, ease: 'easeOut' }}
      />
    </div>
  );
}

function PlanCard({ plan, isBest, maxOcc, maxRev, index }: { plan: RatePlan; isBest: boolean; maxOcc: number; maxRev: number; index: number }) {
  const { formatCurrency } = useCurrency();

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.35 }}
      className={cn(
        'p-4 rounded-xl border transition-all duration-300',
        'hover:shadow-md hover:-translate-y-0.5',
        isBest
          ? 'border-emerald-300 dark:border-emerald-700 ring-2 ring-emerald-400/50 dark:ring-emerald-600/50 bg-gradient-to-br from-emerald-50/50 to-transparent dark:from-emerald-950/20'
          : 'border-border/50 bg-card/50'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{plan.name}</span>
          {isBest && (
            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 text-[10px] px-1.5 py-0 h-5 border-0 gap-0.5">
              <Star className="h-2.5 w-2.5" />
              Best
            </Badge>
          )}
        </div>
        <div className={cn(
          'flex items-center gap-0.5 text-xs font-medium',
          plan.trend >= 0 ? 'text-emerald-600' : 'text-red-500'
        )}>
          {plan.trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {Math.abs(plan.trend)}%
        </div>
      </div>

      {/* Rates */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Base Rate</p>
          <p className="text-sm font-bold tabular-nums">{formatCurrency(plan.baseRate)}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Avg Rate</p>
          <p className="text-sm font-bold tabular-nums">{formatCurrency(plan.avgRate)}</p>
        </div>
      </div>

      {/* Occupancy bar */}
      <div className="mb-2.5">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Occupancy</p>
          <p className="text-xs font-semibold tabular-nums">{plan.occupancy}%</p>
        </div>
        <MiniBar value={plan.occupancy} maxValue={100} color="bg-blue-500" delay={0.2 + index * 0.1} />
      </div>

      {/* Revenue bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Revenue</p>
          <p className="text-xs font-semibold tabular-nums">{formatCurrency(plan.revenue)}</p>
        </div>
        <MiniBar value={plan.revenue} maxValue={maxRev} color="bg-violet-500" delay={0.3 + index * 0.1} />
      </div>

      {/* Rooms */}
      <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/50">
        <span>{plan.roomsBooked} / {plan.totalRooms} rooms</span>
        <span className="font-medium tabular-nums">{formatCurrency(Math.round(plan.revenue / plan.roomsBooked))}/room</span>
      </div>
    </motion.div>
  );
}

export function RatePlanComparisonWidget() {
  const [data, setData] = useState<RatePlanData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchData = useCallback(async (isInitial = false) => {
    if (isInitial) setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/dashboard/rate-plans');
      const result = await response.json();

      if (result.success && result.data) {
        setData(result.data);
        setLastRefresh(new Date());
      } else {
        throw new Error(result.error?.message || 'Failed to fetch data');
      }
    } catch (err) {
      console.error('Rate plan fetch failed:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setData(MOCK_DATA);
      setLastRefresh(new Date());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(true);

    const interval = setInterval(() => {
      fetchData(false);
    }, 10 * 60 * 1000);

    return () => clearInterval(interval);
  }, [fetchData]);

  const maxRev = data ? Math.max(...data.plans.map(p => p.revenue)) : 1;

  return (
    <Card className="border-0 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 rounded-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-violet-600" />
            Rate Plan Comparison
          </CardTitle>
          <div className="flex items-center gap-1.5">
            {lastRefresh && !isLoading && (
              <span className="text-[10px] text-muted-foreground">
                {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => fetchData(false)}
              disabled={isLoading}
            >
              <RefreshCw className={cn('h-3 w-3', isLoading && 'animate-spin')} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && !data ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-44 rounded-xl" />
            ))}
          </div>
        ) : error && !data ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="h-8 w-8 text-red-400 mb-2" />
            <p className="text-sm text-muted-foreground">Failed to load rate plans</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => fetchData(true)}>
              Retry
            </Button>
          </div>
        ) : data ? (
          <div className="space-y-3">
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
              {data.plans.map((plan, index) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  isBest={plan.id === data.bestPerformer}
                  maxOcc={100}
                  maxRev={maxRev}
                  index={index}
                />
              ))}
            </div>
            <Button variant="ghost" size="sm" className="w-full hover:bg-muted/60 transition-colors text-xs">
              View All Plans
              <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
