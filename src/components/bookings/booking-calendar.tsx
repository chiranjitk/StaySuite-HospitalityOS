'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useTimezone } from '@/contexts/TimezoneContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Loader2,
  LogIn,
  LogOut,
  User,
  Hash,
  Building2,
  GripHorizontal,
  CheckCircle,
  AlertCircle,
  Clock,
  BedDouble,
  Plus,
  MoreHorizontal,
  Filter,
  Eye,
  Edit,
  Trash2,
  X,
  LayoutGrid,
  List,
  Columns,
  Download,
  Printer,
  RefreshCw,
  AlertTriangle,
  DollarSign,
  Users,
  Bed,
  Move,
  Copy,
  ArrowRightLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, addMonths, subMonths, addDays, addWeeks, subWeeks, differenceInDays, startOfWeek, endOfWeek, isWithinInterval, parseISO, isSameWeek, getWeek, eachWeekOfInterval } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface Property {
  id: string;
  name: string;
}

interface Guest {
  id: string;
  firstName: string;
  lastName: string;
  isVip: boolean;
  email?: string;
  phone?: string;
}

interface Room {
  id: string;
  number: string;
  roomTypeId: string;
  status: string;
  floor?: number;
}

interface RoomType {
  id: string;
  name: string;
  code: string;
  basePrice: number;
  totalRooms?: number;
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
  roomRate?: number;
  roomTypeId?: string;
  primaryGuestId?: string;
  guestId?: string;
  primaryGuest: Guest;
  room?: Room;
  roomType: RoomType;
  property?: { id: string; name: string };
  notes?: string;
  specialRequests?: string;
}

interface Availability {
  date: string;
  available: number;
  total: number;
  roomTypeId: string;
}

interface DayMetrics {
  date: Date;
  occupancy: number;
  revenue: number;
  arrivals: number;
  departures: number;
  totalRooms: number;
  occupiedRooms: number;
}

