'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Wifi, WifiOff, AlertCircle, Plus, Search, MoreHorizontal,
  Thermometer, Lightbulb, Lock, Tv, Blinds, AirVent, Activity,
  Pencil, Trash2, Power, PowerOff, RefreshCw, Unlock
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface Device {
  id: string;
  name: string;
  type: string;
  status: string;
  protocol: string;
  ipAddress?: string;
  manufacturer?: string;
  model?: string;
  roomName?: string;
  propertyName?: string;
  currentState: Record<string, any>;
  config: Record<string, any>;
  lastHeartbeat?: string;
  _count?: { readings: number; commands: number };
}

interface Stats {
  total: number;
  online: number;
  offline: number;
  error: number;
  byType: Record<string, number>;
}

const deviceTypeIcons: Record<string, any> = {
  thermostat: Thermometer,
  light: Lightbulb,
  lock: Lock,
  sensor: Activity,
  tv: Tv,
  blind: Blinds,
  ac: AirVent
};

const statusColors: Record<string, string> = {
  online: 'bg-green-500',
  offline: 'bg-gray-400',
  error: 'bg-red-500'
};

const deviceTypeGradient: Record<string, string> = {
  thermostat: 'bg-gradient-to-br from-orange-500 to-red-500',
  light: 'bg-gradient-to-br from-yellow-400 to-amber-500',
  lock: 'bg-gradient-to-br from-emerald-500 to-teal-600',
  sensor: 'bg-gradient-to-br from-violet-500 to-purple-600',
  tv: 'bg-gradient-to-br from-cyan-500 to-sky-600',
  blind: 'bg-gradient-to-br from-pink-500 to-rose-600',
  ac: 'bg-gradient-to-br from-sky-400 to-blue-600',
};

const statusBadgeVariants: Record<string, 'default' | 'secondary' | 'destructive'> = {
  online: 'default',
  offline: 'secondary',
  error: 'destructive'
};

