'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Skeleton } from '@/components/ui/skeleton';
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
  Server,
  Hash,
  Clock,
  Plus,
  Edit2,
  Trash2,
  Download,
  Upload,
  RefreshCw,
  Search,
  Filter,
  Monitor,
  Wifi,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Zap,
  FileText,
  Settings,
  ArrowUpDown,
  LayoutGrid,
  Users,
  Shield,
  Cpu,
  Globe,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { usePropertyId } from '@/hooks/use-property';

// ─── Types ───────────────────────────────────────────────────────────────────

interface DhcpSubnet {
  id: string;
  name: string;
  cidr: string;
  gateway: string;
  poolStart: string;
  poolEnd: string;
  leaseTime: number;
  leaseUnit: string;
  domainName: string;
  dnsServers: string[];
  ntpServers: string[];
  vlanId: number | null;
  activeLeases: number;
  totalPool: number;
}

interface DhcpReservation {
  id: string;
  macAddress: string;
  ipAddress: string;
  hostname: string;
  subnetId: string;
  subnetName: string;
  linkedType: 'guest' | 'room' | 'device' | 'staff';
  linkedName: string;
  leaseOverride: string | null;
  description: string;
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
  lastSeen: string;
}

interface DhcpOption {
  id: string;
  code: number;
  name: string;
  value: string;
  scope: 'global' | 'subnet';
  subnetId: string | null;
  subnetName: string | null;
  enabled: boolean;
}

type SortDir = 'asc' | 'desc';

// ─── API Response Mapping Utilities ──────────────────────────────────────────

