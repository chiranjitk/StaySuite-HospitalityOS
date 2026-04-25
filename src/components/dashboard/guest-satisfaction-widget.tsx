'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/store';
import {
  Star,
  TrendingUp,
  TrendingDown,
  MessageSquare,
  Quote,
  ArrowRight,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import { motion } from 'framer-motion';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface CategoryScore {
  score: number | null;
  trend: string | null;
}

interface CategoryData {
  [key: string]: CategoryScore;
}

interface Review {
  guest: string;
  rating: number;
  date: string;
  excerpt: string;
}

interface GuestSatisfactionData {
  overallScore: number | null;
  totalReviews: number;
  trend: string | null;
  categories: CategoryData;
  recentReviews: Review[];
}

/* ------------------------------------------------------------------ */
/*  Category display config                                             */
/* ------------------------------------------------------------------ */

interface CategoryConfig {
  key: string;
  label: string;
  barColor: string;
  bgLight: string;
  bgDark: string;
}

const categoryConfigs: CategoryConfig[] = [
  {
    key: 'cleanliness',
    label: 'Cleanliness',
    barColor: 'bg-emerald-500',
    bgLight: 'bg-emerald-50',
    bgDark: 'dark:bg-emerald-900/40',
  },
  {
    key: 'service',
    label: 'Service',
    barColor: 'bg-teal-500',
    bgLight: 'bg-teal-50',
    bgDark: 'dark:bg-teal-900/40',
  },
  {
    key: 'food',
    label: 'Food',
    barColor: 'bg-amber-500',
    bgLight: 'bg-amber-50',
    bgDark: 'dark:bg-amber-900/40',
  },
  {
    key: 'amenities',
    label: 'Amenities',
    barColor: 'bg-violet-500',
    bgLight: 'bg-violet-50',
    bgDark: 'dark:bg-violet-900/40',
  },
  {
    key: 'value',
    label: 'Value',
    barColor: 'bg-cyan-500',
    bgLight: 'bg-cyan-50',
    bgDark: 'dark:bg-cyan-900/40',
  },
];

/* ------------------------------------------------------------------ */
/*  Helper: Rating color based on score                                 */
/* ------------------------------------------------------------------ */

function ratingColorClass(score: number | null) {
  const s = score ?? 0;
  if (s >= 4) return 'text-emerald-600 dark:text-emerald-400';
  if (s >= 3) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function ratingBgClass(score: number | null) {
  const s = score ?? 0;
  if (s >= 4) return 'bg-emerald-50 dark:bg-emerald-900/40';
  if (s >= 3) return 'bg-amber-50 dark:bg-amber-900/40';
  return 'bg-red-50 dark:bg-red-900/40';
}

/* ------------------------------------------------------------------ */
/*  Animated circular score ring                                        */
/* ------------------------------------------------------------------ */

function ScoreRing({
  score,
  size = 96,
}: {
  score: number | null;
  size?: number;
}) {
  const safeScore = score ?? 0;
  const maxScore = 5;
  const percentage = (safeScore / maxScore) * 100;
  const strokeWidth = 6;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  const center = size / 2;

  // Color based on score
  const gradientId = 'satisfactionGrad';
  let stopColor1 = '#10b981';
  let stopColor2 = '#059669';
  let textColor = 'text-emerald-600 dark:text-emerald-400';

  if (safeScore >= 4) {
    stopColor1 = '#10b981';
    stopColor2 = '#059669';
    textColor = 'text-emerald-600 dark:text-emerald-400';
  } else if (safeScore >= 3) {
    stopColor1 = '#f59e0b';
    stopColor2 = '#d97706';
    textColor = 'text-amber-600 dark:text-amber-400';
  } else {
    stopColor1 = '#ef4444';
    stopColor2 = '#dc2626';
    textColor = 'text-red-600 dark:text-red-400';
  }

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient
            id={gradientId}
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
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
          strokeWidth={strokeWidth}
          className="text-muted/40"
        />
        {/* Progress ring */}
        <motion.circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.2, ease: 'easeOut', delay: 0.2 }}
        />
      </svg>
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className={cn('text-2xl font-bold tabular-nums leading-none', textColor)}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          {safeScore.toFixed(1)}
        </motion.span>
        <span className="text-[9px] text-muted-foreground leading-none mt-0.5">
          / {maxScore}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Star rating display                                                 */
/* ------------------------------------------------------------------ */

function StarRating({ rating, size = 'sm' }: { rating: number | null; size?: 'sm' | 'xs' }) {
  const safeRating = rating ?? 0;
  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-3 w-3';

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            iconSize,
            star <= Math.floor(safeRating)
              ? 'fill-amber-400 text-amber-400 dark:text-amber-300'
              : star <= safeRating
                ? 'fill-amber-400/50 text-amber-400 dark:text-amber-300'
                : 'fill-muted text-muted'
          )}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Category progress row                                               */
/* ------------------------------------------------------------------ */

