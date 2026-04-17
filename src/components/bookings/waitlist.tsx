'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
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
  Clock,
  Plus,
  Search,
  Loader2,
  Calendar,
  User,
  Building2,
  Bell,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowRight,
  MoreHorizontal,
  Trash2,
  Mail,
  Phone,
  UserPlus,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { format, differenceInDays } from 'date-fns';

interface Property {
  id: string;
  name: string;
}

interface RoomType {
  id: string;
  name: string;
  code: string;
}

interface Guest {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  isVip: boolean;
}

interface WaitlistEntry {
  id: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  priority: number;
  status: string;
  notes?: string;
  convertedAt?: string;
  guest: Guest;
  roomType: { id: string; name: string };
  property: { id: string; name: string };
  booking?: { id: string; confirmationCode: string; status: string };
  createdAt: string;
}

interface Stats {
  total: number;
  waiting: number;
  notified: number;
  converted: number;
  expired: number;
}

const waitlistStatuses: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  waiting: { label: 'Waiting', color: 'bg-amber-500', icon: <Clock className="h-3 w-3" /> },
  notified: { label: 'Notified', color: 'bg-cyan-500', icon: <Bell className="h-3 w-3" /> },
  converted: { label: 'Converted', color: 'bg-emerald-500', icon: <CheckCircle className="h-3 w-3" /> },
  expired: { label: 'Expired', color: 'bg-gray-500', icon: <XCircle className="h-3 w-3" /> },
};

