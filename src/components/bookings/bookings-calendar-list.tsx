'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useCurrency } from '@/contexts/CurrencyContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  CheckCircle,
  AlertCircle,
  Clock,
  BedDouble,
  Plus,
  Crown,
  CalendarDays,
  FileText,
  Search,
  DollarSign,
  GripHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, addMonths, subMonths, addDays, differenceInDays, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

// ============ SHARED TYPES ============
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
}

interface RoomType {
  id: string;
  name: string;
  code: string;
  basePrice: number;
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
  room?: Room;
  roomType: RoomType;
  property: { id: string; name: string };
}

interface Availability {
  date: string;
  available: number;
  total: number;
  roomTypeId: string;
}

const bookingStatuses: Record<string, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-gradient-to-r from-gray-400 to-gray-500' },
  confirmed: { label: 'Confirmed', color: 'bg-gradient-to-r from-blue-500 to-blue-600' },
  checked_in: { label: 'Checked In', color: 'bg-gradient-to-r from-emerald-500 to-green-500' },
  checked_out: { label: 'Checked Out', color: 'bg-gradient-to-r from-gray-300 to-gray-400' },
  cancelled: { label: 'Cancelled', color: 'bg-gradient-to-r from-red-400 to-red-500' },
  no_show: { label: 'No Show', color: 'bg-gradient-to-r from-orange-400 to-orange-500' },
};

const sources = [
  { value: 'direct', label: 'Direct' },
  { value: 'booking_com', label: 'Booking.com' },
  { value: 'airbnb', label: 'Airbnb' },
  { value: 'expedia', label: 'Expedia' },
  { value: 'walk_in', label: 'Walk-in' },
];

