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
  _osData?: any;
}

const fallbackInterfaces: NetworkInterface[] = [
  { id: 'if-1', name: 'eth0', type: 'ethernet', status: 'up', ipAddress: '10.0.1.1', subnet: '255.255.255.0', mac: '00:1A:2B:3C:4D:01', speed: '1 Gbps', mtu: 1500, rxBytes: 4521984320, txBytes: 2847190230, description: 'Primary WAN uplink' },
  { id: 'if-2', name: 'eth1', type: 'ethernet', status: 'up', ipAddress: '192.168.1.1', subnet: '255.255.255.0', mac: '00:1A:2B:3C:4D:02', speed: '1 Gbps', mtu: 1500, rxBytes: 1289472340, txBytes: 984712340, description: 'LAN - Floor 1' },
  { id: 'if-3', name: 'br0', type: 'bridge', status: 'up', ipAddress: '172.16.0.1', subnet: '255.255.0.0', mac: '00:1A:2B:3C:4D:03', speed: '2 Gbps', mtu: 1500, rxBytes: 3241987234, txBytes: 2847198234, description: 'Management bridge' },
  { id: 'if-4', name: 'bond0', type: 'bond', status: 'up', ipAddress: '10.0.2.1', subnet: '255.255.255.0', mac: '00:1A:2B:3C:4D:04', speed: '2 Gbps', mtu: 9000, rxBytes: 8947192340, txBytes: 6742198340, description: 'WAN failover bond' },
  { id: 'if-5', name: 'wlan0', type: 'wireless', status: 'up', ipAddress: '192.168.10.1', subnet: '255.255.255.0', mac: '00:1A:2B:3C:4D:05', speed: '300 Mbps', mtu: 1500, rxBytes: 2847192340, txBytes: 1247198234, description: 'Guest WiFi AP' },
  { id: 'if-6', name: 'eth2', type: 'ethernet', status: 'down', ipAddress: '—', subnet: '—', mac: '00:1A:2B:3C:4D:06', speed: '1 Gbps', mtu: 1500, rxBytes: 0, txBytes: 0, description: 'Unused - Future expansion' },
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

type TabId = 'interfaces' | 'vlans' | 'bridges-bonds' | 'wan-lan' | 'port-forwarding' | 'content-filtering' | 'schedules' | 'backup';

const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'interfaces', label: 'Interfaces', icon: <Network className="h-4 w-4" /> },
  { id: 'vlans', label: 'VLANs', icon: <Server className="h-4 w-4" /> },
  { id: 'bridges-bonds', label: 'Bridges & Bonds', icon: <ArrowRightLeft className="h-4 w-4" /> },
  { id: 'wan-lan', label: 'WAN/LAN Mapping', icon: <Globe className="h-4 w-4" /> },
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
  const [bonds, setBonds] = useState<BondEntry[]>(mockBonds);
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

  const [newVlan, setNewVlan] = useState({ vlanId: '', parentInterface: 'eth1', description: '', mtu: 1500 });

  const [newPortForward, setNewPortForward] = useState({ name: '', protocol: 'TCP', extPort: '', internalIp: '', internalPort: '', iface: 'eth0' });
  const [editPortForwardData, setEditPortForwardData] = useState({ name: '', protocol: 'TCP', extPort: '', internalIp: '', internalPort: '', iface: '' });

  const [editFilterDomains, setEditFilterDomains] = useState('');

  const [newFilter, setNewFilter] = useState({ name: '', category: 'custom', enabled: true });
  const [newSchedule, setNewSchedule] = useState({ name: '', days: [true, true, true, true, true, false, false] as boolean[], startTime: '06:00', endTime: '22:00', applyTo: 'Guest VLAN', action: 'Allow', enabled: true });

  // ── API data fetchers ──

  const fetchInterfaces = useCallback(async () => {
    setLoadingInterfaces(true);
    try {
      // Try real OS data first via direct OS API (no kea-service dependency)
      const osRes = await fetch('/api/network/os?section=interfaces');
      const osResult = await osRes.json();
      if (osResult.success && Array.isArray(osResult.data) && osResult.data.length > 0) {
        // Filter out virtual/system interfaces — only keep physical, VLAN, bridge, bond, wireless
        const excludedPrefixes = ['lo', 'dummy', 'ifb', 'imq', 'sit', 'tun', 'tap', 'veth', 'virbr', 'nlmon', 'erspan', 'gre', 'gretap', 'ip6gre', 'ip6tnl', 'ipip', 'teql', 'bonding_masters'];
        const filteredOS = osResult.data.filter((iface: any) => {
          const name = iface.name as string;
          return !excludedPrefixes.some(p => name === p || name.startsWith(p));
        });
        const mapped: NetworkInterface[] = filteredOS.map((iface: any) => {
          const typeMap: Record<string, NetworkInterface['type']> = {
            ethernet: 'ethernet', wifi: 'wireless', loopback: 'ethernet',
            bridge: 'bridge', bond: 'bond', vlan: 'vlan',
            virtual: 'ethernet', tunnel: 'ethernet', unknown: 'ethernet',
          };
          return {
            id: iface.name,
            name: iface.name,
            type: typeMap[iface.type] || 'ethernet',
            status: iface.state === 'up' || iface.state === 'unknown' ? 'up' : 'down',
            ipAddress: iface.ipv4Addresses?.[0]?.split('/')[0] || '—',
            subnet: (() => {
              const cidr = iface.ipv4Addresses?.[0]?.split('/')[1];
              if (!cidr) return '—';
              const prefix = parseInt(cidr, 10);
              if (isNaN(prefix) || prefix < 0 || prefix > 32) return '—';
              const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
              return `${(mask >>> 24) & 255}.${(mask >>> 16) & 255}.${(mask >>> 8) & 255}.${mask & 255}`;
            })(),
            mac: iface.macAddress || '—',
            speed: iface.speed || '—',
            mtu: iface.mtu || 1500,
            rxBytes: iface.rxBytes || 0,
            txBytes: iface.txBytes || 0,
            description: iface.isDefaultRoute ? 'Default route (WAN)' : iface.driver || '',
            _osData: iface, // Keep raw OS data for detail views
          };
        });
        setInterfaces(mapped);
        setOsDataLoaded(true);

        // Also derive bridges, bonds, vlans from OS data
        const osBridges: BridgeEntry[] = osResult.data
          .filter((i: any) => i.type === 'bridge')
          .map((i: any) => ({
            id: i.name,
            name: i.name,
            members: i.bridgePorts || [],
            stp: false,
            forwardDelay: 15,
            enabled: i.state === 'up',
          }));
        if (osBridges.length > 0) setBridges(osBridges);

        const osBonds: BondEntry[] = osResult.data
          .filter((i: any) => i.type === 'bond')
          .map((i: any) => ({
            id: i.name,
            name: i.name,
            mode: 'active-backup',
            members: i.bondMembers || [],
            miimon: 100,
            lacpRate: 'slow',
            primary: i.bondMembers?.[0] || '',
          }));
        if (osBonds.length > 0) setBonds(osBonds);

        const osVlans: VLANEntry[] = osResult.data
          .filter((i: any) => i.type === 'vlan')
          .map((i: any) => {
            const parts = i.name.split('.');
            return {
              id: i.name,
              vlanId: parseInt(parts[1]) || 0,
              subInterface: i.name,
              parent: parts[0] || '',
              description: i.ipv4Addresses?.[0] || '',
              mtu: i.mtu || 1500,
              enabled: i.state === 'up',
              dhcpSubnet: i.ipv4Addresses?.[0] || '',
            };
          });
        if (osVlans.length > 0) setVlans(osVlans);

        // Derive roles from OS data
        const osRoles: InterfaceRole[] = osResult.data
          .filter((i: any) => i.type !== 'loopback')
          .map((i: any) => ({
            interfaceId: i.name,
            interfaceName: i.name,
            role: i.role === 'wan' ? 'wan' : i.role === 'management' ? 'management' : i.role === 'guest' ? 'wifi' : i.role === 'lan' ? 'lan' : 'unused',
            priority: i.isDefaultRoute ? 1 : 0,
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
    const matchedRole = roles.find(r => r.interfaceName === iface.name);
    setEditInterfaceData({ 
      name: iface.name, mtu: iface.mtu, description: iface.description,
      mode: iface.ipAddress === '—' ? 'dhcp' : 'static',
      ipAddress: iface.ipAddress === '—' ? '' : iface.ipAddress,
      netmask: iface.subnet === '—' ? '' : iface.subnet,
      gateway: '',
      role: matchedRole?.role || 'unused',
      priority: matchedRole?.priority || 0
    });
    setEditInterfaceOpen(true);
  };

  const handleSaveEditInterface = async () => {
    if (!selectedInterface) return;
    try {
      const matchedRole = roles.find(r => r.interfaceName === selectedInterface.name);
      
      // If using OS data, apply MTU via OS API
      if (osDataLoaded && editInterfaceData.mtu !== selectedInterface.mtu) {
        const mtuRes = await fetch(`/api/network/os/interfaces/${selectedInterface.name}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mtu: editInterfaceData.mtu }),
        });
        const mtuResult = await mtuRes.json();
        if (mtuResult.success) {
          toast({ title: 'MTU Updated', description: `MTU for ${selectedInterface.name} set to ${editInterfaceData.mtu}` });
        }
      }

      // If IP config changed, call IP config API
      if (osDataLoaded && (editInterfaceData.mode !== (selectedInterface.ipAddress === '—' ? 'dhcp' : 'static') ||
          editInterfaceData.ipAddress !== selectedInterface.ipAddress ||
          editInterfaceData.netmask !== selectedInterface.subnet)) {
        await fetch(`/api/network/os/interfaces/${selectedInterface.name}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            mode: editInterfaceData.mode, 
            ipAddress: editInterfaceData.ipAddress, 
            netmask: editInterfaceData.netmask,
            gateway: editInterfaceData.gateway 
          }),
        });
      }

      // If role changed, call role API
      if (matchedRole && editInterfaceData.role !== matchedRole.role) {
        await fetch(`/api/network/os/interfaces/${selectedInterface.name}/role`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: editInterfaceData.role, priority: editInterfaceData.priority }),
        });
      }

      // Also save to DB for metadata
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
    if (!newVlan.vlanId || !newVlan.description.trim()) return;
    try {
      // Create VLAN via OS API first (real ip link command)
      if (osDataLoaded) {
        const osRes = await fetch('/api/network/os/vlans', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            parentInterface: newVlan.parentInterface,
            vlanId: parseInt(newVlan.vlanId),
            description: newVlan.description,
            mtu: newVlan.mtu,
          }),
        });
        const osResult = await osRes.json();
        if (osResult.success) {
          toast({ title: 'VLAN Created on OS', description: osResult.message });
        } else {
          toast({ title: 'OS VLAN Error', description: osResult.output || 'Failed to create VLAN on OS', variant: 'destructive' });
        }
      }
      // Also save to DB
      const parentIface = interfaces.find(i => i.name === newVlan.parentInterface);
      const res = await fetch('/api/wifi/network/vlans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          parentInterfaceId: parentIface?.id || '',
          vlanId: parseInt(newVlan.vlanId),
          subInterface: `${newVlan.parentInterface}.${newVlan.vlanId}`,
          description: newVlan.description,
          mtu: newVlan.mtu,
          enabled: true,
        }),
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'VLAN Created', description: `VLAN ${newVlan.vlanId} has been added.` });
        setAddVlanOpen(false);
        setNewVlan({ vlanId: '', parentInterface: 'eth1', description: '', mtu: 1500 });
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

  // ── Bridge/Bond handlers ──
  const handleToggleBridge = (id: string) => {
    setBridges(prev => prev.map(b => b.id === id ? { ...b, enabled: !b.enabled } : b));
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
                        {matchedRole && (
                          <Badge variant="outline" className={cn('text-[10px] border', roleBadgeColor[matchedRole.role])}>
                            {matchedRole.role.toUpperCase()}
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
                        <span className="text-muted-foreground">IP Address</span>
                        <p className="font-mono font-medium">{iface.ipAddress}</p>
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
                          <TableCell className="font-mono text-sm">{iface.ipAddress}</TableCell>
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
                  <CardTitle className="text-base">Network Bridges</CardTitle>
                  <CardDescription>Group interfaces into a single logical bridge</CardDescription>
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
                            <Switch checked={bridge.enabled} onCheckedChange={() => handleToggleBridge(bridge.id)} />
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
                  <CardTitle className="text-base">Network Bonds</CardTitle>
                  <CardDescription>Aggregate multiple interfaces for redundancy or throughput</CardDescription>
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
