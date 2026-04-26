'use client';

/**
 * Live Sessions Component
 *
 * Real-time active sessions dashboard.
 * Mobile: card-based layout with prominent disconnect buttons.
 * Desktop: table view with inline actions.
 * Supports search/filter, session details, CoA disconnect, stats cards, auto-refresh.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Wifi,
  Search,
  Loader2,
  Monitor,
  Clock,
  ArrowDownToLine,
  ArrowUpFromLine,
  RefreshCw,
  Router,
  UserCircle,
  CircleDot,
  Zap,
  Unplug,
  Smartphone,
  XCircle,
  Eye,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface LiveSession {
  id: string;
  username: string;
  ipAddress: string;
  macAddress: string;
  nasIp: string;
  nasIdentifier?: string;
  deviceType?: string;
  operatingSystem?: string;
  manufacturer?: string;
  bandwidthDown?: string;
  bandwidthUp?: string;
  sessionTime: number;
  dataDownload: number;
  dataUpload: number;
  status: 'active' | 'idle' | 'disconnecting';
  startedAt?: string;
  lastSeenAt?: string;
  sessionTimeout?: number;
  idleTimeout?: number;
  planName?: string;
  roomId?: string;
}

interface LiveSessionStats {
  totalActive: number;
  peakToday: number;
  peakTodayTime?: string;
  perNas: { nasIp: string; nasIdentifier?: string; count: number }[];
  totalDownload: number;
  totalUpload: number;
}

// ─── Component ──────────────────────────────────────────────────────────────────

export default function LiveSessions() {
  const { toast } = useToast();
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [stats, setStats] = useState<LiveSessionStats>({
    totalActive: 0,
    peakToday: 0,
    perNas: [],
    totalDownload: 0,
    totalUpload: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [nasFilter, setNasFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedSession, setSelectedSession] = useState<LiveSession | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [disconnectTarget, setDisconnectTarget] = useState<LiveSession | null>(null);

  // ─── Debounce search query (300ms) ───────────────────────────────────────

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ─── Fetch Sessions ──────────────────────────────────────────────────────────

  const fetchSessions = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearchQuery) params.append('username', debouncedSearchQuery);
      if (nasFilter !== 'all') params.append('nasIp', nasFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);

      const [sessionRes, statsRes] = await Promise.all([
        fetch(`/api/wifi/radius?action=live-sessions-list&${params.toString()}`),
        fetch('/api/wifi/radius?action=live-sessions-stats'),
      ]);
      const sessionData = await sessionRes.json();
      const statsData = await statsRes.json();

      if (sessionData.success && sessionData.data) {
        setSessions(Array.isArray(sessionData.data) ? sessionData.data : []);
      } else {
        setSessions([]);
      }

      if (statsData.success && statsData.data) {
        setStats(statsData.data);
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') return;
      console.error('Failed to fetch live sessions:', error);
      setSessions([]);
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearchQuery, nasFilter, statusFilter]);

  // ─── Auto-refresh every 10s ───────────────────────────────────────────────

  useEffect(() => {
    fetchSessions();
    if (!autoRefresh) return;
    const interval = setInterval(() => fetchSessions(), 10000);
    return () => {
      clearInterval(interval);
    };
  }, [fetchSessions, autoRefresh]);

  // ─── Disconnect ────────────────────────────────────────────────────────────

  const confirmDisconnect = (session: LiveSession) => {
    setDisconnectTarget(session);
  };

  const handleDisconnect = async () => {
    if (!disconnectTarget) return;
    const session = disconnectTarget;
    setDisconnectingId(session.id);
    setDisconnectTarget(null);

    // Extract acctSessionId from LiveSession id (format: "ls_<acctSessionId>")
    const acctSessionId = session.id.startsWith('ls_') ? session.id.slice(3) : session.id;

    try {
      const res = await fetch('/api/wifi/radius', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'live-sessions-disconnect',
          acctSessionId,
          username: session.username,
          nasIp: session.nasIp,
        }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.coa) {
          // RADIUS CoA succeeded — session terminated on NAS
          toast({ title: 'Disconnected', description: `${session.username} terminated via RADIUS CoA` });
        } else {
          // CoA unavailable (no radclient / NAS unreachable) — ended locally
          toast({
            title: 'Session Ended Locally',
            description: `RADIUS CoA unavailable. ${session.username} session ended in system. The NAS session may still be active.`,
          });
        }
        fetchSessions();
      } else {
        toast({
          title: 'Disconnect Failed',
          description: data.message || 'Could not reach RADIUS server. Session may still be active on the network device.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to disconnect session', variant: 'destructive' });
    } finally {
      setDisconnectingId(null);
    }
  };

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const formatDuration = (seconds: number): string => {
    if (!seconds || seconds <= 0) return '0s';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  };

  const formatBytes = (bytes: number): string => {
    if (!bytes || bytes <= 0) return '0 B';
    if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes} B`;
  };

  const getStatusBadge = (status: string) => {
    if (status === 'active') {
      return (
        <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0">
          <CircleDot className="h-3 w-3 mr-1" />
          Active
        </Badge>
      );
    }
    if (status === 'idle') {
      return (
        <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-0">
          <Clock className="h-3 w-3 mr-1" />
          Idle
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="text-muted-foreground">
        <XCircle className="h-3 w-3 mr-1" />
        Disconnecting
      </Badge>
    );
  };

  const getDeviceIcon = (deviceType?: string) => {
    if (deviceType === 'mobile' || deviceType === 'phone') return <Smartphone className="h-4 w-4" />;
    return <Monitor className="h-4 w-4" />;
  };

  // Unique NAS list for filter
  const nasList = Array.from(new Set(sessions.map(s => s.nasIp).filter(Boolean)));

  // ─── Mobile Card for each session ─────────────────────────────────────────

  const SessionCard = ({ session }: { session: LiveSession }) => (
    <Card className={cn(
      'border',
      session.status === 'active' && 'border-emerald-200 dark:border-emerald-800',
      session.status === 'idle' && 'border-amber-200 dark:border-amber-800'
    )}>
      <CardContent className="p-4 space-y-3">
        {/* Row 1: User info + Status */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <UserCircle className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">{session.username}</p>
              <p className="font-mono text-xs text-muted-foreground">{session.ipAddress || '—'}</p>
            </div>
          </div>
          {getStatusBadge(session.status)}
        </div>

        {/* Row 2: Key info grid */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <p className="text-muted-foreground mb-0.5">MAC</p>
            <p className="font-mono truncate">{session.macAddress || '—'}</p>
          </div>
          <div>
            <p className="text-muted-foreground mb-0.5">Device</p>
            <div className="flex items-center gap-1">
              {getDeviceIcon(session.deviceType)}
              <span className="truncate">{session.deviceType || '—'}</span>
            </div>
          </div>
          <div>
            <p className="text-muted-foreground mb-0.5">Session</p>
            <p className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDuration(session.sessionTime)}
            </p>
          </div>
        </div>

        {/* Row 3: Bandwidth + Data */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-md bg-muted/50 p-2">
            <p className="text-muted-foreground mb-1">Bandwidth</p>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400">
                <ArrowDownToLine className="h-3 w-3" />
                {session.bandwidthDown || '—'}
              </span>
              <span className="flex items-center gap-0.5 text-amber-600 dark:text-amber-400">
                <ArrowUpFromLine className="h-3 w-3" />
                {session.bandwidthUp || '—'}
              </span>
            </div>
          </div>
          <div className="rounded-md bg-muted/50 p-2">
            <p className="text-muted-foreground mb-1">Data Usage</p>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-0.5">
                <ArrowDownToLine className="h-3 w-3 text-emerald-500" />
                {formatBytes(session.dataDownload || 0)}
              </span>
              <span className="flex items-center gap-0.5">
                <ArrowUpFromLine className="h-3 w-3 text-amber-500" />
                {formatBytes(session.dataUpload || 0)}
              </span>
            </div>
          </div>
        </div>

        {/* Row 4: NAS info */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Router className="h-3 w-3" />
          <span>{session.nasIdentifier || session.nasIp}</span>
          {session.roomId && (
            <span className="ml-auto text-muted-foreground">Room {session.roomId}</span>
          )}
        </div>

        {/* Row 5: Action buttons */}
        <div className="flex gap-2 pt-1 border-t">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-9 text-xs"
            onClick={() => setSelectedSession(session)}
          >
            <Eye className="h-3.5 w-3.5 mr-1.5" />
            Details
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="flex-1 h-9 text-xs"
            onClick={() => confirmDisconnect(session)}
            disabled={disconnectingId === session.id}
          >
            {disconnectingId === session.id ? (
              <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Disconnecting...</>
            ) : (
              <><Unplug className="h-3.5 w-3.5 mr-1.5" />Disconnect</>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Wifi className="h-5 w-5" />
            Active Users
          </h2>
          <p className="text-sm text-muted-foreground">
            Real-time active session monitoring with CoA disconnect
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchSessions}>
            <RefreshCw className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <CircleDot className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                {stats.totalActive}
              </div>
              <div className="text-xs text-muted-foreground">Total Active</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Zap className="h-4 w-4 text-amber-500 dark:text-amber-400" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
                {stats.peakToday}
              </div>
              <div className="text-xs text-muted-foreground">Peak Today</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <ArrowDownToLine className="h-4 w-4 text-cyan-500 dark:text-cyan-400" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums">{formatBytes(stats.totalDownload)}</div>
              <div className="text-xs text-muted-foreground">Total Download</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-sky-500/10">
              <ArrowUpFromLine className="h-4 w-4 text-sky-500 dark:text-sky-400" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums">{formatBytes(stats.totalUpload)}</div>
              <div className="text-xs text-muted-foreground">Total Upload</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Per-NAS Breakdown */}
      {stats.perNas && stats.perNas.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Router className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">Per-NAS Breakdown</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {stats.perNas.map(nas => (
                <Badge key={nas.nasIp} variant="outline" className="text-xs gap-1">
                  <Router className="h-3 w-3" />
                  {nas.nasIdentifier || nas.nasIp}: {nas.count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by username..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={nasFilter} onValueChange={setNasFilter}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="All NAS" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All NAS</SelectItem>
                {nasList.map(nas => (
                  <SelectItem key={nas} value={nas}>{nas}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="idle">Idle</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
              <span className="text-xs text-muted-foreground">Auto (10s)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sessions List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center px-4">
          <div className="rounded-full bg-muted/50 p-4 mb-3">
            <Wifi className="h-8 w-8 text-muted-foreground/40" />
          </div>
          <h3 className="text-sm font-medium text-muted-foreground">No active sessions</h3>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Sessions will appear when users authenticate and go online
          </p>
        </div>
      ) : (
        <>
          {/* Mobile: Card Layout */}
          <div className="space-y-3 sm:hidden">
            {sessions.map((session) => (
              <SessionCard key={session.id} session={session} />
            ))}
          </div>

          {/* Desktop: Table Layout */}
          <div className="hidden sm:block">
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>User / IP</TableHead>
                        <TableHead>MAC</TableHead>
                        <TableHead>NAS</TableHead>
                        <TableHead>Device</TableHead>
                        <TableHead>BW Down / Up</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Data Down / Up</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sessions.map((session) => (
                        <TableRow key={session.id} className={cn(
                          session.status === 'active' && 'bg-emerald-50/50 dark:bg-emerald-950/10',
                          session.status === 'idle' && 'bg-amber-50/30 dark:bg-amber-950/10'
                        )}>
                          <TableCell>{getStatusBadge(session.status)}</TableCell>
                          <TableCell>
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5">
                                <UserCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                <p className="font-medium text-sm truncate max-w-[120px]" title={session.username}>
                                  {session.username}
                                </p>
                              </div>
                              <p className="font-mono text-xs text-muted-foreground pl-5">
                                {session.ipAddress || '—'}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="font-mono text-xs text-muted-foreground">{session.macAddress || '—'}</p>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <Router className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <div className="min-w-0">
                                <p className="text-xs font-medium truncate max-w-[105px]" title={session.nasIdentifier || session.nasIp}>
                                  {session.nasIdentifier || session.nasIp}
                                </p>
                                <p className="text-[10px] text-muted-foreground font-mono">{session.nasIp}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              {getDeviceIcon(session.deviceType)}
                              <span className="truncate max-w-[60px]">{session.deviceType || '—'}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs space-y-0.5">
                              <div className="flex items-center gap-1">
                                <ArrowDownToLine className="h-3 w-3 text-emerald-500" />
                                <span>{session.bandwidthDown || '—'}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <ArrowUpFromLine className="h-3 w-3 text-amber-500" />
                                <span>{session.bandwidthUp || '—'}</span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-xs">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              <span>{formatDuration(session.sessionTime)}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs space-y-0.5">
                              <div className="flex items-center gap-1">
                                <ArrowDownToLine className="h-3 w-3 text-emerald-500" />
                                <span>{formatBytes(session.dataDownload || 0)}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <ArrowUpFromLine className="h-3 w-3 text-amber-500" />
                                <span>{formatBytes(session.dataUpload || 0)}</span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs gap-1"
                                onClick={() => setSelectedSession(session)}
                              >
                                <Eye className="h-3.5 w-3.5" />
                                <span className="hidden lg:inline">Details</span>
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                className="h-8 text-xs gap-1"
                                onClick={() => confirmDisconnect(session)}
                                disabled={disconnectingId === session.id}
                              >
                                {disconnectingId === session.id ? (
                                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /></>
                                ) : (
                                  <><Unplug className="h-3.5 w-3.5" /><span className="hidden lg:inline">Disconnect</span></>
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Session Details Dialog */}
      <Dialog open={!!selectedSession} onOpenChange={(open) => { if (!open) setSelectedSession(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Session Details</DialogTitle>
            <DialogDescription>Detailed information for user session</DialogDescription>
          </DialogHeader>
          {selectedSession && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Username</p>
                  <p className="text-sm font-medium">{selectedSession.username}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <div className="mt-1">{getStatusBadge(selectedSession.status)}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">IP Address</p>
                  <p className="text-sm font-mono">{selectedSession.ipAddress || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">MAC Address</p>
                  <p className="text-sm font-mono">{selectedSession.macAddress || '—'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Device</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {getDeviceIcon(selectedSession.deviceType)}
                    <span className="text-sm">{selectedSession.deviceType || 'Unknown'}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{selectedSession.operatingSystem || ''} {selectedSession.manufacturer || ''}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">NAS</p>
                  <p className="text-sm font-mono">{selectedSession.nasIp || '—'}</p>
                  <p className="text-xs text-muted-foreground">{selectedSession.nasIdentifier || ''}</p>
                </div>
              </div>
              <div className="border-t pt-4">
                <p className="text-xs font-medium text-muted-foreground mb-2">Bandwidth & Plan</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Download</p>
                    <p className="text-sm">{selectedSession.bandwidthDown || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Upload</p>
                    <p className="text-sm">{selectedSession.bandwidthUp || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Plan</p>
                    <p className="text-sm">{selectedSession.planName || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Room</p>
                    <p className="text-sm">{selectedSession.roomId || '—'}</p>
                  </div>
                </div>
              </div>
              <div className="border-t pt-4">
                <p className="text-xs font-medium text-muted-foreground mb-2">Session Info</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Session Time</p>
                    <p className="text-sm">{formatDuration(selectedSession.sessionTime)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Data Usage</p>
                    <p className="text-sm">
                      {formatBytes((selectedSession.dataDownload || 0) + (selectedSession.dataUpload || 0))}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Session Timeout</p>
                    <p className="text-sm">{selectedSession.sessionTimeout ? formatDuration(selectedSession.sessionTimeout) : '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Idle Timeout</p>
                    <p className="text-sm">{selectedSession.idleTimeout ? formatDuration(selectedSession.idleTimeout) : '—'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Disconnect Confirmation Dialog */}
      <Dialog open={!!disconnectTarget} onOpenChange={(open) => { if (!open) setDisconnectTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Unplug className="h-5 w-5 text-destructive" />
              Force Disconnect
            </DialogTitle>
            <DialogDescription>
              This will send a RADIUS Disconnect Message to terminate the user session immediately.
            </DialogDescription>
          </DialogHeader>
          {disconnectTarget && (
            <div className="py-4 space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                <UserCircle className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium text-sm">{disconnectTarget.username}</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {disconnectTarget.ipAddress || '—'} · {disconnectTarget.macAddress || '—'}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <p className="text-xs">
                  The user will lose internet access immediately. This action sends a real RADIUS Disconnect Message to the NAS device.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisconnectTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDisconnect} disabled={!!disconnectingId}>
              {disconnectingId ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Disconnecting...</>
              ) : (
                <><Unplug className="h-4 w-4 mr-2" />Disconnect Now</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
