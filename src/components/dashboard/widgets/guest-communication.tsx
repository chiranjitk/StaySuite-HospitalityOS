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
  Mail,
  Phone,
  MessageSquare,
  StickyNote,
  UserCheck,
} from 'lucide-react';
import { motion } from 'framer-motion';

type CommType = 'email' | 'sms' | 'phone' | 'note' | 'inperson';

interface Communication {
  id: string;
  type: CommType;
  guestName: string;
  room: string;
  preview: string;
  timestamp: string;
  isUnread: boolean;
}

interface CommunicationData {
  lastUpdated: string;
  unreadCount: number;
  communications: Communication[];
}

const EMPTY_DATA: CommunicationData = {
  lastUpdated: new Date().toISOString(),
  unreadCount: 0,
  communications: [],
};

const TYPE_CONFIG: Record<CommType, { label: string; color: string; bg: string; border: string; icon: React.ElementType }> = {
  email: { label: 'Email', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/40', border: 'border-blue-300 dark:border-blue-700', icon: Mail },
  sms: { label: 'SMS', color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-100 dark:bg-violet-900/40', border: 'border-violet-300 dark:border-violet-700', icon: MessageSquare },
  phone: { label: 'Call', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/40', border: 'border-emerald-300 dark:border-emerald-700', icon: Phone },
  note: { label: 'Note', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/40', border: 'border-amber-300 dark:border-amber-700', icon: StickyNote },
  inperson: { label: 'In-Person', color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-100 dark:bg-teal-900/40', border: 'border-teal-300 dark:border-teal-700', icon: UserCheck },
};

function getRelativeTime(timestamp: string): string {
  const now = Date.now();
  const diff = now - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / (60 * 1000));
  const hours = Math.floor(diff / (60 * 60 * 1000));
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function TimelineItem({ comm, index }: { comm: Communication; index: number }) {
  const config = TYPE_CONFIG[comm.type];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06, duration: 0.3 }}
      className="flex gap-3 group"
    >
      {/* Timeline line + dot */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div className={cn(
          'relative h-8 w-8 rounded-full flex items-center justify-center border-2 transition-all',
          config.bg,
          config.border,
          'group-hover:scale-110'
        )}>
          <Icon className={cn('h-3.5 w-3.5', config.color)} />
          {comm.isUnread && (
            <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-blue-500 border-2 border-background" />
          )}
        </div>
        {index < 5 && (
          <div className="w-px flex-1 bg-border/50 min-h-[16px]" />
        )}
      </div>

      {/* Content */}
      <div className={cn(
        'flex-1 min-w-0 pb-4 rounded-lg p-2.5 -ml-1 transition-all duration-200',
        'hover:bg-muted/50',
        comm.isUnread && 'bg-muted/50'
      )}>
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className={cn('text-sm font-medium truncate', comm.isUnread && 'font-semibold')}>
              {comm.guestName}
            </span>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-border/50 text-muted-foreground flex-shrink-0">
              Rm {comm.room}
            </Badge>
          </div>
          <span className="text-[10px] text-muted-foreground flex-shrink-0 tabular-nums">
            {getRelativeTime(comm.timestamp)}
          </span>
        </div>
        <p className={cn(
          'text-xs text-muted-foreground line-clamp-2 leading-relaxed',
          comm.isUnread && 'text-foreground/80'
        )}>
          {comm.preview}
        </p>
      </div>
    </motion.div>
  );
}

export function GuestCommunicationWidget() {
  const [data, setData] = useState<CommunicationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchData = useCallback(async (isInitial = false) => {
    if (isInitial) setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/dashboard/communications');
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
        console.error('[GuestComms] Fetch failed:', err.message);
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

    const interval = setInterval(() => {
      fetchData(false);
    }, 2 * 60 * 1000);

    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <Card className="border border-border/50 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 rounded-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            Guest Communications
            {data?.unreadCount ? (
              <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 text-[10px] px-1.5 py-0 h-5 border-0">
                {data.unreadCount} new
              </Badge>
            ) : null}
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
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : error && !data ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="h-8 w-8 text-red-400 dark:text-red-300 mb-2" />
            <p className="text-sm text-muted-foreground">Failed to load communications</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => fetchData(true)}>
              Retry
            </Button>
          </div>
        ) : data ? (
          <div className="space-y-0">
            <div className="max-h-96 overflow-y-auto pr-1 custom-scrollbar">
              {data.communications.map((comm, index) => (
                <TimelineItem key={comm.id} comm={comm} index={index} />
              ))}
            </div>
            <Button variant="ghost" size="sm" className="w-full hover:bg-muted/60 transition-colors text-xs mt-1">
              View All
              <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
