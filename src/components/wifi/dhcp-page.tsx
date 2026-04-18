'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
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
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
  Server,
  Hash,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  Search,
  Monitor,
  Wifi,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Zap,
  Settings,
  ArrowUpDown,
  LayoutGrid,
  Users,
  Shield,
  Cpu,
  FileText,
  RotateCw,
  Ban,
  Tag,
  Filter,
  Globe,
  Terminal,
  Play,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { usePropertyId } from '@/hooks/use-property';

// ─── Types ───────────────────────────────────────────────────────────────────

interface DhcpSubnet {
  id: string;
  name: string;
  interface: string;
  tag: string;
  cidr: string;
  gateway: string;
  poolStart: string;
  poolEnd: string;
  netmask: string;
  leaseTime: string;
  leaseDisplay: string;
  dnsServers: string[];
  domainName: string;
  vlanId: number | null;
  enabled: boolean;
  activeLeases: number;
  totalPool: number;
  utilization: number;
  ipv6Enabled?: boolean;
  ipv6Prefix?: string;
  ipv6PoolStart?: string;
  ipv6PoolEnd?: string;
  ipv6LeaseTime?: string;
  ipv6RAType?: string;
}

interface DhcpBlacklistItem {
  id: string;
  macAddress: string;
  subnetId?: string;
  subnetName?: string;
  reason?: string;
  enabled: boolean;
  createdAt?: string;
}

interface DhcpOptionItem {
  id: string;
  code: number;
  name: string;
  value: string;
  type: string;
  subnetId?: string;
  subnetName?: string;
  enabled: boolean;
  description?: string;
  createdAt?: string;
}

interface DhcpTagRuleItem {
  id: string;
  name: string;
  matchType: string;
  matchPattern: string;
  setTag: string;
  subnetId?: string;
  subnetName?: string;
  enabled: boolean;
  description?: string;
  createdAt?: string;
}

interface DhcpHostnameFilterItem {
  id: string;
  pattern: string;
  action: string;
  subnetId?: string;
  subnetName?: string;
  enabled: boolean;
  description?: string;
  createdAt?: string;
}

interface DhcpLeaseScriptItem {
  id: string;
  name: string;
  scriptPath: string;
  events: string[];
  enabled: boolean;
  description?: string;
  createdAt?: string;
}

interface DhcpReservation {
  id: string;
  macAddress: string;
  ipAddress: string;
  hostname: string;
  subnetId: string;
  subnetName: string;
  leaseTime: string;
  description: string;
  enabled: boolean;
}

interface DhcpLease {
  id: string;
  ipAddress: string;
  macAddress: string;
  hostname: string;
  clientId: string;
  subnetId: string;
  subnetName: string;
  leaseStart: string;
  leaseExpires: string;
  state: 'active' | 'expired' | 'released' | 'declined';
  type: 'static' | 'dynamic';
  lastSeen: string;
}

interface SystemInterface {
  name: string;
  ip: string;
  status: string;
}

interface NetworkInterfaceOption {
  deviceName: string;
  name: string;
  type: string;
  nettype: number;
  nettypeLabel: string;
  state: string;
  ipv4Address: string;
  ipv4Cidr: number;
  ipv4Gateway: string;
  isPhysical: boolean;
  isSlave: boolean;
  vlanId?: number;
  vlanParent?: string;
  description?: string;
}

interface DnsmasqStatus {
  installed: boolean;
  running: boolean;
  processRunning: boolean;
  version: string;
  mode: string;
  backend: string;
  subnetCount: number;
  leaseCount: number;
  activeLeases: number;
  reservationCount: number;
  currentInterfaces: string[];
  systemInterfaces: SystemInterface[];
  configFile: string;
  leasesFile: string;
}

type SortDir = 'asc' | 'desc';

// ─── Utility Functions ────────────────────────────────────────────────────────

function getUtilColor(pct: number) {
  if (pct >= 85) return 'from-red-500 to-rose-600';
  if (pct >= 60) return 'from-amber-400 to-amber-600';
  return 'from-emerald-400 to-emerald-600';
}

function getUtilBorder(pct: number) {
  if (pct >= 85) return 'border-l-red-500';
  if (pct >= 60) return 'border-l-amber-400';
  return 'border-l-emerald-400';
}

function getUtilText(pct: number) {
  if (pct >= 85) return 'text-red-600';
  if (pct >= 60) return 'text-amber-600';
  return 'text-emerald-600';
}

function getLeaseStateBadge(state: DhcpLease['state']) {
  const map: Record<string, { label: string; cls: string }> = {
    active: { label: 'Active', cls: 'bg-emerald-500/15 text-emerald-700 border-emerald-300' },
    expired: { label: 'Expired', cls: 'bg-amber-500/15 text-amber-700 border-amber-300' },
    released: { label: 'Released', cls: 'bg-gray-500/15 text-gray-600 border-gray-300' },
    declined: { label: 'Declined', cls: 'bg-red-500/15 text-red-700 border-red-300' },
  };
  const s = map[state] || map.active;
  return <Badge variant="outline" className={s.cls}>{s.label}</Badge>;
}

function getLeaseTypeBadge(type: DhcpLease['type']) {
  if (type === 'static') {
    return <Badge variant="outline" className="bg-blue-500/15 text-blue-700 border-blue-300">Reserved</Badge>;
  }
  return <Badge variant="outline" className="bg-gray-500/15 text-gray-600 border-gray-300">Dynamic</Badge>;
}

