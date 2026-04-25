'use client';

/**
 * NAS Health Component
 *
 * NAS health monitoring dashboard with online/offline status, live user count,
 * last seen, latency, health log history, and "Check Now" button.
 *
 * Data source: /api/wifi/radius?action=nas-health-current, nas-health-list, nas-health-check, nas-health-stats
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Router,
  Loader2,
  RefreshCw,
  Activity,
  Users,
  Clock,
  Wifi,
  WifiOff,
  Signal,
  CheckCircle,
  XCircle,
  Eye,
  Heart,
  Server,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface NasHealthEntry {
  id: string;
  nasIp: string;
  nasIdentifier?: string;
  status: 'online' | 'offline' | 'degraded';
  liveUserCount: number;
  lastSeenAt: string;
  latency?: number;
  totalSessions: number;
  failedAuths: number;
  uptime?: number;
  softwareVersion?: string;
}

interface NasHealthStats {
  totalNas: number;
  onlineCount: number;
  offlineCount: number;
  totalLiveUsers: number;
  avgLatency: number;
}

// ─── Component ──────────────────────────────────────────────────────────────────

export default function NasHealth() {
  const { toast } = useToast();
  const [nasEntries, setNasEntries] = useState<NasHealthEntry[]>([]);
  const [stats, setStats] = useState<NasHealthStats>({
    totalNas: 0,
    onlineCount: 0,
    offlineCount: 0,
    totalLiveUsers: 0,
    avgLatency: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [checkingAll, setCheckingAll] = useState(false);

  // ─── Fetch ──────────────────────────────────────────────────────────────────

  const fetchHealth = useCallback(async () => {
    setIsLoading(true);
    try {
      const [currentRes, statsRes] = await Promise.all([
        fetch('/api/wifi/radius?action=nas-health-current'),
        fetch('/api/wifi/radius?action=nas-health-stats'),
      ]);
      const currentData = await currentRes.json();
      const statsData = await statsRes.json();

      if (currentData.success && currentData.data) {
        setNasEntries(Array.isArray(currentData.data) ? currentData.data : []);
      } else {
        setNasEntries([]);
      }

      if (statsData.success && statsData.data) {
        setStats(statsData.data);
      }
    } catch (error) {
      console.error('Failed to fetch NAS health:', error);
      setNasEntries([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    // Auto-refresh every 30s
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  // ─── Check Single NAS ──────────────────────────────────────────────────────

  const handleCheckNow = async (nas: NasHealthEntry) => {
    setCheckingId(nas.id);
    try {
      const res = await fetch('/api/wifi/radius', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'nas-health-check', nasIp: nas.nasIp }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'Check Complete', description: `Health check for ${nas.nasIdentifier || nas.nasIp} completed` });
        fetchHealth();
      } else {
        toast({ title: 'Error', description: data.error || 'Health check failed', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Health check failed', variant: 'destructive' });
    } finally {
      setCheckingId(null);
    }
  };

  // ─── Check All NAS ─────────────────────────────────────────────────────────

  const handleCheckAll = async () => {
    setCheckingAll(true);
    try {
      const res = await fetch('/api/wifi/radius', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'nas-health-check', all: true }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'All NAS Checked', description: 'Health check completed for all NAS devices' });
        fetchHealth();
      } else {
        toast({ title: 'Error', description: data.error || 'Health check failed', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Health check failed', variant: 'destructive' });
    } finally {
      setCheckingAll(false);
    }
  };

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const getStatusIndicator = (status: string) => {
    if (status === 'online') {
      return (
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
          </span>
          <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 text-xs">
            <Wifi className="h-3 w-3 mr-1" />
            Online
          </Badge>
        </div>
      );
    }
    if (status === 'degraded') {
      return (
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
          </span>
          <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-0 text-xs">
            Degraded
          </Badge>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2">
        <span className="relative flex h-3 w-3">
          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
        </span>
        <Badge className="bg-red-500 hover:bg-red-600 text-white border-0 text-xs">
          <WifiOff className="h-3 w-3 mr-1" />
          Offline
        </Badge>
      </div>
    );
  };

  const getLatencyBadge = (latency?: number) => {
    if (latency == null) return <span className="text-sm text-muted-foreground">—</span>;
    if (latency < 50) {
      return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 text-xs">{latency}ms</Badge>;
    }
    if (latency < 200) {
      return <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-0 text-xs">{latency}ms</Badge>;
    }
    return <Badge className="bg-red-500 hover:bg-red-600 text-white border-0 text-xs">{latency}ms</Badge>;
  };

  const formatUptime = (seconds?: number) => {
    if (!seconds || seconds <= 0) return '—';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    if (days > 0) return `${days}d ${hours}h`;
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Server className="h-5 w-5" />
            NAS Health Monitor
          </h2>
          <p className="text-sm text-muted-foreground">
            Real-time health monitoring for all NAS devices. Auto-refreshes every 30s.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchHealth}>
            <RefreshCw className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
            Refresh
          </Button>
          <Button size="sm" onClick={handleCheckAll} disabled={checkingAll}>
            {checkingAll ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Heart className="h-4 w-4 mr-2" />
            )}
            Check All
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-5">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <Server className="h-4 w-4 text-cyan-500 dark:text-cyan-400" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums">{stats.totalNas}</div>
              <div className="text-xs text-muted-foreground">Total NAS</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <Wifi className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{stats.onlineCount}</div>
              <div className="text-xs text-muted-foreground">Online</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-red-500/10">
              <WifiOff className="h-4 w-4 text-red-500 dark:text-red-400" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums text-red-600 dark:text-red-400">{stats.offlineCount}</div>
              <div className="text-xs text-muted-foreground">Offline</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <Users className="h-4 w-4 text-violet-500 dark:text-violet-400" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums">{stats.totalLiveUsers}</div>
              <div className="text-xs text-muted-foreground">Live Users</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Signal className="h-4 w-4 text-amber-500 dark:text-amber-400" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums">{stats.avgLatency}ms</div>
              <div className="text-xs text-muted-foreground">Avg Latency</div>
            </div>
          </div>
        </Card>
      </div>

      {/* NAS Status Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {nasEntries.map((nas) => (
          <Card key={nas.id} className={cn(
            nas.status === 'online' && 'border-emerald-200 dark:border-emerald-800',
            nas.status === 'offline' && 'border-red-200 dark:border-red-800',
            nas.status === 'degraded' && 'border-amber-200 dark:border-amber-800',
          )}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    'p-2 rounded-lg',
                    nas.status === 'online' && 'bg-emerald-500/10',
                    nas.status === 'offline' && 'bg-red-500/10',
                    nas.status === 'degraded' && 'bg-amber-500/10',
                  )}>
                    <Router className={cn(
                      'h-5 w-5',
                      nas.status === 'online' && 'text-emerald-500 dark:text-emerald-400',
                      nas.status === 'offline' && 'text-red-500 dark:text-red-400',
                      nas.status === 'degraded' && 'text-amber-500 dark:text-amber-400',
                    )} />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{nas.nasIdentifier || 'NAS'}</p>
                    <p className="text-xs font-mono text-muted-foreground">{nas.nasIp}</p>
                  </div>
                </div>
                {getStatusIndicator(nas.status)}
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-muted-foreground">Live Users</p>
                  <p className="font-medium text-sm tabular-nums">{nas.liveUserCount}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Latency</p>
                  <div className="mt-0.5">{getLatencyBadge(nas.latency)}</div>
                </div>
                <div>
                  <p className="text-muted-foreground">Last Seen</p>
                  <p className="font-medium text-sm">
                    {nas.lastSeenAt ? formatDistanceToNow(new Date(nas.lastSeenAt)) + ' ago' : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Uptime</p>
                  <p className="font-medium text-sm">{formatUptime(nas.uptime)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total Sessions</p>
                  <p className="font-medium text-sm tabular-nums">{nas.totalSessions}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Failed Auths</p>
                  <p className={cn(
                    'font-medium text-sm tabular-nums',
                    nas.failedAuths > 10 && 'text-red-600 dark:text-red-400',
                  )}>
                    {nas.failedAuths}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCheckNow(nas)}
                  disabled={checkingId === nas.id}
                >
                  {checkingId === nas.id ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Heart className="h-4 w-4 mr-2" />
                  )}
                  Check Now
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Health Log Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : nasEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted/50 p-4 mb-3">
                <Server className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <h3 className="text-sm font-medium text-muted-foreground">No NAS devices found</h3>
              <p className="text-xs text-muted-foreground/60 mt-1">
                NAS health entries will appear when NAS clients are configured
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>NAS</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Live Users</TableHead>
                    <TableHead>Latency</TableHead>
                    <TableHead>Last Seen</TableHead>
                    <TableHead>Uptime</TableHead>
                    <TableHead>Sessions</TableHead>
                    <TableHead>Failed Auths</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {nasEntries.map((nas) => (
                    <TableRow key={nas.id} className={cn(
                      nas.status === 'online' && 'bg-emerald-50/30 dark:bg-emerald-950/10',
                      nas.status === 'offline' && 'bg-red-50/30 dark:bg-red-950/10',
                    )}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Router className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium text-sm">{nas.nasIdentifier || 'NAS'}</p>
                            <p className="text-xs font-mono text-muted-foreground">{nas.nasIp}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusIndicator(nas.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm font-medium tabular-nums">{nas.liveUserCount}</span>
                        </div>
                      </TableCell>
                      <TableCell>{getLatencyBadge(nas.latency)}</TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {nas.lastSeenAt ? formatDistanceToNow(new Date(nas.lastSeenAt)) + ' ago' : '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{formatUptime(nas.uptime)}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm tabular-nums">{nas.totalSessions}</span>
                      </TableCell>
                      <TableCell>
                        <span className={cn(
                          'text-sm tabular-nums',
                          nas.failedAuths > 10 && 'text-red-600 dark:text-red-400 font-medium',
                        )}>
                          {nas.failedAuths}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">{nas.softwareVersion || '—'}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCheckNow(nas)}
                          disabled={checkingId === nas.id}
                        >
                          {checkingId === nas.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Heart className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
