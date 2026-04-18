'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Palette,
  Layout,
  Plus,
  Edit2,
  Trash2,
  Copy,
  Eye,
  Upload,
  Download,
  Settings,
  Lock,
  Unlock,
  Smartphone,
  Share2,
  Fingerprint,
  Ticket,
  Building,
  User,
  ChevronRight,
  ChevronDown,
  Zap,
  Monitor,
  CheckCircle2,
  XCircle,
  ArrowUpDown,
  Layers,
} from 'lucide-react';
// Note: Globe, Shield, Search, ChevronRight, ChevronDown removed — DNS tabs moved to DNS Server page
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { usePropertyId } from '@/hooks/use-property';

// ── Static Config ─────────────────────────────────────────────────────────────

const VLAN_OPTIONS = ['VLAN 10', 'VLAN 20', 'VLAN 30', 'VLAN 40', 'VLAN 50'];
const LANGUAGES = ['English', 'Spanish', 'French', 'German', 'Japanese', 'Hindi', 'Arabic', 'Portuguese', 'Chinese'];

const AUTH_METHOD_META: Record<string, { icon: typeof Ticket; color: string; displayName: string }> = {
  voucher: { icon: Ticket, color: 'bg-amber-500', displayName: 'Voucher' },
  room_number: { icon: Building, color: 'bg-emerald-500', displayName: 'Room Number' },
  pms_credentials: { icon: User, color: 'bg-teal-500', displayName: 'PMS Credentials' },
  sms_otp: { icon: Smartphone, color: 'bg-rose-500', displayName: 'SMS OTP' },
  social_login: { icon: Share2, color: 'bg-violet-500', displayName: 'Social Login' },
  mac_auth: { icon: Fingerprint, color: 'bg-orange-500', displayName: 'MAC Auth' },
  open_access: { icon: Unlock, color: 'bg-gray-500', displayName: 'Open Access' },
};

const TEMPLATE_GRADIENTS: Record<string, string> = {
  'hotel': 'from-amber-900 via-amber-700 to-yellow-600',
  'resort': 'from-teal-600 via-cyan-500 to-sky-400',
  'corporate': 'from-slate-700 via-slate-600 to-zinc-500',
  'minimal': 'from-gray-900 via-gray-800 to-gray-700',
  'cafe': 'from-orange-700 via-amber-600 to-yellow-500',
  'airport': 'from-sky-700 via-blue-500 to-cyan-400',
  'boutique': 'from-rose-800 via-pink-600 to-fuchsia-500',
  'tropical': 'from-emerald-700 via-green-500 to-lime-400',
  'tech': 'from-zinc-800 via-neutral-600 to-stone-500',
};

const DEFAULT_GRADIENTS = [
  'from-amber-900 via-amber-700 to-yellow-600',
  'from-teal-600 via-cyan-500 to-sky-400',
  'from-slate-700 via-slate-600 to-zinc-500',
  'from-gray-900 via-gray-800 to-gray-700',
  'from-orange-700 via-amber-600 to-yellow-500',
  'from-sky-700 via-blue-500 to-cyan-400',
  'from-rose-800 via-pink-600 to-fuchsia-500',
  'from-emerald-700 via-green-500 to-lime-400',
  'from-zinc-800 via-neutral-600 to-stone-500',
];

// ── Helpers ──────────────────────────────────────────────────────────────────

const categoryColors: Record<string, string> = {
  'Hotel Luxury': 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  'Resort Casual': 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  'Corporate': 'bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300',
  'Minimal': 'bg-gray-100 text-gray-600 dark:bg-gray-900/40 dark:text-gray-300',
  'Cafe': 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  'Airport': 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  'hotel': 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  'resort': 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  'corporate': 'bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300',
  'minimal': 'bg-gray-100 text-gray-600 dark:bg-gray-900/40 dark:text-gray-300',
  'cafe': 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  'airport': 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  'boutique': 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  'tropical': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  'tech': 'bg-zinc-100 text-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-300',
};

// ── Tab Definitions ──────────────────────────────────────────────────────────

const TABS = [
  { id: 'portals', label: 'Portal List', icon: Monitor },
  { id: 'designer', label: 'Portal Designer', icon: Palette },
  { id: 'mapping', label: 'Portal Mapping', icon: Layers },
  { id: 'auth', label: 'Auth Methods', icon: Lock },
  { id: 'templates', label: 'Templates', icon: Layout },
] as const;

type TabId = (typeof TABS)[number]['id'];

// ── API Helpers ──────────────────────────────────────────────────────────────

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options });
    const result = await res.json();
    if (result.success) return result.data as T;
    return null;
  } catch (e) {
    console.error('API fetch error:', e);
    return null;
  }
}

