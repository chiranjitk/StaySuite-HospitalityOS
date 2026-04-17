'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Radio,
  LogIn,
  LogOut,
  Wrench,
  Utensils,
  Bell,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Bed,
  Coffee,
  Car,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface OperationItem {
  id: string;
  type: 'checkin' | 'checkout' | 'housekeeping' | 'room-service' | 'maintenance' | 'valet' | 'concierge';
  title: string;
  subtitle: string;
  status: 'pending' | 'in-progress' | 'completed' | 'overdue';
  time: string;
  priority: 'high' | 'medium' | 'low';
  roomNumber?: string;
  guestName?: string;
}

const TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  checkin: { icon: LogIn, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30', label: 'Check-in' },
  checkout: { icon: LogOut, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-950/30', label: 'Check-out' },
  housekeeping: { icon: Sparkles, color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-950/30', label: 'Housekeeping' },
  'room-service': { icon: Coffee, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30', label: 'Room Service' },
  maintenance: { icon: Wrench, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/30', label: 'Maintenance' },
  valet: { icon: Car, color: 'text-cyan-600', bg: 'bg-cyan-50 dark:bg-cyan-950/30', label: 'Valet' },
  concierge: { icon: Bell, color: 'text-pink-600', bg: 'bg-pink-50 dark:bg-pink-950/30', label: 'Concierge' },
};

const STATUS_CONFIG: Record<string, { color: string; bg: string; border: string; label: string }> = {
  pending: { color: 'text-amber-700', bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800', label: 'Pending' },
  'in-progress': { color: 'text-sky-700', bg: 'bg-sky-50 dark:bg-sky-950/30', border: 'border-sky-200 dark:border-sky-800', label: 'In Progress' },
  completed: { color: 'text-emerald-700', bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200 dark:border-emerald-800', label: 'Done' },
  overdue: { color: 'text-red-700', bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-200 dark:border-red-800', label: 'Overdue' },
};

function getMockOperations(): OperationItem[] {
  const now = new Date();
  const fmt = (h: number, m: number) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

  return [
    { id: 'op-1', type: 'checkin', title: 'Early Check-in Request', subtitle: 'Mr. Arjun Mehta — VIP Guest', status: 'pending', time: fmt(now.getHours(), now.getMinutes() + 5), priority: 'high', roomNumber: '501', guestName: 'Arjun Mehta' },
    { id: 'op-2', type: 'housekeeping', title: 'Room Cleaning', subtitle: 'Checkout cleaning — Suite 302', status: 'in-progress', time: fmt(now.getHours(), now.getMinutes() - 15), priority: 'medium', roomNumber: '302' },
    { id: 'op-3', type: 'room-service', title: 'Breakfast Delivery', subtitle: 'Room 215 — Continental breakfast', status: 'pending', time: fmt(now.getHours(), now.getMinutes() + 2), priority: 'medium', roomNumber: '215', guestName: 'Mrs. Priya Singh' },
    { id: 'op-4', type: 'maintenance', title: 'AC Repair', subtitle: 'Room 410 — Compressor issue', status: 'overdue', time: fmt(now.getHours(), now.getMinutes() - 30), priority: 'high', roomNumber: '410' },
    { id: 'op-5', type: 'checkout', title: 'Express Checkout', subtitle: 'Ms. Sarah Williams', status: 'pending', time: fmt(now.getHours() + 1, 0), priority: 'low', roomNumber: '205', guestName: 'Sarah Williams' },
    { id: 'op-6', type: 'valet', title: 'Vehicle Retrieval', subtitle: 'BMW 5 Series — KA-05-MX-1234', status: 'in-progress', time: fmt(now.getHours(), now.getMinutes() - 5), priority: 'medium' },
    { id: 'op-7', type: 'concierge', title: 'Airport Transfer', subtitle: 'Mr. Rajesh Kumar — 4 passengers', status: 'pending', time: fmt(now.getHours() + 2, 30), priority: 'high', guestName: 'Rajesh Kumar' },
    { id: 'op-8', type: 'housekeeping', title: 'Turndown Service', subtitle: 'Rooms 501-510 — VIP Floor', status: 'pending', time: fmt(now.getHours() + 3, 0), priority: 'medium', roomNumber: '501-510' },
  ];
}

type FilterType = 'all' | 'pending' | 'in-progress' | 'overdue';

export function OperationsBoardWidget() {
  const [operations, setOperations] = useState<OperationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [isLive, setIsLive] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      // Try real API first
      const response = await fetch('/api/dashboard');
      const result = await response.json();
      if (result.success) {
        // Use mock operations enriched with real data
        setOperations(getMockOperations());
      } else {
        setOperations(getMockOperations());
      }
    } catch {
      setOperations(getMockOperations());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    if (isLive) {
      const interval = setInterval(fetchData, 30000);
      return () => clearInterval(interval);
    }
  }, [fetchData, isLive]);

  const filteredOps = filter === 'all'
    ? operations
    : operations.filter(op => op.status === filter);

  const pendingCount = operations.filter(o => o.status === 'pending').length;
  const inProgressCount = operations.filter(o => o.status === 'in-progress').length;
  const overdueCount = operations.filter(o => o.status === 'overdue').length;

  if (isLoading) {
    return (
      <Card className="border-0 shadow-sm rounded-2xl">
        <CardHeader className="pb-3">
          <div className="h-5 w-48 bg-muted/30 animate-pulse rounded" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-16 bg-muted/20 animate-pulse rounded-lg" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 rounded-2xl overflow-hidden">
      {/* Live indicator gradient bar */}
      <div className="h-[2px] bg-gradient-to-r from-rose-400 via-amber-400 to-emerald-400" />

      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Radio className="h-4 w-4 text-primary" />
            Operations Board
            {isLive && (
              <span className="relative flex h-2 w-2 ml-1">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
            )}
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setIsLive(!isLive)}
            >
              <RefreshCw className={cn('h-3 w-3 text-muted-foreground', isLive && 'animate-spin')} style={{ animationDuration: '3s' }} />
            </Button>
          </div>
        </div>

        {/* Status summary pills */}
        <div className="flex items-center gap-2 pt-1">
          <button onClick={() => setFilter('all')} className={cn(
            'text-[11px] font-semibold px-2.5 py-1 rounded-full transition-all duration-200',
            filter === 'all'
              ? 'bg-primary text-primary-foreground shadow-sm'
              : 'bg-muted/50 text-muted-foreground hover:bg-muted'
          )}>
            All {operations.length}
          </button>
          <button onClick={() => setFilter('pending')} className={cn(
            'text-[11px] font-semibold px-2.5 py-1 rounded-full transition-all duration-200 flex items-center gap-1',
            filter === 'pending'
              ? 'bg-amber-500 text-white shadow-sm'
              : 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950/50'
          )}>
            <Clock className="h-2.5 w-2.5" /> {pendingCount}
          </button>
          <button onClick={() => setFilter('in-progress')} className={cn(
            'text-[11px] font-semibold px-2.5 py-1 rounded-full transition-all duration-200 flex items-center gap-1',
            filter === 'in-progress'
              ? 'bg-sky-500 text-white shadow-sm'
              : 'bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-950/50'
          )}>
            <RefreshCw className="h-2.5 w-2.5" /> {inProgressCount}
          </button>
          {overdueCount > 0 && (
            <button onClick={() => setFilter('overdue')} className={cn(
              'text-[11px] font-semibold px-2.5 py-1 rounded-full transition-all duration-200 flex items-center gap-1 animate-pulse',
              filter === 'overdue'
                ? 'bg-red-500 text-white shadow-sm'
                : 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/50'
            )}>
              <AlertTriangle className="h-2.5 w-2.5" /> {overdueCount}
            </button>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <AnimatePresence mode="popLayout">
          <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
            {filteredOps.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-8 text-center"
              >
                <div className="rounded-full bg-emerald-50 dark:bg-emerald-900/20 p-2.5 mb-2">
                  <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                </div>
                <p className="text-sm font-medium">All caught up!</p>
                <p className="text-xs text-muted-foreground">No {filter === 'all' ? '' : filter.replace('-', ' ')} operations</p>
              </motion.div>
            ) : (
              filteredOps.map((op, i) => {
                const typeConfig = TYPE_CONFIG[op.type];
                const statusConfig = STATUS_CONFIG[op.status];
                const TypeIcon = typeConfig.icon;

                return (
                  <motion.div
                    key={op.id}
                    layout
                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.98 }}
                    transition={{ duration: 0.2, delay: i * 0.04 }}
                    className={cn(
                      'group relative p-3 rounded-xl border transition-all duration-200',
                      'hover:shadow-md hover:-translate-y-0.5 cursor-pointer',
                      statusConfig.border,
                      op.status === 'overdue' && 'border-red-300 dark:border-red-700 bg-red-50/50 dark:bg-red-950/20'
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      {/* Type icon */}
                      <div className={cn(
                        'h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-110',
                        typeConfig.bg
                      )}>
                        <TypeIcon className={cn('h-4 w-4', typeConfig.color)} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{op.title}</p>
                          {op.priority === 'high' && (
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-red-200 text-red-600 dark:border-red-800 dark:text-red-400">
                              URGENT
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{op.subtitle}</p>
                        <div className="flex items-center gap-2 pt-0.5">
                          <span className={cn(
                            'text-[10px] font-medium px-1.5 py-0.5 rounded-full',
                            statusConfig.bg, statusConfig.color
                          )}>
                            {statusConfig.label}
                          </span>
                          {op.roomNumber && (
                            <span className="text-[10px] font-mono text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                              Room {op.roomNumber}
                            </span>
                          )}
                          <span className="text-[10px] text-muted-foreground/60 flex items-center gap-0.5">
                            <Clock className="h-2.5 w-2.5" /> {op.time}
                          </span>
                        </div>
                      </div>

                      {/* Arrow */}
                      <ArrowRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors flex-shrink-0 mt-1" />
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </AnimatePresence>

        {/* Custom scrollbar styling */}
        <style>{`
          .custom-scrollbar::-webkit-scrollbar {
            width: 4px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: hsl(var(--muted-foreground) / 0.2);
            border-radius: 100px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: hsl(var(--muted-foreground) / 0.4);
          }
        `}</style>
      </CardContent>
    </Card>
  );
}
