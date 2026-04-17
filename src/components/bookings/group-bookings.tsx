'use client';

import React, { useState, useEffect } from 'react';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useTimezone } from '@/contexts/TimezoneContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Users,
  Plus,
  Search,
  Loader2,
  Calendar,
  Building2,
  Mail,
  Phone,
  DollarSign,
  FileText,
  MoreHorizontal,
  Pencil,
  Trash2,
  CheckCircle,
  Clock,
  XCircle,
  Bed,
  User,
  ArrowRight,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { format, differenceInDays } from 'date-fns';

interface Property {
  id: string;
  name: string;
}

interface RoomType {
  id: string;
  name: string;
  code: string;
  basePrice: number;
}

interface Room {
  id: string;
  number: string;
  name?: string;
  floor: number;
  status: string;
  roomTypeId: string;
  roomType?: { name: string };
}

interface Guest {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
}

interface Booking {
  id: string;
  confirmationCode: string;
  room?: { number: string };
  roomType?: { name: string };
  primaryGuest?: { firstName: string; lastName: string };
  status: string;
}

interface GroupBooking {
  id: string;
  name: string;
  description?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  checkIn: string;
  checkOut: string;
  totalRooms: number;
  bookedRooms: number;
  totalAmount: number;
  depositAmount: number;
  depositPaid: boolean;
  status: string;
  contractUrl?: string;
  contractSignedAt?: string;
  notes?: string;
  property: { id: string; name: string };
  bookings?: Booking[];
  createdAt: string;
}

interface Stats {
  total: number;
  inquiry: number;
  confirmed: number;
  cancelled: number;
  totalValue: number;
}

const groupStatuses: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  inquiry: { label: 'Inquiry', color: 'bg-gradient-to-r from-amber-400 to-amber-500', icon: <Clock className="h-3 w-3" /> },
  confirmed: { label: 'Confirmed', color: 'bg-gradient-to-r from-emerald-500 to-emerald-600', icon: <CheckCircle className="h-3 w-3" /> },
  cancelled: { label: 'Cancelled', color: 'bg-gradient-to-r from-red-500 to-red-600', icon: <XCircle className="h-3 w-3" /> },
};

