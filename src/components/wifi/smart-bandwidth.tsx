'use client';

/**
 * SmartBandwidth Component
 *
 * Smart bandwidth control tab managing Fair Access Policies (FAP).
 * Provides policy CRUD, enforce-all, and per-user usage checking.
 * Mobile: card layout. Desktop: table layout.
 *
 * API actions (via /api/wifi/radius):
 *  - fap-policies-list   (GET)
 *  - fap-policy-create   (POST)
 *  - fap-policy-update   (POST)
 *  - fap-policy-delete   (POST)
 *  - fap-policies-enforce (POST)
 *  - fap-policy-check    (POST)
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
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
  Gauge,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
  Zap,
  WifiOff,
  Timer,
  HardDrive,
  ArrowDownToLine,
  ArrowUpFromLine,
  Ban,
  Smartphone,
  Database,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  Users,
  CircleDot,
  TrendingDown,
  Sun,
  Calendar,
  CalendarRange,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface FapPolicy {
  id: string;
  name: string;
  description?: string | null;
  cycleType: 'daily' | 'weekly' | 'monthly';
  dataLimit: number;
  dataLimitUnit: 'MB' | 'GB';
  thresholdPercentage: number;
  throttleAction: 'block' | 'throttle';
  throttleDownloadSpeed?: number | null;
  throttleUploadSpeed?: number | null;
  enabled: boolean;
  usageCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

interface FapFormData {
  name: string;
  description: string;
  cycleType: 'daily' | 'weekly' | 'monthly';
  dataLimit: string;
  dataLimitUnit: 'MB' | 'GB';
  thresholdPercentage: number;
  throttleAction: 'block' | 'throttle';
  throttleDownloadSpeed: string;
  throttleUploadSpeed: string;
  enabled: boolean;
}

interface UsageCheckResult {
  username: string;
  policyName: string;
  currentUsage: number;
  currentUsageUnit: string;
  dataLimit: number;
  dataLimitUnit: string;
  percentageUsed: number;
  isThrottled: boolean;
  throttleAction?: string;
  message?: string;
}

interface EnforceResult {
  totalChecked: number;
  throttled: number;
  blocked: number;
  skipped: number;
  message?: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const CYCLE_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
] as const;

const THROTTLE_ACTION_OPTIONS = [
  { value: 'block', label: 'Block Access' },
  { value: 'throttle', label: 'Throttle Bandwidth' },
] as const;

const EMPTY_FORM: FapFormData = {
  name: '',
  description: '',
  cycleType: 'daily',
  dataLimit: '5',
  dataLimitUnit: 'GB',
  thresholdPercentage: 80,
  throttleAction: 'throttle',
  throttleDownloadSpeed: '1',
  throttleUploadSpeed: '0.5',
  enabled: true,
};

// ─── Helpers ────────────────────────────────────────────────────────────────────

function getCycleIcon(cycleType: string) {
  switch (cycleType) {
    case 'daily':
      return <Sun className="h-3.5 w-3.5" />;
    case 'weekly':
      return <Calendar className="h-3.5 w-3.5" />;
    case 'monthly':
      return <CalendarRange className="h-3.5 w-3.5" />;
    default:
      return <Timer className="h-3.5 w-3.5" />;
  }
}

function getCycleBadge(cycleType: string) {
  const colors: Record<string, string> = {
    daily: 'bg-sky-500',
    weekly: 'bg-amber-500',
    monthly: 'bg-violet-500',
  };
  const color = colors[cycleType] || 'bg-gray-500';
  return (
    <Badge className={`${color} hover:${color} text-white border-0 text-xs capitalize`}>
      {getCycleIcon(cycleType)}
      <span className="ml-1">{cycleType}</span>
    </Badge>
  );
}

function formatDataLimit(limit: number, unit: string): string {
  if (unit === 'GB') return `${limit} GB`;
  return `${limit} MB`;
}

function formatSpeed(mbps: number): string {
  if (mbps >= 1) return `${mbps} Mbps`;
  return `${(mbps * 1000).toFixed(0)} Kbps`;
}

// ─── Component ──────────────────────────────────────────────────────────────────

export default function SmartBandwidth() {
  const { toast } = useToast();

  // ─── State ────────────────────────────────────────────────────────────────
  const [policies, setPolicies] = useState<FapPolicy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Stats
  const [usersThrottled, setUsersThrottled] = useState(0);
  const [bandwidthSaved, setBandwidthSaved] = useState('--');

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<FapPolicy | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteName, setDeleteName] = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Enforce all
  const [enforceDialogOpen, setEnforceDialogOpen] = useState(false);
  const [enforcing, setEnforcing] = useState(false);
  const [enforceResult, setEnforceResult] = useState<EnforceResult | null>(null);

  // Usage check
  const [checkUsername, setCheckUsername] = useState('');
  const [checkPolicyId, setCheckPolicyId] = useState('');
  const [checkingUsage, setCheckingUsage] = useState(false);
  const [usageResult, setUsageResult] = useState<UsageCheckResult | null>(null);

  // Form
  const [form, setForm] = useState<FapFormData>(EMPTY_FORM);

  // ─── Computed ─────────────────────────────────────────────────────────────

  const activePolicies = useMemo(
    () => policies.filter((p) => p.enabled),
    [policies],
  );

  const filteredPolicies = useMemo(() => {
    if (!searchQuery) return policies;
    const q = searchQuery.toLowerCase();
    return policies.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q)),
    );
  }, [policies, searchQuery]);

  // ─── Fetch ────────────────────────────────────────────────────────────────

  const fetchPolicies = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/wifi/radius?action=fap-policies-list');
      const data = await res.json();
      if (data.success && data.data) {
        const list = Array.isArray(data.data) ? data.data : [];
        setPolicies(list);

        // Derive stats from the policies list
        const throttledCount = list.reduce(
          (sum, p) => sum + (p.usageCount || 0),
          0,
        );
        setUsersThrottled(throttledCount);

        // Estimate bandwidth saved from active policies with throttle action
        const estimatedSaved = list
          .filter((p: FapPolicy) => p.enabled && p.throttleAction === 'throttle' && p.usageCount)
          .reduce((sum: number, p: FapPolicy) => {
            const dl = p.throttleDownloadSpeed || 1;
            const ul = p.throttleUploadSpeed || 0.5;
            const limit = p.dataLimitUnit === 'GB' ? p.dataLimit * 1024 : p.dataLimit;
            const saved = (limit - (dl + ul)) * (p.usageCount || 0);
            return sum + Math.max(0, saved);
          }, 0);

        if (estimatedSaved >= 1024) {
          setBandwidthSaved(`${(estimatedSaved / 1024).toFixed(1)} GB`);
        } else if (estimatedSaved > 0) {
          setBandwidthSaved(`${Math.round(estimatedSaved)} MB`);
        } else {
          setBandwidthSaved('--');
        }
      } else {
        setPolicies([]);
      }
    } catch (error) {
      console.error('Failed to fetch FAP policies:', error);
      toast({
        title: 'Error',
        description: 'Failed to load FAP policies',
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

  // ─── Form helpers ─────────────────────────────────────────────────────────

  const resetForm = useCallback(() => {
    setForm(EMPTY_FORM);
    setEditingPolicy(null);
  }, []);

  const openCreate = useCallback(() => {
    resetForm();
    setDialogOpen(true);
  }, [resetForm]);

  const openEdit = useCallback((policy: FapPolicy) => {
    setEditingPolicy(policy);
    setForm({
      name: policy.name,
      description: policy.description || '',
      cycleType: policy.cycleType,
      dataLimit: String(policy.dataLimit),
      dataLimitUnit: policy.dataLimitUnit,
      thresholdPercentage: policy.thresholdPercentage || 80,
      throttleAction: policy.throttleAction,
      throttleDownloadSpeed: policy.throttleDownloadSpeed
        ? String(policy.throttleDownloadSpeed)
        : '1',
      throttleUploadSpeed: policy.throttleUploadSpeed
        ? String(policy.throttleUploadSpeed)
        : '0.5',
      enabled: policy.enabled,
    });
    setDialogOpen(true);
  }, []);

  const updateField = useCallback(
    <K extends keyof FapFormData>(key: K, value: FapFormData[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  // ─── CRUD ─────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Policy name is required.',
        variant: 'destructive',
      });
      return;
    }

    const dataLimit = Number(form.dataLimit);
    if (isNaN(dataLimit) || dataLimit <= 0) {
      toast({
        title: 'Validation Error',
        description: 'Data limit must be a positive number.',
        variant: 'destructive',
      });
      return;
    }

    if (form.throttleAction === 'throttle') {
      const dl = Number(form.throttleDownloadSpeed);
      const ul = Number(form.throttleUploadSpeed);
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
      const action = editingPolicy ? 'fap-policy-update' : 'fap-policy-create';
      const body: Record<string, unknown> = {
        action,
        name: form.name.trim(),
        description: form.description.trim() || null,
        cycleType: form.cycleType,
        dataLimit,
        dataLimitUnit: form.dataLimitUnit,
        thresholdPercentage: form.thresholdPercentage,
        throttleAction: form.throttleAction,
        enabled: form.enabled,
      };

      if (form.throttleAction === 'throttle') {
        body.throttleDownloadSpeed = Number(form.throttleDownloadSpeed);
        body.throttleUploadSpeed = Number(form.throttleUploadSpeed);
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
            ? 'FAP policy updated successfully.'
            : 'FAP policy created successfully.',
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
        body: JSON.stringify({ action: 'fap-policy-delete', id: deleteId }),
      });
      const data = await res.json();
      if (data.success) {
        toast({
          title: 'Success',
          description: 'FAP policy deleted successfully.',
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

  const handleToggle = async (policy: FapPolicy) => {
    const newEnabled = !policy.enabled;
    setTogglingId(policy.id);
    try {
      const res = await fetch('/api/wifi/radius', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'fap-policy-update',
          id: policy.id,
          enabled: newEnabled,
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

  // ─── Enforce All ─────────────────────────────────────────────────────────

  const handleEnforceAll = async () => {
    setEnforcing(true);
    setEnforceResult(null);
    try {
      const res = await fetch('/api/wifi/radius', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'fap-policies-enforce' }),
      });
      const data = await res.json();
      if (data.success) {
        const result: EnforceResult = {
          totalChecked: data.data?.totalChecked || 0,
          throttled: data.data?.throttled || 0,
          blocked: data.data?.blocked || 0,
          skipped: data.data?.skipped || 0,
          message: data.message || data.data?.message,
        };
        setEnforceResult(result);
        toast({
          title: 'Enforcement Complete',
          description: data.message || 'All FAP policies have been enforced.',
        });
        fetchPolicies();
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to enforce policies.',
          variant: 'destructive',
        });
        setEnforceDialogOpen(false);
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to enforce policies.',
        variant: 'destructive',
      });
      setEnforceDialogOpen(false);
    } finally {
      setEnforcing(false);
    }
  };

  // ─── Check Usage ─────────────────────────────────────────────────────────

  const handleCheckUsage = async () => {
    if (!checkUsername.trim() || !checkPolicyId) {
      toast({
        title: 'Validation Error',
        description: 'Username and policy are required.',
        variant: 'destructive',
      });
      return;
    }
    setCheckingUsage(true);
    setUsageResult(null);
    try {
      const res = await fetch('/api/wifi/radius', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'fap-policy-check',
          username: checkUsername.trim(),
          policyId: checkPolicyId,
        }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setUsageResult(data.data);
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to check usage.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to check usage.',
        variant: 'destructive',
      });
    } finally {
      setCheckingUsage(false);
    }
  };

  // ─── Mobile Card ─────────────────────────────────────────────────────────

  const PolicyCard = ({ policy }: { policy: FapPolicy }) => (
    <Card
      className={cn(
        'relative transition-opacity',
        !policy.enabled && 'opacity-60',
      )}
    >
      <CardContent className="p-4 space-y-3">
        {/* Row 1: Name + Status */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{policy.name}</p>
            {policy.description && (
              <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                {policy.description}
              </p>
            )}
          </div>
          {policy.enabled ? (
            <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 text-xs shrink-0">
              <CircleDot className="h-3 w-3 mr-1" />
              Active
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-xs shrink-0">
              Disabled
            </Badge>
          )}
        </div>

        {/* Row 2: Key info grid */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <p className="text-muted-foreground mb-0.5">Cycle</p>
            <div className="flex items-center gap-1">
              {getCycleIcon(policy.cycleType)}
              <span className="capitalize">{policy.cycleType}</span>
            </div>
          </div>
          <div>
            <p className="text-muted-foreground mb-0.5">Data Limit</p>
            <div className="flex items-center gap-1">
              <HardDrive className="h-3 w-3" />
              <span className="font-medium tabular-nums">
                {formatDataLimit(policy.dataLimit, policy.dataLimitUnit)}
              </span>
            </div>
          </div>
          <div>
            <p className="text-muted-foreground mb-0.5">Threshold</p>
            <span className="font-medium">{policy.thresholdPercentage || 80}%</span>
          </div>
          <div>
            <p className="text-muted-foreground mb-0.5">Action</p>
            {policy.throttleAction === 'throttle' ? (
              <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <Zap className="h-3 w-3" />
                <span>Throttle</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
                <Ban className="h-3 w-3" />
                <span>Block</span>
              </div>
            )}
          </div>
        </div>

        {/* Throttle speeds (if applicable) */}
        {policy.throttleAction === 'throttle' && (
          <div className="rounded-md bg-muted/50 p-2 text-xs">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <ArrowDownToLine className="h-3 w-3" />
                {formatSpeed(policy.throttleDownloadSpeed || 1)}
              </span>
              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <ArrowUpFromLine className="h-3 w-3" />
                {formatSpeed(policy.throttleUploadSpeed || 0.5)}
              </span>
            </div>
          </div>
        )}

        {/* Usage count */}
        {policy.usageCount !== undefined && policy.usageCount > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="h-3 w-3" />
            <span>{policy.usageCount} user{policy.usageCount !== 1 ? 's' : ''} matched</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1 border-t">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-8 text-xs"
            onClick={() => openEdit(policy)}
          >
            <Pencil className="h-3 w-3 mr-1" />
            Edit
          </Button>
          <div
            role="button"
            tabIndex={0}
            className={cn(
              "inline-flex items-center justify-center rounded-md border border-input bg-background px-2 py-1.5 h-8",
              togglingId === policy.id && "opacity-50 cursor-not-allowed",
            )}
            onClick={togglingId !== policy.id ? () => handleToggle(policy) : undefined}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (togglingId !== policy.id) handleToggle(policy);
              }
            }}
          >
            {togglingId === policy.id ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Switch
                checked={policy.enabled}
                className="pointer-events-none"
              />
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
            onClick={() => {
              setDeleteId(policy.id);
              setDeleteName(policy.name);
            }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ─── Header ────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Gauge className="h-5 w-5" />
            Smart Bandwidth
          </h2>
          <p className="text-sm text-muted-foreground">
            Fair Access Policy management with smart bandwidth control
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={fetchPolicies}>
            <RefreshCw className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-red-300 text-red-700 dark:text-red-400 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
            onClick={() => {
              setEnforceResult(null);
              setEnforceDialogOpen(true);
            }}
          >
            <Zap className="h-4 w-4 mr-2" />
            Enforce All
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Add Policy
          </Button>
        </div>
      </div>

      {/* ─── Info Banner ────────────────────────────────────────────────── */}
      <Card className="bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-orange-600 dark:text-orange-400 mt-0.5 shrink-0" />
            <div className="text-sm text-orange-800 dark:text-orange-200">
              <p className="font-medium">Smart Bandwidth Control</p>
              <p className="text-orange-600 dark:text-orange-400 mt-0.5">
                FAP policies automatically monitor data usage per user per cycle. When a user crosses the
                configured threshold percentage of their data limit, the system triggers the configured action
                (block or throttle) via RADIUS CoA in real time.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Stats Cards ───────────────────────────────────────────────── */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        {/* Total Policies */}
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-teal-500/10">
              <Shield className="h-4 w-4 text-teal-500 dark:text-teal-400" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums">{policies.length}</div>
              <div className="text-xs text-muted-foreground">Total Policies</div>
            </div>
          </div>
        </Card>

        {/* Active Policies */}
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <ShieldCheck className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                {activePolicies.length}
              </div>
              <div className="text-xs text-muted-foreground">Active Policies</div>
            </div>
          </div>
        </Card>

        {/* Users Throttled */}
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Smartphone className="h-4 w-4 text-amber-500 dark:text-amber-400" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
                {usersThrottled}
              </div>
              <div className="text-xs text-muted-foreground">Users Throttled</div>
            </div>
          </div>
        </Card>

        {/* Bandwidth Saved */}
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <TrendingDown className="h-4 w-4 text-purple-500 dark:text-purple-400" />
            </div>
            <div>
              <div className="text-2xl font-bold tabular-nums">{bandwidthSaved}</div>
              <div className="text-xs text-muted-foreground">BW Saved (est.)</div>
            </div>
          </div>
        </Card>
      </div>

      {/* ─── Search ────────────────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search policies by name or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* ─── Policy List ───────────────────────────────────────────────── */}
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
              {searchQuery
                ? 'No policies match your search'
                : 'No FAP policies configured'}
            </h3>
            <p className="text-xs text-muted-foreground/60 mt-1">
              {searchQuery
                ? 'Try adjusting your search query'
                : 'Create your first Fair Access Policy to control guest bandwidth'}
            </p>
            {!searchQuery && (
              <Button variant="outline" size="sm" className="mt-4" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Create Policy
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile: Card Layout */}
          <div className="space-y-3 sm:hidden">
            {filteredPolicies.map((policy) => (
              <PolicyCard key={policy.id} policy={policy} />
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
                        <TableHead>Name</TableHead>
                        <TableHead>Cycle</TableHead>
                        <TableHead>Data Limit</TableHead>
                        <TableHead>Threshold</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Throttle Speed</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Usage</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPolicies.map((policy) => (
                        <TableRow
                          key={policy.id}
                          className={cn(
                            !policy.enabled && 'opacity-60',
                          )}
                        >
                          <TableCell>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <Gauge className="h-4 w-4 text-muted-foreground shrink-0" />
                                <p className="font-medium text-sm truncate max-w-[150px]" title={policy.name}>
                                  {policy.name}
                                </p>
                              </div>
                              {policy.description && (
                                <p className="text-xs text-muted-foreground pl-6 line-clamp-1 mt-0.5">
                                  {policy.description}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{getCycleBadge(policy.cycleType)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <HardDrive className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-sm font-medium tabular-nums">
                                {formatDataLimit(policy.dataLimit, policy.dataLimitUnit)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm font-medium tabular-nums">
                              {policy.thresholdPercentage || 80}%
                            </span>
                          </TableCell>
                          <TableCell>
                            {policy.throttleAction === 'throttle' ? (
                              <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-0 text-xs">
                                <Zap className="h-3 w-3 mr-1" />
                                Throttle
                              </Badge>
                            ) : (
                              <Badge className="bg-red-500 hover:bg-red-600 text-white border-0 text-xs">
                                <Ban className="h-3 w-3 mr-1" />
                                Block
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {policy.throttleAction === 'throttle' ? (
                              <div className="text-xs space-y-0.5">
                                <div className="flex items-center gap-1">
                                  <ArrowDownToLine className="h-3 w-3 text-emerald-500" />
                                  <span>{formatSpeed(policy.throttleDownloadSpeed || 1)}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <ArrowUpFromLine className="h-3 w-3 text-amber-500" />
                                  <span>{formatSpeed(policy.throttleUploadSpeed || 0.5)}</span>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <WifiOff className="h-3 w-3" />
                                <span>N/A</span>
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={policy.enabled}
                                onCheckedChange={() => handleToggle(policy)}
                                disabled={togglingId === policy.id}
                              />
                              {togglingId === policy.id && (
                                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {policy.usageCount !== undefined && policy.usageCount > 0 ? (
                              <Badge variant="outline" className="text-xs">
                                <Users className="h-3 w-3 mr-1" />
                                {policy.usageCount}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">0</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs gap-1"
                                onClick={() => openEdit(policy)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                <span className="hidden lg:inline">Edit</span>
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs"
                                onClick={() => {
                                  setDeleteId(policy.id);
                                  setDeleteName(policy.name);
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </div>
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

      {/* ─── Check User Against Policy ─────────────────────────────────── */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Eye className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium">Check User Against Policy</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground mb-1 block">Username</Label>
              <Input
                placeholder="Enter username"
                value={checkUsername}
                onChange={(e) => setCheckUsername(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCheckUsage();
                }}
              />
            </div>
            <div className="w-full sm:w-48">
              <Label className="text-xs text-muted-foreground mb-1 block">Policy</Label>
              <Select value={checkPolicyId} onValueChange={setCheckPolicyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select policy" />
                </SelectTrigger>
                <SelectContent>
                  {policies.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={handleCheckUsage}
                disabled={checkingUsage || !checkUsername.trim() || !checkPolicyId}
              >
                {checkingUsage ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ShieldCheck className="h-4 w-4 mr-2" />
                )}
                Check
              </Button>
            </div>
          </div>

          {/* Usage Result */}
          {usageResult && (
            <div
              className={cn(
                'mt-4 p-4 rounded-lg border',
                usageResult.isThrottled
                  ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800'
                  : 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800',
              )}
            >
              <div className="flex items-start gap-3">
                {usageResult.isThrottled ? (
                  <XCircle className="h-5 w-5 text-red-500 dark:text-red-400 mt-0.5 shrink-0" />
                ) : (
                  <CheckCircle className="h-5 w-5 text-emerald-500 dark:text-emerald-400 mt-0.5 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{usageResult.username}</span>
                    <Badge
                      variant="outline"
                      className="text-xs"
                    >
                      {usageResult.policyName}
                    </Badge>
                    {usageResult.isThrottled ? (
                      <Badge className="bg-red-500 hover:bg-red-600 text-white border-0 text-xs">
                        Throttled
                      </Badge>
                    ) : (
                      <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 text-xs">
                        Normal
                      </Badge>
                    )}
                  </div>

                  {/* Usage bar */}
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {usageResult.currentUsage} {usageResult.currentUsageUnit} /{' '}
                        {usageResult.dataLimit} {usageResult.dataLimitUnit}
                      </span>
                      <span className="font-medium tabular-nums">
                        {usageResult.percentageUsed}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          usageResult.percentageUsed >= 100
                            ? 'bg-red-500'
                            : usageResult.percentageUsed >= 80
                              ? 'bg-amber-500'
                              : 'bg-emerald-500',
                        )}
                        style={{
                          width: `${Math.min(usageResult.percentageUsed, 100)}%`,
                        }}
                      />
                    </div>
                  </div>

                  {usageResult.message && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {usageResult.message}
                    </p>
                  )}

                  {usageResult.isThrottled && usageResult.throttleAction && (
                    <div className="flex items-center gap-1.5 mt-2 text-xs text-red-600 dark:text-red-400">
                      <AlertTriangle className="h-3 w-3" />
                      <span>
                        Action: {usageResult.throttleAction === 'block' ? 'Access blocked' : 'Bandwidth throttled'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Create / Edit Dialog ─────────────────────────────────────── */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) resetForm();
          setDialogOpen(open);
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPolicy ? 'Edit FAP Policy' : 'Create FAP Policy'}
            </DialogTitle>
            <DialogDescription>
              {editingPolicy
                ? 'Update the Fair Access Policy settings.'
                : 'Configure a new Fair Access Policy for smart bandwidth control.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="fap-name">Policy Name *</Label>
              <Input
                id="fap-name"
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="e.g., Guest Daily Limit"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="fap-description">Description</Label>
              <Textarea
                id="fap-description"
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
                  min="1"
                  step="0.1"
                  value={form.dataLimit}
                  onChange={(e) => updateField('dataLimit', e.target.value)}
                  placeholder="5"
                  className="flex-1"
                />
                <Select
                  value={form.dataLimitUnit}
                  onValueChange={(v) => updateField('dataLimitUnit', v as 'MB' | 'GB')}
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MB">MB</SelectItem>
                    <SelectItem value="GB">GB</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                The total data usage cap per cycle for each user.
              </p>
            </div>

            {/* Threshold Percentage */}
            <div className="space-y-2">
              <Label>
                Threshold Percentage:{' '}
                <span className="font-semibold text-primary">{form.thresholdPercentage}%</span>
              </Label>
              <Slider
                min={50}
                max={100}
                step={5}
                value={[form.thresholdPercentage]}
                onValueChange={(v) => updateField('thresholdPercentage', v[0])}
              />
              <p className="text-xs text-muted-foreground">
                Trigger the throttle/block action when usage reaches this percentage of the data limit.
              </p>
            </div>

            {/* Throttle Action */}
            <div className="space-y-2">
              <Label>When Threshold is Reached</Label>
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
                    <Label htmlFor="fap-throttle-dl" className="text-xs">
                      Download (Mbps)
                    </Label>
                    <Input
                      id="fap-throttle-dl"
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={form.throttleDownloadSpeed}
                      onChange={(e) => updateField('throttleDownloadSpeed', e.target.value)}
                      placeholder="1"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="fap-throttle-ul" className="text-xs">
                      Upload (Mbps)
                    </Label>
                    <Input
                      id="fap-throttle-ul"
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={form.throttleUploadSpeed}
                      onChange={(e) => updateField('throttleUploadSpeed', e.target.value)}
                      placeholder="0.5"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Users exceeding the threshold will have their bandwidth reduced to these speeds via CoA.
                </p>
              </div>
            )}

            <Separator />

            {/* Enabled */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Enabled</Label>
                <p className="text-xs text-muted-foreground">
                  {form.enabled ? 'Policy is active and enforced' : 'Policy is paused'}
                </p>
              </div>
              <Switch
                checked={form.enabled}
                onCheckedChange={(checked) => updateField('enabled', checked)}
              />
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

      {/* ─── Delete Confirmation ──────────────────────────────────────── */}
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete FAP Policy</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the policy &quot;{deleteName}&quot;. Any active
              enforcement rules tied to this policy will stop. Users currently throttled by
              this policy will not be automatically un-throttled.
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

      {/* ─── Enforce All Dialog ───────────────────────────────────────── */}
      <Dialog
        open={enforceDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setEnforceDialogOpen(false);
            setEnforceResult(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-red-500" />
              Enforce All Policies Now
            </DialogTitle>
            <DialogDescription>
              This will immediately evaluate all active FAP policies against every currently
              connected user and apply throttle/block actions where thresholds have been exceeded.
            </DialogDescription>
          </DialogHeader>

          {!enforceResult && !enforcing && (
            <div className="py-4">
              <div className="flex items-start gap-2 text-amber-600 dark:text-amber-400 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <p className="text-xs">
                  This sends real RADIUS CoA messages to all NAS devices. Users who have
                  exceeded their data thresholds will be throttled or disconnected immediately.
                </p>
              </div>
            </div>
          )}

          {enforcing && (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Evaluating policies against active sessions...</p>
            </div>
          )}

          {enforceResult && (
            <div className="py-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-3 text-center">
                  <div className="text-2xl font-bold tabular-nums">{enforceResult.totalChecked}</div>
                  <div className="text-xs text-muted-foreground">Users Checked</div>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <div className="text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
                    {enforceResult.throttled + enforceResult.blocked}
                  </div>
                  <div className="text-xs text-muted-foreground">Actions Taken</div>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <div className="text-2xl font-bold tabular-nums text-orange-600 dark:text-orange-400">
                    {enforceResult.throttled}
                  </div>
                  <div className="text-xs text-muted-foreground">Throttled</div>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <div className="text-2xl font-bold tabular-nums text-red-600 dark:text-red-400">
                    {enforceResult.blocked}
                  </div>
                  <div className="text-xs text-muted-foreground">Blocked</div>
                </div>
              </div>
              {enforceResult.skipped > 0 && (
                <p className="text-xs text-muted-foreground text-center">
                  {enforceResult.skipped} user{enforceResult.skipped !== 1 ? 's' : ''} skipped (within limits)
                </p>
              )}
              {enforceResult.message && (
                <p className="text-xs text-muted-foreground text-center">
                  {enforceResult.message}
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEnforceDialogOpen(false);
                setEnforceResult(null);
              }}
            >
              {enforceResult ? 'Close' : 'Cancel'}
            </Button>
            {!enforceResult && (
              <Button
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={handleEnforceAll}
                disabled={enforcing || activePolicies.length === 0}
              >
                {enforcing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Enforcing...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    Enforce All Policies
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
