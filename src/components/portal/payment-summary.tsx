'use client';

import React, { useState } from 'react';
import { useCurrency } from '@/contexts/CurrencyContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  CreditCard,
  Loader2,
  CheckCircle2,
  AlertCircle,
  DollarSign,
  Calendar,
  Bed,
  Users,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface PaymentSummaryProps {
  booking: {
    id: string;
    confirmationCode: string;
    checkIn: string;
    checkOut: string;
    adults: number;
    children: number;
    infants: number;
    roomRate: number;
    totalAmount: number;
    currency: string;
    status: string;
    discount?: number;
  };
  roomType: {
    id: string;
    name: string;
    description?: string;
    property?: {
      id: string;
      name: string;
      address: string;
      city: string;
    } | null;
  };
  payment: {
    totalBilled: number;
    totalPaid: number;
    balanceDue: number;
    currency: string;
  };
  isComplete: boolean;
  onComplete: () => void;
}

export function PaymentSummary({ 
  booking, 
  roomType, 
  payment, 
  isComplete, 
  onComplete 
}: PaymentSummaryProps) {
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const [isLoading, setIsLoading] = useState(false);

  const nights = Math.ceil(
    (new Date(booking.checkOut).getTime() - new Date(booking.checkIn).getTime()) / (1000 * 60 * 60 * 24)
  );

  const handlePayment = async () => {
    setIsLoading(true);
    try {
      // In a real implementation, this would redirect to a payment gateway
      // For now, we'll show a message
      toast({
        title: 'Payment Gateway',
        description: 'Redirecting to payment gateway...',
      });
      
      // Simulate payment process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast({
        title: 'Demo Mode',
        description: 'Payment gateway integration would redirect here',
      });
    } catch (error) {
      console.error('Payment error:', error);
      toast({
        title: 'Error',
        description: 'Failed to process payment',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600">
              <CreditCard className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold">Payment Summary</CardTitle>
              <CardDescription>Review your booking charges</CardDescription>
            </div>
          </div>
          {isComplete ? (
            <Badge className="bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Paid
            </Badge>
          ) : payment.balanceDue > 0 ? (
            <Badge variant="secondary" className="bg-amber-100 text-amber-700">
              <AlertCircle className="h-3 w-3 mr-1" />
              Balance Due
            </Badge>
          ) : (
            <Badge className="bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Paid
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Booking Info */}
        <div className="p-3 rounded-lg bg-muted/50">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium">{roomType.name}</span>
            <Badge variant="outline" className="text-xs">
              {booking.confirmationCode}
            </Badge>
          </div>
          {roomType.property && (
            <p className="text-sm text-muted-foreground">
              {roomType.property.name}
            </p>
          )}
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Calendar className="h-3 w-3" />
              <span className="text-xs">Check-in</span>
            </div>
            <p className="font-medium">
              {format(new Date(booking.checkIn), 'MMM dd, yyyy')}
            </p>
            <p className="text-xs text-muted-foreground">From 14:00</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Calendar className="h-3 w-3" />
              <span className="text-xs">Check-out</span>
            </div>
            <p className="font-medium">
              {format(new Date(booking.checkOut), 'MMM dd, yyyy')}
            </p>
            <p className="text-xs text-muted-foreground">Until 11:00</p>
          </div>
        </div>

        {/* Guests */}
        <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">
              {booking.adults} Adult{booking.adults > 1 ? 's' : ''}
            </span>
          </div>
          {booking.children > 0 && (
            <span className="text-sm text-muted-foreground">
              {booking.children} Child{booking.children > 1 ? 'ren' : ''}
            </span>
          )}
          {booking.infants > 0 && (
            <span className="text-sm text-muted-foreground">
              {booking.infants} Infant{booking.infants > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Pricing Breakdown */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Room Rate × {nights} night{nights > 1 ? 's' : ''}
            </span>
            <span>{formatCurrency(booking.roomRate * nights)}</span>
          </div>
          
          {booking.totalAmount > booking.roomRate * nights && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Taxes & Fees</span>
              <span>
                {formatCurrency(booking.totalAmount - booking.roomRate * nights)}
              </span>
            </div>
          )}
          
          {booking.discount != null && booking.discount > 0 && (
            <div className="flex items-center justify-between text-sm text-emerald-600">
              <span>Discount</span>
              <span>-{formatCurrency(booking.discount)}</span>
            </div>
          )}

          <Separator />

          <div className="flex items-center justify-between font-medium">
            <span>Total Amount</span>
            <span>{formatCurrency(booking.totalAmount)}</span>
          </div>

          {payment.totalPaid > 0 && (
            <div className="flex items-center justify-between text-sm text-emerald-600">
              <span>Amount Paid</span>
              <span>-{formatCurrency(payment.totalPaid)}</span>
            </div>
          )}
        </div>

        {/* Balance Due */}
        {payment.balanceDue > 0 && (
          <>
            <Separator />
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
              <div className="flex items-center justify-between">
                <span className="font-medium text-amber-800">Balance Due</span>
                <span className="text-lg font-bold text-amber-800">
                  {formatCurrency(payment.balanceDue)}
                </span>
              </div>
            </div>
            
            <Button className="w-full" onClick={handlePayment} disabled={isLoading}>
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <CreditCard className="h-4 w-4 mr-2" />
              Pay Now
            </Button>
          </>
        )}

        {payment.balanceDue <= 0 && (
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-center">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 mx-auto mb-1" />
            <p className="font-medium text-emerald-800">Payment Complete</p>
            <p className="text-xs text-emerald-600">
              Total paid: {formatCurrency(payment.totalPaid)}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
