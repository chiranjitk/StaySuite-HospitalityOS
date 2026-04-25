'use client';

import React, { useState, useEffect } from 'react';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useTimezone } from '@/contexts/TimezoneContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
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
import { Separator } from '@/components/ui/separator';
import {
  CreditCard,
  Search,
  Loader2,
  DollarSign,
  RefreshCw,
  CheckCircle,
  Clock,
  XCircle,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Building2,
  Users,
  Home,
  Eye,
  Settings,
  Pause,
  Play,
  Crown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { differenceInDays } from 'date-fns'; // Keep for date calculations

interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  email: string;
  phone?: string;
  properties: number;
  users: number;
  rooms: number;
  subscriptionStart: string;
  subscriptionEnd?: string;
  trialEndsAt?: string;
  monthlyRevenue: number;
  usage: {
    storage: number;
    apiCalls: number;
    messages: number;
  };
  limits: {
    properties: number;
    users: number;
    rooms: number;
    storage: number;
  };
}

interface SubscriptionStats {
  total: number;
  active: number;
  trial: number;
  suspended: number;
  totalRevenue: number;
}

const statusOptions = [
  { value: 'all', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'trial', label: 'Trial' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'cancelled', label: 'Cancelled' },
];

const billingCycles = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly (2 months free)' },
];

