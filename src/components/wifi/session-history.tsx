'use client';

/**
 * Session History — Production-Ready Component
 *
 * Handles 1000+ users with 1+ year of data efficiently:
 * - Default 7-day window (prevents full-table scans)
 * - Server-side pagination with filtered summary (counts ONLY within date range)
 * - Quick date shortcuts: Today, Yesterday, 7d, 30d, This Month, Custom
 * - Per-user drill-down (click username → filter to that user)
 * - CSV export for compliance reporting
 * - Mobile responsive: card layout on small screens, table on desktop
 *
 * API: /api/wifi/session-history (direct Prisma query, no proxy)
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  History,
  Search,
  Loader2,
  Clock,
  ArrowDownToLine,
  ArrowUpFromLine,
  RefreshCw,
  Router,
  UserCircle,
  CircleDot,
  CircleSlash,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Eye,
  Activity,
  XCircle,
  StopCircle,
  Download,
  FilterX,
  Database,
  AlertTriangle,
  User,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface AccountingSession {
  radacctid: number;
  acctsessionid: string;
  username: string;
  framedipaddress: string;
  callingstationid: string;
  nasipaddress: string;
  acctstarttime: string | null;
  acctupdatetime: string | null;
  acctstoptime: string | null;
  acctsessiontime: number | null;
  acctinputoctets: number | null;
  acctoutputoctets: number | null;
  acctterminatecause: string;
  nasporttype: string | null;
  connectinfo_start: string | null;
  connectinfo_stop: string | null;
}

interface SessionSummary {
  total: number;
  active: number;
  totalDownload: number;
  totalUpload: number;
}

interface SessionPagination {
  total: number;
  limit: number;
  offset: number;
  totalPages: number;
}

interface ActiveFilters {
  username: string;
  nasIp: string;
  status: string;
  startDate: string;
  endDate: string;
}

// ─── Date Shortcuts ─────────────────────────────────────────────────────────────

type DateShortcut = 'today' | 'yesterday' | '7d' | '30d' | '90d' | 'this-month' | 'custom';

function getDateRange(shortcut: DateShortcut): { start: string; end: string } {
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  const end = fmt(now);

  switch (shortcut) {
    case 'today':
      return { start: end, end };
    case 'yesterday': {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      return { start: fmt(y), end: fmt(y) };
    }
    case '7d': {
      const s = new Date(now);
      s.setDate(s.getDate() - 6);
      return { start: fmt(s), end };
    }
    case '30d': {
      const s = new Date(now);
      s.setDate(s.getDate() - 29);
      return { start: fmt(s), end };
    }
    case '90d': {
      const s = new Date(now);
      s.setDate(s.getDate() - 89);
      return { start: fmt(s), end };
    }
    case 'this-month':
      return { start: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`, end };
    default:
      return { start: '', end };
  }
}

const DATE_SHORTCUTS: Array<{ value: DateShortcut; label: string }> = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: '90d', label: 'Last 90 Days' },
  { value: 'this-month', label: 'This Month' },
  { value: 'custom', label: 'Custom Range' },
];

// ─── Helper Functions ───────────────────────────────────────────────────────────

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return '0s';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0) parts.push(`${secs}s`);
  return parts.join(' ') || '0s';
}

function formatBytes(bytes: number | null): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '—';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    });
  } catch {
    return dateStr;
  }
}

function formatDateTimeFull(dateStr: string | null): string {
  if (!dateStr) return '—';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    });
  } catch {
    return dateStr;
  }
}

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const PAGE_SIZE = 25;

// ─── Component ──────────────────────────────────────────────────────────────────

export default function SessionHistory() {
  const { toast } = useToast();
  const abortRef = useRef<AbortController | null>(null);

  // Data state
  const [sessions, setSessions] = useState<AccountingSession[]>([]);
  const [summary, setSummary] = useState<SessionSummary>({ total: 0, active: 0, totalDownload: 0, totalUpload: 0 });
  const [pagination, setPagination] = useState<SessionPagination>({ total: 0, limit: PAGE_SIZE, offset: 0, totalPages: 0 });

  // Filter state
  const [dateShortcut, setDateShortcut] = useState<DateShortcut>('7d');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [drillDownUser, setDrillDownUser] = useState<string | null>(null);

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedSession, setSelectedSession] = useState<AccountingSession | null>(null);

  // ─── Build effective date range ─────────────────────────────────────────────

  const effectiveStartDate = startDate || getDateRange(dateShortcut).start;
  const effectiveEndDate = endDate || getDateRange(dateShortcut).end;

  // ─── Count active filters ───────────────────────────────────────────────────

  const activeFilters: ActiveFilters = {
    username: debouncedSearchQuery || searchQuery,
    nasIp: '',
    status: statusFilter,
    startDate: effectiveStartDate,
    endDate: effectiveEndDate,
  };
  const filterCount = Object.values(activeFilters).filter(v => v && v !== 'all').length;

  // ─── Debounce search query ─────────────────────────────────────────────────

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ─── Fetch Sessions ──────────────────────────────────────────────────────────

  const fetchSessions = useCallback(async (offset?: number) => {
    // Abort previous request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('limit', String(PAGE_SIZE));
      params.append('offset', String(offset ?? 0));
      if (drillDownUser) params.append('username', drillDownUser);
      else if (debouncedSearchQuery) params.append('username', debouncedSearchQuery);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (effectiveStartDate) params.append('startDate', effectiveStartDate);
      if (effectiveEndDate) params.append('endDate', effectiveEndDate);

      const res = await fetch(`/api/wifi/session-history?${params.toString()}`, {
        signal: controller.signal,
      });
      const data = await res.json();

      if (!controller.signal.aborted) {
        if (data.success) {
          setSessions(Array.isArray(data.data) ? data.data : []);
          if (data.summary) {
            setSummary({
              total: data.summary.total ?? 0,
              active: data.summary.active ?? 0,
              totalDownload: data.summary.totalDownload ?? 0,
              totalUpload: data.summary.totalUpload ?? 0,
            });
          }
          if (data.pagination) {
            setPagination(data.pagination);
          }
        } else {
          setSessions([]);
          toast({ title: 'Fetch Failed', description: data.error || 'Failed to load sessions', variant: 'destructive' });
        }
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Session history fetch error:', error);
        setSessions([]);
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [debouncedSearchQuery, statusFilter, effectiveStartDate, effectiveEndDate, drillDownUser, toast]);

  // ─── Initial fetch + refetch on filter change ───────────────────────────────

  useEffect(() => {
    fetchSessions(0);
  }, [fetchSessions]);

  // ─── Pagination ─────────────────────────────────────────────────────────────

  const goToPage = (newOffset: number) => {
    setPagination(prev => ({ ...prev, offset: newOffset }));
    fetchSessions(newOffset);
  };

  const currentPage = Math.floor(pagination.offset / PAGE_SIZE) + 1;
  const totalPages = pagination.totalPages || 1;
  const showingStart = pagination.total > 0 ? pagination.offset + 1 : 0;
  const showingEnd = Math.min(pagination.offset + PAGE_SIZE, pagination.total);

  // ─── Date shortcut change ───────────────────────────────────────────────────

  const handleDateShortcutChange = (value: DateShortcut) => {
    setDateShortcut(value);
    if (value !== 'custom') {
      const range = getDateRange(value);
      setStartDate('');
      setEndDate('');
    }
    // Reset to page 1
    setPagination(prev => ({ ...prev, offset: 0 }));
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setDrillDownUser(null);
    setDateShortcut('7d');
    setStartDate('');
    setEndDate('');
    setPagination(prev => ({ ...prev, offset: 0 }));
  };

  // ─── CSV Export ─────────────────────────────────────────────────────────────

  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      params.append('export', 'csv');
      if (drillDownUser) params.append('username', drillDownUser);
      else if (searchQuery) params.append('username', searchQuery);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (effectiveStartDate) params.append('startDate', effectiveStartDate);
      if (effectiveEndDate) params.append('endDate', effectiveEndDate);

      const res = await fetch(`/api/wifi/session-history?${params.toString()}`);
      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const contentDisposition = res.headers.get('Content-Disposition');
      const filename = contentDisposition?.match(/filename="(.+)"/)?.[1] || 'session-history.csv';
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      toast({ title: 'Export Complete', description: `Downloaded ${filename}` });
    } catch {
      toast({ title: 'Export Failed', description: 'Could not generate CSV file', variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  };

  // ─── Status Badge ───────────────────────────────────────────────────────────

  const getStatusBadge = (session: AccountingSession) => {
    if (!session.acctstoptime) {
      return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 text-[10px]"><CircleDot className="h-3 w-3 mr-1" />Online</Badge>;
    }
    return <Badge variant="secondary" className="text-[10px]"><CircleSlash className="h-3 w-3 mr-1" />Ended</Badge>;
  };

  const getTerminateBadge = (cause: string) => {
    if (!cause) return <span className="text-xs text-muted-foreground">—</span>;
    const c = cause.toLowerCase();
    if (['user-request', 'admin-reset', 'nas-request', 'nas-reboot'].includes(c)) {
      return <Badge variant="outline" className="text-[10px] gap-1 font-normal"><StopCircle className="h-3 w-3 text-orange-500" />{cause}</Badge>;
    }
    if (['idle-timeout', 'session-timeout'].includes(c)) {
      return <Badge variant="outline" className="text-[10px] gap-1 font-normal"><Clock className="h-3 w-3 text-amber-500" />{cause}</Badge>;
    }
    return <Badge variant="outline" className="text-[10px] gap-1 font-normal"><XCircle className="h-3 w-3 text-muted-foreground" />{cause}</Badge>;
  };

  // ─── Mobile Card ────────────────────────────────────────────────────────────

  const SessionCard = ({ session }: { session: AccountingSession }) => (
    <Card
      className={cn('border cursor-pointer hover:border-primary/30 transition-colors', !session.acctstoptime && 'border-emerald-200 dark:border-emerald-800')}
      onClick={() => setSelectedSession(session)}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <UserCircle className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">{session.username || '—'}</p>
              <p className="font-mono text-xs text-muted-foreground">{session.framedipaddress || '—'}</p>
            </div>
          </div>
          {getStatusBadge(session)}
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div><p className="text-muted-foreground mb-0.5">MAC</p><p className="font-mono truncate">{session.callingstationid || '—'}</p></div>
          <div><p className="text-muted-foreground mb-0.5">NAS</p><div className="flex items-center gap-1"><Router className="h-3 w-3 shrink-0" /><span className="truncate">{session.nasipaddress || '—'}</span></div></div>
          <div><p className="text-muted-foreground mb-0.5">Duration</p><p className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDuration(session.acctsessiontime)}</p></div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-md bg-muted/50 p-2"><p className="text-muted-foreground mb-1">Upload</p><div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><ArrowUpFromLine className="h-3 w-3" />{formatBytes(session.acctinputoctets)}</div></div>
          <div className="rounded-md bg-muted/50 p-2"><p className="text-muted-foreground mb-1">Download</p><div className="flex items-center gap-1 text-amber-600 dark:text-amber-400"><ArrowDownToLine className="h-3 w-3" />{formatBytes(session.acctoutputoctets)}</div></div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div><p className="text-muted-foreground mb-0.5">Started</p><p>{formatDateTime(session.acctstarttime)}</p></div>
          <div><p className="text-muted-foreground mb-0.5">Stopped</p><p>{session.acctstoptime ? formatDateTime(session.acctstoptime) : <span className="text-emerald-600 dark:text-emerald-400 font-medium">Online</span>}</p></div>
        </div>
        {session.acctterminatecause && (
          <div className="pt-1 border-t"><p className="text-muted-foreground mb-1 text-xs">Terminate Cause</p>{getTerminateBadge(session.acctterminatecause)}</div>
        )}
      </CardContent>
    </Card>
  );

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <History className="h-5 w-5" />
            Session History
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            RADIUS accounting records · Default: last 7 days
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={isExporting || isLoading}>
            {isExporting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Download className="h-4 w-4 mr-1.5" />}
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => fetchSessions()} disabled={isLoading}>
            <RefreshCw className={cn('h-4 w-4 mr-1.5', isLoading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Drill-down banner */}
      {drillDownUser && (
        <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-800 dark:bg-blue-950/30">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <p className="text-sm font-medium">Filtered by user: <span className="font-mono">{drillDownUser}</span></p>
          </div>
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setDrillDownUser(null); setPagination(prev => ({ ...prev, offset: 0 })); }}>
            <XCircle className="h-3.5 w-3.5 mr-1" /> Clear
          </Button>
        </div>
      )}

      {/* Date Range Selector — Quick Shortcuts */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex flex-wrap gap-1.5">
              {DATE_SHORTCUTS.map((s) => (
                <Button
                  key={s.value}
                  variant={dateShortcut === s.value ? 'default' : 'outline'}
                  size="sm"
                  className={cn('text-xs h-8 px-3', dateShortcut === s.value && 'bg-teal-600 hover:bg-teal-700 text-white')}
                  onClick={() => handleDateShortcutChange(s.value)}
                >
                  {s.label}
                </Button>
              ))}
            </div>
            {dateShortcut === 'custom' && (
              <div className="flex gap-2">
                <div className="relative flex-1 sm:flex-initial">
                  <CalendarDays className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPagination(prev => ({ ...prev, offset: 0 })); }} className="pl-9 w-full sm:w-40" />
                </div>
                <span className="self-center text-muted-foreground text-xs">to</span>
                <div className="relative flex-1 sm:flex-initial">
                  <CalendarDays className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPagination(prev => ({ ...prev, offset: 0 })); }} className="pl-9 w-full sm:w-40" />
                </div>
              </div>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">
            Showing data from {effectiveStartDate || '...'} to {effectiveEndDate || '...'}
            · Summary counts are scoped to this range only
          </p>
        </CardContent>
      </Card>

      {/* Stats Cards — Filtered Summary */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-violet-500/10"><Activity className="h-4 w-4 text-violet-500 dark:text-violet-400" /></div>
            <div>
              <div className="text-2xl font-bold tabular-nums">{formatNumber(summary.total)}</div>
              <div className="text-xs text-muted-foreground">Sessions in range</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10"><CircleDot className="h-4 w-4 text-emerald-500 dark:text-emerald-400" /></div>
            <div>
              <div className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{summary.active}</div>
              <div className="text-xs text-muted-foreground">Active Now</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-cyan-500/10"><ArrowDownToLine className="h-4 w-4 text-cyan-500 dark:text-cyan-400" /></div>
            <div>
              <div className="text-2xl font-bold tabular-nums">{formatBytes(summary.totalDownload)}</div>
              <div className="text-xs text-muted-foreground">Total Download</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-sky-500/10"><ArrowUpFromLine className="h-4 w-4 text-sky-500 dark:text-sky-400" /></div>
            <div>
              <div className="text-2xl font-bold tabular-nums">{formatBytes(summary.totalUpload)}</div>
              <div className="text-xs text-muted-foreground">Total Upload</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Search + Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by username..."
                value={drillDownUser || searchQuery}
                onChange={(e) => { if (drillDownUser) setDrillDownUser(null); setSearchQuery(e.target.value); setPagination(prev => ({ ...prev, offset: 0 })); }}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPagination(prev => ({ ...prev, offset: 0 })); }}>
              <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="All Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="stopped">Ended</SelectItem>
              </SelectContent>
            </Select>
            {filterCount > 0 && (
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={clearAllFilters}>
                <FilterX className="h-3.5 w-3.5 mr-1" /> Clear All
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sessions List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center px-4">
          <div className="rounded-full bg-muted/50 p-4 mb-3"><History className="h-8 w-8 text-muted-foreground/40" /></div>
          <h3 className="text-sm font-medium text-muted-foreground">No sessions found</h3>
          <p className="text-xs text-muted-foreground/60 mt-1 max-w-sm">Try adjusting the date range or filters. The default view shows only the last 7 days.</p>
        </div>
      ) : (
        <>
          {/* Mobile: Card Layout */}
          <div className="space-y-3 sm:hidden">
            {sessions.map((session) => (
              <SessionCard key={session.radacctid} session={session} />
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
                        <TableHead className="w-[70px]">Status</TableHead>
                        <TableHead>User / IP</TableHead>
                        <TableHead>MAC</TableHead>
                        <TableHead>NAS</TableHead>
                        <TableHead>Start Time</TableHead>
                        <TableHead>Stop Time</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead className="text-right">Upload</TableHead>
                        <TableHead className="text-right">Download</TableHead>
                        <TableHead>Cause</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sessions.map((session) => {
                        const isActive = !session.acctstoptime;
                        return (
                          <TableRow
                            key={session.radacctid}
                            className={cn('cursor-pointer hover:bg-muted/50 transition-colors', isActive && 'bg-emerald-50/50 dark:bg-emerald-950/10')}
                            onClick={() => setSelectedSession(session)}
                          >
                            <TableCell>{getStatusBadge(session)}</TableCell>
                            <TableCell>
                              <div className="space-y-0.5">
                                <button
                                  className="font-medium text-sm truncate max-w-[140px] block text-left hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
                                  title={`${session.username} — Click to filter`}
                                  onClick={(e) => { e.stopPropagation(); setDrillDownUser(session.username); setPagination(prev => ({ ...prev, offset: 0 })); }}
                                >
                                  {session.username || '—'}
                                </button>
                                <p className="font-mono text-xs text-muted-foreground pl-1">{session.framedipaddress || '—'}</p>
                              </div>
                            </TableCell>
                            <TableCell><p className="font-mono text-xs text-muted-foreground">{session.callingstationid || '—'}</p></TableCell>
                            <TableCell><div className="flex items-center gap-1.5"><Router className="h-3.5 w-3.5 text-muted-foreground shrink-0" /><span className="text-xs font-mono">{session.nasipaddress || '—'}</span></div></TableCell>
                            <TableCell><div className="flex items-center gap-1 text-xs"><CalendarDays className="h-3 w-3 text-muted-foreground shrink-0" /><span>{formatDateTime(session.acctstarttime)}</span></div></TableCell>
                            <TableCell>
                              {session.acctstoptime ? (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground"><CalendarDays className="h-3 w-3 shrink-0" /><span>{formatDateTime(session.acctstoptime)}</span></div>
                              ) : (
                                <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 text-[10px]"><CircleDot className="h-3 w-3 mr-1" />Online</Badge>
                              )}
                            </TableCell>
                            <TableCell><div className="flex items-center gap-1 text-xs"><Clock className="h-3 w-3 text-muted-foreground" /><span>{formatDuration(session.acctsessiontime)}</span></div></TableCell>
                            <TableCell className="text-right"><div className="flex items-center justify-end gap-1 text-xs"><ArrowUpFromLine className="h-3 w-3 text-sky-500" /><span>{formatBytes(session.acctinputoctets)}</span></div></TableCell>
                            <TableCell className="text-right"><div className="flex items-center justify-end gap-1 text-xs"><ArrowDownToLine className="h-3 w-3 text-cyan-500" /><span>{formatBytes(session.acctoutputoctets)}</span></div></TableCell>
                            <TableCell>{getTerminateBadge(session.acctterminatecause)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Showing <span className="font-medium text-foreground">{showingStart}</span>–<span className="font-medium text-foreground">{showingEnd}</span> of <span className="font-medium text-foreground">{formatNumber(pagination.total)}</span>
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => goToPage(pagination.offset - PAGE_SIZE)} disabled={currentPage <= 1}>
                <ChevronLeft className="h-4 w-4 mr-1" />Prev
              </Button>

              {/* Page number buttons */}
              <div className="hidden sm:flex items-center gap-1">
                {(() => {
                  const pages: number[] = [];
                  const maxVisible = 5;
                  let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
                  const endPage = Math.min(totalPages, startPage + maxVisible - 1);
                  if (endPage - startPage < maxVisible - 1) startPage = Math.max(1, endPage - maxVisible + 1);
                  for (let i = startPage; i <= endPage; i++) pages.push(i);
                  return pages.map(p => (
                    <Button key={p} variant={p === currentPage ? 'default' : 'outline'} size="sm" className={cn('h-8 w-8 p-0 text-xs', p === currentPage && 'bg-teal-600 hover:bg-teal-700 text-white')} onClick={() => goToPage((p - 1) * PAGE_SIZE)}>
                      {p}
                    </Button>
                  ));
                })()}
              </div>

              <span className="sm:hidden text-xs text-muted-foreground px-2">
                {currentPage}/{totalPages}
              </span>

              <Button variant="outline" size="sm" onClick={() => goToPage(pagination.offset + PAGE_SIZE)} disabled={currentPage >= totalPages}>
                Next<ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Session Details Dialog */}
      <Dialog open={!!selectedSession} onOpenChange={(open) => { if (!open) setSelectedSession(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Eye className="h-5 w-5" />Session Details</DialogTitle>
            <DialogDescription>RADIUS accounting record</DialogDescription>
          </DialogHeader>
          {selectedSession && (
            <div className="grid gap-4 py-4">
              <div className="flex items-center justify-between">{getStatusBadge(selectedSession)}</div>
              <div className="border-t pt-4">
                <p className="text-xs font-medium text-muted-foreground mb-3">User Information</p>
                <div className="grid grid-cols-2 gap-4">
                  <div><p className="text-xs text-muted-foreground">Username</p>
                    <button className="text-sm font-medium hover:text-teal-600 dark:hover:text-teal-400 transition-colors text-left" onClick={() => { setDrillDownUser(selectedSession.username); setSelectedSession(null); setPagination(prev => ({ ...prev, offset: 0 })); }}>
                      {selectedSession.username || '—'}
                    </button>
                  </div>
                  <div><p className="text-xs text-muted-foreground">IP Address</p><p className="text-sm font-mono">{selectedSession.framedipaddress || '—'}</p></div>
                  <div><p className="text-xs text-muted-foreground">MAC Address</p><p className="text-sm font-mono">{selectedSession.callingstationid || '—'}</p></div>
                  <div><p className="text-xs text-muted-foreground">NAS IP</p><div className="flex items-center gap-1.5 mt-0.5"><Router className="h-3.5 w-3.5 text-muted-foreground" /><p className="text-sm font-mono">{selectedSession.nasipaddress || '—'}</p></div></div>
                </div>
              </div>
              <div className="border-t pt-4">
                <p className="text-xs font-medium text-muted-foreground mb-3">Session Timing</p>
                <div className="grid grid-cols-2 gap-4">
                  <div><p className="text-xs text-muted-foreground">Start Time</p><div className="flex items-center gap-1.5 mt-0.5"><CalendarDays className="h-3.5 w-3.5 text-muted-foreground" /><p className="text-sm">{formatDateTimeFull(selectedSession.acctstarttime)}</p></div></div>
                  <div><p className="text-xs text-muted-foreground">Stop Time</p>
                    {selectedSession.acctstoptime ? (
                      <div className="flex items-center gap-1.5 mt-0.5"><CalendarDays className="h-3.5 w-3.5 text-muted-foreground" /><p className="text-sm">{formatDateTimeFull(selectedSession.acctstoptime)}</p></div>
                    ) : (
                      <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">Online</p>
                    )}
                  </div>
                  <div><p className="text-xs text-muted-foreground">Duration</p><div className="flex items-center gap-1.5 mt-0.5"><Clock className="h-3.5 w-3.5 text-muted-foreground" /><p className="text-sm font-medium">{formatDuration(selectedSession.acctsessiontime)}</p></div></div>
                  <div><p className="text-xs text-muted-foreground">Terminate Cause</p><div className="mt-1">{getTerminateBadge(selectedSession.acctterminatecause)}</div></div>
                </div>
              </div>
              <div className="border-t pt-4">
                <p className="text-xs font-medium text-muted-foreground mb-3">Data Usage</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground mb-1">Upload</p><div className="flex items-center gap-2"><ArrowUpFromLine className="h-4 w-4 text-sky-500" /><span className="text-sm font-medium">{formatBytes(selectedSession.acctinputoctets)}</span></div></div>
                  <div className="rounded-lg bg-muted/50 p-3"><p className="text-xs text-muted-foreground mb-1">Download</p><div className="flex items-center gap-2"><ArrowDownToLine className="h-4 w-4 text-cyan-500" /><span className="text-sm font-medium">{formatBytes(selectedSession.acctoutputoctets)}</span></div></div>
                </div>
                <div className="mt-3 rounded-lg bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground mb-1">Total Data</p>
                  <p className="text-lg font-bold tabular-nums">{formatBytes((selectedSession.acctinputoctets || 0) + (selectedSession.acctoutputoctets || 0))}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
