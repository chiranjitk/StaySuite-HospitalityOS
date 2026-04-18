'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Shield,
  ShieldCheck,
  ShieldBan,
  ShieldAlert,
  Plus,
  Trash2,
  Edit2,
  Eye,
  Ban,
  Gauge,
  Clock,
  Zap,
  ArrowUp,
  ArrowDown,
  Search,
  Filter,
  RefreshCw,
  Loader2,
  Globe,
  Network,
  Lock,
  Unlock,
  Server,
  Route,
  Timer,
  LayoutGrid,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────

interface GuiRule {
  id: string;
  name: string;
  chain: string;
  protocol: string;
  sourceIp: string;
  destIp: string;
  destPort: string;
  action: string;
  enabled: boolean;
  comment: string;
  priority: number;
  handle: number;
  createdAt: string;
}

interface PortForward {
  id: string;
  name: string;
  protocol: string;
  externalPort: number;
  internalIp: string;
  internalPort: number;
  sourceIp: string;
  enabled: boolean;
  handle: number;
  createdAt: string;
}

interface RateLimit {
  id: string;
  name: string;
  targetIp: string;
  downloadRate: string;
  uploadRate: string;
  protocol: string;
  enabled: boolean;
  downloadHandle: number;
  uploadHandle: number;
  createdAt: string;
}

interface QuickBlock {
  id: string;
  type: string;
  value: string;
  reason: string;
  blockedAt: string;
  handle: number;
}

interface Preset {
  id: string;
  name: string;
  description: string;
  category: string;
  rules: { protocol: string; destPort: string; action: string }[];
}

interface Schedule {
  id: string;
  name: string;
  days: string;
  startTime: string;
  endTime: string;
  linkedRules?: number;
  enabled: boolean;
  createdAt?: string;
}

// ─── API Helper ──────────────────────────────────────────────────────

const API_BASE = '/api/nftables';

async function apiFetch<T>(
  url: string,
  options?: RequestInit
): Promise<{ success: boolean; data?: T; error?: { message: string } }> {
  return fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  }).then(async (res) => {
    const result = await res.json();
    if (!res.ok)
      throw new Error(result.error?.message || `Request failed (${res.status})`);
    return result;
  });
}

// ─── Shared Components ───────────────────────────────────────────────

function TableSkeleton({ cols = 6, rows = 5 }: { cols?: number; rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 items-center">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className="h-8 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

function ActionBadge({ action }: { action: string }) {
  const colors: Record<string, string> = {
    accept: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    drop: 'bg-red-100 text-red-700 border-red-200',
    reject: 'bg-orange-100 text-orange-700 border-orange-200',
    log: 'bg-amber-100 text-amber-700 border-amber-200',
  };
  return (
    <Badge variant="outline" className={cn('text-xs font-semibold', colors[action] || '')}>
      {action.toUpperCase()}
    </Badge>
  );
}

function BlockTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    ip: 'bg-cyan-100 text-cyan-700 border-cyan-200',
    subnet: 'bg-purple-100 text-purple-700 border-purple-200',
    mac: 'bg-pink-100 text-pink-700 border-pink-200',
  };
  return (
    <Badge variant="outline" className={cn('text-xs font-semibold', colors[type] || '')}>
      {type.toUpperCase()}
    </Badge>
  );
}

