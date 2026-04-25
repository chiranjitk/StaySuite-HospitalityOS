'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  History,
  Search,
  Filter,
  Download,
  RefreshCw,
  User,
  Clock,
  Shield,
  Calendar,
  Building2,
  Users,
  Package,
  Settings,
  Wifi,
  Zap,
  BarChart3,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
  Key,
  ChevronLeft,
  ChevronRight,
  Eye,
  TrendingUp,
  AlertCircle,
  Monitor,
  Globe,
  CreditCard,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// Types
interface AuditLogEntry {
  id: string;
  userId: string | null;
  module: string;
  action: string;
  entityType: string;
  entityId: string | null;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  correlationId: string | null;
  createdAt: string;
  userName: string;
}

interface AuditStats {
  total: number;
  byModule: Record<string, number>;
  byAction: Record<string, number>;
  byUser: Array<{ userId: string; userName: string; count: number }>;
  recentActivity: Array<{ date: string; count: number }>;
  topIpAddresses: Array<{ ipAddress: string; count: number }>;
  topEntityTypes: Array<{ entityType: string; count: number }>;
  securityEventsCount: number;
  failedLoginsCount: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// Module icons
const moduleIcons: Record<string, React.ElementType> = {
  auth: Key,
  admin: Shield,
  bookings: Calendar,
  guests: Users,
  rooms: Building2,
  billing: CreditCard,
  inventory: Package,
  housekeeping: History,
  channel: Globe,
  integrations: Zap,
  settings: Settings,
  users: Users,
  reports: BarChart3,
  wifi: Wifi,
  pos: CreditCard,
  parking: Monitor,
  iot: Zap,
  notifications: Monitor,
  webhooks: Globe,
  automation: Zap,
  ai: BarChart3,
  security: Shield,
  system: Monitor,
};

// Module colors
const moduleColors: Record<string, string> = {
  auth: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200',
  admin: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200',
  bookings: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-200',
  guests: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-200',
  rooms: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-200',
  billing: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200',
  inventory: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200',
  housekeeping: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-200',
  channel: 'bg-indigo-500/10 text-indigo-600 border-indigo-200',
  security: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-200',
  default: 'bg-gray-500/10 text-gray-600 border-gray-200',
};

// Action colors
const actionColors: Record<string, string> = {
  create: 'text-green-600 dark:text-green-400',
  update: 'text-blue-600 dark:text-blue-400',
  login: 'text-green-600 dark:text-green-400',
  check_in: 'text-green-600 dark:text-green-400',
  check_out: 'text-blue-600 dark:text-blue-400',
  confirm: 'text-green-600 dark:text-green-400',
  payment: 'text-green-600 dark:text-green-400',
  modify: 'text-amber-600 dark:text-amber-400',
  cancel: 'text-amber-600 dark:text-amber-400',
  refund: 'text-amber-600 dark:text-amber-400',
  delete: 'text-red-600 dark:text-red-400',
  logout: 'text-red-600 dark:text-red-400',
  login_failed: 'text-red-600 dark:text-red-400',
  access_denied: 'text-red-600 dark:text-red-400',
  suspicious_activity: 'text-red-600 dark:text-red-400',
  default: 'text-gray-600',
};

// Filter options
const moduleOptions = [
  { value: 'all', label: 'All Modules' },
  { value: 'auth', label: 'Authentication' },
  { value: 'admin', label: 'Admin' },
  { value: 'bookings', label: 'Bookings' },
  { value: 'guests', label: 'Guests' },
  { value: 'rooms', label: 'Rooms' },
  { value: 'billing', label: 'Billing' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'housekeeping', label: 'Housekeeping' },
  { value: 'channel', label: 'Channel Manager' },
  { value: 'security', label: 'Security' },
  { value: 'settings', label: 'Settings' },
  { value: 'users', label: 'Users' },
  { value: 'system', label: 'System' },
];

const actionOptions = [
  { value: 'all', label: 'All Actions' },
  { value: 'create', label: 'Create' },
  { value: 'update', label: 'Update' },
  { value: 'delete', label: 'Delete' },
  { value: 'login', label: 'Login' },
  { value: 'logout', label: 'Logout' },
  { value: 'login_failed', label: 'Failed Login' },
  { value: 'check_in', label: 'Check In' },
  { value: 'check_out', label: 'Check Out' },
  { value: 'cancel', label: 'Cancel' },
  { value: 'payment', label: 'Payment' },
  { value: 'refund', label: 'Refund' },
  { value: 'password_reset', label: 'Password Reset' },
  { value: 'access_denied', label: 'Access Denied' },
];

export function AuditLogsViewer() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1, limit: 50, total: 0, totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedModule, setSelectedModule] = useState('all');
  const [selectedAction, setSelectedAction] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(pagination.page),
        limit: String(pagination.limit),
        ...(selectedModule !== 'all' && { module: selectedModule }),
        ...(selectedAction !== 'all' && { action: selectedAction }),
        ...(searchQuery && { search: searchQuery }),
        ...(dateFrom && { dateFrom }),
        ...(dateTo && { dateTo }),
      });
      const response = await fetch(`/api/audit-logs?${params}`);
      const data = await response.json();
      if (data.success) {
        setLogs(data.data);
        setPagination(prev => ({
          ...prev, total: data.pagination.total, totalPages: data.pagination.totalPages,
        }));
      } else {
        setError(data.error || 'Failed to fetch audit logs');
      }
    } catch {
      setError('Network error occurred');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, selectedModule, selectedAction, searchQuery, dateFrom, dateTo]);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const response = await fetch('/api/audit-logs/stats?days=30');
      const data = await response.json();
      if (data.success) setStats(data.data);
    } catch {
      console.error('Failed to fetch stats');
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
    fetchStats();
  }, [fetchLogs, fetchStats]);

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const handleExport = async (format: 'json' | 'csv') => {
    try {
      const params = new URLSearchParams({
        format, limit: '50000',
        ...(selectedModule !== 'all' && { module: selectedModule }),
        ...(selectedAction !== 'all' && { action: selectedAction }),
        ...(dateFrom && { dateFrom }),
        ...(dateTo && { dateTo }),
      });
      const response = await fetch(`/api/audit-logs/export?${params}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.${format}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      console.error('Export failed');
    }
  };

  const formatDate = (dateStr: string) => 
    new Date(dateStr).toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });

  const getActionIcon = (action: string) => {
    if (action.includes('create') || action.includes('login') || action.includes('check_in'))
      return <CheckCircle className="h-4 w-4 text-green-500 dark:text-green-400" />;
    if (action.includes('delete') || action.includes('failed') || action.includes('denied'))
      return <XCircle className="h-4 w-4 text-red-500 dark:text-red-400" />;
    if (action.includes('update') || action.includes('modify'))
      return <Info className="h-4 w-4 text-blue-500 dark:text-blue-400" />;
    if (action.includes('warning') || action.includes('suspicious'))
      return <AlertTriangle className="h-4 w-4 text-amber-500 dark:text-amber-400" />;
    return <History className="h-4 w-4 text-gray-500" />;
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Events (30 days)</CardDescription>
              <CardTitle className="text-3xl">{stats.total.toLocaleString()}</CardTitle>
            </CardHeader>
            <CardContent className="pb-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
                <span>{stats.recentActivity.slice(-7).reduce((sum, d) => sum + d.count, 0)} this week</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Security Events</CardDescription>
              <CardTitle className="text-3xl">{stats.securityEventsCount}</CardTitle>
            </CardHeader>
            <CardContent className="pb-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Shield className="h-4 w-4" />
                <span>Monitored activities</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Failed Logins</CardDescription>
              <CardTitle className="text-3xl">{stats.failedLoginsCount}</CardTitle>
            </CardHeader>
            <CardContent className="pb-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertCircle className="h-4 w-4" />
                <span>Failed attempts</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Active Users</CardDescription>
              <CardTitle className="text-3xl">{stats.byUser.length}</CardTitle>
            </CardHeader>
            <CardContent className="pb-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>With activity</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by user, IP, entity..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedModule} onValueChange={setSelectedModule}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Module" /></SelectTrigger>
              <SelectContent>
                {moduleOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedAction} onValueChange={setSelectedAction}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Action" /></SelectTrigger>
              <SelectContent>
                {actionOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[140px]" />
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[140px]" />
            <Button variant="outline" size="icon" onClick={() => { fetchLogs(); fetchStats(); }} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => handleExport('json')}>
              <Download className="h-4 w-4 mr-2" /> Export JSON
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('csv')}>
              <Download className="h-4 w-4 mr-2" /> Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <History className="h-5 w-5" />
              Activity Log
            </CardTitle>
            <span className="text-sm text-muted-foreground">
              {pagination.total.toLocaleString()} total entries
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {error && <div className="p-4 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 border-b">{error}</div>}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Timestamp</TableHead>
                  <TableHead className="w-[120px]">User</TableHead>
                  <TableHead className="w-[100px]">Module</TableHead>
                  <TableHead className="w-[120px]">Action</TableHead>
                  <TableHead className="w-[120px]">Entity</TableHead>
                  <TableHead className="w-[130px]">IP Address</TableHead>
                  <TableHead className="w-[80px]">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Loading...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No audit logs found
                    </TableCell>
                  </TableRow>
                ) : logs.map((log) => {
                  const ModuleIcon = moduleIcons[log.module] || History;
                  const moduleColor = moduleColors[log.module] || moduleColors.default;
                  const actionColor = actionColors[log.action] || actionColors.default;
                  return (
                    <TableRow
                      key={log.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => { setSelectedLog(log); setShowDetail(true); }}
                    >
                      <TableCell className="font-mono text-sm">
                        <div className="flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          {formatDate(log.createdAt)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="truncate max-w-[100px]">{log.userName}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("gap-1 font-normal", moduleColor)}>
                          <ModuleIcon className="h-3 w-3" />
                          {log.module}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getActionIcon(log.action)}
                          <span className={cn("text-sm font-medium", actionColor)}>
                            {log.action.replace(/_/g, ' ')}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium">{log.entityType}</div>
                          {log.entityId && <div className="text-xs text-muted-foreground truncate max-w-[100px]">{log.entityId}</div>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="font-mono text-sm">{log.ipAddress || '—'}</span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs max-w-[300px]">UA: {log.userAgent || 'Unknown'}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedLog(log); setShowDetail(true); }}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t">
              <span className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => handlePageChange(pagination.page - 1)} disabled={pagination.page === 1}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                </Button>
                <Button variant="outline" size="sm" onClick={() => handlePageChange(pagination.page + 1)} disabled={pagination.page === pagination.totalPages}>
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Audit Log Details
            </DialogTitle>
            <DialogDescription>Complete details of the activity</DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-muted-foreground">Timestamp</label>
                    <p className="font-medium">{formatDate(selectedLog.createdAt)}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">User</label>
                    <p className="font-medium">{selectedLog.userName}</p>
                    {selectedLog.userId && <p className="text-xs text-muted-foreground">{selectedLog.userId}</p>}
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Module</label>
                    <Badge variant="outline" className={moduleColors[selectedLog.module] || moduleColors.default}>
                      {selectedLog.module}
                    </Badge>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Action</label>
                    <p className="font-medium">{selectedLog.action.replace(/_/g, ' ')}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-muted-foreground">Entity Type</label>
                    <p className="font-medium">{selectedLog.entityType}</p>
                  </div>
                  {selectedLog.entityId && (
                    <div>
                      <label className="text-sm text-muted-foreground">Entity ID</label>
                      <p className="font-mono text-sm">{selectedLog.entityId}</p>
                    </div>
                  )}
                  <div>
                    <label className="text-sm text-muted-foreground">IP Address</label>
                    <p className="font-mono text-sm">{selectedLog.ipAddress || '—'}</p>
                  </div>
                  {selectedLog.correlationId && (
                    <div>
                      <label className="text-sm text-muted-foreground">Correlation ID</label>
                      <p className="font-mono text-xs">{selectedLog.correlationId}</p>
                    </div>
                  )}
                </div>
              </div>
              {selectedLog.userAgent && (
                <div>
                  <label className="text-sm text-muted-foreground">User Agent</label>
                  <p className="text-sm mt-1 p-2 bg-muted rounded-md">{selectedLog.userAgent}</p>
                </div>
              )}
              {selectedLog.oldValue && Object.keys(selectedLog.oldValue).length > 0 && (
                <div>
                  <label className="text-sm text-muted-foreground flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-500 dark:text-red-400" /> Old Value
                  </label>
                  <pre className="mt-1 p-3 bg-red-50 dark:bg-red-950/20 rounded-md text-xs overflow-x-auto">
                    {JSON.stringify(selectedLog.oldValue, null, 2)}
                  </pre>
                </div>
              )}
              {selectedLog.newValue && Object.keys(selectedLog.newValue).length > 0 && (
                <div>
                  <label className="text-sm text-muted-foreground flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 dark:text-green-400" /> New Value
                  </label>
                  <pre className="mt-1 p-3 bg-green-50 dark:bg-green-950/20 rounded-md text-xs overflow-x-auto">
                    {JSON.stringify(selectedLog.newValue, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AuditLogsViewer;
