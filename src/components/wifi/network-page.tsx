'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
  Network,
  Wifi,
  Globe,
  Shield,
  Clock,
  Plus,
  Edit2,
  Trash2,
  ChevronUp,
  ChevronDown,
  Copy,
  Download,
  Upload,
  ArrowRightLeft,
  Server,
  Monitor,
  Radio,
  ToggleLeft,
  ToggleRight,
  Search,
  Filter,
  MoreHorizontal,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  Save,
  LayoutGrid,
  List,
  Route,
  Workflow,
  MapPin,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { usePropertyId } from '@/hooks/use-property';

// ─── MOCK DATA ───────────────────────────────────────────────────────────────

interface NetworkInterface {
  id: string;
  name: string;
  type: 'ethernet' | 'vlan' | 'bridge' | 'bond' | 'wireless';
  status: 'up' | 'down';
  ipAddress: string;
  subnet: string;
  mac: string;
  speed: string;
  mtu: number;
  rxBytes: number;
  txBytes: number;
  description: string;
  allIps: string[];  // All IPs including secondaries, e.g. ["192.168.1.1", "192.168.1.2"]
  nettype?: number;  // 0=LAN, 1=WAN, 2=VLAN, 3=Bridge, 4=Bond, 5=Management, 6=Guest, 7=IoT, 8=Unused
  nettypeLabel?: string; // 'WAN', 'LAN', etc.
  isPhysical?: boolean;
  secondaryIps?: string[];
  ipv4Gateway?: string;
  ipv4Cidr?: number;
  _osData?: any;
}

const fallbackInterfaces: NetworkInterface[] = [
  { id: 'if-1', name: 'eth0', type: 'ethernet', status: 'up', ipAddress: '10.0.1.1', subnet: '255.255.255.0', mac: '00:1A:2B:3C:4D:01', speed: '1 Gbps', mtu: 1500, rxBytes: 4521984320, txBytes: 2847190230, description: 'Primary WAN uplink', allIps: ['10.0.1.1'] },
  { id: 'if-2', name: 'eth1', type: 'ethernet', status: 'up', ipAddress: '192.168.1.1', subnet: '255.255.255.0', mac: '00:1A:2B:3C:4D:02', speed: '1 Gbps', mtu: 1500, rxBytes: 1289472340, txBytes: 984712340, description: 'LAN - Floor 1', allIps: ['192.168.1.1'] },
  { id: 'if-3', name: 'br0', type: 'bridge', status: 'up', ipAddress: '172.16.0.1', subnet: '255.255.0.0', mac: '00:1A:2B:3C:4D:03', speed: '2 Gbps', mtu: 1500, rxBytes: 3241987234, txBytes: 2847198234, description: 'Management bridge', allIps: ['172.16.0.1'] },
  { id: 'if-4', name: 'bond0', type: 'bond', status: 'up', ipAddress: '10.0.2.1', subnet: '255.255.255.0', mac: '00:1A:2B:3C:4D:04', speed: '2 Gbps', mtu: 9000, rxBytes: 8947192340, txBytes: 6742198340, description: 'WAN failover bond', allIps: ['10.0.2.1'] },
  { id: 'if-5', name: 'wlan0', type: 'wireless', status: 'up', ipAddress: '192.168.10.1', subnet: '255.255.255.0', mac: '00:1A:2B:3C:4D:05', speed: '300 Mbps', mtu: 1500, rxBytes: 2847192340, txBytes: 1247198234, description: 'Guest WiFi AP', allIps: ['192.168.10.1'] },
  { id: 'if-6', name: 'eth2', type: 'ethernet', status: 'down', ipAddress: '—', subnet: '—', mac: '00:1A:2B:3C:4D:06', speed: '1 Gbps', mtu: 1500, rxBytes: 0, txBytes: 0, description: 'Unused - Future expansion', allIps: ['—'] },
];

interface VLANEntry {
  id: string;
  vlanId: number;
  subInterface: string;
  parent: string;
  description: string;
  mtu: number;
  enabled: boolean;
  dhcpSubnet: string;
}

const fallbackVLANs: VLANEntry[] = [
  { id: 'vlan-1', vlanId: 10, subInterface: 'eth1.10', parent: 'eth1', description: 'Guest WiFi Network', mtu: 1500, enabled: true, dhcpSubnet: '192.168.10.0/24' },
  { id: 'vlan-2', vlanId: 20, subInterface: 'eth1.20', parent: 'eth1', description: 'Staff Network', mtu: 1500, enabled: true, dhcpSubnet: '192.168.20.0/24' },
  { id: 'vlan-3', vlanId: 30, subInterface: 'eth1.30', parent: 'eth1', description: 'POS / Payment Terminals', mtu: 1500, enabled: true, dhcpSubnet: '192.168.30.0/24' },
  { id: 'vlan-4', vlanId: 40, subInterface: 'eth1.40', parent: 'eth1', description: 'IoT / Smart Room Devices', mtu: 1500, enabled: false, dhcpSubnet: '192.168.40.0/24' },
  { id: 'vlan-5', vlanId: 50, subInterface: 'br0.50', parent: 'br0', description: 'Management / Admin', mtu: 1500, enabled: true, dhcpSubnet: '172.16.50.0/24' },
];

interface BridgeEntry {
  id: string;
  name: string;
  members: string[];
  stp: boolean;
  forwardDelay: number;
  enabled: boolean;
}

// No mock bridge data — populated from OS data or DB API
// Empty initial state; honest empty state shown until real data loads

interface BondEntry {
  id: string;
  name: string;
  mode: string;
  members: string[];
  miimon: number;
  lacpRate: string;
  primary: string;
}

const mockBonds: BondEntry[] = [
  { id: 'bond-1', name: 'bond0', mode: '802.3ad (LACP)', members: ['eth0', 'eth3'], miimon: 100, lacpRate: 'fast', primary: 'eth0' },
  { id: 'bond-2', name: 'bond1', mode: 'active-backup', members: ['eth4', 'eth5'], miimon: 100, lacpRate: 'slow', primary: 'eth4' },
];

interface InterfaceRole {
  interfaceId: string;
  interfaceName: string;
  role: 'wan' | 'lan' | 'dmz' | 'management' | 'wifi' | 'unused';
  priority: number;
}

const mockRoles: InterfaceRole[] = [
  { interfaceId: 'if-1', interfaceName: 'eth0', role: 'wan', priority: 1 },
  { interfaceId: 'if-4', interfaceName: 'bond0', role: 'wan', priority: 2 },
  { interfaceId: 'if-2', interfaceName: 'eth1', role: 'lan', priority: 1 },
  { interfaceId: 'if-3', interfaceName: 'br0', role: 'management', priority: 1 },
  { interfaceId: 'if-5', interfaceName: 'wlan0', role: 'wifi', priority: 1 },
  { interfaceId: 'if-6', interfaceName: 'eth2', role: 'unused', priority: 0 },
];

interface PortForwardRule {
  id: string;
  name: string;
  protocol: 'TCP' | 'UDP' | 'TCP/UDP';
  extPort: string;
  internalIp: string;
  internalPort: string;
  iface: string;
  enabled: boolean;
}

const mockPortForwards: PortForwardRule[] = [
  { id: 'pf-1', name: 'Web Server', protocol: 'TCP', extPort: '80', internalIp: '192.168.1.10', internalPort: '80', iface: 'eth0', enabled: true },
  { id: 'pf-2', name: 'HTTPS', protocol: 'TCP', extPort: '443', internalIp: '192.168.1.10', internalPort: '443', iface: 'eth0', enabled: true },
  { id: 'pf-3', name: 'PMS Remote Access', protocol: 'TCP', extPort: '8443', internalIp: '192.168.1.20', internalPort: '443', iface: 'eth0', enabled: true },
  { id: 'pf-4', name: 'VPN Server', protocol: 'UDP', extPort: '1194', internalIp: '192.168.1.1', internalPort: '1194', iface: 'bond0', enabled: false },
  { id: 'pf-5', name: 'FTP Server', protocol: 'TCP', extPort: '21', internalIp: '192.168.1.30', internalPort: '21', iface: 'eth0', enabled: true },
  { id: 'pf-6', name: 'DNS Forward', protocol: 'TCP/UDP', extPort: '53', internalIp: '192.168.1.1', internalPort: '53', iface: 'eth0', enabled: true },
];

interface FilterCategory {
  id: string;
  name: string;
  icon: string;
  domainCount: number;
  enabled: boolean;
  domains: string[];
}

const mockFilterCategories: FilterCategory[] = [
  { id: 'fc-1', name: 'Social Media', icon: 'Globe', domainCount: 142, enabled: true, domains: ['facebook.com', 'instagram.com', 'twitter.com', 'tiktok.com', 'linkedin.com'] },
  { id: 'fc-2', name: 'Streaming', icon: 'Monitor', domainCount: 98, enabled: false, domains: ['netflix.com', 'youtube.com', 'hulu.com', 'disneyplus.com', 'primevideo.com'] },
  { id: 'fc-3', name: 'Adult Content', icon: 'Shield', domainCount: 2847, enabled: true, domains: ['*'] },
  { id: 'fc-4', name: 'Gaming', icon: 'Radio', domainCount: 64, enabled: false, domains: ['steam.com', 'epicgames.com', 'origin.com', 'blizzard.com'] },
  { id: 'fc-5', name: 'Malware', icon: 'AlertCircle', domainCount: 15820, enabled: true, domains: ['*'] },
  { id: 'fc-6', name: 'Ads & Trackers', icon: 'Shield', domainCount: 4521, enabled: true, domains: ['doubleclick.net', 'googlesyndication.com', 'facebook.net', 'amazon-adsystem.com'] },
  { id: 'fc-7', name: 'Custom', icon: 'Edit2', domainCount: 12, enabled: true, domains: ['custom-block-1.com', 'custom-block-2.com'] },
];

interface Schedule {
  id: string;
  name: string;
  days: boolean[];
  startTime: string;
  endTime: string;
  applyTo: string;
  action: string;
  enabled: boolean;
}

const mockSchedules: Schedule[] = [
  { id: 'sch-1', name: 'Business Hours WiFi', days: [true, true, true, true, true, false, false], startTime: '06:00', endTime: '22:00', applyTo: 'Guest VLAN', action: 'Allow', enabled: true },
  { id: 'sch-2', name: 'Night Mode', days: [true, true, true, true, true, true, true], startTime: '23:00', endTime: '06:00', applyTo: 'All Guests', action: 'Block Streaming', enabled: true },
  { id: 'sch-3', name: 'Weekend Reduced Speed', days: [false, false, false, false, false, true, true], startTime: '08:00', endTime: '20:00', applyTo: 'Guest Network', action: 'Throttle 50%', enabled: false },
  { id: 'sch-4', name: 'Staff WiFi 24/7', days: [true, true, true, true, true, true, true], startTime: '00:00', endTime: '23:59', applyTo: 'Staff VLAN', action: 'Allow Full', enabled: true },
];

interface BackupSnapshot {
  id: string;
  name: string;
  date: string;
  version: string;
  type: 'auto' | 'manual';
  size: string;
}

interface RouteEntry {
  id: string;
  name: string;
  destination: string;
  gateway: string;
  metric: number;
  interfaceName: string;
  protocol: string;
  isDefault: boolean;
  enabled: boolean;
  description: string;
}

interface MultiWanMemberEntry {
  id: string;
  interfaceName: string;
  weight: number;
  gateway: string;
  healthStatus: 'online' | 'offline' | 'checking' | 'unknown';
  enabled: boolean;
  isPrimary: boolean;
}

interface MultiWanConfigEntry {
  id: string;
  enabled: boolean;
  mode: 'weighted' | 'failover' | 'round-robin' | 'ECMP';
  healthCheckUrl: string;
  healthCheckInterval: number;
  healthCheckTimeout: number;
  failoverThreshold: number;
  autoSwitchback: boolean;
  switchbackDelay: number;
  flushConnectionsOnFailover: boolean;
  wanMembers: MultiWanMemberEntry[];
}

const fallbackBackups: BackupSnapshot[] = [
  { id: 'bk-1', name: 'Pre-Update Backup', date: '2025-01-14 08:30', version: '3.2.1', type: 'auto', size: '2.4 MB' },
  { id: 'bk-2', name: 'Weekly Auto Backup', date: '2025-01-13 00:00', version: '3.2.1', type: 'auto', size: '2.4 MB' },
  { id: 'bk-3', name: 'Manual - Before Firewall Change', date: '2025-01-12 14:22', version: '3.2.0', type: 'manual', size: '2.3 MB' },
  { id: 'bk-4', name: 'Weekly Auto Backup', date: '2025-01-06 00:00', version: '3.2.0', type: 'auto', size: '2.3 MB' },
  { id: 'bk-5', name: 'Initial Setup Snapshot', date: '2025-01-01 10:00', version: '3.2.0', type: 'manual', size: '2.1 MB' },
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const typeBadgeColor: Record<string, string> = {
  ethernet: 'bg-teal-500/15 text-teal-700 dark:text-teal-400 border-teal-500/30',
  vlan: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
  bridge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  bond: 'bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/30',
  wireless: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30',
};

const roleBadgeColor: Record<string, string> = {
  wan: 'bg-gradient-to-r from-orange-500/20 to-amber-500/20 text-orange-700 dark:text-orange-400 border-orange-500/30',
  lan: 'bg-gradient-to-r from-teal-500/20 to-emerald-500/20 text-teal-700 dark:text-teal-400 border-teal-500/30',
  dmz: 'bg-gradient-to-r from-red-500/20 to-rose-500/20 text-red-700 dark:text-red-400 border-red-500/30',
  management: 'bg-gradient-to-r from-violet-500/20 to-purple-500/20 text-violet-700 dark:text-violet-400 border-violet-500/30',
  wifi: 'bg-gradient-to-r from-cyan-500/20 to-sky-500/20 text-cyan-700 dark:text-cyan-400 border-cyan-500/30',
  unused: 'bg-muted text-muted-foreground border-muted-foreground/20',
};

// Nettype label to badge color mapping (Rocky 10 nmcli architecture)
const nettypeBadgeColor: Record<string, string> = {
  'WAN': 'bg-gradient-to-r from-orange-500/20 to-amber-500/20 text-orange-700 dark:text-orange-400 border-orange-500/30',
  'LAN': 'bg-gradient-to-r from-emerald-500/20 to-green-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  'VLAN': 'bg-gradient-to-r from-purple-500/20 to-violet-500/20 text-purple-700 dark:text-purple-400 border-purple-500/30',
  'Bridge': 'bg-gradient-to-r from-cyan-500/20 to-sky-500/20 text-cyan-700 dark:text-cyan-400 border-cyan-500/30',
  'Bond': 'bg-gradient-to-r from-pink-500/20 to-rose-500/20 text-pink-700 dark:text-pink-400 border-pink-500/30',
  'Management': 'bg-gradient-to-r from-slate-500/20 to-gray-500/20 text-slate-700 dark:text-slate-400 border-slate-500/30',
  'Guest': 'bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30',
  'IoT': 'bg-gradient-to-r from-teal-500/20 to-cyan-500/20 text-teal-700 dark:text-teal-400 border-teal-500/30',
  'Unused': 'bg-muted text-muted-foreground border-muted-foreground/20',
  'Unknown': 'bg-muted text-muted-foreground border-muted-foreground/20',
};

const protocolBadgeColor: Record<string, string> = {
  'TCP': 'bg-teal-500/15 text-teal-700 dark:text-teal-400',
  'UDP': 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  'TCP/UDP': 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
};

const filterCategoryIcons: Record<string, React.ReactNode> = {
  Globe: <Globe className="h-6 w-6" />,
  Monitor: <Monitor className="h-6 w-6" />,
  Shield: <Shield className="h-6 w-6" />,
  Radio: <Radio className="h-6 w-6" />,
  AlertCircle: <AlertCircle className="h-6 w-6" />,
  Edit2: <Edit2 className="h-6 w-6" />,
};

const filterCategoryColors: Record<string, string> = {
  'Social Media': 'from-rose-500 to-pink-600',
  'Streaming': 'from-violet-500 to-purple-600',
  'Adult Content': 'from-red-600 to-rose-700',
  'Gaming': 'from-emerald-500 to-teal-600',
  'Malware': 'from-red-500 to-orange-600',
  'Ads & Trackers': 'from-amber-500 to-yellow-600',
  'Custom': 'from-slate-500 to-gray-600',
};

const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ─── TRAFFIC GRAPH PLACEHOLDER ───────────────────────────────────────────────

function TrafficGraph({ rx, tx }: { rx: number; tx: number }) {
  const maxVal = Math.max(rx, tx, 1);
  const rxPct = Math.min(100, (rx / maxVal) * 100);
  const txPct = Math.min(100, (tx / maxVal) * 100);
  return (
    <div className="space-y-1.5 mt-3">
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        <span className="w-8">RX</span>
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-400" style={{ width: `${rxPct}%` }} />
        </div>
        <span className="w-16 text-right font-mono">{formatBytes(rx)}</span>
      </div>
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        <span className="w-8">TX</span>
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-400" style={{ width: `${txPct}%` }} />
        </div>
        <span className="w-16 text-right font-mono">{formatBytes(tx)}</span>
      </div>
    </div>
  );
}

// ─── TAB CONFIG ──────────────────────────────────────────────────────────────

type TabId = 'interfaces' | 'vlans' | 'bridges-bonds' | 'wan-lan' | 'routes' | 'multiwan' | 'port-forwarding' | 'content-filtering' | 'schedules' | 'backup';

const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'interfaces', label: 'Interfaces', icon: <Network className="h-4 w-4" /> },
  { id: 'vlans', label: 'VLANs', icon: <Server className="h-4 w-4" /> },
  { id: 'bridges-bonds', label: 'Bridges & Bonds', icon: <ArrowRightLeft className="h-4 w-4" /> },
  { id: 'wan-lan', label: 'WAN/LAN Mapping', icon: <Globe className="h-4 w-4" /> },
  { id: 'routes', label: 'Routes', icon: <Route className="h-4 w-4" /> },
  { id: 'multiwan', label: 'Multi-WAN', icon: <Workflow className="h-4 w-4" /> },
  { id: 'port-forwarding', label: 'Port Forwarding', icon: <Wifi className="h-4 w-4" /> },
  { id: 'content-filtering', label: 'Content Filtering', icon: <Shield className="h-4 w-4" /> },
  { id: 'schedules', label: 'Schedules', icon: <Clock className="h-4 w-4" /> },
  { id: 'backup', label: 'Backup', icon: <Download className="h-4 w-4" /> },
];

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────

