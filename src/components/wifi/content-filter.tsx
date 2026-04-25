'use client';

/**
 * Content Filter Component
 *
 * Content filtering management for guest WiFi networks.
 * Supports category presets, custom patterns, block/allow rules, test URL.
 * Uses ContentFilter model from schema.
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
  Shield,
  Plus,
  Trash2,
  Edit,
  Loader2,
  RefreshCw,
  Search,
  ShieldBan,
  ShieldCheck,
  Filter,
  TestTube,
  CheckCircle,
  XCircle,
  Zap,
  Globe,
  AlertTriangle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface ContentFilterRule {
  id: string;
  category: string;
  pattern: string;
  action: 'block' | 'allow';
  enabled: boolean;
  hitCount: number;
  createdAt?: string;
  updatedAt?: string;
}

// ─── Category Presets ──────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: 'adult', label: 'Adult Content', color: 'bg-red-500' },
  { value: 'malware', label: 'Malware', color: 'bg-red-600' },
  { value: 'phishing', label: 'Phishing', color: 'bg-orange-500' },
  { value: 'social-media', label: 'Social Media', color: 'bg-sky-500' },
  { value: 'streaming', label: 'Streaming', color: 'bg-violet-500' },
  { value: 'gambling', label: 'Gambling', color: 'bg-amber-600' },
  { value: 'custom', label: 'Custom', color: 'bg-gray-500' },
];

const PRESET_PATTERNS: Record<string, string[]> = {
  adult: ['*.adult.com', '*.xxx', '*.pornhub.com', '*.xvideos.com'],
  malware: ['*.malware-site.com', '*.phishing-domain.com', '*.trojan-download.com'],
  phishing: ['*.phishing-login.com', '*.fake-bank.com', '*.credential-harvest.com'],
  'social-media': ['*.facebook.com', '*.instagram.com', '*.twitter.com', '*.tiktok.com', '*.snapchat.com'],
  streaming: ['*.netflix.com', '*.youtube.com', '*.hulu.com', '*.disneyplus.com', '*.twitch.tv'],
  gambling: ['*.bet365.com', '*.pokerstars.com', '*.casino.com', '*.888.com'],
};

// ─── Component ──────────────────────────────────────────────────────────────────

export default function ContentFilter() {
  const { toast } = useToast();
  const [rules, setRules] = useState<ContentFilterRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ContentFilterRule | null>(null);
  const [savingRule, setSavingRule] = useState(false);
  const [deleteRuleId, setDeleteRuleId] = useState<string | null>(null);

  // Test URL
  const [testUrl, setTestUrl] = useState('');
  const [testResult, setTestResult] = useState<{ matched: boolean; rule?: ContentFilterRule } | null>(null);
  const [testingUrl, setTestingUrl] = useState(false);

  // Form
  const [form, setForm] = useState({
    category: 'custom',
    pattern: '',
    action: 'block' as 'block' | 'allow',
    enabled: true,
  });

  // ─── Fetch ──────────────────────────────────────────────────────────────────

  const fetchRules = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/wifi/radius?action=content-filters');
      const data = await res.json();
      if (data.success && data.data) {
        setRules(Array.isArray(data.data) ? data.data : []);
      } else {
        setRules([]);
      }
    } catch (error) {
      console.error('Failed to fetch content filters:', error);
      setRules([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  // ─── Form Helpers ───────────────────────────────────────────────────────────

  const resetForm = () => {
    setForm({ category: 'custom', pattern: '', action: 'block', enabled: true });
    setEditingRule(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (rule: ContentFilterRule) => {
    setEditingRule(rule);
    setForm({
      category: rule.category,
      pattern: rule.pattern,
      action: rule.action,
      enabled: rule.enabled,
    });
    setDialogOpen(true);
  };

  // ─── CRUD ───────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!form.pattern.trim()) {
      toast({ title: 'Error', description: 'Pattern/domain is required', variant: 'destructive' });
      return;
    }

    setSavingRule(true);
    try {
      const action = editingRule ? 'update-content-filter' : 'create-content-filter';
      const body = editingRule ? { id: editingRule.id, ...form } : form;

      const res = await fetch('/api/wifi/radius', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...body }),
      });
      const data = await res.json();

      if (data.success) {
        toast({ title: 'Success', description: `Filter rule ${editingRule ? 'updated' : 'created'}` });
        setDialogOpen(false);
        resetForm();
        fetchRules();
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to save rule', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to save rule', variant: 'destructive' });
    } finally {
      setSavingRule(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteRuleId) return;
    try {
      const res = await fetch('/api/wifi/radius', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete-content-filter', id: deleteRuleId }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'Success', description: 'Filter rule deleted' });
        fetchRules();
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to delete', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to delete', variant: 'destructive' });
    } finally {
      setDeleteRuleId(null);
    }
  };

  // ─── Toggle ─────────────────────────────────────────────────────────────────

  const handleToggle = async (rule: ContentFilterRule) => {
    try {
      const res = await fetch('/api/wifi/radius', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle-content-filter', id: rule.id, enabled: !rule.enabled }),
      });
      const data = await res.json();
      if (data.success) {
        fetchRules();
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to toggle', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to toggle rule', variant: 'destructive' });
    }
  };

  // ─── Apply Preset ───────────────────────────────────────────────────────────

  const handleApplyPreset = async (category: string) => {
    const patterns = PRESET_PATTERNS[category];
    if (!patterns) return;
    setSavingRule(true);
    try {
      const res = await fetch('/api/wifi/radius', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'apply-content-filter-preset', category, patterns, filterAction: 'block' }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'Preset Applied', description: `Added ${patterns.length} ${category} filter rules` });
        fetchRules();
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to apply preset', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to apply preset', variant: 'destructive' });
    } finally {
      setSavingRule(false);
    }
  };

  // ─── Test URL ───────────────────────────────────────────────────────────────

  const handleTestUrl = async () => {
    if (!testUrl.trim()) return;
    setTestingUrl(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/wifi/radius?action=test-content-filter&url=${encodeURIComponent(testUrl.trim())}`);
      const data = await res.json();
      setTestResult({
        matched: data.success && data.data?.matched ? true : false,
        rule: data.data?.rule,
      });
    } catch {
      setTestResult({ matched: false });
    } finally {
      setTestingUrl(false);
    }
  };

  // ─── Filtering ──────────────────────────────────────────────────────────────

  const filteredRules = rules.filter(r => {
    if (categoryFilter !== 'all' && r.category !== categoryFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return r.pattern.toLowerCase().includes(q) || r.category.toLowerCase().includes(q);
    }
    return true;
  });

  const getCategoryBadge = (category: string) => {
    const cat = CATEGORIES.find(c => c.value === category);
    if (!cat) return <Badge variant="secondary">{category}</Badge>;
    return <Badge className={`${cat.color} hover:${cat.color} text-white border-0 text-xs`}>{cat.label}</Badge>;
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Content Filter
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage content filtering rules for guest WiFi networks
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchRules}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Add Rule
          </Button>
        </div>
      </div>

      {/* Presets */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-4 w-4 text-amber-500 dark:text-amber-400" />
            <p className="text-sm font-medium">Quick Apply Presets</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.filter(c => c.value !== 'custom').map(cat => (
              <Button
                key={cat.value}
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => handleApplyPreset(cat.value)}
                disabled={savingRule}
              >
                {cat.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Test URL */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground mb-1 block">Test if a URL matches any filter</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. https://example.com/page"
                  value={testUrl}
                  onChange={(e) => setTestUrl(e.target.value)}
                  className="font-mono"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleTestUrl(); }}
                />
                <Button variant="outline" onClick={handleTestUrl} disabled={testingUrl}>
                  {testingUrl ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <TestTube className="h-4 w-4 mr-2" />}
                  Test
                </Button>
              </div>
            </div>
            {testResult && (
              <div className="flex items-center gap-2 sm:mt-6">
                {testResult.matched ? (
                  <Badge className="bg-red-500 hover:bg-red-600 text-white border-0">
                    <ShieldBan className="h-3 w-3 mr-1" /> Blocked
                  </Badge>
                ) : (
                  <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0">
                    <ShieldCheck className="h-3 w-3 mr-1" /> Allowed
                  </Badge>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by pattern or category..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORIES.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredRules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted/50 p-4 mb-3">
                <Shield className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <h3 className="text-sm font-medium text-muted-foreground">No content filter rules</h3>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Add rules or apply presets to start filtering content
              </p>
            </div>
          ) : (
            <div className="max-h-[500px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Pattern / Domain</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Hits</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell>{getCategoryBadge(rule.category)}</TableCell>
                      <TableCell>
                        <p className="font-mono text-sm">{rule.pattern}</p>
                      </TableCell>
                      <TableCell>
                        {rule.action === 'block' ? (
                          <Badge className="bg-red-500 hover:bg-red-600 text-white border-0 text-xs">
                            <ShieldBan className="h-3 w-3 mr-1" /> Block
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 text-xs">
                            <ShieldCheck className="h-3 w-3 mr-1" /> Allow
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={rule.enabled}
                          onCheckedChange={() => handleToggle(rule)}
                        />
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs tabular-nums">{rule.hitCount || 0}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(rule)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setDeleteRuleId(rule.id)}>
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

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setDialogOpen(open); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingRule ? 'Edit Filter Rule' : 'Add Filter Rule'}</DialogTitle>
            <DialogDescription>
              {editingRule ? 'Update content filter rule' : 'Create a new content filtering rule'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm(prev => ({ ...prev, category: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Action</Label>
                <Select value={form.action} onValueChange={(v) => setForm(prev => ({ ...prev, action: v as 'block' | 'allow' }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="block">Block</SelectItem>
                    <SelectItem value="allow">Allow</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Pattern / Domain *</Label>
              <Input
                value={form.pattern}
                onChange={(e) => setForm(prev => ({ ...prev, pattern: e.target.value }))}
                placeholder="e.g. *.example.com or exact domain"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Use * as wildcard. Example: *.facebook.com matches all Facebook subdomains
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                checked={form.enabled}
                onCheckedChange={(checked) => setForm(prev => ({ ...prev, enabled: checked }))}
              />
              <Label>Enable this rule</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setDialogOpen(false); }}>Cancel</Button>
            <Button onClick={handleSave} disabled={savingRule}>
              {savingRule && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingRule ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteRuleId} onOpenChange={(open) => { if (!open) setDeleteRuleId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Filter Rule</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this content filter rule.
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