function tryParseJson(str: string, fallback: unknown = []) {
  try {
    const parsed = JSON.parse(str);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function secondsToLeaseDisplay(seconds: number): { leaseTime: number; leaseUnit: string } {
  if (seconds >= 86400 && seconds % 86400 === 0) return { leaseTime: seconds / 86400, leaseUnit: 'days' };
  if (seconds >= 3600 && seconds % 3600 === 0) return { leaseTime: seconds / 3600, leaseUnit: 'hours' };
  if (seconds >= 60 && seconds % 60 === 0) return { leaseTime: seconds / 60, leaseUnit: 'minutes' };
  return { leaseTime: seconds, leaseUnit: 'seconds' };
}

function leaseDisplayToSeconds(time: number, unit: string): number {
  switch (unit) {
    case 'days': return time * 86400;
    case 'hours': return time * 3600;
    case 'minutes': return time * 60;
    default: return time;
  }
}

function computePoolSize(poolStart: string, poolEnd: string): number {
  try {
    const start = parseInt(poolStart.split('.').pop() || '0', 10);
    const end = parseInt(poolEnd.split('.').pop() || '0', 10);
    return Math.max(0, end - start + 1);
  } catch {
    return 254;
  }
}

function mapApiSubnet(s: Record<string, unknown>): DhcpSubnet {
  const dnsRaw = (s.dnsServers as string) || '[]';
  const ntpRaw = (s.ntpServers as string) || '[]';
  const dnsServers = tryParseJson(dnsRaw, []);
  const ntpServers = tryParseJson(ntpRaw, []);
  const leaseSec = typeof s.leaseTime === 'number' ? s.leaseTime : 3600;
  const { leaseTime, leaseUnit } = secondsToLeaseDisplay(leaseSec);
  const countData = s._count as Record<string, unknown> | undefined;
  return {
    id: s.id as string,
    name: s.name as string,
    cidr: (s.subnet as string) || '',
    gateway: (s.gateway as string) || '',
    poolStart: s.poolStart as string,
    poolEnd: s.poolEnd as string,
    leaseTime,
    leaseUnit,
    domainName: (s.domainName as string) || '',
    dnsServers: dnsServers as string[],
    ntpServers: ntpServers as string[],
    vlanId: s.vlanId as number | null,
    activeLeases: (countData?.leases as number) || 0,
    totalPool: computePoolSize(s.poolStart as string, s.poolEnd as string),
  };
}

function mapApiReservation(r: Record<string, unknown>): DhcpReservation {
  const subnet = r.dhcpSubnet as Record<string, unknown> | undefined;
  return {
    id: r.id as string,
    macAddress: r.macAddress as string,
    ipAddress: r.ipAddress as string,
    hostname: (r.hostname as string) || '',
    subnetId: r.subnetId as string,
    subnetName: (subnet?.name as string) || '',
    linkedType: (r.linkedType as DhcpReservation['linkedType']) || 'device',
    linkedName: (r.description as string) || '',
    leaseOverride: r.leaseTime ? String(r.leaseTime) + 's' : null,
    description: (r.description as string) || '',
  };
}

function mapApiLease(l: Record<string, unknown>): DhcpLease {
  const subnet = l.subnet as Record<string, unknown> | undefined;
  return {
    id: l.id as string,
    ipAddress: l.ipAddress as string,
    macAddress: l.macAddress as string,
    hostname: (l.hostname as string) || '',
    clientId: (l.clientId as string) || '',
    subnetId: l.subnetId as string,
    subnetName: (subnet?.name as string) || '',
    leaseStart: (l.leaseStart as string) || '',
    leaseExpires: (l.leaseEnd as string) || '',
    state: l.state as DhcpLease['state'],
    lastSeen: (l.lastSeenAt as string) || '',
  };
}

function mapApiOption(o: Record<string, unknown>): DhcpOption {
  const subnet = o.dhcpSubnet as Record<string, unknown> | undefined;
  return {
    id: o.id as string,
    code: o.code as number,
    name: o.name as string,
    value: o.value as string,
    scope: o.subnetId ? 'subnet' : 'global',
    subnetId: (o.subnetId as string) || null,
    subnetName: (subnet?.name as string) || null,
    enabled: o.enabled as boolean,
  };
}

// ─── Utility ─────────────────────────────────────────────────────────────────

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
function getUtilBg(pct: number) {
  if (pct >= 85) return 'bg-red-500';
  if (pct >= 60) return 'bg-amber-500';
  return 'bg-emerald-500';
}
function getLeaseStateBadge(state: DhcpLease['state']) {
  const map = {
    active: { label: 'Active', cls: 'bg-emerald-500/15 text-emerald-700 border-emerald-300' },
    expired: { label: 'Expired', cls: 'bg-amber-500/15 text-amber-700 border-amber-300' },
    released: { label: 'Released', cls: 'bg-gray-500/15 text-gray-600 border-gray-300' },
    declined: { label: 'Declined', cls: 'bg-red-500/15 text-red-700 border-red-300' },
  };
  const s = map[state];
  return <Badge variant="outline" className={s.cls}>{s.label}</Badge>;
}
function getLinkedBadge(type: DhcpReservation['linkedType']) {
  const map = {
    guest: { label: 'Guest', cls: 'bg-teal-500/15 text-teal-700 border-teal-300' },
    room: { label: 'Room', cls: 'bg-violet-500/15 text-violet-700 border-violet-300' },
    device: { label: 'Device', cls: 'bg-amber-500/15 text-amber-700 border-amber-300' },
    staff: { label: 'Staff', cls: 'bg-cyan-500/15 text-cyan-700 border-cyan-300' },
  };
  const s = map[type];
  return <Badge variant="outline" className={s.cls}>{s.label}</Badge>;
}
function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function getCountdown(expiresIso: string) {
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

// ─── Main Component ──────────────────────────────────────────────────────────

// ─── Kea DHCP Server Status ──────────────────────────────────────────────

interface SystemInterface {
  name: string;
  ip: string;
  status: string;
}

interface KeaServerStatus {
  running: boolean;
  processRunning: boolean;
  version: string;
  subnetCount: number;
  leaseCount: number;
  activeLeases: number;
  reservationCount: number;
  currentInterfaces?: string[];
  systemInterfaces?: SystemInterface[];
}

export default function DhcpPage() {
  const { toast } = useToast();
  const { propertyId } = usePropertyId();
  const [activeTab, setActiveTab] = useState<'subnets' | 'reservations' | 'leases' | 'options'>('subnets');

  // ─── Kea Server Status ────────────────────────────────────────────────────
  const [keaStatus, setKeaStatus] = useState<KeaServerStatus>({
    running: false, processRunning: false, version: '',
    subnetCount: 0, leaseCount: 0, activeLeases: 0, reservationCount: 0,
    currentInterfaces: [], systemInterfaces: [],
  });
  const [interfaceDialogOpen, setInterfaceDialogOpen] = useState(false);
  const [selectedInterfaces, setSelectedInterfaces] = useState<string[]>([]);
  const [keaLoading, setKeaLoading] = useState(true);
  const [keaConnected, setKeaConnected] = useState(false);

  // ─── Shared state ──────────────────────────────────────────────────────────
  const [subnets, setSubnets] = useState<DhcpSubnet[]>([]);
  const [reservations, setReservations] = useState<DhcpReservation[]>([]);
  const [leases, setLeases] = useState<DhcpLease[]>([]);
  const [options, setOptions] = useState<DhcpOption[]>([]);

  // ─── Loading states ────────────────────────────────────────────────────────
  const [isLoadingSubnets, setIsLoadingSubnets] = useState(false);
  const [isLoadingReservations, setIsLoadingReservations] = useState(false);
  const [isLoadingLeases, setIsLoadingLeases] = useState(false);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);

  // ─── Lease refresh ─────────────────────────────────────────────────────────
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const [refreshKey, setRefreshKey] = useState(0);

  // ─── Kea Service Fetch ─────────────────────────────────────────────────────

  const fetchKeaStatus = useCallback(async () => {
    setKeaLoading(true);
    try {
      const response = await fetch('/api/kea/status');
      const result = await response.json();
      if (result.success) {
        setKeaStatus(result.data);
        setKeaConnected(result.data.running);
        setSelectedInterfaces(result.data.currentInterfaces || []);
      } else {
        setKeaConnected(false);
      }
    } catch {
      setKeaConnected(false);
    } finally {
      setKeaLoading(false);
    }
  }, []);

  const handleKeaServiceAction = useCallback(async (action: 'start' | 'stop' | 'restart') => {
    try {
      const response = await fetch(`/api/kea/service/${action}`, { method: 'POST' });
      const result = await response.json();
      if (result.success) {
        toast({ title: 'Success', description: result.message });
        // Immediately sync the running state from response
        if (result.status === 'running') {
          setKeaConnected(true);
          setKeaStatus(prev => prev ? { ...prev, running: true } : prev);
        } else if (result.status === 'stopped') {
          setKeaConnected(false);
          setKeaStatus(prev => prev ? { ...prev, running: false } : prev);
        }
        // Full refresh after a short delay to get full data (subnets, leases, etc.)
        setTimeout(fetchKeaStatus, 3000);
      } else {
        toast({ title: 'Error', description: result.message || `Failed to ${action} Kea`, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Could not reach Kea service', variant: 'destructive' });
    }
  }, [fetchKeaStatus, toast]);

  // ─── Fetch functions (try Kea first, fall back to DB API) ──────────────────

  const fetchSubnets = useCallback(async () => {
    setIsLoadingSubnets(true);
    try {
      // Try Kea service first
      if (keaConnected) {
        const response = await fetch('/api/kea/subnets');
        const result = await response.json();
        if (result.success && Array.isArray(result.data)) {
          const keaSubnets: DhcpSubnet[] = result.data.map((s: any) => {
            const leaseSec = s.leaseTime || 3600;
            const { leaseTime, leaseUnit } = secondsToLeaseDisplay(leaseSec);
            return {
              id: s.id,
              name: s.name,
              cidr: s.cidr,
              gateway: s.gateway,
              poolStart: s.poolStart,
              poolEnd: s.poolEnd,
              leaseTime,
              leaseUnit,
              domainName: '',
              dnsServers: s.dnsServers || [],
              ntpServers: [],
              vlanId: s.vlanId,
              activeLeases: s.activeLeases || 0,
              totalPool: s.totalPool || 0,
            };
          });
          setSubnets(keaSubnets);
          setIsLoadingSubnets(false);
          return;
        }
      }
      // Fallback to DB API
      const response = await fetch('/api/wifi/dhcp/subnets');
      const result = await response.json();
      if (result.success && Array.isArray(result.data)) {
        setSubnets(result.data.map((s: Record<string, unknown>) => mapApiSubnet(s)));
      }
    } catch (error) {
      console.error('Error fetching subnets:', error);
    } finally {
      setIsLoadingSubnets(false);
    }
  }, [keaConnected]);

  const fetchReservations = useCallback(async () => {
    setIsLoadingReservations(true);
    try {
      // Try Kea service first
      if (keaConnected) {
        const response = await fetch('/api/kea/reservations');
        const result = await response.json();
        if (result.success && Array.isArray(result.data)) {
          const keaReservations: DhcpReservation[] = result.data.map((r: any) => ({
            id: r.id,
            macAddress: r.macAddress,
            ipAddress: r.ipAddress,
            hostname: r.hostname || '',
            subnetId: r.subnetId,
            subnetName: r.subnetName || '',
            linkedType: 'device' as const,
            linkedName: '',
            leaseOverride: null,
            description: '',
          }));
          setReservations(keaReservations);
          setIsLoadingReservations(false);
          return;
        }
      }
      // Fallback to DB API
      const response = await fetch('/api/wifi/dhcp/reservations');
      const result = await response.json();
      if (result.success && Array.isArray(result.data)) {
        setReservations(result.data.map((r: Record<string, unknown>) => mapApiReservation(r)));
      }
    } catch (error) {
      console.error('Error fetching reservations:', error);
    } finally {
      setIsLoadingReservations(false);
    }
  }, [keaConnected]);

  const fetchLeases = useCallback(async () => {
    setIsLoadingLeases(true);
    try {
      // Try Kea service first
      if (keaConnected) {
        const response = await fetch('/api/kea/leases');
        const result = await response.json();
        if (result.success && Array.isArray(result.data)) {
          const keaLeases: DhcpLease[] = result.data.map((l: any) => ({
            id: l.id || l.ipAddress,
            ipAddress: l.ipAddress,
            macAddress: l.macAddress,
            hostname: l.hostname || '',
            clientId: l.clientId || '',
            subnetId: l.subnetId,
            subnetName: l.subnetName || '',
            leaseStart: l.leaseStart || '',
            leaseExpires: l.leaseExpires || '',
            state: l.state || 'active',
            lastSeen: l.lastSeen || '',
          }));
          setLeases(keaLeases);
          setLastRefresh(Date.now());
          setRefreshKey(k => k + 1);
          setIsLoadingLeases(false);
          return;
        }
      }
      // Fallback to DB API
      const params = new URLSearchParams();
      if (leaseSubnetFilterRef.current && leaseSubnetFilterRef.current !== 'all') {
        params.set('subnetId', leaseSubnetFilterRef.current);
      }
      const response = await fetch(`/api/wifi/dhcp/leases?${params.toString()}`);
      const result = await response.json();
      if (result.success && Array.isArray(result.data)) {
        setLeases(result.data.map((l: Record<string, unknown>) => mapApiLease(l)));
      }
      setLastRefresh(Date.now());
      setRefreshKey(k => k + 1);
    } catch (error) {
      console.error('Error fetching leases:', error);
    } finally {
      setIsLoadingLeases(false);
    }
  }, [keaConnected]);

  const fetchOptions = useCallback(async () => {
    setIsLoadingOptions(true);
    try {
      // Options only from DB API (Kea doesn't have separate option management)
      const response = await fetch('/api/wifi/dhcp/options');
      const result = await response.json();
      if (result.success && Array.isArray(result.data)) {
        setOptions(result.data.map((o: Record<string, unknown>) => mapApiOption(o)));
      }
    } catch (error) {
      console.error('Error fetching options:', error);
    } finally {
      setIsLoadingOptions(false);
    }
  }, []);

  // ─── Ref for lease subnet filter (needed inside fetchLeases callback) ──────
  const leaseSubnetFilterRef = useRef('all');

  // ─── Initial data fetch ────────────────────────────────────────────────────
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    fetchKeaStatus();
    fetchSubnets();
    fetchReservations();
    fetchLeases();
    fetchOptions();
    return () => { mountedRef.current = false; };
  }, [fetchKeaStatus, fetchSubnets, fetchReservations, fetchLeases, fetchOptions]);

  // ─── Refresh data when Kea connection changes ─────────────────────────────
  useEffect(() => {
    if (keaConnected) {
      fetchSubnets();
      fetchReservations();
      fetchLeases();
    }
  }, [keaConnected, fetchSubnets, fetchReservations, fetchLeases]);

  // ─── Kea status auto-refresh ─────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(fetchKeaStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchKeaStatus]);

  // ─── Lease auto-refresh ────────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== 'leases') return;
    const interval = setInterval(() => {
      fetchLeases();
    }, 10000);
    return () => clearInterval(interval);
  }, [activeTab, fetchLeases]);

  // ─── Tab 1: Subnets ────────────────────────────────────────────────────────
  const [subnetDialogOpen, setSubnetDialogOpen] = useState(false);
  const [editingSubnet, setEditingSubnet] = useState<DhcpSubnet | null>(null);
  const [deleteSubnetOpen, setDeleteSubnetOpen] = useState(false);
  const [subnetForm, setSubnetForm] = useState({
    name: '', cidr: '', gateway: '', poolStart: '', poolEnd: '',
    leaseTime: 4, leaseUnit: 'hours', domainName: '', dnsServers: '',
    ntpServers: '', vlanId: '',
  });

  const openAddSubnet = () => {
    setEditingSubnet(null);
    setSubnetForm({ name: '', cidr: '', gateway: '', poolStart: '', poolEnd: '', leaseTime: 4, leaseUnit: 'hours', domainName: '', dnsServers: '', ntpServers: '', vlanId: '' });
    setSubnetDialogOpen(true);
  };
  const openEditSubnet = (s: DhcpSubnet) => {
    setEditingSubnet(s);
    setSubnetForm({
      name: s.name, cidr: s.cidr, gateway: s.gateway, poolStart: s.poolStart, poolEnd: s.poolEnd,
      leaseTime: s.leaseTime, leaseUnit: s.leaseUnit, domainName: s.domainName,
      dnsServers: s.dnsServers.join(', '), ntpServers: s.ntpServers.join(', '),
      vlanId: s.vlanId?.toString() ?? '',
    });
    setSubnetDialogOpen(true);
  };
  const saveSubnet = async () => {
    if (!subnetForm.name || !subnetForm.cidr || !subnetForm.gateway) {
      toast({ title: 'Validation Error', description: 'Name, CIDR, and Gateway are required.', variant: 'destructive' });
      return;
    }
    const dns = subnetForm.dnsServers.split(',').map(s => s.trim()).filter(Boolean);
    const ntp = subnetForm.ntpServers.split(',').map(s => s.trim()).filter(Boolean);
    const leaseSeconds = leaseDisplayToSeconds(subnetForm.leaseTime, subnetForm.leaseUnit);

    try {
      if (keaConnected) {
        // Use Kea DHCP API for real server configuration
        const keaBody: Record<string, any> = {
          name: subnetForm.name,
          cidr: subnetForm.cidr,
          subnet: subnetForm.cidr,
          gateway: subnetForm.gateway,
          poolStart: subnetForm.poolStart,
          poolEnd: subnetForm.poolEnd,
          leaseTime: leaseSeconds,
          dnsServers: dns.length > 0 ? dns : ['8.8.8.8', '8.8.4.4'],
        };

        if (editingSubnet) {
          keaBody.id = editingSubnet.id;
          const response = await fetch(`/api/kea/subnets/${editingSubnet.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(keaBody),
          });
          const result = await response.json();
          if (result.success) {
            toast({ title: 'Success', description: 'Subnet updated in Kea DHCP4 server.' });
          } else {
            toast({ title: 'Error', description: result.error || 'Failed to update subnet in Kea.', variant: 'destructive' });
          }
        } else {
          const response = await fetch('/api/kea/subnets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(keaBody),
          });
          const result = await response.json();
          if (result.success) {
            toast({ title: 'Success', description: 'Subnet added to Kea DHCP4 server.' });
          } else {
            toast({ title: 'Error', description: result.error || 'Failed to add subnet to Kea.', variant: 'destructive' });
          }
        }
      } else {
        // Fallback to DB API
        const body = {
          propertyId,
          name: subnetForm.name,
          subnet: subnetForm.cidr,
          gateway: subnetForm.gateway,
          poolStart: subnetForm.poolStart,
          poolEnd: subnetForm.poolEnd,
          leaseTime: leaseSeconds,
          domainName: subnetForm.domainName,
          dnsServers: JSON.stringify(dns),
          ntpServers: JSON.stringify(ntp),
          vlanId: subnetForm.vlanId ? parseInt(subnetForm.vlanId) : null,
        };

        if (editingSubnet) {
          const response = await fetch(`/api/wifi/dhcp/subnets/${editingSubnet.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          const result = await response.json();
          if (result.success) {
            toast({ title: 'Success', description: 'Subnet updated successfully.' });
          } else {
            toast({ title: 'Error', description: result.error?.message || 'Failed to update subnet.', variant: 'destructive' });
          }
        } else {
          const response = await fetch('/api/wifi/dhcp/subnets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          const result = await response.json();
          if (result.success) {
            toast({ title: 'Success', description: 'Subnet created successfully.' });
          } else {
            toast({ title: 'Error', description: result.error?.message || 'Failed to create subnet.', variant: 'destructive' });
          }
        }
      }
      setSubnetDialogOpen(false);
      fetchSubnets();
    } catch (error) {
      console.error('Error saving subnet:', error);
      toast({ title: 'Error', description: 'Network error. Please try again.', variant: 'destructive' });
    }
  };
  const deleteSubnet = async (id: string) => {
    try {
      if (keaConnected) {
        const response = await fetch(`/api/kea/subnets/${id}`, { method: 'DELETE' });
        const result = await response.json();
        if (result.success) {
          toast({ title: 'Success', description: 'Subnet removed from Kea DHCP4 server.' });
        } else {
          toast({ title: 'Error', description: result.error || 'Failed to delete subnet from Kea.', variant: 'destructive' });
        }
      } else {
        const response = await fetch(`/api/wifi/dhcp/subnets/${id}`, { method: 'DELETE' });
        const result = await response.json();
        if (result.success) {
          toast({ title: 'Success', description: 'Subnet deleted.' });
        } else {
          toast({ title: 'Error', description: result.error?.message || 'Failed to delete subnet.', variant: 'destructive' });
        }
      }
      setDeleteSubnetOpen(false);
      fetchSubnets();
      fetchKeaStatus();
    } catch (error) {
      console.error('Error deleting subnet:', error);
      toast({ title: 'Error', description: 'Network error. Please try again.', variant: 'destructive' });
    }
  };
  const applyTemplate = (template: 'guest' | 'staff' | 'iot' | 'mgmt') => {
    const templates: Record<string, Partial<typeof subnetForm>> = {
      guest: { name: 'Guest WiFi', cidr: '192.168.1.0/24', gateway: '192.168.1.1', poolStart: '192.168.1.100', poolEnd: '192.168.1.254', leaseTime: 4, leaseUnit: 'hours', domainName: 'guest.staysuite.local', dnsServers: '8.8.8.8, 8.8.4.4', vlanId: '10' },
      staff: { name: 'Staff', cidr: '192.168.2.0/24', gateway: '192.168.2.1', poolStart: '192.168.2.50', poolEnd: '192.168.2.200', leaseTime: 12, leaseUnit: 'hours', domainName: 'staff.staysuite.local', dnsServers: '192.168.100.2, 8.8.8.8', vlanId: '20' },
      iot: { name: 'IoT', cidr: '192.168.10.0/24', gateway: '192.168.10.1', poolStart: '192.168.10.100', poolEnd: '192.168.10.254', leaseTime: 7, leaseUnit: 'days', domainName: 'iot.staysuite.local', dnsServers: '192.168.100.2', vlanId: '30' },
      mgmt: { name: 'Management', cidr: '192.168.100.0/24', gateway: '192.168.100.1', poolStart: '192.168.100.10', poolEnd: '192.168.100.50', leaseTime: 1, leaseUnit: 'days', domainName: 'mgmt.staysuite.local', dnsServers: '192.168.100.2, 8.8.8.8', vlanId: '99' },
    };
    const t = templates[template];
    setSubnetForm(prev => ({ ...prev, ...t }));
    setEditingSubnet(null);
    setSubnetDialogOpen(true);
  };

  // ─── Tab 2: Reservations ───────────────────────────────────────────────────
  const [resSearch, setResSearch] = useState('');
  const [resDialogOpen, setResDialogOpen] = useState(false);
  const [editingRes, setEditingRes] = useState<DhcpReservation | null>(null);
  const [deleteResOpen, setDeleteResOpen] = useState(false);
  const [selectedRes, setSelectedRes] = useState<Set<string>>(new Set());
  const [resForm, setResForm] = useState({
    macAddress: '', ipAddress: '', hostname: '', subnetId: '',
    linkedType: 'device' as DhcpReservation['linkedType'], linkedName: '',
    leaseOverride: '', description: '',
  });

  const filteredReservations = reservations.filter(r => {
    if (!resSearch) return true;
    const q = resSearch.toLowerCase();
    return r.macAddress.toLowerCase().includes(q) || r.ipAddress.toLowerCase().includes(q) || r.hostname.toLowerCase().includes(q);
  });

  const openAddRes = () => {
    setEditingRes(null);
    setResForm({ macAddress: '', ipAddress: '', hostname: '', subnetId: subnets[0]?.id ?? '', linkedType: 'device', linkedName: '', leaseOverride: '', description: '' });
    setResDialogOpen(true);
  };
  const openEditRes = (r: DhcpReservation) => {
    setEditingRes(r);
    setResForm({ macAddress: r.macAddress, ipAddress: r.ipAddress, hostname: r.hostname, subnetId: r.subnetId, linkedType: r.linkedType, linkedName: r.linkedName, leaseOverride: r.leaseOverride ?? '', description: r.description });
    setResDialogOpen(true);
  };
  const saveRes = async () => {
    if (!resForm.macAddress || !resForm.ipAddress || !validateMac(resForm.macAddress)) {
      toast({ title: 'Validation Error', description: 'Valid MAC (XX:XX:XX:XX:XX:XX) and IP are required.', variant: 'destructive' });
      return;
    }

    try {
      if (keaConnected) {
        // Use Kea DHCP API for real reservation management
        const keaBody = {
          subnetId: resForm.subnetId,
          macAddress: resForm.macAddress,
          ipAddress: resForm.ipAddress,
          hostname: resForm.hostname || undefined,
        };

        if (editingRes) {
          // Kea doesn't have a native reservation update, so delete + re-add
          // First delete the old one
          if (editingRes.subnetId && editingRes.macAddress) {
            await fetch(`/api/kea/reservations/${editingRes.subnetId}/${editingRes.macAddress.replace(/:/g, '-')}`, {
              method: 'DELETE',
            });
          }
          // Then add the new one
          const response = await fetch('/api/kea/reservations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(keaBody),
          });
          const result = await response.json();
          if (result.success) {
            toast({ title: 'Success', description: 'Reservation updated in Kea DHCP4 server.' });
          } else {
            toast({ title: 'Error', description: result.error || 'Failed to update reservation in Kea.', variant: 'destructive' });
          }
        } else {
          const response = await fetch('/api/kea/reservations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(keaBody),
          });
          const result = await response.json();
          if (result.success) {
            toast({ title: 'Success', description: 'Reservation added to Kea DHCP4 server.' });
          } else {
            toast({ title: 'Error', description: result.error || 'Failed to add reservation to Kea.', variant: 'destructive' });
          }
        }
      } else {
        // Fallback to DB API
        const body = {
          propertyId,
          subnetId: resForm.subnetId,
          macAddress: resForm.macAddress,
          ipAddress: resForm.ipAddress,
          hostname: resForm.hostname,
          linkedType: resForm.linkedType,
          description: resForm.description,
        };

        if (editingRes) {
          const response = await fetch(`/api/wifi/dhcp/reservations/${editingRes.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          const result = await response.json();
          if (result.success) {
            toast({ title: 'Success', description: 'Reservation updated.' });
          } else {
            toast({ title: 'Error', description: result.error?.message || 'Failed to update reservation.', variant: 'destructive' });
          }
        } else {
          const response = await fetch('/api/wifi/dhcp/reservations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          const result = await response.json();
          if (result.success) {
            toast({ title: 'Success', description: 'Reservation created.' });
          } else {
            toast({ title: 'Error', description: result.error?.message || 'Failed to create reservation.', variant: 'destructive' });
          }
        }
      }
      setResDialogOpen(false);
      fetchReservations();
    } catch (error) {
      console.error('Error saving reservation:', error);
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
      if (keaConnected) {
        // Delete from Kea DHCP server
        const selectedResList = reservations.filter(r => selectedRes.has(r.id));
        await Promise.all(
          selectedResList.map(r =>
            fetch(`/api/kea/reservations/${r.subnetId}/${r.macAddress.replace(/:/g, '-')}`, { method: 'DELETE' })
          )
        );
        toast({ title: 'Success', description: `${selectedRes.size} reservation(s) removed from Kea DHCP4.` });
      } else {
        await Promise.all(
          Array.from(selectedRes).map(id =>
            fetch(`/api/wifi/dhcp/reservations/${id}`, { method: 'DELETE' })
          )
        );
        toast({ title: 'Success', description: `${selectedRes.size} reservation(s) deleted.` });
      }
      setSelectedRes(new Set());
      fetchReservations();
    } catch (error) {
      console.error('Error bulk deleting reservations:', error);
      toast({ title: 'Error', description: 'Network error. Please try again.', variant: 'destructive' });
    }
  };
  const deleteSingleRes = async (id: string) => {
    try {
      if (keaConnected && editingRes) {
        const macForUrl = editingRes.macAddress.replace(/:/g, '-');
        const response = await fetch(`/api/kea/reservations/${editingRes.subnetId}/${macForUrl}`, { method: 'DELETE' });
        const result = await response.json();
        if (result.success) {
          toast({ title: 'Success', description: 'Reservation removed from Kea DHCP4 server.' });
        } else {
          toast({ title: 'Error', description: result.error || 'Failed to delete reservation from Kea.', variant: 'destructive' });
        }
      } else {
        const response = await fetch(`/api/wifi/dhcp/reservations/${id}`, { method: 'DELETE' });
        const result = await response.json();
        if (result.success) {
          toast({ title: 'Success', description: 'Reservation deleted.' });
        } else {
          toast({ title: 'Error', description: result.error?.message || 'Failed to delete reservation.', variant: 'destructive' });
        }
      }
      setDeleteResOpen(false);
      fetchReservations();
    } catch (error) {
      console.error('Error deleting reservation:', error);
      toast({ title: 'Error', description: 'Network error. Please try again.', variant: 'destructive' });
    }
  };
  const autoAssignRooms = async () => {
    const rooms = ['Room 201 Smart Lock', 'Room 202 Smart Lock', 'Room 203 TV', 'Room 204 Thermostat'];
    const iotSubnet = subnets.find(s => s.name.toLowerCase().includes('iot'));
    const subnetId = iotSubnet?.id || subnets[0]?.id;
    if (!subnetId) {
      toast({ title: 'Error', description: 'No subnet available. Please create a subnet first.', variant: 'destructive' });
      return;
    }

    try {
      const results = await Promise.allSettled(
        rooms.map((name, i) => {
          const body = {
            propertyId,
            subnetId,
            macAddress: `DD:EE:FF:${(30 + i).toString(16).toUpperCase()}:00:0${i + 1}`,
            ipAddress: `192.168.10.${110 + i}`,
            hostname: name.toLowerCase().replace(/\s/g, '-'),
            linkedType: 'room',
            description: `Auto-assigned to ${name}`,
          };
          return fetch('/api/wifi/dhcp/reservations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
        })
      );
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      toast({ title: 'Success', description: `${successCount}/${rooms.length} rooms auto-assigned reservations.` });
      fetchReservations();
    } catch (error) {
      console.error('Error auto-assigning rooms:', error);
      toast({ title: 'Error', description: 'Network error during auto-assignment.', variant: 'destructive' });
    }
  };

  // ─── Tab 3: Leases ─────────────────────────────────────────────────────────
  const [leaseFilter, setLeaseFilter] = useState<string>('all');
  const [leaseSubnetFilter, setLeaseSubnetFilter] = useState<string>('all');
  const [leaseSortCol, setLeaseSortCol] = useState<string>('ipAddress');
  const [leaseSortDir, setLeaseSortDir] = useState<SortDir>('asc');
  const [selectedLeases, setSelectedLeases] = useState<Set<string>>(new Set());

  // Sync subnet filter to ref for the fetch callback
  useEffect(() => {
    leaseSubnetFilterRef.current = leaseSubnetFilter;
  }, [leaseSubnetFilter]);

  const filteredLeases = leases.filter(l => {
    if (leaseFilter !== 'all' && l.state !== leaseFilter) return false;
    if (leaseSubnetFilter !== 'all' && l.subnetId !== leaseSubnetFilter) return false;
    return true;
  }).sort((a, b) => {
    let cmp = 0;
    const aVal: any = a[leaseSortCol as keyof DhcpLease];
    const bVal: any = b[leaseSortCol as keyof DhcpLease];
    if (typeof aVal === 'string' && typeof bVal === 'string') cmp = aVal.localeCompare(bVal);
    else cmp = (aVal ?? '') > (bVal ?? '') ? 1 : -1;
    return leaseSortDir === 'asc' ? cmp : -cmp;
  });

  const toggleLeaseSort = (col: string) => {
    if (leaseSortCol === col) setLeaseSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setLeaseSortCol(col); setLeaseSortDir('asc'); }
  };
  const expireSelected = async () => {
    try {
      const ids = Array.from(selectedLeases).join(',');
      const response = await fetch(`/api/wifi/dhcp/leases?ids=${encodeURIComponent(ids)}`, { method: 'DELETE' });
      const result = await response.json();
      if (result.success) {
        toast({ title: 'Success', description: `${selectedLeases.size} lease(s) expired.` });
      } else {
        toast({ title: 'Error', description: result.error?.message || 'Failed to expire leases.', variant: 'destructive' });
      }
      setSelectedLeases(new Set());
      fetchLeases();
    } catch (error) {
      console.error('Error expiring leases:', error);
      toast({ title: 'Error', description: 'Network error. Please try again.', variant: 'destructive' });
    }
  };
  const activeLeaseCount = leases.filter(l => l.state === 'active').length;
  const expiredLeaseCount = leases.filter(l => l.state === 'expired').length;

  // ─── Tab 4: Options ────────────────────────────────────────────────────────
  const [optDialogOpen, setOptDialogOpen] = useState(false);
  const [optForm, setOptForm] = useState({ code: '', name: '', value: '', scope: 'global' as 'global' | 'subnet', subnetId: '' });

  const toggleOptEnabled = async (id: string) => {
    const opt = options.find(o => o.id === id);
    if (!opt) return;
    try {
      const response = await fetch(`/api/wifi/dhcp/options/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !opt.enabled }),
      });
      const result = await response.json();
      if (result.success) {
        setOptions(prev => prev.map(o => o.id === id ? { ...o, enabled: !o.enabled } : o));
      } else {
        toast({ title: 'Error', description: result.error?.message || 'Failed to toggle option.', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error toggling option:', error);
      toast({ title: 'Error', description: 'Network error. Please try again.', variant: 'destructive' });
    }
  };
  const addOption = async () => {
    if (!optForm.code || !optForm.name || !optForm.value) {
      toast({ title: 'Validation Error', description: 'Code, name, and value are required.', variant: 'destructive' });
      return;
    }
    const body = {
      propertyId,
      code: parseInt(optForm.code),
      name: optForm.name,
      value: optForm.value,
      subnetId: optForm.scope === 'subnet' ? optForm.subnetId : null,
    };

    try {
      const response = await fetch('/api/wifi/dhcp/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (result.success) {
        toast({ title: 'Success', description: 'DHCP option added.' });
        setOptDialogOpen(false);
        fetchOptions();
      } else {
        toast({ title: 'Error', description: result.error?.message || 'Failed to add option.', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error adding option:', error);
      toast({ title: 'Error', description: 'Network error. Please try again.', variant: 'destructive' });
    }
  };
  const deleteOption = async (id: string) => {
    try {
      const response = await fetch(`/api/wifi/dhcp/options/${id}`, { method: 'DELETE' });
      const result = await response.json();
      if (result.success) {
        toast({ title: 'Success', description: 'Option deleted.' });
        fetchOptions();
      } else {
        toast({ title: 'Error', description: result.error?.message || 'Failed to delete option.', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error deleting option:', error);
      toast({ title: 'Error', description: 'Network error. Please try again.', variant: 'destructive' });
    }
  };

  // ─── Loading Skeletons ─────────────────────────────────────────────────────

  const renderSubnetsLoading = () => (
    <div className="space-y-6">
      <div className="flex justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-36" />
        </div>
        <Skeleton className="h-9 w-24" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {[1, 2, 3, 4].map(i => (
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
                <div className="flex gap-1">
                  <Skeleton className="h-8 w-8" />
                  <Skeleton className="h-8 w-8" />
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

  const renderReservationsLoading = () => (
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

  const renderLeasesLoading = () => (
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
      <Card><CardContent className="p-4"><Skeleton className="h-4 w-full" /></CardContent></Card>
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

  const renderOptionsLoading = () => (
    <div className="space-y-6">
      <div className="flex justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-36" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
      <Card>
        <CardHeader className="pb-3"><Skeleton className="h-6 w-40" /></CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </CardContent>
      </Card>
    </div>
  );

  // ─── Render helpers ────────────────────────────────────────────────────────

  const renderSubnetsTab = () => (
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
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => { applyTemplate('guest'); }}>
            <Zap className="h-3.5 w-3.5 mr-1.5" />Guest /24
          </Button>
          <Button variant="outline" size="sm" onClick={() => { applyTemplate('staff'); }}>
            <Users className="h-3.5 w-3.5 mr-1.5" />Staff /24
          </Button>
          <Button variant="outline" size="sm" onClick={() => { applyTemplate('iot'); }}>
            <Cpu className="h-3.5 w-3.5 mr-1.5" />IoT /24
          </Button>
          <Button variant="outline" size="sm" onClick={() => { applyTemplate('mgmt'); }}>
            <Shield className="h-3.5 w-3.5 mr-1.5" />Mgmt /24
          </Button>
          <Button onClick={openAddSubnet}>
            <Plus className="h-4 w-4 mr-2" />Add Subnet
          </Button>
        </div>
      </div>

      {/* Subnet cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {subnets.map((s) => {
          const pct = s.totalPool > 0 ? Math.round((s.activeLeases / s.totalPool) * 100) : 0;
          return (
            <Card key={s.id} className={cn('relative overflow-hidden border-l-4', getUtilBorder(pct))}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={cn('p-2 rounded-lg bg-gradient-to-br', getUtilColor(pct))}>
                      <Server className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-base">{s.name}</h3>
                      <p className="font-mono text-sm text-muted-foreground">{s.cidr}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditSubnet(s)}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700" onClick={() => { setEditingSubnet(s); setDeleteSubnetOpen(true); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                  <div>
                    <span className="text-muted-foreground">Gateway</span>
                    <p className="font-mono font-medium">{s.gateway}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Pool Range</span>
                    <p className="font-mono font-medium">{s.poolStart} → {s.poolEnd}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Lease Time</span>
                    <p className="font-medium">{s.leaseTime} {s.leaseUnit}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">VLAN</span>
                    <p className="font-medium">{s.vlanId ? <Badge variant="outline">{s.vlanId}</Badge> : '—'}</p>
                  </div>
                </div>

                {s.domainName && (
                  <div className="text-sm mb-2">
                    <span className="text-muted-foreground">Domain: </span>
                    <span className="font-mono">{s.domainName}</span>
                  </div>
                )}

                {s.dnsServers.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {s.dnsServers.map((dns) => (
                      <Badge key={dns} variant="secondary" className="font-mono text-xs">{dns}</Badge>
                    ))}
                  </div>
                )}

                <Separator className="my-3" />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Active Leases</span>
                    <span className={cn('text-sm font-bold', getUtilText(pct))}>{s.activeLeases}/{s.totalPool}</span>
                  </div>
                  <span className={cn('text-sm font-bold', getUtilText(pct))}>{pct}%</span>
                </div>
                <div className="mt-1.5 h-2 bg-muted rounded-full overflow-hidden">
                  <div className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-500', getUtilColor(pct))} style={{ width: `${pct}%` }} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Add/Edit Subnet Dialog */}
      <Dialog open={subnetDialogOpen} onOpenChange={setSubnetDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSubnet ? 'Edit Subnet' : 'Add Subnet'}</DialogTitle>
            <DialogDescription>{editingSubnet ? 'Modify the DHCP subnet configuration.' : 'Create a new DHCP subnet.'}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Subnet Name *</Label>
              <Input value={subnetForm.name} onChange={e => setSubnetForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Guest WiFi" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Subnet (CIDR) *</Label>
                <Input value={subnetForm.cidr} onChange={e => setSubnetForm(p => ({ ...p, cidr: e.target.value }))} placeholder="192.168.1.0/24" className="font-mono" />
              </div>
              <div className="space-y-2">
                <Label>Gateway *</Label>
                <Input value={subnetForm.gateway} onChange={e => setSubnetForm(p => ({ ...p, gateway: e.target.value }))} placeholder="192.168.1.1" className="font-mono" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Pool Start</Label>
                <Input value={subnetForm.poolStart} onChange={e => setSubnetForm(p => ({ ...p, poolStart: e.target.value }))} placeholder="192.168.1.100" className="font-mono" />
              </div>
              <div className="space-y-2">
                <Label>Pool End</Label>
                <Input value={subnetForm.poolEnd} onChange={e => setSubnetForm(p => ({ ...p, poolEnd: e.target.value }))} placeholder="192.168.1.254" className="font-mono" />
              </div>
            </div>
            <div className="space-y-3">
              <Label>Lease Time</Label>
              <div className="flex items-center gap-4">
                <Slider
                  value={[subnetForm.leaseTime]}
                  onValueChange={([v]) => setSubnetForm(p => ({ ...p, leaseTime: v }))}
                  min={5} max={10080} step={5}
                  className="flex-1"
                />
                <Select value={subnetForm.leaseUnit} onValueChange={v => setSubnetForm(p => ({ ...p, leaseUnit: v }))}>
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minutes">Minutes</SelectItem>
                    <SelectItem value="hours">Hours</SelectItem>
                    <SelectItem value="days">Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">{subnetForm.leaseTime} {subnetForm.leaseUnit}</p>
            </div>
            <div className="space-y-2">
              <Label>Domain Name</Label>
              <Input value={subnetForm.domainName} onChange={e => setSubnetForm(p => ({ ...p, domainName: e.target.value }))} placeholder="guest.staysuite.local" className="font-mono" />
            </div>
            <div className="space-y-2">
              <Label>DNS Servers</Label>
              <Input value={subnetForm.dnsServers} onChange={e => setSubnetForm(p => ({ ...p, dnsServers: e.target.value }))} placeholder="8.8.8.8, 8.8.4.4" className="font-mono" />
              <p className="text-xs text-muted-foreground">Comma-separated</p>
            </div>
            <div className="space-y-2">
              <Label>NTP Servers</Label>
              <Input value={subnetForm.ntpServers} onChange={e => setSubnetForm(p => ({ ...p, ntpServers: e.target.value }))} placeholder="time.google.com" className="font-mono" />
            </div>
            <div className="space-y-2">
              <Label>VLAN ID</Label>
              <Input type="number" value={subnetForm.vlanId} onChange={e => setSubnetForm(p => ({ ...p, vlanId: e.target.value }))} placeholder="e.g. 10" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubnetDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveSubnet}>{editingSubnet ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Subnet Dialog */}
      <Dialog open={deleteSubnetOpen} onOpenChange={setDeleteSubnetOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Subnet</DialogTitle>
            <DialogDescription>Are you sure you want to delete &quot;{editingSubnet?.name}&quot;? Active leases will be released.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteSubnetOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => editingSubnet && deleteSubnet(editingSubnet.id)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  const renderReservationsTab = () => (
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
          <Button variant="outline" size="sm" onClick={autoAssignRooms}>
            <Zap className="h-3.5 w-3.5 mr-1.5" />Auto-assign to Rooms
          </Button>
          <Button variant="outline" size="sm">
            <Upload className="h-3.5 w-3.5 mr-1.5" />Import CSV
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-3.5 w-3.5 mr-1.5" />Export CSV
          </Button>
          {selectedRes.size > 0 && (
            <Button variant="destructive" size="sm" onClick={bulkDeleteRes}>
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />Delete ({selectedRes.size})
            </Button>
          )}
          <Button onClick={openAddRes}>
            <Plus className="h-4 w-4 mr-2" />Add Reservation
          </Button>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by MAC, IP, or hostname..."
              value={resSearch}
              onChange={e => setResSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="max-h-[520px] overflow-y-auto">
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
                  <TableHead>Type</TableHead>
                  <TableHead>Linked To</TableHead>
                  <TableHead>Lease Override</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReservations.map((r) => (
                  <TableRow key={r.id} className={cn(selectedRes.has(r.id) && 'bg-teal-50/50 dark:bg-teal-950/20')}>
                    <TableCell>
                      <Checkbox checked={selectedRes.has(r.id)} onCheckedChange={() => toggleResSelect(r.id)} />
                    </TableCell>
                    <TableCell><span className="font-mono text-sm">{r.macAddress}</span></TableCell>
                    <TableCell><span className="font-mono text-sm font-medium">{r.ipAddress}</span></TableCell>
                    <TableCell className="text-sm">{r.hostname}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{r.subnetName}</Badge>
                    </TableCell>
                    <TableCell>{getLinkedBadge(r.linkedType)}</TableCell>
                    <TableCell className="text-sm max-w-[150px] truncate">{r.linkedName}</TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">{r.leaseOverride ?? '—'}</span>
                    </TableCell>
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
                {filteredReservations.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      No reservations found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Reservation Dialog */}
      <Dialog open={resDialogOpen} onOpenChange={setResDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRes ? 'Edit Reservation' : 'Add Reservation'}</DialogTitle>
            <DialogDescription>{editingRes ? 'Modify the static DHCP reservation.' : 'Create a new static DHCP reservation.'}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
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
                <p className="text-xs text-red-500">Invalid MAC format. Use XX:XX:XX:XX:XX:XX</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>IP Address *</Label>
                <Input value={resForm.ipAddress} onChange={e => setResForm(p => ({ ...p, ipAddress: e.target.value }))} placeholder="192.168.1.200" className="font-mono" />
              </div>
              <div className="space-y-2">
                <Label>Hostname</Label>
                <Input value={resForm.hostname} onChange={e => setResForm(p => ({ ...p, hostname: e.target.value }))} placeholder="my-device" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Subnet</Label>
              <Select value={resForm.subnetId} onValueChange={v => setResForm(p => ({ ...p, subnetId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select subnet" /></SelectTrigger>
                <SelectContent>
                  {subnets.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.cidr})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Linked Type</Label>
                <Select value={resForm.linkedType} onValueChange={v => setResForm(p => ({ ...p, linkedType: v as DhcpReservation['linkedType'] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="guest">Guest</SelectItem>
                    <SelectItem value="room">Room</SelectItem>
                    <SelectItem value="device">Device</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Linked Name</Label>
                <Input value={resForm.linkedName} onChange={e => setResForm(p => ({ ...p, linkedName: e.target.value }))} placeholder="e.g. Room 101" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Lease Override</Label>
                <Input value={resForm.leaseOverride} onChange={e => setResForm(p => ({ ...p, leaseOverride: e.target.value }))} placeholder="e.g. 24h, infinite" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={resForm.description} onChange={e => setResForm(p => ({ ...p, description: e.target.value }))} placeholder="Purpose of this reservation" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveRes}>{editingRes ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Reservation Dialog */}
      <Dialog open={deleteResOpen} onOpenChange={setDeleteResOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Reservation</DialogTitle>
            <DialogDescription>Delete reservation for {editingRes?.macAddress} ({editingRes?.ipAddress})?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteResOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => editingRes && deleteSingleRes(editingRes.id)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  const renderLeasesTab = () => (
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
          <p className="text-sm text-muted-foreground">Last refreshed: {new Date(lastRefresh).toLocaleTimeString()}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => fetchLeases()}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />Refresh Now
          </Button>
          {keaConnected && (
            <Button variant="outline" size="sm" onClick={async () => {
              try {
                const response = await fetch('/api/kea/leases/reclaim', { method: 'POST' });
                const result = await response.json();
                if (result.success) {
                  toast({ title: 'Success', description: 'Expired leases reclaimed from Kea DHCP4.' });
                  fetchLeases();
                } else {
                  toast({ title: 'Error', description: result.error || 'Failed to reclaim leases.', variant: 'destructive' });
                }
              } catch {
                toast({ title: 'Error', description: 'Could not reach Kea service.', variant: 'destructive' });
              }
            }}>
              <Zap className="h-3.5 w-3.5 mr-1.5" />Reclaim Expired
            </Button>
          )}
          {selectedLeases.size > 0 && (
            <Button variant="destructive" size="sm" onClick={expireSelected}>
              <XCircle className="h-3.5 w-3.5 mr-1.5" />Expire ({selectedLeases.size})
            </Button>
          )}
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
              <div className="text-xs text-muted-foreground">Active Leases</div>
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
              <div className="text-xs text-muted-foreground">Expired Leases</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-teal-500/10">
              <Monitor className="h-4 w-4 text-teal-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{leases.length}</div>
              <div className="text-xs text-muted-foreground">Total Leases</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <Server className="h-4 w-4 text-violet-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{subnets.length}</div>
              <div className="text-xs text-muted-foreground">Subnets</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Pool utilization bars */}
      <Card>
        <CardContent className="p-4">
          <h4 className="text-sm font-medium mb-3">Pool Utilization per Subnet</h4>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {subnets.map(s => {
              const pct = s.totalPool > 0 ? Math.round((s.activeLeases / s.totalPool) * 100) : 0;
              return (
                <div key={s.id}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">{s.name}</span>
                    <span className={cn('font-medium', getUtilText(pct))}>{pct}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-500', getUtilColor(pct))} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{s.activeLeases} / {s.totalPool} addresses</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Select value={leaseFilter} onValueChange={setLeaseFilter}>
                <SelectTrigger className="pl-9"><SelectValue placeholder="Filter by state" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All States</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="released">Released</SelectItem>
                  <SelectItem value="declined">Declined</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Select value={leaseSubnetFilter} onValueChange={setLeaseSubnetFilter}>
              <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Filter by subnet" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subnets</SelectItem>
                {subnets.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Lease table */}
      <Card>
        <CardContent className="p-0">
          <div className="max-h-[480px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={filteredLeases.length > 0 && filteredLeases.every(l => selectedLeases.has(l.id))}
                      onCheckedChange={checked => {
                        if (checked) setSelectedLeases(new Set(filteredLeases.map(l => l.id)));
                        else setSelectedLeases(new Set());
                      }}
                    />
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleLeaseSort('ipAddress')}>
                    <span className="flex items-center gap-1">IP <ArrowUpDown className="h-3 w-3" /></span>
                  </TableHead>
                  <TableHead>MAC</TableHead>
                  <TableHead>Hostname</TableHead>
                  <TableHead>Client ID</TableHead>
                  <TableHead>Subnet</TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => toggleLeaseSort('leaseStart')}>
                    <span className="flex items-center gap-1">Start <ArrowUpDown className="h-3 w-3" /></span>
                  </TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Last Seen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeases.slice(0, 80).map((l) => (
                  <TableRow
                    key={`${l.id}-${refreshKey}`}
                    className={cn(
                      'transition-colors',
                      selectedLeases.has(l.id) && 'bg-teal-50/50 dark:bg-teal-950/20',
                      l.state === 'active' && 'animate-[flashRow_0.6s_ease-out]'
                    )}
                  >
                    <TableCell>
                      <Checkbox checked={selectedLeases.has(l.id)} onCheckedChange={() => {
                        setSelectedLeases(prev => {
                          const next = new Set(prev);
                          if (next.has(l.id)) next.delete(l.id); else next.add(l.id);
                          return next;
                        });
                      }} />
                    </TableCell>
                    <TableCell><span className="font-mono text-sm font-medium">{l.ipAddress}</span></TableCell>
                    <TableCell><span className="font-mono text-xs">{l.macAddress}</span></TableCell>
                    <TableCell className="text-sm max-w-[120px] truncate">{l.hostname}</TableCell>
                    <TableCell><span className="font-mono text-xs text-muted-foreground">{l.clientId}</span></TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{l.subnetName}</Badge></TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">{formatDate(l.leaseStart)} {formatTime(l.leaseStart)}</span>
                    </TableCell>
                    <TableCell>
                      <div className="min-w-[70px]">
                        <span className={cn('text-xs font-medium', l.state === 'active' ? 'text-emerald-600' : 'text-muted-foreground')}>
                          {l.state === 'active' ? getCountdown(l.leaseExpires) : formatDate(l.leaseExpires)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{getLeaseStateBadge(l.state)}</TableCell>
                    <TableCell><span className="text-xs text-muted-foreground">{formatTime(l.lastSeen)}</span></TableCell>
                  </TableRow>
                ))}
                {filteredLeases.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      No leases match the current filters
                    </TableCell>
                  </TableRow>
                )}
                {filteredLeases.length > 80 && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-3 text-sm text-muted-foreground">
                      Showing 80 of {filteredLeases.length} leases. Use filters to narrow results.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderOptionsTab = () => {
    const globalOpts = options.filter(o => o.scope === 'global');
    const subnetOpts = options.filter(o => o.scope === 'subnet');

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Settings className="h-5 w-5 text-teal-600" />
              DHCP Options
            </h2>
            <p className="text-sm text-muted-foreground">{options.length} option(s) configured</p>
          </div>
          <Button onClick={() => { setOptForm({ code: '', name: '', value: '', scope: 'global', subnetId: '' }); setOptDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />Add Option
          </Button>
        </div>

        {/* Global Options */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="h-4 w-4 text-teal-600" />
              Global Options
              <Badge variant="secondary" className="ml-auto">{globalOpts.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {globalOpts.map(o => (
              <div key={o.id} className={cn('flex items-center gap-3 p-3 rounded-lg border transition-colors', !o.enabled && 'opacity-50')}>
                <div className="flex-shrink-0 w-12 text-center">
                  <span className="text-xs font-mono text-muted-foreground">Option</span>
                  <p className="font-mono font-bold text-sm">{o.code}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{o.name}</span>
                  </div>
                  <p className="font-mono text-xs text-muted-foreground truncate">{o.value}</p>
                </div>
                <Switch checked={o.enabled} onCheckedChange={() => toggleOptEnabled(o.id)} />
                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700" onClick={() => deleteOption(o.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
            {globalOpts.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No global options configured</p>
            )}
          </CardContent>
        </Card>

        {/* Subnet-specific Options */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Server className="h-4 w-4 text-amber-500" />
              Subnet-Specific Options
              <Badge variant="secondary" className="ml-auto">{subnetOpts.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {subnetOpts.map(o => (
              <div key={o.id} className={cn('flex items-center gap-3 p-3 rounded-lg border transition-colors', !o.enabled && 'opacity-50')}>
                <div className="flex-shrink-0 w-12 text-center">
                  <span className="text-xs font-mono text-muted-foreground">Option</span>
                  <p className="font-mono font-bold text-sm">{o.code}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{o.name}</span>
                    {o.subnetName && <Badge variant="outline" className="text-xs">{o.subnetName}</Badge>}
                  </div>
                  <p className="font-mono text-xs text-muted-foreground truncate">{o.value}</p>
                </div>
                <Switch checked={o.enabled} onCheckedChange={() => toggleOptEnabled(o.id)} />
                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700" onClick={() => deleteOption(o.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
            {subnetOpts.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No subnet-specific options configured</p>
            )}
          </CardContent>
        </Card>

        {/* Common Options Reference */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Common DHCP Option Reference
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { code: 6, name: 'DNS Servers', desc: 'Domain Name System servers' },
                { code: 15, name: 'Domain Name', desc: 'Client domain name suffix' },
                { code: 28, name: 'Broadcast Address', desc: 'Subnet broadcast address' },
                { code: 42, name: 'NTP Servers', desc: 'Network Time Protocol servers' },
                { code: 66, name: 'TFTP Server', desc: 'Trivial File Transfer server' },
                { code: 67, name: 'Boot Filename', desc: 'PXE boot file name' },
                { code: 119, name: 'Domain Search', desc: 'DNS domain search list' },
                { code: 252, name: 'WPAD URL', desc: 'Web Proxy Auto-Discovery URL' },
              ].map(ref => (
                <div key={ref.code} className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
                  <span className="font-mono text-xs text-muted-foreground w-8">{ref.code}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium">{ref.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{ref.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Add Option Dialog */}
        <Dialog open={optDialogOpen} onOpenChange={setOptDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add DHCP Option</DialogTitle>
              <DialogDescription>Configure a custom DHCP option.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Option Code *</Label>
                  <Input type="number" value={optForm.code} onChange={e => setOptForm(p => ({ ...p, code: e.target.value }))} placeholder="e.g. 6" className="font-mono" />
                </div>
                <div className="space-y-2">
                  <Label>Option Name *</Label>
                  <Input value={optForm.name} onChange={e => setOptForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. DNS Servers" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Value *</Label>
                <Input value={optForm.value} onChange={e => setOptForm(p => ({ ...p, value: e.target.value }))} placeholder="e.g. 8.8.8.8, 8.8.4.4" className="font-mono" />
              </div>
              <div className="space-y-2">
                <Label>Scope</Label>
                <Select value={optForm.scope} onValueChange={v => setOptForm(p => ({ ...p, scope: v as 'global' | 'subnet' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">Global</SelectItem>
                    <SelectItem value="subnet">Subnet-Specific</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {optForm.scope === 'subnet' && (
                <div className="space-y-2">
                  <Label>Subnet</Label>
                  <Select value={optForm.subnetId} onValueChange={v => setOptForm(p => ({ ...p, subnetId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select subnet" /></SelectTrigger>
                    <SelectContent>
                      {subnets.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.cidr})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOptDialogOpen(false)}>Cancel</Button>
              <Button onClick={addOption}>Add Option</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  };

  // ─── Main render ───────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Server className="h-6 w-6 text-teal-600" />
          DHCP Server Management
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure subnets, reservations, leases, and DHCP options for your network infrastructure
        </p>
      </div>

      {/* Kea DHCP Server Status Card */}
      <Card className="border-0 shadow-sm rounded-xl hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Server className="h-4 w-4 text-emerald-600" />
              Kea DHCP4 Server
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={cn(
                  'text-[10px] font-semibold px-2 py-0.5 rounded-full',
                  keaLoading
                    ? 'border-muted-foreground/30 text-muted-foreground'
                    : keaStatus.running
                      ? 'border-emerald-300 text-emerald-700 bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:bg-emerald-950/30'
                      : 'border-red-300 text-red-700 bg-red-50 dark:border-red-700 dark:text-red-400 dark:bg-red-950/30'
                )}
              >
                {keaLoading ? (
                  <span className="flex items-center gap-1">
                    <RefreshCw className="h-2.5 w-2.5 animate-spin" />
                    Checking
                  </span>
                ) : keaStatus.running ? (
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="h-2.5 w-2.5" />
                    Online
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <XCircle className="h-2.5 w-2.5" />
                    Offline
                  </span>
                )}
              </Badge>
              <div className="flex gap-1">
                {!keaStatus.running && !keaLoading && (
                  <Button variant="outline" size="sm" className="h-6 text-[10px] px-2" onClick={() => handleKeaServiceAction('start')}>
                    <Zap className="h-2.5 w-2.5 mr-1" />Start
                  </Button>
                )}
                {keaStatus.running && (
                  <>
                    <Button variant="outline" size="sm" className="h-6 text-[10px] px-2" onClick={() => handleKeaServiceAction('restart')}>
                      <RefreshCw className="h-2.5 w-2.5 mr-1" />Restart
                    </Button>
                    <Button variant="outline" size="sm" className="h-6 text-[10px] px-2 text-red-600" onClick={() => handleKeaServiceAction('stop')}>
                      <XCircle className="h-2.5 w-2.5 mr-1" />Stop
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="grid grid-cols-4 gap-3">
            <div className="text-center p-2 rounded-lg bg-muted/30">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <LayoutGrid className="h-3 w-3 text-emerald-500" />
              </div>
              <p className="text-lg font-bold tabular-nums">{keaStatus.subnetCount}</p>
              <p className="text-[10px] text-muted-foreground font-medium">Subnets</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-muted/30">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <Wifi className="h-3 w-3 text-cyan-500" />
              </div>
              <p className="text-lg font-bold tabular-nums">{keaStatus.activeLeases}</p>
              <p className="text-[10px] text-muted-foreground font-medium">Active Leases</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-muted/30">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <Hash className="h-3 w-3 text-violet-500" />
              </div>
              <p className="text-lg font-bold tabular-nums">{keaStatus.reservationCount}</p>
              <p className="text-[10px] text-muted-foreground font-medium">Reservations</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-muted/30">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <Monitor className="h-3 w-3 text-amber-500" />
              </div>
              <p className="text-[10px] font-bold">{keaStatus.running ? 'Kea 2.6.3' : 'N/A'}</p>
              <p className="text-[10px] text-muted-foreground font-medium">Version</p>
            </div>
          </div>
          {keaStatus.running && (
            <div className="mt-2 space-y-1.5">
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                Connected via unix domain socket · Data source: Kea DHCP4 Live
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-muted-foreground">Listening on:</span>
                {(keaStatus.currentInterfaces || []).map(iface => (
                  <Badge key={iface} variant="outline" className="text-[10px] px-1.5 py-0 font-mono border-emerald-300 text-emerald-700 bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:bg-emerald-950/30">
                    {iface}
                  </Badge>
                ))}
                <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1.5" onClick={() => {
                  setSelectedInterfaces(keaStatus.currentInterfaces || []);
                  setInterfaceDialogOpen(true);
                }}>
                  <Settings className="h-2.5 w-2.5 mr-0.5" />Change
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Interface Selection Dialog */}
      <Dialog open={interfaceDialogOpen} onOpenChange={setInterfaceDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-teal-600" />
              DHCP Listen Interfaces
            </DialogTitle>
            <DialogDescription>
              Select which network interfaces Kea DHCP4 should listen on. DHCP requests will only be served on selected interfaces.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-3">
            {(keaStatus.systemInterfaces || []).map(iface => (
              <div
                key={iface.name}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer',
                  selectedInterfaces.includes(iface.name)
                    ? 'border-teal-300 bg-teal-50/50 dark:border-teal-700 dark:bg-teal-950/20'
                    : 'border-muted hover:border-muted-foreground/30'
                )}
                onClick={() => {
                  setSelectedInterfaces(prev =>
                    prev.includes(iface.name)
                      ? prev.filter(i => i !== iface.name)
                      : [...prev, iface.name]
                  );
                }}
              >
                <Checkbox
                  checked={selectedInterfaces.includes(iface.name)}
                  onCheckedChange={() => {
                    setSelectedInterfaces(prev =>
                      prev.includes(iface.name)
                        ? prev.filter(i => i !== iface.name)
                        : [...prev, iface.name]
                    );
                  }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-medium text-sm">{iface.name}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {iface.status === 'loopback' ? 'Loopback' : 'Active'}
                    </Badge>
                  </div>
                  <p className="font-mono text-xs text-muted-foreground">{iface.ip}</p>
                </div>
                {iface.name === 'lo' && (
                  <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Test only</span>
                )}
                {iface.name !== 'lo' && (
                  <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">Production</span>
                )}
              </div>
            ))}
            {selectedInterfaces.length === 0 && (
              <p className="text-xs text-red-500 text-center py-2">At least one interface must be selected</p>
            )}
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
              <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">⚠️ Interface change requires restart</p>
              <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">After saving, the Kea DHCP4 server will be restarted to apply the new interface configuration.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInterfaceDialogOpen(false)}>Cancel</Button>
            <Button
              disabled={selectedInterfaces.length === 0}
              onClick={async () => {
                try {
                  const response = await fetch('/api/kea/interfaces', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ interfaces: selectedInterfaces }),
                  });
                  const result = await response.json();
                  if (result.success) {
                    // Restart Kea to apply interface changes
                    const restartResp = await fetch('/api/kea/service/restart', { method: 'POST' });
                    const restartResult = await restartResp.json();
                    toast({
                      title: 'Interfaces Updated',
                      description: `Kea DHCP4 now listening on: ${selectedInterfaces.join(', ')}. ${restartResult.success ? 'Server restarted.' : 'Restart may be needed.'}`,
                    });
                    setInterfaceDialogOpen(false);
                    setTimeout(fetchKeaStatus, 3000);
                  } else {
                    toast({ title: 'Error', description: result.error || 'Failed to update interfaces.', variant: 'destructive' });
                  }
                } catch {
                  toast({ title: 'Error', description: 'Could not reach Kea service.', variant: 'destructive' });
                }
              }}
            >
              Save & Restart
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Custom Tab Bar */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <TabButton active={activeTab === 'subnets'} icon={LayoutGrid} label="Subnets" count={subnets.length} onClick={() => setActiveTab('subnets')} />
        <TabButton active={activeTab === 'reservations'} icon={Hash} label="Reservations" count={reservations.length} onClick={() => setActiveTab('reservations')} />
        <TabButton active={activeTab === 'leases'} icon={Wifi} label="Leases" count={activeLeaseCount} onClick={() => setActiveTab('leases')} />
        <TabButton active={activeTab === 'options'} icon={Settings} label="Options" count={options.filter(o => o.enabled).length} onClick={() => setActiveTab('options')} />
      </div>

      {/* Tab content */}
      {activeTab === 'subnets' && (isLoadingSubnets ? renderSubnetsLoading() : renderSubnetsTab())}
      {activeTab === 'reservations' && (isLoadingReservations ? renderReservationsLoading() : renderReservationsTab())}
      {activeTab === 'leases' && (isLoadingLeases ? renderLeasesLoading() : renderLeasesTab())}
      {activeTab === 'options' && (isLoadingOptions ? renderOptionsLoading() : renderOptionsTab())}
    </div>
  );
}
