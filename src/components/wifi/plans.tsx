'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Settings,
  Plus,
  Search,
  Loader2,
  ArrowDownToLine,
  ArrowUpFromLine,
  Database,
  Clock,
  DollarSign,
  Pencil,
  Smartphone,
  Gauge,
  Trash2,
  Star,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/contexts/CurrencyContext';
import { usePropertyId } from '@/hooks/use-property';

interface WiFiPlan {
  id: string;
  name: string;
  description: string | null;
  downloadSpeed: number;
  uploadSpeed: number;
  dataLimit: number | null;
  sessionLimit: number | null;
  maxDevices: number;
  fupPolicyId: string | null;
  fupPolicyName?: string;
  price: number;
  currency: string;
  priority: number;
  validityDays: number;
  status: string;
  _count?: {
    vouchers: number;
    sessions: number;
  };
}

const planStatuses = [
  { value: 'active', label: 'Active', color: 'bg-emerald-500' },
  { value: 'inactive', label: 'Inactive', color: 'bg-gray-500' },
];

const currencies = [
  { value: 'USD', label: 'USD ($)' },
  { value: 'EUR', label: 'EUR (€)' },
  { value: 'GBP', label: 'GBP (£)' },
  { value: 'INR', label: 'INR (₹)' },
];

const formatDataSize = (mb: number | null | undefined): string => {
  if (!mb) return 'Unlimited';
  if (mb >= 1024) return `${(mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1)} GB`;
  return `${mb} MB`;
};

const formatDuration = (minutes: number | null | undefined): string => {
  if (!minutes) return 'Unlimited';
  if (minutes >= 1440) return `${(minutes / 1440).toFixed(minutes % 1440 === 0 ? 0 : 1)} day${(minutes / 1440) >= 2 ? 's' : ''}`;
  if (minutes >= 60) return `${(minutes / 60).toFixed(minutes % 60 === 0 ? 0 : 1)} hr${(minutes / 60) >= 2 ? 's' : ''}`;
  return `${minutes} min`;
};

