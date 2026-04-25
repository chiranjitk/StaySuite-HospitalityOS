'use client';

/**
 * FupDashboard -- Real-time Fair Usage Policy monitoring dashboard.
 *
 * Displays FUP enforcement status across active sessions:
 *  - Top stats: active policies, monitored users, throttled users, at-risk, bandwidth saved
 *  - Per-policy breakdown cards with usage progress bars
 *  - Top data consumers table sorted by usage
 *  - Auto-refresh every 30 seconds with manual refresh and last-updated timestamp
 *
 * Data sources:
 *  - /api/wifi/radius?action=fap-policies-list
 *  - /api/wifi/radius?action=live-sessions-list
 *  - /api/wifi/plans (to map planId → fupPolicyId)
 *
 * Client-side comparison: session bytes vs policy dataLimitMb.
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Gauge,
  AlertTriangle,
  TrendingUp,
  Users,
  BarChart3,
  RefreshCw,
  Clock,
  Shield,
  Zap,
  ArrowDownToLine,
  ArrowUpFromLine,
  Sun,
  Calendar,
  CalendarRange,
  Activity,
  Database,
  WifiOff,
  TriangleAlert,
  Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FupPolicy {
  id: string;
  name: string;
  description?: string | null;
  cycleType: 'daily' | 'weekly' | 'monthly';
  dataLimitMb: number;
  dataLimitUnit: 'mb' | 'gb';
  applicableOn: 'total' | 'download' | 'upload';
  isEnabled: boolean;
  switchOverBwPolicyId?: string | null;
  priority: number;
}

interface LiveSession {
  id: string;
  username: string;
  planId?: string;
  planName?: string;
  // The freeradius-service returns these byte counters
  currentInputBytes?: number;
  currentOutputBytes?: number;
  // The existing live-sessions component uses these
  dataDownload?: number;
  dataUpload?: number;
  sessionTime?: number;
  status?: string;
  ipAddress?: string;
  macAddress?: string;
  startedAt?: string;
  [key: string]: unknown;
}

interface WiFiPlan {
  id: string;
  name: string;
  fupPolicyId: string | null;
  fupPolicyName?: string;
  downloadSpeed: number;
  uploadSpeed: number;
  dataLimit?: number | null;
}

type UsageStatus = 'normal' | 'warning' | 'critical' | 'throttled';

interface MonitoredUser {
  session: LiveSession;
  policy: FupPolicy;
  planName: string;
  usedBytes: number;
  limitBytes: number;
  usagePercent: number;
  status: UsageStatus;
}

interface PolicyBreakdown {
  policy: FupPolicy;
  totalUsers: number;
  totalUsedBytes: number;
  totalLimitBytes: number;
  overallPercent: number;
  users: MonitoredUser[];
  below50: number;
  between50and80: number;
  between80and100: number;
  exceeded: number;
}

// ---------------------------------------------------------------------------
// Constants & Helpers
// ---------------------------------------------------------------------------

const REFRESH_INTERVAL_MS = 30_000;

function getPolicyLimitBytes(policy: FupPolicy): number {
  // dataLimitMb is the numeric value; dataLimitUnit says mb or gb
  return policy.dataLimitUnit === 'gb'
    ? policy.dataLimitMb * 1024 * 1024 * 1024
    : policy.dataLimitMb * 1024 * 1024;
}

function getSessionTotalBytes(session: LiveSession, applicableOn: string): number {
  const inputBytes = session.currentInputBytes ?? session.dataDownload ?? 0;
  const outputBytes = session.currentOutputBytes ?? session.dataUpload ?? 0;

  if (applicableOn === 'download') return inputBytes;
  if (applicableOn === 'upload') return outputBytes;
  return inputBytes + outputBytes;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${Math.round(bytes)} B`;
}

function formatDataLimit(mb: number, unit: 'mb' | 'gb'): string {
  if (unit === 'gb') return `${mb} GB`;
  if (mb >= 1024) return `${(mb / 1024).toFixed(1).replace(/\.0$/, '')} GB`;
  return `${mb} MB`;
}

function getCycleLabel(cycleType: string): string {
  switch (cycleType) {
    case 'daily': return 'Daily';
    case 'weekly': return 'Weekly';
    case 'monthly': return 'Monthly';
    default: return cycleType;
  }
}

function getCycleIcon(cycleType: string) {
  switch (cycleType) {
    case 'daily': return <Sun className="h-3.5 w-3.5" />;
    case 'weekly': return <Calendar className="h-3.5 w-3.5" />;
    case 'monthly': return <CalendarRange className="h-3.5 w-3.5" />;
    default: return <Clock className="h-3.5 w-3.5" />;
  }
}

function getUsageStatus(percent: number): UsageStatus {
  if (percent >= 100) return 'throttled';
  if (percent >= 80) return 'critical';
  if (percent >= 50) return 'warning';
  return 'normal';
}

function getProgressColorClass(percent: number): string {
  if (percent >= 100) return '[&>[data-slot=progress-indicator]]:bg-red-500';
  if (percent >= 80) return '[&>[data-slot=progress-indicator]]:bg-orange-500';
  if (percent >= 50) return '[&>[data-slot=progress-indicator]]:bg-amber-500';
  return '[&>[data-slot=progress-indicator]]:bg-emerald-500';
}

function getProgressTrackClass(percent: number): string {
  if (percent >= 100) return '[&>[data-slot=progress]]:bg-red-500/20';
  if (percent >= 80) return '[&>[data-slot=progress]]:bg-orange-500/20';
  if (percent >= 50) return '[&>[data-slot=progress]]:bg-amber-500/20';
  return '[&>[data-slot=progress]]:bg-emerald-500/20';
}

function formatTimeRemaining(startedAt?: string, cycleType?: string): string {
  if (!startedAt) return '—';
  // Estimate remaining time based on cycle type
  const now = new Date();
  const start = new Date(startedAt);
  const elapsedMs = now.getTime() - start.getTime();

  switch (cycleType) {
    case 'daily': {
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);
      const remainingMs = endOfDay.getTime() - now.getTime();
      if (remainingMs <= 0) return 'Resets soon';
      const hours = Math.floor(remainingMs / 3600000);
      const mins = Math.floor((remainingMs % 3600000) / 60000);
      return `${hours}h ${mins}m`;
    }
    case 'weekly': {
      const endOfWeek = new Date(now);
      const dayOfWeek = endOfWeek.getDay();
      endOfWeek.setDate(endOfWeek.getDate() + (7 - dayOfWeek));
      endOfWeek.setHours(23, 59, 59, 999);
      const remainingMs = endOfWeek.getTime() - now.getTime();
      if (remainingMs <= 0) return 'Resets soon';
      const days = Math.floor(remainingMs / 86400000);
      const hours = Math.floor((remainingMs % 86400000) / 3600000);
      return days > 0 ? `${days}d ${hours}h` : `${hours}h`;
    }
    case 'monthly': {
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      const remainingMs = endOfMonth.getTime() - now.getTime();
      if (remainingMs <= 0) return 'Resets soon';
      const days = Math.floor(remainingMs / 86400000);
      const hours = Math.floor((remainingMs % 86400000) / 3600000);
      return days > 0 ? `${days}d ${hours}h` : `${hours}h`;
    }
    default:
      return '—';
  }
}

function getStatusBadge(status: UsageStatus) {
  switch (status) {
    case 'throttled':
      return (
        <Badge className="bg-red-500 hover:bg-red-600 text-white border-0 text-xs gap-1">
          <WifiOff className="h-3 w-3" />
          Throttled
        </Badge>
      );
    case 'critical':
      return (
        <Badge className="bg-orange-500 hover:bg-orange-600 text-white border-0 text-xs gap-1">
          <AlertTriangle className="h-3 w-3" />
          Critical
        </Badge>
      );
    case 'warning':
      return (
        <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-0 text-xs gap-1">
          <TriangleAlert className="h-3 w-3" />
          Warning
        </Badge>
      );
    default:
      return (
        <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 text-xs gap-1">
          <Activity className="h-3 w-3" />
          Normal
        </Badge>
      );
  }
}

// ---------------------------------------------------------------------------
// Loading Skeleton Components
// ---------------------------------------------------------------------------

function StatsSkeleton() {
  return (
    <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i} className="p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-7 w-12" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function PolicyCardSkeleton() {
  return (
    <Card className="p-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-14" />
        </div>
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-2.5 w-full" />
        <div className="flex gap-4">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
    </Card>
  );
}

function TableSkeleton() {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="p-4 space-y-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-2.5 w-full" />
        </div>
        <div className="space-y-0">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3 border-b last:border-0">
              <Skeleton className="h-4 w-8" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function FupDashboard() {
  const { toast } = useToast();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── State ────────────────────────────────────────────────────────────
  const [policies, setPolicies] = useState<FupPolicy[]>([]);
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [plans, setPlans] = useState<WiFiPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // ─── Data Fetching ────────────────────────────────────────────────────

  const fetchAllData = useCallback(async (isBackground = false) => {
    if (!isBackground) setIsLoading(true);
    if (isBackground) setIsRefreshing(true);

    try {
      const [policyRes, sessionRes, planRes] = await Promise.all([
        fetch('/api/wifi/radius?action=fap-policies-list'),
        fetch('/api/wifi/radius?action=live-sessions-list'),
        fetch('/api/wifi/plans'),
      ]);

      const [policyData, sessionData, planData] = await Promise.all([
        policyRes.json(),
        sessionRes.json(),
        planRes.json(),
      ]);

      if (policyData.success && Array.isArray(policyData.data)) {
        setPolicies(policyData.data);
      } else {
        setPolicies([]);
      }

      if (sessionData.success && Array.isArray(sessionData.data)) {
        setSessions(sessionData.data);
      } else {
        setSessions([]);
      }

      // Plans can be in data.data or data directly
      const plansList = Array.isArray(planData?.data?.data)
        ? planData.data.data
        : Array.isArray(planData?.data)
          ? planData.data
          : [];
      setPlans(plansList);

      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to fetch FUP dashboard data:', error);
      if (!isBackground) {
        toast({
          title: 'Error',
          description: 'Failed to load dashboard data',
          variant: 'destructive',
        });
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      fetchAllData(true);
    }, REFRESH_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchAllData]);

  // ─── Computed: Map plans to policies ──────────────────────────────────

  const activePolicies = useMemo(
    () => policies.filter((p) => p.isEnabled),
    [policies],
  );

  // Map: fupPolicyId → policy
  const policyMap = useMemo(() => {
    const map = new Map<string, FupPolicy>();
    for (const p of policies) {
      map.set(p.id, p);
    }
    return map;
  }, [policies]);

  // Map: planId → fupPolicyId
  const planFupMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const plan of plans) {
      if (plan.fupPolicyId) {
        map.set(plan.id, plan.fupPolicyId);
      }
    }
    return map;
  }, [plans]);

  // Map: planId → planName
  const planNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const plan of plans) {
      map.set(plan.id, plan.name);
    }
    return map;
  }, [plans]);

  // ─── Computed: Monitored Users ────────────────────────────────────────

  const monitoredUsers = useMemo<MonitoredUser[]>(() => {
    const users: MonitoredUser[] = [];

    for (const session of sessions) {
      // Try to find FUP policy via planId
      let fupPolicyId: string | null = null;
      let matchedPlanName: string = session.planName || 'Unknown';

      if (session.planId && planFupMap.has(session.planId)) {
        fupPolicyId = planFupMap.get(session.planId) || null;
        matchedPlanName = planNameMap.get(session.planId) || session.planName || 'Unknown';
      }

      // Also try matching by planName if planId didn't work
      if (!fupPolicyId && session.planName) {
        const matchedPlan = plans.find(
          (p) => p.name === session.planName && p.fupPolicyId,
        );
        if (matchedPlan) {
          fupPolicyId = matchedPlan.fupPolicyId;
          matchedPlanName = matchedPlan.name;
        }
      }

      if (!fupPolicyId) continue;

      const policy = policyMap.get(fupPolicyId);
      if (!policy || !policy.isEnabled) continue;

      const usedBytes = getSessionTotalBytes(session, policy.applicableOn);
      const limitBytes = getPolicyLimitBytes(policy);
      const usagePercent = limitBytes > 0 ? Math.min((usedBytes / limitBytes) * 100, 999) : 0;

      users.push({
        session,
        policy,
        planName: matchedPlanName,
        usedBytes,
        limitBytes,
        usagePercent,
        status: getUsageStatus(usagePercent),
      });
    }

    return users;
  }, [sessions, plans, planFupMap, planNameMap, policyMap]);

  // ─── Computed: Stats ──────────────────────────────────────────────────

  const stats = useMemo(() => {
    const throttled = monitoredUsers.filter((u) => u.status === 'throttled').length;
    const atRisk = monitoredUsers.filter((u) => u.status === 'critical').length;
    return {
      activePolicies: activePolicies.length,
      usersMonitored: monitoredUsers.length,
      usersThrottled: throttled,
      usersAtRisk: atRisk,
    };
  }, [activePolicies, monitoredUsers]);

  // ─── Computed: Policy Breakdowns ──────────────────────────────────────

  const policyBreakdowns = useMemo<PolicyBreakdown[]>(() => {
    const breakdownMap = new Map<string, MonitoredUser[]>();

    for (const user of monitoredUsers) {
      const existing = breakdownMap.get(user.policy.id) || [];
      existing.push(user);
      breakdownMap.set(user.policy.id, existing);
    }

    return Array.from(breakdownMap.entries()).map(([policyId, users]) => {
      const policy = policyMap.get(policyId)!;
      const totalLimitBytes = getPolicyLimitBytes(policy);
      const totalUsedBytes = users.reduce((sum, u) => sum + u.usedBytes, 0);
      const overallPercent = totalLimitBytes > 0
        ? Math.min((totalUsedBytes / totalLimitBytes) * 100, 999)
        : 0;

      return {
        policy,
        totalUsers: users.length,
        totalUsedBytes,
        totalLimitBytes,
        overallPercent,
        users,
        below50: users.filter((u) => u.usagePercent < 50).length,
        between50and80: users.filter((u) => u.usagePercent >= 50 && u.usagePercent < 80).length,
        between80and100: users.filter((u) => u.usagePercent >= 80 && u.usagePercent < 100).length,
        exceeded: users.filter((u) => u.usagePercent >= 100).length,
      };
    }).sort((a, b) => b.overallPercent - a.overallPercent);
  }, [monitoredUsers, policyMap]);

  // ─── Computed: Top Consumers (sorted desc by usage) ───────────────────

  const topConsumers = useMemo(() => {
    return [...monitoredUsers].sort((a, b) => b.usagePercent - a.usagePercent);
  }, [monitoredUsers]);

  // ─── Format Helpers ───────────────────────────────────────────────────

  const formatLastUpdated = (date: Date | null): string => {
    if (!date) return 'Never';
    return date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const cycleSinceStart = (cycleType: string, startedAt?: string): string => {
    if (!startedAt) return '—';
    const start = new Date(startedAt);
    const now = new Date();
    const elapsedMs = now.getTime() - start.getTime();
    const hours = Math.floor(elapsedMs / 3600000);
    const mins = Math.floor((elapsedMs % 3600000) / 60000);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ─── Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            FUP Dashboard
          </h2>
          <p className="text-sm text-muted-foreground">
            Real-time fair usage policy enforcement monitoring
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>Updated {formatLastUpdated(lastUpdated)}</span>
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchAllData()}
            disabled={isRefreshing}
          >
            <RefreshCw className={cn('h-4 w-4 mr-2', isRefreshing && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {/* ─── Top Stats Row (5 cards) ────────────────────────────────── */}
      {isLoading ? (
        <StatsSkeleton />
      ) : (
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          {/* Active Policies */}
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <Shield className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
              </div>
              <div>
                <div className="text-2xl font-bold tabular-nums">{stats.activePolicies}</div>
                <div className="text-xs text-muted-foreground">Active Policies</div>
              </div>
            </div>
          </Card>

          {/* Users Monitored */}
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-teal-500/10">
                <Users className="h-5 w-5 text-teal-500 dark:text-teal-400" />
              </div>
              <div>
                <div className="text-2xl font-bold tabular-nums">{stats.usersMonitored}</div>
                <div className="text-xs text-muted-foreground">Users Monitored</div>
              </div>
            </div>
          </Card>

          {/* Users Throttled */}
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Zap className="h-5 w-5 text-amber-500 dark:text-amber-400" />
              </div>
              <div>
                <div className="text-2xl font-bold tabular-nums">{stats.usersThrottled}</div>
                <div className="text-xs text-muted-foreground">Users Throttled</div>
              </div>
            </div>
          </Card>

          {/* Users at 80%+ */}
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <AlertTriangle className="h-5 w-5 text-orange-500 dark:text-orange-400" />
              </div>
              <div>
                <div className="text-2xl font-bold tabular-nums">{stats.usersAtRisk}</div>
                <div className="text-xs text-muted-foreground">Users at 80%+</div>
              </div>
            </div>
          </Card>

          {/* Bandwidth Saved */}
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <TrendingUp className="h-5 w-5 text-purple-500 dark:text-purple-400" />
              </div>
              <div>
                <div className="text-2xl font-bold">—</div>
                <div className="text-xs text-muted-foreground">BW Saved</div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ─── Per-Policy Breakdown Section ───────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Gauge className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Per-Policy Breakdown</h3>
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <PolicyCardSkeleton key={i} />
            ))}
          </div>
        ) : policyBreakdowns.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted/50 p-4 mb-3">
                <Gauge className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <h3 className="text-sm font-medium text-muted-foreground">
                {activePolicies.length === 0
                  ? 'No active FUP policies'
                  : 'No monitored users found'}
              </h3>
              <p className="text-xs text-muted-foreground/60 mt-1">
                {activePolicies.length === 0
                  ? 'Enable a FUP policy and link it to a WiFi plan to see enforcement data'
                  : 'No active sessions are linked to plans with FUP policies'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {policyBreakdowns.map((breakdown) => {
              const clampedPercent = Math.min(breakdown.overallPercent, 100);
              return (
                <Card key={breakdown.policy.id} className="p-4">
                  {/* Header: name + cycle badge */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-semibold truncate">{breakdown.policy.name}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDataLimit(breakdown.policy.dataLimitMb, breakdown.policy.dataLimitUnit)} / {getCycleLabel(breakdown.policy.cycleType).toLowerCase()}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="shrink-0 ml-2 text-xs gap-1"
                    >
                      {getCycleIcon(breakdown.policy.cycleType)}
                      {getCycleLabel(breakdown.policy.cycleType)}
                    </Badge>
                  </div>

                  {/* Overall usage progress */}
                  <div className="space-y-1.5 mb-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Total Usage</span>
                      <span className="font-medium tabular-nums">
                        {formatBytes(breakdown.totalUsedBytes)} / {formatBytes(breakdown.totalLimitBytes)}
                      </span>
                    </div>
                    <div className={cn('relative', getProgressTrackClass(breakdown.overallPercent))}>
                      <Progress
                        value={clampedPercent}
                        className={cn('h-2', getProgressColorClass(breakdown.overallPercent))}
                      />
                    </div>
                    <div className="text-right text-xs text-muted-foreground tabular-nums">
                      {breakdown.overallPercent.toFixed(1)}% aggregate
                    </div>
                  </div>

                  {/* User count */}
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
                    <Users className="h-3.5 w-3.5" />
                    <span>{breakdown.totalUsers} user{breakdown.totalUsers !== 1 ? 's' : ''} on this policy</span>
                  </div>

                  {/* Threshold indicators */}
                  <div className="grid grid-cols-4 gap-2">
                    <div className="text-center">
                      <div className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                        {breakdown.below50}
                      </div>
                      <div className="text-[10px] text-muted-foreground leading-tight">&lt; 50%</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold tabular-nums text-amber-600 dark:text-amber-400">
                        {breakdown.between50and80}
                      </div>
                      <div className="text-[10px] text-muted-foreground leading-tight">50–80%</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold tabular-nums text-orange-600 dark:text-orange-400">
                        {breakdown.between80and100}
                      </div>
                      <div className="text-[10px] text-muted-foreground leading-tight">80–100%</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold tabular-nums text-red-600 dark:text-red-400">
                        {breakdown.exceeded}
                      </div>
                      <div className="text-[10px] text-muted-foreground leading-tight">Over</div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Top Data Consumers Table ───────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Top Data Consumers</h3>
          <Badge variant="secondary" className="text-xs">
            {topConsumers.length} monitored
          </Badge>
        </div>

        {isLoading ? (
          <TableSkeleton />
        ) : topConsumers.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted/50 p-4 mb-3">
                <Database className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <h3 className="text-sm font-medium text-muted-foreground">
                No data to display
              </h3>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Users with data usage will appear here once they connect to a plan with an FUP policy
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <ScrollArea className="max-h-[480px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Username</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Policy</TableHead>
                      <TableHead>Data Used</TableHead>
                      <TableHead>Limit</TableHead>
                      <TableHead className="text-right">Usage %</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topConsumers.map((user, index) => {
                      const clampedPercent = Math.min(user.usagePercent, 100);
                      return (
                        <TableRow
                          key={user.session.id}
                          className={cn(
                            user.status === 'throttled' && 'bg-red-50/50 dark:bg-red-950/10',
                            user.status === 'critical' && 'bg-orange-50/30 dark:bg-orange-950/10',
                          )}
                        >
                          {/* Rank */}
                          <TableCell>
                            <span className={cn(
                              'text-sm font-medium tabular-nums',
                              index < 3 && 'text-amber-600 dark:text-amber-400',
                            )}>
                              {index + 1}
                            </span>
                          </TableCell>

                          {/* Username */}
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="p-1 rounded bg-muted/50">
                                <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                              </div>
                              <span className="text-sm font-medium">{user.session.username}</span>
                            </div>
                          </TableCell>

                          {/* Plan */}
                          <TableCell>
                            <span className="text-sm text-muted-foreground">{user.planName}</span>
                          </TableCell>

                          {/* Policy */}
                          <TableCell>
                            <Badge variant="outline" className="text-xs gap-1">
                              {getCycleIcon(user.policy.cycleType)}
                              {user.policy.name}
                            </Badge>
                          </TableCell>

                          {/* Data Used */}
                          <TableCell>
                            <span className="text-sm font-mono tabular-nums">
                              {formatBytes(user.usedBytes)}
                            </span>
                          </TableCell>

                          {/* Limit */}
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {formatDataLimit(user.policy.dataLimitMb, user.policy.dataLimitUnit)}
                            </span>
                          </TableCell>

                          {/* Usage % */}
                          <TableCell className="text-right">
                            <div className="flex items-center gap-2 justify-end">
                              <div className={cn(
                                'w-16 h-1.5 rounded-full overflow-hidden',
                                user.usagePercent >= 100 ? 'bg-red-500/20' :
                                  user.usagePercent >= 80 ? 'bg-orange-500/20' :
                                    user.usagePercent >= 50 ? 'bg-amber-500/20' :
                                      'bg-emerald-500/20',
                              )}>
                                <div
                                  className={cn(
                                    'h-full rounded-full transition-all',
                                    user.usagePercent >= 100 ? 'bg-red-500' :
                                      user.usagePercent >= 80 ? 'bg-orange-500' :
                                        user.usagePercent >= 50 ? 'bg-amber-500' :
                                          'bg-emerald-500',
                                  )}
                                  style={{ width: `${clampedPercent}%` }}
                                />
                              </div>
                              <span className={cn(
                                'text-sm font-medium tabular-nums',
                                user.usagePercent >= 100 && 'text-red-600 dark:text-red-400',
                                user.usagePercent >= 80 && user.usagePercent < 100 && 'text-orange-600 dark:text-orange-400',
                              )}>
                                {user.usagePercent.toFixed(1)}%
                              </span>
                            </div>
                          </TableCell>

                          {/* Status */}
                          <TableCell>
                            {getStatusBadge(user.status)}
                          </TableCell>

                          {/* Time Remaining */}
                          <TableCell>
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {formatTimeRemaining(user.session.startedAt as string | undefined, user.policy.cycleType)}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ─── Footer note ────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Activity className="h-3.5 w-3.5 shrink-0" />
        <span>
          Auto-refreshes every 30 seconds. Usage is calculated client-side by comparing session byte
          counters against the FUP policy data limit. Actual enforcement is handled by the RADIUS server.
        </span>
      </div>
    </div>
  );
}
