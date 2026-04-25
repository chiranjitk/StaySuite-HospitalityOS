'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
import { Skeleton } from '@/components/ui/skeleton';
import {
  Shield,
  Clock,
  AlertTriangle,
  UserX,
  Plus,
  Pencil,
  Trash2,
  Search,
  Loader2,
  CheckCircle,
  XCircle,
  FileText,
  RefreshCw,
  X,
  Percent,
  DollarSign,
  Hotel,
  Moon,
  Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// ────────────────────────────────────────────
// Types
// ────────────────────────────────────────────

interface CancellationPolicy {
  id: string;
  tenantId: string;
  propertyId: string | null;
  ratePlanId: string | null;
  name: string;
  description: string | null;
  freeCancelHoursBefore: number;
  penaltyPercent: number;
  noShowPenaltyPercent: number;
  penaltyType: 'percentage' | 'fixed_nights' | 'first_night' | 'fixed';
  penaltyFixedAmount: number | null;
  penaltyNights: number | null;
  exceptions: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface PropertyOption {
  id: string;
  name: string;
  currency?: string;
}

interface RatePlanOption {
  id: string;
  name: string;
  propertyId: string;
}

interface PolicyException {
  type: 'loyalty_tier' | 'segment' | 'custom';
  value: string;
}

type PenaltyType = 'percentage' | 'fixed_nights' | 'first_night' | 'fixed';

const PENALTY_TYPE_OPTIONS: { value: PenaltyType; label: string; icon: React.ElementType }[] = [
  { value: 'percentage', label: 'Percentage of Total', icon: Percent },
  { value: 'first_night', label: 'First Night Charge', icon: Moon },
  { value: 'fixed_nights', label: 'Fixed Number of Nights', icon: Hotel },
  { value: 'fixed', label: 'Fixed Amount', icon: DollarSign },
];

// ────────────────────────────────────────────
// Component
// ────────────────────────────────────────────

export default function CancellationPolicies() {
  const { toast } = useToast();

  // ── Data state ──
  const [policies, setPolicies] = useState<CancellationPolicy[]>([]);
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [ratePlans, setRatePlans] = useState<RatePlanOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // ── Filters ──
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPropertyId, setFilterPropertyId] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // ── Pagination ──
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // ── Dialogs ──
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<CancellationPolicy | null>(null);
  const [deletingPolicy, setDeletingPolicy] = useState<CancellationPolicy | null>(null);

  // ── Form state ──
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPropertyId, setFormPropertyId] = useState<string>('none');
  const [formRatePlanId, setFormRatePlanId] = useState<string>('none');
  const [formFreeCancelHours, setFormFreeCancelHours] = useState('48');
  const [formPenaltyType, setFormPenaltyType] = useState<PenaltyType>('percentage');
  const [formPenaltyPercent, setFormPenaltyPercent] = useState('50');
  const [formPenaltyNights, setFormPenaltyNights] = useState('1');
  const [formPenaltyFixedAmount, setFormPenaltyFixedAmount] = useState('');
  const [formNoShowPenaltyPercent, setFormNoShowPenaltyPercent] = useState('100');
  const [formExemptGoldLoyalty, setFormExemptGoldLoyalty] = useState(false);
  const [formExemptCorporateSegment, setFormExemptCorporateSegment] = useState(false);
  const [formCustomExceptions, setFormCustomExceptions] = useState<string[]>([]);
  const [formNewException, setFormNewException] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);

  const isEditing = !!editingPolicy;

  // ── Helpers ──

  const currency = 'USD';

  const buildExceptions = useCallback((): PolicyException[] => {
    const exceptions: PolicyException[] = [];
    if (formExemptGoldLoyalty) {
      exceptions.push({ type: 'loyalty_tier', value: 'gold' });
    }
    if (formExemptCorporateSegment) {
      exceptions.push({ type: 'segment', value: 'corporate' });
    }
    formCustomExceptions.forEach((value) => {
      if (value.trim()) {
        exceptions.push({ type: 'custom', value: value.trim() });
      }
    });
    return exceptions;
  }, [formExemptGoldLoyalty, formExemptCorporateSegment, formCustomExceptions]);

  const parseExceptions = (raw: string): PolicyException[] => {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // ignore
    }
    return [];
  };

  const formatPenaltyLabel = (policy: CancellationPolicy): string => {
    switch (policy.penaltyType) {
      case 'percentage':
        return `${policy.penaltyPercent}% of total`;
      case 'first_night':
        return 'First night charge';
      case 'fixed_nights':
        return `${policy.penaltyNights} night${policy.penaltyNights !== 1 ? 's' : ''} charge`;
      case 'fixed':
        return `${currency} ${policy.penaltyFixedAmount?.toFixed(2) ?? '0.00'}`;
      default:
        return 'Unknown';
    }
  };

  const formatPenaltyShort = (policy: CancellationPolicy): string => {
    switch (policy.penaltyType) {
      case 'percentage':
        return `${policy.penaltyPercent}%`;
      case 'first_night':
        return '1 Night';
      case 'fixed_nights':
        return `${policy.penaltyNights} Night${policy.penaltyNights !== 1 ? 's' : ''}`;
      case 'fixed':
        return `${currency} ${policy.penaltyFixedAmount?.toFixed(2) ?? '0.00'}`;
      default:
        return '—';
    }
  };

  // ── Data fetching ──

  const fetchProperties = useCallback(async () => {
    try {
      const res = await fetch('/api/properties?limit=100');
      const json = await res.json();
      if (json.success) {
        setProperties(
          (json.data || json.properties || []).map((p: { id: string; name: string; currency?: string }) => ({
            id: p.id,
            name: p.name,
            currency: p.currency,
          }))
        );
      }
    } catch {
      // silent — property dropdown is optional
    }
  }, []);

  const fetchRatePlans = useCallback(async (propertyId: string) => {
    try {
      const params = new URLSearchParams();
      params.set('limit', '100');
      if (propertyId && propertyId !== 'none') {
        params.set('propertyId', propertyId);
      }
      const res = await fetch(`/api/rate-plans?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setRatePlans(
          (json.data || json.ratePlans || []).map((rp: { id: string; name: string; propertyId: string }) => ({
            id: rp.id,
            name: rp.name,
            propertyId: rp.propertyId,
          }))
        );
      }
    } catch {
      // silent
    }
  }, []);

  const fetchPolicies = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '20');
      if (searchQuery) params.set('search', searchQuery);
      if (filterPropertyId && filterPropertyId !== 'all') params.set('propertyId', filterPropertyId);
      if (filterStatus === 'active') params.set('isActive', 'true');
      else if (filterStatus === 'inactive') params.set('isActive', 'false');
      params.set('includeInactive', 'true');

      const res = await fetch(`/api/cancellation-policies?${params.toString()}`);
      const json = await res.json();

      if (json.success) {
        setPolicies(json.data || []);
        if (json.pagination) {
          setTotalPages(json.pagination.totalPages || 1);
          setTotalCount(json.pagination.total || 0);
        }
      } else {
        toast({
          title: 'Error',
          description: json.error?.message || 'Failed to load policies',
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('Error fetching cancellation policies:', err);
      toast({
        title: 'Error',
        description: 'Failed to load cancellation policies',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [page, searchQuery, filterPropertyId, filterStatus, toast]);

  // ── Effects ──

  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  useEffect(() => {
    fetchPolicies();
  }, [fetchPolicies]);

  // Fetch rate plans when property changes in the form
  useEffect(() => {
    if (formPropertyId && formPropertyId !== 'none') {
      fetchRatePlans(formPropertyId);
    } else {
      setRatePlans([]);
    }
  }, [formPropertyId, fetchRatePlans]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length >= 2 || searchQuery.length === 0) {
        setPage(1);
        fetchPolicies();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [filterPropertyId, filterStatus]);

  // ── Form helpers ──

  const resetForm = useCallback(() => {
    setEditingPolicy(null);
    setFormName('');
    setFormDescription('');
    setFormPropertyId('none');
    setFormRatePlanId('none');
    setFormFreeCancelHours('48');
    setFormPenaltyType('percentage');
    setFormPenaltyPercent('50');
    setFormPenaltyNights('1');
    setFormPenaltyFixedAmount('');
    setFormNoShowPenaltyPercent('100');
    setFormExemptGoldLoyalty(false);
    setFormExemptCorporateSegment(false);
    setFormCustomExceptions([]);
    setFormNewException('');
    setFormIsActive(true);
  }, []);

  const openCreateDialog = useCallback(() => {
    resetForm();
    setIsFormOpen(true);
  }, [resetForm]);

  const openEditDialog = useCallback((policy: CancellationPolicy) => {
    setEditingPolicy(policy);
    setFormName(policy.name);
    setFormDescription(policy.description || '');
    setFormPropertyId(policy.propertyId || 'none');
    setFormRatePlanId(policy.ratePlanId || 'none');
    setFormFreeCancelHours(String(policy.freeCancelHoursBefore));
    setFormPenaltyType(policy.penaltyType as PenaltyType);
    setFormPenaltyPercent(String(policy.penaltyPercent));
    setFormPenaltyNights(policy.penaltyNights ? String(policy.penaltyNights) : '1');
    setFormPenaltyFixedAmount(policy.penaltyFixedAmount ? String(policy.penaltyFixedAmount) : '');
    setFormNoShowPenaltyPercent(String(policy.noShowPenaltyPercent));
    setFormIsActive(policy.isActive);

    // Parse exceptions
    const excs = parseExceptions(policy.exceptions);
    setFormExemptGoldLoyalty(excs.some((e) => e.type === 'loyalty_tier' && e.value === 'gold'));
    setFormExemptCorporateSegment(excs.some((e) => e.type === 'segment' && e.value === 'corporate'));
    const customs = excs
      .filter((e) => e.type === 'custom')
      .map((e) => e.value);
    setFormCustomExceptions(customs);

    setIsFormOpen(true);
  }, []);

  const addCustomException = useCallback(() => {
    const trimmed = formNewException.trim();
    if (trimmed && !formCustomExceptions.includes(trimmed)) {
      setFormCustomExceptions((prev) => [...prev, trimmed]);
      setFormNewException('');
    }
  }, [formNewException, formCustomExceptions]);

  const removeCustomException = useCallback((value: string) => {
    setFormCustomExceptions((prev) => prev.filter((e) => e !== value));
  }, []);

  // ── CRUD operations ──

  const handleSave = useCallback(async () => {
    if (!formName.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Policy name is required',
        variant: 'destructive',
      });
      return;
    }

    // Validate conditional fields
    if (formPenaltyType === 'percentage') {
      if (!formPenaltyPercent || Number(formPenaltyPercent) <= 0 || Number(formPenaltyPercent) > 100) {
        toast({
          title: 'Validation Error',
          description: 'Penalty percent must be between 1 and 100',
          variant: 'destructive',
        });
        return;
      }
    }
    if (formPenaltyType === 'fixed_nights' || formPenaltyType === 'first_night') {
      if (!formPenaltyNights || Number(formPenaltyNights) < 1) {
        toast({
          title: 'Validation Error',
          description: 'Number of nights must be at least 1',
          variant: 'destructive',
        });
        return;
      }
    }
    if (formPenaltyType === 'fixed') {
      if (!formPenaltyFixedAmount || Number(formPenaltyFixedAmount) <= 0) {
        toast({
          title: 'Validation Error',
          description: 'Fixed amount must be greater than 0',
          variant: 'destructive',
        });
        return;
      }
    }

    setIsSaving(true);

    try {
      const exceptions = buildExceptions();

      const body: Record<string, unknown> = {
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        propertyId: formPropertyId && formPropertyId !== 'none' ? formPropertyId : undefined,
        ratePlanId: formRatePlanId && formRatePlanId !== 'none' ? formRatePlanId : undefined,
        freeCancelHoursBefore: Number(formFreeCancelHours) || 48,
        penaltyType: formPenaltyType,
        noShowPenaltyPercent: Number(formNoShowPenaltyPercent) || 100,
        exceptions,
        isActive: formIsActive,
      };

      // Set conditional fields based on penalty type
      if (formPenaltyType === 'percentage') {
        body.penaltyPercent = Number(formPenaltyPercent);
      } else if (formPenaltyType === 'fixed_nights' || formPenaltyType === 'first_night') {
        body.penaltyNights = Number(formPenaltyNights) || 1;
      } else if (formPenaltyType === 'fixed') {
        body.penaltyFixedAmount = Number(formPenaltyFixedAmount);
      }

      const url = isEditing
        ? `/api/cancellation-policies/${editingPolicy!.id}`
        : '/api/cancellation-policies';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const json = await res.json();

      if (json.success) {
        toast({
          title: isEditing ? 'Policy Updated' : 'Policy Created',
          description: `Cancellation policy "${formName}" ${isEditing ? 'updated' : 'created'} successfully`,
        });
        setIsFormOpen(false);
        resetForm();
        fetchPolicies();
      } else {
        toast({
          title: 'Error',
          description: json.error?.message || `Failed to ${isEditing ? 'update' : 'create'} policy`,
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error(`Error ${isEditing ? 'updating' : 'creating'} policy:`, err);
      toast({
        title: 'Error',
        description: `Failed to ${isEditing ? 'update' : 'create'} cancellation policy`,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }, [
    formName,
    formDescription,
    formPropertyId,
    formRatePlanId,
    formFreeCancelHours,
    formPenaltyType,
    formPenaltyPercent,
    formPenaltyNights,
    formPenaltyFixedAmount,
    formNoShowPenaltyPercent,
    formIsActive,
    isEditing,
    editingPolicy,
    buildExceptions,
    toast,
    resetForm,
    fetchPolicies,
  ]);

  const handleDelete = useCallback(async () => {
    if (!deletingPolicy) return;

    setIsSaving(true);
    try {
      const res = await fetch(`/api/cancellation-policies/${deletingPolicy.id}`, {
        method: 'DELETE',
      });
      const json = await res.json();

      if (json.success) {
        toast({
          title: 'Policy Deleted',
          description: `"${deletingPolicy.name}" has been deleted`,
        });
        setIsDeleteOpen(false);
        setDeletingPolicy(null);
        fetchPolicies();
      } else {
        toast({
          title: 'Error',
          description: json.error?.message || 'Failed to delete policy',
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('Error deleting policy:', err);
      toast({
        title: 'Error',
        description: 'Failed to delete cancellation policy',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }, [deletingPolicy, toast, fetchPolicies]);

  // ── Computed stats ──

  const stats = {
    total: totalCount,
    active: policies.filter((p) => p.isActive).length + Math.max(0, totalCount - policies.length), // approximate
    avgFreeWindow:
      policies.length > 0
        ? Math.round(policies.reduce((sum, p) => sum + p.freeCancelHoursBefore, 0) / policies.length)
        : 0,
  };

  // Recalculate active count properly from the list
  const activeCount = policies.filter((p) => p.isActive).length;

  // ── Filtered rate plans for form (by selected property) ──
  const filteredRatePlans = formPropertyId && formPropertyId !== 'none'
    ? ratePlans.filter((rp) => rp.propertyId === formPropertyId)
    : ratePlans;

  // ────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Cancellation Policies
          </h2>
          <p className="text-sm text-muted-foreground">
            Define cancellation rules, penalties, and guest exemptions
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchPolicies}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Create Policy
          </Button>
        </div>
      </div>

      {/* ── Stats Cards ── */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-violet-500/10">
              <FileText className="h-5 w-5 text-violet-500 dark:text-violet-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-xs text-muted-foreground">Total Policies</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-500/10">
              <CheckCircle className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{activeCount}</div>
              <div className="text-xs text-muted-foreground">Active Policies</div>
            </div>
          </div>
        </Card>
        <Card className="p-4 col-span-2 sm:col-span-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-amber-500/10">
              <Clock className="h-5 w-5 text-amber-500 dark:text-amber-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.avgFreeWindow}h</div>
              <div className="text-xs text-muted-foreground">Avg. Free Window</div>
            </div>
          </div>
        </Card>
      </div>

      {/* ── Filter Bar ── */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search policies by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={filterPropertyId} onValueChange={setFilterPropertyId}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="All Properties" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Properties</SelectItem>
                {properties.map((prop) => (
                  <SelectItem key={prop.id} value={prop.id}>
                    {prop.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* ── Policy Cards ── */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-6">
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-72" />
                  <div className="flex gap-4 pt-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </div>
                <Skeleton className="h-8 w-24" />
              </div>
            </Card>
          ))}
        </div>
      ) : policies.length === 0 ? (
        <Card className="p-12">
          <div className="flex flex-col items-center text-muted-foreground">
            <FileText className="h-12 w-12 mb-4" />
            <p className="text-lg font-medium">No cancellation policies found</p>
            <p className="text-sm mt-1">
              Create your first cancellation policy to define guest cancellation rules
            </p>
            <Button className="mt-4" onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Create Policy
            </Button>
          </div>
        </Card>
      ) : (
        <>
          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
            {policies.map((policy) => {
              const exceptions = parseExceptions(policy.exceptions);
              const propertyName = properties.find((p) => p.id === policy.propertyId)?.name;

              return (
                <Card
                  key={policy.id}
                  className={cn(
                    'transition-colors',
                    !policy.isActive && 'opacity-60'
                  )}
                >
                  <CardContent className="p-5">
                    {/* Top row: name + status */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-base truncate">{policy.name}</h3>
                          <Badge
                            variant="secondary"
                            className={cn(
                              'text-white gap-1 text-xs',
                              policy.isActive ? 'bg-emerald-500' : 'bg-gray-500'
                            )}
                          >
                            {policy.isActive ? (
                              <CheckCircle className="h-3 w-3" />
                            ) : (
                              <XCircle className="h-3 w-3" />
                            )}
                            {policy.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                          {propertyName && (
                            <Badge variant="outline" className="gap-1 text-xs">
                              <Building2 className="h-3 w-3" />
                              {propertyName}
                            </Badge>
                          )}
                        </div>
                        {policy.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {policy.description}
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEditDialog(policy)}
                          title="Edit Policy"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 dark:text-red-400 hover:text-red-600 hover:bg-red-50"
                          onClick={() => {
                            setDeletingPolicy(policy);
                            setIsDeleteOpen(true);
                          }}
                          title="Delete Policy"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <Separator className="my-3" />

                    {/* Detail row */}
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                      {/* Free cancellation */}
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Clock className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                        <span>
                          Free cancellation{' '}
                          <span className="font-medium text-foreground">
                            {policy.freeCancelHoursBefore}h before check-in
                          </span>
                        </span>
                      </div>

                      {/* Penalty */}
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <AlertTriangle className="h-4 w-4 text-orange-500 dark:text-orange-400" />
                        <span>
                          Penalty:{' '}
                          <span className="font-medium text-foreground">
                            {formatPenaltyShort(policy)}
                          </span>
                        </span>
                      </div>

                      {/* No-show penalty */}
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <UserX className="h-4 w-4 text-red-500 dark:text-red-400" />
                        <span>
                          No-show:{' '}
                          <span className="font-medium text-foreground">
                            {policy.noShowPenaltyPercent}% charge
                          </span>
                        </span>
                      </div>
                    </div>

                    {/* Exceptions badges */}
                    {exceptions.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 mt-3">
                        <Shield className="h-3.5 w-3.5 text-muted-foreground mr-0.5" />
                        {exceptions.map((exc, idx) => {
                          const label =
                            exc.type === 'loyalty_tier'
                              ? `Gold+ Loyalty`
                              : exc.type === 'segment'
                                ? 'Corporate'
                                : exc.value;
                          return (
                            <Badge
                              key={`${exc.type}-${exc.value}-${idx}`}
                              variant="secondary"
                              className="text-xs bg-slate-100 dark:bg-slate-800"
                            >
                              {label}
                            </Badge>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* ── Pagination ── */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing page {page} of {totalPages} ({totalCount} total)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ────────────────────────────────────── */}
      {/* Create / Edit Dialog                   */}
      {/* ────────────────────────────────────── */}
      <Dialog
        open={isFormOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsFormOpen(false);
            resetForm();
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>{isEditing ? 'Edit Cancellation Policy' : 'Create Cancellation Policy'}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? 'Update the cancellation policy configuration'
                : 'Define a new cancellation policy with penalties and exemptions'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4 flex-1 overflow-y-auto pr-2 -mr-2">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="policy-name">
                Policy Name <span className="text-red-500 dark:text-red-400">*</span>
              </Label>
              <Input
                id="policy-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Standard Flexible, Non-Refundable"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="policy-desc">Description</Label>
              <Textarea
                id="policy-desc"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Brief description of this policy..."
                rows={2}
              />
            </div>

            {/* Property + Rate Plan */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Property</Label>
                <Select value={formPropertyId} onValueChange={(val) => {
                  setFormPropertyId(val);
                  setFormRatePlanId('none'); // reset rate plan when property changes
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Properties" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">All Properties</SelectItem>
                    {properties.map((prop) => (
                      <SelectItem key={prop.id} value={prop.id}>
                        {prop.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Rate Plan</Label>
                <Select value={formRatePlanId} onValueChange={setFormRatePlanId}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Rate Plans" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">All Rate Plans</SelectItem>
                    {filteredRatePlans.map((rp) => (
                      <SelectItem key={rp.id} value={rp.id}>
                        {rp.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formPropertyId !== 'none' && filteredRatePlans.length === 0 && ratePlans.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    No rate plans found for this property
                  </p>
                )}
              </div>
            </div>

            <Separator />

            {/* Free Cancellation Hours */}
            <div className="space-y-2">
              <Label htmlFor="free-cancel-hours">
                Free Cancellation — Hours Before Check-in
              </Label>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-500 dark:text-amber-400 shrink-0" />
                <Input
                  id="free-cancel-hours"
                  type="number"
                  min="0"
                  max="720"
                  value={formFreeCancelHours}
                  onChange={(e) => setFormFreeCancelHours(e.target.value)}
                  className="w-32"
                />
                <span className="text-sm text-muted-foreground">
                  hours (0 = non-refundable)
                </span>
              </div>
            </div>

            {/* Penalty Type */}
            <div className="space-y-2">
              <Label>Penalty Type</Label>
              <Select
                value={formPenaltyType}
                onValueChange={(val) => setFormPenaltyType(val as PenaltyType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PENALTY_TYPE_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    return (
                      <SelectItem key={opt.value} value={opt.value}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {opt.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Conditional penalty field */}
            {formPenaltyType === 'percentage' && (
              <div className="space-y-2">
                <Label htmlFor="penalty-percent">Penalty Percent</Label>
                <div className="flex items-center gap-2">
                  <Percent className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Input
                    id="penalty-percent"
                    type="number"
                    min="1"
                    max="100"
                    value={formPenaltyPercent}
                    onChange={(e) => setFormPenaltyPercent(e.target.value)}
                    className="w-32"
                  />
                  <span className="text-sm text-muted-foreground">% of total booking</span>
                </div>
              </div>
            )}

            {(formPenaltyType === 'fixed_nights' || formPenaltyType === 'first_night') && (
              <div className="space-y-2">
                <Label htmlFor="penalty-nights">Number of Nights</Label>
                <div className="flex items-center gap-2">
                  <Moon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Input
                    id="penalty-nights"
                    type="number"
                    min="1"
                    value={formPenaltyNights}
                    onChange={(e) => setFormPenaltyNights(e.target.value)}
                    className="w-32"
                    disabled={formPenaltyType === 'first_night'}
                  />
                  <span className="text-sm text-muted-foreground">
                    {formPenaltyType === 'first_night'
                      ? '(always 1 for first night)'
                      : 'nights at room rate'}
                  </span>
                </div>
              </div>
            )}

            {formPenaltyType === 'fixed' && (
              <div className="space-y-2">
                <Label htmlFor="penalty-fixed-amount">Fixed Penalty Amount</Label>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Input
                    id="penalty-fixed-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={formPenaltyFixedAmount}
                    onChange={(e) => setFormPenaltyFixedAmount(e.target.value)}
                    className="w-32"
                  />
                  <span className="text-sm text-muted-foreground">{currency}</span>
                </div>
              </div>
            )}

            <Separator />

            {/* No-Show Penalty */}
            <div className="space-y-2">
              <Label htmlFor="no-show-percent">No-Show Penalty</Label>
              <div className="flex items-center gap-2">
                <UserX className="h-4 w-4 text-red-500 dark:text-red-400 shrink-0" />
                <Input
                  id="no-show-percent"
                  type="number"
                  min="0"
                  max="100"
                  value={formNoShowPenaltyPercent}
                  onChange={(e) => setFormNoShowPenaltyPercent(e.target.value)}
                  className="w-32"
                />
                <span className="text-sm text-muted-foreground">% charge (default: 100%)</span>
              </div>
            </div>

            <Separator />

            {/* Exceptions */}
            <div className="space-y-3">
              <Label>Exemptions</Label>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                  <span className="text-sm">Exempt Gold+ Loyalty Tier</span>
                </div>
                <Switch
                  checked={formExemptGoldLoyalty}
                  onCheckedChange={setFormExemptGoldLoyalty}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                  <span className="text-sm">Exempt Corporate Segment</span>
                </div>
                <Switch
                  checked={formExemptCorporateSegment}
                  onCheckedChange={setFormExemptCorporateSegment}
                />
              </div>

              {/* Custom exceptions */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Custom Exemptions</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. Platinum VIP"
                    value={formNewException}
                    onChange={(e) => setFormNewException(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addCustomException();
                      }
                    }}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addCustomException}
                    disabled={!formNewException.trim()}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {formCustomExceptions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {formCustomExceptions.map((exc) => (
                      <Badge key={exc} variant="secondary" className="gap-1 text-xs">
                        {exc}
                        <button
                          type="button"
                          className="ml-0.5 hover:text-red-500 dark:text-red-400"
                          onClick={() => removeCustomException(exc)}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Active toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
                <Label htmlFor="form-active">Active</Label>
              </div>
              <Switch
                id="form-active"
                checked={formIsActive}
                onCheckedChange={setFormIsActive}
              />
            </div>
          </div>

          <DialogFooter className="shrink-0 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                setIsFormOpen(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEditing ? 'Update Policy' : 'Create Policy'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ────────────────────────────────────── */}
      {/* Delete Confirmation Dialog             */}
      {/* ────────────────────────────────────── */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Cancellation Policy</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deletingPolicy?.name}&quot;? This action
              cannot be undone. Any bookings currently using this policy will fall back to the
              default policy.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {deletingPolicy && (
            <div className="my-2 p-3 rounded-lg bg-muted/50 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Free Window</span>
                <span className="font-medium">{deletingPolicy.freeCancelHoursBefore}h</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Penalty</span>
                <span className="font-medium">{formatPenaltyLabel(deletingPolicy)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">No-Show</span>
                <span className="font-medium">{deletingPolicy.noShowPenaltyPercent}%</span>
              </div>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setIsDeleteOpen(false);
                setDeletingPolicy(null);
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              disabled={isSaving}
            >
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete Policy
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
