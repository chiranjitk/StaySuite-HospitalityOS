'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { 
  Zap, Plus, Search, Edit, Trash2, Play, Pause, Settings,
  Clock, CheckCircle, XCircle, AlertCircle, Copy
} from 'lucide-react';
import { toast } from 'sonner';

interface AutomationRule {
  id: string;
  name: string;
  description: string | null;
  triggerEvent: string;
  triggerConditions: string | null;
  actions: string;
  isActive: boolean;
  executionCount: number;
  lastExecutedAt: string | null;
  createdAt: string;
  recentSuccessRate: number;
}

interface RuleStats {
  totalRules: number;
  activeRules: number;
  totalExecutions: number;
  successRate: number;
  executionsToday: number;
}

interface TriggerEvent {
  value: string;
  label: string;
  description: string;
}

export default function RulesEngine() {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [stats, setStats] = useState<RuleStats>({
    totalRules: 0,
    activeRules: 0,
    totalExecutions: 0,
    successRate: 0,
    executionsToday: 0,
  });
  const [triggerEvents, setTriggerEvents] = useState<TriggerEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [deleteRuleId, setDeleteRuleId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    triggerEvent: '',
    triggerConditions: '',
    actions: [] as Array<{ type: string; config: Record<string, unknown> }>,
    isActive: true,
  });
  const [newAction, setNewAction] = useState({ type: '', config: {} });

  useEffect(() => {
    fetchRules();
  }, [search, statusFilter]);

  const fetchRules = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (statusFilter && statusFilter !== 'all') params.append('isActive', statusFilter);

      const response = await fetch(`/api/automation/rules?${params}`);
      const data = await response.json();

      if (data.success) {
        setRules(data.data.rules);
        setStats(data.data.stats);
        setTriggerEvents(data.data.triggerEvents);
      }
    } catch (error) {
      console.error('Error fetching rules:', error);
      toast.error('Failed to fetch automation rules');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (rule?: AutomationRule) => {
    if (rule) {
      setEditingRule(rule);
      setFormData({
        name: rule.name,
        description: rule.description || '',
        triggerEvent: rule.triggerEvent,
        triggerConditions: rule.triggerConditions || '',
        actions: JSON.parse(rule.actions),
        isActive: rule.isActive,
      });
    } else {
      setEditingRule(null);
      setFormData({
        name: '',
        description: '',
        triggerEvent: '',
        triggerConditions: '',
        actions: [],
        isActive: true,
      });
    }
    setNewAction({ type: '', config: {} });
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingRule(null);
  };

  const addAction = () => {
    if (!newAction.type) {
      toast.error('Please select an action type');
      return;
    }
    setFormData({
      ...formData,
      actions: [...formData.actions, newAction],
    });
    setNewAction({ type: '', config: {} });
  };

  const removeAction = (index: number) => {
    setFormData({
      ...formData,
      actions: formData.actions.filter((_, i) => i !== index),
    });
  };

  const handleSave = async () => {
    if (!formData.name || !formData.triggerEvent || formData.actions.length === 0) {
      toast.error('Name, trigger, and at least one action are required');
      return;
    }

    try {
      const url = '/api/automation/rules';
      const method = editingRule ? 'PUT' : 'POST';
      const body = editingRule
        ? { id: editingRule.id, ...formData, actions: JSON.stringify(formData.actions), triggerConditions: formData.triggerConditions || null }
        : { ...formData, actions: JSON.stringify(formData.actions), triggerConditions: formData.triggerConditions || null };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(editingRule ? 'Rule updated successfully' : 'Rule created successfully');
        handleCloseDialog();
        fetchRules();
      } else {
        toast.error(data.error.message);
      }
    } catch (error) {
      console.error('Error saving rule:', error);
      toast.error('Failed to save rule');
    }
  };

  const handleToggleActive = async (rule: AutomationRule) => {
    try {
      const response = await fetch('/api/automation/rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: rule.id, isActive: !rule.isActive }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(rule.isActive ? 'Rule paused' : 'Rule activated');
        fetchRules();
      } else {
        toast.error(data.error.message);
      }
    } catch (error) {
      console.error('Error toggling rule:', error);
      toast.error('Failed to update rule');
    }
  };

  const handleDelete = (id: string) => {
    setDeleteRuleId(id);
  };

  const confirmDelete = async () => {
    if (!deleteRuleId) return;

    try {
      const response = await fetch(`/api/automation/rules?id=${deleteRuleId}`, { method: 'DELETE' });
      const data = await response.json();

      if (data.success) {
        toast.success('Rule deleted successfully');
        fetchRules();
      } else {
        toast.error(data.error.message);
      }
    } catch (error) {
      console.error('Error deleting rule:', error);
      toast.error('Failed to delete rule');
    } finally {
      setDeleteRuleId(null);
    }
  };

  const duplicateRule = async (rule: AutomationRule) => {
    try {
      const response = await fetch('/api/automation/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${rule.name} (Copy)`,
          description: rule.description,
          triggerEvent: rule.triggerEvent,
          actions: rule.actions,
          isActive: false,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Rule duplicated successfully');
        fetchRules();
      } else {
        toast.error(data.error.message);
      }
    } catch (error) {
      console.error('Error duplicating rule:', error);
      toast.error('Failed to duplicate rule');
    }
  };

  const getTriggerLabel = (value: string) => {
    return triggerEvents.find(t => t.value === value)?.label || value;
  };

  const getSuccessRateColor = (rate: number) => {
    if (rate >= 90) return 'text-emerald-600 dark:text-emerald-400';
    if (rate >= 70) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Rules Engine</h1>
        <p className="text-muted-foreground">
          Create and manage automation rules for your property
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
        <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950 dark:to-teal-950">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Total Rules</p>
                <p className="text-2xl font-bold">{stats.totalRules}</p>
              </div>
              <Zap className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Active Rules</p>
                <p className="text-2xl font-bold">{stats.activeRules}</p>
              </div>
              <Play className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-cyan-50 to-sky-50 dark:from-cyan-950 dark:to-sky-950">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Executions</p>
                <p className="text-2xl font-bold">{stats.totalExecutions.toLocaleString()}</p>
              </div>
              <Clock className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-950 dark:to-pink-950">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Success Rate</p>
                <p className="text-2xl font-bold">{stats.successRate}%</p>
              </div>
              <CheckCircle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950 dark:to-violet-950">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Today</p>
                <p className="text-2xl font-bold">{stats.executionsToday}</p>
              </div>
              <AlertCircle className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search rules..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="true">Active</SelectItem>
              <SelectItem value="false">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => handleOpenDialog()} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="h-4 w-4 mr-2" />
          Create Rule
        </Button>
      </div>

      {/* Rules List */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
        </div>
      ) : rules.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Zap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No automation rules found</h3>
            <p className="text-muted-foreground mb-4">
              {search || statusFilter !== 'all' ? 'Try adjusting your filters' : 'Create your first rule to automate workflows'}
            </p>
            {!search && statusFilter === 'all' && (
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Create Rule
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {rules.map((rule) => (
            <Card key={rule.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row gap-4 md:items-center justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`rounded-lg p-3 ${rule.isActive ? 'bg-emerald-100 dark:bg-emerald-900' : 'bg-gray-100 dark:bg-gray-800'}`}>
                      {rule.isActive ? (
                        <Play className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Pause className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                      )}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{rule.name}</h3>
                        <Badge variant={rule.isActive ? 'default' : 'secondary'} className="text-xs">
                          {rule.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Trigger: <span className="font-medium">{getTriggerLabel(rule.triggerEvent)}</span>
                      </p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {rule.executionCount} executions
                        </span>
                        <span className={`flex items-center gap-1 ${getSuccessRateColor(rule.recentSuccessRate)}`}>
                          <CheckCircle className="h-3 w-3" />
                          {rule.recentSuccessRate}% success
                        </span>
                        {rule.lastExecutedAt && (
                          <span>
                            Last: {new Date(rule.lastExecutedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={rule.isActive}
                      onCheckedChange={() => handleToggleActive(rule)}
                    />
                    <Button variant="ghost" size="icon" onClick={() => duplicateRule(rule)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(rule)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(rule.id)}>
                      <Trash2 className="h-4 w-4 text-red-500 dark:text-red-400" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingRule ? 'Edit Rule' : 'Create Automation Rule'}</DialogTitle>
            <DialogDescription>
              Configure trigger events and actions for this rule
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-6 py-4">
              {/* Basic Info */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Rule Name</label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Send welcome email on booking"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Description</label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe what this rule does"
                    rows={2}
                  />
                </div>
              </div>

              <Separator />

              {/* Trigger */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Trigger Event</label>
                  <Select value={formData.triggerEvent} onValueChange={(v) => setFormData({ ...formData, triggerEvent: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a trigger event" />
                    </SelectTrigger>
                    <SelectContent>
                      {triggerEvents.map((event) => (
                        <SelectItem key={event.value} value={event.value}>
                          <div>
                            <span className="font-medium">{event.label}</span>
                            <span className="text-xs text-muted-foreground ml-2">{event.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Trigger Conditions <span className="text-muted-foreground font-normal">(JSON, optional)</span></label>
                  <Textarea
                    value={formData.triggerConditions}
                    onChange={(e) => setFormData({ ...formData, triggerConditions: e.target.value })}
                    placeholder='[{"type": "loyalty_tier", "config": {"operator": "eq", "value": "gold"}}]'
                    rows={3}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    JSON array of conditions that must be met for this rule to trigger
                  </p>
                </div>
              </div>

              <Separator />

              {/* Actions */}
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium">Actions</h4>
                  <p className="text-sm text-muted-foreground">
                    Define what happens when the trigger fires
                  </p>
                </div>

                {/* Existing Actions */}
                {formData.actions.length > 0 && (
                  <div className="space-y-2">
                    {formData.actions.map((action, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div className="flex items-center gap-2">
                          <Zap className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                          <span className="font-medium capitalize">{action.type.replace('_', ' ')}</span>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => removeAction(index)}>
                          <XCircle className="h-4 w-4 text-red-500 dark:text-red-400" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add New Action */}
                <div className="flex gap-2">
                  <Select value={newAction.type} onValueChange={(v) => setNewAction({ type: v, config: {} })}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select action type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="send_email">Send Email</SelectItem>
                      <SelectItem value="send_sms">Send SMS</SelectItem>
                      <SelectItem value="send_notification">Push Notification</SelectItem>
                      <SelectItem value="add_tag">Add Tag</SelectItem>
                      <SelectItem value="update_loyalty">Update Loyalty Points</SelectItem>
                      <SelectItem value="create_task">Create Task</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" onClick={addAction}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Active Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Active</p>
                  <p className="text-sm text-muted-foreground">
                    Rule will run automatically when active
                  </p>
                </div>
                <Switch
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
              </div>
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>Cancel</Button>
            <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700">
              {editingRule ? 'Update Rule' : 'Create Rule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteRuleId} onOpenChange={(open) => !open && setDeleteRuleId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Rule</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this automation rule? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
