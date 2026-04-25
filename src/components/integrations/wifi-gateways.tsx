'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Wifi, Router, Settings, Plus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface WifiGateway {
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
}

const gatewayTypes = [
  { value: 'cisco', label: 'Cisco Meraki' },
  { value: 'ubiquiti', label: 'Ubiquiti UniFi' },
  { value: 'aruba', label: 'Aruba Networks' },
  { value: 'ruckus', label: 'Ruckus Wireless' },
  { value: 'mikrotik', label: 'MikroTik' },
  { value: 'other', label: 'Other' },
];

export default function WifiGateways() {
  const [gateways, setGateways] = useState<WifiGateway[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, connected: 0, totalAPs: 0, activeSessions: 0 });
  const [editGateway, setEditGateway] = useState<WifiGateway | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    fetchGateways();
  }, []);

  const fetchGateways = async () => {
    try {
      const response = await fetch('/api/integrations/wifi-gateways');
      const data = await response.json();
      if (data.success) {
        setGateways(data.data.gateways);
        setStats(data.data.stats);
      }
    } catch (error) {
      toast.error('Failed to fetch WiFi gateways');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAutoSync = async (id: string) => {
    const gateway = gateways.find(g => g.id === id);
    if (!gateway) return;

    try {
      const response = await fetch('/api/integrations/wifi-gateways', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, autoSync: !gateway.autoSync }),
      });

      if (response.ok) {
        setGateways(gateways.map(g => 
          g.id === id ? { ...g, autoSync: !g.autoSync } : g
        ));
        toast.success('Auto-sync setting updated');
      }
    } catch {
      toast.error('Failed to update auto-sync setting');
    }
  };

  const handleSaveGateway = async () => {
    if (!editGateway) return;

    try {
      const method = editGateway.id && editGateway.id !== '' ? 'PUT' : 'POST';
      const response = await fetch('/api/integrations/wifi-gateways', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editGateway),
      });

      if (response.ok) {
        const data = await response.json();
        if (method === 'POST') {
          setGateways([...gateways, data.data]);
          toast.success('Gateway added successfully');
        } else {
          setGateways(gateways.map(g => g.id === editGateway.id ? editGateway : g));
          toast.success('Gateway updated successfully');
        }
        fetchGateways();
      }
    } catch {
      toast.error('Failed to save gateway');
    }
    setDialogOpen(false);
    setEditGateway(null);
  };

  const handleSync = async (gateway: WifiGateway) => {
    try {
      toast.loading(`Syncing ${gateway.name}...`);
      const response = await fetch('/api/integrations/wifi-gateways', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: gateway.id,
          status: 'syncing',
        }),
      });

      if (response.ok) {
        // In a real implementation, the sync would be handled by the backend
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        await fetch('/api/integrations/wifi-gateways', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: gateway.id,
            status: 'active',
            lastSync: new Date().toISOString(),
          }),
        });

        toast.success('Sync completed successfully!');
        fetchGateways();
      } else {
        toast.error('Sync failed');
      }
    } catch (error) {
      console.error('Sync error:', error);
      toast.error('Sync failed');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'bg-emerald-500';
      case 'disconnected': return 'bg-amber-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">WiFi Gateways</h2>
          <p className="text-muted-foreground">Configure WiFi controller and gateway integrations</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditGateway({ id: '', name: '', type: 'other', ipAddress: '', port: 443, status: 'disconnected', totalAPs: 0, activeSessions: 0, bandwidth: { upload: 0, download: 0 }, autoSync: false, syncInterval: 5 })}>
              <Plus className="h-4 w-4 mr-2" />
              Add Gateway
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editGateway?.id ? 'Edit Gateway' : 'Add WiFi Gateway'}</DialogTitle>
              <DialogDescription>Configure your WiFi controller settings</DialogDescription>
            </DialogHeader>
            {editGateway && (
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Gateway Name</Label>
                    <Input
                      id="name"
                      value={editGateway.name}
                      onChange={(e) => setEditGateway({ ...editGateway, name: e.target.value })}
                      placeholder="My WiFi Controller"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="type">Controller Type</Label>
                    <Select
                      value={editGateway.type}
                      onValueChange={(v: any) => setEditGateway({ ...editGateway, type: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {gatewayTypes.map(t => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
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
                      value={editGateway.ipAddress}
                      onChange={(e) => setEditGateway({ ...editGateway, ipAddress: e.target.value })}
                      placeholder="192.168.1.100"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="port">Port</Label>
                    <Input
                      id="port"
                      type="number"
                      value={editGateway.port}
                      onChange={(e) => setEditGateway({ ...editGateway, port: parseInt(e.target.value) || 443 })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      value={editGateway.username || ''}
                      onChange={(e) => setEditGateway({ ...editGateway, username: e.target.value })}
                      placeholder="admin"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="apiKey">API Key</Label>
                    <Input
                      id="apiKey"
                      type="password"
                      value={editGateway.apiKey || ''}
                      onChange={(e) => setEditGateway({ ...editGateway, apiKey: e.target.value })}
                      placeholder="Enter API key"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={editGateway.location || ''}
                    onChange={(e) => setEditGateway({ ...editGateway, location: e.target.value })}
                    placeholder="Server Room, Building A"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="syncInterval">Sync Interval (min)</Label>
                    <Input
                      id="syncInterval"
                      type="number"
                      value={editGateway.syncInterval}
                      onChange={(e) => setEditGateway({ ...editGateway, syncInterval: parseInt(e.target.value) || 5 })}
                    />
                  </div>
                  <div className="space-y-2 flex items-end">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="autoSync"
                        checked={editGateway.autoSync}
                        onCheckedChange={(v) => setEditGateway({ ...editGateway, autoSync: v })}
                      />
                      <Label htmlFor="autoSync">Auto Sync</Label>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveGateway}>Save Gateway</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="pb-2">
            <CardDescription>Connected Gateways</CardDescription>
            <CardTitle className="text-2xl">{stats.connected}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <CardDescription>Total APs</CardDescription>
            <CardTitle className="text-2xl">{stats.totalAPs}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-cyan-500">
          <CardHeader className="pb-2">
            <CardDescription>Active Sessions</CardDescription>
            <CardTitle className="text-2xl">{stats.activeSessions}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-violet-500">
          <CardHeader className="pb-2">
            <CardDescription>Bandwidth Usage</CardDescription>
            <CardTitle className="text-2xl">{gateways.reduce((sum, g) => sum + g.bandwidth.download, 0)} Mbps</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Gateway List */}
      <div className="grid gap-4">
        {gateways.map((gateway) => (
          <Card key={gateway.id}>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-cyan-500/20 to-teal-500/20 flex items-center justify-center">
                    <Router className="h-5 w-5 text-cyan-500 dark:text-cyan-400" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{gateway.name}</CardTitle>
                    <CardDescription>{gateway.ipAddress}:{gateway.port}</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="capitalize">{gatewayTypes.find(t => t.value === gateway.type)?.label}</Badge>
                  <div className="flex items-center gap-1.5">
                    <div className={`h-2 w-2 rounded-full ${getStatusColor(gateway.status)}`} />
                    <span className="text-sm capitalize">{gateway.status}</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4 mb-4">
                <div>
                  <p className="text-sm text-muted-foreground">Location</p>
                  <p className="font-medium">{gateway.location || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Access Points</p>
                  <p className="font-medium">{gateway.totalAPs}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active Sessions</p>
                  <p className="font-medium">{gateway.activeSessions}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Bandwidth</p>
                  <p className="font-medium">↓ {gateway.bandwidth.download} Mbps / ↑ {gateway.bandwidth.upload} Mbps</p>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-4 border-t">
                <Switch
                  checked={gateway.autoSync}
                  onCheckedChange={() => handleToggleAutoSync(gateway.id)}
                />
                <span className="text-sm text-muted-foreground mr-auto">Auto-sync ({gateway.syncInterval} min)</span>
                <Button variant="outline" size="sm" onClick={() => handleSync(gateway)} disabled={gateway.status !== 'connected'}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Sync Now
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setEditGateway(gateway); setDialogOpen(true); }}>
                  <Settings className="h-4 w-4 mr-2" />
                  Configure
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
