'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Loader2, Building2, MoreHorizontal, Clock, CheckCircle, XCircle, PauseCircle, 
  Archive, TrendingUp, TrendingDown, Calendar, CreditCard, AlertTriangle,
  ArrowUpRight, ArrowDownRight, Play, Ban, RefreshCw
} from 'lucide-react';
import { SectionGuard } from '@/components/common/section-guard';
import { toast } from 'sonner';
import { useCurrency } from '@/contexts/CurrencyContext';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: 'trial' | 'starter' | 'professional' | 'enterprise';
  status: 'trial' | 'active' | 'suspended' | 'cancelled' | 'archived';
  email: string;
  phone?: string;
  properties: number;
  users: number;
  rooms: number;
  subscriptionStart?: string;
  subscriptionEnd?: string;
  trialEndsAt?: string;
  limits: {
    properties: number;
    users: number;
    rooms: number;
    storage: number;
  };
}

interface TenantWithDays extends Tenant {
  daysRemaining?: number;
  usagePercentage?: number;
}

const statusConfig: Record<string, { color: string; bgColor: string; icon: React.ElementType; label: string }> = {
  trial: { color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-500', icon: Clock, label: 'Trial' },
  active: { color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-500', icon: CheckCircle, label: 'Active' },
  suspended: { color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-500', icon: PauseCircle, label: 'Suspended' },
  cancelled: { color: 'text-gray-600 dark:text-gray-400', bgColor: 'bg-gray-500', icon: XCircle, label: 'Cancelled' },
  archived: { color: 'text-slate-600 dark:text-slate-400', bgColor: 'bg-slate-500', icon: Archive, label: 'Archived' },
};

const planConfig: Record<string, { color: string; price: number; label: string }> = {
  trial: { color: 'bg-gray-500', price: 0, label: 'Trial' },
  starter: { color: 'bg-emerald-500', price: 99, label: 'Starter' },
  professional: { color: 'bg-cyan-500', price: 499, label: 'Professional' },
  enterprise: { color: 'bg-violet-500', price: 1999, label: 'Enterprise' },
};

const statusTransitions: Record<string, { next: string[]; labels: Record<string, string> }> = {
  trial: {
    next: ['active', 'cancelled'],
    labels: { active: 'Activate', cancelled: 'Cancel Trial' }
  },
  active: {
    next: ['suspended', 'cancelled'],
    labels: { suspended: 'Suspend', cancelled: 'Cancel Subscription' }
  },
  suspended: {
    next: ['active', 'cancelled'],
    labels: { active: 'Reactivate', cancelled: 'Cancel' }
  },
  cancelled: {
    next: ['active'],
    labels: { active: 'Reactivate' }
  },
  archived: {
    next: ['active'],
    labels: { active: 'Restore' }
  },
};

export function TenantLifecycle() {
  const { formatCurrency } = useCurrency();
  const [tenants, setTenants] = useState<TenantWithDays[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTenant, setSelectedTenant] = useState<TenantWithDays | null>(null);
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [newStatus, setNewStatus] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPlan, setFilterPlan] = useState('all');

  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    try {
      const response = await fetch('/api/admin/tenants');
      const data = await response.json();
      
      if (data.success) {
        const processedTenants = data.data.tenants.map((tenant: Tenant) => {
          // Calculate days remaining for trial
          let daysRemaining: number | undefined;
          if (tenant.status === 'trial' && tenant.trialEndsAt) {
            const trialEnd = new Date(tenant.trialEndsAt);
            const now = new Date();
            daysRemaining = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
          }
          
          // Calculate usage percentage
          const usagePercentage = tenant.limits.rooms > 0 
            ? Math.round((tenant.rooms / tenant.limits.rooms) * 100) 
            : 0;
          
          return { ...tenant, daysRemaining, usagePercentage };
        });
        
        setTenants(processedTenants);
      }
    } catch (error) {
      console.error('Error fetching tenants:', error);
      toast.error('Failed to fetch tenants');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async () => {
    if (!selectedTenant || !newStatus) return;
    
    setSaving(true);
    try {
      const response = await fetch('/api/admin/tenants', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedTenant.id, status: newStatus }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(`Tenant status changed to ${newStatus}`);
        setStatusDialogOpen(false);
        fetchTenants();
      } else {
        throw new Error(data.error || 'Failed to update status');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update tenant status');
    } finally {
      setSaving(false);
    }
  };

  const handlePlanChange = async () => {
    if (!selectedTenant || !selectedPlan) return;
    
    setSaving(true);
    try {
      const response = await fetch('/api/admin/tenants', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedTenant.id, plan: selectedPlan }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(`Plan changed to ${planConfig[selectedPlan]?.label || selectedPlan}`);
        setPlanDialogOpen(false);
        fetchTenants();
      } else {
        throw new Error(data.error || 'Failed to update plan');
      }
    } catch (error) {
      console.error('Error updating plan:', error);
      toast.error('Failed to update tenant plan');
    } finally {
      setSaving(false);
    }
  };

  const openPlanDialog = (tenant: TenantWithDays, direction: 'upgrade' | 'downgrade') => {
    setSelectedTenant(tenant);
    // Pre-select appropriate plan based on direction
    const plans = ['trial', 'starter', 'professional', 'enterprise'];
    const currentIndex = plans.indexOf(tenant.plan);
    if (direction === 'upgrade' && currentIndex < plans.length - 1) {
      setSelectedPlan(plans[currentIndex + 1]);
    } else if (direction === 'downgrade' && currentIndex > 0) {
      setSelectedPlan(plans[currentIndex - 1]);
    } else {
      setSelectedPlan(tenant.plan);
    }
    setPlanDialogOpen(true);
  };

  const openStatusDialog = (tenant: TenantWithDays, status: string) => {
    setSelectedTenant(tenant);
    setNewStatus(status);
    setStatusDialogOpen(true);
  };

  const filteredTenants = tenants.filter(t => {
    const matchesStatus = filterStatus === 'all' || t.status === filterStatus;
    const matchesPlan = filterPlan === 'all' || t.plan === filterPlan;
    return matchesStatus && matchesPlan;
  });

  // Stats
  const stats = {
    total: tenants.length,
    trial: tenants.filter(t => t.status === 'trial').length,
    active: tenants.filter(t => t.status === 'active').length,
    suspended: tenants.filter(t => t.status === 'suspended').length,
    trialsExpiringSoon: tenants.filter(t => t.status === 'trial' && (t.daysRemaining ?? 0) <= 7).length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <SectionGuard permission="admin.tenants">
      <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Tenant Lifecycle Management</h2>
          <p className="text-muted-foreground">Manage tenant status, subscriptions, and plan changes</p>
        </div>
        <Button variant="outline" onClick={fetchTenants}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardDescription>Total Tenants</CardDescription>
            <CardTitle className="text-2xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="pb-2">
            <CardDescription>Active</CardDescription>
            <CardTitle className="text-2xl">{stats.active}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <CardDescription>On Trial</CardDescription>
            <CardTitle className="text-2xl">{stats.trial}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="pb-2">
            <CardDescription>Suspended</CardDescription>
            <CardTitle className="text-2xl">{stats.suspended}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="pb-2">
            <CardDescription>Trials Expiring Soon</CardDescription>
            <CardTitle className="text-2xl">{stats.trialsExpiringSoon}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="trial">Trial</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterPlan} onValueChange={setFilterPlan}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Filter by plan" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Plans</SelectItem>
            <SelectItem value="trial">Trial</SelectItem>
            <SelectItem value="starter">Starter</SelectItem>
            <SelectItem value="professional">Professional</SelectItem>
            <SelectItem value="enterprise">Enterprise</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tenants Table */}
      <Card>
        <CardHeader>
          <CardTitle>Tenant Subscriptions</CardTitle>
          <CardDescription>Manage tenant status transitions and plan changes</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Trial/Subscription</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTenants.map((tenant) => {
                  const config = statusConfig[tenant.status] || statusConfig.active;
                  const plan = planConfig[tenant.plan] || planConfig.trial;
                  const transitions = statusTransitions[tenant.status] || { next: [], labels: {} };
                  const currentIndex = ['trial', 'starter', 'professional', 'enterprise'].indexOf(tenant.plan);
                  
                  return (
                    <TableRow key={tenant.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-teal-500/20 to-emerald-500/20 flex items-center justify-center">
                            <Building2 className="h-5 w-5 text-teal-500 dark:text-teal-400" />
                          </div>
                          <div>
                            <p className="font-medium">{tenant.name}</p>
                            <p className="text-xs text-muted-foreground">{tenant.slug}.staysuite.com</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${plan.color} text-white`}>{plan.label}</Badge>
                        <p className="text-xs text-muted-foreground mt-1">{formatCurrency(plan.price)}/mo</p>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge className={`${config.bgColor} text-white`}>
                            <config.icon className="h-3 w-3 mr-1" />
                            {config.label}
                          </Badge>
                          {tenant.status === 'trial' && tenant.daysRemaining !== undefined && (
                            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                              {tenant.daysRemaining} days left
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span>{tenant.rooms}/{tenant.limits.rooms} rooms</span>
                            <span>{tenant.usagePercentage}%</span>
                          </div>
                          <Progress value={tenant.usagePercentage} className="h-1" />
                        </div>
                      </TableCell>
                      <TableCell>
                        {tenant.status === 'trial' && tenant.trialEndsAt ? (
                          <div className="flex items-center gap-1 text-sm">
                            <Clock className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                            <span>Ends {new Date(tenant.trialEndsAt).toLocaleDateString()}</span>
                          </div>
                        ) : tenant.subscriptionEnd ? (
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span>Renews {new Date(tenant.subscriptionEnd).toLocaleDateString()}</span>
                          </div>
                        ) : tenant.subscriptionStart ? (
                          <div className="flex items-center gap-1 text-sm">
                            <CreditCard className="h-4 w-4 text-muted-foreground" />
                            <span>Started {new Date(tenant.subscriptionStart).toLocaleDateString()}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Plan Change Buttons */}
                          {currentIndex > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openPlanDialog(tenant, 'downgrade')}
                              title="Downgrade Plan"
                            >
                              <TrendingDown className="h-4 w-4 text-red-500 dark:text-red-400" />
                            </Button>
                          )}
                          {currentIndex < 3 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openPlanDialog(tenant, 'upgrade')}
                              title="Upgrade Plan"
                            >
                              <TrendingUp className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
                            </Button>
                          )}
                          
                          {/* Status Actions */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {transitions.next.map((status) => {
                                const statusConf = statusConfig[status];
                                return (
                                  <DropdownMenuItem
                                    key={status}
                                    onClick={() => openStatusDialog(tenant, status)}
                                  >
                                    {status === 'active' && <Play className="h-4 w-4 mr-2 text-emerald-500 dark:text-emerald-400" />}
                                    {status === 'suspended' && <Ban className="h-4 w-4 mr-2 text-red-500 dark:text-red-400" />}
                                    {status === 'cancelled' && <XCircle className="h-4 w-4 mr-2 text-gray-500 dark:text-gray-400" />}
                                    {status === 'archived' && <Archive className="h-4 w-4 mr-2 text-slate-500 dark:text-slate-400" />}
                                    {transitions.labels[status]}
                                  </DropdownMenuItem>
                                );
                              })}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                
                {filteredTenants.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No tenants found matching your criteria.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Plan Change Dialog */}
      <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedPlan && selectedTenant && planConfig[selectedPlan] && 
                (planConfig[selectedPlan].price > planConfig[selectedTenant.plan].price ? (
                  <ArrowUpRight className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
                ) : (
                  <ArrowDownRight className="h-5 w-5 text-red-500 dark:text-red-400" />
                ))
              }
              Change Plan
            </DialogTitle>
            <DialogDescription>
              Change subscription plan for {selectedTenant?.name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select New Plan</label>
              <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(planConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center justify-between w-full">
                        <span>{config.label}</span>
                        <span className="ml-2 text-muted-foreground">{formatCurrency(config.price)}/mo</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {selectedTenant && selectedPlan && selectedPlan !== selectedTenant.plan && (
              <div className={`p-4 rounded-lg ${
                planConfig[selectedPlan]?.price > planConfig[selectedTenant.plan]?.price 
                  ? 'bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800' 
                  : 'bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className={`h-4 w-4 ${
                    planConfig[selectedPlan]?.price > planConfig[selectedTenant.plan]?.price 
                      ? 'text-emerald-600 dark:text-emerald-400' 
                      : 'text-amber-600 dark:text-amber-400'
                  }`} />
                  <span className="font-medium">Plan Change Summary</span>
                </div>
                <div className="text-sm space-y-1">
                  <p>From: <strong>{planConfig[selectedTenant.plan]?.label}</strong> ({formatCurrency(planConfig[selectedTenant.plan]?.price || 0)}/mo)</p>
                  <p>To: <strong>{planConfig[selectedPlan]?.label}</strong> ({formatCurrency(planConfig[selectedPlan]?.price || 0)}/mo)</p>
                  <p className="mt-2">
                    Price difference: <strong>
                      {formatCurrency(Math.abs((planConfig[selectedPlan]?.price || 0) - (planConfig[selectedTenant.plan]?.price || 0)))}/mo
                      {planConfig[selectedPlan]?.price > planConfig[selectedTenant.plan]?.price ? ' increase' : ' decrease'}
                    </strong>
                  </p>
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handlePlanChange} disabled={saving || selectedPlan === selectedTenant?.plan}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm Plan Change
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Change Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Status Change</DialogTitle>
            <DialogDescription>
              You are about to change the status of <strong>{selectedTenant?.name}</strong>
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex items-center gap-2">
                {selectedTenant && (() => {
                  const currentConfig = statusConfig[selectedTenant.status];
                  return (
                    <>
                      <currentConfig.icon className={`h-5 w-5 ${currentConfig.color}`} />
                      <Badge className={`${currentConfig.bgColor} text-white`}>{currentConfig.label}</Badge>
                    </>
                  );
                })()}
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
              <div className="flex items-center gap-2">
                {newStatus && (() => {
                  const newConfig = statusConfig[newStatus];
                  return (
                    <>
                      <newConfig.icon className={`h-5 w-5 ${newConfig.color}`} />
                      <Badge className={`${newConfig.bgColor} text-white`}>{newConfig.label}</Badge>
                    </>
                  );
                })()}
              </div>
            </div>
            
            {newStatus === 'suspended' && (
              <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-800 dark:text-red-200">
                  <strong>Warning:</strong> Suspending this tenant will immediately block all access to the platform.
                  Users will not be able to log in, and all operations will be halted.
                </p>
              </div>
            )}
            
            {newStatus === 'active' && selectedTenant?.status === 'suspended' && (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                <p className="text-sm text-emerald-800 dark:text-emerald-200">
                  Reactivating this tenant will restore full access to the platform for all users.
                </p>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleStatusChange} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm Status Change
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </SectionGuard>
  );
}

export default TenantLifecycle;
