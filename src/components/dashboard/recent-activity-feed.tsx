'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CalendarPlus,
  LogIn,
  LogOut,
  DollarSign,
  CreditCard,
  Sparkles,
  Wrench,
  UserCheck,
  AlertTriangle,
  CheckCircle2,
  Settings,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { useUIStore } from '@/store';

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
}

const categoryConfig: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  booking: { icon: CalendarPlus, color: 'text-sky-600 dark:text-sky-400', bg: 'bg-sky-500/10' },
  payment: { icon: DollarSign, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
  housekeeping: { icon: Wrench, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10' },
  guest: { icon: UserCheck, color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-500/10' },
  system: { icon: Settings, color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-500/10' },
};

const typeIcons: Record<string, React.ElementType> = {
  check_in: LogIn,
  check_out: LogOut,
  payment_received: CreditCard,
  payment_failed: AlertTriangle,
  cleaning_completed: CheckCircle2,
};

function getTimeAgo(timestamp: string): string {
  const now = new Date();
  const time = new Date(timestamp);
  const diffMs = now.getTime() - time.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

export function RecentActivityFeed() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { setActiveSection } = useUIStore();

  useEffect(() => {
    let cancelled = false;

    const fetchActivities = async () => {
      try {
        const response = await fetch('/api/activity?limit=10');
        const result = await response.json();
        if (result.success && result.data && !cancelled) {
          setActivities(result.data.activities);
        }
      } catch {
        // Keep existing state on error
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchActivities();
    const interval = setInterval(fetchActivities, 20000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (isLoading) {
    return (
      <Card className="border border-border/50 shadow-sm rounded-2xl">
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-36" />
        </CardHeader>
        <CardContent className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="border border-border/50 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 rounded-2xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              Recent Activity
              <span className="relative flex h-2 w-2 ml-1">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
            </CardTitle>
            <Badge variant="secondary" className="text-xs tabular-nums">
              {activities.length} items
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-1 max-h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-border/50 scrollbar-track-transparent pr-1">
            {activities.map((activity, idx) => {
              const catConfig = categoryConfig[activity.category] || categoryConfig.system;
              const TypeIcon = typeIcons[activity.type] || catConfig.icon;

              return (
                <motion.div
                  key={activity.id}
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-muted/50 transition-colors duration-200 cursor-default group"
                >
                  {/* Icon */}
                  <div className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg mt-0.5',
                    catConfig.bg
                  )}>
                    <TypeIcon className={cn('h-3.5 w-3.5', catConfig.color)} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate group-hover:text-foreground/80 transition-colors">
                      {activity.title}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                      {activity.description}
                    </p>
                  </div>

                  {/* Time */}
                  <span className="text-[10px] text-muted-foreground/60 tabular-nums flex-shrink-0 mt-0.5">
                    {getTimeAgo(activity.timestamp)}
                  </span>
                </motion.div>
              );
            })}

            {activities.length === 0 && (
              <div className="flex flex-col items-center py-6 text-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 dark:text-emerald-400/50 mb-2" />
                <p className="text-sm text-muted-foreground">No recent activity</p>
              </div>
            )}
          </div>

          {/* View All */}
          {activities.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-2 hover:bg-muted/60 transition-colors text-xs"
              onClick={() => setActiveSection('dashboard-activity')}
            >
              View All Activity
              <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
