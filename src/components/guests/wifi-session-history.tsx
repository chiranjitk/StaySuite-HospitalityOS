'use client';

/**
 * WiFi Session History — Per-guest WiFi usage history tab on Guest Profile.
 *
 * Fetches data from the FreeRADIUS service via the Next.js proxy:
 *   - Guest ↔ WiFi link (to resolve username)
 *   - Accounting sessions (radacct)
 *   - Auth logs (authentication attempts)
 *   - Live sessions (currently active)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Wifi,
  Activity,
  Database,
  Clock,
  Shield,
  RefreshCw,
  Loader2,
  ArrowDownToLine,
  ArrowUpFromLine,
  MonitorSmartphone,
  AlertCircle,
} from 'lucide-react';
import { useTimezone } from '@/contexts/TimezoneContext';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow, format } from 'date-fns';
import { Button } from '@/components/ui/button';

// ─── Types ──────────────────────────────────────────────────────────────────

interface GuestWifiHistoryProps {
  guestId: string;
}

interface WifiLink {
  id: string;
  username: string;
  password?: string;
  status?: string;
  guestId?: string;
  hasActiveSession?: boolean;
  linkedAt?: string;
}

interface AccountingSession {
  username: string;
  nasIp?: string;
  clientMac?: string;
  ipAddress?: string;
  sessionId?: string;
  sessionTime?: number;
  inputOctets?: number;
  outputOctets?: number;
  status: 'active' | 'ended' | 'stale';
  startedAt?: string;
  lastSeenAt?: string;
  terminateCause?: string;
}

interface AuthLog {
  id: string;
  username: string;
  authResult: string;
  replyMessage?: string;
  nasIpAddress?: string;
  timestamp: string;
}

interface LiveSession {
  id: string;
  username: string;
  nasIpAddress?: string;
  macAddress?: string;
  framedIpAddress?: string;
  deviceType?: string;
  operatingSystem?: string;
  manufacturer?: string;
  bandwidthDown?: number;
  bandwidthUp?: number;
  inputOctets?: number;
  outputOctets?: number;
  sessionDuration?: number;
  startedAt?: string;
  lastSeenAt?: string;
  status?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatBytes(octets: number): string {
  if (!octets || octets <= 0) return '0 B';
  const gb = octets / (1024 * 1024 * 1024);
  const mb = octets / (1024 * 1024);
  const kb = octets / 1024;
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  if (kb >= 1) return `${kb.toFixed(0)} KB`;
  return `${octets} B`;
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0s';
  const days = Math.floor(seconds / 86400);
  const hrs = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (days > 0) return `${days}d ${hrs}h`;
  if (hrs > 0) return `${hrs}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

function formatBandwidth(bps?: number): string {
  if (!bps || bps <= 0) return '—';
  const mbps = bps / 1_000_000;
  if (mbps >= 1) return `${mbps.toFixed(0)} Mbps`;
  return `${(bps / 1000).toFixed(0)} Kbps`;
}

function parseTimestamp(ts: string): Date {
  if (!ts) return new Date(0);
  return new Date(ts);
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function WifiSessionHistory({ guestId }: GuestWifiHistoryProps) {
  const { formatDate } = useTimezone();
  const { toast } = useToast();

  // Data state
  const [wifiLink, setWifiLink] = useState<WifiLink | null>(null);
  const [accounting, setAccounting] = useState<AccountingSession[]>([]);
  const [authLogs, setAuthLogs] = useState<AuthLog[]>([]);
  const [liveSessions, setLiveSessions] = useState<LiveSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Computed stats
  const totalSessions = accounting.length;
  const activeSessionsCount = liveSessions.length;
  const totalInputOctets = accounting.reduce((s, a) => s + (a.inputOctets || 0), 0) + liveSessions.reduce((s, l) => s + (l.inputOctets || 0), 0);
  const totalOutputOctets = accounting.reduce((s, a) => s + (a.outputOctets || 0), 0) + liveSessions.reduce((s, l) => s + (l.outputOctets || 0), 0);
  const totalDataBytes = totalInputOctets + totalOutputOctets;
  const totalSessionSeconds = accounting.reduce((s, a) => s + (a.sessionTime || 0), 0) + liveSessions.reduce((s, l) => s + (l.sessionDuration || 0), 0);

  // ─── Fetch Data ────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // 1. Resolve WiFi username from guest link
      const linkRes = await fetch(`/api/wifi/radius?action=guest-wifi-link&guestId=${encodeURIComponent(guestId)}`);
      const linkData = await linkRes.json();

      let username = '';
      if (linkData.success && linkData.data) {
        setWifiLink(linkData.data);
        username = linkData.data.username || '';
      }

      if (!username) {
        // No WiFi account linked — nothing to fetch
        setIsLoading(false);
        return;
      }

      // 2. Fetch accounting sessions in parallel
      const [acctRes, authRes, liveRes] = await Promise.allSettled([
        fetch(`/api/wifi/radius?action=accounting&username=${encodeURIComponent(username)}&limit=200`),
        fetch(`/api/wifi/radius?action=auth-logs&username=${encodeURIComponent(username)}&limit=100`),
        fetch(`/api/wifi/radius?action=live-sessions-get&username=${encodeURIComponent(username)}`),
      ]);

      // Parse accounting
      if (acctRes.status === 'fulfilled' && acctRes.value.ok) {
        const acctData = await acctRes.value.json();
        if (acctData.success && Array.isArray(acctData.data)) {
          setAccounting(acctData.data);
        }
      }

      // Parse auth logs
      if (authRes.status === 'fulfilled' && authRes.value.ok) {
        const authData = await authRes.value.json();
        if (authData.success && Array.isArray(authData.data)) {
          setAuthLogs(authData.data);
        }
      }

      // Parse live sessions — this endpoint may return a single object or an array
      if (liveRes.status === 'fulfilled' && liveRes.value.ok) {
        const liveData = await liveRes.value.json();
        if (liveData.success && liveData.data) {
          setLiveSessions(Array.isArray(liveData.data) ? liveData.data : [liveData.data]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch WiFi session data:', err);
      setError('Failed to load WiFi session data. The RADIUS service may be unavailable.');
    } finally {
      setIsLoading(false);
    }
  }, [guestId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ─── Sub-components ────────────────────────────────────────────────────

  const statusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 text-xs gap-1"><span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span></span>Active</Badge>;
      case 'ended':
        return <Badge variant="secondary" className="text-xs">Ended</Badge>;
      case 'stale':
        return <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-0 text-xs">Stale</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{status}</Badge>;
    }
  };

  const authResultBadge = (result: string) => {
    const normalized = (result || '').toLowerCase();
    if (normalized.includes('accept')) {
      return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 text-xs">Accept</Badge>;
    }
    if (normalized.includes('reject')) {
      return <Badge className="bg-red-500 hover:bg-red-600 text-white border-0 text-xs">Reject</Badge>;
    }
    return <Badge variant="outline" className="text-xs">{result}</Badge>;
  };

  // ─── Loading State ─────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-muted rounded" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 bg-muted/50 rounded-xl border border-border/50" />
          ))}
        </div>
        <div className="h-64 bg-muted/50 rounded-xl border border-border/50" />
      </div>
    );
  }

  // ─── No WiFi Link ──────────────────────────────────────────────────────

  if (!wifiLink) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full bg-muted/50 p-4 mb-4">
          <Wifi className="h-10 w-10 text-muted-foreground/40" />
        </div>
        <h3 className="text-sm font-medium text-muted-foreground">No WiFi Account Linked</h3>
        <p className="text-xs text-muted-foreground/60 mt-1 max-w-sm">
          This guest does not have a WiFi account associated with their profile.
          WiFi accounts are created automatically on check-in or can be linked manually.
        </p>
      </div>
    );
  }

  // ─── Error State ───────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full bg-destructive/10 p-4 mb-4">
          <AlertCircle className="h-10 w-10 text-destructive/60" />
        </div>
        <h3 className="text-sm font-medium text-muted-foreground">{error}</h3>
        <Button variant="outline" size="sm" className="mt-4" onClick={fetchAll}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  // ─── Main Render ───────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Wifi className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            WiFi Sessions
          </h3>
          <p className="text-sm text-muted-foreground">
            Username: <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{wifiLink.username}</code>
            {wifiLink.password && (
              <>
                {' · '}Password: <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{wifiLink.password}</code>
              </>
            )}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchAll}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <Activity className="h-4 w-4 text-cyan-500 dark:text-cyan-400" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums">{totalSessions}</div>
              <div className="text-xs text-muted-foreground">Total Sessions</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <div className="relative">
                <Activity className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
                {activeSessionsCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </span>
                )}
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums">{activeSessionsCount}</div>
              <div className="text-xs text-muted-foreground">Active Now</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <Database className="h-4 w-4 text-violet-500 dark:text-violet-400" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums">{formatBytes(totalDataBytes)}</div>
              <div className="text-xs text-muted-foreground">Total Data Used</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Clock className="h-4 w-4 text-amber-500 dark:text-amber-400" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums">{formatDuration(totalSessionSeconds)}</div>
              <div className="text-xs text-muted-foreground">Total Time</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Active Sessions (if any) */}
      {activeSessionsCount > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              Currently Active Sessions
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-64 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Device</TableHead>
                    <TableHead>MAC Address</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead>NAS</TableHead>
                    <TableHead>Bandwidth</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Started</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {liveSessions.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <MonitorSmartphone className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div>
                            <p className="text-sm font-medium">
                              {[session.manufacturer, session.operatingSystem, session.deviceType].filter(Boolean).join(' · ') || 'Unknown Device'}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                          {session.macAddress || '—'}
                        </code>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs font-mono">{session.framedIpAddress || '—'}</code>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{session.nasIpAddress || '—'}</TableCell>
                      <TableCell className="text-xs">
                        {session.bandwidthDown || session.bandwidthUp ? (
                          <div className="flex items-center gap-1">
                            <ArrowDownToLine className="h-3 w-3 text-emerald-500" />
                            <span>{formatBandwidth(session.bandwidthDown)}</span>
                            <span className="text-muted-foreground mx-0.5">/</span>
                            <ArrowUpFromLine className="h-3 w-3 text-blue-500" />
                            <span>{formatBandwidth(session.bandwidthUp)}</span>
                          </div>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="text-xs font-medium">
                        {session.sessionDuration ? formatDuration(session.sessionDuration) : '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {session.startedAt ? formatDistanceToNow(parseTimestamp(session.startedAt), { addSuffix: true }) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Session History Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            Session History
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {accounting.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted/50 p-4 mb-3">
                <Clock className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <h4 className="text-sm font-medium text-muted-foreground">No session records found</h4>
              <p className="text-xs text-muted-foreground/60 mt-1">
                WiFi session data will appear here once the guest connects.
              </p>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>MAC Address</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead>NAS</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Last Seen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounting
                    .sort((a, b) => {
                      const dateA = parseTimestamp(a.startedAt || a.lastSeenAt || '');
                      const dateB = parseTimestamp(b.startedAt || b.lastSeenAt || '');
                      return dateB.getTime() - dateA.getTime();
                    })
                    .map((session, idx) => (
                      <TableRow key={session.sessionId || `session-${idx}`}>
                        <TableCell>{statusBadge(session.status)}</TableCell>
                        <TableCell>
                          <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                            {session.clientMac || '—'}
                          </code>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs font-mono">{session.ipAddress || '—'}</code>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{session.nasIp || '—'}</TableCell>
                        <TableCell className="text-xs font-medium">
                          {session.sessionTime ? formatDuration(session.sessionTime) : '—'}
                        </TableCell>
                        <TableCell className="text-xs">
                          <div className="flex items-center gap-1">
                            <ArrowDownToLine className="h-3 w-3 text-emerald-500 dark:text-emerald-400" />
                            <span>{formatBytes(session.inputOctets || 0)}</span>
                            <span className="text-muted-foreground mx-0.5">/</span>
                            <ArrowUpFromLine className="h-3 w-3 text-blue-500 dark:text-blue-400" />
                            <span>{formatBytes(session.outputOctets || 0)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {session.startedAt ? formatDistanceToNow(parseTimestamp(session.startedAt), { addSuffix: true }) : '—'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {session.lastSeenAt ? formatDistanceToNow(parseTimestamp(session.lastSeenAt), { addSuffix: true }) : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Auth Attempts */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            Authentication Attempts
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {authLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted/50 p-4 mb-3">
                <Shield className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <h4 className="text-sm font-medium text-muted-foreground">No authentication logs found</h4>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Auth attempts will appear here once the guest tries to connect.
              </p>
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead>NAS IP</TableHead>
                    <TableHead>Reply Message</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {authLogs
                    .sort((a, b) => {
                      const dateA = parseTimestamp(a.timestamp);
                      const dateB = parseTimestamp(b.timestamp);
                      return dateB.getTime() - dateA.getTime();
                    })
                    .map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs text-muted-foreground">
                          {log.timestamp
                            ? formatDistanceToNow(parseTimestamp(log.timestamp), { addSuffix: true })
                            : '—'}
                        </TableCell>
                        <TableCell>{authResultBadge(log.authResult)}</TableCell>
                        <TableCell>
                          <code className="text-xs font-mono">{log.nasIpAddress || '—'}</code>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                          {log.replyMessage || '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