export default function Waitlist() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, waiting: 0, notified: 0, converted: 0, expired: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [propertyFilter, setPropertyFilter] = useState<string>('all');

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<WaitlistEntry | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [createTab, setCreateTab] = useState<'existing' | 'new'>('existing');

  // Form state
  const [formData, setFormData] = useState({
    propertyId: '',
    roomTypeId: '',
    guestId: '',
    checkIn: '',
    checkOut: '',
    adults: 1,
    children: 0,
    priority: 0,
    notes: '',
  });

  // New guest form state
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
          if (result.data.length > 0 && !formData.roomTypeId) {
            setFormData(prev => ({ ...prev, roomTypeId: result.data[0].id }));
          }
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
          if (result.data.length > 0 && !formData.guestId) {
            setFormData(prev => ({ ...prev, guestId: result.data[0].id }));
          }
        }
      } catch (error) {
        console.error('Error fetching guests:', error);
      }
    };
    fetchGuests();
  }, []);

  // Fetch waitlist entries
  const fetchEntries = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (propertyFilter !== 'all') params.append('propertyId', propertyFilter);

      const response = await fetch(`/api/waitlist?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setEntries(result.data);
        setStats(result.stats);
      }
    } catch (error) {
      console.error('Error fetching waitlist:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch waitlist',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
  }, [statusFilter, propertyFilter]);

  // Create waitlist entry
  const handleCreate = async () => {
    // Validate based on tab
    if (createTab === 'existing') {
      if (!formData.propertyId || !formData.guestId || !formData.roomTypeId || !formData.checkIn || !formData.checkOut) {
        toast({
          title: 'Validation Error',
          description: 'Please fill in all required fields',
          variant: 'destructive',
        });
        return;
      }
    } else {
      // New guest validation
      if (!formData.propertyId || !formData.roomTypeId || !formData.checkIn || !formData.checkOut) {
        toast({
          title: 'Validation Error',
          description: 'Please fill in all required fields',
          variant: 'destructive',
        });
        return;
      }
      if (!newGuest.firstName || !newGuest.lastName) {
        toast({
          title: 'Validation Error',
          description: 'Guest first and last name are required',
          variant: 'destructive',
        });
        return;
      }
    }

    setIsSaving(true);
    try {
      let guestId = formData.guestId;

      // Create new guest if needed
      if (createTab === 'new') {
        const guestResponse = await fetch('/api/guests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantId: user?.tenantId || '',
            ...newGuest,
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

        // Add to local guests list
        setGuests(prev => [...prev, guestResult.data]);
      }

      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          guestId,
          checkIn: new Date(formData.checkIn).toISOString(),
          checkOut: new Date(formData.checkOut).toISOString(),
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Added to waitlist successfully',
        });
        setIsCreateOpen(false);
        resetForm();
        fetchEntries();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to add to waitlist',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error creating waitlist entry:', error);
      toast({
        title: 'Error',
        description: 'Failed to add to waitlist',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Update waitlist entry status
  const updateStatus = async (entryId: string, newStatus: string) => {
    try {
      const response = await fetch('/api/waitlist', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: entryId, status: newStatus }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: `Status updated to ${waitlistStatuses[newStatus]?.label}`,
        });
        fetchEntries();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to update status',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update status',
        variant: 'destructive',
      });
    }
  };

  // Delete waitlist entry
  const handleDelete = async () => {
    if (!selectedEntry) return;

    setIsSaving(true);
    try {
      const response = await fetch('/api/waitlist', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedEntry.id }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Waitlist entry removed',
        });
        setIsDeleteOpen(false);
        setSelectedEntry(null);
        fetchEntries();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to remove entry',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error deleting entry:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove entry',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      propertyId: properties[0]?.id || '',
      roomTypeId: roomTypes[0]?.id || '',
      guestId: guests[0]?.id || '',
      checkIn: '',
      checkOut: '',
      adults: 1,
      children: 0,
      priority: 0,
      notes: '',
    });
    setNewGuest({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
    });
    setCreateTab('existing');
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Waitlist
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage guests waiting for availability
          </p>
        </div>
        <Button onClick={() => { resetForm(); setIsCreateOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Add to Waitlist
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-5">
        <Card className="p-4">
          <div className="text-2xl font-bold">{stats.total}</div>
          <div className="text-xs text-muted-foreground">Total Entries</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-amber-500">{stats.waiting}</div>
          <div className="text-xs text-muted-foreground">Waiting</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-cyan-500">{stats.notified}</div>
          <div className="text-xs text-muted-foreground">Notified</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-emerald-500">{stats.converted}</div>
          <div className="text-xs text-muted-foreground">Converted</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-gray-500">{stats.expired}</div>
          <div className="text-xs text-muted-foreground">Expired</div>
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
                  placeholder="Search by guest name..."
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
                {Object.entries(waitlistStatuses).map(([key, { label }]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Waitlist Table */}
      {/* Mobile Card Layout */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : entries.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Clock className="h-12 w-12 mb-4" />
              <p>No waitlist entries found</p>
              <p className="text-sm">Add guests to the waitlist when rooms are unavailable</p>
            </CardContent>
          </Card>
        ) : entries.map((entry) => {
          const nights = differenceInDays(new Date(entry.checkOut), new Date(entry.checkIn));
          const waitingDays = differenceInDays(new Date(), new Date(entry.createdAt));
          return (
            <Card key={entry.id} className="p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-[10px] bg-gradient-to-br from-primary/80 to-primary text-primary-foreground">
                      {getInitials(entry.guest.firstName, entry.guest.lastName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {entry.guest.firstName} {entry.guest.lastName}
                      {entry.guest.isVip && <Badge variant="outline" className="text-xs text-amber-500 border-amber-500 ml-1">VIP</Badge>}
                    </p>
                  </div>
                </div>
                <Badge className={cn('text-white shrink-0', waitlistStatuses[entry.status]?.color)}>
                  {waitlistStatuses[entry.status]?.label}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground">{entry.roomType?.name || '-'}</div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>{format(new Date(entry.checkIn), 'MMM d')} - {format(new Date(entry.checkOut), 'MMM d')} ({nights}n)</span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {entry.adults}a{entry.adults > 1 ? 's' : ''}{entry.children > 0 ? `, ${entry.children}c` : ''}
                </div>
                <span className="text-muted-foreground">P{entry.priority} · {waitingDays}d</span>
              </div>
              <div className="flex items-center justify-end">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => updateStatus(entry.id, 'notified')} disabled={entry.status !== 'waiting'}>
                      <Bell className="h-4 w-4 mr-2" /> Notify
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-red-600" onClick={() => { setSelectedEntry(entry); setIsDeleteOpen(true); }}>
                      <Trash2 className="h-4 w-4 mr-2" /> Remove
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </Card>
          );
        })}
      </div>
      {/* Desktop Table Layout */}
      <Card className="hidden md:block">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Clock className="h-12 w-12 mb-4" />
              <p>No waitlist entries found</p>
              <p className="text-sm">Add guests to the waitlist when rooms are unavailable</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Guest</TableHead>
                    <TableHead>Property</TableHead>
                    <TableHead>Room Type</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead>Guests</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => {
                    const nights = differenceInDays(new Date(entry.checkOut), new Date(entry.checkIn));
                    const waitingDays = differenceInDays(new Date(), new Date(entry.createdAt));

                    return (
                      <TableRow key={entry.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs bg-gradient-to-br from-primary/80 to-primary text-primary-foreground">
                                {getInitials(entry.guest.firstName, entry.guest.lastName)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-sm">
                                  {entry.guest.firstName} {entry.guest.lastName}
                                </p>
                                {entry.guest.isVip && (
                                  <Badge variant="outline" className="text-xs text-amber-500 border-amber-500">
                                    VIP
                                  </Badge>
                                )}
                              </div>
                              <div className="flex gap-2 text-xs text-muted-foreground">
                                {entry.guest.email && (
                                  <span className="flex items-center gap-1">
                                    <Mail className="h-3 w-3" />
                                    {entry.guest.email}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Building2 className="h-3 w-3 text-muted-foreground" />
                            <span>{entry.property?.name || '-'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{entry.roomType?.name || '-'}</span>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              <span>{format(new Date(entry.checkIn), 'MMM d')}</span>
                              <span className="text-muted-foreground">-</span>
                              <span>{format(new Date(entry.checkOut), 'MMM d')}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">{nights} night{nights > 1 ? 's' : ''}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <User className="h-3 w-3 text-muted-foreground" />
                            <span>{entry.adults} adult{entry.adults > 1 ? 's' : ''}</span>
                            {entry.children > 0 && (
                              <span className="text-muted-foreground">, {entry.children} child{entry.children > 1 ? 'ren' : ''}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant={entry.priority > 0 ? 'default' : 'secondary'} className="text-xs">
                              P{entry.priority}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {waitingDays}d waiting
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={entry.status}
                            onValueChange={(value) => updateStatus(entry.id, value)}
                            disabled={entry.status === 'converted' || entry.status === 'expired'}
                          >
                            <SelectTrigger className="w-28 h-7">
                              <Badge className={cn('text-white text-xs', waitlistStatuses[entry.status]?.color)}>
                                {waitlistStatuses[entry.status]?.label}
                              </Badge>
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(waitlistStatuses)
                                .filter(([key]) => key !== 'converted' && key !== 'expired')
                                .map(([key, { label }]) => (
                                  <SelectItem key={key} value={key}>
                                    {label}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => updateStatus(entry.id, 'notified')}
                                disabled={entry.status !== 'waiting'}
                              >
                                <Bell className="h-4 w-4 mr-2" />
                                Notify Guest
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => {
                                  setSelectedEntry(entry);
                                  setIsDeleteOpen(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Remove
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
        <DialogContent className="w-[95vw] sm:max-w-lg max-h-[90dvh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Add to Waitlist</DialogTitle>
            <DialogDescription>
              Add a guest to the waitlist for room availability
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Guest Selection Tabs */}
            <Tabs value={createTab} onValueChange={(v) => setCreateTab(v as 'existing' | 'new')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="existing">Existing Guest</TabsTrigger>
                <TabsTrigger value="new">New Guest</TabsTrigger>
              </TabsList>

              <TabsContent value="existing" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="guestId">Guest *</Label>
                  {guests.length > 0 ? (
                    <Select
                      value={formData.guestId}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, guestId: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select guest" />
                      </SelectTrigger>
                      <SelectContent>
                        {guests.map(guest => (
                          <SelectItem key={guest.id} value={guest.id}>
                            {guest.firstName} {guest.lastName} {guest.isVip ? '(VIP)' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="text-sm text-muted-foreground p-2 bg-muted rounded-md">
                      No guests found. Please switch to "New Guest" tab to create one.
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="new" className="space-y-4 mt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input
                      id="firstName"
                      value={newGuest.firstName}
                      onChange={(e) => setNewGuest(prev => ({ ...prev, firstName: e.target.value }))}
                      placeholder="John"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input
                      id="lastName"
                      value={newGuest.lastName}
                      onChange={(e) => setNewGuest(prev => ({ ...prev, lastName: e.target.value }))}
                      placeholder="Doe"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="guestEmail">Email</Label>
                    <Input
                      id="guestEmail"
                      type="email"
                      value={newGuest.email}
                      onChange={(e) => setNewGuest(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="john@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="guestPhone">Phone</Label>
                    <Input
                      id="guestPhone"
                      value={newGuest.phone}
                      onChange={(e) => setNewGuest(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="+1 234 567 890"
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="propertyId">Property *</Label>
                <Select
                  value={formData.propertyId}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, propertyId: value, roomTypeId: '' }))}
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
                <Label htmlFor="roomTypeId">Room Type *</Label>
                <Select
                  value={formData.roomTypeId}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, roomTypeId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select room type" />
                  </SelectTrigger>
                  <SelectContent>
                    {roomTypes.map(type => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="checkIn">Check-in Date *</Label>
                <Input
                  id="checkIn"
                  type="date"
                  value={formData.checkIn}
                  onChange={(e) => setFormData(prev => ({ ...prev, checkIn: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="checkOut">Check-out Date *</Label>
                <Input
                  id="checkOut"
                  type="date"
                  value={formData.checkOut}
                  onChange={(e) => setFormData(prev => ({ ...prev, checkOut: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="adults">Adults</Label>
                <Input
                  id="adults"
                  type="number"
                  min="1"
                  max="10"
                  value={formData.adults}
                  onChange={(e) => setFormData(prev => ({ ...prev, adults: parseInt(e.target.value) || 1 }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="children">Children</Label>
                <Input
                  id="children"
                  type="number"
                  min="0"
                  max="10"
                  value={formData.children}
                  onChange={(e) => setFormData(prev => ({ ...prev, children: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Input
                  id="priority"
                  type="number"
                  min="0"
                  max="10"
                  value={formData.priority}
                  onChange={(e) => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Special requests or notes..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add to Waitlist
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from Waitlist</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this entry from the waitlist? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
