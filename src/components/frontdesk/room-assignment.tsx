'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Key, 
  RefreshCw,
  Search,
  Users,
  Crown,
  Building2,
  LogIn,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Clock,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { format, differenceInDays } from 'date-fns';

interface Room {
  id: string;
  number: string;
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

interface Guest {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  isVip: boolean;
  loyaltyTier: string;
}

interface Booking {
  id: string;
  confirmationCode: string;
  status: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  totalAmount: number;
  currency: string;
  source: string;
  primaryGuest: Guest;
  room?: { id: string; number: string; floor: number };
  roomType: { id: string; name: string; code: string; basePrice: number };
  property: { id: string; name: string };
}

export default function RoomAssignment() {
  const { toast } = useToast();
  
  // Data states
  const [unassignedBookings, setUnassignedBookings] = useState<Booking[]>([]);
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [properties, setProperties] = useState<{ id: string; name: string }[]>([]);
  const [isLoadingBookings, setIsLoadingBookings] = useState(true);
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Selection states
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [propertyFilter, setPropertyFilter] = useState<string>('all');
  const [roomTypeFilter, setRoomTypeFilter] = useState<string>('all');
  
  // View states
  const [activeTab, setActiveTab] = useState<string>('unassigned');

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

  // Fetch unassigned bookings
  const fetchUnassignedBookings = async () => {
    setIsLoadingBookings(true);
    try {
      const params = new URLSearchParams();
      params.append('status', 'confirmed');
      if (searchQuery) params.append('search', searchQuery);
      
      const response = await fetch(`/api/bookings?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        // Filter to only show bookings without rooms assigned
        const unassigned = result.data.filter((b: Booking) => !b.room);
        setUnassignedBookings(unassigned);
      }
    } catch (error) {
      console.error('Error fetching bookings:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch bookings',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingBookings(false);
    }
  };

  // Fetch available rooms
  const fetchAvailableRooms = async () => {
    setIsLoadingRooms(true);
    try {
      const params = new URLSearchParams();
      params.append('status', 'available');
      if (propertyFilter !== 'all') params.append('propertyId', propertyFilter);
      if (roomTypeFilter !== 'all') params.append('roomTypeId', roomTypeFilter);

      const response = await fetch(`/api/rooms?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setAvailableRooms(result.data);
      }
    } catch (error) {
      console.error('Error fetching rooms:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch rooms',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingRooms(false);
    }
  };

  useEffect(() => {
    fetchUnassignedBookings();
  }, [searchQuery]);

  useEffect(() => {
    fetchAvailableRooms();
  }, [propertyFilter, roomTypeFilter]);

  // Open assign dialog
  const openAssignDialog = (booking: Booking) => {
    setSelectedBooking(booking);
    setSelectedRoom(null);
    setIsAssignDialogOpen(true);
  };

  // Filter rooms by booking's room type
  const getCompatibleRooms = (booking: Booking) => {
    return availableRooms.filter(room => 
      room.roomType.id === booking.roomType.id && 
      room.property.id === booking.property.id
    );
  };

  // Assign room to booking
  const assignRoom = async () => {
    if (!selectedBooking || !selectedRoom) return;

    setIsProcessing(true);
    try {
      const response = await fetch(`/api/bookings/${selectedBooking.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: selectedRoom.id,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Room Assigned',
          description: `Room ${selectedRoom.number} assigned to booking ${selectedBooking.confirmationCode}`,
        });
        setIsAssignDialogOpen(false);
        fetchUnassignedBookings();
        fetchAvailableRooms();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to assign room',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error assigning room:', error);
      toast({
        title: 'Error',
        description: 'Failed to assign room',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Quick assign (drag-drop alternative)
  const quickAssign = async (booking: Booking, room: Room) => {
    setIsProcessing(true);
    try {
      const response = await fetch(`/api/bookings/${booking.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: room.id,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Room Assigned',
          description: `Room ${room.number} assigned to booking ${booking.confirmationCode}`,
        });
        fetchUnassignedBookings();
        fetchAvailableRooms();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to assign room',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error assigning room:', error);
      toast({
        title: 'Error',
        description: 'Failed to assign room',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  };

  const getLoyaltyColor = (tier: string) => {
    const colors: Record<string, string> = {
      bronze: 'text-amber-700 dark:text-amber-300 bg-amber-100',
      silver: 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800',
      gold: 'text-yellow-600 dark:text-yellow-400 bg-yellow-100',
      platinum: 'text-violet-600 dark:text-violet-400 bg-violet-100',
    };
    return colors[tier] || colors.bronze;
  };

  // Group rooms by floor
  const roomsByFloor = availableRooms.reduce((acc, room) => {
    const floor = room.floor;
    if (!acc[floor]) acc[floor] = [];
    acc[floor].push(room);
    return acc;
  }, {} as Record<number, Room[]>);

  // Stats
  const stats = {
    unassigned: unassignedBookings.length,
    available: availableRooms.length,
    arriving: unassignedBookings.filter(b => {
      const checkIn = new Date(b.checkIn);
      return checkIn.toDateString() === new Date().toDateString();
    }).length,
  };

  // Get unique room types from available rooms
  const roomTypes = [...new Map(availableRooms.map(r => [r.roomType.id, r.roomType])).values()];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Key className="h-5 w-5" />
            Room Assignment
          </h2>
          <p className="text-sm text-muted-foreground">
            Assign rooms to bookings and manage room allocation
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { fetchUnassignedBookings(); fetchAvailableRooms(); }}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-3">
        <Card className="p-4 border-l-4 border-l-amber-500">
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.unassigned}</div>
          <div className="text-xs text-muted-foreground">Unassigned Bookings</div>
        </Card>
        <Card className="p-4 border-l-4 border-l-emerald-500">
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.available}</div>
          <div className="text-xs text-muted-foreground">Available Rooms</div>
        </Card>
        <Card className="p-4 border-l-4 border-l-rose-500">
          <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">{stats.arriving}</div>
          <div className="text-xs text-muted-foreground">Arriving Today</div>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="unassigned">Unassigned Bookings</TabsTrigger>
          <TabsTrigger value="available">Available Rooms</TabsTrigger>
        </TabsList>

        {/* Unassigned Bookings Tab */}
        <TabsContent value="unassigned" className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by confirmation code or guest name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </CardContent>
          </Card>

          {isLoadingBookings ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-12 w-12 rounded-full" />
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : unassignedBookings.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <CheckCircle2 className="h-12 w-12 mb-4 text-emerald-500 dark:text-emerald-400" />
                <p>All bookings have rooms assigned</p>
                <p className="text-sm">No unassigned bookings found</p>
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-4 pr-4">
                {unassignedBookings.map((booking) => {
                  const nights = differenceInDays(new Date(booking.checkOut), new Date(booking.checkIn));
                  const isArrivingToday = new Date(booking.checkIn).toDateString() === new Date().toDateString();
                  const compatibleRooms = getCompatibleRooms(booking);
                  
                  return (
                    <Card key={booking.id} className={cn(
                      isArrivingToday && "border-l-4 border-l-amber-500"
                    )}>
                      <CardContent className="p-4">
                        <div className="flex flex-col sm:flex-row gap-4">
                          {/* Guest Info */}
                          <div className="flex items-start gap-4 flex-1">
                            <Avatar className="h-12 w-12">
                              <AvatarFallback className={cn(
                                "text-sm font-medium",
                                booking.primaryGuest.isVip 
                                  ? "bg-gradient-to-br from-amber-400 to-amber-600 text-white"
                                  : "bg-gradient-to-br from-primary/80 to-primary text-primary-foreground"
                              )}>
                                {getInitials(booking.primaryGuest.firstName, booking.primaryGuest.lastName)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium">
                                  {booking.primaryGuest.firstName} {booking.primaryGuest.lastName}
                                </p>
                                {booking.primaryGuest.isVip && (
                                  <Crown className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                                )}
                                <Badge className={cn("text-xs", getLoyaltyColor(booking.primaryGuest.loyaltyTier))}>
                                  {booking.primaryGuest.loyaltyTier}
                                </Badge>
                                {isArrivingToday && (
                                  <Badge className="bg-amber-100 text-amber-700 dark:text-amber-300">Arriving Today</Badge>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground space-y-1">
                                <div className="flex items-center gap-4">
                                  <span className="font-mono">{booking.confirmationCode}</span>
                                  <span className="flex items-center gap-1">
                                    <Users className="h-3 w-3" />
                                    {booking.adults} adult{booking.adults > 1 ? 's' : ''}
                                  </span>
                                </div>
                                <div className="flex items-center gap-4">
                                  <span className="flex items-center gap-1">
                                    <Building2 className="h-3 w-3" />
                                    {booking.roomType.name}
                                  </span>
                                  <span>{booking.property.name}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {format(new Date(booking.checkIn), 'MMM d')} - {format(new Date(booking.checkOut), 'MMM d')} ({nights} nights)
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex flex-col gap-2">
                            <Button onClick={() => openAssignDialog(booking)}>
                              <Key className="h-4 w-4 mr-2" />
                              Assign Room
                            </Button>
                            {compatibleRooms.length > 0 && (
                              <p className="text-xs text-muted-foreground text-center">
                                {compatibleRooms.length} compatible room(s)
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        {/* Available Rooms Tab */}
        <TabsContent value="available" className="space-y-4">
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
                <Select value={roomTypeFilter} onValueChange={setRoomTypeFilter}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Room Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Room Types</SelectItem>
                    {roomTypes.map(type => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {isLoadingRooms ? (
            <div className="grid gap-4 grid-cols-4 sm:grid-cols-6 lg:grid-cols-8">
              {Array.from({ length: 16 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-lg" />
              ))}
            </div>
          ) : availableRooms.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Key className="h-12 w-12 mb-4" />
                <p>No available rooms</p>
                <p className="text-sm">All rooms are occupied or match your filters</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {Object.entries(roomsByFloor)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([floor, rooms]) => (
                  <Card key={floor}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        Floor {floor}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-3 grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10">
                        {rooms.map(room => (
                          <div
                            key={room.id}
                            className="relative p-3 rounded-lg border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 text-center"
                          >
                            <div className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{room.number}</div>
                            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 truncate">
                              {room.roomType.code}
                            </div>
                            <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-500" />
                            {room.hasSeaView && (
                              <Sparkles className="absolute bottom-1 left-1 h-3 w-3 text-cyan-500 dark:text-cyan-400" />
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Room Assignment Dialog */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Assign Room</DialogTitle>
            <DialogDescription>
              {selectedBooking?.primaryGuest.firstName} {selectedBooking?.primaryGuest.lastName} - {selectedBooking?.confirmationCode}
            </DialogDescription>
          </DialogHeader>

          {selectedBooking && (
            <div className="space-y-4">
              {/* Booking Info */}
              <Card className="p-4 bg-muted/50">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Room Type</span>
                    <p className="font-medium">{selectedBooking.roomType.name}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Property</span>
                    <p className="font-medium">{selectedBooking.property.name}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Dates</span>
                    <p className="font-medium">
                      {format(new Date(selectedBooking.checkIn), 'MMM d')} - {format(new Date(selectedBooking.checkOut), 'MMM d')}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Guests</span>
                    <p className="font-medium">{selectedBooking.adults} adult{selectedBooking.adults > 1 ? 's' : ''}</p>
                  </div>
                </div>
              </Card>

              {/* Available Rooms */}
              <div className="space-y-2">
                <Label>Select Available Room</Label>
                {(() => {
                  const compatibleRooms = getCompatibleRooms(selectedBooking);
                  if (compatibleRooms.length === 0) {
                    return (
                      <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-700 dark:text-amber-300">
                        <AlertCircle className="h-4 w-4" />
                        <span className="text-sm">No compatible rooms available</span>
                      </div>
                    );
                  }
                  return (
                    <ScrollArea className="h-48">
                      <div className="grid grid-cols-4 gap-2 pr-2">
                        {compatibleRooms.map(room => (
                          <button
                            key={room.id}
                            onClick={() => setSelectedRoom(room)}
                            className={cn(
                              "p-3 rounded-lg border-2 text-center transition-all",
                              selectedRoom?.id === room.id
                                ? "border-primary bg-primary/10"
                                : "border-border hover:border-primary/50"
                            )}
                          >
                            <div className="text-lg font-bold">{room.number}</div>
                            <div className="text-[10px] text-muted-foreground">Floor {room.floor}</div>
                            {room.hasSeaView && (
                              <Sparkles className="h-3 w-3 mx-auto mt-1 text-cyan-500 dark:text-cyan-400" />
                            )}
                          </button>
                        ))}
                      </div>
                    </ScrollArea>
                  );
                })()}
              </div>

              {/* Selected Room Preview */}
              {selectedRoom && (
                <Card className="p-3 border-primary">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
                      {selectedRoom.number}
                    </div>
                    <div>
                      <p className="font-medium">Room {selectedRoom.number}</p>
                      <p className="text-sm text-muted-foreground">
                        Floor {selectedRoom.floor} • {selectedRoom.roomType.name}
                      </p>
                    </div>
                    {selectedRoom.hasSeaView && (
                      <Badge variant="outline" className="ml-auto text-cyan-600 dark:text-cyan-400">
                        <Sparkles className="h-3 w-3 mr-1" />
                        Sea View
                      </Badge>
                    )}
                  </div>
                </Card>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={assignRoom} 
              disabled={isProcessing || !selectedRoom}
            >
              {isProcessing ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4 mr-2" />
              )}
              Assign Room
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
