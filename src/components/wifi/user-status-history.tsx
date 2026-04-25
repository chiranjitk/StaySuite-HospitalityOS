'use client';

/**
 * User Status History Component
 *
 * User status change audit log - tracks when user statuses change
 * (active, suspended, disabled, expired, etc.) with who changed it and why.
 *
 * Data source: /api/wifi/radius?action=user-status-history-list
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
  History,
  Search,
  Loader2,
  RefreshCw,
  Clock,
  UserCircle,
  ArrowRight,
  Activity,
  AlertTriangle,
  Ban,
  CheckCircle,
  XCircle,
  Pause,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface UserStatusEntry {
  id: string;
  timestamp: string;
  username: string;
  oldStatus: string;
  newStatus: string;
  changedBy: string;
  reason?: string;
  ipAddress?: string;
}

// ─── Status Config ──────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { color: string; icon: React.ReactNode }> = {
  active: { color: 'bg-emerald-500 hover:bg-emerald-600 text-white border-0', icon: <CheckCircle className="h-3 w-3 mr-1" /> },
  suspended: { color: 'bg-amber-500 hover:bg-amber-600 text-white border-0', icon: <Pause className="h-3 w-3 mr-1" /> },
  disabled: { color: 'bg-gray-500 hover:bg-gray-600 text-white border-0', icon: <Ban className="h-3 w-3 mr-1" /> },
  expired: { color: 'bg-red-500 hover:bg-red-600 text-white border-0', icon: <AlertTriangle className="h-3 w-3 mr-1" /> },
  blocked: { color: 'bg-red-600 hover:bg-red-700 text-white border-0', icon: <XCircle className="h-3 w-3 mr-1" /> },
  inactive: { color: 'bg-slate-500 hover:bg-slate-600 text-white border-0', icon: <Activity className="h-3 w-3 mr-1" /> },
  pending: { color: 'bg-sky-500 hover:bg-sky-600 text-white border-0', icon: <Clock className="h-3 w-3 mr-1" /> },
};

const getStatusBadge = (status: string) => {
  const config = STATUS_CONFIG[status] || { color: 'bg-gray-500 hover:bg-gray-600 text-white border-0', icon: null };
  return (
    <Badge className={cn(config.color, 'text-xs capitalize')}>
      {config.icon}
      {status}
    </Badge>
  );
};

// ─── Component ──────────────────────────────────────────────────────────────────

export default function UserStatusHistory() {
  const { toast } = useToast();
  const [entries, setEntries] = useState<UserStatusEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusTypeFilter, setStatusTypeFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // ─── Fetch ──────────────────────────────────────────────────────────────────

  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('limit', '200');
      if (searchQuery) params.append('username', searchQuery);
      if (statusTypeFilter !== 'all') params.append('status', statusTypeFilter);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const res = await fetch(`/api/wifi/radius?action=user-status-history-list&${params.toString()}`);
      const data = await res.json();
      if (data.success && data.data) {
        setEntries(Array.isArray(data.data) ? data.data : []);
      } else {
        setEntries([]);
      }
    } catch (error) {
      console.error('Failed to fetch user status history:', error);
      setEntries([]);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, statusTypeFilter, startDate, endDate]);

  // ─── Debounced search ──────────────────────────────────────────────────────

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchHistory();
    }, 300);
  };

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const formatTimestamp = (ts: string) => {
    if (!ts) return '—';
    const date = new Date(ts);
    return date.toLocaleString();
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <History className="h-5 w-5" />
            User Status History
          </h2>
          <p className="text-sm text-muted-foreground">
            Audit log of user status changes with change reason and operator info
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchHistory}>
            <RefreshCw className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

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
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={statusTypeFilter} onValueChange={setStatusTypeFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Status Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="disabled">Disabled</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="blocked">Blocked</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
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

      {/* History Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted/50 p-4 mb-3">
                <History className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <h3 className="text-sm font-medium text-muted-foreground">No status changes found</h3>
              <p className="text-xs text-muted-foreground/60 mt-1">
                {searchQuery || statusTypeFilter !== 'all' || startDate || endDate
                  ? 'Try clearing filters or search terms'
                  : 'Status change entries will appear when user statuses are modified'}
              </p>
            </div>
          ) : (
            <div className="max-h-[500px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>Status Change</TableHead>
                    <TableHead>Changed By</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead className="text-right">IP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry, index) => (
                    <TableRow key={entry.id || index} className={
                      entry.newStatus === 'blocked' || entry.newStatus === 'disabled' || entry.newStatus === 'expired'
                        ? 'bg-red-50/30 dark:bg-red-950/10'
                        : entry.newStatus === 'active'
                          ? 'bg-emerald-50/30 dark:bg-emerald-950/10'
                          : ''
                    }>
                      <TableCell>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{formatTimestamp(entry.timestamp)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <UserCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                          <p className="font-medium text-sm">{entry.username}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(entry.oldStatus)}
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          {getStatusBadge(entry.newStatus)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm text-muted-foreground">{entry.changedBy || '—'}</p>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm text-muted-foreground max-w-[200px] truncate">{entry.reason || '—'}</p>
                      </TableCell>
                      <TableCell className="text-right">
                        <p className="text-xs font-mono text-muted-foreground">{entry.ipAddress || '—'}</p>
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
