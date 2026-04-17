'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
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
import { Progress } from '@/components/ui/progress';
import {
  Gauge,
  Search,
  Loader2,
  Users,
  AlertTriangle,
  Database,
  BarChart3,
  RefreshCw,
  RotateCcw,
  Ban,
  Eye,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { usePropertyId } from '@/hooks/use-property';

// ─── Types ──────────────────────────────────────────────────────────────────

interface QuotaUser {
  id: string;
  username: string;
  guestName: string | null;
  planName: string;
  dataUsed: number;
  dataLimit: number | null;
  percentUsed: number;
  activeSessions: number;
  sessionLimit: number | null;
  maxSessions: number;
  status: string;
  overQuota: boolean;
  createdAt: string;
}

interface QuotaSummary {
  totalUsers: number;
  activeUsers: number;
  overQuotaUsers: number;
  suspendedUsers: number;
  totalDataUsedMB: number;
  avgUsagePerUser: number;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const statusFilters = [
  { value: 'all', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'over-quota', label: 'Over Quota' },
  { value: 'suspended', label: 'Suspended' },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDataUsage(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  return `${mb.toFixed(0)} MB`;
}

function getProgressColor(percent: number): string {
  if (percent > 85) return 'bg-red-500';
  if (percent >= 60) return 'bg-amber-500';
  return 'bg-emerald-500';
}

function getProgressTextColor(percent: number): string {
  if (percent > 85) return 'text-red-600 dark:text-red-400';
  if (percent >= 60) return 'text-amber-600 dark:text-amber-400';
  return 'text-emerald-600 dark:text-emerald-400';
}

function getStatusBadge(status: string, overQuota: boolean) {
  if (overQuota) {
    return (
      <Badge variant="secondary" className="bg-red-500 text-white">
        Over Quota
      </Badge>
    );
  }
  switch (status) {
    case 'active':
      return (
        <Badge variant="secondary" className="bg-emerald-500 text-white">
          Active
        </Badge>
      );
    case 'suspended':
      return (
        <Badge variant="secondary" className="bg-gray-500 text-white">
          Suspended
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="capitalize">
          {status}
        </Badge>
      );
  }
}

// ─── Component ──────────────────────────────────────────────────────────────

export function UserQuotas() {
  const { toast } = useToast();
  const { propertyId } = usePropertyId();

  const [users, setUsers] = useState<QuotaUser[]>([]);
  const [summary, setSummary] = useState<QuotaSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEnforcing, setIsEnforcing] = useState(false);
  const [isResetting, setIsResetting] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Detail dialog
  const [detailUser, setDetailUser] = useState<QuotaUser | null>(null);

  // Suspend confirmation dialog
  const [suspendUser, setSuspendUser] = useState<QuotaUser | null>(null);
  const [isSuspending, setIsSuspending] = useState(false);

  // ── Fetch quota data ────────────────────────────────────────────────
  const fetchQuotas = useCallback(async () => {
    if (!propertyId) return;
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ propertyId });
      const response = await fetch(`/api/wifi/quotas?${params.toString()}`);
      const result = await response.json();
      if (result.success) {
        setUsers(result.data);
        setSummary(result.summary);
      }
    } catch (error) {
      console.error('Error fetching quotas:', error);
      toast({ title: 'Error', description: 'Failed to fetch quota data', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [propertyId, toast]);

  useEffect(() => {
    fetchQuotas();
  }, [fetchQuotas]);

  // ── Enforce limits ──────────────────────────────────────────────────
  const handleEnforceLimits = async () => {
    if (!propertyId) return;
    setIsEnforcing(true);
    try {
      const params = new URLSearchParams({ propertyId });
      const response = await fetch(`/api/wifi/quotas?${params.toString()}`, { method: 'POST' });
      const result = await response.json();
      if (result.success) {
        toast({
          title: 'Enforcement Complete',
          description: result.message || 'Quota enforcement finished',
        });
        fetchQuotas();
      } else {
        toast({ title: 'Error', description: result.error || 'Failed to enforce limits', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error enforcing limits:', error);
      toast({ title: 'Error', description: 'Failed to enforce limits', variant: 'destructive' });
    } finally {
      setIsEnforcing(false);
    }
  };

  // ── Reset usage for a single user ───────────────────────────────────
  const handleResetUsage = async (userId: string) => {
    setIsResetting(userId);
    try {
      const response = await fetch(`/api/wifi/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset_usage' }),
      });
      const result = await response.json();
      if (result.success) {
        toast({ title: 'Success', description: 'Data usage reset successfully' });
        fetchQuotas();
      } else {
        toast({ title: 'Error', description: result.error || 'Failed to reset usage', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error resetting usage:', error);
      toast({ title: 'Error', description: 'Failed to reset usage', variant: 'destructive' });
    } finally {
      setIsResetting(null);
    }
  };

  // ── Suspend user ────────────────────────────────────────────────────
  const handleSuspendUser = async () => {
    if (!suspendUser) return;
    setIsSuspending(true);
    try {
      const response = await fetch(`/api/wifi/users/${suspendUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'suspended' }),
      });
      const result = await response.json();
      if (result.success) {
        toast({ title: 'Success', description: 'User suspended successfully' });
        setSuspendUser(null);
        fetchQuotas();
      } else {
        toast({ title: 'Error', description: result.error || 'Failed to suspend user', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error suspending user:', error);
      toast({ title: 'Error', description: 'Failed to suspend user', variant: 'destructive' });
    } finally {
      setIsSuspending(false);
    }
  };

  // ── Filtered users ──────────────────────────────────────────────────
  const filteredUsers = users.filter((u) => {
    // Status filter
    if (statusFilter === 'over-quota' && !u.overQuota) return false;
    if (statusFilter === 'suspended' && u.status !== 'suspended') return false;
    if (statusFilter === 'active' && u.status !== 'active') return false;
    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        u.username.toLowerCase().includes(q) ||
        (u.guestName && u.guestName.toLowerCase().includes(q)) ||
        u.planName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Gauge className="h-5 w-5" />
            User Quotas
          </h2>
          <p className="text-sm text-muted-foreground">
            Monitor data usage, enforce limits, and manage user bandwidth quotas
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchQuotas} disabled={isLoading}>
            <RefreshCw className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={handleEnforceLimits}
            disabled={isEnforcing}
            className="bg-teal-600 hover:bg-teal-700 text-white"
          >
            {isEnforcing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <ShieldCheck className="h-4 w-4 mr-2" />
            )}
            Enforce Limits
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <Users className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{summary?.activeUsers ?? 0}</div>
              <div className="text-xs text-muted-foreground">Active Users</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-red-500/10">
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{summary?.overQuotaUsers ?? 0}</div>
              <div className="text-xs text-muted-foreground">Over Quota</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <Database className="h-4 w-4 text-violet-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{summary ? formatDataUsage(summary.totalDataUsedMB) : '0 MB'}</div>
              <div className="text-xs text-muted-foreground">Total Data Today</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <BarChart3 className="h-4 w-4 text-cyan-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">
                {summary ? formatDataUsage(summary.avgUsagePerUser) : '0 MB'}
              </div>
              <div className="text-xs text-muted-foreground">Avg Per User</div>
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
                  placeholder="Search by username, guest name, or plan..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                {statusFilters.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Quota Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted/50 p-4 mb-3">
                <Gauge className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <h3 className="text-sm font-medium text-muted-foreground">
                {searchQuery || statusFilter !== 'all'
                  ? 'No matching users found'
                  : 'No WiFi users found'}
              </h3>
              <p className="text-xs text-muted-foreground/60 mt-1">
                {searchQuery || statusFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'WiFi users will appear here once created'}
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead>Guest</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead className="min-w-[160px]">Data Used</TableHead>
                    <TableHead>Sessions</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((u) => (
                    <TableRow key={u.id}>
                      {/* Username */}
                      <TableCell>
                        <p className="font-mono text-sm font-medium">{u.username}</p>
                      </TableCell>

                      {/* Guest Name */}
                      <TableCell>
                        <p className="text-sm">{u.guestName || '—'}</p>
                      </TableCell>

                      {/* Plan */}
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {u.planName}
                        </Badge>
                      </TableCell>

                      {/* Data Used / Limit */}
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">{formatDataUsage(u.dataUsed)}</span>
                            {u.dataLimit && (
                              <span className="text-muted-foreground text-xs">
                                / {formatDataUsage(u.dataLimit)}
                              </span>
                            )}
                          </div>
                          {u.dataLimit ? (
                            <>
                              <div className="relative h-2 w-full rounded-full bg-muted overflow-hidden">
                                <div
                                  className={cn(
                                    'absolute inset-y-0 left-0 rounded-full transition-all duration-300',
                                    getProgressColor(u.percentUsed)
                                  )}
                                  style={{ width: `${Math.min(100, u.percentUsed)}%` }}
                                />
                              </div>
                              <p className={cn('text-xs font-medium', getProgressTextColor(u.percentUsed))}>
                                {u.percentUsed}%
                              </p>
                            </>
                          ) : (
                            <p className="text-xs text-muted-foreground">Unlimited</p>
                          )}
                        </div>
                      </TableCell>

                      {/* Sessions */}
                      <TableCell>
                        <div>
                          <span className="text-sm font-medium">{u.activeSessions}</span>
                          <span className="text-xs text-muted-foreground"> / {u.maxSessions}</span>
                        </div>
                      </TableCell>

                      {/* Status */}
                      <TableCell>{getStatusBadge(u.status, u.overQuota)}</TableCell>

                      {/* Actions */}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDetailUser(u)}
                            title="View details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleResetUsage(u.id)}
                            disabled={isResetting === u.id}
                            title="Reset usage"
                          >
                            {isResetting === u.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RotateCcw className="h-4 w-4" />
                            )}
                          </Button>
                          {u.status === 'active' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSuspendUser(u)}
                              title="Suspend user"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                            >
                              <Ban className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* ── View Details Dialog ───────────────────────────────────────── */}
      <Dialog open={!!detailUser} onOpenChange={() => setDetailUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Quota Details</DialogTitle>
            <DialogDescription>Detailed quota information for this user</DialogDescription>
          </DialogHeader>
          {detailUser && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Username</p>
                  <p className="font-mono text-sm font-medium">{detailUser.username}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Guest</p>
                  <p className="text-sm">{detailUser.guestName || '—'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Plan</p>
                  <p className="text-sm font-medium">{detailUser.planName}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Status</p>
                  {getStatusBadge(detailUser.status, detailUser.overQuota)}
                </div>
              </div>
              <div className="border-t pt-4 space-y-3">
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Data Used</span>
                    <span className="font-medium">{formatDataUsage(detailUser.dataUsed)}</span>
                  </div>
                  {detailUser.dataLimit && (
                    <>
                      <div className="relative h-3 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn(
                            'absolute inset-y-0 left-0 rounded-full transition-all duration-300',
                            getProgressColor(detailUser.percentUsed)
                          )}
                          style={{ width: `${Math.min(100, detailUser.percentUsed)}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {detailUser.percentUsed}% of {formatDataUsage(detailUser.dataLimit)} limit
                      </p>
                    </>
                  )}
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Active Sessions</span>
                  <span className="font-medium">
                    {detailUser.activeSessions} / {detailUser.maxSessions}
                  </span>
                </div>
                {detailUser.sessionLimit && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Session Limit</span>
                    <span className="font-medium">{detailUser.sessionLimit} min</span>
                  </div>
                )}
              </div>
              {detailUser.overQuota && (
                <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-red-700 dark:text-red-400 text-sm font-medium">
                    <AlertTriangle className="h-4 w-4" />
                    Over Data Limit
                  </div>
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    This user has consumed {detailUser.percentUsed}% of their allocated data limit.
                    Consider resetting their usage or suspending their access.
                  </p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailUser(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Suspend Confirmation Dialog ──────────────────────────────── */}
      <Dialog open={!!suspendUser} onOpenChange={() => setSuspendUser(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Suspend User</DialogTitle>
            <DialogDescription>
              Are you sure you want to suspend <span className="font-mono font-semibold">{suspendUser?.username}</span>?
              Their WiFi access will be disabled immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendUser(null)} disabled={isSuspending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleSuspendUser} disabled={isSuspending}>
              {isSuspending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Suspend
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