export default function WifiPlans() {
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const [plans, setPlans] = useState<WiFiPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [summary, setSummary] = useState({
    totalPlans: 0,
    activePlans: 0,
    avgPrice: 0,
    avgDownloadSpeed: 0,
    avgUploadSpeed: 0,
  });

  const [fupPolicies, setFupPolicies] = useState<Array<{ id: string; name: string }>>([]);
  const [defaultPlanId, setDefaultPlanId] = useState<string | null>(null);
  const { propertyId } = usePropertyId();

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<WiFiPlan | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    downloadSpeed: '10',
    uploadSpeed: '5',
    dataLimit: '',
    sessionLimit: '',
    maxDevices: '1',
    fupPolicyId: '',
    price: '0',
    currency: 'USD',
    priority: '0',
    validityDays: '1',
    status: 'active',
    unlimitedData: true,
    unlimitedSession: true,
  });

  // Fetch plans
  const fetchPlans = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (statusFilter !== 'all') params.append('status', statusFilter);

      const [planRes, fupRes] = await Promise.all([
        fetch(`/api/wifi/plans?${params.toString()}`),
        fetch('/api/wifi/radius?action=fap-policies-list'),
      ]);
      const result = await planRes.json();
      const fupResult = await fupRes.json();

      if (fupResult.success && Array.isArray(fupResult.data)) {
        setFupPolicies(fupResult.data.map((p: { id: string; name: string; isEnabled: boolean }) => ({
          id: p.id,
          name: `${p.name}${p.isEnabled ? '' : ' (disabled)'}`
        })));
      }

      if (result.success) {
        setPlans(result.data);
        setSummary(result.summary);
      }
    } catch (error) {
      console.error('Error fetching plans:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch WiFi plans',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch default plan ID from AAA config
  useEffect(() => {
    if (!propertyId) return;
    fetch(`/api/wifi/aaa?propertyId=${propertyId}`)
      .then(res => res.json())
      .then(result => {
        if (result.success && result.data?.defaultPlanId) {
          setDefaultPlanId(result.data.defaultPlanId);
        }
      })
      .catch(() => {});
  }, [propertyId]);

  useEffect(() => {
    fetchPlans();
  }, [statusFilter]);

  const isInitialMount = useRef(true);

  // Debounced search
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    const timer = setTimeout(() => {
      if (searchQuery.length >= 2 || searchQuery.length === 0) {
        fetchPlans();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Create plan
  const handleCreate = async () => {
    if (!formData.name || !formData.downloadSpeed || !formData.uploadSpeed) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/wifi/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || null,
          downloadSpeed: parseInt(formData.downloadSpeed),
          uploadSpeed: parseInt(formData.uploadSpeed),
          dataLimit: formData.unlimitedData ? null : (formData.dataLimit ? parseInt(formData.dataLimit) : null),
          sessionLimit: formData.unlimitedSession ? null : (formData.sessionLimit ? parseInt(formData.sessionLimit) : null),
          maxDevices: parseInt(formData.maxDevices),
          fupPolicyId: formData.fupPolicyId && formData.fupPolicyId !== 'none' ? formData.fupPolicyId : undefined,
          price: parseFloat(formData.price),
          currency: formData.currency,
          priority: parseInt(formData.priority),
          validityDays: parseInt(formData.validityDays),
          status: formData.status,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: 'WiFi plan created successfully',
        });
        setIsCreateOpen(false);
        resetForm();
        fetchPlans();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to create plan',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error creating plan:', error);
      toast({
        title: 'Error',
        description: 'Failed to create plan',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Update plan
  const handleUpdate = async () => {
    if (!selectedPlan) return;

    setIsSaving(true);
    try {
      const response = await fetch('/api/wifi/plans', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedPlan.id,
          name: formData.name,
          description: formData.description || null,
          downloadSpeed: parseInt(formData.downloadSpeed),
          uploadSpeed: parseInt(formData.uploadSpeed),
          dataLimit: formData.unlimitedData ? null : (formData.dataLimit ? parseInt(formData.dataLimit) : null),
          sessionLimit: formData.unlimitedSession ? null : (formData.sessionLimit ? parseInt(formData.sessionLimit) : null),
          maxDevices: parseInt(formData.maxDevices),
          fupPolicyId: formData.fupPolicyId && formData.fupPolicyId !== 'none' ? formData.fupPolicyId : null,
          price: parseFloat(formData.price),
          currency: formData.currency,
          priority: parseInt(formData.priority),
          validityDays: parseInt(formData.validityDays),
          status: formData.status,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: 'WiFi plan updated successfully',
        });
        setIsEditOpen(false);
        setSelectedPlan(null);
        fetchPlans();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to update plan',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error updating plan:', error);
      toast({
        title: 'Error',
        description: 'Failed to update plan',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Delete plan
  const handleDelete = async () => {
    if (!selectedPlan) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/wifi/plans?id=${selectedPlan.id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: result.message || 'WiFi plan deleted successfully',
        });
        setIsDeleteOpen(false);
        setSelectedPlan(null);
        fetchPlans();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to delete plan',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error deleting plan:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete plan',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const openEditDialog = (plan: WiFiPlan) => {
    setSelectedPlan(plan);
    setFormData({
      name: plan.name,
      description: plan.description || '',
      downloadSpeed: plan.downloadSpeed.toString(),
      uploadSpeed: plan.uploadSpeed.toString(),
      dataLimit: plan.dataLimit?.toString() || '',
      sessionLimit: plan.sessionLimit?.toString() || '',
      maxDevices: (plan.maxDevices ?? 1).toString(),
      fupPolicyId: (plan as Record<string, unknown>).fupPolicyId?.toString() || '',
      price: plan.price.toString(),
      currency: plan.currency,
      priority: plan.priority.toString(),
      validityDays: plan.validityDays.toString(),
      status: plan.status,
      unlimitedData: !plan.dataLimit,
      unlimitedSession: !plan.sessionLimit,
    });
    setIsEditOpen(true);
  };

  const openDeleteDialog = (plan: WiFiPlan) => {
    setSelectedPlan(plan);
    setIsDeleteOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      downloadSpeed: '10',
      uploadSpeed: '5',
      dataLimit: '',
      sessionLimit: '',
      maxDevices: '1',
      fupPolicyId: '',
      price: '0',
      currency: 'USD',
      priority: '0',
      validityDays: '1',
      status: 'active',
      unlimitedData: true,
      unlimitedSession: true,
    });
  };

  const getStatusBadge = (status: string) => {
    const option = planStatuses.find(o => o.value === status);
    return (
      <Badge variant="secondary" className={cn('text-white', option?.color)}>
        {option?.label || status}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Settings className="h-5 w-5" />
            WiFi Plans
          </h2>
          <p className="text-sm text-muted-foreground">
            Configure WiFi service plans and pricing
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchPlans}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => { resetForm(); setIsCreateOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Plan
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <Settings className="h-4 w-4 text-violet-500 dark:text-violet-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{summary.totalPlans}</div>
              <div className="text-xs text-muted-foreground">Total Plans</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <Star className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{summary.activePlans}</div>
              <div className="text-xs text-muted-foreground">Active Plans</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <ArrowDownToLine className="h-4 w-4 text-amber-500 dark:text-amber-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{summary.avgDownloadSpeed} Mbps</div>
              <div className="text-xs text-muted-foreground">Avg Download</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <DollarSign className="h-4 w-4 text-cyan-500 dark:text-cyan-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{formatCurrency(summary.avgPrice)}</div>
              <div className="text-xs text-muted-foreground">Avg Price</div>
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
                  placeholder="Search by plan name..."
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
                {planStatuses.map(status => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Plans Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : plans.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="rounded-full bg-muted/50 p-4 mb-3">
            <Settings className="h-8 w-8 text-muted-foreground/40" />
          </div>
          <h3 className="text-sm font-medium text-muted-foreground">No WiFi plans found</h3>
          <p className="text-xs text-muted-foreground/60 mt-1">Create your first plan to get started</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <Card key={plan.id} className={cn(
              'relative overflow-hidden',
              plan.status === 'inactive' && 'opacity-60'
            )}>
              {plan.priority > 0 && (
                <div className="absolute top-2 right-2">
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-700">
                    <Star className="h-3 w-3 mr-1" />
                    Featured
                  </Badge>
                </div>
              )}
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {plan.name}
                    {defaultPlanId === plan.id && (
                      <Badge variant="outline" className="bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-700 text-[10px] px-1.5 py-0">
                        <Star className="h-3 w-3 mr-1 fill-teal-500" />
                        Default
                      </Badge>
                    )}
                  </CardTitle>
                  {getStatusBadge(plan.status)}
                </div>
                {plan.description && (
                  <p className="text-sm text-muted-foreground">{plan.description}</p>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Speed */}
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <ArrowDownToLine className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
                    <span className="font-medium">{plan.downloadSpeed} Mbps</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <ArrowUpFromLine className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                    <span className="font-medium">{plan.uploadSpeed} Mbps</span>
                  </div>
                </div>

                {/* Limits */}
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  {plan.dataLimit ? (
                    <div className="flex items-center gap-1">
                      <Database className="h-4 w-4" />
                      <span>{formatDataSize(plan.dataLimit)}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <Database className="h-4 w-4" />
                      <span>Unlimited</span>
                    </div>
                  )}
                  {plan.sessionLimit && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <span>{formatDuration(plan.sessionLimit)}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <Smartphone className="h-4 w-4" />
                    <span>{plan.maxDevices ?? 1} device{((plan.maxDevices ?? 1) > 1) ? 's' : ''}</span>
                  </div>
                  {(plan as Record<string, unknown>).fupPolicy && (
                    <div className="flex items-center gap-1">
                      <Gauge className="h-4 w-4 text-orange-500" />
                      <span className="text-xs">{(plan as Record<string, unknown>).fupPolicy?.name || 'FUP'}</span>
                    </div>
                  )}
                </div>

                {/* Validity & Price */}
                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="text-sm text-muted-foreground">
                    {plan.validityDays} day{plan.validityDays > 1 ? 's' : ''} validity
                  </div>
                  <div className="text-xl font-bold">
                    {plan.price > 0 ? formatCurrency(plan.price) : 'Free'}
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                  <span>{plan._count?.vouchers || 0} vouchers</span>
                  <span>{plan._count?.sessions || 0} sessions</span>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => openEditDialog(plan)}
                  >
                    <Pencil className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 dark:text-red-400 hover:text-red-700"
                    onClick={() => openDeleteDialog(plan)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isCreateOpen || isEditOpen} onOpenChange={(open) => {
        if (!open) {
          setIsCreateOpen(false);
          setIsEditOpen(false);
          setSelectedPlan(null);
        }
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditOpen ? 'Edit WiFi Plan' : 'Create WiFi Plan'}</DialogTitle>
            <DialogDescription>
              {isEditOpen ? 'Update the WiFi plan details' : 'Configure a new WiFi service plan'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Plan Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Premium WiFi"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Plan description..."
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="downloadSpeed">Download Speed (Mbps) *</Label>
                <Input
                  id="downloadSpeed"
                  type="number"
                  min="1"
                  value={formData.downloadSpeed}
                  onChange={(e) => setFormData(prev => ({ ...prev, downloadSpeed: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="uploadSpeed">Upload Speed (Mbps) *</Label>
                <Input
                  id="uploadSpeed"
                  type="number"
                  min="1"
                  value={formData.uploadSpeed}
                  onChange={(e) => setFormData(prev => ({ ...prev, uploadSpeed: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="dataLimit">Data Limit (MB)</Label>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.unlimitedData}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, unlimitedData: checked }))}
                    />
                    <span className="text-xs text-muted-foreground">Unlimited</span>
                  </div>
                </div>
                <Input
                  id="dataLimit"
                  type="number"
                  min="0"
                  placeholder="e.g., 1024"
                  value={formData.dataLimit}
                  onChange={(e) => setFormData(prev => ({ ...prev, dataLimit: e.target.value }))}
                  disabled={formData.unlimitedData}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="sessionLimit">Session Limit (min)</Label>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.unlimitedSession}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, unlimitedSession: checked }))}
                    />
                    <span className="text-xs text-muted-foreground">Unlimited</span>
                  </div>
                </div>
                <Input
                  id="sessionLimit"
                  type="number"
                  min="0"
                  placeholder="e.g., 60"
                  value={formData.sessionLimit}
                  onChange={(e) => setFormData(prev => ({ ...prev, sessionLimit: e.target.value }))}
                  disabled={formData.unlimitedSession}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxDevices">Max Devices</Label>
              <Input
                id="maxDevices"
                type="number"
                min="1"
                max="10"
                value={formData.maxDevices}
                onChange={(e) => setFormData(prev => ({ ...prev, maxDevices: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Maximum simultaneous devices per guest (1 = phone only, 2 = phone + laptop)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fupPolicyId">FUP Policy</Label>
              <Select value={formData.fupPolicyId} onValueChange={(v) => setFormData(prev => ({ ...prev, fupPolicyId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="None (no data cap)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (no data cap)</SelectItem>
                  {fupPolicies.map(fp => (
                    <SelectItem key={fp.id} value={fp.id}>{fp.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Apply Fair Usage Policy to throttle/block after data limit
              </p>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">Price</Label>
                <Input
                  id="price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Select
                  value={formData.currency}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, currency: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {currencies.map(currency => (
                      <SelectItem key={currency.value} value={currency.value}>
                        {currency.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="validityDays">Validity (Days)</Label>
                <Input
                  id="validityDays"
                  type="number"
                  min="1"
                  value={formData.validityDays}
                  onChange={(e) => setFormData(prev => ({ ...prev, validityDays: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Input
                  id="priority"
                  type="number"
                  min="0"
                  value={formData.priority}
                  onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">Higher priority shows first</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {planStatuses.map(status => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsCreateOpen(false);
              setIsEditOpen(false);
              setSelectedPlan(null);
            }}>
              Cancel
            </Button>
            <Button onClick={isEditOpen ? handleUpdate : handleCreate} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEditOpen ? 'Update Plan' : 'Create Plan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete WiFi Plan</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{selectedPlan?.name}&quot;?
              {selectedPlan?._count && (selectedPlan._count.vouchers > 0 || selectedPlan._count.sessions > 0) && (
                <p className="mt-2 text-amber-600 dark:text-amber-400">
                  This plan has associated vouchers or sessions. It will be deactivated instead of deleted.
                </p>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
