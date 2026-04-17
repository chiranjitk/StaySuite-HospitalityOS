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
import { Loader2, UtensilsCrossed, Server, Settings, Plus, RefreshCw, Link2 } from 'lucide-react';
import { toast } from 'sonner';

interface PosSystem {
  id: string;
  name: string;
  provider: 'micros' | 'toast' | 'square' | 'lightspeed' | 'posist' | 'other';
  status: 'connected' | 'disconnected' | 'error';
  endpoint?: string;
  apiKey?: string;
  merchantId?: string;
  locationId?: string;
  lastSync?: string;
  syncStatus: 'synced' | 'pending' | 'error';
  outlets: number;
  menuItems: number;
  syncSettings: {
    syncMenu: boolean;
    syncOrders: boolean;
    syncPayments: boolean;
    syncGuests: boolean;
  };
}

const providerOptions = [
  { value: 'toast', label: 'Toast POS' },
  { value: 'square', label: 'Square' },
  { value: 'micros', label: 'Oracle MICROS' },
  { value: 'lightspeed', label: 'Lightspeed' },
  { value: 'posist', label: 'Posist' },
  { value: 'other', label: 'Other' },
];

export default function PosSystems() {
  const [systems, setSystems] = useState<PosSystem[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, connected: 0, totalOutlets: 0, totalMenuItems: 0 });
  const [editSystem, setEditSystem] = useState<PosSystem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    fetchSystems();
  }, []);

  const fetchSystems = async () => {
    try {
      const response = await fetch('/api/integrations/pos-systems');
      const data = await response.json();
      if (data.success) {
        setSystems(data.data.systems);
        setStats(data.data.stats);
      }
    } catch (error) {
      toast.error('Failed to fetch POS systems');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSync = async (id: string, setting: keyof PosSystem['syncSettings']) => {
    const system = systems.find(s => s.id === id);
    if (!system) return;

    try {
      const response = await fetch('/api/integrations/pos-systems', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          syncSettings: { ...system.syncSettings, [setting]: !system.syncSettings[setting] },
        }),
      });

      if (response.ok) {
        setSystems(systems.map(s => 
          s.id === id ? { ...s, syncSettings: { ...s.syncSettings, [setting]: !s.syncSettings[setting] } } : s
        ));
        toast.success('Sync setting updated');
      }
    } catch {
      toast.error('Failed to update sync setting');
    }
  };

  const handleSaveSystem = async () => {
    if (!editSystem) return;

    try {
      const method = editSystem.id && editSystem.id !== '' ? 'PUT' : 'POST';
      const response = await fetch('/api/integrations/pos-systems', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editSystem),
      });

      if (response.ok) {
        const data = await response.json();
        if (method === 'POST') {
          setSystems([...systems, data.data]);
          toast.success('POS system added successfully');
        } else {
          setSystems(systems.map(s => s.id === editSystem.id ? editSystem : s));
          toast.success('POS system updated successfully');
        }
        fetchSystems();
      }
    } catch {
      toast.error('Failed to save POS system');
    }
    setDialogOpen(false);
    setEditSystem(null);
  };

  const handleSync = async (system: PosSystem) => {
    try {
      toast.loading(`Syncing ${system.name}...`);
      const response = await fetch('/api/integrations/pos-systems', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: system.id,
          syncStatus: 'syncing',
        }),
      });

      if (response.ok) {
        // Simulate sync completion (in real implementation, this would be handled by backend)
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        await fetch('/api/integrations/pos-systems', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: system.id,
            syncStatus: 'synced',
            lastSync: new Date().toISOString(),
          }),
        });

        toast.success('Sync completed successfully!');
        fetchSystems();
      } else {
        toast.error('Sync failed');
      }
    } catch (error) {
      console.error('Sync error:', error);
      toast.error('Sync failed');
    }
  };

  const handleConnect = async (system: PosSystem) => {
    try {
      toast.loading(`Connecting to ${system.name}...`);
      const response = await fetch('/api/integrations/pos-systems', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: system.id,
          status: 'active',
        }),
      });

      if (response.ok) {
        toast.success('Connected successfully!');
        fetchSystems();
      } else {
        const data = await response.json();
        toast.error(data.error?.message || 'Connection failed');
      }
    } catch (error) {
      console.error('Connection error:', error);
      toast.error('Connection failed');
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
          <h2 className="text-2xl font-bold tracking-tight">POS Systems</h2>
          <p className="text-muted-foreground">Configure restaurant and point-of-sale integrations</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditSystem({ id: '', name: '', provider: 'other', status: 'disconnected', outlets: 0, menuItems: 0, syncStatus: 'pending', syncSettings: { syncMenu: false, syncOrders: false, syncPayments: false, syncGuests: false } })}>
              <Plus className="h-4 w-4 mr-2" />
              Add POS System
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editSystem?.id ? 'Edit POS System' : 'Add POS System'}</DialogTitle>
              <DialogDescription>Configure your POS integration settings</DialogDescription>
            </DialogHeader>
            {editSystem && (
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">System Name</Label>
                    <Input
                      id="name"
                      value={editSystem.name}
                      onChange={(e) => setEditSystem({ ...editSystem, name: e.target.value })}
                      placeholder="My POS System"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="provider">Provider</Label>
                    <Select
                      value={editSystem.provider}
                      onValueChange={(v: any) => setEditSystem({ ...editSystem, provider: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {providerOptions.map(p => (
                          <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="endpoint">API Endpoint</Label>
                    <Input
                      id="endpoint"
                      value={editSystem.endpoint || ''}
                      onChange={(e) => setEditSystem({ ...editSystem, endpoint: e.target.value })}
                      placeholder="https://api.example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="apiKey">API Key</Label>
                    <Input
                      id="apiKey"
                      type="password"
                      value={editSystem.apiKey || ''}
                      onChange={(e) => setEditSystem({ ...editSystem, apiKey: e.target.value })}
                      placeholder="Enter API key"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="merchantId">Merchant ID</Label>
                    <Input
                      id="merchantId"
                      value={editSystem.merchantId || ''}
                      onChange={(e) => setEditSystem({ ...editSystem, merchantId: e.target.value })}
                      placeholder="MERCHANT_123"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="locationId">Location ID</Label>
                    <Input
                      id="locationId"
                      value={editSystem.locationId || ''}
                      onChange={(e) => setEditSystem({ ...editSystem, locationId: e.target.value })}
                      placeholder="LOCATION_456"
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <Label>Sync Settings</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="syncMenu"
                        checked={editSystem.syncSettings.syncMenu}
                        onCheckedChange={(v) => setEditSystem({ ...editSystem, syncSettings: { ...editSystem.syncSettings, syncMenu: v } })}
                      />
                      <Label htmlFor="syncMenu">Sync Menu</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="syncOrders"
                        checked={editSystem.syncSettings.syncOrders}
                        onCheckedChange={(v) => setEditSystem({ ...editSystem, syncSettings: { ...editSystem.syncSettings, syncOrders: v } })}
                      />
                      <Label htmlFor="syncOrders">Sync Orders</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="syncPayments"
                        checked={editSystem.syncSettings.syncPayments}
                        onCheckedChange={(v) => setEditSystem({ ...editSystem, syncSettings: { ...editSystem.syncSettings, syncPayments: v } })}
                      />
                      <Label htmlFor="syncPayments">Sync Payments</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="syncGuests"
                        checked={editSystem.syncSettings.syncGuests}
                        onCheckedChange={(v) => setEditSystem({ ...editSystem, syncSettings: { ...editSystem.syncSettings, syncGuests: v } })}
                      />
                      <Label htmlFor="syncGuests">Sync Guests</Label>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveSystem}>Save System</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="pb-2">
            <CardDescription>Connected Systems</CardDescription>
            <CardTitle className="text-2xl">{stats.connected}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <CardDescription>Total Outlets</CardDescription>
            <CardTitle className="text-2xl">{stats.totalOutlets}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-cyan-500">
          <CardHeader className="pb-2">
            <CardDescription>Menu Items</CardDescription>
            <CardTitle className="text-2xl">{stats.totalMenuItems}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-violet-500">
          <CardHeader className="pb-2">
            <CardDescription>Providers</CardDescription>
            <CardTitle className="text-2xl">{new Set(systems.map(s => s.provider)).size}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* System List */}
      <div className="grid gap-4">
        {systems.map((system) => (
          <Card key={system.id}>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-orange-500/20 to-amber-500/20 flex items-center justify-center">
                    <UtensilsCrossed className="h-5 w-5 text-orange-500" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{system.name}</CardTitle>
                    <CardDescription>{providerOptions.find(p => p.value === system.provider)?.label}</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={system.syncStatus === 'synced' ? 'default' : system.syncStatus === 'error' ? 'destructive' : 'secondary'}>
                    {system.syncStatus}
                  </Badge>
                  <Badge variant={system.status === 'connected' ? 'default' : 'outline'} className={system.status === 'connected' ? 'bg-emerald-500' : ''}>
                    {system.status}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4 mb-4">
                <div>
                  <p className="text-sm text-muted-foreground">Outlets</p>
                  <p className="font-medium">{system.outlets}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Menu Items</p>
                  <p className="font-medium">{system.menuItems}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Last Sync</p>
                  <p className="font-medium">{system.lastSync ? new Date(system.lastSync).toLocaleString() : 'Never'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Endpoint</p>
                  <p className="font-medium truncate">{system.endpoint || 'N/A'}</p>
                </div>
              </div>
              <div className="border-t pt-4 mb-4">
                <p className="text-sm font-medium mb-2">Sync Settings</p>
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={system.syncSettings.syncMenu}
                      onCheckedChange={() => handleToggleSync(system.id, 'syncMenu')}
                    />
                    <span className="text-sm">Menu</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={system.syncSettings.syncOrders}
                      onCheckedChange={() => handleToggleSync(system.id, 'syncOrders')}
                    />
                    <span className="text-sm">Orders</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={system.syncSettings.syncPayments}
                      onCheckedChange={() => handleToggleSync(system.id, 'syncPayments')}
                    />
                    <span className="text-sm">Payments</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={system.syncSettings.syncGuests}
                      onCheckedChange={() => handleToggleSync(system.id, 'syncGuests')}
                    />
                    <span className="text-sm">Guests</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-4 border-t">
                {system.status === 'connected' ? (
                  <>
                    <Button variant="outline" size="sm" onClick={() => handleSync(system)}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Sync Now
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { setEditSystem(system); setDialogOpen(true); }}>
                      <Settings className="h-4 w-4 mr-2" />
                      Configure
                    </Button>
                  </>
                ) : (
                  <Button size="sm" onClick={() => handleConnect(system)}>
                    <Link2 className="h-4 w-4 mr-2" />
                    Connect
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
