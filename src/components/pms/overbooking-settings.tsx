'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import {
  Settings2,
  AlertTriangle,
  TrendingUp,
  Shield,
  RefreshCw,
  Loader2,
  Pencil,
  Info,
  Percent,
  Hash,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface Property {
  id: string;
  name: string;
  currency: string;
}

interface RoomType {
  id: string;
  name: string;
  code: string;
  basePrice: number;
  totalRooms: number;
  propertyId: string;
  property?: Property;
  overbookingEnabled: boolean;
  overbookingPercentage: number;
  overbookingLimit: number;
  overbookingStats?: {
    activeBookings: number;
    availableForOverbooking: number;
  };
}

interface OverbookingStats {
  totalRoomTypes: number;
  enabledCount: number;
  totalOverbookingCapacity: number;
  avgOverbookingPercentage: number;
}

export default function OverbookingSettings() {
  const { toast } = useToast();
  const [properties, setProperties] = useState<Property[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<OverbookingStats | null>(null);

  // Dialog states
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedRoomType, setSelectedRoomType] = useState<RoomType | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    overbookingEnabled: false,
    overbookingPercentage: 0,
    overbookingLimit: 0,
  });

  // Fetch properties
  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const response = await fetch('/api/properties');
        const result = await response.json();
        if (result.success) {
          setProperties(result.data);
          if (result.data.length > 0) {
            setSelectedProperty(result.data[0].id);
          }
        }
      } catch (error) {
        console.error('Error fetching properties:', error);
        toast({
          title: 'Error',
          description: 'Failed to fetch properties',
          variant: 'destructive',
        });
      }
    };
    fetchProperties();
  }, []);

  // Fetch room types when property changes
  useEffect(() => {
    fetchRoomTypes();
  }, [selectedProperty]);

  // Open edit dialog
  const openEditDialog = (roomType: RoomType) => {
    setSelectedRoomType(roomType);
    setFormData({
      overbookingEnabled: roomType.overbookingEnabled,
      overbookingPercentage: roomType.overbookingPercentage,
      overbookingLimit: roomType.overbookingLimit,
    });
    setIsEditOpen(true);
  };

  // Handle update
  const handleUpdate = async () => {
    if (!selectedRoomType) return;
    setIsSaving(true);

    try {
      const response = await fetch(`/api/room-types/${selectedRoomType.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Overbooking settings updated successfully',
        });
        setIsEditOpen(false);
        setSelectedRoomType(null);
        // Refresh data
        fetchRoomTypes();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to update settings',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error updating overbooking settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to update overbooking settings',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Quick toggle overbooking
  const handleToggle = async (roomType: RoomType, enabled: boolean) => {
    try {
      const response = await fetch(`/api/room-types/${roomType.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          overbookingEnabled: enabled,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: `Overbooking ${enabled ? 'enabled' : 'disabled'} for ${roomType.name}`,
        });
        // Update local state
        setRoomTypes(prev =>
          prev.map(rt =>
            rt.id === roomType.id ? { ...rt, overbookingEnabled: enabled } : rt
          )
        );
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to update settings',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error toggling overbooking:', error);
      toast({
        title: 'Error',
        description: 'Failed to toggle overbooking',
        variant: 'destructive',
      });
    }
  };

  // Refresh data
  const fetchRoomTypes = async () => {
    if (!selectedProperty) return;
    setIsLoading(true);

    try {
      const response = await fetch(`/api/room-types?propertyId=${selectedProperty}`);
      const result = await response.json();

      if (result.success) {
        setRoomTypes(result.data);

        // Calculate stats
        const enabledCount = result.data.filter((rt: RoomType) => rt.overbookingEnabled).length;
        const totalOverbookingCapacity = result.data.reduce(
          (sum: number, rt: RoomType) => sum + (rt.overbookingStats?.availableForOverbooking || 0),
          0
        );
        const enabledRoomTypes = result.data.filter((rt: RoomType) => rt.overbookingEnabled);
        const avgOverbookingPercentage = enabledRoomTypes.length > 0
          ? enabledRoomTypes.reduce((sum: number, rt: RoomType) => sum + rt.overbookingPercentage, 0) / enabledRoomTypes.length
          : 0;

        setStats({
          totalRoomTypes: result.data.length,
          enabledCount,
          totalOverbookingCapacity,
          avgOverbookingPercentage: Math.round(avgOverbookingPercentage * 10) / 10,
        });
      }
    } catch (error) {
      console.error('Error fetching room types:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate effective overbooking
  const calculateEffectiveOverbooking = (roomType: RoomType) => {
    if (!roomType.overbookingEnabled) return 0;
    const percentageBased = Math.ceil(roomType.totalRooms * (roomType.overbookingPercentage / 100));
    return Math.min(percentageBased, roomType.overbookingLimit);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Overbooking Settings
          </h2>
          <p className="text-sm text-muted-foreground">
            Configure overbooking policies per room type
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchRoomTypes}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Warning Card */}
      <Card className="border-yellow-200 bg-yellow-50">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
            <div>
              <h4 className="font-medium text-yellow-800 dark:text-yellow-200">About Overbooking</h4>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                Overbooking allows you to sell more rooms than physically available, based on historical
                no-show and cancellation patterns. Use with caution and monitor closely to avoid guest
                displacement issues.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Property Select */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <Label className="text-sm font-medium">Select Property</Label>
            <Select value={selectedProperty} onValueChange={setSelectedProperty}>
              <SelectTrigger className="w-full sm:w-64">
                <SelectValue placeholder="Select Property" />
              </SelectTrigger>
              <SelectContent>
                {properties.map(property => (
                  <SelectItem key={property.id} value={property.id}>
                    {property.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats?.totalRoomTypes || 0}</div>
              <div className="text-xs text-muted-foreground">Total Room Types</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <Shield className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats?.enabledCount || 0}</div>
              <div className="text-xs text-muted-foreground">Overbooking Enabled</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Hash className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats?.totalOverbookingCapacity || 0}</div>
              <div className="text-xs text-muted-foreground">Total Overbooking Capacity</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Percent className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats?.avgOverbookingPercentage || 0}%</div>
              <div className="text-xs text-muted-foreground">Avg Overbooking %</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Room Types Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Overbooking Configuration</CardTitle>
          <CardDescription>
            Manage overbooking settings for each room type
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : roomTypes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Settings2 className="h-12 w-12 mb-4" />
              <p>No room types found</p>
              <p className="text-sm">Create room types to configure overbooking</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Room Type</TableHead>
                    <TableHead>Total Rooms</TableHead>
                    <TableHead>Overbooking</TableHead>
                    <TableHead>Percentage</TableHead>
                    <TableHead>Max Limit</TableHead>
                    <TableHead>Effective Capacity</TableHead>
                    <TableHead>Current Bookings</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roomTypes.map((roomType) => {
                    const effectiveCapacity = calculateEffectiveOverbooking(roomType);
                    const occupancyRate = roomType.overbookingStats?.activeBookings && roomType.totalRooms > 0
                      ? Math.round((roomType.overbookingStats.activeBookings / roomType.totalRooms) * 100)
                      : 0;

                    return (
                      <TableRow key={roomType.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{roomType.name}</div>
                            <div className="text-xs text-muted-foreground">{roomType.code}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{roomType.totalRooms} rooms</Badge>
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={roomType.overbookingEnabled}
                            onCheckedChange={(checked) => handleToggle(roomType, checked)}
                          />
                        </TableCell>
                        <TableCell>
                          {roomType.overbookingEnabled ? (
                            <Badge className="bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800">
                              {roomType.overbookingPercentage}%
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {roomType.overbookingEnabled ? (
                            <Badge className="bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800">
                              {roomType.overbookingLimit} rooms
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {roomType.overbookingEnabled ? (
                            <div>
                              <div className="font-medium text-green-600 dark:text-green-400">
                                +{effectiveCapacity} rooms
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Max {roomType.totalRooms + effectiveCapacity} total
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">
                                {roomType.overbookingStats?.activeBookings || 0}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                / {roomType.totalRooms}
                              </span>
                            </div>
                            <Progress
                              value={occupancyRate}
                              className={cn(
                                "h-2",
                                occupancyRate > 100 && "bg-red-100 dark:bg-red-900/30",
                                occupancyRate > 90 && occupancyRate <= 100 && "bg-yellow-100 dark:bg-yellow-900/30"
                              )}
                            />
                            <div className={cn(
                              "text-xs",
                              occupancyRate > 100 && "text-red-600 dark:text-red-400",
                              occupancyRate > 90 && "text-yellow-600 dark:text-yellow-400"
                            )}>
                              {occupancyRate}% occupied
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(roomType)}
                          >
                            <Pencil className="h-4 w-4 mr-1" />
                            Configure
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Overbooking Statistics */}
      {roomTypes.some(rt => rt.overbookingEnabled) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Overbooking Statistics</CardTitle>
            <CardDescription>
              Current overbooking status across all enabled room types
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {roomTypes
                .filter(rt => rt.overbookingEnabled)
                .map(roomType => {
                  const effectiveCapacity = calculateEffectiveOverbooking(roomType);
                  const activeBookings = roomType.overbookingStats?.activeBookings || 0;
                  const isOverbooked = activeBookings > roomType.totalRooms;
                  const overbookingUsed = Math.max(0, activeBookings - roomType.totalRooms);

                  return (
                    <div
                      key={roomType.id}
                      className={cn(
                        "p-4 rounded-lg border",
                        isOverbooked ? "bg-red-50 border-red-200" : "bg-muted/50"
                      )}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="font-medium">{roomType.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {roomType.totalRooms} rooms | {roomType.overbookingPercentage}% overbooking allowed
                          </div>
                        </div>
                        {isOverbooked && (
                          <Badge className="bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800">
                            Overbooked
                          </Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <div className="text-muted-foreground">Physical Rooms</div>
                          <div className="font-medium">{roomType.totalRooms}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Overbooking Capacity</div>
                          <div className="font-medium text-blue-600 dark:text-blue-400">+{effectiveCapacity}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Active Bookings</div>
                          <div className={cn(
                            "font-medium",
                            isOverbooked && "text-red-600 dark:text-red-400"
                          )}>
                            {activeBookings}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Overbooking Used</div>
                          <div className="font-medium text-orange-600 dark:text-orange-400">
                            {overbookingUsed} / {effectiveCapacity}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Configure Overbooking</DialogTitle>
            <DialogDescription>
              Set overbooking parameters for {selectedRoomType?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-4">
            {/* Enable Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <Label className="font-medium">Enable Overbooking</Label>
                <p className="text-xs text-muted-foreground">
                  Allow selling more rooms than available
                </p>
              </div>
              <Switch
                checked={formData.overbookingEnabled}
                onCheckedChange={(checked) =>
                  setFormData(prev => ({ ...prev, overbookingEnabled: checked }))
                }
              />
            </div>

            {formData.overbookingEnabled && (
              <>
                {/* Overbooking Percentage */}
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label htmlFor="percentage">Overbooking Percentage</Label>
                    <span className="text-sm text-muted-foreground">
                      {formData.overbookingPercentage}% = {Math.ceil((selectedRoomType?.totalRooms || 0) * (formData.overbookingPercentage / 100))} rooms
                    </span>
                  </div>
                  <Input
                    id="percentage"
                    type="number"
                    min="0"
                    max="50"
                    step="1"
                    value={formData.overbookingPercentage}
                    onChange={(e) =>
                      setFormData(prev => ({
                        ...prev,
                        overbookingPercentage: parseFloat(e.target.value) || 0,
                      }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Percentage of total rooms that can be overbooked. Recommended: 5-15%
                  </p>
                </div>

                {/* Max Limit */}
                <div className="space-y-2">
                  <Label htmlFor="limit">Maximum Overbooking Limit</Label>
                  <Input
                    id="limit"
                    type="number"
                    min="0"
                    max={selectedRoomType?.totalRooms || 10}
                    step="1"
                    value={formData.overbookingLimit}
                    onChange={(e) =>
                      setFormData(prev => ({
                        ...prev,
                        overbookingLimit: parseInt(e.target.value, 10) || 0,
                      }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Hard limit on how many rooms can be overbooked regardless of percentage
                  </p>
                </div>

                {/* Preview */}
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Info className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Preview</span>
                  </div>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span>Physical rooms:</span>
                      <span className="font-medium">{selectedRoomType?.totalRooms}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Percentage-based ({formData.overbookingPercentage}%):</span>
                      <span className="font-medium">
                        +{Math.ceil((selectedRoomType?.totalRooms || 0) * (formData.overbookingPercentage / 100))} rooms
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Hard limit:</span>
                      <span className="font-medium">+{formData.overbookingLimit} rooms</span>
                    </div>
                    <div className="border-t pt-1 mt-1 flex justify-between">
                      <span className="font-medium">Effective overbooking:</span>
                      <span className="font-bold text-green-600 dark:text-green-400">
                        +{Math.min(
                          Math.ceil((selectedRoomType?.totalRooms || 0) * (formData.overbookingPercentage / 100)),
                          formData.overbookingLimit
                        )} rooms
                      </span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Total sellable capacity:</span>
                      <span className="font-medium">
                        {(selectedRoomType?.totalRooms || 0) + Math.min(
                          Math.ceil((selectedRoomType?.totalRooms || 0) * (formData.overbookingPercentage / 100)),
                          formData.overbookingLimit
                        )} rooms
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
