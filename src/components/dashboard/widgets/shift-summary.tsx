'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  Clock,
  Users,
  Bed,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  ArrowRight,
  Coffee,
  LogIn,
  LogOut,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ShiftStats {
  shiftName: string;
  shiftStart: string;
  shiftEnd: string;
  elapsed: string;
  remaining: string;
  progressPercent: number;
  checkIns: number;
  checkOuts: number;
  revenue: number;
  pendingRequests: number;
  occupancyChange: number;
  highlights: ShiftHighlight[];
}

interface ShiftHighlight {
  id: string;
  type: 'success' | 'warning' | 'info' | 'alert';
  message: string;
  time: string;
}

const MOCK_DATA: ShiftStats = {
  shiftName: 'Morning Shift',
  shiftStart: '06:00',
  shiftEnd: '14:00',
  elapsed: '6h 32m',
  remaining: '1h 28m',
  progressPercent: 82,
  checkIns: 8,
  checkOuts: 5,
  revenue: 124500,
  pendingRequests: 3,
  occupancyChange: 4.2,
  highlights: [
    { id: 'h1', type: 'success', message: 'VIP suite 501 early check-in completed', time: '12:45' },
    { id: 'h2', type: 'warning', message: 'Room 204 AC unit needs urgent repair', time: '11:30' },
    { id: 'h3', type: 'info', message: 'Group booking for 12 rooms confirmed', time: '10:15' },
    { id: 'h4', type: 'alert', message: '2 guests pending for late checkout approval', time: '09:45' },
    { id: 'h5', type: 'success', message: 'All morning housekeeping inspections passed', time: '09:00' },
  ],
};

