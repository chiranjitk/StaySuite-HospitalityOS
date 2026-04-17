'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  Key,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Wrench,
  Clock,
  User,
  Bed,
  MapPin,
  Eye,
  Sparkles,
  Ban,
  Star,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface RoomType {
  id: string;
  name: string;
  code: string;
}

interface Room {
  id: string;
  number: string;
  floor: number;
  status: string;
  isAccessible: boolean;
  isSmoking: boolean;
  hasBalcony: boolean;
  hasSeaView: boolean;
  dnd?: boolean;
  hkPriority?: string;
  roomType: RoomType;
  property: {
    id: string;
    name: string;
  };
  bookings?: Array<{
    id: string;
    checkIn: string;
    checkOut: string;
    status: string;
    primaryGuest: {
      firstName: string;
      lastName: string;
    };
  }>;
}

interface Property {
  id: string;
  name: string;
}

const roomStatuses = [
  { value: 'available', label: 'Available', color: 'bg-emerald-500', textColor: 'text-emerald-500', icon: CheckCircle2 },
  { value: 'occupied', label: 'Occupied', color: 'bg-violet-500', textColor: 'text-violet-500', icon: User },
  { value: 'dirty', label: 'Dirty', color: 'bg-amber-500', textColor: 'text-amber-500', icon: Bed },
  { value: 'cleaning', label: 'Cleaning', color: 'bg-cyan-500', textColor: 'text-cyan-500', icon: Sparkles },
  { value: 'inspected', label: 'Inspected', color: 'bg-blue-500', textColor: 'text-blue-500', icon: Eye },
  { value: 'maintenance', label: 'Maintenance', color: 'bg-orange-500', textColor: 'text-orange-500', icon: Wrench },
  { value: 'out_of_order', label: 'Out of Order', color: 'bg-red-500', textColor: 'text-red-500', icon: XCircle },
];

const VALID_TRANSITIONS: Record<string, string[]> = {
  available: ['occupied', 'dirty', 'maintenance', 'out_of_order'],
  occupied: ['dirty', 'available', 'maintenance', 'out_of_order'],
  dirty: ['cleaning', 'maintenance', 'out_of_order'],
  cleaning: ['inspected', 'dirty', 'maintenance'],
  inspected: ['available', 'dirty'],
  maintenance: ['available', 'dirty', 'out_of_order'],
  out_of_order: ['available', 'maintenance'],
};

