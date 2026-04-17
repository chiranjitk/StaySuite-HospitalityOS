'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  BedDouble, 
  Sparkles, 
  Wrench, 
  Ban, 
  RefreshCw,
  LogIn,
  LogOut,
  Users,
  Building2,
  Eye,
  CheckCircle2,
  Clock,
  AlertCircle,
  Wifi,
  WifiOff,
  Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { useUIStore } from '@/store';
import { useSocket, RoomStatusEvent, RoomInitialState } from '@/hooks/use-socket';

interface Room {
  id: string;
  number: string;
  name?: string;
  floor: number;
  status: string;
  isAccessible: boolean;
  isSmoking: boolean;
  hasBalcony: boolean;
  hasSeaView: boolean;
  hasMountainView: boolean;
  roomType: {
    id: string;
    name: string;
    code: string;
    basePrice: number;
  };
  property: {
    id: string;
    name: string;
  };
}

interface Booking {
  id: string;
  confirmationCode: string;
  status: string;
  checkIn: string;
  checkOut: string;
  primaryGuest: {
    id: string;
    firstName: string;
    lastName: string;
    phone?: string;
    isVip: boolean;
  };
}

const roomStatuses = [
  { value: 'available', label: 'Available', color: 'bg-emerald-500', textColor: 'text-emerald-600', bgColor: 'bg-emerald-50 border-emerald-200' },
  { value: 'occupied', label: 'Occupied', color: 'bg-rose-500', textColor: 'text-rose-600', bgColor: 'bg-rose-50 border-rose-200' },
  { value: 'dirty', label: 'Dirty', color: 'bg-amber-500', textColor: 'text-amber-600', bgColor: 'bg-amber-50 border-amber-200' },
  { value: 'maintenance', label: 'Maintenance', color: 'bg-orange-500', textColor: 'text-orange-600', bgColor: 'bg-orange-50 border-orange-200' },
  { value: 'out_of_order', label: 'Out of Order', color: 'bg-gray-500', textColor: 'text-gray-600', bgColor: 'bg-gray-50 border-gray-200' },
];

const getStatusConfig = (status: string) => {
  return roomStatuses.find(s => s.value === status) || roomStatuses[4];
};

