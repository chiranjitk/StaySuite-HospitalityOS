'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/store';
import {
  CalendarDays,
  LogIn,
  CreditCard,
  ArrowRight,
  AlertTriangle,
  ChevronDown,
  Filter,
  Clock,
  UserPlus,
  Settings,
  RefreshCw,
  Activity,
  ClipboardCheck,
  Ban,
  Banknote,
  TrendingUp,
  Loader2,
  Inbox,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Info,
} from 'lucide-react';
import { formatDistanceToNow, isToday, isYesterday, subDays, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';

// ============================================
// Types
// ============================================

type ActivityCategory = 'booking' | 'payment' | 'housekeeping' | 'guest' | 'system';

interface ActivityItem {
  id: string;
  category: ActivityCategory;
  type: string;
  title: string;
  description: string;
  guest?: { name: string; initials: string };
  room?: string;
  timestamp: string;
  status?: string;
  amount?: number;
  user?: { name: string; initials: string };
  metadata?: Record<string, unknown>;
}

interface GroupedActivities {
  label: string;
  key: string;
  activities: ActivityItem[];
}

// ============================================
// Configurations
// ============================================

const categoryConfig: Record<ActivityCategory, {
  icon: React.ComponentType<{ className?: string }>;
  dotColor: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
}> = {
  booking: {
    icon: CalendarDays,
    dotColor: 'bg-emerald-500',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/40',
    textColor: 'text-emerald-700 dark:text-emerald-400',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
  },
  payment: {
    icon: CreditCard,
    dotColor: 'bg-violet-500',
    bgColor: 'bg-violet-50 dark:bg-violet-950/40',
    textColor: 'text-violet-700 dark:text-violet-400',
    borderColor: 'border-violet-200 dark:border-violet-800',
  },
  housekeeping: {
    icon: ClipboardCheck,
    dotColor: 'bg-amber-500',
    bgColor: 'bg-amber-50 dark:bg-amber-950/40',
    textColor: 'text-amber-700 dark:text-amber-400',
    borderColor: 'border-amber-200 dark:border-amber-800',
  },
  guest: {
    icon: UserPlus,
    dotColor: 'bg-cyan-500',
    bgColor: 'bg-cyan-50 dark:bg-cyan-950/40',
    textColor: 'text-cyan-700 dark:text-cyan-400',
    borderColor: 'border-cyan-200 dark:border-cyan-800',
  },
  system: {
    icon: Settings,
    dotColor: 'bg-slate-500',
    bgColor: 'bg-slate-50 dark:bg-slate-950/40',
    textColor: 'text-slate-700 dark:text-slate-400',
    borderColor: 'border-slate-200 dark:border-slate-800',
  },
};

const statusIcons: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string }> = {
  completed: { icon: CheckCircle2, color: 'text-emerald-500 dark:text-emerald-400' },
  passed: { icon: CheckCircle2, color: 'text-emerald-500 dark:text-emerald-400' },
  confirmed: { icon: CheckCircle2, color: 'text-emerald-500 dark:text-emerald-400' },
  approved: { icon: CheckCircle2, color: 'text-emerald-500 dark:text-emerald-400' },
  checked_in: { icon: LogIn, color: 'text-teal-500 dark:text-teal-400' },
  positive: { icon: TrendingUp, color: 'text-emerald-500 dark:text-emerald-400' },
  refunded: { icon: Banknote, color: 'text-amber-500 dark:text-amber-400' },
  pending: { icon: Clock, color: 'text-amber-500 dark:text-amber-400' },
  open: { icon: AlertCircle, color: 'text-amber-500 dark:text-amber-400' },
  no_show: { icon: AlertTriangle, color: 'text-orange-500 dark:text-orange-400' },
  failed: { icon: XCircle, color: 'text-red-500 dark:text-red-400' },
  cancelled: { icon: Ban, color: 'text-red-500 dark:text-red-400' },
  resolved: { icon: Info, color: 'text-blue-500 dark:text-blue-400' },
};

const filterChips: Array<{ value: string; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { value: 'all', label: 'All', icon: Activity },
  { value: 'booking', label: 'Bookings', icon: CalendarDays },
  { value: 'payment', label: 'Payments', icon: CreditCard },
  { value: 'housekeeping', label: 'Housekeeping', icon: ClipboardCheck },
  { value: 'guest', label: 'Guest', icon: UserPlus },
  { value: 'system', label: 'System', icon: Settings },
];

// ============================================
// Helpers
// ============================================

function getRelativeTime(timestamp: string): string {
  try {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
  } catch {
    return 'just now';
  }
}

function getTimePeriodLabel(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  if (isWithinInterval(date, { start: subDays(today, 6), end: weekEnd })) {
    return 'Earlier This Week';
  }
  if (isWithinInterval(date, { start: subDays(today, 13), end: subDays(today, 7) })) {
    return 'Last Week';
  }
  if (isWithinInterval(date, { start: subDays(today, 30), end: subDays(today, 14) })) {
    return 'Earlier This Month';
  }
  return 'Older';
}