const HIGHLIGHT_CONFIG: Record<string, { color: string; bg: string; icon: React.ElementType }> = {
  success: { color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/20', icon: CheckCircle2 },
  warning: { color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/20', icon: AlertTriangle },
  info: { color: 'text-sky-600 dark:text-sky-400', bg: 'bg-sky-50 dark:bg-sky-950/20', icon: TrendingUp },
  alert: { color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-950/20', icon: AlertTriangle },
};

function getShiftName(): string {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 14) return 'Morning Shift';
  if (hour >= 14 && hour < 22) return 'Evening Shift';
  return 'Night Shift';
}

function getShiftTimes(): { start: string; end: string; progressPercent: number } {
  const hour = new Date().getHours();
  const minute = new Date().getMinutes();
  const totalMinutes = hour * 60 + minute;
  
  if (hour >= 6 && hour < 14) {
    const elapsed = totalMinutes - 360; // 6:00
    return { start: '06:00', end: '14:00', progressPercent: Math.round((elapsed / 480) * 100) };
  }
  if (hour >= 14 && hour < 22) {
    const elapsed = totalMinutes - 840; // 14:00
    return { start: '14:00', end: '22:00', progressPercent: Math.round((elapsed / 480) * 100) };
  }
  // Night shift: 22:00 - 06:00
  const elapsed = hour >= 22 ? totalMinutes - 1320 : totalMinutes + 120; // wraps midnight
  return { start: '22:00', end: '06:00', progressPercent: Math.min(100, Math.round((elapsed / 480) * 100)) };
}

export function ShiftSummaryWidget() {
  const [data, setData] = useState<ShiftStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAllHighlights, setShowAllHighlights] = useState(false);

  useEffect(() => {
    // Use mock data enriched with current shift info
    const computeShiftData = () => {
      const { start, end, progressPercent } = getShiftTimes();
      const elapsedMin = progressPercent * 4.8;
      const remainingMin = 480 - elapsedMin;
      const elapsedHours = Math.floor(elapsedMin / 60);
      const elapsedMins = Math.floor(elapsedMin % 60);
      const remainHours = Math.floor(remainingMin / 60);
      const remainMins = Math.floor(remainingMin % 60);

      setData({
        ...MOCK_DATA,
        shiftName: getShiftName(),
        shiftStart: start,
        shiftEnd: end,
        elapsed: `${elapsedHours}h ${elapsedMins}m`,
        remaining: `${remainHours}h ${remainMins}m`,
        progressPercent: Math.min(98, Math.max(5, progressPercent)),
      });
      setIsLoading(false);
    };
    computeShiftData();
    const interval = setInterval(computeShiftData, 60000);
    return () => clearInterval(interval);
  }, []);

  const visibleHighlights = showAllHighlights
    ? (data?.highlights || [])
    : (data?.highlights || []).slice(0, 3);

  if (isLoading || !data) {
    return (
      <Card className="border-0 shadow-sm rounded-2xl">
        <CardContent className="p-5">
          <div className="animate-pulse space-y-3">
            <div className="h-5 w-32 bg-muted rounded" />
            <div className="h-3 w-full bg-muted rounded" />
            <div className="grid grid-cols-4 gap-2">
              {[0,1,2,3].map(i => <div key={i} className="h-14 bg-muted rounded-lg" />)}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 rounded-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Coffee className="h-4 w-4 text-amber-600" />
            {data.shiftName}
          </CardTitle>
          <Badge variant="outline" className="text-xs rounded-full border-primary/20 text-primary bg-primary/5">
            <Clock className="h-3 w-3 mr-1" />
            Live
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Shift Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{data.shiftStart}</span>
            <span className="font-medium text-foreground">{data.elapsed} elapsed</span>
            <span className="text-muted-foreground">{data.shiftEnd}</span>
          </div>
          <div className="relative h-2.5 rounded-full bg-muted overflow-hidden">
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500"
              initial={{ width: 0 }}
              animate={{ width: `${data.progressPercent}%` }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
            />
            {/* Current time marker */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-foreground/50"
              style={{ left: `${data.progressPercent}%` }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground text-center">{data.remaining} remaining</p>
        </div>

        <Separator className="opacity-50" />

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-4 gap-2">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-2.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-100/50 dark:border-emerald-800/30 text-center"
          >
            <LogIn className="h-3.5 w-3.5 text-emerald-600 mx-auto mb-1" />
            <p className="text-lg font-bold text-emerald-600 tabular-nums leading-none">{data.checkIns}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Check-ins</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="p-2.5 rounded-xl bg-orange-50/80 dark:bg-orange-950/20 border border-orange-100/50 dark:border-orange-800/30 text-center"
          >
            <LogOut className="h-3.5 w-3.5 text-orange-600 mx-auto mb-1" />
            <p className="text-lg font-bold text-orange-600 tabular-nums leading-none">{data.checkOuts}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Check-outs</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="p-2.5 rounded-xl bg-sky-50/80 dark:bg-sky-950/20 border border-sky-100/50 dark:border-sky-800/30 text-center"
          >
            <DollarSign className="h-3.5 w-3.5 text-sky-600 mx-auto mb-1" />
            <p className="text-lg font-bold text-sky-600 tabular-nums leading-none">
              {(data.revenue / 1000).toFixed(0)}K
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Revenue</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="p-2.5 rounded-xl bg-violet-50/80 dark:bg-violet-950/20 border border-violet-100/50 dark:border-violet-800/30 text-center"
          >
            <TrendingUp className="h-3.5 w-3.5 text-violet-600 mx-auto mb-1" />
            <p className="text-lg font-bold text-violet-600 tabular-nums leading-none">
              {data.occupancyChange > 0 ? '+' : ''}{data.occupancyChange}%
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Occupancy</p>
          </motion.div>
        </div>

        {/* Shift Highlights */}
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Shift Highlights
          </p>
          <AnimatePresence mode="popLayout">
            {visibleHighlights.map((h, i) => {
              const config = HIGHLIGHT_CONFIG[h.type];
              const Icon = config.icon;
              return (
                <motion.div
                  key={h.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ delay: i * 0.05, duration: 0.2 }}
                  className={cn(
                    'flex items-start gap-2 p-2 rounded-lg border border-transparent transition-colors',
                    'hover:border-border/30 hover:bg-muted/20',
                    config.bg
                  )}
                >
                  <Icon className={cn('h-3.5 w-3.5 flex-shrink-0 mt-0.5', config.color)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground leading-relaxed">{h.message}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground flex-shrink-0 tabular-nums">{h.time}</span>
                </motion.div>
              );
            })}
          </AnimatePresence>
          {data.highlights.length > 3 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs h-7"
              onClick={() => setShowAllHighlights(!showAllHighlights)}
            >
              {showAllHighlights ? 'Show Less' : `+${data.highlights.length - 3} More Highlights`}
              <ArrowRight className={cn('ml-1 h-3 w-3 transition-transform', showAllHighlights && 'rotate-90')} />
            </Button>
          )}
        </div>

        {/* Pending badge */}
        {data.pendingRequests > 0 && (
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/20 border border-amber-100/50 dark:border-amber-800/30">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span className="text-xs font-medium">Pending Requests</span>
            </div>
            <Badge className="bg-amber-500 text-white text-[10px] h-5 px-1.5 border-0">
              {data.pendingRequests}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