export default function RoomGrid() {
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  
  // Room state
  const [rooms, setRooms] = useState<Room[]>([]);
  const [properties, setProperties] = useState<{ id: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [propertyFilter, setPropertyFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [roomBooking, setRoomBooking] = useState<Booking | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isLoadingBooking, setIsLoadingBooking] = useState(false);

  // Real-time update indicator
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [showUpdateFlash, setShowUpdateFlash] = useState(false);
  const [updatedRoomId, setUpdatedRoomId] = useState<string | null>(null);

  // Handle room status change from WebSocket
  const handleRoomStatusChange = useCallback((event: RoomStatusEvent) => {
    if (process.env.NODE_ENV !== 'production') { console.log('[RoomGrid] Received room status change:', event); }
    
    // Update the room in state
    setRooms(prevRooms => 
      prevRooms.map(room => 
        room.id === event.roomId 
          ? { ...room, status: event.status }
          : room
      )
    );

    // Update selected room if it's the one that changed
    setSelectedRoom(prev => 
      prev?.id === event.roomId 
        ? { ...prev, status: event.status }
        : prev
    );

    // Show visual indicator
    setUpdatedRoomId(event.roomId);
    setShowUpdateFlash(true);
    setLastUpdate(new Date());

    // Clear flash after animation
    setTimeout(() => {
      setShowUpdateFlash(false);
      setUpdatedRoomId(null);
    }, 2000);

    // Show toast notification
    toast({
      title: 'Room Status Updated',
      description: `Room ${event.roomId.slice(-4)} is now ${getStatusConfig(event.status).label}`,
    });
  }, [toast]);

  // Handle initial state from WebSocket
  const handleInitialState = useCallback((state: RoomInitialState) => {
    if (process.env.NODE_ENV !== 'production') { console.log('[RoomGrid] Received initial state:', state.rooms.length, 'rooms'); }
    
    // Merge WebSocket state with existing rooms (prefer WebSocket status as it's real-time)
    setRooms(prevRooms => {
      const roomMap = new Map(prevRooms.map(r => [r.id, r]));
      
      state.rooms.forEach(wsRoom => {
        if (roomMap.has(wsRoom.id)) {
          const existing = roomMap.get(wsRoom.id)!;
          roomMap.set(wsRoom.id, {
            ...existing,
            status: wsRoom.status // Use real-time status from WebSocket
          });
        }
      });
      
      return Array.from(roomMap.values());
    });
    
    setLastUpdate(new Date());
  }, []);

  // Initialize WebSocket connection
  const { 
    connectionStatus, 
    requestRoomStatusChange,
    reconnect,
    disconnect 
  } = useSocket({
    tenantId: user?.tenantId || '',
    userId: user?.id || '',
    autoConnect: isAuthenticated,
    onRoomStatusChange: handleRoomStatusChange,
    onInitialState: handleInitialState,
    onError: (error) => {
      console.error('[RoomGrid] Socket error:', error);
      toast({
        title: 'Connection Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

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

  // Fetch booking for room
  const fetchRoomBooking = async (roomId: string) => {
    setIsLoadingBooking(true);
    try {
      const response = await fetch(`/api/bookings?roomId=${roomId}&status=checked_in`);
      const result = await response.json();
      if (result.success && result.data.length > 0) {
        setRoomBooking(result.data[0]);
      } else {
        // Check for confirmed bookings too
        const confirmedResponse = await fetch(`/api/bookings?roomId=${roomId}&status=confirmed`);
        const confirmedResult = await confirmedResponse.json();
        if (confirmedResult.success && confirmedResult.data.length > 0) {
          setRoomBooking(confirmedResult.data[0]);
        } else {
          setRoomBooking(null);
        }
      }
    } catch (error) {
      console.error('Error fetching room booking:', error);
      setRoomBooking(null);
    } finally {
      setIsLoadingBooking(false);
    }
  };

  // Handle room click
  const handleRoomClick = (room: Room) => {
    setSelectedRoom(room);
    setIsDetailOpen(true);
    if (room.status === 'occupied' || room.status === 'dirty') {
      fetchRoomBooking(room.id);
    } else {
      setRoomBooking(null);
    }
  };

  // Update room status with WebSocket integration
  const updateRoomStatus = async (roomId: string, newStatus: string) => {
    try {
      const room = rooms.find(r => r.id === roomId);
      if (!room) return;

      const response = await fetch(`/api/rooms/${roomId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      const result = await response.json();

      if (result.success) {
        // Optimistic update - update local state immediately
        setRooms(prev => prev.map(r => 
          r.id === roomId ? { ...r, status: newStatus } : r
        ));
        setSelectedRoom(prev => prev ? { ...prev, status: newStatus } : null);

        // Request WebSocket broadcast (will be handled by server-side socket)
        if (connectionStatus.connected && room.property) {
          requestRoomStatusChange(roomId, newStatus, room.property.id);
        }

        toast({
          title: 'Success',
          description: 'Room status updated',
        });
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to update room',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error updating room:', error);
      toast({
        title: 'Error',
        description: 'Failed to update room status',
        variant: 'destructive',
      });
    }
  };

  // Group rooms by floor
  const roomsByFloor = rooms.reduce((acc, room) => {
    const floor = room.floor;
    if (!acc[floor]) acc[floor] = [];
    acc[floor].push(room);
    return acc;
  }, {} as Record<number, Room[]>);

  const sortedFloors = Object.keys(roomsByFloor)
    .map(Number)
    .sort((a, b) => a - b);

  // Stats
  const stats = {
    total: rooms.length,
    available: rooms.filter(r => r.status === 'available').length,
    occupied: rooms.filter(r => r.status === 'occupied').length,
    dirty: rooms.filter(r => r.status === 'dirty').length,
    maintenance: rooms.filter(r => r.status === 'maintenance').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <BedDouble className="h-5 w-5" />
            Room Grid
            {/* Real-time indicator */}
            <div className="flex items-center gap-2 ml-2">
              {connectionStatus.connected ? (
                <Badge variant="outline" className="text-xs gap-1 bg-emerald-50 text-emerald-700 border-emerald-200">
                  <Wifi className="h-3 w-3" />
                  Live
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs gap-1 bg-gray-50 text-gray-500 border-gray-200">
                  <WifiOff className="h-3 w-3" />
                  Offline
                </Badge>
              )}
              {lastUpdate && (
                <span className="text-xs text-muted-foreground">
                  Updated {format(lastUpdate, 'HH:mm:ss')}
                </span>
              )}
            </div>
          </h2>
          <p className="text-sm text-muted-foreground">
            Visual overview of all rooms by floor • Real-time updates
          </p>
        </div>
        <div className="flex gap-2">
          {!connectionStatus.connected && (
            <Button variant="outline" onClick={reconnect} disabled={!isAuthenticated}>
              <Wifi className="h-4 w-4 mr-2" />
              Connect
            </Button>
          )}
          <Button variant="outline" onClick={() => fetchRooms()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-5">
        <Card className="p-4">
          <div className="text-2xl font-bold">{stats.total}</div>
          <div className="text-xs text-muted-foreground">Total Rooms</div>
        </Card>
        <Card className="p-4 border-l-4 border-l-emerald-500">
          <div className="text-2xl font-bold text-emerald-600">{stats.available}</div>
          <div className="text-xs text-muted-foreground">Available</div>
        </Card>
        <Card className="p-4 border-l-4 border-l-rose-500">
          <div className="text-2xl font-bold text-rose-600">{stats.occupied}</div>
          <div className="text-xs text-muted-foreground">Occupied</div>
        </Card>
        <Card className="p-4 border-l-4 border-l-amber-500">
          <div className="text-2xl font-bold text-amber-600">{stats.dirty}</div>
          <div className="text-xs text-muted-foreground">Dirty</div>
        </Card>
        <Card className="p-4 border-l-4 border-l-orange-500">
          <div className="text-2xl font-bold text-orange-600">{stats.maintenance}</div>
          <div className="text-xs text-muted-foreground">Maintenance</div>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <Select value={propertyFilter} onValueChange={setPropertyFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Property" />
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
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Status" />
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
          </div>
        </CardContent>
      </Card>

      {/* Room Grid */}
      {isLoading ? (
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
          {Array.from({ length: 16 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      ) : rooms.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <BedDouble className="h-12 w-12 mb-4" />
            <p>No rooms found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {sortedFloors.map(floor => (
            <Card key={floor}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Floor {floor}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
                  {roomsByFloor[floor].map(room => {
                    const statusConfig = getStatusConfig(room.status);
                    const isRecentlyUpdated = updatedRoomId === room.id && showUpdateFlash;
                    
                    return (
                      <button
                        key={room.id}
                        onClick={() => handleRoomClick(room)}
                        className={cn(
                          "relative p-3 rounded-lg border-2 text-center transition-all duration-200 hover:shadow-md hover:scale-105",
                          statusConfig.bgColor,
                          "cursor-pointer",
                          isRecentlyUpdated && "ring-2 ring-blue-400 ring-offset-2 animate-pulse"
                        )}
                      >
                        {/* Real-time update indicator */}
                        {isRecentlyUpdated && (
                          <div className="absolute -top-1 -right-1">
                            <Activity className="h-4 w-4 text-blue-500 animate-ping" />
                          </div>
                        )}
                        <div className="text-lg font-bold">{room.number}</div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {room.roomType.code}
                        </div>
                        <div className={cn(
                          "absolute top-1 right-1 w-2 h-2 rounded-full",
                          statusConfig.color
                        )} />
                        {room.hasSeaView && (
                          <Sparkles className="absolute bottom-1 left-1 h-3 w-3 text-cyan-500" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Legend */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 text-sm">
            {roomStatuses.map(status => (
              <div key={status.value} className="flex items-center gap-2">
                <div className={cn("w-3 h-3 rounded-full", status.color)} />
                <span>{status.label}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 border-l pl-4 ml-2">
              <Sparkles className="h-3 w-3 text-cyan-500" />
              <span>Sea View</span>
            </div>
            <div className="flex items-center gap-2 border-l pl-4 ml-2">
              <Activity className="h-3 w-3 text-blue-500" />
              <span>Live Update</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Room Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md max-h-[90dvh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Room {selectedRoom?.number}
              {connectionStatus.connected && (
                <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700">
                  <Wifi className="h-3 w-3 mr-1" />
                  Live
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              {selectedRoom?.roomType.name} - Floor {selectedRoom?.floor}
            </DialogDescription>
          </DialogHeader>
          
          {selectedRoom && (
            <div className="space-y-4">
              {/* Status */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge className={cn('text-white', getStatusConfig(selectedRoom.status).color)}>
                  {getStatusConfig(selectedRoom.status).label}
                </Badge>
              </div>

              {/* Features */}
              <div className="flex flex-wrap gap-2">
                {selectedRoom.hasSeaView && (
                  <Badge variant="outline" className="text-cyan-600">Sea View</Badge>
                )}
                {selectedRoom.hasMountainView && (
                  <Badge variant="outline" className="text-emerald-600">Mountain View</Badge>
                )}
                {selectedRoom.hasBalcony && (
                  <Badge variant="outline">Balcony</Badge>
                )}
                {selectedRoom.isAccessible && (
                  <Badge variant="outline" className="text-violet-600">Accessible</Badge>
                )}
                {selectedRoom.isSmoking && (
                  <Badge variant="outline" className="text-amber-600">Smoking</Badge>
                )}
              </div>

              {/* Booking Info */}
              {isLoadingBooking ? (
                <div className="flex items-center justify-center py-4">
                  <RefreshCw className="h-5 w-5 animate-spin" />
                </div>
              ) : roomBooking ? (
                <Card className="p-4 bg-muted/50">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {roomBooking.primaryGuest.firstName} {roomBooking.primaryGuest.lastName}
                      </span>
                      {roomBooking.primaryGuest.isVip && (
                        <Badge variant="outline" className="text-amber-600">VIP</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {roomBooking.confirmationCode}
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <LogIn className="h-3 w-3" />
                        {format(new Date(roomBooking.checkIn), 'MMM d')}
                      </div>
                      <div className="flex items-center gap-1">
                        <LogOut className="h-3 w-3" />
                        {format(new Date(roomBooking.checkOut), 'MMM d')}
                      </div>
                    </div>
                  </div>
                </Card>
              ) : null}

              {/* Quick Actions */}
              <div className="space-y-2">
                <div className="text-sm font-medium">Quick Actions</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {selectedRoom.status === 'dirty' && (
                    <Button 
                      size="sm" 
                      onClick={() => updateRoomStatus(selectedRoom.id, 'available')}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Mark Clean
                    </Button>
                  )}
                  {selectedRoom.status === 'available' && (
                    <Button 
                      size="sm" 
                      onClick={() => updateRoomStatus(selectedRoom.id, 'maintenance')}
                      variant="outline"
                    >
                      <Wrench className="h-4 w-4 mr-1" />
                      Maintenance
                    </Button>
                  )}
                  {selectedRoom.status === 'maintenance' && (
                    <Button 
                      size="sm" 
                      onClick={() => updateRoomStatus(selectedRoom.id, 'available')}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Mark Available
                    </Button>
                  )}
                  {selectedRoom.status === 'occupied' && roomBooking && (
                    <Button 
                      size="sm" 
                      onClick={() => {
                        // Navigate to check-out via Zustand (syncs URL hash)
                        useUIStore.getState().setActiveSection('frontdesk-checkout');
                        setIsDetailOpen(false);
                      }}
                      variant="outline"
                      className="text-amber-600"
                    >
                      <LogOut className="h-4 w-4 mr-1" />
                      Check Out
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
