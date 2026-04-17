'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  History,
  Calendar,
  Building,
  BedDouble,
  Clock,
  DollarSign,
  Loader2,
  MapPin,
  Star,
  ChevronRight,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useTimezone } from '@/contexts/TimezoneContext';
import { differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';

interface Stay {
  id: string;
  bookingId: string;
  roomNights: number;
  totalAmount: number;
  feedbackGiven: boolean;
  reviewGiven: boolean;
  createdAt: string;
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

interface StayHistoryProps {
  guestId: string;
}

const statusColors: Record<string, string> = {
  checked_out: 'bg-emerald-100 text-emerald-800',
  checked_in: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-sky-100 text-sky-800',
  cancelled: 'bg-red-100 text-red-800',
};

export function StayHistory({ guestId }: StayHistoryProps) {
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const { formatDate } = useTimezone();
  const [stays, setStays] = useState<Stay[]>([]);
  const [summary, setSummary] = useState({
    totalStays: 0,
    totalNights: 0,
    totalSpent: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [filterYear, setFilterYear] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('date_desc');

  useEffect(() => {
    fetchStays();
  }, [guestId]);

  const fetchStays = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/guests/${guestId}/stays`);
      const result = await response.json();
      
      if (result.success) {
        setStays(result.data);
        setSummary(result.summary);
      }
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

  const getYears = () => {
    const years = new Set<string>();
    stays.forEach(stay => {
      const year = new Date(stay.booking.checkIn).getFullYear().toString();
      years.add(year);
    });
    return Array.from(years).sort((a, b) => parseInt(b) - parseInt(a));
  };

  const filteredStays = stays
    .filter(stay => {
      if (filterYear === 'all') return true;
      return new Date(stay.booking.checkIn).getFullYear().toString() === filterYear;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'date_asc':
          return new Date(a.booking.checkIn).getTime() - new Date(b.booking.checkIn).getTime();
        case 'amount_desc':
          return b.totalAmount - a.totalAmount;
        case 'amount_asc':
          return a.totalAmount - b.totalAmount;
        case 'date_desc':
        default:
          return new Date(b.booking.checkIn).getTime() - new Date(a.booking.checkIn).getTime();
      }
    });

  if (isLoading) {
    return (
      <Card className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid gap-4 grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Total Stays</span>
          </div>
          <div className="text-2xl font-bold mt-1">{summary.totalStays}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Total Nights</span>
          </div>
          <div className="text-2xl font-bold mt-1">{summary.totalNights}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Total Spent</span>
          </div>
          <div className="text-2xl font-bold mt-1">{formatCurrency(summary.totalSpent)}</div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Year:</span>
          <Select value={filterYear} onValueChange={setFilterYear}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Years</SelectItem>
              {getYears().map(year => (
                <SelectItem key={year} value={year}>{year}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Sort by:</span>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date_desc">Newest First</SelectItem>
              <SelectItem value="date_asc">Oldest First</SelectItem>
              <SelectItem value="amount_desc">Highest Amount</SelectItem>
              <SelectItem value="amount_asc">Lowest Amount</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stays List */}
      {filteredStays.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-12">
          <History className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No stay history found</p>
        </Card>
      ) : (
        <ScrollArea className="h-[500px]">
          <div className="space-y-4">
            {filteredStays.map((stay, index) => {
              const checkInDate = new Date(stay.booking.checkIn);
              const checkOutDate = new Date(stay.booking.checkOut);
              const nights = differenceInDays(checkOutDate, checkInDate);
              
              return (
                <Card key={stay.id} className="overflow-hidden">
                  <div className="flex flex-col md:flex-row">
                    {/* Date Column */}
                    <div className="w-full md:w-32 bg-muted/30 p-4 flex flex-col items-center justify-center text-center border-b md:border-b-0 md:border-r">
                      <div className="text-2xl font-bold">
                        {formatDate(checkInDate).split('/')[0]}
                      </div>
                      <div className="text-sm text-muted-foreground uppercase">
                        {new Date(checkInDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                      </div>
                      <Badge className={cn('mt-2', statusColors[stay.booking.status] || '')}>
                        {stay.booking.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    
                    {/* Main Content */}
                    <div className="flex-1 p-4">
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Building className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">
                              {stay.booking.property?.name || 'Property'}
                            </span>
                            {stay.booking.property?.city && (
                              <span className="text-sm text-muted-foreground">
                                • {stay.booking.property.city}
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-4 text-sm">
                            <div className="flex items-center gap-1">
                              <BedDouble className="h-4 w-4 text-muted-foreground" />
                              <span>{stay.booking.roomType?.name || 'Room'}</span>
                              {stay.booking.room?.number && (
                                <span className="text-muted-foreground">
                                  (#{stay.booking.room.number})
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              <span>
                                {new Date(checkInDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(checkOutDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              <span>{nights} night{nights !== 1 ? 's' : ''}</span>
                            </div>
                          </div>
                          
                          <div className="text-xs text-muted-foreground">
                            Confirmation: <span className="font-mono">{stay.booking.confirmationCode}</span>
                          </div>
                        </div>
                        
                        <div className="flex flex-col items-end gap-2">
                          <div className="text-xl font-bold">
                            {formatCurrency(stay.totalAmount)}
                          </div>
                          <div className="flex gap-2">
                            {stay.feedbackGiven && (
                              <Badge variant="outline" className="text-emerald-600">
                                <Star className="h-3 w-3 mr-1" />
                                Feedback
                              </Badge>
                            )}
                            {stay.reviewGiven && (
                              <Badge variant="outline" className="text-amber-600">
                                <Star className="h-3 w-3 mr-1" />
                                Reviewed
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
