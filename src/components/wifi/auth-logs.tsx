'use client';

/**
 * Auth Logs Component
 *
 * Real authentication log viewer for RADIUS auth events.
 * Shows timestamp, username, result, auth type, NAS IP, client MAC, reply message.
 * Auto-refreshes every 30s. Fetches from /api/wifi/radius?action=auth-logs
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
import {
  Shield,
  Search,
  Loader2,
  RefreshCw,
  CheckCircle,
  XCircle,
  TrendingUp,
  Activity,
  Clock,
  Filter,
  Monitor,
  Wifi,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface AuthLogEntry {
  id?: string;
  timestamp: string;
  username: string;
  authResult: string;
  authType: string;
  nasIpAddress?: string;
  callingStationId?: string;
  replyMessage?: string;
}

interface AuthLogStats {
  totalAuths: number;
  acceptCount: number;
  rejectCount: number;
  successRate: number;
  last24hTrend: number;
}

// ─── Component ──────────────────────────────────────────────────────────────────

export default function AuthLogs() {
  const { toast } = useToast();
  const [logs, setLogs] = useState<AuthLogEntry[]>([]);
  const [stats, setStats] = useState<AuthLogStats>({
    totalAuths: 0,
    acceptCount: 0,
    rejectCount: 0,
    successRate: 0,
    last24hTrend: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

  const [resultFilter, setResultFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // ─── Fetch Logs ────────────────────────────────────────────────────────────

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('limit', '100');
      if (resultFilter !== 'all') params.append('result', resultFilter);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (debouncedSearchQuery) {
        params.append('username', debouncedSearchQuery);
      }

      const statsParams = new URLSearchParams();
      if (debouncedSearchQuery) statsParams.append('username', debouncedSearchQuery);
      if (resultFilter !== 'all') statsParams.append('result', resultFilter);
      if (startDate) statsParams.append('startDate', startDate);
      if (endDate) statsParams.append('endDate', endDate);

      const [logsRes, statsRes] = await Promise.all([
        fetch(`/api/wifi/radius?action=auth-logs&${params.toString()}`),
        fetch(`/api/wifi/radius?action=auth-logs-stats&${statsParams.toString()}`),
      ]);
      const logsData = await logsRes.json();
      const statsData = await statsRes.json();

      if (logsData.success && logsData.data) {
        setLogs(Array.isArray(logsData.data) ? logsData.data : []);
      } else {
        setLogs([]);
      }

      if (statsData.success && statsData.data) {
        setStats(statsData.data);
      }
    } catch (error) {
      console.error('Failed to fetch auth logs:', error);
      setLogs([]);
    } finally {
      setIsLoading(false);
    }
  }, [resultFilter, startDate, endDate, debouncedSearchQuery]);

  // ─── Debounced search ──────────────────────────────────────────────────────

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
  };

  // ─── Auto-refresh every 30s ───────────────────────────────────────────────

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 30000);
    return () => clearInterval(interval);
  }, [fetchLogs]);

  // ─── Filtering (client-side for MAC search) ────────────────────────────────

  const filteredLogs = logs.filter(log => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const mac = log.callingStationId || '';
      const matchesMac = mac.toLowerCase().includes(q);
      // Username already filtered server-side, but MAC is filtered client-side
      if (!matchesMac && !log.username.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const getResultBadge = (authResult: string) => {
    const r = (authResult || '').toLowerCase();
    if (r === 'access-accept' || r === 'accept') {
      return (
        <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0">
          <CheckCircle className="h-3 w-3 mr-1" />
          Accept
        </Badge>
      );
    }
    return (
      <Badge className="bg-red-500 hover:bg-red-600 text-white border-0">
        <XCircle className="h-3 w-3 mr-1" />
        Reject
      </Badge>
    );
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Auth Logs
          </h2>
          <p className="text-sm text-muted-foreground">
            Real-time RADIUS authentication log viewer. Auto-refreshes every 30s.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchLogs}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <Activity className="h-4 w-4 text-cyan-500 dark:text-cyan-400" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums">{stats.totalAuths}</div>
              <div className="text-xs text-muted-foreground">Total Auths</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <CheckCircle className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{stats.acceptCount}</div>
              <div className="text-xs text-muted-foreground">Accepted</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-red-500/10">
              <XCircle className="h-4 w-4 text-red-500 dark:text-red-400" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums text-red-600 dark:text-red-400">{stats.rejectCount}</div>
              <div className="text-xs text-muted-foreground">Rejected</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-teal-500/10">
              <TrendingUp className="h-4 w-4 text-teal-500 dark:text-teal-400" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums text-teal-600 dark:text-teal-400">{stats.successRate}%</div>
              <div className="text-xs text-muted-foreground">Success Rate</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Clock className="h-4 w-4 text-amber-500 dark:text-amber-400" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
                {stats.last24hTrend > 0 ? '+' : ''}{stats.last24hTrend}
              </div>
              <div className="text-xs text-muted-foreground">Last 24h</div>
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
                  placeholder="Search by username or MAC..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={resultFilter} onValueChange={setResultFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Result" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Results</SelectItem>
                <SelectItem value="Access-Accept">Accept</SelectItem>
                <SelectItem value="Access-Reject">Reject</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full sm:w-auto"
                placeholder="From"
              />
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full sm:w-auto"
                placeholder="To"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted/50 p-4 mb-3">
                <Shield className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <h3 className="text-sm font-medium text-muted-foreground">No auth logs found</h3>
              <p className="text-xs text-muted-foreground/60 mt-1">
                {searchQuery || resultFilter !== 'all' || startDate || endDate
                  ? 'Try clearing filters or search terms'
                  : 'Auth logs will appear when users authenticate via RADIUS'}
              </p>
            </div>
          ) : (
            <div className="max-h-[500px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead className="text-left">Reply Message</TableHead>
                    <TableHead>Auth Type</TableHead>
                    <TableHead>NAS IP</TableHead>
                    <TableHead>Client MAC</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log, index) => (
                    <TableRow key={log.id || index} className={
                      log.authResult === 'Access-Reject' ? 'bg-red-50/30 dark:bg-red-950/10' : ''
                    }>
                      <TableCell>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{log.timestamp ? formatDistanceToNow(new Date(log.timestamp)) + ' ago' : '—'}</span>
                        </div>
                        <p className="text-xs text-muted-foreground/60 mt-0.5">
                          {log.timestamp ? new Date(log.timestamp).toLocaleString() : ''}
                        </p>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Wifi className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <p className="font-medium text-sm">{log.username}</p>
                        </div>
                      </TableCell>
                      <TableCell>{getResultBadge(log.authResult)}</TableCell>
                      <TableCell className="text-left">
                        <p className="text-xs text-muted-foreground max-w-[280px] truncate cursor-default" title={log.replyMessage || undefined}>
                          {log.replyMessage || '—'}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{log.authType || 'PAP'}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
                          <p className="text-sm font-mono text-xs">{log.nasIpAddress || '—'}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm font-mono text-xs">{log.callingStationId || '—'}</p>
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
