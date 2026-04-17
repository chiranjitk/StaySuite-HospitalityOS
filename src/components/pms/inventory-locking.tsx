'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Calendar } from '@/components/ui/calendar';
import {
  Lock,
  Unlock,
  Plus,
  Pencil,
  Trash2,
  Search,
  Loader2,
  Calendar as CalendarIcon,
  Filter,
  RefreshCw,
  Clock,
  AlertTriangle,
  Wrench,
  PartyPopper,
  Ban,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { format, addDays, parseISO, isAfter, isBefore, isWithinInterval } from 'date-fns';

interface Property {
  id: string;
  name: string;
}

interface RoomType {
  id: string;
  name: string;
  code: string;
  propertyId: string;
}

interface Room {
  id: string;
  number: string;
  floor: number;
  status: string;
  roomTypeId: string;
  roomType?: RoomType;
}

interface InventoryLock {
  id: string;
  propertyId: string;
  roomId?: string;
  roomTypeId?: string;
  startDate: string;
  endDate: string;
  reason: string;
  lockType: string;
  createdBy?: string;
  createdAt: string;
  room?: {
    id: string;
    number: string;
    floor: number;
    roomType?: RoomType;
  };
  isActive?: boolean;
  isUpcoming?: boolean;
  isPast?: boolean;
  durationDays?: number;
  status?: string;
}

interface LockStats {
  totalLocks: number;
  activeLocks: number;
  upcomingLocks: number;
  lockTypeDistribution: { lockType: string; count: number }[];
}

const lockTypes = [
  { value: 'maintenance', label: 'Maintenance', icon: Wrench, color: 'text-orange-600' },
  { value: 'event', label: 'Event', icon: PartyPopper, color: 'text-purple-600' },
  { value: 'overbooking', label: 'Overbooking Protection', icon: Ban, color: 'text-red-600' },
  { value: 'renovation', label: 'Renovation', icon: Wrench, color: 'text-yellow-600' },
  { value: 'other', label: 'Other', icon: Lock, color: 'text-gray-600' },
];

export default function InventoryLocking() {
  const { toast } = useToast();
  const [properties, setProperties] = useState<Property[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [locks, setLocks] = useState<InventoryLock[]>([]);
  const [stats, setStats] = useState<LockStats | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [lockTypeFilter, setLockTypeFilter] = useState<string>('all');

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedLock, setSelectedLock] = useState<InventoryLock | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    lockType: 'maintenance',
    roomId: '',
    roomTypeId: '',
    startDate: '',
    endDate: '',
    reason: '',
  });

  // Calendar popover states
  const [isStartCalendarOpen, setIsStartCalendarOpen] = useState(false);
  const [isEndCalendarOpen, setIsEndCalendarOpen] = useState(false);

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

  // Fetch data when property changes
  useEffect(() => {
    fetchData();
  }, [selectedProperty, statusFilter]);

  // Filter locks
  const filteredLocks = locks.filter(lock => {
    const matchesSearch =
      lock.reason.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lock.room?.number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lock.room?.roomType?.name?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesLockType = lockTypeFilter === 'all' || lock.lockType === lockTypeFilter;

    return matchesSearch && matchesLockType;
  });

  // Create lock
  const handleCreate = async () => {
    if (!formData.startDate || !formData.endDate || !formData.reason) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.roomId && !formData.roomTypeId) {
      toast({
        title: 'Validation Error',
        description: 'Please select a room or room type',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/inventory-locks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          propertyId: selectedProperty,
          startDate: formData.startDate,
          endDate: formData.endDate,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Inventory lock created successfully',
        });
        setIsCreateOpen(false);
        resetForm();
        // Refresh data
        fetchData();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to create lock',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error creating lock:', error);
      toast({
        title: 'Error',
        description: 'Failed to create inventory lock',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Update lock
  const handleUpdate = async () => {
    if (!selectedLock) return;
    setIsSaving(true);

    try {
      const response = await fetch('/api/inventory-locks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedLock.id,
          ...formData,
          startDate: formData.startDate,
          endDate: formData.endDate,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Inventory lock updated successfully',
        });
        setIsEditOpen(false);
        setSelectedLock(null);
        fetchData();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to update lock',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error updating lock:', error);
      toast({
        title: 'Error',
        description: 'Failed to update inventory lock',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Delete lock
  const handleDelete = async () => {
    if (!selectedLock) return;
    setIsSaving(true);

    try {
      const response = await fetch(`/api/inventory-locks?ids=${selectedLock.id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Inventory lock removed successfully',
        });
        setIsDeleteOpen(false);
        setSelectedLock(null);
        fetchData();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to remove lock',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error deleting lock:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove inventory lock',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Remove lock (unlock)
  const handleUnlock = async (lock: InventoryLock) => {
    try {
      const response = await fetch(`/api/inventory-locks?ids=${lock.id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Lock removed successfully',
        });
        fetchData();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to remove lock',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error unlocking:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove lock',
        variant: 'destructive',
      });
    }
  };

  const fetchData = async () => {
    if (!selectedProperty) return;
    setIsLoading(true);

    try {
      // Fetch room types
      const roomTypesResponse = await fetch(`/api/room-types?propertyId=${selectedProperty}`);
      const roomTypesResult = await roomTypesResponse.json();
      if (roomTypesResult.success) {
        setRoomTypes(roomTypesResult.data);
      }

      // Fetch rooms
      const roomsResponse = await fetch(`/api/rooms?propertyId=${selectedProperty}`);
      const roomsResult = await roomsResponse.json();
      if (roomsResult.success) {
        setRooms(roomsResult.data);
      }

      // Fetch inventory locks
      const locksParams = new URLSearchParams({ propertyId: selectedProperty });
      if (statusFilter === 'active') locksParams.append('active', 'true');
      if (statusFilter === 'upcoming') locksParams.append('upcoming', 'true');

      const locksResponse = await fetch(`/api/inventory-locks?${locksParams.toString()}`);
      const locksResult = await locksResponse.json();
      if (locksResult.success) {
        setLocks(locksResult.data);
        setStats(locksResult.stats);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch inventory locks',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const openEditDialog = (lock: InventoryLock) => {
    setSelectedLock(lock);
    setFormData({
      lockType: lock.lockType,
      roomId: lock.roomId || '',
      roomTypeId: lock.roomTypeId || '',
      startDate: lock.startDate.split('T')[0],
      endDate: lock.endDate.split('T')[0],
      reason: lock.reason,
    });
    setIsEditOpen(true);
  };

  const openDeleteDialog = (lock: InventoryLock) => {
    setSelectedLock(lock);
    setIsDeleteOpen(true);
  };

  const resetForm = () => {
    setFormData({
      lockType: 'maintenance',
      roomId: '',
      roomTypeId: '',
      startDate: '',
      endDate: '',
      reason: '',
    });
  };

  const getLockTypeInfo = (lockType: string) => {
    return lockTypes.find(lt => lt.value === lockType) || lockTypes[lockTypes.length - 1];
  };

  const getStatusBadge = (lock: InventoryLock) => {
    if (lock.isActive) {
      return <Badge className="bg-green-100 text-green-700 border-green-200">Active</Badge>;
    }
    if (lock.isUpcoming) {
      return <Badge className="bg-blue-100 text-blue-700 border-blue-200">Upcoming</Badge>;
    }
    return <Badge variant="secondary">Past</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Inventory Locking
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage room inventory locks and restrictions
          </p>
        </div>
        <Button onClick={() => { resetForm(); setIsCreateOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Create Lock
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Lock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats?.totalLocks || 0}</div>
              <div className="text-xs text-muted-foreground">Total Locks</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Unlock className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats?.activeLocks || 0}</div>
              <div className="text-xs text-muted-foreground">Active Locks</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Clock className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats?.upcomingLocks || 0}</div>
              <div className="text-xs text-muted-foreground">Upcoming</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Wrench className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <div className="text-2xl font-bold">
                {stats?.lockTypeDistribution?.find(lt => lt.lockType === 'maintenance')?.count || 0}
              </div>
              <div className="text-xs text-muted-foreground">Maintenance</div>
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
                  placeholder="Search locks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={selectedProperty} onValueChange={setSelectedProperty}>
              <SelectTrigger className="w-full sm:w-48">
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
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="upcoming">Upcoming</SelectItem>
              </SelectContent>
            </Select>
            <Select value={lockTypeFilter} onValueChange={setLockTypeFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Lock Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {lockTypes.map(lt => (
                  <SelectItem key={lt.value} value={lt.value}>
                    {lt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={fetchData}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Locks Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredLocks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Lock className="h-12 w-12 mb-4" />
              <p>No inventory locks found</p>
              <p className="text-sm">Create a lock to restrict room availability</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Room / Room Type</TableHead>
                    <TableHead>Date Range</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLocks.map((lock) => {
                    const lockType = getLockTypeInfo(lock.lockType);
                    const LockIcon = lockType.icon;

                    return (
                      <TableRow key={lock.id}>
                        <TableCell>{getStatusBadge(lock)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <LockIcon className={cn("h-4 w-4", lockType.color)} />
                            <span>{lockType.label}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {lock.room ? (
                            <div>
                              <div className="font-medium">Room {lock.room.number}</div>
                              <div className="text-xs text-muted-foreground">
                                Floor {lock.room.floor} | {lock.room.roomType?.name || 'Unknown Type'}
                              </div>
                            </div>
                          ) : lock.roomTypeId ? (
                            <div className="font-medium">
                              {roomTypes.find(rt => rt.id === lock.roomTypeId)?.name || 'Unknown Type'}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div>{format(parseISO(lock.startDate), 'MMM d, yyyy')}</div>
                            <div className="text-muted-foreground">
                              to {format(parseISO(lock.endDate), 'MMM d, yyyy')}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {lock.durationDays || 0} days
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[200px] truncate text-sm" title={lock.reason}>
                            {lock.reason}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {lock.isActive && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleUnlock(lock)}
                                className="text-green-600 hover:text-green-700"
                              >
                                <Unlock className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(lock)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openDeleteDialog(lock)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
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

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Inventory Lock</DialogTitle>
            <DialogDescription>
              Block room availability for a specific period
            </DialogDescription>
          </DialogHeader>
          <LockForm
            formData={formData}
            setFormData={setFormData}
            rooms={rooms}
            roomTypes={roomTypes}
            lockTypes={lockTypes}
            isStartCalendarOpen={isStartCalendarOpen}
            setIsStartCalendarOpen={setIsStartCalendarOpen}
            isEndCalendarOpen={isEndCalendarOpen}
            setIsEndCalendarOpen={setIsEndCalendarOpen}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Lock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Inventory Lock</DialogTitle>
            <DialogDescription>
              Modify the lock details
            </DialogDescription>
          </DialogHeader>
          <LockForm
            formData={formData}
            setFormData={setFormData}
            rooms={rooms}
            roomTypes={roomTypes}
            lockTypes={lockTypes}
            isStartCalendarOpen={isStartCalendarOpen}
            setIsStartCalendarOpen={setIsStartCalendarOpen}
            isEndCalendarOpen={isEndCalendarOpen}
            setIsEndCalendarOpen={setIsEndCalendarOpen}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Update Lock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Inventory Lock</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this lock? The room will become available for the locked dates.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Remove Lock
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Lock Form Component
interface LockFormProps {
  formData: {
    lockType: string;
    roomId: string;
    roomTypeId: string;
    startDate: string;
    endDate: string;
    reason: string;
  };
  setFormData: React.Dispatch<React.SetStateAction<{
    lockType: string;
    roomId: string;
    roomTypeId: string;
    startDate: string;
    endDate: string;
    reason: string;
  }>>;
  rooms: Room[];
  roomTypes: RoomType[];
  lockTypes: { value: string; label: string; icon: React.ElementType; color: string }[];
  isStartCalendarOpen: boolean;
  setIsStartCalendarOpen: (open: boolean) => void;
  isEndCalendarOpen: boolean;
  setIsEndCalendarOpen: (open: boolean) => void;
}

function LockForm({
  formData,
  setFormData,
  rooms,
  roomTypes,
  lockTypes,
  isStartCalendarOpen,
  setIsStartCalendarOpen,
  isEndCalendarOpen,
  setIsEndCalendarOpen,
}: LockFormProps) {
  return (
    <div className="grid gap-4 py-4">
      {/* Lock Type */}
      <div className="space-y-2">
        <Label>Lock Type *</Label>
        <Select
          value={formData.lockType}
          onValueChange={(value) => setFormData(prev => ({ ...prev, lockType: value }))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select lock type" />
          </SelectTrigger>
          <SelectContent>
            {lockTypes.map(lt => (
              <SelectItem key={lt.value} value={lt.value}>
                <div className="flex items-center gap-2">
                  <lt.icon className={cn("h-4 w-4", lt.color)} />
                  {lt.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Room Selection */}
      <div className="space-y-2">
        <Label>Lock Target</Label>
        <div className="text-xs text-muted-foreground mb-2">
          Select either a specific room or an entire room type
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="roomId" className="text-xs">Specific Room</Label>
            <Select
              value={formData.roomId}
              onValueChange={(value) => setFormData(prev => ({ ...prev, roomId: value, roomTypeId: '' }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select room" />
              </SelectTrigger>
              <SelectContent>
                {rooms.map(room => (
                  <SelectItem key={room.id} value={room.id}>
                    Room {room.number} - {room.roomType?.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="roomTypeId" className="text-xs">Room Type</Label>
            <Select
              value={formData.roomTypeId}
              onValueChange={(value) => setFormData(prev => ({ ...prev, roomTypeId: value, roomId: '' }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {roomTypes.map(rt => (
                  <SelectItem key={rt.id} value={rt.id}>
                    {rt.name} ({rt.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Date Range */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Start Date *</Label>
          <Popover open={isStartCalendarOpen} onOpenChange={setIsStartCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left font-normal">
                <CalendarIcon className="h-4 w-4 mr-2" />
                {formData.startDate ? format(parseISO(formData.startDate), 'MMM d, yyyy') : 'Select date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={formData.startDate ? parseISO(formData.startDate) : undefined}
                onSelect={(date) => {
                  if (date) {
                    setFormData(prev => ({ ...prev, startDate: format(date, 'yyyy-MM-dd') }));
                    setIsStartCalendarOpen(false);
                  }
                }}
                disabled={(date) => date < new Date()}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label>End Date *</Label>
          <Popover open={isEndCalendarOpen} onOpenChange={setIsEndCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left font-normal">
                <CalendarIcon className="h-4 w-4 mr-2" />
                {formData.endDate ? format(parseISO(formData.endDate), 'MMM d, yyyy') : 'Select date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={formData.endDate ? parseISO(formData.endDate) : undefined}
                onSelect={(date) => {
                  if (date) {
                    setFormData(prev => ({ ...prev, endDate: format(date, 'yyyy-MM-dd') }));
                    setIsEndCalendarOpen(false);
                  }
                }}
                disabled={(date: Date) =>
                  date < new Date() ||
                  !!(formData.startDate && date < parseISO(formData.startDate))
                }
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Reason */}
      <div className="space-y-2">
        <Label htmlFor="reason">Reason *</Label>
        <Textarea
          id="reason"
          value={formData.reason}
          onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
          placeholder="Enter the reason for this lock..."
          rows={3}
        />
      </div>
    </div>
  );
}
