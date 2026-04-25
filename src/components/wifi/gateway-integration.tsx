'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Router,
  Plus,
  Loader2,
  Settings,
  RefreshCw,
  Wifi,
  WifiOff,
  Server,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Activity,
  Zap,
  Shield,
  Clock,
  TestTube,
  Trash2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { format, formatDistanceToNow } from 'date-fns';

interface WiFiGateway {
  id: string;
  name: string;
  type: 'cisco' | 'ubiquiti' | 'aruba' | 'ruckus' | 'mikrotik' | 'other';
  ipAddress: string;
  port: number;
  status: 'connected' | 'disconnected' | 'error';
  apiEndpoint?: string;
  apiKey?: string;
  username?: string;
  lastSync?: string;
  totalAPs: number;
  activeSessions: number;
  bandwidth: {
    upload: number;
    download: number;
  };
  location?: string;
  autoSync: boolean;
  syncInterval: number;
  config?: {
    ssid: string;
    vlanId?: number;
    captivePortal: boolean;
    splashPage?: string;
    sessionTimeout: number;
    idleTimeout: number;
  };
}

interface GatewayStats {
  total: number;
  connected: number;
  totalAPs: number;
  activeSessions: number;
  totalBandwidth: number;
}

const gatewayTypes = [
  { value: 'cisco', label: 'Cisco Meraki' },
  { value: 'ubiquiti', label: 'Ubiquiti UniFi' },
  { value: 'aruba', label: 'Aruba Networks' },
  { value: 'ruckus', label: 'Ruckus Wireless' },
  { value: 'mikrotik', label: 'MikroTik' },
  { value: 'other', label: 'Other' },
];

const statusConfig = {
  connected: { color: 'text-emerald-500 dark:text-emerald-400', bgColor: 'bg-emerald-100', icon: CheckCircle, label: 'Connected' },
  disconnected: { color: 'text-amber-500 dark:text-amber-400', bgColor: 'bg-amber-100', icon: AlertTriangle, label: 'Disconnected' },
  error: { color: 'text-red-500 dark:text-red-400', bgColor: 'bg-red-100', icon: XCircle, label: 'Error' },
};

