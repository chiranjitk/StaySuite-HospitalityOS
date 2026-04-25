'use client';

/**
 * WifiFupPolicy -- Fair Usage Policy management for guest WiFi.
 *
 * Manages data usage limits, throttling rules, and enforcement across
 * guest sessions. Each policy defines a cycle (daily/weekly/monthly),
 * a data cap, and an action (block or throttle) when the limit is reached.
 *
 * API actions (via /api/wifi/radius):
 *  - fap-policies-list  (GET)
 *  - fap-policies-create  (POST)
 *  - fap-policies-update  (POST)
 *  - fap-policies-delete  (POST)
 *  - fap-policies-enforce (POST)
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import FupDashboard from '@/components/wifi/fup-dashboard';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Gauge,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  RefreshCw,
  Search,
  Shield,
  Smartphone,
  ArrowUpDown,
  Clock,
  Sun,
  Calendar,
  CalendarRange,
  ArrowDownToLine,
  ArrowUpFromLine,
  Ban,
  Zap,
  AlertTriangle,
  Database,
  WifiOff,
  BarChart3,
  List,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FupPolicy {
  id: string;
  tenantId?: string;
  propertyId?: string;
  name: string;
  description?: string | null;
  cycleType: 'daily' | 'weekly' | 'monthly';
  limitType: 'total' | 'download' | 'upload';
  dataLimitMb: number;
  dataLimitUnit: 'mb' | 'gb';
  switchOverBwPolicyId?: string | null;
  cycleResetHour: number;
  cycleResetMinute: number;
  applicableOn: 'total' | 'download' | 'upload';
  isEnabled: boolean;
  priority: number;
  createdAt?: string;
  updatedAt?: string;
}

interface FupFormData {
  name: string;
  description: string;
  cycleType: 'daily' | 'weekly' | 'monthly';
  dataLimitMb: string;
  dataLimitUnit: 'mb' | 'gb';
  applicableOn: 'total' | 'download' | 'upload';
  throttleAction: 'block' | 'throttle';
  throttleDownloadMbps: string;
  throttleUploadMbps: string;
  cycleResetHour: string;
  cycleResetMinute: string;
  priority: string;
  isEnabled: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CYCLE_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
] as const;

const APPLICABLE_ON_OPTIONS = [
  { value: 'total', label: 'Total Usage' },
  { value: 'download', label: 'Download Only' },
  { value: 'upload', label: 'Upload Only' },
] as const;

const THROTTLE_ACTION_OPTIONS = [
  { value: 'block', label: 'Block Access (Disconnect)' },
  { value: 'throttle', label: 'Throttle Bandwidth' },
] as const;

const EMPTY_FORM: FupFormData = {
  name: '',
  description: '',
  cycleType: 'daily',
  dataLimitMb: '5',
  dataLimitUnit: 'gb',
  applicableOn: 'total',
  throttleAction: 'block',
  throttleDownloadMbps: '1',
  throttleUploadMbps: '0.5',
  cycleResetHour: '23',
  cycleResetMinute: '59',
  priority: '0',
  isEnabled: true,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDataLimit(mb: number, unit: 'mb' | 'gb'): string {
  if (unit === 'gb') {
    return `${mb} GB`;
  }
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(1).replace(/\.0$/, '')} GB`;
  }
  return `${mb} MB`;
}

function formatDataLimitDisplay(mb: number, unit: 'mb' | 'gb', cycleType: string): string {
  const formatted = formatDataLimit(mb, unit);
  const cycleLabel = CYCLE_OPTIONS.find((c) => c.value === cycleType)?.label || cycleType;
  return `${formatted}/${cycleLabel.toLowerCase()}`;
}

function getCycleIcon(cycleType: string) {
  switch (cycleType) {
    case 'daily':
      return <Sun className="h-4 w-4" />;
    case 'weekly':
      return <Calendar className="h-4 w-4" />;
    case 'monthly':
      return <CalendarRange className="h-4 w-4" />;
    default:
      return <Clock className="h-4 w-4" />;
  }
}

function getApplicableOnLabel(value: string): string {
  const opt = APPLICABLE_ON_OPTIONS.find((o) => o.value === value);
  return opt?.label || value;
}

function getApplicableOnIcon(value: string) {
  switch (value) {
    case 'download':
      return <ArrowDownToLine className="h-3.5 w-3.5" />;
    case 'upload':
      return <ArrowUpFromLine className="h-3.5 w-3.5" />;
    default:
      return <ArrowUpDown className="h-3.5 w-3.5" />;
  }
}

function formatResetTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

// Hour and minute options for time picker
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTE_OPTIONS = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55', '59'];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function WifiFupPolicy() {
  const { toast } = useToast();

  // ─── State ────────────────────────────────────────────────────────────
  const [activeView, setActiveView] = useState<'policies' | 'dashboard'>('policies');
  const [policies, setPolicies] = useState<FupPolicy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<FupPolicy | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteName, setDeleteName] = useState('');
  const [enforceOpen, setEnforceOpen] = useState(false);
  const [enforcing, setEnforcing] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState<FupFormData>(EMPTY_FORM);

  // ─── Computed ─────────────────────────────────────────────────────────

  const activePolicies = useMemo(
    () => policies.filter((p) => p.isEnabled),
    [policies],
  );

  const filteredPolicies = useMemo(() => {
    let result = policies;
    if (statusFilter === 'active') result = result.filter((p) => p.isEnabled);
    else if (statusFilter === 'disabled') result = result.filter((p) => !p.isEnabled);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q)),
      );
    }
    // Sort by priority ascending
    return result.sort((a, b) => a.priority - b.priority);
  }, [policies, statusFilter, searchQuery]);

  // ─── Fetch ────────────────────────────────────────────────────────────

  const fetchPolicies = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/wifi/radius?action=fap-policies-list');
      const data = await res.json();
      if (data.success && data.data) {
        setPolicies(Array.isArray(data.data) ? data.data : []);
      } else {
        setPolicies([]);
      }
    } catch (error) {
      console.error('Failed to fetch FUP policies:', error);
      toast({
        title: 'Error',
        description: 'Failed to load FUP policies',
        variant: 'destructive',
      });
      setPolicies([]);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchPolicies();
  }, [fetchPolicies]);

  // ─── Form helpers ─────────────────────────────────────────────────────

  const resetForm = useCallback(() => {
    setForm(EMPTY_FORM);
    setEditingPolicy(null);
  }, []);

  const openCreate = useCallback(() => {
    resetForm();
    setDialogOpen(true);
  }, [resetForm]);

  const openEdit = useCallback((policy: FupPolicy) => {
    setEditingPolicy(policy);
    setForm({
      name: policy.name,
      description: policy.description || '',
      cycleType: policy.cycleType,
      dataLimitMb: String(policy.dataLimitMb),
      dataLimitUnit: policy.dataLimitUnit,
      applicableOn: policy.applicableOn,
      throttleAction: policy.switchOverBwPolicyId ? 'throttle' : 'block',
      throttleDownloadMbps: String((policy as Record<string, unknown>).switchOverDownloadMbps || (policy as Record<string, unknown>).throttleDown || 1),
      throttleUploadMbps: String((policy as Record<string, unknown>).switchOverUploadMbps || (policy as Record<string, unknown>).throttleUp || 0.5),
      cycleResetHour: String(policy.cycleResetHour).padStart(2, '0'),
      cycleResetMinute: String(policy.cycleResetMinute).padStart(2, '0'),
      priority: String(policy.priority),
      isEnabled: policy.isEnabled,
    });
    setDialogOpen(true);
  }, []);

  const updateField = useCallback(
    <K extends keyof FupFormData>(key: K, value: FupFormData[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  // ─── CRUD ─────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Policy name is required.',
        variant: 'destructive',
      });
      return;
    }

    const dataLimitMb = Number(form.dataLimitMb);
    if (isNaN(dataLimitMb) || dataLimitMb <= 0) {
      toast({
        title: 'Validation Error',
        description: 'Data limit must be a positive number.',
        variant: 'destructive',
      });
      return;
    }

    if (form.throttleAction === 'throttle') {
      const dl = Number(form.throttleDownloadMbps);
      const ul = Number(form.throttleUploadMbps);
      if (isNaN(dl) || dl <= 0 || isNaN(ul) || ul <= 0) {
        toast({
          title: 'Validation Error',
          description: 'Throttle speeds must be positive numbers.',
          variant: 'destructive',
        });
        return;
      }
    }

    setSaving(true);
    try {
      const action = editingPolicy ? 'fap-policies-update' : 'fap-policies-create';
      const body: Record<string, unknown> = {
        action,
        name: form.name.trim(),
        description: form.description.trim() || null,
        cycleType: form.cycleType,
        dataLimitMb,
        dataLimitUnit: form.dataLimitUnit,
        applicableOn: form.applicableOn,
        cycleResetHour: Number(form.cycleResetHour),
        cycleResetMinute: Number(form.cycleResetMinute),
        priority: Number(form.priority),
        isEnabled: form.isEnabled,
        throttleAction: form.throttleAction,
      };

      if (form.throttleAction === 'throttle') {
        body.throttleDownloadMbps = Number(form.throttleDownloadMbps);
        body.throttleUploadMbps = Number(form.throttleUploadMbps);
      }

      if (editingPolicy) {
        body.id = editingPolicy.id;
      }

      const res = await fetch('/api/wifi/radius', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (data.success) {
        toast({
          title: 'Success',
          description: editingPolicy
            ? 'FUP policy updated successfully.'
            : 'FUP policy created successfully.',
        });
        setDialogOpen(false);
        resetForm();
        fetchPolicies();
      } else {
        toast({
          title: 'Error',
          description: data.error || `Failed to ${editingPolicy ? 'update' : 'create'} policy.`,
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: `Failed to ${editingPolicy ? 'update' : 'create'} policy.`,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch('/api/wifi/radius', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'fap-policies-delete', id: deleteId }),
      });
      const data = await res.json();
      if (data.success) {
        toast({
          title: 'Success',
          description: 'FUP policy deleted successfully.',
        });
        fetchPolicies();
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to delete policy.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to delete policy.',
        variant: 'destructive',
      });
    } finally {
      setDeleteId(null);
      setDeleteName('');
    }
  };

  const handleToggle = async (policy: FupPolicy) => {
    const newEnabled = !policy.isEnabled;
    setTogglingId(policy.id);
    try {
      const res = await fetch('/api/wifi/radius', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'fap-policies-update',
          id: policy.id,
          isEnabled: newEnabled,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({
          title: newEnabled ? 'Policy Enabled' : 'Policy Disabled',
          description: `"${policy.name}" has been ${newEnabled ? 'enabled' : 'disabled'}.`,
        });
        fetchPolicies();
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to toggle policy.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to toggle policy.',
        variant: 'destructive',
      });
    } finally {
      setTogglingId(null);
    }
  };

  const handleEnforceAll = async () => {
    setEnforcing(true);
    try {
      const res = await fetch('/api/wifi/radius', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'fap-policies-enforce' }),
      });
      const data = await res.json();
      if (data.success) {
        toast({
          title: 'Enforcement Started',
          description: data.message || 'FUP policies are being enforced on all active sessions.',
        });
        setEnforceOpen(false);
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to enforce policies.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to enforce policies.',
        variant: 'destructive',
      });
    } finally {
      setEnforcing(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ─── Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Gauge className="h-5 w-5" />
            Fair Usage Policy
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage data usage limits and throttling rules for guest WiFi
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {/* View Toggle */}
          <div className="flex rounded-lg border bg-muted/50 p-0.5">
            <Button
              variant={activeView === 'policies' ? 'default' : 'ghost'}
              size="sm"
              className="gap-1.5 h-8 text-xs"
              onClick={() => setActiveView('policies')}
            >
              <List className="h-3.5 w-3.5" />
              Policies
            </Button>
            <Button
              variant={activeView === 'dashboard' ? 'default' : 'ghost'}
              size="sm"
              className="gap-1.5 h-8 text-xs"
              onClick={() => setActiveView('dashboard')}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              Dashboard
            </Button>
          </div>
          {activeView === 'policies' && (
            <>
              <Button variant="outline" size="sm" onClick={fetchPolicies}>
                <RefreshCw className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-amber-300 text-amber-700 dark:text-amber-400 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                onClick={() => setEnforceOpen(true)}
              >
                <Zap className="h-4 w-4 mr-2" />
                Enforce All
              </Button>
              <Button size="sm" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Add Policy
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ─── Dashboard View ────────────────────────────────────────── */}
      {activeView === 'dashboard' ? (
        <FupDashboard />
      ) : (
        <>
      {/* ─── Stats Cards ────────────────────────────────────────────── */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        {/* Active Policies */}
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <Shield className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums">{activePolicies.length}</div>
              <div className="text-xs text-muted-foreground">Active Policies</div>
            </div>
          </div>
        </Card>

        {/* Total Policies */}
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-teal-500/10">
              <Gauge className="h-5 w-5 text-teal-500 dark:text-teal-400" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums">{policies.length}</div>
              <div className="text-xs text-muted-foreground">Total Policies</div>
            </div>
          </div>
        </Card>

        {/* Users Throttled */}
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Smartphone className="h-5 w-5 text-amber-500 dark:text-amber-400" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums">0</div>
              <div className="text-xs text-muted-foreground">Users Throttled</div>
            </div>
          </div>
        </Card>

        {/* Bandwidth Saved */}
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <Database className="h-5 w-5 text-purple-500 dark:text-purple-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">--</div>
              <div className="text-xs text-muted-foreground">Bandwidth Saved</div>
            </div>
          </div>
        </Card>
      </div>

      {/* ─── Filters ────────────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search policies..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="disabled">Disabled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* ─── Policy Cards ───────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredPolicies.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-muted/50 p-4 mb-3">
              <Gauge className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <h3 className="text-sm font-medium text-muted-foreground">
              {searchQuery || statusFilter !== 'all'
                ? 'No policies match your filters'
                : 'No FUP policies configured'}
            </h3>
            <p className="text-xs text-muted-foreground/60 mt-1">
              {searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your search or filters'
                : 'Create your first fair usage policy to limit guest data usage'}
            </p>
            {!searchQuery && statusFilter === 'all' && (
              <Button variant="outline" size="sm" className="mt-4" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Create Policy
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPolicies.map((policy) => (
            <Card
              key={policy.id}
              className={cn(
                'relative overflow-hidden transition-opacity',
                !policy.isEnabled && 'opacity-60',
              )}
            >
              {/* Priority badge */}
              {policy.priority > 0 && (
                <div className="absolute top-3 right-3">
                  <Badge
                    variant="outline"
                    className="bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-700 text-xs"
                  >
                    <ArrowUpDown className="h-3 w-3 mr-1" />
                    P{policy.priority}
                  </Badge>
                </div>
              )}

              <CardHeader className="pb-2">
                <div className="flex items-center justify-between pr-14">
                  <CardTitle className="text-base leading-tight">{policy.name}</CardTitle>
                  {policy.isEnabled ? (
                    <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 text-xs">
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">
                      Disabled
                    </Badge>
                  )}
                </div>
                {policy.description && (
                  <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                    {policy.description}
                  </p>
                )}
              </CardHeader>

              <CardContent className="space-y-3">
                {/* Cycle + Data Limit */}
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    {getCycleIcon(policy.cycleType)}
                    <span className="capitalize">{policy.cycleType}</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-medium">
                    <Database className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{formatDataLimitDisplay(policy.dataLimitMb, policy.dataLimitUnit, policy.cycleType)}</span>
                  </div>
                </div>

                {/* Applicable On */}
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  {getApplicableOnIcon(policy.applicableOn)}
                  <span>{getApplicableOnLabel(policy.applicableOn)}</span>
                </div>

                {/* Throttle Action */}
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  {policy.switchOverBwPolicyId ? (
                    <>
                      <Zap className="h-3.5 w-3.5 text-amber-500" />
                      <span>Throttle bandwidth</span>
                    </>
                  ) : (
                    <>
                      <WifiOff className="h-3.5 w-3.5 text-red-500" />
                      <span>Block access</span>
                    </>
                  )}
                </div>

                {/* Reset Time + Priority */}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>Resets at {formatResetTime(policy.cycleResetHour, policy.cycleResetMinute)}</span>
                  </div>
                  <span>Priority {policy.priority}</span>
                </div>

                <Separator />

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => openEdit(policy)}
                  >
                    <Pencil className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                  <div className="flex items-center gap-1">
                    <div
                      role="button"
                      tabIndex={0}
                      className={`inline-flex items-center justify-center rounded-md border border-input bg-background p-1.5 cursor-pointer transition-colors hover:bg-accent hover:text-accent-foreground ${togglingId === policy.id ? 'opacity-50 pointer-events-none' : ''}`}
                      onClick={() => handleToggle(policy)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleToggle(policy); } }}
                    >
                      {togglingId === policy.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Switch
                          checked={policy.isEnabled}
                          className="pointer-events-none"
                        />
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                      onClick={() => {
                        setDeleteId(policy.id);
                        setDeleteName(policy.name);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ─── Create / Edit Dialog ─────────────────────────────────── */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            resetForm();
          }
          setDialogOpen(open);
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPolicy ? 'Edit FUP Policy' : 'Create FUP Policy'}
            </DialogTitle>
            <DialogDescription>
              {editingPolicy
                ? 'Update the fair usage policy settings.'
                : 'Configure a new fair usage policy for guest WiFi.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="fup-name">Policy Name *</Label>
              <Input
                id="fup-name"
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="e.g., Guest Daily Limit"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="fup-description">Description</Label>
              <Textarea
                id="fup-description"
                value={form.description}
                onChange={(e) => updateField('description', e.target.value)}
                placeholder="Optional description of this policy..."
                rows={2}
              />
            </div>

            {/* Cycle Type */}
            <div className="space-y-2">
              <Label>Cycle Type</Label>
              <div className="grid grid-cols-3 gap-2">
                {CYCLE_OPTIONS.map((opt) => (
                  <Button
                    key={opt.value}
                    type="button"
                    variant={form.cycleType === opt.value ? 'default' : 'outline'}
                    size="sm"
                    className="gap-1.5"
                    onClick={() => updateField('cycleType', opt.value)}
                  >
                    {getCycleIcon(opt.value)}
                    <span className="hidden sm:inline">{opt.label}</span>
                    <span className="sm:hidden">{opt.label.slice(0, 3)}</span>
                  </Button>
                ))}
              </div>
            </div>

            {/* Data Limit */}
            <div className="space-y-2">
              <Label>Data Limit</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.dataLimitMb}
                  onChange={(e) => updateField('dataLimitMb', e.target.value)}
                  placeholder="5"
                  className="flex-1"
                />
                <Select
                  value={form.dataLimitUnit}
                  onValueChange={(v) => updateField('dataLimitUnit', v as 'mb' | 'gb')}
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mb">MB</SelectItem>
                    <SelectItem value="gb">GB</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                The data usage threshold that triggers the throttle/block action.
              </p>
            </div>

            {/* Applicable On */}
            <div className="space-y-2">
              <Label>Applicable On</Label>
              <Select
                value={form.applicableOn}
                onValueChange={(v) => updateField('applicableOn', v as 'total' | 'download' | 'upload')}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {APPLICABLE_ON_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Which traffic direction counts toward the data limit.
              </p>
            </div>

            {/* Throttle Action */}
            <div className="space-y-2">
              <Label>When Limit is Exceeded</Label>
              <div className="space-y-2">
                {THROTTLE_ACTION_OPTIONS.map((opt) => (
                  <Button
                    key={opt.value}
                    type="button"
                    variant={form.throttleAction === opt.value ? 'default' : 'outline'}
                    size="sm"
                    className={cn(
                      'w-full justify-start gap-2',
                      form.throttleAction === opt.value && opt.value === 'block' && 'bg-red-600 hover:bg-red-700 text-white',
                    )}
                    onClick={() => updateField('throttleAction', opt.value)}
                  >
                    {opt.value === 'block' ? (
                      <Ban className="h-4 w-4" />
                    ) : (
                      <Zap className="h-4 w-4" />
                    )}
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Throttle Speeds (conditional) */}
            {form.throttleAction === 'throttle' && (
              <div className="rounded-lg border p-3 space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-amber-600 dark:text-amber-400">
                  <Zap className="h-4 w-4" />
                  Throttle Speeds
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="fup-throttle-dl" className="text-xs">
                      Download (Mbps)
                    </Label>
                    <Input
                      id="fup-throttle-dl"
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={form.throttleDownloadMbps}
                      onChange={(e) => updateField('throttleDownloadMbps', e.target.value)}
                      placeholder="1"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="fup-throttle-ul" className="text-xs">
                      Upload (Mbps)
                    </Label>
                    <Input
                      id="fup-throttle-ul"
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={form.throttleUploadMbps}
                      onChange={(e) => updateField('throttleUploadMbps', e.target.value)}
                      placeholder="0.5"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Users exceeding the limit will be throttled to these speeds.
                </p>
              </div>
            )}

            {/* Cycle Reset Time */}
            <div className="space-y-2">
              <Label>Cycle Reset Time</Label>
              <div className="flex gap-2">
                <Select
                  value={form.cycleResetHour}
                  onValueChange={(v) => updateField('cycleResetHour', v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="HH" />
                  </SelectTrigger>
                  <SelectContent>
                    {HOUR_OPTIONS.map((h) => (
                      <SelectItem key={h} value={h}>
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="self-center text-muted-foreground font-mono text-lg">:</span>
                <Select
                  value={form.cycleResetMinute}
                  onValueChange={(v) => updateField('cycleResetMinute', v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="MM" />
                  </SelectTrigger>
                  <SelectContent>
                    {MINUTE_OPTIONS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                Time of day when the usage cycle resets (24h format).
              </p>
            </div>

            {/* Priority + Enabled */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fup-priority">Priority</Label>
                <Input
                  id="fup-priority"
                  type="number"
                  min="0"
                  value={form.priority}
                  onChange={(e) => updateField('priority', e.target.value)}
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground">0 = highest priority</p>
              </div>

              <div className="flex items-end">
                <div className="flex items-center justify-between rounded-lg border p-3 w-full">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Enabled</Label>
                    <p className="text-xs text-muted-foreground">
                      {form.isEnabled ? 'Policy is active' : 'Policy is paused'}
                    </p>
                  </div>
                  <Switch
                    checked={form.isEnabled}
                    onCheckedChange={(checked) => updateField('isEnabled', checked)}
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                resetForm();
                setDialogOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingPolicy ? 'Update Policy' : 'Create Policy'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation ──────────────────────────────────── */}
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteId(null);
            setDeleteName('');
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete FUP Policy</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteName}&quot;? This action
              cannot be undone. Users currently affected by this policy will no
              longer be throttled.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Enforce All Confirmation ─────────────────────────────── */}
      <AlertDialog open={enforceOpen} onOpenChange={setEnforceOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500" />
              Enforce on All Sessions
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately check all active guest sessions against
              enabled FUP policies and apply throttling or disconnection to
              users who have exceeded their data limits.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Users who have exceeded their data limits may experience reduced
                speeds or be disconnected from the network.
              </p>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={enforcing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEnforceAll}
              disabled={enforcing}
              className="bg-amber-600 text-white hover:bg-amber-700"
            >
              {enforcing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enforcing...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Enforce Now
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
        </>
      )}
    </div>
  );
}
