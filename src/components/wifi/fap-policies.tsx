'use client';

/**
 * FAP Policies Component
 *
 * Fair Access Policy management - data cap with bandwidth throttle.
 * Supports create/edit dialog, enable/disable toggle, check usage, enforce now.
 *
 * Data source: /api/wifi/radius?action=fap-policies-*
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Gauge,
  Plus,
  Trash2,
  Edit,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Zap,
  Timer,
  HardDrive,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface FapPolicy {
  id: string;
  name: string;
  cycleType: 'daily' | 'weekly' | 'monthly';
  dataLimit: number;
  unit: 'MB' | 'GB' | 'TB';
  throttlePolicyId?: string;
  throttlePolicyName?: string;
  resetHours: number;
  resetMinutes: number;
  enabled: boolean;
  applicableOn: 'upload' | 'download' | 'total';
  createdAt?: string;
}

interface FapFormData {
  name: string;
  cycleType: string;
  dataLimit: string;
  unit: string;
  throttlePolicyId: string;
  resetHours: string;
  resetMinutes: string;
  enabled: boolean;
  applicableOn: string;
}

interface UsageCheckResult {
  username: string;
  usedData: number;
  usedUnit: string;
  limitData: number;
  limitUnit: string;
  percentage: number;
  isExceeded: boolean;
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const EMPTY_FORM: FapFormData = {
  name: '',
  cycleType: 'daily',
  dataLimit: '5',
  unit: 'GB',
  throttlePolicyId: '',
  resetHours: '23',
  resetMinutes: '59',
  enabled: true,
  applicableOn: 'total',
};

const CYCLE_TYPE_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const UNIT_OPTIONS = [
  { value: 'MB', label: 'MB' },
  { value: 'GB', label: 'GB' },
  { value: 'TB', label: 'TB' },
];

const APPLICABLE_ON_OPTIONS = [
  { value: 'total', label: 'Total Data' },
  { value: 'upload', label: 'Upload Only' },
  { value: 'download', label: 'Download Only' },
];

// ─── Component ──────────────────────────────────────────────────────────────────

export default function FapPolicies() {
  const { toast } = useToast();
  const [policies, setPolicies] = useState<FapPolicy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<FapPolicy | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Usage check
  const [checkUsername, setCheckUsername] = useState('');
  const [checkPolicyId, setCheckPolicyId] = useState('');
  const [checkingUsage, setCheckingUsage] = useState(false);
  const [usageResult, setUsageResult] = useState<UsageCheckResult | null>(null);

  // Enforce
  const [enforcingId, setEnforcingId] = useState<string | null>(null);

  // Form
  const [form, setForm] = useState<FapFormData>(EMPTY_FORM);

  // ─── Fetch ──────────────────────────────────────────────────────────────────

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
      console.error('Failed to fetch FAP policies:', error);
      setPolicies([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPolicies();
  }, [fetchPolicies]);

  // ─── Form Helpers ───────────────────────────────────────────────────────────

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingPolicy(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (policy: FapPolicy) => {
    setEditingPolicy(policy);
    setForm({
      name: policy.name,
      cycleType: policy.cycleType,
      dataLimit: String(policy.dataLimit),
      unit: policy.unit,
      throttlePolicyId: policy.throttlePolicyId || '',
      resetHours: String(policy.resetHours).padStart(2, '0'),
      resetMinutes: String(policy.resetMinutes).padStart(2, '0'),
      enabled: policy.enabled,
      applicableOn: policy.applicableOn,
    });
    setDialogOpen(true);
  };

  // ─── CRUD ───────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Error', description: 'Policy name is required', variant: 'destructive' });
      return;
    }
    if (!form.dataLimit || Number(form.dataLimit) <= 0) {
      toast({ title: 'Error', description: 'Data limit must be positive', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const action = editingPolicy ? 'fap-policies-update' : 'fap-policies-create';
      const body = {
        action,
        ...(editingPolicy ? { id: editingPolicy.id } : {}),
        name: form.name.trim(),
        cycleType: form.cycleType,
        dataLimit: Number(form.dataLimit),
        unit: form.unit,
        throttlePolicyId: form.throttlePolicyId || null,
        resetHours: Number(form.resetHours),
        resetMinutes: Number(form.resetMinutes),
        enabled: form.enabled,
        applicableOn: form.applicableOn,
      };

      const res = await fetch('/api/wifi/radius', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (data.success) {
        toast({ title: 'Success', description: `FAP policy ${editingPolicy ? 'updated' : 'created'}` });
        setDialogOpen(false);
        resetForm();
        fetchPolicies();
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to save policy', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to save policy', variant: 'destructive' });
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
        toast({ title: 'Success', description: 'FAP policy deleted' });
        fetchPolicies();
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to delete', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to delete', variant: 'destructive' });
    } finally {
      setDeleteId(null);
    }
  };

  const handleToggle = async (policy: FapPolicy) => {
    try {
      const res = await fetch('/api/wifi/radius', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'fap-policies-update', id: policy.id, enabled: !policy.enabled }),
      });
      const data = await res.json();
      if (data.success) {
        fetchPolicies();
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to toggle', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to toggle policy', variant: 'destructive' });
    }
  };

  // ─── Check Usage ────────────────────────────────────────────────────────────

  const handleCheckUsage = async () => {
    if (!checkUsername.trim() || !checkPolicyId) {
      toast({ title: 'Error', description: 'Username and policy are required', variant: 'destructive' });
      return;
    }
    setCheckingUsage(true);
    setUsageResult(null);
    try {
      const res = await fetch(
        `/api/wifi/radius?action=fap-policies-check&username=${encodeURIComponent(checkUsername.trim())}&policyId=${checkPolicyId}`
      );
      const data = await res.json();
      if (data.success && data.data) {
        setUsageResult(data.data);
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to check usage', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to check usage', variant: 'destructive' });
    } finally {
      setCheckingUsage(false);
    }
  };

  // ─── Enforce Now ────────────────────────────────────────────────────────────

  const handleEnforce = async (policy: FapPolicy) => {
    setEnforcingId(policy.id);
    try {
      const res = await fetch('/api/wifi/radius', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'fap-policies-enforce', id: policy.id }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'Enforced', description: `FAP policy "${policy.name}" enforcement triggered` });
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to enforce', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to enforce policy', variant: 'destructive' });
    } finally {
      setEnforcingId(null);
    }
  };

  // ─── Filtering ──────────────────────────────────────────────────────────────

  const filteredPolicies = policies.filter(p => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return p.name.toLowerCase().includes(q);
    }
    return true;
  });

  const getCycleBadge = (cycleType: string) => {
    const colors: Record<string, string> = {
      daily: 'bg-sky-500',
      weekly: 'bg-amber-500',
      monthly: 'bg-violet-500',
    };
    const color = colors[cycleType] || 'bg-gray-500';
    return (
      <Badge className={`${color} hover:${color} text-white border-0 text-xs capitalize`}>
        <Timer className="h-3 w-3 mr-1" />
        {cycleType}
      </Badge>
    );
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Gauge className="h-5 w-5" />
            Fair Access Policies
          </h2>
          <p className="text-sm text-muted-foreground">
            Data cap policies with bandwidth throttle enforcement
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchPolicies}>
            <RefreshCw className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
            Refresh
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            New Policy
          </Button>
        </div>
      </div>

      {/* Info Banner */}
      <Card className="bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Gauge className="h-5 w-5 text-orange-600 dark:text-orange-400 mt-0.5 shrink-0" />
            <div className="text-sm text-orange-800 dark:text-orange-200">
              <p className="font-medium">Fair Access Policy (FAP)</p>
              <p className="text-orange-600 dark:text-orange-400 mt-0.5">
                When a user exceeds the data cap, their bandwidth is automatically throttled to the configured throttle policy via CoA.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Check Usage */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium">Check User Usage Against Policy</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground mb-1 block">Username</Label>
              <Input
                placeholder="Enter username"
                value={checkUsername}
                onChange={(e) => setCheckUsername(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCheckUsage(); }}
              />
            </div>
            <div className="w-full sm:w-48">
              <Label className="text-xs text-muted-foreground mb-1 block">Policy</Label>
              <Select value={checkPolicyId} onValueChange={setCheckPolicyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select policy" />
                </SelectTrigger>
                <SelectContent>
                  {policies.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button variant="outline" onClick={handleCheckUsage} disabled={checkingUsage}>
                {checkingUsage ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                Check Usage
              </Button>
            </div>
          </div>
          {usageResult && (
            <div className={cn(
              'mt-3 p-3 rounded-lg border',
              usageResult.isExceeded
                ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800'
                : 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800'
            )}>
              <div className="flex items-center gap-2">
                {usageResult.isExceeded ? (
                  <XCircle className="h-4 w-4 text-red-500 dark:text-red-400" />
                ) : (
                  <CheckCircle className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
                )}
                <span className="text-sm font-medium">
                  {usageResult.username}: {usageResult.usedData} {usageResult.usedUnit} / {usageResult.limitData} {usageResult.limitUnit} ({usageResult.percentage}%)
                </span>
                {usageResult.isExceeded && (
                  <Badge className="bg-red-500 hover:bg-red-600 text-white border-0 text-xs ml-auto">
                    Limit Exceeded
                  </Badge>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Policies Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredPolicies.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted/50 p-4 mb-3">
                <Gauge className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <h3 className="text-sm font-medium text-muted-foreground">No FAP policies</h3>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Create a policy to enforce data caps with bandwidth throttle
              </p>
            </div>
          ) : (
            <div className="max-h-[500px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Cycle</TableHead>
                    <TableHead>Data Limit</TableHead>
                    <TableHead>Applies To</TableHead>
                    <TableHead>Reset Time</TableHead>
                    <TableHead>Throttle Policy</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPolicies.map((policy) => (
                    <TableRow key={policy.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Gauge className="h-4 w-4 text-muted-foreground" />
                          <p className="font-medium text-sm">{policy.name}</p>
                        </div>
                      </TableCell>
                      <TableCell>{getCycleBadge(policy.cycleType)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <HardDrive className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm font-medium tabular-nums">
                            {policy.dataLimit} {policy.unit}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs capitalize">{policy.applicableOn}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-mono text-muted-foreground">
                          {String(policy.resetHours).padStart(2, '0')}:{String(policy.resetMinutes).padStart(2, '0')}
                        </span>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm text-muted-foreground">{policy.throttlePolicyName || '—'}</p>
                      </TableCell>
                      <TableCell>
                        <Switch checked={policy.enabled} onCheckedChange={() => handleToggle(policy)} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleEnforce(policy)} disabled={enforcingId === policy.id}>
                            {enforcingId === policy.id ? (
                              <Loader2 className="h-4 w-4 animate-spin text-orange-500 dark:text-orange-400" />
                            ) : (
                              <Zap className="h-4 w-4 text-orange-500 dark:text-orange-400" />
                            )}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openEdit(policy)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setDeleteId(policy.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setDialogOpen(open); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingPolicy ? 'Edit FAP Policy' : 'New FAP Policy'}</DialogTitle>
            <DialogDescription>
              {editingPolicy ? 'Update Fair Access Policy settings' : 'Create a new data cap policy with bandwidth throttle'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Policy Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Daily 5GB Limit"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Cycle Type</Label>
                <Select value={form.cycleType} onValueChange={(v) => setForm(prev => ({ ...prev, cycleType: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CYCLE_TYPE_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Data Limit *</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.dataLimit}
                  onChange={(e) => setForm(prev => ({ ...prev, dataLimit: e.target.value }))}
                  placeholder="5"
                />
              </div>
              <div className="space-y-2">
                <Label>Unit</Label>
                <Select value={form.unit} onValueChange={(v) => setForm(prev => ({ ...prev, unit: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIT_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Applies To</Label>
                <Select value={form.applicableOn} onValueChange={(v) => setForm(prev => ({ ...prev, applicableOn: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {APPLICABLE_ON_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Reset Time</Label>
                <div className="flex gap-1 items-center">
                  <Input
                    type="number"
                    min="0"
                    max="23"
                    value={form.resetHours}
                    onChange={(e) => setForm(prev => ({ ...prev, resetHours: e.target.value }))}
                    className="w-16 text-center font-mono"
                  />
                  <span className="text-muted-foreground font-mono">:</span>
                  <Input
                    type="number"
                    min="0"
                    max="59"
                    value={form.resetMinutes}
                    onChange={(e) => setForm(prev => ({ ...prev, resetMinutes: e.target.value }))}
                    className="w-16 text-center font-mono"
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Enabled</Label>
                <p className="text-xs text-muted-foreground">Activate this FAP policy for enforcement</p>
              </div>
              <Switch checked={form.enabled} onCheckedChange={(checked) => setForm(prev => ({ ...prev, enabled: checked }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setDialogOpen(false); }}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingPolicy ? 'Update Policy' : 'Create Policy'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete FAP Policy</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this Fair Access Policy. Active enforcement rules will stop.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