export default function GatewayIntegration() {
  const { toast } = useToast();
  const [gateways, setGateways] = useState<WiFiGateway[]>([]);
  const [stats, setStats] = useState<GatewayStats>({
    total: 0,
    connected: 0,
    totalAPs: 0,
    activeSessions: 0,
    totalBandwidth: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedGateway, setSelectedGateway] = useState<WiFiGateway | null>(null);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isTestOpen, setIsTestOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'failed' | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [deleteGatewayId, setDeleteGatewayId] = useState<string | null>(null);

  // Form state for new/edit gateway
  const [formData, setFormData] = useState<Partial<WiFiGateway>>({
    name: '',
    type: 'other',
    ipAddress: '',
    port: 443,
    username: '',
    apiKey: '',
    location: '',
    autoSync: true,
    syncInterval: 5,
    config: {
      ssid: '',
      captivePortal: false,
      sessionTimeout: 3600,
      idleTimeout: 300,
    },
  });

  useEffect(() => {
    fetchGateways();
  }, []);

  const fetchGateways = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/integrations/wifi-gateways');
      const result = await response.json();

      if (result.success) {
        setGateways(result.data.gateways || []);
        setStats(result.data.stats || {
          total: 0,
          connected: 0,
          totalAPs: 0,
          activeSessions: 0,
          totalBandwidth: 0,
        });
      }
    } catch (error) {
      console.error('Error fetching gateways:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch WiFi gateways',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveGateway = async () => {
    if (!formData.name || !formData.ipAddress) {
      toast({
        title: 'Validation Error',
        description: 'Name and IP Address are required',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const isEdit = formData.id && formData.id !== '';
      const response = await fetch('/api/integrations/wifi-gateways', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: isEdit ? 'Gateway updated successfully' : 'Gateway added successfully',
        });
        setIsConfigOpen(false);
        resetForm();
        fetchGateways();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to save gateway',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error saving gateway:', error);
      toast({
        title: 'Error',
        description: 'Failed to save gateway',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!selectedGateway) return;

    setTestResult(null);
    setIsSaving(true);

    try {
      const response = await fetch(`/api/integrations/wifi-gateways?action=test-connection&id=${selectedGateway.id}`);
      const result = await response.json();

      if (result.success && result.data?.connected) {
        setTestResult('success');
        toast({
          title: 'Connection Test Passed',
          description: result.data.message || `Successfully connected to ${selectedGateway.name}`,
        });
        // Refresh gateway list to reflect updated status
        fetchGateways();
      } else {
        setTestResult('failed');
        toast({
          title: 'Connection Test Failed',
          description: result.data?.message || 'Could not establish connection to the gateway',
          variant: 'destructive',
        });
        fetchGateways();
      }
    } catch (error) {
      setTestResult('failed');
      toast({
        title: 'Connection Test Failed',
        description: 'An error occurred during the test',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleAutoSync = async (gateway: WiFiGateway) => {
    try {
      const response = await fetch('/api/integrations/wifi-gateways', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: gateway.id,
          autoSync: !gateway.autoSync,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setGateways(gateways.map(g =>
          g.id === gateway.id ? { ...g, autoSync: !g.autoSync } : g
        ));
        toast({
          title: 'Success',
          description: 'Auto-sync setting updated',
        });
      }
    } catch (error) {
      console.error('Error updating auto-sync:', error);
      toast({
        title: 'Error',
        description: 'Failed to update auto-sync setting',
        variant: 'destructive',
      });
    }
  };

  const handleSync = async (gateway: WiFiGateway) => {
    toast({
      title: 'Sync Started',
      description: `Syncing ${gateway.name}...`,
    });

    try {
      const response = await fetch(`/api/integrations/wifi-gateways?action=sync&id=${gateway.id}`);
      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Sync Complete',
          description: result.message || `Successfully synced ${gateway.name}`,
        });
        fetchGateways();
      } else {
        toast({
          title: 'Sync Failed',
          description: result.error?.message || 'Failed to sync gateway',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Sync Failed',
        description: 'Failed to sync gateway',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = (gateway: WiFiGateway) => {
    setDeleteGatewayId(gateway.id);
  };

  const confirmDelete = async () => {
    if (!deleteGatewayId) return;

    try {
      const response = await fetch(`/api/integrations/wifi-gateways?id=${deleteGatewayId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Gateway deleted successfully',
        });
        fetchGateways();
      }
    } catch (error) {
      console.error('Error deleting gateway:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete gateway',
        variant: 'destructive',
      });
    } finally {
      setDeleteGatewayId(null);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'other',
      ipAddress: '',
      port: 443,
      username: '',
      apiKey: '',
      location: '',
      autoSync: true,
      syncInterval: 5,
      config: {
        ssid: '',
        captivePortal: false,
        sessionTimeout: 3600,
        idleTimeout: 300,
      },
    });
    setSelectedGateway(null);
  };

  const openEditDialog = (gateway: WiFiGateway) => {
    setSelectedGateway(gateway);
    setFormData({
      ...gateway,
      config: gateway.config || {
        ssid: '',
        captivePortal: false,
        sessionTimeout: 3600,
        idleTimeout: 300,
      },
    });
    setIsConfigOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Router className="h-5 w-5" />
            Gateway Integration
          </h2>
          <p className="text-sm text-muted-foreground">
            Configure and manage WiFi gateway connections
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchGateways}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => { resetForm(); setIsConfigOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Gateway
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-5">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <CheckCircle className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.connected}</div>
              <div className="text-xs text-muted-foreground">Connected</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <Wifi className="h-4 w-4 text-violet-500 dark:text-violet-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.totalAPs}</div>
              <div className="text-xs text-muted-foreground">Access Points</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <Activity className="h-4 w-4 text-cyan-500 dark:text-cyan-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.activeSessions}</div>
              <div className="text-xs text-muted-foreground">Active Sessions</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Zap className="h-4 w-4 text-amber-500 dark:text-amber-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.totalBandwidth}</div>
              <div className="text-xs text-muted-foreground">Mbps Total</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-rose-500/10">
              <Server className="h-4 w-4 text-rose-500 dark:text-rose-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-xs text-muted-foreground">Total Gateways</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Gateway List */}
      {gateways.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-12">
          <Router className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-4">No WiFi gateways configured</p>
          <Button onClick={() => { resetForm(); setIsConfigOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Your First Gateway
          </Button>
        </Card>
      ) : (
        <ScrollArea className="h-[600px]">
          <div className="space-y-4">
            {gateways.map((gateway) => {
              const statusInfo = statusConfig[gateway.status] || statusConfig.disconnected;
              const StatusIcon = statusInfo.icon;

              return (
                <Card key={gateway.id} className="overflow-hidden">
                  <div className="flex flex-col lg:flex-row">
                    {/* Status Indicator */}
                    <div className={cn(
                      'w-full lg:w-2 p-4 flex items-center justify-center gap-2',
                      statusInfo.bgColor
                    )}>
                      <StatusIcon className={cn('h-5 w-5', statusInfo.color)} />
                      <span className={cn('font-medium', statusInfo.color)}>
                        {statusInfo.label}
                      </span>
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 p-4">
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-cyan-500/20 to-teal-500/20 flex items-center justify-center">
                            <Router className="h-6 w-6 text-cyan-500 dark:text-cyan-400" />
                          </div>
                          <div>
                            <h3 className="font-semibold">{gateway.name}</h3>
                            <p className="text-sm text-muted-foreground">
                              {gateway.ipAddress}:{gateway.port}
                            </p>
                            <div className="flex gap-2 mt-1">
                              <Badge variant="outline" className="capitalize text-xs">
                                {gatewayTypes.find(t => t.value === gateway.type)?.label}
                              </Badge>
                              {gateway.location && (
                                <Badge variant="secondary" className="text-xs">
                                  {gateway.location}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Metrics */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">APs</p>
                            <p className="font-semibold">{gateway.totalAPs}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Sessions</p>
                            <p className="font-semibold">{gateway.activeSessions}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Download</p>
                            <p className="font-semibold">{gateway.bandwidth.download} Mbps</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Upload</p>
                            <p className="font-semibold">{gateway.bandwidth.upload} Mbps</p>
                          </div>
                        </div>
                      </div>

                      {/* Last Sync & Auto Sync */}
                      <div className="flex items-center gap-4 mt-4 pt-4 border-t">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={gateway.autoSync}
                            onCheckedChange={() => handleToggleAutoSync(gateway)}
                          />
                          <span className="text-sm text-muted-foreground">
                            Auto-sync ({gateway.syncInterval} min)
                          </span>
                        </div>
                        {gateway.lastSync && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            Last sync: {formatDistanceToNow(new Date(gateway.lastSync))} ago
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap gap-2 mt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSync(gateway)}
                          disabled={gateway.status !== 'connected'}
                        >
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Sync
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => { setSelectedGateway(gateway); setIsTestOpen(true); }}
                        >
                          <TestTube className="h-3 w-3 mr-1" />
                          Test Connection
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(gateway)}
                        >
                          <Settings className="h-3 w-3 mr-1" />
                          Configure
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 dark:text-red-400 hover:text-red-700"
                          onClick={() => handleDelete(gateway)}
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      )}

      {/* Add/Edit Gateway Dialog */}
      <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{formData.id ? 'Edit Gateway' : 'Add WiFi Gateway'}</DialogTitle>
            <DialogDescription>
              Configure your WiFi controller connection settings
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Basic Settings */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm">Basic Settings</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Gateway Name *</Label>
                  <Input
                    id="name"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Main Controller"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Controller Type</Label>
                  <Select
                    value={formData.type || 'other'}
                    onValueChange={(value) => setFormData({ ...formData, type: value as WiFiGateway['type'] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {gatewayTypes.map(type => (
                        <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ipAddress">IP Address *</Label>
                  <Input
                    id="ipAddress"
                    value={formData.ipAddress || ''}
                    onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                    placeholder="192.168.1.100"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="port">Port</Label>
                  <Input
                    id="port"
                    type="number"
                    value={formData.port || 443}
                    onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) || 443 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={formData.location || ''}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="Server Room, Building A"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="syncInterval">Sync Interval (min)</Label>
                  <Input
                    id="syncInterval"
                    type="number"
                    value={formData.syncInterval || 5}
                    onChange={(e) => setFormData({ ...formData, syncInterval: parseInt(e.target.value) || 5 })}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="autoSync"
                  checked={formData.autoSync ?? true}
                  onCheckedChange={(checked) => setFormData({ ...formData, autoSync: checked })}
                />
                <Label htmlFor="autoSync">Enable auto-sync</Label>
              </div>
            </div>

            <Separator />

            {/* Authentication */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm">Authentication</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={formData.username || ''}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="admin"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="apiKey">API Key</Label>
                  <div className="relative">
                    <Input
                      id="apiKey"
                      type={showApiKey ? 'text' : 'password'}
                      value={formData.apiKey || ''}
                      onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                      placeholder="Enter API key"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowApiKey(!showApiKey)}
                    >
                      {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* WiFi Configuration */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm">WiFi Configuration</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ssid">SSID</Label>
                  <Input
                    id="ssid"
                    value={formData.config?.ssid || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      config: { ...formData.config!, ssid: e.target.value }
                    })}
                    placeholder="Hotel-Guest"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vlanId">VLAN ID</Label>
                  <Input
                    id="vlanId"
                    type="number"
                    value={formData.config?.vlanId || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      config: { ...formData.config!, vlanId: parseInt(e.target.value) || undefined }
                    })}
                    placeholder="100"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sessionTimeout">Session Timeout (sec)</Label>
                  <Input
                    id="sessionTimeout"
                    type="number"
                    value={formData.config?.sessionTimeout || 3600}
                    onChange={(e) => setFormData({
                      ...formData,
                      config: { ...formData.config!, sessionTimeout: parseInt(e.target.value) || 3600 }
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="idleTimeout">Idle Timeout (sec)</Label>
                  <Input
                    id="idleTimeout"
                    type="number"
                    value={formData.config?.idleTimeout || 300}
                    onChange={(e) => setFormData({
                      ...formData,
                      config: { ...formData.config!, idleTimeout: parseInt(e.target.value) || 300 }
                    })}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="captivePortal"
                  checked={formData.config?.captivePortal ?? false}
                  onCheckedChange={(checked) => setFormData({
                    ...formData,
                    config: { ...formData.config!, captivePortal: checked }
                  })}
                />
                <Label htmlFor="captivePortal">Enable Captive Portal</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfigOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveGateway} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Gateway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test Connection Dialog */}
      <Dialog open={isTestOpen} onOpenChange={setIsTestOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Test Connection</DialogTitle>
            <DialogDescription>
              Verify connection to {selectedGateway?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="py-6">
            {testResult === null ? (
              <div className="text-center text-muted-foreground">
                <TestTube className="h-12 w-12 mx-auto mb-4" />
                <p>Click the button below to test the connection</p>
              </div>
            ) : (
              <div className={cn(
                'text-center p-6 rounded-lg',
                testResult === 'success' ? 'bg-emerald-50' : 'bg-red-50'
              )}>
                {testResult === 'success' ? (
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-emerald-500 dark:text-emerald-400" />
                ) : (
                  <XCircle className="h-12 w-12 mx-auto mb-4 text-red-500 dark:text-red-400" />
                )}
                <p className={cn(
                  'font-medium',
                  testResult === 'success' ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'
                )}>
                  {testResult === 'success' ? 'Connection Successful' : 'Connection Failed'}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {testResult === 'success'
                    ? 'The gateway is responding correctly'
                    : 'Could not establish connection to the gateway'
                  }
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsTestOpen(false); setTestResult(null); }}>
              Close
            </Button>
            <Button onClick={handleTestConnection} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <TestTube className="h-4 w-4 mr-2" />
                  Test Connection
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteGatewayId} onOpenChange={(open) => !open && setDeleteGatewayId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Gateway</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this gateway? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
