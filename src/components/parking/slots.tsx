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
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Car,
  Plus,
  Search,
  Loader2,
  RefreshCw,
  Zap,
  Accessibility,
  Truck,
  Bike,
  CheckCircle2,
  XCircle,
  Wrench,
  Clock,
  Star,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { usePropertyId } from '@/hooks/use-property';

interface ParkingSlot {
  id: string;
  number: string;
  floor: number;
  type: string;
  vehicleType: string;
  hasCharging: boolean;
  chargerType?: string;
  status: string;
  vehicles?: {
    id: string;
    licensePlate: string;
    make?: string;
    model?: string;
    color?: string;
    guest?: {
      id: string;
      firstName: string;
      lastName: string;
    };
  }[];
}

const slotTypes = [
  { value: 'standard', label: 'Standard' },
  { value: 'compact', label: 'Compact' },
  { value: 'large', label: 'Large' },
  { value: 'accessible', label: 'Accessible' },
  { value: 'vip', label: 'VIP' },
  { value: 'electric', label: 'Electric / EV' },
];

const vehicleTypes = [
  { value: 'car', label: 'Car', icon: Car },
  { value: 'motorcycle', label: 'Motorcycle', icon: Bike },
  { value: 'truck', label: 'Truck', icon: Truck },
];

const statuses = [
  { value: 'available', label: 'Available', color: 'bg-emerald-500' },
  { value: 'occupied', label: 'Occupied', color: 'bg-red-500' },
  { value: 'reserved', label: 'Reserved', color: 'bg-amber-500' },
  { value: 'maintenance', label: 'Maintenance', color: 'bg-gray-500' },
];