function getTimePeriodKey(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  if (isToday(date)) return 'today';
  if (isYesterday(date)) return 'yesterday';
  if (isWithinInterval(date, { start: subDays(today, 6), end: weekEnd })) return 'earlier-this-week';
  if (isWithinInterval(date, { start: subDays(today, 13), end: subDays(today, 7) })) return 'last-week';
  if (isWithinInterval(date, { start: subDays(today, 30), end: subDays(today, 14) })) return 'earlier-this-month';
  return 'older';
}

const periodOrder = ['today', 'yesterday', 'earlier-this-week', 'last-week', 'earlier-this-month', 'older'];

function groupActivitiesByTime(activities: ActivityItem[]): GroupedActivities[] {
  const groups = new Map<string, GroupedActivities>();

  for (const activity of activities) {
    const date = new Date(activity.timestamp);
    const key = getTimePeriodKey(date);
    const label = getTimePeriodLabel(date);

    if (!groups.has(key)) {
      groups.set(key, { label, key, activities: [] });
    }
    groups.get(key)!.activities.push(activity);
  }

  // Sort groups by period order
  return Array.from(groups.values())
    .sort((a, b) => periodOrder.indexOf(a.key) - periodOrder.indexOf(b.key));
}

function getExtendedDetails(activity: ActivityItem): string[] {
  const details: string[] = [];

  if (activity.user) {
    details.push(`Performed by: ${activity.user.name}`);
  }
  if (activity.guest) {
    details.push(`Guest: ${activity.guest.name}`);
  }
  if (activity.room) {
    details.push(`Room: ${activity.room}`);
  }
  if (activity.amount) {
    details.push(`Amount: $${activity.amount.toFixed(2)}`);
  }
  if (activity.status) {
    details.push(`Status: ${activity.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`);
  }

  return details;
}

// ============================================
// Sub-components
// ============================================

