'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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
  RefreshCw,
  Plus,
  Layers,
  Link2,
  Unlink,
  Check,
  X,
  Edit,
  Trash2,
  Settings,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';

interface ChannelMapping {
  id: string;
  connectionId: string;
  channelName: string;
  channelType: string;
  roomTypeId: string;
  roomTypeName: string;
  ratePlanId: string | null;
  ratePlanName: string | null;
  externalRoomId: string;
  externalRoomName: string;
  externalRateId: string | null;
  externalRateName: string | null;
  syncInventory: boolean;
  syncRates: boolean;
  syncRestrictions: boolean;
  status: string;
}

interface RoomType {
  id: string;
  name: string;
  code: string;
}

interface RatePlan {
  id: string;
  name: string;
  code: string;
  roomTypeId: string;
}

interface MappingStats {
  total: number;
  active: number;
  syncedInventory: number;
  syncedRates: number;
}

export default function ChannelMapping() {
  const [mappings, setMappings] = useState<ChannelMapping[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([]);
  const [stats, setStats] = useState<MappingStats>({ total: 0, active: 0, syncedInventory: 0, syncedRates: 0 });
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [connections, setConnections] = useState<Array<{ id: string; displayName: string; channel: string }>>([]);
  const [formData, setFormData] = useState({
    connectionId: '',
    roomTypeId: '',
    ratePlanId: '',
    externalRoomId: '',
    externalRoomName: '',
    externalRateId: '',
    externalRateName: '',
    syncInventory: true,
    syncRates: true,
    syncRestrictions: true,
  });
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/channels/mapping');
      const result = await response.json();
      
      if (result.success) {
        setMappings(result.data);
        setRoomTypes(result.roomTypes || []);
        setRatePlans(result.ratePlans || []);
        setStats(result.stats);
      } else {
        toast.error('Failed to load channel mappings');
      }
    } catch (error) {
      console.error('Error fetching mappings:', error);
      toast.error('Failed to load channel mappings');
    } finally {
      setLoading(false);
    }
  };

  const fetchConnections = async () => {
    try {
      const response = await fetch('/api/channels/connections');
      const result = await response.json();
      
      if (result.success) {
        setConnections(result.data.map((c: { id: string; displayName: string | null; channel: string }) => ({
          id: c.id,
          displayName: c.displayName || c.channel,
          channel: c.channel,
        })));
      }
    } catch (error) {
      console.error('Error fetching connections:', error);
    }
  };

  useEffect(() => {
    fetchData();
    fetchConnections();
  }, []);

  const handleToggleSync = async (id: string, field: keyof ChannelMapping, value: boolean) => {
    try {
      // Update mapping via API
      await fetch('/api/channels/mapping', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, [field]: value }),
      });
      
      setMappings(prev => prev.map(item => 
        item.id === id ? { ...item, [field]: value } : item
      ));
      toast.success('Mapping updated');
    } catch {
      toast.error('Failed to update mapping');
    }
  };

  const handleDelete = (id: string) => {
    setDeleteItemId(id);
  };

  const confirmDelete = async () => {
    if (!deleteItemId) return;
    
    try {
      await fetch(`/api/channels/mapping?id=${deleteItemId}`, { method: 'DELETE' });
      setMappings(prev => prev.filter(item => item.id !== deleteItemId));
      toast.success('Mapping deleted');
    } catch {
      toast.error('Failed to delete mapping');
    } finally {
      setDeleteItemId(null);
    }
  };

  const handleAddMapping = async () => {
    try {
      const roomType = roomTypes.find(rt => rt.id === formData.roomTypeId);
      const ratePlan = formData.ratePlanId ? ratePlans.find(rp => rp.id === formData.ratePlanId) : null;
      const connection = connections.find(c => c.id === formData.connectionId);
      
      const response = await fetch('/api/channels/mapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId: formData.connectionId,
          roomTypeId: formData.roomTypeId,
          ratePlanId: formData.ratePlanId || null,
          externalRoomId: formData.externalRoomId,
          externalRoomName: formData.externalRoomName,
          externalRateId: formData.externalRateId || null,
          externalRateName: formData.externalRateName || null,
          syncInventory: formData.syncInventory,
          syncRates: formData.syncRates,
          syncRestrictions: formData.syncRestrictions,
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        const newMapping: ChannelMapping = {
          id: result.data.id,
          connectionId: formData.connectionId,
          channelName: connection?.displayName || 'Unknown',
          channelType: connection?.channel || 'unknown',
          roomTypeId: formData.roomTypeId,
          roomTypeName: roomType?.name || '',
          ratePlanId: formData.ratePlanId || null,
          ratePlanName: ratePlan?.name || null,
          externalRoomId: formData.externalRoomId,
          externalRoomName: formData.externalRoomName,
          externalRateId: formData.externalRateId || null,
          externalRateName: formData.externalRateName || null,
          syncInventory: formData.syncInventory,
          syncRates: formData.syncRates,
          syncRestrictions: formData.syncRestrictions,
          status: 'active',
        };

        setMappings(prev => [...prev, newMapping]);
        toast.success('Mapping created');
        setShowAddDialog(false);
        setFormData({
          connectionId: '',
          roomTypeId: '',
          ratePlanId: '',
          externalRoomId: '',
          externalRoomName: '',
          externalRateId: '',
          externalRateName: '',
          syncInventory: true,
          syncRates: true,
          syncRestrictions: true,
        });
      } else {
        toast.error(result.error?.message || 'Failed to create mapping');
      }
    } catch {
      toast.error('Failed to create mapping');
    }
  };

  // Group by channel
  const groupedByChannel = mappings.reduce((acc, item) => {
    const key = item.channelName;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as Record<string, ChannelMapping[]>);

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
          <h1 className="text-2xl font-bold tracking-tight">Channel Mapping</h1>
          <p className="text-muted-foreground">Map your room types and rate plans to external channels</p>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Mapping
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Add Channel Mapping</DialogTitle>
              <DialogDescription>
                Link your room types and rate plans to external channel products
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Channel</Label>
                  <Select
                    value={formData.connectionId}
                    onValueChange={(value) => setFormData({ ...formData, connectionId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select channel" />
                    </SelectTrigger>
                    <SelectContent>
                      {connections.map((conn) => (
                        <SelectItem key={conn.id} value={conn.id}>{conn.displayName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Room Type</Label>
                  <Select
                    value={formData.roomTypeId}
                    onValueChange={(value) => setFormData({ ...formData, roomTypeId: value, ratePlanId: '' })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select room type" />
                    </SelectTrigger>
                    <SelectContent>
                      {roomTypes.map((rt) => (
                        <SelectItem key={rt.id} value={rt.id}>{rt.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Rate Plan (Optional)</Label>
                <Select
                  value={formData.ratePlanId}
                  onValueChange={(value) => setFormData({ ...formData, ratePlanId: value })}
                  disabled={!formData.roomTypeId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select rate plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {ratePlans
                      .filter(rp => rp.roomTypeId === formData.roomTypeId)
                      .map((rp) => (
                        <SelectItem key={rp.id} value={rp.id}>{rp.name}</SelectItem>
                      ))}
                    <SelectItem value="">No rate plan</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="font-medium">External Channel Details</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>External Room ID</Label>
                    <Input
                      value={formData.externalRoomId}
                      onChange={(e) => setFormData({ ...formData, externalRoomId: e.target.value })}
                      placeholder="e.g., BC_STD_001"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>External Room Name</Label>
                    <Input
                      value={formData.externalRoomName}
                      onChange={(e) => setFormData({ ...formData, externalRoomName: e.target.value })}
                      placeholder="e.g., Standard Double Room"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>External Rate ID (Optional)</Label>
                    <Input
                      value={formData.externalRateId}
                      onChange={(e) => setFormData({ ...formData, externalRateId: e.target.value })}
                      placeholder="e.g., BC_BAR"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>External Rate Name</Label>
                    <Input
                      value={formData.externalRateName}
                      onChange={(e) => setFormData({ ...formData, externalRateName: e.target.value })}
                      placeholder="e.g., Best Available Rate"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <h4 className="font-medium">Sync Settings</h4>
                <div className="flex items-center justify-between">
                  <Label>Sync Inventory</Label>
                  <Switch
                    checked={formData.syncInventory}
                    onCheckedChange={(checked) => setFormData({ ...formData, syncInventory: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Sync Rates</Label>
                  <Switch
                    checked={formData.syncRates}
                    onCheckedChange={(checked) => setFormData({ ...formData, syncRates: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Sync Restrictions</Label>
                  <Switch
                    checked={formData.syncRestrictions}
                    onCheckedChange={(checked) => setFormData({ ...formData, syncRestrictions: checked })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddMapping} disabled={!formData.connectionId || !formData.roomTypeId || !formData.externalRoomId}>
                Create Mapping
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-slate-500/10 to-slate-600/5 border-slate-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-500/20">
                <Layers className="h-5 w-5 text-slate-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Mappings</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <Check className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.active}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border-cyan-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/20">
                <Link2 className="h-5 w-5 text-cyan-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.syncedInventory}</p>
                <p className="text-xs text-muted-foreground">Inventory Sync</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <Settings className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.syncedRates}</p>
                <p className="text-xs text-muted-foreground">Rate Sync</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mapping Tables by Channel */}
      {Object.keys(groupedByChannel).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No channel mappings configured</p>
            <p className="text-sm text-muted-foreground">Add mappings to sync inventory and rates with channels</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedByChannel).map(([channelName, items]) => (
            <Card key={channelName}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{channelName}</CardTitle>
                <CardDescription>{items.length} mappings configured</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Room Type</TableHead>
                        <TableHead>Rate Plan</TableHead>
                        <TableHead>External Room</TableHead>
                        <TableHead>External Rate</TableHead>
                        <TableHead>Sync Inv.</TableHead>
                        <TableHead>Sync Rates</TableHead>
                        <TableHead>Sync Rest.</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.roomTypeName}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {item.ratePlanName || '—'}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span>{item.externalRoomName}</span>
                              <span className="text-xs text-muted-foreground">{item.externalRoomId}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {item.externalRateName ? (
                              <div className="flex flex-col">
                                <span>{item.externalRateName}</span>
                                <span className="text-xs">{item.externalRateId}</span>
                              </div>
                            ) : '—'}
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={item.syncInventory}
                              onCheckedChange={(checked) => handleToggleSync(item.id, 'syncInventory', checked)}
                            />
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={item.syncRates}
                              onCheckedChange={(checked) => handleToggleSync(item.id, 'syncRates', checked)}
                            />
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={item.syncRestrictions}
                              onCheckedChange={(checked) => handleToggleSync(item.id, 'syncRestrictions', checked)}
                            />
                          </TableCell>
                          <TableCell>
                            <Badge className={item.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700'}>
                              {item.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => handleDelete(item.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteItemId} onOpenChange={(open) => !open && setDeleteItemId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Mapping</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this mapping?
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