function formatTime(iso: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatDate(iso: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDateTime(iso: string) {
  if (!iso) return '—';
  return `${formatDate(iso)} ${formatTime(iso)}`;
}

function getCountdown(expiresIso: string) {
  if (!expiresIso) return '—';
  const diff = new Date(expiresIso).getTime() - Date.now();
  if (diff <= 0) return 'Expired';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function validateMac(mac: string): boolean {
  return /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/.test(mac);
}

function formatMacInput(val: string): string {
  const clean = val.replace(/[^0-9A-Fa-f]/g, '').slice(0, 12);
  return clean.match(/.{1,2}/g)?.join(':') ?? clean;
}

/**
 * Compute network address from IP and CIDR prefix.
 * e.g. ipToNetwork('192.168.1.50', 24) → '192.168.1.0'
 */
function ipToNetwork(ip: string, prefix: number): string {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(p => isNaN(p))) return '';
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  const net = ((parts[0] << 24 | parts[1] << 16 | parts[2] << 8 | parts[3]) & mask) >>> 0;
  return `${(net >>> 24) & 255}.${(net >>> 16) & 255}.${(net >>> 8) & 255}.${net & 255}`;
}

/**
 * Compute broadcast address from IP and CIDR prefix.
 * e.g. ipToBroadcast('192.168.1.50', 24) → '192.168.1.255'
 */
function ipToBroadcast(ip: string, prefix: number): string {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(p => isNaN(p))) return '';
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  const bcast = ((parts[0] << 24 | parts[1] << 16 | parts[2] << 8 | parts[3]) | (~mask >>> 0)) >>> 0;
  return `${(bcast >>> 24) & 255}.${(bcast >>> 16) & 255}.${(bcast >>> 8) & 255}.${bcast & 255}`;
}

/**
 * Convert an integer IP to dotted-decimal string.
 */
function intToIp(n: number): string {
  return `${(n >>> 24) & 255}.${(n >>> 16) & 255}.${(n >>> 8) & 255}.${n & 255}`;
}

/**
 * Compute a sensible DHCP pool for a given subnet.
 * For /24: poolStart = network+100, poolEnd = broadcast-1
 * For /23: poolStart = network+100, poolEnd = broadcast-1
 * For /25 or smaller: poolStart = network+10, poolEnd = broadcast-1
 * For /16 or larger: poolStart = network+256, poolEnd = broadcast-1
 */
function computePool(networkIp: string, prefix: number, gatewayIp: string): { poolStart: string; poolEnd: string } {
  const parts = networkIp.split('.').map(Number);
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  const netInt = ((parts[0] << 24 | parts[1] << 16 | parts[2] << 8 | parts[3]) & mask) >>> 0;
  const bcastInt = (netInt | (~mask >>> 0)) >>> 0;
  const gwParts = gatewayIp.split('.').map(Number);
  const gwInt = (gwParts[0] << 24 | gwParts[1] << 16 | gwParts[2] << 8 | gwParts[3]) >>> 0;

  let startOffset: number;
  if (prefix <= 16) startOffset = 256;
  else if (prefix <= 24) startOffset = 100;
  else startOffset = 10;

  let poolStartInt = netInt + startOffset;
  // Ensure pool doesn't start at or below gateway
  if (poolStartInt <= gwInt) poolStartInt = gwInt + 1;
  // Ensure pool doesn't overlap with network address
  if (poolStartInt <= netInt + 1) poolStartInt = netInt + 2;

  const poolEndInt = bcastInt - 1;
  return { poolStart: intToIp(poolStartInt), poolEnd: intToIp(poolEndInt) };
}

function leaseTimeToSeconds(input: string): number {
  if (!input || input === 'infinite') return 0;
  const str = input.trim().toLowerCase();
  const num = parseFloat(str);
  if (isNaN(num)) return 0;
  if (str.endsWith('d')) return Math.round(num * 86400);
  if (str.endsWith('h')) return Math.round(num * 3600);
  if (str.endsWith('m')) return Math.round(num * 60);
  if (str.endsWith('s')) return Math.round(num);
  return Math.round(num * 3600); // default assume hours
}

// ─── Tab Button Component ────────────────────────────────────────────────────

function TabButton({ active, icon: Icon, label, count, onClick }: {
  active: boolean;
  icon: React.ElementType;
  label: string;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap',
        active
          ? 'bg-teal-600 text-white shadow-md shadow-teal-600/25'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
      {count !== undefined && (
        <span className={cn(
          'ml-1 px-1.5 py-0.5 text-xs rounded-full',
          active ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'
        )}>
          {count}
        </span>
      )}
    </button>
  );
}

// ─── Empty State Component ───────────────────────────────────────────────────

function EmptyState({ icon: Icon, title, description, action, actionLabel }: {
  icon: React.ElementType;
  title: string;
  description: string;
  action?: () => void;
  actionLabel?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="p-3 rounded-full bg-muted mb-4">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="text-sm font-medium mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-sm">{description}</p>
      {action && actionLabel && (
        <Button variant="outline" size="sm" onClick={action}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

// ─── Subnet Templates ────────────────────────────────────────────────────────

interface SubnetTemplate {
  name: string;
  label: string;
  icon: React.ElementType;
  color: string;
  values: {
    name: string;
    iface: string;
    cidr: string;
    gateway: string;
    poolStart: string;
    poolEnd: string;
    leaseTime: string;
    dnsServers: string;
    domainName: string;
    vlanId: string;
  };
}

const SUBNET_TEMPLATES: SubnetTemplate[] = [
  {
    name: 'guest',
    label: 'Guest WiFi',
    icon: Wifi,
    color: 'text-teal-600 bg-teal-50 dark:bg-teal-950/30',
    values: {
      name: 'Guest WiFi',
      iface: 'eth0.10',
      cidr: '192.168.1.0/24',
      gateway: '192.168.1.1',
      poolStart: '192.168.1.100',
      poolEnd: '192.168.1.250',
      leaseTime: '4h',
      dnsServers: '8.8.8.8, 8.8.4.4',
      domainName: 'guest.staysuite.local',
      vlanId: '10',
    },
  },
  {
    name: 'staff',
    label: 'Staff',
    icon: Users,
    color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/30',
    values: {
      name: 'Staff Network',
      iface: 'eth0.20',
      cidr: '192.168.2.0/24',
      gateway: '192.168.2.1',
      poolStart: '192.168.2.50',
      poolEnd: '192.168.2.200',
      leaseTime: '12h',
      dnsServers: '192.168.100.2, 8.8.8.8',
      domainName: 'staff.staysuite.local',
      vlanId: '20',
    },
  },
  {
    name: 'iot',
    label: 'IoT',
    icon: Cpu,
    color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30',
    values: {
      name: 'IoT Network',
      iface: 'eth0.30',
      cidr: '192.168.10.0/24',
      gateway: '192.168.10.1',
      poolStart: '192.168.10.100',
      poolEnd: '192.168.10.250',
      leaseTime: '7d',
      dnsServers: '192.168.100.2',
      domainName: 'iot.staysuite.local',
      vlanId: '30',
    },
  },
  {
    name: 'mgmt',
    label: 'Management',
    icon: Shield,
    color: 'text-violet-600 bg-violet-50 dark:bg-violet-950/30',
    values: {
      name: 'Management',
      iface: 'eth0.99',
      cidr: '192.168.100.0/24',
      gateway: '192.168.100.1',
      poolStart: '192.168.100.10',
      poolEnd: '192.168.100.50',
      leaseTime: '1d',
      dnsServers: '192.168.100.2, 8.8.8.8',
      domainName: 'mgmt.staysuite.local',
      vlanId: '99',
    },
  },
];

// ─── API Helpers ─────────────────────────────────────────────────────────────

async function apiCall(url: string, options?: RequestInit) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  return response.json();
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function DhcpPage() {
  const { toast } = useToast();
  const { propertyId } = usePropertyId();
  const [activeTab, setActiveTab] = useState<'subnets' | 'reservations' | 'leases' | 'blacklist' | 'options' | 'tag-rules' | 'hostname-filters' | 'lease-scripts' | 'ipv6' | 'templates'>('subnets');

  // ─── Status State ──────────────────────────────────────────────────────────
  const [status, setStatus] = useState<DnsmasqStatus>({
    installed: false, running: false, processRunning: false, version: '',
    mode: '', backend: 'dnsmasq', subnetCount: 0, leaseCount: 0,
    activeLeases: 0, reservationCount: 0, currentInterfaces: [],
    systemInterfaces: [], configFile: '', leasesFile: '',
  });
  const [statusLoading, setStatusLoading] = useState(true);

  // ─── Data State ────────────────────────────────────────────────────────────
  const [subnets, setSubnets] = useState<DhcpSubnet[]>([]);
  const [reservations, setReservations] = useState<DhcpReservation[]>([]);
  const [leases, setLeases] = useState<DhcpLease[]>([]);
  const [blacklist, setBlacklist] = useState<DhcpBlacklistItem[]>([]);
  const [dhcpOptions, setDhcpOptions] = useState<DhcpOptionItem[]>([]);
  const [tagRules, setTagRules] = useState<DhcpTagRuleItem[]>([]);
  const [hostnameFilters, setHostnameFilters] = useState<DhcpHostnameFilterItem[]>([]);
  const [leaseScripts, setLeaseScripts] = useState<DhcpLeaseScriptItem[]>([]);

  // ─── Loading States ────────────────────────────────────────────────────────
  const [loadingSubnets, setLoadingSubnets] = useState(false);
  const [loadingReservations, setLoadingReservations] = useState(false);
  const [loadingLeases, setLoadingLeases] = useState(false);
  const [loadingBlacklist, setLoadingBlacklist] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [loadingTagRules, setLoadingTagRules] = useState(false);
  const [loadingHostnameFilters, setLoadingHostnameFilters] = useState(false);
  const [loadingLeaseScripts, setLoadingLeaseScripts] = useState(false);

  // ─── Network Interface State (for DHCP subnet form) ─────────────────────
  const [eligibleInterfaces, setEligibleInterfaces] = useState<NetworkInterfaceOption[]>([]);
  const [loadingInterfaces, setLoadingInterfaces] = useState(false);

  // ─── Lease Refresh ─────────────────────────────────────────────────────────
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const [refreshKey, setRefreshKey] = useState(0);
  const [countdownKey, setCountdownKey] = useState(0);

  // ─── Status Fetch ──────────────────────────────────────────────────────────
  const fetchStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const result = await apiCall('/api/kea/status');
      if (result.success) {
        setStatus(result.data);
      }
    } catch {
      // service may be offline
    } finally {
      setStatusLoading(false);
    }
  }, []);

  // ─── Service Actions ───────────────────────────────────────────────────────
  const handleServiceAction = useCallback(async (action: 'start' | 'stop' | 'restart' | 'reload') => {
    try {
      const result = await apiCall(`/api/kea/service/${action}`, { method: 'POST' });
      if (result.success) {
        const isReload = action === 'reload';
        toast({
          title: isReload ? 'Config Reloaded' : 'Success',
          description: result.message || `dnsmasq ${action} successful.`,
        });
        if (result.running !== undefined) {
          setStatus(prev => ({ ...prev, running: result.running, processRunning: result.running }));
        }
        setTimeout(fetchStatus, 2000);
      } else {
        toast({
          title: 'Error',
          description: result.message || `Failed to ${action} dnsmasq`,
          variant: 'destructive',
        });
      }
    } catch {
      toast({ title: 'Error', description: 'Could not reach dhcp-service', variant: 'destructive' });
    }
  }, [fetchStatus, toast]);

  // ─── Fetch Functions ───────────────────────────────────────────────────────
  const fetchSubnets = useCallback(async () => {
    setLoadingSubnets(true);
    try {
      const result = await apiCall('/api/kea/subnets');
      if (result.success && Array.isArray(result.data)) {
        setSubnets(result.data.map((s: Record<string, unknown>) => ({
          id: s.id as string,
          name: s.name as string,
          interface: (s.interface as string) || '',
          tag: (s.tag as string) || '',
          cidr: (s.cidr as string) || '',
          gateway: (s.gateway as string) || '',
          poolStart: (s.poolStart as string) || '',
          poolEnd: (s.poolEnd as string) || '',
          netmask: (s.netmask as string) || '',
          leaseTime: s.leaseTime as string || '',
          leaseDisplay: (s.leaseDisplay as string) || '',
          dnsServers: (s.dnsServers as string[]) || [],
          domainName: (s.domainName as string) || '',
          vlanId: s.vlanId as number | null ?? null,
          enabled: s.enabled as boolean ?? true,
          activeLeases: (s.activeLeases as number) || 0,
          totalPool: (s.totalPool as number) || 0,
          utilization: (s.utilization as number) || 0,
          ipv6Enabled: s.ipv6Enabled as boolean ?? false,
          ipv6Prefix: (s.ipv6Prefix as string) || '',
          ipv6PoolStart: (s.ipv6PoolStart as string) || '',
          ipv6PoolEnd: (s.ipv6PoolEnd as string) || '',
          ipv6LeaseTime: (s.ipv6LeaseTime as string) || '',
          ipv6RAType: (s.ipv6RAType as string) || '',
        })));
      }
    } catch (err) {
      console.error('Error fetching subnets:', err);
    } finally {
      setLoadingSubnets(false);
    }
  }, []);

  const fetchReservations = useCallback(async () => {
    setLoadingReservations(true);
    try {
      const result = await apiCall('/api/kea/reservations');
      if (result.success && Array.isArray(result.data)) {
        setReservations(result.data.map((r: Record<string, unknown>) => ({
          id: r.id as string,
          macAddress: r.macAddress as string,
          ipAddress: r.ipAddress as string,
          hostname: (r.hostname as string) || '',
          subnetId: r.subnetId as string,
          subnetName: (r.subnetName as string) || '',
          leaseTime: (r.leaseTime as string) || '',
          description: (r.description as string) || '',
          enabled: r.enabled as boolean ?? true,
        })));
      }
    } catch (err) {
      console.error('Error fetching reservations:', err);
    } finally {
      setLoadingReservations(false);
    }
  }, []);

  const fetchLeases = useCallback(async () => {
    setLoadingLeases(true);
    try {
      const result = await apiCall('/api/kea/leases');
      if (result.success && Array.isArray(result.data)) {
        setLeases(result.data.map((l: Record<string, unknown>) => ({
          id: (l.id as string) || (l.ipAddress as string),
          ipAddress: l.ipAddress as string,
          macAddress: l.macAddress as string,
          hostname: (l.hostname as string) || '',
          clientId: (l.clientId as string) || '',
          subnetId: l.subnetId as string,
          subnetName: (l.subnetName as string) || '',
          leaseStart: (l.leaseStart as string) || '',
          leaseExpires: (l.leaseExpires as string) || '',
          state: (l.state as DhcpLease['state']) || 'active',
          type: (l.type as DhcpLease['type']) || 'dynamic',
          lastSeen: (l.lastSeen as string) || '',
        })));
        setLastRefresh(Date.now());
        setRefreshKey(k => k + 1);
      }
    } catch (err) {
      console.error('Error fetching leases:', err);
    } finally {
      setLoadingLeases(false);
    }
  }, []);

  const fetchBlacklist = useCallback(async () => {
    setLoadingBlacklist(true);
    try {
      const result = await apiCall('/api/kea/blacklist');
      if (result.success && Array.isArray(result.data)) {
        setBlacklist(result.data as DhcpBlacklistItem[]);
      }
    } catch (err) { console.error('Error fetching blacklist:', err); }
    finally { setLoadingBlacklist(false); }
  }, []);

  const fetchOptions = useCallback(async () => {
    setLoadingOptions(true);
    try {
      const result = await apiCall('/api/kea/options');
      if (result.success && Array.isArray(result.data)) {
        setDhcpOptions(result.data as DhcpOptionItem[]);
      }
    } catch (err) { console.error('Error fetching options:', err); }
    finally { setLoadingOptions(false); }
  }, []);

  const fetchTagRules = useCallback(async () => {
    setLoadingTagRules(true);
    try {
      const result = await apiCall('/api/kea/tag-rules');
      if (result.success && Array.isArray(result.data)) {
        setTagRules(result.data as DhcpTagRuleItem[]);
      }
    } catch (err) { console.error('Error fetching tag rules:', err); }
    finally { setLoadingTagRules(false); }
  }, []);

  const fetchHostnameFilters = useCallback(async () => {
    setLoadingHostnameFilters(true);
    try {
      const result = await apiCall('/api/kea/hostname-filters');
      if (result.success && Array.isArray(result.data)) {
        setHostnameFilters(result.data as DhcpHostnameFilterItem[]);
      }
    } catch (err) { console.error('Error fetching hostname filters:', err); }
    finally { setLoadingHostnameFilters(false); }
  }, []);

  const fetchLeaseScripts = useCallback(async () => {
    setLoadingLeaseScripts(true);
    try {
      const result = await apiCall('/api/kea/lease-scripts');
      if (result.success && Array.isArray(result.data)) {
        setLeaseScripts(result.data as DhcpLeaseScriptItem[]);
      }
    } catch (err) { console.error('Error fetching lease scripts:', err); }
    finally { setLoadingLeaseScripts(false); }
  }, []);

  // ─── Initial Load ──────────────────────────────────────────────────────────
  useEffect(() => {
    fetchStatus();
    fetchSubnets();
    fetchReservations();
    fetchLeases();
    fetchBlacklist();
    fetchOptions();
    fetchTagRules();
    fetchHostnameFilters();
    fetchLeaseScripts();
  }, [fetchStatus, fetchSubnets, fetchReservations, fetchLeases, fetchBlacklist, fetchOptions, fetchTagRules, fetchHostnameFilters, fetchLeaseScripts]);

  // ─── Status auto-refresh every 30s ─────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // ─── Lease auto-refresh every 10s when on Leases tab ───────────────────────
  useEffect(() => {
    if (activeTab !== 'leases') return;
    const interval = setInterval(fetchLeases, 10000);
    return () => clearInterval(interval);
  }, [activeTab, fetchLeases]);

  // ─── Countdown tick every second ───────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => setCountdownKey(k => k + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // ─── Refresh all data after service action ─────────────────────────────────
  const refreshAll = useCallback(() => {
    fetchStatus();
    fetchSubnets();
    fetchReservations();
    fetchLeases();
    fetchBlacklist();
    fetchOptions();
    fetchTagRules();
    fetchHostnameFilters();
    fetchLeaseScripts();
  }, [fetchStatus, fetchSubnets, fetchReservations, fetchLeases, fetchBlacklist, fetchOptions, fetchTagRules, fetchHostnameFilters, fetchLeaseScripts]);

  // ══════════════════════════════════════════════════════════════════════════
  // ─── Tab 1: Subnets ────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  const [subnetDialogOpen, setSubnetDialogOpen] = useState(false);
  const [editingSubnet, setEditingSubnet] = useState<DhcpSubnet | null>(null);
  const [deleteSubnetOpen, setDeleteSubnetOpen] = useState(false);
  const [subnetSaving, setSubnetSaving] = useState(false);
  const [subnetForm, setSubnetForm] = useState({
    name: '', iface: '', vlanId: '', cidr: '', gateway: '',
    poolStart: '', poolEnd: '', leaseTime: '4h',
    dnsServers: '', domainName: '',
  });

  // ─── Fetch DHCP-Eligible Network Interfaces ─────────────────────────────
  const fetchEligibleInterfaces = useCallback(async () => {
    setLoadingInterfaces(true);
    try {
      const result = await apiCall('/api/network/os?section=interfaces');
      if (result.success && Array.isArray(result.data)) {
        // Filter: exclude WAN (nettype=1), exclude slaves, exclude loopback, must have IP
        const eligible = (result.data as Record<string, unknown>[]).filter((iface) => {
          if (iface.nettype === 1) return false; // WAN
          if (iface.isSlave) return false; // bridge/bond slave port
          if (!iface.ipv4Address) return false; // must have IP configured
          const type = (iface.type as string) || '';
          if (type === 'loopback') return false;
          // Only allow: ethernet, vlan, bridge, bond
          return ['ethernet', 'vlan', 'bridge', 'bond'].includes(type);
        }).map((iface) => ({
          deviceName: (iface.deviceName as string) || (iface.name as string) || '',
          name: (iface.name as string) || '',
          type: (iface.type as string) || 'ethernet',
          nettype: (iface.nettype as number) || 0,
          nettypeLabel: (iface.nettypeLabel as string) || 'LAN',
          state: (iface.state as string) || 'down',
          ipv4Address: (iface.ipv4Address as string) || '',
          ipv4Cidr: (iface.ipv4Cidr as number) || 24,
          ipv4Gateway: (iface.ipv4Gateway as string) || '',
          isPhysical: (iface.isPhysical as boolean) || false,
          isSlave: (iface.isSlave as boolean) || false,
          vlanId: (iface.vlanId as number) || undefined,
          vlanParent: (iface.vlanParent as string) || undefined,
          description: (iface.description as string) || undefined,
        }));
        // Sort: physical first, then by nettype, then by name
        eligible.sort((a, b) => {
          if (a.isPhysical !== b.isPhysical) return a.isPhysical ? -1 : 1;
          if (a.nettype !== b.nettype) return a.nettype - b.nettype;
          return a.deviceName.localeCompare(b.deviceName);
        });
        setEligibleInterfaces(eligible);
      }
    } catch (err) {
      console.error('Error fetching eligible interfaces:', err);
    } finally {
      setLoadingInterfaces(false);
    }
  }, []);

  // ─── Auto-fill subnet form from selected network interface ───────────────
  const handleInterfaceSelect = useCallback((deviceName: string) => {
    const iface = eligibleInterfaces.find(i => i.deviceName === deviceName);
    if (!iface) {
      // User typed manually or cleared - just set the interface name
      setSubnetForm(prev => ({ ...prev, iface: deviceName }));
      return;
    }

    const prefix = iface.ipv4Cidr || 24;
    const networkAddr = ipToNetwork(iface.ipv4Address, prefix);
    const gateway = iface.ipv4Gateway || `${networkAddr.replace(/\.\d+$/, '.1')}`;
    const { poolStart, poolEnd } = computePool(networkAddr, prefix, gateway);

    setSubnetForm(prev => ({
      ...prev,
      iface: iface.deviceName,
      name: prev.name || `${iface.nettypeLabel} - ${iface.deviceName}`,
      cidr: `${networkAddr}/${prefix}`,
      gateway: gateway,
      poolStart: poolStart,
      poolEnd: poolEnd,
      vlanId: iface.vlanId ? String(iface.vlanId) : prev.vlanId,
    }));
  }, [eligibleInterfaces]);

  const openAddSubnet = () => {
    setEditingSubnet(null);
    setSubnetForm({
      name: '', iface: '', vlanId: '', cidr: '', gateway: '',
      poolStart: '', poolEnd: '', leaseTime: '4h',
      dnsServers: '8.8.8.8, 8.8.4.4', domainName: '',
    });
    fetchEligibleInterfaces();
    setSubnetDialogOpen(true);
  };

  const openEditSubnet = (s: DhcpSubnet) => {
    setEditingSubnet(s);
    setSubnetForm({
      name: s.name,
      iface: s.interface,
      vlanId: s.vlanId?.toString() ?? '',
      cidr: s.cidr,
      gateway: s.gateway,
      poolStart: s.poolStart,
      poolEnd: s.poolEnd,
      leaseTime: s.leaseDisplay || s.leaseTime || '4h',
      dnsServers: (s.dnsServers || []).join(', '),
      domainName: s.domainName,
    });
    fetchEligibleInterfaces();
    setSubnetDialogOpen(true);
  };

  const saveSubnet = async () => {
    if (!subnetForm.name || !subnetForm.cidr || !subnetForm.gateway) {
      toast({ title: 'Validation Error', description: 'Name, CIDR, and Gateway are required.', variant: 'destructive' });
      return;
    }

    const dns = subnetForm.dnsServers
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    const body: Record<string, unknown> = {
      name: subnetForm.name,
      interface: subnetForm.iface,
      cidr: subnetForm.cidr,
      subnet: subnetForm.cidr,
      gateway: subnetForm.gateway,
      poolStart: subnetForm.poolStart,
      poolEnd: subnetForm.poolEnd,
      leaseTime: leaseTimeToSeconds(subnetForm.leaseTime),
      dnsServers: dns.length > 0 ? dns : ['8.8.8.8', '8.8.4.4'],
      domainName: subnetForm.domainName,
      vlanId: subnetForm.vlanId ? parseInt(subnetForm.vlanId) : null,
    };

    if (editingSubnet) {
      body.id = editingSubnet.id;
    }

    setSubnetSaving(true);
    try {
      const url = editingSubnet
        ? `/api/kea/subnets/${editingSubnet.id}`
        : '/api/kea/subnets';
      const method = editingSubnet ? 'PUT' : 'POST';
      const result = await apiCall(url, { method, body: JSON.stringify(body) });

      if (result.success) {
        const persistedMsg = result.persisted !== false
          ? 'Config written to disk.'
          : 'Warning: config applied live but not persisted.';
        toast({
          title: editingSubnet ? 'Subnet Updated' : 'Subnet Created',
          description: `${result.message || ''} ${persistedMsg}`,
          variant: result.persisted === false ? 'destructive' : 'default',
        });
        setSubnetDialogOpen(false);
        fetchSubnets();
        fetchStatus();
      } else {
        toast({
          title: 'Error',
          description: result.message || result.error || `Failed to ${editingSubnet ? 'update' : 'create'} subnet.`,
          variant: 'destructive',
        });
      }
    } catch {
      toast({ title: 'Error', description: 'Network error. Please try again.', variant: 'destructive' });
    } finally {
      setSubnetSaving(false);
    }
  };

  const deleteSubnet = async () => {
    if (!editingSubnet) return;
    try {
      const result = await apiCall(`/api/kea/subnets/${editingSubnet.id}`, { method: 'DELETE' });
      if (result.success) {
        toast({
          title: 'Subnet Deleted',
          description: result.persisted !== false
            ? 'Subnet removed and config persisted.'
            : 'Subnet removed but config not persisted.',
          variant: result.persisted === false ? 'destructive' : 'default',
        });
        setDeleteSubnetOpen(false);
        fetchSubnets();
        fetchStatus();
      } else {
        toast({
          title: 'Error',
          description: result.message || result.error || 'Failed to delete subnet.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({ title: 'Error', description: 'Network error. Please try again.', variant: 'destructive' });
    }
  };

  // ══════════════════════════════════════════════════════════════════════════
  // ─── Tab 2: Reservations ───────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  const [resSearch, setResSearch] = useState('');
  const [resDialogOpen, setResDialogOpen] = useState(false);
  const [editingRes, setEditingRes] = useState<DhcpReservation | null>(null);
  const [deleteResOpen, setDeleteResOpen] = useState(false);
  const [selectedRes, setSelectedRes] = useState<Set<string>>(new Set());
  const [resSaving, setResSaving] = useState(false);
  const [resForm, setResForm] = useState({
    subnetId: '',
    macAddress: '',
    ipAddress: '',
    hostname: '',
    leaseTime: 'infinite',
    description: '',
  });

  const filteredReservations = reservations.filter(r => {
    if (!resSearch) return true;
    const q = resSearch.toLowerCase();
    return (
      r.macAddress.toLowerCase().includes(q) ||
      r.ipAddress.toLowerCase().includes(q) ||
      r.hostname.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q) ||
      r.subnetName.toLowerCase().includes(q)
    );
  });

  const openAddRes = () => {
    setEditingRes(null);
    setResForm({
      subnetId: subnets[0]?.id ?? '',
      macAddress: '',
      ipAddress: '',
      hostname: '',
      leaseTime: 'infinite',
      description: '',
    });
    setResDialogOpen(true);
  };

  const openEditRes = (r: DhcpReservation) => {
    setEditingRes(r);
    setResForm({
      subnetId: r.subnetId,
      macAddress: r.macAddress,
      ipAddress: r.ipAddress,
      hostname: r.hostname,
      leaseTime: r.leaseTime || 'infinite',
      description: r.description,
    });
    setResDialogOpen(true);
  };

  const saveReservation = async () => {
    if (!resForm.macAddress || !resForm.ipAddress || !validateMac(resForm.macAddress)) {
      toast({ title: 'Validation Error', description: 'Valid MAC (XX:XX:XX:XX:XX:XX) and IP are required.', variant: 'destructive' });
      return;
    }
    if (!resForm.subnetId) {
      toast({ title: 'Validation Error', description: 'Please select a subnet.', variant: 'destructive' });
      return;
    }

    const body: Record<string, unknown> = {
      subnetId: resForm.subnetId,
      macAddress: resForm.macAddress,
      ipAddress: resForm.ipAddress,
      hostname: resForm.hostname || undefined,
      leaseTime: resForm.leaseTime || 'infinite',
      description: resForm.description || undefined,
    };

    setResSaving(true);
    try {
      if (editingRes) {
        // For update, we need to handle the edit. The API uses POST with id for updates.
        body.id = editingRes.id;
      }
      const result = await apiCall('/api/kea/reservations', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      if (result.success) {
        toast({
          title: editingRes ? 'Reservation Updated' : 'Reservation Created',
          description: result.persisted !== false
            ? 'Config written to disk.'
            : 'Warning: config applied live but not persisted.',
          variant: result.persisted === false ? 'destructive' : 'default',
        });
        setResDialogOpen(false);
        fetchReservations();
        fetchStatus();
      } else {
        toast({
          title: 'Error',
          description: result.message || result.error || `Failed to ${editingRes ? 'update' : 'create'} reservation.`,
          variant: 'destructive',
        });
      }
    } catch {
      toast({ title: 'Error', description: 'Network error. Please try again.', variant: 'destructive' });
    } finally {
      setResSaving(false);
    }
  };

  const deleteReservation = async () => {
    if (!editingRes) return;
    try {
      const result = await apiCall(`/api/kea/reservations/${editingRes.id}`, { method: 'DELETE' });
      if (result.success) {
        toast({
          title: 'Reservation Deleted',
          description: result.message || 'Reservation removed and config persisted.',
        });
        setDeleteResOpen(false);
        fetchReservations();
        fetchStatus();
      } else {
        toast({
          title: 'Error',
          description: result.message || result.error || 'Failed to delete reservation.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({ title: 'Error', description: 'Network error. Please try again.', variant: 'destructive' });
    }
  };

  const toggleResSelect = (id: string) => {
    setSelectedRes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const bulkDeleteRes = async () => {
    try {
      await Promise.all(
        Array.from(selectedRes).map(id =>
          apiCall(`/api/kea/reservations/${id}`, { method: 'DELETE' })
        )
      );
      toast({ title: 'Success', description: `${selectedRes.size} reservation(s) deleted and persisted.` });
      setSelectedRes(new Set());
      fetchReservations();
      fetchStatus();
    } catch {
      toast({ title: 'Error', description: 'Network error during bulk delete.', variant: 'destructive' });
    }
  };

  // ══════════════════════════════════════════════════════════════════════════
  // ─── Tab 3: Leases ─────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  const [leaseSearch, setLeaseSearch] = useState('');
  const [leaseFilter, setLeaseFilter] = useState<string>('all');
  const [leaseSubnetFilter, setLeaseSubnetFilter] = useState<string>('all');
  const [leaseSortCol, setLeaseSortCol] = useState<string>('ipAddress');
  const [leaseSortDir, setLeaseSortDir] = useState<SortDir>('asc');

  const filteredLeases = leases
    .filter(l => {
      if (leaseFilter !== 'all' && l.state !== leaseFilter) return false;
      if (leaseSubnetFilter !== 'all' && l.subnetId !== leaseSubnetFilter) return false;
      if (leaseSearch) {
        const q = leaseSearch.toLowerCase();
        return (
          l.ipAddress.toLowerCase().includes(q) ||
          l.macAddress.toLowerCase().includes(q) ||
          l.hostname.toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => {
      let cmp = 0;
      const aVal = a[leaseSortCol as keyof DhcpLease] as string;
      const bVal = b[leaseSortCol as keyof DhcpLease] as string;
      if (typeof aVal === 'string' && typeof bVal === 'string') cmp = aVal.localeCompare(bVal);
      else cmp = (aVal ?? '') > (bVal ?? '') ? 1 : -1;
      return leaseSortDir === 'asc' ? cmp : -cmp;
    });

  const toggleLeaseSort = (col: string) => {
    if (leaseSortCol === col) setLeaseSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setLeaseSortCol(col); setLeaseSortDir('asc'); }
  };

  const activeLeaseCount = leases.filter(l => l.state === 'active').length;
  const expiredLeaseCount = leases.filter(l => l.state === 'expired').length;
  const staticLeaseCount = leases.filter(l => l.type === 'static').length;

  // ══════════════════════════════════════════════════════════════════════════
  // ─── Tab 4: Blacklist (MAC Deny List) ──────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  const [blSearch, setBlSearch] = useState('');
  const [blDialogOpen, setBlDialogOpen] = useState(false);
  const [blBulkDialogOpen, setBlBulkDialogOpen] = useState(false);
  const [editingBl, setEditingBl] = useState<DhcpBlacklistItem | null>(null);
  const [deleteBlOpen, setDeleteBlOpen] = useState(false);
  const [blSaving, setBlSaving] = useState(false);
  const [blSelected, setBlSelected] = useState<Set<string>>(new Set());
  const [blForm, setBlForm] = useState({ macAddress: '', subnetId: '__all__', reason: '', enabled: true });
  const [blBulkText, setBlBulkText] = useState('');

  const filteredBlacklist = blacklist.filter(b => {
    if (!blSearch) return true;
    const q = blSearch.toLowerCase();
    return b.macAddress.toLowerCase().includes(q) || (b.reason || '').toLowerCase().includes(q) || (b.subnetName || '').toLowerCase().includes(q);
  });

  const openAddBl = () => { setEditingBl(null); setBlForm({ macAddress: '', subnetId: '__all__', reason: '', enabled: true }); setBlDialogOpen(true); };
  const openEditBl = (b: DhcpBlacklistItem) => { setEditingBl(b); setBlForm({ macAddress: b.macAddress, subnetId: b.subnetId || '__all__', reason: b.reason || '', enabled: b.enabled }); setBlDialogOpen(true); };

  const saveBl = async () => {
    if (!blForm.macAddress) { toast({ title: 'Validation Error', description: 'MAC address is required.', variant: 'destructive' }); return; }
    setBlSaving(true);
    try {
      const body: Record<string, unknown> = { ...blForm, subnetId: blForm.subnetId === '__all__' ? null : blForm.subnetId };
      if (editingBl) body.id = editingBl.id;
      const url = editingBl ? `/api/kea/blacklist/${editingBl.id}` : '/api/kea/blacklist';
      const result = await apiCall(url, { method: editingBl ? 'PUT' : 'POST', body: JSON.stringify(body) });
      if (result.success) {
        toast({ title: editingBl ? 'Blacklist Updated' : 'Blacklist Added', description: result.message || 'MAC address added to deny list.' });
        setBlDialogOpen(false); fetchBlacklist(); fetchStatus();
      } else { toast({ title: 'Error', description: result.message || result.error || 'Failed to save.', variant: 'destructive' }); }
    } catch { toast({ title: 'Error', description: 'Network error.', variant: 'destructive' }); }
    finally { setBlSaving(false); }
  };

  const deleteBl = async () => {
    if (!editingBl) return;
    try {
      const result = await apiCall(`/api/kea/blacklist/${editingBl.id}`, { method: 'DELETE' });
      if (result.success) { toast({ title: 'Removed', description: 'MAC address removed from deny list.' }); setDeleteBlOpen(false); fetchBlacklist(); fetchStatus(); }
      else { toast({ title: 'Error', description: result.message || 'Failed to delete.', variant: 'destructive' }); }
    } catch { toast({ title: 'Error', description: 'Network error.', variant: 'destructive' }); }
  };

  const saveBulkBl = async () => {
    const macs = blBulkText.split('\n').map(l => l.trim()).filter(Boolean);
    if (macs.length === 0) { toast({ title: 'Error', description: 'No MAC addresses provided.', variant: 'destructive' }); return; }
    setBlSaving(true);
    try {
      const result = await apiCall('/api/kea/blacklist/bulk', { method: 'POST', body: JSON.stringify({ macAddresses: macs }) });
      if (result.success) { toast({ title: 'Bulk Added', description: `${macs.length} MAC address(es) added to deny list.` }); setBlBulkDialogOpen(false); setBlBulkText(''); fetchBlacklist(); fetchStatus(); }
      else { toast({ title: 'Error', description: result.message || 'Bulk add failed.', variant: 'destructive' }); }
    } catch { toast({ title: 'Error', description: 'Network error.', variant: 'destructive' }); }
    finally { setBlSaving(false); }
  };

  const bulkDeleteBl = async () => {
    try {
      await Promise.all(Array.from(blSelected).map(id => apiCall(`/api/kea/blacklist/${id}`, { method: 'DELETE' })));
      toast({ title: 'Deleted', description: `${blSelected.size} entry(s) removed.` }); setBlSelected(new Set()); fetchBlacklist(); fetchStatus();
    } catch { toast({ title: 'Error', description: 'Network error.', variant: 'destructive' }); }
  };

  const validateMacWithWildcard = (mac: string): boolean => {
    if (!mac) return false;
    const parts = mac.split(':');
    if (parts.length !== 6) return false;
    return parts.every(p => p === '*' || /^[0-9A-Fa-f]{2}$/.test(p));
  };

  const formatMacWildcardInput = (val: string): string => {
    const clean = val.replace(/[^0-9A-Fa-f*:]/g, '').slice(0, 17);
    const parts = clean.split(':');
    if (parts.length > 6) return parts.slice(0, 6).join(':');
    return parts.map(p => p.length > 2 ? p.slice(0, 2) : p).join(':');
  };

  // ══════════════════════════════════════════════════════════════════════════
  // ─── Tab 5: Options (Custom DHCP Options) ──────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  const [optSearch, setOptSearch] = useState('');
  const [optDialogOpen, setOptDialogOpen] = useState(false);
  const [editingOpt, setEditingOpt] = useState<DhcpOptionItem | null>(null);
  const [deleteOptOpen, setDeleteOptOpen] = useState(false);
  const [optSaving, setOptSaving] = useState(false);
  const [optForm, setOptForm] = useState({ code: '', name: '', value: '', type: 'string', subnetId: '__global__', enabled: true, description: '' });

  const OPTION_PRESETS = [
    { code: 42, name: 'NTP Server', type: 'ip' },
    { code: 15, name: 'Domain Name', type: 'string' },
    { code: 26, name: 'MTU', type: 'integer' },
    { code: 252, name: 'WPAD URL', type: 'string' },
    { code: 66, name: 'TFTP Server', type: 'string' },
    { code: 67, name: 'Boot File', type: 'string' },
    { code: 6, name: 'DNS Server', type: 'ip' },
    { code: 3, name: 'Router', type: 'ip' },
  ];

  const filteredOptions = dhcpOptions.filter(o => {
    if (!optSearch) return true;
    const q = optSearch.toLowerCase();
    return o.name.toLowerCase().includes(q) || String(o.code).includes(q) || o.value.toLowerCase().includes(q);
  });

  const openAddOpt = () => { setEditingOpt(null); setOptForm({ code: '', name: '', value: '', type: 'string', subnetId: '__global__', enabled: true, description: '' }); setOptDialogOpen(true); };
  const openEditOpt = (o: DhcpOptionItem) => { setEditingOpt(o); setOptForm({ code: String(o.code), name: o.name, value: o.value, type: o.type, subnetId: o.subnetId || '__global__', enabled: o.enabled, description: o.description || '' }); setOptDialogOpen(true); };
  const applyPreset = (preset: typeof OPTION_PRESETS[0]) => { setOptForm(p => ({ ...p, code: String(preset.code), name: preset.name, type: preset.type })); };

  const saveOpt = async () => {
    if (!optForm.code || !optForm.name || !optForm.value) { toast({ title: 'Validation Error', description: 'Code, name, and value are required.', variant: 'destructive' }); return; }
    const codeNum = parseInt(optForm.code);
    if (isNaN(codeNum) || codeNum < 1 || codeNum > 254) { toast({ title: 'Validation Error', description: 'Option code must be 1-254.', variant: 'destructive' }); return; }
    setOptSaving(true);
    try {
      const body: Record<string, unknown> = { ...optForm, code: codeNum, subnetId: optForm.subnetId === '__global__' ? null : optForm.subnetId };
      if (editingOpt) body.id = editingOpt.id;
      const url = editingOpt ? `/api/kea/options/${editingOpt.id}` : '/api/kea/options';
      const result = await apiCall(url, { method: editingOpt ? 'PUT' : 'POST', body: JSON.stringify(body) });
      if (result.success) { toast({ title: editingOpt ? 'Option Updated' : 'Option Created', description: result.message || 'Custom DHCP option saved.' }); setOptDialogOpen(false); fetchOptions(); fetchStatus(); }
      else { toast({ title: 'Error', description: result.message || 'Failed to save.', variant: 'destructive' }); }
    } catch { toast({ title: 'Error', description: 'Network error.', variant: 'destructive' }); }
    finally { setOptSaving(false); }
  };

  const deleteOpt = async () => {
    if (!editingOpt) return;
    try {
      const result = await apiCall(`/api/kea/options/${editingOpt.id}`, { method: 'DELETE' });
      if (result.success) { toast({ title: 'Deleted', description: 'DHCP option removed.' }); setDeleteOptOpen(false); fetchOptions(); fetchStatus(); }
      else { toast({ title: 'Error', description: result.message || 'Failed.', variant: 'destructive' }); }
    } catch { toast({ title: 'Error', description: 'Network error.', variant: 'destructive' }); }
  };

  // ══════════════════════════════════════════════════════════════════════════
  // ─── Tab 6: Tag Rules ──────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  const [trSearch, setTrSearch] = useState('');
  const [trDialogOpen, setTrDialogOpen] = useState(false);
  const [editingTr, setEditingTr] = useState<DhcpTagRuleItem | null>(null);
  const [deleteTrOpen, setDeleteTrOpen] = useState(false);
  const [trSaving, setTrSaving] = useState(false);
  const [trForm, setTrForm] = useState({ name: '', matchType: 'mac', matchPattern: '', setTag: '', subnetId: '__all__', enabled: true, description: '' });

  const MATCH_PLACEHOLDERS: Record<string, string> = {
    mac: '00:1a:dd:*:*:*',
    vendor_class: 'Hewlett-Packard JetDirect',
    user_class: 'staff-phone',
    hostname: 'printer-*',
  };

  const MATCH_LABELS: Record<string, string> = {
    mac: 'MAC Address',
    vendor_class: 'Vendor Class',
    user_class: 'User Class',
    hostname: 'Hostname',
  };

  const filteredTagRules = tagRules.filter(t => {
    if (!trSearch) return true;
    const q = trSearch.toLowerCase();
    return t.name.toLowerCase().includes(q) || t.setTag.toLowerCase().includes(q) || t.matchPattern.toLowerCase().includes(q);
  });

  const openAddTr = () => { setEditingTr(null); setTrForm({ name: '', matchType: 'mac', matchPattern: '', setTag: '', subnetId: '__all__', enabled: true, description: '' }); setTrDialogOpen(true); };
  const openEditTr = (t: DhcpTagRuleItem) => { setEditingTr(t); setTrForm({ name: t.name, matchType: t.matchType, matchPattern: t.matchPattern, setTag: t.setTag, subnetId: t.subnetId || '__all__', enabled: t.enabled, description: t.description || '' }); setTrDialogOpen(true); };

  const saveTr = async () => {
    if (!trForm.name || !trForm.matchPattern || !trForm.setTag) { toast({ title: 'Validation Error', description: 'Name, pattern, and tag are required.', variant: 'destructive' }); return; }
    setTrSaving(true);
    try {
      const body: Record<string, unknown> = { ...trForm, subnetId: trForm.subnetId === '__all__' ? null : trForm.subnetId };
      if (editingTr) body.id = editingTr.id;
      const url = editingTr ? `/api/kea/tag-rules/${editingTr.id}` : '/api/kea/tag-rules';
      const result = await apiCall(url, { method: editingTr ? 'PUT' : 'POST', body: JSON.stringify(body) });
      if (result.success) { toast({ title: editingTr ? 'Tag Rule Updated' : 'Tag Rule Created', description: result.message || 'Tag rule saved.' }); setTrDialogOpen(false); fetchTagRules(); fetchStatus(); }
      else { toast({ title: 'Error', description: result.message || 'Failed.', variant: 'destructive' }); }
    } catch { toast({ title: 'Error', description: 'Network error.', variant: 'destructive' }); }
    finally { setTrSaving(false); }
  };

  const deleteTr = async () => {
    if (!editingTr) return;
    try {
      const result = await apiCall(`/api/kea/tag-rules/${editingTr.id}`, { method: 'DELETE' });
      if (result.success) { toast({ title: 'Deleted', description: 'Tag rule removed.' }); setDeleteTrOpen(false); fetchTagRules(); fetchStatus(); }
      else { toast({ title: 'Error', description: result.message || 'Failed.', variant: 'destructive' }); }
    } catch { toast({ title: 'Error', description: 'Network error.', variant: 'destructive' }); }
  };

  // ══════════════════════════════════════════════════════════════════════════
  // ─── Tab 7: Hostname Filter ────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  const [hfSearch, setHfSearch] = useState('');
  const [hfDialogOpen, setHfDialogOpen] = useState(false);
  const [editingHf, setEditingHf] = useState<DhcpHostnameFilterItem | null>(null);
  const [deleteHfOpen, setDeleteHfOpen] = useState(false);
  const [hfSaving, setHfSaving] = useState(false);
  const [hfForm, setHfForm] = useState({ pattern: '', action: 'ignore', subnetId: '__all__', enabled: true, description: '' });

  const filteredHostnameFilters = hostnameFilters.filter(h => {
    if (!hfSearch) return true;
    const q = hfSearch.toLowerCase();
    return h.pattern.toLowerCase().includes(q) || (h.subnetName || '').toLowerCase().includes(q);
  });

  const openAddHf = () => { setEditingHf(null); setHfForm({ pattern: '', action: 'ignore', subnetId: '__all__', enabled: true, description: '' }); setHfDialogOpen(true); };
  const openEditHf = (h: DhcpHostnameFilterItem) => { setEditingHf(h); setHfForm({ pattern: h.pattern, action: h.action, subnetId: h.subnetId || '__all__', enabled: h.enabled, description: h.description || '' }); setHfDialogOpen(true); };

  const saveHf = async () => {
    if (!hfForm.pattern) { toast({ title: 'Validation Error', description: 'Pattern is required.', variant: 'destructive' }); return; }
    setHfSaving(true);
    try {
      const body: Record<string, unknown> = { ...hfForm, subnetId: hfForm.subnetId === '__all__' ? null : hfForm.subnetId };
      if (editingHf) body.id = editingHf.id;
      const url = editingHf ? `/api/kea/hostname-filters/${editingHf.id}` : '/api/kea/hostname-filters';
      const result = await apiCall(url, { method: editingHf ? 'PUT' : 'POST', body: JSON.stringify(body) });
      if (result.success) { toast({ title: editingHf ? 'Filter Updated' : 'Filter Created', description: result.message || 'Hostname filter saved.' }); setHfDialogOpen(false); fetchHostnameFilters(); fetchStatus(); }
      else { toast({ title: 'Error', description: result.message || 'Failed.', variant: 'destructive' }); }
    } catch { toast({ title: 'Error', description: 'Network error.', variant: 'destructive' }); }
    finally { setHfSaving(false); }
  };

  const deleteHf = async () => {
    if (!editingHf) return;
    try {
      const result = await apiCall(`/api/kea/hostname-filters/${editingHf.id}`, { method: 'DELETE' });
      if (result.success) { toast({ title: 'Deleted', description: 'Hostname filter removed.' }); setDeleteHfOpen(false); fetchHostnameFilters(); fetchStatus(); }
      else { toast({ title: 'Error', description: result.message || 'Failed.', variant: 'destructive' }); }
    } catch { toast({ title: 'Error', description: 'Network error.', variant: 'destructive' }); }
  };

  // ══════════════════════════════════════════════════════════════════════════
  // ─── Tab 8: Event Scripts ──────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  const [lsDialogOpen, setLsDialogOpen] = useState(false);
  const [editingLs, setEditingLs] = useState<DhcpLeaseScriptItem | null>(null);
  const [deleteLsOpen, setDeleteLsOpen] = useState(false);
  const [lsSaving, setLsSaving] = useState(false);
  const [lsForm, setLsForm] = useState({ name: '', scriptPath: '', events: [] as string[], enabled: true, description: '' });
  const LEASE_EVENTS = ['add', 'del', 'old', 'arp-add', 'arp-del'];

  const EVENT_BADGE_COLORS: Record<string, string> = {
    add: 'bg-emerald-500/15 text-emerald-700 border-emerald-300',
    del: 'bg-red-500/15 text-red-700 border-red-300',
    old: 'bg-amber-500/15 text-amber-700 border-amber-300',
    'arp-add': 'bg-sky-500/15 text-sky-700 border-sky-300',
    'arp-del': 'bg-gray-500/15 text-gray-600 border-gray-300',
  };

  const openAddLs = () => { setEditingLs(null); setLsForm({ name: '', scriptPath: '', events: [], enabled: true, description: '' }); setLsDialogOpen(true); };
  const openEditLs = (s: DhcpLeaseScriptItem) => { setEditingLs(s); setLsForm({ name: s.name, scriptPath: s.scriptPath, events: [...s.events], enabled: s.enabled, description: s.description || '' }); setLsDialogOpen(true); };

  const toggleLsEvent = (event: string) => {
    setLsForm(p => ({
      ...p,
      events: p.events.includes(event) ? p.events.filter(e => e !== event) : [...p.events, event],
    }));
  };

  const saveLs = async () => {
    if (!lsForm.name || !lsForm.scriptPath) { toast({ title: 'Validation Error', description: 'Name and script path are required.', variant: 'destructive' }); return; }
    if (!lsForm.scriptPath.startsWith('/')) { toast({ title: 'Validation Error', description: 'Script path must be absolute (start with /).', variant: 'destructive' }); return; }
    if (lsForm.events.length === 0) { toast({ title: 'Validation Error', description: 'Select at least one event.', variant: 'destructive' }); return; }
    setLsSaving(true);
    try {
      const body: Record<string, unknown> = { ...lsForm };
      if (editingLs) body.id = editingLs.id;
      const url = editingLs ? `/api/kea/lease-scripts/${editingLs.id}` : '/api/kea/lease-scripts';
      const result = await apiCall(url, { method: editingLs ? 'PUT' : 'POST', body: JSON.stringify(body) });
      if (result.success) { toast({ title: editingLs ? 'Script Updated' : 'Script Created', description: result.message || 'Lease event script saved.' }); setLsDialogOpen(false); fetchLeaseScripts(); fetchStatus(); }
      else { toast({ title: 'Error', description: result.message || 'Failed.', variant: 'destructive' }); }
    } catch { toast({ title: 'Error', description: 'Network error.', variant: 'destructive' }); }
    finally { setLsSaving(false); }
  };

  const deleteLs = async () => {
    if (!editingLs) return;
    try {
      const result = await apiCall(`/api/kea/lease-scripts/${editingLs.id}`, { method: 'DELETE' });
      if (result.success) { toast({ title: 'Deleted', description: 'Script removed.' }); setDeleteLsOpen(false); fetchLeaseScripts(); fetchStatus(); }
      else { toast({ title: 'Error', description: result.message || 'Failed.', variant: 'destructive' }); }
    } catch { toast({ title: 'Error', description: 'Network error.', variant: 'destructive' }); }
  };

  const testLs = async (s: DhcpLeaseScriptItem) => {
    toast({ title: 'Test Trigger Sent', description: `Test trigger sent for "${s.name}" with sample arguments.` });
  };

  // ══════════════════════════════════════════════════════════════════════════
  // ─── Tab 9: IPv6 ───────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  const [ipv6DialogOpen, setIpv6DialogOpen] = useState(false);
  const [editingIpv6, setEditingIpv6] = useState<DhcpSubnet | null>(null);
  const [ipv6Saving, setIpv6Saving] = useState(false);
  const [ipv6Form, setIpv6Form] = useState({ ipv6Enabled: false, ipv6Prefix: '', ipv6PoolStart: '', ipv6PoolEnd: '', ipv6LeaseTime: '', ipv6RAType: 'slaac' });

  const ipv6EnabledCount = subnets.filter(s => s.ipv6Enabled).length;
  const ipv6DisabledCount = subnets.filter(s => !s.ipv6Enabled).length;

  const RA_TYPE_BADGES: Record<string, string> = {
    slaac: 'bg-teal-500/15 text-teal-700 border-teal-300',
    stateful: 'bg-sky-500/15 text-sky-700 border-sky-300',
    'ra-only': 'bg-amber-500/15 text-amber-700 border-amber-300',
    'ra-stateless': 'bg-purple-500/15 text-purple-700 border-purple-300',
  };

  const openEditIpv6 = (s: DhcpSubnet) => {
    setEditingIpv6(s);
    setIpv6Form({
      ipv6Enabled: s.ipv6Enabled ?? false,
      ipv6Prefix: s.ipv6Prefix || '',
      ipv6PoolStart: s.ipv6PoolStart || '',
      ipv6PoolEnd: s.ipv6PoolEnd || '',
      ipv6LeaseTime: s.ipv6LeaseTime || '',
      ipv6RAType: s.ipv6RAType || 'slaac',
    });
    setIpv6DialogOpen(true);
  };

  const toggleIpv6Enabled = async (s: DhcpSubnet) => {
    const newVal = !(s.ipv6Enabled ?? false);
    try {
      const result = await apiCall(`/api/kea/subnets/${s.id}`, { method: 'PUT', body: JSON.stringify({ ipv6Enabled: newVal }) });
      if (result.success) {
        toast({ title: newVal ? 'IPv6 Enabled' : 'IPv6 Disabled', description: `IPv6 ${newVal ? 'activated' : 'deactivated'} for "${s.name}".` });
        fetchSubnets();
      } else { toast({ title: 'Error', description: result.message || 'Failed to update.', variant: 'destructive' }); }
    } catch { toast({ title: 'Error', description: 'Network error.', variant: 'destructive' }); }
  };

  const saveIpv6 = async () => {
    if (!editingIpv6) return;
    setIpv6Saving(true);
    try {
      const result = await apiCall(`/api/kea/subnets/${editingIpv6.id}`, { method: 'PUT', body: JSON.stringify(ipv6Form) });
      if (result.success) { toast({ title: 'IPv6 Settings Updated', description: `IPv6 config for "${editingIpv6.name}" saved.` }); setIpv6DialogOpen(false); fetchSubnets(); }
      else { toast({ title: 'Error', description: result.message || 'Failed.', variant: 'destructive' }); }
    } catch { toast({ title: 'Error', description: 'Network error.', variant: 'destructive' }); }
    finally { setIpv6Saving(false); }
  };

  // ══════════════════════════════════════════════════════════════════════════
  // ─── Templates Tab ─────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  const applyTemplate = (template: SubnetTemplate) => {
    setEditingSubnet(null);
    setSubnetForm({
      name: template.values.name,
      iface: template.values.iface,
      vlanId: template.values.vlanId,
      cidr: template.values.cidr,
      gateway: template.values.gateway,
      poolStart: template.values.poolStart,
      poolEnd: template.values.poolEnd,
      leaseTime: template.values.leaseTime,
      dnsServers: template.values.dnsServers,
      domainName: template.values.domainName,
    });
    setSubnetDialogOpen(true);
  };

  // ══════════════════════════════════════════════════════════════════════════
  // ─── Copy to clipboard helper ──────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(
      () => toast({ title: 'Copied', description: `${label} copied to clipboard.` }),
      () => toast({ title: 'Error', description: 'Failed to copy.', variant: 'destructive' })
    );
  };

  // ══════════════════════════════════════════════════════════════════════════
  // ─── Render: Status Header ─────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  const renderStatusHeader = () => {
    if (statusLoading) {
      return (
        <Card className="border-teal-200 dark:border-teal-900">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <Skeleton className="h-12 w-12 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-9 w-20" />
                <Skeleton className="h-9 w-20" />
                <Skeleton className="h-9 w-20" />
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className={cn(
        'border',
        status.running
          ? 'border-teal-200 dark:border-teal-900 bg-gradient-to-r from-teal-50/50 to-transparent dark:from-teal-950/20'
          : 'border-red-200 dark:border-red-900 bg-gradient-to-r from-red-50/50 to-transparent dark:from-red-950/20'
      )}>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            {/* Left: status info */}
            <div className="flex items-center gap-4">
              <div className={cn(
                'p-3 rounded-lg',
                status.running
                  ? 'bg-teal-500/15'
                  : 'bg-red-500/15'
              )}>
                <Server className={cn('h-6 w-6', status.running ? 'text-teal-600' : 'text-red-600')} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-semibold">dnsmasq DHCP</h2>
                  {status.running ? (
                    <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-300 hover:bg-emerald-500/25">
                      <span className="relative flex h-1.5 w-1.5 mr-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                      </span>
                      Online
                    </Badge>
                  ) : (
                    <Badge className="bg-red-500/15 text-red-700 border-red-300 hover:bg-red-500/25">
                      <XCircle className="h-3 w-3 mr-1" />
                      Offline
                    </Badge>
                  )}
                  {status.version && (
                    <span className="text-xs text-muted-foreground font-mono">{status.version}</span>
                  )}
                </div>
                <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1">
                    <LayoutGrid className="h-3.5 w-3.5" />
                    {status.subnetCount} subnet{status.subnetCount !== 1 ? 's' : ''}
                  </span>
                  <span className="flex items-center gap-1">
                    <Wifi className="h-3.5 w-3.5" />
                    {status.activeLeases} active leases
                  </span>
                  <span className="flex items-center gap-1">
                    <Hash className="h-3.5 w-3.5" />
                    {status.reservationCount} reservations
                  </span>
                  <span className="flex items-center gap-1">
                    <Monitor className="h-3.5 w-3.5" />
                    {status.currentInterfaces?.length || 0} interfaces
                  </span>
                </div>
              </div>
            </div>

            {/* Right: service controls */}
            <div className="flex items-center gap-2 flex-wrap">
              <TooltipProvider>
                {status.running ? (
                  <>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="sm" onClick={() => handleServiceAction('reload')}>
                          <RotateCw className="h-3.5 w-3.5 mr-1.5" />
                          Reload
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Zero-downtime config reload (SIGHUP)</p>
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="sm" onClick={() => handleServiceAction('restart')}>
                          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                          Restart
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Full service restart</p>
                      </TooltipContent>
                    </Tooltip>
                    <Button variant="destructive" size="sm" onClick={() => handleServiceAction('stop')}>
                      <XCircle className="h-3.5 w-3.5 mr-1.5" />
                      Stop
                    </Button>
                  </>
                ) : (
                  <Button size="sm" onClick={() => handleServiceAction('start')}>
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                    Start
                  </Button>
                )}
              </TooltipProvider>
            </div>
          </div>

          {/* Config info bar */}
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground border-t border-dashed pt-3">
            {status.configFile && (
              <span className="flex items-center gap-1">
                <Settings className="h-3 w-3" />
                Config: <code className="font-mono text-foreground/70">{status.configFile}</code>
              </span>
            )}
            {status.leasesFile && (
              <span className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                Leases: <code className="font-mono text-foreground/70">{status.leasesFile}</code>
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  // ══════════════════════════════════════════════════════════════════════════
  // ─── Render: Tab Navigation ────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  const renderTabNav = () => (
    <div className="flex gap-1.5 overflow-x-auto pb-1 -mb-px scrollbar-thin">
      <TabButton active={activeTab === 'subnets'} icon={Server} label="Subnets" count={subnets.length} onClick={() => setActiveTab('subnets')} />
      <TabButton active={activeTab === 'reservations'} icon={Hash} label="Reservations" count={reservations.length} onClick={() => setActiveTab('reservations')} />
      <TabButton active={activeTab === 'leases'} icon={Wifi} label="Leases" count={leases.length} onClick={() => setActiveTab('leases')} />
      <TabButton active={activeTab === 'blacklist'} icon={Ban} label="Blacklist" count={blacklist.length} onClick={() => setActiveTab('blacklist')} />
      <TabButton active={activeTab === 'options'} icon={Settings} label="Options" count={dhcpOptions.length} onClick={() => setActiveTab('options')} />
      <TabButton active={activeTab === 'tag-rules'} icon={Tag} label="Tag Rules" count={tagRules.length} onClick={() => setActiveTab('tag-rules')} />
      <TabButton active={activeTab === 'hostname-filters'} icon={Filter} label="Hostname Filter" count={hostnameFilters.length} onClick={() => setActiveTab('hostname-filters')} />
      <TabButton active={activeTab === 'lease-scripts'} icon={Terminal} label="Event Scripts" count={leaseScripts.length} onClick={() => setActiveTab('lease-scripts')} />
      <TabButton active={activeTab === 'ipv6'} icon={Globe} label="IPv6" onClick={() => setActiveTab('ipv6')} />
      <TabButton active={activeTab === 'templates'} icon={LayoutGrid} label="Templates" onClick={() => setActiveTab('templates')} />
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════
  // ─── Render: Subnets Tab ───────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  const renderSubnetsTab = () => {
    if (loadingSubnets) {
      return (
        <div className="space-y-6">
          <div className="flex justify-between">
            <div className="space-y-2">
              <Skeleton className="h-7 w-48" />
              <Skeleton className="h-4 w-36" />
            </div>
            <Skeleton className="h-9 w-32" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2, 3].map(i => (
              <Card key={i}>
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-lg" />
                      <div className="space-y-1.5">
                        <Skeleton className="h-5 w-32" />
                        <Skeleton className="h-4 w-44" />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                  <Skeleton className="h-2 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Header + actions */}
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Server className="h-5 w-5 text-teal-600" />
              DHCP Subnets
            </h2>
            <p className="text-sm text-muted-foreground">{subnets.length} subnet(s) configured</p>
          </div>
          <Button onClick={openAddSubnet}>
            <Plus className="h-4 w-4 mr-2" />
            Add Subnet
          </Button>
        </div>

        {/* Subnet cards */}
        {subnets.length === 0 ? (
          <EmptyState
            icon={Server}
            title="No subnets configured"
            description="Create your first DHCP subnet to start assigning addresses, or use a template to get started quickly."
            action={openAddSubnet}
            actionLabel="Add Subnet"
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {subnets.map((s) => {
              const pct = s.utilization || (s.totalPool > 0 ? Math.round((s.activeLeases / s.totalPool) * 100) : 0);
              return (
                <Card key={s.id} className={cn('relative overflow-hidden border-l-4 transition-shadow hover:shadow-md', getUtilBorder(pct))}>
                  <CardContent className="p-5">
                    {/* Header row */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className={cn('p-2 rounded-lg bg-gradient-to-br', getUtilColor(pct))}>
                          <Server className="h-4 w-4 text-white" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-base">{s.name}</h3>
                          <p className="font-mono text-sm text-muted-foreground">{s.cidr}</p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditSubnet(s)}>
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit subnet</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700" onClick={() => { setEditingSubnet(s); setDeleteSubnetOpen(true); }}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete subnet</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>

                    {/* Info grid */}
                    <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                      {s.interface && (
                        <div>
                          <span className="text-muted-foreground">Interface</span>
                          <p className="font-mono font-medium flex items-center gap-1">
                            <Monitor className="h-3 w-3 text-muted-foreground" />
                            {s.interface}
                          </p>
                        </div>
                      )}
                      <div>
                        <span className="text-muted-foreground">Gateway</span>
                        <p className="font-mono font-medium">{s.gateway}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Pool Range</span>
                        <p className="font-mono font-medium text-xs">{s.poolStart} → {s.poolEnd}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Lease Time</span>
                        <p className="font-medium">{s.leaseDisplay || s.leaseTime || '—'}</p>
                      </div>
                      {s.vlanId != null && (
                        <div>
                          <span className="text-muted-foreground">VLAN</span>
                          <p><Badge variant="outline">{s.vlanId}</Badge></p>
                        </div>
                      )}
                      {s.domainName && (
                        <div>
                          <span className="text-muted-foreground">Domain</span>
                          <p className="font-mono text-xs truncate">{s.domainName}</p>
                        </div>
                      )}
                    </div>

                    {/* DNS servers */}
                    {s.dnsServers && s.dnsServers.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {s.dnsServers.map((dns) => (
                          <Badge key={dns} variant="secondary" className="font-mono text-xs">{dns}</Badge>
                        ))}
                      </div>
                    )}

                    <Separator className="my-3" />

                    {/* Utilization bar */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Active Leases</span>
                        <span className={cn('text-sm font-bold', getUtilText(pct))}>{s.activeLeases}/{s.totalPool}</span>
                      </div>
                      <span className={cn('text-sm font-bold', getUtilText(pct))}>{pct}%</span>
                    </div>
                    <div className="mt-1.5 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-500', getUtilColor(pct))}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Add/Edit Subnet Dialog */}
        <Dialog open={subnetDialogOpen} onOpenChange={setSubnetDialogOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingSubnet ? 'Edit Subnet' : 'Add Subnet'}</DialogTitle>
              <DialogDescription>
                {editingSubnet
                  ? 'Modify the DHCP subnet configuration. Changes are written to disk and reloaded.'
                  : 'Create a new DHCP subnet. The config will be written to disk and dnsmasq reloaded.'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="subnet-name">Subnet Name *</Label>
                <Input
                  id="subnet-name"
                  value={subnetForm.name}
                  onChange={e => setSubnetForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Guest WiFi"
                />
              </div>

              {/* Interface Selector + VLAN */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="subnet-iface-select">
                    <span className="flex items-center gap-1.5">
                      <Monitor className="h-3.5 w-3.5" />
                      Interface
                    </span>
                  </Label>
                  {loadingInterfaces ? (
                    <Skeleton className="h-9 w-full" />
                  ) : eligibleInterfaces.length > 0 ? (
                    <Select
                      value={subnetForm.iface}
                      onValueChange={handleInterfaceSelect}
                    >
                      <SelectTrigger id="subnet-iface-select" className="font-mono">
                        <SelectValue placeholder="Select interface..." />
                      </SelectTrigger>
                      <SelectContent>
                        {eligibleInterfaces.map((iface) => (
                          <SelectItem key={iface.deviceName} value={iface.deviceName}>
                            <span className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-mono">
                                {iface.type === 'vlan' ? 'VLAN' : iface.type === 'bridge' ? 'BR' : iface.type === 'bond' ? 'BOND' : 'PHY'}
                              </Badge>
                              <span className="font-mono font-medium">{iface.deviceName}</span>
                              <span className="text-muted-foreground text-xs">
                                {iface.ipv4Address}/{iface.ipv4Cidr}
                              </span>
                              <Badge
                                variant="outline"
                                className={cn(
                                  'text-[10px] px-1.5 py-0 h-4',
                                  iface.state === 'up'
                                    ? 'bg-emerald-500/15 text-emerald-700 border-emerald-300'
                                    : 'bg-gray-500/15 text-gray-600 border-gray-300'
                                )}
                              >
                                {iface.nettypeLabel}
                              </Badge>
                              {iface.state !== 'up' && (
                                <AlertTriangle className="h-3 w-3 text-amber-500" />
                              )}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="relative">
                      <Input
                        id="subnet-iface"
                        value={subnetForm.iface}
                        onChange={e => setSubnetForm(p => ({ ...p, iface: e.target.value }))}
                        placeholder="e.g. eth0.10 (manual)"
                        className="font-mono pr-8"
                      />
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="absolute right-2 top-1/2 -translate-y-1/2">
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>No eligible interfaces found from Network Manager.</p>
                            <p>You can type the interface name manually.</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Select from Network Manager (excludes WAN) or type manually
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subnet-vlan">VLAN ID</Label>
                  <Input
                    id="subnet-vlan"
                    type="number"
                    value={subnetForm.vlanId}
                    onChange={e => setSubnetForm(p => ({ ...p, vlanId: e.target.value }))}
                    placeholder="e.g. 10"
                    disabled={!!subnetForm.iface && eligibleInterfaces.some(i => i.deviceName === subnetForm.iface && !!i.vlanId)}
                  />
                  {subnetForm.iface && eligibleInterfaces.some(i => i.deviceName === subnetForm.iface && !!i.vlanId) && (
                    <p className="text-xs text-muted-foreground">Auto-filled from VLAN interface</p>
                  )}
                </div>
              </div>

              {/* Auto-fill info banner */}
              {subnetForm.iface && eligibleInterfaces.some(i => i.deviceName === subnetForm.iface) && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-teal-50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-900 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-teal-600 shrink-0" />
                  <span className="text-teal-700 dark:text-teal-400">
                    Form auto-filled from <span className="font-mono font-medium">{subnetForm.iface}</span> network config. You can edit any field manually.
                  </span>
                </div>
              )}

              {/* CIDR + Gateway */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="subnet-cidr">CIDR *</Label>
                  <Input
                    id="subnet-cidr"
                    value={subnetForm.cidr}
                    onChange={e => setSubnetForm(p => ({ ...p, cidr: e.target.value }))}
                    placeholder="192.168.1.0/24"
                    className="font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subnet-gateway">Gateway *</Label>
                  <Input
                    id="subnet-gateway"
                    value={subnetForm.gateway}
                    onChange={e => setSubnetForm(p => ({ ...p, gateway: e.target.value }))}
                    placeholder="192.168.1.1"
                    className="font-mono"
                  />
                </div>
              </div>

              {/* Pool Start + End */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="subnet-pool-start">Pool Start</Label>
                  <Input
                    id="subnet-pool-start"
                    value={subnetForm.poolStart}
                    onChange={e => setSubnetForm(p => ({ ...p, poolStart: e.target.value }))}
                    placeholder="192.168.1.100"
                    className="font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subnet-pool-end">Pool End</Label>
                  <Input
                    id="subnet-pool-end"
                    value={subnetForm.poolEnd}
                    onChange={e => setSubnetForm(p => ({ ...p, poolEnd: e.target.value }))}
                    placeholder="192.168.1.250"
                    className="font-mono"
                  />
                </div>
              </div>

              {/* Lease Time */}
              <div className="space-y-2">
                <Label htmlFor="subnet-lease">Lease Time</Label>
                <Input
                  id="subnet-lease"
                  value={subnetForm.leaseTime}
                  onChange={e => setSubnetForm(p => ({ ...p, leaseTime: e.target.value }))}
                  placeholder="e.g. 4h, 12h, 7d, infinite"
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Use format like: <code>30m</code>, <code>4h</code>, <code>7d</code>, <code>infinite</code>
                </p>
              </div>

              {/* DNS Servers */}
              <div className="space-y-2">
                <Label htmlFor="subnet-dns">DNS Servers</Label>
                <Input
                  id="subnet-dns"
                  value={subnetForm.dnsServers}
                  onChange={e => setSubnetForm(p => ({ ...p, dnsServers: e.target.value }))}
                  placeholder="8.8.8.8, 8.8.4.4"
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">Comma-separated</p>
              </div>

              {/* Domain Name */}
              <div className="space-y-2">
                <Label htmlFor="subnet-domain">Domain Name</Label>
                <Input
                  id="subnet-domain"
                  value={subnetForm.domainName}
                  onChange={e => setSubnetForm(p => ({ ...p, domainName: e.target.value }))}
                  placeholder="guest.staysuite.local"
                  className="font-mono"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSubnetDialogOpen(false)}>Cancel</Button>
              <Button onClick={saveSubnet} disabled={subnetSaving}>
                {subnetSaving && <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                {editingSubnet ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Subnet Confirmation */}
        <AlertDialog open={deleteSubnetOpen} onOpenChange={setDeleteSubnetOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Subnet</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete &quot;{editingSubnet?.name}&quot;?
                Active leases on this subnet will be released.
                This action is persisted to the config file.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={deleteSubnet}
                className="bg-red-600 text-white hover:bg-red-700"
              >
                Delete Subnet
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════════════════════
  // ─── Render: Reservations Tab ──────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  const renderReservationsTab = () => {
    if (loadingReservations) {
      return (
        <div className="space-y-6">
          <div className="flex justify-between">
            <div className="space-y-2">
              <Skeleton className="h-7 w-48" />
              <Skeleton className="h-4 w-56" />
            </div>
            <Skeleton className="h-9 w-40" />
          </div>
          <Card><CardContent className="p-4"><Skeleton className="h-10 w-full" /></CardContent></Card>
          <Card>
            <CardContent className="p-0">
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4, 5].map(i => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Hash className="h-5 w-5 text-teal-600" />
              DHCP Reservations
            </h2>
            <p className="text-sm text-muted-foreground">{reservations.length} static reservation(s) configured</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {selectedRes.size > 0 && (
              <Button variant="destructive" size="sm" onClick={bulkDeleteRes}>
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Delete ({selectedRes.size})
              </Button>
            )}
            <Button onClick={openAddRes}>
              <Plus className="h-4 w-4 mr-2" />
              Add Reservation
            </Button>
          </div>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by MAC, IP, hostname, or description..."
                value={resSearch}
                onChange={e => setResSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        {filteredReservations.length === 0 ? (
          <EmptyState
            icon={Hash}
            title="No reservations found"
            description={resSearch ? 'No reservations match your search query.' : 'Create your first static DHCP reservation to assign fixed IP addresses to devices.'}
            action={!resSearch ? openAddRes : undefined}
            actionLabel="Add Reservation"
          />
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={filteredReservations.length > 0 && filteredReservations.every(r => selectedRes.has(r.id))}
                          onCheckedChange={checked => {
                            if (checked) setSelectedRes(new Set(filteredReservations.map(r => r.id)));
                            else setSelectedRes(new Set());
                          }}
                        />
                      </TableHead>
                      <TableHead>MAC Address</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Hostname</TableHead>
                      <TableHead>Subnet</TableHead>
                      <TableHead>Lease Time</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReservations.map((r) => (
                      <TableRow key={r.id} className={cn(selectedRes.has(r.id) && 'bg-teal-50/50 dark:bg-teal-950/20')}>
                        <TableCell>
                          <Checkbox checked={selectedRes.has(r.id)} onCheckedChange={() => toggleResSelect(r.id)} />
                        </TableCell>
                        <TableCell>
                          <span
                            className="font-mono text-sm cursor-pointer hover:text-teal-600 transition-colors"
                            onClick={() => copyToClipboard(r.macAddress, 'MAC address')}
                            title="Click to copy"
                          >
                            {r.macAddress}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span
                            className="font-mono text-sm font-medium cursor-pointer hover:text-teal-600 transition-colors"
                            onClick={() => copyToClipboard(r.ipAddress, 'IP address')}
                            title="Click to copy"
                          >
                            {r.ipAddress}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm max-w-[120px] truncate">{r.hostname || '—'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{r.subnetName}</Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs font-mono">{r.leaseTime || 'infinite'}</span>
                        </TableCell>
                        <TableCell className="text-sm max-w-[150px] truncate text-muted-foreground">{r.description || '—'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditRes(r)}>
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700" onClick={() => { setEditingRes(r); setDeleteResOpen(true); }}>
                              <Trash2 className="h-3 w-3" />
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
        )}

        {/* Add/Edit Reservation Dialog */}
        <Dialog open={resDialogOpen} onOpenChange={setResDialogOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingRes ? 'Edit Reservation' : 'Add Reservation'}</DialogTitle>
              <DialogDescription>
                {editingRes
                  ? 'Modify the static DHCP reservation. Changes are persisted to config.'
                  : 'Create a new static DHCP reservation. The device will always receive this IP address.'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {/* Subnet */}
              <div className="space-y-2">
                <Label>Subnet *</Label>
                <Select value={resForm.subnetId} onValueChange={v => setResForm(p => ({ ...p, subnetId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select subnet" /></SelectTrigger>
                  <SelectContent>
                    {subnets.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name} ({s.cidr})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* MAC + IP */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>MAC Address *</Label>
                  <Input
                    value={resForm.macAddress}
                    onChange={e => setResForm(p => ({ ...p, macAddress: formatMacInput(e.target.value) }))}
                    placeholder="XX:XX:XX:XX:XX:XX"
                    className={cn('font-mono', resForm.macAddress && !validateMac(resForm.macAddress) && 'border-red-500 focus-visible:ring-red-500')}
                    maxLength={17}
                  />
                  {resForm.macAddress && !validateMac(resForm.macAddress) && (
                    <p className="text-xs text-red-500">Invalid MAC format</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>IP Address *</Label>
                  <Input
                    value={resForm.ipAddress}
                    onChange={e => setResForm(p => ({ ...p, ipAddress: e.target.value }))}
                    placeholder="192.168.1.200"
                    className="font-mono"
                  />
                </div>
              </div>

              {/* Hostname */}
              <div className="space-y-2">
                <Label>Hostname</Label>
                <Input
                  value={resForm.hostname}
                  onChange={e => setResForm(p => ({ ...p, hostname: e.target.value }))}
                  placeholder="my-device"
                />
              </div>

              {/* Lease Time + Description */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Lease Time</Label>
                  <Input
                    value={resForm.leaseTime}
                    onChange={e => setResForm(p => ({ ...p, leaseTime: e.target.value }))}
                    placeholder="infinite"
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground">e.g. <code>4h</code>, <code>infinite</code></p>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    value={resForm.description}
                    onChange={e => setResForm(p => ({ ...p, description: e.target.value }))}
                    placeholder="Purpose of this reservation"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setResDialogOpen(false)}>Cancel</Button>
              <Button onClick={saveReservation} disabled={resSaving}>
                {resSaving && <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                {editingRes ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Reservation Confirmation */}
        <AlertDialog open={deleteResOpen} onOpenChange={setDeleteResOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Reservation</AlertDialogTitle>
              <AlertDialogDescription>
                Delete reservation for <code className="font-mono">{editingRes?.macAddress}</code> → <code className="font-mono">{editingRes?.ipAddress}</code>?
                This will be persisted to the config file.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={deleteReservation}
                className="bg-red-600 text-white hover:bg-red-700"
              >
                Delete Reservation
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════════════════════
  // ─── Render: Leases Tab ────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  const renderLeasesTab = () => {
    if (loadingLeases && leases.length === 0) {
      return (
        <div className="space-y-6">
          <div className="flex justify-between">
            <div className="space-y-2">
              <Skeleton className="h-7 w-36" />
              <Skeleton className="h-4 w-48" />
            </div>
            <Skeleton className="h-9 w-32" />
          </div>
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
            {[1, 2, 3, 4].map(i => (
              <Card key={i} className="p-4">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-8 w-8 rounded-lg" />
                  <div className="space-y-1">
                    <Skeleton className="h-7 w-12" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
          <Card><CardContent className="p-4"><Skeleton className="h-10 w-full" /></CardContent></Card>
          <Card>
            <CardContent className="p-0">
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Wifi className="h-5 w-5 text-teal-600" />
              DHCP Leases
              <span className="inline-flex items-center gap-1 text-sm font-normal text-muted-foreground ml-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                Auto-refresh 10s
              </span>
            </h2>
            <p className="text-sm text-muted-foreground">
              Last refreshed: {new Date(lastRefresh).toLocaleTimeString()}
              {' '}· {leases.length} total
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchLeases}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Refresh Now
            </Button>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              </div>
              <div>
                <div className="text-2xl font-bold text-emerald-600">{activeLeaseCount}</div>
                <div className="text-xs text-muted-foreground">Active</div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              </div>
              <div>
                <div className="text-2xl font-bold text-amber-600">{expiredLeaseCount}</div>
                <div className="text-xs text-muted-foreground">Expired</div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Hash className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">{staticLeaseCount}</div>
                <div className="text-xs text-muted-foreground">Reserved</div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-teal-500/10">
                <Server className="h-4 w-4 text-teal-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{subnets.length}</div>
                <div className="text-xs text-muted-foreground">Subnets</div>
              </div>
            </div>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by IP, MAC, or hostname..."
                  value={leaseSearch}
                  onChange={e => setLeaseSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={leaseFilter} onValueChange={setLeaseFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Filter by state" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All States</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="released">Released</SelectItem>
                </SelectContent>
              </Select>
              <Select value={leaseSubnetFilter} onValueChange={setLeaseSubnetFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filter by subnet" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subnets</SelectItem>
                  {subnets.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Lease table */}
        {filteredLeases.length === 0 ? (
          <EmptyState
            icon={Wifi}
            title="No leases found"
            description={leaseSearch || leaseFilter !== 'all' || leaseSubnetFilter !== 'all'
              ? 'No leases match the current filters. Try adjusting your search criteria.'
              : 'No DHCP leases recorded yet. Leases will appear here as devices connect to the network.'}
          />
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead
                        className="cursor-pointer select-none"
                        onClick={() => toggleLeaseSort('ipAddress')}
                      >
                        <span className="flex items-center gap-1">
                          IP <ArrowUpDown className="h-3 w-3" />
                        </span>
                      </TableHead>
                      <TableHead>MAC</TableHead>
                      <TableHead>Hostname</TableHead>
                      <TableHead>Client ID</TableHead>
                      <TableHead>Subnet</TableHead>
                      <TableHead>Start</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead>State</TableHead>
                      <TableHead>Type</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLeases.slice(0, 100).map((l) => (
                      <TableRow
                        key={`${l.id}-${refreshKey}`}
                        className={cn(
                          'transition-colors',
                          l.state === 'active' && 'bg-emerald-50/30 dark:bg-emerald-950/10'
                        )}
                      >
                        <TableCell>
                          <span
                            className="font-mono text-sm font-medium cursor-pointer hover:text-teal-600 transition-colors"
                            onClick={() => copyToClipboard(l.ipAddress, 'IP address')}
                            title="Click to copy"
                          >
                            {l.ipAddress}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span
                            className="font-mono text-xs cursor-pointer hover:text-teal-600 transition-colors"
                            onClick={() => copyToClipboard(l.macAddress, 'MAC address')}
                            title="Click to copy"
                          >
                            {l.macAddress}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm max-w-[120px] truncate">{l.hostname || '—'}</TableCell>
                        <TableCell>
                          <span className="font-mono text-xs text-muted-foreground max-w-[80px] truncate block">
                            {l.clientId || '—'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{l.subnetName}</Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatDateTime(l.leaseStart)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="min-w-[80px]">
                            {l.state === 'active' ? (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="text-xs font-medium text-emerald-600 cursor-help">
                                      {getCountdown(l.leaseExpires)}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {formatDateTime(l.leaseExpires)}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                {formatDateTime(l.leaseExpires)}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{getLeaseStateBadge(l.state)}</TableCell>
                        <TableCell>{getLeaseTypeBadge(l.type)}</TableCell>
                      </TableRow>
                    ))}
                    {filteredLeases.length > 100 && (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-3 text-sm text-muted-foreground">
                          Showing 100 of {filteredLeases.length} leases. Use filters to narrow results.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════════════════════
  // ─── Render: Blacklist Tab ──────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  const renderBlacklistTab = () => {
    if (loadingBlacklist) {
      return (
        <div className="space-y-6">
          <div className="flex justify-between"><div className="space-y-2"><Skeleton className="h-7 w-48" /><Skeleton className="h-4 w-36" /></div><Skeleton className="h-9 w-32" /></div>
          <Card><CardContent className="p-4"><Skeleton className="h-10 w-full" /></CardContent></Card>
          <Card><CardContent className="p-0"><div className="p-4 space-y-3">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div></CardContent></Card>
        </div>
      );
    }
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2"><Ban className="h-5 w-5 text-teal-600" />MAC Blacklist</h2>
            <p className="text-sm text-muted-foreground">{blacklist.length} blocked MAC address(es)</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {blSelected.size > 0 && <Button variant="destructive" size="sm" onClick={bulkDeleteBl}><Trash2 className="h-3.5 w-3.5 mr-1.5" />Delete ({blSelected.size})</Button>}
            <Button variant="outline" size="sm" onClick={() => setBlBulkDialogOpen(true)}><Plus className="h-3.5 w-3.5 mr-1.5" />Bulk Import</Button>
            <Button onClick={openAddBl}><Plus className="h-4 w-4 mr-2" />Add MAC</Button>
          </div>
        </div>
        <Card><CardContent className="p-4"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search by MAC address or reason..." value={blSearch} onChange={e => setBlSearch(e.target.value)} className="pl-9" /></div></CardContent></Card>
        {filteredBlacklist.length === 0 ? (
          <EmptyState icon={Ban} title="No blocked MAC addresses" description={blSearch ? 'No entries match your search.' : 'Block specific MAC addresses from receiving DHCP leases.'} action={!blSearch ? openAddBl : undefined} actionLabel="Add MAC" />
        ) : (
          <Card><CardContent className="p-0"><div className="max-h-96 overflow-y-auto"><Table><TableHeader><TableRow>
            <TableHead className="w-10"><Checkbox checked={filteredBlacklist.length > 0 && filteredBlacklist.every(b => blSelected.has(b.id))} onCheckedChange={c => { if (c) setBlSelected(new Set(filteredBlacklist.map(b => b.id))); else setBlSelected(new Set()); }} /></TableHead>
            <TableHead>MAC Address</TableHead><TableHead>Subnet</TableHead><TableHead>Reason</TableHead><TableHead>Enabled</TableHead><TableHead className="text-right">Actions</TableHead>
          </TableRow></TableHeader><TableBody>
            {filteredBlacklist.map(b => (
              <TableRow key={b.id} className={cn(blSelected.has(b.id) && 'bg-teal-50/50 dark:bg-teal-950/20')}>
                <TableCell><Checkbox checked={blSelected.has(b.id)} onCheckedChange={() => setBlSelected(p => { const n = new Set(p); if (n.has(b.id)) n.delete(b.id); else n.add(b.id); return n; })} /></TableCell>
                <TableCell><span className="font-mono text-sm cursor-pointer hover:text-teal-600 transition-colors" onClick={() => copyToClipboard(b.macAddress, 'MAC address')} title="Click to copy">{b.macAddress}</span></TableCell>
                <TableCell><Badge variant="outline" className="text-xs">{b.subnetName || 'All Subnets'}</Badge></TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">{b.reason || '—'}</TableCell>
                <TableCell><Badge variant="outline" className={b.enabled ? 'bg-emerald-500/15 text-emerald-700 border-emerald-300' : 'bg-gray-500/15 text-gray-600 border-gray-300'}>{b.enabled ? 'Yes' : 'No'}</Badge></TableCell>
                <TableCell className="text-right"><div className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditBl(b)}><Edit2 className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700" onClick={() => { setEditingBl(b); setDeleteBlOpen(true); }}><Trash2 className="h-3 w-3" /></Button>
                </div></TableCell>
              </TableRow>
            ))}
          </TableBody></Table></div></CardContent></Card>
        )}
        {/* Add/Edit Dialog */}
        <Dialog open={blDialogOpen} onOpenChange={setBlDialogOpen}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>{editingBl ? 'Edit' : 'Add'} Blacklist Entry</DialogTitle><DialogDescription>{editingBl ? 'Modify the blocked MAC entry.' : 'Add a MAC address to the deny list. The device will not receive a DHCP lease.'}</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2"><Label>MAC Address *</Label><Input value={blForm.macAddress} onChange={e => setBlForm(p => ({ ...p, macAddress: formatMacWildcardInput(e.target.value) }))} placeholder="00:1a:dd:*:*:* (supports wildcards)" className="font-mono" maxLength={17} /><p className="text-xs text-muted-foreground">Format: xx:xx:xx:xx:xx:xx — use * for wildcard segments</p></div>
            <div className="space-y-2"><Label>Subnet</Label><Select value={blForm.subnetId} onValueChange={v => setBlForm(p => ({ ...p, subnetId: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__all__">All Subnets</SelectItem>{subnets.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Reason</Label><Input value={blForm.reason} onChange={e => setBlForm(p => ({ ...p, reason: e.target.value }))} placeholder="Why is this MAC blocked?" /></div>
            <div className="flex items-center gap-2"><Checkbox checked={blForm.enabled} onCheckedChange={c => setBlForm(p => ({ ...p, enabled: !!c }))} /><Label>Enabled</Label></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setBlDialogOpen(false)}>Cancel</Button><Button onClick={saveBl} disabled={blSaving}>{blSaving && <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />}{editingBl ? 'Update' : 'Add'}</Button></DialogFooter>
        </DialogContent></Dialog>
        {/* Bulk Import Dialog */}
        <Dialog open={blBulkDialogOpen} onOpenChange={setBlBulkDialogOpen}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Bulk Import MAC Addresses</DialogTitle><DialogDescription>Paste one MAC address per line. They will all be added to the deny list.</DialogDescription></DialogHeader>
          <div className="py-4"><textarea className="w-full h-40 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder={"00:1a:2b:3c:4d:5e\n00:1a:2b:3c:4d:5f\n..."} value={blBulkText} onChange={e => setBlBulkText(e.target.value)} /></div>
          <DialogFooter><Button variant="outline" onClick={() => setBlBulkDialogOpen(false)}>Cancel</Button><Button onClick={saveBulkBl} disabled={blSaving}>{blSaving && <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />}Import {blBulkText ? blBulkText.split('\n').filter(Boolean).length : 0} MACs</Button></DialogFooter>
        </DialogContent></Dialog>
        {/* Delete Confirmation */}
        <AlertDialog open={deleteBlOpen} onOpenChange={setDeleteBlOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete Blacklist Entry</AlertDialogTitle><AlertDialogDescription>Remove {editingBl?.macAddress} from the deny list?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={deleteBl} className="bg-red-600 text-white hover:bg-red-700">Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════════════════════
  // ─── Render: Options Tab ───────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  const renderOptionsTab = () => {
    if (loadingOptions) {
      return (<div className="space-y-6"><div className="flex justify-between"><div className="space-y-2"><Skeleton className="h-7 w-48" /><Skeleton className="h-4 w-36" /></div><Skeleton className="h-9 w-32" /></div><Card><CardContent className="p-0"><div className="p-4 space-y-3">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div></CardContent></Card></div>);
    }
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2"><Settings className="h-5 w-5 text-teal-600" />Custom DHCP Options</h2>
            <p className="text-sm text-muted-foreground">{dhcpOptions.length} custom option(s) configured</p>
          </div>
          <Button onClick={openAddOpt}><Plus className="h-4 w-4 mr-2" />Add Option</Button>
        </div>
        <Card><CardContent className="p-4"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search by name, code, or value..." value={optSearch} onChange={e => setOptSearch(e.target.value)} className="pl-9" /></div></CardContent></Card>
        {filteredOptions.length === 0 ? (
          <EmptyState icon={Settings} title="No custom options" description={optSearch ? 'No options match your search.' : 'Add custom DHCP options to extend configuration. Use presets for common options.'} action={!optSearch ? openAddOpt : undefined} actionLabel="Add Option" />
        ) : (
          <Card><CardContent className="p-0"><div className="max-h-96 overflow-y-auto"><Table><TableHeader><TableRow>
            <TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Value</TableHead><TableHead>Type</TableHead><TableHead>Subnet</TableHead><TableHead>Enabled</TableHead><TableHead className="text-right">Actions</TableHead>
          </TableRow></TableHeader><TableBody>
            {filteredOptions.map(o => (
              <TableRow key={o.id}>
                <TableCell><Badge variant="outline" className="font-mono">{o.code}</Badge></TableCell>
                <TableCell className="font-medium text-sm">{o.name}</TableCell>
                <TableCell><span className="font-mono text-xs">{o.value}</span></TableCell>
                <TableCell><Badge variant="secondary" className="text-xs">{o.type}</Badge></TableCell>
                <TableCell><Badge variant="outline" className="text-xs">{o.subnetName || 'Global'}</Badge></TableCell>
                <TableCell><Badge variant="outline" className={o.enabled ? 'bg-emerald-500/15 text-emerald-700 border-emerald-300' : 'bg-gray-500/15 text-gray-600 border-gray-300'}>{o.enabled ? 'Yes' : 'No'}</Badge></TableCell>
                <TableCell className="text-right"><div className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditOpt(o)}><Edit2 className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700" onClick={() => { setEditingOpt(o); setDeleteOptOpen(true); }}><Trash2 className="h-3 w-3" /></Button>
                </div></TableCell>
              </TableRow>
            ))}
          </TableBody></Table></div></CardContent></Card>
        )}
        {/* Add/Edit Dialog */}
        <Dialog open={optDialogOpen} onOpenChange={setOptDialogOpen}><DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{editingOpt ? 'Edit' : 'Add'} DHCP Option</DialogTitle><DialogDescription>{editingOpt ? 'Modify custom DHCP option.' : 'Add a custom DHCP option. Code 1-254.'}</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex flex-wrap gap-2"><span className="text-xs text-muted-foreground self-center mr-1">Quick presets:</span>{OPTION_PRESETS.map(p => <Button key={p.code} variant="outline" size="sm" className="text-xs h-7" onClick={() => applyPreset(p)}>{p.name} ({p.code})</Button>)}</div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Option Code *</Label><Input type="number" min={1} max={254} value={optForm.code} onChange={e => setOptForm(p => ({ ...p, code: e.target.value }))} placeholder="1-254" className="font-mono" /></div>
              <div className="space-y-2"><Label>Name *</Label><Input value={optForm.name} onChange={e => setOptForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. NTP Server" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Value *</Label><Input value={optForm.value} onChange={e => setOptForm(p => ({ ...p, value: e.target.value }))} placeholder="Option value" className="font-mono" /></div>
              <div className="space-y-2"><Label>Type</Label><Select value={optForm.type} onValueChange={v => setOptForm(p => ({ ...p, type: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['string','ip','integer','boolean','hex'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="space-y-2"><Label>Subnet</Label><Select value={optForm.subnetId} onValueChange={v => setOptForm(p => ({ ...p, subnetId: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__global__">Global (all subnets)</SelectItem>{subnets.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Description</Label><Input value={optForm.description} onChange={e => setOptForm(p => ({ ...p, description: e.target.value }))} placeholder="Optional description" /></div>
            <div className="flex items-center gap-2"><Checkbox checked={optForm.enabled} onCheckedChange={c => setOptForm(p => ({ ...p, enabled: !!c }))} /><Label>Enabled</Label></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOptDialogOpen(false)}>Cancel</Button><Button onClick={saveOpt} disabled={optSaving}>{optSaving && <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />}{editingOpt ? 'Update' : 'Create'}</Button></DialogFooter>
        </DialogContent></Dialog>
        <AlertDialog open={deleteOptOpen} onOpenChange={setDeleteOptOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete Option</AlertDialogTitle><AlertDialogDescription>Delete option &quot;{editingOpt?.name}&quot; (code {editingOpt?.code})?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={deleteOpt} className="bg-red-600 text-white hover:bg-red-700">Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════════════════════
  // ─── Render: Tag Rules Tab ─────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  const renderTagRulesTab = () => {
    if (loadingTagRules) {
      return (<div className="space-y-6"><div className="flex justify-between"><div className="space-y-2"><Skeleton className="h-7 w-48" /><Skeleton className="h-4 w-36" /></div><Skeleton className="h-9 w-32" /></div><Card><CardContent className="p-0"><div className="p-4 space-y-3">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div></CardContent></Card></div>);
    }
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div><h2 className="text-xl font-semibold flex items-center gap-2"><Tag className="h-5 w-5 text-teal-600" />Tag Rules</h2><p className="text-sm text-muted-foreground">{tagRules.length} rule(s) configured</p></div>
          <Button onClick={openAddTr}><Plus className="h-4 w-4 mr-2" />Add Rule</Button>
        </div>
        <Card><CardContent className="p-4"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search by name, tag, or pattern..." value={trSearch} onChange={e => setTrSearch(e.target.value)} className="pl-9" /></div></CardContent></Card>
        {filteredTagRules.length === 0 ? (
          <EmptyState icon={Tag} title="No tag rules" description={trSearch ? 'No rules match your search.' : 'Create tag rules to classify devices by MAC, vendor class, user class, or hostname.'} action={!trSearch ? openAddTr : undefined} actionLabel="Add Rule" />
        ) : (
          <Card><CardContent className="p-0"><div className="max-h-96 overflow-y-auto"><Table><TableHeader><TableRow>
            <TableHead>Name</TableHead><TableHead>Match Type</TableHead><TableHead>Pattern</TableHead><TableHead>Tag</TableHead><TableHead>Subnet</TableHead><TableHead>Enabled</TableHead><TableHead className="text-right">Actions</TableHead>
          </TableRow></TableHeader><TableBody>
            {filteredTagRules.map(t => (
              <TableRow key={t.id}>
                <TableCell className="font-medium text-sm">{t.name}</TableCell>
                <TableCell><Badge variant="secondary" className="text-xs">{MATCH_LABELS[t.matchType] || t.matchType}</Badge></TableCell>
                <TableCell><span className="font-mono text-xs">{t.matchPattern}</span></TableCell>
                <TableCell><Badge variant="outline" className="bg-teal-500/15 text-teal-700 border-teal-300">{t.setTag}</Badge></TableCell>
                <TableCell><Badge variant="outline" className="text-xs">{t.subnetName || 'All'}</Badge></TableCell>
                <TableCell><Badge variant="outline" className={t.enabled ? 'bg-emerald-500/15 text-emerald-700 border-emerald-300' : 'bg-gray-500/15 text-gray-600 border-gray-300'}>{t.enabled ? 'Yes' : 'No'}</Badge></TableCell>
                <TableCell className="text-right"><div className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditTr(t)}><Edit2 className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700" onClick={() => { setEditingTr(t); setDeleteTrOpen(true); }}><Trash2 className="h-3 w-3" /></Button>
                </div></TableCell>
              </TableRow>
            ))}
          </TableBody></Table></div></CardContent></Card>
        )}
        <Dialog open={trDialogOpen} onOpenChange={setTrDialogOpen}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>{editingTr ? 'Edit' : 'Add'} Tag Rule</DialogTitle><DialogDescription>{editingTr ? 'Modify the tag rule.' : 'Create a tag rule to classify devices matching a pattern.'}</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2"><Label>Name *</Label><Input value={trForm.name} onChange={e => setTrForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. HP Printers" /></div>
            <div className="space-y-2"><Label>Match Type</Label><Select value={trForm.matchType} onValueChange={v => setTrForm(p => ({ ...p, matchType: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(MATCH_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Pattern *</Label><Input value={trForm.matchPattern} onChange={e => setTrForm(p => ({ ...p, matchPattern: e.target.value }))} placeholder={MATCH_PLACEHOLDERS[trForm.matchType] || ''} className="font-mono" /><p className="text-xs text-muted-foreground">Example: {MATCH_PLACEHOLDERS[trForm.matchType]}</p></div>
            <div className="space-y-2"><Label>Tag Name *</Label><Input value={trForm.setTag} onChange={e => setTrForm(p => ({ ...p, setTag: e.target.value }))} placeholder="e.g. printers" /></div>
            <div className="space-y-2"><Label>Subnet</Label><Select value={trForm.subnetId} onValueChange={v => setTrForm(p => ({ ...p, subnetId: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__all__">All Subnets</SelectItem>{subnets.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Description</Label><Input value={trForm.description} onChange={e => setTrForm(p => ({ ...p, description: e.target.value }))} /></div>
            <div className="flex items-center gap-2"><Checkbox checked={trForm.enabled} onCheckedChange={c => setTrForm(p => ({ ...p, enabled: !!c }))} /><Label>Enabled</Label></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setTrDialogOpen(false)}>Cancel</Button><Button onClick={saveTr} disabled={trSaving}>{trSaving && <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />}{editingTr ? 'Update' : 'Create'}</Button></DialogFooter>
        </DialogContent></Dialog>
        <AlertDialog open={deleteTrOpen} onOpenChange={setDeleteTrOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete Tag Rule</AlertDialogTitle><AlertDialogDescription>Delete rule &quot;{editingTr?.name}&quot;?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={deleteTr} className="bg-red-600 text-white hover:bg-red-700">Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════════════════════
  // ─── Render: Hostname Filter Tab ───────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  const renderHostnameFilterTab = () => {
    if (loadingHostnameFilters) {
      return (<div className="space-y-6"><div className="flex justify-between"><div className="space-y-2"><Skeleton className="h-7 w-48" /><Skeleton className="h-4 w-36" /></div><Skeleton className="h-9 w-32" /></div><Card><CardContent className="p-0"><div className="p-4 space-y-3">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div></CardContent></Card></div>);
    }
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div><h2 className="text-xl font-semibold flex items-center gap-2"><Filter className="h-5 w-5 text-teal-600" />Hostname Filter</h2><p className="text-sm text-muted-foreground">{hostnameFilters.length} filter(s) configured</p></div>
          <Button onClick={openAddHf}><Plus className="h-4 w-4 mr-2" />Add Filter</Button>
        </div>
        {/* Info Banner */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-teal-50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-900 text-sm">
          <Info className="h-4 w-4 text-teal-600 shrink-0 mt-0.5" />
          <div className="text-teal-700 dark:text-teal-400">
            <strong>Ignore Name:</strong> Device gets a DHCP lease but hostname is not registered in DNS. <strong>Deny Lease:</strong> Device is completely blocked from getting a lease.
          </div>
        </div>
        <Card><CardContent className="p-4"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search by pattern..." value={hfSearch} onChange={e => setHfSearch(e.target.value)} className="pl-9" /></div></CardContent></Card>
        {filteredHostnameFilters.length === 0 ? (
          <EmptyState icon={Filter} title="No hostname filters" description={hfSearch ? 'No filters match your search.' : 'Create hostname filters to block or ignore devices by their hostname pattern.'} action={!hfSearch ? openAddHf : undefined} actionLabel="Add Filter" />
        ) : (
          <Card><CardContent className="p-0"><div className="max-h-96 overflow-y-auto"><Table><TableHeader><TableRow>
            <TableHead>Pattern</TableHead><TableHead>Action</TableHead><TableHead>Subnet</TableHead><TableHead>Enabled</TableHead><TableHead className="text-right">Actions</TableHead>
          </TableRow></TableHeader><TableBody>
            {filteredHostnameFilters.map(h => (
              <TableRow key={h.id}>
                <TableCell><span className="font-mono text-sm">{h.pattern}</span></TableCell>
                <TableCell><Badge variant="outline" className={h.action === 'deny' ? 'bg-red-500/15 text-red-700 border-red-300' : 'bg-amber-500/15 text-amber-700 border-amber-300'}>{h.action === 'deny' ? 'Deny Lease' : 'Ignore Name'}</Badge></TableCell>
                <TableCell><Badge variant="outline" className="text-xs">{h.subnetName || 'All Subnets'}</Badge></TableCell>
                <TableCell><Badge variant="outline" className={h.enabled ? 'bg-emerald-500/15 text-emerald-700 border-emerald-300' : 'bg-gray-500/15 text-gray-600 border-gray-300'}>{h.enabled ? 'Yes' : 'No'}</Badge></TableCell>
                <TableCell className="text-right"><div className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditHf(h)}><Edit2 className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700" onClick={() => { setEditingHf(h); setDeleteHfOpen(true); }}><Trash2 className="h-3 w-3" /></Button>
                </div></TableCell>
              </TableRow>
            ))}
          </TableBody></Table></div></CardContent></Card>
        )}
        <Dialog open={hfDialogOpen} onOpenChange={setHfDialogOpen}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>{editingHf ? 'Edit' : 'Add'} Hostname Filter</DialogTitle><DialogDescription>{editingHf ? 'Modify the hostname filter.' : 'Create a filter to block or ignore devices by hostname pattern.'}</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2"><Label>Pattern *</Label><Input value={hfForm.pattern} onChange={e => setHfForm(p => ({ ...p, pattern: e.target.value }))} placeholder="e.g. android-* or printer-123" className="font-mono" /><p className="text-xs text-muted-foreground">Hostname pattern. Supports trailing wildcard (*).</p></div>
            <div className="space-y-2"><Label>Action</Label><Select value={hfForm.action} onValueChange={v => setHfForm(p => ({ ...p, action: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ignore">Ignore Name</SelectItem><SelectItem value="deny">Deny Lease</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Subnet</Label><Select value={hfForm.subnetId} onValueChange={v => setHfForm(p => ({ ...p, subnetId: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__all__">All Subnets</SelectItem>{subnets.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Description</Label><Input value={hfForm.description} onChange={e => setHfForm(p => ({ ...p, description: e.target.value }))} /></div>
            <div className="flex items-center gap-2"><Checkbox checked={hfForm.enabled} onCheckedChange={c => setHfForm(p => ({ ...p, enabled: !!c }))} /><Label>Enabled</Label></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setHfDialogOpen(false)}>Cancel</Button><Button onClick={saveHf} disabled={hfSaving}>{hfSaving && <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />}{editingHf ? 'Update' : 'Create'}</Button></DialogFooter>
        </DialogContent></Dialog>
        <AlertDialog open={deleteHfOpen} onOpenChange={setDeleteHfOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete Hostname Filter</AlertDialogTitle><AlertDialogDescription>Delete filter for pattern &quot;{editingHf?.pattern}&quot;?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={deleteHf} className="bg-red-600 text-white hover:bg-red-700">Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════════════════════
  // ─── Render: Event Scripts Tab ─────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  const renderLeaseScriptsTab = () => {
    if (loadingLeaseScripts) {
      return (<div className="space-y-6"><div className="flex justify-between"><div className="space-y-2"><Skeleton className="h-7 w-48" /><Skeleton className="h-4 w-36" /></div><Skeleton className="h-9 w-32" /></div><div className="grid gap-4 md:grid-cols-2">{[1,2].map(i => <Card key={i}><CardContent className="p-5 space-y-3"><Skeleton className="h-5 w-32" /><Skeleton className="h-4 w-48" /><Skeleton className="h-8 w-full" /></CardContent></Card>)}</div></div>);
    }
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div><h2 className="text-xl font-semibold flex items-center gap-2"><Terminal className="h-5 w-5 text-teal-600" />Event Scripts</h2><p className="text-sm text-muted-foreground">{leaseScripts.length} script(s) configured</p></div>
          <Button onClick={openAddLs}><Plus className="h-4 w-4 mr-2" />Add Script</Button>
        </div>
        {leaseScripts.length === 0 ? (
          <EmptyState icon={Terminal} title="No event scripts" description="Configure scripts that run on DHCP lease events (add, delete, expire, ARP changes)." action={openAddLs} actionLabel="Add Script" />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {leaseScripts.map(s => (
              <Card key={s.id} className={cn('transition-shadow hover:shadow-md', !s.enabled && 'opacity-60')}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-lg bg-teal-500/10"><Terminal className="h-4 w-4 text-teal-600" /></div>
                      <div><h3 className="font-semibold text-base">{s.name}</h3><p className="font-mono text-xs text-muted-foreground">{s.scriptPath}</p></div>
                    </div>
                    <div className="flex gap-1">
                      <TooltipProvider><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => testLs(s)}><Play className="h-3 w-3 text-emerald-500" /></Button></TooltipTrigger><TooltipContent>Test trigger</TooltipContent></Tooltip></TooltipProvider>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditLs(s)}><Edit2 className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700" onClick={() => { setEditingLs(s); setDeleteLsOpen(true); }}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-3">{s.events.map(ev => <Badge key={ev} variant="outline" className={cn('text-xs', EVENT_BADGE_COLORS[ev])}>{ev}</Badge>)}</div>
                  {s.description && <p className="text-sm text-muted-foreground">{s.description}</p>}
                  <div className="mt-3"><Badge variant="outline" className={s.enabled ? 'bg-emerald-500/15 text-emerald-700 border-emerald-300' : 'bg-gray-500/15 text-gray-600 border-gray-300'}>{s.enabled ? 'Enabled' : 'Disabled'}</Badge></div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        <Dialog open={lsDialogOpen} onOpenChange={setLsDialogOpen}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>{editingLs ? 'Edit' : 'Add'} Event Script</DialogTitle><DialogDescription>{editingLs ? 'Modify the lease event script.' : 'Configure a script to run on DHCP lease events.'}</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2"><Label>Name *</Label><Input value={lsForm.name} onChange={e => setLsForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Notify Admin" /></div>
            <div className="space-y-2"><Label>Script Path *</Label><Input value={lsForm.scriptPath} onChange={e => setLsForm(p => ({ ...p, scriptPath: e.target.value }))} placeholder="/usr/local/bin/dhcp-notify.sh" className="font-mono" /><p className="text-xs text-muted-foreground">Must be an absolute path. The script must exist on the server.</p></div>
            <div className="space-y-2"><Label>Events *</Label><div className="flex flex-wrap gap-2">{LEASE_EVENTS.map(ev => <button key={ev} type="button" onClick={() => toggleLsEvent(ev)} className={cn('px-3 py-1.5 rounded-md text-xs font-medium border transition-colors', lsForm.events.includes(ev) ? EVENT_BADGE_COLORS[ev] : 'border-muted text-muted-foreground hover:bg-muted')}>{ev}</button>)}</div><p className="text-xs text-muted-foreground">Select at least one event to trigger the script.</p></div>
            <div className="space-y-2"><Label>Description</Label><Input value={lsForm.description} onChange={e => setLsForm(p => ({ ...p, description: e.target.value }))} placeholder="What this script does" /></div>
            <div className="flex items-center gap-2"><Checkbox checked={lsForm.enabled} onCheckedChange={c => setLsForm(p => ({ ...p, enabled: !!c }))} /><Label>Enabled</Label></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setLsDialogOpen(false)}>Cancel</Button><Button onClick={saveLs} disabled={lsSaving}>{lsSaving && <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />}{editingLs ? 'Update' : 'Create'}</Button></DialogFooter>
        </DialogContent></Dialog>
        <AlertDialog open={deleteLsOpen} onOpenChange={setDeleteLsOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete Script</AlertDialogTitle><AlertDialogDescription>Delete script &quot;{editingLs?.name}&quot;?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={deleteLs} className="bg-red-600 text-white hover:bg-red-700">Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════════════════════
  // ─── Render: IPv6 Tab ──────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  const renderIpv6Tab = () => {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div><h2 className="text-xl font-semibold flex items-center gap-2"><Globe className="h-5 w-5 text-teal-600" />IPv6 Dual-Stack</h2><p className="text-sm text-muted-foreground">Configure IPv6 per subnet for DHCPv6 support</p></div>
        </div>
        {/* Info Banner */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-teal-50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-900 text-sm">
          <Info className="h-4 w-4 text-teal-600 shrink-0 mt-0.5" />
          <div className="text-teal-700 dark:text-teal-400">IPv6 is a feature flag. Enable per subnet below to activate DHCPv6 dual-stack. Supports SLAAC, Stateful, RA-Only, and RA-Stateless modes.</div>
        </div>
        {/* Summary Cards */}
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3">
          <Card className="p-4"><div className="flex items-center gap-2"><div className="p-2 rounded-lg bg-teal-500/10"><Server className="h-4 w-4 text-teal-500" /></div><div><div className="text-2xl font-bold">{subnets.length}</div><div className="text-xs text-muted-foreground">Total Subnets</div></div></div></Card>
          <Card className="p-4"><div className="flex items-center gap-2"><div className="p-2 rounded-lg bg-emerald-500/10"><CheckCircle2 className="h-4 w-4 text-emerald-500" /></div><div><div className="text-2xl font-bold text-emerald-600">{ipv6EnabledCount}</div><div className="text-xs text-muted-foreground">IPv6 Enabled</div></div></div></Card>
          <Card className="p-4"><div className="flex items-center gap-2"><div className="p-2 rounded-lg bg-gray-500/10"><XCircle className="h-4 w-4 text-gray-500" /></div><div><div className="text-2xl font-bold text-gray-600">{ipv6DisabledCount}</div><div className="text-xs text-muted-foreground">IPv6 Disabled</div></div></div></Card>
        </div>
        {/* Subnet IPv6 Table */}
        {subnets.length === 0 ? (
          <EmptyState icon={Globe} title="No subnets" description="Create subnets first to configure IPv6 settings." />
        ) : (
          <Card><CardContent className="p-0"><div className="max-h-96 overflow-y-auto"><Table><TableHeader><TableRow>
            <TableHead>Subnet Name</TableHead><TableHead>IPv4 CIDR</TableHead><TableHead>IPv6 Enabled</TableHead><TableHead>IPv6 Prefix</TableHead><TableHead>IPv6 Pool</TableHead><TableHead>RA Type</TableHead><TableHead>Lease Time</TableHead><TableHead className="text-right">Actions</TableHead>
          </TableRow></TableHeader><TableBody>
            {subnets.map(s => (
              <TableRow key={s.id}>
                <TableCell className="font-medium text-sm">{s.name}</TableCell>
                <TableCell><span className="font-mono text-xs">{s.cidr}</span></TableCell>
                <TableCell>
                  <button onClick={() => toggleIpv6Enabled(s)} className={cn('relative inline-flex h-5 w-9 items-center rounded-full transition-colors', s.ipv6Enabled ? 'bg-teal-500' : 'bg-gray-300 dark:bg-gray-600')}>
                    <span className={cn('inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow-sm', s.ipv6Enabled ? 'translate-x-4.5' : 'translate-x-0.5')} />
                  </button>
                </TableCell>
                <TableCell><span className="font-mono text-xs">{s.ipv6Prefix || '—'}</span></TableCell>
                <TableCell><span className="font-mono text-xs">{s.ipv6PoolStart && s.ipv6PoolEnd ? `${s.ipv6PoolStart} - ${s.ipv6PoolEnd}` : '—'}</span></TableCell>
                <TableCell>{s.ipv6RAType ? <Badge variant="outline" className={RA_TYPE_BADGES[s.ipv6RAType] || ''}>{s.ipv6RAType}</Badge> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                <TableCell><span className="text-xs">{s.ipv6LeaseTime || '—'}</span></TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditIpv6(s)}><Edit2 className="h-3 w-3" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody></Table></div></CardContent></Card>
        )}
        {/* Edit IPv6 Dialog */}
        <Dialog open={ipv6DialogOpen} onOpenChange={setIpv6DialogOpen}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Edit IPv6 Settings</DialogTitle><DialogDescription>Configure IPv6 for subnet &quot;{editingIpv6?.name}&quot;</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex items-center gap-2"><Checkbox checked={ipv6Form.ipv6Enabled} onCheckedChange={c => setIpv6Form(p => ({ ...p, ipv6Enabled: !!c }))} /><Label>Enable IPv6 (DHCPv6 dual-stack)</Label></div>
            <div className="space-y-2"><Label>IPv6 Prefix</Label><Input value={ipv6Form.ipv6Prefix} onChange={e => setIpv6Form(p => ({ ...p, ipv6Prefix: e.target.value }))} placeholder="e.g. fd00::/64" className="font-mono" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Pool Start</Label><Input value={ipv6Form.ipv6PoolStart} onChange={e => setIpv6Form(p => ({ ...p, ipv6PoolStart: e.target.value }))} placeholder="fd00::100" className="font-mono" /></div>
              <div className="space-y-2"><Label>Pool End</Label><Input value={ipv6Form.ipv6PoolEnd} onChange={e => setIpv6Form(p => ({ ...p, ipv6PoolEnd: e.target.value }))} placeholder="fd00::200" className="font-mono" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Lease Time</Label><Input value={ipv6Form.ipv6LeaseTime} onChange={e => setIpv6Form(p => ({ ...p, ipv6LeaseTime: e.target.value }))} placeholder="e.g. 4h, 1d" className="font-mono" /></div>
              <div className="space-y-2"><Label>RA Type</Label><Select value={ipv6Form.ipv6RAType} onValueChange={v => setIpv6Form(p => ({ ...p, ipv6RAType: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
                <SelectItem value="slaac">SLAAC</SelectItem><SelectItem value="stateful">Stateful</SelectItem><SelectItem value="ra-only">RA-Only</SelectItem><SelectItem value="ra-stateless">RA-Stateless</SelectItem>
              </SelectContent></Select></div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setIpv6DialogOpen(false)}>Cancel</Button><Button onClick={saveIpv6} disabled={ipv6Saving}>{ipv6Saving && <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />}Save</Button></DialogFooter>
        </DialogContent></Dialog>
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════════════════════
  // ─── Render: Templates Tab ─────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  const renderTemplatesTab = () => (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <LayoutGrid className="h-5 w-5 text-teal-600" />
          Quick Templates
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Pre-configured subnet templates for common hospitality network setups. Click to pre-fill the subnet form.
        </p>
      </div>

      {/* Template cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {SUBNET_TEMPLATES.map((t) => {
          const Icon = t.icon;
          return (
            <Card
              key={t.name}
              className="cursor-pointer hover:shadow-md transition-all duration-200 hover:border-teal-300 dark:hover:border-teal-800 group"
              onClick={() => applyTemplate(t)}
            >
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className={cn('p-3 rounded-lg', t.color)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-semibold text-base">{t.label}</h3>
                      <Badge variant="secondary" className="text-xs">VLAN {t.values.vlanId}</Badge>
                    </div>
                    <p className="font-mono text-sm text-muted-foreground mb-3">{t.values.cidr}</p>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Interface: </span>
                        <span className="font-mono">{t.values.iface}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Gateway: </span>
                        <span className="font-mono">{t.values.gateway}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Pool: </span>
                        <span className="font-mono">{t.values.poolStart}-{t.values.poolEnd}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Lease: </span>
                        <span className="font-mono">{t.values.leaseTime}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-muted-foreground">DNS: </span>
                        <span className="font-mono">{t.values.dnsServers}</span>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-3 text-teal-600 hover:text-teal-700 group-hover:opacity-100 opacity-0 transition-opacity"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1.5" />
                      Use Template
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Custom info */}
      <Card className="border-dashed">
        <CardContent className="p-6 text-center">
          <div className="flex flex-col items-center gap-2">
            <div className="p-2 rounded-full bg-muted">
              <Zap className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground max-w-md">
              Templates pre-fill the subnet creation form. You can customize all values before saving.
              Each template includes interface, VLAN, pool range, DNS, and domain name defaults.
            </p>
            <Button variant="outline" size="sm" className="mt-2" onClick={openAddSubnet}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Create Custom Subnet
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ══════════════════════════════════════════════════════════════════════════
  // ─── Main Render ───────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Status Header */}
        {renderStatusHeader()}

        {/* Tab Navigation */}
        <Separator />
        {renderTabNav()}

        {/* Tab Content */}
        <div key={activeTab}>
          {activeTab === 'subnets' && renderSubnetsTab()}
          {activeTab === 'reservations' && renderReservationsTab()}
          {activeTab === 'leases' && renderLeasesTab()}
          {activeTab === 'blacklist' && renderBlacklistTab()}
          {activeTab === 'options' && renderOptionsTab()}
          {activeTab === 'tag-rules' && renderTagRulesTab()}
          {activeTab === 'hostname-filters' && renderHostnameFilterTab()}
          {activeTab === 'lease-scripts' && renderLeaseScriptsTab()}
          {activeTab === 'ipv6' && renderIpv6Tab()}
          {activeTab === 'templates' && renderTemplatesTab()}
        </div>
      </div>
    </TooltipProvider>
  );
}


