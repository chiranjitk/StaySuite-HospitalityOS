'use client';

import React, { lazy, useState, useEffect, useCallback, Suspense } from 'react';
import { Wifi, Users, UserPlus, Ticket, BarChart3, Gauge, RefreshCw, QrCode, Server, ShieldCheck, ShieldAlert, Fingerprint, Activity, History, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// ─── Lazy imports for tab content ─────────────────────────────────────────
// Keep 10 essential tabs — removed: Bandwidth Scheduler, Content Filter, Smart Bandwidth,
// NAS Health, Provisioning Logs, CoA Audit (duplicates or low-usage)

const LiveSessions = lazy(() => import('@/components/wifi/live-sessions'));
const AuthLogsTab = lazy(() => import('@/components/wifi/auth-logs'));
const RadiusUsersTab = lazy(() => import('@/components/wifi/radius-users-tab'));
const SessionHistory = lazy(() => import('@/components/wifi/session-history'));
const UserUsageDashboard = lazy(() => import('@/components/wifi/user-usage-dashboard'));
const WifiPlans = lazy(() => import('@/components/wifi/plans'));
const WifiVouchers = lazy(() => import('@/components/wifi/vouchers'));
const MacAuthTab = lazy(() => import('@/components/wifi/mac-auth'));
const WifiFupPolicy = lazy(() => import('@/components/wifi/fup-policy'));
const EventWifiTab = lazy(() => import('@/components/wifi/event-wifi'));

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function TabSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-muted rounded" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-40 bg-muted/50 rounded-xl border border-border/50" />
        ))}
      </div>
      <div className="h-64 bg-muted/50 rounded-xl border border-border/50" />
    </div>
  );
}

// ─── RADIUS Server Status Card ──────────────────────────────────────────────