export default function GroupBookings() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { formatCurrency, currency } = useCurrency();
  const { formatDate } = useTimezone();
  const [groups, setGroups] = useState<GroupBooking[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, inquiry: 0, confirmed: 0, cancelled: 0, totalValue: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [propertyFilter, setPropertyFilter] = useState<string>('all');

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isBookRoomsOpen, setIsBookRoomsOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<GroupBooking | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    propertyId: '',
    name: '',
    description: '',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    checkIn: '',
    checkOut: '',
    totalRooms: 1,
    totalAmount: 0,
    depositAmount: 0,
    depositPaid: false,
    status: 'inquiry',
    notes: '',
  });

  // Room booking state
  const [selectedRooms, setSelectedRooms] = useState<string[]>([]);
  const [selectedRoomTypes, setSelectedRoomTypes] = useState<Record<string, number>>({});
  const [selectedGuest, setSelectedGuest] = useState<string>('');
  const [guestMode, setGuestMode] = useState<'existing' | 'new'>('existing');
  const [newGuest, setNewGuest] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  });

  // Fetch properties
  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const response = await fetch('/api/properties');
        const result = await response.json();
        if (result.success) {
          setProperties(result.data);
          if (result.data.length > 0 && !formData.propertyId) {
            setFormData(prev => ({ ...prev, propertyId: result.data[0].id }));
          }
        }
      } catch (error) {
        console.error('Error fetching properties:', error);
      }
    };
    fetchProperties();
  }, []);

  // Fetch room types when property changes
  useEffect(() => {
    const fetchRoomTypes = async () => {
      if (!formData.propertyId) return;
      try {
        const response = await fetch(`/api/room-types?propertyId=${formData.propertyId}`);
        const result = await response.json();
        if (result.success) {
          setRoomTypes(result.data);
        }
      } catch (error) {
        console.error('Error fetching room types:', error);
      }
    };
    fetchRoomTypes();
  }, [formData.propertyId]);

  // Fetch guests
  useEffect(() => {
    const fetchGuests = async () => {
      try {
        const response = await fetch('/api/guests?limit=100');
        const result = await response.json();
        if (result.success) {
          setGuests(result.data);
          if (result.data.length > 0) {
            setSelectedGuest(result.data[0].id);
          }
        }
      } catch (error) {
        console.error('Error fetching guests:', error);
      }
    };
    fetchGuests();
  }, []);

  // Fetch group bookings
  const fetchGroups = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (propertyFilter !== 'all') params.append('propertyId', propertyFilter);

      const response = await fetch(`/api/group-bookings?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setGroups(result.data);
        setStats(result.stats);
      }
    } catch (error) {
      console.error('Error fetching group bookings:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch group bookings',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, [statusFilter, propertyFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length >= 2 || searchQuery.length === 0) {
        fetchGroups();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch available rooms for booking
  const fetchAvailableRooms = async (groupId: string) => {
    setIsLoadingRooms(true);
    try {
      const group = groups.find(g => g.id === groupId);
      if (!group) return;

      const response = await fetch(
        `/api/rooms/available?propertyId=${group.property.id}&checkIn=${group.checkIn}&checkOut=${group.checkOut}`
      );
      const result = await response.json();
      if (result.success) {
        setAvailableRooms(result.data || []);
      }
    } catch (error) {
      console.error('Error fetching available rooms:', error);
    } finally {
      setIsLoadingRooms(false);
    }
  };

  // Create group booking
  const handleCreate = async () => {
    if (!formData.propertyId || !formData.name || !formData.checkIn || !formData.checkOut) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/group-bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Group booking created successfully',
        });
        setIsCreateOpen(false);
        resetForm();
        fetchGroups();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to create group booking',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error creating group booking:', error);
      toast({
        title: 'Error',
        description: 'Failed to create group booking',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Book rooms for group
  const handleBookRooms = async () => {
    if (!selectedGroup || selectedRooms.length === 0) {
      toast({
        title: 'Validation Error',
        description: 'Please select at least one room to book',
        variant: 'destructive',
      });
      return;
    }

    // Validate guest based on mode
    if (guestMode === 'existing' && !selectedGuest) {
      toast({
        title: 'Validation Error',
        description: 'Please select a guest for the booking',
        variant: 'destructive',
      });
      return;
    }

    if (guestMode === 'new') {
      if (!newGuest.firstName.trim() || !newGuest.lastName.trim()) {
        toast({
          title: 'Validation Error',
          description: 'Please enter guest first and last name',
          variant: 'destructive',
        });
        return;
      }
    }

    setIsSaving(true);
    try {
      let guestId = selectedGuest;

      // Create new guest if needed
      if (guestMode === 'new') {
        const guestResponse = await fetch('/api/guests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantId: user?.tenantId || '',
            firstName: newGuest.firstName,
            lastName: newGuest.lastName,
            email: newGuest.email || undefined,
            phone: newGuest.phone || undefined,
          }),
        });

        const guestResult = await guestResponse.json();
        if (!guestResult.success) {
          toast({
            title: 'Error',
            description: guestResult.error?.message || 'Failed to create guest',
            variant: 'destructive',
          });
          setIsSaving(false);
          return;
        }
        guestId = guestResult.data.id;

        // Add to guests list
        setGuests(prev => [...prev, guestResult.data]);
        setSelectedGuest(guestId);
      }

      const response = await fetch('/api/group-bookings/book-rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId: selectedGroup.id,
          roomIds: selectedRooms,
          guestId,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: `Successfully booked ${selectedRooms.length} room(s)`,
        });
        setIsBookRoomsOpen(false);
        setSelectedRooms([]);
        fetchGroups();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to book rooms',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error booking rooms:', error);
      toast({
        title: 'Error',
        description: 'Failed to book rooms',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Update group booking
  const handleUpdate = async () => {
    if (!selectedGroup) return;

    setIsSaving(true);
    try {
      const response = await fetch('/api/group-bookings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedGroup.id, ...formData }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Group booking updated successfully',
        });
        setIsEditOpen(false);
        setSelectedGroup(null);
        resetForm();
        fetchGroups();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to update group booking',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error updating group booking:', error);
      toast({
        title: 'Error',
        description: 'Failed to update group booking',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Delete group booking
  const handleDelete = async () => {
    if (!selectedGroup) return;

    setIsSaving(true);
    try {
      const response = await fetch('/api/group-bookings', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedGroup.id }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Group booking deleted successfully',
        });
        setIsDeleteOpen(false);
        setSelectedGroup(null);
        fetchGroups();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to delete group booking',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error deleting group booking:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete group booking',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      propertyId: properties[0]?.id || '',
      name: '',
      description: '',
      contactName: '',
      contactEmail: '',
      contactPhone: '',
      checkIn: '',
      checkOut: '',
      totalRooms: 1,
      totalAmount: 0,
      depositAmount: 0,
      depositPaid: false,
      status: 'inquiry',
      notes: '',
    });
    setSelectedRooms([]);
    setSelectedRoomTypes({});
  };

  const openEditDialog = (group: GroupBooking) => {
    setSelectedGroup(group);
    setFormData({
      propertyId: group.property.id,
      name: group.name,
      description: group.description || '',
      contactName: group.contactName || '',
      contactEmail: group.contactEmail || '',
      contactPhone: group.contactPhone || '',
      checkIn: format(new Date(group.checkIn), 'yyyy-MM-dd'),
      checkOut: format(new Date(group.checkOut), 'yyyy-MM-dd'),
      totalRooms: group.totalRooms,
      totalAmount: group.totalAmount,
      depositAmount: group.depositAmount,
      depositPaid: group.depositPaid,
      status: group.status,
      notes: group.notes || '',
    });
    setIsEditOpen(true);
  };

  const openBookRoomsDialog = (group: GroupBooking) => {
    setSelectedGroup(group);
    setSelectedRooms([]);
    fetchAvailableRooms(group.id);
    setIsBookRoomsOpen(true);
  };

  const openDetailsDialog = async (group: GroupBooking) => {
    try {
      const response = await fetch(`/api/group-bookings/${group.id}`);
      const result = await response.json();
      if (result.success) {
        setSelectedGroup(result.data);
        setIsDetailsOpen(true);
      }
    } catch (error) {
      console.error('Error fetching group details:', error);
    }
  };

  const toggleRoomSelection = (roomId: string) => {
    setSelectedRooms(prev =>
      prev.includes(roomId)
        ? prev.filter(id => id !== roomId)
        : [...prev, roomId]
    );
  };

  const getRoomTypeById = (roomTypeId: string) => {
    return roomTypes.find(rt => rt.id === roomTypeId);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Users className="h-5 w-5" />
            Group Bookings
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage group reservations with multi-room booking
          </p>
        </div>
        <Button onClick={() => { resetForm(); setIsCreateOpen(true); }} className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-md hover:shadow-lg hover:shadow-emerald-500/25 transition-all duration-200">
          <Plus className="h-4 w-4 mr-2" />
          New Group
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-5">
        <Card className="p-4 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200">
          <div className="text-2xl font-bold">{stats.total}</div>
          <div className="text-xs text-muted-foreground">Total Groups</div>
        </Card>
        <Card className="p-4 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200">
          <div className="text-2xl font-bold text-amber-500">{stats.inquiry}</div>
          <div className="text-xs text-muted-foreground">Inquiries</div>
        </Card>
        <Card className="p-4 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200">
          <div className="text-2xl font-bold text-emerald-500">{stats.confirmed}</div>
          <div className="text-xs text-muted-foreground">Confirmed</div>
        </Card>
        <Card className="p-4 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200">
          <div className="text-2xl font-bold text-red-500">{stats.cancelled}</div>
          <div className="text-xs text-muted-foreground">Cancelled</div>
        </Card>
        <Card className="p-4 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200">
          <div className="text-2xl font-bold text-violet-500">{formatCurrency(stats.totalValue)}</div>
          <div className="text-xs text-muted-foreground">Total Value</div>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative focus-within:ring-2 focus-within:ring-primary/20 rounded-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search groups..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
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
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {Object.entries(groupStatuses).map(([key, { label }]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Group Bookings - Mobile Card Layout */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : groups.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mb-4" />
              <p>No group bookings found</p>
              <p className="text-sm">Create your first group booking to get started</p>
            </CardContent>
          </Card>
        ) : groups.map((group) => {
          const nights = differenceInDays(new Date(group.checkOut), new Date(group.checkIn));
          const roomProgress = (group.bookedRooms / group.totalRooms) * 100;
          return (
            <Card key={group.id} className="p-3 space-y-2 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium truncate">{group.name}</p>
                  {group.description && (
                    <p className="text-xs text-muted-foreground truncate">{group.description}</p>
                  )}
                </div>
                <Badge className={cn('text-white shrink-0', groupStatuses[group.status]?.color)}>
                  {groupStatuses[group.status]?.label}
                </Badge>
              </div>
              {group.contactName && (
                <div className="text-sm text-muted-foreground">{group.contactName}</div>
              )}
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Building2 className="h-3 w-3" />
                <span>{group.property?.name || '-'}</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>{formatDate(group.checkIn)} - {formatDate(group.checkOut)}</span>
                <span>({nights}n)</span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent font-semibold">{group.bookedRooms}/{group.totalRooms}</span> rooms
                  <span className="font-medium">{formatCurrency(group.totalAmount)}</span>
                </div>
                <Progress value={roomProgress} className="h-2 [&>div]:bg-gradient-to-r [&>div]:from-emerald-500 [&>div]:to-teal-500" />
              </div>
              <div className="flex items-center justify-end">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openDetailsDialog(group)}>
                      <FileText className="h-4 w-4 mr-2" />
                      View Details
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openBookRoomsDialog(group)}>
                      <Bed className="h-4 w-4 mr-2" />
                      Book Rooms
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openEditDialog(group)}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-red-600"
                      onClick={() => {
                        setSelectedGroup(group);
                        setIsDeleteOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </Card>
          );
        })}
      </div>
      {/* Group Bookings - Desktop Table Layout */}
      <Card className="hidden md:block">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mb-4" />
              <p>No group bookings found</p>
              <p className="text-sm">Create your first group booking to get started</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Group</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Property</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead>Rooms</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groups.map((group) => {
                    const nights = differenceInDays(new Date(group.checkOut), new Date(group.checkIn));
                    const roomProgress = (group.bookedRooms / group.totalRooms) * 100;

                    return (
                      <TableRow key={group.id} className="hover:bg-muted/50 transition-colors">
                        <TableCell>
                          <div>
                            <p className="font-medium">{group.name}</p>
                            {group.description && (
                              <p className="text-xs text-muted-foreground truncate max-w-32">
                                {group.description}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {group.contactName && <p>{group.contactName}</p>}
                            {group.contactEmail && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {group.contactEmail}
                              </p>
                            )}
                            {group.contactPhone && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {group.contactPhone}
                              </p>
                            )}
                            {!group.contactName && !group.contactEmail && !group.contactPhone && (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Building2 className="h-3 w-3 text-muted-foreground" />
                            <span>{group.property?.name || '-'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              <span>{formatDate(group.checkIn)}</span>
                              <span className="text-muted-foreground">-</span>
                              <span>{formatDate(group.checkOut)}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">{nights} night{nights > 1 ? 's' : ''}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="w-24">
                            <div className="flex justify-between text-xs mb-1">
                              <span>{group.bookedRooms}/{group.totalRooms}</span>
                            </div>
                            <Progress value={roomProgress} className="h-2 [&>div]:bg-gradient-to-r [&>div]:from-emerald-500 [&>div]:to-teal-500" />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <span className="font-medium">{formatCurrency(group.totalAmount)}</span>
                            {group.depositAmount > 0 && (
                              <p className="text-xs text-muted-foreground">
                                Deposit: {formatCurrency(group.depositAmount)}
                                {group.depositPaid && <span className="text-emerald-500 ml-1">(Paid)</span>}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={cn('text-white', groupStatuses[group.status]?.color)}>
                            {groupStatuses[group.status]?.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openDetailsDialog(group)}>
                                <FileText className="h-4 w-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openBookRoomsDialog(group)}>
                                <Bed className="h-4 w-4 mr-2" />
                                Book Rooms
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openEditDialog(group)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => {
                                  setSelectedGroup(group);
                                  setIsDeleteOpen(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90dvh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>Create Group Booking</DialogTitle>
            <DialogDescription>
              Create a new group reservation container
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2 -mr-2">
            <GroupBookingForm
              formData={formData}
              setFormData={setFormData}
              properties={properties}
            />
          </div>
          <DialogFooter className="shrink-0">
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90dvh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>Edit Group Booking</DialogTitle>
            <DialogDescription>
              Update group reservation details
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2 -mr-2">
            <GroupBookingForm
              formData={formData}
              setFormData={setFormData}
              properties={properties}
            />
          </div>
          <DialogFooter className="shrink-0">
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Update Group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Book Rooms Dialog */}
      <Dialog open={isBookRoomsOpen} onOpenChange={setIsBookRoomsOpen}>
        <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[90dvh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>Book Rooms for {selectedGroup?.name}</DialogTitle>
            <DialogDescription>
              Select available rooms to add to this group booking
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 flex-1 overflow-y-auto pr-2 -mr-2">
            {/* Guest Selection */}
            <div className="space-y-3">
              <Label>Primary Guest for Bookings *</Label>
              
              <Tabs value={guestMode} onValueChange={(v) => setGuestMode(v as 'existing' | 'new')}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="existing">Existing Guest</TabsTrigger>
                  <TabsTrigger value="new">New Guest</TabsTrigger>
                </TabsList>

                <TabsContent value="existing" className="mt-3">
                  <Select value={selectedGuest} onValueChange={setSelectedGuest}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a guest" />
                    </SelectTrigger>
                    <SelectContent>
                      {guests.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground text-center">
                          No guests found. Use "New Guest" tab to create one.
                        </div>
                      ) : (
                        guests.map(guest => (
                          <SelectItem key={guest.id} value={guest.id}>
                            {guest.firstName} {guest.lastName} {guest.email ? `(${guest.email})` : ''}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </TabsContent>

                <TabsContent value="new" className="mt-3 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="newGuestFirstName" className="text-xs">First Name *</Label>
                      <Input
                        id="newGuestFirstName"
                        value={newGuest.firstName}
                        onChange={(e) => setNewGuest(prev => ({ ...prev, firstName: e.target.value }))}
                        placeholder="John"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="newGuestLastName" className="text-xs">Last Name *</Label>
                      <Input
                        id="newGuestLastName"
                        value={newGuest.lastName}
                        onChange={(e) => setNewGuest(prev => ({ ...prev, lastName: e.target.value }))}
                        placeholder="Doe"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="newGuestEmail" className="text-xs">Email</Label>
                      <Input
                        id="newGuestEmail"
                        type="email"
                        value={newGuest.email}
                        onChange={(e) => setNewGuest(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="john@example.com"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="newGuestPhone" className="text-xs">Phone</Label>
                      <Input
                        id="newGuestPhone"
                        value={newGuest.phone}
                        onChange={(e) => setNewGuest(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="+1 234 567 890"
                      />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            {/* Room Selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Available Rooms</Label>
                <span className="text-sm text-muted-foreground">
                  {selectedRooms.length} room(s) selected
                </span>
              </div>

              {isLoadingRooms ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : availableRooms.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Bed className="h-8 w-8 mx-auto mb-2" />
                  <p>No available rooms for the selected dates</p>
                </div>
              ) : (
                <ScrollArea className="h-[300px] border rounded-lg">
                  <div className="p-2 space-y-2">
                    {availableRooms.map(room => (
                      <div
                        key={room.id}
                        className={cn(
                          'flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors',
                          selectedRooms.includes(room.id)
                            ? 'bg-primary/10 border-primary'
                            : 'hover:bg-muted'
                        )}
                        onClick={() => toggleRoomSelection(room.id)}
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={selectedRooms.includes(room.id)}
                            onCheckedChange={() => toggleRoomSelection(room.id)}
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <Bed className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">Room {room.number}</span>
                              <span className="text-xs text-muted-foreground">
                                Floor {room.floor}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {room.roomType?.name || 'Unknown Type'}
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {room.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>

            {/* Summary */}
            {selectedRooms.length > 0 && (
              <Card className="p-4 bg-muted/50">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Selected Rooms:</span>
                  <span className="font-medium">{selectedRooms.length}</span>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-sm">Est. Total:</span>
                  <span className="font-medium">
                    {formatCurrency(selectedRooms.length * 150)}/night
                  </span>
                </div>
              </Card>
            )}
          </div>

          <DialogFooter className="shrink-0">
            <Button variant="outline" onClick={() => setIsBookRoomsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleBookRooms} disabled={isSaving || selectedRooms.length === 0}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Book {selectedRooms.length} Room(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[90dvh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>{selectedGroup?.name}</DialogTitle>
            <DialogDescription>
              Group booking details and associated reservations
            </DialogDescription>
          </DialogHeader>

          {selectedGroup && (
            <div className="space-y-4 flex-1 overflow-y-auto pr-2 -mr-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card className="p-4">
                  <div className="text-sm text-muted-foreground">Property</div>
                  <div className="font-medium">{selectedGroup.property?.name}</div>
                </Card>
                <Card className="p-4">
                  <div className="text-sm text-muted-foreground">Dates</div>
                  <div className="font-medium">
                    {format(new Date(selectedGroup.checkIn), 'MMM d')} - {format(new Date(selectedGroup.checkOut), 'MMM d, yyyy')}
                  </div>
                </Card>
                <Card className="p-4">
                  <div className="text-sm text-muted-foreground">Rooms</div>
                  <div className="font-medium">{selectedGroup.bookedRooms} / {selectedGroup.totalRooms} booked</div>
                </Card>
                <Card className="p-4">
                  <div className="text-sm text-muted-foreground">Total Amount</div>
                  <div className="font-medium">{formatCurrency(selectedGroup.totalAmount)}</div>
                </Card>
              </div>

              {selectedGroup.bookings && selectedGroup.bookings.length > 0 && (
                <div className="space-y-2">
                  <Label>Booked Rooms</Label>
                  <ScrollArea className="h-[200px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Confirmation</TableHead>
                          <TableHead>Room</TableHead>
                          <TableHead>Guest</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedGroup.bookings.map(booking => (
                          <TableRow key={booking.id}>
                            <TableCell className="font-mono text-sm">
                              {booking.confirmationCode}
                            </TableCell>
                            <TableCell>
                              {booking.room?.number || '-'}
                            </TableCell>
                            <TableCell>
                              {booking.primaryGuest
                                ? `${booking.primaryGuest.firstName} ${booking.primaryGuest.lastName}`
                                : '-'}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{booking.status}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailsOpen(false)}>
              Close
            </Button>
            <Button onClick={() => {
              setIsDetailsOpen(false);
              if (selectedGroup) openBookRoomsDialog(selectedGroup);
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Add More Rooms
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Group Booking</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{selectedGroup?.name}&quot;? This action cannot be undone.
              {selectedGroup && selectedGroup.bookedRooms > 0 && (
                <p className="text-amber-500 mt-2">
                  Warning: This group has {selectedGroup.bookedRooms} associated bookings.
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Group Booking Form Component
interface GroupBookingFormData {
  propertyId: string;
  name: string;
  description: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  checkIn: string;
  checkOut: string;
  totalRooms: number;
  totalAmount: number;
  depositAmount: number;
  depositPaid: boolean;
  status: string;
  notes: string;
}

interface GroupBookingFormProps {
  formData: GroupBookingFormData;
  setFormData: React.Dispatch<React.SetStateAction<GroupBookingFormData>>;
  properties: Property[];
}

function GroupBookingForm({ formData, setFormData, properties }: GroupBookingFormProps) {
  return (
    <div className="grid gap-4 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="propertyId">Property *</Label>
          <Select
            value={formData.propertyId as string}
            onValueChange={(value) => setFormData(prev => ({ ...prev, propertyId: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select property" />
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
        <div className="space-y-2">
          <Label htmlFor="name">Group Name *</Label>
          <Input
            id="name"
            value={formData.name as string}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Corporate Retreat 2024"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description as string}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Group description..."
          rows={2}
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="contactName">Contact Name</Label>
          <Input
            id="contactName"
            value={formData.contactName as string}
            onChange={(e) => setFormData(prev => ({ ...prev, contactName: e.target.value }))}
            placeholder="John Doe"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contactEmail">Email</Label>
          <Input
            id="contactEmail"
            type="email"
            value={formData.contactEmail as string}
            onChange={(e) => setFormData(prev => ({ ...prev, contactEmail: e.target.value }))}
            placeholder="john@company.com"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contactPhone">Phone</Label>
          <Input
            id="contactPhone"
            value={formData.contactPhone as string}
            onChange={(e) => setFormData(prev => ({ ...prev, contactPhone: e.target.value }))}
            placeholder="+1 234 567 890"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="checkIn">Check-in Date *</Label>
          <Input
            id="checkIn"
            type="date"
            value={formData.checkIn as string}
            onChange={(e) => setFormData(prev => ({ ...prev, checkIn: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="checkOut">Check-out Date *</Label>
          <Input
            id="checkOut"
            type="date"
            value={formData.checkOut as string}
            onChange={(e) => setFormData(prev => ({ ...prev, checkOut: e.target.value }))}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="totalRooms">Total Rooms Needed</Label>
          <Input
            id="totalRooms"
            type="number"
            min="1"
            value={formData.totalRooms as number}
            onChange={(e) => setFormData(prev => ({ ...prev, totalRooms: parseInt(e.target.value) || 1 }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="totalAmount">Total Amount</Label>
          <Input
            id="totalAmount"
            type="number"
            min="0"
            step="0.01"
            value={formData.totalAmount as number}
            onChange={(e) => setFormData(prev => ({ ...prev, totalAmount: parseFloat(e.target.value) || 0 }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="depositAmount">Deposit Amount</Label>
          <Input
            id="depositAmount"
            type="number"
            min="0"
            step="0.01"
            value={formData.depositAmount as number}
            onChange={(e) => setFormData(prev => ({ ...prev, depositAmount: parseFloat(e.target.value) || 0 }))}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select
            value={formData.status as string}
            onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(groupStatuses).map(([key, { label }]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="depositPaid">Deposit Status</Label>
          <Select
            value={formData.depositPaid ? 'paid' : 'pending'}
            onValueChange={(value) => setFormData(prev => ({ ...prev, depositPaid: value === 'paid' }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={formData.notes as string}
          onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
          placeholder="Additional notes..."
          rows={2}
        />
      </div>
    </div>
  );
}
