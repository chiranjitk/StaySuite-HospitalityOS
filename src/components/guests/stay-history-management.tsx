'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  History,
  Search,
  Loader2,
  Download,
  CalendarIcon,
  Building,
  BedDouble,
  Clock,
  DollarSign,
  RefreshCw,
  Star,
  FileDown,
  MapPin,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useTimezone } from '@/contexts/TimezoneContext';
import { differenceInDays, subDays } from 'date-fns';
import { DateRange } from 'react-day-picker';

interface Stay {
  id: string;
  bookingId: string;
  guestId: string;
  roomNights: number;
  totalAmount: number;
  feedbackGiven: boolean;
  reviewGiven: boolean;
  createdAt: string;
  guest: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
    avatarUrl?: string;
  };
  booking: {
    id: string;
    confirmationCode: string;
    checkIn: string;
    checkOut: string;
    status: string;
    room?: {
      number: string;
      name?: string;
    };
    roomType?: {
      name: string;
    };
    property?: {
      name: string;
      city?: string;
    };
  };
}

interface Guest {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
}

const statusColors: Record<string, string> = {
  checked_out: 'bg-emerald-100 text-emerald-800 dark:text-emerald-200',
  checked_in: 'bg-amber-100 text-amber-800 dark:text-amber-200',
  confirmed: 'bg-sky-100 text-sky-800 dark:text-sky-200',
  cancelled: 'bg-red-100 text-red-800 dark:text-red-200',
};