function RADIUSStatusCard() {
  const [radiusStatus, setRadiusStatus] = useState<{
    connected: boolean;
    usersSynced: number;
    lastSync: string | null;
    authPort: number;
  }>({ connected: false, usersSynced: 0, lastSync: null, authPort: 1812 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch('/api/wifi/radius?action=status');
        const data = await res.json();
        if (data.success && data.data) {
          setRadiusStatus({
            connected: data.data.installed && data.data.running,
            usersSynced: data.data.userCount || 0,
            lastSync: new Date().toISOString(),
            authPort: 1812,
          });
        } else {
          setRadiusStatus(prev => ({ ...prev, connected: false }));
        }
      } catch {
        setRadiusStatus(prev => ({ ...prev, connected: false }));
      } finally {
        setIsLoading(false);
      }
    };
    checkStatus();
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Card className="border-0 shadow-sm rounded-xl hover:shadow-md transition-all duration-200">
      <CardContent className="p-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Server className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            <span className="text-sm font-semibold">RADIUS Server</span>
            <span className="text-xs text-muted-foreground tabular-nums">{radiusStatus.usersSynced} users · Port {radiusStatus.authPort}</span>
          </div>
          <Badge
            variant="outline"
            className={cn(
              'text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0',
              isLoading
                ? 'border-muted-foreground/30 text-muted-foreground'
                : radiusStatus.connected
                  ? 'border-emerald-300 text-emerald-700 bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:bg-emerald-950/30'
                  : 'border-red-300 text-red-700 bg-red-50 dark:border-red-700 dark:text-red-400 dark:bg-red-950/30'
            )}
          >
            {isLoading ? (
              <span className="flex items-center gap-1">
                <RefreshCw className="h-2.5 w-2.5 animate-spin" />
                Checking
              </span>
            ) : radiusStatus.connected ? (
              <span className="flex items-center gap-1">
                <ShieldCheck className="h-2.5 w-2.5" />
                Connected
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <ShieldAlert className="h-2.5 w-2.5" />
                Offline
              </span>
            )}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── WiFi Quick Actions ──────────────────────────────────────────────────────

function WiFiQuickActions({ onRefresh, onSwitchToVouchers }: { onRefresh: () => void; onSwitchToVouchers: () => void }) {
  const { toast } = useToast();
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSyncUsers = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/wifi/radius', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync-users' }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'Sync Complete', description: data.message || 'WiFi users synced successfully' });
      } else {
        toast({ title: 'Sync Failed', description: data.error || 'Failed to sync users', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Sync Failed', description: 'Could not connect to sync service', variant: 'destructive' });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <Button
        variant="outline"
        size="sm"
        className="rounded-lg text-xs"
        onClick={handleSyncUsers}
        disabled={isSyncing}
      >
        <Wifi className="h-3.5 w-3.5 mr-1.5" />
        {isSyncing ? 'Syncing...' : 'Sync Users'}
      </Button>
      <Button variant="outline" size="sm" className="rounded-lg text-xs" onClick={onRefresh}>
        <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
        Refresh Status
      </Button>
      <Button variant="outline" size="sm" className="rounded-lg text-xs" onClick={onSwitchToVouchers}>
        <QrCode className="h-3.5 w-3.5 mr-1.5" />
        Generate Voucher
      </Button>
    </div>
  );
}

// ─── Tab Config ──────────────────────────────────────────────────────────────
// 16 tabs → 10 tabs (37% reduction)
// Removed duplicates: Bandwidth Scheduler (Firewall), Content Filter (Network),
//   NAS Health (Gateway/RADIUS), Provisioning Logs (Gateway/RADIUS), CoA Audit (Reports)
// Removed low-usage: Smart Bandwidth (feature-incomplete)
// Ordered by frequency: Live → Access → History → Policy

type TabId = 'live-sessions' | 'users' | 'auth-logs' | 'session-history' | 'user-usage' | 'plans' | 'vouchers' | 'mac-auth' | 'fup-policy' | 'event-wifi';

type TabItem = {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  group: string;
};

type GroupHeader = {
  type: 'header';
  label: string;
  indicatorColor?: string;
};

type TabEntry = TabItem | GroupHeader;

const tabs: TabEntry[] = [
  // ── Live ──
  { type: 'header', label: 'Live', indicatorColor: 'bg-emerald-500' },
  { type: 'tab', id: 'live-sessions', label: 'Active Users', icon: <Activity className="h-4 w-4" />, group: 'live' },
  { type: 'tab', id: 'users', label: 'Users', icon: <UserPlus className="h-4 w-4" />, group: 'live' },
  { type: 'tab', id: 'auth-logs', label: 'Auth Logs', icon: <ShieldCheck className="h-4 w-4" />, group: 'live' },

  // ── History ──
  { type: 'header', label: 'History', indicatorColor: 'bg-blue-500' },
  { type: 'tab', id: 'session-history', label: 'Session History', icon: <History className="h-4 w-4" />, group: 'history' },
  { type: 'tab', id: 'user-usage', label: 'User Usage', icon: <TrendingUp className="h-4 w-4" />, group: 'history' },

  // ── Policy ──
  { type: 'header', label: 'Policy', indicatorColor: 'bg-amber-500' },
  { type: 'tab', id: 'plans', label: 'Plans', icon: <BarChart3 className="h-4 w-4" />, group: 'policy' },
  { type: 'tab', id: 'fup-policy', label: 'FUP Policy', icon: <Gauge className="h-4 w-4" />, group: 'policy' },

  // ── Access ──
  { type: 'header', label: 'Access', indicatorColor: 'bg-purple-500' },
  { type: 'tab', id: 'vouchers', label: 'Vouchers', icon: <Ticket className="h-4 w-4" />, group: 'access' },
  { type: 'tab', id: 'mac-auth', label: 'MAC Auth', icon: <Fingerprint className="h-4 w-4" />, group: 'access' },
  { type: 'tab', id: 'event-wifi', label: 'Event WiFi', icon: <Users className="h-4 w-4" />, group: 'access' },
];

// ─── Main Component ─────────────────────────────────────────────────────────

export function WifiAccessPage() {
  const [activeTab, setActiveTab] = useState<TabId>('live-sessions');
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  const handleSwitchToVouchers = useCallback(() => {
    setActiveTab('vouchers');
  }, []);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Wifi className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            WiFi Access
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage active sessions, vouchers, bandwidth plans, and usage logs
          </p>
        </div>
      </div>

      {/* RADIUS Server Status */}
      <RADIUSStatusCard />

      {/* Quick Actions */}
      <WiFiQuickActions onRefresh={handleRefresh} onSwitchToVouchers={handleSwitchToVouchers} />

      {/* Tab Switcher */}
      <div className="relative">
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-thin items-center">
          {tabs.map((entry, index) => {
            if (entry.type === 'header') {
              return (
                <React.Fragment key={`header-${index}`}>
                  {index > 0 && (
                    <div className="w-px h-5 bg-border/60 mx-1.5 shrink-0" />
                  )}
                  <div className="flex items-center gap-1.5 px-2 py-1 shrink-0 select-none">
                    {entry.indicatorColor && (
                      <span className={cn('w-1.5 h-1.5 rounded-full', entry.indicatorColor)} />
                    )}
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                      {entry.label}
                    </span>
                  </div>
                  {index < tabs.length - 1 && (
                    <div className="w-px h-5 bg-border/60 mx-1.5 shrink-0" />
                  )}
                </React.Fragment>
              );
            }

            const tab = entry;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200',
                  activeTab === tab.id
                    ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/25'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="mt-2" key={refreshKey}>
        <Suspense fallback={<TabSkeleton />}>
          {/* Live */}
          {activeTab === 'live-sessions' && <LiveSessions />}
          {activeTab === 'users' && <RadiusUsersTab />}
          {activeTab === 'auth-logs' && <AuthLogsTab />}

          {/* History */}
          {activeTab === 'session-history' && <SessionHistory />}
          {activeTab === 'user-usage' && <UserUsageDashboard />}

          {/* Policy */}
          {activeTab === 'plans' && <WifiPlans />}
          {activeTab === 'fup-policy' && <WifiFupPolicy />}

          {/* Access */}
          {activeTab === 'vouchers' && <WifiVouchers />}
          {activeTab === 'mac-auth' && <MacAuthTab />}
          {activeTab === 'event-wifi' && <EventWifiTab />}
        </Suspense>
      </div>
    </div>
  );
}

export default WifiAccessPage;
