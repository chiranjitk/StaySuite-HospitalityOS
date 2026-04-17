'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
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
import {
  RadioGroup,
  RadioGroupItem,
} from '@/components/ui/radio-group';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldBan,
  Lock,
  Unlock,
  Network,
  Wifi,
  Activity,
  Globe,
  Gauge,
  TrendingUp,
  TrendingDown,
  Plus,
  Edit2,
  Trash2,
  Search,
  Filter,
  ChevronUp,
  ChevronDown,
  RefreshCw,
  Zap,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  Users,
  ArrowUpDown,
  Eye,
  Monitor,
  Ban,
  BarChart3,
  Download,
  Upload,
  Loader2,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { usePropertyId } from '@/hooks/use-property';

// ─── Types ───────────────────────────────────────────────────────

interface FirewallZone {
  id: string;
  name: string;
  interfaces: string[];
  inputPolicy: 'accept' | 'drop' | 'reject';
  forwardPolicy: 'accept' | 'drop' | 'reject';
  outputPolicy: 'accept' | 'drop' | 'reject';
  masquerade: boolean;
  enabled: boolean;
}

interface FirewallRule {
  id: string;
  priority: number;
  zone: string;
  chain: 'input' | 'forward' | 'output';
  protocol: 'tcp' | 'udp' | 'icmp' | 'all';
  source: string;
  dest: string;
  ports: string;
  action: 'accept' | 'drop' | 'reject' | 'log';
  logPrefix: string;
  schedule: string;
  comment: string;
  enabled: boolean;
}

interface MacEntry {
  id: string;
  mac: string;
  description: string;
  listType: 'whitelist' | 'blacklist';
  linkedType: 'guest' | 'device' | 'staff';
  expires: string;
  status: 'active' | 'expired' | 'disabled';
}

interface BandwidthPolicy {
  id: string;
  name: string;
  downloadKbps: number;
  uploadKbps: number;
  burstDownKbps: number;
  burstUpKbps: number;
  priority: number;
  linkedPlan: string;
  enabled: boolean;
}

interface BandwidthUser {
  id: string;
  username: string;
  ip: string;
  mac: string;
  plan: string;
  downloadSpeed: number;
  uploadSpeed: number;
  sessionTime: number;
  dataDown: number;
  dataUp: number;
}

interface BandwidthPool {
  id: string;
  name: string;
  vlan: string;
  totalDownKbps: number;
  totalUpKbps: number;
  usedDownKbps: number;
  usedUpKbps: number;
  perUserDownKbps: number;
  perUserUpKbps: number;
  activeUsers: number;
}

interface TimeSchedule {
  id: string;
  name: string;
  days: boolean[];
  startTime: string;
  endTime: string;
  linkedRuleCount: number;
  enabled: boolean;
}

// ─── Constants ───────────────────────────────────────────────────

const WIFI_PLANS = ['Free WiFi', 'Basic Plan', 'Standard Plan', 'Premium Plan', 'VIP Suite Plan', 'None'];
const INTERFACES = ['eth0', 'eth1', 'eth2', 'br-lan', 'wlan0', 'wlan0-guest', 'ppp0', 'vlan20', 'vlan30'];
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ─── API Helpers ─────────────────────────────────────────────────

function apiFetch<T>(url: string, options?: RequestInit): Promise<{ success: boolean; data?: T; error?: { message: string } }> {
  return fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  }).then(async (res) => {
    const result = await res.json();
    if (!res.ok) {
      throw new Error(result.error?.message || `Request failed (${res.status})`);
    }
    return result;
  });
}

function mapZoneFromApi(d: Record<string, unknown>): FirewallZone {
  return {
    id: d.id as string,
    name: d.name as string,
    interfaces: typeof d.interfaces === 'string' ? JSON.parse(d.interfaces) : (d.interfaces as string[] || []),
    inputPolicy: (d.inputPolicy as FirewallZone['inputPolicy']) || 'accept',
    forwardPolicy: (d.forwardPolicy as FirewallZone['forwardPolicy']) || 'accept',
    outputPolicy: (d.outputPolicy as FirewallZone['outputPolicy']) || 'accept',
    masquerade: !!(d.masquerade),
    enabled: !!(d.enabled),
  };
}

function mapRuleFromApi(d: Record<string, unknown>): FirewallRule {
  return {
    id: d.id as string,
    priority: (d.priority as number) || 0,
    zone: ((d.firewallZone as Record<string, unknown>)?.name || d.zoneId || d.zone || '') as string,
    chain: (d.chain as FirewallRule['chain']) || 'input',
    protocol: (d.protocol as FirewallRule['protocol']) || 'all',
    source: (d.sourceIp || d.source || '') as string,
    dest: (d.destIp || d.dest || '') as string,
    ports: (d.destPort ? String(d.destPort) : d.ports || '') as string,
    action: (d.action as FirewallRule['action']) || 'accept',
    logPrefix: (d.logPrefix || '') as string,
    schedule: ((d.schedule as Record<string, unknown>)?.name || d.scheduleId || 'Always') as string,
    comment: (d.comment || '') as string,
    enabled: !!(d.enabled),
  };
}

function mapMacFromApi(d: Record<string, unknown>): MacEntry {
  const expiresAt = d.expiresAt ? new Date(d.expiresAt as string) : null;
  const now = new Date();
  let status: MacEntry['status'] = 'active';
  if (d.enabled === false) status = 'disabled';
  else if (expiresAt && expiresAt < now) status = 'expired';
  return {
    id: d.id as string,
    mac: (d.macAddress || d.mac || '') as string,
    description: (d.description || '') as string,
    listType: (d.listType as MacEntry['listType']) || 'blacklist',
    linkedType: (d.linkedType as MacEntry['linkedType']) || 'device',
    expires: expiresAt ? expiresAt.toISOString().split('T')[0] : 'Never',
    status,
  };
}

function mapPolicyFromApi(d: Record<string, unknown>): BandwidthPolicy {
  return {
    id: d.id as string,
    name: (d.name || '') as string,
    downloadKbps: (d.downloadLimit || d.downloadKbps || 0) as number,
    uploadKbps: (d.uploadLimit || d.uploadKbps || 0) as number,
    burstDownKbps: (d.burstDownloadLimit || d.burstDownKbps || 0) as number,
    burstUpKbps: (d.burstUploadLimit || d.burstUpKbps || 0) as number,
    priority: (d.priority || 0) as number,
    linkedPlan: ((d.wifiPlan as Record<string, unknown>)?.name || d.linkedPlan || d.planId || '') as string,
    enabled: !!(d.enabled),
  };
}

function mapPoolFromApi(d: Record<string, unknown>): BandwidthPool {
  return {
    id: d.id as string,
    name: (d.name || '') as string,
    vlan: ((d.vlan as Record<string, unknown>)?.vlanId || d.vlanId || d.vlan || '') as string,
    totalDownKbps: (d.totalDownKbps || d.totalDownloadLimit || 0) as number,
    totalUpKbps: (d.totalUpKbps || d.totalUploadLimit || 0) as number,
    usedDownKbps: (d.usedDownKbps || d.currentDownKbps || 0) as number,
    usedUpKbps: (d.usedUpKbps || d.currentUpKbps || 0) as number,
    perUserDownKbps: (d.perUserDownKbps || d.perUserDownloadLimit || 0) as number,
    perUserUpKbps: (d.perUserUpKbps || d.perUserUploadLimit || 0) as number,
    activeUsers: (d.activeUsers || d.currentUsers || 0) as number,
  };
}

function mapScheduleFromApi(d: Record<string, unknown>): TimeSchedule {
  return {
    id: d.id as string,
    name: (d.name || '') as string,
    days: typeof d.days === 'string' ? JSON.parse(d.days) : (d.days || [true, true, true, true, true, true, true]) as boolean[],
    startTime: (d.startTime || '00:00') as string,
    endTime: (d.endTime || '23:59') as string,
    linkedRuleCount: (d.linkedRuleCount || 0) as number,
    enabled: !!(d.enabled),
  };
}

function mapSessionFromApi(d: Record<string, unknown>): BandwidthUser {
  return {
    id: d.id as string,
    username: (d.username || '') as string,
    ip: (d.ipAddress || d.ip || '') as string,
    mac: (d.macAddress || d.mac || '') as string,
    plan: ((d.wifiPlan as Record<string, unknown>)?.name || d.planName || '') as string,
    downloadSpeed: (d.downloadSpeed || 0) as number,
    uploadSpeed: (d.uploadSpeed || 0) as number,
    sessionTime: (d.durationSeconds || 0) as number,
    dataDown: Math.round((d.downloadBytes || 0) as number / 1024 / 1024),
    dataUp: Math.round((d.uploadBytes || 0) as number / 1024 / 1024),
  };
}

// ─── Loading Skeleton ────────────────────────────────────────────

function TabSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-9 w-24" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-9 w-9 rounded-lg" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-24 mb-1" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function TableSkeleton({ cols = 6, rows = 5 }: { cols?: number; rows?: number }) {
  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {Array.from({ length: cols }).map((_, i) => (
                  <TableHead key={i}>
                    <Skeleton className="h-4 w-16" />
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: rows }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: cols }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full max-w-20" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Component ───────────────────────────────────────────────────

export default function FirewallPage() {
  const [activeTab, setActiveTab] = useState(0);
  const tabs = [
    { label: 'Zones', icon: Shield },
    { label: 'Rules', icon: ShieldCheck },
    { label: 'MAC Filter', icon: ShieldBan },
    { label: 'BW Policies', icon: Gauge },
    { label: 'BW Monitor', icon: BarChart3 },
    { label: 'Schedules', icon: Clock },
    { label: 'Content Filtering', icon: ShieldAlert },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Shield className="h-6 w-6 text-teal-600" />
          Firewall & Bandwidth
        </h2>
        <p className="text-muted-foreground">
          Zone-based firewall, traffic shaping, MAC filtering, and real-time bandwidth monitoring
        </p>
      </div>

      {/* Custom Tabs */}
      <div className="flex gap-1 bg-muted/50 p-1 rounded-lg overflow-x-auto">
        {tabs.map((tab, idx) => {
          const Icon = tab.icon;
          return (
            <button
              key={idx}
              onClick={() => setActiveTab(idx)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all whitespace-nowrap',
                activeTab === idx
                  ? 'bg-background text-foreground shadow-sm border border-border'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 0 && <ZonesTab />}
      {activeTab === 1 && <RulesTab />}
      {activeTab === 2 && <MacFilterTab />}
      {activeTab === 3 && <BwPoliciesTab />}
      {activeTab === 4 && <BwMonitorTab />}
      {activeTab === 5 && <SchedulesTab />}
      {activeTab === 6 && <ContentFilterTab />}
    </div>
  );
}

function PolicyBadge({ policy }: { policy: string }) {
  const colors: Record<string, string> = {
    accept: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    drop: 'bg-red-100 text-red-700 border-red-200',
    reject: 'bg-orange-100 text-orange-700 border-orange-200',
  };
  return (
    <Badge variant="outline" className={cn('text-xs font-mono', colors[policy] || '')}>
      {policy.toUpperCase()}
    </Badge>
  );
}

// ─── Tab 1: Firewall Zones ───────────────────────────────────────

function ZonesTab() {
  const { toast } = useToast();
  const [zones, setZones] = useState<FirewallZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<FirewallZone | null>(null);
  const [form, setForm] = useState({
    name: '',
    interfaces: [] as string[],
    inputPolicy: 'accept' as const,
    forwardPolicy: 'accept' as const,
    outputPolicy: 'accept' as const,
    masquerade: false,
    enabled: true,
  });

  const fetchZones = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch<Record<string, unknown>[]>('/api/wifi/firewall/zones');
      if (res.success && res.data) {
        setZones(res.data.map(mapZoneFromApi));
      }
    } catch (e) {
      console.error(e);
      toast({ title: 'Error', description: 'Failed to load firewall zones', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchZones(); }, [fetchZones]);

  const openAdd = () => {
    setEditingZone(null);
    setForm({ name: '', interfaces: [], inputPolicy: 'accept', forwardPolicy: 'accept', outputPolicy: 'accept', masquerade: false, enabled: true });
    setDialogOpen(true);
  };

  const openEdit = (z: FirewallZone) => {
    setEditingZone(z);
    setForm({ name: z.name, interfaces: z.interfaces, inputPolicy: z.inputPolicy, forwardPolicy: z.forwardPolicy, outputPolicy: z.outputPolicy, masquerade: z.masquerade, enabled: z.enabled });
    setDialogOpen(true);
  };

  const saveZone = async () => {
    try {
      setSaving(true);
      if (editingZone) {
        const res = await apiFetch(`/api/wifi/firewall/zones/${editingZone.id}`, {
          method: 'PUT',
          body: JSON.stringify(form),
        });
        if (res.success) {
          toast({ title: 'Zone Updated', description: `${form.name} zone has been updated.` });
        }
      } else {
        const res = await apiFetch('/api/wifi/firewall/zones', {
          method: 'POST',
          body: JSON.stringify(form),
        });
        if (res.success) {
          toast({ title: 'Zone Created', description: `${form.name} zone has been created.` });
        }
      }
      setDialogOpen(false);
      await fetchZones();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to save zone';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const toggleInterface = (iface: string) => {
    setForm(prev => ({
      ...prev,
      interfaces: prev.interfaces.includes(iface)
        ? prev.interfaces.filter(i => i !== iface)
        : [...prev.interfaces, iface],
    }));
  };

  const deleteZone = async (id: string) => {
    try {
      const res = await apiFetch(`/api/wifi/firewall/zones/${id}`, { method: 'DELETE' });
      if (res.success) {
        toast({ title: 'Zone Deleted', description: 'Firewall zone has been removed.' });
        await fetchZones();
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to delete zone';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    }
  };

  const toggleEnabled = async (zone: FirewallZone, enabled: boolean) => {
    try {
      await apiFetch(`/api/wifi/firewall/zones/${zone.id}`, {
        method: 'PUT',
        body: JSON.stringify({ enabled }),
      });
      setZones(zones.map(z => z.id === zone.id ? { ...z, enabled } : z));
    } catch {
      toast({ title: 'Error', description: 'Failed to toggle zone', variant: 'destructive' });
    }
  };

  const zoneColors: Record<string, string> = {
    wan: 'from-red-500/20 to-orange-500/20 border-red-300',
    lan: 'from-emerald-500/20 to-teal-500/20 border-emerald-300',
    guest: 'from-amber-500/20 to-yellow-500/20 border-amber-300',
    dmz: 'from-purple-500/20 to-pink-500/20 border-purple-300',
  };

  if (loading) return <TabSkeleton />;

  return (
    <div className="space-y-6">
      {/* Zone Diagram */}
      <Card className="bg-gradient-to-br from-slate-900 to-slate-800 text-white overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-slate-300 flex items-center gap-2">
            <Network className="h-4 w-4" />
            Zone Topology
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-4 py-6 flex-wrap">
            {/* WAN Zone */}
            <div className="flex flex-col items-center gap-2">
              <div className="w-28 h-20 rounded-xl bg-gradient-to-br from-red-500/30 to-orange-500/30 border-2 border-red-400/50 flex items-center justify-center flex-col">
                <Globe className="h-5 w-5 text-red-400" />
                <span className="text-xs font-bold text-red-300 mt-1">WAN</span>
                <span className="text-[10px] text-red-400/70">Untrusted</span>
              </div>
              <span className="text-[10px] text-slate-500">eth0, ppp0</span>
            </div>

            {/* Arrow */}
            <div className="flex flex-col items-center gap-1">
              <ChevronDown className="h-5 w-5 text-slate-400" />
              <div className="w-8 h-0.5 bg-gradient-to-r from-red-400/50 to-slate-400/50" />
            </div>

            {/* System / Firewall */}
            <div className="flex flex-col items-center gap-2">
              <div className="w-32 h-24 rounded-xl bg-gradient-to-br from-teal-500/30 to-cyan-500/30 border-2 border-teal-400/60 flex items-center justify-center flex-col shadow-lg shadow-teal-500/10">
                <Shield className="h-6 w-6 text-teal-400" />
                <span className="text-xs font-bold text-teal-300 mt-1">FIREWALL</span>
                <span className="text-[10px] text-teal-400/70">System Router</span>
              </div>
            </div>

            {/* Arrows to internal zones */}
            <div className="flex flex-col items-center gap-1">
              <ChevronDown className="h-5 w-5 text-slate-400" />
              <div className="w-8 h-0.5 bg-gradient-to-r from-slate-400/50 to-emerald-400/50" />
            </div>

            {/* Internal Zones */}
            <div className="flex gap-3 flex-wrap justify-center">
              {zones.filter(z => z.id !== 'wan').map(zone => {
                const col: Record<string, string> = {
                  lan: 'from-emerald-500/30 to-teal-500/30 border-emerald-400/50',
                  guest: 'from-amber-500/30 to-yellow-500/30 border-amber-400/50',
                  dmz: 'from-purple-500/30 to-pink-500/30 border-purple-400/50',
                };
                const iconCol: Record<string, string> = { lan: 'text-emerald-400', guest: 'text-amber-400', dmz: 'text-purple-400' };
                return (
                  <div key={zone.id} className="flex flex-col items-center gap-1">
                    <div className={cn('w-24 h-20 rounded-xl bg-gradient-to-br border-2 flex items-center justify-center flex-col', col[zone.id] || 'from-slate-500/30 border-slate-400/50')}>
                      <Lock className={cn('h-4 w-4', iconCol[zone.id] || 'text-slate-400')} />
                      <span className={cn('text-xs font-bold mt-1', iconCol[zone.id] || 'text-slate-400')}>{zone.name}</span>
                      <span className="text-[10px] text-slate-400/60">{zone.interfaces.length} iface</span>
                    </div>
                    <span className="text-[10px] text-slate-500">{zone.interfaces.join(', ')}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Zone Cards */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Firewall Zones</h3>
        <Button onClick={openAdd} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Zone
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {zones.map(zone => (
          <Card key={zone.id} className={cn('border transition-all hover:shadow-md', zoneColors[zone.id] && `border-l-4`, !zone.enabled && 'opacity-60')}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn('p-2 rounded-lg', zone.id === 'wan' ? 'bg-red-100' : zone.id === 'lan' ? 'bg-emerald-100' : zone.id === 'guest' ? 'bg-amber-100' : 'bg-purple-100')}>
                    {zone.id === 'wan' ? <Globe className="h-4 w-4 text-red-600" /> : <Shield className={cn('h-4 w-4', zone.id === 'lan' ? 'text-emerald-600' : zone.id === 'guest' ? 'text-amber-600' : 'text-purple-600')} />}
                  </div>
                  <div>
                    <CardTitle className="text-base">{zone.name} Zone</CardTitle>
                    <CardDescription>{zone.interfaces.length} interface(s)</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Switch checked={zone.enabled} onCheckedChange={(c) => toggleEnabled(zone, c)} />
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(zone)}>
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  {zone.id !== 'wan' && zone.id !== 'lan' && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteZone(zone.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Interface Tags */}
              <div className="flex flex-wrap gap-1.5">
                {zone.interfaces.map(iface => (
                  <Badge key={iface} variant="outline" className="text-xs font-mono">
                    <Network className="h-2.5 w-2.5 mr-1" />
                    {iface}
                  </Badge>
                ))}
              </div>
              {/* Policies */}
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Input</p>
                  <PolicyBadge policy={zone.inputPolicy} />
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Forward</p>
                  <PolicyBadge policy={zone.forwardPolicy} />
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Output</p>
                  <PolicyBadge policy={zone.outputPolicy} />
                </div>
              </div>
              {/* Masquerade */}
              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-xs text-muted-foreground">Masquerade (NAT)</span>
                <Badge variant={zone.masquerade ? 'default' : 'secondary'} className="text-xs">
                  {zone.masquerade ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingZone ? 'Edit Zone' : 'Add Zone'}</DialogTitle>
            <DialogDescription>Configure firewall zone settings and policies</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Zone Name</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. IoT" />
            </div>
            <div className="space-y-2">
              <Label>Interfaces</Label>
              <div className="flex flex-wrap gap-2">
                {INTERFACES.map(iface => (
                  <Badge
                    key={iface}
                    variant={form.interfaces.includes(iface) ? 'default' : 'outline'}
                    className="cursor-pointer font-mono text-xs"
                    onClick={() => toggleInterface(iface)}
                  >
                    {iface}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {(['inputPolicy', 'forwardPolicy', 'outputPolicy'] as const).map(key => (
                <div key={key} className="space-y-1">
                  <Label className="text-xs capitalize">{key.replace('Policy', '')}</Label>
                  <Select value={form[key]} onValueChange={v => setForm(p => ({ ...p, [key]: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="accept">Accept</SelectItem>
                      <SelectItem value="drop">Drop</SelectItem>
                      <SelectItem value="reject">Reject</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <Label>Masquerade (NAT)</Label>
              <Switch checked={form.masquerade} onCheckedChange={c => setForm(p => ({ ...p, masquerade: c }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveZone} disabled={!form.name || saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingZone ? 'Update' : 'Create'} Zone
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Tab 2: Firewall Rules ───────────────────────────────────────

function RulesTab() {
  const { toast } = useToast();
  const [rules, setRules] = useState<FirewallRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<FirewallRule | null>(null);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [filters, setFilters] = useState({ zone: 'all', chain: 'all', protocol: 'all', action: 'all' });

  const [form, setForm] = useState({
    zone: 'wan', chain: 'input' as const, protocol: 'tcp' as const,
    source: '', dest: '', ports: '', action: 'accept' as const,
    logPrefix: '', schedule: 'Always', comment: '',
  });

  const fetchRules = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.zone !== 'all') params.set('zoneId', filters.zone);
      if (filters.chain !== 'all') params.set('chain', filters.chain);
      if (filters.protocol !== 'all') params.set('protocol', filters.protocol);
      if (filters.action !== 'all') params.set('action', filters.action);
      const qs = params.toString();
      const res = await apiFetch<Record<string, unknown>[]>(`/api/wifi/firewall/rules${qs ? `?${qs}` : ''}`);
      if (res.success && res.data) {
        setRules(res.data.map(mapRuleFromApi));
      }
    } catch (e) {
      console.error(e);
      toast({ title: 'Error', description: 'Failed to load firewall rules', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast, filters.zone, filters.chain, filters.protocol, filters.action]);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  const openAdd = () => {
    setEditingRule(null);
    setForm({ zone: 'wan', chain: 'input', protocol: 'tcp', source: '', dest: '', ports: '', action: 'accept', logPrefix: '', schedule: 'Always', comment: '' });
    setDialogOpen(true);
  };

  const openEdit = (r: FirewallRule) => {
    setEditingRule(r);
    setForm({ zone: r.zone, chain: r.chain, protocol: r.protocol, source: r.source, dest: r.dest, ports: r.ports, action: r.action, logPrefix: r.logPrefix, schedule: r.schedule, comment: r.comment });
    setDialogOpen(true);
  };

  const saveRule = async () => {
    try {
      setSaving(true);
      if (editingRule) {
        await apiFetch(`/api/wifi/firewall/rules/${editingRule.id}`, {
          method: 'PUT',
          body: JSON.stringify(form),
        });
        toast({ title: 'Rule Updated', description: 'Firewall rule has been updated.' });
      } else {
        const maxP = Math.max(...rules.map(r => r.priority), 0);
        await apiFetch('/api/wifi/firewall/rules', {
          method: 'POST',
          body: JSON.stringify({ ...form, priority: maxP + 10, enabled: true }),
        });
        toast({ title: 'Rule Created', description: 'New firewall rule has been created.' });
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

  const moveRule = (id: string, dir: 'up' | 'down') => {
    const sorted = [...rules].sort((a, b) => a.priority - b.priority);
    const idx = sorted.findIndex(r => r.id === id);
    if (dir === 'up' && idx > 0) {
      const temp = sorted[idx].priority;
      sorted[idx].priority = sorted[idx - 1].priority;
      sorted[idx - 1].priority = temp;
      setRules(sorted);
      apiFetch(`/api/wifi/firewall/rules/${sorted[idx].id}`, { method: 'PUT', body: JSON.stringify({ priority: sorted[idx].priority }) }).catch(() => {});
      apiFetch(`/api/wifi/firewall/rules/${sorted[idx - 1].id}`, { method: 'PUT', body: JSON.stringify({ priority: sorted[idx - 1].priority }) }).catch(() => {});
    } else if (dir === 'down' && idx < sorted.length - 1) {
      const temp = sorted[idx].priority;
      sorted[idx].priority = sorted[idx + 1].priority;
      sorted[idx + 1].priority = temp;
      setRules(sorted);
      apiFetch(`/api/wifi/firewall/rules/${sorted[idx].id}`, { method: 'PUT', body: JSON.stringify({ priority: sorted[idx].priority }) }).catch(() => {});
      apiFetch(`/api/wifi/firewall/rules/${sorted[idx + 1].id}`, { method: 'PUT', body: JSON.stringify({ priority: sorted[idx + 1].priority }) }).catch(() => {});
    }
  };

  const toggleRule = async (id: string) => {
    const rule = rules.find(r => r.id === id);
    if (!rule) return;
    try {
      await apiFetch(`/api/wifi/firewall/rules/${id}`, { method: 'PUT', body: JSON.stringify({ enabled: !rule.enabled }) });
      setRules(rules.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
    } catch {
      toast({ title: 'Error', description: 'Failed to toggle rule', variant: 'destructive' });
    }
  };

  const deleteRule = async (id: string) => {
    try {
      await apiFetch(`/api/wifi/firewall/rules/${id}`, { method: 'DELETE' });
      toast({ title: 'Rule Deleted', description: 'Firewall rule has been removed.' });
      await fetchRules();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to delete rule';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    }
  };

  const [testing, setTesting] = useState(false);

  const runTest = async () => {
    setTestResult(null);
    setTesting(true);
    try {
      const res = await apiFetch<{ passed: number; failed: number; details?: string }>('/api/wifi/firewall/test', { method: 'POST' });
      if (res.success && res.data) {
        const { passed, failed, details } = res.data;
        setTestResult(`Test complete: ${passed} rules passed, ${failed} rules failed.${details ? ` ${details}` : ''}`);
      } else {
        setTestResult('Test completed but returned no data.');
      }
    } catch {
      setTestResult('Rule testing is not available. The firewall test endpoint is not reachable.');
    } finally {
      setTesting(false);
    }
  };

  const filteredRules = rules
    .filter(r => filters.zone === 'all' || r.zone === filters.zone)
    .filter(r => filters.chain === 'all' || r.chain === filters.chain)
    .filter(r => filters.protocol === 'all' || r.protocol === filters.protocol)
    .filter(r => filters.action === 'all' || r.action === filters.action)
    .sort((a, b) => a.priority - b.priority);

  const actionBadge = (action: string) => {
    const m: Record<string, string> = {
      accept: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      drop: 'bg-red-100 text-red-700 border-red-200',
      reject: 'bg-orange-100 text-orange-700 border-orange-200',
      log: 'bg-amber-100 text-amber-700 border-amber-200',
    };
    return <Badge variant="outline" className={cn('text-xs font-semibold', m[action] || '')}>{action.toUpperCase()}</Badge>;
  };

  if (loading) return <TableSkeleton cols={12} rows={8} />;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filters.zone} onValueChange={v => setFilters(p => ({ ...p, zone: v }))}>
              <SelectTrigger className="w-28"><SelectValue placeholder="Zone" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Zones</SelectItem>
                <SelectItem value="wan">WAN</SelectItem>
                <SelectItem value="lan">LAN</SelectItem>
                <SelectItem value="guest">Guest</SelectItem>
                <SelectItem value="dmz">DMZ</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.chain} onValueChange={v => setFilters(p => ({ ...p, chain: v }))}>
              <SelectTrigger className="w-28"><SelectValue placeholder="Chain" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Chains</SelectItem>
                <SelectItem value="input">Input</SelectItem>
                <SelectItem value="forward">Forward</SelectItem>
                <SelectItem value="output">Output</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.protocol} onValueChange={v => setFilters(p => ({ ...p, protocol: v }))}>
              <SelectTrigger className="w-28"><SelectValue placeholder="Protocol" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Proto</SelectItem>
                <SelectItem value="tcp">TCP</SelectItem>
                <SelectItem value="udp">UDP</SelectItem>
                <SelectItem value="icmp">ICMP</SelectItem>
                <SelectItem value="all">ALL</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.action} onValueChange={v => setFilters(p => ({ ...p, action: v }))}>
              <SelectTrigger className="w-28"><SelectValue placeholder="Action" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="accept">Accept</SelectItem>
                <SelectItem value="drop">Drop</SelectItem>
                <SelectItem value="reject">Reject</SelectItem>
                <SelectItem value="log">Log</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex-1" />
            <Button variant="outline" size="sm" onClick={runTest} disabled={testing}>
              {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
              Test Rules
            </Button>
            <Button onClick={openAdd} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Rule
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Rules Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Pri</TableHead>
                  <TableHead>Zone</TableHead>
                  <TableHead>Chain</TableHead>
                  <TableHead>Proto</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Dest</TableHead>
                  <TableHead>Ports</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Log</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead className="w-12" />
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRules.map((rule, idx) => (
                  <TableRow key={rule.id} className={cn(!rule.enabled && 'opacity-50')}>
                    <TableCell>
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-muted font-mono text-xs font-bold">
                        {rule.priority}
                      </span>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{rule.zone}</Badge></TableCell>
                    <TableCell className="uppercase text-xs font-mono">{rule.chain}</TableCell>
                    <TableCell className="uppercase text-xs font-mono">{rule.protocol}</TableCell>
                    <TableCell className="font-mono text-xs">{rule.source}</TableCell>
                    <TableCell className="font-mono text-xs">{rule.dest}</TableCell>
                    <TableCell className="font-mono text-xs">{rule.ports || '—'}</TableCell>
                    <TableCell>{actionBadge(rule.action)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{rule.logPrefix || '—'}</TableCell>
                    <TableCell className="text-xs">{rule.schedule}</TableCell>
                    <TableCell>
                      <Switch checked={rule.enabled} onCheckedChange={() => toggleRule(rule.id)} className="scale-75" />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-0.5">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={idx === 0} onClick={() => moveRule(rule.id, 'up')}>
                              <ChevronUp className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Move up</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={idx === filteredRules.length - 1} onClick={() => moveRule(rule.id, 'down')}>
                              <ChevronDown className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Move down</TooltipContent>
                        </Tooltip>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(rule)}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteRule(rule.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Rule Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingRule ? 'Edit Rule' : 'Add Rule'}</DialogTitle>
            <DialogDescription>Configure firewall rule parameters</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Zone</Label>
                <Select value={form.zone} onValueChange={v => setForm(p => ({ ...p, zone: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="wan">WAN</SelectItem>
                    <SelectItem value="lan">LAN</SelectItem>
                    <SelectItem value="guest">Guest</SelectItem>
                    <SelectItem value="dmz">DMZ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Chain</Label>
                <Select value={form.chain} onValueChange={v => setForm(p => ({ ...p, chain: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="input">Input</SelectItem>
                    <SelectItem value="forward">Forward</SelectItem>
                    <SelectItem value="output">Output</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Protocol</Label>
                <Select value={form.protocol} onValueChange={v => setForm(p => ({ ...p, protocol: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tcp">TCP</SelectItem>
                    <SelectItem value="udp">UDP</SelectItem>
                    <SelectItem value="icmp">ICMP</SelectItem>
                    <SelectItem value="all">ALL</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Action</Label>
                <Select value={form.action} onValueChange={v => setForm(p => ({ ...p, action: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="accept">Accept</SelectItem>
                    <SelectItem value="drop">Drop</SelectItem>
                    <SelectItem value="reject">Reject</SelectItem>
                    <SelectItem value="log">Log</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Source IP/Mask</Label>
                <Input value={form.source} onChange={e => setForm(p => ({ ...p, source: e.target.value }))} placeholder="0.0.0.0/0" className="font-mono text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Destination IP/Mask</Label>
                <Input value={form.dest} onChange={e => setForm(p => ({ ...p, dest: e.target.value }))} placeholder="0.0.0.0/0" className="font-mono text-xs" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Ports</Label>
                <Input value={form.ports} onChange={e => setForm(p => ({ ...p, ports: e.target.value }))} placeholder="80,443" className="font-mono text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Log Prefix</Label>
                <Input value={form.logPrefix} onChange={e => setForm(p => ({ ...p, logPrefix: e.target.value }))} placeholder="RULE_LOG" className="font-mono text-xs" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Schedule</Label>
                <Select value={form.schedule} onValueChange={v => setForm(p => ({ ...p, schedule: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Always">Always</SelectItem>
                    <SelectItem value="Business Hours">Business Hours</SelectItem>
                    <SelectItem value="Night Only">Night Only</SelectItem>
                    <SelectItem value="Weekend Only">Weekend Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Comment</Label>
              <Input value={form.comment} onChange={e => setForm(p => ({ ...p, comment: e.target.value }))} placeholder="Rule description..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveRule} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingRule ? 'Update' : 'Create'} Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test Dialog */}
      <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Firewall Rules Test</DialogTitle>
            <DialogDescription>Testing firewall rules configuration...</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {testing ? (
              <div className="flex items-center justify-center gap-3 py-8">
                <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
                <span className="text-muted-foreground">Testing {rules.filter(r => r.enabled).length} active rules...</span>
              </div>
            ) : !testResult ? (
              <div className="flex items-center justify-center gap-3 py-8">
                <span className="text-muted-foreground">Click "Test Rules" to validate firewall rules.</span>
              </div>
            ) : (
              <div className="space-y-3">
                <div className={cn('flex items-center gap-2 p-3 rounded-lg', testResult.includes('not available') ? 'bg-amber-50 border border-amber-200' : 'bg-emerald-50 border border-emerald-200')}>
                  {testResult.includes('not available') ? <AlertTriangle className="h-5 w-5 text-amber-600" /> : <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
                  <p className={cn('text-sm', testResult.includes('not available') ? 'text-amber-800' : 'text-emerald-800')}>{testResult}</p>
                </div>
                {!testResult.includes('not available') && (
                  <div className="text-xs text-muted-foreground">
                    Test verified rule processing order, policy conflicts, and security coverage.
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Tab 3: MAC Filtering ────────────────────────────────────────

function LinkedBadge({ type }: { type: string }) {
  const m: Record<string, string> = {
    guest: 'bg-teal-100 text-teal-700',
    device: 'bg-slate-100 text-slate-700',
    staff: 'bg-amber-100 text-amber-700',
  };
  return <Badge className={cn('text-xs', m[type] || '')}>{type}</Badge>;
}

function MacFilterTable({ entries, title, accent, onToggle, onEdit, onDelete }: {
  entries: MacEntry[];
  title: string;
  accent: string;
  onToggle: (m: MacEntry) => void;
  onEdit: (m: MacEntry) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            {accent === 'green' ? <ShieldCheck className="h-4 w-4 text-emerald-600" /> : <ShieldBan className="h-4 w-4 text-red-600" />}
            {title}
            <Badge variant="secondary" className="text-xs">{entries.length}</Badge>
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-64 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>MAC</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-sm">
                    No entries
                  </TableCell>
                </TableRow>
              ) : (
                entries.map(entry => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-mono text-xs">{entry.mac}</TableCell>
                    <TableCell className="text-sm">{entry.description}</TableCell>
                    <TableCell><LinkedBadge type={entry.linkedType} /></TableCell>
                    <TableCell className="text-xs">{entry.expires}</TableCell>
                    <TableCell>
                      <Badge variant={entry.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                        {entry.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onToggle(entry)}>
                              {entry.listType === 'whitelist' ? <Ban className="h-3.5 w-3.5 text-red-500" /> : <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{entry.listType === 'whitelist' ? 'Block' : 'Allow'}</TooltipContent>
                        </Tooltip>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(entry)}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDelete(entry.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function MacFilterTab() {
  const { toast } = useToast();
  const [macs, setMacs] = useState<MacEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filterMode, setFilterMode] = useState<'blacklist' | 'whitelist'>('blacklist');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [editingMac, setEditingMac] = useState<MacEntry | null>(null);
  const [form, setForm] = useState({
    mac: '', description: '', listType: 'blacklist' as const,
    linkedType: 'guest' as const, expires: '',
  });

  const fetchMacs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch<Record<string, unknown>[]>('/api/wifi/firewall/mac-filter');
      if (res.success && res.data) {
        setMacs(res.data.map(mapMacFromApi));
      }
    } catch (e) {
      console.error(e);
      toast({ title: 'Error', description: 'Failed to load MAC filter entries', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchMacs(); }, [fetchMacs]);

  const whitelist = macs.filter(m => m.listType === 'whitelist');
  const blacklist = macs.filter(m => m.listType === 'blacklist');

  const openAdd = () => {
    setEditingMac(null);
    setForm({ mac: '', description: '', listType: 'blacklist', linkedType: 'guest', expires: '' });
    setDialogOpen(true);
  };

  const openEdit = (m: MacEntry) => {
    setEditingMac(m);
    setForm({ mac: m.mac, description: m.description, listType: m.listType, linkedType: m.linkedType, expires: m.expires });
    setDialogOpen(true);
  };

  const saveMac = async () => {
    try {
      setSaving(true);
      if (editingMac) {
        await apiFetch(`/api/wifi/firewall/mac-filter/${editingMac.id}`, {
          method: 'PUT',
          body: JSON.stringify(form),
        });
        toast({ title: 'Entry Updated', description: 'MAC filter entry updated.' });
      } else {
        await apiFetch('/api/wifi/firewall/mac-filter', {
          method: 'POST',
          body: JSON.stringify({ ...form, macAddress: form.mac }),
        });
        toast({ title: 'Entry Created', description: 'New MAC filter entry added.' });
      }
      setDialogOpen(false);
      await fetchMacs();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to save MAC entry';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const deleteMac = async (id: string) => {
    try {
      await apiFetch(`/api/wifi/firewall/mac-filter/${id}`, { method: 'DELETE' });
      toast({ title: 'Entry Deleted', description: 'MAC filter entry removed.' });
      await fetchMacs();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to delete MAC entry';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    }
  };

  const toggleBlock = async (m: MacEntry) => {
    const newType = m.listType === 'whitelist' ? 'blacklist' : 'whitelist';
    try {
      await apiFetch(`/api/wifi/firewall/mac-filter/${m.id}`, {
        method: 'PUT',
        body: JSON.stringify({ listType: newType }),
      });
      setMacs(macs.map(x => x.id === m.id ? { ...x, listType: newType } : x));
    } catch {
      toast({ title: 'Error', description: 'Failed to toggle MAC entry', variant: 'destructive' });
    }
  };

  const handleImport = async () => {
    try {
      const lines = importText.trim().split('\n').filter(l => l.trim());
      for (const line of lines) {
        const parts = line.split(',').map(s => s.trim());
        await apiFetch('/api/wifi/firewall/mac-filter', {
          method: 'POST',
          body: JSON.stringify({
            macAddress: parts[0],
            description: parts[1] || 'Imported',
            listType: filterMode,
            linkedType: 'device',
          }),
        });
      }
      toast({ title: 'Import Complete', description: `${lines.length} MAC entries imported.` });
      setImportOpen(false);
      setImportText('');
      await fetchMacs();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to import MAC entries';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    }
  };

  if (loading) return <div className="grid gap-4 md:grid-cols-2"><TableSkeleton cols={6} rows={4} /><TableSkeleton cols={6} rows={4} /></div>;

  return (
    <div className="space-y-4">
      {/* Mode Selector & Counts */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-600" />
              <span className="font-medium text-sm">Active Filter Mode:</span>
            </div>
            <RadioGroup value={filterMode} onValueChange={v => setFilterMode(v as 'blacklist' | 'whitelist')} className="flex gap-4">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="blacklist" id="bl" />
                <Label htmlFor="bl" className="flex items-center gap-1.5 cursor-pointer">
                  <ShieldBan className="h-3.5 w-3.5 text-red-500" />
                  Blacklist
                  <Badge variant="secondary" className="text-xs">{blacklist.length}</Badge>
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="whitelist" id="wl" />
                <Label htmlFor="wl" className="flex items-center gap-1.5 cursor-pointer">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                  Whitelist
                  <Badge variant="secondary" className="text-xs">{whitelist.length}</Badge>
                </Label>
              </div>
            </RadioGroup>
            <div className="flex-1" />
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
            <Button onClick={openAdd} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add MAC
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Split Tables */}
      <div className="grid gap-4 md:grid-cols-2">
        <MacFilterTable entries={whitelist} title="Whitelisted" accent="green" onToggle={toggleBlock} onEdit={openEdit} onDelete={deleteMac} />
        <MacFilterTable entries={blacklist} title="Blacklisted" accent="red" onToggle={toggleBlock} onEdit={openEdit} onDelete={deleteMac} />
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingMac ? 'Edit MAC Entry' : 'Add MAC Entry'}</DialogTitle>
            <DialogDescription>Add or modify a MAC address filter entry</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="space-y-1">
              <Label className="text-xs">MAC Address</Label>
              <Input value={form.mac} onChange={e => setForm(p => ({ ...p, mac: e.target.value }))} placeholder="XX:XX:XX:XX:XX:XX" className="font-mono" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Description</Label>
              <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Device description" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">List Type</Label>
                <Select value={form.listType} onValueChange={v => setForm(p => ({ ...p, listType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whitelist">Whitelist</SelectItem>
                    <SelectItem value="blacklist">Blacklist</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Linked Type</Label>
                <Select value={form.linkedType} onValueChange={v => setForm(p => ({ ...p, linkedType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="guest">Guest</SelectItem>
                    <SelectItem value="device">Device</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Expires</Label>
              <Input value={form.expires} onChange={e => setForm(p => ({ ...p, expires: e.target.value }))} placeholder="Never or YYYY-MM-DD" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveMac} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingMac ? 'Update' : 'Add'} Entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Import MAC List</DialogTitle>
            <DialogDescription>Paste MAC addresses, one per line. Format: MAC, Description</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              value={importText}
              onChange={e => setImportText(e.target.value)}
              placeholder="AA:BB:CC:DD:EE:FF, Device description&#10;11:22:33:44:55:66, Another device"
              className="font-mono text-xs min-h-[200px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>Cancel</Button>
            <Button onClick={handleImport}>Import ({importText.trim().split('\n').filter(l => l.trim()).length} entries)</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Tab 4: Bandwidth Policies ───────────────────────────────────

function BwPoliciesTab() {
  const { toast } = useToast();
  const [policies, setPolicies] = useState<BandwidthPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<BandwidthPolicy | null>(null);
  const [form, setForm] = useState({
    name: '', downloadKbps: 10240, uploadKbps: 10240,
    burstDownKbps: 20480, burstUpKbps: 20480,
    priority: 5, linkedPlan: 'Standard Plan', enabled: true,
  });

  const fetchPolicies = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch<Record<string, unknown>[]>('/api/wifi/firewall/bandwidth-policies');
      if (res.success && res.data) {
        setPolicies(res.data.map(mapPolicyFromApi));
      }
    } catch (e) {
      console.error(e);
      toast({ title: 'Error', description: 'Failed to load bandwidth policies', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchPolicies(); }, [fetchPolicies]);

  const openAdd = () => {
    setEditingPolicy(null);
    setForm({ name: '', downloadKbps: 10240, uploadKbps: 10240, burstDownKbps: 20480, burstUpKbps: 20480, priority: 5, linkedPlan: 'Standard Plan', enabled: true });
    setDialogOpen(true);
  };

  const openEdit = (p: BandwidthPolicy) => {
    setEditingPolicy(p);
    setForm({ name: p.name, downloadKbps: p.downloadKbps, uploadKbps: p.uploadKbps, burstDownKbps: p.burstDownKbps, burstUpKbps: p.burstUpKbps, priority: p.priority, linkedPlan: p.linkedPlan, enabled: p.enabled });
    setDialogOpen(true);
  };

  const savePolicy = async () => {
    try {
      setSaving(true);
      if (editingPolicy) {
        await apiFetch(`/api/wifi/firewall/bandwidth-policies/${editingPolicy.id}`, {
          method: 'PUT',
          body: JSON.stringify(form),
        });
        toast({ title: 'Policy Updated', description: `${form.name} policy updated.` });
      } else {
        await apiFetch('/api/wifi/firewall/bandwidth-policies', {
          method: 'POST',
          body: JSON.stringify(form),
        });
        toast({ title: 'Policy Created', description: `${form.name} policy created.` });
      }
      setDialogOpen(false);
      await fetchPolicies();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to save policy';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const deletePolicy = async (id: string) => {
    try {
      await apiFetch(`/api/wifi/firewall/bandwidth-policies/${id}`, { method: 'DELETE' });
      toast({ title: 'Policy Deleted', description: 'Bandwidth policy removed.' });
      await fetchPolicies();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to delete policy';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    }
  };

  const toggleEnabled = async (policy: BandwidthPolicy, enabled: boolean) => {
    try {
      await apiFetch(`/api/wifi/firewall/bandwidth-policies/${policy.id}`, {
        method: 'PUT',
        body: JSON.stringify({ enabled }),
      });
      setPolicies(policies.map(p => p.id === policy.id ? { ...p, enabled } : p));
    } catch {
      toast({ title: 'Error', description: 'Failed to toggle policy', variant: 'destructive' });
    }
  };

  const toMbps = (kbps: number) => (kbps / 1024).toFixed(1);

  const priorityColors = ['bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500', 'bg-lime-500', 'bg-green-500', 'bg-emerald-500', 'bg-teal-500', 'bg-cyan-500', 'bg-slate-400', 'bg-teal-600'];

  if (loading) return <TabSkeleton />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Bandwidth Shaping Policies</h3>
        <Button onClick={openAdd} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Policy
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {policies.map(policy => {
          const maxKbps = 51200;
          return (
            <Card key={policy.id} className={cn('transition-all hover:shadow-md', !policy.enabled && 'opacity-60')}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-teal-100">
                      <Gauge className="h-4 w-4 text-teal-600" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{policy.name}</CardTitle>
                      <CardDescription className="text-xs">{policy.linkedPlan}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Switch checked={policy.enabled} onCheckedChange={c => toggleEnabled(policy, c)} className="scale-75" />
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(policy)}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deletePolicy(policy.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Speed bars */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Download className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="text-xs text-muted-foreground w-12">Down</span>
                    <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all"
                        style={{ width: `${Math.min(100, (policy.downloadKbps / maxKbps) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono font-semibold w-20 text-right">{toMbps(policy.downloadKbps)} Mbps</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Upload className="h-3.5 w-3.5 text-amber-600" />
                    <span className="text-xs text-muted-foreground w-12">Up</span>
                    <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all"
                        style={{ width: `${Math.min(100, (policy.uploadKbps / maxKbps) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono font-semibold w-20 text-right">{toMbps(policy.uploadKbps)} Mbps</span>
                  </div>
                </div>

                {/* Burst */}
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Burst: ↓{toMbps(policy.burstDownKbps)} / ↑{toMbps(policy.burstUpKbps)} Mbps</span>
                </div>

                <Separator />

                {/* Priority */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">Priority</span>
                    <span className="text-xs font-bold">{policy.priority}/10</span>
                  </div>
                  <div className="flex gap-1">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <div
                        key={i}
                        className={cn(
                          'h-2 flex-1 rounded-full transition-all',
                          i < policy.priority ? priorityColors[policy.priority] : 'bg-muted'
                        )}
                      />
                    ))}
                  </div>
                </div>

                {/* Applied to */}
                <div className="flex items-center gap-1.5 pt-1">
                  <Wifi className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Applied to:</span>
                  <Badge variant="outline" className="text-xs">{policy.linkedPlan}</Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingPolicy ? 'Edit Policy' : 'Add Policy'}</DialogTitle>
            <DialogDescription>Configure bandwidth shaping parameters</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Policy Name</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Premium" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Download (Kbps)</Label>
                <Input type="number" value={form.downloadKbps} onChange={e => setForm(p => ({ ...p, downloadKbps: parseInt(e.target.value) || 0 }))} />
                <p className="text-[10px] text-muted-foreground">{toMbps(form.downloadKbps)} Mbps</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Upload (Kbps)</Label>
                <Input type="number" value={form.uploadKbps} onChange={e => setForm(p => ({ ...p, uploadKbps: parseInt(e.target.value) || 0 }))} />
                <p className="text-[10px] text-muted-foreground">{toMbps(form.uploadKbps)} Mbps</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Burst Download (Kbps)</Label>
                <Input type="number" value={form.burstDownKbps} onChange={e => setForm(p => ({ ...p, burstDownKbps: parseInt(e.target.value) || 0 }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Burst Upload (Kbps)</Label>
                <Input type="number" value={form.burstUpKbps} onChange={e => setForm(p => ({ ...p, burstUpKbps: parseInt(e.target.value) || 0 }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Priority ({form.priority}/10)</Label>
              <Slider value={[form.priority]} onValueChange={v => setForm(p => ({ ...p, priority: v[0] }))} min={0} max={10} step={1} />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Lowest</span>
                <span>Highest</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Link to WiFi Plan</Label>
              <Select value={form.linkedPlan} onValueChange={v => setForm(p => ({ ...p, linkedPlan: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {WIFI_PLANS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={savePolicy} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingPolicy ? 'Update' : 'Create'} Policy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Tab 5: Bandwidth Monitor ────────────────────────────────────

function SpeedBar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
      <div className={cn('h-full rounded-full', color)} style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
    </div>
  );
}

function BwMonitorTab() {
  const { toast } = useToast();
  const [users, setUsers] = useState<BandwidthUser[]>([]);
  const [pools, setPools] = useState<BandwidthPool[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const [sparklineHistory, setSparklineHistory] = useState<number[]>([]);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [usersRes, poolsRes] = await Promise.all([
        apiFetch<Record<string, unknown>[]>('/api/wifi/firewall/bandwidth-usage?type=session'),
        apiFetch<Record<string, unknown>[]>('/api/wifi/firewall/bandwidth-pools'),
      ]);
      if (usersRes.success && usersRes.data) {
        setUsers(usersRes.data.map(mapSessionFromApi));
      }
      if (poolsRes.success && poolsRes.data) {
        setPools(poolsRes.data.map(mapPoolFromApi));
      }
      // Update sparkline history with real total bandwidth usage
      const poolsData = poolsRes.success && poolsRes.data ? poolsRes.data.map(mapPoolFromApi) : [];
      const totalDown = poolsData.reduce((s: number, p: BandwidthPool) => s + p.usedDownKbps, 0);
      const totalUp = poolsData.reduce((s: number, p: BandwidthPool) => s + p.usedUpKbps, 0);
      const totalKbps = totalDown + totalUp;
      const maxExpected = poolsData.reduce((s: number, p: BandwidthPool) => s + p.totalDownKbps + p.totalUpKbps, 0) || 1;
      const pct = Math.round((totalKbps / maxExpected) * 100);
      setSparklineHistory(prev => [...prev.slice(-19), pct]);
      setTick(t => t + 1);
      setLoading(false);
    } catch {
      // Silently fail on background refresh; initial load error is handled below
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [usersRes, poolsRes] = await Promise.all([
          apiFetch<Record<string, unknown>[]>('/api/wifi/firewall/bandwidth-usage?type=session'),
          apiFetch<Record<string, unknown>[]>('/api/wifi/firewall/bandwidth-pools'),
        ]);
        if (cancelled) return;
        if (usersRes.success && usersRes.data) {
          setUsers(usersRes.data.map(mapSessionFromApi));
        }
        if (poolsRes.success && poolsRes.data) {
          setPools(poolsRes.data.map(mapPoolFromApi));
        }
        // Initialize sparkline
        const poolsData = poolsRes.success && poolsRes.data ? poolsRes.data.map(mapPoolFromApi) : [];
        const totalDown = poolsData.reduce((s: number, p: BandwidthPool) => s + p.usedDownKbps, 0);
        const totalUp = poolsData.reduce((s: number, p: BandwidthPool) => s + p.usedUpKbps, 0);
        const totalKbps = totalDown + totalUp;
        const maxExpected = poolsData.reduce((s: number, p: BandwidthPool) => s + p.totalDownKbps + p.totalUpKbps, 0) || 1;
        const pct = Math.round((totalKbps / maxExpected) * 100);
        setSparklineHistory([pct]);
        setLoading(false);
      } catch (e) {
        if (!cancelled) {
          console.error(e);
          toast({ title: 'Error', description: 'Failed to load bandwidth data', variant: 'destructive' });
          setLoading(false);
        }
      }
    };
    load();
    return () => { cancelled = true; };
  }, [toast]);

  const startRefresh = useCallback(() => {
    if (tickRef.current) return;
    tickRef.current = setInterval(() => {
      fetchData();
    }, 5000);
  }, [fetchData]);

  const stopRefresh = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  useEffect(() => {
    startRefresh();
    return () => stopRefresh();
  }, [startRefresh, stopRefresh]);

  const wanDown = pools.reduce((s, p) => s + p.usedDownKbps, 0);
  const wanUp = pools.reduce((s, p) => s + p.usedUpKbps, 0);
  const totalUsers = pools.reduce((s, p) => s + p.activeUsers, 0);
  const totalDownGB = users.reduce((s, u) => s + u.dataDown, 0) / 1024;
  const totalUpGB = users.reduce((s, u) => s + u.dataUp, 0) / 1024;
  const peakMbps = Math.max(...users.map(u => u.downloadSpeed)) / 1024;

  const topConsumers = [...users].sort((a, b) => b.dataDown - a.dataDown).slice(0, 10);
  const maxData = Math.max(...topConsumers.map(u => u.dataDown), 1);

  const formatSpeed = (kbps: number) => {
    if (kbps >= 1024) return `${(kbps / 1024).toFixed(1)} Mbps`;
    return `${kbps} Kbps`;
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  // Sparkline data from real bandwidth history
  const sparklineData = sparklineHistory.length > 0 ? sparklineHistory : Array.from({ length: 20 }, () => 0);

  if (loading) return <TabSkeleton />;

  return (
    <div className="space-y-4">
      {/* Stats Row */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Card className="bg-slate-900 text-white border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400">WAN Usage</span>
              <div className="flex items-center gap-1">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="text-[10px] text-emerald-400">LIVE</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div>
                <Download className="h-3 w-3 text-emerald-400 mb-1" />
                <p className="text-lg font-bold">{(wanDown / 1024).toFixed(1)} <span className="text-xs font-normal">Mbps</span></p>
              </div>
              <div>
                <Upload className="h-3 w-3 text-amber-400 mb-1" />
                <p className="text-lg font-bold">{(wanUp / 1024).toFixed(1)} <span className="text-xs font-normal">Mbps</span></p>
              </div>
            </div>
            {/* Sparkline */}
            <div className="flex items-end gap-0.5 mt-2 h-4">
              {sparklineData.map((v, i) => (
                <div key={i} className="flex-1 bg-emerald-500/60 rounded-t-sm" style={{ height: `${v}%` }} />
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 text-white border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-3.5 w-3.5 text-teal-400" />
              <span className="text-xs text-slate-400">Active Users</span>
            </div>
            <p className="text-3xl font-bold">{totalUsers}</p>
            <div className="flex items-center gap-1 mt-1">
              <TrendingUp className="h-3 w-3 text-emerald-400" />
              <span className="text-xs text-emerald-400">Live data</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 text-white border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-xs text-slate-400">Peak Today</span>
            </div>
            <p className="text-3xl font-bold">{peakMbps.toFixed(1)} <span className="text-sm font-normal">Mbps</span></p>
            <span className="text-xs text-slate-500">Single user peak download</span>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 text-white border-slate-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="h-3.5 w-3.5 text-cyan-400" />
              <span className="text-xs text-slate-400">Total Today</span>
            </div>
            <div className="flex items-center gap-3">
              <div>
                <span className="text-xl font-bold">{totalDownGB.toFixed(1)} <span className="text-xs font-normal">GB↓</span></span>
              </div>
              <div>
                <span className="text-xl font-bold">{totalUpGB.toFixed(1)} <span className="text-xs font-normal">GB↑</span></span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Per-User Live Table */}
      <Card className="bg-slate-900 text-white border-slate-800">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base text-slate-300">Live User Activity</CardTitle>
              <div className="flex items-center gap-1">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="text-[10px] text-emerald-400">Auto-refresh 5s</span>
              </div>
            </div>
            <Badge variant="outline" className="text-xs border-slate-700 text-slate-400">
              Updated {tick} times
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[350px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800 hover:bg-slate-800/50">
                  <TableHead className="text-slate-400">User / IP</TableHead>
                  <TableHead className="text-slate-400">MAC</TableHead>
                  <TableHead className="text-slate-400">Plan</TableHead>
                  <TableHead className="text-slate-400">↓ Speed</TableHead>
                  <TableHead className="text-slate-400">↑ Speed</TableHead>
                  <TableHead className="text-slate-400">Session</TableHead>
                  <TableHead className="text-slate-400">Data</TableHead>
                  <TableHead className="text-slate-400 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map(user => (
                  <TableRow key={user.id} className="border-slate-800/50 hover:bg-slate-800/30">
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">{user.username}</p>
                        <p className="text-xs text-slate-500 font-mono">{user.ip}</p>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-400">{user.mac}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs border-slate-700 text-slate-300">{user.plan}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <SpeedBar value={user.downloadSpeed} max={15000} color="bg-emerald-500" />
                        <span className="text-xs font-mono text-emerald-400 w-16">{formatSpeed(user.downloadSpeed)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <SpeedBar value={user.uploadSpeed} max={8000} color="bg-amber-500" />
                        <span className="text-xs font-mono text-amber-400 w-16">{formatSpeed(user.uploadSpeed)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-slate-400">{formatTime(user.sessionTime)}</TableCell>
                    <TableCell>
                      <div className="text-xs">
                        <span className="text-emerald-400">↓{(user.dataDown / 1024).toFixed(1)} GB</span>
                        {' '}
                        <span className="text-slate-600">/</span>
                        {' '}
                        <span className="text-amber-400">↑{(user.dataUp / 1024).toFixed(1)} GB</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-300 hover:bg-red-900/20">
                              <XCircle className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Disconnect</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-400 hover:text-amber-300 hover:bg-amber-900/20">
                              <AlertTriangle className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Limit</TooltipContent>
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

      {/* Bottom Row: Top Consumers + Subnets */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Top Consumers */}
        <Card className="bg-slate-900 text-white border-slate-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-slate-300">Top 10 Bandwidth Consumers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topConsumers.map((u, i) => (
              <div key={u.id} className="flex items-center gap-2">
                <span className="text-xs text-slate-500 w-4 text-right">{i + 1}</span>
                <span className="text-xs text-slate-300 w-24 truncate">{u.username}</span>
                <div className="flex-1 h-4 bg-slate-800 rounded overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-teal-600 to-emerald-500 rounded"
                    style={{ width: `${(u.dataDown / maxData) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-slate-400 w-20 text-right">{(u.dataDown / 1024).toFixed(2)} GB</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Per-Subnet Aggregate */}
        <Card className="bg-slate-900 text-white border-slate-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-slate-300">Per-Subnet Throughput</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {pools.map(pool => {
              const downPct = (pool.usedDownKbps / pool.totalDownKbps) * 100;
              const upPct = (pool.usedUpKbps / pool.totalUpKbps) * 100;
              return (
                <div key={pool.id} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Network className="h-3.5 w-3.5 text-teal-400" />
                      <span className="text-sm font-medium">{pool.name}</span>
                      <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-400">VLAN {pool.vlan}</Badge>
                    </div>
                    <span className="text-xs text-slate-400">{pool.activeUsers} users</span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Download className="h-3 w-3 text-emerald-400" />
                      <div className="flex-1 h-2.5 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-emerald-600 to-teal-500 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, downPct)}%` }} />
                      </div>
                      <span className="text-xs font-mono text-slate-400 w-28 text-right">{formatSpeed(pool.usedDownKbps)} / {formatSpeed(pool.totalDownKbps)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Upload className="h-3 w-3 text-amber-400" />
                      <div className="flex-1 h-2.5 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-amber-600 to-orange-500 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, upPct)}%` }} />
                      </div>
                      <span className="text-xs font-mono text-slate-400 w-28 text-right">{formatSpeed(pool.usedUpKbps)} / {formatSpeed(pool.totalUpKbps)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Bandwidth Pools */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Bandwidth Pools</h3>
          <Button variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Pool
          </Button>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {pools.map(pool => {
            const downPct = (pool.usedDownKbps / pool.totalDownKbps) * 100;
            const upPct = (pool.usedUpKbps / pool.totalUpKbps) * 100;
            return (
              <Card key={pool.id} className="bg-slate-900 text-white border-slate-800">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Monitor className="h-4 w-4 text-teal-400" />
                      <span className="font-medium text-sm">{pool.name}</span>
                    </div>
                    <Badge variant="outline" className="text-xs border-slate-700 text-slate-400">VLAN {pool.vlan}</Badge>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-400">Download Capacity</span>
                        <span className={cn('font-mono', downPct > 80 ? 'text-red-400' : 'text-emerald-400')}>{downPct.toFixed(0)}%</span>
                      </div>
                      <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
                        <div className={cn('h-full rounded-full transition-all duration-500', downPct > 80 ? 'bg-gradient-to-r from-red-600 to-orange-500' : 'bg-gradient-to-r from-emerald-600 to-teal-500')} style={{ width: `${Math.min(100, downPct)}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-400">Upload Capacity</span>
                        <span className={cn('font-mono', upPct > 80 ? 'text-red-400' : 'text-amber-400')}>{upPct.toFixed(0)}%</span>
                      </div>
                      <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
                        <div className={cn('h-full rounded-full transition-all duration-500', upPct > 80 ? 'bg-gradient-to-r from-red-600 to-orange-500' : 'bg-gradient-to-r from-amber-600 to-orange-500')} style={{ width: `${Math.min(100, upPct)}%` }} />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between text-xs text-slate-500 pt-2 border-t border-slate-800">
                    <span>Per-user: ↓{formatSpeed(pool.perUserDownKbps)} / ↑{formatSpeed(pool.perUserUpKbps)}</span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {pool.activeUsers} active
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Tab 6: Time Schedules ───────────────────────────────────────

function SchedulesTab() {
  const { toast } = useToast();
  const [schedules, setSchedules] = useState<TimeSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<TimeSchedule | null>(null);
  const [form, setForm] = useState({
    name: '',
    days: [true, true, true, true, true, false, false] as boolean[],
    startTime: '08:00',
    endTime: '18:00',
    enabled: true,
  });

  const fetchSchedules = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch<Record<string, unknown>[]>('/api/wifi/firewall/schedules');
      if (res.success && res.data) {
        setSchedules(res.data.map(mapScheduleFromApi));
      }
    } catch (e) {
      console.error(e);
      toast({ title: 'Error', description: 'Failed to load schedules', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchSchedules(); }, [fetchSchedules]);

  const openAdd = () => {
    setEditingSchedule(null);
    setForm({ name: '', days: [true, true, true, true, true, false, false], startTime: '08:00', endTime: '18:00', enabled: true });
    setDialogOpen(true);
  };

  const openEdit = (s: TimeSchedule) => {
    setEditingSchedule(s);
    setForm({ name: s.name, days: [...s.days], startTime: s.startTime, endTime: s.endTime, enabled: s.enabled });
    setDialogOpen(true);
  };

  const saveSchedule = async () => {
    try {
      setSaving(true);
      if (editingSchedule) {
        await apiFetch(`/api/wifi/firewall/schedules/${editingSchedule.id}`, {
          method: 'PUT',
          body: JSON.stringify(form),
        });
        toast({ title: 'Schedule Updated', description: `${form.name} schedule updated.` });
      } else {
        await apiFetch('/api/wifi/firewall/schedules', {
          method: 'POST',
          body: JSON.stringify({ ...form, linkedRuleCount: 0 }),
        });
        toast({ title: 'Schedule Created', description: `${form.name} schedule created.` });
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

  const deleteSchedule = async (id: string) => {
    try {
      await apiFetch(`/api/wifi/firewall/schedules/${id}`, { method: 'DELETE' });
      toast({ title: 'Schedule Deleted', description: 'Time schedule removed.' });
      await fetchSchedules();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to delete schedule';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    }
  };

  const toggleEnabled = async (schedule: TimeSchedule, enabled: boolean) => {
    try {
      await apiFetch(`/api/wifi/firewall/schedules/${schedule.id}`, {
        method: 'PUT',
        body: JSON.stringify({ enabled }),
      });
      setSchedules(schedules.map(s => s.id === schedule.id ? { ...s, enabled } : s));
    } catch {
      toast({ title: 'Error', description: 'Failed to toggle schedule', variant: 'destructive' });
    }
  };

  const toggleDay = (idx: number) => {
    setForm(prev => {
      const days = [...prev.days];
      days[idx] = !days[idx];
      return { ...prev, days };
    });
  };

  // Time blocks for visual week view (24h timeline)
  const hours = Array.from({ length: 24 }, (_, i) => i);

  if (loading) return <TableSkeleton cols={7} rows={5} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Time Schedules</h3>
        <Button onClick={openAdd} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Schedule
        </Button>
      </div>

      {/* Schedules Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Days Active</TableHead>
                <TableHead>Time Range</TableHead>
                <TableHead>Linked Rules</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12" />
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedules.map(schedule => (
                <TableRow key={schedule.id} className={cn(!schedule.enabled && 'opacity-50')}>
                  <TableCell className="font-medium">{schedule.name}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {DAY_LABELS.map((day, i) => (
                        <div
                          key={day}
                          className={cn(
                            'w-7 h-7 rounded flex items-center justify-center text-[10px] font-bold',
                            schedule.days[i]
                              ? 'bg-teal-100 text-teal-700 border border-teal-200'
                              : 'bg-muted text-muted-foreground'
                          )}
                        >
                          {day}
                        </div>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{schedule.startTime} — {schedule.endTime}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      <ShieldCheck className="h-2.5 w-2.5 mr-1" />
                      {schedule.linkedRuleCount} rules
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={schedule.enabled ? 'default' : 'secondary'} className="text-xs">
                      {schedule.enabled ? 'Active' : 'Disabled'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Switch checked={schedule.enabled} onCheckedChange={c => toggleEnabled(schedule, c)} className="scale-75" />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(schedule)}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteSchedule(schedule.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Visual Week View */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4 text-teal-600" />
            Week Schedule View
          </CardTitle>
          <CardDescription>Visual representation of active time blocks across the week</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            {/* Header row */}
            <div className="flex gap-0 min-w-[700px]">
              <div className="w-16 flex-shrink-0" />
              {DAY_LABELS.map(day => (
                <div key={day} className="flex-1 text-center text-xs font-medium text-muted-foreground pb-1">
                  {day}
                </div>
              ))}
            </div>

            {/* Hour rows */}
            <div className="space-y-px min-w-[700px]">
              {hours.filter(h => h % 2 === 0).map(hour => (
                <div key={hour} className="flex gap-0 items-center">
                  <div className="w-16 flex-shrink-0 text-[10px] text-muted-foreground font-mono text-right pr-2">
                    {hour.toString().padStart(2, '0')}:00
                  </div>
                  {DAY_LABELS.map((_, dayIdx) => {
                    // Check if any schedule covers this day+hour
                    const activeSchedules = schedules.filter(s =>
                      s.enabled && s.days[dayIdx] &&
                      parseInt(s.startTime.split(':')[0]) <= hour &&
                      parseInt(s.endTime.split(':')[0]) > hour
                    );
                    const isHourEnd = schedules.filter(s =>
                      s.enabled && s.days[dayIdx] &&
                      parseInt(s.endTime.split(':')[0]) === hour
                    );

                    return (
                      <div key={dayIdx} className="flex-1 h-6 flex items-center justify-center">
                        <div
                          className={cn(
                            'w-full h-full rounded-sm transition-colors',
                            activeSchedules.length > 0
                              ? isHourEnd.length > 0
                                ? 'bg-gradient-to-r from-teal-500/30 to-teal-500/10'
                                : 'bg-teal-500/30'
                              : 'bg-muted/30'
                          )}
                        >
                          {activeSchedules.length > 0 && (
                            <span className="text-[8px] text-teal-700 font-medium truncate block text-center leading-6">
                              {activeSchedules.map(s => s.name).join(', ')}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-4 pt-3 border-t">
            <div className="flex items-center gap-2">
              <div className="w-4 h-3 rounded-sm bg-teal-500/30" />
              <span className="text-xs text-muted-foreground">Active Time Block</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-3 rounded-sm bg-muted/30" />
              <span className="text-xs text-muted-foreground">Inactive</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingSchedule ? 'Edit Schedule' : 'Add Schedule'}</DialogTitle>
            <DialogDescription>Configure time-based firewall schedule</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Schedule Name</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Business Hours" />
            </div>

            {/* Day Picker */}
            <div className="space-y-2">
              <Label>Active Days</Label>
              <div className="flex gap-2 flex-wrap">
                {DAY_LABELS.map((day, i) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(i)}
                    className={cn(
                      'w-12 h-10 rounded-lg text-xs font-bold transition-all border',
                      form.days[i]
                        ? 'bg-teal-100 text-teal-700 border-teal-300 shadow-sm'
                        : 'bg-background text-muted-foreground border-muted hover:border-muted-foreground/30'
                    )}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>

            {/* Time Range */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Start Time</Label>
                <Input type="time" value={form.startTime} onChange={e => setForm(p => ({ ...p, startTime: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">End Time</Label>
                <Input type="time" value={form.endTime} onChange={e => setForm(p => ({ ...p, endTime: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveSchedule} disabled={!form.name || saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingSchedule ? 'Update' : 'Create'} Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Tab 7: Content Filtering ───────────────────────────────────────

const CONTENT_CATEGORIES = [
  { value: 'social_media', label: 'Social Media', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'streaming', label: 'Streaming', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { value: 'adult', label: 'Adult', color: 'bg-red-100 text-red-700 border-red-200' },
  { value: 'gaming', label: 'Gaming', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { value: 'malware', label: 'Malware', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { value: 'ads', label: 'Ads/Trackers', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { value: 'custom', label: 'Custom', color: 'bg-slate-100 text-slate-700 border-slate-200' },
] as const;

interface ContentFilterEntry {
  id: string;
  name: string;
  category: string;
  domains: string[];
  enabled: boolean;
}

interface CategorySummary {
  category: string;
  count: number;
}

function mapContentFilterFromApi(d: Record<string, unknown>): ContentFilterEntry {
  return {
    id: d.id as string,
    name: (d.name || '') as string,
    category: (d.category || 'custom') as string,
    domains: typeof d.domains === 'string' ? JSON.parse(d.domains) : ((d.domains as string[]) || []),
    enabled: !!(d.enabled),
  };
}

function ContentFilterTab() {
  const { toast } = useToast();
  const { propertyId } = usePropertyId();
  const [filters, setFilters] = useState<ContentFilterEntry[]>([]);
  const [categorySummary, setCategorySummary] = useState<CategorySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<ContentFilterEntry | null>(null);
  const [editFilterDomains, setEditFilterDomains] = useState('');
  const [newFilter, setNewFilter] = useState({ name: '', category: 'custom', enabled: true });

  const fetchContentFilters = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (propertyId) params.set('propertyId', propertyId);
      const qs = params.toString();
      const res = await apiFetch<{ data?: Record<string, unknown>[]; categorySummary?: CategorySummary[] }>(
        `/api/wifi/firewall/content-filter${qs ? `?${qs}` : ''}`
      );
      if (res.success && res.data) {
        setFilters(res.data.map(mapContentFilterFromApi));
      }
      if (res.success && (res as Record<string, unknown>).categorySummary) {
        setCategorySummary((res as Record<string, unknown>).categorySummary as CategorySummary[]);
      }
    } catch (e) {
      console.error(e);
      toast({ title: 'Error', description: 'Failed to load content filters', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast, propertyId]);

  useEffect(() => { fetchContentFilters(); }, [fetchContentFilters]);

  const toggleFilter = async (filter: ContentFilterEntry) => {
    const prev = [...filters];
    const newEnabled = !filter.enabled;
    // Optimistic update
    setFilters(filters.map(f => f.id === filter.id ? { ...f, enabled: newEnabled } : f));
    try {
      await apiFetch(`/api/wifi/firewall/content-filter/${filter.id}`, {
        method: 'PUT',
        body: JSON.stringify({ enabled: newEnabled }),
      });
      toast({ title: newEnabled ? 'Filter Enabled' : 'Filter Disabled', description: `${filter.name} has been ${newEnabled ? 'enabled' : 'disabled'}.` });
    } catch {
      // Rollback
      setFilters(prev);
      toast({ title: 'Error', description: 'Failed to toggle filter', variant: 'destructive' });
    }
  };

  const openEditDialog = (filter: ContentFilterEntry) => {
    setSelectedFilter(filter);
    setEditFilterDomains(filter.domains.join('\n'));
    setEditDialogOpen(true);
  };

  const saveFilterDomains = async () => {
    if (!selectedFilter) return;
    try {
      setSaving(true);
      const domains = editFilterDomains.split('\n').map(d => d.trim()).filter(Boolean);
      const res = await apiFetch(`/api/wifi/firewall/content-filter/${selectedFilter.id}`, {
        method: 'PUT',
        body: JSON.stringify({ domains }),
      });
      if (res.success) {
        toast({ title: 'Filter Updated', description: `${selectedFilter.name} domains updated.` });
        setEditDialogOpen(false);
        setSelectedFilter(null);
        await fetchContentFilters();
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to update filter';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const openAddDialog = () => {
    setNewFilter({ name: '', category: 'custom', enabled: true });
    setAddDialogOpen(true);
  };

  const createFilter = async () => {
    if (!newFilter.name || !propertyId) {
      toast({ title: 'Error', description: 'Name and property are required', variant: 'destructive' });
      return;
    }
    try {
      setSaving(true);
      const res = await apiFetch('/api/wifi/firewall/content-filter', {
        method: 'POST',
        body: JSON.stringify({
          propertyId,
          name: newFilter.name,
          category: newFilter.category,
          domains: [],
          enabled: newFilter.enabled,
        }),
      });
      if (res.success) {
        toast({ title: 'Filter Created', description: `${newFilter.name} content filter has been created.` });
        setAddDialogOpen(false);
        await fetchContentFilters();
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to create filter';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const deleteFilter = async (id: string) => {
    const filter = filters.find(f => f.id === id);
    try {
      await apiFetch(`/api/wifi/firewall/content-filter/${id}`, { method: 'DELETE' });
      toast({ title: 'Filter Deleted', description: `${filter?.name || 'Content filter'} has been removed.` });
      await fetchContentFilters();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to delete filter';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    }
  };

  const getCategoryInfo = (category: string) => {
    return CONTENT_CATEGORIES.find(c => c.value === category) || CONTENT_CATEGORIES[6];
  };

  if (loading) return <TabSkeleton />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Content Filtering</h3>
        <Button onClick={openAddDialog} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Filter
        </Button>
      </div>

      {/* Category Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-teal-600" />
            Category Summary
          </CardTitle>
          <CardDescription>Content filter distribution across categories</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {CONTENT_CATEGORIES.map(cat => {
              const summary = categorySummary.find(s => s.category === cat.value);
              const count = summary?.count || 0;
              return (
                <div key={cat.value} className="flex flex-col items-center gap-1 p-3 rounded-lg border bg-card">
                  <Badge variant="outline" className={cn('text-xs font-medium', cat.color)}>
                    {cat.label}
                  </Badge>
                  <span className="text-2xl font-bold">{count}</span>
                  <span className="text-[10px] text-muted-foreground">filter{count !== 1 ? 's' : ''}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Filter Cards */}
      {filters.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ShieldAlert className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h4 className="text-base font-medium text-muted-foreground">No Content Filters</h4>
            <p className="text-sm text-muted-foreground/70 mt-1 mb-4">Create content filters to block or allow specific website categories</p>
            <Button onClick={openAddDialog} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Filter
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filters.map(filter => {
            const catInfo = getCategoryInfo(filter.category);
            return (
              <Card key={filter.id} className={cn('border transition-all hover:shadow-md', !filter.enabled && 'opacity-60')}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-teal-50">
                        <ShieldAlert className="h-4 w-4 text-teal-600" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{filter.name}</CardTitle>
                        <CardDescription>{filter.domains.length} domain{filter.domains.length !== 1 ? 's' : ''}</CardDescription>
                      </div>
                    </div>
                    <Switch checked={filter.enabled} onCheckedChange={() => toggleFilter(filter)} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className={cn('text-xs font-medium', catInfo.color)}>
                      {catInfo.label}
                    </Badge>
                    <Badge variant={filter.enabled ? 'default' : 'secondary'} className="text-xs">
                      {filter.enabled ? 'Active' : 'Disabled'}
                    </Badge>
                  </div>

                  {/* Domain Preview */}
                  {filter.domains.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Domains</p>
                      <div className="max-h-24 overflow-y-auto space-y-0.5">
                        {filter.domains.slice(0, 5).map((domain, idx) => (
                          <div key={idx} className="text-xs font-mono text-muted-foreground truncate">
                            {domain}
                          </div>
                        ))}
                        {filter.domains.length > 5 && (
                          <div className="text-xs text-muted-foreground/60">
                            +{filter.domains.length - 5} more
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-1 pt-2 border-t">
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openEditDialog(filter)}>
                      <Edit2 className="h-3 w-3 mr-1" />
                      Edit Domains
                    </Button>
                    <div className="flex-1" />
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteFilter(filter.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit Domains Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Domains — {selectedFilter?.name}</DialogTitle>
            <DialogDescription>One domain per line. These domains will be blocked when the filter is active.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Badge variant="outline" className={cn('text-xs font-medium', selectedFilter && getCategoryInfo(selectedFilter.category).color)}>
                {selectedFilter && getCategoryInfo(selectedFilter.category).label}
              </Badge>
            </div>
            <div className="space-y-2">
              <Label>Domains (one per line)</Label>
              <Textarea
                value={editFilterDomains}
                onChange={e => setEditFilterDomains(e.target.value)}
                placeholder={"facebook.com\ninstagram.com\ntiktok.com"}
                className="min-h-[200px] font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                {editFilterDomains.split('\n').filter(d => d.trim()).length} domain(s)
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveFilterDomains} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Domains
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Filter Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Content Filter</DialogTitle>
            <DialogDescription>Create a new content filter category for blocking websites</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Filter Name</Label>
              <Input
                value={newFilter.name}
                onChange={e => setNewFilter(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Social Media Block"
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={newFilter.category} onValueChange={v => setNewFilter(p => ({ ...p, category: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {CONTENT_CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label>Enabled</Label>
              <Switch
                checked={newFilter.enabled}
                onCheckedChange={c => setNewFilter(p => ({ ...p, enabled: c }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
            <Button onClick={createFilter} disabled={!newFilter.name || saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Filter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