export default function DeviceManagement() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
  const [unlockDeviceId, setUnlockDeviceId] = useState<string | null>(null);
  const [properties, setProperties] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    type: 'thermostat',
    propertyId: '',
    roomId: '',
    manufacturer: '',
    model: '',
    serialNumber: '',
    protocol: 'wifi',
    ipAddress: '',
    macAddress: ''
  });

  useEffect(() => {
    fetchDevices();
    fetchProperties();
  }, []);

  const fetchDevices = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/iot/devices');
      if (response.ok) {
        const data = await response.json();
        setDevices(data.devices);
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching devices:', error);
      toast.error('Failed to fetch devices');
    } finally {
      setLoading(false);
    }
  };

  const fetchProperties = async () => {
    try {
      const response = await fetch('/api/properties');
      if (response.ok) {
        const data = await response.json();
        setProperties(data.properties || []);
      }
    } catch (error) {
      console.error('Error fetching properties:', error);
    }
  };

  const fetchRooms = async (propertyId: string) => {
    try {
      const response = await fetch(`/api/rooms?propertyId=${propertyId}`);
      if (response.ok) {
        const data = await response.json();
        setRooms(data.rooms || []);
      }
    } catch (error) {
      console.error('Error fetching rooms:', error);
    }
  };

  const handleCreateDevice = async () => {
    try {
      const response = await fetch('/api/iot/devices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        toast.success('Device created successfully');
        setDialogOpen(false);
        resetForm();
        fetchDevices();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to create device');
      }
    } catch (error) {
      console.error('Error creating device:', error);
      toast.error('Failed to create device');
    }
  };

  const handleUpdateDevice = async () => {
    if (!selectedDevice) return;

    try {
      const response = await fetch(`/api/iot/devices/${selectedDevice.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        toast.success('Device updated successfully');
        setDialogOpen(false);
        resetForm();
        fetchDevices();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to update device');
      }
    } catch (error) {
      console.error('Error updating device:', error);
      toast.error('Failed to update device');
    }
  };

  const handleDeleteDevice = (deviceId: string) => {
    setDeleteItemId(deviceId);
  };

  const confirmDelete = async () => {
    if (!deleteItemId) return;

    try {
      const response = await fetch(`/api/iot/devices/${deleteItemId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        toast.success('Device deleted successfully');
        fetchDevices();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to delete device');
      }
    } catch (error) {
      console.error('Error deleting device:', error);
      toast.error('Failed to delete device');
    } finally {
      setDeleteItemId(null);
    }
  };

  const handleSendCommand = async (deviceId: string, command: string, params: any = {}) => {
    try {
      const response = await fetch(`/api/iot/devices/${deviceId}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, parameters: params, source: 'manual' })
      });

      if (response.ok) {
        toast.success(`Command "${command}" sent successfully`);
        fetchDevices();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to send command');
      }
    } catch (error) {
      console.error('Error sending command:', error);
      toast.error('Failed to send command');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'thermostat',
      propertyId: '',
      roomId: '',
      manufacturer: '',
      model: '',
      serialNumber: '',
      protocol: 'wifi',
      ipAddress: '',
      macAddress: ''
    });
    setSelectedDevice(null);
  };

  const openEditDialog = (device: Device) => {
    setSelectedDevice(device);
    setFormData({
      name: device.name,
      type: device.type,
      propertyId: (device as any).propertyId || '',
      roomId: (device as any).roomId || '',
      manufacturer: device.manufacturer || '',
      model: device.model || '',
      serialNumber: (device as any).serialNumber || '',
      protocol: device.protocol,
      ipAddress: device.ipAddress || '',
      macAddress: (device as any).macAddress || ''
    });
    // Fetch rooms for the device's property if propertyId exists
    const propId = (device as any).propertyId;
    if (propId) {
      fetchRooms(propId);
    }
    setDialogOpen(true);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const filteredDevices = devices.filter(device => {
    const matchesSearch = device.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (device.roomName && device.roomName.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesType = filterType === 'all' || device.type === filterType;
    const matchesStatus = filterStatus === 'all' || device.status === filterStatus;
    return matchesSearch && matchesType && matchesStatus;
  });

  const getDeviceIcon = (type: string) => {
    const Icon = deviceTypeIcons[type] || Activity;
    return <Icon className="h-5 w-5" />;
  };

  const StatusIndicator = ({ status }: { status: string }) => {
    const color = statusColors[status] || 'bg-gray-400';
    return (
      <div className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          {status === 'online' && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>}
          <span className={cn('relative inline-flex rounded-full h-2.5 w-2.5', color)}></span>
        </span>
        <Badge variant={statusBadgeVariants[status] || 'secondary'} className={cn(
          status === 'online' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700',
          status === 'offline' && 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border border-gray-200 dark:border-gray-700',
          status === 'error' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-700'
        )}>
          {status === 'online' ? 'Online' : status === 'offline' ? 'Offline' : 'Error'}
        </Badge>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600 dark:text-teal-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">IoT Device Management</h1>
        <p className="text-muted-foreground">
          Manage and monitor all smart devices across your properties
        </p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Devices</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <Activity className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Online</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.online}</p>
                </div>
                <Wifi className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Offline</p>
                  <p className="text-2xl font-bold text-gray-500">{stats.offline}</p>
                </div>
                <WifiOff className="h-8 w-8 text-gray-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Errors</p>
                  <p className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.error}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters and Actions */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search devices..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-all"
                />
              </div>
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Device Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="thermostat">Thermostat</SelectItem>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="lock">Lock</SelectItem>
                <SelectItem value="sensor">Sensor</SelectItem>
                <SelectItem value="tv">TV</SelectItem>
                <SelectItem value="blind">Blinds</SelectItem>
                <SelectItem value="ac">AC</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="online">Online</SelectItem>
                <SelectItem value="offline">Offline</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={openCreateDialog} className="bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white shadow-md hover:shadow-lg transition-all">
              <Plus className="h-4 w-4 mr-2" />
              Add Device
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Devices Table */}
      <Card>
        <CardContent className="p-0">
          <ScrollArea className="max-h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Device</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Protocol</TableHead>
                  <TableHead>Last Seen</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDevices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No devices found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDevices.map((device) => (
                    <TableRow key={device.id} className="transition-colors hover:bg-muted/60 hover:shadow-sm">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className={cn('p-2.5 rounded-lg text-white shadow-sm', deviceTypeGradient[device.type] || 'bg-gradient-to-br from-gray-400 to-gray-500')}>
                            {getDeviceIcon(device.type)}
                          </div>
                          <div>
                            <p className="font-medium">{device.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {device.manufacturer} {device.model}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn('capitalize',
                          device.type === 'thermostat' && 'border-orange-300 text-orange-700 dark:text-orange-300 bg-orange-50',
                          device.type === 'light' && 'border-yellow-300 text-yellow-700 dark:text-yellow-300 bg-yellow-50',
                          device.type === 'lock' && 'border-emerald-300 text-emerald-700 dark:text-emerald-300 bg-emerald-50',
                          device.type === 'sensor' && 'border-violet-300 text-violet-700 dark:text-violet-300 bg-violet-50',
                          device.type === 'tv' && 'border-cyan-300 text-cyan-700 dark:text-cyan-300 bg-cyan-50',
                          device.type === 'blind' && 'border-pink-300 text-pink-700 dark:text-pink-300 bg-pink-50',
                          device.type === 'ac' && 'border-sky-300 text-sky-700 dark:text-sky-300 bg-sky-50'
                        )}>{device.type}</Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{device.roomName || 'Unassigned'}</p>
                          <p className="text-sm text-muted-foreground">{device.propertyName}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusIndicator status={device.status} />
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{device.protocol}</Badge>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">
                          {device.lastHeartbeat 
                            ? new Date(device.lastHeartbeat).toLocaleString()
                            : 'Never'}
                        </p>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {device.status === 'online' && (
                            <>
                              {device.type === 'lock' ? (
                                device.currentState?.locked ? (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setUnlockDeviceId(device.id)}
                                    title="Unlock Door"
                                    className="text-amber-600 dark:text-amber-400 hover:text-amber-700 hover:bg-amber-50"
                                  >
                                    <Lock className="h-4 w-4" />
                                  </Button>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleSendCommand(device.id, 'lock')}
                                    title="Lock Door"
                                    className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 hover:bg-emerald-50"
                                  >
                                    <Unlock className="h-4 w-4" />
                                  </Button>
                                )
                              ) : (
                                device.currentState?.isOn ? (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleSendCommand(device.id, 'turn_off')}
                                    title="Turn Off"
                                  >
                                    <PowerOff className="h-4 w-4" />
                                  </Button>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleSendCommand(device.id, 'turn_on')}
                                    title="Turn On"
                                  >
                                    <Power className="h-4 w-4" />
                                  </Button>
                                )
                              )}
                            </>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(device)}
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteDevice(device.id)}
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Door Unlock Confirmation Dialog */}
      <AlertDialog open={!!unlockDeviceId} onOpenChange={(open) => !open && setUnlockDeviceId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unlock Door</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to unlock this door? This will allow access to the room.
              This action will be logged for security purposes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (unlockDeviceId) {
                  await handleSendCommand(unlockDeviceId, 'unlock');
                  setUnlockDeviceId(null);
                }
              }}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Unlock
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteItemId} onOpenChange={(open) => !open && setDeleteItemId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Device</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this device? This action cannot be undone.
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

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedDevice ? 'Edit Device' : 'Add New Device'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Device Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Room 101 Thermostat"
              />
            </div>
            <div className="space-y-2">
              <Label>Device Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="thermostat">Thermostat</SelectItem>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="lock">Smart Lock</SelectItem>
                  <SelectItem value="sensor">Sensor</SelectItem>
                  <SelectItem value="tv">Smart TV</SelectItem>
                  <SelectItem value="blind">Motorized Blinds</SelectItem>
                  <SelectItem value="ac">Air Conditioner</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Protocol</Label>
              <Select
                value={formData.protocol}
                onValueChange={(value) => setFormData({ ...formData, protocol: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="wifi">WiFi</SelectItem>
                  <SelectItem value="zigbee">Zigbee</SelectItem>
                  <SelectItem value="z-wave">Z-Wave</SelectItem>
                  <SelectItem value="bluetooth">Bluetooth</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Manufacturer</Label>
              <Input
                value={formData.manufacturer}
                onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                placeholder="e.g., Nest, Philips, August"
              />
            </div>
            <div className="space-y-2">
              <Label>Model</Label>
              <Input
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                placeholder="e.g., Learning Thermostat"
              />
            </div>
            <div className="space-y-2">
              <Label>IP Address</Label>
              <Input
                value={formData.ipAddress}
                onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                placeholder="e.g., 192.168.1.100"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={selectedDevice ? handleUpdateDevice : handleCreateDevice}>
              {selectedDevice ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
