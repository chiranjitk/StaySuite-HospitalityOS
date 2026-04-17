'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertTriangle,
  AlertCircle,
  Loader2,
  RefreshCw,
  Calendar,
  User,
  Building2,
  Hash,
  ArrowRight,
  DoorOpen,
  Users,
  XCircle,
  CheckCircle,
  CalendarX,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

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
  };
  room?: {
    id: string;
    number: string;
  };
  roomType: {
    id: string;
    name: string;
  };
  property: {
    id: string;
    name: string;
  };
}

interface Conflict {
  type: string;
  severity: string;
  bookings: Booking[];
  roomId?: string;
  roomNumber?: string;
  overlappingDates: {
    start: Date;
    end: Date;
  };
}

interface Overbooking {
  type: string;
  severity: string;
  roomTypeId: string;
  roomTypeName: string;
  totalRooms: number;
  bookedRooms: number;
  date: Date;
  bookings: Booking[];
}

interface Stats {
  totalConflicts: number;
  criticalConflicts: number;
  warnings: number;
  doubleBookings: number;
  overbookings: number;
  lockConflicts: number;
}

interface Property {
  id: string;
  name: string;
}

interface Room {
  id: string;
  number: string;
  roomTypeId: string;
  status: string;
}

export default function Conflicts() {
  const { toast } = useToast();
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [overbookings, setOverbookings] = useState<Overbooking[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalConflicts: 0,
    criticalConflicts: 0,
    warnings: 0,
    doubleBookings: 0,
    overbookings: 0,
    lockConflicts: 0,
  });
  const [properties, setProperties] = useState<Property[]>([]);
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [propertyFilter, setPropertyFilter] = useState<string>('all');

  // Dialog states
  const [isResolveOpen, setIsResolveOpen] = useState(false);
  const [selectedConflict, setSelectedConflict] = useState<Conflict | Overbooking | null>(null);
  const [selectedType, setSelectedType] = useState<'conflict' | 'overbooking'>('conflict');
  const [resolution, setResolution] = useState<string>('');
  const [targetRoomId, setTargetRoomId] = useState<string>('');
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

  // Fetch conflicts
  const fetchConflicts = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (propertyFilter !== 'all') {
        params.append('propertyId', propertyFilter);
      }

      const response = await fetch(`/api/bookings/conflicts?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setConflicts(result.data.conflicts || []);
        setOverbookings(result.data.overbookings || []);
        setStats(result.stats || {
          totalConflicts: 0,
          criticalConflicts: 0,
          warnings: 0,
          doubleBookings: 0,
          overbookings: 0,
          lockConflicts: 0,
        });
      }
    } catch (error) {
      console.error('Error fetching conflicts:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch booking conflicts',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConflicts();
  }, [propertyFilter]);

  // Fetch available rooms when resolving
  useEffect(() => {
    if (isResolveOpen && propertyFilter !== 'all') {
      const fetchRooms = async () => {
        try {
          const response = await fetch(`/api/rooms?propertyId=${propertyFilter}&status=available`);
          const result = await response.json();
          if (result.success) {
            setAvailableRooms(result.data);
          }
        } catch (error) {
          console.error('Error fetching rooms:', error);
        }
      };
      fetchRooms();
    }
  }, [isResolveOpen, propertyFilter]);

  // Resolve conflict
  const handleResolve = async () => {
    if (!selectedConflict || !resolution) {
      toast({
        title: 'Validation Error',
        description: 'Please select a resolution method',
        variant: 'destructive',
      });
      return;
    }

    if (resolution === 'move_room' && !targetRoomId) {
      toast({
        title: 'Validation Error',
        description: 'Please select a target room',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const bookingIds = selectedType === 'conflict'
        ? (selectedConflict as Conflict).bookings.map(b => b.id)
        : (selectedConflict as Overbooking).bookings.map(b => b.id);

      const response = await fetch('/api/bookings/conflicts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conflictType: selectedType,
          bookingIds,
          resolution,
          targetRoomId: resolution === 'move_room' ? targetRoomId : undefined,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Conflict resolved successfully',
        });
        setIsResolveOpen(false);
        setSelectedConflict(null);
        setResolution('');
        setTargetRoomId('');
        fetchConflicts();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to resolve conflict',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error resolving conflict:', error);
      toast({
        title: 'Error',
        description: 'Failed to resolve conflict',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const openResolveDialog = (conflict: Conflict | Overbooking, type: 'conflict' | 'overbooking') => {
    setSelectedConflict(conflict);
    setSelectedType(type);
    setResolution('');
    setTargetRoomId('');
    setIsResolveOpen(true);
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  };

  const getConflictIcon = (type: string) => {
    switch (type) {
      case 'double_booking':
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      case 'overbooking':
        return <Users className="h-5 w-5 text-amber-500" />;
      case 'lock_conflict':
        return <CalendarX className="h-5 w-5 text-orange-500" />;
      default:
        return <AlertCircle className="h-5 w-5 text-amber-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Booking Conflicts
          </h2>
          <p className="text-sm text-muted-foreground">
            Detect and resolve booking conflicts and overbookings
          </p>
        </div>
        <Button variant="outline" onClick={fetchConflicts} disabled={isLoading}>
          <RefreshCw className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-6">
        <Card className={cn('p-4', stats.criticalConflicts > 0 && 'border-red-500')}>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <div className="text-2xl font-bold text-red-500">{stats.criticalConflicts}</div>
          </div>
          <div className="text-xs text-muted-foreground">Critical</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            <div className="text-2xl font-bold text-amber-500">{stats.warnings}</div>
          </div>
          <div className="text-xs text-muted-foreground">Warnings</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold">{stats.totalConflicts}</div>
          <div className="text-xs text-muted-foreground">Total Issues</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-red-500">{stats.doubleBookings}</div>
          <div className="text-xs text-muted-foreground">Double Bookings</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-amber-500">{stats.overbookings}</div>
          <div className="text-xs text-muted-foreground">Overbookings</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-orange-500">{stats.lockConflicts}</div>
          <div className="text-xs text-muted-foreground">Lock Conflicts</div>
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
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : stats.totalConflicts === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-muted-foreground">
              <CheckCircle className="h-16 w-16 mb-4 text-emerald-500" />
              <h3 className="text-lg font-semibold text-foreground">No Conflicts Detected</h3>
              <p className="text-sm">All bookings are properly scheduled without conflicts</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Critical Conflicts */}
          {conflicts.length > 0 && (
            <Card className="border-red-200 dark:border-red-900">
              <CardHeader className="py-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  Critical Conflicts ({conflicts.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="max-h-96">
                  <div className="divide-y">
                    {conflicts.map((conflict, index) => (
                      <div key={index} className="p-4 hover:bg-muted/50">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              {getConflictIcon(conflict.type)}
                              <Badge variant="outline" className="text-red-500 border-red-500">
                                {conflict.type.replace('_', ' ').toUpperCase()}
                              </Badge>
                              {conflict.roomNumber && (
                                <Badge variant="secondary" className="flex items-center gap-1">
                                  <DoorOpen className="h-3 w-3" />
                                  Room {conflict.roomNumber}
                                </Badge>
                              )}
                            </div>

                            <div className="text-sm text-muted-foreground mb-2">
                              Overlapping: {format(conflict.overlappingDates.start, 'MMM d')} - {format(conflict.overlappingDates.end, 'MMM d, yyyy')}
                            </div>

                            <div className="flex flex-wrap gap-2">
                              {conflict.bookings.map(booking => (
                                <div
                                  key={booking.id}
                                  className="flex items-center gap-2 p-2 bg-muted rounded-md"
                                >
                                  <Avatar className="h-6 w-6">
                                    <AvatarFallback className="text-xs">
                                      {getInitials(booking.primaryGuest.firstName, booking.primaryGuest.lastName)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <p className="text-xs font-medium">
                                      {booking.primaryGuest.firstName} {booking.primaryGuest.lastName}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {booking.confirmationCode}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openResolveDialog(conflict, 'conflict')}
                          >
                            Resolve
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* Overbookings */}
          {overbookings.length > 0 && (
            <Card className="border-amber-200 dark:border-amber-900">
              <CardHeader className="py-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5 text-amber-500" />
                  Overbookings ({overbookings.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="max-h-96">
                  <div className="divide-y">
                    {overbookings.map((overbooking, index) => (
                      <div key={index} className="p-4 hover:bg-muted/50">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline" className="text-amber-500 border-amber-500">
                                {overbooking.roomTypeName}
                              </Badge>
                              <span className="text-sm">
                                <span className="text-red-500 font-medium">{overbooking.bookedRooms}</span>
                                <span className="text-muted-foreground"> / {overbooking.totalRooms} rooms</span>
                              </span>
                            </div>

                            <div className="text-sm text-muted-foreground mb-2">
                              Date: {format(overbooking.date, 'MMM d, yyyy')}
                            </div>

                            <div className="flex flex-wrap gap-2">
                              {overbooking.bookings.slice(0, 4).map(booking => (
                                <div
                                  key={booking.id}
                                  className="flex items-center gap-2 p-2 bg-muted rounded-md"
                                >
                                  <Avatar className="h-6 w-6">
                                    <AvatarFallback className="text-xs">
                                      {getInitials(booking.primaryGuest.firstName, booking.primaryGuest.lastName)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <p className="text-xs font-medium">
                                      {booking.primaryGuest.firstName} {booking.primaryGuest.lastName}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {booking.confirmationCode}
                                    </p>
                                  </div>
                                </div>
                              ))}
                              {overbooking.bookings.length > 4 && (
                                <div className="flex items-center px-2 bg-muted rounded-md text-xs text-muted-foreground">
                                  +{overbooking.bookings.length - 4} more
                                </div>
                              )}
                            </div>
                          </div>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openResolveDialog(overbooking, 'overbooking')}
                          >
                            Resolve
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Resolve Dialog */}
      <Dialog open={isResolveOpen} onOpenChange={setIsResolveOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Resolve Conflict</DialogTitle>
            <DialogDescription>
              Choose how to resolve this booking conflict
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Resolution Options */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Resolution Method</label>
              <Select value={resolution} onValueChange={setResolution}>
                <SelectTrigger>
                  <SelectValue placeholder="Select resolution" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="move_room">
                    <div className="flex items-center gap-2">
                      <DoorOpen className="h-4 w-4" />
                      Move to Different Room
                    </div>
                  </SelectItem>
                  <SelectItem value="cancel">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-4 w-4" />
                      Cancel Conflicting Booking
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Room Selection */}
            {resolution === 'move_room' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Target Room</label>
                <Select value={targetRoomId} onValueChange={setTargetRoomId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select available room" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRooms.map(room => (
                      <SelectItem key={room.id} value={room.id}>
                        Room {room.number}
                      </SelectItem>
                    ))}
                    {availableRooms.length === 0 && (
                      <SelectItem value="none" disabled>
                        No available rooms
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Warning */}
            {resolution === 'cancel' && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-md">
                <p className="text-sm text-red-500">
                  Warning: This will cancel the most recent conflicting booking. This action cannot be undone.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsResolveOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleResolve} disabled={isSaving || !resolution}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Apply Resolution
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
