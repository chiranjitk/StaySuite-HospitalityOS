'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Network, Play, Square, RotateCw, RefreshCw, Plus, Trash2, Edit2,
  Globe, Server, ArrowUpDown, Activity, Database,
  AlertTriangle, CheckCircle2, XCircle, Save, Search,
  Wifi, FileText, Zap, ChevronDown, ChevronRight, Clock,
  MonitorSmartphone, ArrowRight, Trash,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface DnsStatus {
  installed: boolean;
  running: boolean;
  version: string;
  mode: string;
  configPath: string;
  zoneCount: number;
  recordCount: number;
  redirectCount: number;
  forwarderCount: number;
  cacheStats: { size: number; maxSize: number; inserts: number; evictions: number; hitRate: string };
}

interface DnsZone {
  id: string;
  domain: string;
  type: string;
  description: string | null;
  enabled: number;
  recordCount?: number;
  vlanId: number | null;
}

interface DnsRecord {
  id: string;
  zoneId: string;
  name: string;
  type: string;
  value: string;
  ttl: number;
  priority: number | null;
  enabled: number;
  zoneDomain?: string;
}

interface DnsRedirect {
  id: string;
  domain: string;
  targetIp: string;
  wildcard: number;
  priority: number;
  description: string | null;
  enabled: number;
}

interface DnsForwarder {
  id: string;
  address: string;
  port: number;
  description: string | null;
  enabled: number;
}

interface ActivityLogEntry {
  id: string;
  action: string;
  details: string | null;
  severity: string;
  timestamp: string;
}

interface DhcpDnsEntry {
  timestamp: string;
  macAddress: string;
  ipAddress: string;
  hostname: string;
  clientId?: string;
}

// ============================================================================
// API Helper
// ============================================================================

const DNS_PROXY = '/api/dns';

