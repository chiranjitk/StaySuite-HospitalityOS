'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Wifi,
  Search,
  Loader2,
  Download,
  CalendarIcon,
  Monitor,
  Smartphone,
  Tablet,
  Laptop,
  Clock,
  ArrowDownToLine,
  ArrowUpFromLine,
  RefreshCw,
  Filter,
  FileDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { format, formatDistanceToNow, subDays } from 'date-fns';
import { DateRange } from 'react-day-picker';

interface WiFiPlan {
  id: string;
  name: string;
  downloadSpeed: number;
  uploadSpeed: number;
  dataLimit: number | null;
}

interface WiFiSession {
  id: string;
  macAddress: string;
  ipAddress: string | null;
  deviceName: string | null;
  deviceType: string | null;
  startTime: string;
  endTime: string | null;
  dataUsed: number;
  duration: number;
  authMethod: string;
  status: string;
  guest?: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
  } | null;
  plan: WiFiPlan | null;
}

interface Guest {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  roomNumber?: string;
}

const sessionStatuses = [
  { value: 'active', label: 'Active', color: 'bg-emerald-500' },
  { value: 'ended', label: 'Ended', color: 'bg-gray-500' },
  { value: 'terminated', label: 'Terminated', color: 'bg-red-500' },
];

const deviceTypes = [
  { value: 'smartphone', label: 'Smartphone', icon: Smartphone },
  { value: 'tablet', label: 'Tablet', icon: Tablet },
  { value: 'laptop', label: 'Laptop', icon: Laptop },
  { value: 'desktop', label: 'Desktop', icon: Monitor },
  { value: 'other', label: 'Other', icon: Monitor },
];

const authMethods = [
  { value: 'voucher', label: 'Voucher' },
  { value: 'social', label: 'Social Login' },
  { value: 'portal', label: 'Captive Portal' },
];

