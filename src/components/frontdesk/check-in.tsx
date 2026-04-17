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
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
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
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  LogIn, 
  Search,
  Users,
  Crown,
  Clock,
  Phone,
  Mail,
  Building2,
  Key,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  FileText,
  Wifi,
  Copy,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { differenceInDays, startOfDay, endOfDay } from 'date-fns';

interface Room {
  id: string;
  number: string;
  floor: number;
  status: string;
  roomType: {
    id: string;
    name: string;
    code: string;
    basePrice: number;
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
  specialRequests?: string;
  primaryGuest: Guest;
  room?: { id: string; number: string; floor: number };
  roomType: { id: string; name: string; code: string; basePrice: number };
  property: { id: string; name: string; checkInTime: string };
}

export default function CheckIn() {
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const { formatDate, formatDateTime } = useTimezone();
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [isCheckInOpen, setIsCheckInOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // WiFi credentials state
  const [wifiCredentials, setWifiCredentials] = useState<{
    username: string;
    password: string;
    validUntil: string;
  } | null>(null);
  const [showWifiDialog, setShowWifiDialog] = useState(false);
  
  // Check-in form state
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [idType, setIdType] = useState<string>('passport');
  const [idNumber, setIdNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [lateCheckOut, setLateCheckOut] = useState<boolean>(false);

  // Fetch today's arrivals
  const fetchArrivals = async () => {
    setIsLoading(true);
    try {
      const today = new Date();
      const params = new URLSearchParams();
      params.append('status', 'confirmed');
      params.append('checkInFrom', startOfDay(today).toISOString());
      params.append('checkInTo', endOfDay(today).toISOString());
      if (searchQuery) params.append('search', searchQuery);

      const response = await fetch(`/api/bookings?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setBookings(result.data);
      }
    } catch (error) {
      console.error('Error fetching arrivals:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch arrivals',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchArrivals();
  }, [searchQuery]);

  // Fetch available rooms for room type
  const fetchAvailableRooms = async (roomTypeId: string, propertyId: string) => {
    try {
      const response = await fetch(`/api/rooms?roomTypeId=${roomTypeId}&propertyId=${propertyId}&status=available`);
      const result = await response.json();
      if (result.success) {
        setAvailableRooms(result.data);
        if (result.data.length > 0) {
          setSelectedRoomId(result.data[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching available rooms:', error);
    }
  };

  // Open check-in dialog
  const openCheckIn = (booking: Booking) => {
    setSelectedBooking(booking);
    setNotes('');
    setIdNumber('');
    setIdType('passport');
    setLateCheckOut(false);
    
    // If room already assigned, use it
    if (booking.room) {
      setSelectedRoomId(booking.room.id);
      setAvailableRooms([]);
    } else {
      // Fetch available rooms for this room type
      fetchAvailableRooms(booking.roomType.id, booking.property.id);
    }
    
    setIsCheckInOpen(true);
  };

  // Process check-in
  const processCheckIn = async () => {
    if (!selectedBooking) return;
    
    if (!selectedRoomId && !selectedBooking.room) {
      toast({
        title: 'Validation Error',
        description: 'Please select a room for check-in',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetch(`/api/bookings/${selectedBooking.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'checked_in',
          roomId: selectedRoomId || selectedBooking.room?.id,
          actualCheckIn: new Date().toISOString(),
          checkedInBy: user?.id || '',
          notes: notes || undefined,
        }),
      });

      const result = await response.json();

      if (result.success) {
        // Handle WiFi credentials from response
        if (result.wifi?.credentials) {
          setWifiCredentials({
            username: result.wifi.credentials.username,
            password: result.wifi.credentials.password,
            validUntil: formatDateTime(result.wifi.credentials.validUntil),
          });
          setShowWifiDialog(true);
        }

        toast({
          title: 'Check-in Successful',
          description: `Guest checked in to Room ${result.data.room?.number || 'assigned'}. WiFi credentials ready.`,
        });
        
        setIsCheckInOpen(false);
        fetchArrivals();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to process check-in',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error processing check-in:', error);
      toast({
        title: 'Error',
        description: 'Failed to process check-in',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Copy to clipboard helper
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied',
      description: `${label} copied to clipboard`,
    });
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  };

  const getLoyaltyColor = (tier: string) => {
    const colors: Record<string, string> = {
      bronze: 'text-amber-700 bg-amber-100',
      silver: 'text-gray-600 bg-gray-100',
      gold: 'text-yellow-600 bg-yellow-100',
      platinum: 'text-violet-600 bg-violet-100',
    };
    return colors[tier] || colors.bronze;
  };

  // Stats
  const stats = {
    total: bookings.length,
    arrived: bookings.filter(b => b.status === 'checked_in').length,
    pending: bookings.filter(b => b.status === 'confirmed').length,
    vip: bookings.filter(b => b.primaryGuest.isVip).length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <LogIn className="h-5 w-5" />
            Check-in
          </h2>
          <p className="text-sm text-muted-foreground">
            Today&apos;s arrivals - {formatDate(new Date())}
          </p>
        </div>
        <Button variant="outline" onClick={() => fetchArrivals()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Quick Stats Ribbon */}
      <div className="grid gap-3 grid-cols-3">
        <Card className="p-3 sm:p-4 bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30 border border-emerald-200/50 dark:border-emerald-800/30">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <LogIn className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-bold text-emerald-600 tabular-nums">{stats.total}</div>
              <div className="text-[10px] sm:text-xs text-muted-foreground">Today&apos;s Arrivals</div>
            </div>
          </div>
        </Card>
        <Card className="p-3 sm:p-4 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-200/50 dark:border-amber-800/30">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Clock className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-bold text-amber-600 tabular-nums">{stats.pending}</div>
              <div className="text-[10px] sm:text-xs text-muted-foreground">Pending Check-ins</div>
            </div>
          </div>
        </Card>
        <Card className="p-3 sm:p-4 bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 border border-violet-200/50 dark:border-violet-800/30">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <Crown className="h-4 w-4 text-violet-600" />
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-bold text-violet-600 tabular-nums">{stats.vip}</div>
              <div className="text-[10px] sm:text-xs text-muted-foreground">VIP Arrivals</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by confirmation code or guest name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-12 text-base focus:ring-2 focus:ring-primary/30 focus:border-primary/50 shadow-sm transition-all duration-200"
            />
          </div>
        </CardContent>
      </Card>

      {/* Arrivals List */}
      {isLoading ? (
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
      ) : bookings.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <LogIn className="h-12 w-12 mb-4" />
            <p>No arrivals scheduled for today</p>
            <p className="text-sm">All guests have been checked in or no bookings found</p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[500px]">
          <div className="space-y-4 pr-4">
            {bookings.map((booking) => {
              const nights = differenceInDays(new Date(booking.checkOut), new Date(booking.checkIn));
              const isCheckedIn = booking.status === 'checked_in';
              
              return (
                <Card key={booking.id} className={cn(
                  "transition-all",
                  isCheckedIn && "opacity-60"
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
                          <div className="flex items-center gap-2">
                            <p className="font-medium">
                              {booking.primaryGuest.firstName} {booking.primaryGuest.lastName}
                            </p>
                            {booking.primaryGuest.isVip && (
                              <Crown className="h-4 w-4 text-amber-500" />
                            )}
                            <Badge className={cn("text-xs", getLoyaltyColor(booking.primaryGuest.loyaltyTier))}>
                              {booking.primaryGuest.loyaltyTier}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <div className="flex items-center gap-4">
                              <span className="font-mono">{booking.confirmationCode}</span>
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {booking.adults} adult{booking.adults > 1 ? 's' : ''}
                                {booking.children > 0 && `, ${booking.children} child${booking.children > 1 ? 'ren' : ''}`}
                              </span>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="flex items-center gap-1">
                                <Building2 className="h-3 w-3" />
                                {booking.roomType.name}
                              </span>
                              {booking.room && (
                                <span className="flex items-center gap-1">
                                  <Key className="h-3 w-3" />
                                  Room {booking.room.number}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {nights} night{nights > 1 ? 's' : ''}
                              </span>
                              <span className="font-medium">{formatCurrency(booking.totalAmount)}</span>
                            </div>
                          </div>
                          {booking.specialRequests && (
                            <div className="mt-2 p-2 bg-muted/50 rounded text-xs text-muted-foreground">
                              <strong>Special Requests:</strong> {booking.specialRequests}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-2">
                        {isCheckedIn ? (
                          <Badge className="bg-emerald-500 text-white justify-center">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Checked In
                          </Badge>
                        ) : (
                          <Button onClick={() => openCheckIn(booking)} className="bg-emerald-600 hover:bg-emerald-700">
                            <LogIn className="h-4 w-4 mr-2" />
                            Check In
                          </Button>
                        )}
                        {booking.primaryGuest.phone && (
                          <Button variant="outline" size="sm" asChild>
                            <a href={`tel:${booking.primaryGuest.phone}`}>
                              <Phone className="h-3 w-3 mr-1" />
                              Call
                            </a>
                          </Button>
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

      {/* Check-in Dialog */}
      <Dialog open={isCheckInOpen} onOpenChange={setIsCheckInOpen}>
        <DialogContent className="w-[95vw] sm:max-w-lg max-h-[90dvh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>Check-in Guest</DialogTitle>
            <DialogDescription>
              {selectedBooking?.primaryGuest.firstName} {selectedBooking?.primaryGuest.lastName} - {selectedBooking?.confirmationCode}
            </DialogDescription>
          </DialogHeader>

          {selectedBooking && (
            <div className="space-y-4 flex-1 overflow-y-auto pr-2 -mr-2">
              {/* Booking Summary */}
              <Card className="p-4 bg-muted/50">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Room Type</span>
                    <p className="font-medium">{selectedBooking.roomType.name}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Nights</span>
                    <p className="font-medium">
                      {differenceInDays(new Date(selectedBooking.checkOut), new Date(selectedBooking.checkIn))} nights
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Check-out</span>
                    <p className="font-medium">{formatDate(selectedBooking.checkOut)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total Amount</span>
                    <p className="font-medium">{formatCurrency(selectedBooking.totalAmount)}</p>
                  </div>
                </div>
              </Card>

              {/* Room Selection */}
              {selectedBooking.room ? (
                <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <Key className="h-5 w-5 text-emerald-600" />
                  <div>
                    <span className="text-sm text-muted-foreground">Assigned Room</span>
                    <p className="font-medium text-emerald-700">Room {selectedBooking.room.number} (Floor {selectedBooking.room.floor})</p>
                  </div>
                </div>
              ) : availableRooms.length > 0 ? (
                <div className="space-y-2">
                  <Label>Select Room *</Label>
                  <Select value={selectedRoomId} onValueChange={setSelectedRoomId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a room" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRooms.map(room => (
                        <SelectItem key={room.id} value={room.id}>
                          Room {room.number} - Floor {room.floor} ({room.roomType.name})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {availableRooms.length} room(s) available
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                  <p className="text-sm text-amber-700">No rooms available for this room type</p>
                </div>
              )}

              {/* ID Verification */}
              <div className="space-y-2">
                <Label>ID Document</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Select value={idType} onValueChange={setIdType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="passport">Passport</SelectItem>
                      <SelectItem value="national_id">National ID</SelectItem>
                      <SelectItem value="driver_license">Driver License</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="ID Number"
                    value={idNumber}
                    onChange={(e) => setIdNumber(e.target.value)}
                  />
                </div>
              </div>

              {/* Late Check-out */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="lateCheckOut"
                  checked={lateCheckOut}
                  onChange={(e) => setLateCheckOut(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="lateCheckOut" className="text-sm font-normal">
                  Request late check-out (additional fee may apply)
                </Label>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  placeholder="Any special notes for this check-in..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          )}

          <DialogFooter className="shrink-0">
            <Button variant="outline" onClick={() => setIsCheckInOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={processCheckIn} 
              disabled={isProcessing || (!selectedBooking?.room && !selectedRoomId)}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4 mr-2" />
                  Complete Check-in
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* WiFi Credentials Dialog */}
      <Dialog open={showWifiDialog} onOpenChange={setShowWifiDialog}>
        <DialogContent className="w-[95vw] sm:max-w-md max-h-[90dvh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wifi className="h-5 w-5 text-emerald-600" />
              WiFi Credentials
            </DialogTitle>
            <DialogDescription>
              Provide these credentials to the guest for WiFi access
            </DialogDescription>
          </DialogHeader>

          {wifiCredentials && (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs text-muted-foreground">Username</span>
                      <p className="font-mono font-medium">{wifiCredentials.username}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(wifiCredentials.username, 'Username')}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs text-muted-foreground">Password</span>
                      <p className="font-mono font-medium">{wifiCredentials.password}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(wifiCredentials.password, 'Password')}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="pt-2 border-t border-emerald-200">
                    <span className="text-xs text-muted-foreground">Valid Until</span>
                    <p className="text-sm font-medium">{wifiCredentials.validUntil}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <p className="text-xs text-blue-700">
                  WiFi access will be automatically disabled at check-out time.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setShowWifiDialog(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