async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${DNS_PROXY}${endpoint}`;
  const res = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...options?.headers } });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'API Error');
  return data.data as T;
}

async function apiMutate(endpoint: string, body: unknown, method = 'POST') {
  const url = `${DNS_PROXY}${endpoint}`;
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'API Error');
  return data;
}

async function apiDelete(endpoint: string) {
  const url = `${DNS_PROXY}${endpoint}`;
  const res = await fetch(url, { method: 'DELETE' });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'API Error');
  return data;
}

// ============================================================================
// Animated Number Counter
// ============================================================================

function AnimatedNumber({ value, duration = 800 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const prevValue = useRef(0);

  useEffect(() => {
    const start = prevValue.current;
    const end = value;
    const startTime = performance.now();

    function animate(currentTime: number) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + (end - start) * eased));
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    }

    requestAnimationFrame(animate);
    prevValue.current = value;
  }, [value, duration]);

  return <span>{display}</span>;
}

// ============================================================================
// Pulse Status Dot
// ============================================================================

function StatusDot({ running }: { running: boolean }) {
  return (
    <span className="relative flex h-3 w-3">
      {running && (
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
      )}
      <span className={`relative inline-flex rounded-full h-3 w-3 ${running ? 'bg-emerald-500' : 'bg-red-500'}`} />
    </span>
  );
}

// ============================================================================
// Skeletons
// ============================================================================

function TabSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <div className="h-8 w-48 bg-muted animate-pulse rounded" />
      <div className="h-64 w-full bg-muted animate-pulse rounded" />
    </div>
  );
}

function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      <div className="h-10 w-full bg-muted animate-pulse rounded" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 w-full bg-muted/50 animate-pulse rounded" />
      ))}
    </div>
  );
}

// ============================================================================
// Empty State Component
// ============================================================================

function EmptyState({ icon: Icon, title, description, action }: {
  icon: React.ElementType;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <Card className="border-dashed">
      <CardContent className="py-16 flex flex-col items-center justify-center text-center">
        <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
          <Icon className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-1">{title}</h3>
        <p className="text-sm text-muted-foreground max-w-sm mb-4">{description}</p>
        {action}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// DNS Server Page (Main)
// ============================================================================

export default function DnsPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [status, setStatus] = useState<DnsStatus | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const tabs = [
    { id: 0, label: 'Server', icon: Server },
    { id: 1, label: 'Zones', icon: Globe },
    { id: 2, label: 'Records', icon: Network },
    { id: 3, label: 'Redirects', icon: ArrowUpDown },
    { id: 4, label: 'DHCP-DNS', icon: Wifi },
    { id: 5, label: 'Cache', icon: Database },
    { id: 6, label: 'Activity', icon: Activity },
    { id: 7, label: 'Config', icon: Save },
  ];

  const fetchStatus = useCallback(async () => {
    try {
      const s = await apiFetch<DnsStatus>('/api/status');
      setStatus(s);
    } catch {
      // silent
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchStatus();
      setRefreshKey((k) => k + 1);
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleQuickAction = async (action: string) => {
    try {
      await apiMutate(`/api/service/${action}`, {});
      await fetchStatus();
    } catch {
      // silent
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-600 via-teal-700 to-emerald-800 p-6 text-white shadow-xl">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-50" />
        <div className="relative z-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <StatusDot running={!!status?.running} />
                <h1 className="text-2xl font-bold tracking-tight">DNS Server</h1>
              </div>
              <Badge variant="outline" className="border-white/30 text-white bg-white/10">
                <Network className="h-3 w-3 mr-1" /> Port 3012
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-xs text-white/70">
              <Clock className="h-3.5 w-3.5" />
              <span>Auto-refresh: 10s</span>
              <RefreshCw className="h-3 w-3 ml-1 animate-spin opacity-50" style={{ animationDuration: '3s' }} />
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-6">
            {[
              { label: 'Zones', value: status?.zoneCount || 0, icon: Globe },
              { label: 'Records', value: status?.recordCount || 0, icon: Network },
              { label: 'Redirects', value: status?.redirectCount || 0, icon: ArrowUpDown },
              { label: 'Forwarders', value: status?.forwarderCount || 0, icon: Server },
              { label: 'Cache Size', value: status?.cacheStats?.size || 0, icon: Database },
            ].map((stat) => (
              <div key={stat.label} className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/10">
                <div className="flex items-center gap-2 mb-1">
                  <stat.icon className="h-4 w-4 text-white/60" />
                  <span className="text-xs text-white/60">{stat.label}</span>
                </div>
                <p className="text-2xl font-bold">
                  <AnimatedNumber value={stat.value} />
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions Bar */}
      <div className="flex flex-wrap items-center gap-2 p-3 bg-muted/50 rounded-xl border">
        <Zap className="h-4 w-4 text-amber-500 mr-1" />
        <span className="text-xs font-medium text-muted-foreground mr-2">Quick Actions:</span>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => handleQuickAction('start')} disabled={status?.running}>
          <Play className="h-3 w-3" /> Start
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => handleQuickAction('stop')} disabled={!status?.running}>
          <Square className="h-3 w-3" /> Stop
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => handleQuickAction('restart')}>
          <RotateCw className="h-3 w-3" /> Restart
        </Button>
        <Separator orientation="vertical" className="h-5" />
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={async () => {
          try {
            await apiMutate('/api/sync', {});
            await fetchStatus();
          } catch { /* silent */ }
        }}>
          <Database className="h-3 w-3" /> Sync DB
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={async () => {
          try {
            await apiMutate('/api/cache/flush', {});
            await fetchStatus();
          } catch { /* silent */ }
        }}>
          <RefreshCw className="h-3 w-3" /> Flush Cache
        </Button>
      </div>

      {/* Tab Bar - Modern Underline Style */}
      <div className="border-b">
        <ScrollArea className="w-full">
          <div className="flex gap-0 relative">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors relative whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'text-teal-600 dark:text-teal-400'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
                {activeTab === tab.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-500 rounded-full" />
                )}
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Tab Content */}
      {activeTab === 0 && <ServerTab key={refreshKey} />}
      {activeTab === 1 && <ZonesTab />}
      {activeTab === 2 && <RecordsTab />}
      {activeTab === 3 && <RedirectsTab />}
      {activeTab === 4 && <DhcpDnsTab />}
      {activeTab === 5 && <CacheTab key={refreshKey} />}
      {activeTab === 6 && <ActivityTab />}
      {activeTab === 7 && <ConfigTab />}
    </div>
  );
}

// ============================================================================
// Server Tab
// ============================================================================

function ServerTab() {
  const [status, setStatus] = useState<DnsStatus | null>(null);
  const [forwarders, setForwarders] = useState<DnsForwarder[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [addFwdOpen, setAddFwdOpen] = useState(false);
  const [newFwd, setNewFwd] = useState({ address: '', port: 53, description: '' });
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    try {
      const [s, f] = await Promise.all([apiFetch<DnsStatus>('/api/status'), apiFetch<DnsForwarder[]>('/api/forwarders')]);
      setStatus(s);
      setForwarders(f);
    } catch (error) {
      console.error('Failed to fetch DNS status:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAction = async (action: string) => {
    setActionLoading(true);
    try {
      await apiMutate(`/api/service/${action}`, {});
      toast({ title: `DNS service ${action}ed`, description: `dnsmasq ${action} initiated` });
      await fetchData();
    } catch (error: unknown) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddForwarder = async () => {
    try {
      await apiMutate('/api/forwarders', newFwd);
      toast({ title: 'Forwarder added', description: `${newFwd.address}:${newFwd.port}` });
      setAddFwdOpen(false);
      setNewFwd({ address: '', port: 53, description: '' });
      fetchData();
    } catch (error: unknown) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' });
    }
  };

  const handleDeleteForwarder = async (id: string) => {
    try {
      await apiDelete(`/api/forwarders/${id}`);
      toast({ title: 'Forwarder removed' });
      fetchData();
    } catch (error: unknown) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' });
    }
  };

  if (loading) return <TabSkeleton />;

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <Card className="overflow-hidden">
        <div className={`h-1 ${status?.running ? 'bg-emerald-500' : 'bg-red-500'}`} />
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <CardTitle className="flex items-center gap-3">
              <StatusDot running={!!status?.running} />
              <span>dnsmasq DNS Server</span>
              <Badge variant={status?.running ? 'default' : 'destructive'} className={status?.running ? 'bg-emerald-500 hover:bg-emerald-600' : ''}>
                {status?.running ? 'Running' : 'Stopped'}
              </Badge>
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => handleAction('start')} disabled={actionLoading || !!status?.running}>
                <Play className="h-4 w-4 mr-1" /> Start
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleAction('stop')} disabled={actionLoading || !status?.running}>
                <Square className="h-4 w-4 mr-1" /> Stop
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleAction('restart')} disabled={actionLoading}>
                <RotateCw className="h-4 w-4 mr-1" /> Restart
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleAction('reload')} disabled={actionLoading || !status?.running}>
                <RefreshCw className="h-4 w-4 mr-1" /> Reload
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Version', value: status?.version || 'N/A' },
              { label: 'Mode', value: status?.mode || 'N/A' },
              { label: 'Installed', value: status?.installed ? 'Yes' : 'No', badge: true, badgeVariant: status?.installed ? 'default' : 'secondary' },
              { label: 'Config', value: status?.configPath ? status.configPath.split('/').pop() || status.configPath : 'N/A' },
            ].map((item) => (
              <div key={item.label} className="space-y-1 p-3 rounded-lg bg-muted/30">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                {item.badge ? (
                  <Badge variant={item.badgeVariant as 'default' | 'secondary'}>{item.value}</Badge>
                ) : (
                  <p className="text-sm font-medium truncate">{item.value}</p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Upstream Forwarders */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Upstream DNS Forwarders</CardTitle>
              <CardDescription>Servers used to resolve external DNS queries</CardDescription>
            </div>
            <Dialog open={addFwdOpen} onOpenChange={setAddFwdOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-teal-600 hover:bg-teal-700"><Plus className="h-4 w-4 mr-1" /> Add Forwarder</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add DNS Forwarder</DialogTitle>
                  <DialogDescription>Add an upstream DNS server for external resolution</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>IP Address *</Label>
                    <Input placeholder="8.8.8.8" value={newFwd.address} onChange={(e) => setNewFwd({ ...newFwd, address: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Port</Label>
                    <Input type="number" value={newFwd.port} onChange={(e) => setNewFwd({ ...newFwd, port: parseInt(e.target.value) || 53 })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input placeholder="Google DNS" value={newFwd.description} onChange={(e) => setNewFwd({ ...newFwd, description: e.target.value })} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddFwdOpen(false)}>Cancel</Button>
                  <Button onClick={handleAddForwarder} disabled={!newFwd.address} className="bg-teal-600 hover:bg-teal-700">Add</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {forwarders.length === 0 ? (
            <EmptyState
              icon={Server}
              title="No upstream forwarders"
              description="Add forwarders like 8.8.8.8, 1.1.1.1, or your ISP DNS to resolve external queries"
              action={<Button size="sm" onClick={() => setAddFwdOpen(true)}><Plus className="h-4 w-4 mr-1" /> Add Forwarder</Button>}
            />
          ) : (
            <div className="space-y-2">
              {forwarders.map((fwd) => (
                <div key={fwd.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-teal-50 dark:bg-teal-950 flex items-center justify-center">
                      <Server className="h-4 w-4 text-teal-600" />
                    </div>
                    <div>
                      <p className="font-medium font-mono text-sm">{fwd.address}:{fwd.port}</p>
                      {fwd.description && <p className="text-xs text-muted-foreground">{fwd.description}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={fwd.enabled ? 'default' : 'secondary'} className={fwd.enabled ? 'bg-emerald-500' : ''}>
                      {fwd.enabled ? 'Active' : 'Disabled'}
                    </Badge>
                    <Button size="sm" variant="ghost" onClick={() => handleDeleteForwarder(fwd.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Zones Tab (with search, bulk delete, expand-to-see-records)
// ============================================================================

function ZonesTab() {
  const [zones, setZones] = useState<DnsZone[]>([]);
  const [records, setRecords] = useState<DnsRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editZone, setEditZone] = useState<DnsZone | null>(null);
  const [form, setForm] = useState({ domain: '', type: 'forward', description: '', enabled: true });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const [expandedZone, setExpandedZone] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchZones = useCallback(async () => {
    try {
      const [z, r] = await Promise.all([apiFetch<DnsZone[]>('/api/zones'), apiFetch<DnsRecord[]>('/api/records')]);
      setZones(z);
      setRecords(r);
    } catch { /* silent */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchZones(); }, [fetchZones]);

  const filteredZones = zones.filter((z) =>
    z.domain.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (z.description || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSave = async () => {
    try {
      if (editZone) {
        await apiMutate(`/api/zones/${editZone.id}`, form, 'PUT');
        toast({ title: 'Zone updated' });
      } else {
        await apiMutate('/api/zones', form);
        toast({ title: 'Zone created' });
      }
      setDialogOpen(false);
      setEditZone(null);
      setForm({ domain: '', type: 'forward', description: '', enabled: true });
      fetchZones();
    } catch (error: unknown) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    setConfirmAction(() => async () => {
      try {
        await apiDelete(`/api/zones/${id}`);
        toast({ title: 'Zone deleted' });
        fetchZones();
      } catch (error: unknown) {
        toast({ title: 'Error', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' });
      }
      setConfirmOpen(false);
    });
    setConfirmOpen(true);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setConfirmAction(() => async () => {
      try {
        await apiMutate('/api/zones/bulk-delete', { ids: Array.from(selectedIds) });
        toast({ title: `${selectedIds.size} zones deleted` });
        setSelectedIds(new Set());
        fetchZones();
      } catch (error: unknown) {
        toast({ title: 'Error', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' });
      }
      setConfirmOpen(false);
    });
    setConfirmOpen(true);
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredZones.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredZones.map((z) => z.id)));
    }
  };

  const openEdit = (zone: DnsZone) => {
    setEditZone(zone);
    setForm({ domain: zone.domain, type: zone.type, description: zone.description || '', enabled: !!zone.enabled });
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditZone(null);
    setForm({ domain: '', type: 'forward', description: '', enabled: true });
    setDialogOpen(true);
  };

  if (loading) return <TableSkeleton />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">DNS Zones</h3>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search zones..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-48 h-9"
            />
          </div>
          {selectedIds.size > 0 && (
            <Button size="sm" variant="destructive" onClick={handleBulkDelete} className="h-9">
              <Trash className="h-4 w-4 mr-1" /> Delete ({selectedIds.size})
            </Button>
          )}
          <Button size="sm" onClick={openNew} className="bg-teal-600 hover:bg-teal-700"><Plus className="h-4 w-4 mr-1" /> Add Zone</Button>
        </div>
      </div>

      {filteredZones.length === 0 ? (
        <EmptyState
          icon={Globe}
          title="No DNS zones configured"
          description="Create a zone like hotel.local or guest.wifi to manage DNS records"
          action={<Button size="sm" onClick={openNew} className="bg-teal-600 hover:bg-teal-700"><Plus className="h-4 w-4 mr-1" /> Add Zone</Button>}
        />
      ) : (
        <div className="space-y-2">
          {/* Select All Row */}
          <div className="flex items-center gap-3 p-2 text-xs text-muted-foreground">
            <Checkbox checked={selectedIds.size === filteredZones.length && filteredZones.length > 0} onCheckedChange={toggleSelectAll} />
            <span>{selectedIds.size > 0 ? `${selectedIds.size} selected` : `Select all`}</span>
          </div>

          {filteredZones.map((zone) => {
            const zoneRecords = records.filter((r) => r.zoneId === zone.id);
            const isExpanded = expandedZone === zone.id;

            return (
              <Card key={zone.id} className={`overflow-hidden transition-all ${selectedIds.has(zone.id) ? 'ring-2 ring-teal-500/50' : ''}`}>
                <CardContent className="p-0">
                  <div className="flex items-center gap-3 p-4">
                    <Checkbox checked={selectedIds.has(zone.id)} onCheckedChange={() => toggleSelect(zone.id)} />
                    <button
                      className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => setExpandedZone(isExpanded ? null : zone.id)}
                    >
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                    <div className="h-9 w-9 rounded-lg bg-teal-50 dark:bg-teal-950 flex items-center justify-center flex-shrink-0">
                      <Globe className="h-4 w-4 text-teal-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{zone.domain}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className="text-xs">{zone.type}</Badge>
                        <span className="text-xs text-muted-foreground">{zone.recordCount || zoneRecords.length} records</span>
                        {zone.description && <span className="text-xs text-muted-foreground hidden sm:inline">• {zone.description}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={zone.enabled ? 'default' : 'secondary'} className={zone.enabled ? 'bg-emerald-500' : ''}>
                        {zone.enabled ? 'Active' : 'Disabled'}
                      </Badge>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(zone)}><Edit2 className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(zone.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </div>

                  {/* Expanded Records */}
                  {isExpanded && zoneRecords.length > 0 && (
                    <div className="border-t bg-muted/20">
                      <div className="p-3 overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left p-2 font-medium text-muted-foreground">Name</th>
                              <th className="text-left p-2 font-medium text-muted-foreground">Type</th>
                              <th className="text-left p-2 font-medium text-muted-foreground">Value</th>
                              <th className="text-left p-2 font-medium text-muted-foreground">TTL</th>
                            </tr>
                          </thead>
                          <tbody>
                            {zoneRecords.map((rec) => (
                              <tr key={rec.id} className="border-b last:border-0 hover:bg-muted/30">
                                <td className="p-2 font-mono">{rec.name}</td>
                                <td className="p-2"><Badge variant="outline" className="font-mono text-[10px]">{rec.type}</Badge></td>
                                <td className="p-2 font-mono max-w-[200px] truncate">{rec.value}</td>
                                <td className="p-2">{rec.ttl}s</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  {isExpanded && zoneRecords.length === 0 && (
                    <div className="border-t p-4 text-center text-xs text-muted-foreground">
                      No records in this zone
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Zone Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editZone ? 'Edit Zone' : 'Create DNS Zone'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Domain *</Label>
              <Input placeholder="hotel.local" value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="forward">Forward</SelectItem>
                  <SelectItem value="reverse">Reverse</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input placeholder="Internal hotel network" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} />
              <Label>Enabled</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.domain} className="bg-teal-600 hover:bg-teal-700">{editZone ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Confirm Deletion
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the zone and all associated records. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAction || undefined} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============================================================================
// Records Tab (with search, bulk delete)
// ============================================================================

function RecordsTab() {
  const [records, setRecords] = useState<DnsRecord[]>([]);
  const [zones, setZones] = useState<DnsZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterZone, setFilterZone] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<DnsRecord | null>(null);
  const [form, setForm] = useState({ zoneId: '', name: '', type: 'A', value: '', ttl: 300, priority: '', enabled: true });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    try {
      const [r, z] = await Promise.all([apiFetch<DnsRecord[]>('/api/records'), apiFetch<DnsZone[]>('/api/zones')]);
      setRecords(r);
      setZones(z);
    } catch { /* silent */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredRecords = records.filter((r) => {
    if (filterZone !== 'all' && r.zoneId !== filterZone) return false;
    if (filterType !== 'all' && r.type !== filterType) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return r.name.toLowerCase().includes(q) || r.value.toLowerCase().includes(q) || (r.zoneDomain || '').toLowerCase().includes(q);
    }
    return true;
  });

  const handleSave = async () => {
    try {
      const body = { ...form, priority: form.priority ? parseInt(form.priority) : null };
      if (editRecord) {
        await apiMutate(`/api/records/${editRecord.id}`, body, 'PUT');
        toast({ title: 'Record updated' });
      } else {
        await apiMutate('/api/records', body);
        toast({ title: 'Record created' });
      }
      setDialogOpen(false);
      setEditRecord(null);
      setForm({ zoneId: '', name: '', type: 'A', value: '', ttl: 300, priority: '', enabled: true });
      fetchData();
    } catch (error: unknown) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    setConfirmAction(() => async () => {
      try {
        await apiDelete(`/api/records/${id}`);
        toast({ title: 'Record deleted' });
        fetchData();
      } catch (error: unknown) {
        toast({ title: 'Error', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' });
      }
      setConfirmOpen(false);
    });
    setConfirmOpen(true);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setConfirmAction(() => async () => {
      try {
        await apiMutate('/api/records/bulk-delete', { ids: Array.from(selectedIds) });
        toast({ title: `${selectedIds.size} records deleted` });
        setSelectedIds(new Set());
        fetchData();
      } catch (error: unknown) {
        toast({ title: 'Error', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' });
      }
      setConfirmOpen(false);
    });
    setConfirmOpen(true);
  };

  const openEdit = (record: DnsRecord) => {
    setEditRecord(record);
    setForm({
      zoneId: record.zoneId, name: record.name, type: record.type,
      value: record.value, ttl: record.ttl, priority: record.priority?.toString() || '',
      enabled: !!record.enabled,
    });
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditRecord(null);
    setForm({ zoneId: zones[0]?.id || '', name: '', type: 'A', value: '', ttl: 300, priority: '', enabled: true });
    setDialogOpen(true);
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredRecords.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRecords.map((r) => r.id)));
    }
  };

  const recordTypes = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'SRV', 'PTR'];

  if (loading) return <TableSkeleton />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">DNS Records</h3>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search records..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-40 h-9"
            />
          </div>
          <Select value={filterZone} onValueChange={setFilterZone}>
            <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Zone" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Zones</SelectItem>
              {zones.map((z) => <SelectItem key={z.id} value={z.id}>{z.domain}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-24 h-9"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {recordTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          {selectedIds.size > 0 && (
            <Button size="sm" variant="destructive" onClick={handleBulkDelete} className="h-9">
              <Trash className="h-4 w-4 mr-1" /> Delete ({selectedIds.size})
            </Button>
          )}
          <Button size="sm" onClick={openNew} className="bg-teal-600 hover:bg-teal-700"><Plus className="h-4 w-4 mr-1" /> Add Record</Button>
        </div>
      </div>

      {filteredRecords.length === 0 ? (
        <EmptyState
          icon={Network}
          title="No DNS records found"
          description="Create A, AAAA, CNAME, MX, TXT, SRV, or PTR records for your zones"
          action={<Button size="sm" onClick={openNew} className="bg-teal-600 hover:bg-teal-700"><Plus className="h-4 w-4 mr-1" /> Add Record</Button>}
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium w-10">
                    <Checkbox checked={selectedIds.size === filteredRecords.length && filteredRecords.length > 0} onCheckedChange={toggleSelectAll} />
                  </th>
                  <th className="text-left p-3 font-medium">Name</th>
                  <th className="text-left p-3 font-medium">Type</th>
                  <th className="text-left p-3 font-medium">Value</th>
                  <th className="text-left p-3 font-medium">TTL</th>
                  <th className="text-left p-3 font-medium">Zone</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-right p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((record, idx) => (
                  <tr key={record.id} className={`border-b hover:bg-muted/30 transition-colors ${idx % 2 === 1 ? 'bg-muted/10' : ''} ${selectedIds.has(record.id) ? 'bg-teal-50/50 dark:bg-teal-950/20' : ''}`}>
                    <td className="p-3"><Checkbox checked={selectedIds.has(record.id)} onCheckedChange={() => toggleSelect(record.id)} /></td>
                    <td className="p-3 font-mono text-xs">{record.name}</td>
                    <td className="p-3"><Badge variant="outline" className="font-mono text-xs">{record.type}</Badge></td>
                    <td className="p-3 font-mono text-xs max-w-[200px] truncate">{record.value}</td>
                    <td className="p-3 text-xs">{record.ttl}s</td>
                    <td className="p-3 text-xs">{record.zoneDomain || '-'}</td>
                    <td className="p-3">
                      <Badge variant={record.enabled ? 'default' : 'secondary'} className={`text-xs ${record.enabled ? 'bg-emerald-500' : ''}`}>
                        {record.enabled ? 'Active' : 'Disabled'}
                      </Badge>
                    </td>
                    <td className="p-3 text-right">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(record)}><Edit2 className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(record.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Create/Edit Record Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editRecord ? 'Edit Record' : 'Create DNS Record'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Zone *</Label>
              <Select value={form.zoneId} onValueChange={(v) => setForm({ ...form, zoneId: v })}>
                <SelectTrigger><SelectValue placeholder="Select zone" /></SelectTrigger>
                <SelectContent>
                  {zones.map((z) => <SelectItem key={z.id} value={z.id}>{z.domain}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input placeholder="www" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <p className="text-xs text-muted-foreground">Just the hostname (zone domain is appended automatically)</p>
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {recordTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Value *</Label>
              <Input placeholder={form.type === 'A' ? '192.168.1.10' : form.type === 'CNAME' ? 'server.hotel.local' : 'value'} value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>TTL (seconds)</Label>
                <Input type="number" value={form.ttl} onChange={(e) => setForm({ ...form, ttl: parseInt(e.target.value) || 300 })} />
              </div>
              {(form.type === 'MX' || form.type === 'SRV') && (
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Input type="number" placeholder="10" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} />
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} />
              <Label>Enabled</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.zoneId || !form.name || !form.value} className="bg-teal-600 hover:bg-teal-700">
              {editRecord ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Confirm Deletion
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the selected DNS record(s). This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAction || undefined} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============================================================================
// Redirects Tab
// ============================================================================

function RedirectsTab() {
  const [redirects, setRedirects] = useState<DnsRedirect[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editRedirect, setEditRedirect] = useState<DnsRedirect | null>(null);
  const [form, setForm] = useState({ domain: '', targetIp: '', wildcard: false, priority: 100, description: '', enabled: true });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const { toast } = useToast();

  const fetchRedirects = useCallback(async () => {
    try {
      const data = await apiFetch<DnsRedirect[]>('/api/redirects');
      setRedirects(data);
    } catch { /* silent */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchRedirects(); }, [fetchRedirects]);

  const handleSave = async () => {
    try {
      if (editRedirect) {
        await apiMutate(`/api/redirects/${editRedirect.id}`, form, 'PUT');
        toast({ title: 'Redirect updated' });
      } else {
        await apiMutate('/api/redirects', form);
        toast({ title: 'Redirect created' });
      }
      setDialogOpen(false);
      setEditRedirect(null);
      setForm({ domain: '', targetIp: '', wildcard: false, priority: 100, description: '', enabled: true });
      fetchRedirects();
    } catch (error: unknown) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    setConfirmAction(() => async () => {
      try {
        await apiDelete(`/api/redirects/${id}`);
        toast({ title: 'Redirect deleted' });
        fetchRedirects();
      } catch (error: unknown) {
        toast({ title: 'Error', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' });
      }
      setConfirmOpen(false);
    });
    setConfirmOpen(true);
  };

  const openEdit = (redirect: DnsRedirect) => {
    setEditRedirect(redirect);
    setForm({
      domain: redirect.domain, targetIp: redirect.targetIp,
      wildcard: !!redirect.wildcard, priority: redirect.priority,
      description: redirect.description || '', enabled: !!redirect.enabled,
    });
    setDialogOpen(true);
  };

  if (loading) return <TableSkeleton />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">DNS Redirects</h3>
          <p className="text-sm text-muted-foreground">Redirect domains for captive portal or content filtering</p>
        </div>
        <Button size="sm" onClick={() => { setEditRedirect(null); setForm({ domain: '', targetIp: '', wildcard: false, priority: 100, description: '', enabled: true }); setDialogOpen(true); }} className="bg-teal-600 hover:bg-teal-700">
          <Plus className="h-4 w-4 mr-1" /> Add Redirect
        </Button>
      </div>

      {!redirects.length ? (
        <EmptyState
          icon={ArrowUpDown}
          title="No DNS redirects configured"
          description="Redirect domains to your captive portal IP for guest network control"
          action={<Button size="sm" onClick={() => setDialogOpen(true)} className="bg-teal-600 hover:bg-teal-700"><Plus className="h-4 w-4 mr-1" /> Add Redirect</Button>}
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">Domain</th>
                  <th className="text-left p-3 font-medium">Target IP</th>
                  <th className="text-left p-3 font-medium">Wildcard</th>
                  <th className="text-left p-3 font-medium">Priority</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-right p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {redirects.map((r, idx) => (
                  <tr key={r.id} className={`border-b hover:bg-muted/30 transition-colors ${idx % 2 === 1 ? 'bg-muted/10' : ''}`}>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <ArrowRight className="h-3.5 w-3.5 text-orange-500" />
                        <span className="font-mono text-xs">{r.wildcard ? `*.${r.domain}` : r.domain}</span>
                      </div>
                    </td>
                    <td className="p-3 font-mono text-xs">{r.targetIp}</td>
                    <td className="p-3"><Badge variant={r.wildcard ? 'default' : 'secondary'} className={r.wildcard ? 'bg-orange-500' : ''}>{r.wildcard ? 'Yes' : 'No'}</Badge></td>
                    <td className="p-3 text-xs">{r.priority}</td>
                    <td className="p-3"><Badge variant={r.enabled ? 'default' : 'secondary'} className={r.enabled ? 'bg-emerald-500' : ''}>{r.enabled ? 'Active' : 'Disabled'}</Badge></td>
                    <td className="p-3 text-right">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(r)}><Edit2 className="h-3.5 w-3.5" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(r.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Create/Edit Redirect Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editRedirect ? 'Edit Redirect' : 'Create DNS Redirect'}</DialogTitle>
            <DialogDescription>Redirect DNS queries for a domain to a specific IP</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Domain *</Label>
              <Input placeholder="facebook.com" value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Target IP *</Label>
              <Input placeholder="192.168.1.1" value={form.targetIp} onChange={(e) => setForm({ ...form, targetIp: e.target.value })} />
              <p className="text-xs text-muted-foreground">Usually your captive portal IP</p>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.wildcard} onCheckedChange={(v) => setForm({ ...form, wildcard: v })} />
              <Label>Wildcard (match all subdomains)</Label>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Input type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) || 100 })} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input placeholder="Captive portal redirect" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} />
              <Label>Enabled</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!form.domain || !form.targetIp} className="bg-teal-600 hover:bg-teal-700">{editRedirect ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Confirm Deletion
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the DNS redirect. Any clients relying on this redirect will be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAction || undefined} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============================================================================
// DHCP-DNS Integration Tab (NEW)
// ============================================================================

function DhcpDnsTab() {
  const [entries, setEntries] = useState<DhcpDnsEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    try {
      const data = await apiFetch<DhcpDnsEntry[]>('/api/dhcp-dns');
      setEntries(data);
    } catch { /* silent */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <TableSkeleton />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">DHCP-DNS Integration</h3>
          <p className="text-sm text-muted-foreground">DHCP lease entries with automatic DNS registration</p>
        </div>
        <Button size="sm" variant="outline" onClick={fetchData}>
          <RefreshCw className="h-4 w-4 mr-1" /> Refresh
        </Button>
      </div>

      {entries.length === 0 ? (
        <EmptyState
          icon={Wifi}
          title="No DHCP leases found"
          description="DHCP lease entries will appear here when clients connect to the network"
          action={<Button size="sm" variant="outline" onClick={fetchData}><RefreshCw className="h-4 w-4 mr-1" /> Check Again</Button>}
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">MAC Address</th>
                  <th className="text-left p-3 font-medium">IP Address</th>
                  <th className="text-left p-3 font-medium">Hostname</th>
                  <th className="text-left p-3 font-medium">Lease Time</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, idx) => (
                  <tr key={`${entry.macAddress}-${idx}`} className={`border-b hover:bg-muted/30 transition-colors ${idx % 2 === 1 ? 'bg-muted/10' : ''}`}>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <MonitorSmartphone className="h-3.5 w-3.5 text-teal-500" />
                        <span className="font-mono text-xs">{entry.macAddress}</span>
                      </div>
                    </td>
                    <td className="p-3 font-mono text-xs">{entry.ipAddress}</td>
                    <td className="p-3 text-xs">{entry.hostname || '-'}</td>
                    <td className="p-3 text-xs text-muted-foreground">{entry.timestamp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Wifi className="h-5 w-5 text-teal-500" />
            How DHCP-DNS Integration Works
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>When dnsmasq handles both DHCP and DNS, it automatically creates DNS entries for DHCP clients:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Each DHCP lease gets an automatic A record mapping the hostname to the assigned IP</li>
            <li>Clients can reach each other by hostname instead of IP address</li>
            <li>Lease entries above are read from the dnsmasq lease file</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Cache Tab
// ============================================================================

function CacheTab() {
  const [cacheStats, setCacheStats] = useState<{ size: number; maxSize: number; inserts: number; evictions: number; hitRate: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { toast } = useToast();

  const fetchCache = useCallback(async () => {
    try {
      const data = await apiFetch<{ size: number; maxSize: number; inserts: number; evictions: number; hitRate: string }>('/api/cache');
      setCacheStats(data);
    } catch { /* silent */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchCache(); }, [fetchCache]);

  const handleFlush = async () => {
    try {
      await apiMutate('/api/cache/flush', {});
      toast({ title: 'Cache flushed', description: 'DNS cache has been cleared' });
      fetchCache();
    } catch (error: unknown) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' });
    }
    setConfirmOpen(false);
  };

  if (loading) return <TabSkeleton />;

  const utilization = cacheStats ? Math.round((cacheStats.size / (cacheStats.maxSize || 10000)) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">DNS Cache</h3>
        <Button size="sm" variant="outline" onClick={() => setConfirmOpen(true)}>
          <RefreshCw className="h-4 w-4 mr-1" /> Flush Cache
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Cached Entries', value: cacheStats?.size || 0, icon: Database, color: 'text-teal-500', bg: 'bg-teal-50 dark:bg-teal-950' },
          { label: 'Max Cache Size', value: cacheStats?.maxSize || 10000, icon: Server, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950' },
          { label: 'Status', value: cacheStats?.hitRate || 'N/A', icon: Activity, color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-950', isText: true },
          { label: 'Evictions', value: cacheStats?.evictions || 0, icon: AlertTriangle, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-950' },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4 text-center">
              <div className={`h-10 w-10 rounded-xl ${stat.bg} flex items-center justify-center mx-auto mb-2`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <p className="text-2xl font-bold">
                {stat.isText ? stat.value : <AnimatedNumber value={typeof stat.value === 'number' ? stat.value : 0} />}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cache Utilization</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b">
              <span className="text-sm text-muted-foreground">Cache Size</span>
              <span className="text-sm font-medium">{cacheStats?.size || 0} / {cacheStats?.maxSize || 10000}</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Utilization</span>
                <span className="text-sm font-medium">{utilization}%</span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(utilization, 100)}%` }}
                />
              </div>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-sm text-muted-foreground">Status</span>
              <Badge variant={cacheStats?.size && cacheStats.size > 0 ? 'default' : 'secondary'} className={cacheStats?.size && cacheStats.size > 0 ? 'bg-emerald-500' : ''}>
                {cacheStats?.hitRate || 'Unknown'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Flush DNS Cache
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will clear all cached DNS entries. New queries will need to be resolved from upstream servers again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleFlush}>Flush Cache</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============================================================================
// Activity Log Tab (NEW)
// ============================================================================

