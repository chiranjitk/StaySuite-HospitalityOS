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
import { Separator } from '@/components/ui/separator';
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
  LogOut, 
  Search,
  Users,
  Crown,
  Clock,
  Phone,
  Building2,
  Key,
  RefreshCw,
  CheckCircle2,
  CreditCard,
  Receipt,
  DollarSign,
  AlertCircle,
  Wallet,
  Printer,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { differenceInDays, startOfDay, endOfDay } from 'date-fns';

interface Room {
  id: string;
  number: string;
  floor: number;
  status: string;
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

interface Folio {
  id: string;
  folioNumber: string;
  subtotal: number;
  taxes: number;
  discount: number;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  status: string;
  lineItems: {
    id: string;
    description: string;
    category: string;
    quantity: number;
    unitPrice: number;
    totalAmount: number;
    serviceDate: string;
  }[];
  payments: {
    id: string;
    amount: number;
    method: string;
    status: string;
    createdAt: string;
  }[];
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
  actualCheckIn?: string;
  primaryGuest: Guest;
  room?: Room;
  roomType: { id: string; name: string; code: string };
  property: { id: string; name: string; checkOutTime: string };
  folios?: Folio[];
}

const paymentMethods = [
  { value: 'card', label: 'Credit/Debit Card' },
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'wallet', label: 'Digital Wallet' },
  { value: 'check', label: 'Check' },
];

