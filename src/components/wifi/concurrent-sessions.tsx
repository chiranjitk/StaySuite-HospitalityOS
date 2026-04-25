'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Shield, AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// ─── Types ──────────────────────────────────────────────────────────────────

/** Map of group name → max simultaneous sessions (0 = unlimited) */
interface SessionLimits {
  [groupName: string]: number;
}

/** A single concurrent-use violation entry */
interface Violation {
  username: string;
  group: string;
  activeSessions: number;
  maxSessions: number;
  nasIp?: string;
  calledStationId?: string;
  firstSeen?: string;
}

interface ViolationsResponse {
  success: boolean;
  data?: Violation[];
  error?: string;
}

interface LimitsResponse {
  success: boolean;
  data?: SessionLimits;
  error?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatLimit(limit: number): string {
  return limit === 0 ? 'Unlimited' : String(limit);
}

function timeAgo(dateStr?: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function ConcurrentSessions() {
  const { toast } = useToast();

  // Data state
  const [limits, setLimits] = useState<SessionLimits>({});
  const [violations, setViolations] = useState<Violation[]>([]);

  // Loading state
  const [isLoadingLimits, setIsLoadingLimits] = useState(true);
  const [isLoadingViolations, setIsLoadingViolations] = useState(true);
  const [isSaving, setIsSaving] = useState<string | null>(null); // groupName being saved

  // Edit dialog state
  const [editGroup, setEditGroup] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('0');
  const [dialogOpen, setDialogOpen] = useState(false);

  // Auto-refresh interval ref
  const violationsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch session limits ──────────────────────────────────────────────
  const fetchLimits = useCallback(async () => {
    setIsLoadingLimits(true);
    try {
      const res = await fetch('/api/wifi/radius?action=concurrent-sessions');
      const data: LimitsResponse = await res.json();
      if (data.success && data.data) {
        setLimits(data.data);
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to load session limits',
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('Failed to fetch concurrent session limits:', err);
      toast({
        title: 'Network Error',
        description: 'Could not reach the RADIUS service',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingLimits(false);
    }
  }, [toast]);

  // ── Fetch active violations ───────────────────────────────────────────
  const fetchViolations = useCallback(async () => {
    setIsLoadingViolations(true);
    try {
      const res = await fetch('/api/wifi/radius?action=concurrent-violations');
      const data: ViolationsResponse = await res.json();
      if (data.success && data.data) {
        setViolations(data.data);
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to load violations',
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('Failed to fetch concurrent violations:', err);
      toast({
        title: 'Network Error',
        description: 'Could not reach the RADIUS service',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingViolations(false);
    }
  }, [toast]);

  // ── Initial load & auto-refresh violations every 30 s ─────────────────
  useEffect(() => {
    fetchLimits();
    fetchViolations();

    violationsTimerRef.current = setInterval(() => {
      fetchViolations();
    }, 30_000);

    return () => {
      if (violationsTimerRef.current) {
        clearInterval(violationsTimerRef.current);
      }
    };
  }, [fetchLimits, fetchViolations]);

  // ── Open edit dialog ──────────────────────────────────────────────────
  const handleOpenEdit = (groupName: string, currentLimit: number) => {
    setEditGroup(groupName);
    setEditValue(currentLimit === 0 ? '' : String(currentLimit));
    setDialogOpen(true);
  };

  // ── Save limit ────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!editGroup) return;

    const maxSessions = editValue.trim() === '' ? 0 : parseInt(editValue, 10);
    if (isNaN(maxSessions) || maxSessions < 0) {
      toast({
        title: 'Invalid Value',
        description: 'Please enter a non-negative integer (0 for unlimited)',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(editGroup);
    try {
      const res = await fetch('/api/wifi/radius', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'concurrent-sessions',
          groupName: editGroup,
          maxSessions,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({
          title: 'Limit Updated',
          description: `Simultaneous-Use for "${editGroup}" set to ${formatLimit(maxSessions)}`,
        });
        setDialogOpen(false);
        // Refresh both limits and violations
        fetchLimits();
        fetchViolations();
      } else {
        toast({
          title: 'Update Failed',
          description: data.error || `Could not update limit for "${editGroup}"`,
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('Failed to save session limit:', err);
      toast({
        title: 'Network Error',
        description: 'Could not reach the RADIUS service',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(null);
    }
  };

  // ── Manual refresh all ────────────────────────────────────────────────
  const handleRefreshAll = () => {
    fetchLimits();
    fetchViolations();
  };

  // ── Derived data ──────────────────────────────────────────────────────
  const groupNames = Object.keys(limits).sort();
  const hasViolations = violations.length > 0;

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Page Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Concurrent Session Enforcement
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Configure Simultaneous-Use limits per RADIUS group and monitor active violations
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefreshAll}
          disabled={isLoadingLimits || isLoadingViolations}
        >
          <RefreshCw
            className={cn(
              'h-4 w-4 mr-1.5',
              (isLoadingLimits || isLoadingViolations) && 'animate-spin',
            )}
          />
          Refresh
        </Button>
      </div>

      {/* ── Summary Cards ────────────────────────────────────────────── */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        {/* Total Groups */}
        <Card className="py-4">
          <CardContent className="px-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {isLoadingLimits ? (
                    <Skeleton className="h-7 w-8 inline-block rounded" />
                  ) : (
                    groupNames.length
                  )}
                </div>
                <p className="text-xs text-muted-foreground">RADIUS Groups</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Limited Groups */}
        <Card className="py-4">
          <CardContent className="px-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <Shield className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {isLoadingLimits ? (
                    <Skeleton className="h-7 w-8 inline-block rounded" />
                  ) : (
                    groupNames.filter((g) => limits[g] > 0).length
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Limited Groups</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Violations */}
        <Card className="py-4">
          <CardContent className="px-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                'p-2 rounded-lg',
                hasViolations ? 'bg-red-500/10' : 'bg-muted/50',
              )}>
                <AlertTriangle className={cn(
                  'h-4 w-4',
                  hasViolations
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-muted-foreground/50',
                )} />
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {isLoadingViolations ? (
                    <Skeleton className="h-7 w-8 inline-block rounded" />
                  ) : (
                    violations.length
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Active Violations</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Session Limits Table ──────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">Simultaneous-Use Limits</CardTitle>
              <CardDescription>
                Set the maximum number of concurrent sessions allowed per group (0 = unlimited)
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoadingLimits ? (
            <div className="px-6 py-10 space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : groupNames.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-6">
              <div className="rounded-full bg-muted/50 p-4 mb-3">
                <Users className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <h3 className="text-sm font-medium text-muted-foreground">
                No RADIUS groups found
              </h3>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Groups will appear here once configured in your RADIUS server
              </p>
            </div>
          ) : (
            <ScrollArea className="max-h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Group Name</TableHead>
                    <TableHead className="text-center">Max Sessions</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right pr-6">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupNames.map((name) => {
                    const maxSessions = limits[name];
                    const isUnlimited = maxSessions === 0;
                    // Count violations for this specific group
                    const groupViolations = violations.filter(
                      (v) => v.group === name,
                    );

                    return (
                      <TableRow key={name}>
                        {/* Group Name */}
                        <TableCell className="pl-6">
                          <span className="font-mono text-sm font-medium">{name}</span>
                        </TableCell>

                        {/* Max Sessions */}
                        <TableCell className="text-center">
                          <span
                            className={cn(
                              'text-sm font-semibold',
                              isUnlimited && 'text-muted-foreground',
                            )}
                          >
                            {formatLimit(maxSessions)}
                          </span>
                        </TableCell>

                        {/* Status */}
                        <TableCell className="text-center">
                          {groupViolations.length > 0 ? (
                            <Badge variant="destructive" className="text-xs">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              {groupViolations.length} violation
                              {groupViolations.length !== 1 ? 's' : ''}
                            </Badge>
                          ) : isUnlimited ? (
                            <Badge variant="outline" className="text-xs">
                              No Limit
                            </Badge>
                          ) : (
                            <Badge variant="success" className="text-xs">
                              Enforced
                            </Badge>
                          )}
                        </TableCell>

                        {/* Action */}
                        <TableCell className="text-right pr-6">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEdit(name, maxSessions)}
                          >
                            Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* ── Active Violations Section ─────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500 dark:text-red-400" />
                Active Violations
              </CardTitle>
              <CardDescription>
                Users who currently exceed their group's Simultaneous-Use limit
              </CardDescription>
            </div>
            {hasViolations && (
              <Badge variant="destructive" className="w-fit text-xs">
                Auto-refreshes every 30 s
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoadingViolations ? (
            <div className="px-6 py-10 space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : !hasViolations ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-6">
              <div className="rounded-full bg-emerald-500/10 p-4 mb-3">
                <Shield className="h-8 w-8 text-emerald-500 dark:text-emerald-400/60" />
              </div>
              <h3 className="text-sm font-medium text-muted-foreground">
                No active violations
              </h3>
              <p className="text-xs text-muted-foreground/60 mt-1">
                All users are within their concurrent session limits
              </p>
            </div>
          ) : (
            <ScrollArea className="max-h-[360px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">User</TableHead>
                    <TableHead>Group</TableHead>
                    <TableHead className="text-center">Active Sessions</TableHead>
                    <TableHead className="text-center">Limit</TableHead>
                    <TableHead className="hidden md:table-cell">NAS IP</TableHead>
                    <TableHead className="hidden lg:table-cell">First Seen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {violations.map((v, idx) => {
                    const overage = v.activeSessions - v.maxSessions;
                    return (
                      <TableRow key={`${v.username}-${v.group}-${idx}`}>
                        {/* Username */}
                        <TableCell className="pl-6">
                          <span className="font-mono text-sm font-medium">
                            {v.username}
                          </span>
                        </TableCell>

                        {/* Group */}
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {v.group}
                          </Badge>
                        </TableCell>

                        {/* Active Sessions */}
                        <TableCell className="text-center">
                          <Badge variant="destructive" className="text-xs">
                            {v.activeSessions}
                          </Badge>
                        </TableCell>

                        {/* Limit */}
                        <TableCell className="text-center">
                          <span className="text-sm text-muted-foreground">
                            {formatLimit(v.maxSessions)}
                          </span>
                        </TableCell>

                        {/* NAS IP */}
                        <TableCell className="hidden md:table-cell">
                          <span className="font-mono text-xs text-muted-foreground">
                            {v.nasIp || '\u2014'}
                          </span>
                        </TableCell>

                        {/* First Seen */}
                        <TableCell className="hidden lg:table-cell">
                          <span className="text-xs text-muted-foreground">
                            {v.firstSeen ? timeAgo(v.firstSeen) : '\u2014'}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* ── Edit Limit Dialog ──────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={(open) => setDialogOpen(open)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Simultaneous-Use Limit</DialogTitle>
            <DialogDescription>
              Set the maximum concurrent sessions for the{' '}
              <span className="font-mono font-semibold">{editGroup}</span> group.
              Enter <span className="font-mono font-semibold">0</span> to allow
              unlimited sessions.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {/* Current limit info */}
            {editGroup && limits[editGroup] !== undefined && (
              <div className="rounded-lg border bg-muted/30 px-4 py-3">
                <p className="text-xs text-muted-foreground">Current Limit</p>
                <p className="text-lg font-semibold">
                  {formatLimit(limits[editGroup])}
                </p>
              </div>
            )}

            {/* Input */}
            <div className="space-y-2">
              <label
                htmlFor="max-sessions-input"
                className="text-sm font-medium leading-none"
              >
                Max Sessions
              </label>
              <Input
                id="max-sessions-input"
                type="number"
                min={0}
                placeholder="0 for unlimited"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="h-10"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Accepts 0 (unlimited) or any positive integer.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={isSaving !== null}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving !== null}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