function TimelineItem({ activity, isLast }: { activity: ActivityItem; isLast: boolean }) {
  const [isHovered, setIsHovered] = useState(false);
  const config = categoryConfig[activity.category] || categoryConfig.system;
  const Icon = config.icon;
  const statusInfo = activity.status ? statusIcons[activity.status] : null;
  const details = getExtendedDetails(activity);

  return (
    <div
      className="relative flex gap-3 group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Timeline line and dot */}
      <div className="relative flex flex-col items-center">
        {/* Timeline dot */}
        <div className={cn(
          'relative z-10 flex items-center justify-center w-9 h-9 rounded-full border-2 transition-all duration-200',
          config.bgColor,
          config.borderColor,
          isHovered && 'scale-110 shadow-md'
        )}>
          <Icon className={cn('h-4 w-4', config.textColor)} />
        </div>
        {/* Timeline line */}
        {!isLast && (
          <div className="w-0.5 flex-1 min-h-[12px] bg-border/60 mt-1" />
        )}
      </div>

      {/* Content */}
      <div className={cn(
        'flex-1 pb-4 transition-all duration-200 rounded-lg',
        isHovered ? 'bg-muted/40 -mx-1 px-1' : ''
      )}>
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-medium leading-tight truncate">{activity.title}</h4>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{activity.description}</p>
          </div>
          <span className="text-[10px] text-muted-foreground whitespace-nowrap flex-shrink-0 mt-0.5">
            {getRelativeTime(activity.timestamp)}
          </span>
        </div>

        {/* Meta row */}
        <div className="flex items-center flex-wrap gap-1.5 mt-1.5">
          {activity.guest && (
            <div className="flex items-center gap-1">
              <Avatar className="h-4 w-4">
                <AvatarFallback className="text-[7px] bg-muted">{activity.guest.initials}</AvatarFallback>
              </Avatar>
              <span className="text-[10px] text-muted-foreground">{activity.guest.name}</span>
            </div>
          )}
          {activity.room && (
            <Badge variant="outline" className="text-[10px] h-4 px-1 py-0 font-normal">
              {activity.room}
            </Badge>
          )}
          {activity.amount && (
            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
              ${activity.amount.toLocaleString()}
            </span>
          )}
          {statusInfo && (
            <div className="flex items-center gap-0.5">
              <statusInfo.icon className={cn('h-3 w-3', statusInfo.color)} />
              <span className={cn('text-[10px] capitalize', statusInfo.color)}>
                {activity.status?.replace(/_/g, ' ')}
              </span>
            </div>
          )}
          {activity.user && activity.category !== 'guest' && (
            <span className="text-[10px] text-muted-foreground">
              by {activity.user.name}
            </span>
          )}
        </div>

        {/* Hover details */}
        {isHovered && details.length > 0 && (
          <div className="mt-2 p-2 rounded-md bg-background border text-[10px] text-muted-foreground space-y-0.5 animate-in fade-in slide-in-from-top-1 duration-150">
            {details.map((detail, i) => (
              <p key={i} className="flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-muted-foreground/40 flex-shrink-0" />
                {detail}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TimelineSkeleton() {
  return (
    <div className="space-y-0">
      {['Today', 'Yesterday'].map((period) => (
        <div key={period} className="mb-4">
          <Skeleton className="h-5 w-24 mb-3" />
          <div className="space-y-0">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex gap-3 mb-3">
                <div className="flex flex-col items-center">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  {i < 2 && <Skeleton className="w-0.5 flex-1 min-h-[12px] mt-1" />}
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex justify-between">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <Skeleton className="h-3 w-full" />
                  <div className="flex gap-2">
                    <Skeleton className="h-4 w-20 rounded-full" />
                    <Skeleton className="h-4 w-10 rounded-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="relative mb-4">
        <div className="h-20 w-20 rounded-full bg-muted/50 flex items-center justify-center">
          <Inbox className="h-9 w-9 text-muted-foreground/60" />
        </div>
        <div className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-muted/50 flex items-center justify-center">
          <Clock className="h-3 w-3 text-muted-foreground/40" />
        </div>
      </div>
      <h3 className="text-sm font-medium text-muted-foreground mb-1">No Activity Yet</h3>
      <p className="text-xs text-muted-foreground/70 max-w-[200px]">
        Activities will appear here as bookings, payments, and other events occur.
      </p>
    </div>
  );
}

// ============================================
// Main Component
// ============================================

export function RecentActivity() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);

  const fetchActivities = useCallback(async (offset = 0, category = 'all', append = false) => {
    const loadingFn = offset === 0 ? setIsLoading : setIsLoadingMore;
    loadingFn(true);

    try {
      const params = new URLSearchParams({
        limit: '10',
        offset: offset.toString(),
        category,
      });

      const response = await fetch(`/api/activity?${params}`);
      const result = await response.json();

      if (result.success) {
        const newActivities = result.data.activities || [];
        setActivities(prev => append ? [...prev, ...newActivities] : newActivities);
        setHasMore(result.data.pagination.hasMore);
        setTotal(result.data.pagination.total);
        setError(null);
      } else {
        if (offset === 0) {
          setError(result.error?.message || 'Failed to load activities');
        }
      }
    } catch {
      if (offset === 0) {
        setError('Failed to fetch recent activity');
      }
    } finally {
      loadingFn(false);
    }
  }, []);

  useEffect(() => {
    fetchActivities(0, activeFilter);
  }, [activeFilter, fetchActivities]);

  const handleLoadMore = () => {
    fetchActivities(activities.length, activeFilter, true);
  };

  const handleFilterChange = (category: string) => {
    setActiveFilter(category);
    setActivities([]);
    setHasMore(false);
  };

  const handleRefresh = () => {
    fetchActivities(0, activeFilter);
  };

  const groupedActivities = groupActivitiesByTime(activities);

  return (
    <Card className="border border-border/50 shadow-sm">
      <CardHeader className="flex flex-col gap-3 pb-3">
        {/* Header row */}
        <div className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Activity Timeline
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              {total > 0 ? `${total} events tracked` : 'Latest operations'}
            </CardDescription>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={handleRefresh}
              disabled={isLoading}
            >
              <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs gap-1"
              onClick={() => useUIStore.getState().setActiveSection('bookings-calendar')}
            >
              View All
              <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <Filter className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          {filterChips.map((chip) => {
            const ChipIcon = chip.icon;
            return (
              <button
                key={chip.value}
                onClick={() => handleFilterChange(chip.value)}
                className={cn(
                  'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all duration-150 whitespace-nowrap flex-shrink-0',
                  activeFilter === chip.value
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <ChipIcon className="h-3 w-3" />
                {chip.label}
              </button>
            );
          })}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {isLoading ? (
          <TimelineSkeleton />
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mb-3">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" className="mt-3 h-7 text-xs" onClick={handleRefresh}>
              Try Again
            </Button>
          </div>
        ) : activities.length === 0 ? (
          <EmptyState />
        ) : (
          <ScrollArea className="max-h-[420px]" type="hover">
            <div className="pr-3">
              {groupedActivities.map((group) => (
                <div key={group.key} className="mb-4 last:mb-0">
                  {/* Period label */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted/50">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        {group.label}
                      </span>
                    </div>
                    <div className="flex-1 h-px bg-border/40" />
                    <span className="text-[10px] text-muted-foreground/60">
                      {group.activities.length} {group.activities.length === 1 ? 'event' : 'events'}
                    </span>
                  </div>

                  {/* Timeline items */}
                  <div className="space-y-0">
                    {group.activities.map((activity, index) => (
                      <TimelineItem
                        key={activity.id}
                        activity={activity}
                        isLast={index === group.activities.length - 1}
                      />
                    ))}
                  </div>
                </div>
              ))}

              {/* Load more button */}
              {hasMore && (
                <div className="flex justify-center pt-4 pb-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5"
                    onClick={handleLoadMore}
                    disabled={isLoadingMore}
                  >
                    {isLoadingMore ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3 w-3" />
                        Load More Activities
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