export default function RoomStatus() {
  const { toast } = useToast();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [propertyFilter, setPropertyFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [floorFilter, setFloorFilter] = useState<string>('all');
  
  // Dialog states
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isStatusChangeOpen, setIsStatusChangeOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  // Fetch properties
  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const response = await fetch('/api/properties');
        const result = await response.json();
        if (result.success) {
          setProperties(result.data);
        }
      } catch (error) {
        console.error('Error fetching properties:', error);
      }
    };
    fetchProperties();
  }, []);

  // Fetch rooms
  const fetchRooms = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (propertyFilter !== 'all') params.append('propertyId', propertyFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      
      const response = await fetch(`/api/rooms?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setRooms(result.data);
      }
    } catch (error) {
      console.error('Error fetching rooms:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch rooms',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, [propertyFilter, statusFilter]);

  // Get unique floors
  const floors = [...new Set(rooms.map(r => r.floor))].sort((a, b) => a - b);

  // Filter rooms by floor
  const filteredRooms = floorFilter === 'all' 
    ? rooms 
    : rooms.filter(r => r.floor === parseInt(floorFilter));

  // Group rooms by floor
  const roomsByFloor = filteredRooms.reduce((acc, room) => {
    const floor = room.floor;
    if (!acc[floor]) acc[floor] = [];
    acc[floor].push(room);
    return acc;
  }, {} as Record<number, Room[]>);

  // Stats
  const stats = {
    total: rooms.length,
    available: rooms.filter(r => r.status === 'available').length,
    occupied: rooms.filter(r => r.status === 'occupied').length,
    dirty: rooms.filter(r => r.status === 'dirty').length,
    cleaning: rooms.filter(r => r.status === 'cleaning').length,
    inspected: rooms.filter(r => r.status === 'inspected').length,
    maintenance: rooms.filter(r => r.status === 'maintenance').length,
    outOfOrder: rooms.filter(r => r.status === 'out_of_order').length,
  };

  // Handle status change
  const handleStatusChange = async () => {
    if (!selectedRoom || !newStatus) return;

    // Validate status transition
    const allowed = VALID_TRANSITIONS[selectedRoom.status];
    if (!allowed?.includes(newStatus)) {
      toast({
        title: 'Invalid transition',
        description: `Cannot change from ${selectedRoom.status.replace('_', ' ')} to ${newStatus.replace('_', ' ')}`,
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/rooms/${selectedRoom.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: `Room ${selectedRoom.number} status updated to ${newStatus.replace('_', ' ')}`,
        });
        setIsStatusChangeOpen(false);
        setSelectedRoom(null);
        fetchRooms();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to update room status',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error updating room status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update room status',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const openStatusChangeDialog = (room: Room) => {
    setSelectedRoom(room);
    setNewStatus(room.status);
    setIsStatusChangeOpen(true);
  };

  const getStatusInfo = (status: string) => {
    return roomStatuses.find(s => s.value === status) || roomStatuses[0];
  };

  // Room card component
  const RoomCard = ({ room }: { room: Room }) => {
    const statusInfo = getStatusInfo(room.status);
    const StatusIcon = statusInfo.icon;
    
    return (
      <Card 
        className={cn(
          'cursor-pointer transition-all duration-200 hover:shadow-md relative overflow-hidden',
          'border-l-4',
          statusInfo.color.replace('bg-', 'border-l-')
        )}
        onClick={() => { setSelectedRoom(room); setIsDetailOpen(true); }}
      >
        {/* Status indicator bar */}
        <div className={cn('absolute top-0 left-0 right-0 h-1', statusInfo.color)} />
        
        <CardContent className="p-3">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Key className={cn('h-4 w-4', statusInfo.textColor)} />
                <span className="font-bold text-lg">{room.number}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{room.roomType.name}</p>
            </div>
            <Badge variant="secondary" className={cn('text-white text-[10px]', statusInfo.color)}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {statusInfo.label}
            </Badge>
          </div>
          
          {/* Features */}
          <div className="flex gap-1 mt-2 flex-wrap">
            {room.dnd && (
              <Badge variant="destructive" className="text-[9px] h-5 gap-1">
                <Ban className="h-2.5 w-2.5" />
                DND
              </Badge>
            )}
            {room.hkPriority && room.hkPriority !== 'normal' && (
              <Badge className="bg-amber-500 text-[9px] h-5 gap-1">
                <Star className="h-2.5 w-2.5" />
                {room.hkPriority}
              </Badge>
            )}
            {room.isAccessible && (
              <Badge variant="outline" className="text-[9px] h-5">Accessible</Badge>
            )}
            {room.hasSeaView && (
              <Badge variant="outline" className="text-[9px] h-5">Sea View</Badge>
            )}
            {room.hasBalcony && (
              <Badge variant="outline" className="text-[9px] h-5">Balcony</Badge>
            )}
          </div>
          
          {/* Quick action */}
          <div className="mt-3 pt-2 border-t border-border/50 flex gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              className="flex-1 h-7 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                openStatusChangeDialog(room);
              }}
            >
              Change Status
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Key className="h-5 w-5" />
            Room Status
          </h2>
          <p className="text-sm text-muted-foreground">
            View and manage room status across your property
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchRooms}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4 lg:grid-cols-8">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gray-500/10">
              <Key className="h-4 w-4 text-gray-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-xs text-muted-foreground">Total Rooms</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.available}</div>
              <div className="text-xs text-muted-foreground">Available</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <User className="h-4 w-4 text-violet-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.occupied}</div>
              <div className="text-xs text-muted-foreground">Occupied</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Bed className="h-4 w-4 text-amber-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.dirty}</div>
              <div className="text-xs text-muted-foreground">Dirty</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <Sparkles className="h-4 w-4 text-cyan-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.cleaning}</div>
              <div className="text-xs text-muted-foreground">Cleaning</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Eye className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.inspected}</div>
              <div className="text-xs text-muted-foreground">Inspected</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-orange-500/10">
              <Wrench className="h-4 w-4 text-orange-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.maintenance}</div>
              <div className="text-xs text-muted-foreground">Maintenance</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-red-500/10">
              <XCircle className="h-4 w-4 text-red-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.outOfOrder}</div>
              <div className="text-xs text-muted-foreground">Out of Order</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <Select value={propertyFilter} onValueChange={setPropertyFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="All Properties" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Properties</SelectItem>
                {properties.map(property => (
                  <SelectItem key={property.id} value={property.id}>
                    {property.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {roomStatuses.map(status => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={floorFilter} onValueChange={setFloorFilter}>
              <SelectTrigger className="w-full sm:w-32">
                <SelectValue placeholder="All Floors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Floors</SelectItem>
                {floors.map(floor => (
                  <SelectItem key={floor} value={floor.toString()}>
                    Floor {floor}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Room Grid by Floor */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredRooms.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Key className="h-12 w-12 mb-4" />
          <p>No rooms found</p>
          <p className="text-sm">Try adjusting your filters</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(roomsByFloor).map(([floor, floorRooms]) => (
            <div key={floor}>
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-medium">Floor {floor}</h3>
                <Badge variant="outline">{floorRooms.length} rooms</Badge>
              </div>
              <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {floorRooms.map(room => (
                  <RoomCard key={room.id} room={room} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Room Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Room Details</DialogTitle>
          </DialogHeader>
          {selectedRoom && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className={cn(
                  'w-16 h-16 rounded-lg flex items-center justify-center',
                  getStatusInfo(selectedRoom.status).color
                )}>
                  <Key className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold">{selectedRoom.number}</h3>
                  <p className="text-muted-foreground">{selectedRoom.roomType.name}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Floor</p>
                  <p className="font-medium">{selectedRoom.floor}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge className={cn('text-white', getStatusInfo(selectedRoom.status).color)}>
                    {getStatusInfo(selectedRoom.status).label}
                  </Badge>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-2">Features</p>
                <div className="flex gap-2 flex-wrap">
                  {selectedRoom.isAccessible && (
                    <Badge variant="outline">Accessible</Badge>
                  )}
                  {selectedRoom.hasSeaView && (
                    <Badge variant="outline">Sea View</Badge>
                  )}
                  {selectedRoom.hasBalcony && (
                    <Badge variant="outline">Balcony</Badge>
                  )}
                  {selectedRoom.isSmoking && (
                    <Badge variant="outline">Smoking</Badge>
                  )}
                  {!selectedRoom.isAccessible && !selectedRoom.hasSeaView && !selectedRoom.hasBalcony && (
                    <span className="text-sm text-muted-foreground">No special features</span>
                  )}
                </div>
              </div>

              {selectedRoom.property && (
                <div>
                  <p className="text-xs text-muted-foreground">Property</p>
                  <p className="text-sm">{selectedRoom.property.name}</p>
                </div>
              )}

              <div className="pt-4 border-t flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => {
                    setIsDetailOpen(false);
                    openStatusChangeDialog(selectedRoom);
                  }}
                >
                  Change Status
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Status Change Dialog */}
      <Dialog open={isStatusChangeOpen} onOpenChange={setIsStatusChangeOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Change Room Status</DialogTitle>
            <DialogDescription>
              Update the status for Room {selectedRoom?.number}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {roomStatuses.map(status => (
                  <SelectItem key={status.value} value={status.value}>
                    <div className="flex items-center gap-2">
                      <div className={cn('w-2 h-2 rounded-full', status.color)} />
                      {status.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsStatusChangeOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleStatusChange} disabled={isSaving || newStatus === selectedRoom?.status}>
              {isSaving && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
              Update Status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
