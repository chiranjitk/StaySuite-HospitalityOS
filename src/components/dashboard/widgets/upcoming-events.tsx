'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  RefreshCw,
  AlertCircle,
  ArrowRight,
  CalendarHeart,
  Monitor,
  UsersRound,
  GlassWater,
  Lock,
  Clock,
} from 'lucide-react';
import { motion } from 'framer-motion';

type EventType = 'conference' | 'wedding' | 'meeting' | 'banquet' | 'private';
type EventStatus = 'confirmed' | 'pending' | 'cancelled';

interface HotelEvent {
  id: string;
  name: string;
  type: EventType;
  date: string;
  startTime: string;
  endTime: string;
  expectedGuests: number;
  venue: string;
  status: EventStatus;
}

interface EventsData {
  lastUpdated: string;
  events: HotelEvent[];
}

const MOCK_DATA: EventsData = {
  lastUpdated: new Date().toISOString(),
  events: [
    { id: 'evt-001', name: 'Tech Innovation Summit 2026', type: 'conference', date: new Date().toISOString(), startTime: '09:00', endTime: '17:00', expectedGuests: 150, venue: 'Grand Ballroom A', status: 'confirmed' },
    { id: 'evt-002', name: 'Anderson–Lee Wedding Reception', type: 'wedding', date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(), startTime: '16:00', endTime: '23:00', expectedGuests: 120, venue: 'Garden Terrace', status: 'confirmed' },
    { id: 'evt-003', name: 'Quarterly Sales Review', type: 'meeting', date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(), startTime: '10:00', endTime: '12:00', expectedGuests: 25, venue: 'Boardroom 3', status: 'confirmed' },
    { id: 'evt-004', name: 'Annual Charity Gala Dinner', type: 'banquet', date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), startTime: '19:00', endTime: '23:30', expectedGuests: 200, venue: 'Grand Ballroom B', status: 'pending' },
    { id: 'evt-005', name: 'Private Birthday Celebration', type: 'private', date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), startTime: '18:00', endTime: '22:00', expectedGuests: 30, venue: 'Rooftop Lounge', status: 'confirmed' },
  ],
};

const TYPE_CONFIG: Record<EventType, { label: string; color: string; bg: string; border: string; icon: React.ElementType }> = {
  conference: { label: 'Conference', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30', border: 'border-blue-300 dark:border-blue-700', icon: Monitor },
  wedding: { label: 'Wedding', color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-100 dark:bg-rose-900/30', border: 'border-rose-300 dark:border-rose-700', icon: CalendarHeart },
  meeting: { label: 'Meeting', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30', border: 'border-amber-300 dark:border-amber-700', icon: UsersRound },
  banquet: { label: 'Banquet', color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-100 dark:bg-violet-900/30', border: 'border-violet-300 dark:border-violet-700', icon: GlassWater },
  private: { label: 'Private', color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-100 dark:bg-teal-900/30', border: 'border-teal-300 dark:border-teal-700', icon: Lock },
};

const STATUS_CONFIG: Record<EventStatus, { label: string; className: string }> = {
  confirmed: { label: 'Confirmed', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' },
  pending: { label: 'Pending', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800' },
  cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800' },
};

function getCountdown(dateStr: string): { text: string; isToday: boolean } {
  const now = new Date();
  const eventDate = new Date(dateStr);
  const startOfEvent = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((startOfEvent.getTime() - startOfToday.getTime()) / (24 * 60 * 60 * 1000));

  if (diffDays === 0) return { text: 'Today', isToday: true };
  if (diffDays === 1) return { text: 'Tomorrow', isToday: false };
  if (diffDays < 0) return { text: `${Math.abs(diffDays)}d ago`, isToday: false };
  return { text: `In ${diffDays} days`, isToday: false };
}

function formatEventDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatWeekday(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { weekday: 'short' });
}

function EventRow({ event, index }: { event: HotelEvent; index: number }) {
  const typeConfig = TYPE_CONFIG[event.type];
  const statusConfig = STATUS_CONFIG[event.status];
  const countdown = getCountdown(event.date);
  const Icon = typeConfig.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.3 }}
      className={cn(
        'flex items-start gap-3 p-3 rounded-xl border transition-all duration-200',
        'hover:shadow-sm hover:-translate-y-0.5',
        countdown.isToday
          ? 'border-amber-300 dark:border-amber-700 ring-2 ring-amber-400/40 dark:ring-amber-600/40 bg-gradient-to-br from-amber-50/60 to-transparent dark:from-amber-950/20'
          : 'border-border/50 bg-card/50'
      )}
    >
      {/* Date block */}
      <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-muted/80 flex flex-col items-center justify-center border border-border/50">
        <span className="text-[10px] uppercase text-muted-foreground leading-none">{formatWeekday(event.date)}</span>
        <span className="text-base font-bold leading-tight">{new Date(event.date).getDate()}</span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <span className={cn('text-sm font-medium leading-tight line-clamp-1', countdown.isToday && 'font-semibold')}>
            {event.name}
          </span>
          <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 h-5 flex-shrink-0 border', statusConfig.className)}>
            {statusConfig.label}
          </Badge>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            <div className={cn('h-5 w-5 rounded flex items-center justify-center', typeConfig.bg)}>
              <Icon className={cn('h-3 w-3', typeConfig.color)} />
            </div>
            <span className={cn('text-[10px] font-medium', typeConfig.color)}>{typeConfig.label}</span>
          </div>
          <span className="text-[10px] text-muted-foreground">·</span>
          <span className="text-[10px] text-muted-foreground">{event.venue}</span>
        </div>

        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-0.5">
            <Clock className="h-2.5 w-2.5" />
            {event.startTime} – {event.endTime}
          </span>
          <span className="flex items-center gap-0.5">
            <UsersRound className="h-2.5 w-2.5" />
            {event.expectedGuests} guests
          </span>
        </div>
      </div>

      {/* Countdown */}
      <div className={cn(
        'flex-shrink-0 px-2 py-1 rounded-full text-[10px] font-semibold',
        countdown.isToday
          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
          : 'bg-muted text-muted-foreground'
      )}>
        {countdown.text}
      </div>
    </motion.div>
  );
}

export function UpcomingEventsWidget() {
  const [data, setData] = useState<EventsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchData = useCallback(async (isInitial = false) => {
    if (isInitial) setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/dashboard/events');
      const result = await response.json();

      if (result.success && result.data) {
        setData(result.data);
        setLastRefresh(new Date());
      } else {
        throw new Error(result.error?.message || 'Failed to fetch data');
      }
    } catch (err) {
      console.error('Events fetch failed:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setData(MOCK_DATA);
      setLastRefresh(new Date());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(true);

    const interval = setInterval(() => {
      fetchData(false);
    }, 10 * 60 * 1000);

    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <Card className="border-0 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 rounded-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <CalendarHeart className="h-4 w-4 text-rose-600" />
            Upcoming Events
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
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : error && !data ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="h-8 w-8 text-red-400 mb-2" />
            <p className="text-sm text-muted-foreground">Failed to load events</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => fetchData(true)}>
              Retry
            </Button>
          </div>
        ) : data ? (
          <div className="space-y-2.5">
            <div className="max-h-96 overflow-y-auto pr-1 custom-scrollbar space-y-2.5">
              {data.events.map((event, index) => (
                <EventRow key={event.id} event={event} index={index} />
              ))}
            </div>
            <Button variant="ghost" size="sm" className="w-full hover:bg-muted/60 transition-colors text-xs mt-1">
              View Calendar
              <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
