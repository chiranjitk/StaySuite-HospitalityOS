'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Building2, BedDouble } from 'lucide-react';
import { motion } from 'framer-motion';

interface RoomStatusCounts {
  available: number;
  occupied: number;
  maintenance: number;
  dirty: number;
  out_of_order: number;
}

interface PropertyStatusWidgetProps {
  roomStatusCounts: RoomStatusCounts | null;
  totalRooms: number | null;
  isLoading: boolean;
}

interface StatusConfig {
  label: string;
  colorClass: string;
  bgClass: string;
  indicatorClass: string;
  textClass: string;
}

const statusConfig: Record<keyof RoomStatusCounts, StatusConfig> = {
  available: {
    label: 'Available',
    colorClass: 'bg-emerald-500',
    bgClass: 'bg-emerald-500/15',
    indicatorClass: '[&>[data-slot=progress-indicator]]:bg-emerald-500',
    textClass: 'text-emerald-600 dark:text-emerald-400',
  },
  occupied: {
    label: 'Occupied',
    colorClass: 'bg-violet-500',
    bgClass: 'bg-violet-500/15',
    indicatorClass: '[&>[data-slot=progress-indicator]]:bg-violet-500',
    textClass: 'text-violet-600 dark:text-violet-400',
  },
  maintenance: {
    label: 'Maintenance',
    colorClass: 'bg-amber-500',
    bgClass: 'bg-amber-500/15',
    indicatorClass: '[&>[data-slot=progress-indicator]]:bg-amber-500',
    textClass: 'text-amber-600 dark:text-amber-400',
  },
  dirty: {
    label: 'Dirty',
    colorClass: 'bg-red-500',
    bgClass: 'bg-red-500/15',
    indicatorClass: '[&>[data-slot=progress-indicator]]:bg-red-500',
    textClass: 'text-red-600 dark:text-red-400',
  },
  out_of_order: {
    label: 'Out of Order',
    colorClass: 'bg-slate-500',
    bgClass: 'bg-slate-500/15',
    indicatorClass: '[&>[data-slot=progress-indicator]]:bg-slate-500',
    textClass: 'text-slate-600 dark:text-slate-400',
  },
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: 12 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.35, ease: 'easeOut' },
  },
};

function PropertyStatusWidget({
  roomStatusCounts,
  totalRooms,
  isLoading,
}: PropertyStatusWidgetProps) {
  if (isLoading) {
    return (
      <Card className="border border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-3 w-full rounded-full" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!roomStatusCounts || !totalRooms) return null;

  const occupiedPct =
    totalRooms > 0
      ? Math.round((roomStatusCounts.occupied / totalRooms) * 100)
      : 0;

  const statusEntries = Object.entries(statusConfig) as [
    keyof RoomStatusCounts,
    StatusConfig,
  ][];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <Card className="border border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Building2 className="h-4 w-4 text-teal-600 dark:text-teal-400" />
              Property Status
            </CardTitle>
            <Badge
              variant="outline"
              className="text-xs font-normal gap-1"
            >
              <BedDouble className="h-3 w-3" />
              {totalRooms} rooms
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {/* Overall Occupancy Bar */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium text-muted-foreground">
                Occupancy Rate
              </span>
              <span className="text-sm font-bold text-violet-600 dark:text-violet-400">
                {occupiedPct}%
              </span>
            </div>
            <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-500"
                initial={{ width: 0 }}
                animate={{ width: `${occupiedPct}%` }}
                transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' }}
              />
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-muted-foreground">
                {roomStatusCounts.occupied} of {totalRooms} occupied
              </span>
              <span className="text-xs text-muted-foreground">
                {roomStatusCounts.available} available
              </span>
            </div>
          </div>

          {/* Room Status Breakdown */}
          <motion.div
            className="space-y-3.5"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {statusEntries.map(([key, config]) => {
              const count = roomStatusCounts[key];
              const pct = totalRooms > 0 ? Math.round((count / totalRooms) * 100) : 0;

              return (
                <motion.div key={key} variants={itemVariants}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'inline-block h-2.5 w-2.5 rounded-full',
                          config.colorClass
                        )}
                      />
                      <span className="text-sm font-medium">{config.label}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold tabular-nums">
                        {count}
                      </span>
                      <span
                        className={cn('text-xs tabular-nums', config.textClass)}
                      >
                        ({pct}%)
                      </span>
                    </div>
                  </div>
                  <Progress
                    value={pct}
                    className={cn('h-2', config.indicatorClass, config.bgClass)}
                  />
                </motion.div>
              );
            })}
          </motion.div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export { PropertyStatusWidget };
export type { PropertyStatusWidgetProps, RoomStatusCounts };