function CategoryBadge({ category }: { category: string }) {
  const colors: Record<string, string> = {
    networking: 'bg-teal-100 text-teal-700 border-teal-200',
    'remote-access': 'bg-blue-100 text-blue-700 border-blue-200',
    security: 'bg-red-100 text-red-700 border-red-200',
    'content-filter': 'bg-amber-100 text-amber-700 border-amber-200',
  };
  return (
    <Badge variant="outline" className={cn('text-xs font-semibold', colors[category] || '')}>
      {category.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
    </Badge>
  );
}

const RATE_PRESETS = [
  { label: '512 Kbps', value: '512kbit' },
  { label: '1 Mbps', value: '1mbit' },
  { label: '2 Mbps', value: '2mbit' },
  { label: '5 Mbps', value: '5mbit' },
  { label: '10 Mbps', value: '10mbit' },
  { label: '20 Mbps', value: '20mbit' },
  { label: '50 Mbps', value: '50mbit' },
  { label: '100 Mbps', value: '100mbit' },
];

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ─── Main Firewall Page ─────────────────────────────────────────────

export default function FirewallPage() {
  const [activeTab, setActiveTab] = useState('rules');

  const tabs = [
    { id: 'rules', label: 'Rules', icon: ShieldCheck },
    { id: 'port-forward', label: 'Port Forwarding', icon: Route },
    { id: 'rate-limit', label: 'Rate Limiting', icon: Gauge },
    { id: 'quick-block', label: 'Quick Block', icon: Ban },
    { id: 'schedules', label: 'Schedules', icon: Clock },
    { id: 'presets', label: 'Presets', icon: LayoutGrid },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Shield className="h-6 w-6 text-teal-600" />
          Firewall Management
        </h2>
        <p className="text-muted-foreground">
          Manage nftables firewall rules, port forwarding, rate limiting, and security presets
        </p>
      </div>

      {/* Sticky Tab Navigation */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pb-1">
        <div className="flex gap-1 bg-muted/50 p-1 rounded-lg overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all whitespace-nowrap',
                  activeTab === tab.id
                    ? 'bg-background text-foreground shadow-sm border border-border'
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'rules' && <RulesTab />}
      {activeTab === 'port-forward' && <PortForwardTab />}
      {activeTab === 'rate-limit' && <RateLimitTab />}
      {activeTab === 'quick-block' && <QuickBlockTab />}
      {activeTab === 'schedules' && <SchedulesTab />}
      {activeTab === 'presets' && <PresetsTab />}
    </div>
  );
}

// ─── Tab 1: Rules ───────────────────────────────────────────────────

function RulesTab() {
  const { toast } = useToast();
  const [rules, setRules] = useState<GuiRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<GuiRule | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [filters, setFilters] = useState({ protocol: 'all', action: 'all' });

  const [form, setForm] = useState({
    name: '',
    protocol: 'tcp',
    sourceIp: '',
    destIp: '',
    destPort: '',
    action: 'accept',
    comment: '',
    enabled: true,
  });

  const fetchRules = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch<GuiRule[]>(`${API_BASE}/gui-rules`);
      if (res.success && res.data) {
        setRules(res.data);
      }
    } catch (e) {
      toast({
        title: 'Error',
        description: 'Failed to load firewall rules',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const openAdd = () => {
    setEditingRule(null);
    setForm({ name: '', protocol: 'tcp', sourceIp: '', destIp: '', destPort: '', action: 'accept', comment: '', enabled: true });
    setDialogOpen(true);
  };

  const openEdit = (r: GuiRule) => {
    setEditingRule(r);
    setForm({
      name: r.name,
      protocol: r.protocol,
      sourceIp: r.sourceIp || '',
      destIp: r.destIp || '',
      destPort: r.destPort || '',
      action: r.action,
      comment: r.comment || '',
      enabled: r.enabled,
    });
    setDialogOpen(true);
  };

  const saveRule = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Validation Error', description: 'Rule name is required', variant: 'destructive' });
      return;
    }
    try {
      setSaving(true);
      if (editingRule) {
        await apiFetch(`${API_BASE}/gui-rules/${editingRule.id}`, {
          method: 'PUT',
          body: JSON.stringify(form),
        });
        toast({ title: 'Rule Updated', description: `${form.name} has been updated.` });
      } else {
        const maxP = rules.length > 0 ? Math.max(...rules.map((r) => r.priority)) : 0;
        await apiFetch(`${API_BASE}/gui-rules`, {
          method: 'POST',
          body: JSON.stringify({ ...form, priority: maxP + 10 }),
        });
        toast({ title: 'Rule Created', description: `${form.name} has been created.` });
      }
      setDialogOpen(false);
      await fetchRules();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to save rule';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const deleteRule = async () => {
    if (!deleteId) return;
    try {
      await apiFetch(`${API_BASE}/gui-rules/${deleteId}`, { method: 'DELETE' });
      toast({ title: 'Rule Deleted', description: 'Firewall rule has been removed.' });
      await fetchRules();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to delete rule';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setDeleteId(null);
    }
  };

  const toggleRule = async (id: string) => {
    const rule = rules.find((r) => r.id === id);
    if (!rule) return;
    try {
      await apiFetch(`${API_BASE}/gui-rules/${id}/toggle`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: !rule.enabled }),
      });
      setRules(rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)));
      toast({ title: rule.enabled ? 'Rule Disabled' : 'Rule Enabled' });
    } catch {
      toast({ title: 'Error', description: 'Failed to toggle rule', variant: 'destructive' });
    }
  };

  const moveRule = async (id: string, dir: 'up' | 'down') => {
    const sorted = [...rules].sort((a, b) => a.priority - b.priority);
    const idx = sorted.findIndex((r) => r.id === id);
    if ((dir === 'up' && idx <= 0) || (dir === 'down' && idx >= sorted.length - 1)) return;

    const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
    const tempP = sorted[idx].priority;
    sorted[idx] = { ...sorted[idx], priority: sorted[swapIdx].priority };
    sorted[swapIdx] = { ...sorted[swapIdx], priority: tempP };
    setRules(sorted);

    try {
      await Promise.all([
        apiFetch(`${API_BASE}/gui-rules/${sorted[idx].id}`, {
          method: 'PUT',
          body: JSON.stringify({ priority: sorted[idx].priority }),
        }),
        apiFetch(`${API_BASE}/gui-rules/${sorted[swapIdx].id}`, {
          method: 'PUT',
          body: JSON.stringify({ priority: sorted[swapIdx].priority }),
        }),
      ]);
    } catch {
      toast({ title: 'Error', description: 'Failed to reorder rules', variant: 'destructive' });
      await fetchRules();
    }
  };

  const filteredRules = rules
    .filter((r) => filters.protocol === 'all' || r.protocol === filters.protocol)
    .filter((r) => filters.action === 'all' || r.action === filters.action)
    .sort((a, b) => a.priority - b.priority);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-24" />
        </div>
        <TableSkeleton cols={9} rows={5} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={filters.protocol} onValueChange={(v) => setFilters((p) => ({ ...p, protocol: v }))}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Protocol" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Proto</SelectItem>
            <SelectItem value="tcp">TCP</SelectItem>
            <SelectItem value="udp">UDP</SelectItem>
            <SelectItem value="icmp">ICMP</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filters.action} onValueChange={(v) => setFilters((p) => ({ ...p, action: v }))}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            <SelectItem value="accept">Accept</SelectItem>
            <SelectItem value="drop">Drop</SelectItem>
            <SelectItem value="reject">Reject</SelectItem>
            <SelectItem value="log">Log</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={fetchRules}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
        <Button onClick={openAdd} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Rule
        </Button>
      </div>

      {/* Rules Table */}
      {filteredRules.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No firewall rules"
          description={
            filters.protocol !== 'all' || filters.action !== 'all'
              ? 'No rules match the current filters. Try adjusting your filters.'
              : 'Create your first firewall rule to control network traffic.'
          }
          action={filters.protocol === 'all' && filters.action === 'all' ? { label: 'Add Rule', onClick: openAdd } : undefined}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Pri</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Protocol</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Dest</TableHead>
                    <TableHead>Port</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead className="w-16">On</TableHead>
                    <TableHead className="w-28 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRules.map((rule) => (
                    <TableRow key={rule.id} className={cn(!rule.enabled && 'opacity-50')}>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => moveRule(rule.id, 'up')}
                              >
                                <ArrowUp className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Move Up</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => moveRule(rule.id, 'down')}
                              >
                                <ArrowDown className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Move Down</TooltipContent>
                          </Tooltip>
                          <span className="ml-1 font-mono text-xs font-bold">{rule.priority}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <span className="font-medium text-sm">{rule.name}</span>
                          {rule.comment && (
                            <p className="text-xs text-muted-foreground truncate max-w-40">{rule.comment}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs font-mono">
                          {rule.protocol.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{rule.sourceIp || '—'}</TableCell>
                      <TableCell className="font-mono text-xs">{rule.destIp || '—'}</TableCell>
                      <TableCell className="font-mono text-xs">{rule.destPort || '—'}</TableCell>
                      <TableCell>
                        <ActionBadge action={rule.action} />
                      </TableCell>
                      <TableCell>
                        <Switch checked={rule.enabled} onCheckedChange={() => toggleRule(rule.id)} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(rule)}>
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive"
                                onClick={() => setDeleteId(rule.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingRule ? 'Edit Rule' : 'Add Firewall Rule'}</DialogTitle>
            <DialogDescription>
              {editingRule ? 'Modify the existing firewall rule.' : 'Create a new custom firewall rule.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Rule Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Allow PMS Access"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Protocol</Label>
                <Select value={form.protocol} onValueChange={(v) => setForm((p) => ({ ...p, protocol: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tcp">TCP</SelectItem>
                    <SelectItem value="udp">UDP</SelectItem>
                    <SelectItem value="icmp">ICMP</SelectItem>
                    <SelectItem value="all">All</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Action</Label>
                <Select value={form.action} onValueChange={(v) => setForm((p) => ({ ...p, action: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="accept">Accept</SelectItem>
                    <SelectItem value="drop">Drop</SelectItem>
                    <SelectItem value="reject">Reject</SelectItem>
                    <SelectItem value="log">Log</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Source IP / CIDR</Label>
                <Input
                  value={form.sourceIp}
                  onChange={(e) => setForm((p) => ({ ...p, sourceIp: e.target.value }))}
                  placeholder="e.g. 10.0.0.0/24"
                />
              </div>
              <div className="space-y-2">
                <Label>Dest IP / CIDR</Label>
                <Input
                  value={form.destIp}
                  onChange={(e) => setForm((p) => ({ ...p, destIp: e.target.value }))}
                  placeholder="e.g. 10.0.0.50"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Destination Port</Label>
              <Input
                value={form.destPort}
                onChange={(e) => setForm((p) => ({ ...p, destPort: e.target.value }))}
                placeholder="e.g. 5432 or 8000-9000"
              />
            </div>
            <div className="space-y-2">
              <Label>Comment</Label>
              <Input
                value={form.comment}
                onChange={(e) => setForm((p) => ({ ...p, comment: e.target.value }))}
                placeholder="Optional description"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Enabled</Label>
              <Switch checked={form.enabled} onCheckedChange={(c) => setForm((p) => ({ ...p, enabled: c }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveRule} disabled={!form.name.trim() || saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingRule ? 'Update' : 'Create'} Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Rule</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this firewall rule? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteRule} className="bg-destructive text-white hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Tab 2: Port Forwarding ─────────────────────────────────────────

function PortForwardTab() {
  const { toast } = useToast();
  const [forwards, setForwards] = useState<PortForward[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFwd, setEditingFwd] = useState<PortForward | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    protocol: 'tcp',
    externalPort: '',
    internalIp: '',
    internalPort: '',
    sourceIp: '',
    enabled: true,
  });

  const fetchForwards = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch<PortForward[]>(`${API_BASE}/port-forwards`);
      if (res.success && res.data) setForwards(res.data);
    } catch {
      toast({ title: 'Error', description: 'Failed to load port forwards', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchForwards();
  }, [fetchForwards]);

  const openAdd = () => {
    setEditingFwd(null);
    setForm({ name: '', protocol: 'tcp', externalPort: '', internalIp: '', internalPort: '', sourceIp: '', enabled: true });
    setDialogOpen(true);
  };

  const openEdit = (f: PortForward) => {
    setEditingFwd(f);
    setForm({
      name: f.name,
      protocol: f.protocol,
      externalPort: String(f.externalPort),
      internalIp: f.internalIp,
      internalPort: String(f.internalPort),
      sourceIp: f.sourceIp || '',
      enabled: f.enabled,
    });
    setDialogOpen(true);
  };

  const saveForward = async () => {
    if (!form.name.trim() || !form.externalPort || !form.internalIp || !form.internalPort) {
      toast({ title: 'Validation Error', description: 'Name, ports, and internal IP are required', variant: 'destructive' });
      return;
    }
    try {
      setSaving(true);
      const body = {
        ...form,
        externalPort: parseInt(form.externalPort, 10),
        internalPort: parseInt(form.internalPort, 10),
      };
      if (editingFwd) {
        await apiFetch(`${API_BASE}/port-forwards/${editingFwd.id}`, { method: 'PUT', body: JSON.stringify(body) });
        toast({ title: 'Port Forward Updated', description: `${form.name} has been updated.` });
      } else {
        await apiFetch(`${API_BASE}/port-forwards`, { method: 'POST', body: JSON.stringify(body) });
        toast({ title: 'Port Forward Created', description: `${form.name} has been created.` });
      }
      setDialogOpen(false);
      await fetchForwards();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to save port forward';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const deleteForward = async () => {
    if (!deleteId) return;
    try {
      await apiFetch(`${API_BASE}/port-forwards/${deleteId}`, { method: 'DELETE' });
      toast({ title: 'Port Forward Deleted' });
      await fetchForwards();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to delete';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setDeleteId(null);
    }
  };

  const toggleForward = async (id: string) => {
    const fwd = forwards.find((f) => f.id === id);
    if (!fwd) return;
    try {
      await apiFetch(`${API_BASE}/port-forwards/${id}/toggle`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: !fwd.enabled }),
      });
      setForwards(forwards.map((f) => (f.id === id ? { ...f, enabled: !fwd.enabled } : f)));
    } catch {
      toast({ title: 'Error', description: 'Failed to toggle port forward', variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-40" />
        </div>
        <TableSkeleton cols={7} rows={4} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Route className="h-4 w-4" />
          {forwards.length} port forward{forwards.length !== 1 ? 's' : ''} configured
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchForwards}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={openAdd} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Port Forward
          </Button>
        </div>
      </div>

      {/* Table */}
      {forwards.length === 0 ? (
        <EmptyState
          icon={Route}
          title="No port forwarding rules"
          description="Set up port forwarding to route external traffic to internal services like RDP, CCTV, or PMS."
          action={{ label: 'Add Port Forward', onClick: openAdd }}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Protocol</TableHead>
                    <TableHead>Ext Port</TableHead>
                    <TableHead>Internal IP</TableHead>
                    <TableHead>Int Port</TableHead>
                    <TableHead>Source Restriction</TableHead>
                    <TableHead className="w-16">On</TableHead>
                    <TableHead className="w-24 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {forwards.map((fwd) => (
                    <TableRow key={fwd.id} className={cn(!fwd.enabled && 'opacity-50')}>
                      <TableCell className="font-medium text-sm">{fwd.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs font-mono">{fwd.protocol.toUpperCase()}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{fwd.externalPort}</TableCell>
                      <TableCell className="font-mono text-sm">{fwd.internalIp}</TableCell>
                      <TableCell className="font-mono text-sm">{fwd.internalPort}</TableCell>
                      <TableCell className="font-mono text-xs">{fwd.sourceIp || '—'}</TableCell>
                      <TableCell>
                        <Switch checked={fwd.enabled} onCheckedChange={() => toggleForward(fwd.id)} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(fwd)}>
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive"
                                onClick={() => setDeleteId(fwd.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingFwd ? 'Edit Port Forward' : 'Add Port Forward'}</DialogTitle>
            <DialogDescription>
              Configure DNAT port forwarding rule for external-to-internal traffic routing.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. RDP to Front Desk"
              />
            </div>
            <div className="space-y-2">
              <Label>Protocol</Label>
              <Select value={form.protocol} onValueChange={(v) => setForm((p) => ({ ...p, protocol: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tcp">TCP</SelectItem>
                  <SelectItem value="udp">UDP</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>External Port *</Label>
                <Input
                  type="number"
                  value={form.externalPort}
                  onChange={(e) => setForm((p) => ({ ...p, externalPort: e.target.value }))}
                  placeholder="e.g. 3389"
                />
              </div>
              <div className="space-y-2">
                <Label>Internal Port *</Label>
                <Input
                  type="number"
                  value={form.internalPort}
                  onChange={(e) => setForm((p) => ({ ...p, internalPort: e.target.value }))}
                  placeholder="e.g. 3389"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Internal IP *</Label>
              <Input
                value={form.internalIp}
                onChange={(e) => setForm((p) => ({ ...p, internalIp: e.target.value }))}
                placeholder="e.g. 10.0.0.50"
              />
            </div>
            <div className="space-y-2">
              <Label>Source IP Restriction (optional)</Label>
              <Input
                value={form.sourceIp}
                onChange={(e) => setForm((p) => ({ ...p, sourceIp: e.target.value }))}
                placeholder="e.g. 203.0.113.0/24"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Enabled</Label>
              <Switch checked={form.enabled} onCheckedChange={(c) => setForm((p) => ({ ...p, enabled: c }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveForward} disabled={!form.name.trim() || !form.externalPort || !form.internalIp || !form.internalPort || saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingFwd ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Port Forward</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this port forwarding rule? External traffic will no longer be routed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteForward} className="bg-destructive text-white hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Tab 3: Rate Limiting ───────────────────────────────────────────

function RateLimitTab() {
  const { toast } = useToast();
  const [limits, setLimits] = useState<RateLimit[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLimit, setEditingLimit] = useState<RateLimit | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    targetIp: '',
    downloadRate: '5mbit',
    uploadRate: '2mbit',
    protocol: 'all',
    enabled: true,
  });

  const fetchLimits = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch<RateLimit[]>(`${API_BASE}/rate-limits`);
      if (res.success && res.data) setLimits(res.data);
    } catch {
      toast({ title: 'Error', description: 'Failed to load rate limits', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchLimits();
  }, [fetchLimits]);

  const openAdd = () => {
    setEditingLimit(null);
    setForm({ name: '', targetIp: '', downloadRate: '5mbit', uploadRate: '2mbit', protocol: 'all', enabled: true });
    setDialogOpen(true);
  };

  const openEdit = (l: RateLimit) => {
    setEditingLimit(l);
    setForm({
      name: l.name,
      targetIp: l.targetIp,
      downloadRate: l.downloadRate,
      uploadRate: l.uploadRate,
      protocol: l.protocol,
      enabled: l.enabled,
    });
    setDialogOpen(true);
  };

  const saveLimit = async () => {
    if (!form.name.trim() || !form.targetIp.trim()) {
      toast({ title: 'Validation Error', description: 'Name and target IP/CIDR are required', variant: 'destructive' });
      return;
    }
    try {
      setSaving(true);
      if (editingLimit) {
        await apiFetch(`${API_BASE}/rate-limits/${editingLimit.id}`, { method: 'PUT', body: JSON.stringify(form) });
        toast({ title: 'Rate Limit Updated', description: `${form.name} has been updated.` });
      } else {
        await apiFetch(`${API_BASE}/rate-limits`, { method: 'POST', body: JSON.stringify(form) });
        toast({ title: 'Rate Limit Created', description: `${form.name} has been created.` });
      }
      setDialogOpen(false);
      await fetchLimits();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to save rate limit';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const deleteLimit = async () => {
    if (!deleteId) return;
    try {
      await apiFetch(`${API_BASE}/rate-limits/${deleteId}`, { method: 'DELETE' });
      toast({ title: 'Rate Limit Deleted' });
      await fetchLimits();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to delete';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setDeleteId(null);
    }
  };

  const toggleLimit = async (id: string) => {
    const limit = limits.find((l) => l.id === id);
    if (!limit) return;
    try {
      await apiFetch(`${API_BASE}/rate-limits/${id}/toggle`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: !limit.enabled }),
      });
      setLimits(limits.map((l) => (l.id === id ? { ...l, enabled: !limit.enabled } : l)));
    } catch {
      toast({ title: 'Error', description: 'Failed to toggle rate limit', variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-40" />
        </div>
        <TableSkeleton cols={6} rows={4} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Gauge className="h-4 w-4" />
          {limits.length} rate limit{limits.length !== 1 ? 's' : ''} configured
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchLimits}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={openAdd} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Rate Limit
          </Button>
        </div>
      </div>

      {/* Table */}
      {limits.length === 0 ? (
        <EmptyState
          icon={Gauge}
          title="No rate limits"
          description="Control bandwidth usage per IP or subnet for guests, IoT devices, or specific networks."
          action={{ label: 'Add Rate Limit', onClick: openAdd }}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Target IP/CIDR</TableHead>
                    <TableHead>Download</TableHead>
                    <TableHead>Upload</TableHead>
                    <TableHead>Protocol</TableHead>
                    <TableHead className="w-16">On</TableHead>
                    <TableHead className="w-24 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {limits.map((limit) => (
                    <TableRow key={limit.id} className={cn(!limit.enabled && 'opacity-50')}>
                      <TableCell className="font-medium text-sm">{limit.name}</TableCell>
                      <TableCell className="font-mono text-sm">{limit.targetIp}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <ArrowDown className="h-3 w-3 text-emerald-500" />
                          <span className="text-sm font-mono">{limit.downloadRate}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <ArrowUp className="h-3 w-3 text-blue-500" />
                          <span className="text-sm font-mono">{limit.uploadRate}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs font-mono">{limit.protocol.toUpperCase()}</Badge>
                      </TableCell>
                      <TableCell>
                        <Switch checked={limit.enabled} onCheckedChange={() => toggleLimit(limit.id)} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(limit)}>
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive"
                                onClick={() => setDeleteId(limit.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingLimit ? 'Edit Rate Limit' : 'Add Rate Limit'}</DialogTitle>
            <DialogDescription>
              Configure bandwidth limits for a specific IP address or subnet.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Limit IoT devices"
              />
            </div>
            <div className="space-y-2">
              <Label>Target IP/CIDR *</Label>
              <Input
                value={form.targetIp}
                onChange={(e) => setForm((p) => ({ ...p, targetIp: e.target.value }))}
                placeholder="e.g. 10.0.2.0/24"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Download Rate</Label>
                <Select value={form.downloadRate} onValueChange={(v) => setForm((p) => ({ ...p, downloadRate: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RATE_PRESETS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Upload Rate</Label>
                <Select value={form.uploadRate} onValueChange={(v) => setForm((p) => ({ ...p, uploadRate: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RATE_PRESETS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Protocol</Label>
              <Select value={form.protocol} onValueChange={(v) => setForm((p) => ({ ...p, protocol: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="tcp">TCP</SelectItem>
                  <SelectItem value="udp">UDP</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label>Enabled</Label>
              <Switch checked={form.enabled} onCheckedChange={(c) => setForm((p) => ({ ...p, enabled: c }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveLimit} disabled={!form.name.trim() || !form.targetIp.trim() || saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingLimit ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Rate Limit</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this bandwidth limit?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteLimit} className="bg-destructive text-white hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Tab 4: Quick Block ─────────────────────────────────────────────

function QuickBlockTab() {
  const { toast } = useToast();
  const [blocks, setBlocks] = useState<QuickBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [blocking, setBlocking] = useState(false);
  const [type, setType] = useState('ip');
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchBlocks = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch<QuickBlock[]>(`${API_BASE}/quick-blocks`);
      if (res.success && res.data) setBlocks(res.data);
    } catch {
      toast({ title: 'Error', description: 'Failed to load quick blocks', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchBlocks();
  }, [fetchBlocks]);

  const handleBlock = async () => {
    if (!value.trim()) {
      toast({ title: 'Validation Error', description: 'Please enter a value to block', variant: 'destructive' });
      return;
    }
    try {
      setBlocking(true);
      await apiFetch(`${API_BASE}/quick-blocks`, {
        method: 'POST',
        body: JSON.stringify({ type, value: value.trim(), reason: reason.trim() || 'Manual block' }),
      });
      toast({ title: 'Blocked', description: `${type.toUpperCase()} ${value} has been blocked.` });
      setValue('');
      setReason('');
      await fetchBlocks();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to block';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setBlocking(false);
    }
  };

  const unblock = async () => {
    if (!deleteId) return;
    try {
      await apiFetch(`${API_BASE}/quick-blocks/${deleteId}`, { method: 'DELETE' });
      toast({ title: 'Unblocked', description: 'Block has been removed.' });
      await fetchBlocks();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to unblock';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setDeleteId(null);
    }
  };

  const typePlaceholder: Record<string, string> = {
    ip: 'e.g. 103.21.44.5',
    subnet: 'e.g. 198.51.100.0/24',
    mac: 'e.g. AA:BB:CC:DD:EE:FF',
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-lg" />
        <TableSkeleton cols={5} rows={4} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quick Add Form */}
      <Card className="border-teal-200 bg-teal-50/30 dark:bg-teal-950/10 dark:border-teal-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Ban className="h-4 w-4 text-teal-600" />
            Quick Block
          </CardTitle>
          <CardDescription>
            Instantly block an IP address, subnet, or MAC address from accessing the network.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="w-full sm:w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ip">IP</SelectItem>
                <SelectItem value="subnet">Subnet</SelectItem>
                <SelectItem value="mac">MAC</SelectItem>
              </SelectContent>
            </Select>
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={typePlaceholder[type]}
              className="flex-1"
              onKeyDown={(e) => e.key === 'Enter' && handleBlock()}
            />
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason (optional)"
              className="flex-1"
              onKeyDown={(e) => e.key === 'Enter' && handleBlock()}
            />
            <Button onClick={handleBlock} disabled={blocking || !value.trim()}>
              {blocking ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Ban className="h-4 w-4 mr-2" />}
              Block
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Blocks */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <ShieldBan className="h-4 w-4 text-muted-foreground" />
          Recent Blocks
          <Badge variant="secondary" className="text-xs">{blocks.length}</Badge>
        </h3>
        <Button variant="outline" size="sm" onClick={fetchBlocks}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {blocks.length === 0 ? (
        <EmptyState
          icon={ShieldBan}
          title="No active blocks"
          description="Blocked IPs, subnets, and MAC addresses will appear here. Use the form above to add one."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Blocked At</TableHead>
                    <TableHead className="w-24 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {blocks.map((block) => (
                    <TableRow key={block.id}>
                      <TableCell>
                        <BlockTypeBadge type={block.type} />
                      </TableCell>
                      <TableCell className="font-mono text-sm">{block.value}</TableCell>
                      <TableCell className="text-sm">{block.reason}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {block.blockedAt ? new Date(block.blockedAt).toLocaleString() : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-teal-600 hover:text-teal-700 hover:bg-teal-50"
                              onClick={() => setDeleteId(block.id)}
                            >
                              <Unlock className="h-3.5 w-3.5 mr-1" />
                              Unblock
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Remove block</TooltipContent>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Unblock Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unblock Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this block? The entry will be able to access the network again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={unblock}>
              Unblock
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Tab 5: Schedules ───────────────────────────────────────────────

function SchedulesTab() {
  const { toast } = useToast();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);

  const [form, setForm] = useState({
    name: '',
    days: [true, true, true, true, true, false, false],
    startTime: '09:00',
    endTime: '18:00',
    enabled: true,
  });

  const fetchSchedules = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/wifi/firewall/schedules');
      if (res.ok) {
        const result = await res.json();
        if (result.success && result.data) {
          setSchedules(result.data);
        }
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to load schedules', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  const openAdd = () => {
    setEditingSchedule(null);
    setForm({ name: '', days: [true, true, true, true, true, false, false], startTime: '09:00', endTime: '18:00', enabled: true });
    setDialogOpen(true);
  };

  const openEdit = (s: Schedule) => {
    setEditingSchedule(s);
    const daysArr = typeof s.days === 'string'
      ? s.days.split(',').map((d) => d === '1')
      : Array.isArray(s.days)
        ? s.days
        : [true, true, true, true, true, false, false];
    setForm({
      name: s.name,
      days: daysArr.length === 7 ? daysArr : [true, true, true, true, true, false, false],
      startTime: s.startTime || '09:00',
      endTime: s.endTime || '18:00',
      enabled: s.enabled,
    });
    setDialogOpen(true);
  };

  const saveSchedule = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Validation Error', description: 'Schedule name is required', variant: 'destructive' });
      return;
    }
    try {
      setSaving(true);
      const body = {
        ...form,
        days: form.days.join(','),
      };
      if (editingSchedule) {
        const res = await fetch(`/api/wifi/firewall/schedules/${editingSchedule.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          toast({ title: 'Schedule Updated', description: `${form.name} has been updated.` });
        } else {
          const err = await res.json();
          throw new Error(err.error?.message || 'Update failed');
        }
      } else {
        const res = await fetch('/api/wifi/firewall/schedules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          toast({ title: 'Schedule Created', description: `${form.name} has been created.` });
        } else {
          const err = await res.json();
          throw new Error(err.error?.message || 'Create failed');
        }
      }
      setDialogOpen(false);
      await fetchSchedules();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to save schedule';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const toggleDay = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      days: prev.days.map((d, i) => (i === idx ? !d : d)),
    }));
  };

  const isScheduleActiveNow = (schedule: Schedule) => {
    if (!schedule.enabled) return false;
    const now = new Date();
    const dayOfWeek = now.getDay();
    // JS: 0=Sun, 1=Mon... our array: [Mon, Tue, Wed, Thu, Fri, Sat, Sun]
    const mappedDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const daysArr = typeof schedule.days === 'string'
      ? schedule.days.split(',').map((d) => d === '1')
      : Array.isArray(schedule.days) ? schedule.days : [true, true, true, true, true, false, false];
    if (!daysArr[mappedDay]) return false;
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    return currentTime >= (schedule.startTime || '00:00') && currentTime <= (schedule.endTime || '23:59');
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-40" />
        </div>
        <TableSkeleton cols={5} rows={3} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Timer className="h-4 w-4" />
          Time-based rule scheduling (linking to rules coming soon)
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchSchedules}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={openAdd} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Schedule
          </Button>
        </div>
      </div>

      {/* Table */}
      {schedules.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="No schedules"
          description="Create time-based schedules to automatically enable or disable firewall rules at specific times."
          action={{ label: 'Add Schedule', onClick: openAdd }}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Days</TableHead>
                    <TableHead>Start Time</TableHead>
                    <TableHead>End Time</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Linked Rules</TableHead>
                    <TableHead className="w-24 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedules.map((schedule) => {
                    const activeNow = isScheduleActiveNow(schedule);
                    const daysArr = typeof schedule.days === 'string'
                      ? schedule.days.split(',').map((d) => (d === '1' ? DAY_LABELS : '·'))
                      : Array.isArray(schedule.days)
                        ? schedule.days.map((d, i) => (d ? DAY_LABELS[i] : '·'))
                        : DAY_LABELS;
                    return (
                      <TableRow key={schedule.id}>
                        <TableCell className="font-medium text-sm">{schedule.name}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {daysArr.map((d, i) => (
                              <span
                                key={i}
                                className={cn(
                                  'text-xs px-1.5 py-0.5 rounded font-mono',
                                  d !== '·' ? 'bg-muted text-foreground' : 'text-muted-foreground/40'
                                )}
                              >
                                {d}
                              </span>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{schedule.startTime || '—'}</TableCell>
                        <TableCell className="font-mono text-sm">{schedule.endTime || '—'}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-xs',
                              activeNow
                                ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                : schedule.enabled
                                  ? 'bg-amber-100 text-amber-700 border-amber-200'
                                  : 'bg-gray-100 text-gray-500 border-gray-200'
                            )}
                          >
                            {activeNow ? 'Active' : schedule.enabled ? 'Scheduled' : 'Disabled'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {schedule.linkedRules ?? 0} rules
                        </TableCell>
                        <TableCell className="text-right">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(schedule)}>
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit</TooltipContent>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingSchedule ? 'Edit Schedule' : 'Add Schedule'}</DialogTitle>
            <DialogDescription>
              Define a time window for rule activation. Days are Mon through Sun.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Schedule Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Business Hours"
              />
            </div>
            <div className="space-y-2">
              <Label>Active Days</Label>
              <div className="flex gap-2">
                {DAY_LABELS.map((day, idx) => (
                  <Button
                    key={day}
                    variant={form.days[idx] ? 'default' : 'outline'}
                    size="sm"
                    className="w-12"
                    onClick={() => toggleDay(idx)}
                  >
                    {day}
                  </Button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Input
                  type="time"
                  value={form.startTime}
                  onChange={(e) => setForm((p) => ({ ...p, startTime: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <Input
                  type="time"
                  value={form.endTime}
                  onChange={(e) => setForm((p) => ({ ...p, endTime: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label>Enabled</Label>
              <Switch checked={form.enabled} onCheckedChange={(c) => setForm((p) => ({ ...p, enabled: c }))} />
            </div>
            <p className="text-xs text-muted-foreground">
              Schedule-to-rule attachment will be available in a future update.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveSchedule} disabled={!form.name.trim() || saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingSchedule ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Tab 6: Presets ─────────────────────────────────────────────────

function PresetsTab() {
  const { toast } = useToast();
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(true);
  const [applyId, setApplyId] = useState<string | null>(null);
  const [sourceIp, setSourceIp] = useState('');
  const [applying, setApplying] = useState(false);

  const fetchPresets = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch<Preset[]>(`${API_BASE}/presets`);
      if (res.success && res.data) setPresets(res.data);
    } catch {
      toast({ title: 'Error', description: 'Failed to load presets', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchPresets();
  }, [fetchPresets]);

  const applyPreset = async () => {
    if (!applyId) return;
    try {
      setApplying(true);
      const res = await apiFetch<{ message: string }>(`${API_BASE}/presets/${applyId}/apply`, {
        method: 'POST',
        body: JSON.stringify({ sourceIp: sourceIp.trim() || undefined }),
      });
      toast({ title: 'Preset Applied', description: res.data?.message || 'Preset has been applied successfully.' });
      setApplyId(null);
      setSourceIp('');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to apply preset';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setApplying(false);
    }
  };

  const selectedPreset = presets.find((p) => p.id === applyId);

  const categoryIcons: Record<string, React.ElementType> = {
    networking: Network,
    'remote-access': Globe,
    security: Lock,
    'content-filter': ShieldAlert,
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-48" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-9 w-20" />
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LayoutGrid className="h-4 w-4" />
          {presets.length} preset templates available
        </div>
        <Button variant="outline" size="sm" onClick={fetchPresets}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Preset Cards Grid */}
      {presets.length === 0 ? (
        <EmptyState
          icon={LayoutGrid}
          title="No presets available"
          description="Preset templates will appear here when the nftables-service is running."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {presets.map((preset) => {
            const Icon = categoryIcons[preset.category] || Shield;
            return (
              <Card
                key={preset.id}
                className="transition-all hover:shadow-md hover:border-teal-300 dark:hover:border-teal-700"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-muted">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <CardTitle className="text-base">{preset.name}</CardTitle>
                    </div>
                    <CategoryBadge category={preset.category} />
                  </div>
                  <CardDescription className="mt-2">{preset.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">
                      {preset.rules.length} rule{preset.rules.length !== 1 ? 's' : ''}
                    </div>
                    <Button size="sm" onClick={() => setApplyId(preset.id)}>
                      <Zap className="h-3.5 w-3.5 mr-1" />
                      Apply
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Apply Preset Dialog */}
      <Dialog open={!!applyId} onOpenChange={() => { setApplyId(null); setSourceIp(''); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Apply Preset</DialogTitle>
            <DialogDescription>
              Review and apply the selected preset template.
            </DialogDescription>
          </DialogHeader>
          {selectedPreset && (
            <div className="space-y-4 py-4">
              <div className="space-y-3 p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{selectedPreset.name}</span>
                  <CategoryBadge category={selectedPreset.category} />
                </div>
                <p className="text-sm text-muted-foreground">{selectedPreset.description}</p>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Rules to be created:</p>
                  {selectedPreset.rules.map((rule, i) => (
                    <div key={i} className="text-xs font-mono text-muted-foreground flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{rule.protocol.toUpperCase()}</Badge>
                      <span>port {rule.destPort}</span>
                      <ActionBadge action={rule.action} />
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Source IP (optional)</Label>
                <Input
                  value={sourceIp}
                  onChange={(e) => setSourceIp(e.target.value)}
                  placeholder="e.g. 10.0.0.50"
                />
                <p className="text-xs text-muted-foreground">
                  Restrict these rules to a specific source IP or CIDR. Leave empty for any source.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setApplyId(null); setSourceIp(''); }}>
              Cancel
            </Button>
            <Button onClick={applyPreset} disabled={applying}>
              {applying && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Zap className="h-4 w-4 mr-2" />
              Confirm Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