export default function NetworkPage() {
  const [activeTab, setActiveTab] = useState<TabId>('interfaces');
  const { toast } = useToast();
  const { propertyId } = usePropertyId();

  // Dialog states
  const [addInterfaceOpen, setAddInterfaceOpen] = useState(false);
  const [editInterfaceOpen, setEditInterfaceOpen] = useState(false);
  const [selectedInterface, setSelectedInterface] = useState<NetworkInterface | null>(null);

  const [addVlanOpen, setAddVlanOpen] = useState(false);
  const [editVlanOpen, setEditVlanOpen] = useState(false);
  const [selectedVlan, setSelectedVlan] = useState<VLANEntry | null>(null);

  const [addPortForwardOpen, setAddPortForwardOpen] = useState(false);
  const [editPortForwardOpen, setEditPortForwardOpen] = useState(false);
  const [selectedPortForward, setSelectedPortForward] = useState<PortForwardRule | null>(null);

  const [editFilterOpen, setEditFilterOpen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<FilterCategory | null>(null);

  const [addFilterOpen, setAddFilterOpen] = useState(false);
  const [addScheduleOpen, setAddScheduleOpen] = useState(false);

  // Loading states
  const [loadingInterfaces, setLoadingInterfaces] = useState(true);
  const [loadingVlans, setLoadingVlans] = useState(true);
  const [loadingFilters, setLoadingFilters] = useState(true);
  const [loadingSchedules, setLoadingSchedules] = useState(true);
  const [loadingBackups, setLoadingBackups] = useState(true);

  // Local state for editable data — interfaces, vlans, backups fetched from API
  const [interfaces, setInterfaces] = useState<NetworkInterface[]>([]);
  const [vlans, setVlans] = useState<VLANEntry[]>([]);
  const [bridges, setBridges] = useState<BridgeEntry[]>([]);
  const [bonds, setBonds] = useState<BondEntry[]>([]);
  const [roles, setRoles] = useState<InterfaceRole[]>(mockRoles);
  const [portForwards, setPortForwards] = useState<PortForwardRule[]>(mockPortForwards);
  const [filterCategories, setFilterCategories] = useState<FilterCategory[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [backups, setBackups] = useState<BackupSnapshot[]>([]);

  const [bridgeBondSubTab, setBridgeBondSubTab] = useState<'bridges' | 'bonds'>('bridges');

  // Real OS data state
  const [osSystemInfo, setOsSystemInfo] = useState<{ hostname: string; kernel: string; osRelease: string; uptimeFormatted: string; loadAverage: string; memory: { total: number; used: number; usagePercent: number }; cpuCount: number } | null>(null);
  const [osDataLoaded, setOsDataLoaded] = useState(false);

  // WAN failover config
  const [failoverConfig, setFailoverConfig] = useState({
    healthCheckUrl: 'https://1.1.1.1',
    failoverThreshold: 3,
    autoSwitchback: true,
  });

  // Form states
  const [newInterface, setNewInterface] = useState({ name: '', type: 'ethernet', mtu: 1500, description: '' });
  const [interfaceView, setInterfaceView] = useState<'grid' | 'list'>('grid');
  const [editInterfaceData, setEditInterfaceData] = useState({ 
    name: '', mtu: 1500, description: '',
    mode: 'dhcp' as 'dhcp' | 'static',
    ipAddress: '', netmask: '', gateway: '',
    role: 'unused' as string,
    priority: 0
  });

  const [newVlan, setNewVlan] = useState({ vlanId: '', parentInterface: 'eth1', description: '', mtu: 1500, subnet: '', ipAddress: '', netmask: '' });

  const [addBridgeOpen, setAddBridgeOpen] = useState(false);
  const [newBridge, setNewBridge] = useState({ name: '', members: [] as string[], stp: false, forwardDelay: 15, ipAddress: '', netmask: '' });

  const [addBondOpen, setAddBondOpen] = useState(false);
  const [newBond, setNewBond] = useState({ name: '', mode: 'active-backup', members: [] as string[], miimon: 100, lacpRate: 'slow', primary: '', ipAddress: '', netmask: '' });

  const [interfaceAliases, setInterfaceAliases] = useState<{ipAddress: string; netmask: string; description: string}[]>([]);
  const [newAlias, setNewAlias] = useState({ ipAddress: '', netmask: '255.255.255.0', description: '' });

  const [routes, setRoutes] = useState<RouteEntry[]>([]);
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [addRouteOpen, setAddRouteOpen] = useState(false);
  const [newRoute, setNewRoute] = useState({ name: '', destination: '0.0.0.0/0', gateway: '', metric: 100, interfaceName: '', isDefault: false, description: '' });

  const [multiWanConfig, setMultiWanConfig] = useState<MultiWanConfigEntry | null>(null);
  const [loadingMultiWan, setLoadingMultiWan] = useState(false);

  const [newPortForward, setNewPortForward] = useState({ name: '', protocol: 'TCP', extPort: '', internalIp: '', internalPort: '', iface: 'eth0' });
  const [editPortForwardData, setEditPortForwardData] = useState({ name: '', protocol: 'TCP', extPort: '', internalIp: '', internalPort: '', iface: '' });

  const [loadingBridges, setLoadingBridges] = useState(false);
  const [loadingBonds, setLoadingBonds] = useState(false);

  const [editFilterDomains, setEditFilterDomains] = useState('');

  const [newFilter, setNewFilter] = useState({ name: '', category: 'custom', enabled: true });
  const [newSchedule, setNewSchedule] = useState({ name: '', days: [true, true, true, true, true, false, false] as boolean[], startTime: '06:00', endTime: '22:00', applyTo: 'Guest VLAN', action: 'Allow', enabled: true });

  // ── API data fetchers ──

  const fetchInterfaces = useCallback(async () => {
    setLoadingInterfaces(true);
    try {
      // New Rocky 10 nmcli scan architecture: scan .nmconnection files via single endpoint
      const osRes = await fetch('/api/network/os?section=all');
      const osResult = await osRes.json();
      if (osResult.success && osResult.data?.interfaces && Array.isArray(osResult.data.interfaces) && osResult.data.interfaces.length > 0) {
        // Filter out virtual/system interfaces
        const excludedPrefixes = ['lo', 'dummy', 'ifb', 'imq', 'sit', 'tun', 'tap', 'veth', 'virbr', 'nlmon', 'erspan', 'gre', 'gretap', 'ip6gre', 'ip6tnl', 'ipip', 'teql', 'bonding_masters'];
        const filteredOS = osResult.data.interfaces.filter((iface: any) => {
          const name = iface.deviceName || iface.name;
          return !excludedPrefixes.some(p => name === p || name.startsWith(p));
        });

        // Fetch DB-stored interface descriptions to override OS driver names
        let dbDescriptions: Record<string, string> = {};
        try {
          const dbRes = await fetch(`/api/wifi/network/interfaces?${propertyId ? 'propertyId=' + propertyId : ''}`);
          const dbResult = await dbRes.json();
          if (dbResult.success && Array.isArray(dbResult.data)) {
            for (const row of dbResult.data) {
              if (row.name && row.description) {
                dbDescriptions[row.name as string] = row.description as string;
              }
            }
          }
        } catch { /* ignore DB fetch errors */ }

        // CIDR to netmask conversion helper
        const cidrToNetmask = (cidr: number): string => {
          if (isNaN(cidr) || cidr < 0 || cidr > 32) return '—';
          const mask = cidr === 0 ? 0 : (~0 << (32 - cidr)) >>> 0;
          return `${(mask >>> 24) & 255}.${(mask >>> 16) & 255}.${(mask >>> 8) & 255}.${mask & 255}`;
        };

        const mapped: NetworkInterface[] = filteredOS.map((iface: any) => {
          const typeMap: Record<string, NetworkInterface['type']> = {
            '802-3-ethernet': 'ethernet', ethernet: 'ethernet', wifi: 'wireless', loopback: 'ethernet',
            bridge: 'bridge', bond: 'bond', vlan: 'vlan',
            virtual: 'ethernet', tunnel: 'ethernet', unknown: 'ethernet',
          };
          return {
            id: iface.name || iface.deviceName,
            name: iface.deviceName || iface.name,
            type: typeMap[iface.type] || 'ethernet',
            status: iface.state === 'up' ? 'up' : 'down',
            ipAddress: iface.ipv4Address || '—',
            subnet: cidrToNetmask(iface.ipv4Cidr || 0),
            mac: '—',
            speed: '—',
            mtu: iface.mtu || 1500,
            rxBytes: 0,
            txBytes: 0,
            description: dbDescriptions[iface.deviceName] || dbDescriptions[iface.name] || '',
            allIps: [
              ...(iface.ipv4Address && iface.ipv4Address !== '—' ? [iface.ipv4Address] : []),
              ...(iface.secondaryIps || []),
            ],
            nettype: iface.nettype,
            nettypeLabel: iface.nettypeLabel,
            isPhysical: iface.isPhysical,
            secondaryIps: iface.secondaryIps || [],
            ipv4Gateway: iface.ipv4Gateway,
            ipv4Cidr: iface.ipv4Cidr,
            _osData: iface,
          };
        });
        setInterfaces(mapped);
        setOsDataLoaded(true);

        // Derive bridges from scan data
        if (osResult.data.bridges?.length > 0) {
          setBridges(osResult.data.bridges.map((b: any) => ({
            id: b.name, name: b.name, members: [], stp: b.bridgeStp || false,
            forwardDelay: b.bridgeForwardDelay || 15, enabled: b.state === 'up',
          })));
        }

        // Derive bonds from scan data
        if (osResult.data.bonds?.length > 0) {
          setBonds(osResult.data.bonds.map((b: any) => ({
            id: b.name, name: b.name, mode: b.bondMode || 'active-backup',
            members: [], miimon: b.bondMiimon || 100, lacpRate: b.bondLacpRate || 'slow', primary: '',
          })));
        }

        // Derive VLANs from scan data
        if (osResult.data.vlans?.length > 0) {
          setVlans(osResult.data.vlans.map((v: any) => ({
            id: v.name, vlanId: v.vlanId || 0, subInterface: v.name,
            parent: v.vlanParent || '', description: v.ipv4Address || '',
            mtu: v.mtu || 1500, enabled: v.state === 'up',
            dhcpSubnet: v.ipv4Address ? `${v.ipv4Address}/${v.ipv4Cidr || 24}` : '',
          })));
        }

        // Derive roles from nettype
        const nettypeToRoleMap: Record<number, string> = { 1: 'wan', 0: 'lan', 5: 'management', 6: 'wifi', 3: 'lan', 7: 'lan' };
        const osRoles: InterfaceRole[] = osResult.data.interfaces
          .filter((i: any) => i.nettype && i.nettype !== 8)
          .map((i: any) => ({
            interfaceId: i.name,
            interfaceName: i.deviceName || i.name,
            role: (nettypeToRoleMap[i.nettype] || 'unused') as InterfaceRole['role'],
            priority: i.priority || 0,
          }));
        if (osRoles.length > 0) setRoles(osRoles);
      } else {
        // Fallback to DB API
        const params = new URLSearchParams();
        if (propertyId) params.set('propertyId', propertyId);
        const res = await fetch(`/api/wifi/network/interfaces?${params.toString()}`);
        const result = await res.json();
        if (result.success && Array.isArray(result.data)) {
          const mapped: NetworkInterface[] = result.data.map((row: Record<string, unknown>) => ({
            id: row.id as string,
            name: row.name as string,
            type: (row.type as NetworkInterface['type']) || 'ethernet',
            status: (row.status as NetworkInterface['status']) || 'down',
            ipAddress: (row as Record<string, unknown>).ipAddress as string || '—',
            subnet: (row as Record<string, unknown>).subnet as string || '—',
            mac: (row.hwAddress as string) || '—',
            speed: (row.speed as string) || '—',
            mtu: (row.mtu as number) || 1500,
            rxBytes: (row.rxBytes as number) || 0,
            txBytes: (row.txBytes as number) || 0,
            description: (row.description as string) || '',
          }));
          setInterfaces(mapped);
        } else {
          setInterfaces(fallbackInterfaces);
        }
      }
    } catch {
      setInterfaces(fallbackInterfaces);
    } finally {
      setLoadingInterfaces(false);
    }
  }, [propertyId]);

  const fetchVlans = useCallback(async () => {
    setLoadingVlans(true);
    try {
      const params = new URLSearchParams();
      if (propertyId) params.set('propertyId', propertyId);
      const res = await fetch(`/api/wifi/network/vlans?${params.toString()}`);
      const result = await res.json();
      if (result.success && Array.isArray(result.data)) {
        const mapped: VLANEntry[] = result.data.map((row: Record<string, unknown>) => {
          const parentIface = row.parentInterface as Record<string, unknown> | null;
          const dhcpSubnets = row.dhcpSubnets as Array<Record<string, unknown>> | undefined;
          return {
            id: row.id as string,
            vlanId: row.vlanId as number,
            subInterface: row.subInterface as string,
            parent: (parentIface?.name as string) || (row.parentInterfaceId as string) || '—',
            description: (row.description as string) || '',
            mtu: (row.mtu as number) || 1500,
            enabled: (row.enabled as boolean) ?? true,
            dhcpSubnet: (dhcpSubnets?.[0]?.network as string) || `192.168.${row.vlanId}.0/24`,
          };
        });
        setVlans(mapped);
      } else {
        setVlans(fallbackVLANs);
      }
    } catch {
      setVlans(fallbackVLANs);
      toast({ title: 'Error', description: 'Failed to load VLANs', variant: 'destructive' });
    } finally {
      setLoadingVlans(false);
    }
  }, [propertyId, toast]);

  const fetchBackups = useCallback(async () => {
    setLoadingBackups(true);
    try {
      const params = new URLSearchParams();
      if (propertyId) params.set('propertyId', propertyId);
      const res = await fetch(`/api/wifi/network/backups?${params.toString()}`);
      const result = await res.json();
      if (result.success && Array.isArray(result.data)) {
        const mapped: BackupSnapshot[] = result.data.map((row: Record<string, unknown>) => ({
          id: row.id as string,
          name: row.name as string,
          date: row.createdAt ? new Date(row.createdAt as string).toLocaleString('sv-SE', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).replace('T', ' ') : '—',
          version: String(row.version || '1'),
          type: (row.autoBackup ? 'auto' : 'manual') as BackupSnapshot['type'],
          size: '—',
        }));
        setBackups(mapped);
      } else {
        setBackups(fallbackBackups);
      }
    } catch {
      setBackups(fallbackBackups);
      toast({ title: 'Error', description: 'Failed to load backups', variant: 'destructive' });
    } finally {
      setLoadingBackups(false);
    }
  }, [propertyId, toast]);

  const fetchFilters = useCallback(async () => {
    setLoadingFilters(true);
    try {
      const params = new URLSearchParams();
      if (propertyId) params.set('propertyId', propertyId);
      const res = await fetch(`/api/wifi/firewall/content-filter?${params.toString()}`);
      const result = await res.json();
      if (result.success && Array.isArray(result.data)) {
        const categoryIcons: Record<string, string> = {
          social_media: 'Globe', streaming: 'Monitor', adult: 'Shield',
          gaming: 'Radio', malware: 'AlertCircle', ads: 'Shield', custom: 'Edit2'
        };
        const categoryNames: Record<string, string> = {
          social_media: 'Social Media', streaming: 'Streaming', adult: 'Adult Content',
          gaming: 'Gaming', malware: 'Malware', ads: 'Ads & Trackers', custom: 'Custom'
        };
        const mapped: FilterCategory[] = result.data.map((row: Record<string, unknown>) => {
          const cat = (row.category as string) || 'custom';
          let domains: string[] = [];
          try { domains = JSON.parse((row.domains as string) || '[]'); } catch { domains = []; }
          return {
            id: row.id as string,
            name: (row.name as string) || categoryNames[cat] || cat,
            icon: categoryIcons[cat] || 'Shield',
            domainCount: domains.length,
            enabled: (row.enabled as boolean) ?? true,
            domains,
          };
        });
        setFilterCategories(mapped.length > 0 ? mapped : mockFilterCategories);
      } else {
        setFilterCategories(mockFilterCategories);
      }
    } catch {
      setFilterCategories(mockFilterCategories);
      toast({ title: 'Error', description: 'Failed to load content filters', variant: 'destructive' });
    } finally {
      setLoadingFilters(false);
    }
  }, [propertyId, toast]);

  const fetchSchedules = useCallback(async () => {
    setLoadingSchedules(true);
    try {
      const params = new URLSearchParams();
      if (propertyId) params.set('propertyId', propertyId);
      const res = await fetch(`/api/wifi/firewall/schedules?${params.toString()}`);
      const result = await res.json();
      if (result.success && Array.isArray(result.data)) {
        const mapped: Schedule[] = result.data.map((row: Record<string, unknown>) => {
          let days: boolean[] = [true, true, true, true, true, false, false];
          try { days = JSON.parse((row.days as string) || JSON.stringify(days)); } catch { /* keep default */ }
          return {
            id: row.id as string,
            name: (row.name as string) || 'Untitled Schedule',
            days,
            startTime: (row.startTime as string) || '00:00',
            endTime: (row.endTime as string) || '23:59',
            applyTo: (row.applyTo as string) || 'Guest VLAN',
            action: (row.action as string) || 'Allow',
            enabled: (row.enabled as boolean) ?? true,
          };
        });
        setSchedules(mapped.length > 0 ? mapped : mockSchedules);
      } else {
        setSchedules(mockSchedules);
      }
    } catch {
      setSchedules(mockSchedules);
      toast({ title: 'Error', description: 'Failed to load schedules', variant: 'destructive' });
    } finally {
      setLoadingSchedules(false);
    }
  }, [propertyId, toast]);

  useEffect(() => {
    fetchInterfaces();
  }, [fetchInterfaces]);

  useEffect(() => {
    fetchVlans();
  }, [fetchVlans]);

  useEffect(() => {
    fetchFilters();
  }, [fetchFilters]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  useEffect(() => {
    fetchBackups();
  }, [fetchBackups]);

  // Fetch real OS system info and port forwards
  useEffect(() => {
    const fetchOsData = async () => {
      try {
        const [sysRes, fwdRes] = await Promise.allSettled([
          fetch('/api/network/os?section=system-info'),
          fetch('/api/network/os/nat/forwards'),
        ]);
        if (sysRes.status === 'fulfilled') {
          const sysData = await sysRes.value.json();
          if (sysData.success) setOsSystemInfo(sysData.data);
        }
        if (fwdRes.status === 'fulfilled') {
          const fwdData = await fwdRes.value.json();
          if (fwdData.success && Array.isArray(fwdData.data) && fwdData.data.length > 0) {
            setPortForwards(fwdData.data.map((r: any, i: number) => ({
              id: String(i),
              name: `${r.parsed?.protocol || 'TCP'}:${r.parsed?.destination || ''}`,
              protocol: (r.parsed?.protocol || 'TCP') as PortForwardRule['protocol'],
              extPort: r.parsed?.destination?.split(':')?.[1] || '',
              internalIp: r.parsed?.toDestination?.split(':')?.[0] || '',
              internalPort: r.parsed?.toDestination?.split(':')?.[1] || '',
              iface: r.parsed?.interface || 'eth0',
              enabled: true,
            })));
          }
        }
      } catch {}
    };
    fetchOsData();
    const interval = setInterval(fetchOsData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Fetch routes
  const fetchRoutes = useCallback(async () => {
    setLoadingRoutes(true);
    try {
      const osRes = await fetch('/api/network/os?section=routes');
      const osResult = await osRes.json();
      const dbRes = await fetch(`/api/wifi/network/routes?${propertyId ? 'propertyId=' + propertyId : ''}`);
      const dbResult = await dbRes.json();
      const dbRoutes: RouteEntry[] = (dbResult.success && Array.isArray(dbResult.data) ? dbResult.data : []).map((r: any) => ({
        id: r.id, name: r.name, destination: r.destination, gateway: r.gateway,
        metric: r.metric, interfaceName: r.interfaceName || '', protocol: r.protocol || 'static',
        isDefault: r.isDefault, enabled: r.enabled, description: r.description || '',
      }));
      if (osResult.success && Array.isArray(osResult.data)) {
        const osRoutes: RouteEntry[] = osResult.data.map((r: any, i: number) => ({
          id: `os-${i}`, name: r.isDefault ? 'Default (OS)' : `Route ${i}`, destination: r.destination,
          gateway: r.gateway, metric: r.metric || 0, interfaceName: r.interface || '',
          protocol: r.protocol || 'kernel', isDefault: r.isDefault, enabled: true,
          description: r.isDefault ? 'Default route from OS' : '',
        }));
        // Merge: DB routes override OS for same dest+gw
        const merged = [...osRoutes];
        for (const db of dbRoutes) {
          const exists = merged.find(m => m.destination === db.destination && m.gateway === db.gateway);
          if (!exists) merged.push(db);
        }
        setRoutes(merged);
      } else {
        setRoutes(dbRoutes.length > 0 ? dbRoutes : []);
      }
    } catch { setRoutes([]); } finally { setLoadingRoutes(false); }
  }, [propertyId]);

  // Fetch multi-WAN config
  const fetchMultiWan = useCallback(async () => {
    setLoadingMultiWan(true);
    try {
      const res = await fetch(`/api/wifi/network/multiwan?${propertyId ? 'propertyId=' + propertyId : ''}`);
      const result = await res.json();
      if (result.success && result.data) {
        setMultiWanConfig({
          id: result.data.id, enabled: result.data.enabled,
          mode: result.data.mode || 'weighted',
          healthCheckUrl: result.data.healthCheckUrl || 'https://1.1.1.1',
          healthCheckInterval: result.data.healthCheckInterval || 10,
          healthCheckTimeout: result.data.healthCheckTimeout || 3,
          failoverThreshold: result.data.failoverThreshold || 3,
          autoSwitchback: result.data.autoSwitchback ?? true,
          switchbackDelay: result.data.switchbackDelay || 300,
          flushConnectionsOnFailover: result.data.flushConnectionsOnFailover ?? true,
          wanMembers: (result.data.wanMembers || []).map((m: any) => ({
            id: m.id, interfaceName: m.interfaceName, weight: m.weight || 1,
            gateway: m.gateway || '', healthStatus: m.healthStatus || 'unknown',
            enabled: m.enabled ?? true, isPrimary: m.isPrimary ?? false,
          })),
        });
      }
    } catch {} finally { setLoadingMultiWan(false); }
  }, [propertyId]);

  useEffect(() => { fetchRoutes(); }, [fetchRoutes]);
  useEffect(() => { fetchMultiWan(); }, [fetchMultiWan]);

  // ── Interface handlers ──
  const handleAddInterface = async () => {
    if (!newInterface.name.trim()) return;
    try {
      const res = await fetch('/api/wifi/network/interfaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          name: newInterface.name,
          type: newInterface.type,
          mtu: newInterface.mtu,
          description: newInterface.description,
          status: 'down',
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Interface Created', description: `${newInterface.name} has been added.` });
        setAddInterfaceOpen(false);
        setNewInterface({ name: '', type: 'ethernet', mtu: 1500, description: '' });
        fetchInterfaces();
      } else {
        toast({ title: 'Error', description: result.error?.message || 'Failed to create interface', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to create interface', variant: 'destructive' });
    }
  };

  const handleOpenEditInterface = (iface: NetworkInterface) => {
    setSelectedInterface(iface);
    setInterfaceAliases([]);
    const matchedRole = roles.find(r => r.interfaceName === iface.name);
    // Map nettype back to role label for the dropdown
    const nettypeToRole: Record<number, string> = { 1: 'wan', 0: 'lan', 2: 'vlan', 3: 'bridge', 4: 'bond', 5: 'management', 6: 'guest', 7: 'iot', 8: 'unused' };
    const roleFromNettype = iface.nettype !== undefined && iface.nettype >= 0 ? nettypeToRole[iface.nettype] || 'unused' : undefined;
    setEditInterfaceData({
      name: iface.name, mtu: iface.mtu, description: iface.description,
      mode: iface.ipAddress === '—' ? 'dhcp' : 'static',
      ipAddress: iface.ipAddress === '—' ? '' : iface.ipAddress,
      netmask: iface.subnet === '—' ? '' : iface.subnet,
      gateway: iface.ipv4Gateway || '',
      role: roleFromNettype || matchedRole?.role || 'unused',
      priority: (iface._osData?.priority as number) || matchedRole?.priority || 0
    });
    handleFetchAliases(iface.name);
    setEditInterfaceOpen(true);
  };

  const handleSaveEditInterface = async () => {
    if (!selectedInterface) return;
    try {
      const matchedRole = roles.find(r => r.interfaceName === selectedInterface.name);
      const errors: string[] = [];

      // If using OS data, apply changes via OS APIs
      if (osDataLoaded) {
        // 1. Apply MTU if changed
        if (editInterfaceData.mtu !== selectedInterface.mtu) {
          try {
            const mtuRes = await fetch(`/api/network/os/interfaces/${selectedInterface.name}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ mtu: editInterfaceData.mtu }),
            });
            const mtuResult = await mtuRes.json();
            if (mtuResult.success) {
              toast({ title: 'MTU Updated', description: `MTU for ${selectedInterface.name} set to ${editInterfaceData.mtu}` });
            } else {
              errors.push(`MTU: ${mtuResult.error?.message || 'failed'}`);
            }
          } catch (e: any) {
            errors.push(`MTU: ${e.message}`);
          }
        }

        // 2. Apply IP config — detect mode from _osData if available
        const currentMode = (selectedInterface as any)._osData
          ? (editInterfaceData.mode === 'dhcp' ? 'dhcp' : 'static')
          : (selectedInterface.ipAddress === '—' ? 'dhcp' : 'static');
        const ipChanged = editInterfaceData.mode !== currentMode ||
          editInterfaceData.ipAddress !== selectedInterface.ipAddress ||
          editInterfaceData.netmask !== selectedInterface.subnet ||
          editInterfaceData.gateway !== '';

        // Also always apply when switching between dhcp/static
        if (ipChanged || editInterfaceData.mode !== currentMode) {
          try {
            const ipRes = await fetch(`/api/network/os/interfaces/${selectedInterface.name}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                mode: editInterfaceData.mode,
                ...(editInterfaceData.mode === 'static' ? {
                  ipAddress: editInterfaceData.ipAddress,
                  netmask: editInterfaceData.netmask,
                  gateway: editInterfaceData.gateway,
                } : {}),
              }),
            });
            const ipResult = await ipRes.json();
            if (ipResult.success) {
              toast({ title: 'IP Config Updated', description: `${selectedInterface.name} set to ${editInterfaceData.mode.toUpperCase()}` });
            } else {
              errors.push(`IP Config: ${ipResult.error?.message || 'failed'}`);
            }
          } catch (e: any) {
            errors.push(`IP Config: ${e.message}`);
          }
        }

        // 3. Apply role/nettype change (Rocky 10: uses nettype in .nmconnection)
        const nettypeMap: Record<string, number> = { wan: 1, lan: 0, dmz: 7, management: 5, wifi: 6, guest: 6, iot: 7, unused: 8 };
        const currentNettype = selectedInterface.nettype ?? (matchedRole ? nettypeMap[matchedRole.role] ?? 8 : 8);
        const newNettype = nettypeMap[editInterfaceData.role] ?? 8;
        if (newNettype !== currentNettype || editInterfaceData.priority !== (selectedInterface._osData?.priority || 0)) {
          try {
            const roleRes = await fetch(`/api/network/os/interfaces/${selectedInterface.name}/role`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ nettype: newNettype, priority: editInterfaceData.priority }),
            });
            const roleResult = await roleRes.json();
            if (roleResult.success) {
              toast({ title: 'Role Updated', description: `${selectedInterface.name} set to ${editInterfaceData.role.toUpperCase()} (nettype=${newNettype})` });
            } else if (roleResult.warning) {
              toast({ title: 'Role Updated (partial)', description: roleResult.warning, variant: 'default' });
            } else {
              errors.push(`Role: ${roleResult.error?.message || 'failed'}`);
            }
          } catch (e: any) {
            errors.push(`Role: ${e.message}`);
          }
        }

        // 4. Save description to DB
        if (editInterfaceData.description !== selectedInterface.description) {
          try {
            await fetch(`/api/network/os/interfaces/${selectedInterface.name}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ description: editInterfaceData.description }),
            });
          } catch (e: any) {
            errors.push(`Description: ${e.message}`);
          }
        }

        if (errors.length > 0) {
          toast({ title: 'Partial Update', description: `Some changes failed: ${errors.join('; ')}`, variant: 'destructive' });
        } else {
          toast({ title: 'Interface Updated', description: `${editInterfaceData.name} configuration saved.` });
        }
        setEditInterfaceOpen(false);
        fetchInterfaces();
        return;
      }

      // Fallback: save to DB for metadata (only when NOT using OS data)
      const res = await fetch(`/api/wifi/network/interfaces/${selectedInterface.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editInterfaceData.name,
          mtu: editInterfaceData.mtu,
          description: editInterfaceData.description,
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Interface Updated', description: `${editInterfaceData.name} has been saved.` });
        setEditInterfaceOpen(false);
        fetchInterfaces();
      } else {
        toast({ title: 'Error', description: result.error?.message || 'Failed to update interface', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to update interface', variant: 'destructive' });
    }
  };

  const handleToggleInterfaceState = async (iface: NetworkInterface) => {
    const newState = iface.status === 'up' ? 'down' : 'up';
    try {
      if (osDataLoaded) {
        const res = await fetch(`/api/network/os/interfaces/${iface.name}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: newState }),
        });
        const result = await res.json();
        if (result.success) {
          toast({ title: 'Interface State Changed', description: `${iface.name} is now ${newState}` });
          setTimeout(fetchInterfaces, 1000);
        } else {
          toast({ title: 'Error', description: result.output || `Failed to bring ${iface.name} ${newState}`, variant: 'destructive' });
        }
      } else {
        toast({ title: 'OS API Required', description: 'Interface state changes require OS-level access', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to change interface state', variant: 'destructive' });
    }
  };

  // ── VLAN handlers ──
  const handleToggleVlan = async (id: string) => {
    const current = vlans.find(v => v.id === id);
    if (!current) return;
    try {
      const res = await fetch(`/api/wifi/network/vlans/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !current.enabled }),
      });
      const result = await res.json();
      if (result.success) {
        setVlans(prev => prev.map(v => v.id === id ? { ...v, enabled: !v.enabled } : v));
      } else {
        toast({ title: 'Error', description: result.error?.message || 'Failed to toggle VLAN', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to toggle VLAN', variant: 'destructive' });
    }
  };

  const handleAddVlan = async () => {
    console.log('[VLAN ADD] newVlan state:', JSON.stringify(newVlan));
    if (!newVlan.vlanId || !newVlan.parentInterface) {
      toast({ title: 'Missing Fields', description: 'VLAN ID and Parent Interface are required.', variant: 'destructive' });
      return;
    }
    if (!newVlan.description.trim()) {
      toast({ title: 'Missing Description', description: 'Please enter a description for this VLAN.', variant: 'destructive' });
      return;
    }
    console.log('[VLAN ADD] Validation passed, calling APIs...');
    try {
      // Create VLAN via OS API first (L3: interface + IP in one step)
      if (osDataLoaded) {
        const osBody: Record<string, unknown> = {
          parentInterface: newVlan.parentInterface,
          vlanId: parseInt(newVlan.vlanId),
          mtu: newVlan.mtu,
        };
        // Pass IP directly for L3 VLAN creation (single step)
        if (newVlan.ipAddress && newVlan.netmask) {
          osBody.ipAddress = newVlan.ipAddress;
          osBody.netmask = newVlan.netmask;
        }
        // Pass nettype for Rocky 10 .nmconnection [staysuite] section
        osBody.nettype = 2; // VLAN
        const osRes = await fetch('/api/network/os/vlans', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(osBody),
        });
        const osResult = await osRes.json();
        if (osResult.success) {
          toast({ title: 'VLAN Created on OS', description: osResult.message });
        } else {
          toast({ title: 'OS VLAN Error', description: osResult.error?.message || osResult.output || 'Failed to create VLAN on OS', variant: 'destructive' });
        }
      }
      // Also save to DB
      const subIfaceName = `${newVlan.parentInterface}.${newVlan.vlanId}`;
      const parentIface = interfaces.find(i => i.name === newVlan.parentInterface);
      const res = await fetch('/api/wifi/network/vlans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          parentInterfaceId: parentIface?.id || '',
          vlanId: parseInt(newVlan.vlanId),
          subInterface: subIfaceName,
          description: newVlan.description,
          mtu: newVlan.mtu,
          enabled: true,
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'VLAN Created', description: `VLAN ${newVlan.vlanId} has been added.${newVlan.ipAddress ? ` IP ${newVlan.ipAddress}/${newVlan.netmask || '24'} assigned.` : ''}` });
        setAddVlanOpen(false);
        setNewVlan({ vlanId: '', parentInterface: 'eth1', description: '', mtu: 1500, subnet: '', ipAddress: '', netmask: '' });
        fetchVlans();
      } else {
        toast({ title: 'Error', description: result.error?.message || 'Failed to create VLAN', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to create VLAN', variant: 'destructive' });
    }
  };

  const handleDeleteVlan = async (id: string) => {
    try {
      const res = await fetch(`/api/wifi/network/vlans/${id}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'VLAN Deleted', description: 'The VLAN has been removed.' });
        setVlans(prev => prev.filter(v => v.id !== id));
      } else {
        toast({ title: 'Error', description: result.error?.message || 'Failed to delete VLAN', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to delete VLAN', variant: 'destructive' });
    }
  };

  // ── Bridge/Bond handlers ──
  const handleToggleBridge = async (bridgeName: string, currentState: boolean) => {
    try {
      if (osDataLoaded) {
        await fetch(`/api/network/os/interfaces/${bridgeName}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: currentState ? 'down' : 'up' }),
        });
      }
      setBridges(prev => prev.map(b => b.name === bridgeName ? { ...b, enabled: !currentState } : b));
    } catch {
      toast({ title: 'Error', description: 'Failed to toggle bridge state', variant: 'destructive' });
    }
  };

  const handleCreateBridge = async () => {
    if (!newBridge.name.trim() || newBridge.members.length === 0) {
      toast({ title: 'Error', description: 'Bridge name and at least one member are required', variant: 'destructive' });
      return;
    }
    try {
      const res = await fetch('/api/network/os/bridges', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newBridge, nettype: 3 }), // nettype=3 = Bridge
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Bridge Created', description: `${newBridge.name} has been created with ${newBridge.members.length} member(s).` });
        setAddBridgeOpen(false);
        setNewBridge({ name: '', members: [], stp: false, forwardDelay: 15, ipAddress: '', netmask: '' });
        fetchInterfaces();
      } else {
        toast({ title: 'Error', description: result.error?.message || 'Failed to create bridge', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to create bridge', variant: 'destructive' });
    }
  };

  const handleDeleteBridge = async (name: string) => {
    try {
      const res = await fetch(`/api/network/os/bridges?name=${encodeURIComponent(name)}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Bridge Deleted', description: `${name} has been removed.` });
        setBridges(prev => prev.filter(b => b.name !== name));
        fetchInterfaces();
      } else {
        toast({ title: 'Error', description: result.error?.message || 'Failed to delete bridge', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to delete bridge', variant: 'destructive' });
    }
  };

  const handleCreateBond = async () => {
    if (!newBond.name.trim() || newBond.members.length === 0) {
      toast({ title: 'Error', description: 'Bond name and at least one member are required', variant: 'destructive' });
      return;
    }
    try {
      const res = await fetch('/api/network/os/bonds', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newBond, nettype: 4 }), // nettype=4 = Bond
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Bond Created', description: `${newBond.name} created in ${newBond.mode} mode.` });
        setAddBondOpen(false);
        setNewBond({ name: '', mode: 'active-backup', members: [], miimon: 100, lacpRate: 'slow', primary: '', ipAddress: '', netmask: '' });
        fetchInterfaces();
      } else {
        toast({ title: 'Error', description: result.error?.message || 'Failed to create bond', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to create bond', variant: 'destructive' });
    }
  };

  const handleDeleteBond = async (name: string) => {
    try {
      const res = await fetch(`/api/network/os/bonds?name=${encodeURIComponent(name)}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Bond Deleted', description: `${name} has been removed.` });
        setBonds(prev => prev.filter(b => b.name !== name));
        fetchInterfaces();
      } else {
        toast({ title: 'Error', description: result.error?.message || 'Failed to delete bond', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to delete bond', variant: 'destructive' });
    }
  };

  // ── Alias handlers ──
  const handleFetchAliases = async (ifaceName: string) => {
    try {
      const osRes = await fetch(`/api/network/os/interfaces/${ifaceName}/aliases`);
      const osResult = await osRes.json();
      if (osResult.success && osResult.data) {
        // New format: { data: { interfaceName, osAliases, dbAliases } }
        const aliases = osResult.data.osAliases || [];
        if (aliases.length > 0) {
          setInterfaceAliases(aliases.map((a: any) => ({ ipAddress: a.ip, netmask: a.netmask, description: '' })));
        } else {
          // Fallback: derive from _osData
          const iface = interfaces.find(i => i.name === ifaceName);
          if (iface?._osData?.ipv4Addresses?.length > 1) {
            const extra = iface._osData.ipv4Addresses.slice(1).map((addr: string) => {
              const [ip, cidr] = addr.split('/');
              const prefix = parseInt(cidr || '24', 10);
              const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
              return { ipAddress: ip, netmask: `${(mask >>> 24) & 255}.${(mask >>> 16) & 255}.${(mask >>> 8) & 255}.${mask & 255}`, description: '' };
            });
            setInterfaceAliases(extra);
          } else {
            setInterfaceAliases([]);
          }
        }
      } else {
        setInterfaceAliases([]);
      }
    } catch { setInterfaceAliases([]); }
  };

  const handleAddAlias = async (ifaceName: string) => {
    if (!newAlias.ipAddress.trim()) return;
    try {
      const res = await fetch(`/api/network/os/interfaces/${ifaceName}/aliases`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAlias),
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Alias Added', description: `${newAlias.ipAddress} added to ${ifaceName}` });
        setNewAlias({ ipAddress: '', netmask: '255.255.255.0', description: '' });
        handleFetchAliases(ifaceName);
      } else {
        toast({ title: 'Error', description: result.error?.message || 'Failed to add alias', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to add alias', variant: 'destructive' });
    }
  };

  const handleDeleteAlias = async (ifaceName: string, ip: string) => {
    try {
      await fetch(`/api/network/os/interfaces/${ifaceName}/aliases?ip=${encodeURIComponent(ip)}`, { method: 'DELETE' });
      toast({ title: 'Alias Removed', description: `${ip} removed from ${ifaceName}` });
      handleFetchAliases(ifaceName);
    } catch {
      toast({ title: 'Error', description: 'Failed to remove alias', variant: 'destructive' });
    }
  };

  // ── Route handlers ──
  const handleAddRoute = async () => {
    if (!newRoute.gateway.trim() || !newRoute.interfaceName) {
      toast({ title: 'Error', description: 'Gateway and interface are required', variant: 'destructive' });
      return;
    }
    try {
      const res = await fetch('/api/network/os/routes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRoute),
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Route Added', description: `Route via ${newRoute.gateway} has been added.` });
        setAddRouteOpen(false);
        setNewRoute({ name: '', destination: '0.0.0.0/0', gateway: '', metric: 100, interfaceName: '', isDefault: false, description: '' });
        fetchRoutes();
      } else {
        toast({ title: 'Error', description: result.error?.message || 'Failed to add route', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to add route', variant: 'destructive' });
    }
  };

  const handleDeleteRoute = async (destination: string, gateway: string) => {
    try {
      await fetch(`/api/network/os/routes?destination=${encodeURIComponent(destination)}&gateway=${encodeURIComponent(gateway)}`, { method: 'DELETE' });
      toast({ title: 'Route Removed', description: 'Route has been deleted.' });
      fetchRoutes();
    } catch {
      toast({ title: 'Error', description: 'Failed to remove route', variant: 'destructive' });
    }
  };

  // ── Multi-WAN handlers ──
  const handleApplyMultiWan = async () => {
    if (!multiWanConfig) return;
    try {
      const res = await fetch('/api/network/os/multiwan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(multiWanConfig),
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Multi-WAN Applied', description: result.message || 'Load balancing configuration applied.' });
        fetchMultiWan();
      } else {
        toast({ title: 'Error', description: result.error?.message || 'Failed to apply multi-WAN', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to apply multi-WAN configuration', variant: 'destructive' });
    }
  };

  const handleResetMultiWan = async () => {
    try {
      await fetch('/api/network/os/multiwan', { method: 'DELETE' });
      toast({ title: 'Multi-WAN Reset', description: 'All multi-WAN rules and tables have been removed.' });
      fetchMultiWan();
      fetchRoutes();
    } catch {
      toast({ title: 'Error', description: 'Failed to reset multi-WAN', variant: 'destructive' });
    }
  };

  const handleAddWanMember = () => {
    if (!multiWanConfig) return;
    const wanIfaces = interfaces.filter(i => {
      const r = roles.find(rl => rl.interfaceName === i.name);
      return r?.role === 'wan' && !multiWanConfig.wanMembers.some(m => m.interfaceName === i.name);
    });
    if (wanIfaces.length === 0) {
      toast({ title: 'Info', description: 'No additional WAN interfaces available. Assign WAN role to interfaces first.' });
      return;
    }
    const iface = wanIfaces[0];
    setMultiWanConfig(prev => prev ? {
      ...prev,
      wanMembers: [...prev.wanMembers, {
        id: `new-${Date.now()}`, interfaceName: iface.name, weight: 1,
        gateway: iface.ipAddress !== '—' ? iface.ipAddress : '', healthStatus: 'unknown',
        enabled: true, isPrimary: prev.wanMembers.length === 0,
      }],
    } : prev);
  };

  const handleRemoveWanMember = (interfaceName: string) => {
    if (!multiWanConfig) return;
    setMultiWanConfig(prev => prev ? {
      ...prev,
      wanMembers: prev.wanMembers.filter(m => m.interfaceName !== interfaceName),
    } : prev);
  };

  // ── Backup handlers ──
  const handleCreateBackup = async () => {
    try {
      const configSnapshot = JSON.stringify({ interfaces, vlans, bridges, bonds, roles, portForwards });
      const res = await fetch('/api/wifi/network/backups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          name: `Manual Backup - ${new Date().toLocaleString()}`,
          configData: configSnapshot,
          autoBackup: false,
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Backup Created', description: 'Network configuration has been backed up.' });
        fetchBackups();
      } else {
        toast({ title: 'Error', description: result.error?.message || 'Failed to create backup', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to create backup', variant: 'destructive' });
    }
  };

  const handleRestoreBackup = async (backupId: string) => {
    try {
      const res = await fetch('/api/wifi/network/backups', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupId }),
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Restore Initiated', description: 'Backup data retrieved. Applying configuration...' });
      } else {
        toast({ title: 'Error', description: result.error?.message || 'Failed to restore backup', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to restore backup', variant: 'destructive' });
    }
  };

  // ── Role handlers (persist to OS + DB) ──
  const [roleSaving, setRoleSaving] = useState<string | null>(null);

  const handleRoleChange = async (interfaceId: string, newRole: InterfaceRole['role']) => {
    setRoleSaving(interfaceId);
    // Optimistic update
    setRoles(prev => prev.map(r => r.interfaceId === interfaceId ? { ...r, role: newRole } : r));
    try {
      const currentRole = roles.find(r => r.interfaceId === interfaceId);
      const res = await fetch(`/api/network/os/interfaces/${interfaceId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole, priority: currentRole?.priority || 0 }),
      });
      const result = await res.json();
      if (result.success) {
        const sources = [];
        if (result.data?.persistedToOS) sources.push('OS (/etc/network/interfaces)');
        if (result.data?.persistedToDB) sources.push('Database');
        toast({ title: 'Role Updated', description: `${interfaceId} → ${newRole.toUpperCase()} saved to ${sources.join(' + ')}` });
      } else {
        toast({ title: 'Error', description: result.error?.message || 'Failed to persist role', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to save role', variant: 'destructive' });
    } finally {
      setRoleSaving(null);
    }
  };

  const handleMovePriority = (interfaceId: string, direction: 'up' | 'down') => {
    setRoles(prev => {
      const arr = [...prev].sort((a, b) => a.priority - b.priority);
      const idx = arr.findIndex(r => r.interfaceId === interfaceId);
      if (idx < 0) return prev;
      if (direction === 'up' && idx > 0) {
        [arr[idx - 1].priority, arr[idx].priority] = [arr[idx].priority, arr[idx - 1].priority];
      } else if (direction === 'down' && idx < arr.length - 1) {
        [arr[idx + 1].priority, arr[idx].priority] = [arr[idx].priority, arr[idx + 1].priority];
      }
      return prev.map(r => arr.find(a => a.interfaceId === r.interfaceId) || r);
    });
  };

  const handleSaveAllRoles = async () => {
    try {
      const res = await fetch('/api/network/os/interfaces/roles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roles: roles.map(r => ({
            interfaceName: r.interfaceName,
            role: r.role,
            priority: r.priority,
          })),
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'All Roles Saved', description: `${result.data.total} interface roles persisted to OS + Database` });
      } else {
        toast({ title: 'Error', description: 'Failed to save some roles', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to save roles', variant: 'destructive' });
    }
  };

  // ── Port Forward handlers ──
  const handleTogglePortForward = (id: string) => {
    setPortForwards(prev => prev.map(p => p.id === id ? { ...p, enabled: !p.enabled } : p));
  };

  const handleAddPortForward = () => {
    const pf: PortForwardRule = {
      id: `pf-${Date.now()}`,
      name: newPortForward.name,
      protocol: newPortForward.protocol as PortForwardRule['protocol'],
      extPort: newPortForward.extPort,
      internalIp: newPortForward.internalIp,
      internalPort: newPortForward.internalPort,
      iface: newPortForward.iface,
      enabled: true,
    };
    setPortForwards(prev => [...prev, pf]);
    setAddPortForwardOpen(false);
    setNewPortForward({ name: '', protocol: 'TCP', extPort: '', internalIp: '', internalPort: '', iface: 'eth0' });
  };

  const handleOpenEditPortForward = (pf: PortForwardRule) => {
    setSelectedPortForward(pf);
    setEditPortForwardData({ name: pf.name, protocol: pf.protocol, extPort: pf.extPort, internalIp: pf.internalIp, internalPort: pf.internalPort, iface: pf.iface });
    setEditPortForwardOpen(true);
  };

  const handleSaveEditPortForward = () => {
    if (!selectedPortForward) return;
    setPortForwards(prev => prev.map(p => p.id === selectedPortForward.id ? { ...p, ...editPortForwardData } : p));
    setEditPortForwardOpen(false);
  };

  const handleDeletePortForward = (id: string) => {
    setPortForwards(prev => prev.filter(p => p.id !== id));
  };

  const handleBulkTogglePortForwards = (enabled: boolean) => {
    setPortForwards(prev => prev.map(p => ({ ...p, enabled })));
  };

  // ── Filter handlers ──
  const handleToggleFilter = async (id: string) => {
    const filter = filterCategories.find(f => f.id === id);
    if (!filter) return;
    setFilterCategories(prev => prev.map(f => f.id === id ? { ...f, enabled: !f.enabled } : f));
    try {
      const res = await fetch(`/api/wifi/firewall/content-filter/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !filter.enabled }),
      });
      const result = await res.json();
      if (!result.success) {
        setFilterCategories(prev => prev.map(f => f.id === id ? { ...f, enabled: filter.enabled } : f));
        toast({ title: 'Error', description: result.error?.message || 'Failed to update filter', variant: 'destructive' });
      } else {
        toast({ title: 'Updated', description: `${filter.name} ${!filter.enabled ? 'enabled' : 'disabled'}` });
      }
    } catch {
      setFilterCategories(prev => prev.map(f => f.id === id ? { ...f, enabled: filter.enabled } : f));
      toast({ title: 'Error', description: 'Failed to update filter', variant: 'destructive' });
    }
  };

  const handleOpenEditFilter = (cat: FilterCategory) => {
    setSelectedFilter(cat);
    setEditFilterDomains(cat.domains.join('\n'));
    setEditFilterOpen(true);
  };

  const handleSaveEditFilter = async () => {
    if (!selectedFilter) return;
    const domains = editFilterDomains.split('\n').map(d => d.trim()).filter(Boolean);
    try {
      const res = await fetch(`/api/wifi/firewall/content-filter/${selectedFilter.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domains }),
      });
      const result = await res.json();
      if (result.success) {
        setFilterCategories(prev => prev.map(f => f.id === selectedFilter.id ? { ...f, domains, domainCount: domains.length } : f));
        setEditFilterOpen(false);
        toast({ title: 'Saved', description: 'Domain list updated' });
      } else {
        toast({ title: 'Error', description: result.error?.message || 'Failed to save', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to save domains', variant: 'destructive' });
    }
  };

  const handleCreateFilter = async () => {
    if (!newFilter.name || !propertyId) return;
    try {
      const res = await fetch('/api/wifi/firewall/content-filter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId, name: newFilter.name, category: newFilter.category, enabled: newFilter.enabled, domains: [] }),
      });
      const result = await res.json();
      if (result.success) {
        setAddFilterOpen(false);
        setNewFilter({ name: '', category: 'custom', enabled: true });
        fetchFilters();
        toast({ title: 'Created', description: 'Filter category added' });
      } else {
        toast({ title: 'Error', description: result.error?.message || 'Failed to create filter', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to create filter', variant: 'destructive' });
    }
  };

  const handleDeleteFilter = async (id: string) => {
    const filter = filterCategories.find(f => f.id === id);
    if (!filter) return;
    try {
      const res = await fetch(`/api/wifi/firewall/content-filter/${id}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) {
        setFilterCategories(prev => prev.filter(f => f.id !== id));
        toast({ title: 'Deleted', description: `${filter.name} removed` });
      } else {
        toast({ title: 'Error', description: result.error?.message || 'Failed to delete', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to delete filter', variant: 'destructive' });
    }
  };

  // ── Schedule handlers ──
  const handleToggleSchedule = async (id: string) => {
    const schedule = schedules.find(s => s.id === id);
    if (!schedule) return;
    setSchedules(prev => prev.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s));
    try {
      const res = await fetch(`/api/wifi/firewall/schedules/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !schedule.enabled }),
      });
      const result = await res.json();
      if (!result.success) {
        setSchedules(prev => prev.map(s => s.id === id ? { ...s, enabled: schedule.enabled } : s));
        toast({ title: 'Error', description: result.error?.message || 'Failed to update schedule', variant: 'destructive' });
      } else {
        toast({ title: 'Updated', description: `${schedule.name} ${!schedule.enabled ? 'enabled' : 'disabled'}` });
      }
    } catch {
      setSchedules(prev => prev.map(s => s.id === id ? { ...s, enabled: schedule.enabled } : s));
      toast({ title: 'Error', description: 'Failed to update schedule', variant: 'destructive' });
    }
  };

  const handleAddSchedule = async () => {
    if (!newSchedule.name.trim() || !propertyId) return;
    try {
      const res = await fetch('/api/wifi/firewall/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          name: newSchedule.name,
          days: JSON.stringify(newSchedule.days),
          startTime: newSchedule.startTime,
          endTime: newSchedule.endTime,
          applyTo: newSchedule.applyTo,
          action: newSchedule.action,
          enabled: newSchedule.enabled,
        }),
      });
      const result = await res.json();
      if (result.success) {
        setAddScheduleOpen(false);
        setNewSchedule({ name: '', days: [true, true, true, true, true, false, false], startTime: '06:00', endTime: '22:00', applyTo: 'Guest VLAN', action: 'Allow', enabled: true });
        fetchSchedules();
        toast({ title: 'Created', description: 'Schedule added' });
      } else {
        toast({ title: 'Error', description: result.error?.message || 'Failed to create schedule', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to create schedule', variant: 'destructive' });
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    const schedule = schedules.find(s => s.id === id);
    if (!schedule) return;
    try {
      const res = await fetch(`/api/wifi/firewall/schedules/${id}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) {
        setSchedules(prev => prev.filter(s => s.id !== id));
        toast({ title: 'Deleted', description: `${schedule.name} removed` });
      } else {
        toast({ title: 'Error', description: result.error?.message || 'Failed to delete', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to delete schedule', variant: 'destructive' });
    }
  };

  // ─── RENDER TABS ──────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Network className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            Network Management
          </h2>
          <p className="text-sm text-muted-foreground">
            Configure interfaces, VLANs, routing, firewall rules, and content filtering
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            System Online
          </div>
        </div>
      </div>

      {/* Real OS System Info Card */}
      {osSystemInfo && (
        <Card className="border-0 shadow-sm rounded-xl">
          <CardContent className="p-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Hostname</p>
                <p className="text-sm font-semibold truncate">{osSystemInfo.hostname}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">OS</p>
                <p className="text-sm font-semibold truncate">{osSystemInfo.osRelease || 'Linux'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Kernel</p>
                <p className="text-sm font-mono truncate">{osSystemInfo.kernel}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Uptime</p>
                <p className="text-sm font-semibold">{osSystemInfo.uptimeFormatted}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Load Avg</p>
                <p className="text-sm font-mono">{osSystemInfo.loadAverage}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Memory</p>
                <div className="flex items-center gap-2">
                  <Progress value={osSystemInfo.memory.usagePercent} className="h-2 flex-1" />
                  <span className="text-xs font-medium">{osSystemInfo.memory.usagePercent}%</span>
                </div>
                <p className="text-[10px] text-muted-foreground">{(osSystemInfo.memory.used / 1073741824).toFixed(1)} / {(osSystemInfo.memory.total / 1073741824).toFixed(1)} GB</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">CPU</p>
                <p className="text-sm font-semibold">{osSystemInfo.cpuCount} cores</p>
              </div>
            </div>
            {osDataLoaded && (
              <div className="mt-2 pt-2 border-t flex items-center gap-1.5 text-[10px] text-emerald-600">
                <CheckCircle2 className="h-3 w-3" />
                Live data from OS · Auto-refresh every 30s
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Custom Tab Switcher */}
      <div className="relative">
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-thin">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200',
                activeTab === tab.id
                  ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/25'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="mt-2">
        {/* ═══════ TAB 1: INTERFACES ═══════ */}
        {activeTab === 'interfaces' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <p className="text-sm text-muted-foreground">{interfaces.length} interfaces configured</p>
                <div className="flex items-center border rounded-md p-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn('h-7 w-7', interfaceView === 'grid' ? 'bg-muted' : '')}
                    onClick={() => setInterfaceView('grid')}
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn('h-7 w-7', interfaceView === 'list' ? 'bg-muted' : '')}
                    onClick={() => setInterfaceView('list')}
                  >
                    <List className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <Button onClick={() => setAddInterfaceOpen(true)} className="bg-teal-600 hover:bg-teal-700">
                <Plus className="h-4 w-4 mr-2" />
                Add Interface
              </Button>
            </div>

            {loadingInterfaces ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
                <span className="ml-3 text-sm text-muted-foreground">Loading interfaces…</span>
              </div>
            ) : interfaceView === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {interfaces.map((iface) => {
                const matchedRole = roles.find(r => r.interfaceName === iface.name);
                return (
                <Card
                  key={iface.id}
                  className="cursor-pointer transition-all duration-200 hover:scale-[1.01] hover:shadow-md border-border/50 hover:border-teal-500/30"
                  onClick={() => handleOpenEditInterface(iface)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          'p-2 rounded-lg',
                          iface.type === 'wireless' ? 'bg-rose-500/10' :
                          iface.type === 'bridge' ? 'bg-emerald-500/10' :
                          iface.type === 'bond' ? 'bg-violet-500/10' :
                          iface.type === 'vlan' ? 'bg-amber-500/10' : 'bg-teal-500/10'
                        )}>
                          {iface.type === 'wireless' ? <Wifi className="h-4 w-4 text-rose-500" /> :
                           iface.type === 'bridge' ? <ArrowRightLeft className="h-4 w-4 text-emerald-500" /> :
                           iface.type === 'bond' ? <Server className="h-4 w-4 text-violet-500" /> :
                           <Network className="h-4 w-4 text-teal-500" />}
                        </div>
                        <div>
                          <CardTitle className="text-base font-semibold">{iface.name}</CardTitle>
                          <CardDescription className="text-xs">{iface.description}</CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={cn('text-[10px] border', typeBadgeColor[iface.type])}>
                          {iface.type}
                        </Badge>
                        {iface.nettypeLabel ? (
                          <Badge variant="outline" className={cn('text-[10px] border', nettypeBadgeColor[iface.nettypeLabel] || roleBadgeColor[matchedRole?.role || 'unused'])}>
                            {iface.nettypeLabel}
                          </Badge>
                        ) : matchedRole ? (
                          <Badge variant="outline" className={cn('text-[10px] border', roleBadgeColor[matchedRole.role])}>
                            {matchedRole.role.toUpperCase()}
                          </Badge>
                        ) : null}
                        {iface.isPhysical && (
                          <Badge variant="outline" className="text-[10px] border bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20">
                            Physical
                          </Badge>
                        )}
                        <div className={cn(
                          'h-2.5 w-2.5 rounded-full',
                          iface.status === 'up' ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-gray-400'
                        )} />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="space-y-0.5">
                        <span className="text-muted-foreground">IP Address{iface.allIps.length > 1 ? 'es' : ''}</span>
                        {iface.allIps.map((ip, idx) => (
                          <p key={idx} className="font-mono font-medium text-xs">{ip}</p>
                        ))}
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-muted-foreground">Subnet</span>
                        <p className="font-mono font-medium">{iface.subnet}</p>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-muted-foreground">MAC</span>
                        <p className="font-mono font-medium">{iface.mac}</p>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-muted-foreground">Speed</span>
                        <p className="font-medium">{iface.speed}</p>
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-muted-foreground">MTU</span>
                        <p className="font-medium">{iface.mtu}</p>
                      </div>
                    </div>
                    <Separator className="my-3" />
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Status</span>
                      <Badge variant={iface.status === 'up' ? 'default' : 'secondary'} className={cn(
                        'text-[10px]',
                        iface.status === 'up' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-gray-500/15 text-gray-600'
                      )}>
                        {iface.status === 'up' ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                        {iface.status.toUpperCase()}
                      </Badge>
                    </div>
                    <TrafficGraph rx={iface.rxBytes} tx={iface.txBytes} />
                  </CardContent>
                </Card>
                );
              })}
            </div>
            ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="font-semibold">Interface</TableHead>
                      <TableHead className="font-semibold">IP Address</TableHead>
                      <TableHead className="font-semibold">Subnet</TableHead>
                      <TableHead className="font-semibold">MAC</TableHead>
                      <TableHead className="font-semibold">Speed</TableHead>
                      <TableHead className="font-semibold">MTU</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                      <TableHead className="font-semibold">Role</TableHead>
                      <TableHead className="font-semibold">Traffic</TableHead>
                      <TableHead className="text-right font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {interfaces.map((iface) => {
                      const matchedRole = roles.find(r => r.interfaceName === iface.name);
                      return (
                        <TableRow key={iface.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className={cn(
                                'p-1.5 rounded-md',
                                iface.type === 'wireless' ? 'bg-rose-500/10' :
                                iface.type === 'bridge' ? 'bg-emerald-500/10' :
                                iface.type === 'bond' ? 'bg-violet-500/10' :
                                iface.type === 'vlan' ? 'bg-amber-500/10' : 'bg-teal-500/10'
                              )}>
                                {iface.type === 'wireless' ? <Wifi className="h-3.5 w-3.5 text-rose-500" /> :
                                 iface.type === 'bridge' ? <ArrowRightLeft className="h-3.5 w-3.5 text-emerald-500" /> :
                                 iface.type === 'bond' ? <Server className="h-3.5 w-3.5 text-violet-500" /> :
                                 <Network className="h-3.5 w-3.5 text-teal-500" />}
                              </div>
                              <div>
                                <p className="font-medium text-sm">{iface.name}</p>
                                <div className="flex items-center gap-1 mt-0.5">
                                  <Badge variant="outline" className={cn('text-[9px] border px-1 py-0', typeBadgeColor[iface.type])}>
                                    {iface.type}
                                  </Badge>
                                  {matchedRole && (
                                    <Badge variant="outline" className={cn('text-[9px] border px-1 py-0', roleBadgeColor[matchedRole.role])}>
                                      {matchedRole.role.toUpperCase()}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {iface.allIps.map((ip, idx) => (
                              <span key={idx}>{ip}{idx < iface.allIps.length - 1 ? ', ' : ''}</span>
                            ))}
                          </TableCell>
                          <TableCell className="font-mono text-sm">{iface.subnet}</TableCell>
                          <TableCell className="font-mono text-sm">{iface.mac}</TableCell>
                          <TableCell className="text-sm">{iface.speed}</TableCell>
                          <TableCell className="text-sm">{iface.mtu}</TableCell>
                          <TableCell>
                            <Badge variant={iface.status === 'up' ? 'default' : 'secondary'} className={cn(
                              'text-[10px]',
                              iface.status === 'up' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-gray-500/15 text-gray-600'
                            )}>
                              {iface.status === 'up' ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                              {iface.status.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {matchedRole ? (
                              <Badge variant="outline" className={cn('text-[10px] border', roleBadgeColor[matchedRole.role])}>
                                {matchedRole.role.toUpperCase()}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="text-xs space-y-0.5">
                              <div className="text-muted-foreground">RX: <span className="font-mono text-foreground">{formatBytes(iface.rxBytes)}</span></div>
                              <div className="text-muted-foreground">TX: <span className="font-mono text-foreground">{formatBytes(iface.txBytes)}</span></div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); handleOpenEditInterface(iface); }}>
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            )}

            {/* Add Interface Dialog */}
            <Dialog open={addInterfaceOpen} onOpenChange={setAddInterfaceOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Network Interface</DialogTitle>
                  <DialogDescription>Create a new virtual or physical interface</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-2">
                  <div className="space-y-2">
                    <Label>Interface Name</Label>
                    <Input placeholder="e.g., eth2, vlan10, br-guest" value={newInterface.name} onChange={e => setNewInterface(p => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={newInterface.type} onValueChange={v => setNewInterface(p => ({ ...p, type: v }))}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ethernet">Ethernet</SelectItem>
                        <SelectItem value="vlan">VLAN</SelectItem>
                        <SelectItem value="bridge">Bridge</SelectItem>
                        <SelectItem value="bond">Bond</SelectItem>
                        <SelectItem value="wireless">Wireless</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>MTU</Label>
                    <Input type="number" value={newInterface.mtu} onChange={e => setNewInterface(p => ({ ...p, mtu: parseInt(e.target.value) || 1500 }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input placeholder="Interface description" value={newInterface.description} onChange={e => setNewInterface(p => ({ ...p, description: e.target.value }))} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddInterfaceOpen(false)}>Cancel</Button>
                  <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleAddInterface}>Add Interface</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Edit Interface Dialog */}
            <Dialog open={editInterfaceOpen} onOpenChange={setEditInterfaceOpen}>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Edit Interface — {selectedInterface?.name}</DialogTitle>
                  <DialogDescription>Modify interface configuration</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-2 max-h-[70vh] overflow-y-auto pr-2">
                  {/* Basic Settings */}
                  <div className="space-y-2">
                    <Label>Interface Name</Label>
                    <Input value={editInterfaceData.name} onChange={e => setEditInterfaceData(p => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>MTU</Label>
                    <Input type="number" value={editInterfaceData.mtu} onChange={e => setEditInterfaceData(p => ({ ...p, mtu: parseInt(e.target.value) || 1500 }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input value={editInterfaceData.description} onChange={e => setEditInterfaceData(p => ({ ...p, description: e.target.value }))} />
                  </div>

                  <Separator />

                  {/* IP Configuration Section */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold">IP Configuration</h4>
                    <div className="space-y-2">
                      <Label>Mode</Label>
                      <Select value={editInterfaceData.mode} onValueChange={v => setEditInterfaceData(p => ({ ...p, mode: v as 'dhcp' | 'static' }))}>
                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="dhcp">DHCP</SelectItem>
                          <SelectItem value="static">Static</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {editInterfaceData.mode === 'static' ? (
                      <div className="grid gap-3">
                        <div className="space-y-2">
                          <Label>IP Address</Label>
                          <Input className="font-mono" placeholder="e.g., 192.168.1.1" value={editInterfaceData.ipAddress} onChange={e => setEditInterfaceData(p => ({ ...p, ipAddress: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                          <Label>Subnet / Netmask</Label>
                          <Input className="font-mono" placeholder="e.g., 255.255.255.0" value={editInterfaceData.netmask} onChange={e => setEditInterfaceData(p => ({ ...p, netmask: e.target.value }))} />
                        </div>
                        <div className="space-y-2">
                          <Label>Gateway</Label>
                          <Input className="font-mono" placeholder="e.g., 192.168.1.254" value={editInterfaceData.gateway} onChange={e => setEditInterfaceData(p => ({ ...p, gateway: e.target.value }))} />
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground bg-muted/50 rounded-md p-3">IP address will be assigned by DHCP server</p>
                    )}
                  </div>

                  <Separator />

                  {/* Role Assignment Section */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold">Role Assignment</h4>
                    <div className="space-y-2">
                      <Label>Role</Label>
                      <Select value={editInterfaceData.role} onValueChange={v => setEditInterfaceData(p => ({ ...p, role: v }))}>
                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="wan">WAN</SelectItem>
                          <SelectItem value="lan">LAN</SelectItem>
                          <SelectItem value="dmz">DMZ</SelectItem>
                          <SelectItem value="management">Management</SelectItem>
                          <SelectItem value="wifi">WiFi</SelectItem>
                          <SelectItem value="guest">Guest</SelectItem>
                          <SelectItem value="iot">IoT</SelectItem>
                          <SelectItem value="unused">Unused</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Priority</Label>
                      <Input type="number" value={editInterfaceData.priority} onChange={e => setEditInterfaceData(p => ({ ...p, priority: parseInt(e.target.value) || 0 }))} />
                    </div>
                  </div>

                  {/* IP Aliases Section */}
                  <Separator />
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <Plus className="h-3.5 w-3.5" />
                      IP Aliases (Secondary IPs)
                    </h4>
                    {interfaceAliases.length > 0 && (
                      <div className="space-y-2">
                        {interfaceAliases.map((alias, idx) => (
                          <div key={idx} className="flex items-center gap-2 bg-muted/50 rounded-md p-2">
                            <div className="flex-1 grid grid-cols-3 gap-2 text-xs">
                              <span className="font-mono font-medium">{alias.ipAddress}</span>
                              <span className="font-mono text-muted-foreground">{alias.netmask}</span>
                              <span className="text-muted-foreground truncate">{alias.description}</span>
                            </div>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-600 shrink-0"
                              onClick={() => selectedInterface && handleDeleteAlias(selectedInterface.name, alias.ipAddress)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="grid grid-cols-3 gap-2">
                      <Input className="font-mono text-xs h-8" placeholder="IP Address" value={newAlias.ipAddress}
                        onChange={e => setNewAlias(p => ({ ...p, ipAddress: e.target.value }))} />
                      <Input className="font-mono text-xs h-8" placeholder="Netmask" value={newAlias.netmask}
                        onChange={e => setNewAlias(p => ({ ...p, netmask: e.target.value }))} />
                      <div className="flex gap-1">
                        <Input className="text-xs h-8" placeholder="Desc" value={newAlias.description}
                          onChange={e => setNewAlias(p => ({ ...p, description: e.target.value }))} />
                        <Button variant="outline" size="sm" className="h-8 px-2 shrink-0" onClick={() => selectedInterface && handleAddAlias(selectedInterface.name)}>
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Read-only info */}
                  {selectedInterface && (
                    <div className="grid grid-cols-2 gap-4 text-sm bg-muted/50 rounded-lg p-3">
                      <div><span className="text-muted-foreground">MAC:</span> <span className="font-mono">{selectedInterface.mac}</span></div>
                      <div><span className="text-muted-foreground">Speed:</span> {selectedInterface.speed}</div>
                      <div><span className="text-muted-foreground">IP:</span> <span className="font-mono">{selectedInterface.ipAddress}</span></div>
                      <div><span className="text-muted-foreground">Status:</span> <span className="capitalize">{selectedInterface.status}</span></div>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setEditInterfaceOpen(false)}>Cancel</Button>
                  <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleSaveEditInterface}>Save Changes</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}

        {/* ═══════ TAB 2: VLANs ═══════ */}
        {activeTab === 'vlans' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">{vlans.length} VLANs configured</p>
              <Button onClick={() => setAddVlanOpen(true)} className="bg-teal-600 hover:bg-teal-700">
                <Plus className="h-4 w-4 mr-2" />
                Add VLAN
              </Button>
            </div>

            {loadingVlans ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
                <span className="ml-3 text-sm text-muted-foreground">Loading VLANs…</span>
              </div>
            ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="font-semibold">VLAN ID</TableHead>
                      <TableHead className="font-semibold">Sub-Interface</TableHead>
                      <TableHead className="font-semibold">Parent</TableHead>
                      <TableHead className="font-semibold">Description</TableHead>
                      <TableHead className="font-semibold">MTU</TableHead>
                      <TableHead className="font-semibold">DHCP Subnet</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                      <TableHead className="text-right font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vlans.map((vlan) => (
                      <TableRow key={vlan.id} className="group">
                        <TableCell>
                          <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 font-mono font-semibold">
                            {vlan.vlanId}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm font-medium">{vlan.subInterface}</TableCell>
                        <TableCell className="font-mono text-sm">{vlan.parent}</TableCell>
                        <TableCell className="text-sm">{vlan.description}</TableCell>
                        <TableCell className="text-sm font-mono">{vlan.mtu}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs font-mono">{vlan.dhcpSubnet}</Badge>
                        </TableCell>
                        <TableCell>
                          <Switch checked={vlan.enabled} onCheckedChange={() => handleToggleVlan(vlan.id)} />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <Edit2 className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Edit VLAN</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:text-red-600" onClick={() => handleDeleteVlan(vlan.id)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Delete VLAN</TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            )}

            {/* Add VLAN Dialog */}
            <Dialog open={addVlanOpen} onOpenChange={setAddVlanOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add VLAN</DialogTitle>
                  <DialogDescription>Create a new VLAN interface</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-2">
                  <div className="space-y-2">
                    <Label>VLAN ID</Label>
                    <Input type="number" placeholder="e.g., 60" value={newVlan.vlanId} onChange={e => setNewVlan(p => ({ ...p, vlanId: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Parent Interface</Label>
                    <Select value={newVlan.parentInterface} onValueChange={v => setNewVlan(p => ({ ...p, parentInterface: v }))}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {interfaces.filter(i => i.type === 'ethernet' || i.type === 'bridge').map(i => (
                          <SelectItem key={i.id} value={i.name}>{i.name} — {i.description}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input placeholder="VLAN description" value={newVlan.description} onChange={e => setNewVlan(p => ({ ...p, description: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>MTU</Label>
                    <Input type="number" value={newVlan.mtu} onChange={e => setNewVlan(p => ({ ...p, mtu: parseInt(e.target.value) || 1500 }))} />
                  </div>
                  <Separator />
                  <p className="text-xs font-semibold text-muted-foreground">VLAN Gateway IP Configuration</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>IP Address</Label>
                      <Input className="font-mono" placeholder="192.168.10.1" value={newVlan.ipAddress} onChange={e => setNewVlan(p => ({ ...p, ipAddress: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Subnet Mask</Label>
                      <Input className="font-mono" placeholder="255.255.255.0" value={newVlan.netmask} onChange={e => setNewVlan(p => ({ ...p, netmask: e.target.value }))} />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddVlanOpen(false)}>Cancel</Button>
                  <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleAddVlan}>Add VLAN</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}

        {/* ═══════ TAB 3: BRIDGES & BONDS ═══════ */}
        {activeTab === 'bridges-bonds' && (
          <div className="space-y-6">
            {/* Sub-tabs */}
            <div className="flex gap-2">
              <button
                onClick={() => setBridgeBondSubTab('bridges')}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                  bridgeBondSubTab === 'bridges' ? 'bg-teal-600 text-white' : 'bg-muted text-muted-foreground hover:text-foreground'
                )}
              >
                <ArrowRightLeft className="h-4 w-4 inline mr-2" />
                Bridges ({bridges.length})
              </button>
              <button
                onClick={() => setBridgeBondSubTab('bonds')}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                  bridgeBondSubTab === 'bonds' ? 'bg-teal-600 text-white' : 'bg-muted text-muted-foreground hover:text-foreground'
                )}
              >
                <Server className="h-4 w-4 inline mr-2" />
                Bonds ({bonds.length})
              </button>
            </div>

            {bridgeBondSubTab === 'bridges' && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">Network Bridges</CardTitle>
                      <CardDescription>Group interfaces into a single logical bridge</CardDescription>
                    </div>
                    <Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={() => setAddBridgeOpen(true)}>
                      <Plus className="h-3.5 w-3.5 mr-1.5" /> Create Bridge
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="font-semibold">Name</TableHead>
                        <TableHead className="font-semibold">Members</TableHead>
                        <TableHead className="font-semibold">STP</TableHead>
                        <TableHead className="font-semibold">Forward Delay</TableHead>
                        <TableHead className="font-semibold">Enabled</TableHead>
                        <TableHead className="text-right font-semibold">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bridges.map((bridge) => (
                        <TableRow key={bridge.id}>
                          <TableCell className="font-mono font-semibold">{bridge.name}</TableCell>
                          <TableCell>
                            <div className="flex gap-1.5 flex-wrap">
                              {bridge.members.map((m) => (
                                <Badge key={m} variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 font-mono text-xs">
                                  {m}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            {bridge.stp ? (
                              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-xs">Enabled</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">Disabled</Badge>
                            )}
                          </TableCell>
                          <TableCell className="font-mono">{bridge.forwardDelay}s</TableCell>
                          <TableCell>
                            <Switch checked={bridge.enabled} onCheckedChange={() => handleToggleBridge(bridge.name, bridge.enabled)} />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:text-red-600" onClick={() => handleDeleteBridge(bridge.name)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {bridgeBondSubTab === 'bonds' && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">Network Bonds</CardTitle>
                      <CardDescription>Aggregate multiple interfaces for redundancy or throughput</CardDescription>
                    </div>
                    <Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={() => setAddBondOpen(true)}>
                      <Plus className="h-3.5 w-3.5 mr-1.5" /> Create Bond
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="font-semibold">Name</TableHead>
                        <TableHead className="font-semibold">Mode</TableHead>
                        <TableHead className="font-semibold">Members</TableHead>
                        <TableHead className="font-semibold">MIIMon</TableHead>
                        <TableHead className="font-semibold">LACP Rate</TableHead>
                        <TableHead className="font-semibold">Primary</TableHead>
                        <TableHead className="text-right font-semibold">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bonds.map((bond) => (
                        <TableRow key={bond.id}>
                          <TableCell className="font-mono font-semibold">{bond.name}</TableCell>
                          <TableCell>
                            <Select defaultValue={bond.mode}>
                              <SelectTrigger className="w-48 h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="802.3ad (LACP)">802.3ad (LACP)</SelectItem>
                                <SelectItem value="active-backup">Active-Backup</SelectItem>
                                <SelectItem value="balance-xor">Balance-XOR</SelectItem>
                                <SelectItem value="broadcast">Broadcast</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1.5 flex-wrap">
                              {bond.members.map((m) => (
                                <Badge key={m} variant="outline" className="bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/30 font-mono text-xs">
                                  {m}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="font-mono">{bond.miimon}ms</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize text-xs">{bond.lacpRate}</Badge>
                          </TableCell>
                          <TableCell className="font-mono">{bond.primary}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:text-red-600" onClick={() => handleDeleteBond(bond.name)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ═══════ TAB 4: WAN/LAN MAPPING ═══════ */}
        {activeTab === 'wan-lan' && (
          <div className="space-y-6">
            {/* Persistence Info Banner */}
            <Card className="border-sky-500/30 bg-gradient-to-r from-sky-50 to-cyan-50 dark:from-sky-950/20 dark:to-cyan-950/20">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-sky-600 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-sky-800 dark:text-sky-300">Dual Persistence: OS + Database</p>
                    <p className="text-xs text-sky-700/70 dark:text-sky-400/70 mt-1">
                      Role assignments are persisted to <code className="bg-sky-100 dark:bg-sky-900 px-1 rounded font-mono text-[10px]">/etc/network/interfaces</code> via comment tags
                      (<code className="bg-sky-100 dark:bg-sky-900 px-1 rounded font-mono text-[10px]"># STAYSUITE_ROLE: wan</code>) and
                      the database. Roles survive system reboots and are read automatically at startup.
                    </p>
                  </div>
                  <Button size="sm" variant="outline" className="shrink-0 border-sky-300 text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900"
                    onClick={handleSaveAllRoles}>
                    <Save className="h-3.5 w-3.5 mr-1.5" />
                    Save All Roles
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* WAN Failover Config */}
            <Card className="border-orange-500/30 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Globe className="h-4 w-4 text-orange-600" />
                  WAN Failover Configuration
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Health Check URL</Label>
                    <Input
                      value={failoverConfig.healthCheckUrl}
                      onChange={e => setFailoverConfig(p => ({ ...p, healthCheckUrl: e.target.value }))}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Failover Threshold (failures)</Label>
                    <Input
                      type="number"
                      value={failoverConfig.failoverThreshold}
                      onChange={e => setFailoverConfig(p => ({ ...p, failoverThreshold: parseInt(e.target.value) || 3 }))}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-2 flex items-end">
                    <div className="flex items-center gap-3 pb-1">
                      <Switch
                        checked={failoverConfig.autoSwitchback}
                        onCheckedChange={v => setFailoverConfig(p => ({ ...p, autoSwitchback: v }))}
                      />
                      <Label className="text-sm">Auto Switchback</Label>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Traffic Flow Indicator */}
            <div className="flex items-center justify-center gap-4 py-4">
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-orange-500" />
                <span className="text-sm font-semibold text-orange-700 dark:text-orange-400">WAN</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-0.5 w-12 bg-gradient-to-r from-orange-500 to-teal-500 rounded-full" />
                <div className="h-3 w-3 rounded-full bg-teal-500 shadow-sm shadow-teal-500/50 animate-pulse" />
                <Server className="h-5 w-5 text-teal-600 mx-1" />
                <div className="h-3 w-3 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50 animate-pulse" />
                <div className="h-0.5 w-12 bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">LAN</span>
                <Monitor className="h-5 w-5 text-emerald-500" />
              </div>
            </div>

            {/* WAN Interfaces */}
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-orange-500" />
                WAN Interfaces
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {roles.filter(r => r.role === 'wan').sort((a, b) => a.priority - b.priority).map((role) => {
                  const iface = interfaces.find(i => i.id === role.interfaceId);
                  if (!iface) return null;
                  return (
                    <Card key={role.interfaceId} className="transition-all duration-200 hover:scale-[1.01] hover:shadow-md border-orange-500/20">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-orange-500/10">
                              <Globe className="h-4 w-4 text-orange-600" />
                            </div>
                            <div>
                              <p className="font-semibold text-sm">{iface.name}</p>
                              <p className="text-xs text-muted-foreground font-mono">{iface.ipAddress}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className="bg-gradient-to-r from-orange-500/20 to-amber-500/20 text-orange-700 dark:text-orange-400 border border-orange-500/30 text-[10px]">
                              Priority #{role.priority}
                            </Badge>
                            <div className="flex flex-col gap-0.5">
                              <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => handleMovePriority(role.interfaceId, 'up')}>
                                <ChevronUp className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => handleMovePriority(role.interfaceId, 'down')}>
                                <ChevronDown className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="font-mono">{iface.speed}</span>
                            <span>•</span>
                            <span>MTU {iface.mtu}</span>
                          </div>
                          <div className={cn('h-2 w-2 rounded-full', iface.status === 'up' ? 'bg-emerald-500' : 'bg-gray-400')} />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* LAN & Other Interfaces */}
            <div>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                LAN / Other Interfaces
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {roles.filter(r => r.role !== 'wan').map((role) => {
                  const iface = interfaces.find(i => i.id === role.interfaceId);
                  if (!iface) return null;
                  return (
                    <Card key={role.interfaceId} className="transition-all duration-200 hover:scale-[1.01] hover:shadow-md">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              'p-1.5 rounded-lg',
                              role.role === 'lan' ? 'bg-teal-500/10' :
                              role.role === 'management' ? 'bg-violet-500/10' :
                              role.role === 'wifi' ? 'bg-cyan-500/10' :
                              role.role === 'dmz' ? 'bg-red-500/10' : 'bg-muted'
                            )}>
                              {role.role === 'wifi' ? <Wifi className="h-4 w-4 text-cyan-600" /> :
                               role.role === 'management' ? <Shield className="h-4 w-4 text-violet-600" /> :
                               <Monitor className="h-4 w-4 text-teal-600" />}
                            </div>
                            <div>
                              <p className="font-semibold text-sm">{iface.name}</p>
                              <p className="text-xs text-muted-foreground font-mono">{iface.ipAddress}</p>
                            </div>
                          </div>
                          <Badge variant="outline" className={cn('text-[10px] border', roleBadgeColor[role.role])}>
                            {role.role.toUpperCase()}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="font-mono">{iface.speed}</span>
                            <span>•</span>
                            <span>{iface.description}</span>
                          </div>
                          <Select value={role.role} onValueChange={v => handleRoleChange(role.interfaceId, v as InterfaceRole['role'])} disabled={roleSaving === role.interfaceId}>
                            <SelectTrigger className="w-28 h-7 text-[11px]">
                              {roleSaving === role.interfaceId ? <Loader2 className="h-3 w-3 animate-spin" /> : <SelectValue />}
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="wan">WAN</SelectItem>
                              <SelectItem value="lan">LAN</SelectItem>
                              <SelectItem value="dmz">DMZ</SelectItem>
                              <SelectItem value="management">Management</SelectItem>
                              <SelectItem value="wifi">WiFi</SelectItem>
                              <SelectItem value="unused">Unused</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ═══════ TAB 5: ROUTES ═══════ */}
        {activeTab === 'routes' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">{routes.length} routes configured</p>
              <Button onClick={() => setAddRouteOpen(true)} className="bg-teal-600 hover:bg-teal-700">
                <Plus className="h-4 w-4 mr-2" /> Add Route
              </Button>
            </div>
            {loadingRoutes ? (
              <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-teal-500" /></div>
            ) : routes.length === 0 ? (
              <Card className="border-dashed"><CardContent className="p-12 text-center"><Route className="h-10 w-10 mx-auto mb-3 text-muted-foreground" /><p className="text-sm text-muted-foreground">No routes configured. Add a default route or custom static routes.</p></CardContent></Card>
            ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="font-semibold">Type</TableHead>
                      <TableHead className="font-semibold">Destination</TableHead>
                      <TableHead className="font-semibold">Gateway</TableHead>
                      <TableHead className="font-semibold">Interface</TableHead>
                      <TableHead className="font-semibold">Metric</TableHead>
                      <TableHead className="font-semibold">Protocol</TableHead>
                      <TableHead className="font-semibold">Description</TableHead>
                      <TableHead className="text-right font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {routes.map((route) => (
                      <TableRow key={route.id}>
                        <TableCell>
                          <Badge className={route.isDefault ? 'bg-orange-500/15 text-orange-700 dark:text-orange-400 text-[10px]' : 'bg-teal-500/15 text-teal-700 dark:text-teal-400 text-[10px]'}>
                            {route.isDefault ? 'Default' : 'Custom'}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{route.destination}</TableCell>
                        <TableCell className="font-mono text-sm font-medium">{route.gateway || '—'}</TableCell>
                        <TableCell className="font-mono text-sm">{route.interfaceName || '—'}</TableCell>
                        <TableCell className="text-sm">{route.metric}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{route.protocol}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{route.description || '—'}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                            onClick={() => handleDeleteRoute(route.destination, route.gateway)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            )}

            <Dialog open={addRouteOpen} onOpenChange={setAddRouteOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Route</DialogTitle>
                  <DialogDescription>Add a static route (default gateway or custom network route)</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-2">
                  <div className="space-y-2">
                    <Label>Route Name</Label>
                    <Input placeholder="e.g., Default Gateway" value={newRoute.name} onChange={e => setNewRoute(p => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch checked={newRoute.isDefault} onCheckedChange={v => setNewRoute(p => ({ ...p, isDefault: v, destination: v ? '0.0.0.0/0' : p.destination }))} />
                    <Label>Default Route (0.0.0.0/0)</Label>
                  </div>
                  {!newRoute.isDefault && (
                    <div className="space-y-2">
                      <Label>Destination Network</Label>
                      <Input className="font-mono" placeholder="e.g., 10.0.0.0/24" value={newRoute.destination} onChange={e => setNewRoute(p => ({ ...p, destination: e.target.value }))} />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Gateway</Label>
                    <Input className="font-mono" placeholder="e.g., 192.168.1.254" value={newRoute.gateway} onChange={e => setNewRoute(p => ({ ...p, gateway: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Interface</Label>
                      <Select value={newRoute.interfaceName} onValueChange={v => setNewRoute(p => ({ ...p, interfaceName: v }))}>
                        <SelectTrigger className="w-full"><SelectValue placeholder="Select interface" /></SelectTrigger>
                        <SelectContent>
                          {interfaces.map(i => (<SelectItem key={i.id} value={i.name}>{i.name}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Metric</Label>
                      <Input type="number" value={newRoute.metric} onChange={e => setNewRoute(p => ({ ...p, metric: parseInt(e.target.value) || 100 }))} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input placeholder="Optional description" value={newRoute.description} onChange={e => setNewRoute(p => ({ ...p, description: e.target.value }))} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddRouteOpen(false)}>Cancel</Button>
                  <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleAddRoute}>Add Route</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}

        {/* ═══════ TAB 6: MULTI-WAN ═══════ */}
        {activeTab === 'multiwan' && (
          <div className="space-y-6">
            {loadingMultiWan ? (
              <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-teal-500" /></div>
            ) : (
            <>
            {/* Status Banner */}
            <Card className={multiWanConfig?.enabled ? 'border-emerald-500/30 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20' : 'border-muted'}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn('p-2.5 rounded-xl', multiWanConfig?.enabled ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white' : 'bg-muted text-muted-foreground')}>
                      <Workflow className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{multiWanConfig?.enabled ? 'Multi-WAN Load Balancing Active' : 'Multi-WAN Not Configured'}</p>
                      <p className="text-xs text-muted-foreground">
                        {multiWanConfig?.enabled
                          ? `Mode: ${(multiWanConfig?.mode || 'weighted').toUpperCase()} · ${multiWanConfig?.wanMembers.filter(m => m.enabled).length} WAN link(s)`
                          : 'Configure multiple WAN interfaces for load balancing or failover'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={multiWanConfig?.enabled ?? false} onCheckedChange={v => {
                      if (!multiWanConfig) {
                        setMultiWanConfig({
                          id: 'new',
                          enabled: v,
                          mode: 'weighted',
                          healthCheckUrl: 'https://1.1.1.1',
                          healthCheckInterval: 10,
                          healthCheckTimeout: 3,
                          failoverThreshold: 3,
                          autoSwitchback: true,
                          switchbackDelay: 300,
                          flushConnectionsOnFailover: true,
                          wanMembers: interfaces.filter(i => {
                            const role = roles.find(r => r.interfaceId === i.name);
                            return role?.role === 'wan';
                          }).map(i => ({
                            id: `m-${i.name}`,
                            interfaceName: i.name,
                            weight: 1,
                            gateway: '',
                            healthStatus: 'unknown' as const,
                            enabled: true,
                            isPrimary: false,
                          })),
                        });
                      } else {
                        setMultiWanConfig(prev => prev ? { ...prev, enabled: v } : prev);
                      }
                    }} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Configuration Card */}
            {multiWanConfig && (
              <>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2"><Zap className="h-4 w-4 text-amber-500" /> Load Balancing Configuration</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Mode</Label>
                      <Select value={multiWanConfig.mode} onValueChange={v => setMultiWanConfig(p => p ? { ...p, mode: v as any } : p)}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="weighted">Weighted (ECMP)</SelectItem>
                          <SelectItem value="failover">Failover</SelectItem>
                          <SelectItem value="round-robin">Round Robin</SelectItem>
                          <SelectItem value="ECMP">ECMP</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Health Check URL</Label>
                      <Input className="h-9 text-sm" value={multiWanConfig.healthCheckUrl} onChange={e => setMultiWanConfig(p => p ? { ...p, healthCheckUrl: e.target.value } : p)} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Check Interval (s)</Label>
                      <Input type="number" className="h-9" value={multiWanConfig.healthCheckInterval} onChange={e => setMultiWanConfig(p => p ? { ...p, healthCheckInterval: parseInt(e.target.value) || 10 } : p)} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Failover Threshold</Label>
                      <Input type="number" className="h-9" value={multiWanConfig.failoverThreshold} onChange={e => setMultiWanConfig(p => p ? { ...p, failoverThreshold: parseInt(e.target.value) || 3 } : p)} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Timeout (s)</Label>
                      <Input type="number" className="h-9" value={multiWanConfig.healthCheckTimeout} onChange={e => setMultiWanConfig(p => p ? { ...p, healthCheckTimeout: parseInt(e.target.value) || 3 } : p)} />
                    </div>
                    <div className="space-y-2 flex items-end gap-3">
                      <div className="flex items-center gap-2">
                        <Switch checked={multiWanConfig.autoSwitchback} onCheckedChange={v => setMultiWanConfig(p => p ? { ...p, autoSwitchback: v } : p)} />
                        <Label className="text-xs">Auto Switchback</Label>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Switchback Delay (s)</Label>
                      <Input type="number" className="h-9" value={multiWanConfig.switchbackDelay} onChange={e => setMultiWanConfig(p => p ? { ...p, switchbackDelay: parseInt(e.target.value) || 300 } : p)} />
                    </div>
                    <div className="space-y-2 flex items-end gap-3">
                      <div className="flex items-center gap-2">
                        <Switch checked={multiWanConfig.flushConnectionsOnFailover} onCheckedChange={v => setMultiWanConfig(p => p ? { ...p, flushConnectionsOnFailover: v } : p)} />
                        <Label className="text-xs">Flush Conn.</Label>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* WAN Members */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2"><Globe className="h-4 w-4 text-orange-500" /> WAN Interfaces</CardTitle>
                      <CardDescription>Manage WAN links for load balancing</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={handleAddWanMember}><Plus className="h-3.5 w-3.5 mr-1.5" /> Add WAN Link</Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {multiWanConfig.wanMembers.length === 0 ? (
                    <div className="p-8 text-center text-sm text-muted-foreground">
                      <Globe className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                      No WAN members added. Click "Add WAN Link" or assign WAN role to interfaces in the WAN/LAN Mapping tab.
                    </div>
                  ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="font-semibold">Interface</TableHead>
                        <TableHead className="font-semibold">Gateway</TableHead>
                        <TableHead className="font-semibold">Weight</TableHead>
                        <TableHead className="font-semibold">Primary</TableHead>
                        <TableHead className="font-semibold">Health</TableHead>
                        <TableHead className="font-semibold">Enabled</TableHead>
                        <TableHead className="text-right font-semibold">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {multiWanConfig.wanMembers.map((member) => (
                        <TableRow key={member.id}>
                          <TableCell className="font-mono font-semibold">{member.interfaceName}</TableCell>
                          <TableCell className="font-mono text-sm">{member.gateway || '—'}</TableCell>
                          <TableCell>
                            <Input type="number" className="w-20 h-8 text-sm font-mono" value={member.weight}
                              onChange={e => setMultiWanConfig(p => p ? { ...p, wanMembers: p.wanMembers.map(m => m.interfaceName === member.interfaceName ? { ...m, weight: parseInt(e.target.value) || 1 } : m) } : p)} />
                          </TableCell>
                          <TableCell>
                            <input type="radio" name="primary" checked={member.isPrimary}
                              onChange={() => setMultiWanConfig(p => p ? { ...p, wanMembers: p.wanMembers.map(m => ({ ...m, isPrimary: m.interfaceName === member.interfaceName })) } : p)}
                              className="h-4 w-4 accent-teal-600" />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <div className={cn('h-2.5 w-2.5 rounded-full', member.healthStatus === 'online' ? 'bg-emerald-500' : member.healthStatus === 'offline' ? 'bg-red-500' : 'bg-amber-500 animate-pulse')} />
                              <span className="text-xs capitalize">{member.healthStatus}</span>
                            </div>
                          </TableCell>
                          <TableCell><Switch checked={member.enabled} onCheckedChange={v => setMultiWanConfig(p => p ? { ...p, wanMembers: p.wanMembers.map(m => m.interfaceName === member.interfaceName ? { ...m, enabled: v } : m) } : p)} /></TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500" onClick={() => handleRemoveWanMember(member.interfaceName)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  )}
                </CardContent>
              </Card>

              {/* Flow Diagram */}
              <div className="flex items-center justify-center gap-4 py-2">
                <div className="flex items-center gap-2"><Globe className="h-5 w-5 text-orange-500" /><span className="text-xs font-semibold text-orange-700">INTERNET</span></div>
                <div className="h-0.5 w-8 bg-gradient-to-r from-orange-500 to-teal-500 rounded-full" />
                <div className="flex items-center gap-1">
                  {multiWanConfig.wanMembers.filter(m => m.enabled).map((m, i) => (
                    <React.Fragment key={m.interfaceName}>
                      <div className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold border', m.healthStatus === 'online' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200')}>
                        {m.interfaceName}
                      </div>
                      {i < multiWanConfig.wanMembers.filter(m => m.enabled).length - 1 && <ArrowRightLeft className="h-3 w-3 text-muted-foreground mx-1" />}
                    </React.Fragment>
                  ))}
                </div>
                <div className="h-0.5 w-8 bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full" />
                <div className="flex items-center gap-2"><Server className="h-5 w-5 text-teal-600" /><span className="text-xs font-semibold text-teal-700">GATEWAY</span></div>
                <div className="h-0.5 w-8 bg-emerald-500 rounded-full" />
                <div className="flex items-center gap-2"><Monitor className="h-5 w-5 text-emerald-500" /><span className="text-xs font-semibold text-emerald-700">LAN</span></div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleApplyMultiWan} disabled={!multiWanConfig.enabled || multiWanConfig.wanMembers.filter(m => m.enabled).length === 0}>
                  <Zap className="h-4 w-4 mr-2" /> Apply Configuration
                </Button>
                <Button variant="outline" onClick={handleResetMultiWan}>
                  <RefreshCw className="h-4 w-4 mr-2" /> Reset Multi-WAN
                </Button>
              </div>
              </>
            )}
            </>
            )}
          </div>
        )}

        {/* Bridge Create Dialog */}
        <Dialog open={addBridgeOpen} onOpenChange={setAddBridgeOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Network Bridge</DialogTitle>
              <DialogDescription>Create a new bridge interface to group physical interfaces</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="space-y-2">
                <Label>Bridge Name</Label>
                <Input placeholder="e.g., br-guest" value={newBridge.name} onChange={e => setNewBridge(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Member Interfaces</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {interfaces.filter(i => i.type === 'ethernet' && !bridges.some(b => b.members.includes(i.name))).map(i => (
                    <label key={i.id} className="flex items-center gap-2 p-2 rounded-md border hover:bg-muted/50 cursor-pointer">
                      <input type="checkbox" checked={newBridge.members.includes(i.name)}
                        onChange={e => setNewBridge(p => ({ ...p, members: e.target.checked ? [...p.members, i.name] : p.members.filter(m => m !== i.name) }))} className="accent-teal-600" />
                      <span className="text-sm font-mono">{i.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={newBridge.stp} onCheckedChange={v => setNewBridge(p => ({ ...p, stp: v }))} />
                <Label>Enable STP (Spanning Tree Protocol)</Label>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>IP Address (Optional)</Label>
                  <Input className="font-mono" placeholder="192.168.1.1" value={newBridge.ipAddress} onChange={e => setNewBridge(p => ({ ...p, ipAddress: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Netmask (Optional)</Label>
                  <Input className="font-mono" placeholder="255.255.255.0" value={newBridge.netmask} onChange={e => setNewBridge(p => ({ ...p, netmask: e.target.value }))} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddBridgeOpen(false)}>Cancel</Button>
              <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleCreateBridge}>Create Bridge</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bond Create Dialog */}
        <Dialog open={addBondOpen} onOpenChange={setAddBondOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Network Bond</DialogTitle>
              <DialogDescription>Create a bonded interface for link aggregation or redundancy</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="space-y-2">
                <Label>Bond Name</Label>
                <Input placeholder="e.g., bond0, bond1" value={newBond.name} onChange={e => setNewBond(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Mode</Label>
                <Select value={newBond.mode} onValueChange={v => setNewBond(p => ({ ...p, mode: v }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active-backup">Active-Backup</SelectItem>
                    <SelectItem value="balance-rr">Balance-RR</SelectItem>
                    <SelectItem value="balance-xor">Balance-XOR</SelectItem>
                    <SelectItem value="802.3ad">802.3ad (LACP)</SelectItem>
                    <SelectItem value="balance-tlb">Balance-TLB</SelectItem>
                    <SelectItem value="balance-alb">Balance-ALB</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Member Interfaces</Label>
                {(() => {
                  const bridgeMemberNames = bridges.flatMap(b => b.members);
                  const usedInBond = bonds.flatMap(b => b.members);
                  const available = interfaces.filter(i =>
                    (i.type === 'ethernet') &&
                    !usedInBond.includes(i.name) &&
                    !bridgeMemberNames.includes(i.name)
                  );
                  return available.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-3">No available ethernet interfaces. All may be in use by bridges or existing bonds.</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {available.map(i => (
                        <label key={i.id} className="flex items-center gap-2 p-2 rounded-md border hover:bg-muted/50 cursor-pointer">
                          <input type="checkbox" checked={newBond.members.includes(i.name)}
                            onChange={e => setNewBond(p => ({ ...p, members: e.target.checked ? [...p.members, i.name] : p.members.filter(m => m !== i.name) }))} className="accent-teal-600" />
                          <span className="text-sm font-mono">{i.name}</span>
                          <span className="text-[10px] text-muted-foreground truncate">{i.description}</span>
                        </label>
                      ))}
                    </div>
                  );
                })()}
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>MIIMon (ms)</Label>
                  <Input type="number" value={newBond.miimon} onChange={e => setNewBond(p => ({ ...p, miimon: parseInt(e.target.value) || 100 }))} />
                </div>
                <div className="space-y-2">
                  <Label>LACP Rate</Label>
                  <Select value={newBond.lacpRate} onValueChange={v => setNewBond(p => ({ ...p, lacpRate: v }))}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="slow">Slow</SelectItem>
                      <SelectItem value="fast">Fast</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Primary</Label>
                  <Select value={newBond.primary} onValueChange={v => setNewBond(p => ({ ...p, primary: v }))}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {newBond.members.map(m => (<SelectItem key={m} value={m}>{m}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>IP Address (Optional)</Label>
                  <Input className="font-mono" placeholder="10.0.2.1" value={newBond.ipAddress} onChange={e => setNewBond(p => ({ ...p, ipAddress: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Netmask (Optional)</Label>
                  <Input className="font-mono" placeholder="255.255.255.0" value={newBond.netmask} onChange={e => setNewBond(p => ({ ...p, netmask: e.target.value }))} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddBondOpen(false)}>Cancel</Button>
              <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleCreateBond}>Create Bond</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ═══════ TAB 5: PORT FORWARDING ═══════ */}
        {activeTab === 'port-forwarding' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between gap-3">
              <p className="text-sm text-muted-foreground">{portForwards.length} rules configured</p>
              <div className="flex gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Filter className="h-4 w-4 mr-2" />
                      Bulk Actions
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => handleBulkTogglePortForwards(true)}>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Enable All
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleBulkTogglePortForwards(false)}>
                      <XCircle className="h-4 w-4 mr-2" />
                      Disable All
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button onClick={() => setAddPortForwardOpen(true)} className="bg-teal-600 hover:bg-teal-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Rule
                </Button>
              </div>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="font-semibold">Name</TableHead>
                      <TableHead className="font-semibold">Protocol</TableHead>
                      <TableHead className="font-semibold">Ext Port</TableHead>
                      <TableHead className="font-semibold">Internal IP</TableHead>
                      <TableHead className="font-semibold">Int Port</TableHead>
                      <TableHead className="font-semibold">Interface</TableHead>
                      <TableHead className="font-semibold">Enabled</TableHead>
                      <TableHead className="text-right font-semibold">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {portForwards.map((pf) => (
                      <TableRow key={pf.id} className="group">
                        <TableCell className="font-medium text-sm">{pf.name}</TableCell>
                        <TableCell>
                          <Badge className={cn('text-[10px]', protocolBadgeColor[pf.protocol])}>
                            {pf.protocol}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{pf.extPort}</TableCell>
                        <TableCell className="font-mono text-sm">{pf.internalIp}</TableCell>
                        <TableCell className="font-mono text-sm">{pf.internalPort}</TableCell>
                        <TableCell className="font-mono text-sm">{pf.iface}</TableCell>
                        <TableCell>
                          <Switch checked={pf.enabled} onCheckedChange={() => handleTogglePortForward(pf.id)} />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleOpenEditPortForward(pf)}>
                                  <Edit2 className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Edit Rule</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:text-red-600" onClick={() => handleDeletePortForward(pf.id)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Delete Rule</TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Add Port Forward Dialog */}
            <Dialog open={addPortForwardOpen} onOpenChange={setAddPortForwardOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Port Forward Rule</DialogTitle>
                  <DialogDescription>Create a new NAT forwarding rule</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-2">
                  <div className="space-y-2">
                    <Label>Rule Name</Label>
                    <Input placeholder="e.g., Web Server" value={newPortForward.name} onChange={e => setNewPortForward(p => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Protocol</Label>
                      <Select value={newPortForward.protocol} onValueChange={v => setNewPortForward(p => ({ ...p, protocol: v }))}>
                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="TCP">TCP</SelectItem>
                          <SelectItem value="UDP">UDP</SelectItem>
                          <SelectItem value="TCP/UDP">TCP/UDP</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Interface</Label>
                      <Select value={newPortForward.iface} onValueChange={v => setNewPortForward(p => ({ ...p, iface: v }))}>
                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {interfaces.filter(i => i.status === 'up').map(i => (
                            <SelectItem key={i.id} value={i.name}>{i.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>External Port</Label>
                      <Input placeholder="80" value={newPortForward.extPort} onChange={e => setNewPortForward(p => ({ ...p, extPort: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Internal Port</Label>
                      <Input placeholder="80" value={newPortForward.internalPort} onChange={e => setNewPortForward(p => ({ ...p, internalPort: e.target.value }))} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Internal IP Address</Label>
                    <Input placeholder="192.168.1.10" value={newPortForward.internalIp} onChange={e => setNewPortForward(p => ({ ...p, internalIp: e.target.value }))} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddPortForwardOpen(false)}>Cancel</Button>
                  <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleAddPortForward}>Add Rule</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Edit Port Forward Dialog */}
            <Dialog open={editPortForwardOpen} onOpenChange={setEditPortForwardOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Rule — {selectedPortForward?.name}</DialogTitle>
                  <DialogDescription>Modify port forwarding configuration</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-2">
                  <div className="space-y-2">
                    <Label>Rule Name</Label>
                    <Input value={editPortForwardData.name} onChange={e => setEditPortForwardData(p => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Protocol</Label>
                      <Select value={editPortForwardData.protocol} onValueChange={v => setEditPortForwardData(p => ({ ...p, protocol: v }))}>
                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="TCP">TCP</SelectItem>
                          <SelectItem value="UDP">UDP</SelectItem>
                          <SelectItem value="TCP/UDP">TCP/UDP</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Interface</Label>
                      <Select value={editPortForwardData.iface} onValueChange={v => setEditPortForwardData(p => ({ ...p, iface: v }))}>
                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {interfaces.filter(i => i.status === 'up').map(i => (
                            <SelectItem key={i.id} value={i.name}>{i.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>External Port</Label>
                      <Input value={editPortForwardData.extPort} onChange={e => setEditPortForwardData(p => ({ ...p, extPort: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Internal Port</Label>
                      <Input value={editPortForwardData.internalPort} onChange={e => setEditPortForwardData(p => ({ ...p, internalPort: e.target.value }))} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Internal IP Address</Label>
                    <Input value={editPortForwardData.internalIp} onChange={e => setEditPortForwardData(p => ({ ...p, internalIp: e.target.value }))} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setEditPortForwardOpen(false)}>Cancel</Button>
                  <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleSaveEditPortForward}>Save Changes</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}

        {/* ═══════ TAB 6: CONTENT FILTERING ═══════ */}
        {activeTab === 'content-filtering' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                Manage DNS-based content filtering categories. Block or allow specific website categories for guest and staff networks.
              </p>
              <Button onClick={() => setAddFilterOpen(true)} className="bg-teal-600 hover:bg-teal-700">
                <Plus className="h-4 w-4 mr-2" />
                Add Filter
              </Button>
            </div>

            {loadingFilters ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
                <span className="ml-3 text-sm text-muted-foreground">Loading content filters…</span>
              </div>
            ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filterCategories.map((cat) => (
                <Card
                  key={cat.id}
                  className="transition-all duration-200 hover:scale-[1.01] hover:shadow-md border-border/50"
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className={cn(
                        'p-2.5 rounded-xl bg-gradient-to-br text-white shadow-sm',
                        filterCategoryColors[cat.name] || 'from-slate-500 to-gray-600'
                      )}>
                        {filterCategoryIcons[cat.icon] || <Shield className="h-6 w-6" />}
                      </div>
                      <div className="flex items-center gap-1">
                        <Switch checked={cat.enabled} onCheckedChange={() => handleToggleFilter(cat.id)} />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-red-600"
                          onClick={() => handleDeleteFilter(cat.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <CardTitle className="text-sm font-semibold mb-1">{cat.name}</CardTitle>
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="outline" className="text-[10px]">
                        {cat.domainCount.toLocaleString()} domains
                      </Badge>
                      {cat.enabled ? (
                        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-[10px]">
                          <CheckCircle2 className="h-3 w-3 mr-1" />Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">
                          <XCircle className="h-3 w-3 mr-1" />Disabled
                        </Badge>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => handleOpenEditFilter(cat)}
                    >
                      <Edit2 className="h-3.5 w-3.5 mr-1.5" />
                      Edit Domains
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
            )}

            {/* Edit Filter Dialog */}
            <Dialog open={editFilterOpen} onOpenChange={setEditFilterOpen}>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Edit Category — {selectedFilter?.name}</DialogTitle>
                  <DialogDescription>Manage the domain list for this filter category. One domain per line.</DialogDescription>
                </DialogHeader>
                <div className="py-2">
                  <Label className="mb-2 block">Domain List</Label>
                  <Textarea
                    value={editFilterDomains}
                    onChange={e => setEditFilterDomains(e.target.value)}
                    rows={10}
                    className="font-mono text-xs"
                    placeholder="Enter one domain per line..."
                  />
                  {selectedFilter?.name === 'Adult Content' || selectedFilter?.name === 'Malware' ? (
                    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      This category uses an automatically maintained blocklist. Custom entries will be merged.
                    </p>
                  ) : null}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setEditFilterOpen(false)}>Cancel</Button>
                  <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleSaveEditFilter}>Save Domains</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Add Filter Dialog */}
            <Dialog open={addFilterOpen} onOpenChange={setAddFilterOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Filter Category</DialogTitle>
                  <DialogDescription>Create a new DNS-based content filter category</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-2">
                  <div className="space-y-2">
                    <Label>Filter Name</Label>
                    <Input
                      placeholder="e.g., Social Media"
                      value={newFilter.name}
                      onChange={e => setNewFilter(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={newFilter.category} onValueChange={value => setNewFilter(prev => ({ ...prev, category: value }))}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="social_media">Social Media</SelectItem>
                        <SelectItem value="streaming">Streaming</SelectItem>
                        <SelectItem value="adult">Adult Content</SelectItem>
                        <SelectItem value="gaming">Gaming</SelectItem>
                        <SelectItem value="malware">Malware</SelectItem>
                        <SelectItem value="ads">Ads & Trackers</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={newFilter.enabled}
                      onCheckedChange={checked => setNewFilter(prev => ({ ...prev, enabled: checked }))}
                    />
                    <Label>Enable immediately</Label>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddFilterOpen(false)}>Cancel</Button>
                  <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleCreateFilter}>Create Filter</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}

        {/* ═══════ TAB 7: SCHEDULES ═══════ */}
        {activeTab === 'schedules' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">{schedules.length} schedules configured</p>
              <Button onClick={() => setAddScheduleOpen(true)} className="bg-teal-600 hover:bg-teal-700">
                <Plus className="h-4 w-4 mr-2" />
                Add Schedule
              </Button>
            </div>

            {loadingSchedules ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
                <span className="ml-3 text-sm text-muted-foreground">Loading schedules…</span>
              </div>
            ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="font-semibold">Name</TableHead>
                      <TableHead className="font-semibold">Days</TableHead>
                      <TableHead className="font-semibold">Time Range</TableHead>
                      <TableHead className="font-semibold">Apply To</TableHead>
                      <TableHead className="font-semibold">Action</TableHead>
                      <TableHead className="font-semibold">Enabled</TableHead>
                      <TableHead className="font-semibold w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {schedules.map((sch) => (
                      <TableRow key={sch.id}>
                        <TableCell className="font-medium text-sm">{sch.name}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {dayNames.map((day, idx) => (
                              <div
                                key={day}
                                className={cn(
                                  'w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-medium transition-colors',
                                  sch.days[idx]
                                    ? 'bg-teal-500/15 text-teal-700 dark:text-teal-400 border border-teal-500/30'
                                    : 'bg-muted text-muted-foreground/50 border border-transparent'
                                )}
                              >
                                {day[0]}
                              </div>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-sm">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="font-mono">{sch.startTime} — {sch.endTime}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{sch.applyTo}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={cn(
                            'text-xs',
                            sch.action.includes('Allow') || sch.action.includes('Full')
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                              : sch.action.includes('Block')
                              ? 'bg-red-500/15 text-red-700 dark:text-red-400'
                              : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                          )}>
                            {sch.action}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Switch checked={sch.enabled} onCheckedChange={() => handleToggleSchedule(sch.id)} />
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-red-600"
                            onClick={() => handleDeleteSchedule(sch.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            )}

            {/* Add Schedule Dialog */}
            <Dialog open={addScheduleOpen} onOpenChange={setAddScheduleOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Schedule</DialogTitle>
                  <DialogDescription>Create a time-based access control rule</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-2">
                  <div className="space-y-2">
                    <Label>Schedule Name</Label>
                    <Input
                      placeholder="e.g., Business Hours WiFi"
                      value={newSchedule.name}
                      onChange={e => setNewSchedule(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Days of Week</Label>
                    <div className="flex gap-2">
                      {dayNames.map((day, idx) => (
                        <button
                          key={day}
                          onClick={() => setNewSchedule(prev => {
                            const days = [...prev.days];
                            days[idx] = !days[idx];
                            return { ...prev, days };
                          })}
                          className={cn(
                            'w-10 h-10 rounded-lg border text-xs font-medium transition-colors',
                            newSchedule.days[idx]
                              ? 'border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-400'
                              : 'border-border bg-muted/50 text-muted-foreground hover:bg-teal-500/10 hover:border-teal-500/30 hover:text-teal-700 dark:hover:text-teal-400'
                          )}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Start Time</Label>
                      <Input
                        type="time"
                        value={newSchedule.startTime}
                        onChange={e => setNewSchedule(prev => ({ ...prev, startTime: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>End Time</Label>
                      <Input
                        type="time"
                        value={newSchedule.endTime}
                        onChange={e => setNewSchedule(prev => ({ ...prev, endTime: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Apply To</Label>
                    <Select value={newSchedule.applyTo} onValueChange={value => setNewSchedule(prev => ({ ...prev, applyTo: value }))}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Guest VLAN">Guest VLAN</SelectItem>
                        <SelectItem value="All Guests">All Guests</SelectItem>
                        <SelectItem value="Guest Network">Guest Network</SelectItem>
                        <SelectItem value="Staff VLAN">Staff VLAN</SelectItem>
                        <SelectItem value="All Networks">All Networks</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Action</Label>
                    <Select value={newSchedule.action} onValueChange={value => setNewSchedule(prev => ({ ...prev, action: value }))}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Allow">Allow Full Access</SelectItem>
                        <SelectItem value="Allow Full">Allow Full</SelectItem>
                        <SelectItem value="Block Streaming">Block Streaming</SelectItem>
                        <SelectItem value="Throttle 50%">Throttle Speed 50%</SelectItem>
                        <SelectItem value="Block All">Block All Access</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={newSchedule.enabled}
                      onCheckedChange={checked => setNewSchedule(prev => ({ ...prev, enabled: checked }))}
                    />
                    <Label>Enable immediately</Label>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddScheduleOpen(false)}>Cancel</Button>
                  <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleAddSchedule}>Create Schedule</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}

        {/* ═══════ TAB 8: BACKUP ═══════ */}
        {activeTab === 'backup' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between gap-3">
              <p className="text-sm text-muted-foreground">{backups.length} backup snapshots available</p>
              <div className="flex gap-2">
                <Button variant="outline">
                  <Upload className="h-4 w-4 mr-2" />
                  Import Config
                </Button>
                <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleCreateBackup}>
                  <Download className="h-4 w-4 mr-2" />
                  Create Backup
                </Button>
              </div>
            </div>

            {loadingBackups ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
                <span className="ml-3 text-sm text-muted-foreground">Loading backups…</span>
              </div>
            ) : (
            <div className="space-y-3">
              {backups.map((backup) => (
                <Card
                  key={backup.id}
                  className="transition-all duration-200 hover:scale-[1.005] hover:shadow-md border-border/50"
                >
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'p-2 rounded-lg',
                          backup.type === 'auto' ? 'bg-amber-500/10' : 'bg-teal-500/10'
                        )}>
                          {backup.type === 'auto' ? (
                            <Clock className="h-4 w-4 text-amber-600" />
                          ) : (
                            <Copy className="h-4 w-4 text-teal-600" />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{backup.name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            <span>{backup.date}</span>
                            <span>•</span>
                            <span className="font-mono">v{backup.version}</span>
                            <span>•</span>
                            <span>{backup.size}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={cn(
                          'text-[10px]',
                          backup.type === 'auto'
                            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                            : 'bg-teal-500/15 text-teal-700 dark:text-teal-400'
                        )}>
                          {backup.type === 'auto' ? (
                            <><Clock className="h-3 w-3 mr-1" />Automatic</>
                          ) : (
                            <><Copy className="h-3 w-3 mr-1" />Manual</>
                          )}
                        </Badge>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 text-xs">
                              <Download className="h-3.5 w-3.5 mr-1" />
                              Download
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Download this backup</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 text-xs text-orange-600 hover:text-orange-700 border-orange-500/30 hover:bg-orange-500/10" onClick={() => handleRestoreBackup(backup.id)}>
                              <Upload className="h-3.5 w-3.5 mr-1" />
                              Restore
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Restore from this backup</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            )}

            {/* Empty state hint */}
            <Card className="bg-muted/30 border-dashed border-2 border-border/50">
              <CardContent className="p-6 flex flex-col items-center text-center">
                <div className="p-3 rounded-full bg-teal-500/10 mb-3">
                  <Download className="h-6 w-6 text-teal-600" />
                </div>
                <p className="font-medium text-sm">Automated backups run weekly</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Backups are stored locally. Create manual backups before making critical changes.
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
