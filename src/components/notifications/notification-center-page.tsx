'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Settings,
  CreditCard,
  Shield,
  Wifi,
  CheckCheck,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

interface Notification {
  id: string;
  type: 'booking' | 'system' | 'alert' | 'payment' | 'security' | 'wifi';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  actionUrl?: string;
}

const typeConfig: Record<string, { icon: typeof Bell; color: string; bg: string }> = {
  booking: { icon: Calendar, color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-950/30' },
  system: { icon: Settings, color: 'text-slate-600', bg: 'bg-slate-50 dark:bg-slate-950/30' },
  alert: { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30' },
  payment: { icon: CreditCard, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
  security: { icon: Shield, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/30' },
  wifi: { icon: Wifi, color: 'text-cyan-600', bg: 'bg-cyan-50 dark:bg-cyan-950/30' },
};



export default function NotificationCenterPage() {
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const fetchNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/notifications/list?limit=50');
      const data = await res.json();
      if (data.success && data.data?.notifications?.length > 0) {
        // Map API response to local Notification type
        const mapped = data.data.notifications.map((n: { id: string; type: string; title: string; message: string; createdAt: string; read: boolean; actionUrl?: string }) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          message: n.message,
          read: n.read,
          createdAt: n.createdAt,
          actionUrl: n.actionUrl,
        }));
        setNotifications(mapped);
      } else {
        // No notifications found — show empty state
        setNotifications([]);
      }
    } catch {
      setNotifications([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAsRead = async (id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    );
    try {
      await fetch(`/api/notifications/mark-read?id=${encodeURIComponent(id)}`, {
        method: 'PUT',
      });
    } catch {
      // Optimistic update already applied
    }
  };

  const markAllRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    try {
      const res = await fetch('/api/notifications/mark-read?all=true', {
        method: 'PUT',
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: `${data.data?.markedCount || 'All'} notifications marked as read` });
      } else {
        toast({ title: 'Failed to mark all as read', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Failed to mark all as read', variant: 'destructive' });
    }
  };

  const filteredNotifications = filter === 'all'
    ? notifications
    : notifications.filter(n => n.type === filter);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Bell className="h-5 w-5 text-amber-600" />
            Notification Center
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-1 text-[10px] px-1.5 py-0">
                {unreadCount}
              </Badge>
            )}
          </h2>
          <p className="text-sm text-muted-foreground">
            Stay updated with the latest alerts and activities
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchNotifications}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllRead}>
              <CheckCheck className="h-4 w-4 mr-2" />
              Mark All Read
            </Button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList className="bg-muted/50">
          <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
          <TabsTrigger value="booking" className="text-xs">Bookings</TabsTrigger>
          <TabsTrigger value="alert" className="text-xs">Alerts</TabsTrigger>
          <TabsTrigger value="system" className="text-xs">System</TabsTrigger>
          <TabsTrigger value="payment" className="text-xs">Payments</TabsTrigger>
          <TabsTrigger value="wifi" className="text-xs">WiFi</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Notifications List */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex items-start gap-3 p-3">
                  <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-72" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-full bg-muted/50 p-4 mb-3">
                <CheckCircle2 className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <h3 className="text-sm font-medium text-muted-foreground">No notifications</h3>
              <p className="text-xs text-muted-foreground/60 mt-1">
                {filter === 'all' ? "You're all caught up!" : `No ${filter} notifications found`}
              </p>
            </div>
          ) : (
            <ScrollArea className="max-h-[600px]">
              <div className="divide-y divide-border/30">
                {filteredNotifications.map((notification) => {
                  const config = typeConfig[notification.type] || typeConfig.system;
                  const Icon = config.icon;
                  return (
                    <div
                      key={notification.id}
                      className={cn(
                        'flex items-start gap-3 p-4 transition-all duration-200 hover:bg-muted/30 cursor-pointer group',
                        !notification.read && 'bg-primary/[0.03]'
                      )}
                      onClick={() => !notification.read && markAsRead(notification.id)}
                    >
                      {/* Type Icon */}
                      <div className={cn(
                        'flex items-center justify-center h-9 w-9 rounded-lg flex-shrink-0 transition-transform duration-200 group-hover:scale-105',
                        config.bg
                      )}>
                        <Icon className={cn('h-4 w-4', config.color)} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className={cn(
                              'text-sm truncate',
                              notification.read ? 'font-medium text-foreground/80' : 'font-semibold text-foreground'
                            )}>
                              {notification.title}
                            </p>
                            <p className="text-xs text-muted-foreground/70 mt-0.5 line-clamp-2">
                              {notification.message}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {!notification.read && (
                              <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                            )}
                            <span className="text-[10px] text-muted-foreground/50 whitespace-nowrap">
                              {(() => { try { const d = new Date(notification.createdAt); return isNaN(d.getTime()) ? 'just now' : formatDistanceToNow(d, { addSuffix: true }); } catch { return 'just now'; } })()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