export default function Subscriptions() {
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const { formatDate, formatTime, formatDateTime, settings } = useTimezone();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [planOptions, setPlanOptions] = useState<Array<{ value: string; label: string; price: number }>>([]);
  const [stats, setStats] = useState<SubscriptionStats>({
    total: 0,
    active: 0,
    trial: 0,
    suspended: 0,
    totalRevenue: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [planFilter, setPlanFilter] = useState<string>('all');

  // Dialog states
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isUpgradeOpen, setIsUpgradeOpen] = useState(false);
  const [isSelectedOpen, setIsSelectedOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state for upgrade/downgrade
  const [upgradeData, setUpgradeData] = useState({
    newPlan: '',
    billingCycle: 'monthly',
    reason: '',
    effectiveDate: '',
  });

// Fetch plan options from server-side API instead of hardcoding prices
  const fetchPlanOptions = async () => {
    try {
      const response = await fetch('/api/admin/plans');
      const result = await response.json();
      if (result.success) {
        setPlanOptions(
          result.data.map((p: { name: string; displayName: string; price: number }) => ({
            value: p.name,
            label: p.displayName,
            price: p.price,
          }))
        );
      }
    } catch (err) {
      console.error('Error fetching plan options:', err);
      // Fallback to empty array — will show no plan options
      setPlanOptions([]);
    }
  };

  const fetchTenants = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (planFilter !== 'all') params.append('plan', planFilter);

      const response = await fetch(`/api/admin/tenants?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setTenants(result.data.tenants);
        setStats(result.data.stats);
      }
    } catch (error) {
      console.error('Error fetching tenants:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch subscriptions',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPlanOptions();
    fetchTenants();
  }, [statusFilter, planFilter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length >= 2 || searchQuery.length === 0) {
        fetchTenants();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Update tenant status
  const updateStatus = async (tenant: Tenant, newStatus: string) => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/tenants', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: tenant.id,
          status: newStatus,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: `Subscription ${newStatus === 'active' ? 'activated' : newStatus === 'suspended' ? 'suspended' : 'updated'}`,
        });
        fetchTenants();
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to update subscription',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error updating tenant:', error);
      toast({
        title: 'Error',
        description: 'Failed to update subscription',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Update tenant plan
  const updatePlan = async () => {
    if (!selectedTenant || !upgradeData.newPlan) {
      toast({
        title: 'Validation Error',
        description: 'Please select a plan',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/tenants', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedTenant.id,
          plan: upgradeData.newPlan,
        }),
      });

      const result = await response.json();

      if (result.success) {
        const isUpgrade = planOptions.findIndex(p => p.value === upgradeData.newPlan) >
          planOptions.findIndex(p => p.value === selectedTenant.plan);
        toast({
          title: 'Success',
          description: `Subscription ${isUpgrade ? 'upgraded' : 'downgraded'} to ${upgradeData.newPlan}`,
        });
        setIsUpgradeOpen(false);
        setUpgradeData({ newPlan: '', billingCycle: 'monthly', reason: '', effectiveDate: '' });
        fetchTenants();
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to update plan',
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

  const getStatusBadge = (status: string, trialEndsAt?: string) => {
    const isTrialExpired = trialEndsAt && new Date(trialEndsAt) < new Date();
    
    if (status === 'trial' && isTrialExpired) {
      return (
        <Badge variant="secondary" className="bg-red-500 text-white gap-1">
          <AlertTriangle className="h-3 w-3" />
          Trial Expired
        </Badge>
      );
    }

    const statusMap: Record<string, { label: string; color: string; icon: React.ElementType }> = {
      active: { label: 'Active', color: 'bg-emerald-500', icon: CheckCircle },
      trial: { label: 'Trial', color: 'bg-cyan-500', icon: Clock },
      suspended: { label: 'Suspended', color: 'bg-amber-500', icon: Pause },
      cancelled: { label: 'Cancelled', color: 'bg-red-500', icon: XCircle },
    };
    const option = statusMap[status] || { label: status, color: 'bg-gray-500', icon: Clock };
    const Icon = option.icon;
    return (
      <Badge variant="secondary" className={cn('text-white gap-1', option.color)}>
        <Icon className="h-3 w-3" />
        {option.label}
      </Badge>
    );
  };

  const getPlanBadge = (plan: string) => {
    const planMap: Record<string, { label: string; color: string }> = {
      trial: { label: 'Trial', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200' },
      starter: { label: 'Starter', color: 'bg-emerald-100 text-emerald-800 dark:text-emerald-200' },
      professional: { label: 'Professional', color: 'bg-violet-100 text-violet-800 dark:text-violet-200' },
      enterprise: { label: 'Enterprise', color: 'bg-amber-100 text-amber-800 dark:text-amber-200' },
    };
    const option = planMap[plan] || { label: plan, color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200' };
    return (
      <Badge variant="outline" className={option.color}>
        {option.label}
      </Badge>
    );
  };

  const getUsagePercent = (used: number, limit: number) => {
    return Math.min((used / limit) * 100, 100);
  };

  const viewTenantDetails = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setIsDetailOpen(true);
  };

  const openUpgradeDialog = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setUpgradeData({
      newPlan: tenant.plan,
      billingCycle: 'monthly',
      reason: '',
      effectiveDate: new Date().toISOString().split('T')[0],
    });
    setIsUpgradeOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Subscriptions
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage tenant subscriptions and billing cycles
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchTenants}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-5">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <Building2 className="h-4 w-4 text-violet-500 dark:text-violet-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <CheckCircle className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.active}</div>
              <div className="text-xs text-muted-foreground">Active</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <Clock className="h-4 w-4 text-cyan-500 dark:text-cyan-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.trial}</div>
              <div className="text-xs text-muted-foreground">Trial</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Pause className="h-4 w-4 text-amber-500 dark:text-amber-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.suspended}</div>
              <div className="text-xs text-muted-foreground">Suspended</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <DollarSign className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</div>
              <div className="text-xs text-muted-foreground">MRR</div>
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
                  placeholder="Search by name, email, or slug..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={planFilter} onValueChange={setPlanFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Plans</SelectItem>
                {planOptions.map(plan => (
                  <SelectItem key={plan.value} value={plan.value}>
                    {plan.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map(status => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Subscriptions Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : tenants.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <CreditCard className="h-12 w-12 mb-4" />
              <p>No subscriptions found</p>
              <p className="text-sm">No tenants match the current filters</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Billing Cycle</TableHead>
                    <TableHead>Usage</TableHead>
                    <TableHead>Revenue</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenants.map((tenant) => {
                    const trialDaysLeft = tenant.trialEndsAt
                      ? differenceInDays(new Date(tenant.trialEndsAt), new Date())
                      : null;

                    return (
                      <TableRow key={tenant.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{tenant.name}</p>
                            <p className="text-xs text-muted-foreground">{tenant.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {getPlanBadge(tenant.plan)}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p>{formatDate(tenant.subscriptionStart)}</p>
                            {tenant.subscriptionEnd && (
                              <p className="text-xs text-muted-foreground">
                                to {formatDate(tenant.subscriptionEnd)}
                              </p>
                            )}
                            {tenant.trialEndsAt && trialDaysLeft !== null && trialDaysLeft > 0 && (
                              <p className="text-xs text-cyan-600 dark:text-cyan-400">
                                {trialDaysLeft} trial days left
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-xs">
                              <Home className="h-3 w-3 text-muted-foreground" />
                              <span>{tenant.properties}/{tenant.limits.properties}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              <Users className="h-3 w-3 text-muted-foreground" />
                              <span>{tenant.users}/{tenant.limits.users}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="font-medium">{formatCurrency(tenant.monthlyRevenue)}/mo</p>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(tenant.status, tenant.trialEndsAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => viewTenantDetails(tenant)}
                              title="View Details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openUpgradeDialog(tenant)}
                              title="Change Plan"
                            >
                              <Settings className="h-4 w-4" />
                            </Button>
                            {tenant.status === 'active' ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-amber-600 dark:text-amber-400"
                                onClick={() => updateStatus(tenant, 'suspended')}
                                title="Suspend"
                                disabled={isSaving}
                              >
                                <Pause className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-emerald-600 dark:text-emerald-400"
                                onClick={() => updateStatus(tenant, 'active')}
                                title="Activate"
                                disabled={isSaving}
                              >
                                <Play className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
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

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Subscription Details
            </DialogTitle>
          </DialogHeader>
          {selectedTenant && (
            <div className="space-y-4">
              <Card className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-lg">{selectedTenant.name}</p>
                    <p className="text-sm text-muted-foreground">{selectedTenant.email}</p>
                    <p className="text-xs text-muted-foreground">Slug: {selectedTenant.slug}</p>
                  </div>
                  {getStatusBadge(selectedTenant.status, selectedTenant.trialEndsAt)}
                </div>
              </Card>

              <Card className="p-4">
                <h4 className="text-sm font-medium text-muted-foreground mb-3">Subscription</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span>Current Plan</span>
                    {getPlanBadge(selectedTenant.plan)}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Monthly Revenue</span>
                    <span className="font-medium">{formatCurrency(selectedTenant.monthlyRevenue)}/mo</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Started</span>
                    <span>{formatDate(selectedTenant.subscriptionStart)}</span>
                  </div>
                  {selectedTenant.subscriptionEnd && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Ends</span>
                      <span>{formatDate(selectedTenant.subscriptionEnd)}</span>
                    </div>
                  )}
                  {selectedTenant.trialEndsAt && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Trial Ends</span>
                      <span>{formatDate(selectedTenant.trialEndsAt)}</span>
                    </div>
                  )}
                </div>
              </Card>

              <Card className="p-4">
                <h4 className="text-sm font-medium text-muted-foreground mb-3">Usage & Limits</h4>
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="flex items-center gap-2">
                        <Home className="h-4 w-4" /> Properties
                      </span>
                      <span>{selectedTenant.properties} / {selectedTenant.limits.properties}</span>
                    </div>
                    <Progress value={getUsagePercent(selectedTenant.properties, selectedTenant.limits.properties)} className="h-1.5" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="flex items-center gap-2">
                        <Users className="h-4 w-4" /> Users
                      </span>
                      <span>{selectedTenant.users} / {selectedTenant.limits.users}</span>
                    </div>
                    <Progress value={getUsagePercent(selectedTenant.users, selectedTenant.limits.users)} className="h-1.5" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span>Rooms</span>
                      <span>{selectedTenant.rooms} / {selectedTenant.limits.rooms}</span>
                    </div>
                    <Progress value={getUsagePercent(selectedTenant.rooms, selectedTenant.limits.rooms)} className="h-1.5" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span>Storage</span>
                      <span>{selectedTenant.usage.storage} MB / {selectedTenant.limits.storage} MB</span>
                    </div>
                    <Progress value={getUsagePercent(selectedTenant.usage.storage, selectedTenant.limits.storage)} className="h-1.5" />
                  </div>
                </div>
              </Card>

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => {
                    setIsDetailOpen(false);
                    openUpgradeDialog(selectedTenant);
                  }}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Change Plan
                </Button>
                {selectedTenant.status === 'active' ? (
                  <Button 
                    variant="outline" 
                    className="flex-1 text-amber-600 dark:text-amber-400"
                    onClick={() => {
                      setIsDetailOpen(false);
                      updateStatus(selectedTenant, 'suspended');
                    }}
                  >
                    <Pause className="h-4 w-4 mr-2" />
                    Suspend
                  </Button>
                ) : (
                  <Button 
                    variant="outline" 
                    className="flex-1 text-emerald-600 dark:text-emerald-400"
                    onClick={() => {
                      setIsDetailOpen(false);
                      updateStatus(selectedTenant, 'active');
                    }}
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Activate
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Upgrade/Downgrade Dialog */}
      <Dialog open={isUpgradeOpen} onOpenChange={setIsUpgradeOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5" />
              Change Subscription Plan
            </DialogTitle>
            <DialogDescription>
              {selectedTenant?.name} - Current: {selectedTenant?.plan}
            </DialogDescription>
          </DialogHeader>
          {selectedTenant && (
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>New Plan</Label>
                <Select
                  value={upgradeData.newPlan}
                  onValueChange={(value) => setUpgradeData(prev => ({ ...prev, newPlan: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {planOptions.map(plan => {
                      const isCurrentPlan = plan.value === selectedTenant.plan;
                      const priceChange = plan.price - (planOptions.find(p => p.value === selectedTenant.plan)?.price || 0);
                      return (
                        <SelectItem key={plan.value} value={plan.value} disabled={isCurrentPlan}>
                          <div className="flex items-center justify-between w-full gap-4">
                            <span>{plan.label}</span>
                            <span className="text-muted-foreground">
                              {formatCurrency(plan.price)}/mo
                              {!isCurrentPlan && priceChange !== 0 && (
                                <span className={priceChange > 0 ? 'text-red-500 dark:text-red-400 ml-2' : 'text-emerald-500 dark:text-emerald-400 ml-2'}>
                                  ({priceChange > 0 ? '+' : ''}{priceChange})
                                </span>
                              )}
                            </span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Billing Cycle</Label>
                <Select
                  value={upgradeData.billingCycle}
                  onValueChange={(value) => setUpgradeData(prev => ({ ...prev, billingCycle: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {billingCycles.map(cycle => (
                      <SelectItem key={cycle.value} value={cycle.value}>
                        {cycle.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Effective Date</Label>
                <Input
                  type="date"
                  value={upgradeData.effectiveDate}
                  onChange={(e) => setUpgradeData(prev => ({ ...prev, effectiveDate: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Reason (Optional)</Label>
                <Textarea
                  placeholder="Reason for change..."
                  value={upgradeData.reason}
                  onChange={(e) => setUpgradeData(prev => ({ ...prev, reason: e.target.value }))}
                  rows={2}
                />
              </div>

              {upgradeData.newPlan && upgradeData.newPlan !== selectedTenant.plan && (
                <Card className="p-4 bg-muted/50">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Current Plan</span>
                      <span className="capitalize">{selectedTenant.plan}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">New Plan</span>
                      <span className="font-medium capitalize">{upgradeData.newPlan}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-medium">
                      <span>Price Change</span>
                      <span className={
                        (planOptions.find(p => p.value === upgradeData.newPlan)?.price || 0) >
                        (planOptions.find(p => p.value === selectedTenant.plan)?.price || 0)
                          ? 'text-red-500 dark:text-red-400'
                          : 'text-emerald-500 dark:text-emerald-400'
                      }>
                        {formatCurrency(planOptions.find(p => p.value === upgradeData.newPlan)?.price || 0)}
                          -
                          {formatCurrency(planOptions.find(p => p.value === selectedTenant.plan)?.price || 0)}/mo
                      </span>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUpgradeOpen(false)}>
              Cancel
            </Button>
            <Button onClick={updatePlan} disabled={isSaving || !upgradeData.newPlan}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm Change
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