function CategoryRow({
  label,
  score,
  trend,
  barColor,
  bgLight,
  bgDark,
}: CategoryConfig & CategoryScore) {
  const safeScore = score ?? 0;
  const percentage = (safeScore / 5) * 100;
  const trendNum = parseFloat(trend) || 0;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <div className="flex items-center gap-1.5">
          <span className={cn('text-xs font-semibold tabular-nums', ratingColorClass(safeScore))}>
            {safeScore.toFixed(1)}
          </span>
          <div
            className={cn(
              'flex items-center gap-0.5 text-[10px] font-medium',
              trendNum > 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : trendNum < 0
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-muted-foreground'
            )}
          >
            {trendNum > 0 ? (
              <TrendingUp className="h-2.5 w-2.5" />
            ) : trendNum < 0 ? (
              <TrendingDown className="h-2.5 w-2.5" />
            ) : null}
            <span>{trend}</span>
          </div>
        </div>
      </div>
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <motion.div
          className={cn('h-full rounded-full', barColor)}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Review snippet card                                                 */
/* ------------------------------------------------------------------ */

function ReviewSnippet({ review }: { review: Review }) {
  const formattedDate = new Date(review.date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="group p-2.5 rounded-lg bg-muted/50 hover:bg-muted/50 transition-colors"
    >
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'flex items-center justify-center h-6 w-6 rounded-full text-[10px] font-semibold',
              ratingColorClass(review.rating),
              ratingBgClass(review.rating)
            )}
          >
            {review.guest
              .split(' ')
              .map((n) => n[0])
              .join('')}
          </div>
          <div>
            <p className="text-xs font-medium leading-none">{review.guest}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {formattedDate}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <span
            className={cn(
              'text-xs font-bold tabular-nums',
              ratingColorClass(review.rating)
            )}
          >
            {review.rating}
          </span>
          <StarRating rating={review.rating} size="xs" />
        </div>
      </div>
      <div className="flex gap-1.5 mt-1.5">
        <Quote className="h-3 w-3 text-muted-foreground/40 flex-shrink-0 mt-0.5" />
        <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
          {review.excerpt}
        </p>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Skeleton                                                           */
/* ------------------------------------------------------------------ */

function GuestSatisfactionSkeleton() {
  return (
    <Card className="border border-border/50 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-5 w-16" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Score ring + stars skeleton */}
        <div className="flex items-center gap-4">
          <Skeleton className="h-[96px] w-[96px] rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>

        <div className="h-px bg-border" />

        {/* Category bars skeleton */}
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="space-y-1">
              <div className="flex justify-between">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-8" />
              </div>
              <Skeleton className="h-1.5 w-full rounded-full" />
            </div>
          ))}
        </div>

        <div className="h-px bg-border" />

        {/* Review skeletons */}
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>

        <Skeleton className="h-8 w-full rounded-lg" />
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Main widget                                                        */
/* ------------------------------------------------------------------ */

export function GuestSatisfactionWidget() {
  const { setActiveSection } = useUIStore();
  const [data, setData] = useState<GuestSatisfactionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/guest-satisfaction');
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        setError(null);
      } else {
        setError(
          json.error?.message || 'Failed to load guest satisfaction data'
        );
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

  if (isLoading) return <GuestSatisfactionSkeleton />;

  if (error || !data) {
    return (
      <Card className="border border-border/50 shadow-sm">
        <CardContent className="p-6 flex flex-col items-center justify-center gap-2 text-center">
          <ShieldAlert className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {error || 'Unable to load satisfaction data'}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            className="mt-1"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const trendNum = parseFloat(data.trend ?? '') || 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <Card className="border border-border/50 shadow-sm hover:shadow-md transition-shadow duration-300">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-teal-600 dark:text-teal-400" />
              Guest Satisfaction
            </CardTitle>
            <Badge variant="outline" className="text-xs font-normal gap-1">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400 dark:text-amber-300" />
              {data.totalReviews} reviews
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Score ring + stars + trend */}
          <div className="flex items-center gap-4">
            <ScoreRing score={data.overallScore} size={96} />
            <div className="flex-1 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Overall</span>
                <div
                  className={cn(
                    'flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full',
                    trendNum > 0
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
                      : trendNum < 0
                        ? 'bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                        : 'bg-muted text-muted-foreground'
                  )}
                >
                  {trendNum > 0 ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : trendNum < 0 ? (
                    <TrendingDown className="h-3 w-3" />
                  ) : null}
                  {data.trend}
                </div>
              </div>
              <StarRating rating={data.overallScore} />
              <p className="text-[11px] text-muted-foreground">
                Based on {data.totalReviews} guest reviews
              </p>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-border" />

          {/* Category breakdown */}
          <div className="space-y-2.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Category Scores
            </p>
            {categoryConfigs.map((config) => {
              const catData = data.categories[config.key];
              if (!catData) return null;
              return (
                <CategoryRow
                  key={config.key}
                  label={config.label}
                  score={catData.score}
                  trend={catData.trend}
                  barColor={config.barColor}
                  bgLight={config.bgLight}
                  bgDark={config.bgDark}
                />
              );
            })}
          </div>

          {/* Divider */}
          <div className="h-px bg-border" />

          {/* Recent review snippets */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Recent Reviews
            </p>
            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
              {data.recentReviews.map((review, idx) => (
                <ReviewSnippet key={idx} review={review} />
              ))}
            </div>
          </div>

          {/* View All Reviews button */}
          <Button
            variant="outline"
            className="w-full h-8 text-xs gap-1.5 hover:bg-muted/60 transition-colors"
            onClick={() => setActiveSection('crm-feedback')}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            View All Reviews
            <ArrowRight className="h-3 w-3 ml-auto" />
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}
