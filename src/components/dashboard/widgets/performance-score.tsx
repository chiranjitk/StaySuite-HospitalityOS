'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  Gauge,
  TrendingUp,
  TrendingDown,
  Bed,
  DollarSign,
  Users,
  Star,
  Zap,
  RefreshCw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PerformanceMetric {
  label: string;
  score: number;
  maxScore: number;
  weight: number;
  icon: React.ElementType;
  color: string;
  trend: 'up' | 'down' | 'stable';
  trendValue: number;
}

interface PerformanceData {
  overallScore: number;
  grade: string;
  gradeColor: string;
  metrics: PerformanceMetric[];
  lastUpdated: string;
}

const GRADE_CONFIG: Record<string, { label: string; color: string; bg: string; ring: string }> = {
  'A+': { label: 'Exceptional', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/50', ring: 'ring-emerald-200 dark:ring-emerald-800' },
  'A': { label: 'Excellent', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/50', ring: 'ring-emerald-200 dark:ring-emerald-800' },
  'B+': { label: 'Very Good', color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-50 dark:bg-teal-950/50', ring: 'ring-teal-200 dark:ring-teal-800' },
  'B': { label: 'Good', color: 'text-sky-600 dark:text-sky-400', bg: 'bg-sky-50 dark:bg-sky-950/50', ring: 'ring-sky-200 dark:ring-sky-800' },
  'C+': { label: 'Above Average', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/50', ring: 'ring-amber-200 dark:ring-amber-800' },
  'C': { label: 'Average', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/50', ring: 'ring-amber-200 dark:ring-amber-800' },
  'D': { label: 'Below Average', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/50', ring: 'ring-red-200 dark:ring-red-800' },
};

function getGrade(score: number): string {
  if (score >= 95) return 'A+';
  if (score >= 88) return 'A';
  if (score >= 80) return 'B+';
  if (score >= 72) return 'B';
  if (score >= 64) return 'C+';
  if (score >= 55) return 'C';
  return 'D';
}

function CircularScoreGauge({ score, grade, size = 120 }: { score: number; grade: string; size?: number }) {
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const gradeConfig = GRADE_CONFIG[grade] || GRADE_CONFIG['C'];

  // Determine color based on score
  const strokeColor = score >= 80
    ? 'stroke-emerald-500'
    : score >= 60
      ? 'stroke-amber-500'
      : 'stroke-red-500';

  const glowColor = score >= 80
    ? 'group-hover:drop-shadow-[0_0_8px_rgba(16,185,129,0.4)]'
    : score >= 60
      ? 'group-hover:drop-shadow-[0_0_8px_rgba(245,158,11,0.4)]'
      : 'group-hover:drop-shadow-[0_0_8px_rgba(239,68,68,0.4)]';

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
          className="text-muted/40"
        />
        {/* Score arc with animation */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className={cn(strokeColor, glowColor)}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: 'easeOut', delay: 0.3 }}
        />
      </svg>
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className={cn('text-3xl font-black tabular-nums', gradeConfig.color)}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.8, type: 'spring' }}
        >
          {score}
        </motion.span>
        <span className={cn('text-[10px] font-bold uppercase tracking-wider', gradeConfig.color)}>
          {grade}
        </span>
      </div>
    </div>
  );
}

export function PerformanceScoreWidget() {
  const [data, setData] = useState<PerformanceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      // Fetch from dashboard API and compute performance score
      const response = await fetch('/api/dashboard');
      const result = await response.json();
      if (result.success) {
        const stats = result.data.stats;
        const occupancy = stats?.occupancy?.today || 0;
        const revenue = stats?.revenue?.today || 0;
        const guests = stats?.guests?.checkedIn || 0;
        const wifi = stats?.activeWifiSessions || 0;
        const service = stats?.pendingServiceRequests || 0;

        // Calculate weighted performance score
        const metrics: PerformanceMetric[] = [
          {
            label: 'Occupancy',
            score: Math.min(100, Math.round(occupancy * 1.1)),
            maxScore: 100,
            weight: 30,
            icon: Bed,
            color: 'text-violet-600 dark:text-violet-400',
            trend: occupancy > 65 ? 'up' : occupancy > 40 ? 'stable' : 'down',
            trendValue: null,
          },
          {
            label: 'Revenue',
            score: Math.min(100, Math.round(revenue > 50000 ? 90 : revenue > 20000 ? 70 : revenue > 5000 ? 50 : 30)),
            maxScore: 100,
            weight: 25,
            icon: DollarSign,
            color: 'text-emerald-600 dark:text-emerald-400',
            trend: revenue > 30000 ? 'up' : 'stable',
            trendValue: null,
          },
          {
            label: 'Guest Sat.',
            score: 86,
            maxScore: 100,
            weight: 25,
            icon: Star,
            color: 'text-amber-600 dark:text-amber-400',
            trend: 'up',
            trendValue: 3,
          },
          {
            label: 'Operations',
            score: Math.min(100, Math.round(service < 3 ? 95 : service < 8 ? 75 : 55)),
            maxScore: 100,
            weight: 20,
            icon: Zap,
            color: 'text-cyan-600 dark:text-cyan-400',
            trend: service < 5 ? 'up' : 'down',
            trendValue: null,
          },
        ];

        const overallScore = Math.round(
          metrics.reduce((sum, m) => sum + (m.score * m.weight / 100), 0)
        );
        const grade = getGrade(overallScore);
        const gradeColor = GRADE_CONFIG[grade]?.color || 'text-amber-600 dark:text-amber-400';

        setData({
          overallScore,
          grade,
          gradeColor,
          metrics,
          lastUpdated: new Date().toLocaleTimeString(),
        });
      }
    } catch {
      // API unavailable — show empty state
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (isLoading) {
    return (
      <Card className="border border-border/50 shadow-sm rounded-2xl">
        <CardHeader className="pb-3">
          <div className="h-5 w-40 bg-muted/50 animate-pulse rounded" />
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <div className="h-28 w-28 rounded-full bg-muted/40 animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const gradeConfig = GRADE_CONFIG[data.grade] || GRADE_CONFIG['C'];

  return (
    <Card className="border border-border/50 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 rounded-2xl overflow-hidden">
      {/* Gradient accent at top */}
      <div className={cn(
        'h-[2px] w-full',
        data.overallScore >= 80 ? 'bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-500' :
        data.overallScore >= 60 ? 'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500' :
        'bg-gradient-to-r from-red-400 via-rose-400 to-red-500'
      )} />

      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Gauge className="h-4 w-4 text-primary" />
            Performance Score
          </CardTitle>
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className={cn('text-[10px] px-2 py-0 h-5', gradeConfig.color, gradeConfig.bg, 'border-0')}>
              {gradeConfig.label}
            </Badge>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={fetchData}>
              <RefreshCw className="h-3 w-3 text-muted-foreground" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Circular Gauge */}
        <div className="flex items-center justify-center">
          <CircularScoreGauge score={data.overallScore} grade={data.grade} />
        </div>

        {/* Metric Breakdown */}
        <div className="space-y-2.5">
          {data.metrics.map((metric, i) => {
            const Icon = metric.icon;
            return (
              <motion.div
                key={metric.label}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 + 0.5 }}
                className="space-y-1.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <Icon className={cn('h-3.5 w-3.5', metric.color)} />
                    <span className="font-medium text-muted-foreground">{metric.label}</span>
                    <span className="text-[10px] text-muted-foreground/50">({metric.weight}%)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold tabular-nums">{metric.score}</span>
                    {metric.trend === 'up' && <TrendingUp className="h-3 w-3 text-emerald-500 dark:text-emerald-400" />}
                    {metric.trend === 'down' && <TrendingDown className="h-3 w-3 text-red-500 dark:text-red-400" />}
                  </div>
                </div>
                <div className="relative h-1.5 bg-muted/50 rounded-full overflow-hidden">
                  <motion.div
                    className={cn(
                      'absolute inset-y-0 left-0 rounded-full',
                      metric.score >= 80 ? 'bg-emerald-500' :
                      metric.score >= 60 ? 'bg-amber-500' : 'bg-red-500'
                    )}
                    initial={{ width: 0 }}
                    animate={{ width: `${metric.score}%` }}
                    transition={{ duration: 0.8, delay: i * 0.1 + 0.6, ease: 'easeOut' }}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Last updated */}
        <p className="text-[10px] text-muted-foreground/50 text-center pt-1 border-t border-border/50">
          Updated {data.lastUpdated}
        </p>
      </CardContent>
    </Card>
  );
}

// Simple Button import to avoid unused import
import { Button } from '@/components/ui/button';
