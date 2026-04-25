'use client';

/**
 * Portal Whitelist / Walled Garden Component
 *
 * Hotel services captive portal bypass management.
 * Allows specific domains/URLs to bypass captive portal authentication
 * so guests can access hotel services without logging in first.
 *
 * API: /api/wifi/portal-whitelist (REST: GET/POST/PUT/DELETE)
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
  Globe,
  Plus,
  Trash2,
  Pencil,
  Loader2,
  RefreshCw,
  Search,
  Download,
  Unlock,
  Lock,
  Hotel,
  ShieldCheck,
  Info,
  ChevronDown,
  CheckCircle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { usePropertyId } from '@/hooks/use-property';
import { cn } from '@/lib/utils';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface PortalWhitelistEntry {
  id: string;
  domain: string;
  path?: string | null;
  description?: string | null;
  protocol: string;
  bypassAuth: boolean;
  status: string;
  priority: number;
  createdAt?: string;
  updatedAt?: string;
}

interface WhitelistForm {
  domain: string;
  path: string;
  description: string;
  protocol: string;
  bypassAuth: boolean;
  priority: number;
}

// ─── Hotel Service Presets ─────────────────────────────────────────────────────

const HOTEL_PRESETS: Array<{ domain: string; path: string; description: string; protocol: string; icon: string }> = [
  { domain: '*.hotel-website.com', path: '/', description: 'Hotel Website', protocol: 'https', icon: '🏨' },
  { domain: 'bookings.hotel.com', path: '/', description: 'Booking Engine', protocol: 'https', icon: '📅' },
  { domain: 'payments.stripe.com', path: '/', description: 'Payment Gateway', protocol: 'https', icon: '💳' },
  { domain: 'menu.hotel.com', path: '/', description: 'Restaurant Menu', protocol: 'https', icon: '🍽️' },
  { domain: 'spa.hotel.com', path: '/', description: 'Spa Booking', protocol: 'https', icon: '🧖' },
  { domain: 'concierge.hotel.com', path: '/', description: 'Concierge Services', protocol: 'https', icon: '🔔' },
  { domain: '*.tripadvisor.com', path: '/', description: 'TripAdvisor Reviews', protocol: 'https', icon: '⭐' },
  { domain: '*.google.com', path: '/maps', description: 'Google Maps', protocol: 'https', icon: '🗺️' },
];

// ─── Component ──────────────────────────────────────────────────────────────────

export default function PortalWhitelist() {
  const { toast } = useToast();
  const { propertyId } = usePropertyId();
  const [entries, setEntries] = useState<PortalWhitelistEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showPresetPanel, setShowPresetPanel] = useState(false);

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<PortalWhitelistEntry | null>(null);
  const [savingEntry, setSavingEntry] = useState(false);
  const [deleteEntryId, setDeleteEntryId] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState<WhitelistForm>({
    domain: '',
    path: '/',
    description: '',
    protocol: 'https',
    bypassAuth: true,
    priority: 0,
  });

  // ─── API Helpers ─────────────────────────────────────────────────────────────

  const buildUrl = (base: string, params?: Record<string, string>) => {
    const url = new URL(base, window.location.origin);
    if (propertyId) url.searchParams.set('propertyId', propertyId);
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    return url.toString();
  };

  const fetchEntries = useCallback(async () => {
    if (!propertyId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(buildUrl('/api/wifi/portal-whitelist'));
      const data = await res.json();
      if (data.success && data.data) {
        setEntries(Array.isArray(data.data) ? data.data : []);
      } else {
        setEntries([]);
      }
    } catch (error) {
      console.error('Failed to fetch portal whitelist:', error);
      setEntries([]);
    } finally {
      setIsLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // ─── Form Helpers ───────────────────────────────────────────────────────────

  const resetForm = () => {
    setForm({ domain: '', path: '/', description: '', protocol: 'https', bypassAuth: true, priority: 0 });
    setEditingEntry(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (entry: PortalWhitelistEntry) => {
    setEditingEntry(entry);
    setForm({
      domain: entry.domain,
      path: entry.path || '/',
      description: entry.description || '',
      protocol: entry.protocol,
      bypassAuth: entry.bypassAuth,
      priority: entry.priority,
    });
    setDialogOpen(true);
  };

  // ─── CRUD Operations ────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!form.domain.trim()) {
      toast({ title: 'Validation Error', description: 'Domain is required', variant: 'destructive' });
      return;
    }

    setSavingEntry(true);
    try {
      let res: Response;
      if (editingEntry) {
        // Update
        res = await fetch(buildUrl('/api/wifi/portal-whitelist'), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingEntry.id,
            domain: form.domain,
            path: form.path || null,
            description: form.description || null,
            protocol: form.protocol,
            bypassAuth: form.bypassAuth,
            priority: form.priority,
          }),
        });
      } else {
        // Create
        res = await fetch(buildUrl('/api/wifi/portal-whitelist'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            propertyId,
            domain: form.domain,
            path: form.path || null,
            description: form.description || null,
            protocol: form.protocol,
            bypassAuth: form.bypassAuth,
            priority: form.priority,
          }),
        });
      }

      const data = await res.json();
      if (data.success) {
        toast({
          title: editingEntry ? 'Entry Updated' : 'Entry Added',
          description: `${form.domain} has been ${editingEntry ? 'updated' : 'added to the whitelist'}`,
        });
        setDialogOpen(false);
        resetForm();
        fetchEntries();
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to save entry', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Network Error', description: 'Failed to save entry', variant: 'destructive' });
    } finally {
      setSavingEntry(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteEntryId) return;
    try {
      const res = await fetch(buildUrl('/api/wifi/portal-whitelist'), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deleteEntryId }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'Deleted', description: 'Whitelist entry removed' });
        fetchEntries();
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to delete', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Network Error', description: 'Failed to delete', variant: 'destructive' });
    } finally {
      setDeleteEntryId(null);
    }
  };

  const handleToggle = async (entry: PortalWhitelistEntry) => {
    const newStatus = entry.status === 'active' ? 'inactive' : 'active';
    try {
      const res = await fetch(buildUrl('/api/wifi/portal-whitelist'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: entry.id, status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'Status Updated', description: `${entry.domain} is now ${newStatus}` });
        fetchEntries();
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to update status', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Network Error', description: 'Failed to toggle status', variant: 'destructive' });
    }
  };

  // ─── Apply Preset ───────────────────────────────────────────────────────────

  const handleApplyPreset = async (preset: typeof HOTEL_PRESETS[number]) => {
    try {
      const res = await fetch(buildUrl('/api/wifi/portal-whitelist'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          domain: preset.domain,
          path: preset.path,
          description: preset.description,
          protocol: preset.protocol,
          bypassAuth: true,
          priority: 0,
          status: 'active',
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'Preset Added', description: `"${preset.description}" added to whitelist` });
        fetchEntries();
      } else {
        toast({ title: 'Already Exists', description: data.error || 'This preset may already be in the whitelist', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Network Error', description: 'Failed to add preset', variant: 'destructive' });
    }
  };

  // ─── Export DNS Config ──────────────────────────────────────────────────────

  const handleExportDns = async () => {
    try {
      const res = await fetch(buildUrl('/api/wifi/portal-whitelist', { export: 'dns' }));
      const data = await res.json();
      if (data.success && data.data) {
        const blob = new Blob([data.data], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'portal-whitelist-dns.conf';
        a.click();
        URL.revokeObjectURL(url);
        toast({ title: 'Exported', description: 'DNS configuration file downloaded' });
      } else {
        // Fallback to client-side generation
        exportFallbackDns();
      }
    } catch {
      exportFallbackDns();
    }
  };

  const exportFallbackDns = () => {
    const active = entries.filter(e => e.status === 'active');
    const config = [
      '; StaySuite Portal Whitelist - Walled Garden DNS Configuration',
      '; Generated: ' + new Date().toISOString(),
      '; Total bypass entries: ' + active.length,
      ';',
      '; Add these entries to your DNS server or firewall rules',
      '; to allow unauthenticated access to these domains.',
      '',
    ];
    active.forEach(e => {
      config.push(`; ${e.description || e.domain}`);
      config.push(`${e.domain} IN CNAME captive-portal-bypass.local`);
      config.push('');
    });
    const blob = new Blob([config.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'portal-whitelist-dns.conf';
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Exported', description: 'DNS configuration file downloaded' });
  };

  // ─── Filtering ──────────────────────────────────────────────────────────────

  const filteredEntries = entries.filter(e => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return e.domain.toLowerCase().includes(q) ||
        (e.description || '').toLowerCase().includes(q) ||
        (e.path || '').toLowerCase().includes(q);
    }
    return true;
  });

  const activeCount = entries.filter(e => e.status === 'active').length;
  const inactiveCount = entries.length - activeCount;

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Info Banner */}
      <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-800 dark:bg-blue-950/30">
        <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-blue-800 dark:text-blue-300">Walled Garden / Portal Whitelist</p>
          <p className="text-xs text-blue-700/80 dark:text-blue-400/70 mt-1">
            Domains listed here bypass captive portal authentication. Guests can access these hotel services
            (booking engine, restaurant menu, spa, etc.) without logging into WiFi first.
          </p>
        </div>
      </div>

      {/* Stats + Actions Row */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold">{entries.length}</span>
            <span className="text-sm text-muted-foreground">entries</span>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              {activeCount} active
            </span>
            {inactiveCount > 0 && (
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                {inactiveCount} inactive
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setShowPresetPanel(!showPresetPanel)}>
            <Hotel className="h-4 w-4 mr-1.5" />
            Presets
            <ChevronDown className={cn('h-3 w-3 ml-1 transition-transform', showPresetPanel && 'rotate-180')} />
          </Button>
          <Button variant="outline" size="sm" onClick={fetchEntries} disabled={isLoading}>
            <RefreshCw className={cn('h-4 w-4 mr-1.5', isLoading && 'animate-spin')} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportDns} disabled={entries.length === 0}>
            <Download className="h-4 w-4 mr-1.5" />
            Export DNS
          </Button>
          <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add Domain
          </Button>
        </div>
      </div>

      {/* Hotel Service Presets Panel */}
      {showPresetPanel && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Hotel className="h-4 w-4 text-teal-600 dark:text-teal-400" />
              <p className="text-sm font-medium">Hotel Service Presets</p>
              <span className="text-xs text-muted-foreground">— Quick-add common hotel services</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {HOTEL_PRESETS.map((preset, i) => {
                const alreadyExists = entries.some(e => e.domain === preset.domain);
                return (
                  <Button
                    key={i}
                    variant={alreadyExists ? 'ghost' : 'outline'}
                    size="sm"
                    className={cn('text-xs gap-1.5', alreadyExists && 'opacity-50 line-through')}
                    onClick={() => !alreadyExists && handleApplyPreset(preset)}
                    disabled={alreadyExists}
                  >
                    <span>{preset.icon}</span>
                    {preset.description}
                    {alreadyExists && <CheckCircle className="h-3 w-3 text-emerald-500" />}
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search domains, descriptions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Whitelist Table / Cards */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <div className="rounded-full bg-muted/50 p-4 mb-3">
                <ShieldCheck className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <h3 className="text-sm font-medium text-muted-foreground">
                {searchQuery ? 'No matching entries' : 'No whitelist entries yet'}
              </h3>
              <p className="text-xs text-muted-foreground/60 mt-1 max-w-sm">
                {searchQuery
                  ? 'Try a different search term'
                  : 'Add domains that should bypass the captive portal authentication'}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop: Table view */}
              <div className="hidden sm:block max-h-[500px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Domain</TableHead>
                      <TableHead>Path</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Protocol</TableHead>
                      <TableHead>Bypass Auth</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEntries.map((entry) => (
                      <TableRow key={entry.id} className={entry.status !== 'active' ? 'opacity-50' : ''}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <p className="font-mono text-sm font-medium">{entry.domain}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm text-muted-foreground font-mono">{entry.path || '/'}</p>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm">{entry.description || '—'}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] uppercase font-semibold">
                            {entry.protocol}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {entry.bypassAuth ? (
                            <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 text-[10px] gap-1">
                              <Unlock className="h-3 w-3" /> Bypass
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px] gap-1">
                              <Lock className="h-3 w-3" /> Require
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={entry.status === 'active'}
                            onCheckedChange={() => handleToggle(entry)}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openEdit(entry)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setDeleteEntryId(entry.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile: Card view */}
              <div className="sm:hidden divide-y">
                {filteredEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className={cn('p-4 space-y-3', entry.status !== 'active' && 'opacity-50')}
                  >
                    {/* Domain + status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                        <p className="font-mono text-sm font-medium truncate">{entry.domain}</p>
                      </div>
                      <Switch
                        checked={entry.status === 'active'}
                        onCheckedChange={() => handleToggle(entry)}
                      />
                    </div>

                    {/* Details grid */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Path:</span>
                        <span className="ml-1 font-mono">{entry.path || '/'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Protocol:</span>
                        <Badge variant="outline" className="text-[10px] uppercase ml-1">{entry.protocol}</Badge>
                      </div>
                      {entry.description && (
                        <div className="col-span-2">
                          <span className="text-muted-foreground">Description:</span>
                          <span className="ml-1">{entry.description}</span>
                        </div>
                      )}
                    </div>

                    {/* Bypass badge + actions */}
                    <div className="flex items-center justify-between">
                      {entry.bypassAuth ? (
                        <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 text-[10px] gap-1">
                          <Unlock className="h-3 w-3" /> Bypass Auth
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px] gap-1">
                          <Lock className="h-3 w-3" /> Auth Required
                        </Badge>
                      )}
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(entry)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setDeleteEntryId(entry.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setDialogOpen(open); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingEntry ? 'Edit Whitelist Entry' : 'Add Whitelist Entry'}</DialogTitle>
            <DialogDescription>
              {editingEntry
                ? 'Update domain bypass settings for the captive portal'
                : 'Add a domain that guests can access without WiFi authentication'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Domain *</Label>
              <Input
                value={form.domain}
                onChange={(e) => setForm(prev => ({ ...prev, domain: e.target.value }))}
                placeholder="e.g. booking.hotel.com or *.example.com"
                className="font-mono"
              />
              <p className="text-[10px] text-muted-foreground">
                Use *.domain.com for wildcard matching of all subdomains
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Path</Label>
                <Input
                  value={form.path}
                  onChange={(e) => setForm(prev => ({ ...prev, path: e.target.value }))}
                  placeholder="/"
                  className="font-mono"
                />
                <p className="text-[10px] text-muted-foreground">Leave / for all paths</p>
              </div>
              <div className="space-y-2">
                <Label>Protocol</Label>
                <Select value={form.protocol} onValueChange={(v) => setForm(prev => ({ ...prev, protocol: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="https">HTTPS</SelectItem>
                    <SelectItem value="http">HTTP</SelectItem>
                    <SelectItem value="both">Both (HTTP + HTTPS)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="e.g. Hotel booking engine"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Input
                  type="number"
                  value={form.priority}
                  onChange={(e) => setForm(prev => ({ ...prev, priority: parseInt(e.target.value) || 0 }))}
                  placeholder="0"
                />
                <p className="text-[10px] text-muted-foreground">Higher = matched first</p>
              </div>
              <div className="flex items-end space-x-2 pb-1">
                <Switch
                  checked={form.bypassAuth}
                  onCheckedChange={(checked) => setForm(prev => ({ ...prev, bypassAuth: checked }))}
                />
                <Label className="text-sm">Bypass authentication</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setDialogOpen(false); }}>Cancel</Button>
            <Button onClick={handleSave} disabled={savingEntry} className="bg-teal-600 hover:bg-teal-700 text-white">
              {savingEntry && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingEntry ? 'Update' : 'Add Entry'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteEntryId} onOpenChange={(open) => { if (!open) setDeleteEntryId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from Whitelist?</AlertDialogTitle>
            <AlertDialogDescription>
              This domain will no longer bypass the captive portal. Guests will need to authenticate
              via WiFi login before accessing it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