const bookingStatuses: Record<string, { label: string; color: string; bgClass: string }> = {
  draft: { label: 'Draft', color: 'bg-gray-500', bgClass: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  confirmed: { label: 'Confirmed', color: 'bg-emerald-500', bgClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  checked_in: { label: 'Checked In', color: 'bg-teal-500', bgClass: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' },
  checked_out: { label: 'Checked Out', color: 'bg-cyan-500', bgClass: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400' },
  cancelled: { label: 'Cancelled', color: 'bg-red-500', bgClass: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  no_show: { label: 'No Show', color: 'bg-orange-500', bgClass: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
};

const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const weekDaysShort = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

type CalendarView = 'month' | 'week' | 'timeline';

export function BookingCalendar() {
  const { toast } = useToast();
  const { formatCurrency, currency } = useCurrency();
  const { formatDate, formatDateTime } = useTimezone();
  
  // Data state
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Calendar state
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>('month');
  const [propertyFilter, setPropertyFilter] = useState<string>('all');
  const [roomTypeFilter, setRoomTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  
  // Selection & Bulk operations
  const [selectedBookings, setSelectedBookings] = useState<Set<string>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);
  
  // Drag-drop state for creating/moving bookings
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartDate, setDragStartDate] = useState<Date | null>(null);
  const [dragEndDate, setDragEndDate] = useState<Date | null>(null);
  const [dragRoomType, setDragRoomType] = useState<string | null>(null);
  const [dragBooking, setDragBooking] = useState<Booking | null>(null);
  const [dragMode, setDragMode] = useState<'create' | 'move' | 'resize'>('create');
  
  // Dialogs
  const [isQuickBookOpen, setIsQuickBookOpen] = useState(false);
  const [isBookingDetailOpen, setIsBookingDetailOpen] = useState(false);
  const [isBulkActionOpen, setIsBulkActionOpen] = useState(false);
  const [quickBookData, setQuickBookData] = useState({
    propertyId: '',
    roomTypeId: '',
    guestId: '',
    checkIn: '',
    checkOut: '',
    adults: 1,
    children: 0,
    roomRate: 0,
  });
  const [isSaving, setIsSaving] = useState(false);
  
  // Show filters panel
  const [showFilters, setShowFilters] = useState(false);

  // Fetch properties
  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const response = await fetch('/api/properties');
        const result = await response.json();
        if (result.success) {
          setProperties(result.data);
          if (result.data.length > 0) {
            setPropertyFilter(result.data[0].id);
            setQuickBookData(prev => ({ ...prev, propertyId: result.data[0].id }));
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
      if (!propertyFilter || propertyFilter === 'all') return;
      try {
        const response = await fetch(`/api/room-types?propertyId=${propertyFilter}`);
        const result = await response.json();
        if (result.success) {
          setRoomTypes(result.data);
          // Also fetch rooms
          const roomsResponse = await fetch(`/api/rooms?propertyId=${propertyFilter}`);
          const roomsResult = await roomsResponse.json();
          if (roomsResult.success) {
            setRooms(roomsResult.data || []);
          }
          if (result.data.length > 0) {
            setQuickBookData(prev => ({ 
              ...prev, 
              propertyId: propertyFilter, // Update propertyId when property filter changes
              roomTypeId: result.data[0].id,
              roomRate: result.data[0].basePrice 
            }));
          }
        }
      } catch (error) {
        console.error('Error fetching room types:', error);
      }
    };
    fetchRoomTypes();
  }, [propertyFilter]);

  // Fetch guests
  useEffect(() => {
    const fetchGuests = async () => {
      try {
        const response = await fetch('/api/guests?limit=100');
        const result = await response.json();
        if (result.success) {
          setGuests(result.data);
          // Only set guestId if not already set
          setQuickBookData(prev => {
            if (!prev.guestId && result.data.length > 0) {
              return { ...prev, guestId: result.data[0].id };
            }
            return prev;
          });
        }
      } catch (error) {
        console.error('Error fetching guests:', error);
      }
    };
    fetchGuests();
  }, []);

  // Fetch bookings and availability
  const fetchData = useCallback(async () => {
    if (propertyFilter === 'all') return;
    
    setIsLoading(true);
    try {
      let startDate: Date, endDate: Date;
      
      if (view === 'month') {
        startDate = startOfMonth(currentDate);
        endDate = endOfMonth(currentDate);
      } else if (view === 'week') {
        startDate = startOfWeek(currentDate);
        endDate = endOfWeek(currentDate);
      } else {
        // Timeline view - show 2 weeks
        startDate = startOfWeek(currentDate);
        endDate = endOfWeek(addWeeks(currentDate, 1));
      }
      
      const bufferStart = subMonths(startDate, 1);
      const bufferEnd = addMonths(endDate, 1);

      // Fetch bookings
      const bookingsParams = new URLSearchParams();
      bookingsParams.append('checkInFrom', bufferStart.toISOString());
      bookingsParams.append('checkInTo', bufferEnd.toISOString());
      bookingsParams.append('propertyId', propertyFilter);
      if (roomTypeFilter !== 'all') {
        bookingsParams.append('roomTypeId', roomTypeFilter);
      }
      if (statusFilter !== 'all') {
        bookingsParams.append('status', statusFilter);
      }

      const bookingsResponse = await fetch(`/api/bookings?${bookingsParams.toString()}`);
      const bookingsResult = await bookingsResponse.json();

      if (bookingsResult.success) {
        setBookings(bookingsResult.data);
      }

      // Fetch availability
      const availabilityParams = new URLSearchParams();
      availabilityParams.append('propertyId', propertyFilter);
      availabilityParams.append('startDate', startDate.toISOString());
      availabilityParams.append('endDate', endDate.toISOString());

      try {
        const availabilityResponse = await fetch(`/api/availability?${availabilityParams.toString()}`);
        const availabilityResult = await availabilityResponse.json();
        if (availabilityResult.success) {
          setAvailability(availabilityResult.data || []);
        }
      } catch (e) {
        if (process.env.NODE_ENV !== 'production') { console.log('Availability API not available, using booking data'); }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentDate, propertyFilter, roomTypeFilter, statusFilter, view]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Calculate day metrics
  const getDayMetrics = useCallback((day: Date): DayMetrics => {
    const dayBookings = bookings.filter(b => {
      const checkIn = new Date(b.checkIn);
      const checkOut = new Date(b.checkOut);
      return day >= checkIn && day < checkOut && b.status !== 'cancelled';
    });
    
    const arrivals = bookings.filter(b => isSameDay(new Date(b.checkIn), day) && b.status !== 'cancelled');
    const departures = bookings.filter(b => isSameDay(new Date(b.checkOut), day) && b.status !== 'cancelled');
    
    const totalRooms = roomTypes.reduce((sum, rt) => sum + (rt.totalRooms || rooms.filter(r => r.roomTypeId === rt.id).length), 0);
    const occupiedRooms = dayBookings.length;
    const occupancy = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;
    const revenue = dayBookings.reduce((sum, b) => sum + (b.roomRate || b.totalAmount / Math.max(1, differenceInDays(new Date(b.checkOut), new Date(b.checkIn)))), 0);
    
    return {
      date: day,
      occupancy,
      revenue,
      arrivals: arrivals.length,
      departures: departures.length,
      totalRooms,
      occupiedRooms,
    };
  }, [bookings, roomTypes, rooms]);

  // Generate calendar days based on view
  const calendarDays = useMemo(() => {
    if (view === 'month') {
      const start = startOfWeek(startOfMonth(currentDate));
      const end = endOfWeek(endOfMonth(currentDate));
      return eachDayOfInterval({ start, end });
    } else if (view === 'week') {
      const start = startOfWeek(currentDate);
      const end = endOfWeek(currentDate);
      return eachDayOfInterval({ start, end });
    } else {
      // Timeline view
      const start = startOfWeek(currentDate);
      const end = endOfWeek(addWeeks(currentDate, 1));
      return eachDayOfInterval({ start, end });
    }
  }, [currentDate, view]);

  // Filter bookings
  const filteredBookings = useMemo(() => {
    return bookings.filter(booking => {
      if (roomTypeFilter !== 'all' && booking.roomTypeId !== roomTypeFilter) return false;
      if (statusFilter !== 'all' && booking.status !== statusFilter) return false;
      return true;
    });
  }, [bookings, roomTypeFilter, statusFilter]);

  // Get bookings for a specific day
  const getBookingsForDay = (day: Date) => {
    return filteredBookings.filter(booking => {
      const checkIn = new Date(booking.checkIn);
      const checkOut = new Date(booking.checkOut);
      return day >= checkIn && day < checkOut;
    });
  };

  // Get availability for a specific day and room type
  const getAvailabilityForDay = (day: Date, roomTypeId?: string) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const dayAvailability = availability.filter(a => a.date === dateStr);
    
    if (roomTypeId) {
      const roomTypeAvail = dayAvailability.find(a => a.roomTypeId === roomTypeId);
      return roomTypeAvail ? { available: roomTypeAvail.available, total: roomTypeAvail.total } : null;
    }
    
    return dayAvailability.reduce((acc, a) => ({
      available: acc.available + a.available,
      total: acc.total + a.total,
    }), { available: 0, total: 0 });
  };

  // Get arrivals/departures for a specific day
  const getArrivalsForDay = (day: Date) => {
    return filteredBookings.filter(booking => isSameDay(new Date(booking.checkIn), day));
  };

  const getDeparturesForDay = (day: Date) => {
    return filteredBookings.filter(booking => isSameDay(new Date(booking.checkOut), day));
  };

  // Check for conflicts
  const hasConflict = (booking: Booking) => {
    if (!booking.room) return false;
    const checkIn = new Date(booking.checkIn);
    const checkOut = new Date(booking.checkOut);
    
    return bookings.some(b => {
      if (b.id === booking.id || b.status === 'cancelled' || !b.room) return false;
      if (b.room.id !== booking.room?.id) return false;
      
      const bCheckIn = new Date(b.checkIn);
      const bCheckOut = new Date(b.checkOut);
      
      return (checkIn < bCheckOut && checkOut > bCheckIn);
    });
  };

  // Navigation
  const goToPrevious = () => {
    if (view === 'month') setCurrentDate(subMonths(currentDate, 1));
    else setCurrentDate(subWeeks(currentDate, 1));
  };
  
  const goToNext = () => {
    if (view === 'month') setCurrentDate(addMonths(currentDate, 1));
    else setCurrentDate(addWeeks(currentDate, 1));
  };
  
  const goToToday = () => setCurrentDate(new Date());

  // Drag handlers for creating/moving/resizing bookings
  const handleDragStart = (day: Date, roomTypeId?: string, booking?: Booking, mode?: 'create' | 'move' | 'resize') => {
    if (mode === 'move' && booking) {
      // Move mode: drag an existing booking to a new date range
      setIsDragging(true);
      setDragBooking(booking);
      setDragRoomType(booking.roomTypeId ?? null);
      const duration = differenceInDays(new Date(booking.checkOut), new Date(booking.checkIn));
      setDragStartDate(day);
      setDragEndDate(addDays(day, duration - 1));
      setDragMode('move');
    } else if (mode === 'resize' && booking) {
      // Resize mode: drag the bottom edge to change check-out
      setIsDragging(true);
      setDragBooking(booking);
      setDragRoomType(booking.roomTypeId ?? null);
      setDragStartDate(new Date(booking.checkIn));
      setDragEndDate(day);
      setDragMode('resize');
    } else if (roomTypeId) {
      // Create mode: drag on empty cells to create new booking
      setIsDragging(true);
      setDragStartDate(day);
      setDragEndDate(day);
      setDragRoomType(roomTypeId);
      setDragBooking(null);
      setDragMode('create');
    }
  };

  const handleDragOver = (day: Date) => {
    if (!isDragging || !dragStartDate) return;

    if (dragMode === 'move' && dragBooking) {
      // Move: shift both start and end by the same delta
      const duration = differenceInDays(dragEndDate || dragStartDate, dragStartDate);
      setDragStartDate(day);
      setDragEndDate(addDays(day, duration));
    } else if (dragMode === 'resize' && dragBooking) {
      // Resize: only change the end date (must stay after start)
      if (day > dragStartDate) {
        setDragEndDate(day);
      }
    } else {
      // Create: extend selection
      if (day < dragStartDate) {
        setDragStartDate(day);
      }
      setDragEndDate(day);
    }
  };

  const handleDragEnd = async () => {
    if (!isDragging || !dragStartDate || !dragEndDate) {
      clearDragState();
      return;
    }

    const earliest = dragStartDate < dragEndDate ? dragStartDate : dragEndDate;
    const latest = dragStartDate < dragEndDate ? dragEndDate : dragStartDate;

    if (dragMode === 'move' && dragBooking) {
      // Execute move: update checkIn/checkOut dates
      const newCheckIn = earliest;
      const newCheckOut = addDays(latest, 1);
      setIsSaving(true);
      try {
        const response = await fetch(`/api/bookings/${dragBooking.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            checkIn: newCheckIn.toISOString(),
            checkOut: newCheckOut.toISOString(),
          }),
        });
        const result = await response.json();
        if (result.success) {
          toast({
            title: 'Success',
            description: `Booking ${dragBooking.confirmationCode} moved to ${format(newCheckIn, 'MMM d')} - ${format(newCheckOut, 'MMM d')}`,
          });
          fetchData();
        } else {
          toast({
            title: 'Error',
            description: result.error?.message || 'Failed to move booking',
            variant: 'destructive',
          });
        }
      } catch (error) {
        console.error('Error moving booking:', error);
        toast({
          title: 'Error',
          description: 'Failed to move booking',
          variant: 'destructive',
        });
      } finally {
        setIsSaving(false);
      }
    } else if (dragMode === 'resize' && dragBooking) {
      // Execute resize: update checkOut date
      const newCheckOut = addDays(latest, 1);
      setIsSaving(true);
      try {
        const response = await fetch(`/api/bookings/${dragBooking.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            checkOut: newCheckOut.toISOString(),
          }),
        });
        const result = await response.json();
        if (result.success) {
          toast({
            title: 'Success',
            description: `Booking ${dragBooking.confirmationCode} extended to ${format(newCheckOut, 'MMM d')}`,
          });
          fetchData();
        } else {
          toast({
            title: 'Error',
            description: result.error?.message || 'Failed to resize booking',
            variant: 'destructive',
          });
        }
      } catch (error) {
        console.error('Error resizing booking:', error);
        toast({
          title: 'Error',
          description: 'Failed to resize booking',
          variant: 'destructive',
        });
      } finally {
        setIsSaving(false);
      }
    } else if (dragRoomType) {
      // Create mode: open quick book dialog
      const checkIn = earliest;
      const checkOut = addDays(latest, 1);
      const selectedRoomType = roomTypes.find(rt => rt.id === dragRoomType);

      setQuickBookData(prev => ({
        ...prev,
        propertyId: propertyFilter || prev.propertyId,
        roomTypeId: dragRoomType,
        roomRate: selectedRoomType?.basePrice || 0,
        checkIn: format(checkIn, 'yyyy-MM-dd'),
        checkOut: format(checkOut, 'yyyy-MM-dd'),
      }));
      setIsQuickBookOpen(true);
    }

    clearDragState();
  };

  const clearDragState = () => {
    setIsDragging(false);
    setDragStartDate(null);
    setDragEndDate(null);
    setDragRoomType(null);
    setDragBooking(null);
    setDragMode('create');
  };

  // Create quick booking
  const handleQuickBook = async () => {
    // Use propertyFilter as fallback for propertyId
    const bookingPropertyId = quickBookData.propertyId || propertyFilter;
    const bookingRoomTypeId = quickBookData.roomTypeId || (roomTypes[0]?.id || '');
    const bookingGuestId = quickBookData.guestId || (guests[0]?.id || '');
    
    // Debug: Log all the values
    if (process.env.NODE_ENV !== 'production') { console.log('Quick Book Debug:', {
      'quickBookData.propertyId': quickBookData.propertyId,
      'propertyFilter': propertyFilter,
      'bookingPropertyId': bookingPropertyId,
      'quickBookData.roomTypeId': quickBookData.roomTypeId,
      'roomTypes.length': roomTypes.length,
      'roomTypes[0]?.id': roomTypes[0]?.id,
      'bookingRoomTypeId': bookingRoomTypeId,
      'quickBookData.guestId': quickBookData.guestId,
      'guests.length': guests.length,
      'guests[0]?.id': guests[0]?.id,
      'bookingGuestId': bookingGuestId,
      'quickBookData.checkIn': quickBookData.checkIn,
      'quickBookData.checkOut': quickBookData.checkOut,
    }); }
    
    // Check each field individually
    const missingFields: string[] = [];
    if (!bookingPropertyId) missingFields.push('Property');
    if (!bookingRoomTypeId) missingFields.push('Room Type');
    if (!bookingGuestId) missingFields.push('Guest');
    if (!quickBookData.checkIn) missingFields.push('Check-in Date');
    if (!quickBookData.checkOut) missingFields.push('Check-out Date');
    
    if (missingFields.length > 0) {
      toast({
        title: 'Validation Error',
        description: `Please fill in: ${missingFields.join(', ')}`,
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const checkInDate = new Date(quickBookData.checkIn);
      const checkOutDate = new Date(quickBookData.checkOut);
      const nights = differenceInDays(checkOutDate, checkInDate);
      const roomRate = quickBookData.roomRate || roomTypes.find(rt => rt.id === bookingRoomTypeId)?.basePrice || 0;
      const totalAmount = roomRate * nights;

      const requestBody = {
        propertyId: bookingPropertyId,
        roomTypeId: bookingRoomTypeId,
        primaryGuestId: bookingGuestId,
        checkIn: checkInDate.toISOString(),
        checkOut: checkOutDate.toISOString(),
        adults: quickBookData.adults || 1,
        children: quickBookData.children || 0,
        roomRate,
        totalAmount,
        status: 'confirmed',
        source: 'direct',
      };
      
      if (process.env.NODE_ENV !== 'production') { console.log('Request body:', requestBody); }

      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Booking created successfully',
        });
        setIsQuickBookOpen(false);
        fetchData();
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

  // Bulk operations
  const handleBulkStatusChange = async (newStatus: string) => {
    if (selectedBookings.size === 0) return;
    
    setIsSaving(true);
    try {
      const updates = Array.from(selectedBookings).map(id =>
        fetch(`/api/bookings/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        })
      );
      
      await Promise.all(updates);
      
      toast({
        title: 'Success',
        description: `Updated ${selectedBookings.size} booking(s) to ${newStatus}`,
      });
      
      setSelectedBookings(new Set());
      setIsSelectMode(false);
      fetchData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update bookings',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedBookings.size === 0) return;
    
    setIsSaving(true);
    try {
      const deletes = Array.from(selectedBookings).map(id =>
        fetch(`/api/bookings/${id}`, { method: 'DELETE' })
      );
      
      await Promise.all(deletes);
      
      toast({
        title: 'Success',
        description: `Deleted ${selectedBookings.size} booking(s)`,
      });
      
      setSelectedBookings(new Set());
      setIsSelectMode(false);
      fetchData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete bookings',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle booking selection
  const toggleBookingSelection = (bookingId: string) => {
    const newSet = new Set(selectedBookings);
    if (newSet.has(bookingId)) {
      newSet.delete(bookingId);
    } else {
      newSet.add(bookingId);
    }
    setSelectedBookings(newSet);
  };

  // Select all visible bookings
  const selectAllVisible = () => {
    setSelectedBookings(new Set(filteredBookings.map(b => b.id)));
  };

  // Day details
  const dayBookings = selectedDate ? getBookingsForDay(selectedDate) : [];
  const dayArrivals = selectedDate ? getArrivalsForDay(selectedDate) : [];
  const dayDepartures = selectedDate ? getDeparturesForDay(selectedDate) : [];
  const dayMetrics = selectedDate ? getDayMetrics(selectedDate) : null;

  // Export calendar data
  const handleExport = (exportFormat: 'csv' | 'pdf') => {
    if (filteredBookings.length === 0) {
      toast({
        title: 'No Data',
        description: 'No bookings to export for the current view.',
        variant: 'destructive',
      });
      return;
    }

    if (exportFormat === 'csv') {
      // Generate CSV content
      const headers = ['Confirmation Code', 'Guest', 'Room', 'Check-In', 'Check-Out', 'Status', 'Total'];
      const rows = filteredBookings.map(booking => {
        const guestName = `${booking.primaryGuest?.firstName || ''} ${booking.primaryGuest?.lastName || ''}`.trim();
        const roomName = booking.room?.number || booking.roomType?.name || 'N/A';
        const checkIn = new Date(booking.checkIn).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
        const checkOut = new Date(booking.checkOut).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
        const status = bookingStatuses[booking.status]?.label || booking.status;
        const total = booking.totalAmount?.toFixed(2) || '0.00';
        return [booking.confirmationCode, guestName, roomName, checkIn, checkOut, status, total]
          .map(field => `"${String(field).replace(/"/g, '""')}"`)
          .join(',');
      });

      const csvContent = [headers.join(','), ...rows].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `bookings-export-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: 'Export Complete',
        description: `Exported ${filteredBookings.length} bookings as CSV`,
      });
    } else {
      // PDF - trigger print view
      toast({
        title: 'Print View',
        description: 'Opening print dialog...',
      });
      window.print();
    }
  };

  // Render month/week view
  const renderCalendarGrid = () => (
    <div className="grid grid-cols-7">
      {calendarDays.map((day) => {
        const isCurrentMonth = view === 'month' ? format(day, 'M') === format(currentDate, 'M') : true;
        const dayBookings = getBookingsForDay(day);
        const arrivals = getArrivalsForDay(day);
        const departures = getDeparturesForDay(day);
        const metrics = getDayMetrics(day);
        const dayAvail = getAvailabilityForDay(day);
        const availPercent = dayAvail && dayAvail.total > 0 
          ? (dayAvail.available / dayAvail.total) * 100 
          : 100;

        const isInDragSelection = isDragging && dragStartDate && dragEndDate &&
          isWithinInterval(day, {
            start: dragStartDate < dragEndDate ? dragStartDate : dragEndDate,
            end: dragStartDate < dragEndDate ? dragEndDate : dragStartDate,
          });

        return (
          <div
            key={day.toISOString()}
            className={cn(
              'min-h-24 p-1 border-r last:border-r-0 border-b cursor-pointer transition-all',
              !isCurrentMonth && 'bg-muted/30',
              isToday(day) && 'bg-primary/5',
              isInDragSelection && 'bg-primary/20 border-2 border-primary border-dashed',
              'hover:bg-muted/50'
            )}
            onClick={() => setSelectedDate(day)}
            onMouseDown={() => handleDragStart(day)}
            onMouseEnter={() => handleDragOver(day)}
            onMouseUp={handleDragEnd}
            onMouseLeave={() => isDragging && handleDragOver(day)}
          >
            {/* Date header */}
            <div className="flex items-center justify-between mb-1">
              <div className={cn(
                'text-sm p-1 rounded-sm w-7 h-7 flex items-center justify-center',
                isToday(day) && 'bg-primary text-primary-foreground font-semibold',
                !isCurrentMonth && 'text-muted-foreground'
              )}>
                {view === 'week' ? format(day, 'd MMM') : format(day, 'd')}
              </div>
              
              {/* Metrics indicators */}
              {isCurrentMonth && (
                <div className="flex items-center gap-1">
                  {metrics.occupancy >= 90 && (
                    <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800">
                      {metrics.occupancy}%
                    </Badge>
                  )}
                  {metrics.revenue > 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      {formatCurrency(metrics.revenue)}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Occupancy bar */}
            {isCurrentMonth && view === 'week' && (
              <div className="mb-1">
                <Progress value={metrics.occupancy} className="h-1" />
              </div>
            )}

            {/* Bookings */}
            {isCurrentMonth && (
              <div className="space-y-1">
                {dayBookings.slice(0, view === 'week' ? 5 : 3).map(booking => {
                  const isArrival = arrivals.includes(booking);
                  const isDeparture = departures.includes(booking);
                  const conflict = hasConflict(booking);
                  
                  return (
                    <div
                      key={booking.id}
                      className={cn(
                        'text-xs px-1 py-0.5 rounded truncate cursor-pointer flex items-center gap-1',
                        bookingStatuses[booking.status]?.bgClass || 'bg-gray-100',
                        isArrival && 'border-l-2 border-emerald-500',
                        isDeparture && 'border-r-2 border-amber-500',
                        conflict && 'ring-2 ring-red-500',
                        selectedBookings.has(booking.id) && 'ring-2 ring-primary'
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isSelectMode) {
                          toggleBookingSelection(booking.id);
                        } else {
                          setSelectedBooking(booking);
                          setIsBookingDetailOpen(true);
                        }
                      }}
                      title={`${booking.primaryGuest.firstName} ${booking.primaryGuest.lastName} - ${booking.confirmationCode}${conflict ? ' (CONFLICT)' : ''}`}
                    >
                      {isArrival && <LogIn className="h-2.5 w-2.5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />}
                      {isDeparture && <LogOut className="h-2.5 w-2.5 flex-shrink-0 text-amber-600 dark:text-amber-400" />}
                      {conflict && <AlertTriangle className="h-2.5 w-2.5 flex-shrink-0 text-red-600 dark:text-red-400" />}
                      <span className="truncate">
                        {booking.primaryGuest.firstName} {booking.primaryGuest.lastName[0]}.
                      </span>
                    </div>
                  );
                })}
                {dayBookings.length > (view === 'week' ? 5 : 3) && (
                  <div className="text-xs text-muted-foreground px-1">
                    +{dayBookings.length - (view === 'week' ? 5 : 3)} more
                  </div>
                )}
              </div>
            )}

            {/* Arrival/Departure indicators */}
            {isCurrentMonth && (arrivals.length > 0 || departures.length > 0) && dayBookings.length === 0 && (
              <div className="flex gap-1 mt-1">
                {arrivals.length > 0 && (
                  <div className="flex items-center text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/20 px-1 rounded">
                    <LogIn className="h-3 w-3 mr-0.5" />
                    {arrivals.length}
                  </div>
                )}
                {departures.length > 0 && (
                  <div className="flex items-center text-xs text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/20 px-1 rounded">
                    <LogOut className="h-3 w-3 mr-0.5" />
                    {departures.length}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  // Render timeline view (by room type)
  const renderTimelineView = () => {
    const filteredRoomTypes = roomTypeFilter === 'all' ? roomTypes : roomTypes.filter(rt => rt.id === roomTypeFilter);
    
    return (
      <div className="overflow-x-auto">
        <div className="min-w-[800px]">
          {/* Header with dates */}
          <div className="grid border-b bg-muted/50 sticky top-0" style={{ gridTemplateColumns: `150px repeat(${calendarDays.length}, minmax(40px, 1fr))` }}>
            <div className="p-2 font-medium border-r">Room Type</div>
            {calendarDays.map((day) => (
              <div
                key={day.toISOString()}
                className={cn(
                  'p-2 text-center border-r last:border-r-0 text-sm',
                  isToday(day) && 'bg-primary/10 font-semibold'
                )}
              >
                <div className="text-xs text-muted-foreground">{format(day, 'EEE')}</div>
                <div>{format(day, 'd')}</div>
              </div>
            ))}
          </div>
          
          {/* Room type rows */}
          {filteredRoomTypes.map(roomType => {
            const rtRooms = rooms.filter(r => r.roomTypeId === roomType.id);
            const totalRooms = roomType.totalRooms || rtRooms.length;
            
            return (
              <div key={roomType.id} className="grid border-b hover:bg-muted/20" style={{ gridTemplateColumns: `150px repeat(${calendarDays.length}, minmax(40px, 1fr))` }}>
                <div className="p-2 border-r bg-muted/30">
                  <div className="font-medium text-sm">{roomType.name}</div>
                  <div className="text-xs text-muted-foreground">{totalRooms} rooms</div>
                </div>
                
                {calendarDays.map((day) => {
                  const dayBookings = filteredBookings.filter(b => {
                    if (b.roomTypeId !== roomType.id) return false;
                    const checkIn = new Date(b.checkIn);
                    const checkOut = new Date(b.checkOut);
                    return day >= checkIn && day < checkOut;
                  });
                  
                  const isStart = filteredBookings.some(b => b.roomTypeId === roomType.id && isSameDay(new Date(b.checkIn), day));
                  const isEnd = filteredBookings.some(b => b.roomTypeId === roomType.id && isSameDay(new Date(b.checkOut), day));
                  
                  const avail = getAvailabilityForDay(day, roomType.id);
                  const availPercent = avail ? (avail.available / avail.total) * 100 : 100;
                  
                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        'p-1 border-r last:border-r-0 min-h-16 relative',
                        isToday(day) && 'bg-primary/5'
                      )}
                      onMouseDown={() => handleDragStart(day, roomType.id)}
                      onMouseEnter={() => handleDragOver(day)}
                      onMouseUp={handleDragEnd}
                    >
                      {/* Occupancy indicator */}
                      <div className="absolute inset-0 flex items-end">
                        <div 
                          className={cn(
                            "w-full h-1",
                            availPercent < 20 ? "bg-red-500" : 
                            availPercent < 50 ? "bg-amber-500" : 
                            availPercent < 80 ? "bg-emerald-500" : "bg-muted"
                          )}
                        />
                      </div>
                      
                      {/* Bookings */}
                      <div className="relative z-10">
                        {dayBookings.slice(0, 2).map(booking => (
                          <div
                            key={booking.id}
                            className={cn(
                              'text-[10px] px-1 py-0.5 rounded truncate cursor-pointer mb-0.5',
                              bookingStatuses[booking.status]?.bgClass,
                              isStart && isSameDay(new Date(booking.checkIn), day) && 'font-semibold',
                              selectedBookings.has(booking.id) && 'ring-1 ring-primary'
                            )}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isSelectMode) {
                                toggleBookingSelection(booking.id);
                              } else {
                                setSelectedBooking(booking);
                                setIsBookingDetailOpen(true);
                              }
                            }}
                          >
                            {booking.primaryGuest.firstName[0]}. {booking.primaryGuest.lastName[0]}
                          </div>
                        ))}
                        {dayBookings.length > 2 && (
                          <div className="text-[10px] text-muted-foreground px-1">
                            +{dayBookings.length - 2}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Booking Calendar
          </h2>
          <p className="text-sm text-muted-foreground">
            Drag to create bookings &bull; Drag bookings to move &bull; Drag bottom edge to resize
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {/* View Switcher */}
          <div className="flex items-center border rounded-lg p-1">
            <Button
              variant={view === 'month' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setView('month')}
              className="gap-1"
            >
              <LayoutGrid className="h-4 w-4" />
              <span className="hidden sm:inline">Month</span>
            </Button>
            <Button
              variant={view === 'week' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setView('week')}
              className="gap-1"
            >
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">Week</span>
            </Button>
            <Button
              variant={view === 'timeline' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setView('timeline')}
              className="gap-1"
            >
              <Columns className="h-4 w-4" />
              <span className="hidden sm:inline">Timeline</span>
            </Button>
          </div>
          
          {/* Actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsSelectMode(!isSelectMode)}>
                <Checkbox className="mr-2 h-4 w-4" />
                {isSelectMode ? 'Exit Selection' : 'Bulk Select'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowFilters(!showFilters)}>
                <Filter className="mr-2 h-4 w-4" />
                {showFilters ? 'Hide Filters' : 'Show Filters'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleExport('csv')}>
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('pdf')}>
                <Printer className="mr-2 h-4 w-4" />
                Print View
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {isSelectMode && (
        <Card className="border-primary">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium">
                  {selectedBookings.size} selected
                </span>
                <Button variant="outline" size="sm" onClick={selectAllVisible}>
                  Select All
                </Button>
                <Button variant="outline" size="sm" onClick={() => setSelectedBookings(new Set())}>
                  Clear
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Select onValueChange={handleBulkStatusChange}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Change Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="checked_in">Checked In</SelectItem>
                    <SelectItem value="checked_out">Checked Out</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
                <Button variant="outline" size="sm" onClick={() => setIsSelectMode(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters Panel */}
      {showFilters && (
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Property</Label>
                <Select value={propertyFilter} onValueChange={setPropertyFilter}>
                  <SelectTrigger>
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
              <div className="space-y-2">
                <Label>Room Type</Label>
                <Select value={roomTypeFilter} onValueChange={setRoomTypeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Room Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Room Types</SelectItem>
                    {roomTypes.map(rt => (
                      <SelectItem key={rt.id} value={rt.id}>
                        {rt.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {Object.entries(bookingStatuses).map(([key, { label }]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>&nbsp;</Label>
                <Button variant="outline" className="w-full" onClick={fetchData}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={goToPrevious}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={goToToday}>
                Today
              </Button>
              <Button variant="outline" size="icon" onClick={goToNext}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <span className="text-lg font-semibold ml-2">
                {view === 'month' 
                  ? format(currentDate, 'MMMM yyyy')
                  : `Week ${getWeek(currentDate)}, ${format(currentDate, 'yyyy')}`
                }
              </span>
            </div>
            <div className="flex items-center gap-2">
              {!isSelectMode && (
                <Button onClick={() => {
                  // Set default dates when opening from button
                  const today = new Date();
                  const tomorrow = addDays(today, 1);
                  setQuickBookData(prev => ({
                    ...prev,
                    propertyId: propertyFilter || prev.propertyId,
                    roomTypeId: prev.roomTypeId || roomTypes[0]?.id || '',
                    guestId: prev.guestId || guests[0]?.id || '',
                    roomRate: prev.roomRate || roomTypes[0]?.basePrice || 0,
                    checkIn: prev.checkIn || format(today, 'yyyy-MM-dd'),
                    checkOut: prev.checkOut || format(tomorrow, 'yyyy-MM-dd'),
                  }));
                  setIsQuickBookOpen(true);
                }}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Booking
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
        {roomTypes.slice(0, 4).map(roomType => {
          const todayAvail = getAvailabilityForDay(new Date(), roomType.id);
          const percentAvailable = todayAvail ? (todayAvail.available / todayAvail.total) * 100 : 100;
          
          return (
            <Card key={roomType.id} className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium truncate">{roomType.name}</span>
                {percentAvailable < 20 ? (
                  <AlertCircle className="h-4 w-4 text-red-500 dark:text-red-400" />
                ) : percentAvailable < 50 ? (
                  <Clock className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                ) : (
                  <CheckCircle className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
                )}
              </div>
              <div className="text-2xl font-bold">
                {todayAvail?.available ?? '-'}<span className="text-sm font-normal text-muted-foreground">/{todayAvail?.total ?? '-'}</span>
              </div>
              <div className="text-xs text-muted-foreground">Available Today</div>
              <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full rounded-full transition-all",
                    percentAvailable < 20 ? "bg-red-500" : percentAvailable < 50 ? "bg-amber-500" : "bg-emerald-500"
                  )}
                  style={{ width: `${percentAvailable}%` }}
                />
              </div>
            </Card>
          );
        })}
        
        {/* Today's metrics */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Today</span>
            <LogIn className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-bold">{getArrivalsForDay(new Date()).length}</div>
          <div className="text-xs text-muted-foreground">Arrivals</div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Today</span>
            <LogOut className="h-4 w-4 text-amber-500 dark:text-amber-400" />
          </div>
          <div className="text-2xl font-bold">{getDeparturesForDay(new Date()).length}</div>
          <div className="text-xs text-muted-foreground">Departures</div>
        </Card>
      </div>

      {/* Calendar Grid */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Week day headers */}
              <div className="grid grid-cols-7 border-b bg-muted/50">
                {weekDays.map(day => (
                  <div
                    key={day}
                    className="p-3 text-center text-sm font-medium text-muted-foreground border-r last:border-r-0"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar content */}
              {view === 'timeline' ? renderTimelineView() : renderCalendarGrid()}
            </>
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex flex-wrap gap-4">
        {Object.entries(bookingStatuses).map(([key, { label, bgClass }]) => (
          <div key={key} className="flex items-center gap-2">
            <div className={cn('w-3 h-3 rounded', bgClass)} />
            <span className="text-sm text-muted-foreground">{label}</span>
          </div>
        ))}
        <Separator orientation="vertical" className="h-4" />
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded border-l-2 border-emerald-500 bg-emerald-100 dark:bg-emerald-800" />
          <span className="text-sm text-muted-foreground">Arrival</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded border-r-2 border-amber-500 bg-amber-100 dark:bg-amber-800" />
          <span className="text-sm text-muted-foreground">Departure</span>
        </div>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-3 w-3 text-red-500 dark:text-red-400" />
          <span className="text-sm text-muted-foreground">Conflict</span>
        </div>
      </div>

      {/* Day Details Dialog */}
      <Dialog open={!!selectedDate && !isBookingDetailOpen} onOpenChange={() => setSelectedDate(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              {selectedDate && format(selectedDate, 'EEEE, MMMM d, yyyy')}
            </DialogTitle>
            <DialogDescription>
              {dayBookings.length} booking{dayBookings.length !== 1 ? 's' : ''} on this day
            </DialogDescription>
          </DialogHeader>

          {/* Day Metrics */}
          {dayMetrics && (
            <div className="grid grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
              <div className="text-center">
                <div className="text-2xl font-bold">{dayMetrics.occupancy}%</div>
                <div className="text-xs text-muted-foreground">Occupancy</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{formatCurrency(dayMetrics.revenue)}</div>
                <div className="text-xs text-muted-foreground">Revenue</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{dayMetrics.arrivals}</div>
                <div className="text-xs text-muted-foreground">Arrivals</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{dayMetrics.departures}</div>
                <div className="text-xs text-muted-foreground">Departures</div>
              </div>
            </div>
          )}

          <ScrollArea className="max-h-96">
            <div className="space-y-4">
              {/* Arrivals */}
              {dayArrivals.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-2 flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                    <LogIn className="h-4 w-4" />
                    Arrivals ({dayArrivals.length})
                  </h4>
                  <div className="space-y-2">
                    {dayArrivals.map(booking => (
                      <BookingCard 
                        key={booking.id} 
                        booking={booking} 
                        onClick={() => {
                          setSelectedBooking(booking);
                          setIsBookingDetailOpen(true);
                        }}
                        isSelected={selectedBookings.has(booking.id)}
                        onToggleSelect={() => toggleBookingSelection(booking.id)}
                        isSelectMode={isSelectMode}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Departures */}
              {dayDepartures.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-2 flex items-center gap-2 text-amber-600 dark:text-amber-400">
                    <LogOut className="h-4 w-4" />
                    Departures ({dayDepartures.length})
                  </h4>
                  <div className="space-y-2">
                    {dayDepartures.map(booking => (
                      <BookingCard 
                        key={booking.id} 
                        booking={booking} 
                        onClick={() => {
                          setSelectedBooking(booking);
                          setIsBookingDetailOpen(true);
                        }}
                        isSelected={selectedBookings.has(booking.id)}
                        onToggleSelect={() => toggleBookingSelection(booking.id)}
                        isSelectMode={isSelectMode}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Staying */}
              {dayBookings.filter(b => !dayArrivals.includes(b) && !dayDepartures.includes(b)).length > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-2 flex items-center gap-2 text-muted-foreground">
                    <User className="h-4 w-4" />
                    Staying
                  </h4>
                  <div className="space-y-2">
                    {dayBookings
                      .filter(b => !dayArrivals.includes(b) && !dayDepartures.includes(b))
                      .map(booking => (
                        <BookingCard 
                          key={booking.id} 
                          booking={booking} 
                          onClick={() => {
                            setSelectedBooking(booking);
                            setIsBookingDetailOpen(true);
                          }}
                          isSelected={selectedBookings.has(booking.id)}
                          onToggleSelect={() => toggleBookingSelection(booking.id)}
                          isSelectMode={isSelectMode}
                        />
                      ))}
                  </div>
                </div>
              )}

              {dayBookings.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <BedDouble className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No bookings on this day</p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => {
                      if (selectedDate) {
                        setQuickBookData(prev => ({
                          ...prev,
                          propertyId: propertyFilter || prev.propertyId,
                          roomTypeId: prev.roomTypeId || roomTypes[0]?.id || '',
                          guestId: prev.guestId || guests[0]?.id || '',
                          roomRate: prev.roomRate || roomTypes[0]?.basePrice || 0,
                          checkIn: format(selectedDate, 'yyyy-MM-dd'),
                          checkOut: format(addDays(selectedDate, 1), 'yyyy-MM-dd'),
                        }));
                        setIsQuickBookOpen(true);
                        setSelectedDate(null);
                      }
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Booking
                  </Button>
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Booking Details Dialog */}
      <Dialog open={isBookingDetailOpen} onOpenChange={setIsBookingDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Booking Details</DialogTitle>
          </DialogHeader>
          {selectedBooking && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Hash className="h-4 w-4 text-muted-foreground" />
                  <span className="font-mono font-semibold">{selectedBooking.confirmationCode}</span>
                </div>
                <Badge className={bookingStatuses[selectedBooking.status]?.bgClass}>
                  {bookingStatuses[selectedBooking.status]?.label}
                </Badge>
              </div>

              <div className="grid gap-3">
                <div className="flex items-start gap-3">
                  <User className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">
                      {selectedBooking.primaryGuest.firstName} {selectedBooking.primaryGuest.lastName}
                      {selectedBooking.primaryGuest.isVip && (
                        <span className="ml-2 text-amber-500 dark:text-amber-400">VIP</span>
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {selectedBooking.adults} adult{selectedBooking.adults > 1 ? 's' : ''}
                      {selectedBooking.children > 0 && `, ${selectedBooking.children} child${selectedBooking.children > 1 ? 'ren' : ''}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Building2 className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{selectedBooking.property?.name}</p>
                    <p className="text-sm text-muted-foreground">{selectedBooking.roomType.name}</p>
                    {selectedBooking.room && (
                      <p className="text-sm text-muted-foreground">Room {selectedBooking.room.number}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CalendarIcon className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <p className="text-sm">
                      {format(new Date(selectedBooking.checkIn), 'MMM d')} - {format(new Date(selectedBooking.checkOut), 'MMM d, yyyy')}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {differenceInDays(new Date(selectedBooking.checkOut), new Date(selectedBooking.checkIn))} nights
                    </p>
                  </div>
                </div>
              </div>

              {hasConflict(selectedBooking) && (
                <div className="p-3 bg-red-100 dark:bg-red-900/20 rounded-lg flex items-center gap-2 text-red-700 dark:text-red-400">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm">This booking has a room conflict</span>
                </div>
              )}

              <div className="pt-2 border-t">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total Amount</span>
                  <span className="text-lg font-semibold">{formatCurrency(selectedBooking.totalAmount)}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => {
                  // Navigate to edit
                  setIsBookingDetailOpen(false);
                }}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => {
                  // Move booking - navigate to date picker
                  setIsBookingDetailOpen(false);
                  if (selectedBooking) {
                    toast({ title: 'Select New Dates', description: 'Use the calendar to pick new check-in/check-out dates for this booking.' });
                  }
                }}>
                  <Move className="h-4 w-4 mr-2" />
                  Move
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => {
                  // Copy booking
                  if (selectedBooking) {
                    navigator.clipboard.writeText(JSON.stringify({
                      roomTypeId: selectedBooking.roomTypeId,
                      checkIn: selectedBooking.checkIn,
                      checkOut: selectedBooking.checkOut,
                      guestId: selectedBooking.guestId,
                    }, null, 2));
                    toast({ title: 'Booking Details Copied', description: 'Booking data copied to clipboard.' });
                  }
                }}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Quick Booking Dialog */}
      <Dialog open={isQuickBookOpen} onOpenChange={setIsQuickBookOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Quick Booking</DialogTitle>
            <DialogDescription>
              Create a new booking for the selected dates
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            {/* Room Type - Full width */}
            <div className="space-y-2">
              <Label>Room Type *</Label>
              <Select 
                value={quickBookData.roomTypeId} 
                onValueChange={(value) => {
                  const rt = roomTypes.find(r => r.id === value);
                  setQuickBookData(prev => ({ 
                    ...prev, 
                    roomTypeId: value,
                    roomRate: rt?.basePrice || 0
                  }));
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select room type" />
                </SelectTrigger>
                <SelectContent>
                  {roomTypes.map(type => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name} - {formatCurrency(type.basePrice)}/night
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Guest - Full width */}
            <div className="space-y-2">
              <Label>Guest *</Label>
              <Select 
                value={quickBookData.guestId} 
                onValueChange={(value) => setQuickBookData(prev => ({ ...prev, guestId: value }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select guest" />
                </SelectTrigger>
                <SelectContent>
                  {guests.map(guest => (
                    <SelectItem key={guest.id} value={guest.id}>
                      <div className="flex items-center gap-2">
                        <span>{guest.firstName} {guest.lastName}</span>
                        {guest.isVip && <Badge className="bg-amber-100 text-amber-700 dark:text-amber-300 text-xs">VIP</Badge>}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Check-in/Check-out */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Check-in *</Label>
                <Input
                  type="date"
                  value={quickBookData.checkIn}
                  onChange={(e) => setQuickBookData(prev => ({ ...prev, checkIn: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Check-out *</Label>
                <Input
                  type="date"
                  value={quickBookData.checkOut}
                  onChange={(e) => setQuickBookData(prev => ({ ...prev, checkOut: e.target.value }))}
                />
              </div>
            </div>

            {/* Adults, Children, Rate */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Adults</Label>
                <Input
                  type="number"
                  min="1"
                  max="10"
                  value={quickBookData.adults}
                  onChange={(e) => setQuickBookData(prev => ({ ...prev, adults: parseInt(e.target.value) || 1 }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Children</Label>
                <Input
                  type="number"
                  min="0"
                  max="10"
                  value={quickBookData.children}
                  onChange={(e) => setQuickBookData(prev => ({ ...prev, children: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Rate/Night</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={quickBookData.roomRate}
                  onChange={(e) => setQuickBookData(prev => ({ ...prev, roomRate: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            </div>

            {/* Availability Status */}
            {quickBookData.roomTypeId && quickBookData.checkIn && quickBookData.checkOut && (
              <Card className="p-3 border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                    Room Available for Selected Dates
                  </span>
                </div>
              </Card>
            )}

            {quickBookData.checkIn && quickBookData.checkOut && (
              <Card className="p-3 bg-muted/50">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Estimated Total:</span>
                  <span className="text-lg font-bold">
                    {formatCurrency((quickBookData.roomRate || 0) * 
                      Math.max(1, Math.ceil((new Date(quickBookData.checkOut).getTime() - new Date(quickBookData.checkIn).getTime()) / (1000 * 60 * 60 * 24)))
                    ).toLocaleString()}
                  </span>
                </div>
              </Card>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsQuickBookOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleQuickBook} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Booking card component for dialogs
interface BookingCardProps {
  booking: Booking;
  onClick: () => void;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  isSelectMode?: boolean;
}

function BookingCard({ booking, onClick, isSelected, onToggleSelect, isSelectMode }: BookingCardProps) {
  const { formatCurrency } = useCurrency();
  
  return (
    <div
      className={cn(
        'p-3 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-colors',
        isSelected && 'ring-2 ring-primary'
      )}
      onClick={isSelectMode ? onToggleSelect : onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isSelectMode && (
            <Checkbox 
              checked={isSelected} 
              onCheckedChange={onToggleSelect}
              onClick={(e) => e.stopPropagation()}
            />
          )}
          <span className="font-mono text-sm">{booking.confirmationCode}</span>
          <Badge
            variant="secondary"
            className={cn('text-xs', bookingStatuses[booking.status]?.bgClass)}
          >
            {bookingStatuses[booking.status]?.label}
          </Badge>
        </div>
        <span className="font-medium">{formatCurrency(booking.totalAmount)}</span>
      </div>
      <p className="text-sm mt-1">
        {booking.primaryGuest.firstName} {booking.primaryGuest.lastName}
        {booking.primaryGuest.isVip && (
          <span className="ml-1 text-amber-500 dark:text-amber-400 text-xs">VIP</span>
        )}
      </p>
      <p className="text-xs text-muted-foreground">
        {booking.roomType.name}
        {booking.room && ` - Room ${booking.room.number}`}
      </p>
    </div>
  );
}
