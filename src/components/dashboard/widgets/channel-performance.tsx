'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/contexts/CurrencyContext';
import {
  Globe,
  Monitor,
  BarChart3,
  ArrowUpRight,
  TrendingUp,
} from 'lucide-react';
import { motion } from 'framer-motion';

interface Channel {
  name: string;
  icon: React.ElementType;
  bookings: number;
  revenue: number;
  share: number;
  color: string;
  bg: string;
  barBg: string;
}

interface ChannelData {
  channels: Channel[];
  totalRevenue: number;
  totalBookings: number;
  conversionRate: number;
}

const CHANNEL_COLORS = [
  { color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/50', barBg: 'bg-emerald-500' },
  { color: 'text-sky-600 dark:text-sky-400', bg: 'bg-sky-50 dark:bg-sky-950/50', barBg: 'bg-sky-500' },
  { color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-950/50', barBg: 'bg-violet-500' },
  { color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/50', barBg: 'bg-amber-500' },
  { color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-950/50', barBg: 'bg-rose-500' },
  { color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-950/50', barBg: 'bg-cyan-500' },
  { color: 'text-pink-600 dark:text-pink-400', bg: 'bg-pink-50 dark:bg-pink-950/50', barBg: 'bg-pink-500' },
];

const CHANNEL_ICONS: Record<string, React.ElementType> = {
  direct: Globe,
  website: Globe,
  booking_com: Monitor,
  makemytrip: Monitor,
  expedia: Monitor,
  walk_in: Globe,
};

function getChannelIcon(channelName: string): React.ElementType {
  const lower = channelName.toLowerCase().replace(/[\s._-]/g, '');
  for (const [key, icon] of Object.entries(CHANNEL_ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return Globe;
}

export default function ChannelPerformanceWidget() {
  const [data, setData] = useState<ChannelData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { formatCurrency } = useCurrency();

  useEffect(() => {
    async function fetchChannels() {
      try {
        const response = await fetch('/api/channels/connections');
        const result = await response.json();
        if (result.success && result.data && result.data.length > 0) {
          const connections = result.data;
          const totalBookings = connections.reduce((sum: number, c: { mappingCount?: number; syncCount?: number }) => sum + (c.mappingCount || c.syncCount || 0), 0);

          const channels: Channel[] = connections.slice(0, 7).map((conn: { displayName?: string; channel?: string; mappingCount?: number; syncCount?: number; status?: string }, index: number) => {
            const count = conn.mappingCount || conn.syncCount || 0;
            const share = totalBookings > 0 ? Math.round((count / totalBookings) * 100) : 0;
            const colors = CHANNEL_COLORS[index % CHANNEL_COLORS.length];
            return {
              name: conn.displayName || conn.channel || 'Unknown',
              icon: getChannelIcon(conn.displayName || conn.channel || ''),
              bookings: count,
              revenue: 0,
              share,
              ...colors,
            };
          });

          const stats = result.stats || {};
          setData({
            channels,
            totalRevenue: 0,
            totalBookings: stats.totalConnections || connections.length,
            conversionRate: stats.activeConnections && stats.totalConnections
              ? Math.round((stats.activeConnections / stats.totalConnections) * 100)
              : 0,
          });
        } else {
          setData(null);
        }
      } catch {
        setData(null);
      } finally {
        setIsLoading(false);
      }
    }
    fetchChannels();
  }, []);

  if (isLoading) {
    return (
      <Card className="border border-border/50 shadow-sm rounded-2xl">
        <CardHeader className="pb-3">
          <div className="h-5 w-40 bg-muted/50 animate-pulse rounded" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-10 bg-muted/40 animate-pulse rounded" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!data || data.channels.length === 0) {
    return (
      <Card className="border border-border/50 shadow-sm rounded-2xl overflow-hidden">
        <div className="h-[2px] bg-gradient-to-r from-teal-400 via-cyan-400 to-sky-400" />
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            Channel Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="rounded-full bg-teal-50 dark:bg-teal-900/40 p-3 mb-3">
              <Globe className="h-6 w-6 text-teal-400 dark:text-teal-300" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">No channels connected</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Channel performance data will appear once channels are set up</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-border/50 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 rounded-2xl overflow-hidden">
      {/* Accent bar */}
      <div className="h-[2px] bg-gradient-to-r from-teal-400 via-cyan-400 to-sky-400" />

      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            Channel Performance
          </CardTitle>
          <Badge variant="outline" className="text-[10px] px-2 py-0 h-5 border-teal-200 text-teal-700 dark:border-teal-800 dark:text-teal-400">
            {data.totalBookings} channels
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Channel list */}
        <div className="space-y-2.5">
          {data.channels.map((channel, i) => {
            const Icon = channel.icon;
            return (
              <motion.div
                key={channel.name}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 + 0.2 }}
                className="space-y-1.5"
              >
                <div className="flex items-center gap-2">
                  <div className={cn('h-6 w-6 rounded-md flex items-center justify-center', channel.bg)}>
                    <Icon className={cn('h-3 w-3', channel.color)} />
                  </div>
                  <span className="text-xs font-medium flex-1">{channel.name}</span>
                  <span className="text-[10px] text-muted-foreground tabular-nums">{channel.bookings} mappings</span>
                  <span className={cn('text-xs font-bold tabular-nums', channel.color)}>{channel.share}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-muted/40 rounded-full overflow-hidden">
                    <motion.div
                      className={cn('h-full rounded-full', channel.barBg)}
                      initial={{ width: 0 }}
                      animate={{ width: `${channel.share}%` }}
                      transition={{ duration: 0.8, delay: i * 0.1 + 0.4, ease: 'easeOut' }}
                    />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Total + conversion */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/50">
          <div className="p-2.5 rounded-lg bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-950/50 dark:to-cyan-950/50 border border-teal-100/50 dark:border-teal-800/50">
            <div className="flex items-center gap-1 mb-0.5">
              <TrendingUp className="h-3 w-3 text-teal-600 dark:text-teal-400" />
              <span className="text-[10px] text-muted-foreground font-medium">Total Channels</span>
            </div>
            <p className="text-sm font-bold text-teal-600 dark:text-teal-400 tabular-nums">{data.totalBookings}</p>
          </div>
          <div className="p-2.5 rounded-lg bg-gradient-to-br from-sky-50 to-blue-50 dark:from-sky-950/50 dark:to-blue-950/50 border border-sky-100/50 dark:border-sky-800/50">
            <div className="flex items-center gap-1 mb-0.5">
              <ArrowUpRight className="h-3 w-3 text-sky-600 dark:text-sky-400" />
              <span className="text-[10px] text-muted-foreground font-medium">Active Rate</span>
            </div>
            <p className="text-sm font-bold text-sky-600 dark:text-sky-400 tabular-nums">{data.conversionRate}%</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
