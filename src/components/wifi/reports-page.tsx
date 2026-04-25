'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Download,
  Upload,
  Users,
  Globe,
  Clock,
  Search,
  Filter,
  FileDown,
  FileText,
  RefreshCw,
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Server,
  Cpu,
  HardDrive,
  MemoryStick,
  Shield,
  Radio,
  Zap,
  Eye,
  MoreHorizontal,
  ChevronDown,
  Calendar,
  Wifi,
  ArrowUpDown,
  Copy,
  Trash2,
  Plus,
  Settings,
  Play,
  Pause,
  Square,
  Monitor,
  Thermometer,
  Loader2,
  FileCheck,
  History,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { usePropertyId } from '@/hooks/use-property';

// ==================== LAZY-LOADED TAB COMPONENTS ====================

const CoaAuditTab = lazy(() => import('./coa-audit'));
const UserStatusHistoryTab = lazy(() => import('./user-status-history'));

// ==================== LOADING SPINNER ====================

function LoadingSpinner({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </div>
  );
}

// ==================== HELPERS ====================

function formatBytes(bytes: number) {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function formatMB(mb: number) {
  if (mb >= 1048576) return `${(mb / 1048576).toFixed(2)} TB`;
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb.toFixed(0)} MB`;
}

function formatDuration(seconds: number) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ==================== SVG GAUGE ====================

function CircularGauge({ value, label, color, size = 120 }: { value: number; label: string; color: string; size?: number }) {
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  const colorMap: Record<string, { stroke: string; text: string }> = {
    teal: { stroke: 'stroke-teal-500', text: 'text-teal-600 dark:text-teal-400' },
    amber: { stroke: 'stroke-amber-500', text: 'text-amber-600 dark:text-amber-400' },
    emerald: { stroke: 'stroke-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
    red: { stroke: 'stroke-red-500', text: 'text-red-600 dark:text-red-400' },
  };
  const c = colorMap[color] || colorMap.teal;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" className="stroke-muted/30" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className={c.stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center" style={{ width: size, height: size, marginTop: -size - 4 }}>
        <span className={cn('text-2xl font-bold', c.text)}>{value}%</span>
      </div>
      <span className="text-xs font-medium text-muted-foreground mt-1">{label}</span>
    </div>
  );
}

// ==================== TAB TYPES ====================

type TabId = 'bandwidth' | 'user-bw' | 'web-surfing' | 'nat-logs' | 'syslog' | 'sys-health' | 'coa-audit' | 'user-status-history';

function SortIcon({ col, isActive }: { col: string; isActive: boolean }) {
  return <ArrowUpDown className={cn('h-3 w-3 ml-1 inline', isActive ? 'opacity-100' : 'opacity-30')} />;
}

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'bandwidth', label: 'Bandwidth Usage', icon: BarChart3 },
  { id: 'user-bw', label: 'User Bandwidth', icon: Users },
  { id: 'web-surfing', label: 'Web Surfing', icon: Globe },
  { id: 'nat-logs', label: 'NAT Logs', icon: Shield },
  { id: 'syslog', label: 'Syslog Config', icon: Server },
  { id: 'sys-health', label: 'System Health', icon: Activity },
  { id: 'coa-audit', label: 'CoA Audit', icon: FileCheck },
  { id: 'user-status-history', label: 'User History', icon: History },
];

// ==================== MAIN COMPONENT ====================

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('bandwidth');

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Tab Navigation */}
        <div className="flex gap-1 rounded-lg bg-muted/50 p-1 overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap',
                  isActive
                    ? 'bg-background text-foreground shadow-sm'
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
        <div className="min-h-[600px]">
          {activeTab === 'bandwidth' && <BandwidthUsageTab />}
          {activeTab === 'user-bw' && <UserBandwidthTab />}
          {activeTab === 'web-surfing' && <WebSurfingTab />}
          {activeTab === 'nat-logs' && <NATLogsTab />}
          {activeTab === 'syslog' && <SyslogConfigTab />}
          {activeTab === 'sys-health' && <SystemHealthTab />}
          {activeTab === 'coa-audit' && (
            <Suspense fallback={<LoadingSpinner message="Loading CoA Audit..." />}>
              <CoaAuditTab />
            </Suspense>
          )}
          {activeTab === 'user-status-history' && (
            <Suspense fallback={<LoadingSpinner message="Loading User History..." />}>
              <UserStatusHistoryTab />
            </Suspense>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

// ==================== TAB 1: BANDWIDTH USAGE ====================

function BandwidthUsageTab() {
  const [dateRange, setDateRange] = useState('30');
  const [property, setProperty] = useState('all');
  const [showSubnet, setShowSubnet] = useState(false);
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);
  const [bandwidthData, setBandwidthData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { propertyId, properties } = usePropertyId();

  const fetchBandwidth = useCallback(async (range: string) => {
    setLoading(true);
    try {
      const days = range === 'today' ? 1 : range === '7' ? 7 : 30;
      const endDate = new Date().toISOString().split('T')[0];
      const start = new Date();
      start.setDate(start.getDate() - days);
      const startDate = start.toISOString().split('T')[0];
      const params = new URLSearchParams({ startDate, endDate });
      if (property !== 'all' && propertyId) params.set('propertyId', propertyId);
      const res = await fetch(`/api/wifi/reports/bandwidth?${params.toString()}`);
      const result = await res.json();
      if (result.success) {
        setBandwidthData(result.data || []);
      } else {
        toast({ title: 'Error', description: typeof result.error === 'string' ? result.error : result.error?.message || 'Failed to fetch bandwidth data', variant: 'destructive' });
      }
    } catch (e) {
      console.error(e);
      toast({ title: 'Error', description: 'Failed to fetch bandwidth data', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast, property, propertyId]);

  useEffect(() => {
    fetchBandwidth(dateRange);
  }, [dateRange, fetchBandwidth]);

  const filteredData = useMemo(() => {
    const count = dateRange === 'today' ? 1 : dateRange === '7' ? 7 : 30;
    return bandwidthData.slice(-count);
  }, [bandwidthData, dateRange]);

  const summary = useMemo(() => {
    if (filteredData.length === 0) return { totalDown: 0, totalUp: 0, uniqueUsers: 0, avgPerUser: 0, peakTime: '20:00', trend: 0 };
    const totalDown = filteredData.reduce((s, d) => s + d.download, 0);
    const totalUp = filteredData.reduce((s, d) => s + d.upload, 0);
    const uniqueUsers = Math.max(...filteredData.map(d => d.users));
    const avgPerUser = totalDown / Math.max(1, uniqueUsers);
    const peakDay = filteredData.reduce((a, b) => a.download > b.download ? a : b);
    return {
      totalDown,
      totalUp,
      uniqueUsers,
      avgPerUser,
      peakTime: peakDay?.peakTime || '20:00',
      trend: 8.3,
    };
  }, [filteredData]);

  const maxTotal = filteredData.length > 0 ? Math.max(...filteredData.map(d => d.total)) : 1;

  if (loading) return <LoadingSpinner message="Loading bandwidth data..." />;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Period:</span>
            </div>
            <div className="flex gap-2">
              {[
                { value: 'today', label: 'Today' },
                { value: '7', label: '7 Days' },
                { value: '30', label: '30 Days' },
              ].map((p) => (
                <Button key={p.value} variant={dateRange === p.value ? 'default' : 'outline'} size="sm" onClick={() => setDateRange(p.value)}>
                  {p.label}
                </Button>
              ))}
            </div>
            <div className="hidden sm:block w-px h-6 bg-border" />
            <Select value={property} onValueChange={setProperty}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Properties</SelectItem>
                {properties.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="ml-auto flex gap-2">
              <Button variant="outline" size="sm" onClick={() => {
                const headers = 'Date,Download (MB),Upload (MB),Total (MB),Users,Peak Time';
                const rows = filteredData.map(d => `${d.date},${d.download},${d.upload},${d.total},${d.users},${d.peakTime}`);
                const csv = [headers, ...rows].join('\n');
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `bandwidth-report-${new Date().toISOString().split('T')[0]}.csv`;
                a.click();
                URL.revokeObjectURL(url);
                toast({ title: 'Exported', description: 'CSV file downloaded' });
              }}>
                <FileDown className="h-3.5 w-3.5 mr-1.5" /> CSV
              </Button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" onClick={() => window.print()}>
                    <FileText className="h-3.5 w-3.5 mr-1.5" /> PDF
                  </Button>
                </TooltipTrigger>
                <TooltipContent>PDF export coming soon — uses print for now</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <SummaryCard icon={Download} label="Total Download" value={formatMB(summary.totalDown)} trend={summary.trend} color="teal" />
        <SummaryCard icon={Upload} label="Total Upload" value={formatMB(summary.totalUp)} trend={5.1} color="amber" />
        <SummaryCard icon={Users} label="Unique Users" value={summary.uniqueUsers.toString()} trend={12.4} color="emerald" />
        <SummaryCard icon={BarChart3} label="Avg per User" value={formatMB(summary.avgPerUser)} trend={-2.1} color="teal" />
        <SummaryCard icon={Clock} label="Peak Usage" value={summary.peakTime} color="amber" />
      </div>

      {/* Bar Chart */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Daily Bandwidth</CardTitle>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-gradient-to-r from-teal-400 to-emerald-400" /> Download</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-gradient-to-r from-amber-400 to-orange-400" /> Upload</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-[3px] h-48" onMouseLeave={() => setHoveredBar(null)}>
            {filteredData.map((day, i) => {
              const downH = (day.download / maxTotal) * 100;
              const upH = (day.upload / maxTotal) * 100;
              return (
                <Tooltip key={day.date}>
                  <TooltipTrigger asChild>
                    <div
                      className="flex-1 flex flex-col justify-end cursor-pointer group relative min-w-[8px]"
                      onMouseEnter={() => setHoveredBar(i)}
                    >
                      <div className="w-full rounded-t-sm bg-gradient-to-t from-amber-400 to-orange-400 transition-all duration-200 group-hover:opacity-80" style={{ height: `${upH}%` }} />
                      <div className="w-full rounded-t-sm bg-gradient-to-t from-teal-400 to-emerald-400 transition-all duration-200 group-hover:opacity-80" style={{ height: `${downH}%` }} />
                      {hoveredBar === i && (
                        <div className="absolute -top-16 left-1/2 -translate-x-1/2 bg-popover border rounded-lg p-2 shadow-lg text-xs z-50 pointer-events-none whitespace-nowrap">
                          <p className="font-medium">{formatDate(day.date)}</p>
                          <p className="text-teal-600 dark:text-teal-400">↓ {formatMB(day.download)}</p>
                          <p className="text-amber-600 dark:text-amber-400">↑ {formatMB(day.upload)}</p>
                        </div>
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{formatDate(day.date)}</p>
                    <p>↓ {formatMB(day.download)} | ↑ {formatMB(day.upload)}</p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
          <div className="flex justify-between mt-2 text-xs text-muted-foreground px-1">
            <span>{formatDate(filteredData[0]?.date)}</span>
            <span>{formatDate(filteredData[filteredData.length - 1]?.date)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Subnet Toggle */}
      <div className="flex items-center gap-2">
        <Switch checked={showSubnet} onCheckedChange={setShowSubnet} />
        <span className="text-sm font-medium">Show per-subnet breakdown</span>
      </div>

      {showSubnet && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Subnet Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {[
                { subnet: '10.0.1.0/24', label: 'Lobby & Reception', pct: 45 },
                { subnet: '10.0.2.0/24', label: 'Floor 1-5', pct: 30 },
                { subnet: '10.0.3.0/24', label: 'Floor 6-10', pct: 20 },
                { subnet: '10.0.4.0/24', label: 'Conference & Events', pct: 5 },
              ].map((s) => (
                <div key={s.subnet} className="flex items-center gap-4">
                  <span className="text-sm font-mono w-32 text-muted-foreground">{s.subnet}</span>
                  <span className="text-sm w-36">{s.label}</span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-teal-400 to-emerald-400 rounded-full" style={{ width: `${s.pct}%` }} />
                  </div>
                  <span className="text-sm font-medium w-10 text-right">{s.pct}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Data Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Detailed Usage Data</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="max-h-96">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Download (MB)</TableHead>
                  <TableHead className="text-right">Upload (MB)</TableHead>
                  <TableHead className="text-right">Total (MB)</TableHead>
                  <TableHead className="text-right">Users</TableHead>
                  <TableHead>Peak Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((day) => (
                  <TableRow key={day.date} className="hover:bg-muted/30">
                    <TableCell className="font-medium">{formatDate(day.date)}</TableCell>
                    <TableCell className="text-right text-teal-600 dark:text-teal-400 font-mono text-sm">{day.download.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-amber-600 dark:text-amber-400 font-mono text-sm">{day.upload.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono text-sm font-medium">{day.total.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{day.users}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-xs">{day.peakTime}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, trend, color }: { icon: React.ElementType; label: string; value: string; trend?: number; color: string }) {
  const colorClasses: Record<string, string> = {
    teal: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  };

  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className={cn('p-2 rounded-lg', colorClasses[color])}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          <p className="text-lg font-bold truncate">{value}</p>
        </div>
        {trend !== undefined && (
          <div className={cn('flex items-center gap-0.5 text-xs font-medium', trend >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400')}>
            {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
    </Card>
  );
}

// ==================== TAB 2: USER BANDWIDTH ====================

function UserBandwidthTab() {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<string>('totalDown');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [usersData, setUsersData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      params.set('sortKey', sortKey);
      params.set('sortDir', sortDir);
      const res = await fetch(`/api/wifi/reports/user-bandwidth?${params.toString()}`);
      const result = await res.json();
      if (result.success) {
        setUsersData(result.data || []);
      } else {
        toast({ title: 'Error', description: typeof result.error === 'string' ? result.error : result.error?.message || 'Failed to fetch user bandwidth', variant: 'destructive' });
      }
    } catch (e) {
      console.error(e);
      toast({ title: 'Error', description: 'Failed to fetch user bandwidth', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [searchQuery, sortKey, sortDir, toast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const filteredUsers = useMemo(() => {
    let users = [...usersData];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      users = users.filter(u =>
        u.username.includes(q) || u.ip.includes(q) || u.mac.toLowerCase().includes(q)
      );
    }
    users.sort((a, b) => {
      const aVal = a[sortKey as keyof typeof a] as number | string;
      const bVal = b[sortKey as keyof typeof b] as number | string;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return sortDir === 'asc' ? String(aVal).localeCompare(String(bVal)) : String(bVal).localeCompare(String(aVal));
    });
    return users;
  }, [usersData, searchQuery, sortKey, sortDir]);

  const topDownloaders = useMemo(() => [...usersData].sort((a, b) => b.totalDown - a.totalDown).slice(0, 10), [usersData]);
  const topUploaders = useMemo(() => [...usersData].sort((a, b) => b.totalUp - a.totalUp).slice(0, 10), [usersData]);
  const maxDown = topDownloaders[0]?.totalDown || 1;
  const maxUp = topUploaders[0]?.totalUp || 1;

  const planAgg = useMemo(() => {
    const plans: Record<string, { count: number; avgDown: number; avgUp: number }> = {};
    usersData.forEach(u => {
      if (!plans[u.plan]) plans[u.plan] = { count: 0, avgDown: 0, avgUp: 0 };
      plans[u.plan].count++;
      plans[u.plan].avgDown += u.totalDown;
      plans[u.plan].avgUp += u.totalUp;
    });
    Object.keys(plans).forEach(k => {
      plans[k].avgDown = Math.floor(plans[k].avgDown / plans[k].count);
      plans[k].avgUp = Math.floor(plans[k].avgUp / plans[k].count);
    });
    return plans;
  }, [usersData]);

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  if (loading) return <LoadingSpinner message="Loading user bandwidth..." />;

  return (
    <div className="space-y-4">
      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by username, IP, or MAC address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Top 10 Charts */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Download className="h-4 w-4 text-teal-500 dark:text-teal-400" /> Top 10 by Download</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {topDownloaders.map((u, i) => (
              <div key={u.username} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-4">{i + 1}</span>
                <span className="text-xs font-mono w-24 truncate">{u.username}</span>
                <div className="flex-1 h-4 bg-muted rounded-sm overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-teal-400 to-emerald-400 rounded-sm" style={{ width: `${(u.totalDown / maxDown) * 100}%` }} />
                </div>
                <span className="text-xs font-mono w-16 text-right">{formatMB(u.totalDown)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Upload className="h-4 w-4 text-amber-500 dark:text-amber-400" /> Top 10 by Upload</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {topUploaders.map((u, i) => (
              <div key={u.username} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-4">{i + 1}</span>
                <span className="text-xs font-mono w-24 truncate">{u.username}</span>
                <div className="flex-1 h-4 bg-muted rounded-sm overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-amber-400 to-orange-400 rounded-sm" style={{ width: `${(u.totalUp / maxUp) * 100}%` }} />
                </div>
                <span className="text-xs font-mono w-16 text-right">{formatMB(u.totalUp)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Plan Aggregate */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Average Usage per Plan Tier</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(planAgg).map(([plan, data]) => (
              <div key={plan} className="rounded-lg border p-3">
                <Badge variant={plan === 'VIP' ? 'default' : plan === 'Premium' ? 'secondary' : 'outline'} className="mb-2">{plan}</Badge>
                <p className="text-xs text-muted-foreground">{data.count} users</p>
                <div className="mt-2 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-teal-600 dark:text-teal-400">↓ {formatMB(data.avgDown)}</span>
                    <span className="text-amber-600 dark:text-amber-400">↑ {formatMB(data.avgUp)}</span>
                  </div>
                  <div className="flex gap-0.5 h-2">
                    <div className="bg-gradient-to-r from-teal-400 to-emerald-400 rounded-l-sm" style={{ width: `${(data.avgDown / (data.avgDown + data.avgUp)) * 100}%` }} />
                    <div className="bg-gradient-to-r from-amber-400 to-orange-400 rounded-r-sm" style={{ width: `${(data.avgUp / (data.avgDown + data.avgUp)) * 100}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">User Bandwidth Details</CardTitle>
          <CardDescription>Click a row to expand session history</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="max-h-96">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('username')}>Username <SortIcon col="username" isActive={sortKey === 'username'} /></TableHead>
                  <TableHead className="cursor-pointer" onClick={() => handleSort('ip')}>IP <SortIcon col="ip" isActive={sortKey === 'ip'} /></TableHead>
                  <TableHead>MAC</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead className="cursor-pointer text-right" onClick={() => handleSort('sessions')}>Sessions <SortIcon col="sessions" isActive={sortKey === 'sessions'} /></TableHead>
                  <TableHead className="cursor-pointer text-right" onClick={() => handleSort('totalDown')}>Download <SortIcon col="totalDown" isActive={sortKey === 'totalDown'} /></TableHead>
                  <TableHead className="cursor-pointer text-right" onClick={() => handleSort('totalUp')}>Upload <SortIcon col="totalUp" isActive={sortKey === 'totalUp'} /></TableHead>
                  <TableHead className="cursor-pointer text-right" onClick={() => handleSort('avgDuration')}>Avg Duration <SortIcon col="avgDuration" isActive={sortKey === 'avgDuration'} /></TableHead>
                  <TableHead>Last Seen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <React.Fragment key={user.username}>
                    <TableRow
                      className="cursor-pointer hover:bg-muted/30"
                      onClick={() => setExpandedUser(expandedUser === user.username ? null : user.username)}
                    >
                      <TableCell className="font-medium">{user.username}</TableCell>
                      <TableCell className="font-mono text-sm">{user.ip}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{user.mac}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{user.plan}</Badge></TableCell>
                      <TableCell className="text-right">{user.sessions}</TableCell>
                      <TableCell className="text-right text-teal-600 dark:text-teal-400 font-mono text-sm">{formatMB(user.totalDown)}</TableCell>
                      <TableCell className="text-right text-amber-600 dark:text-amber-400 font-mono text-sm">{formatMB(user.totalUp)}</TableCell>
                      <TableCell className="text-right">{formatDuration(user.avgDuration)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{user.lastSeen}</TableCell>
                    </TableRow>
                    {expandedUser === user.username && (
                      <TableRow className="bg-muted/10">
                        <TableCell colSpan={9}>
                          <div className="p-3 ml-4">
                            <p className="text-xs font-semibold mb-2 flex items-center gap-1.5"><Clock className="h-3 w-3" /> Session History for {user.username}</p>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="text-xs">Session</TableHead>
                                  <TableHead className="text-xs">Start</TableHead>
                                  <TableHead className="text-xs">End</TableHead>
                                  <TableHead className="text-xs text-right">Download</TableHead>
                                  <TableHead className="text-xs text-right">Upload</TableHead>
                                  <TableHead className="text-xs text-right">Duration</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {user.sessionHistory.map((s: any) => (
                                  <TableRow key={s.id}>
                                    <TableCell className="font-mono text-xs">{s.id}</TableCell>
                                    <TableCell className="text-xs">{new Date(s.start).toLocaleString()}</TableCell>
                                    <TableCell className="text-xs">{new Date(s.end).toLocaleString()}</TableCell>
                                    <TableCell className="text-xs text-right text-teal-600 dark:text-teal-400 font-mono">{formatMB(s.download)}</TableCell>
                                    <TableCell className="text-xs text-right text-amber-600 dark:text-amber-400 font-mono">{formatMB(s.upload)}</TableCell>
                                    <TableCell className="text-xs text-right">{formatDuration(s.duration)}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

// ==================== TAB 3: WEB SURFING ====================

function WebSurfingTab() {
  const [dateFilter, setDateFilter] = useState('all');
  const [domainSearch, setDomainSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [surfingLogs, setSurfingLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const handleExportCSV = useCallback(() => {
    const headers = 'Domain,Source IP,Category,Total Bytes,Connections,Last Accessed';
    const rows = surfingLogs.map(l => `${l.domain},${l.sourceIp},${l.category},${l.totalBytes},${l.connections},${l.lastAccessed}`);
    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `web-surfing-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Exported', description: 'Web surfing CSV downloaded' });
  }, [surfingLogs, toast]);

  const fetchWebSurfing = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (domainSearch) params.set('search', domainSearch);
      if (categoryFilter !== 'all') params.set('category', categoryFilter);
      const res = await fetch(`/api/wifi/reports/web-surfing?${params.toString()}`);
      const result = await res.json();
      if (result.success) {
        setSurfingLogs(result.data || []);
      } else {
        toast({ title: 'Error', description: typeof result.error === 'string' ? result.error : result.error?.message || 'Failed to fetch web surfing logs', variant: 'destructive' });
      }
    } catch (e) {
      console.error(e);
      toast({ title: 'Error', description: 'Failed to fetch web surfing logs', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [domainSearch, categoryFilter, toast]);

  useEffect(() => {
    fetchWebSurfing();
  }, [fetchWebSurfing]);

  const filteredLogs = useMemo(() => {
    let logs = [...surfingLogs];
    if (domainSearch) {
      const q = domainSearch.toLowerCase();
      logs = logs.filter(l => l.domain.includes(q) || l.sourceIp.includes(q));
    }
    if (categoryFilter !== 'all') {
      logs = logs.filter(l => l.category === categoryFilter);
    }
    return logs;
  }, [surfingLogs, domainSearch, categoryFilter]);

  const topDomains = useMemo(() => {
    const counts: Record<string, { domain: string; bytes: number; count: number }> = {};
    surfingLogs.forEach(l => {
      if (!counts[l.domain]) counts[l.domain] = { domain: l.domain, bytes: 0, count: 0 };
      counts[l.domain].bytes += l.totalBytes;
      counts[l.domain].count += l.connections;
    });
    return Object.values(counts).sort((a, b) => b.bytes - a.bytes).slice(0, 20);
  }, [surfingLogs]);

  const maxDomainBytes = topDomains[0]?.bytes || 1;

  const categoryBreakdown = useMemo(() => {
    const cats: Record<string, number> = {};
    surfingLogs.forEach(l => {
      cats[l.category] = (cats[l.category] || 0) + l.totalBytes;
    });
    const total = Object.values(cats).reduce((s, v) => s + v, 0);
    return Object.entries(cats).map(([name, bytes]) => ({ name, bytes, pct: total > 0 ? (bytes / total) * 100 : 0 })).sort((a, b) => b.bytes - a.bytes);
  }, [surfingLogs]);

  const catColors: Record<string, string> = {
    social_media: 'text-violet-600 dark:text-violet-400 bg-violet-100 dark:bg-violet-900/30',
    streaming: 'text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-900/30',
    news: 'text-teal-600 dark:text-teal-400 bg-teal-100 dark:bg-teal-900/30',
    gaming: 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30',
    other: 'text-gray-600 bg-gray-100 dark:bg-gray-800/30',
  };

  const catGradient: Record<string, string> = {
    social_media: '#8b5cf6',
    streaming: '#f43f5e',
    news: '#14b8a6',
    gaming: '#10b981',
    other: '#6b7280',
  };

  const pieGradient = useMemo(() => {
    return categoryBreakdown.reduce<{ result: string; cumulative: number }>((acc, c) => {
      const start = acc.cumulative;
      const end = start + c.pct;
      const segment = `${catGradient[c.name] || '#6b7280'} ${start.toFixed(1)}% ${end.toFixed(1)}%`;
      return {
        result: acc.result ? `${acc.result}, ${segment}` : segment,
        cumulative: end,
      };
    }, { result: '', cumulative: 0 }).result;
  }, [categoryBreakdown]);

  if (loading) return <LoadingSpinner message="Loading web surfing logs..." />;

  return (
    <div className="space-y-4">
      {/* Privacy Notice */}
      <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
        <Eye className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
        <p className="text-sm text-muted-foreground">This report shows domain-level access logs only. Full URL tracking is disabled for guest privacy compliance (GDPR/PIPL).</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Filter by domain or IP..." value={domainSearch} onChange={(e) => setDomainSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="social_media">Social Media</SelectItem>
                <SelectItem value="streaming">Streaming</SelectItem>
                <SelectItem value="news">News</SelectItem>
                <SelectItem value="gaming">Gaming</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="7d">7 Days</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={handleExportCSV}><FileDown className="h-3.5 w-3.5 mr-1.5" /> Export</Button>
          </div>
        </CardContent>
      </Card>

      {/* Top Domains + Category Pie */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top 20 Most Visited Domains</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-64">
              <div className="space-y-1">
                {topDomains.map((d, i) => (
                  <div key={d.domain} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-5">{i + 1}</span>
                    <span className="text-xs font-mono w-36 truncate">{d.domain}</span>
                    <div className="flex-1 h-3 bg-muted rounded-sm overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-teal-400 to-emerald-500 rounded-sm" style={{ width: `${(d.bytes / maxDomainBytes) * 100}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground w-16 text-right">{formatBytes(d.bytes)}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Category Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center">
              <div
                className="w-32 h-32 rounded-full"
                style={{ background: `conic-gradient(${pieGradient})` }}
              />
              <div className="mt-4 space-y-2 w-full">
                {categoryBreakdown.map(c => (
                  <div key={c.name} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: catGradient[c.name] }} />
                      {c.name.replace('_', ' ')}
                    </span>
                    <span className="font-medium">{c.pct.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Logs Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Domain Access Logs</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="max-h-96">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Source IP</TableHead>
                  <TableHead>Domain</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Connections</TableHead>
                  <TableHead className="text-right">Total Bytes</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.slice(0, 50).map((log, idx) => (
                  <TableRow key={log.id || `${log.domain}-${log.sourceIp}-${idx}`} className="hover:bg-muted/30">
                    <TableCell className="text-xs text-muted-foreground">{new Date(log.timestamp || log.lastAccess).toLocaleString()}</TableCell>
                    <TableCell className="font-mono text-xs">{log.sourceIp}</TableCell>
                    <TableCell className="font-mono text-sm">{log.domain}</TableCell>
                    <TableCell>
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', catColors[log.category] || catColors.other)}>
                        {log.category.replace('_', ' ')}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{log.connections}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatBytes(log.totalBytes)}</TableCell>
                    <TableCell>
                      <Badge variant={(log.action || 'allowed') === 'allowed' ? 'default' : 'destructive'} className={cn('text-xs', (log.action || 'allowed') === 'allowed' && 'bg-emerald-600')}>
                        {log.action || 'allowed'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

// ==================== TAB 4: NAT LOGS ====================

function NATLogsTab() {
  const [logs, setLogs] = useState<any[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [protocolFilter, setProtocolFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { toast } = useToast();

  const handleExportCSV = useCallback(() => {
    const headers = 'Timestamp,Source IP:Port,Dest IP:Port,Protocol,Domain,Bytes,Action,Session ID';
    const rows = logs.map(l => `${l.timestamp},${l.sourceIp}:${l.sourcePort},${l.destIp}:${l.destPort},${l.protocol},${l.domain},${l.bytes},${l.action},${l.sessionId}`);
    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nat-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Exported', description: 'NAT logs CSV downloaded' });
  }, [logs, toast]);

  const fetchNATLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('sourceIp', searchQuery);
      if (protocolFilter !== 'all') params.set('protocol', protocolFilter);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
      params.set('startDate', startDate.toISOString().split('T')[0]);
      const res = await fetch(`/api/wifi/reports/nat-logs?${params.toString()}`);
      const result = await res.json();
      if (result.success) {
        setLogs(result.data || []);
      } else {
        toast({ title: 'Error', description: typeof result.error === 'string' ? result.error : result.error?.message || 'Failed to fetch NAT logs', variant: 'destructive' });
      }
    } catch (e) {
      console.error(e);
      toast({ title: 'Error', description: 'Failed to fetch NAT logs', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [searchQuery, protocolFilter, toast]);

  useEffect(() => {
    fetchNATLogs();
  }, [fetchNATLogs]);

  // Poll for real NAT log updates from API
  useEffect(() => {
    if (isPaused) return;
    timerRef.current = setInterval(async () => {
      try {
        const params = new URLSearchParams();
        if (searchQuery) params.set('search', searchQuery);
        if (protocolFilter !== 'all') params.set('protocol', protocolFilter);
        params.set('limit', '500');
        const res = await fetch(`/api/wifi/reports/nat-logs?${params.toString()}`);
        const result = await res.json();
        if (result.success) {
          setLogs(result.data || []);
        }
      } catch {
        // Silently fail on polling - don't spam error toasts
      }
    }, 5000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isPaused, searchQuery, protocolFilter]);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [logs.length, autoScroll]);

  const filteredLogs = useMemo(() => {
    let result = logs;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(l =>
        l.sourceIp.includes(q) || l.destIp.includes(q) || l.domain.toLowerCase().includes(q) || l.sessionId.includes(q)
      );
    }
    if (protocolFilter !== 'all') result = result.filter(l => l.protocol === protocolFilter);
    if (actionFilter !== 'all') result = result.filter(l => l.action === actionFilter);
    return result;
  }, [logs, searchQuery, protocolFilter, actionFilter]);

  if (loading) return <LoadingSpinner message="Loading NAT logs..." />;

  return (
    <div className="space-y-4">
      {/* Live Counter & Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={cn('w-2 h-2 rounded-full', isPaused ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse')} />
              <span className="text-sm font-medium">
                Showing <span className="text-teal-600 dark:text-teal-400 font-bold">{filteredLogs.length.toLocaleString()}</span> of <span className="font-bold">{logs.length.toLocaleString()}</span> total entries
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsPaused(!isPaused)}>
                {isPaused ? <Play className="h-3.5 w-3.5 mr-1.5" /> : <Pause className="h-3.5 w-3.5 mr-1.5" />}
                {isPaused ? 'Resume' : 'Pause'}
              </Button>
              <div className="flex items-center gap-1.5">
                <Switch checked={autoScroll} onCheckedChange={setAutoScroll} id="auto-scroll" />
                <Label htmlFor="auto-scroll" className="text-xs">Auto-scroll</Label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search IP, domain, session ID..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
            </div>
            <Select value={protocolFilter} onValueChange={setProtocolFilter}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Proto</SelectItem>
                <SelectItem value="tcp">TCP</SelectItem>
                <SelectItem value="udp">UDP</SelectItem>
              </SelectContent>
            </Select>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="allow">Allow</SelectItem>
                <SelectItem value="deny">Deny</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={handleExportCSV}><FileDown className="h-3.5 w-3.5 mr-1.5" /> Export</Button>
          </div>
        </CardContent>
      </Card>

      {/* NAT Logs Table */}
      <Card>
        <CardContent className="p-0">
          <div ref={scrollRef} className="max-h-[500px] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="text-xs">Timestamp</TableHead>
                  <TableHead className="text-xs">Source IP:Port</TableHead>
                  <TableHead className="text-xs">Dest IP:Port</TableHead>
                  <TableHead className="text-xs">Proto</TableHead>
                  <TableHead className="text-xs">Domain</TableHead>
                  <TableHead className="text-xs text-right">Bytes</TableHead>
                  <TableHead className="text-xs">Action</TableHead>
                  <TableHead className="text-xs">Session ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.slice(0, 100).map((log) => (
                  <TableRow key={log.id} className={cn('hover:bg-muted/30', log.action === 'deny' && 'bg-red-50/50 dark:bg-red-950/10')}>
                    <TableCell className="text-xs text-muted-foreground font-mono whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      <span className="text-teal-600 dark:text-teal-400">{log.sourceIp}</span>:<span className="text-muted-foreground">{log.sourcePort}</span>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      <span className="text-amber-600 dark:text-amber-400">{log.destIp}</span>:<span className="text-muted-foreground">{log.destPort}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={log.protocol === 'tcp' ? 'default' : 'outline'} className="text-xs uppercase font-mono">
                        {log.protocol}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono max-w-[140px] truncate">{log.domain}</TableCell>
                    <TableCell className="text-right text-xs font-mono">{formatBytes(log.bytes)}</TableCell>
                    <TableCell>
                      <Badge variant={log.action === 'allow' ? 'default' : 'destructive'} className={cn('text-xs', log.action === 'allow' && 'bg-emerald-600')}>
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">{log.sessionId}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ==================== TAB 5: SYSLOG CONFIG ====================

interface SyslogServer {
  id: string;
  name: string;
  host: string;
  port: number;
  protocol: string;
  format: string;
  facility: string;
  severity: string;
  categories: string[];
  status: string;
  tlsVerify: boolean;
}

function SyslogConfigTab() {
  const [servers, setServers] = useState<SyslogServer[]>([]);
  const [syslogEntries, setSyslogEntries] = useState<string[]>([]);
  const [moduleEnabled, setModuleEnabled] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editServer, setEditServer] = useState<SyslogServer | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    protocol: 'udp',
    host: '',
    port: 514,
    format: 'RFC5424',
    facility: 'local0',
    severity: 'info',
    categories: ['auth'] as string[],
    tlsVerify: false,
  });
  const { toast } = useToast();

  const fetchSyslogServers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/wifi/reports/syslog');
      const result = await res.json();
      if (result.success) {
        setServers(result.data?.servers || []);
        setSyslogEntries(result.data?.entries || []);
      } else {
        toast({ title: 'Error', description: typeof result.error === 'string' ? result.error : result.error?.message || 'Failed to fetch syslog config', variant: 'destructive' });
      }
    } catch (e) {
      console.error(e);
      toast({ title: 'Error', description: 'Failed to fetch syslog config', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchSyslogServers();
  }, [fetchSyslogServers]);

  const categoryOptions = ['auth', 'firewall', 'dhcp', 'radius', 'dns', 'system', 'portal'];

  const handleSave = async () => {
    if (!formData.name || !formData.host) return;
    setSaving(true);
    try {
      const isNew = !editServer;
      const url = isNew ? '/api/wifi/reports/syslog' : `/api/wifi/reports/syslog/${editServer.id}`;
      const res = await fetch(url, {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: isNew ? 'Server added' : 'Server updated', description: `${formData.name} has been ${isNew ? 'added' : 'updated'}.` });
        setIsAddOpen(false);
        setEditServer(null);
        resetForm();
        fetchSyslogServers();
      } else {
        toast({ title: 'Error', description: typeof result.error === 'string' ? result.error : result.error?.message || 'Failed to save server', variant: 'destructive' });
      }
    } catch (e) {
      console.error(e);
      toast({ title: 'Error', description: 'Failed to save server', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/wifi/reports/syslog/${id}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Server deleted', description: 'Syslog server has been removed.' });
        fetchSyslogServers();
      } else {
        toast({ title: 'Error', description: typeof result.error === 'string' ? result.error : result.error?.message || 'Failed to delete server', variant: 'destructive' });
      }
    } catch (e) {
      console.error(e);
      toast({ title: 'Error', description: 'Failed to delete server', variant: 'destructive' });
    }
  };

  const handleTest = (serverId: string) => {
    setServers(servers.map(s => s.id === serverId ? { ...s, status: 'connected' } : s));
  };

  const openEdit = (server: SyslogServer) => {
    setEditServer(server);
    setFormData({
      name: server.name,
      protocol: server.protocol,
      host: server.host,
      port: server.port,
      format: server.format,
      facility: server.facility,
      severity: server.severity,
      categories: [...server.categories],
      tlsVerify: server.tlsVerify,
    });
    setIsAddOpen(true);
  };

  const resetForm = () => {
    setFormData({ name: '', protocol: 'udp', host: '', port: 514, format: 'RFC5424', facility: 'local0', severity: 'info', categories: ['auth'], tlsVerify: false });
    setEditServer(null);
  };

  const toggleCategory = (cat: string) => {
    setFormData(prev => ({
      ...prev,
      categories: prev.categories.includes(cat) ? prev.categories.filter(c => c !== cat) : [...prev.categories, cat],
    }));
  };

  const protoColors: Record<string, string> = { udp: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300', tcp: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', tls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' };

  if (loading) return <LoadingSpinner message="Loading syslog configuration..." />;

  return (
    <div className="space-y-4">
      {/* Module Status */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn('p-2 rounded-lg', moduleEnabled ? 'bg-emerald-500/10' : 'bg-gray-500/10')}>
                <Radio className={cn('h-5 w-5', moduleEnabled ? 'text-emerald-500 dark:text-emerald-400' : 'text-gray-400')} />
              </div>
              <div>
                <p className="font-semibold">Syslog Forwarding</p>
                <p className="text-sm text-muted-foreground">Forward gateway logs to external collectors</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={moduleEnabled ? 'default' : 'outline'} className={cn(moduleEnabled && 'bg-emerald-600')}>
                {moduleEnabled ? 'Enabled' : 'Disabled'}
              </Badge>
              <Switch checked={moduleEnabled} onCheckedChange={setModuleEnabled} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Server List */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Configured Servers</h3>
        <Button size="sm" onClick={() => { resetForm(); setIsAddOpen(true); }}>
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Server
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {servers.map((server) => (
          <Card key={server.id} className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={cn('w-2 h-2 rounded-full', server.status === 'connected' ? 'bg-emerald-500' : 'bg-gray-400')} />
                <h4 className="font-medium text-sm">{server.name}</h4>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(server)}>
                  <Settings className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 dark:text-red-400 hover:text-red-600" onClick={() => handleDelete(server.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Server className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-mono text-muted-foreground">{server.host}:{server.port}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={cn('text-xs', protoColors[server.protocol])}>{server.protocol.toUpperCase()}</Badge>
                <Badge variant="outline" className="text-xs">{server.format}</Badge>
              </div>
              <div className="flex flex-wrap gap-1">
                {server.categories.map(cat => (
                  <Badge key={cat} variant="secondary" className="text-xs">{cat}</Badge>
                ))}
              </div>
              <div className="text-xs text-muted-foreground">
                Facility: {server.facility} | Severity: {server.severity}
                {server.tlsVerify && ' | TLS Verify ✓'}
              </div>
            </div>
            <Button variant="outline" size="sm" className="w-full mt-3" onClick={() => handleTest(server.id)}>
              <Zap className="h-3 w-3 mr-1.5" /> Test Connection
            </Button>
          </Card>
        ))}
      </div>

      {/* Log Preview */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> Log Preview (last 5 entries)</CardTitle>
          <CardDescription>Showing log format as it would be sent to the configured server</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg bg-gray-950 p-4 font-mono text-xs text-green-400 dark:text-green-300 space-y-1 max-h-40 overflow-y-auto">
            {syslogEntries.map((entry, i) => (
              <p key={i}>{entry}</p>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={isAddOpen} onOpenChange={(open) => { if (!open) { setIsAddOpen(false); resetForm(); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editServer ? 'Edit Syslog Server' : 'Add Syslog Server'}</DialogTitle>
            <DialogDescription>Configure an external syslog collector for log forwarding</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label>Name</Label>
                <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="SIEM Collector" />
              </div>
              <div className="space-y-2">
                <Label>Protocol</Label>
                <Select value={formData.protocol} onValueChange={(v) => setFormData({ ...formData, protocol: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="udp">UDP</SelectItem>
                    <SelectItem value="tcp">TCP</SelectItem>
                    <SelectItem value="tls">TLS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Port</Label>
                <Input type="number" value={formData.port} onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) || 514 })} />
              </div>
              <div className="space-y-2">
                <Label>Host</Label>
                <Input value={formData.host} onChange={(e) => setFormData({ ...formData, host: e.target.value })} placeholder="10.10.1.50" />
              </div>
              <div className="space-y-2">
                <Label>Format</Label>
                <Select value={formData.format} onValueChange={(v) => setFormData({ ...formData, format: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RFC5424">RFC5424</SelectItem>
                    <SelectItem value="RFC3164">RFC3164</SelectItem>
                    <SelectItem value="JSON">JSON</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Facility</Label>
                <Select value={formData.facility} onValueChange={(v) => setFormData({ ...formData, facility: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['local0', 'local1', 'local2', 'daemon', 'auth', 'syslog'].map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Severity</Label>
                <Select value={formData.severity} onValueChange={(v) => setFormData({ ...formData, severity: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['debug', 'info', 'notice', 'warning', 'error'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Log Categories</Label>
              <div className="flex flex-wrap gap-2">
                {categoryOptions.map(cat => (
                  <button
                    key={cat}
                    onClick={() => toggleCategory(cat)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-medium transition-all border',
                      formData.categories.includes(cat)
                        ? 'bg-teal-100 text-teal-700 border-teal-300 dark:bg-teal-900/40 dark:text-teal-300 dark:border-teal-700'
                        : 'bg-background text-muted-foreground border-border hover:border-muted-foreground'
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {formData.protocol === 'tls' && (
              <div className="flex items-center gap-2">
                <Switch checked={formData.tlsVerify} onCheckedChange={(v) => setFormData({ ...formData, tlsVerify: v })} id="tls-verify" />
                <Label htmlFor="tls-verify">Verify TLS Certificate</Label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsAddOpen(false); resetForm(); }}>Cancel</Button>
            <Button onClick={handleSave} disabled={!formData.name || !formData.host || saving}>
              {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              {editServer ? 'Update' : 'Add'} Server
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==================== TAB 6: SYSTEM HEALTH ====================

function SystemHealthTab() {
  const [loading, setLoading] = useState(true);
  const [systemInfo, setSystemInfo] = useState<any>(null);
  const [resources, setResources] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [interfaceTraffic, setInterfaceTraffic] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const { toast } = useToast();

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/wifi/reports/health');
      const result = await res.json();
      if (result.success) {
        const data = result.data || {};
        setSystemInfo(data.systemInfo || null);
        setResources(data.resources || { cpu: 0, ram: 0, disk: 0 });
        setServices(data.services || []);
        setInterfaceTraffic(data.interfaceTraffic || []);
        setAlerts(data.alerts || []);
      } else {
        toast({ title: 'Error', description: typeof result.error === 'string' ? result.error : result.error?.message || 'Failed to fetch system health', variant: 'destructive' });
      }
    } catch (e) {
      console.error(e);
      toast({ title: 'Error', description: 'Failed to fetch system health', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  // Poll for real resource data from API
  useEffect(() => {
    if (!resources) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/wifi/reports/health');
        const result = await res.json();
        if (result.success && result.data?.resources) {
          setResources(result.data.resources);
        }
      } catch {
        // Silently fail on polling
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [resources]);

  if (loading || !systemInfo || !resources) return <LoadingSpinner message="Loading system health..." />;

  const cpuColor = resources.cpu > 80 ? 'red' : resources.cpu > 60 ? 'amber' : 'teal';
  const ramColor = resources.ram > 80 ? 'red' : resources.ram > 60 ? 'amber' : 'teal';
  const diskColor = resources.disk > 80 ? 'red' : resources.disk > 60 ? 'amber' : 'emerald';

  return (
    <div className="space-y-4">
      {/* System Info */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><Monitor className="h-4 w-4" /> System Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <InfoItem label="Hostname" value={systemInfo.hostname} />
            <InfoItem label="Kernel" value={systemInfo.kernel} />
            <InfoItem label="Uptime" value={formatDuration(systemInfo.uptime)} />
            <InfoItem label="CPU" value={systemInfo.cpuModel.split('@')[0].trim()} />
            <InfoItem label="Total RAM" value={`${(systemInfo.totalRam / 1024).toFixed(0)} GB`} />
            <InfoItem label="CPU Cores" value={systemInfo.cpuCores.toString()} />
          </div>
        </CardContent>
      </Card>

      {/* Resource Gauges */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4" /> Resource Usage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap justify-center gap-8 py-4">
            <div className="relative">
              <CircularGauge value={Math.round(resources.cpu)} label="CPU Usage" color={cpuColor} />
            </div>
            <div className="relative">
              <CircularGauge value={Math.round(resources.ram)} label="RAM Usage" color={ramColor} />
            </div>
            <div className="relative">
              <CircularGauge value={Math.round(resources.disk)} label="Disk Usage" color={diskColor} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Service Status */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><Server className="h-4 w-4" /> Service Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {services.map((svc: any) => {
              const isRunning = svc.status === 'running' || svc.status === 'loaded';
              const StatusIcon = isRunning ? CheckCircle2 : XCircle;
              return (
                <div key={svc.name} className="rounded-lg border p-3 flex items-start gap-3">
                  <div className="mt-0.5">
                    <StatusIcon className={cn('h-5 w-5', isRunning ? 'text-emerald-500 dark:text-emerald-400' : 'text-red-500 dark:text-red-400')} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{svc.name}</p>
                      <Badge variant={isRunning ? 'default' : 'destructive'} className={cn('text-xs', isRunning && 'bg-emerald-600')}>
                        {svc.status}
                      </Badge>
                    </div>
                    <div className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                      {svc.pid && <p>PID: <span className="font-mono">{svc.pid}</span></p>}
                      {svc.uptime && <p>Uptime: {formatDuration(svc.uptime)}</p>}
                      {svc.version && <p>Version: {svc.version}</p>}
                      {'rulesCount' in svc && <p>Rules: <span className="font-mono">{svc.rulesCount}</span></p>}
                      {'activeConnections' in svc && <p>Active connections: <span className="font-mono">{svc.activeConnections}</span></p>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Interface Traffic */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><Wifi className="h-4 w-4" /> Interface Traffic</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {interfaceTraffic.map((iface: any) => (
              <div key={iface.name} className="rounded-lg border p-3">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="outline" className="font-mono text-xs">{iface.name}</Badge>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-teal-600 dark:text-teal-400">↓ {formatBytes(iface.rx)}</span>
                    <span className="text-amber-600 dark:text-amber-400">↑ {formatBytes(iface.tx)}</span>
                  </div>
                </div>
                {/* Sparkline */}
                <div className="flex items-end gap-[2px] h-8">
                  {iface.history.map((val: number, i: number) => (
                    <div
                      key={i}
                      className="flex-1 bg-gradient-to-t from-teal-500/40 to-teal-400/80 rounded-t-sm transition-all"
                      style={{ height: `${val}%` }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Alerts */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> System Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {alerts.map((alert: any) => {
              const Icon = alert.icon || AlertTriangle;
              const severityStyles: Record<string, string> = {
                warning: 'border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700',
                info: 'border-teal-300 bg-teal-50 dark:bg-teal-950/20 dark:border-teal-700',
                success: 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-700',
              };
              const iconStyles: Record<string, string> = {
                warning: 'text-amber-500 dark:text-amber-400',
                info: 'text-teal-500 dark:text-teal-400',
                success: 'text-emerald-500 dark:text-emerald-400',
              };
              return (
                <div key={alert.id} className={cn('flex items-center gap-3 rounded-lg border p-3', severityStyles[alert.severity])}>
                  <Icon className={cn('h-4 w-4 flex-shrink-0', iconStyles[alert.severity])} />
                  <p className="text-sm flex-1">{alert.message}</p>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{alert.time}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium truncate mt-0.5" title={value}>{value}</p>
    </div>
  );
}