export default function StayHistoryManagement() {
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const { formatDate } = useTimezone();
  const [stays, setStays] = useState<Stay[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [guestFilter, setGuestFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [selectedStay, setSelectedStay] = useState<Stay | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Stats
  const [stats, setStats] = useState({
    totalStays: 0,
    totalNights: 0,
    totalRevenue: 0,
    avgStayLength: 0,
  });

  useEffect(() => {
    fetchGuests();
  }, []);

  useEffect(() => {
    fetchStays();
  }, [guestFilter, statusFilter, dateRange]);

  const fetchGuests = async () => {
    try {
      const response = await fetch('/api/guests?limit=100');
      const result = await response.json();
      if (result.success) {
        setGuests(result.data);
      }
    } catch (error) {
      console.error('Error fetching guests:', error);
    }
  };

  const fetchStays = async () => {
    setIsLoading(true);
    try {
      // Fetch stays for all guests or filtered guest
      const guestIds = guestFilter !== 'all' ? [guestFilter] : guests.map(g => g.id);

      if (guestIds.length === 0) {
        setIsLoading(false);
        return;
      }

      // Fetch stays for each guest
      const stayPromises = guestIds.map(async (guestId) => {
        const params = new URLSearchParams();
        if (statusFilter !== 'all') params.append('status', statusFilter);
        if (dateRange?.from) params.append('startDate', dateRange.from.toISOString());
        if (dateRange?.to) params.append('endDate', dateRange.to.toISOString());

        const response = await fetch(`/api/guests/${guestId}/stays?${params.toString()}`);
        const result = await response.json();
        return result.success ? result.data : [];
      });

      const stayResults = await Promise.all(stayPromises);
      const allStays = stayResults.flat().map((stay: Stay) => ({
        ...stay,
        guest: guests.find(g => g.id === stay.guestId) || stay.guest,
      }));

      // Filter by search query
      const filteredStays = allStays.filter((stay: Stay) => {
        if (!searchQuery) return true;
        const guest = stay.guest;
        return (
          guest?.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          guest?.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          guest?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          stay.booking?.confirmationCode?.toLowerCase().includes(searchQuery.toLowerCase())
        );
      });

      setStays(filteredStays);

      // Calculate stats
      const totalNights = filteredStays.reduce((sum: number, s: Stay) => sum + s.roomNights, 0);
      const totalRevenue = filteredStays.reduce((sum: number, s: Stay) => sum + s.totalAmount, 0);
      const avgStayLength = filteredStays.length > 0 ? totalNights / filteredStays.length : 0;

      setStats({
        totalStays: filteredStays.length,
        totalNights,
        totalRevenue,
        avgStayLength: Math.round(avgStayLength * 10) / 10,
      });
    } catch (error) {
      console.error('Error fetching stays:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch stay history',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length >= 2 || searchQuery.length === 0) {
        fetchStays();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const exportToCSV = () => {
    const headers = [
      'Guest Name',
      'Email',
      'Confirmation Code',
      'Property',
      'Room Type',
      'Room Number',
      'Check In',
      'Check Out',
      'Nights',
      'Amount',
      'Status',
      'Feedback',
    ];

    const rows = stays.map(stay => [
      `${stay.guest?.firstName || ''} ${stay.guest?.lastName || ''}`,
      stay.guest?.email || 'N/A',
      stay.booking?.confirmationCode || 'N/A',
      stay.booking?.property?.name || 'N/A',
      stay.booking?.roomType?.name || 'N/A',
      stay.booking?.room?.number || 'N/A',
      stay.booking?.checkIn ? formatDate(stay.booking.checkIn) : 'N/A',
      stay.booking?.checkOut ? formatDate(stay.booking.checkOut) : 'N/A',
      stay.roomNights.toString(),
      stay.totalAmount.toString(),
      stay.booking?.status || 'N/A',
      stay.feedbackGiven ? 'Yes' : 'No',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `stay-history-${formatDate(new Date())}.csv`;
    link.click();

    toast({
      title: 'Export Complete',
      description: `Exported ${stays.length} stay records to CSV`,
    });
  };

  if (isLoading && guests.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <History className="h-5 w-5" />
            Stay History Management
          </h2>
          <p className="text-sm text-muted-foreground">
            View and analyze all guest stay history
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchStays}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportToCSV} disabled={stays.length === 0}>
            <FileDown className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <History className="h-4 w-4 text-violet-500 dark:text-violet-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.totalStays}</div>
              <div className="text-xs text-muted-foreground">Total Stays</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <CalendarIcon className="h-4 w-4 text-amber-500 dark:text-amber-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.totalNights}</div>
              <div className="text-xs text-muted-foreground">Total Nights</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <DollarSign className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</div>
              <div className="text-xs text-muted-foreground">Total Revenue</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <Clock className="h-4 w-4 text-cyan-500 dark:text-cyan-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.avgStayLength}</div>
              <div className="text-xs text-muted-foreground">Avg Stay (nights)</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by guest name, email, or confirmation code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={guestFilter} onValueChange={setGuestFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All Guests" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Guests</SelectItem>
                  {guests.map(guest => (
                    <SelectItem key={guest.id} value={guest.id}>
                      {guest.firstName} {guest.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="checked_out">Checked Out</SelectItem>
                  <SelectItem value="checked_in">Checked In</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="w-[200px] justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (
                      dateRange.to ? (
                        <>
                          {new Date(dateRange.from).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(dateRange.to).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </>
                      ) : (
                        new Date(dateRange.from).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      )
                    ) : (
                      <span>Date Range</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="range"
                    selected={dateRange}
                    onSelect={setDateRange}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stays Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : stays.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <History className="h-12 w-12 mb-4" />
              <p>No stay history found</p>
              <p className="text-sm">Try adjusting your filters</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Guest</TableHead>
                    <TableHead>Property</TableHead>
                    <TableHead>Room</TableHead>
                    <TableHead>Check In</TableHead>
                    <TableHead>Check Out</TableHead>
                    <TableHead>Nights</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stays.map((stay) => {
                    const checkInDate = stay.booking?.checkIn ? new Date(stay.booking.checkIn) : null;
                    const checkOutDate = stay.booking?.checkOut ? new Date(stay.booking.checkOut) : null;

                    return (
                      <TableRow
                        key={stay.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => { setSelectedStay(stay); setIsDetailOpen(true); }}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={stay.guest?.avatarUrl} />
                              <AvatarFallback>
                                {stay.guest?.firstName?.[0]}{stay.guest?.lastName?.[0]}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-sm">
                                {stay.guest?.firstName} {stay.guest?.lastName}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {stay.booking?.confirmationCode}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm font-medium">
                              {stay.booking?.property?.name || 'N/A'}
                            </p>
                            {stay.booking?.property?.city && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {stay.booking.property.city}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm">{stay.booking?.roomType?.name || 'N/A'}</p>
                            {stay.booking?.room?.number && (
                              <p className="text-xs text-muted-foreground">#{stay.booking.room.number}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {checkInDate ? formatDate(checkInDate) : 'N/A'}
                        </TableCell>
                        <TableCell>
                          {checkOutDate ? formatDate(checkOutDate) : 'N/A'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{stay.roomNights}</Badge>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">{formatCurrency(stay.totalAmount)}</span>
                        </TableCell>
                        <TableCell>
                          <Badge className={cn(statusColors[stay.booking?.status] || '')}>
                            {stay.booking?.status?.replace('_', ' ') || 'N/A'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm">
                            View
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
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

      {/* Stay Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Stay Details</DialogTitle>
            <DialogDescription>
              Complete information about this stay
            </DialogDescription>
          </DialogHeader>
          {selectedStay && (
            <div className="space-y-4 py-4">
              {/* Guest Info */}
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={selectedStay.guest?.avatarUrl} />
                  <AvatarFallback>
                    {selectedStay.guest?.firstName?.[0]}{selectedStay.guest?.lastName?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{selectedStay.guest?.firstName} {selectedStay.guest?.lastName}</p>
                  <p className="text-sm text-muted-foreground">{selectedStay.guest?.email}</p>
                </div>
              </div>

              {/* Stay Info Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Confirmation Code</p>
                  <p className="font-mono font-medium">{selectedStay.booking?.confirmationCode}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge className={cn(statusColors[selectedStay.booking?.status] || '')}>
                    {selectedStay.booking?.status?.replace('_', ' ')}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Property</p>
                  <p className="font-medium">{selectedStay.booking?.property?.name || 'N/A'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Location</p>
                  <p className="font-medium">{selectedStay.booking?.property?.city || 'N/A'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Room Type</p>
                  <p className="font-medium">{selectedStay.booking?.roomType?.name || 'N/A'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Room Number</p>
                  <p className="font-medium">{selectedStay.booking?.room?.number || 'N/A'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Check In</p>
                  <p className="font-medium">
                    {selectedStay.booking?.checkIn
                      ? formatDate(selectedStay.booking.checkIn)
                      : 'N/A'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Check Out</p>
                  <p className="font-medium">
                    {selectedStay.booking?.checkOut
                      ? formatDate(selectedStay.booking.checkOut)
                      : 'N/A'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Room Nights</p>
                  <p className="font-medium">{selectedStay.roomNights} nights</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Total Amount</p>
                  <p className="font-medium text-lg">{formatCurrency(selectedStay.totalAmount)}</p>
                </div>
              </div>

              {/* Feedback Status */}
              <div className="flex gap-2 pt-4 border-t">
                {selectedStay.feedbackGiven && (
                  <Badge variant="outline" className="text-emerald-600 dark:text-emerald-400">
                    <Star className="h-3 w-3 mr-1" />
                    Feedback Given
                  </Badge>
                )}
                {selectedStay.reviewGiven && (
                  <Badge variant="outline" className="text-amber-600 dark:text-amber-400">
                    <Star className="h-3 w-3 mr-1" />
                    Review Given
                  </Badge>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
