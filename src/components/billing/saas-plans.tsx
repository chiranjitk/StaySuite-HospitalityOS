'use client';

import React, { useState, useEffect } from 'react';
import { useCurrency } from '@/contexts/CurrencyContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Crown,
  Zap,
  Rocket,
  Building2,
  Check,
  X,
  Plus,
  Edit,
  Loader2,
  RefreshCw,
  Users,
  Home,
  DoorOpen,
  Database,
  Sparkles,
  Shield,
  BarChart3,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface PlanFeature {
  name: string;
  included: boolean;
  limit?: string;
}

interface SaaSPlan {
  id: string;
  name: string;
  displayName: string;
  description: string;
  price: number;
  currency: string;
  billingPeriod: 'monthly' | 'yearly';
  maxProperties: number;
  maxUsers: number;
  maxRooms: number;
  storageLimitMb: number;
  features: PlanFeature[];
  isPopular?: boolean;
  isCustom?: boolean;
  status: string;
  subscriberCount: number;
}

// Plans are now fetched from /api/admin/plans (server-side source of truth)
// No more hardcoded plan definitions on the client.

export default function SaaSPlans() {
  const { toast } = useToast();
  const { formatCurrency, currency } = useCurrency();
  const [plans, setPlans] = useState<SaaSPlan[]>([]);
  const [tenants, setTenants] = useState<Array<{ id: string; plan: string; name: string }>>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SaaSPlan | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'cards' | 'comparison'>('cards');
  const [subscribingPlanId, setSubscribingPlanId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    displayName: '',
    description: '',
    price: '',
    maxProperties: '',
    maxUsers: '',
    maxRooms: '',
    storageLimitMb: '',
  });

  // Fetch plans from server-side API (source of truth)
  const fetchPlans = async () => {
    setIsLoading(true);
    try {
      // Fetch plans from /api/admin/plans — server-side source of truth
      const plansResponse = await fetch('/api/admin/plans');
      const plansResult = await plansResponse.json();

      if (plansResult.success) {
        setPlans(plansResult.data);
      } else {
        throw new Error(plansResult.error || 'Failed to fetch plans');
      }

      // Also fetch tenants for the subscribe dialog (non-blocking — may fail if not admin)
      try {
        const tenantsResponse = await fetch('/api/admin/tenants');
        const tenantsResult = await tenantsResponse.json();
        if (tenantsResult.success) {
          setTenants(tenantsResult.data.tenants);
          // Default to first tenant if none selected
          if (!selectedTenantId && tenantsResult.data.tenants.length > 0) {
            setSelectedTenantId(tenantsResult.data.tenants[0].id);
          }
        }
      } catch {
        // Non-critical — tenant list only needed for subscribe dialog
      }
    } catch (error) {
      console.error('Error fetching plans:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch plan data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  // Update plan via server-side /api/admin/plans/[id]
  const handleUpdate = async () => {
    if (!selectedPlan) return;

    setIsSaving(true);
    try {
      const updatedValues = {
        displayName: formData.displayName,
        description: formData.description,
        price: parseFloat(formData.price) || selectedPlan.price,
        maxProperties: parseInt(formData.maxProperties) || selectedPlan.maxProperties,
        maxUsers: parseInt(formData.maxUsers) || selectedPlan.maxUsers,
        maxRooms: parseInt(formData.maxRooms) || selectedPlan.maxRooms,
        storageLimitMb: parseInt(formData.storageLimitMb) || selectedPlan.storageLimitMb,
      };

      // Update via the plans API (server-side validation, cascades to tenants)
      const response = await fetch(`/api/admin/plans/${selectedPlan.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedValues),
      });

      const result = await response.json();

      if (result.success) {
        // Update local state with server response
        const updatedPlans = plans.map(p => {
          if (p.id === selectedPlan.id) {
            return { ...p, ...updatedValues };
          }
          return p;
        });
        setPlans(updatedPlans);
        toast({
          title: 'Success',
          description: result.message || 'Plan updated successfully',
        });
        setIsEditOpen(false);
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

  // Subscribe a tenant to a plan using proper tenant selection
  const handleSubscribe = async (planId: string) => {
    // Require an explicit tenant selection — no more tenants[0]?.id
    if (!selectedTenantId) {
      toast({
        title: 'No Tenant Selected',
        description: 'Please select a tenant before subscribing to a plan.',
        variant: 'destructive',
      });
      return;
    }

    setSubscribingPlanId(planId);
    try {
      const plan = plans.find(p => p.id === planId);
      if (!plan) return;

      const response = await fetch('/api/admin/tenants', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedTenantId,
          plan: plan.name,
          limits: {
            properties: plan.maxProperties,
            users: plan.maxUsers,
            rooms: plan.maxRooms,
            storage: plan.storageLimitMb,
          },
        }),
      });

      const result = await response.json();
      if (result.success) {
        toast({
          title: 'Plan changed',
          description: `Tenant updated to ${plan.displayName} plan successfully.`,
        });
        // Refresh plans to get updated subscriber counts
        fetchPlans();
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to update plan',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error subscribing:', error);
      toast({
        title: 'Error',
        description: 'Failed to update plan',
        variant: 'destructive',
      });
    } finally {
      setSubscribingPlanId(null);
    }
  };

  const editPlan = (plan: SaaSPlan) => {
    setSelectedPlan(plan);
    setFormData({
      displayName: plan.displayName,
      description: plan.description,
      price: plan.price.toString(),
      maxProperties: plan.maxProperties.toString(),
      maxUsers: plan.maxUsers.toString(),
      maxRooms: plan.maxRooms.toString(),
      storageLimitMb: plan.storageLimitMb.toString(),
    });
    setIsEditOpen(true);
  };

  const getPlanIcon = (planId: string) => {
    switch (planId) {
      case 'trial':
        return <Clock className="h-6 w-6" />;
      case 'starter':
        return <Zap className="h-6 w-6" />;
      case 'professional':
        return <Rocket className="h-6 w-6" />;
      case 'enterprise':
        return <Crown className="h-6 w-6" />;
      default:
        return <Building2 className="h-6 w-6" />;
    }
  };

  const getPlanColor = (planId: string) => {
    switch (planId) {
      case 'trial':
        return 'text-gray-600';
      case 'starter':
        return 'text-emerald-600';
      case 'professional':
        return 'text-violet-600';
      case 'enterprise':
        return 'text-amber-600';
      default:
        return 'text-gray-600';
    }
  };

  // Stats
  const totalSubscribers = plans.reduce((sum, p) => sum + p.subscriberCount, 0);
  const totalRevenue = plans.reduce((sum, p) => sum + (p.price * p.subscriberCount), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Crown className="h-5 w-5" />
            SaaS Plans
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage subscription plans for multi-tenant
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchPlans}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <div className="flex gap-1 border rounded-md p-1">
            <Button
              variant={viewMode === 'cards' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('cards')}
            >
              Cards
            </Button>
            <Button
              variant={viewMode === 'comparison' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('comparison')}
            >
              Compare
            </Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <Users className="h-4 w-4 text-violet-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{totalSubscribers}</div>
              <div className="text-xs text-muted-foreground">Total Subscribers</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <BarChart3 className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
              <div className="text-xs text-muted-foreground">Monthly Revenue</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <Rocket className="h-4 w-4 text-cyan-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{plans.filter(p => p.subscriberCount > 0).length}</div>
              <div className="text-xs text-muted-foreground">Active Plans</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Crown className="h-4 w-4 text-amber-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{plans.find(p => p.name === 'professional')?.subscriberCount || 0}</div>
              <div className="text-xs text-muted-foreground">Professional Users</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Tenant Selector for subscribe actions */}
      {tenants.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label className="text-sm font-medium">Subscribe Tenant</Label>
              <p className="text-xs text-muted-foreground mb-2">Select which tenant to assign a plan to</p>
              <Select value={selectedTenantId || ''} onValueChange={setSelectedTenantId}>
                <SelectTrigger className="w-full max-w-sm">
                  <SelectValue placeholder="Select a tenant" />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map(tenant => (
                    <SelectItem key={tenant.id} value={tenant.id}>
                      {tenant.name} ({tenant.plan})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : viewMode === 'cards' ? (
        /* Cards View */
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className={cn(
                'relative flex flex-col',
                plan.isPopular && 'border-violet-500 shadow-lg shadow-violet-500/10'
              )}
            >
              {plan.isPopular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-violet-500 text-white">Most Popular</Badge>
                </div>
              )}
              <CardHeader className="text-center pb-2">
                <div className={cn('mx-auto mb-2 p-3 rounded-full bg-muted', getPlanColor(plan.id))}>
                  {getPlanIcon(plan.id)}
                </div>
                <CardTitle className="text-lg">{plan.displayName}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="text-center mb-4">
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-3xl font-bold">{formatCurrency(plan.price)}</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {plan.subscriberCount} subscribers
                  </p>
                </div>

                <Separator className="my-4" />

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <Home className="h-4 w-4 text-muted-foreground" />
                      Properties
                    </span>
                    <span className="font-medium">
                      {plan.maxProperties === 999 ? 'Unlimited' : plan.maxProperties}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      Users
                    </span>
                    <span className="font-medium">
                      {plan.maxUsers === 999 ? 'Unlimited' : plan.maxUsers}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <DoorOpen className="h-4 w-4 text-muted-foreground" />
                      Rooms
                    </span>
                    <span className="font-medium">
                      {plan.maxRooms === 9999 ? 'Unlimited' : plan.maxRooms}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <Database className="h-4 w-4 text-muted-foreground" />
                      Storage
                    </span>
                    <span className="font-medium">{plan.storageLimitMb} MB</span>
                  </div>
                </div>

                <Separator className="my-4" />

                <ScrollArea className="h-40">
                  <div className="space-y-2">
                    {plan.features.map((feature, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm">
                        {feature.included ? (
                          <Check className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <X className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className={feature.included ? '' : 'text-muted-foreground'}>
                          {feature.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
              <CardFooter className="flex flex-col gap-2">
                <Button
                  className="w-full"
                  variant={plan.isPopular ? 'default' : 'outline'}
                  disabled={subscribingPlanId === plan.id}
                  onClick={() => handleSubscribe(plan.id)}
                >
                  {subscribingPlanId === plan.id ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Rocket className="h-4 w-4 mr-2" />
                  )}
                  {plan.subscriberCount > 0 ? 'Upgrade' : 'Subscribe'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-muted-foreground"
                  onClick={() => editPlan(plan)}
                >
                  <Edit className="h-3 w-3 mr-2" />
                  Edit Plan
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        /* Comparison View */
        <Card>
          <CardContent className="p-0">
            <ScrollArea className="max-h-[600px]">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50 sticky top-0">
                    <th className="p-4 text-left font-medium">Feature</th>
                    {plans.map(plan => (
                      <th key={plan.id} className="p-4 text-center font-medium min-w-[150px]">
                        <div className="flex flex-col items-center gap-2">
                          {getPlanIcon(plan.id)}
                          <span>{plan.displayName}</span>
                          <span className="text-lg font-bold">{formatCurrency(plan.price)}/mo</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b bg-muted/30">
                    <td className="p-3 font-medium">Pricing</td>
                    {plans.map(plan => (
                      <td key={plan.id} className="p-3 text-center">
                        <div className="text-lg font-bold">{formatCurrency(plan.price)}</div>
                        <div className="text-xs text-muted-foreground">/month</div>
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b">
                    <td className="p-3 font-medium">Properties</td>
                    {plans.map(plan => (
                      <td key={plan.id} className="p-3 text-center">
                        {plan.maxProperties === 999 ? 'Unlimited' : plan.maxProperties}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b bg-muted/30">
                    <td className="p-3 font-medium">Users</td>
                    {plans.map(plan => (
                      <td key={plan.id} className="p-3 text-center">
                        {plan.maxUsers === 999 ? 'Unlimited' : plan.maxUsers}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b">
                    <td className="p-3 font-medium">Rooms</td>
                    {plans.map(plan => (
                      <td key={plan.id} className="p-3 text-center">
                        {plan.maxRooms === 9999 ? 'Unlimited' : plan.maxRooms}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b bg-muted/30">
                    <td className="p-3 font-medium">Storage</td>
                    {plans.map(plan => (
                      <td key={plan.id} className="p-3 text-center">
                        {plan.storageLimitMb} MB
                      </td>
                    ))}
                  </tr>
                  {/* Features comparison */}
                  {plans[0]?.features.map((_, featureIndex) => (
                    <tr key={featureIndex} className={featureIndex % 2 === 0 ? 'border-b' : 'border-b bg-muted/30'}>
                      <td className="p-3">{plans[0].features[featureIndex].name}</td>
                      {plans.map(plan => (
                        <td key={plan.id} className="p-3 text-center">
                          {plan.features[featureIndex]?.included ? (
                            <Check className="h-5 w-5 text-emerald-500 mx-auto" />
                          ) : (
                            <X className="h-5 w-5 text-muted-foreground mx-auto" />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr className="bg-muted/50">
                    <td className="p-3 font-medium">Subscribers</td>
                    {plans.map(plan => (
                      <td key={plan.id} className="p-3 text-center font-medium">
                        {plan.subscriberCount}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Edit Plan Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Edit Plan: {selectedPlan?.displayName}
            </DialogTitle>
            <DialogDescription>
              Update plan details and limits
            </DialogDescription>
          </DialogHeader>
          {selectedPlan && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="displayName">Display Name</Label>
                  <Input
                    id="displayName"
                    value={formData.displayName}
                    onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price">Price ({currency.symbol}/month)</Label>
                  <Input
                    id="price"
                    type="number"
                    min="0"
                    value={formData.price}
                    onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={2}
                />
              </div>

              <Separator />

              <h4 className="font-medium">Resource Limits</h4>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="maxProperties">Max Properties</Label>
                  <Input
                    id="maxProperties"
                    type="number"
                    min="1"
                    value={formData.maxProperties}
                    onChange={(e) => setFormData(prev => ({ ...prev, maxProperties: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxUsers">Max Users</Label>
                  <Input
                    id="maxUsers"
                    type="number"
                    min="1"
                    value={formData.maxUsers}
                    onChange={(e) => setFormData(prev => ({ ...prev, maxUsers: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="maxRooms">Max Rooms</Label>
                  <Input
                    id="maxRooms"
                    type="number"
                    min="1"
                    value={formData.maxRooms}
                    onChange={(e) => setFormData(prev => ({ ...prev, maxRooms: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="storageLimitMb">Storage (MB)</Label>
                  <Input
                    id="storageLimitMb"
                    type="number"
                    min="100"
                    value={formData.storageLimitMb}
                    onChange={(e) => setFormData(prev => ({ ...prev, storageLimitMb: e.target.value }))}
                  />
                </div>
              </div>

              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  Current subscribers: <span className="font-medium text-foreground">{selectedPlan.subscriberCount}</span>
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