const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Helper to get today's date in local timezone format (YYYY-MM-DD)
const getTodayLocal = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper to get tomorrow's date in local timezone format (YYYY-MM-DD)
const getTomorrowLocal = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const year = tomorrow.getFullYear();
  const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const day = String(tomorrow.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// ============ MAIN COMPONENT ============
export function BookingsCalendarList() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Bookings Management
          </h2>
          <p className="text-sm text-muted-foreground">
            View calendar, manage reservations, and create new bookings
          </p>
        </div>
      </div>

      <Tabs defaultValue="calendar" className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="calendar" className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4" />
            Calendar View
          </TabsTrigger>
          <TabsTrigger value="list" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            All Bookings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendar">
          <CalendarViewTab />
        </TabsContent>

        <TabsContent value="list">
          <BookingsListTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============ CALENDAR VIEW TAB ============
function CalendarViewTab() {
  const { toast } = useToast();
  const { formatCurrency, currency } = useCurrency();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [roomTypeStats, setRoomTypeStats] = useState<Array<{
    id: string;
    name: string;
    totalRooms: number;
    availableRooms: number;
    occupiedRooms: number;
  }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [propertyFilter, setPropertyFilter] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  
  // Quick booking dialog
  const [isQuickBookOpen, setIsQuickBookOpen] = useState(false);
  const [quickBookData, setQuickBookData] = useState({
    propertyId: '',
    roomTypeId: '',
    primaryGuestId: '',
    checkIn: '',
    checkOut: '',
    adults: 1,
    children: 0,
    roomRate: 0,
  });
  const [isSaving, setIsSaving] = useState(false);

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

  // Sync propertyId with propertyFilter and fetch room types
  useEffect(() => {
    const fetchRoomTypes = async () => {
      if (!propertyFilter || propertyFilter === 'all') return;
      // Sync propertyId with propertyFilter
      setQuickBookData(prev => ({ ...prev, propertyId: propertyFilter }));
      try {
        const response = await fetch(`/api/room-types?propertyId=${propertyFilter}`);
        const result = await response.json();
        if (result.success) {
          setRoomTypes(result.data);
          if (result.data.length > 0) {
            setQuickBookData(prev => ({ 
              ...prev, 
              propertyId: propertyFilter,
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
          if (result.data.length > 0) {
            setQuickBookData(prev => ({ ...prev, primaryGuestId: result.data[0].id }));
          }
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
      const startDate = startOfMonth(currentMonth);
      const endDate = endOfMonth(currentMonth);
      const bufferStart = subMonths(startDate, 1);
      const bufferEnd = addMonths(endDate, 1);

      const bookingsParams = new URLSearchParams();
      bookingsParams.append('checkInFrom', bufferStart.toISOString());
      bookingsParams.append('checkInTo', bufferEnd.toISOString());
      bookingsParams.append('propertyId', propertyFilter);

      const bookingsResponse = await fetch(`/api/bookings?${bookingsParams.toString()}`);
      const bookingsResult = await bookingsResponse.json();

      if (bookingsResult.success) {
        setBookings(bookingsResult.data);
      }

      // Try to fetch availability
      try {
        const availabilityParams = new URLSearchParams();
        availabilityParams.append('propertyId', propertyFilter);
        availabilityParams.append('startDate', startDate.toISOString());
        availabilityParams.append('endDate', endDate.toISOString());

        const availabilityResponse = await fetch(`/api/availability?${availabilityParams.toString()}`);
        const availabilityResult = await availabilityResponse.json();
        if (availabilityResult.success && availabilityResult.data?.availabilityByRoomType) {
          // Flatten the availability data for easier access
          const flatAvailability: Availability[] = [];
          const stats: Array<{
            id: string;
            name: string;
            totalRooms: number;
            availableRooms: number;
            occupiedRooms: number;
          }> = [];
          
          availabilityResult.data.availabilityByRoomType.forEach((rt: {
            roomTypeId: string;
            roomTypeName: string;
            totalRooms: number;
            availableRooms: number;
            occupiedRooms: number;
            dailyAvailability: Array<{ date: string; available: number; booked: number; locked: number }>;
          }) => {
            // Store room type stats
            stats.push({
              id: rt.roomTypeId,
              name: rt.roomTypeName,
              totalRooms: rt.totalRooms,
              availableRooms: rt.availableRooms,
              occupiedRooms: rt.occupiedRooms,
            });
            
            // Flatten daily availability
            rt.dailyAvailability.forEach((day) => {
              flatAvailability.push({
                date: day.date,
                available: day.available,
                total: rt.totalRooms,
                roomTypeId: rt.roomTypeId,
              });
            });
          });
          setAvailability(flatAvailability);
          setRoomTypeStats(stats);
        }
      } catch (e) {
        console.log('Availability API not available');
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentMonth, propertyFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth));
    const end = endOfWeek(endOfMonth(currentMonth));
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  // Get bookings for a specific day
  const getBookingsForDay = (day: Date) => {
    return bookings.filter(booking => {
      // Parse dates and normalize to start of day in local timezone
      const checkIn = new Date(booking.checkIn);
      const checkOut = new Date(booking.checkOut);
      
      // Normalize to start of day for comparison
      const checkInStart = new Date(checkIn.getFullYear(), checkIn.getMonth(), checkIn.getDate());
      const checkOutStart = new Date(checkOut.getFullYear(), checkOut.getMonth(), checkOut.getDate());
      const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
      
      return dayStart >= checkInStart && dayStart < checkOutStart;
    });
  };

  // Get availability for a specific day
  const getAvailabilityForDay = (day: Date, roomTypeId?: string) => {
    if (!availability || !Array.isArray(availability)) {
      return null;
    }
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

  // Get arrivals for a specific day
  const getArrivalsForDay = (day: Date) => {
    return bookings.filter(booking => {
      const checkIn = new Date(booking.checkIn);
      // Normalize to start of day for comparison
      const checkInStart = new Date(checkIn.getFullYear(), checkIn.getMonth(), checkIn.getDate());
      const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
      return isSameDay(checkInStart, dayStart);
    });
  };

  // Get departures for a specific day
  const getDeparturesForDay = (day: Date) => {
    return bookings.filter(booking => {
      const checkOut = new Date(booking.checkOut);
      // Normalize to start of day for comparison
      const checkOutStart = new Date(checkOut.getFullYear(), checkOut.getMonth(), checkOut.getDate());
      const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
      return isSameDay(checkOutStart, dayStart);
    });
  };

  // Navigation
  const goToPreviousMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const goToNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const goToToday = () => setCurrentMonth(new Date());

  // Create quick booking
  const handleQuickBook = async () => {
    // Debug: log the data being sent
    console.log('Quick Booking Data:', quickBookData);
    
    if (!quickBookData.propertyId || !quickBookData.primaryGuestId || !quickBookData.roomTypeId || !quickBookData.checkIn || !quickBookData.checkOut) {
      const missing: string[] = [];
      if (!quickBookData.propertyId) missing.push('Property');
      if (!quickBookData.primaryGuestId) missing.push('Guest');
      if (!quickBookData.roomTypeId) missing.push('Room Type');
      if (!quickBookData.checkIn) missing.push('Check-in');
      if (!quickBookData.checkOut) missing.push('Check-out');
      
      toast({
        title: 'Validation Error',
        description: `Please fill in: ${missing.join(', ')}`,
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      // Create dates at local midnight to avoid timezone issues
      const checkInDate = new Date(quickBookData.checkIn + 'T00:00:00');
      const checkOutDate = new Date(quickBookData.checkOut + 'T00:00:00');
      const nights = differenceInDays(checkOutDate, checkInDate);
      const totalAmount = quickBookData.roomRate * nights;

      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...quickBookData,
          checkIn: checkInDate.toISOString(),
          checkOut: checkOutDate.toISOString(),
          // Send local date strings for timezone-aware validation
          checkInLocalDate: quickBookData.checkIn,
          checkOutLocalDate: quickBookData.checkOut,
          totalAmount,
          status: 'confirmed',
          source: 'direct',
        }),
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

  // Day details dialog
  const dayBookings = selectedDate ? getBookingsForDay(selectedDate) : [];
  const dayArrivals = selectedDate ? getArrivalsForDay(selectedDate) : [];
  const dayDepartures = selectedDate ? getDeparturesForDay(selectedDate) : [];

  return (
    <>
      {/* Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={goToPreviousMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={goToToday}>
                Today
              </Button>
              <Button variant="outline" size="icon" onClick={goToNextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <span className="text-lg font-semibold ml-2">
                {format(currentMonth, 'MMMM yyyy')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Select value={propertyFilter} onValueChange={setPropertyFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Property" />
                </SelectTrigger>
                <SelectContent>
                  {properties.map(property => (
                    <SelectItem key={property.id} value={property.id}>
                      {property.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-md hover:shadow-lg transition-all" onClick={() => setIsQuickBookOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Booking
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Availability Overview - Show ALL room types */}
      {roomTypes.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {roomTypes.map(roomType => {
            // Find matching stats from availability API
            const stat = roomTypeStats.find(s => s.id === roomType.id);
            const hasStats = !!stat;
            const percentAvailable = stat && stat.totalRooms > 0
              ? (stat.availableRooms / stat.totalRooms) * 100
              : 0;
            const noRoomsConfigured = stat ? stat.totalRooms === 0 : true;

            return (
              <Card key={roomType.id} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium truncate pr-2">{roomType.name}</span>
                  {!hasStats ? (
                    <Loader2 className="h-4 w-4 text-muted-foreground animate-spin flex-shrink-0" />
                  ) : noRoomsConfigured ? (
                    <AlertCircle className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  ) : percentAvailable < 20 ? (
                    <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                  ) : percentAvailable < 50 ? (
                    <Clock className="h-4 w-4 text-amber-500 flex-shrink-0" />
                  ) : (
                    <CheckCircle className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                  )}
                </div>
                <div className="text-2xl font-bold">
                  {!hasStats ? (
                    <span className="text-muted-foreground">-</span>
                  ) : noRoomsConfigured ? (
                    <span className="text-muted-foreground text-base">No Rooms</span>
                  ) : (
                    <>
                      {stat!.availableRooms}<span className="text-sm font-normal text-muted-foreground">/{stat!.totalRooms}</span>
                    </>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {!hasStats ? 'Loading...' : noRoomsConfigured ? 'Configure in Rooms' : 'Available Now'}
                </div>
                <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      !hasStats ? "bg-muted animate-pulse" :
                      noRoomsConfigured ? "bg-gray-300" :
                      percentAvailable < 20 ? "bg-red-500" : percentAvailable < 50 ? "bg-amber-500" : "bg-emerald-500"
                    )}
                    style={{ width: !hasStats ? '50%' : noRoomsConfigured ? '100%' : `${percentAvailable}%` }}
                  />
                </div>
              </Card>
            );
          })}
        </div>
      ) : !isLoading && (
        <Card className="p-4">
          <div className="text-center py-4">
            <BedDouble className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No room types configured for this property</p>
          </div>
        </Card>
      )}

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
              <div className="grid grid-cols-7 border-b">
                {weekDays.map(day => (
                  <div
                    key={day}
                    className="p-3 text-center text-sm font-medium text-muted-foreground border-r last:border-r-0"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar days */}
              <div className="grid grid-cols-7">
                {calendarDays.map((day) => {
                  const isCurrentMonth = format(day, 'M') === format(currentMonth, 'M');
                  const dayBookings = getBookingsForDay(day);
                  const arrivals = getArrivalsForDay(day);
                  const departures = getDeparturesForDay(day);
                  const dayAvail = getAvailabilityForDay(day);
                  const availPercent = dayAvail && dayAvail.total > 0 
                    ? (dayAvail.available / dayAvail.total) * 100 
                    : 100;

                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        'min-h-24 p-1 border-r last:border-r-0 border-b cursor-pointer transition-all hover:bg-muted/50',
                        !isCurrentMonth && 'bg-muted/30',
                        isToday(day) && 'bg-primary/5 ring-2 ring-inset ring-primary/20',
                      )}
                      onClick={() => setSelectedDate(day)}
                    >
                      {/* Date header */}
                      <div className="flex items-center justify-between mb-1">
                        <div className={cn(
                          'text-sm p-1 rounded-full w-7 h-7 flex items-center justify-center',
                          isToday(day) && 'bg-primary text-primary-foreground font-semibold ring-2 ring-primary ring-offset-1 ring-offset-background',
                          !isCurrentMonth && 'text-muted-foreground'
                        )}>
                          {format(day, 'd')}
                        </div>
                        
                        {/* Availability indicator */}
                        {dayAvail && isCurrentMonth && (
                          <div className={cn(
                            "text-xs px-1 rounded",
                            availPercent < 20 ? "text-red-600 bg-red-100 dark:bg-red-900/20" : 
                            availPercent < 50 ? "text-amber-600 bg-amber-100 dark:bg-amber-900/20" : 
                            "text-emerald-600 bg-emerald-100 dark:bg-emerald-900/20"
                          )}>
                            {dayAvail.available}
                          </div>
                        )}
                      </div>

                      {/* Bookings */}
                      {isCurrentMonth && (
                        <div className="space-y-1">
                          {dayBookings.slice(0, 3).map(booking => {
                            const isArrival = arrivals.includes(booking);
                            const isDeparture = departures.includes(booking);
                            
                            return (
                              <div
                                key={booking.id}
                                className={cn(
                                  'text-xs px-1 py-0.5 rounded truncate cursor-pointer flex items-center gap-1',
                                  bookingStatuses[booking.status]?.color || 'bg-gray-500',
                                  'text-white hover:opacity-90',
                                  isArrival && 'border-l-2 border-white',
                                  isDeparture && 'border-r-2 border-white'
                                )}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedBooking(booking);
                                }}
                                title={`${booking.primaryGuest.firstName} ${booking.primaryGuest.lastName} - ${booking.confirmationCode}`}
                              >
                                {isArrival && <LogIn className="h-2.5 w-2.5 flex-shrink-0" />}
                                {isDeparture && <LogOut className="h-2.5 w-2.5 flex-shrink-0" />}
                                <span className="truncate">
                                  {booking.primaryGuest.firstName} {booking.primaryGuest.lastName[0]}.
                                </span>
                              </div>
                            );
                          })}
                          {dayBookings.length > 3 && (
                            <div className="text-xs text-muted-foreground px-1">
                              +{dayBookings.length - 3} more
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
            </>
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex flex-wrap gap-4">
        {Object.entries(bookingStatuses).map(([key, { label, color }]) => (
          <div key={key} className="flex items-center gap-2">
            <div className={cn('w-3 h-3 rounded', color)} />
            <span className="text-sm text-muted-foreground">{label}</span>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded border-l-2 border-white bg-emerald-500" />
          <span className="text-sm text-muted-foreground">Arrival</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded border-r-2 border-white bg-amber-500" />
          <span className="text-sm text-muted-foreground">Departure</span>
        </div>
      </div>

      {/* Day Details Dialog */}
      <Dialog open={!!selectedDate} onOpenChange={() => setSelectedDate(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedDate && format(selectedDate, 'EEEE, MMMM d, yyyy')}
            </DialogTitle>
            <DialogDescription>
              {dayBookings.length} booking{dayBookings.length !== 1 ? 's' : ''} on this day
            </DialogDescription>
          </DialogHeader>

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
                      <BookingCard key={booking.id} booking={booking} onClick={() => setSelectedBooking(booking)} />
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
                      <BookingCard key={booking.id} booking={booking} onClick={() => setSelectedBooking(booking)} />
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
                        <BookingCard key={booking.id} booking={booking} onClick={() => setSelectedBooking(booking)} />
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
      <Dialog open={!!selectedBooking} onOpenChange={() => setSelectedBooking(null)}>
        <DialogContent className="max-w-md">
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
                <Badge className={cn('text-white', bookingStatuses[selectedBooking.status]?.color)}>
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
                        <span className="ml-2 text-amber-500">VIP</span>
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
                    <p className="font-medium">{selectedBooking.property.name}</p>
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

              <div className="pt-2 border-t">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total Amount</span>
                  <span className="text-lg font-semibold">{formatCurrency(selectedBooking.totalAmount)}</span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Quick Booking Dialog */}
      <Dialog open={isQuickBookOpen} onOpenChange={setIsQuickBookOpen}>
        <DialogContent className="sm:max-w-lg w-full">
          <DialogHeader>
            <DialogTitle>Quick Booking</DialogTitle>
            <DialogDescription>
              Create a new booking for the selected dates
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Room Type</Label>
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
                        {type.name} ({formatCurrency(type.basePrice)}/night)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Guest <span className="text-red-500">*</span></Label>
                <Select 
                  value={quickBookData.primaryGuestId} 
                  onValueChange={(value) => setQuickBookData(prev => ({ ...prev, primaryGuestId: value }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select guest" />
                  </SelectTrigger>
                  <SelectContent>
                    {guests.length === 0 ? (
                      <div className="px-2 py-4 text-center text-muted-foreground text-sm">
                        No guests found. Please add guests first.
                      </div>
                    ) : (
                      guests.map(guest => (
                        <SelectItem key={guest.id} value={guest.id}>
                          {guest.firstName} {guest.lastName} {guest.isVip ? '(VIP)' : ''}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Check-in</Label>
                <Input
                  type="date"
                  value={quickBookData.checkIn}
                  min={getTodayLocal()}
                  onChange={(e) => setQuickBookData(prev => ({ ...prev, checkIn: e.target.value }))}
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <Label>Check-out</Label>
                <Input
                  type="date"
                  value={quickBookData.checkOut}
                  min={quickBookData.checkIn || getTodayLocal()}
                  onChange={(e) => setQuickBookData(prev => ({ ...prev, checkOut: e.target.value }))}
                  className="w-full"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Adults</Label>
                <Input
                  type="number"
                  min="1"
                  max="10"
                  value={quickBookData.adults}
                  onChange={(e) => setQuickBookData(prev => ({ ...prev, adults: parseInt(e.target.value) || 1 }))}
                  className="w-full"
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
                  className="w-full"
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
                  className="w-full"
                />
              </div>
            </div>

            {quickBookData.checkIn && quickBookData.checkOut && (
              <Card className="p-3 bg-muted/50">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Estimated Total:</span>
                  <span className="text-lg font-bold">
                    {formatCurrency((quickBookData.roomRate || 0) * 
                      Math.max(1, Math.ceil((new Date(quickBookData.checkOut).getTime() - new Date(quickBookData.checkIn).getTime()) / (1000 * 60 * 60 * 24)))
                    )}
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
    </>
  );
}

// ============ BOOKINGS LIST TAB ============
function BookingsListTab() {
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [propertyFilter, setPropertyFilter] = useState<string>('all');
  
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
      
      const response = await fetch(`/api/bookings?${params.toString()}`);
      const result = await response.json();
      
      if (result.success) {
        setBookings(result.data);
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
  }, [statusFilter, propertyFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length >= 2 || searchQuery.length === 0) {
        fetchBookings();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

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
      const checkInDate = new Date(formData.checkIn);
      const checkOutDate = new Date(formData.checkOut);
      const nights = differenceInDays(checkOutDate, checkInDate);
      const roomRate = parseFloat(formData.roomRate) || 0;
      const totalAmount = roomRate * nights;
      
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          checkIn: checkInDate,
          checkOut: checkOutDate,
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
    const option = Object.entries(bookingStatuses).find(([k]) => k === status);
    return (
      <Badge variant="secondary" className={cn('text-white', option?.[1]?.color)}>
        {option?.[1]?.label || status}
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
    <>
      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-5">
        <Card className="p-4">
          <div className="text-2xl font-bold">{stats.total}</div>
          <div className="text-xs text-muted-foreground">Total Bookings</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-emerald-500">{stats.confirmed}</div>
          <div className="text-xs text-muted-foreground">Confirmed</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-teal-500">{stats.checkedIn}</div>
          <div className="text-xs text-muted-foreground">Checked In</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-amber-500">{stats.checkingOut}</div>
          <div className="text-xs text-muted-foreground">Checking Out</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-violet-500">{formatCurrency(stats.revenue)}</div>
          <div className="text-xs text-muted-foreground">Revenue</div>
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
                {Object.entries(bookingStatuses).map(([key, { label }]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => { resetForm(); setIsCreateOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              New Booking
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Bookings Table */}
      <Card>
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
            {/* Mobile Card View */}
            <div className="md:hidden">
              <ScrollArea className="h-[500px]">
                <div className="space-y-3 p-4">
                  {bookings.map((booking) => {
                    const nights = differenceInDays(new Date(booking.checkOut), new Date(booking.checkIn));
                    const isArrivingToday = new Date(booking.checkIn).toDateString() === new Date().toDateString();
                    const isDepartingToday = new Date(booking.checkOut).toDateString() === new Date().toDateString();

                    return (
                      <Card key={booking.id} className="p-4">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarFallback className="text-xs bg-gradient-to-br from-primary/80 to-primary text-primary-foreground">
                                {getInitials(booking.primaryGuest.firstName, booking.primaryGuest.lastName)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <p className="font-medium text-sm">{booking.primaryGuest.firstName} {booking.primaryGuest.lastName}</p>
                                {booking.primaryGuest.isVip && (
                                  <Crown className="h-3 w-3 text-amber-500" />
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground font-mono">{booking.confirmationCode}</p>
                            </div>
                          </div>
                          {getStatusBadge(booking.status)}
                        </div>

                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Building2 className="h-3.5 w-3.5" />
                            <span>{booking.property.name}</span>
                            <span className="text-border">·</span>
                            <span>{booking.roomType.name}</span>
                            {booking.room && (
                              <>
                                <span className="text-border">·</span>
                                <span>Room {booking.room.number}</span>
                              </>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <CalendarIcon className="h-3.5 w-3.5" />
                            <span>{format(new Date(booking.checkIn), 'MMM d')} → {format(new Date(booking.checkOut), 'MMM d')}</span>
                            <span className="text-border">·</span>
                            <span>{nights} night{nights > 1 ? 's' : ''}</span>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t">
                            <span className="font-semibold">{formatCurrency(booking.totalAmount)}</span>
                            <div className="flex gap-2">
                              {isArrivingToday && booking.status === 'confirmed' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => updateBookingStatus(booking.id, 'checked_in')}
                                  className="text-emerald-600 h-7 text-xs"
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
                                  className="text-amber-600 h-7 text-xs"
                                >
                                  <LogOut className="h-3 w-3 mr-1" />
                                  Check Out
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block">
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
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bookings.map((booking) => {
                      const nights = differenceInDays(new Date(booking.checkOut), new Date(booking.checkIn));
                      const isArrivingToday = new Date(booking.checkIn).toDateString() === new Date().toDateString();
                      const isDepartingToday = new Date(booking.checkOut).toDateString() === new Date().toDateString();
                      
                      return (
                        <TableRow key={booking.id}>
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
                                <span>{format(new Date(booking.checkIn), 'MMM d')}</span>
                              </div>
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <LogOut className="h-3 w-3" />
                                <span>{format(new Date(booking.checkOut), 'MMM d')}</span>
                              </div>
                              <p className="text-xs text-muted-foreground">{nights} night{nights > 1 ? 's' : ''}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-medium">{formatCurrency(booking.totalAmount)}</span>
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
                                {Object.entries(bookingStatuses).map(([key]) => (
                                  <SelectItem key={key} value={key}>
                                    {bookingStatuses[key].label}
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
            </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-xl w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Booking</DialogTitle>
            <DialogDescription>
              Create a new reservation
            </DialogDescription>
          </DialogHeader>
          <BookingForm 
            formData={formData}
            setFormData={setFormData}
            properties={properties}
            roomTypes={roomTypes}
            guests={guests}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setIsCreateOpen(false); }}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ============ HELPER COMPONENTS ============
function BookingCard({ booking, onClick }: { booking: Booking; onClick: () => void }) {
  const { formatCurrency } = useCurrency();
  
  return (
    <div
      className="p-3 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-colors"
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm">{booking.confirmationCode}</span>
          <Badge
            variant="secondary"
            className={cn('text-white text-xs', bookingStatuses[booking.status]?.color)}
          >
            {bookingStatuses[booking.status]?.label}
          </Badge>
        </div>
        <span className="font-medium">{formatCurrency(booking.totalAmount)}</span>
      </div>
      <p className="text-sm mt-1">
        {booking.primaryGuest.firstName} {booking.primaryGuest.lastName}
        {booking.primaryGuest.isVip && (
          <span className="ml-1 text-amber-500 text-xs">VIP</span>
        )}
      </p>
      <p className="text-xs text-muted-foreground">
        {booking.roomType.name}
        {booking.room && ` - Room ${booking.room.number}`}
      </p>
    </div>
  );
}

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

function BookingForm({ formData, setFormData, properties, roomTypes, guests }: {
  formData: BookingFormData;
  setFormData: React.Dispatch<React.SetStateAction<BookingFormData>>;
  properties: Property[];
  roomTypes: RoomType[];
  guests: Guest[];
}) {
  const { formatCurrency } = useCurrency();
  const selectedRoomType = roomTypes.find(rt => rt.id === formData.roomTypeId);
  
  return (
    <div className="grid gap-4 py-4">
      <div className="grid grid-cols-2 gap-4">
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
              {Object.entries(bookingStatuses)
                .filter(([key]) => key === 'confirmed' || key === 'draft')
                .map(([key, { label }]) => (
                  <SelectItem key={key} value={key}>
                    {label}
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
              )}
            </span>
          </div>
        </Card>
      )}
    </div>
  );
}

export default BookingsCalendarList;
