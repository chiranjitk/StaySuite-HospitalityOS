'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowDownLeft,
  ArrowUpRight,
  LogIn,
  LogOut,
  Crown,
  Globe,
  Hotel,
  Clock,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/store';

interface ScheduleItem {
  id: string;
  time: string;
  guestName: string;
  roomNumber: string;
  roomType?: string;
  isVip: boolean;
  loyaltyTier?: string;
  status: string;
  source?: string;
  specialRequests?: string;
  property?: string;
}

interface ScheduleData {
  arrivals: ScheduleItem[];
  departures: ScheduleItem[];
  date: string;
}

function formatTime(isoString: string): string {
  try {
    return new Date(isoString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '--:--';
  }
}

function SourceIcon({ source }: { source: string }) {
  const iconClass = 'h-3 w-3';
  switch (source) {
    case 'booking_com':
      return <Globe className={cn(iconClass, 'text-blue-500 dark:text-blue-400')} />;
    case 'airbnb':
      return <Hotel className={cn(iconClass, 'text-rose-500 dark:text-rose-400')} />;
    default:
      return <Globe className={cn(iconClass, 'text-muted-foreground')} />;
  }
}

function ScheduleItemRow({ item, type }: { item: ScheduleItem; type: 'arrival' | 'departure' }) {
  const isCompleted = type === 'arrival' ? item.status === 'checked_in' : item.status === 'checked_out';
  const Icon = type === 'arrival' ? ArrowDownLeft : ArrowUpRight;

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-2.5 rounded-lg transition-all duration-200 cursor-pointer',
        'hover:bg-muted/60 group',
        isCompleted && 'opacity-50'
      )}
    >
      {/* Time */}
      <div className="text-xs font-medium text-muted-foreground tabular-nums w-14 shrink-0 text-right">
        {formatTime(item.time)}
      </div>

      {/* Icon */}
      <div
        className={cn(
          'h-7 w-7 rounded-full flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-110',
          type === 'arrival'
            ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'
            : 'bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400'
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>

      {/* Guest info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium truncate">{item.guestName}</span>
          {item.isVip && (
            <Crown className="h-3 w-3 text-amber-500 dark:text-amber-400 shrink-0" />
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-mono">#{item.roomNumber}</span>
          {item.source && <SourceIcon source={item.source} />}
        </div>
      </div>

      {/* Badges */}
      <div className="flex items-center gap-1 shrink-0">
        {item.isVip && (
          <Badge className="bg-gradient-to-r from-amber-500 to-yellow-500 text-white text-[9px] px-1.5 py-0 border-0 h-4">
            VIP
          </Badge>
        )}
        {item.specialRequests && (
          <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-amber-300 text-amber-600 dark:border-amber-700 dark:text-amber-400">
            Note
          </Badge>
        )}
      </div>
    </div>
  );
}

function EmptyState({ type }: { type: 'arrival' | 'departure' }) {
  return (
    <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
      {type === 'arrival' ? (
        <ArrowDownLeft className="h-6 w-6 mb-2 opacity-30" />
      ) : (
        <ArrowUpRight className="h-6 w-6 mb-2 opacity-30" />
      )}
      <p className="text-xs">No {type}s today</p>
    </div>
  );
}

export function TodaysSchedule() {
  const [data, setData] = useState<ScheduleData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { setActiveSection } = useUIStore();

  const fetchSchedule = useCallback(async () => {
    try {
      const response = await fetch('/api/dashboard/todays-schedule');
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error('Error fetching schedule:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchedule();
    const interval = setInterval(fetchSchedule, 60000);
    return () => clearInterval(interval);
  }, [fetchSchedule]);

  if (isLoading) {
    return (
      <Card className="border border-border/50 shadow-sm rounded-2xl hover:shadow-md transition-all duration-300">
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-lg" />
              ))}
            </div>
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-lg" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const arrivals = data?.arrivals?.slice(0, 5) || [];
  const departures = data?.departures?.slice(0, 5) || [];

  return (
    <Card className="border border-border/50 shadow-sm rounded-2xl hover:shadow-md transition-all duration-300">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Today&apos;s Schedule
            <span className="relative flex h-2 w-2 ml-0.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={fetchSchedule}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 max-h-[320px] overflow-y-auto scrollbar-thin scrollbar-thumb-border/50 scrollbar-track-transparent pr-1">
          {/* Arrivals */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                Arrivals
              </span>
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 border-0">
                {arrivals.length}
              </Badge>
            </div>
            <div className="space-y-0.5">
              {arrivals.length === 0 ? (
                <EmptyState type="arrival" />
              ) : (
                arrivals.map((item) => (
                  <ScheduleItemRow key={item.id} item={item} type="arrival" />
                ))
              )}
            </div>
          </div>

          {/* Departures */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <div className="h-1.5 w-1.5 rounded-full bg-orange-500" />
              <span className="text-xs font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wider">
                Departures
              </span>
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5 bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 border-0">
                {departures.length}
              </Badge>
            </div>
            <div className="space-y-0.5">
              {departures.length === 0 ? (
                <EmptyState type="departure" />
              ) : (
                departures.map((item) => (
                  <ScheduleItemRow key={item.id} item={item} type="departure" />
                ))
              )}
            </div>
          </div>
        </div>

        {/* View All link */}
        <div className="mt-3 pt-2 border-t border-border/50 flex gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950 transition-colors"
            onClick={() => setActiveSection('frontdesk-checkin')}
          >
            View All Arrivals
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-orange-600 dark:text-orange-400 hover:text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-950 transition-colors"
            onClick={() => setActiveSection('frontdesk-checkout')}
          >
            View All Departures
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
