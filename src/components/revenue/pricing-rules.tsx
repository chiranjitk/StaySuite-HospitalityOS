'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useCurrency } from '@/contexts/CurrencyContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
  Plus,
  Calendar,
  DollarSign,
  Percent,
  Clock,
  TrendingUp,
  TrendingDown,
  Edit,
  Trash2,
  Copy,
  MoreHorizontal,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface PricingRule {
  id: string;
  name: string;
  type: 'markup' | 'markdown' | 'dynamic' | 'seasonal';
  value: number;
  valueType: 'percentage' | 'fixed';
  conditions: {
    minOccupancy?: number;
    maxOccupancy?: number;
    daysOfWeek?: string[];
    minLeadTime?: number;
    maxLeadTime?: number;
    minStay?: number;
    maxStay?: number;
  };
  priority: number;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo?: string;
  roomTypes: string[];
  description?: string;
}

interface PricingRuleStats {
  totalRules: number;
  activeRules: number;
  avgAdjustment: number;
  seasonalRules: number;
}

const ruleTypeLabels: Record<string, string> = {
  markup: 'Price Increase',
  markdown: 'Price Decrease',
  dynamic: 'Dynamic Pricing',
  seasonal: 'Seasonal Rate',
};

const ruleTypeColors: Record<string, string> = {
  markup: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
  markdown: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  dynamic: 'bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300',
  seasonal: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
};

