'use client';

/**
 * CoA Audit Component
 *
 * CoA (Change of Authorization) audit trail viewer.
 * Shows timestamp, username, CoA type, policy name, result, before/after counters.
 * Supports date range, username, CoA type, and result filters.
 * Expandable rows for full details (bandwidth percent, error message).
 *
 * Data source: /api/wifi/radius?action=coa-audit-list, coa-audit-stats
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  GitBranch,
  Search,
  Loader2,
  RefreshCw,
  CheckCircle,
  XCircle,
  TrendingUp,
  Activity,
  Clock,
  ChevronDown,
  ArrowDownToLine,
  ArrowUpFromLine,
  AlertTriangle,
  Filter,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface CoaAuditEntry {
  id: string;
  timestamp: string;
  username: string;
  coaType: string;
  policyName?: string;
  result: 'success' | 'failed';
  errorMessage?: string;
  bandwidthPercent?: number;
  beforeSessionTime?: number;
  afterSessionTime?: number;
  beforeDownload?: number;
  afterDownload?: number;
  beforeUpload?: number;
  afterUpload?: number;
  nasIp?: string;
  oldChangeId?: string;
  newChangeId?: string;
}

interface CoaAuditStats {
  totalToday: number;
  successCount: number;
  failedCount: number;
  successRate: number;
  byType: { type: string; count: number }[];
}

// ─── CoA Type Colors ────────────────────────────────────────────────────────────

const COA_TYPE_COLORS: Record<string, string> = {
  'bandwidth-change': 'bg-cyan-500',
  'policy-update': 'bg-violet-500',
  'session-disconnect': 'bg-red-500',
  'data-limit': 'bg-amber-500',
  'time-limit': 'bg-emerald-500',
  'fap-trigger': 'bg-orange-500',
};

// ─── Component ──────────────────────────────────────────────────────────────────

export default function CoaAudit() {
  const { toast } = useToast();
  const [entries, setEntries] = useState<CoaAuditEntry[]>([]);
  const [stats, setStats] = useState<CoaAuditStats>({
    totalToday: 0,
    successCount: 0,
    failedCount: 0,
    successRate: 0,
    byType: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [coaTypeFilter, setCoaTypeFilter] = useState<string>('all');
  const [resultFilter, setResultFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // ─── Fetch ──────────────────────────────────────────────────────────────────

  const fetchAudit = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('username', searchQuery);
      if (coaTypeFilter !== 'all') params.append('coaType', coaTypeFilter);
      if (resultFilter !== 'all') params.append('result', resultFilter);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const [listRes, statsRes] = await Promise.all([
        fetch(`/api/wifi/radius?action=coa-audit-list&${params.toString()}`),
        fetch('/api/wifi/radius?action=coa-audit-stats'),
      ]);
      const listData = await listRes.json();
      const statsData = await statsRes.json();

      if (listData.success && listData.data) {
        setEntries(Array.isArray(listData.data) ? listData.data : []);
      } else {
        setEntries([]);
      }

      if (statsData.success && statsData.data) {
        setStats(statsData.data);
      }
    } catch (error) {
      console.error('Failed to fetch CoA audit:', error);
      setEntries([]);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, coaTypeFilter, resultFilter, startDate, endDate]);

  useEffect(() => {
    fetchAudit();
  }, [fetchAudit]);

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const formatBytes = (bytes: number): string => {
    if (!bytes || bytes <= 0) return '0 B';
    if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`;
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes} B`;
  };

  const formatDuration = (seconds: number): string => {
    if (!seconds || seconds <= 0) return '0s';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m`;
    return `${seconds % 60}s`;
  };

  const getResultBadge = (result: string) => {
    if (result === 'success') {
      return (
        <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0">
          <CheckCircle className="h-3 w-3 mr-1" />
          Success
        </Badge>
      );
    }
    return (
      <Badge className="bg-red-500 hover:bg-red-600 text-white border-0">
        <XCircle className="h-3 w-3 mr-1" />
        Failed
      </Badge>
    );
  };

  const getCoaTypeBadge = (type: string) => {
    if (!type) return <span className="text-muted-foreground text-xs">N/A</span>;
    const color = COA_TYPE_COLORS[type] || 'bg-gray-500';
    const label = type.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    return (
      <Badge className={`${color} hover:${color} text-white border-0 text-xs`}>
        {label}
      </Badge>
    );
  };

  const formatTimestamp = (ts: string) => {
    if (!ts) return '—';
    const date = new Date(ts);
    return date.toLocaleString();
  };

  // Unique CoA types for filter
  const coaTypes = Array.from(new Set(entries.map(e => e.coaType).filter(Boolean)));

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            CoA Audit Trail
          </h2>
          <p className="text-sm text-muted-foreground">
            Change of Authorization audit log with before/after counters
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchAudit}>
            <RefreshCw className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <Activity className="h-4 w-4 text-cyan-500 dark:text-cyan-400" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums">{stats.totalToday}</div>
              <div className="text-xs text-muted-foreground">Total CoA Today</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <CheckCircle className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{stats.successCount}</div>
              <div className="text-xs text-muted-foreground">Successful</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-red-500/10">
              <XCircle className="h-4 w-4 text-red-500 dark:text-red-400" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums text-red-600 dark:text-red-400">{stats.failedCount}</div>
              <div className="text-xs text-muted-foreground">Failed</div>
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
      </div>

      {/* By Type Breakdown */}
      {stats.byType && stats.byType.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">Breakdown by Type</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {stats.byType.map(item => (
                <Badge key={item.type} variant="outline" className="text-xs">
                  {getCoaTypeBadge(item.coaType || item.type)}
                  <span className="ml-1 font-medium">{item.count}</span>
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
            <Select value={coaTypeFilter} onValueChange={setCoaTypeFilter}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {coaTypes.map(type => (
                  <SelectItem key={type} value={type}>
                    {type.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={resultFilter} onValueChange={setResultFilter}>
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue placeholder="Result" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Results</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
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

      {/* Audit Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted/50 p-4 mb-3">
                <GitBranch className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <h3 className="text-sm font-medium text-muted-foreground">No CoA audit entries</h3>
              <p className="text-xs text-muted-foreground/60 mt-1">
                CoA audit entries will appear when bandwidth or policy changes are triggered
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>CoA Type</TableHead>
                    <TableHead>Policy</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead>NAS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <Collapsible
                      key={entry.id}
                      open={expandedRow === entry.id}
                      onOpenChange={(open) => setExpandedRow(open ? entry.id : null)}
                    >
                      <TableRow className={cn(
                        entry.result === 'failed' && 'bg-red-50/30 dark:bg-red-950/10',
                        'cursor-pointer'
                      )}>
                        <TableCell>
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                              <ChevronDown className={cn(
                                'h-4 w-4 transition-transform',
                                expandedRow === entry.id && 'rotate-180'
                              )} />
                            </Button>
                          </CollapsibleTrigger>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>{formatTimestamp(entry.timestamp)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="font-medium text-sm">{entry.username}</p>
                        </TableCell>
                        <TableCell>{getCoaTypeBadge(entry.coaType)}</TableCell>
                        <TableCell>
                          <p className="text-sm text-muted-foreground">{entry.policyName || '—'}</p>
                        </TableCell>
                        <TableCell>{getResultBadge(entry.result)}</TableCell>
                        <TableCell>
                          <p className="text-sm font-mono text-muted-foreground">{entry.nasIp || '—'}</p>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell colSpan={7} className="p-0">
                          <CollapsibleContent>
                            <div className="bg-muted/30 px-6 py-4">
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                {/* BW Percent */}
                                <div>
                                  <p className="text-xs text-muted-foreground">Bandwidth %</p>
                                  <p className="text-sm font-medium">{entry.bandwidthPercent != null ? `${entry.bandwidthPercent}%` : '—'}</p>
                                </div>
                                {/* Change IDs */}
                                <div>
                                  <p className="text-xs text-muted-foreground">Change ID</p>
                                  <p className="text-xs font-mono">{entry.oldChangeId || '—'} → {entry.newChangeId || '—'}</p>
                                </div>
                                {/* Session Time */}
                                <div>
                                  <p className="text-xs text-muted-foreground">Session Time</p>
                                  <p className="text-xs">
                                    {formatDuration(entry.beforeSessionTime || 0)} → {formatDuration(entry.afterSessionTime || 0)}
                                  </p>
                                </div>
                                {/* Error */}
                                <div>
                                  <p className="text-xs text-muted-foreground">Error</p>
                                  {entry.errorMessage ? (
                                    <div className="flex items-center gap-1">
                                      <AlertTriangle className="h-3 w-3 text-red-500 dark:text-red-400" />
                                      <p className="text-xs text-red-600 dark:text-red-400">{entry.errorMessage}</p>
                                    </div>
                                  ) : (
                                    <p className="text-xs">—</p>
                                  )}
                                </div>
                                {/* Download before/after */}
                                <div>
                                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                                    <ArrowDownToLine className="h-3 w-3" /> Download
                                  </p>
                                  <p className="text-xs">
                                    {formatBytes(entry.beforeDownload || 0)} → {formatBytes(entry.afterDownload || 0)}
                                  </p>
                                </div>
                                {/* Upload before/after */}
                                <div>
                                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                                    <ArrowUpFromLine className="h-3 w-3" /> Upload
                                  </p>
                                  <p className="text-xs">
                                    {formatBytes(entry.beforeUpload || 0)} → {formatBytes(entry.afterUpload || 0)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </CollapsibleContent>
                        </TableCell>
                      </TableRow>
                    </Collapsible>
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


