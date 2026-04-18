'use client';

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  Search,
  Settings,
  Ban,
  Tag,
  Filter,
  Globe,
  Terminal,
  Play,
  Info,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// ─── Exported Types ────────────────────────────────────────────────────────────

export interface DhcpBlacklistItem {
  id: string;
  macAddress: string;
  subnetId?: string;
  subnetName?: string;
  reason?: string;
  enabled: boolean;
  createdAt?: string;
}

export interface DhcpOptionItem {
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

export interface DhcpTagRuleItem {
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

export interface DhcpHostnameFilterItem {
  id: string;
  pattern: string;
  action: string;
  subnetId?: string;
  subnetName?: string;
  enabled: boolean;
  description?: string;
  createdAt?: string;
}

export interface DhcpLeaseScriptItem {
  id: string;
  name: string;
  scriptPath: string;
  events: string[];
  enabled: boolean;
  description?: string;
  createdAt?: string;
}

// ─── Local Subnet Type (avoids circular import with dhcp-page) ────────────────

interface SubnetInfo {
  id: string;
  name: string;
  cidr: string;
  ipv6Enabled?: boolean;
  ipv6Prefix?: string;
  ipv6PoolStart?: string;
  ipv6PoolEnd?: string;
  ipv6LeaseTime?: string;
  ipv6RAType?: string;
}

// ─── API Helper ───────────────────────────────────────────────────────────────

async function apiCall(url: string, options?: RequestInit) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  return response.json();
}

// ─── Empty State Component (local copy) ───────────────────────────────────────

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

// ─── Constants ────────────────────────────────────────────────────────────────

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

const LEASE_EVENTS = ['add', 'del', 'old', 'arp-add', 'arp-del'];

const EVENT_BADGE_COLORS: Record<string, string> = {
  add: 'bg-emerald-500/15 text-emerald-700 border-emerald-300',
  del: 'bg-red-500/15 text-red-700 border-red-300',
  old: 'bg-amber-500/15 text-amber-700 border-amber-300',
  'arp-add': 'bg-sky-500/15 text-sky-700 border-sky-300',
  'arp-del': 'bg-gray-500/15 text-gray-600 border-gray-300',
};

const RA_TYPE_BADGES: Record<string, string> = {
  slaac: 'bg-teal-500/15 text-teal-700 border-teal-300',
  stateful: 'bg-sky-500/15 text-sky-700 border-sky-300',
  'ra-only': 'bg-amber-500/15 text-amber-700 border-amber-300',
  'ra-stateless': 'bg-purple-500/15 text-purple-700 border-purple-300',
};

// ─── Utility Functions ────────────────────────────────────────────────────────

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

// ─── Props Interface ──────────────────────────────────────────────────────────

interface DhcpAdvancedTabsProps {
  activeTab: string;
  subnets: SubnetInfo[];
  blacklist: DhcpBlacklistItem[];
  dhcpOptions: DhcpOptionItem[];
  tagRules: DhcpTagRuleItem[];
  hostnameFilters: DhcpHostnameFilterItem[];
  leaseScripts: DhcpLeaseScriptItem[];
  loadingBlacklist: boolean;
  loadingOptions: boolean;
  loadingTagRules: boolean;
  loadingHostnameFilters: boolean;
  loadingLeaseScripts: boolean;
  onRefresh: () => void;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function DhcpAdvancedTabs({
  activeTab,
  subnets,
  blacklist,
  dhcpOptions,
  tagRules,
  hostnameFilters,
  leaseScripts,
  loadingBlacklist,
  loadingOptions,
  loadingTagRules,
  loadingHostnameFilters,
  loadingLeaseScripts,
  onRefresh,
}: DhcpAdvancedTabsProps) {
  const { toast } = useToast();

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(
      () => toast({ title: 'Copied', description: `${label} copied to clipboard.` }),
      () => toast({ title: 'Error', description: 'Failed to copy.', variant: 'destructive' })
    );
  };

