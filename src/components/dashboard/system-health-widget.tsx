'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  Wifi,
  Wrench,
  Users,
  Clock,
  Shield,
  Package,
  Activity,
} from 'lucide-react';
import { motion } from 'framer-motion';

interface SystemHealthWidgetProps {
  stats: {
    activeWifiSessions: number;
    pendingServiceRequests: number;
    lowStockItems: number;
    staffOnDuty: number;
    upcomingCheckIns: number;
  };
  roomStatus: {
    available: number;
    occupied: number;
    maintenance: number;
    dirty: number;
    out_of_order: number;
  };
  isLoading?: boolean;
}

type StatusLevel = 'healthy' | 'warning' | 'critical';

const statusDotColors: Record<StatusLevel, string> = {
  healthy: 'bg-emerald-500',
  warning: 'bg-amber-500',
  critical: 'bg-red-500',
};

const statusIconColors: Record<StatusLevel, string> = {
  healthy: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  critical: 'text-red-600 dark:text-red-400',
};

const statusBgColors: Record<StatusLevel, string> = {
  healthy: 'bg-emerald-50 dark:bg-emerald-900/20',
  warning: 'bg-amber-50 dark:bg-amber-900/20',
  critical: 'bg-red-50 dark:bg-red-900/20',
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring' as const,
      stiffness: 300,
      damping: 24,
    },
  },
};

function StatusDot({ status }: { status: StatusLevel }) {
  return (
    <span
      className={cn(
        'relative flex h-2.5 w-2.5',
      )}
    >
      <span
        className={cn(
          'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
          statusDotColors[status],
        )}
      />
      <span
        className={cn(
          'relative inline-flex h-2.5 w-2.5 rounded-full',
          statusDotColors[status],
        )}
      />
    </span>
  );
}

interface IndicatorCellProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  status: StatusLevel;
  index: number;
}

function IndicatorCell({ icon: Icon, label, value, status, index }: IndicatorCellProps) {
  return (
    <motion.div
      variants={itemVariants}
      className={cn(
        'group flex items-center gap-3 p-3 rounded-xl border transition-all duration-200',
        'hover:shadow-md hover:scale-[1.02] cursor-default',
        'bg-card border-border/60',
      )}
    >
      <div className={cn('flex items-center justify-center w-9 h-9 rounded-lg', statusBgColors[status])}>
        <Icon className={cn('h-4 w-4', statusIconColors[status])} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground font-medium truncate">{label}</p>
        <p className={cn('text-sm font-bold leading-tight', statusIconColors[status])}>
          {value}
        </p>
      </div>
      <StatusDot status={status} />
    </motion.div>
  );
}

function SystemHealthLoadingSkeleton() {
  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <Skeleton className="h-5 w-36" />
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function SystemHealthWidget({ stats, roomStatus, isLoading }: SystemHealthWidgetProps) {
  if (isLoading) {
    return <SystemHealthLoadingSkeleton />;
  }

  const housekeepingCount = roomStatus.dirty + roomStatus.maintenance;

  const indicators: IndicatorCellProps[] = [
    {
      icon: Wifi,
      label: 'WiFi Gateway',
      value: stats.activeWifiSessions >= 0 ? 'Connected' : 'Offline',
      status: stats.activeWifiSessions >= 0 ? 'healthy' : 'critical',
      index: 0,
    },
    {
      icon: Shield,
      label: 'Service Queue',
      value: stats.pendingServiceRequests,
      status:
        stats.pendingServiceRequests === 0
          ? 'healthy'
          : stats.pendingServiceRequests <= 3
            ? 'warning'
            : 'critical',
      index: 1,
    },
    {
      icon: Users,
      label: 'Staff On Duty',
      value: stats.staffOnDuty,
      status: stats.staffOnDuty > 0 ? 'healthy' : 'critical',
      index: 2,
    },
    {
      icon: Wrench,
      label: 'Housekeeping',
      value: housekeepingCount,
      status:
        housekeepingCount === 0
          ? 'healthy'
          : housekeepingCount <= 5
            ? 'warning'
            : 'critical',
      index: 3,
    },
    {
      icon: Clock,
      label: 'Upcoming Arrivals',
      value: stats.upcomingCheckIns,
      status:
        stats.upcomingCheckIns === 0
          ? 'healthy'
          : stats.upcomingCheckIns <= 5
            ? 'warning'
            : 'critical',
      index: 4,
    },
    {
      icon: Package,
      label: 'Low Stock',
      value: stats.lowStockItems,
      status: stats.lowStockItems > 0 ? 'critical' : 'healthy',
      index: 5,
    },
  ];

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Activity className="h-4 w-4 text-emerald-600" />
          System Health
        </CardTitle>
      </CardHeader>
      <CardContent>
        <motion.div
          className="grid grid-cols-2 sm:grid-cols-3 gap-2"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {indicators.map((indicator) => (
            <IndicatorCell key={indicator.label} {...indicator} />
          ))}
        </motion.div>
      </CardContent>
    </Card>
  );
}