async function apiMutate<T>(url: string, options?: RequestInit): Promise<{ data: T | null; error: string | null }> {
  try {
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options });
    const result = await res.json();
    if (result.success) return { data: result.data as T, error: null };
    return { data: null, error: result.error?.message || 'Request failed' };
  } catch (e) {
    console.error('API mutate error:', e);
    return { data: null, error: (e as Error).message || 'Network error' };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════════

export default function PortalPage() {
  const [activeTab, setActiveTab] = useState<TabId>('portals');
  const [portalOptions, setPortalOptions] = useState<string[]>([]);

  const fetchPortalOptions = useCallback(async () => {
    try {
      const data = await apiFetch<any[]>('/api/wifi/portal/instances');
      if (data) {
        setPortalOptions(data.map((p: any) => p.name));
      }
    } catch (e) {
      console.error('Failed to fetch portal options:', e);
    }
  }, []);

  useEffect(() => {
    void fetchPortalOptions(); // eslint-disable-line react-hooks/set-state-in-effect -- standard data-fetching pattern
  }, [fetchPortalOptions]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Captive Portal</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage captive portal instances, guest authentication, and portal design
        </p>
      </div>

      {/* Tab Bar */}
      <div className="border-b border-border">
        <ScrollArea className="w-full">
          <div className="flex gap-1 min-w-max px-1">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all duration-150 whitespace-nowrap',
                    isActive
                      ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Tab Content */}
      <div className="mt-4">
        {activeTab === 'portals' && <PortalListTab onPortalsChanged={fetchPortalOptions} />}
        {activeTab === 'designer' && <PortalDesignerTab portalOptions={portalOptions} />}
        {activeTab === 'mapping' && <PortalMappingTab portalOptions={portalOptions} />}
        {activeTab === 'auth' && <AuthMethodsTab portalOptions={portalOptions} />}
        {activeTab === 'templates' && <TemplatesTab />}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab 1: Portal List
// ═══════════════════════════════════════════════════════════════════════════════
// Note: DNS Zones and DNS Redirects tabs were moved to the DNS Server page.

interface PortalInstance {
  id: string;
  name: string;
  listenIP: string;
  port: number;
  ssl: boolean;
  enabled: boolean;
  sessions: number;
  sessionTimeout: number;
  idleTimeout: number;
  vlans: string[];
  status: string;
}

function PortalListTab({ onPortalsChanged }: { onPortalsChanged?: () => void }) {
  const [portals, setPortals] = useState<PortalInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [systemGateway, setSystemGateway] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [newPortal, setNewPortal] = useState({
    name: '', listenIP: '192.168.1.1', port: 80, ssl: false,
    certPath: '', keyPath: '', maxConcurrent: 100, sessionTimeout: 1440, idleTimeout: 30,
  });
  const { toast } = useToast();
  const { propertyId } = usePropertyId();

  const fetchPortals = useCallback(async () => {
    setLoading(true);
    const data = await apiFetch<any[]>('/api/wifi/portal/instances');
    if (data) {
      setPortals(data.map((p: any) => ({
        id: p.id,
        name: p.name,
        listenIP: p.listenIp || '0.0.0.0',
        port: p.listenPort || 80,
        ssl: p.useSsl ?? false,
        enabled: p.enabled ?? true,
        sessions: 0,
        sessionTimeout: Math.round((p.sessionTimeout || 1440) / 60),
        idleTimeout: Math.round((p.idleTimeout || 30) / 60),
        vlans: [],
        status: p.enabled ? 'running' : 'stopped',
      })));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPortals(); // eslint-disable-line react-hooks/set-state-in-effect -- standard data-fetching pattern
  }, [fetchPortals]);

  const toggleEnabled = async (id: string) => {
    const portal = portals.find((p) => p.id === id);
    if (!portal) return;
    const { error } = await apiMutate(`/api/wifi/portal/instances/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ enabled: !portal.enabled }),
    });
    if (!error) {
      setPortals((prev) => prev.map((p) => (p.id === id ? { ...p, enabled: !p.enabled, status: !p.enabled ? 'running' : 'stopped' } : p)));
      toast({ title: 'Portal updated', description: `${portal.name} ${!portal.enabled ? 'enabled' : 'disabled'}` });
      onPortalsChanged?.();
    } else {
      toast({ title: 'Error', description: error, variant: 'destructive' });
    }
  };

  const deletePortal = async (id: string) => {
    const { error } = await apiMutate(`/api/wifi/portal/instances/${id}`, { method: 'DELETE' });
    if (!error) {
      toast({ title: 'Portal deleted', description: 'Portal instance deleted' });
      await fetchPortals();
      onPortalsChanged?.();
    } else {
      toast({ title: 'Error deleting portal', description: error || 'Failed to delete portal', variant: 'destructive' });
    }
  };

  const clonePortal = async (portal: PortalInstance) => {
    const { data, error } = await apiMutate<any>('/api/wifi/portal/instances', {
      method: 'POST',
      body: JSON.stringify({
        propertyId: propertyId || 'default',
        name: `${portal.name} (Copy)`,
        listenIp: portal.listenIP,
        listenPort: portal.port,
        useSsl: portal.ssl,
        sessionTimeout: portal.sessionTimeout * 60,
        idleTimeout: portal.idleTimeout * 60,
        enabled: false,
      }),
    });
    if (data) {
      toast({ title: 'Portal cloned', description: `Cloned as "${data.name}"` });
      await fetchPortals();
      onPortalsChanged?.();
    } else {
      toast({ title: 'Error cloning portal', description: error || 'Failed to clone portal', variant: 'destructive' });
    }
  };

  const addPortal = async () => {
    if (!newPortal.name) return;
    const { data, error } = await apiMutate<any>('/api/wifi/portal/instances', {
      method: 'POST',
      body: JSON.stringify({
        propertyId: propertyId || 'default',
        name: newPortal.name,
        listenIp: newPortal.listenIP,
        listenPort: newPortal.port,
        useSsl: newPortal.ssl,
        sslCertPath: newPortal.certPath || undefined,
        sslKeyPath: newPortal.keyPath || undefined,
        maxConcurrent: newPortal.maxConcurrent,
        sessionTimeout: newPortal.sessionTimeout * 60,
        idleTimeout: newPortal.idleTimeout * 60,
        enabled: true,
      }),
    });
    if (data) {
      toast({ title: 'Portal created', description: `Portal "${newPortal.name}" created` });
      await fetchPortals();
      onPortalsChanged?.();
      setAddOpen(false);
      setNewPortal({ name: '', listenIP: '192.168.1.1', port: 80, ssl: false, certPath: '', keyPath: '', maxConcurrent: 100, sessionTimeout: 1440, idleTimeout: 30 });
    } else {
      toast({ title: 'Error creating portal', description: error || 'Failed to create portal', variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 md:grid-cols-2"><Skeleton className="h-64 w-full" /><Skeleton className="h-64 w-full" /></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Master Switch */}
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-teal-100 dark:bg-teal-900/40">
            <Zap className="h-5 w-5 text-teal-600 dark:text-teal-400" />
          </div>
          <div>
            <p className="font-medium text-sm">System as Gateway</p>
            <p className="text-xs text-muted-foreground">Route all unauthenticated traffic through the captive portal</p>
          </div>
        </div>
        <Switch checked={systemGateway} onCheckedChange={setSystemGateway} />
      </div>

      {/* Portal Cards Grid */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{portals.length} portal instances</p>
        <Button onClick={() => setAddOpen(true)} className="bg-teal-600 hover:bg-teal-700">
          <Plus className="h-4 w-4 mr-2" />
          Add Portal
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {portals.map((portal) => (
          <Card key={portal.id} className={cn(!portal.enabled && 'opacity-60')}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn('p-2 rounded-lg', portal.status === 'running' ? 'bg-emerald-100 dark:bg-emerald-900/40' : 'bg-gray-100 dark:bg-gray-800')}>
                    <Monitor className={cn('h-5 w-5', portal.status === 'running' ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400')} />
                  </div>
                  <div>
                    <CardTitle className="text-base">{portal.name}</CardTitle>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">
                      {portal.listenIP}:{portal.port}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {portal.ssl && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 text-xs gap-1">
                          <Lock className="h-3 w-3" />SSL
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>HTTPS enabled</TooltipContent>
                    </Tooltip>
                  )}
                  <div className={cn('flex items-center gap-1 text-xs', portal.status === 'running' ? 'text-emerald-600' : 'text-gray-400')}>
                    {portal.status === 'running' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                    {portal.status === 'running' ? 'Running' : 'Stopped'}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-lg bg-muted/50 p-2">
                  <div className="text-lg font-bold">{portal.sessions}</div>
                  <div className="text-xs text-muted-foreground">Sessions</div>
                </div>
                <div className="rounded-lg bg-muted/50 p-2">
                  <div className="text-lg font-bold">{portal.sessionTimeout}m</div>
                  <div className="text-xs text-muted-foreground">Session</div>
                </div>
                <div className="rounded-lg bg-muted/50 p-2">
                  <div className="text-lg font-bold">{portal.idleTimeout}m</div>
                  <div className="text-xs text-muted-foreground">Idle</div>
                </div>
              </div>
              {portal.vlans.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {portal.vlans.map((v) => (
                    <Badge key={v} variant="outline" className="text-xs">{v}</Badge>
                  ))}
                </div>
              )}
              <Separator />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Enabled</Label>
                  <Switch checked={portal.enabled} onCheckedChange={() => toggleEnabled(portal.id)} />
                </div>
                <div className="flex gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8"><Edit2 className="h-3.5 w-3.5" /></Button>
                    </TooltipTrigger>
                    <TooltipContent>Edit</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => clonePortal(portal)}><Copy className="h-3.5 w-3.5" /></Button>
                    </TooltipTrigger>
                    <TooltipContent>Clone</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => deletePortal(portal.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </TooltipTrigger>
                    <TooltipContent>Delete</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add Portal Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Portal Instance</DialogTitle>
            <DialogDescription>Create a new captive portal instance</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="grid gap-4 py-4 pr-4">
              <div className="space-y-2">
                <Label>Portal Name *</Label>
                <Input placeholder="My Portal" value={newPortal.name} onChange={(e) => setNewPortal({ ...newPortal, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Listen IP</Label>
                  <Input placeholder="192.168.1.1" value={newPortal.listenIP} onChange={(e) => setNewPortal({ ...newPortal, listenIP: e.target.value })} className="font-mono" />
                </div>
                <div className="space-y-2">
                  <Label>Port</Label>
                  <Input type="number" value={newPortal.port} onChange={(e) => setNewPortal({ ...newPortal, port: parseInt(e.target.value) || 80 })} />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable SSL</Label>
                  <p className="text-xs text-muted-foreground">Require HTTPS for this portal</p>
                </div>
                <Switch checked={newPortal.ssl} onCheckedChange={(v) => setNewPortal({ ...newPortal, ssl: v })} />
              </div>
              {newPortal.ssl && (
                <>
                  <div className="space-y-2">
                    <Label>Certificate Path</Label>
                    <Input placeholder="/etc/ssl/certs/portal.crt" value={newPortal.certPath} onChange={(e) => setNewPortal({ ...newPortal, certPath: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Key Path</Label>
                    <Input placeholder="/etc/ssl/private/portal.key" value={newPortal.keyPath} onChange={(e) => setNewPortal({ ...newPortal, keyPath: e.target.value })} />
                  </div>
                </>
              )}
              <Separator />
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Max Concurrent</Label>
                  <Input type="number" value={newPortal.maxConcurrent} onChange={(e) => setNewPortal({ ...newPortal, maxConcurrent: parseInt(e.target.value) || 100 })} />
                </div>
                <div className="space-y-2">
                  <Label>Session Timeout (min)</Label>
                  <Input type="number" value={newPortal.sessionTimeout} onChange={(e) => setNewPortal({ ...newPortal, sessionTimeout: parseInt(e.target.value) || 1440 })} />
                </div>
                <div className="space-y-2">
                  <Label>Idle Timeout (min)</Label>
                  <Input type="number" value={newPortal.idleTimeout} onChange={(e) => setNewPortal({ ...newPortal, idleTimeout: parseInt(e.target.value) || 30 })} />
                </div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={addPortal} className="bg-teal-600 hover:bg-teal-700">Create Portal</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab 2: Portal Designer
// ═══════════════════════════════════════════════════════════════════════════════

function PortalDesignerTab({ portalOptions }: { portalOptions: string[] }) {
  const [portalSelect, setPortalSelect] = useState<string>(portalOptions[0] || '');
  const [language, setLanguage] = useState('English');
  const [designerTab, setDesignerTab] = useState<'content' | 'fields' | 'advanced'>('content');

  const [design, setDesign] = useState({
    title: 'Welcome to StaySuite',
    subtitle: 'Connect to our high-speed WiFi network',
    logoUrl: '',
    backgroundType: 'color' as 'color' | 'image',
    backgroundColor: '#0f766e',
    backgroundImageUrl: '',
    brandColor: '#14b8a6',
    textColor: '#ffffff',
    fields: { username: true, password: true, roomNumber: false, phone: false, voucherCode: true, termsCheckbox: true },
    socialLogin: { google: false, facebook: false, apple: false },
    customCSS: '/* Custom CSS */\n.portal-header {\n  text-align: center;\n}',
    customHTML: '<div class="legal-footer">\n  <p>&copy; 2025 StaySuite Hospitality</p>\n</div>',
  });

  const updateDesign = (partial: Partial<typeof design>) => setDesign((prev) => ({ ...prev, ...partial }));
  const updateFields = (field: string) => setDesign((prev) => ({ ...prev, fields: { ...prev.fields, [field]: !prev.fields[field as keyof typeof prev.fields] } }));
  const updateSocial = (provider: string) => setDesign((prev) => ({ ...prev, socialLogin: { ...prev.socialLogin, [provider]: !prev.socialLogin[provider as keyof typeof prev.socialLogin] } }));

  const resetDesign = () => {
    setDesign({
      title: 'Welcome to StaySuite',
      subtitle: 'Connect to our high-speed WiFi network',
      logoUrl: '',
      backgroundType: 'color',
      backgroundColor: '#0f766e',
      backgroundImageUrl: '',
      brandColor: '#14b8a6',
      textColor: '#ffffff',
      fields: { username: true, password: true, roomNumber: false, phone: false, voucherCode: true, termsCheckbox: true },
      socialLogin: { google: false, facebook: false, apple: false },
      customCSS: '/* Custom CSS */\n.portal-header {\n  text-align: center;\n}',
      customHTML: '<div class="legal-footer">\n  <p>&copy; 2025 StaySuite Hospitality</p>\n</div>',
    });
  };

  const activeFields = Object.entries(design.fields).filter(([, v]) => v).map(([k]) => k);

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Select value={portalSelect} onValueChange={setPortalSelect}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>{portalOptions.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>{LANGUAGES.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={resetDesign}>
            <Settings className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button variant="outline">
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
          <Button className="bg-teal-600 hover:bg-teal-700">
            <Download className="h-4 w-4 mr-2" />
            Save
          </Button>
        </div>
      </div>

      {/* Split Pane Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Live Preview */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Live Preview
              <Badge variant="outline" className="ml-auto text-xs">{language}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div
              className="w-full aspect-[9/16] max-h-[600px] relative overflow-hidden flex flex-col items-center justify-center"
              style={{
                background: design.backgroundType === 'color'
                  ? design.backgroundColor
                  : `url(${design.backgroundImageUrl || 'linear-gradient(135deg, #0f766e, #14b8a6)'})`,
                color: design.textColor,
              }}
            >
              {/* Logo placeholder */}
              {design.logoUrl ? (
                <img src={design.logoUrl} alt="Logo" className="w-16 h-16 rounded-xl object-cover mb-4 bg-white/20" />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center mb-4">
                  <Upload className="h-6 w-6 text-white/60" />
                </div>
              )}
              <h2 className="text-2xl font-bold text-center px-8">{design.title}</h2>
              <p className="text-sm opacity-80 mt-2 text-center px-8">{design.subtitle}</p>
              <div className="mt-8 w-72 space-y-3">
                {design.fields.username && (
                  <div className="rounded-lg bg-white/20 backdrop-blur-sm border border-white/10 px-4 py-2.5">
                    <span className="text-sm text-white/60">Username or Email</span>
                  </div>
                )}
                {design.fields.password && (
                  <div className="rounded-lg bg-white/20 backdrop-blur-sm border border-white/10 px-4 py-2.5">
                    <span className="text-sm text-white/60">Password</span>
                  </div>
                )}
                {design.fields.roomNumber && (
                  <div className="rounded-lg bg-white/20 backdrop-blur-sm border border-white/10 px-4 py-2.5">
                    <span className="text-sm text-white/60">Room Number</span>
                  </div>
                )}
                {design.fields.phone && (
                  <div className="rounded-lg bg-white/20 backdrop-blur-sm border border-white/10 px-4 py-2.5">
                    <span className="text-sm text-white/60">Phone Number</span>
                  </div>
                )}
                {design.fields.voucherCode && (
                  <div className="rounded-lg bg-white/20 backdrop-blur-sm border border-white/10 px-4 py-2.5">
                    <span className="text-sm text-white/60">Voucher Code</span>
                  </div>
                )}
                <button
                  className="w-full py-2.5 rounded-lg text-white font-medium text-sm transition-all"
                  style={{ backgroundColor: design.brandColor }}
                >
                  Connect to WiFi
                </button>
                {(design.socialLogin.google || design.socialLogin.facebook || design.socialLogin.apple) && (
                  <div className="flex gap-2">
                    {design.socialLogin.google && <div className="flex-1 h-9 rounded-lg bg-white/20 backdrop-blur text-center leading-9 text-xs">Google</div>}
                    {design.socialLogin.facebook && <div className="flex-1 h-9 rounded-lg bg-white/20 backdrop-blur text-center leading-9 text-xs">Facebook</div>}
                    {design.socialLogin.apple && <div className="flex-1 h-9 rounded-lg bg-white/20 backdrop-blur text-center leading-9 text-xs">Apple</div>}
                  </div>
                )}
                {design.fields.termsCheckbox && (
                  <p className="text-xs text-center opacity-60 mt-2">
                    By connecting, you agree to the Terms of Service
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right: Controls */}
        <div className="space-y-4">
          {/* Sub-tabs */}
          <div className="flex border-b border-border">
            {(['content', 'fields', 'advanced'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setDesignerTab(t)}
                className={cn(
                  'px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize',
                  designerTab === t
                    ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                {t}
              </button>
            ))}
          </div>

          <ScrollArea className="max-h-[560px]">
            <div className="space-y-4 pr-3">
              {designerTab === 'content' && (
                <>
                  <Card>
                    <CardHeader className="pb-3"><CardTitle className="text-sm">Title & Branding</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label>Title</Label>
                        <Input value={design.title} onChange={(e) => updateDesign({ title: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Subtitle</Label>
                        <Input value={design.subtitle} onChange={(e) => updateDesign({ subtitle: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label>Logo URL</Label>
                        <div className="flex gap-2">
                          <Input placeholder="https://..." value={design.logoUrl} onChange={(e) => updateDesign({ logoUrl: e.target.value })} />
                          <Button variant="outline" size="icon"><Upload className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-3"><CardTitle className="text-sm">Appearance</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label>Background Type</Label>
                        <Select value={design.backgroundType} onValueChange={(v: 'color' | 'image') => updateDesign({ backgroundType: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="color">Solid Color</SelectItem>
                            <SelectItem value="image">Image URL</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {design.backgroundType === 'color' ? (
                        <div className="space-y-2">
                          <Label>Background Color</Label>
                          <div className="flex items-center gap-2">
                            <input type="color" value={design.backgroundColor} onChange={(e) => updateDesign({ backgroundColor: e.target.value })} className="h-10 w-14 rounded border cursor-pointer" />
                            <Input value={design.backgroundColor} onChange={(e) => updateDesign({ backgroundColor: e.target.value })} className="font-mono" />
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Label>Background Image URL</Label>
                          <Input placeholder="https://..." value={design.backgroundImageUrl} onChange={(e) => updateDesign({ backgroundImageUrl: e.target.value })} />
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Brand Color</Label>
                          <div className="flex items-center gap-2">
                            <input type="color" value={design.brandColor} onChange={(e) => updateDesign({ brandColor: e.target.value })} className="h-10 w-14 rounded border cursor-pointer" />
                            <Input value={design.brandColor} onChange={(e) => updateDesign({ brandColor: e.target.value })} className="font-mono" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Text Color</Label>
                          <div className="flex items-center gap-2">
                            <input type="color" value={design.textColor} onChange={(e) => updateDesign({ textColor: e.target.value })} className="h-10 w-14 rounded border cursor-pointer" />
                            <Input value={design.textColor} onChange={(e) => updateDesign({ textColor: e.target.value })} className="font-mono" />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}

              {designerTab === 'fields' && (
                <>
                  <Card>
                    <CardHeader className="pb-3"><CardTitle className="text-sm">Login Form Fields</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      {[
                        { key: 'username', label: 'Username / Email', icon: User },
                        { key: 'password', label: 'Password', icon: Lock },
                        { key: 'roomNumber', label: 'Room Number', icon: Building },
                        { key: 'phone', label: 'Phone Number', icon: Smartphone },
                        { key: 'voucherCode', label: 'Voucher Code', icon: Ticket },
                        { key: 'termsCheckbox', label: 'Terms & Conditions', icon: Settings },
                      ].map(({ key, label, icon: Icon }) => (
                        <div key={key} className="flex items-center justify-between py-2">
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{label}</span>
                          </div>
                          <Switch checked={design.fields[key as keyof typeof design.fields]} onCheckedChange={() => updateFields(key)} />
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-3"><CardTitle className="text-sm">Social Login Providers</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      {[
                        { key: 'google', label: 'Google', color: 'text-red-500' },
                        { key: 'facebook', label: 'Facebook', color: 'text-blue-500' },
                        { key: 'apple', label: 'Apple', color: 'text-gray-800 dark:text-gray-200' },
                      ].map(({ key, label, color }) => (
                        <div key={key} className="flex items-center justify-between py-2">
                          <div className="flex items-center gap-2">
                            <Share2 className={cn('h-4 w-4', color)} />
                            <span className="text-sm">{label}</span>
                          </div>
                          <Switch checked={design.socialLogin[key as keyof typeof design.socialLogin]} onCheckedChange={() => updateSocial(key)} />
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                  <div className="text-xs text-muted-foreground">
                    Active fields: {activeFields.length > 0 ? activeFields.join(', ') : 'None'}
                  </div>
                </>
              )}

              {designerTab === 'advanced' && (
                <>
                  <Card>
                    <CardHeader className="pb-3"><CardTitle className="text-sm">Custom CSS</CardTitle></CardHeader>
                    <CardContent>
                      <Textarea
                        value={design.customCSS}
                        onChange={(e) => updateDesign({ customCSS: e.target.value })}
                        className="font-mono text-xs min-h-[180px] resize-y"
                        placeholder="/* Custom CSS here */"
                      />
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-3"><CardTitle className="text-sm">Custom HTML Injection</CardTitle></CardHeader>
                    <CardContent>
                      <Textarea
                        value={design.customHTML}
                        onChange={(e) => updateDesign({ customHTML: e.target.value })}
                        className="font-mono text-xs min-h-[120px] resize-y"
                        placeholder="<!-- Custom HTML -->"
                      />
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab 3: Portal Mapping
// ═══════════════════════════════════════════════════════════════════════════════

interface PortalMapping {
  id: string;
  ssid: string;
  vlan: string;
  subnet: string;
  portal: string;
  priority: number;
  fallback: string | null;
}

function PortalMappingTab({ portalOptions }: { portalOptions: string[] }) {
  const [mappings, setMappings] = useState<PortalMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [newMapping, setNewMapping] = useState({ ssid: '', vlan: 'VLAN 10', subnet: '', portal: portalOptions[0] || '', fallback: 'None' });
  const { toast } = useToast();
  const { propertyId } = usePropertyId();

  const fetchMappings = useCallback(async () => {
    setLoading(true);
    const data = await apiFetch<any[]>('/api/wifi/portal/mappings');
    if (data) {
      setMappings(data.map((m: any) => ({
        id: m.id,
        ssid: m.ssid || '',
        vlan: m.vlanId ? `VLAN ${m.vlanId}` : VLAN_OPTIONS[0],
        subnet: m.subnet || '',
        portal: m.captivePortal?.name || '',
        priority: m.priority,
        fallback: null,
      })));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchMappings(); // eslint-disable-line react-hooks/set-state-in-effect -- standard data-fetching pattern
  }, [fetchMappings]);

  const hasConflict = (ssid: string) => {
    const activeForSsid = mappings.filter((m) => m.ssid === ssid);
    const uniquePortals = new Set(activeForSsid.map((m) => m.portal));
    return uniquePortals.size > 1;
  };

  const updatePortal = async (id: string, portalName: string) => {
    // Find portal ID by name from instances
    const { data: instances } = await apiFetch<any[]>('/api/wifi/portal/instances');
    if (!instances) return;
    const portal = instances.find((p: any) => p.name === portalName);
    if (!portal) return;
    const { error } = await apiMutate(`/api/wifi/portal/mappings/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ portalId: portal.id }),
    });
    if (!error) {
      setMappings((prev) => prev.map((m) => (m.id === id ? { ...m, portal: portalName } : m)));
      toast({ title: 'Mapping updated', description: `Portal updated to ${portalName}` });
    } else {
      toast({ title: 'Error', description: error, variant: 'destructive' });
    }
  };

  const addMapping = async () => {
    if (!newMapping.ssid || !newMapping.subnet) return;
    const { data: instances } = await apiFetch<any[]>('/api/wifi/portal/instances');
    const portal = instances?.find((p: any) => p.name === newMapping.portal);
    const fallbackPortal = newMapping.fallback !== 'None' ? instances?.find((p: any) => p.name === newMapping.fallback) : null;
    const { data, error } = await apiMutate<any>('/api/wifi/portal/mappings', {
      method: 'POST',
      body: JSON.stringify({
        propertyId: propertyId || 'default',
        portalId: portal?.id,
        vlanId: parseInt(newMapping.vlan.replace('VLAN ', ''), 10),
        ssid: newMapping.ssid,
        subnet: newMapping.subnet,
        priority: mappings.length + 1,
        fallbackPortalId: fallbackPortal?.id || null,
      }),
    });
    if (data) {
      toast({ title: 'Mapping created', description: `SSID "${newMapping.ssid}" mapped` });
      await fetchMappings();
      setAddOpen(false);
      setNewMapping({ ssid: '', vlan: 'VLAN 10', subnet: '', portal: portalOptions[0] || '', fallback: 'None' });
    } else {
      toast({ title: 'Error creating mapping', description: error || 'Failed to create mapping', variant: 'destructive' });
    }
  };

  const deleteMapping = async (id: string) => {
    const { error } = await apiMutate(`/api/wifi/portal/mappings/${id}`, { method: 'DELETE' });
    if (!error) {
      toast({ title: 'Mapping deleted', description: 'Portal mapping deleted' });
      await fetchMappings();
    } else {
      toast({ title: 'Error deleting mapping', description: error || 'Failed to delete mapping', variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Card><CardContent className="p-6 space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{mappings.length} SSID-to-Portal mappings</p>
        <Button onClick={() => setAddOpen(true)} className="bg-teal-600 hover:bg-teal-700">
          <Plus className="h-4 w-4 mr-2" />
          Add Mapping
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SSID</TableHead>
                <TableHead>VLAN</TableHead>
                <TableHead>Subnet</TableHead>
                <TableHead>Portal</TableHead>
                <TableHead>Fallback</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mappings.map((mapping) => {
                const conflict = hasConflict(mapping.ssid);
                return (
                  <TableRow key={mapping.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {conflict && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" />
                            </TooltipTrigger>
                            <TooltipContent>Conflict: Same SSID maps to multiple active portals</TooltipContent>
                          </Tooltip>
                        )}
                        <span className={cn('font-medium text-sm', conflict && 'text-amber-600')}>
                          {mapping.ssid}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{mapping.vlan}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{mapping.subnet}</TableCell>
                    <TableCell>
                      <Select value={mapping.portal} onValueChange={(v) => updatePortal(mapping.id, v)}>
                        <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                        <SelectContent>{portalOptions.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{mapping.fallback ?? '—'}</TableCell>
                    <TableCell className="font-mono text-sm">{mapping.priority}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => deleteMapping(mapping.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Mapping Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Portal Mapping</DialogTitle>
            <DialogDescription>Map an SSID/VLAN to a captive portal</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>SSID Name *</Label>
              <Input placeholder="MyNetwork-Guest" value={newMapping.ssid} onChange={(e) => setNewMapping({ ...newMapping, ssid: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>VLAN</Label>
                <Select value={newMapping.vlan} onValueChange={(v) => setNewMapping({ ...newMapping, vlan: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{VLAN_OPTIONS.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Subnet *</Label>
                <Input placeholder="192.168.1.0/24" value={newMapping.subnet} onChange={(e) => setNewMapping({ ...newMapping, subnet: e.target.value })} className="font-mono" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Portal</Label>
              <Select value={newMapping.portal} onValueChange={(v) => setNewMapping({ ...newMapping, portal: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{portalOptions.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fallback Portal</Label>
              <Select value={newMapping.fallback} onValueChange={(v) => setNewMapping({ ...newMapping, fallback: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="None">None</SelectItem>
                  {portalOptions.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={addMapping} className="bg-teal-600 hover:bg-teal-700">Add Mapping</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab 4: Auth Methods
// ═══════════════════════════════════════════════════════════════════════════════

interface AuthMethod {
  id: string;
  name: string;
  icon: typeof Ticket;
  color: string;
  enabled: boolean;
  priority: number;
  config: Record<string, any>;
}

function AuthMethodsTab({ portalOptions }: { portalOptions: string[] }) {
  const [portalSelect, setPortalSelect] = useState<string>(portalOptions[0] || '');
  const [methods, setMethods] = useState<AuthMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchMethods = useCallback(async () => {
    setLoading(true);
    const data = await apiFetch<any[]>('/api/wifi/portal/auth-methods');
    if (data) {
      setMethods(data.map((m: any) => {
        const meta = AUTH_METHOD_META[m.method] || { icon: Lock, color: 'bg-gray-500', displayName: m.method };
        let config: Record<string, any> = {};
        try {
          config = typeof m.config === 'string' ? JSON.parse(m.config) : (m.config || {});
        } catch { /* use empty config */ }
        return {
          id: m.id,
          name: meta.displayName,
          icon: meta.icon,
          color: meta.color,
          enabled: m.enabled ?? true,
          priority: m.priority,
          config,
        };
      }));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchMethods(); // eslint-disable-line react-hooks/set-state-in-effect -- standard data-fetching pattern
  }, [fetchMethods]);

  const toggleMethod = async (id: string) => {
    const method = methods.find((m) => m.id === id);
    if (!method) return;
    const { error } = await apiMutate(`/api/wifi/portal/auth-methods/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ enabled: !method.enabled }),
    });
    if (!error) {
      setMethods((prev) => prev.map((m) => (m.id === id ? { ...m, enabled: !m.enabled } : m)));
      toast({ title: 'Method updated', description: `${method.name} ${!method.enabled ? 'enabled' : 'disabled'}` });
    } else {
      toast({ title: 'Error', description: error, variant: 'destructive' });
    }
  };

  const moveUp = async (index: number) => {
    if (index === 0) return;
    const arr = [...methods];
    [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
    const updated = arr.map((m, i) => ({ ...m, priority: i + 1 }));
    setMethods(updated);
    for (const m of updated) {
      await apiMutate(`/api/wifi/portal/auth-methods/${m.id}`, {
        method: 'PUT',
        body: JSON.stringify({ priority: m.priority }),
      });
    }
  };

  const moveDown = async (index: number) => {
    if (index === methods.length - 1) return;
    const arr = [...methods];
    [arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];
    const updated = arr.map((m, i) => ({ ...m, priority: i + 1 }));
    setMethods(updated);
    for (const m of updated) {
      await apiMutate(`/api/wifi/portal/auth-methods/${m.id}`, {
        method: 'PUT',
        body: JSON.stringify({ priority: m.priority }),
      });
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full max-w-md" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"><Skeleton className="h-64 w-full" /><Skeleton className="h-64 w-full" /><Skeleton className="h-64 w-full" /></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Portal Selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Label className="text-sm font-medium">Authenticating for:</Label>
          <Select value={portalSelect} onValueChange={setPortalSelect}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>{portalOptions.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <p className="text-sm text-muted-foreground">
          {methods.filter((m) => m.enabled).length} of {methods.length} methods active
        </p>
      </div>

      {/* Auth Method Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {methods.map((method, index) => {
          const Icon = method.icon;
          return (
            <Card key={method.id} className={cn(!method.enabled && 'opacity-50')}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn('p-2.5 rounded-lg text-white', method.color)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-sm">{method.name}</CardTitle>
                      <p className="text-xs text-muted-foreground">Priority #{method.priority}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant={method.enabled ? 'default' : 'secondary'} className={cn('text-xs', method.enabled && 'bg-teal-600')}>
                      {method.enabled ? 'Active' : 'Disabled'}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Method-specific config display */}
                <div className="rounded-lg bg-muted/50 p-3 space-y-1.5 text-xs">
                  {method.name === 'Voucher' && (
                    <>
                      <div className="flex justify-between"><span className="text-muted-foreground">Length</span><span className="font-mono">{method.config.length} chars</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Prefix</span><span className="font-mono">{method.config.prefix}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Charset</span><span className="font-mono">{method.config.charset}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Expiry</span><span className="font-mono">{method.config.expiry} min</span></div>
                    </>
                  )}
                  {method.name === 'Room Number' && (
                    <>
                      <div className="flex justify-between"><span className="text-muted-foreground">Require Name</span><span className="font-mono">{method.config.requireName ? 'Yes' : 'No'}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">PMS Auto-fill</span><span className="font-mono">{method.config.autoFillFromPMS ? 'Yes' : 'No'}</span></div>
                    </>
                  )}
                  {method.name === 'PMS Credentials' && (
                    <>
                      <div className="flex justify-between"><span className="text-muted-foreground">Username Field</span><span className="font-mono">{method.config.usernameField}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Password Field</span><span className="font-mono">{method.config.passwordField}</span></div>
                    </>
                  )}
                  {method.name === 'SMS OTP' && (
                    <>
                      <div className="flex justify-between"><span className="text-muted-foreground">OTP Length</span><span className="font-mono">{method.config.otpLength} digits</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Expiry</span><span className="font-mono">{method.config.expiry}s</span></div>
                      <div className="text-muted-foreground mt-1">Template: <code className="font-mono text-[10px]">{method.config.smsTemplate}</code></div>
                    </>
                  )}
                  {method.name === 'Social Login' && (
                    <>
                      <div className="flex justify-between"><span className="text-muted-foreground">Google Client ID</span><span className="font-mono">{method.config.googleClientId || 'Not set'}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Facebook App ID</span><span className="font-mono">{method.config.facebookAppId || 'Not set'}</span></div>
                    </>
                  )}
                  {method.name === 'MAC Auth' && (
                    <>
                      <div className="flex justify-between"><span className="text-muted-foreground">Auto-register</span><span className="font-mono">{method.config.autoRegister ? 'Yes' : 'No'}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Approval</span><span className="font-mono">{method.config.approvalMode}</span></div>
                    </>
                  )}
                  {method.name === 'Open Access' && (
                    <>
                      <div className="flex justify-between"><span className="text-muted-foreground">Data Limit</span><span className="font-mono">{method.config.dataLimit} MB</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Time Limit</span><span className="font-mono">{method.config.timeLimit} min</span></div>
                    </>
                  )}
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveUp(index)} disabled={index === 0}>
                      <ArrowUpDown className="h-3 w-3 rotate-180" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => moveDown(index)} disabled={index === methods.length - 1}>
                      <ArrowUpDown className="h-3 w-3" />
                    </Button>
                  </div>
                  <Switch checked={method.enabled} onCheckedChange={() => toggleMethod(method.id)} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab 5: Templates
// ═══════════════════════════════════════════════════════════════════════════════

interface Template {
  id: string;
  name: string;
  category: string;
  gradient: string;
}

function TemplatesTab() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    const data = await apiFetch<any[]>('/api/wifi/portal/templates?includeBuiltIn=true');
    if (data) {
      setTemplates(data.map((t: any, i: number) => ({
        id: t.id,
        name: t.name,
        category: t.category || 'Custom',
        gradient: TEMPLATE_GRADIENTS[t.category?.toLowerCase()] || DEFAULT_GRADIENTS[i % DEFAULT_GRADIENTS.length],
      })));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTemplates(); // eslint-disable-line react-hooks/set-state-in-effect -- standard data-fetching pattern
  }, [fetchTemplates]);

  const openPreview = (template: Template) => {
    setSelectedTemplate(template);
    setPreviewOpen(true);
  };

  const categories = [...new Set(templates.map((t) => t.category))];

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <div className="flex flex-wrap gap-2"><Skeleton className="h-6 w-24" /><Skeleton className="h-6 w-24" /><Skeleton className="h-6 w-24" /></div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Skeleton className="h-64 w-full" /><Skeleton className="h-64 w-full" /><Skeleton className="h-64 w-full" /></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{templates.length} templates available across {categories.length} categories</p>
        <Button variant="outline">
          <Upload className="h-4 w-4 mr-2" />
          Upload Custom
        </Button>
      </div>

      {/* Category Chips */}
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <Badge
            key={cat}
            variant="secondary"
            className={cn('text-xs cursor-pointer hover:opacity-80', categoryColors[cat])}
          >
            {cat} ({templates.filter((t) => t.category === cat).length})
          </Badge>
        ))}
      </div>

      {/* Template Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((template) => (
          <Card key={template.id} className="group overflow-hidden">
            {/* Thumbnail */}
            <div className={cn('relative h-40 bg-gradient-to-br', template.gradient)}>
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />
              <div className="absolute bottom-3 left-3">
                <Badge className={cn('text-xs', categoryColors[template.category])} variant="secondary">
                  {template.category}
                </Badge>
              </div>
            </div>
            <CardContent className="p-4 space-y-3">
              <h3 className="font-medium text-sm">{template.name}</h3>
              <div className="flex gap-2">
                <Button size="sm" className="flex-1 bg-teal-600 hover:bg-teal-700 text-xs h-8">
                  Use Template
                </Button>
                <Button size="sm" variant="outline" className="flex-1 text-xs h-8" onClick={() => openPreview(template)}>
                  <Eye className="h-3 w-3 mr-1" />
                  Preview
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Template Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedTemplate?.name}</DialogTitle>
            <DialogDescription>
              <Badge className={cn('text-xs mt-1', selectedTemplate ? categoryColors[selectedTemplate.category] : '')} variant="secondary">
                {selectedTemplate?.category}
              </Badge>
            </DialogDescription>
          </DialogHeader>
          {selectedTemplate && (
            <div className="space-y-4">
              <div className={cn('h-64 rounded-lg bg-gradient-to-br relative overflow-hidden', selectedTemplate.gradient)}>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                  <div className="w-16 h-16 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center mb-4">
                    <Monitor className="h-8 w-8" />
                  </div>
                  <h3 className="text-xl font-bold">{selectedTemplate.name}</h3>
                  <p className="text-sm opacity-80 mt-1">Captive Portal Preview</p>
                  <button className="mt-6 px-6 py-2 rounded-lg bg-white/20 backdrop-blur text-sm font-medium">
                    Connect to WiFi
                  </button>
                </div>
              </div>
              <div className="flex gap-2">
                <Button className="flex-1 bg-teal-600 hover:bg-teal-700">
                  Use This Template
                </Button>
                <Button variant="outline" onClick={() => setPreviewOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
