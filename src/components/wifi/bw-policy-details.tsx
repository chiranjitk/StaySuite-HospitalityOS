'use client';

/**
 * Bandwidth Policy Details Component
 *
 * Enhanced bandwidth policy detail management.
 * Fields: download/upload limits, guaranteed down/up, burst time/threshold,
 * contention ratio, priority, schedule link.
 *
 * Data source: /api/wifi/radius?action=bw-policy-details-*
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  ArrowDownToLine,
  ArrowUpFromLine,
  Zap,
  Clock,
  BarChart3,
  Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface BwPolicyDetail {
  id: string;
  policyId?: string;
  policyName?: string;
  downloadLimit: number;
  uploadLimit: number;
  guaranteedDownload: number;
  guaranteedUpload: number;
  burstTime?: number;
  burstThresholdDown?: number;
  burstThresholdUp?: number;
  contentionRatio?: number;
  priority?: number;
  scheduleId?: string;
  scheduleName?: string;
  bandwidth?: string;
}

interface BwPolicyDetailFormData {
  policyId: string;
  downloadLimit: string;
  uploadLimit: string;
  guaranteedDownload: string;
  guaranteedUpload: string;
  burstTime: string;
  burstThresholdDown: string;
  burstThresholdUp: string;
  contentionRatio: string;
  priority: string;
  scheduleId: string;
}

interface BwPolicy {
  id: string;
  name: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const EMPTY_FORM: BwPolicyDetailFormData = {
  policyId: '',
  downloadLimit: '10',
  uploadLimit: '5',
  guaranteedDownload: '2',
  guaranteedUpload: '1',
  burstTime: '60',
  burstThresholdDown: '20',
  burstThresholdUp: '10',
  contentionRatio: '10',
  priority: '5',
  scheduleId: '',
};

const PRIORITY_OPTIONS = [
  { value: '1', label: '1 - Highest' },
  { value: '2', label: '2 - Very High' },
  { value: '3', label: '3 - High' },
  { value: '4', label: '4 - Medium-High' },
  { value: '5', label: '5 - Medium (Default)' },
  { value: '6', label: '6 - Medium-Low' },
  { value: '7', label: '7 - Low' },
  { value: '8', label: '8 - Very Low' },
  { value: '9', label: '9 - Lowest' },
];

// ─── Component ──────────────────────────────────────────────────────────────────

export default function BwPolicyDetails() {
  const { toast } = useToast();
  const [details, setDetails] = useState<BwPolicyDetail[]>([]);
  const [policies, setPolicies] = useState<BwPolicy[]>([]);
  const [schedules, setSchedules] = useState<BwPolicy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [policyFilter, setPolicyFilter] = useState<string>('all');

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDetail, setEditingDetail] = useState<BwPolicyDetail | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Form
  const [form, setForm] = useState<BwPolicyDetailFormData>(EMPTY_FORM);

  // ─── Fetch ──────────────────────────────────────────────────────────────────

  const fetchDetails = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (policyFilter !== 'all') params.append('policyId', policyFilter);

      const [detailsRes, policiesRes] = await Promise.all([
        fetch(`/api/wifi/radius?action=bw-policy-details-list&${params.toString()}`),
        fetch('/api/wifi/radius?action=bw-policy-details-list&context=policies'),
      ]);
      const detailsData = await detailsRes.json();
      const policiesData = await policiesRes.json();

      if (detailsData.success && detailsData.data) {
        setDetails(Array.isArray(detailsData.data) ? detailsData.data : []);
      } else {
        setDetails([]);
      }

      if (policiesData.success && policiesData.data) {
        setPolicies(Array.isArray(policiesData.data) ? policiesData.data : []);
      }

      // Also fetch schedules for dropdown
      try {
        const schedRes = await fetch('/api/wifi/radius?action=bandwidth-schedules');
        const schedData = await schedRes.json();
        if (schedData.success && schedData.data) {
          setSchedules(Array.isArray(schedData.data) ? schedData.data : []);
        }
      } catch {
        // Schedules not available — empty dropdown
      }
    } catch (error) {
      console.error('Failed to fetch BW policy details:', error);
      setDetails([]);
    } finally {
      setIsLoading(false);
    }
  }, [policyFilter]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  // ─── Form Helpers ───────────────────────────────────────────────────────────

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingDetail(null);
  };

  const openCreate = () => {
    resetForm();
    if (policyFilter !== 'all') {
      setForm(prev => ({ ...prev, policyId: policyFilter }));
    }
    setDialogOpen(true);
  };

  const openEdit = (detail: BwPolicyDetail) => {
    setEditingDetail(detail);
    setForm({
      policyId: detail.policyId || '',
      downloadLimit: String(detail.downloadLimit),
      uploadLimit: String(detail.uploadLimit),
      guaranteedDownload: String(detail.guaranteedDownload),
      guaranteedUpload: String(detail.guaranteedUpload),
      burstTime: String(detail.burstTime || ''),
      burstThresholdDown: String(detail.burstThresholdDown || ''),
      burstThresholdUp: String(detail.burstThresholdUp || ''),
      contentionRatio: String(detail.contentionRatio || ''),
      priority: String(detail.priority || '5'),
      scheduleId: detail.scheduleId || '',
    });
    setDialogOpen(true);
  };

  // ─── CRUD ───────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!form.policyId) {
      toast({ title: 'Error', description: 'Bandwidth policy is required', variant: 'destructive' });
      return;
    }
    if (!form.downloadLimit || Number(form.downloadLimit) <= 0) {
      toast({ title: 'Error', description: 'Download limit must be positive', variant: 'destructive' });
      return;
    }
    if (!form.uploadLimit || Number(form.uploadLimit) <= 0) {
      toast({ title: 'Error', description: 'Upload limit must be positive', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const action = editingDetail ? 'bw-policy-details-update' : 'bw-policy-details-create';
      const body = {
        action,
        ...(editingDetail ? { id: editingDetail.id } : {}),
        policyId: form.policyId,
        downloadLimit: Number(form.downloadLimit),
        uploadLimit: Number(form.uploadLimit),
        guaranteedDownload: Number(form.guaranteedDownload || 0),
        guaranteedUpload: Number(form.guaranteedUpload || 0),
        burstTime: Number(form.burstTime || 0),
        burstThresholdDown: Number(form.burstThresholdDown || 0),
        burstThresholdUp: Number(form.burstThresholdUp || 0),
        contentionRatio: Number(form.contentionRatio || 1),
        priority: Number(form.priority || 5),
        scheduleId: form.scheduleId || null,
      };

      const res = await fetch('/api/wifi/radius', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (data.success) {
        toast({ title: 'Success', description: `Policy detail ${editingDetail ? 'updated' : 'created'}` });
        setDialogOpen(false);
        resetForm();
        fetchDetails();
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to save', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to save policy detail', variant: 'destructive' });
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
        body: JSON.stringify({ action: 'bw-policy-details-delete', id: deleteId }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'Success', description: 'Policy detail deleted' });
        fetchDetails();
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to delete', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to delete', variant: 'destructive' });
    } finally {
      setDeleteId(null);
    }
  };

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const getPriorityBadge = (priority?: number) => {
    if (!priority) return <Badge variant="outline" className="text-xs">Default</Badge>;
    if (priority <= 3) return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 text-xs">P{priority}</Badge>;
    if (priority <= 6) return <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-0 text-xs">P{priority}</Badge>;
    return <Badge className="bg-red-500 hover:bg-red-600 text-white border-0 text-xs">P{priority}</Badge>;
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Gauge className="h-5 w-5" />
            Bandwidth Policy Details
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage bandwidth limits, guaranteed rates, burst profiles, and scheduling per policy
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchDetails}>
            <RefreshCw className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
            Refresh
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Add Detail
          </Button>
        </div>
      </div>

      {/* Info Banner */}
      <Card className="bg-cyan-50 dark:bg-cyan-950/20 border-cyan-200 dark:border-cyan-800">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Gauge className="h-5 w-5 text-cyan-600 dark:text-cyan-400 mt-0.5 shrink-0" />
            <div className="text-sm text-cyan-800 dark:text-cyan-200">
              <p className="font-medium">Bandwidth Policy Details</p>
              <p className="text-cyan-600 dark:text-cyan-400 mt-0.5">
                Each detail entry defines specific speed parameters (download/upload, guaranteed, burst) that can be
                linked to time-based schedules for dynamic bandwidth changes via CoA.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">Filter by Policy:</p>
            </div>
            <Select value={policyFilter} onValueChange={setPolicyFilter}>
              <SelectTrigger className="w-full sm:w-64">
                <SelectValue placeholder="All Policies" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Policies</SelectItem>
                {policies.map(policy => (
                  <SelectItem key={policy.id} value={policy.id}>{policy.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Details Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : details.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted/50 p-4 mb-3">
                <Gauge className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <h3 className="text-sm font-medium text-muted-foreground">No bandwidth policy details</h3>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Add detail entries to define specific bandwidth parameters per policy
              </p>
            </div>
          ) : (
            <div className="max-h-[500px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Policy</TableHead>
                    <TableHead className="text-right">Download</TableHead>
                    <TableHead className="text-right">Upload</TableHead>
                    <TableHead className="text-right">Guaranteed ↓</TableHead>
                    <TableHead className="text-right">Guaranteed ↑</TableHead>
                    <TableHead className="text-right">Burst</TableHead>
                    <TableHead className="text-right">Contention</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Schedule</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {details.map((detail) => (
                    <TableRow key={detail.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <BarChart3 className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium text-sm">{detail.policyName || 'Policy'}</p>
                            <p className="text-xs text-muted-foreground">{detail.bandwidth || ''}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1 text-sm">
                          <ArrowDownToLine className="h-3 w-3 text-emerald-500 dark:text-emerald-400" />
                          <span className="font-medium tabular-nums">{detail.downloadLimit} Mbps</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1 text-sm">
                          <ArrowUpFromLine className="h-3 w-3 text-amber-500 dark:text-amber-400" />
                          <span className="font-medium tabular-nums">{detail.uploadLimit} Mbps</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-sm tabular-nums">{detail.guaranteedDownload || 0} Mbps</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-sm tabular-nums">{detail.guaranteedUpload || 0} Mbps</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-xs text-muted-foreground">
                          {detail.burstTime ? `${detail.burstTime}s` : '—'}
                        </span>
                        <p className="text-xs text-muted-foreground">
                          ↑{detail.burstThresholdDown || 0} ↓{detail.burstThresholdUp || 0}
                        </p>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-sm tabular-nums">1:{detail.contentionRatio || 1}</span>
                      </TableCell>
                      <TableCell>{getPriorityBadge(detail.priority)}</TableCell>
                      <TableCell>
                        {detail.scheduleName ? (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <Badge variant="outline" className="text-xs">{detail.scheduleName}</Badge>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(detail)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setDeleteId(detail.id)}>
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

      {/* ─── Create / Edit Dialog ────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setDialogOpen(open); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingDetail ? 'Edit Bandwidth Policy Detail' : 'New Bandwidth Policy Detail'}</DialogTitle>
            <DialogDescription>
              {editingDetail
                ? 'Modify bandwidth parameters, burst profile, and scheduling.'
                : 'Define specific speed limits, guaranteed bandwidth, burst settings, and schedule linkage.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Policy Selection */}
            <div className="space-y-2">
              <Label>Bandwidth Policy *</Label>
              <Select value={form.policyId} onValueChange={(v) => setForm(prev => ({ ...prev, policyId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select bandwidth policy" />
                </SelectTrigger>
                <SelectContent>
                  {policies.map(policy => (
                    <SelectItem key={policy.id} value={policy.id}>{policy.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Download/Upload Limits */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <ArrowDownToLine className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
                  Download Limit (Mbps) *
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.downloadLimit}
                  onChange={(e) => setForm(prev => ({ ...prev, downloadLimit: e.target.value }))}
                  placeholder="10"
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <ArrowUpFromLine className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
                  Upload Limit (Mbps) *
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.uploadLimit}
                  onChange={(e) => setForm(prev => ({ ...prev, uploadLimit: e.target.value }))}
                  placeholder="5"
                />
              </div>
            </div>

            {/* Guaranteed Bandwidth */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Guaranteed Download (Mbps)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.guaranteedDownload}
                  onChange={(e) => setForm(prev => ({ ...prev, guaranteedDownload: e.target.value }))}
                  placeholder="2"
                />
              </div>
              <div className="space-y-2">
                <Label>Guaranteed Upload (Mbps)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.guaranteedUpload}
                  onChange={(e) => setForm(prev => ({ ...prev, guaranteedUpload: e.target.value }))}
                  placeholder="1"
                />
              </div>
            </div>

            {/* Burst Settings */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Zap className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
                  Burst Time (s)
                </Label>
                <Input
                  type="number"
                  min="0"
                  value={form.burstTime}
                  onChange={(e) => setForm(prev => ({ ...prev, burstTime: e.target.value }))}
                  placeholder="60"
                />
              </div>
              <div className="space-y-2">
                <Label>Burst Down (Mbps)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.burstThresholdDown}
                  onChange={(e) => setForm(prev => ({ ...prev, burstThresholdDown: e.target.value }))}
                  placeholder="20"
                />
              </div>
              <div className="space-y-2">
                <Label>Burst Up (Mbps)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.burstThresholdUp}
                  onChange={(e) => setForm(prev => ({ ...prev, burstThresholdUp: e.target.value }))}
                  placeholder="10"
                />
              </div>
            </div>

            {/* Contention + Priority */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Contention Ratio</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.contentionRatio}
                  onChange={(e) => setForm(prev => ({ ...prev, contentionRatio: e.target.value }))}
                  placeholder="10"
                />
                <p className="text-xs text-muted-foreground">Users sharing the same bandwidth (1:1 = dedicated)</p>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm(prev => ({ ...prev, priority: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Schedule Link */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                Linked Schedule (Optional)
              </Label>
              <Select value={form.scheduleId} onValueChange={(v) => setForm(prev => ({ ...prev, scheduleId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="None — always apply" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None — always apply</SelectItem>
                  {schedules.map(sched => (
                    <SelectItem key={sched.id} value={sched.id}>{sched.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Link to a time-based schedule for dynamic bandwidth changes. If none, this detail always applies.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setDialogOpen(false); }}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingDetail ? 'Update Detail' : 'Create Detail'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation ─────────────────────────────────────────── */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Policy Detail</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this bandwidth policy detail entry.
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