export default function CheckOut() {
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const { formatDate } = useTimezone();
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [selectedFolio, setSelectedFolio] = useState<Folio | null>(null);
  const [isCheckOutOpen, setIsCheckOutOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Payment form
  const [paymentMethod, setPaymentMethod] = useState<string>('card');
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentReference, setPaymentReference] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Fetch today's departures
  const fetchDepartures = async () => {
    setIsLoading(true);
    try {
      const today = new Date();
      const params = new URLSearchParams();
      params.append('status', 'checked_in');
      params.append('checkInFrom', startOfDay(today).toISOString());
      params.append('checkInTo', endOfDay(today).toISOString());
      if (searchQuery) params.append('search', searchQuery);

      const response = await fetch(`/api/bookings?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        // Filter to only show check-outs for today
        const todayDepartures = result.data.filter((b: Booking) => {
          const checkOut = new Date(b.checkOut);
          return checkOut.toDateString() === today.toDateString();
        });
        setBookings(todayDepartures);
      }
    } catch (error) {
      console.error('Error fetching departures:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch departures',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartures();
  }, [searchQuery]);

  // Fetch booking details with folio
  const fetchBookingDetails = async (bookingId: string) => {
    try {
      const response = await fetch(`/api/bookings/${bookingId}`);
      const result = await response.json();
      if (result.success) {
        setSelectedBooking(result.data);
        if (result.data.folios && result.data.folios.length > 0) {
          setSelectedFolio(result.data.folios[0]);
          setPaymentAmount(result.data.folios[0].balance.toString());
        } else {
          setSelectedFolio(null);
          setPaymentAmount(result.data.totalAmount.toString());
        }
      }
    } catch (error) {
      console.error('Error fetching booking details:', error);
    }
  };

  // Open check-out dialog
  const openCheckOut = async (booking: Booking) => {
    await fetchBookingDetails(booking.id);
    setIsCheckOutOpen(true);
  };

  // Process payment
  const processPayment = async () => {
    if (!selectedBooking || !selectedFolio) return;

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a valid payment amount',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: user?.tenantId || '',
          folioId: selectedFolio.id,
          guestId: selectedBooking.primaryGuest.id,
          amount,
          currency: selectedBooking.currency,
          method: paymentMethod,
          reference: paymentReference || undefined,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Payment Recorded',
          description: `Payment of ${formatCurrency(amount)} processed`,
        });
        // Refresh booking details
        await fetchBookingDetails(selectedBooking.id);
        setIsPaymentOpen(false);
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to process payment',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error processing payment:', error);
      toast({
        title: 'Error',
        description: 'Failed to process payment',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Process check-out
  const processCheckOut = async () => {
    if (!selectedBooking) return;

    // Check if balance is due
    if (selectedFolio && selectedFolio.balance > 0) {
      toast({
        title: 'Outstanding Balance',
        description: 'Please settle the balance before check-out',
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
          status: 'checked_out',
          actualCheckOut: new Date().toISOString(),
          checkedOutBy: user?.id || '',
          notes: notes || undefined,
        }),
      });

      const result = await response.json();

      if (result.success) {
        const roomNumber = selectedBooking.room?.number;
        
        // Build success message with WiFi status
        let successMessage = `Guest checked out from Room ${roomNumber || 'assigned'}`;
        const additionalActions: string[] = [];
        
        if (result.wifi?.deprovisioned) {
          additionalActions.push('WiFi disabled');
        }
        additionalActions.push('room marked for cleaning');
        
        if (additionalActions.length > 0) {
          successMessage += `. ${additionalActions.join(', ')}.`;
        }

        toast({
          title: 'Check-out Successful',
          description: successMessage,
        });
        setIsCheckOutOpen(false);
        fetchDepartures();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to process check-out',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error processing check-out:', error);
      toast({
        title: 'Error',
        description: 'Failed to process check-out',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  };

  const getLoyaltyColor = (tier: string) => {
    const colors: Record<string, string> = {
      bronze: 'text-amber-700 dark:text-amber-300 bg-amber-100',
      silver: 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800',
      gold: 'text-yellow-600 dark:text-yellow-400 bg-yellow-100',
      platinum: 'text-violet-600 dark:text-violet-400 bg-violet-100',
    };
    return colors[tier] || colors.bronze;
  };

  // Stats
  const stats = {
    total: bookings.length,
    checkingOut: bookings.length,
    withBalance: bookings.filter(b => b.folios?.[0]?.balance ?? 0 > 0).length,
    vip: bookings.filter(b => b.primaryGuest.isVip).length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <LogOut className="h-5 w-5" />
            Check-out
          </h2>
          <p className="text-sm text-muted-foreground">
            Today&apos;s departures - {formatDate(new Date())}
          </p>
        </div>
        <Button variant="outline" onClick={() => fetchDepartures()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <Card className="p-4">
          <div className="text-2xl font-bold">{stats.total}</div>
          <div className="text-xs text-muted-foreground">Today&apos;s Departures</div>
        </Card>
        <Card className="p-4 border-l-4 border-l-amber-500">
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.checkingOut}</div>
          <div className="text-xs text-muted-foreground">Checking Out</div>
        </Card>
        <Card className="p-4 border-l-4 border-l-rose-500">
          <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">{stats.withBalance}</div>
          <div className="text-xs text-muted-foreground">Outstanding Balance</div>
        </Card>
        <Card className="p-4 border-l-4 border-l-violet-500">
          <div className="text-2xl font-bold text-violet-600 dark:text-violet-400">{stats.vip}</div>
          <div className="text-xs text-muted-foreground">VIP Guests</div>
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
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Departures List */}
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
            <LogOut className="h-12 w-12 mb-4" />
            <p>No departures scheduled for today</p>
            <p className="text-sm">All guests have checked out or no bookings found</p>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[500px]">
          <div className="space-y-4 pr-4">
            {bookings.map((booking) => {
              const nights = differenceInDays(new Date(booking.checkOut), new Date(booking.checkIn));
              const hasBalance = (booking.folios?.[0]?.balance ?? 0) > 0;
              
              return (
                <Card key={booking.id}>
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
                              <Crown className="h-4 w-4 text-amber-500 dark:text-amber-400" />
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
                          {hasBalance && (
                            <div className="mt-2 flex items-center gap-2 text-sm text-rose-600 dark:text-rose-400">
                              <AlertCircle className="h-4 w-4" />
                              Outstanding balance: {formatCurrency(booking.folios?.[0]?.balance ?? 0)}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-2">
                        <Button onClick={() => openCheckOut(booking)} className="bg-amber-600 hover:bg-amber-700">
                          <LogOut className="h-4 w-4 mr-2" />
                          Check Out
                        </Button>
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

      {/* Check-out Dialog */}
      <Dialog open={isCheckOutOpen} onOpenChange={setIsCheckOutOpen}>
        <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Check-out Guest</DialogTitle>
            <DialogDescription>
              {selectedBooking?.primaryGuest.firstName} {selectedBooking?.primaryGuest.lastName} - {selectedBooking?.confirmationCode}
            </DialogDescription>
          </DialogHeader>

          {selectedBooking && (
            <div className="space-y-4">
              {/* Room Info */}
              <Card className="p-4 bg-muted/50">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Room</span>
                    <p className="font-medium">Room {selectedBooking.room?.number} - {selectedBooking.roomType.name}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Stay Duration</span>
                    <p className="font-medium">
                      {selectedBooking.actualCheckIn
                        ? formatDate(selectedBooking.actualCheckIn)
                        : formatDate(selectedBooking.checkIn)
                      } - {formatDate(new Date())}
                    </p>
                  </div>
                </div>
              </Card>

              {/* Billing Summary */}
              {selectedFolio ? (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Receipt className="h-4 w-4" />
                      Folio {selectedFolio.folioNumber}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {/* Line Items */}
                    <div className="space-y-2 mb-4">
                      {selectedFolio.lineItems.map(item => (
                        <div key={item.id} className="flex justify-between text-sm">
                          <div>
                            <span>{item.description}</span>
                            {item.quantity > 1 && <span className="text-muted-foreground"> x{item.quantity}</span>}
                          </div>
                          <span>{formatCurrency(item.totalAmount)}</span>
                        </div>
                      ))}
                    </div>

                    <Separator className="my-2" />

                    {/* Totals */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span>{formatCurrency(selectedFolio.subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Taxes</span>
                        <span>{formatCurrency(selectedFolio.taxes)}</span>
                      </div>
                      {selectedFolio.discount > 0 && (
                        <div className="flex justify-between text-sm text-emerald-600 dark:text-emerald-400">
                          <span>Discount</span>
                          <span>-{formatCurrency(selectedFolio.discount)}</span>
                        </div>
                      )}
                      <Separator className="my-2" />
                      <div className="flex justify-between font-medium">
                        <span>Total</span>
                        <span>{formatCurrency(selectedFolio.totalAmount)}</span>
                      </div>
                      <div className="flex justify-between text-sm text-emerald-600 dark:text-emerald-400">
                        <span>Paid</span>
                        <span>{formatCurrency(selectedFolio.paidAmount)}</span>
                      </div>
                      <div className={cn(
                        "flex justify-between font-medium",
                        selectedFolio.balance > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
                      )}>
                        <span>Balance</span>
                        <span>{formatCurrency(selectedFolio.balance)}</span>
                      </div>
                    </div>

                    {/* Payments */}
                    {selectedFolio.payments.length > 0 && (
                      <div className="mt-4 pt-4 border-t">
                        <p className="text-sm font-medium mb-2">Payments</p>
                        {selectedFolio.payments.map(payment => (
                          <div key={payment.id} className="flex justify-between text-sm text-muted-foreground">
                            <span>{payment.method} - {formatDate(payment.createdAt)}</span>
                            <span>{formatCurrency(payment.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Actions */}
                    {selectedFolio.balance > 0 && (
                      <div className="mt-4 flex gap-2">
                        <Button 
                          variant="outline" 
                          className="flex-1"
                          onClick={() => setIsPaymentOpen(true)}
                        >
                          <CreditCard className="h-4 w-4 mr-2" />
                          Take Payment
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card className="p-4 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                    <AlertCircle className="h-5 w-5" />
                    <span>No folio found. Please create a folio for this booking.</span>
                  </div>
                </Card>
              )}

              {/* Notes */}
              <div className="space-y-2">
                <Label>Check-out Notes</Label>
                <Textarea
                  placeholder="Any notes for this check-out..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCheckOutOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={processCheckOut} 
              disabled={isProcessing || ((selectedFolio?.balance ?? 0) > 0)}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <LogOut className="h-4 w-4 mr-2" />
                  Complete Check-out
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md max-h-[90dvh]">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Record payment for folio {selectedFolio?.folioNumber}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Balance */}
            {selectedFolio && (
              <div className="flex justify-between items-center p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-lg">
                <span className="text-rose-600 dark:text-rose-400">Outstanding Balance</span>
                <span className="font-bold text-rose-600 dark:text-rose-400">{formatCurrency(selectedFolio.balance)}</span>
              </div>
            )}

            {/* Payment Method */}
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethods.map(method => (
                    <SelectItem key={method.value} value={method.value}>
                      {method.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <Label>Amount</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Reference */}
            <div className="space-y-2">
              <Label>Reference (Optional)</Label>
              <Input
                placeholder="Transaction ID, receipt number..."
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPaymentOpen(false)}>
              Cancel
            </Button>
            <Button onClick={processPayment} disabled={isProcessing}>
              {isProcessing ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CreditCard className="h-4 w-4 mr-2" />
              )}
              Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