export default function UsageLogs() {
  const { toast } = useToast();
  const [sessions, setSessions] = useState<WiFiSession[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [guestFilter, setGuestFilter] = useState<string>('all');
  const [authMethodFilter, setAuthMethodFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 7),
    to: new Date(),
  });
  const [summary, setSummary] = useState({
    totalDataUsed: 0,
    totalDuration: 0,
    count: 0,
    byStatus: {} as Record<string, number>,
  });
  const [selectedSession, setSelectedSession] = useState<WiFiSession | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Fetch guests for filter dropdown
  useEffect(() => {
    const fetchGuests = async () => {
      try {
        const response = await fetch('/api/guests?limit=100');
        const result = await response.json();
        if (result.success) {
          setGuests(result.data);
        }
      } catch (error) {
        console.error('Error fetching guests:', error);
      }
    };
    fetchGuests();
  }, []);

  // Fetch sessions
  const fetchSessions = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (guestFilter !== 'all') params.append('guestId', guestFilter);
      if (authMethodFilter !== 'all') params.append('authMethod', authMethodFilter);
      if (dateRange?.from) {
        params.append('startDate', dateRange.from.toISOString());
      }
      if (dateRange?.to) {
        params.append('endDate', dateRange.to.toISOString());
      }

      const response = await fetch(`/api/wifi/sessions?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setSessions(result.data);
        setSummary(result.summary);
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch WiFi usage logs',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [statusFilter, guestFilter, authMethodFilter, dateRange]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length >= 2 || searchQuery.length === 0) {
        fetchSessions();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const getDeviceIcon = (deviceType: string | null) => {
    const device = deviceTypes.find(d => d.value === deviceType);
    const Icon = device?.icon || Monitor;
    return <Icon className="h-4 w-4" />;
  };

  const getStatusBadge = (status: string) => {
    const option = sessionStatuses.find(o => o.value === status);
    return (
      <Badge variant="secondary" className={cn('text-white', option?.color)}>
        {option?.label || status}
      </Badge>
    );
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
  };

  const formatDataUsage = (mb: number) => {
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(2)} GB`;
    }
    return `${mb.toFixed(0)} MB`;
  };

  // Export functionality
  const exportToCSV = () => {
    const headers = [
      'Device Name',
      'MAC Address',
      'IP Address',
      'Guest',
      'Plan',
      'Start Time',
      'End Time',
      'Duration',
      'Data Used',
      'Auth Method',
      'Status',
    ];

    const rows = sessions.map(session => [
      session.deviceName || 'Unknown',
      session.macAddress,
      session.ipAddress || 'N/A',
      session.guest ? `${session.guest.firstName} ${session.guest.lastName}` : 'N/A',
      session.plan?.name || 'No Plan',
      format(new Date(session.startTime), 'yyyy-MM-dd HH:mm:ss'),
      session.endTime ? format(new Date(session.endTime), 'yyyy-MM-dd HH:mm:ss') : 'N/A',
      formatDuration(session.duration),
      formatDataUsage(session.dataUsed),
      session.authMethod,
      session.status,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `wifi-usage-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();

    toast({
      title: 'Export Complete',
      description: `Exported ${sessions.length} records to CSV`,
    });
  };

  // Stats
  const activeSessions = sessions.filter(s => s.status === 'active').length;
  const avgDataUsage = summary.count > 0 ? summary.totalDataUsed / summary.count : 0;
  const avgDuration = summary.count > 0 ? summary.totalDuration / summary.count : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Wifi className="h-5 w-5" />
            WiFi Usage Logs
          </h2>
          <p className="text-sm text-muted-foreground">
            Track and analyze WiFi usage across your property
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchSessions}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportToCSV} disabled={sessions.length === 0}>
            <FileDown className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-5">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <Wifi className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{activeSessions}</div>
              <div className="text-xs text-muted-foreground">Active</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <ArrowDownToLine className="h-4 w-4 text-violet-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{formatDataUsage(summary.totalDataUsed)}</div>
              <div className="text-xs text-muted-foreground">Total Data</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Clock className="h-4 w-4 text-amber-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{formatDuration(summary.totalDuration)}</div>
              <div className="text-xs text-muted-foreground">Total Duration</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <Monitor className="h-4 w-4 text-cyan-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{summary.count}</div>
              <div className="text-xs text-muted-foreground">Total Sessions</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-rose-500/10">
              <ArrowUpFromLine className="h-4 w-4 text-rose-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{formatDataUsage(avgDataUsage)}</div>
              <div className="text-xs text-muted-foreground">Avg Data/Session</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by MAC, IP, device name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {sessionStatuses.map(status => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={guestFilter} onValueChange={setGuestFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Guest" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Guests</SelectItem>
                  {guests.map(guest => (
                    <SelectItem key={guest.id} value={guest.id}>
                      {guest.firstName} {guest.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={authMethodFilter} onValueChange={setAuthMethodFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Auth Method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Methods</SelectItem>
                  {authMethods.map(method => (
                    <SelectItem key={method.value} value={method.value}>
                      {method.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="w-[200px] justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, 'MMM dd')} - {format(dateRange.to, 'MMM dd')}
                        </>
                      ) : (
                        format(dateRange.from, 'MMM dd, yyyy')
                      )
                    ) : (
                      <span>Date Range</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="range"
                    selected={dateRange}
                    onSelect={setDateRange}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sessions Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted/50 p-4 mb-3">
                <Wifi className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <h3 className="text-sm font-medium text-muted-foreground">No WiFi usage logs found</h3>
              <p className="text-xs text-muted-foreground/60 mt-1">Try adjusting your filters or date range</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Device</TableHead>
                    <TableHead>Guest</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Data Used</TableHead>
                    <TableHead>Auth</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((session) => (
                    <TableRow key={session.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setSelectedSession(session); setIsDetailOpen(true); }}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getDeviceIcon(session.deviceType)}
                          <div>
                            <p className="font-medium text-sm">
                              {session.deviceName || 'Unknown Device'}
                            </p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {session.macAddress}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {session.guest ? (
                          <div>
                            <p className="text-sm font-medium">
                              {session.guest.firstName} {session.guest.lastName}
                            </p>
                            <p className="text-xs text-muted-foreground">{session.guest.email}</p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">N/A</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {session.plan ? (
                          <div>
                            <p className="text-sm font-medium">{session.plan.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {session.plan.downloadSpeed}/{session.plan.uploadSpeed} Mbps
                            </p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">No Plan</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">
                            {formatDuration(session.duration)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Started {formatDistanceToNow(new Date(session.startTime))} ago
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm font-medium">{formatDataUsage(session.dataUsed)}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {session.authMethod}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(session.status)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); setSelectedSession(session); setIsDetailOpen(true); }}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Session Details</DialogTitle>
            <DialogDescription>
              Complete information about this WiFi session
            </DialogDescription>
          </DialogHeader>
          {selectedSession && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Device Name</Label>
                  <p className="font-medium">{selectedSession.deviceName || 'Unknown'}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Device Type</Label>
                  <p className="font-medium capitalize">{selectedSession.deviceType || 'Unknown'}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">MAC Address</Label>
                  <p className="font-medium font-mono">{selectedSession.macAddress}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">IP Address</Label>
                  <p className="font-medium font-mono">{selectedSession.ipAddress || 'N/A'}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Start Time</Label>
                  <p className="font-medium">{format(new Date(selectedSession.startTime), 'MMM dd, yyyy HH:mm:ss')}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">End Time</Label>
                  <p className="font-medium">
                    {selectedSession.endTime
                      ? format(new Date(selectedSession.endTime), 'MMM dd, yyyy HH:mm:ss')
                      : 'Active'}
                  </p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Duration</Label>
                  <p className="font-medium">{formatDuration(selectedSession.duration)}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Data Used</Label>
                  <p className="font-medium">{formatDataUsage(selectedSession.dataUsed)}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Auth Method</Label>
                  <p className="font-medium capitalize">{selectedSession.authMethod}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground text-xs">Status</Label>
                  <div>{getStatusBadge(selectedSession.status)}</div>
                </div>
              </div>
              {selectedSession.guest && (
                <div className="pt-4 border-t">
                  <Label className="text-muted-foreground text-xs">Associated Guest</Label>
                  <p className="font-medium">{selectedSession.guest.firstName} {selectedSession.guest.lastName}</p>
                  <p className="text-sm text-muted-foreground">{selectedSession.guest.email}</p>
                </div>
              )}
              {selectedSession.plan && (
                <div className="pt-4 border-t">
                  <Label className="text-muted-foreground text-xs">WiFi Plan</Label>
                  <p className="font-medium">{selectedSession.plan.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Download: {selectedSession.plan.downloadSpeed} Mbps | Upload: {selectedSession.plan.uploadSpeed} Mbps
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
