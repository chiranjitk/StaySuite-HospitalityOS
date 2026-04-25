'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  Wrench,
  RefreshCw,
  AlertCircle,
  Clock,
  CheckCircle2,
  CircleDot,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type TaskStatus = 'pending' | 'inProgress' | 'completed' | 'overdue';
type TaskPriority = 'high' | 'medium' | 'low';

interface MaintenanceTask {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignedTo: { initials: string; name: string };
  progress: number;
  dueDate: string;
  location: string;
}

interface MaintenanceData {
  totalTasks: number;
  lastUpdated: string;
  summary: {
    pending: number;
    inProgress: number;
    completed: number;
    overdue: number;
  };
  tasks: MaintenanceTask[];
}

const EMPTY_DATA: MaintenanceData = {
  totalTasks: 0,
  lastUpdated: new Date().toISOString(),
  summary: { pending: 0, inProgress: 0, completed: 0, overdue: 0 },
  tasks: [],
};

const STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; bg: string; border: string; icon: React.ElementType }> = {
  pending: { label: 'Pending', color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/40', border: 'border-amber-200 dark:border-amber-800', icon: Clock },
  inProgress: { label: 'In Progress', color: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/40', border: 'border-blue-200 dark:border-blue-800', icon: CircleDot },
  completed: { label: 'Completed', color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/40', border: 'border-emerald-200 dark:border-emerald-800', icon: CheckCircle2 },
  overdue: { label: 'Overdue', color: 'text-red-700 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/40', border: 'border-red-200 dark:border-red-800', icon: AlertTriangle },
};

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  high: 'bg-red-500',
  medium: 'bg-amber-500',
  low: 'bg-emerald-500',
};

const AVATAR_COLORS = [
  'bg-violet-500',
  'bg-sky-500',
  'bg-teal-500',
  'bg-orange-500',
  'bg-rose-500',
];

function getAvatarColor(initials: string): string {
  const idx = initials.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

function SummaryBadge({ count, label, variant }: { count: number; label: string; variant: TaskStatus }) {
  const config = STATUS_CONFIG[variant];
  return (
    <div className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg', config.bg, config.border, 'border')}>
      <config.icon className={cn('h-3.5 w-3.5', config.color)} />
      <div className="flex flex-col leading-none">
        <span className={cn('text-sm font-bold', config.color)}>{count}</span>
        <span className="text-[10px] text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}

function TaskRow({ task, index }: { task: MaintenanceTask; index: number }) {
  const config = STATUS_CONFIG[task.status];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.3 }}
      className={cn(
        'flex items-start gap-3 p-3 rounded-xl border transition-all duration-200',
        'hover:shadow-sm hover:-translate-y-0.5',
        config.bg,
        config.border
      )}
    >
      {/* Priority Dot */}
      <div className="flex-shrink-0 pt-1.5">
        <span className={cn('block h-2.5 w-2.5 rounded-full', PRIORITY_COLORS[task.priority])} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium truncate">{task.title}</span>
          <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 h-5 flex-shrink-0', config.color, config.border)}>
            {config.label}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground truncate">{task.location}</p>

        {/* Progress bar for in-progress */}
        {(task.status === 'inProgress' || task.status === 'overdue') && task.progress > 0 && (
          <div className="flex items-center gap-2">
            <Progress value={task.progress} className="h-1.5" />
            <span className="text-[10px] text-muted-foreground tabular-nums flex-shrink-0">{task.progress}%</span>
          </div>
        )}
      </div>

      {/* Avatar */}
      <div className="flex-shrink-0">
        <div
          className={cn(
            'h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-semibold text-white',
            getAvatarColor(task.assignedTo.initials)
          )}
          title={task.assignedTo.name}
        >
          {task.assignedTo.initials}
        </div>
      </div>
    </motion.div>
  );
}

export function MaintenanceTrackerWidget() {
  const [data, setData] = useState<MaintenanceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [filter, setFilter] = useState<TaskStatus | 'all'>('all');

  const fetchData = useCallback(async (isInitial = false) => {
    if (isInitial) setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/dashboard/maintenance');
      const result = await response.json();

      if (result.success && result.data) {
        setData(result.data);
        setLastRefresh(new Date());
      } else {
        throw new Error(result.error?.message || 'Failed to fetch data');
      }
    } catch (err) {
      // Auth errors are expected during initial load or session refresh
      if (err instanceof Error && err.message !== 'Authentication required') {
        console.error('[Maintenance] Fetch failed:', err.message);
      }
      setError(null); // Don't show error for auth issues
      setData(EMPTY_DATA);
      setLastRefresh(new Date());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(true);

    // Auto-refresh every 3 minutes
    const interval = setInterval(() => {
      fetchData(false);
    }, 3 * 60 * 1000);

    return () => clearInterval(interval);
  }, [fetchData]);

  const filteredTasks = data?.tasks.filter(
    (task) => filter === 'all' || task.status === filter
  ) ?? [];

  const filterOptions: { value: TaskStatus | 'all'; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'overdue', label: 'Overdue' },
    { value: 'inProgress', label: 'In Progress' },
    { value: 'pending', label: 'Pending' },
    { value: 'completed', label: 'Completed' },
  ];

  return (
    <Card className="border border-border/50 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 rounded-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Wrench className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            Maintenance Tracker
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
            {/* Summary skeleton */}
            <div className="grid grid-cols-4 gap-2">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : error && !data ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="h-8 w-8 text-red-400 dark:text-red-300 mb-2" />
            <p className="text-sm text-muted-foreground">Failed to load maintenance tasks</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => fetchData(true)}>
              Retry
            </Button>
          </div>
        ) : data ? (
          <div className="space-y-3">
            {/* Summary Badges */}
            <div className="grid grid-cols-4 gap-2">
              <SummaryBadge count={data.summary.overdue} label="Overdue" variant="overdue" />
              <SummaryBadge count={data.summary.inProgress} label="Active" variant="inProgress" />
              <SummaryBadge count={data.summary.pending} label="Pending" variant="pending" />
              <SummaryBadge count={data.summary.completed} label="Done" variant="completed" />
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1">
              {filterOptions.map((opt) => (
                <Button
                  key={opt.value}
                  variant={filter === opt.value ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs px-2.5 flex-shrink-0"
                  onClick={() => setFilter(opt.value)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>

            {/* Task List */}
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1 custom-scrollbar">
              <AnimatePresence mode="popLayout">
                {filteredTasks.length > 0 ? (
                  filteredTasks.map((task, index) => (
                    <TaskRow key={task.id} task={task} index={index} />
                  ))
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center py-8 text-center"
                  >
                    <CheckCircle2 className="h-8 w-8 text-muted-foreground/40 mb-2" />
                    <p className="text-sm text-muted-foreground">No tasks in this category</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
