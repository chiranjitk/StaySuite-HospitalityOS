'use client';

/**
 * User Usage Dashboard Component
 *
 * Per-user aggregated usage dashboard with sorting, search, rank badges,
 * and a detail dialog showing session history, daily breakdown bar chart,
 * and quick disconnect actions.
 * Mobile: card-based layout.
 * Desktop: table view with inline actions.
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  BarChart3,
  Search,
  Loader2,
  Users,
  Download,
  Upload,
  Clock,
  RefreshCw,
  UserCircle,
  Crown,
  Medal,
  Award,
  Eye,
  Unplug,
  AlertTriangle,
  CalendarDays,
  TrendingUp,
  XCircle,
  CircleDot,
  Router,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface UserUsageItem {
  username: string;
  totalSessions: number;
  activeSessions: number;
  totalDownloadBytes: number;
  totalUploadBytes: number;
  totalSessionTime: number;
  lastSeen: string;
}

interface UserUsageStats {
  totalUsers: number;
  totalBandwidth: number;
  avgPerUser: number;
  topUser: string;
}

interface UserSessionDetail {
  id: string;
  sessionId: string;
  startedAt: string;
  endedAt?: string;
  nasIp: string;
  nasIdentifier?: string;
  ipAddress?: string;
  macAddress?: string;
  downloadBytes: number;
  uploadBytes: number;
  sessionTime: number;
  isActive: boolean;
}

interface DailyUsageEntry {
  date: string;
  dayLabel: string;
  downloadBytes: number;
  uploadBytes: number;
  totalBytes: number;
}

interface UserUsageDetail {
  username: string;
  totalSessions: number;
  activeSessions: number;
  totalDownloadBytes: number;
  totalUploadBytes: number;
  totalSessionTime: number;
  sessions: UserSessionDetail[];
  dailyUsage: DailyUsageEntry[];
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const SORT_OPTIONS = [
  { value: 'download', label: 'Total Download' },
  { value: 'upload', label: 'Total Upload' },
  { value: 'sessions', label: 'Total Sessions' },
  { value: 'sessionTime', label: 'Session Time' },
] as const;

type SortKey = (typeof SORT_OPTIONS)[number]['value'];

const DEFAULT_LIMIT = 20;

// ─── Helpers ────────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0s';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function formatRelativeDate(dateStr: string): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

function getDateRange(): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  };
}

function getRankBadge(index: number) {
  if (index === 0) {
    return (
      <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-0 text-xs gap-1">
        <Crown className="h-3 w-3" />
        #1
      </Badge>
    );
  }
  if (index === 1) {
    return (
      <Badge className="bg-slate-400 hover:bg-slate-500 text-white border-0 text-xs gap-1">
        <Medal className="h-3 w-3" />
        #2
      </Badge>
    );
  }
  if (index === 2) {
    return (
      <Badge className="bg-orange-500 hover:bg-orange-600 text-white border-0 text-xs gap-1">
        <Award className="h-3 w-3" />
        #3
      </Badge>
    );
  }
  return null;
}

// ─── Component ──────────────────────────────────────────────────────────────────

export default function UserUsageDashboard() {
  const { toast } = useToast();

  // ─── State ──────────────────────────────────────────────────────────────────

  const [users, setUsers] = useState<UserUsageItem[]>([]);
  const [stats, setStats] = useState<UserUsageStats>({
    totalUsers: 0,
    totalBandwidth: 0,
    avgPerUser: 0,
    topUser: '—',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('download');

  // Detail dialog
  const [detailUser, setDetailUser] = useState<UserUsageDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Disconnect confirmation
  const [disconnectTarget, setDisconnectTarget] = useState<UserSessionDetail | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);

  // ─── Fetch Summary ───────────────────────────────────────────────────────────

  const fetchSummary = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        action: 'user-usage-summary',
        limit: String(DEFAULT_LIMIT),
        sort: sortBy,
      });

      const res = await fetch(`/api/wifi/radius?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setUsers(Array.isArray(data.data) ? data.data : (data.data?.users || []));
        if (data.data?.overallStats) {
          const os = data.data.overallStats;
          setStats({
            totalUsers: os.totalUsers ?? 0,
            totalBandwidth: os.totalBandwidth ?? 0,
            avgPerUser: os.avgPerUser ?? (os.totalBandwidth && os.totalUsers ? Math.round(os.totalBandwidth / os.totalUsers) : 0),
            topUser: typeof os.topUser === 'object' && os.topUser ? (os.topUser as { username: string }).username : (os.topUser || '—'),
          });
        } else if (data.stats) {
          setStats(data.stats);
        }
      } else {
        setUsers([]);
      }
    } catch (error) {
      console.error('Failed to fetch user usage summary:', error);
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  }, [sortBy]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  // ─── Fetch User Detail ───────────────────────────────────────────────────────

  const openUserDetail = async (username: string) => {
    setDetailLoading(true);
    setDetailUser(null);
    try {
      const params = new URLSearchParams({
        action: 'user-usage-detail',
        username,
      });

      const res = await fetch(`/api/wifi/radius?${params.toString()}`);
      const data = await res.json();

      if (data.success && data.data) {
        setDetailUser(data.data);
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to load user detail',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to load user detail',
        variant: 'destructive',
      });
    } finally {
      setDetailLoading(false);
    }
  };

  // ─── Disconnect Session ──────────────────────────────────────────────────────

  const handleDisconnect = async () => {
    if (!disconnectTarget) return;
    const session = disconnectTarget;
    setDisconnectingId(session.id);
    setDisconnectTarget(null);

    try {
      const res = await fetch('/api/wifi/radius', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'live-sessions-disconnect',
          sessionId: session.sessionId,
          username: detailUser?.username || '',
          nasIp: session.nasIp,
        }),
      });
      const data = await res.json();

      if (data.success) {
        if (data.coa) {
          toast({
            title: 'Disconnected',
            description: 'Session terminated via RADIUS CoA',
          });
        } else {
          toast({
            title: 'Session Ended Locally',
            description: 'Session ended in dashboard. The network device session may still be active.',
          });
        }
        // Refresh detail
        if (detailUser?.username) {
          openUserDetail(detailUser.username);
        }
        // Refresh summary
        fetchSummary();
      } else {
        toast({
          title: 'Disconnect Failed',
          description: data.error || 'Could not reach RADIUS server. Try again or check that the RADIUS service is running.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to disconnect session',
        variant: 'destructive',
      });
    } finally {
      setDisconnectingId(null);
    }
  };

  // ─── Disconnect All Sessions ────────────────────────────────────────────────

  const [disconnectingAll, setDisconnectingAll] = useState(false);

  const handleDisconnectAll = async () => {
    if (!detailUser?.sessions?.length) return;
    setDisconnectingAll(true);

    const activeSessions = detailUser.sessions.filter(s => s.isActive);
    let coaSuccessCount = 0;
    let localSuccessCount = 0;
    let failCount = 0;

    for (const session of activeSessions) {
      try {
        const res = await fetch('/api/wifi/radius', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'live-sessions-disconnect',
            sessionId: session.sessionId,
            username: detailUser.username,
            nasIp: session.nasIp,
          }),
        });
        const data = await res.json();
        if (data.success && data.coa) coaSuccessCount++;
        else if (data.success) localSuccessCount++;
        else failCount++;
      } catch {
        failCount++;
      }
    }

    const totalSuccess = coaSuccessCount + localSuccessCount;

    if (totalSuccess > 0 && failCount === 0 && coaSuccessCount === 0) {
      // All succeeded locally but CoA failed for all
      toast({
        title: 'Sessions Ended Locally',
        description: `${localSuccessCount} session${localSuccessCount > 1 ? 's' : ''} ended locally. RADIUS CoA was unavailable — network device sessions may still be active.`,
      });
    } else if (totalSuccess > 0 && failCount === 0) {
      // All succeeded (mix of CoA and local)
      const parts: string[] = [];
      if (coaSuccessCount > 0) parts.push(`${coaSuccessCount} terminated via RADIUS CoA`);
      if (localSuccessCount > 0) parts.push(`${localSuccessCount} ended locally (CoA unavailable)`);
      toast({
        title: 'Sessions Disconnected',
        description: parts.join(', ') + '.',
      });
    } else if (totalSuccess > 0) {
      // Mixed success and failure
      const parts: string[] = [];
      if (coaSuccessCount > 0) parts.push(`${coaSuccessCount} terminated via CoA`);
      if (localSuccessCount > 0) parts.push(`${localSuccessCount} ended locally`);
      parts.push(`${failCount} failed`);
      toast({
        title: 'Partial Disconnect',
        description: parts.join(', ') + '.',
        variant: 'destructive',
      });
    } else {
      // All failed
      toast({
        title: 'Disconnect Failed',
        description: 'All disconnect attempts failed. Make sure the RADIUS management service is running on port 3010.',
        variant: 'destructive',
      });
    }

    // Refresh detail + summary
    if (detailUser.username) openUserDetail(detailUser.username);
    fetchSummary();
    setDisconnectingAll(false);
  };

  // ─── Client-side Filter ─────────────────────────────────────────────────────

  const filteredUsers = users.filter((u) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return u.username.toLowerCase().includes(q);
  });

  // ─── Daily Bar Chart Component ───────────────────────────────────────────────

  const DailyBarChart = ({ entries }: { entries: DailyUsageEntry[] }) => {
    if (!entries || entries.length === 0) return null;

    const maxBytes = Math.max(...entries.map((e) => Math.max(e.downloadBytes, e.uploadBytes)), 1);

    return (
      <div className="space-y-2">
        {entries.map((entry) => {
          const dlPct = Math.round((entry.downloadBytes / maxBytes) * 100);
          const ulPct = Math.round((entry.uploadBytes / maxBytes) * 100);
          return (
            <div key={entry.date} className="flex items-center gap-2 text-xs">
              <span className="w-16 text-muted-foreground shrink-0 font-medium">
                {entry.dayLabel}
              </span>
              <div className="flex-1 flex items-center gap-0.5">
                <div className="flex-1 h-5 rounded-sm bg-muted overflow-hidden flex">
                  <div
                    className="h-full bg-emerald-500 transition-all duration-500 rounded-sm"
                    style={{ width: `${dlPct}%` }}
                  />
                </div>
                <div className="flex-1 h-5 rounded-sm bg-muted overflow-hidden flex">
                  <div
                    className="h-full bg-amber-500 transition-all duration-500 rounded-sm"
                    style={{
                      width: `${ulPct}%`,
                    }}
                  />
                </div>
              </div>
              <span className="w-24 text-right tabular-nums shrink-0">
                <span className="text-emerald-600 dark:text-emerald-400">{formatBytes(entry.downloadBytes)}</span>
                {' / '}
                <span className="text-amber-600 dark:text-amber-400">{formatBytes(entry.uploadBytes)}</span>
              </span>
            </div>
          );
        })}
        <div className="flex items-center gap-3 pt-1 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
            <span>Download</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
            <span>Upload</span>
          </div>
        </div>
      </div>
    );
  };

  // ─── Mobile Card ─────────────────────────────────────────────────────────────

  const UserCard = ({ user, index }: { user: UserUsageItem; index: number }) => (
    <Card className="border hover:shadow-sm transition-shadow">
      <CardContent className="p-4 space-y-3">
        {/* Row 1: Username + Rank */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <UserCircle className="h-5 w-5 text-muted-foreground shrink-0" />
            <button
              className="font-medium text-sm truncate hover:text-primary transition-colors text-left"
              onClick={() => openUserDetail(user.username)}
              title={`View details for ${user.username}`}
            >
              {user.username}
            </button>
          </div>
          {getRankBadge(index)}
        </div>

        {/* Row 2: Sessions / Time Grid */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <p className="text-muted-foreground mb-0.5">Sessions</p>
            <p className="font-medium tabular-nums">{user.totalSessions}</p>
          </div>
          <div>
            <p className="text-muted-foreground mb-0.5">Active</p>
            <div className="flex items-center gap-1">
              {user.activeSessions > 0 ? (
                <CircleDot className="h-3 w-3 text-emerald-500" />
              ) : (
                <XCircle className="h-3 w-3 text-muted-foreground/40" />
              )}
              <span className="font-medium tabular-nums">{user.activeSessions}</span>
            </div>
          </div>
          <div>
            <p className="text-muted-foreground mb-0.5">Time</p>
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span className="font-medium tabular-nums">{formatDuration(user.totalSessionTime)}</span>
            </div>
          </div>
        </div>

        {/* Row 3: Bandwidth Boxes */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-md bg-muted/50 p-2">
            <p className="text-muted-foreground mb-1 flex items-center gap-1">
              <Download className="h-3 w-3" />
              Download
            </p>
            <p className="font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
              {formatBytes(user.totalDownloadBytes)}
            </p>
          </div>
          <div className="rounded-md bg-muted/50 p-2">
            <p className="text-muted-foreground mb-1 flex items-center gap-1">
              <Upload className="h-3 w-3" />
              Upload
            </p>
            <p className="font-medium tabular-nums text-amber-600 dark:text-amber-400">
              {formatBytes(user.totalUploadBytes)}
            </p>
          </div>
        </div>

        {/* Row 4: Last Seen */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarDays className="h-3 w-3" />
          <span>Last seen: {formatRelativeDate(user.lastSeen)}</span>
        </div>

        {/* Row 5: View Details Button */}
        <Button
          variant="outline"
          size="sm"
          className="w-full h-9 text-xs"
          onClick={() => openUserDetail(user.username)}
        >
          <Eye className="h-3.5 w-3.5 mr-1.5" />
          View Details
        </Button>
      </CardContent>
    </Card>
  );

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            User Usage Dashboard
          </h2>
          <p className="text-sm text-muted-foreground">
            Per-user aggregated bandwidth, sessions, and activity overview
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchSummary} disabled={isLoading}>
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
              <Users className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                {stats.totalUsers}
              </div>
              <div className="text-xs text-muted-foreground">Total Users</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <TrendingUp className="h-4 w-4 text-cyan-500 dark:text-cyan-400" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums">{formatBytes(stats.totalBandwidth)}</div>
              <div className="text-xs text-muted-foreground">Total Bandwidth</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <BarChart3 className="h-4 w-4 text-violet-500 dark:text-violet-400" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums">{formatBytes(stats.avgPerUser)}</div>
              <div className="text-xs text-muted-foreground">Avg Per User</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Crown className="h-4 w-4 text-amber-500 dark:text-amber-400" />
            </div>
            <div className="min-w-0">
              <div className="text-lg font-bold truncate" title={stats.topUser}>
                {stats.topUser}
              </div>
              <div className="text-xs text-muted-foreground">Top User</div>
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
                  placeholder="Search by username..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Content List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center px-4">
          <div className="rounded-full bg-muted/50 p-4 mb-3">
            <BarChart3 className="h-8 w-8 text-muted-foreground/40" />
          </div>
          <h3 className="text-sm font-medium text-muted-foreground">
            {searchQuery ? 'No matching users found' : 'No usage data available'}
          </h3>
          <p className="text-xs text-muted-foreground/60 mt-1">
            {searchQuery
              ? 'Try adjusting your search query'
              : 'Usage data will appear as users connect and consume bandwidth'}
          </p>
        </div>
      ) : (
        <>
          {/* Mobile: Card Layout */}
          <div className="space-y-3 sm:hidden">
            {filteredUsers.map((user, index) => (
              <UserCard key={user.username} user={user} index={index} />
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
                        <TableHead className="w-16">Rank</TableHead>
                        <TableHead>Username</TableHead>
                        <TableHead>Sessions</TableHead>
                        <TableHead>Active</TableHead>
                        <TableHead>Download</TableHead>
                        <TableHead>Upload</TableHead>
                        <TableHead>Session Time</TableHead>
                        <TableHead>Last Seen</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((user, index) => (
                        <TableRow
                          key={user.username}
                          className={cn(
                            index === 0 && 'bg-amber-50/50 dark:bg-amber-950/10',
                            index === 1 && 'bg-slate-50/50 dark:bg-slate-950/10',
                            index === 2 && 'bg-orange-50/30 dark:bg-orange-950/10'
                          )}
                        >
                          <TableCell>{getRankBadge(index)}</TableCell>
                          <TableCell>
                            <button
                              className="flex items-center gap-1.5 hover:text-primary transition-colors"
                              onClick={() => openUserDetail(user.username)}
                              title={`View details for ${user.username}`}
                            >
                              <UserCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="font-medium text-sm truncate max-w-[140px]">
                                {user.username}
                              </span>
                            </button>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm tabular-nums">{user.totalSessions}</span>
                          </TableCell>
                          <TableCell>
                            {user.activeSessions > 0 ? (
                              <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 text-xs">
                                <CircleDot className="h-3 w-3 mr-1" />
                                {user.activeSessions}
                              </Badge>
                            ) : (
                              <span className="text-sm text-muted-foreground">0</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm">
                              <Download className="h-3.5 w-3.5 text-emerald-500" />
                              <span className="tabular-nums">{formatBytes(user.totalDownloadBytes)}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm">
                              <Upload className="h-3.5 w-3.5 text-amber-500" />
                              <span className="tabular-nums">{formatBytes(user.totalUploadBytes)}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Clock className="h-3.5 w-3.5" />
                              <span className="tabular-nums">{formatDuration(user.totalSessionTime)}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <CalendarDays className="h-3 w-3" />
                              <span>{formatRelativeDate(user.lastSeen)}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs gap-1"
                              onClick={() => openUserDetail(user.username)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                              <span className="hidden lg:inline">Details</span>
                            </Button>
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

      {/* ─── User Detail Dialog ──────────────────────────────────────────────── */}
      <Dialog
        open={detailLoading || !!detailUser}
        onOpenChange={(open) => {
          if (!open) {
            setDetailUser(null);
            setDetailLoading(false);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCircle className="h-5 w-5" />
              {detailUser?.username ?? 'Loading...'}
            </DialogTitle>
            <DialogDescription>
              Session history and daily usage breakdown
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : detailUser ? (
            <div className="space-y-5 py-2">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Total Sessions</p>
                  <p className="text-lg font-bold tabular-nums">{detailUser.totalSessions}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Active Sessions</p>
                  <p className={cn(
                    'text-lg font-bold tabular-nums',
                    detailUser.activeSessions > 0 && 'text-emerald-600 dark:text-emerald-400'
                  )}>
                    {detailUser.activeSessions}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Total Download</p>
                  <p className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                    {formatBytes(detailUser.totalDownloadBytes)}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Total Upload</p>
                  <p className="text-lg font-bold tabular-nums text-amber-600 dark:text-amber-400">
                    {formatBytes(detailUser.totalUploadBytes)}
                  </p>
                </div>
              </div>

              {/* Daily Usage Breakdown (Bar Chart) */}
              {detailUser.dailyUsage && detailUser.dailyUsage.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    Daily Usage Breakdown (Last 30 Days)
                  </h4>
                  <Card>
                    <CardContent className="p-4">
                      <DailyBarChart entries={detailUser.dailyUsage} />
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Quick Actions — Disconnect All Active */}
              {detailUser.activeSessions > 0 && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      {detailUser.activeSessions} active session{detailUser.activeSessions > 1 ? 's' : ''}
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      You can disconnect individual sessions below or use the quick action.
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="shrink-0"
                    disabled={!!disconnectingId || disconnectingAll}
                    onClick={handleDisconnectAll}
                  >
                    {disconnectingAll || !!disconnectingId ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                        Disconnecting...
                      </>
                    ) : (
                      <>
                        <Unplug className="h-3.5 w-3.5 mr-1.5" />
                        Disconnect All
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* Sessions List */}
              <div>
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  All Sessions
                  <Badge variant="secondary" className="text-xs">
                    {detailUser.sessions?.length ?? 0}
                  </Badge>
                </h4>

                {!detailUser.sessions || detailUser.sessions.length === 0 ? (
                  <div className="text-center py-6 text-sm text-muted-foreground">
                    No session records found for this user.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {detailUser.sessions.map((session) => (
                      <div
                        key={session.id}
                        className={cn(
                          'flex items-center gap-3 p-3 rounded-lg border text-sm',
                          session.isActive
                            ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/10'
                            : 'border-border bg-muted/20'
                        )}
                      >
                        {/* Status indicator */}
                        <div>
                          {session.isActive ? (
                            <CircleDot className="h-4 w-4 text-emerald-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-muted-foreground/40" />
                          )}
                        </div>

                        {/* Session Info */}
                        <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-5 gap-x-4 gap-y-1">
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Started</p>
                            <p className="font-mono text-xs truncate" title={session.startedAt || undefined}>
                              {session.startedAt
                                ? new Date(session.startedAt).toLocaleString(undefined, {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    second: '2-digit',
                                  })
                                : '—'}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Ended</p>
                            <p className="font-mono text-xs truncate" title={session.endedAt || undefined}>
                              {session.endedAt
                                ? new Date(session.endedAt).toLocaleString(undefined, {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    second: '2-digit',
                                  })
                                : session.isActive
                                  ? <span className="text-emerald-600 dark:text-emerald-400">Active</span>
                                  : '—'}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Duration</p>
                            <p className="text-xs tabular-nums">{formatDuration(session.sessionTime)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Data</p>
                            <div className="flex items-center gap-2 text-xs">
                              <span className="flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400">
                                <Download className="h-2.5 w-2.5" />
                                {formatBytes(session.downloadBytes)}
                              </span>
                              <span className="flex items-center gap-0.5 text-amber-600 dark:text-amber-400">
                                <Upload className="h-2.5 w-2.5" />
                                {formatBytes(session.uploadBytes)}
                              </span>
                            </div>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">NAS</p>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Router className="h-3 w-3 shrink-0" />
                              <span className="truncate" title={session.nasIp}>
                                {session.nasIdentifier || session.nasIp || '—'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Disconnect Button (active only) */}
                        {session.isActive && (
                          <Button
                            variant="destructive"
                            size="sm"
                            className="h-7 text-xs shrink-0"
                            onClick={() => setDisconnectTarget(session)}
                            disabled={disconnectingId === session.id}
                          >
                            {disconnectingId === session.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Unplug className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDetailUser(null);
                setDetailLoading(false);
              }}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Disconnect Confirmation Dialog ──────────────────────────────────── */}
      <Dialog
        open={!!disconnectTarget}
        onOpenChange={(open) => {
          if (!open) setDisconnectTarget(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Unplug className="h-5 w-5 text-destructive" />
              Disconnect Session
            </DialogTitle>
            <DialogDescription>
              This will send a RADIUS CoA (Change of Authorization) message to terminate this
              session immediately.
            </DialogDescription>
          </DialogHeader>
          {disconnectTarget && (
            <div className="py-4 space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                <UserCircle className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium text-sm">{detailUser?.username || disconnectTarget.sessionId}</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {disconnectTarget.nasIdentifier || disconnectTarget.nasIp || '—'}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <p className="text-xs">
                  The user will lose internet access immediately. This action sends a real RADIUS
                  Disconnect Message to the NAS device.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisconnectTarget(null)} disabled={!!disconnectingId}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDisconnect} disabled={!!disconnectingId}>
              {disconnectingId ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Disconnecting...
                </>
              ) : (
                <>
                  <Unplug className="h-4 w-4 mr-2" />
                  Disconnect Now
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
