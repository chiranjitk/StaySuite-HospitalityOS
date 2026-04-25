'use client';

/**
 * WiFi Sessions Component
 *
 * Displays live RADIUS accounting sessions from freeradius-service.
 * When a guest logs in via captive portal (MikroTik, built-in gateway, etc.),
 * the NAS sends RADIUS accounting packets → FreeRADIUS logs them in radacct detail files
 * → freeradius-service parses them → this component displays them.
 *
 * Data source: /api/wifi/radius?action=active-sessions (freeradius-service:3010)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { ScrollArea } from '@/components/ui/scroll-area';
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
  Radio,
  UserCircle,
  CircleDot,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface RadiusSession {
  username: string;
  nasIp: string;
  clientMac: string;
  apMac: string;
  ipAddress: string;
  sessionId: string;
  sessionTime: number;
  inputOctets: number;
  outputOctets: number;
  status: 'active' | 'ended' | 'stale';
  startedAt: string;
  lastSeenAt: string;
  terminateCause?: string;
}

interface SessionSummary {
  activeSessions: number;
  staleSessions: number;
  count: number;
  totalInputBytes: number;
  totalOutputBytes: number;
  totalSessionTime: number;
}

// ─── Status Options ─────────────────────────────────────────────────────────────

const statusOptions = [
  { value: 'active', label: 'Active Now', color: 'bg-emerald-500' },
  { value: 'stale', label: 'Idle (No Update)', color: 'bg-amber-500' },
  { value: 'all', label: 'All Sessions', color: '' },
  { value: 'ended', label: 'Ended', color: 'bg-gray-500' },
];

// ─── Component ──────────────────────────────────────────────────────────────────

export default function WifiSessions() {
  const { toast } = useToast();
  const [sessions, setSessions] = useState<RadiusSession[]>([]);
  const [summary, setSummary] = useState<SessionSummary>({
    activeSessions: 0,
    staleSessions: 0,
    count: 0,
    totalInputBytes: 0,
    totalOutputBytes: 0,
    totalSessionTime: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dataSource, setDataSource] = useState<'radius' | 'internal'>('radius');
  const [accountingStatus, setAccountingStatus] = useState<{
    accountingEnabled: boolean;
    activePath: string | null;
    totalDetailFiles: number;
    nasDirectories: string[];
  } | null>(null);

  // ─── Fetch Sessions ──────────────────────────────────────────────────────────

  const fetchSessions = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      // Always request active+stale from backend; 'all' adds ended too
      if (statusFilter === 'all') {
        params.append('status', 'all');
      } else if (statusFilter === 'active') {
        params.append('status', 'active');
      } else if (statusFilter === 'stale') {
        params.append('status', 'stale');
      } else if (statusFilter === 'ended') {
        params.append('status', 'ended');
      }
      if (searchQuery) params.append('username', searchQuery);

      // Fetch accounting sessions and accounting status in parallel
      const [sessionRes, statusRes] = await Promise.all([
        fetch(`/api/wifi/radius?action=accounting&${params.toString()}`),
        fetch('/api/wifi/radius?action=accounting-status'),
      ]);
      const result = await sessionRes.json();
      const statusResult = await statusRes.json();

      // Store accounting diagnostic status
      if (statusResult.success && statusResult.data) {
        setAccountingStatus({
          accountingEnabled: statusResult.data.accountingEnabled,
          activePath: statusResult.data.activePath,
          totalDetailFiles: statusResult.data.totalDetailFiles,
          nasDirectories: statusResult.data.nasDirectories || [],
        });
      }

      if (result.success && result.data) {
        setSessions(result.data);
        setSummary({
          activeSessions: result.data.filter((s: RadiusSession) => s.status === 'active').length,
          staleSessions: result.data.filter((s: RadiusSession) => s.status === 'stale').length,
          count: result.total || result.data.length,
          totalInputBytes: result.summary?.totalInputBytes || 0,
          totalOutputBytes: result.summary?.totalOutputBytes || 0,
          totalSessionTime: result.summary?.totalSessionTime || 0,
        });
        setDataSource('radius');
      } else {
        setSessions([]);
        setDataSource('radius');
      }
    } catch (error) {
      console.error('Error fetching RADIUS sessions:', error);
      setSessions([]);
      setDataSource('radius');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, searchQuery]);

  // ─── Force Refresh (invalidate cache) ──────────────────────────────────────

  const handleForceRefresh = async () => {
    setIsLoading(true);
    try {
      // Call accounting-refresh to force re-read of radacct detail files
      await fetch('/api/wifi/radius', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accounting-refresh' }),
      });
      // After refresh, re-fetch sessions
      await fetchSessions();
      toast({ title: 'Refreshed', description: 'RADIUS accounting data reloaded from detail files' });
    } catch {
      fetchSessions();
    }
  };

  // ─── Auto-refresh + WebSocket for real-time updates ────────────────────────────

  useEffect(() => {
    fetchSessions();
    // Auto-refresh every 30 seconds for live view
    const interval = setInterval(fetchSessions, 30000);

    // Try WebSocket connection for real-time RADIUS session updates
    let socketCleanup: (() => void) | null = null;

    import('socket.io-client').then(({ io }) => {
      const socket = io('/?XTransformPort=3003', {
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 3000,
      });

      socket.on('radius:session', (event: { event: string }) => {
        if (['session-start', 'session-stop', 'session-update', 'coa-action'].includes(event.event)) {
          fetchSessions();
        }
      });

      socket.on('radius:active-count', () => {
        fetchSessions();
      });

      socketCleanup = () => {
        socket.disconnect();
      };
    }).catch(() => {
      // WebSocket not available — polling fallback is fine
    });

    return () => {
      clearInterval(interval);
      if (socketCleanup) socketCleanup();
    };
  }, [fetchSessions]);

  // ─── Helpers ──────────────────────────────────────────────────────────────────

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
    if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`;
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes} B`;
  };

  const getTotalData = (session: RadiusSession): number => {
    return (session.inputOctets || 0) + (session.outputOctets || 0);
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
    if (status === 'stale') {
      return (
        <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-0">
          <Clock className="h-3 w-3 mr-1" />
          Idle
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="text-muted-foreground">
        Ended
      </Badge>
    );
  };

  const filteredSessions = sessions.filter(s => {
    // Client-side status filter (backend also filters, this is for safety)
    if (statusFilter === 'active' && s.status !== 'active') return false;
    if (statusFilter === 'stale' && s.status !== 'stale') return false;
    if (statusFilter === 'ended' && s.status !== 'ended') return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        s.username.toLowerCase().includes(q) ||
        s.clientMac.toLowerCase().includes(q) ||
        s.ipAddress.toLowerCase().includes(q) ||
        s.nasIp.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const activeCount = filteredSessions.filter(s => s.status === 'active').length;
  const staleCount = filteredSessions.filter(s => s.status === 'stale').length;
  const totalDownload = filteredSessions.reduce((sum, s) => sum + (s.inputOctets || 0), 0);
  const totalUpload = filteredSessions.reduce((sum, s) => sum + (s.outputOctets || 0), 0);

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Wifi className="h-5 w-5" />
            RADIUS Sessions
          </h2>
          <p className="text-sm text-muted-foreground">
            Live WiFi sessions from RADIUS accounting (MikroTik, built-in gateway, etc.)
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleForceRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Force Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-5">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <CircleDot className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{activeCount}</div>
              <div className="text-xs text-muted-foreground">Active Now</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Clock className="h-4 w-4 text-amber-500 dark:text-amber-400" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">{staleCount}</div>
              <div className="text-xs text-muted-foreground">Idle</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <ArrowDownToLine className="h-4 w-4 text-violet-500 dark:text-violet-400" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums">{formatBytes(totalDownload)}</div>
              <div className="text-xs text-muted-foreground">Download</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-sky-500/10">
              <ArrowUpFromLine className="h-4 w-4 text-sky-500 dark:text-sky-400" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums">{formatBytes(totalUpload)}</div>
              <div className="text-xs text-muted-foreground">Upload</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <Monitor className="h-4 w-4 text-cyan-500 dark:text-cyan-400" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums">{summary.activeSessions + (summary.staleSessions || 0)}</div>
              <div className="text-xs text-muted-foreground">Connected</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by username, MAC, IP, or NAS..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map(status => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Sessions Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <div className="rounded-full bg-muted/50 p-4 mb-3">
                <Radio className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <h3 className="text-sm font-medium text-muted-foreground">No RADIUS sessions found</h3>
              {searchQuery || (statusFilter !== 'all' && statusFilter !== 'active') ? (
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Try clearing filters or search terms
                </p>
              ) : statusFilter === 'active' && !searchQuery ? (
                <p className="text-xs text-muted-foreground/60 mt-1">
                  No currently active sessions. Sessions appear here when guests connect via captive portal.
                </p>
              ) : accountingStatus && !accountingStatus.accountingEnabled ? (
                <div className="mt-3 max-w-md">
                  <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-left">
                    <p className="text-xs font-medium text-amber-800 dark:text-amber-200 flex items-center gap-1.5">
                      <Wifi className="h-3.5 w-3.5" />
                      RADIUS Accounting Not Active
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5">
                      Sessions appear here when your NAS device (MikroTik, router, AP) sends RADIUS accounting
                      packets to FreeRADIUS. Currently no accounting data has been received.
                    </p>
                    <div className="mt-2 text-xs text-amber-700 dark:text-amber-300 space-y-1">
                      <p className="font-medium">Required on NAS device:</p>
                      <ul className="list-disc list-inside space-y-0.5 ml-1">
                        <li>Configure RADIUS Accounting server IP (your StaySuite server)</li>
                        <li>Set Accounting port to <span className="font-mono">1813</span></li>
                        <li>Use the same shared secret as the NAS client</li>
                        <li>Enable &quot;Send Accounting&quot; or &quot;Interim-Update&quot; in captive portal settings</li>
                      </ul>
                    </div>
                    {accountingStatus.activePath && (
                      <p className="text-xs text-muted-foreground mt-2 font-mono">
                        radacct path: {accountingStatus.activePath}
                        {accountingStatus.totalDetailFiles > 0 && ` (${accountingStatus.totalDetailFiles} detail files found)`}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Sessions will appear when users authenticate via RADIUS (MikroTik portal, captive portal, etc.)
                </p>
              )}
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Client MAC</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead>NAS (Gateway)</TableHead>
                    <TableHead>AP MAC</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Last Seen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSessions.map((session, index) => (
                    <TableRow key={`${session.sessionId}-${index}`} className={cn(
                      session.status === 'active' && 'bg-emerald-50/50 dark:bg-emerald-950/10',
                      session.status === 'stale' && 'bg-amber-50/30 dark:bg-amber-950/10'
                    )}>
                      <TableCell>
                        {getStatusBadge(session.status)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <UserCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div>
                            <p className="font-medium text-sm">{session.username}</p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {session.sessionId.substring(0, 12)}...
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="font-mono text-sm">{session.clientMac || '—'}</p>
                      </TableCell>
                      <TableCell>
                        <p className="font-mono text-sm">{session.ipAddress || '—'}</p>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Router className="h-3.5 w-3.5 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">{session.nasIp}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="font-mono text-xs text-muted-foreground">{session.apMac || '—'}</p>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <p className="text-sm">{formatDuration(session.sessionTime)}</p>
                        </div>
                        {(session.status === 'active' || session.status === 'stale') && session.startedAt && (
                          <p className="text-xs text-muted-foreground">
                            Started {formatDistanceToNow(new Date(session.startedAt))} ago
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="flex items-center gap-1 text-xs">
                            <ArrowDownToLine className="h-3 w-3 text-emerald-500 dark:text-emerald-400" />
                            <span>{formatBytes(session.inputOctets || 0)}</span>
                          </div>
                          <div className="flex items-center gap-1 text-xs">
                            <ArrowUpFromLine className="h-3 w-3 text-amber-500 dark:text-amber-400" />
                            <span>{formatBytes(session.outputOctets || 0)}</span>
                          </div>
                          <p className="text-xs font-medium text-muted-foreground mt-0.5">
                            Total: {formatBytes(getTotalData(session))}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <p className="text-xs text-muted-foreground">
                          {session.lastSeenAt
                            ? formatDistanceToNow(new Date(session.lastSeenAt)) + ' ago'
                            : '—'}
                        </p>
                        {session.terminateCause && session.status === 'ended' && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {session.terminateCause}
                          </p>
                        )}
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
