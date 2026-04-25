'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  Briefcase,
  TreePalm,
  Users,
  Crown,
  CalendarDays,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface GuestSegment {
  id: string;
  name: string;
  count: number;
  percentage: number;
  color: string;
  icon: string;
}

interface GuestSegmentsData {
  totalGuests: number;
  lastUpdated: string;
  segments: GuestSegment[];
}

const MOCK_DATA: GuestSegmentsData = {
  totalGuests: 156,
  lastUpdated: new Date().toISOString(),
  segments: [
    { id: 'business', name: 'Business', count: 55, percentage: 35, color: '#3b82f6', icon: 'Briefcase' },
    { id: 'leisure', name: 'Leisure', count: 39, percentage: 25, color: '#10b981', icon: 'TreePalm' },
    { id: 'group', name: 'Group', count: 31, percentage: 20, color: '#f59e0b', icon: 'Users' },
    { id: 'vip', name: 'VIP', count: 19, percentage: 12, color: '#8b5cf6', icon: 'Crown' },
    { id: 'extended', name: 'Extended Stay', count: 12, percentage: 8, color: '#14b8a6', icon: 'CalendarDays' },
  ],
};

const ICON_MAP: Record<string, React.ElementType> = {
  Briefcase,
  TreePalm,
  Users,
  Crown,
  CalendarDays,
};

// SVG Donut Chart
function DonutChart({ segments }: { segments: GuestSegment[] }) {
  const total = segments.reduce((sum, s) => sum + s.percentage, 0);
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const gap = 2;

  const segmentArcs = segments.reduce<Array<{ segment: GuestSegment; segmentLength: number; offset: number }>>(
    (acc, segment) => {
      const segmentLength = (segment.percentage / total) * circumference;
      const offset = acc.length > 0 ? acc[acc.length - 1].offset + acc[acc.length - 1].segmentLength : 0;
      return [...acc, { segment, segmentLength, offset }];
    },
    []
  );

  return (
    <div className="relative flex items-center justify-center">
      <svg width="128" height="128" viewBox="0 0 128 128" className="transform -rotate-90">
        {segmentArcs.map(({ segment, segmentLength, offset }) => (
          <circle
            key={segment.id}
            cx="64"
            cy="64"
            r={radius}
            fill="none"
            stroke={segment.color}
            strokeWidth="16"
            strokeDasharray={`${Math.max(0, segmentLength - gap)} ${circumference - segmentLength + gap}`}
            strokeDashoffset={-offset}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold tabular-nums">156</span>
        <span className="text-[10px] text-muted-foreground leading-none">Total</span>
      </div>
    </div>
  );
}

function SegmentCard({ segment, index }: { segment: GuestSegment; index: number }) {
  const Icon = ICON_MAP[segment.icon] || Users;

  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.07, duration: 0.3 }}
      className={cn(
        'flex items-center gap-3 p-2.5 rounded-xl transition-all duration-200',
        'hover:bg-muted/50 cursor-default'
      )}
    >
      <div
        className="flex-shrink-0 h-8 w-8 rounded-lg flex items-center justify-center"
        style={{ backgroundColor: `${segment.color}15`, color: segment.color }}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium truncate">{segment.name}</span>
          <span className="text-xs font-semibold tabular-nums" style={{ color: segment.color }}>
            {segment.percentage}%
          </span>
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <span className="text-xs text-muted-foreground">{segment.count} guests</span>
          <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: segment.color }}
              initial={{ width: 0 }}
              animate={{ width: `${segment.percentage}%` }}
              transition={{ delay: index * 0.1 + 0.3, duration: 0.6, ease: 'easeOut' }}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function GuestSegmentsWidget() {
  const [data, setData] = useState<GuestSegmentsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchData = useCallback(async (isInitial = false) => {
    if (isInitial) setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/dashboard/guest-segments');
      const result = await response.json();

      if (result.success && result.data) {
        setData(result.data);
        setLastRefresh(new Date());
      } else {
        throw new Error(result.error?.message || 'Failed to fetch data');
      }
    } catch (err) {
      console.error('Guest segments fetch failed:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      // Fallback to mock data
      setData(MOCK_DATA);
      setLastRefresh(new Date());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(true);

    // Auto-refresh every 5 minutes
    const interval = setInterval(() => {
      fetchData(false);
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <Card className="border border-border/50 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 rounded-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            Guest Segments
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
          <div className="space-y-3">
            <div className="flex justify-center py-4">
              <Skeleton className="h-32 w-32 rounded-full" />
            </div>
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : error && !data ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="h-8 w-8 text-red-400 dark:text-red-300 mb-2" />
            <p className="text-sm text-muted-foreground">Failed to load segments</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => fetchData(true)}>
              Retry
            </Button>
          </div>
        ) : data ? (
          <div className="space-y-4">
            {/* Donut Chart */}
            <div className="flex justify-center">
              <DonutChart segments={data.segments} />
            </div>

            {/* Segment Cards */}
            <div className="space-y-1">
              <AnimatePresence>
                {data.segments.map((segment, index) => (
                  <SegmentCard key={segment.id} segment={segment} index={index} />
                ))}
              </AnimatePresence>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
