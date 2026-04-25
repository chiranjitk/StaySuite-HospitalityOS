'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, isToday, isYesterday, isBefore, subDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Bell,
  CalendarCheck,
  BedDouble,
  CheckCircle2,
  AlertTriangle,
  Wifi,
  PackageX,
  TrendingUp,
  Star,
  Tag,
  Trash2,
  CheckCheck,
  Filter,
  Inbox,
  Clock,
  X,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';

// ============================================
// Types
// ============================================

export interface NotificationItem {
  id: string;
  type: 'booking' | 'housekeeping' | 'system' | 'alerts' | 'billing' | 'maintenance' | 'inventory' | 'crm' | 'revenue';
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
  action?: {
    label: string;
    section: string;
  };
}

export interface NotificationGroup {
  label: string;
  notifications: NotificationItem[];
}

type FilterType = 'all' | 'booking' | 'housekeeping' | 'system' | 'alerts';

// ============================================
// Icon mapping
// ============================================

const typeIconMap: Record<string, React.ElementType> = {
  booking: CalendarCheck,
  housekeeping: BedDouble,
  system: Wifi,
  alerts: AlertTriangle,
  billing: CheckCircle2,
  maintenance: Sparkles,
  inventory: PackageX,
  crm: Star,
  revenue: TrendingUp,
  default: Bell,
};

const typeColorMap: Record<string, string> = {
  booking: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
  housekeeping: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  system: 'bg-slate-500/10 text-slate-600 dark:text-slate-400',
  alerts: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  billing: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  maintenance: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  inventory: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  crm: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  revenue: 'bg-pink-500/10 text-pink-600 dark:text-pink-400',
};

const filterTypeToApiTypes: Record<FilterType, string[]> = {
  all: [],
  booking: ['booking', 'billing'],
  housekeeping: ['housekeeping', 'maintenance'],
  system: ['system', 'inventory', 'revenue'],
  alerts: ['alerts', 'crm'],
};

// ============================================
// Format relative time
// ============================================

function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (isYesterday(date)) return 'Yesterday';
  if (diffHours < 48) return `${diffHours}h ago`;
  return format(date, 'MMM d');
}

// ============================================
// Group notifications by time period
// ============================================

function groupNotificationsByTime(notifications: NotificationItem[]): NotificationGroup[] {
  const groups: NotificationGroup[] = [];
  const justNow: NotificationItem[] = [];
  const today: NotificationItem[] = [];
  const yesterday: NotificationItem[] = [];
  const earlier: NotificationItem[] = [];

  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  for (const notif of notifications) {
    const date = new Date(notif.timestamp);
    if (date >= oneHourAgo) {
      justNow.push(notif);
    } else if (isToday(date)) {
      today.push(notif);
    } else if (isYesterday(date)) {
      yesterday.push(notif);
    } else {
      earlier.push(notif);
    }
  }

  if (justNow.length > 0) groups.push({ label: 'Just Now', notifications: justNow });
  if (today.length > 0) groups.push({ label: 'Today', notifications: today });
  if (yesterday.length > 0) groups.push({ label: 'Yesterday', notifications: yesterday });
  if (earlier.length > 0) groups.push({ label: 'Earlier', notifications: earlier });

  return groups;
}

// ============================================
// Skeleton loader
// ============================================

function NotificationSkeleton() {
  return (
    <div className="p-4 space-y-3">
      <div className="flex items-start gap-3">
        <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-full" />
        </div>
      </div>
    </div>
  );
}

// ============================================
// Empty state
// ============================================

function EmptyState({ hasFilter }: { hasFilter: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="mb-4"
      >
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
          <Inbox className="h-8 w-8 text-muted-foreground" />
        </div>
      </motion.div>
      <h3 className="text-sm font-semibold text-foreground mb-1">
        {hasFilter ? 'No matching notifications' : 'All caught up!'}
      </h3>
      <p className="text-xs text-muted-foreground max-w-[200px]">
        {hasFilter
          ? 'Try changing your filter to see more notifications.'
          : 'You have no notifications at the moment. We\'ll let you know when something arrives.'}
      </p>
    </div>
  );
}

// ============================================
// Single notification item
// ============================================

