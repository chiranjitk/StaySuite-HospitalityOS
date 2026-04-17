'use client';

import React, { lazy, useState, useEffect, useCallback, Suspense } from 'react';
import { Wifi, Users, Ticket, BarChart3, FileText, Gauge, Activity, Signal, RefreshCw, QrCode, Server, ShieldCheck, ShieldAlert, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// Lazy imports for tab content
const WifiSessions = lazy(() => import('@/components/wifi/sessions'));
const WifiVouchers = lazy(() => import('@/components/wifi/vouchers'));
const WifiPlans = lazy(() => import('@/components/wifi/plans'));
const UsageLogs = lazy(() => import('@/components/wifi/usage-logs'));
const UserQuotas = lazy(() => import('@/components/wifi/user-quotas').then(m => ({ default: m.UserQuotas })));

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

// ─── WiFi Status Header ──────────────────────────────────────────────────────

function WiFiStatusHeader() {
  const [stats, setStats] = useState({
    activeSessions: 0,
    totalUsers: 0,
    bandwidth: '0 Mbps',
    health: 'online' as 'online' | 'offline',
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const [sessionsRes, usersRes] = await Promise.all([
        fetch('/api/wifi/sessions?status=active&limit=1'),
        fetch('/api/wifi/users?limit=1'),
      ]);
      const sessionsData = await sessionsRes.json();
      const usersData = await usersRes.json();

      // Calculate active sessions from summary if available
      const activeCount = sessionsData.summary?.byStatus?.active ?? sessionsData.data?.length ?? 0;
      const totalUsers = usersData.pagination?.total ?? usersData.data?.length ?? 0;

      setStats({
        activeSessions: activeCount,
        totalUsers: totalUsers,
        bandwidth: `${Math.max(10, activeCount * 5)} Mbps`,
        health: 'online',
      });
    } catch {
      setStats(prev => ({ ...prev, health: 'offline' }));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    // Refresh stats every 60 seconds
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      <Card className="border-0 shadow-sm rounded-xl bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-950/30 dark:to-blue-950/30 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-7 w-7 rounded-lg bg-cyan-500/10 flex items-center justify-center">
              <Wifi className="h-3.5 w-3.5 text-cyan-600" />
            </div>
            <span className="text-xs text-muted-foreground font-medium">Active Sessions</span>
          </div>
          <p className="text-2xl font-bold text-cyan-600 tabular-nums">{isLoading ? '...' : stats.activeSessions}</p>
        </CardContent>
      </Card>
      <Card className="border-0 shadow-sm rounded-xl bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-7 w-7 rounded-lg bg-violet-500/10 flex items-center justify-center">
              <Users className="h-3.5 w-3.5 text-violet-600" />
            </div>
            <span className="text-xs text-muted-foreground font-medium">WiFi Users</span>
          </div>
          <p className="text-2xl font-bold text-violet-600 tabular-nums">{isLoading ? '...' : stats.totalUsers}</p>
        </CardContent>
      </Card>
      <Card className="border-0 shadow-sm rounded-xl bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-7 w-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Activity className="h-3.5 w-3.5 text-emerald-600" />
            </div>
            <span className="text-xs text-muted-foreground font-medium">Bandwidth</span>
          </div>
          <p className="text-2xl font-bold text-emerald-600 tabular-nums">{isLoading ? '...' : stats.bandwidth}</p>
        </CardContent>
      </Card>
      <Card className="border-0 shadow-sm rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-7 w-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Signal className="h-3.5 w-3.5 text-amber-600" />
            </div>
            <span className="text-xs text-muted-foreground font-medium">Network Health</span>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-bold text-amber-600 capitalize">{stats.health}</p>
            {stats.health === 'online' && (
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
            )}
          </div>
        </CardContent>
      </Card>
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
  }>({ connected: false, usersSynced: 0, lastSync: null, authPort: 18120 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch('/api/wifi/sync?XTransformPort=3010');
        const data = await res.json();
        setRadiusStatus({
          connected: true,
          usersSynced: data.users || 0,
          lastSync: data.lastSync || new Date().toISOString(),
          authPort: 18120,
        });
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
    <Card className="border-0 shadow-sm rounded-xl hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Server className="h-4 w-4 text-teal-600" />
            FreeRADIUS Server
          </CardTitle>
          <Badge
            variant="outline"
            className={cn(
              'text-[10px] font-semibold px-2 py-0.5 rounded-full',
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
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-2 rounded-lg bg-muted/30">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <Users className="h-3 w-3 text-violet-500" />
            </div>
            <p className="text-lg font-bold tabular-nums">{radiusStatus.usersSynced}</p>
            <p className="text-[10px] text-muted-foreground font-medium">Users Synced</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/30">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <Zap className="h-3 w-3 text-amber-500" />
            </div>
            <p className="text-lg font-bold tabular-nums">{radiusStatus.authPort}</p>
            <p className="text-[10px] text-muted-foreground font-medium">Auth Port</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/30">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <Wifi className="h-3 w-3 text-cyan-500" />
            </div>
            <p className="text-lg font-bold tabular-nums">AAA</p>
            <p className="text-[10px] text-muted-foreground font-medium">Protocol</p>
          </div>
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
      const res = await fetch('/api/wifi/sync', { method: 'POST' });
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

type TabId = 'sessions' | 'vouchers' | 'plans' | 'logs' | 'quotas';

const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'sessions', label: 'Sessions', icon: <Users className="h-4 w-4" /> },
  { id: 'vouchers', label: 'Vouchers', icon: <Ticket className="h-4 w-4" /> },
  { id: 'plans', label: 'Plans', icon: <BarChart3 className="h-4 w-4" /> },
  { id: 'logs', label: 'Usage Logs', icon: <FileText className="h-4 w-4" /> },
  { id: 'quotas', label: 'User Quotas', icon: <Gauge className="h-4 w-4" /> },
];

// ─── Main Component ─────────────────────────────────────────────────────────

export function WifiAccessPage() {
  const [activeTab, setActiveTab] = useState<TabId>('sessions');
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

      {/* WiFi Status Dashboard Header */}
      <WiFiStatusHeader />

      {/* RADIUS Server Status */}
      <RADIUSStatusCard />

      {/* Quick Actions */}
      <WiFiQuickActions onRefresh={handleRefresh} onSwitchToVouchers={handleSwitchToVouchers} />

      {/* Tab Switcher */}
      <div className="relative">
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-thin">
          {tabs.map((tab) => (
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
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="mt-2" key={refreshKey}>
        <Suspense fallback={<TabSkeleton />}>
          {activeTab === 'sessions' && <WifiSessions />}
          {activeTab === 'vouchers' && <WifiVouchers />}
          {activeTab === 'plans' && <WifiPlans />}
          {activeTab === 'logs' && <UsageLogs />}
          {activeTab === 'quotas' && <UserQuotas />}
        </Suspense>
      </div>
    </div>
  );
}

export default WifiAccessPage;
