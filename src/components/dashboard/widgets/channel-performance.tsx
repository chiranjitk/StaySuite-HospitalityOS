'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/contexts/CurrencyContext';
import {
  Globe,
  Monitor,
  Phone,
  Footprints,
  Building2,
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

function getMockData(): ChannelData {
  return {
    channels: [
      { name: 'Direct', icon: Globe, bookings: 42, revenue: 504000, share: 35, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30', barBg: 'bg-emerald-500' },
      { name: 'Booking.com', icon: Monitor, bookings: 28, revenue: 336000, share: 23, color: 'text-sky-600', bg: 'bg-sky-50 dark:bg-sky-950/30', barBg: 'bg-sky-500' },
      { name: 'MakeMyTrip', icon: Phone, bookings: 22, revenue: 264000, share: 18, color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-950/30', barBg: 'bg-violet-500' },
      { name: 'Expedia', icon: Building2, bookings: 16, revenue: 192000, share: 13, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30', barBg: 'bg-amber-500' },
      { name: 'Walk-in', icon: Footprints, bookings: 12, revenue: 144000, share: 10, color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-950/30', barBg: 'bg-rose-500' },
    ],
    totalRevenue: 1440000,
    totalBookings: 120,
    conversionRate: 68,
  };
}

export default function ChannelPerformanceWidget() {
  const [data, setData] = useState<ChannelData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { formatCurrency } = useCurrency();

  useEffect(() => {
    const timer = setTimeout(() => {
      setData(getMockData());
      setIsLoading(false);
    }, 1100);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return (
      <Card className="border border-border/50 shadow-sm rounded-2xl">
        <CardHeader className="pb-3">
          <div className="h-5 w-40 bg-muted/30 animate-pulse rounded" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-10 bg-muted/20 animate-pulse rounded" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <Card className="border border-border/50 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 rounded-2xl overflow-hidden">
      {/* Accent bar */}
      <div className="h-[2px] bg-gradient-to-r from-teal-400 via-cyan-400 to-sky-400" />

      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-teal-600" />
            Channel Performance
          </CardTitle>
          <Badge variant="outline" className="text-[10px] px-2 py-0 h-5 border-teal-200 text-teal-700 dark:border-teal-800 dark:text-teal-400">
            {data.totalBookings} bookings
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
                  <span className="text-[10px] text-muted-foreground tabular-nums">{channel.bookings} bkg</span>
                  <span className={cn('text-xs font-bold tabular-nums', channel.color)}>{channel.share}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-muted/20 rounded-full overflow-hidden">
                    <motion.div
                      className={cn('h-full rounded-full', channel.barBg)}
                      initial={{ width: 0 }}
                      animate={{ width: `${channel.share}%` }}
                      transition={{ duration: 0.8, delay: i * 0.1 + 0.4, ease: 'easeOut' }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground tabular-nums w-16 text-right">
                    {formatCurrency(channel.revenue)}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Total + conversion */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/30">
          <div className="p-2.5 rounded-lg bg-gradient-to-br from-teal-50/80 to-cyan-50/50 dark:from-teal-950/20 dark:to-cyan-950/10 border border-teal-100/50 dark:border-teal-800/30">
            <div className="flex items-center gap-1 mb-0.5">
              <TrendingUp className="h-3 w-3 text-teal-600" />
              <span className="text-[10px] text-muted-foreground font-medium">Total Revenue</span>
            </div>
            <p className="text-sm font-bold text-teal-600 tabular-nums">{formatCurrency(data.totalRevenue)}</p>
          </div>
          <div className="p-2.5 rounded-lg bg-gradient-to-br from-sky-50/80 to-blue-50/50 dark:from-sky-950/20 dark:to-blue-950/10 border border-sky-100/50 dark:border-sky-800/30">
            <div className="flex items-center gap-1 mb-0.5">
              <ArrowUpRight className="h-3 w-3 text-sky-600" />
              <span className="text-[10px] text-muted-foreground font-medium">Conversion</span>
            </div>
            <p className="text-sm font-bold text-sky-600 tabular-nums">{data.conversionRate}%</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
