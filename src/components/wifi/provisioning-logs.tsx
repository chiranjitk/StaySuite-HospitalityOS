'use client';

/**
 * Provisioning Logs Component
 *
 * Displays RADIUS provisioning log history — sync, guest-wifi-link,
 * guest-wifi-unlink, and other provisioning actions. Auto-refreshes every 60s.
 * Fetches from /api/wifi/radius?action=provisioning-logs
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  FileText,
  CheckCircle,
  XCircle,
  RefreshCw,
  Loader2,
  Search,
  Clock,
  Activity,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface ProvisioningLogEntry {
  id: string;
  propertyId?: string;
  action: string;
  username?: string;
  result: string;
  details?: string;
  durationMs?: number;
  timestamp: string;
}

interface ProvisioningLogStats {
  successCount: number;
  failCount: number;
  total: number;
  lastLog: ProvisioningLogEntry | null;
  actions: { action: string; cnt: number }[];
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const PAGE_LIMIT = 50;

const ACTION_OPTIONS = [
  { value: 'all', label: 'All Actions' },
  { value: 'create', label: 'Create / Provision' },
  { value: 'update', label: 'Update / Sync' },
  { value: 'delete', label: 'Delete / Deprovision' },
];

const AUTO_REFRESH_MS = 60_000;

// ─── Helpers ────────────────────────────────────────────────────────────────────

function formatActionLabel(action: string): string {
  const map: Record<string, string> = {
    'sync-users': 'Sync Users',
    'sync': 'Sync',
    'guest-wifi-link': 'Guest WiFi Link',
    'guest-wifi-unlink': 'Guest WiFi Unlink',
    provision: 'Provision',
    deprovision: 'Deprovision',
    'batch-sync': 'Batch Sync',
    'password-reset': 'Password Reset',
  };
  return map[action] || action;
}

function getActionBadgeVariant(action: string): 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'destructive' {
  if (action.includes('unlink') || action.includes('deprovision')) return 'destructive';
  if (action.includes('link') || action.includes('provision')) return 'success';
  if (action.includes('reset')) return 'warning';
  return 'secondary';
}

function formatDuration(ms: number | undefined): string {
  if (ms === undefined || ms === null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function truncateText(text: string | undefined, maxLen: number): string {
  if (!text) return '—';
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '…';
}

// ─── Component ──────────────────────────────────────────────────────────────────

export default function ProvisioningLogs() {
  const { toast } = useToast();

  // Data state
  const [logs, setLogs] = useState<ProvisioningLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<ProvisioningLogStats>({
    successCount: 0,
    failCount: 0,
    total: 0,
    lastLog: null,
    actions: [],
  });

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [resultFilter, setResultFilter] = useState('all');
  const [offset, setOffset] = useState(0);

  // Refs
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const autoRefreshRef = useRef<ReturnType<typeof setInterval>>();

  // ─── Fetch Stats ────────────────────────────────────────────────────────────

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/wifi/radius?action=provisioning-logs-stats');
      const data = await res.json();
      if (data.success && data.data) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch provisioning log stats:', error);
    }
  }, []);

  // ─── Fetch Logs ─────────────────────────────────────────────────────────────

  const fetchLogs = useCallback(
    async (showRefreshSpinner = false) => {
      if (showRefreshSpinner) setIsRefreshing(true);
      else setIsLoading(true);

      try {
        const params = new URLSearchParams();
        params.append('action', 'provisioning-logs');
        if (searchQuery.trim()) params.append('username', searchQuery.trim());
        if (actionFilter !== 'all') params.append('filterAction', actionFilter);
        if (resultFilter !== 'all') params.append('result', resultFilter);
        params.append('limit', String(PAGE_LIMIT));
        params.append('offset', String(offset));

        const res = await fetch(`/api/wifi/radius?${params.toString()}`);
        const data = await res.json();

        if (data.success && data.data) {
          setLogs(Array.isArray(data.data) ? data.data : []);
          setTotal(data.total ?? 0);
        } else {
          setLogs([]);
          setTotal(0);
        }
      } catch (error) {
        console.error('Failed to fetch provisioning logs:', error);
        toast({
          title: 'Error',
          description: 'Failed to load provisioning logs. Please try again.',
          variant: 'destructive',
        });
        setLogs([]);
        setTotal(0);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [searchQuery, actionFilter, resultFilter, offset, toast],
  );

  // ─── Debounced search ──────────────────────────────────────────────────────

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setOffset(0); // reset to first page on search change
    }, 400);
  };

  // ─── Filter change handlers ────────────────────────────────────────────────

  const handleActionFilterChange = (value: string) => {
    setActionFilter(value);
    setOffset(0);
  };

  const handleResultFilterChange = (value: string) => {
    setResultFilter(value);
    setOffset(0);
  };

  // ─── Pagination ────────────────────────────────────────────────────────────

  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));
  const currentPage = Math.floor(offset / PAGE_LIMIT) + 1;

  const goToPreviousPage = () => {
    if (offset > 0) {
      setOffset((prev) => Math.max(0, prev - PAGE_LIMIT));
    }
  };

  const goToNextPage = () => {
    if (offset + PAGE_LIMIT < total) {
      setOffset((prev) => prev + PAGE_LIMIT);
    }
  };

  // ─── Initial load + auto-refresh ───────────────────────────────────────────

  useEffect(() => {
    fetchLogs();
    fetchStats();

    autoRefreshRef.current = setInterval(() => {
      fetchLogs();
      fetchStats();
    }, AUTO_REFRESH_MS);

    return () => {
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Re-fetch when filters/offset change (after initial mount)
  useEffect(() => {
    fetchLogs(true);
    fetchStats();
  }, [searchQuery, actionFilter, resultFilter, offset]);

  // ─── Manual refresh ────────────────────────────────────────────────────────

  const handleManualRefresh = () => {
    fetchLogs(true);
    fetchStats();
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  const hasNextPage = offset + PAGE_LIMIT < total;
  const hasPreviousPage = offset > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Provisioning Logs
          </h2>
          <p className="text-sm text-muted-foreground">
            History of WiFi user provisioning actions. Auto-refreshes every 60s.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleManualRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Logs */}
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <Activity className="h-4 w-4 text-cyan-500 dark:text-cyan-400" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums">{stats.total}</div>
              <div className="text-xs text-muted-foreground">Total Logs</div>
            </div>
          </div>
        </Card>

        {/* Success Count */}
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <CheckCircle className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                {stats.successCount}
              </div>
              <div className="text-xs text-muted-foreground">Successful</div>
            </div>
          </div>
        </Card>

        {/* Failed Count */}
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/10">
              <XCircle className="h-4 w-4 text-red-500 dark:text-red-400" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums text-red-600 dark:text-red-400">
                {stats.failCount}
              </div>
              <div className="text-xs text-muted-foreground">Failed</div>
            </div>
          </div>
        </Card>

        {/* Last Action Time */}
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Clock className="h-4 w-4 text-amber-500 dark:text-amber-400" />
            </div>
            <div className="min-w-0">
              {stats.lastLog?.timestamp ? (
                <>
                  <div className="text-sm font-bold truncate tabular-nums">
                    {formatDistanceToNow(new Date(stats.lastLog.timestamp), { addSuffix: true })}
                  </div>
                  <div className="text-xs text-muted-foreground">Last Action</div>
                </>
              ) : (
                <>
                  <div className="text-sm font-bold text-muted-foreground">N/A</div>
                  <div className="text-xs text-muted-foreground">Last Action</div>
                </>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Username Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by username..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Action Filter */}
            <Select value={actionFilter} onValueChange={handleActionFilterChange}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Action Type" />
              </SelectTrigger>
              <SelectContent>
                {ACTION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Result Filter */}
            <Select value={resultFilter} onValueChange={handleResultFilterChange}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Result" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Results</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <div className="rounded-full bg-muted/50 p-4 mb-3">
                <FileText className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <h3 className="text-sm font-medium text-muted-foreground">
                No provisioning logs found
              </h3>
              <p className="text-xs text-muted-foreground/60 mt-1">
                {searchQuery || actionFilter !== 'all' || resultFilter !== 'all'
                  ? 'Try clearing filters or search terms'
                  : 'Provisioning logs will appear when sync or provisioning actions are performed'}
              </p>
            </div>
          ) : (
            <>
              <div className="max-h-[600px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[160px] sm:w-[180px]">Timestamp</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Username</TableHead>
                      <TableHead>Result</TableHead>
                      <TableHead className="hidden md:table-cell">Details</TableHead>
                      <TableHead className="text-right w-[90px]">Duration</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow
                        key={log.id}
                        className={
                          log.result === 'failed'
                            ? 'bg-red-50/30 dark:bg-red-950/10'
                            : ''
                        }
                      >
                        {/* Timestamp */}
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3 shrink-0" />
                            <span>
                              {log.timestamp
                                ? formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })
                                : '—'}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground/60 mt-0.5 pl-[18px]">
                            {log.timestamp
                              ? new Date(log.timestamp).toLocaleString()
                              : ''}
                          </p>
                        </TableCell>

                        {/* Action */}
                        <TableCell>
                          <Badge variant={getActionBadgeVariant(log.action)}>
                            {formatActionLabel(log.action)}
                          </Badge>
                        </TableCell>

                        {/* Username */}
                        <TableCell>
                          <span className="text-sm font-medium">
                            {log.username || '—'}
                          </span>
                        </TableCell>

                        {/* Result */}
                        <TableCell>
                          {log.result === 'success' ? (
                            <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Success
                            </Badge>
                          ) : (
                            <Badge className="bg-red-500 hover:bg-red-600 text-white border-0">
                              <XCircle className="h-3 w-3 mr-1" />
                              Failed
                            </Badge>
                          )}
                        </TableCell>

                        {/* Details (hidden on mobile) */}
                        <TableCell className="hidden md:table-cell">
                          <p
                            className="text-xs text-muted-foreground max-w-[260px] truncate"
                            title={log.details || undefined}
                          >
                            {truncateText(log.details, 50)}
                          </p>
                        </TableCell>

                        {/* Duration */}
                        <TableCell className="text-right">
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {formatDuration(log.durationMs)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20">
                <p className="text-xs text-muted-foreground">
                  Showing {offset + 1}–{Math.min(offset + PAGE_LIMIT, total)} of{' '}
                  <span className="font-medium text-foreground">{total}</span> entries
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goToPreviousPage}
                    disabled={!hasPreviousPage}
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span className="hidden sm:inline ml-1">Prev</span>
                  </Button>
                  <span className="text-xs text-muted-foreground px-2 tabular-nums">
                    {currentPage} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goToNextPage}
                    disabled={!hasNextPage}
                    aria-label="Next page"
                  >
                    <span className="hidden sm:inline mr-1">Next</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