export function PricingRules() {
  const { formatCurrency, currency } = useCurrency();
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [stats, setStats] = useState<PricingRuleStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<PricingRule | null>(null);
  const [newRule, setNewRule] = useState<Partial<PricingRule>>({
    name: '',
    type: 'markup',
    value: 10,
    valueType: 'percentage',
    isActive: true,
    priority: 1,
    effectiveFrom: format(new Date(), 'yyyy-MM-dd'),
    roomTypes: [],
    conditions: {},
  });

  // Fetch pricing rules from API
  const fetchPricingRules = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/revenue/pricing-rules');
      const data = await response.json();
      
      if (data.success) {
        setRules(data.data || []);
        setStats(data.stats || {
          totalRules: 0,
          activeRules: 0,
          avgAdjustment: 0,
          seasonalRules: 0,
        });
      } else {
        toast.error('Failed to load pricing rules');
      }
    } catch (error) {
      console.error('Error fetching pricing rules:', error);
      toast.error('Failed to load pricing rules');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPricingRules();
  }, [fetchPricingRules]);

  const toggleRuleActive = async (id: string) => {
    const rule = rules.find(r => r.id === id);
    if (!rule) return;

    try {
      const response = await fetch('/api/revenue/pricing-rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          isActive: !rule.isActive,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setRules(prev =>
          prev.map(r =>
            r.id === id ? { ...r, isActive: !r.isActive } : r
          )
        );
        toast.success('Rule status updated');
      } else {
        toast.error('Failed to update rule');
      }
    } catch (error) {
      console.error('Error updating rule:', error);
      toast.error('Failed to update rule');
    }
  };

  const deleteRule = async (id: string) => {
    try {
      const response = await fetch(`/api/revenue/pricing-rules?id=${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      
      if (data.success) {
        setRules(prev => prev.filter(rule => rule.id !== id));
        toast.success('Rule deleted');
      } else {
        toast.error('Failed to delete rule');
      }
    } catch (error) {
      console.error('Error deleting rule:', error);
      toast.error('Failed to delete rule');
    }
  };

  const duplicateRule = async (rule: PricingRule) => {
    try {
      const response = await fetch('/api/revenue/pricing-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...rule,
          name: `${rule.name} (Copy)`,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setRules(prev => [...prev, data.data]);
        toast.success('Rule duplicated');
      } else {
        toast.error('Failed to duplicate rule');
      }
    } catch (error) {
      console.error('Error duplicating rule:', error);
      toast.error('Failed to duplicate rule');
    }
  };

  const createRule = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/revenue/pricing-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRule),
      });

      const data = await response.json();
      
      if (data.success) {
        setRules(prev => [...prev, data.data]);
        setIsCreateOpen(false);
        resetForm();
        toast.success('Pricing rule created');
      } else {
        toast.error(data.error?.message || 'Failed to create rule');
      }
    } catch (error) {
      console.error('Error creating rule:', error);
      toast.error('Failed to create rule');
    } finally {
      setIsSaving(false);
    }
  };

  const updateRule = async () => {
    if (!editingRule) return;
    setIsSaving(true);
    try {
      const response = await fetch('/api/revenue/pricing-rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingRule),
      });

      const data = await response.json();
      
      if (data.success) {
        setRules(prev =>
          prev.map(r => (r.id === editingRule.id ? data.data : r))
        );
        setEditingRule(null);
        toast.success('Pricing rule updated');
      } else {
        toast.error('Failed to update rule');
      }
    } catch (error) {
      console.error('Error updating rule:', error);
      toast.error('Failed to update rule');
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setNewRule({
      name: '',
      type: 'markup',
      value: 10,
      valueType: 'percentage',
      isActive: true,
      priority: 1,
      effectiveFrom: format(new Date(), 'yyyy-MM-dd'),
      roomTypes: [],
      conditions: {},
    });
    setEditingRule(null);
  };

  const RuleForm = ({ rule, onChange, onSave, onCancel }: {
    rule: Partial<PricingRule>;
    onChange: (rule: Partial<PricingRule>) => void;
    onSave: () => void;
    onCancel: () => void;
  }) => (
    <div className="space-y-4 py-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Rule Name</label>
        <Input
          placeholder="Enter rule name"
          value={rule.name || ''}
          onChange={(e) => onChange({ ...rule, name: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Rule Type</label>
          <Select
            value={rule.type}
            onValueChange={(value) => onChange({ ...rule, type: value as PricingRule['type'] })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="markup">Price Increase</SelectItem>
              <SelectItem value="markdown">Price Decrease</SelectItem>
              <SelectItem value="dynamic">Dynamic Pricing</SelectItem>
              <SelectItem value="seasonal">Seasonal Rate</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Value Type</label>
          <Select
            value={rule.valueType}
            onValueChange={(value) => onChange({ ...rule, valueType: value as 'percentage' | 'fixed' })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="percentage">Percentage (%)</SelectItem>
              <SelectItem value="fixed">Fixed Amount</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Adjustment Value</label>
          <Input
            type="number"
            placeholder="Enter value"
            value={rule.value || ''}
            onChange={(e) => onChange({ ...rule, value: parseFloat(e.target.value) || 0 })}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Priority</label>
          <Input
            type="number"
            placeholder="1"
            value={rule.priority || ''}
            onChange={(e) => onChange({ ...rule, priority: parseInt(e.target.value) || 1 })}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Effective From</label>
          <Input
            type="date"
            value={rule.effectiveFrom || ''}
            onChange={(e) => onChange({ ...rule, effectiveFrom: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Effective To (Optional)</label>
          <Input
            type="date"
            value={rule.effectiveTo || ''}
            onChange={(e) => onChange({ ...rule, effectiveTo: e.target.value })}
          />
        </div>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium">Description</label>
        <Textarea
          placeholder="Describe this pricing rule"
          value={rule.description || ''}
          onChange={(e) => onChange({ ...rule, description: e.target.value })}
        />
      </div>
      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={onSave} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700">
          {isSaving ? 'Saving...' : 'Save Rule'}
        </Button>
      </DialogFooter>
    </div>
  );

  if (isLoading || !stats) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="grid gap-4 grid-cols-1 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="border-0 shadow-sm">
              <CardContent className="pt-6">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Pricing Rules</h2>
          <p className="text-muted-foreground">Automated pricing adjustments and strategies</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchPricingRules}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <Button onClick={() => setIsCreateOpen(true)} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
              <Plus className="h-4 w-4" />
              Create Rule
            </Button>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Create Pricing Rule</DialogTitle>
                <DialogDescription>
                  Set up an automated pricing adjustment rule
                </DialogDescription>
              </DialogHeader>
              <RuleForm
                rule={newRule}
                onChange={setNewRule}
                onSave={createRule}
                onCancel={() => { setIsCreateOpen(false); resetForm(); }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Total Rules</p>
                <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">{stats.totalRules}</p>
              </div>
              <div className="p-3 rounded-full bg-emerald-200 dark:bg-emerald-800">
                <DollarSign className="h-6 w-6 text-emerald-700 dark:text-emerald-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Active Rules</p>
                <p className="text-2xl font-bold text-amber-900 dark:text-amber-100">{stats.activeRules}</p>
              </div>
              <div className="p-3 rounded-full bg-amber-200 dark:bg-amber-800">
                <CheckCircle className="h-6 w-6 text-amber-700 dark:text-amber-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-violet-50 to-violet-100 dark:from-violet-950 dark:to-violet-900">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-violet-700 dark:text-violet-400">Avg Adjustment</p>
                <p className="text-2xl font-bold text-violet-900 dark:text-violet-100">{stats.avgAdjustment}%</p>
              </div>
              <div className="p-3 rounded-full bg-violet-200 dark:bg-violet-800">
                <Percent className="h-6 w-6 text-violet-700 dark:text-violet-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-950 dark:to-cyan-900">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-cyan-700 dark:text-cyan-400">Seasonal Rules</p>
                <p className="text-2xl font-bold text-cyan-900 dark:text-cyan-100">{stats.seasonalRules}</p>
              </div>
              <div className="p-3 rounded-full bg-cyan-200 dark:bg-cyan-800">
                <Calendar className="h-6 w-6 text-cyan-700 dark:text-cyan-300" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rules List */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Pricing Rules</CardTitle>
          <CardDescription>Manage automated pricing adjustments</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {rules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <DollarSign className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">No pricing rules yet</p>
              <p className="text-sm">Create your first pricing rule to get started</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rule Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Adjustment</TableHead>
                  <TableHead>Conditions</TableHead>
                  <TableHead>Effective Period</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id} className={!rule.isActive ? 'opacity-60' : ''}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{rule.name}</p>
                        {rule.description && (
                          <p className="text-xs text-muted-foreground">{rule.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={ruleTypeColors[rule.type]}>
                        {ruleTypeLabels[rule.type]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {rule.type === 'markdown' ? (
                          <TrendingDown className="h-4 w-4 text-red-500 dark:text-red-400" />
                        ) : (
                          <TrendingUp className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
                        )}
                        <span className={rule.type === 'markdown' ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}>
                          {rule.type === 'markdown' ? '-' : '+'}{rule.value}{rule.valueType === 'percentage' ? '%' : currency.symbol}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {rule.conditions?.daysOfWeek && rule.conditions.daysOfWeek.length > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {rule.conditions.daysOfWeek.join(', ')}
                          </Badge>
                        )}
                        {rule.conditions?.minStay && (
                          <Badge variant="outline" className="text-xs">
                            {rule.conditions.minStay}+ nights
                          </Badge>
                        )}
                        {rule.conditions?.maxLeadTime && (
                          <Badge variant="outline" className="text-xs">
                            Within {rule.conditions.maxLeadTime} days
                          </Badge>
                        )}
                        {(!rule.conditions?.daysOfWeek?.length && !rule.conditions?.minStay && !rule.conditions?.maxLeadTime) && (
                          <span className="text-muted-foreground text-sm">All conditions</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p>{rule.effectiveFrom ? format(new Date(rule.effectiveFrom), 'MMM dd, yyyy') : '-'}</p>
                        {rule.effectiveTo && (
                          <p className="text-muted-foreground">to {format(new Date(rule.effectiveTo), 'MMM dd, yyyy')}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={rule.isActive}
                        onCheckedChange={() => toggleRuleActive(rule.id)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditingRule(rule)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => duplicateRule(rule)}>
                            <Copy className="h-4 w-4 mr-2" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600 dark:text-red-400"
                            onClick={() => deleteRule(rule.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingRule} onOpenChange={() => setEditingRule(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Pricing Rule</DialogTitle>
            <DialogDescription>
              Update the pricing rule settings
            </DialogDescription>
          </DialogHeader>
          {editingRule && (
            <RuleForm
              rule={editingRule}
              onChange={(rule) => setEditingRule(rule as PricingRule)}
              onSave={updateRule}
              onCancel={() => setEditingRule(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
