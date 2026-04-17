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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import {
  Wifi,
  Plus,
  Search,
  Loader2,
  Monitor,
  Smartphone,
  Tablet,
  Laptop,
  Clock,
  ArrowDownToLine,
  ArrowUpFromLine,
  Square,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { format, formatDistanceToNow } from 'date-fns';

interface WiFiPlan {
  id: string;
  name: string;
  downloadSpeed: number;
  uploadSpeed: number;
  dataLimit: number | null;
  sessionLimit: number | null;
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
  plan: WiFiPlan | null;
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

export default function WifiSessions() {
  const { toast } = useToast();
  const [sessions, setSessions] = useState<WiFiSession[]>([]);
  const [plans, setPlans] = useState<WiFiPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [summary, setSummary] = useState({
    totalDataUsed: 0,
    totalDuration: 0,
    count: 0,
    byStatus: {} as Record<string, number>,
  });

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    planId: '',
    macAddress: '',
    ipAddress: '',
    deviceName: '',
    deviceType: 'smartphone',
    authMethod: 'voucher',
  });

  // Fetch plans for dropdown
  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const response = await fetch('/api/wifi/plans?status=active');
        const result = await response.json();
        if (result.success) {
          setPlans(result.data);
          if (result.data.length > 0) {
            setFormData(prev => ({ ...prev, planId: result.data[0].id }));
          }
        }
      } catch (error) {
        console.error('Error fetching plans:', error);
      }
    };
    fetchPlans();
  }, []);

  // Fetch sessions
  const fetchSessions = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (statusFilter !== 'all') params.append('status', statusFilter);

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
        description: 'Failed to fetch WiFi sessions',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [statusFilter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length >= 2 || searchQuery.length === 0) {
        fetchSessions();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // End session
  const endSession = async (sessionId: string) => {
    try {
      const response = await fetch('/api/wifi/sessions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: sessionId,
          status: 'ended',
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: 'WiFi session ended successfully',
        });
        fetchSessions();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to end session',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error ending session:', error);
      toast({
        title: 'Error',
        description: 'Failed to end session',
        variant: 'destructive',
      });
    }
  };

  // Create session
  const handleCreate = async () => {
    if (!formData.macAddress) {
      toast({
        title: 'Validation Error',
        description: 'MAC address is required',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/wifi/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: 'WiFi session started successfully',
        });
        setIsCreateOpen(false);
        resetForm();
        fetchSessions();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to start session',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error creating session:', error);
      toast({
        title: 'Error',
        description: 'Failed to start session',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      planId: plans[0]?.id || '',
      macAddress: '',
      ipAddress: '',
      deviceName: '',
      deviceType: 'smartphone',
      authMethod: 'voucher',
    });
  };

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

  const getDataUsagePercentage = (session: WiFiSession) => {
    if (!session.plan?.dataLimit) return 0;
    return Math.min(100, (session.dataUsed / session.plan.dataLimit) * 100);
  };

  // Calculate active session duration in real-time
  const getActiveDuration = (startTime: string, duration: number, status: string) => {
    if (status !== 'active') {
      return formatDuration(duration);
    }
    const start = new Date(startTime).getTime();
    const now = Date.now();
    const elapsed = Math.floor((now - start) / 1000);
    return formatDuration(elapsed);
  };

  // Stats
  const activeSessions = sessions.filter(s => s.status === 'active').length;
  const avgDataUsage = summary.count > 0 ? summary.totalDataUsed / summary.count : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Wifi className="h-5 w-5" />
            WiFi Sessions
          </h2>
          <p className="text-sm text-muted-foreground">
            Monitor active and past WiFi sessions
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchSessions}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => { resetForm(); setIsCreateOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Start Session
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <Wifi className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{activeSessions}</div>
              <div className="text-xs text-muted-foreground">Active Sessions</div>
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
              <div className="text-xs text-muted-foreground">Total Data Used</div>
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
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by MAC address, IP, or device..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
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
              <h3 className="text-sm font-medium text-muted-foreground">No WiFi sessions found</h3>
              <p className="text-xs text-muted-foreground/60 mt-1">Active WiFi sessions will appear here</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Device</TableHead>
                    <TableHead>MAC Address</TableHead>
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
                    <TableRow key={session.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getDeviceIcon(session.deviceType)}
                          <div>
                            <p className="font-medium text-sm">
                              {session.deviceName || 'Unknown Device'}
                            </p>
                            <p className="text-xs text-muted-foreground capitalize">
                              {session.deviceType || 'Unknown'}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-mono text-sm">{session.macAddress}</p>
                          {session.ipAddress && (
                            <p className="text-xs text-muted-foreground">{session.ipAddress}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {session.plan ? (
                          <div>
                            <p className="text-sm font-medium">{session.plan.name}</p>
                            <p className="text-xs text-muted-foreground">
                              <ArrowDownToLine className="h-3 w-3 inline mr-1" />
                              {session.plan.downloadSpeed} Mbps
                              <ArrowUpFromLine className="h-3 w-3 inline ml-2 mr-1" />
                              {session.plan.uploadSpeed} Mbps
                            </p>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">No Plan</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">
                            {getActiveDuration(session.startTime, session.duration, session.status)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Started {formatDistanceToNow(new Date(session.startTime))} ago
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="min-w-[100px]">
                          <p className="text-sm font-medium">{formatDataUsage(session.dataUsed)}</p>
                          {session.plan?.dataLimit && (
                            <>
                              <Progress
                                value={getDataUsagePercentage(session)}
                                className="h-1.5 mt-1"
                              />
                              <p className="text-xs text-muted-foreground mt-1">
                                {getDataUsagePercentage(session).toFixed(0)}% of {formatDataUsage(session.plan.dataLimit)}
                              </p>
                            </>
                          )}
                        </div>
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
                        {session.status === 'active' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => endSession(session.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Square className="h-3 w-3 mr-1" />
                            End
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Start WiFi Session</DialogTitle>
            <DialogDescription>
              Register a new device for WiFi access
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="macAddress">MAC Address *</Label>
              <Input
                id="macAddress"
                placeholder="00:1A:2B:3C:4D:5E"
                value={formData.macAddress}
                onChange={(e) => setFormData(prev => ({ ...prev, macAddress: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="planId">WiFi Plan</Label>
              <Select
                value={formData.planId}
                onValueChange={(value) => setFormData(prev => ({ ...prev, planId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select plan" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map(plan => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name} ({plan.downloadSpeed}/{plan.uploadSpeed} Mbps)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="deviceName">Device Name</Label>
                <Input
                  id="deviceName"
                  placeholder="John's iPhone"
                  value={formData.deviceName}
                  onChange={(e) => setFormData(prev => ({ ...prev, deviceName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deviceType">Device Type</Label>
                <Select
                  value={formData.deviceType}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, deviceType: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {deviceTypes.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ipAddress">IP Address</Label>
                <Input
                  id="ipAddress"
                  placeholder="192.168.1.100"
                  value={formData.ipAddress}
                  onChange={(e) => setFormData(prev => ({ ...prev, ipAddress: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="authMethod">Auth Method</Label>
                <Select
                  value={formData.authMethod}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, authMethod: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    {authMethods.map(method => (
                      <SelectItem key={method.value} value={method.value}>
                        {method.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Start Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