export default function ParkingSlots() {
  const { toast } = useToast();
  const { propertyId } = usePropertyId();
  const [slots, setSlots] = useState<ParkingSlot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [summary, setSummary] = useState<{
    byStatus: Record<string, number>;
    occupancyRate: number;
  } | null>(null);

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<ParkingSlot | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteSlotId, setDeleteSlotId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    number: '',
    floor: '1',
    type: 'standard',
    vehicleType: 'car',
    hasCharging: false,
    chargerType: '',
  });

  // Fetch parking slots
  const fetchSlots = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (typeFilter !== 'all') params.append('type', typeFilter);
      if (propertyId) params.append('propertyId', propertyId);

      const response = await fetch(`/api/parking?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setSlots(result.data);
        setSummary(result.summary);
      }
    } catch (error) {
      console.error('Error fetching parking slots:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch parking slots',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSlots();
  }, [statusFilter, typeFilter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length >= 1 || searchQuery.length === 0) {
        fetchSlots();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Create parking slot
  const handleCreate = async () => {
    if (!formData.number) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a slot number',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/parking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          floor: parseInt(formData.floor),
          ...(propertyId ? { propertyId } : {}),
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Parking slot created successfully',
        });
        setIsCreateOpen(false);
        setFormData({
          number: '',
          floor: '1',
          type: 'standard',
          vehicleType: 'car',
          hasCharging: false,
          chargerType: '',
        });
        fetchSlots();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to create parking slot',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error creating parking slot:', error);
      toast({
        title: 'Error',
        description: 'Failed to create parking slot',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Update slot status
  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      const response = await fetch('/api/parking', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Slot status updated',
        });
        fetchSlots();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to update slot',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error updating slot:', error);
    }
  };

  // Delete slot
  const handleDelete = (id: string) => {
    setDeleteSlotId(id);
  };

  const confirmDelete = async () => {
    if (!deleteSlotId) return;

    try {
      const response = await fetch(`/api/parking?id=${deleteSlotId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Parking slot deleted',
        });
        fetchSlots();
        setIsDetailOpen(false);
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to delete slot',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error deleting slot:', error);
    } finally {
      setDeleteSlotId(null);
    }
  };

  const getStatusColor = (status: string) => {
    const option = statuses.find(o => o.value === status);
    return option?.color || 'bg-gray-500';
  };

  const getSlotIcon = (type: string) => {
    if (type === 'accessible') return <Accessibility className="h-4 w-4" />;
    if (type === 'electric') return <Zap className="h-4 w-4" />;
    if (type === 'vip') return <Star className="h-4 w-4" />;
    if (type === 'large') return <Truck className="h-4 w-4" />;
    return <Car className="h-4 w-4" />;
  };

  // Group slots by floor
  const slotsByFloor = slots.reduce((acc, slot) => {
    const floor = slot.floor;
    if (!acc[floor]) acc[floor] = [];
    acc[floor].push(slot);
    return acc;
  }, {} as Record<number, ParkingSlot[]>);

  if (!propertyId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <Car className="h-12 w-12 mb-4" />
        <p className="text-lg font-medium">No Property Selected</p>
        <p className="text-sm">Please select a property to manage parking slots</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Car className="h-5 w-5" />
            Parking Slots
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage parking inventory and slot assignments
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchSlots}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-md hover:shadow-lg transition-all" onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Slot
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{summary?.byStatus?.available || 0}</div>
              <div className="text-xs text-muted-foreground">Available</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-red-500/10">
              <XCircle className="h-4 w-4 text-red-500 dark:text-red-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{summary?.byStatus?.occupied || 0}</div>
              <div className="text-xs text-muted-foreground">Occupied</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Clock className="h-4 w-4 text-amber-500 dark:text-amber-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{summary?.byStatus?.reserved || 0}</div>
              <div className="text-xs text-muted-foreground">Reserved</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <Car className="h-4 w-4 text-violet-500 dark:text-violet-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{summary?.occupancyRate || 0}%</div>
              <div className="text-xs text-muted-foreground">Occupancy</div>
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
                  placeholder="Search by slot number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
                />
              </div>
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {slotTypes.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {statuses.map(status => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Parking Grid by Floor */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : slots.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Car className="h-12 w-12 mb-4" />
          <p>No parking slots found</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(slotsByFloor).map(([floor, floorSlots]) => (
            <Card key={floor}>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-lg">Floor {floor}</CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
                  {floorSlots.map((slot) => (
                    <div
                      key={slot.id}
                      className={cn(
                        'p-2 rounded-lg border-2 cursor-pointer transition-all hover:scale-105',
                        getStatusColor(slot.status),
                        slot.status === 'available' && 'border-emerald-500/50',
                        slot.status === 'occupied' && 'border-red-500/50',
                        slot.status === 'reserved' && 'border-amber-500/50',
                        slot.status === 'maintenance' && 'border-gray-500/50'
                      )}
                      onClick={() => {
                        setSelectedSlot(slot);
                        setIsDetailOpen(true);
                      }}
                    >
                      <div className="text-white text-center">
                        <div className="flex justify-center mb-1">
                          {getSlotIcon(slot.type)}
                        </div>
                        <p className="text-xs font-bold">{slot.number}</p>
                        {slot.hasCharging && (
                          <Zap className="h-3 w-3 mx-auto mt-1 text-yellow-300 dark:text-yellow-200" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Slot Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Parking Slot</DialogTitle>
            <DialogDescription>
              Create a new parking slot
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Slot Number</Label>
                <Input
                  placeholder="A-101"
                  value={formData.number}
                  onChange={(e) => setFormData(prev => ({ ...prev, number: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Floor</Label>
                <Select
                  value={formData.floor}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, floor: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select floor" />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map(f => (
                      <SelectItem key={f} value={f.toString()}>
                        Floor {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Slot Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {slotTypes.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Vehicle Type</Label>
                <Select
                  value={formData.vehicleType}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, vehicleType: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicleTypes.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {formData.type === 'electric' && (
              <div className="space-y-2">
                <Label>Charger Type</Label>
                <Select
                  value={formData.chargerType}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, chargerType: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select charger" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="level1">Level 1 (120V)</SelectItem>
                    <SelectItem value="level2">Level 2 (240V)</SelectItem>
                    <SelectItem value="dc_fast">DC Fast Charging</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Slot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Slot Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Slot {selectedSlot?.number}</DialogTitle>
          </DialogHeader>
          {selectedSlot && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Badge 
                  variant="secondary" 
                  className={cn('text-white', getStatusColor(selectedSlot.status))}
                >
                  {selectedSlot.status.charAt(0).toUpperCase() + selectedSlot.status.slice(1)}
                </Badge>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {getSlotIcon(selectedSlot.type)}
                  <span className="capitalize">{selectedSlot.type}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Floor</p>
                  <p className="font-medium">{selectedSlot.floor}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Vehicle Type</p>
                  <p className="font-medium capitalize">{selectedSlot.vehicleType}</p>
                </div>
                {selectedSlot.hasCharging && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground">EV Charging</p>
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                      <p className="font-medium capitalize">{selectedSlot.chargerType || 'Available'}</p>
                    </div>
                  </div>
                )}
              </div>

              {selectedSlot.vehicles && selectedSlot.vehicles.length > 0 && (
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm font-medium mb-2">Parked Vehicle</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">License:</span>
                      <span className="font-medium">{selectedSlot.vehicles[0].licensePlate}</span>
                    </div>
                    {selectedSlot.vehicles[0].make && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Vehicle:</span>
                        <span>{selectedSlot.vehicles[0].make} {selectedSlot.vehicles[0].model}</span>
                      </div>
                    )}
                    {selectedSlot.vehicles[0].guest && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Guest:</span>
                        <span>{selectedSlot.vehicles[0].guest.firstName} {selectedSlot.vehicles[0].guest.lastName}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                {selectedSlot.status === 'available' && (
                  <>
                    <Button 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => {
                        handleUpdateStatus(selectedSlot.id, 'reserved');
                        setIsDetailOpen(false);
                      }}
                    >
                      Reserve
                    </Button>
                    <Button 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => {
                        handleUpdateStatus(selectedSlot.id, 'maintenance');
                        setIsDetailOpen(false);
                      }}
                    >
                      <Wrench className="h-4 w-4 mr-2" />
                      Maintenance
                    </Button>
                  </>
                )}
                {(selectedSlot.status === 'reserved' || selectedSlot.status === 'maintenance') && (
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => {
                      handleUpdateStatus(selectedSlot.id, 'available');
                      setIsDetailOpen(false);
                    }}
                  >
                    Set Available
                  </Button>
                )}
                {selectedSlot.status === 'available' && (
                  <Button 
                    variant="destructive" 
                    className="flex-1"
                    onClick={() => {
                      handleDelete(selectedSlot.id);
                    }}
                  >
                    Delete
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteSlotId} onOpenChange={(open) => !open && setDeleteSlotId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Parking Slot</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this parking slot? This action cannot be undone.
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
