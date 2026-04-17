'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useTimezone } from '@/contexts/TimezoneContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription 
} from '@/components/ui/dialog';
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
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  CalendarDays, 
  Plus, 
  Search,
  LogIn,
  LogOut,
  Users,
  DollarSign,
  Loader2,
  Crown,
  Building2,
  Hash,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  CheckCircle,
  Clock,
  XCircle,
  Calendar,
  SlidersHorizontal,
  Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { exportToCSV } from '@/lib/export-utils';
import { useToast } from '@/hooks/use-toast';
import { differenceInDays } from 'date-fns';

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

interface Guest {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  isVip: boolean;
}

interface Payment {
  id: string;
  status: 'pending' | 'paid' | 'partial' | 'refunded';
  amount: number;
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
  room?: { id: string; number: string };
  roomType: { id: string; name: string; code: string };
  property: { id: string; name: string };
  payments?: Payment[];
  paymentStatus?: string;
}

const bookingStatuses = [
  { value: 'draft', label: 'Draft', color: 'bg-gradient-to-r from-gray-400 to-gray-500' },
  { value: 'confirmed', label: 'Confirmed', color: 'bg-gradient-to-r from-emerald-400 to-emerald-600' },
  { value: 'checked_in', label: 'Checked In', color: 'bg-gradient-to-r from-blue-400 to-blue-600' },
  { value: 'checked_out', label: 'Checked Out', color: 'bg-gradient-to-r from-teal-400 to-teal-600' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-gradient-to-r from-red-400 to-red-600' },
  { value: 'no_show', label: 'No Show', color: 'bg-gradient-to-r from-orange-400 to-orange-600' },
];

const paymentStatusConfig = {
  pending: { label: 'Pending', color: 'bg-amber-100 text-amber-700', icon: Clock },
  partial: { label: 'Partial', color: 'bg-blue-100 text-blue-700', icon: CreditCard },
  paid: { label: 'Paid', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  refunded: { label: 'Refunded', color: 'bg-red-100 text-red-700', icon: XCircle },
};

const sources = [
  { value: 'direct', label: 'Direct' },
  { value: 'booking_com', label: 'Booking.com' },
  { value: 'airbnb', label: 'Airbnb' },
  { value: 'expedia', label: 'Expedia' },
  { value: 'walk_in', label: 'Walk-in' },
];

const ITEMS_PER_PAGE = 10;

// Helper to get today's date in local timezone format (YYYY-MM-DD)
const getTodayLocal = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function BookingsList() {
  const { toast } = useToast();
  const { formatCurrency, currency } = useCurrency();
  const { formatDate } = useTimezone();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [propertyFilter, setPropertyFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  
  // Date range filters
  const [dateRangeFrom, setDateRangeFrom] = useState<string>('');
  const [dateRangeTo, setDateRangeTo] = useState<string>('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  
  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    propertyId: '',
    roomTypeId: '',
    primaryGuestId: '',
    checkIn: '',
    checkOut: '',
    adults: 1,
    children: 0,
    roomRate: '',
    status: 'confirmed',
    source: 'direct',
    specialRequests: '',
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
            setFormData(prev => ({ 
              ...prev, 
              roomTypeId: result.data[0].id,
              roomRate: result.data[0].basePrice.toString()
            }));
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
          if (result.data.length > 0 && !formData.primaryGuestId) {
            setFormData(prev => ({ ...prev, primaryGuestId: result.data[0].id }));
          }
        }
      } catch (error) {
        console.error('Error fetching guests:', error);
      }
    };
    fetchGuests();
  }, []);

  // Fetch bookings
  const fetchBookings = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (propertyFilter !== 'all') params.append('propertyId', propertyFilter);
      if (dateRangeFrom) params.append('checkInFrom', dateRangeFrom);
      if (dateRangeTo) params.append('checkInTo', dateRangeTo);
      if (sourceFilter !== 'all') params.append('source', sourceFilter);
      
      const response = await fetch(`/api/bookings?${params.toString()}`);
      const result = await response.json();
      
      if (result.success) {
        setBookings(result.data);
        setCurrentPage(1); // Reset to first page on filter change
      }
    } catch (error) {
      console.error('Error fetching bookings:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch bookings',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, [statusFilter, propertyFilter, paymentFilter, sourceFilter, dateRangeFrom, dateRangeTo]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length >= 2 || searchQuery.length === 0) {
        fetchBookings();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Filter bookings by payment status (client-side since API may not support it)
  const filteredBookings = useMemo(() => {
    if (paymentFilter === 'all') return bookings;
    return bookings.filter(b => b.paymentStatus === paymentFilter);
  }, [bookings, paymentFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredBookings.length / ITEMS_PER_PAGE);
  const paginatedBookings = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredBookings.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredBookings, currentPage]);

  // Quick status update
  const updateBookingStatus = async (bookingId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/bookings/${bookingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: 'Success',
          description: `Booking ${newStatus === 'checked_in' ? 'checked in' : newStatus === 'checked_out' ? 'checked out' : 'updated'}`,
        });
        fetchBookings();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to update booking',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error updating booking:', error);
      toast({
        title: 'Error',
        description: 'Failed to update booking',
        variant: 'destructive',
      });
    }
  };

  // Create booking
  const handleCreate = async () => {
    if (!formData.propertyId || !formData.primaryGuestId || !formData.roomTypeId || !formData.checkIn || !formData.checkOut) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }
    
    setIsSaving(true);
    try {
      // Create dates at local midnight to avoid timezone issues
      const checkInDate = new Date(formData.checkIn + 'T00:00:00');
      const checkOutDate = new Date(formData.checkOut + 'T00:00:00');
      const nights = differenceInDays(checkOutDate, checkInDate);
      const roomRate = parseFloat(formData.roomRate as string) || 0;
      const totalAmount = roomRate * nights;
      
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          checkIn: checkInDate.toISOString(),
          checkOut: checkOutDate.toISOString(),
          roomRate,
          totalAmount,
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: 'Success',
          description: 'Booking created successfully',
        });
        setIsCreateOpen(false);
        resetForm();
        fetchBookings();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to create booking',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error creating booking:', error);
      toast({
        title: 'Error',
        description: 'Failed to create booking',
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
      primaryGuestId: guests[0]?.id || '',
      checkIn: '',
      checkOut: '',
      adults: 1,
      children: 0,
      roomRate: roomTypes[0]?.basePrice?.toString() || '',
      status: 'confirmed',
      source: 'direct',
      specialRequests: '',
    });
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  };

  const getStatusBadge = (status: string) => {
    const option = bookingStatuses.find(o => o.value === status);
    return (
      <Badge variant="secondary" className={cn('text-white shadow-sm transition-all duration-200 hover:shadow-md hover:scale-105', option?.color, 'rounded-full')}>
        {option?.label || status}
      </Badge>
    );
  };

  const getPaymentBadge = (status: string) => {
    const config = paymentStatusConfig[status as keyof typeof paymentStatusConfig] || paymentStatusConfig.pending;
    const Icon = config.icon;
    return (
      <Badge variant="outline" className={cn('gap-1 rounded-full transition-all duration-200 hover:shadow-sm hover:scale-105', config.color)}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  // Stats
  const stats = {
    total: bookings.length,
    confirmed: bookings.filter(b => b.status === 'confirmed').length,
    checkedIn: bookings.filter(b => b.status === 'checked_in').length,
    checkingOut: bookings.filter(b => {
      if (b.status !== 'checked_in') return false;
      const checkOut = new Date(b.checkOut);
      const today = new Date();
      return checkOut.toDateString() === today.toDateString();
    }).length,
    revenue: bookings
      .filter(b => b.status !== 'cancelled')
      .reduce((sum, b) => sum + b.totalAmount, 0),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Bookings
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage reservations and check-ins
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              if (bookings.length === 0) return;
              exportToCSV(
                bookings.map((b: any) => ({
                  ...b,
                  guestName: `${b.primaryGuest?.firstName || ''} ${b.primaryGuest?.lastName || ''}`.trim(),
                  roomName: b.room?.number || '',
                  roomTypeName: b.roomType?.name || '',
                  propertyName: b.property?.name || '',
                })),
                `bookings-export-${new Date().toISOString().split('T')[0]}`,
                [
                  { key: 'confirmationCode', label: 'Confirmation Code' },
                  { key: 'guestName', label: 'Guest Name' },
                  { key: 'status', label: 'Status' },
                  { key: 'source', label: 'Source' },
                  { key: 'checkIn', label: 'Check In' },
                  { key: 'checkOut', label: 'Check Out' },
                  { key: 'roomName', label: 'Room' },
                  { key: 'roomTypeName', label: 'Room Type' },
                  { key: 'propertyName', label: 'Property' },
                  { key: 'adults', label: 'Adults' },
                  { key: 'children', label: 'Children' },
                  { key: 'totalAmount', label: 'Total Amount' },
                ]
              );
            }}
            disabled={bookings.length === 0}
            className="border-dashed"
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button onClick={() => { resetForm(); setIsCreateOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            New Booking
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-5">
        <Card className="p-4 border-0 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 rounded-xl">
          <div className="text-2xl font-bold">{stats.total}</div>
          <div className="text-xs text-muted-foreground">Total Bookings</div>
        </Card>
        <Card className="p-4 border-0 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 rounded-xl">
          <div className="text-2xl font-bold bg-gradient-to-r from-emerald-500 to-emerald-600 bg-clip-text text-transparent">{stats.confirmed}</div>
          <div className="text-xs text-muted-foreground">Confirmed</div>
        </Card>
        <Card className="p-4 border-0 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 rounded-xl">
          <div className="text-2xl font-bold bg-gradient-to-r from-blue-500 to-blue-600 bg-clip-text text-transparent">{stats.checkedIn}</div>
          <div className="text-xs text-muted-foreground">Checked In</div>
        </Card>
        <Card className="p-4 border-0 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 rounded-xl">
          <div className="text-2xl font-bold bg-gradient-to-r from-amber-500 to-amber-600 bg-clip-text text-transparent">{stats.checkingOut}</div>
          <div className="text-xs text-muted-foreground">Checking Out</div>
        </Card>
        <Card className="p-4 border-0 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 rounded-xl">
          <div className="text-2xl font-bold bg-gradient-to-r from-violet-500 to-purple-600 bg-clip-text text-transparent">{formatCurrency(stats.revenue)}</div>
          <div className="text-xs text-muted-foreground">Revenue</div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-sm rounded-xl hover:shadow-md transition-all duration-300">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by code or guest name..."
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
                  {bookingStatuses.map(status => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className={cn(showAdvancedFilters && 'bg-primary text-primary-foreground')}
              >
                <SlidersHorizontal className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Advanced Filters */}
            {showAdvancedFilters && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t">
                <div className="space-y-2">
                  <Label className="text-xs">Check-in From</Label>
                  <Input
                    type="date"
                    value={dateRangeFrom}
                    onChange={(e) => setDateRangeFrom(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Check-in To</Label>
                  <Input
                    type="date"
                    value={dateRangeTo}
                    onChange={(e) => setDateRangeTo(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Payment Status</Label>
                  <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Payments" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Payments</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="partial">Partial</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="refunded">Refunded</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Source</Label>
                  <Select value={sourceFilter} onValueChange={setSourceFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Sources" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sources</SelectItem>
                      {sources.map(source => (
                        <SelectItem key={source.value} value={source.value}>
                          {source.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Bookings Table */}
      <Card className="border-0 shadow-sm rounded-xl hover:shadow-md transition-all duration-300">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : bookings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <CalendarDays className="h-12 w-12 mb-4" />
              <p>No bookings found</p>
              <p className="text-sm">Create your first booking to get started</p>
            </div>
          ) : (
            <>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Booking</TableHead>
                      <TableHead>Guest</TableHead>
                      <TableHead>Property</TableHead>
                      <TableHead>Room</TableHead>
                      <TableHead>Dates</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedBookings.map((booking) => {
                      const nights = differenceInDays(new Date(booking.checkOut), new Date(booking.checkIn));
                      const isArrivingToday = new Date(booking.checkIn).toDateString() === new Date().toDateString();
                      const isDepartingToday = new Date(booking.checkOut).toDateString() === new Date().toDateString();
                      
                      return (
                        <TableRow key={booking.id} className="transition-all duration-200 hover:bg-gradient-to-r hover:from-primary/[0.03] hover:to-primary/[0.06] hover:shadow-sm group">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Hash className="h-4 w-4 text-muted-foreground" />
                              <span className="font-mono font-medium">{booking.confirmationCode}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="text-xs bg-gradient-to-br from-primary/80 to-primary text-primary-foreground">
                                  {getInitials(booking.primaryGuest.firstName, booking.primaryGuest.lastName)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-medium text-sm">{booking.primaryGuest.firstName} {booking.primaryGuest.lastName}</p>
                                  {booking.primaryGuest.isVip && (
                                    <Crown className="h-3 w-3 text-amber-500" />
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {booking.adults} adult{booking.adults > 1 ? 's' : ''}
                                  {booking.children > 0 && `, ${booking.children} child${booking.children > 1 ? 'ren' : ''}`}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm">
                              <Building2 className="h-3 w-3 text-muted-foreground" />
                              <span>{booking.property.name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="text-sm font-medium">{booking.roomType.name}</p>
                              {booking.room && (
                                <p className="text-xs text-muted-foreground">Room {booking.room.number}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div className="flex items-center gap-1">
                                <LogIn className="h-3 w-3 text-muted-foreground" />
                                <span>{formatDate(booking.checkIn)}</span>
                              </div>
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <LogOut className="h-3 w-3" />
                                <span>{formatDate(booking.checkOut)}</span>
                              </div>
                              <p className="text-xs text-muted-foreground">{nights} night{nights > 1 ? 's' : ''}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-medium">{formatCurrency(booking.totalAmount)}</span>
                          </TableCell>
                          <TableCell>
                            {getPaymentBadge(booking.paymentStatus || 'pending')}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={booking.status}
                              onValueChange={(value) => updateBookingStatus(booking.id, value)}
                            >
                              <SelectTrigger className="w-28 h-7">
                                {getStatusBadge(booking.status)}
                              </SelectTrigger>
                              <SelectContent>
                                {bookingStatuses.map(status => (
                                  <SelectItem key={status.value} value={status.value}>
                                    {status.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {isArrivingToday && booking.status === 'confirmed' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => updateBookingStatus(booking.id, 'checked_in')}
                                  className="text-emerald-600"
                                >
                                  <LogIn className="h-3 w-3 mr-1" />
                                  Check In
                                </Button>
                              )}
                              {isDepartingToday && booking.status === 'checked_in' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => updateBookingStatus(booking.id, 'checked_out')}
                                  className="text-amber-600"
                                >
                                  <LogOut className="h-3 w-3 mr-1" />
                                  Check Out
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20">
                  <div className="text-sm text-muted-foreground">
                    Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredBookings.length)} of {filteredBookings.length} bookings
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let page: number;
                        if (totalPages <= 5) {
                          page = i + 1;
                        } else if (currentPage <= 3) {
                          page = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          page = totalPages - 4 + i;
                        } else {
                          page = currentPage - 2 + i;
                        }
                        return (
                          <Button
                            key={page}
                            variant={currentPage === page ? "default" : "outline"}
                            size="sm"
                            className="w-8 h-8 p-0"
                            onClick={() => setCurrentPage(page)}
                          >
                            {page}
                          </Button>
                        );
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-2xl w-[95vw] max-h-[90vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>Create New Booking</DialogTitle>
            <DialogDescription>
              Create a new reservation
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 pr-4">
            <BookingForm 
              formData={formData}
              setFormData={setFormData}
              properties={properties}
              roomTypes={roomTypes}
              guests={guests}
            />
          </ScrollArea>
          <DialogFooter className="shrink-0 pt-4 border-t">
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Booking Form Component
interface BookingFormData {
  propertyId: string;
  roomTypeId: string;
  primaryGuestId: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  roomRate: string;
  status: string;
  source: string;
  specialRequests: string;
}

interface BookingFormProps {
  formData: BookingFormData;
  setFormData: React.Dispatch<React.SetStateAction<BookingFormData>>;
  properties: Property[];
  roomTypes: RoomType[];
  guests: Guest[];
}

function BookingForm({ formData, setFormData, properties, roomTypes, guests }: BookingFormProps) {
  const { formatCurrency } = useCurrency();
  const selectedRoomType = roomTypes.find(rt => rt.id === formData.roomTypeId);
  
  return (
    <div className="grid gap-4 py-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="propertyId">Property *</Label>
          <Select 
            value={formData.propertyId as string} 
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
            value={formData.roomTypeId as string} 
            onValueChange={(value) => {
              const rt = roomTypes.find(r => r.id === value);
              setFormData(prev => ({ 
                ...prev, 
                roomTypeId: value,
                roomRate: rt?.basePrice?.toString() || ''
              }));
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select room type" />
            </SelectTrigger>
            <SelectContent>
              {roomTypes.map(type => (
                <SelectItem key={type.id} value={type.id}>
                  {type.name} ({formatCurrency(type.basePrice)}/night)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="primaryGuestId">Guest *</Label>
        <Select 
          value={formData.primaryGuestId as string} 
          onValueChange={(value) => setFormData(prev => ({ ...prev, primaryGuestId: value }))}
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
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="checkIn">Check-in Date *</Label>
          <Input
            id="checkIn"
            type="date"
            value={formData.checkIn as string}
            min={getTodayLocal()}
            onChange={(e) => setFormData(prev => ({ ...prev, checkIn: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="checkOut">Check-out Date *</Label>
          <Input
            id="checkOut"
            type="date"
            value={formData.checkOut as string}
            min={(formData.checkIn as string) || getTodayLocal()}
            onChange={(e) => setFormData(prev => ({ ...prev, checkOut: e.target.value }))}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="adults">Adults</Label>
          <Input
            id="adults"
            type="number"
            min="1"
            max="10"
            value={formData.adults as number}
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
            value={formData.children as number}
            onChange={(e) => setFormData(prev => ({ ...prev, children: parseInt(e.target.value) || 0 }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="roomRate">Rate/Night</Label>
          <Input
            id="roomRate"
            type="number"
            min="0"
            step="0.01"
            value={formData.roomRate as string}
            onChange={(e) => setFormData(prev => ({ ...prev, roomRate: e.target.value }))}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="source">Source</Label>
          <Select 
            value={formData.source as string} 
            onValueChange={(value) => setFormData(prev => ({ ...prev, source: value }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sources.map(source => (
                <SelectItem key={source.value} value={source.value}>
                  {source.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
              {bookingStatuses.filter(s => s.value === 'confirmed' || s.value === 'draft').map(status => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="specialRequests">Special Requests</Label>
        <Textarea
          id="specialRequests"
          value={formData.specialRequests as string}
          onChange={(e) => setFormData(prev => ({ ...prev, specialRequests: e.target.value }))}
          placeholder="Early check-in, late check-out, room preferences..."
          rows={2}
        />
      </div>

      {selectedRoomType && formData.checkIn && formData.checkOut && (
        <Card className="p-4 bg-muted/50">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Estimated Total:</span>
            <span className="text-lg font-bold">
              {formatCurrency((selectedRoomType.basePrice) * 
                Math.ceil((new Date(formData.checkOut as string).getTime() - new Date(formData.checkIn as string).getTime()) / (1000 * 60 * 60 * 24))
              ).toLocaleString()}
            </span>
          </div>
        </Card>
      )}
    </div>
  );
}