function ActivityTab() {
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchLogs = useCallback(async () => {
    try {
      const data = await apiFetch<ActivityLogEntry[]>('/api/activity');
      setLogs(data);
    } catch { /* silent */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case 'info': return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      default: return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'error': return <Badge variant="destructive" className="text-xs">Error</Badge>;
      case 'warning': return <Badge className="text-xs bg-amber-500">Warning</Badge>;
      case 'info': return <Badge className="text-xs bg-emerald-500">Info</Badge>;
      default: return <Badge variant="secondary" className="text-xs">{severity}</Badge>;
    }
  };

  const formatTimestamp = (ts: string) => {
    try {
      const d = new Date(ts);
      return d.toLocaleString();
    } catch {
      return ts;
    }
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      service_start: 'Service Start',
      service_stop: 'Service Stop',
      config_sync: 'Config Sync',
      zone_create: 'Zone Created',
      zone_delete: 'Zone Deleted',
      zones_bulk_delete: 'Zones Bulk Delete',
      record_create: 'Record Created',
      record_delete: 'Record Deleted',
      records_bulk_delete: 'Records Bulk Delete',
      forwarder_add: 'Forwarder Added',
      redirect_create: 'Redirect Created',
      cache_flush: 'Cache Flushed',
      status_check: 'Status Check',
    };
    return labels[action] || action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  };

  if (loading) return <TableSkeleton />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Activity Log</h3>
          <p className="text-sm text-muted-foreground">Recent DNS server activity and events</p>
        </div>
        <Button size="sm" variant="outline" onClick={fetchLogs}>
          <RefreshCw className="h-4 w-4 mr-1" /> Refresh
        </Button>
      </div>

      {logs.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No activity recorded"
          description="DNS server activity will appear here as operations are performed"
        />
      ) : (
        <Card>
          <div className="max-h-[600px] overflow-y-auto">
            {logs.map((log, idx) => (
              <div key={log.id} className={`flex items-start gap-3 p-4 border-b last:border-0 hover:bg-muted/30 transition-colors ${idx % 2 === 1 ? 'bg-muted/10' : ''}`}>
                <div className="mt-0.5 flex-shrink-0">
                  {getSeverityIcon(log.severity)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{getActionLabel(log.action)}</span>
                    {getSeverityBadge(log.severity)}
                  </div>
                  {log.details && (
                    <p className="text-xs text-muted-foreground">{log.details}</p>
                  )}
                </div>
                <div className="flex-shrink-0 text-xs text-muted-foreground">
                  {formatTimestamp(log.timestamp)}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ============================================================================
// Config Tab
// ============================================================================

function ConfigTab() {
  const [config, setConfig] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchConfig = useCallback(async () => {
    try {
      const data = await apiFetch<{ path: string; content: string }>('/api/config');
      setConfig(data.content);
    } catch { /* silent */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiMutate('/api/config', { content: config });
      toast({ title: 'Config saved', description: 'dnsmasq configuration updated and reloaded' });
    } catch (error: unknown) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    try {
      await apiMutate('/api/sync', {});
      toast({ title: 'Sync complete', description: 'Database synced to dnsmasq config' });
      fetchConfig();
    } catch (error: unknown) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' });
    }
  };

  if (loading) return <TabSkeleton />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">dnsmasq Configuration</h3>
          <p className="text-sm text-muted-foreground">Edit raw dnsmasq configuration file</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleSync}>
            <RefreshCw className="h-4 w-4 mr-1" /> Sync from DB
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="bg-teal-600 hover:bg-teal-700">
            <Save className="h-4 w-4 mr-1" /> {saving ? 'Saving...' : 'Save & Reload'}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <textarea
            className="w-full h-96 font-mono text-xs bg-muted/50 p-4 rounded-lg border resize-y focus:outline-none focus:ring-2 focus:ring-teal-500"
            value={config}
            onChange={(e) => setConfig(e.target.value)}
            spellCheck={false}
          />
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 text-xs text-muted-foreground p-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-900">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
        <p>Editing this file directly may be overwritten when DNS records are synced from the database. Use &quot;Sync from DB&quot; to regenerate.</p>
      </div>
    </div>
  );
}