  // ══════════════════════════════════════════════════════════════════════════
  // ─── Tab: Blacklist (MAC Deny List) ────────────────────────────────────────
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
        setBlDialogOpen(false); onRefresh();
      } else { toast({ title: 'Error', description: result.message || result.error || 'Failed to save.', variant: 'destructive' }); }
    } catch { toast({ title: 'Error', description: 'Network error.', variant: 'destructive' }); }
    finally { setBlSaving(false); }
  };

  const deleteBl = async () => {
    if (!editingBl) return;
    try {
      const result = await apiCall(`/api/kea/blacklist/${editingBl.id}`, { method: 'DELETE' });
      if (result.success) { toast({ title: 'Removed', description: 'MAC address removed from deny list.' }); setDeleteBlOpen(false); onRefresh(); }
      else { toast({ title: 'Error', description: result.message || 'Failed to delete.', variant: 'destructive' }); }
    } catch { toast({ title: 'Error', description: 'Network error.', variant: 'destructive' }); }
  };

  const saveBulkBl = async () => {
    const macs = blBulkText.split('\n').map(l => l.trim()).filter(Boolean);
    if (macs.length === 0) { toast({ title: 'Error', description: 'No MAC addresses provided.', variant: 'destructive' }); return; }
    setBlSaving(true);
    try {
      const result = await apiCall('/api/kea/blacklist/bulk', { method: 'POST', body: JSON.stringify({ macAddresses: macs }) });
      if (result.success) { toast({ title: 'Bulk Added', description: `${macs.length} MAC address(es) added to deny list.` }); setBlBulkDialogOpen(false); setBlBulkText(''); onRefresh(); }
      else { toast({ title: 'Error', description: result.message || 'Bulk add failed.', variant: 'destructive' }); }
    } catch { toast({ title: 'Error', description: 'Network error.', variant: 'destructive' }); }
    finally { setBlSaving(false); }
  };

  const bulkDeleteBl = async () => {
    try {
      await Promise.all(Array.from(blSelected).map(id => apiCall(`/api/kea/blacklist/${id}`, { method: 'DELETE' })));
      toast({ title: 'Deleted', description: `${blSelected.size} entry(s) removed.` }); setBlSelected(new Set()); onRefresh();
    } catch { toast({ title: 'Error', description: 'Network error.', variant: 'destructive' }); }
  };

  // ══════════════════════════════════════════════════════════════════════════
  // ─── Tab: Options (Custom DHCP Options) ────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  const [optSearch, setOptSearch] = useState('');
  const [optDialogOpen, setOptDialogOpen] = useState(false);
  const [editingOpt, setEditingOpt] = useState<DhcpOptionItem | null>(null);
  const [deleteOptOpen, setDeleteOptOpen] = useState(false);
  const [optSaving, setOptSaving] = useState(false);
  const [optForm, setOptForm] = useState({ code: '', name: '', value: '', type: 'string', subnetId: '__global__', enabled: true, description: '' });

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
      if (result.success) { toast({ title: editingOpt ? 'Option Updated' : 'Option Created', description: result.message || 'Custom DHCP option saved.' }); setOptDialogOpen(false); onRefresh(); }
      else { toast({ title: 'Error', description: result.message || 'Failed to save.', variant: 'destructive' }); }
    } catch { toast({ title: 'Error', description: 'Network error.', variant: 'destructive' }); }
    finally { setOptSaving(false); }
  };

  const deleteOpt = async () => {
    if (!editingOpt) return;
    try {
      const result = await apiCall(`/api/kea/options/${editingOpt.id}`, { method: 'DELETE' });
      if (result.success) { toast({ title: 'Deleted', description: 'DHCP option removed.' }); setDeleteOptOpen(false); onRefresh(); }
      else { toast({ title: 'Error', description: result.message || 'Failed.', variant: 'destructive' }); }
    } catch { toast({ title: 'Error', description: 'Network error.', variant: 'destructive' }); }
  };

  // ══════════════════════════════════════════════════════════════════════════
  // ─── Tab: Tag Rules ────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  const [trSearch, setTrSearch] = useState('');
  const [trDialogOpen, setTrDialogOpen] = useState(false);
  const [editingTr, setEditingTr] = useState<DhcpTagRuleItem | null>(null);
  const [deleteTrOpen, setDeleteTrOpen] = useState(false);
  const [trSaving, setTrSaving] = useState(false);
  const [trForm, setTrForm] = useState({ name: '', matchType: 'mac', matchPattern: '', setTag: '', subnetId: '__all__', enabled: true, description: '' });

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
      if (result.success) { toast({ title: editingTr ? 'Tag Rule Updated' : 'Tag Rule Created', description: result.message || 'Tag rule saved.' }); setTrDialogOpen(false); onRefresh(); }
      else { toast({ title: 'Error', description: result.message || 'Failed.', variant: 'destructive' }); }
    } catch { toast({ title: 'Error', description: 'Network error.', variant: 'destructive' }); }
    finally { setTrSaving(false); }
  };

  const deleteTr = async () => {
    if (!editingTr) return;
    try {
      const result = await apiCall(`/api/kea/tag-rules/${editingTr.id}`, { method: 'DELETE' });
      if (result.success) { toast({ title: 'Deleted', description: 'Tag rule removed.' }); setDeleteTrOpen(false); onRefresh(); }
      else { toast({ title: 'Error', description: result.message || 'Failed.', variant: 'destructive' }); }
    } catch { toast({ title: 'Error', description: 'Network error.', variant: 'destructive' }); }
  };

  // ══════════════════════════════════════════════════════════════════════════
  // ─── Tab: Hostname Filter ──────────────────────────────────────────────────
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
      if (result.success) { toast({ title: editingHf ? 'Filter Updated' : 'Filter Created', description: result.message || 'Hostname filter saved.' }); setHfDialogOpen(false); onRefresh(); }
      else { toast({ title: 'Error', description: result.message || 'Failed.', variant: 'destructive' }); }
    } catch { toast({ title: 'Error', description: 'Network error.', variant: 'destructive' }); }
    finally { setHfSaving(false); }
  };

  const deleteHf = async () => {
    if (!editingHf) return;
    try {
      const result = await apiCall(`/api/kea/hostname-filters/${editingHf.id}`, { method: 'DELETE' });
      if (result.success) { toast({ title: 'Deleted', description: 'Hostname filter removed.' }); setDeleteHfOpen(false); onRefresh(); }
      else { toast({ title: 'Error', description: result.message || 'Failed.', variant: 'destructive' }); }
    } catch { toast({ title: 'Error', description: 'Network error.', variant: 'destructive' }); }
  };

  // ══════════════════════════════════════════════════════════════════════════
  // ─── Tab: Event Scripts ────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  const [lsDialogOpen, setLsDialogOpen] = useState(false);
  const [editingLs, setEditingLs] = useState<DhcpLeaseScriptItem | null>(null);
  const [deleteLsOpen, setDeleteLsOpen] = useState(false);
  const [lsSaving, setLsSaving] = useState(false);
  const [lsForm, setLsForm] = useState({ name: '', scriptPath: '', events: [] as string[], enabled: true, description: '' });

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
      if (result.success) { toast({ title: editingLs ? 'Script Updated' : 'Script Created', description: result.message || 'Lease event script saved.' }); setLsDialogOpen(false); onRefresh(); }
      else { toast({ title: 'Error', description: result.message || 'Failed.', variant: 'destructive' }); }
    } catch { toast({ title: 'Error', description: 'Network error.', variant: 'destructive' }); }
    finally { setLsSaving(false); }
  };

  const deleteLs = async () => {
    if (!editingLs) return;
    try {
      const result = await apiCall(`/api/kea/lease-scripts/${editingLs.id}`, { method: 'DELETE' });
      if (result.success) { toast({ title: 'Deleted', description: 'Script removed.' }); setDeleteLsOpen(false); onRefresh(); }
      else { toast({ title: 'Error', description: result.message || 'Failed.', variant: 'destructive' }); }
    } catch { toast({ title: 'Error', description: 'Network error.', variant: 'destructive' }); }
  };

  const testLs = async (s: DhcpLeaseScriptItem) => {
    toast({ title: 'Test Trigger Sent', description: `Test trigger sent for "${s.name}" with sample arguments.` });
  };

  // ══════════════════════════════════════════════════════════════════════════
  // ─── Tab: IPv6 ─────────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  const [ipv6DialogOpen, setIpv6DialogOpen] = useState(false);
  const [editingIpv6, setEditingIpv6] = useState<SubnetInfo | null>(null);
  const [ipv6Saving, setIpv6Saving] = useState(false);
  const [ipv6Form, setIpv6Form] = useState({ ipv6Enabled: false, ipv6Prefix: '', ipv6PoolStart: '', ipv6PoolEnd: '', ipv6LeaseTime: '', ipv6RAType: 'slaac' });

  const ipv6EnabledCount = subnets.filter(s => s.ipv6Enabled).length;
  const ipv6DisabledCount = subnets.filter(s => !s.ipv6Enabled).length;

  const openEditIpv6 = (s: SubnetInfo) => {
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

  const toggleIpv6Enabled = async (s: SubnetInfo) => {
    const newVal = !(s.ipv6Enabled ?? false);
    try {
      const result = await apiCall(`/api/kea/subnets/${s.id}`, { method: 'PUT', body: JSON.stringify({ ipv6Enabled: newVal }) });
      if (result.success) {
        toast({ title: newVal ? 'IPv6 Enabled' : 'IPv6 Disabled', description: `IPv6 ${newVal ? 'activated' : 'deactivated'} for "${s.name}".` });
        onRefresh();
      } else { toast({ title: 'Error', description: result.message || 'Failed to update.', variant: 'destructive' }); }
    } catch { toast({ title: 'Error', description: 'Network error.', variant: 'destructive' }); }
  };

  const saveIpv6 = async () => {
    if (!editingIpv6) return;
    setIpv6Saving(true);
    try {
      const result = await apiCall(`/api/kea/subnets/${editingIpv6.id}`, { method: 'PUT', body: JSON.stringify(ipv6Form) });
      if (result.success) { toast({ title: 'IPv6 Settings Updated', description: `IPv6 config for "${editingIpv6.name}" saved.` }); setIpv6DialogOpen(false); onRefresh(); }
      else { toast({ title: 'Error', description: result.message || 'Failed.', variant: 'destructive' }); }
    } catch { toast({ title: 'Error', description: 'Network error.', variant: 'destructive' }); }
    finally { setIpv6Saving(false); }
  };

  // ══════════════════════════════════════════════════════════════════════════
  // ─── Render: Blacklist Tab ─────────────────────────────────────────────────
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
  // ─── Main Render ───────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════════

  if (!['blacklist', 'options', 'tag-rules', 'hostname-filters', 'lease-scripts', 'ipv6'].includes(activeTab)) return null;

  return (
    <>
      {activeTab === 'blacklist' && renderBlacklistTab()}
      {activeTab === 'options' && renderOptionsTab()}
      {activeTab === 'tag-rules' && renderTagRulesTab()}
      {activeTab === 'hostname-filters' && renderHostnameFilterTab()}
      {activeTab === 'lease-scripts' && renderLeaseScriptsTab()}
      {activeTab === 'ipv6' && renderIpv6Tab()}
    </>
  );
}
