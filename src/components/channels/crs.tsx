'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Server,
  RefreshCw,
  Settings,
  Check,
  X,
  Clock,
  Globe,
  Link2,
  Shield,
  Zap,
  Database,
  Wifi,
  WifiOff,
  Save,
  Edit,
  Plus,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useCurrency } from '@/contexts/CurrencyContext';

interface CRSConnection {
  id: string;
  name: string;
  type: 'internal' | 'external';
  provider: string;
  endpoint: string;
  apiKey: string;
  status: 'active' | 'inactive' | 'error';
  lastSync: Date | null;
  features: {
    inventory: boolean;
    rates: boolean;
    bookings: boolean;
    guests: boolean;
  };
  syncInterval: number;
  autoSync: boolean;
}

interface BookingSource {
  id: string;
  name: string;
  type: 'direct' | 'gds' | 'ota' | 'wholesale';
  enabled: boolean;
  commission: number;
  bookings: number;
  revenue: number;
}

interface CRSStats {
  totalConnections: number;
  activeConnections: number;
  totalSources: number;
  enabledSources: number;
  totalBookings: number;
  totalRevenue: number;
}

export default function CRS() {
  const { formatCurrency } = useCurrency();
  const [connections, setConnections] = useState<CRSConnection[]>([]);
  const [bookingSources, setBookingSources] = useState<BookingSource[]>([]);
  const [stats, setStats] = useState<CRSStats>({ totalConnections: 0, activeConnections: 0, totalSources: 0, enabledSources: 0, totalBookings: 0, totalRevenue: 0 });
  const [loading, setLoading] = useState(true);
  const [editDialog, setEditDialog] = useState<{ open: boolean; item: CRSConnection | null }>({ open: false, item: null });
  const [editForm, setEditForm] = useState({
    name: '',
    endpoint: '',
    apiKey: '',
    syncInterval: 15,
    autoSync: true,
    features: {
      inventory: true,
      rates: true,
      bookings: true,
      guests: false,
    },
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/channels/crs');
      const result = await response.json();
      
      if (result.success) {
        setConnections(result.data.connections.map((c: CRSConnection) => ({
          ...c,
          lastSync: c.lastSync ? new Date(c.lastSync) : null,
        })));
        setBookingSources(result.data.bookingSources);
        setStats(result.stats);
      } else {
        toast.error('Failed to load CRS data');
      }
    } catch (error) {
      console.error('Error fetching CRS data:', error);
      toast.error('Failed to load CRS data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggleConnection = async (id: string, autoSync: boolean) => {
    try {
      await fetch('/api/channels/crs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, autoSync }),
      });
      
      setConnections(prev => prev.map(item => 
        item.id === id ? { ...item, autoSync } : item
      ));
      toast.success(`Auto-sync ${autoSync ? 'enabled' : 'disabled'}`);
    } catch {
      toast.error('Failed to update connection');
    }
  };

  const handleToggleSource = async (id: string, enabled: boolean) => {
    try {
      const response = await fetch('/api/channels/crs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, enabled }),
      });
      const result = await response.json();

      if (result.success) {
        setBookingSources(prev => prev.map(item =>
          item.id === id ? { ...item, enabled } : item
        ));
        toast.success(`Source ${enabled ? 'enabled' : 'disabled'}`);
      } else {
        toast.error(result.error?.message || 'Failed to update source');
      }
    } catch {
      toast.error('Failed to connect to server');
    }
  };

  const handleTestConnection = async (id: string) => {
    try {
      toast.info('Testing connection...');
      const response = await fetch('/api/channels/crs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'test' }),
      });
      const result = await response.json();

      if (result.success) {
        setConnections(prev => prev.map(item =>
          item.id === id ? { ...item, status: 'active' as const, lastSync: result.data?.lastSync ? new Date(result.data.lastSync) : new Date() } : item
        ));
        toast.success(result.message || 'Connection test successful');
      } else {
        setConnections(prev => prev.map(item =>
          item.id === id ? { ...item, status: 'error' as const } : item
        ));
        toast.error(result.error?.message || 'Connection test failed');
      }
    } catch {
      toast.error('Failed to connect to server');
    }
  };

  const openEditDialog = (item: CRSConnection) => {
    setEditDialog({ open: true, item });
    setEditForm({
      name: item.name,
      endpoint: item.endpoint,
      apiKey: item.apiKey,
      syncInterval: item.syncInterval,
      autoSync: item.autoSync,
      features: item.features,
    });
  };

  const handleSaveConnection = async () => {
    if (!editDialog.item) return;
    
    try {
      await fetch('/api/channels/crs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editDialog.item.id,
          ...editForm,
        }),
      });
      
      setConnections(prev => prev.map(item => 
        item.id === editDialog.item!.id 
          ? { ...item, ...editForm }
          : item
      ));
      
      toast.success('Connection updated');
      setEditDialog({ open: false, item: null });
    } catch {
      toast.error('Failed to update connection');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Central Reservation System</h1>
          <p className="text-muted-foreground">Manage your central reservation system and booking sources</p>
        </div>
        <Button onClick={fetchData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-slate-500/10 to-slate-600/5 border-slate-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-500/20">
                <Server className="h-5 w-5 text-slate-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.activeConnections}</p>
                <p className="text-xs text-muted-foreground">Active CRS</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border-cyan-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/20">
                <Globe className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.enabledSources}</p>
                <p className="text-xs text-muted-foreground">Active Sources</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <Link2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalBookings}</p>
                <p className="text-xs text-muted-foreground">Total Bookings</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <Zap className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</p>
                <p className="text-xs text-muted-foreground">Total Revenue</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="connections">
        <TabsList>
          <TabsTrigger value="connections">
            <Server className="h-4 w-4 mr-2" />
            CRS Connections
          </TabsTrigger>
          <TabsTrigger value="sources">
            <Globe className="h-4 w-4 mr-2" />
            Booking Sources
          </TabsTrigger>
        </TabsList>

        {/* CRS Connections Tab */}
        <TabsContent value="connections" className="mt-4 space-y-4">
          {connections.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Server className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No CRS connections configured</p>
                <p className="text-sm text-muted-foreground">The internal CRS is available by default</p>
              </CardContent>
            </Card>
          ) : (
            connections.map((connection) => (
              <Card key={connection.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${connection.status === 'active' ? 'bg-emerald-500/20' : 'bg-gray-500/20'}`}>
                        {connection.type === 'internal' ? (
                          <Database className={`h-5 w-5 ${connection.status === 'active' ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-600'}`} />
                        ) : (
                          <Server className={`h-5 w-5 ${connection.status === 'active' ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-600'}`} />
                        )}
                      </div>
                      <div>
                        <CardTitle className="text-lg">{connection.name}</CardTitle>
                        <CardDescription>
                          {connection.type === 'internal' ? 'Internal CRS' : `${connection.provider} - External`}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={connection.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : connection.status === 'error' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'}>
                        {connection.status === 'active' && <Check className="h-3 w-3 mr-1" />}
                        {connection.status === 'error' && <X className="h-3 w-3 mr-1" />}
                        {connection.status === 'inactive' && <WifiOff className="h-3 w-3 mr-1" />}
                        {connection.status}
                      </Badge>
                      <Button variant="outline" size="sm" onClick={() => openEditDialog(connection)}>
                        <Settings className="h-4 w-4 mr-1" />
                        Settings
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Last Sync</p>
                      <p className="text-sm font-medium">
                        {connection.lastSync ? new Date(connection.lastSync).toLocaleString() : 'Never'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Sync Interval</p>
                      <p className="text-sm font-medium">Every {connection.syncInterval} min</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Auto Sync</p>
                      <Switch
                        checked={connection.autoSync}
                        onCheckedChange={(checked) => handleToggleConnection(connection.id, checked)}
                      />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Actions</p>
                      <Button variant="outline" size="sm" onClick={() => handleTestConnection(connection.id)}>
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Test
                      </Button>
                    </div>
                  </div>
                  <Separator className="my-4" />
                  <div className="flex gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Features:</span>
                      {connection.features.inventory && <Badge variant="outline">Inventory</Badge>}
                      {connection.features.rates && <Badge variant="outline">Rates</Badge>}
                      {connection.features.bookings && <Badge variant="outline">Bookings</Badge>}
                      {connection.features.guests && <Badge variant="outline">Guests</Badge>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Booking Sources Tab */}
        <TabsContent value="sources" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Source</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Commission</TableHead>
                      <TableHead>Bookings</TableHead>
                      <TableHead>Revenue</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bookingSources.map((source) => (
                      <TableRow key={source.id} className={!source.enabled ? 'opacity-50' : ''}>
                        <TableCell className="font-medium">{source.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">{source.type}</Badge>
                        </TableCell>
                        <TableCell>{source.commission}%</TableCell>
                        <TableCell>{source.bookings}</TableCell>
                        <TableCell>{formatCurrency(source.revenue)}</TableCell>
                        <TableCell>
                          <Switch
                            checked={source.enabled}
                            onCheckedChange={(checked) => handleToggleSource(source.id, checked)}
                          />
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => {
                            setEditDialog({ open: true, item: source as unknown as CRSConnection });
                            setEditForm({
                              name: source.name,
                              endpoint: '',
                              apiKey: '',
                              syncInterval: 15,
                              autoSync: source.enabled,
                              features: { inventory: true, rates: true, bookings: true, guests: false },
                            });
                          }}>
                            <Settings className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Connection Dialog */}
      <Dialog open={editDialog.open} onOpenChange={(open) => setEditDialog({ open, item: editDialog.item })}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit CRS Connection</DialogTitle>
            <DialogDescription>
              Configure connection settings for {editDialog.item?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Connection Name</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>API Endpoint</Label>
              <Input
                value={editForm.endpoint}
                onChange={(e) => setEditForm({ ...editForm, endpoint: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>API Key</Label>
              <Input
                type="password"
                value={editForm.apiKey}
                onChange={(e) => setEditForm({ ...editForm, apiKey: e.target.value })}
                placeholder="••••••••"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sync Interval (minutes)</Label>
                <Select
                  value={editForm.syncInterval.toString()}
                  onValueChange={(value) => setEditForm({ ...editForm, syncInterval: parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 minutes</SelectItem>
                    <SelectItem value="15">15 minutes</SelectItem>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="60">1 hour</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Auto Sync</Label>
                <div className="flex items-center h-10">
                  <Switch
                    checked={editForm.autoSync}
                    onCheckedChange={(checked) => setEditForm({ ...editForm, autoSync: checked })}
                  />
                </div>
              </div>
            </div>
            <Separator />
            <div className="space-y-3">
              <Label>Features to Sync</Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Inventory</span>
                  <Switch
                    checked={editForm.features.inventory}
                    onCheckedChange={(checked) => setEditForm({ ...editForm, features: { ...editForm.features, inventory: checked } })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Rates</span>
                  <Switch
                    checked={editForm.features.rates}
                    onCheckedChange={(checked) => setEditForm({ ...editForm, features: { ...editForm.features, rates: checked } })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Bookings</span>
                  <Switch
                    checked={editForm.features.bookings}
                    onCheckedChange={(checked) => setEditForm({ ...editForm, features: { ...editForm.features, bookings: checked } })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Guests</span>
                  <Switch
                    checked={editForm.features.guests}
                    onCheckedChange={(checked) => setEditForm({ ...editForm, features: { ...editForm.features, guests: checked } })}
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog({ open: false, item: null })}>
              Cancel
            </Button>
            <Button onClick={handleSaveConnection}>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