function NotificationItemRow({
  notification,
  onMarkRead,
  onDelete,
  onNavigate,
}: {
  notification: NotificationItem;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
  onNavigate: (section: string) => void;
}) {
  const Icon = typeIconMap[notification.type] || typeIconMap.default;
  const colorClasses = typeColorMap[notification.type] || typeColorMap.system;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20, height: 0 }}
      transition={{ duration: 0.2 }}
      className={`group relative px-4 py-3 transition-colors hover:bg-accent/50 cursor-pointer ${
        !notification.read ? 'bg-primary/[0.03]' : ''
      }`}
      onClick={() => {
        if (!notification.read) onMarkRead(notification.id);
        if (notification.action?.section) {
          onNavigate(notification.action.section);
        }
      }}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${colorClasses}`}>
          <Icon className="h-4 w-4" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {!notification.read && (
                  <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                )}
                <p className={`text-sm truncate ${!notification.read ? 'font-semibold text-foreground' : 'font-medium text-foreground/90'}`}>
                  {notification.title}
                </p>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                {notification.description}
              </p>
            </div>

            {/* Actions (visible on hover) */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              {!notification.read && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation();
                    onMarkRead(notification.id);
                  }}
                >
                  <CheckCheck className="h-3 w-3" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(notification.id);
                }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Timestamp */}
          <div className="flex items-center gap-1.5 mt-1.5">
            <Clock className="h-3 w-3 text-muted-foreground/60" />
            <span className="text-[11px] text-muted-foreground/70">
              {formatRelativeTime(notification.timestamp)}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================
// Badge count animation component
// ============================================

export function UnreadBadge({ count }: { count: number }) {
  return (
    <AnimatePresence mode="popLayout">
      {count > 0 && (
        <motion.span
          key={count}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground ring-2 ring-background"
        >
          {count > 99 ? '99+' : count}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

// ============================================
// Bell trigger button for header
// ============================================

export function NotificationBellButton() {
  const panelOpen = useNotificationCenterStore((s) => s.panelOpen);
  const setPanelOpen = useNotificationCenterStore((s) => s.setPanelOpen);
  const unreadCount = useNotificationCenterStore((s) => s.unreadCount);

  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative h-9 w-9"
      onClick={() => setPanelOpen(!panelOpen)}
      aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
    >
      <motion.div
        whileTap={{ scale: 0.9 }}
        transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      >
        <Bell className="h-[18px] w-[18px]" />
        <UnreadBadge count={unreadCount} />
      </motion.div>
    </Button>
  );
}

// ============================================
// Zustand store for notification center
// ============================================

import { create } from 'zustand';

interface NotificationCenterState {
  notifications: NotificationItem[];
  unreadCount: number;
  loading: boolean;
  filter: FilterType;
  panelOpen: boolean;

  setNotifications: (notifications: NotificationItem[]) => void;
  setUnreadCount: (count: number) => void;
  setLoading: (loading: boolean) => void;
  setFilter: (filter: FilterType) => void;
  setPanelOpen: (open: boolean) => void;
  markAsReadLocally: (id: string) => void;
  markAllAsReadLocally: () => void;
  removeNotificationLocally: (id: string) => void;
}

// Use a simple store name to avoid conflict with the main store
export const useNotificationCenterStore = create<NotificationCenterState>((set) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,
  filter: 'all',
  panelOpen: false,

  setNotifications: (notifications) =>
    set({
      notifications,
      unreadCount: notifications.filter((n) => !n.read).length,
    }),

  setUnreadCount: (count) => set({ unreadCount: count }),

  setLoading: (loading) => set({ loading }),

  setFilter: (filter) => set({ filter }),

  setPanelOpen: (panelOpen) => set({ panelOpen }),

  markAsReadLocally: (id) =>
    set((state) => {
      const notification = state.notifications.find((n) => n.id === id);
      if (!notification || notification.read) return state;
      return {
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, read: true } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      };
    }),

  markAllAsReadLocally: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    })),

  removeNotificationLocally: (id) =>
    set((state) => {
      const notification = state.notifications.find((n) => n.id === id);
      return {
        notifications: state.notifications.filter((n) => n.id !== id),
        unreadCount:
          notification && !notification.read
            ? Math.max(0, state.unreadCount - 1)
            : state.unreadCount,
      };
    }),
}));

// ============================================
// Main NotificationCenter component
// ============================================

export function NotificationCenter() {
  const {
    notifications,
    unreadCount,
    loading,
    filter,
    panelOpen,
    setNotifications,
    setLoading,
    setFilter,
    setPanelOpen,
    markAsReadLocally,
    markAllAsReadLocally,
    removeNotificationLocally,
  } = useNotificationCenterStore();

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch notifications
  const fetchNotifications = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '50');
      if (filter !== 'all') {
        const types = filterTypeToApiTypes[filter];
        types.forEach((t) => params.append('type', t));
      }
      const response = await fetch(`/api/notifications/list?${params.toString()}`);
      const data = await response.json();
      if (data.success) {
        setNotifications(data.data.notifications);
        // Use the server-provided unread count for accurate badge
        if (typeof data.data.unreadCount === 'number') {
          useNotificationCenterStore.getState().setUnreadCount(data.data.unreadCount);
        }
      }
    } catch {
      // Silently fail - the panel will show empty state
    } finally {
      setLoading(false);
    }
  }, [filter, setNotifications, setLoading]);

  // Initial fetch and polling
  useEffect(() => {
    fetchNotifications(true);

    // Poll every 30 seconds
    pollIntervalRef.current = setInterval(() => {
      fetchNotifications(false);
    }, 30000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [fetchNotifications]);

  // Re-fetch when filter changes
  useEffect(() => {
    fetchNotifications(true);
  }, [filter, fetchNotifications]);

  // Mark as read
  const handleMarkRead = async (id: string) => {
    markAsReadLocally(id);
    try {
      await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
    } catch {
      // Silent fail
    }
  };

  // Mark all as read
  const handleMarkAllRead = async () => {
    markAllAsReadLocally();
    try {
      await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true }),
      });
      toast.success('All notifications marked as read');
    } catch {
      toast.error('Failed to mark all as read');
    }
  };

  // Delete notification
  const handleDelete = async (id: string) => {
    removeNotificationLocally(id);
    try {
      await fetch('/api/notifications/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
    } catch {
      toast.error('Failed to delete notification');
    }
  };

  // Navigate to section (dispatch custom event for the app to pick up)
  const handleNavigate = useCallback((section: string) => {
    setPanelOpen(false);
    // Import dynamically to avoid circular deps
    import('@/store').then(({ useUIStore }) => {
      useUIStore.getState().setActiveSection(section);
    }).catch(() => {
      // Fallback: dispatch event
      window.dispatchEvent(new CustomEvent('navigate-section', { detail: section }));
    });
  }, [setPanelOpen]);

  // Filtered notifications
  const filteredNotifications = notifications;

  // Grouped notifications
  const grouped = groupNotificationsByTime(filteredNotifications);

  // Filter options
  const filterOptions: { value: FilterType; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'booking', label: 'Bookings' },
    { value: 'housekeeping', label: 'Housekeeping' },
    { value: 'system', label: 'System' },
    { value: 'alerts', label: 'Alerts' },
  ];

  return (
    <Sheet open={panelOpen} onOpenChange={setPanelOpen}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[420px] p-0 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <SheetHeader className="px-4 pt-5 pb-0 space-y-0 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <SheetTitle className="text-lg font-semibold">
                Notifications
              </SheetTitle>
              {unreadCount > 0 && (
                <Badge variant="secondary" className="text-xs font-semibold h-5 px-2 rounded-full">
                  {unreadCount} new
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1.5"
                  onClick={handleMarkAllRead}
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Mark all read
                </Button>
              )}
            </div>
          </div>
          <SheetDescription className="text-xs text-muted-foreground">
            Stay up to date with your hotel operations
          </SheetDescription>
        </SheetHeader>

        {/* Filter bar */}
        <div className="px-4 py-3 shrink-0 border-b">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
            <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            {filterOptions.map((option) => (
              <Button
                key={option.value}
                variant={filter === option.value ? 'default' : 'ghost'}
                size="sm"
                className={`h-7 px-3 text-xs rounded-full shrink-0 transition-colors ${
                  filter === option.value
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
                onClick={() => setFilter(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Notifications list */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            {loading && notifications.length === 0 ? (
              <div className="space-y-0">
                <NotificationSkeleton />
                <Separator />
                <NotificationSkeleton />
                <Separator />
                <NotificationSkeleton />
                <Separator />
                <NotificationSkeleton />
                <Separator />
                <NotificationSkeleton />
              </div>
            ) : grouped.length === 0 ? (
              <EmptyState hasFilter={filter !== 'all'} />
            ) : (
              <div>
                {grouped.map((group, groupIndex) => (
                  <div key={group.label}>
                    {groupIndex > 0 && <Separator />}
                    <div className="px-4 py-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                        {group.label}
                      </span>
                    </div>
                    <AnimatePresence mode="popLayout">
                      {group.notifications.map((notification, idx) => (
                        <div key={notification.id}>
                          {idx > 0 && <Separator />}
                          <NotificationItemRow
                            notification={notification}
                            onMarkRead={handleMarkRead}
                            onDelete={handleDelete}
                            onNavigate={handleNavigate}
                          />
                        </div>
                      ))}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="border-t px-4 py-3 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-muted-foreground hover:text-foreground"
              onClick={() => {
                setFilter('all');
                toast.info('Showing all notifications');
              }}
            >
              View all notifications
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// Default export
export default NotificationCenter;
