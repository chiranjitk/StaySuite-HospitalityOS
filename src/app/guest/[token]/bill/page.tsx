'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useGuestApp } from '../layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  FileText,
  Download,
  CreditCard,
  Receipt,
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface FolioLineItem {
  id: string;
  description: string;
  category: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  serviceDate: string;
  createdAt: string;
}

interface FolioData {
  id: string;
  folioNumber: string;
  subtotal: number;
  taxes: number;
  discount: number;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  currency: string;
  status: string;
  lineItems: FolioLineItem[];
  payments: Array<{
    id: string;
    amount: number;
    method: string;
    cardType?: string;
    cardLast4?: string;
    createdAt: string;
  }>;
}

const categoryIcons: Record<string, string> = {
  room: '🛏️',
  food_beverage: '🍽️',
  service: '🔧',
  tax: '📊',
  discount: '💰',
  amenity: '✨',
  other: '📦',
};

export default function BillPage() {
  const router = useRouter();
  const { data: guestData, isLoading: guestLoading } = useGuestApp();
  const { toast } = useToast();

  const [folio, setFolio] = useState<FolioData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Fetch detailed folio data
  useEffect(() => {
    const fetchFolio = async () => {
      if (!guestData) return;

      setIsLoading(true);
      try {
        // Get folio from booking
        const token = window.location.pathname.split('/')[2];
        const response = await fetch(`/api/folios?bookingId=${guestData.booking.id}`);
        const result = await response.json();

        if (result.success && result.data.length > 0) {
          // Get detailed folio with line items
          const folioId = result.data[0].id;
          const detailResponse = await fetch(`/api/folios/${folioId}`);
          const detailResult = await detailResponse.json();

          if (detailResult.success) {
            setFolio(detailResult.data);
          }
        }
      } catch (error) {
        console.error('Error fetching folio:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFolio();
  }, [guestData]);

  // Handle payment
  const handlePayment = async () => {
    setIsProcessingPayment(true);
    try {
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      toast({
        title: 'Payment Successful',
        description: 'Your payment has been processed',
      });
      setIsPaymentDialogOpen(false);
    } catch (error) {
      toast({
        title: 'Payment Failed',
        description: 'Please try again or contact the front desk',
        variant: 'destructive',
      });
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Loading state
  if (guestLoading || isLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!guestData) {
    return null;
  }

  const { bill, property, booking } = guestData;

  // Group line items by date
  const groupedItems = folio?.lineItems.reduce((groups: Record<string, FolioLineItem[]>, item) => {
    const date = format(new Date(item.serviceDate), 'yyyy-MM-dd');
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(item);
    return groups;
  }, {}) || {};

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Your Bill</h2>
          <p className="text-sm text-muted-foreground">
            Booking #{booking.confirmationCode}
          </p>
        </div>
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-1" />
          Export
        </Button>
      </div>

      {/* Balance Card */}
      <Card className={cn(
        'overflow-hidden',
        bill.balanceDue > 0 ? 'bg-gradient-to-br from-amber-500 to-orange-600' : 'bg-gradient-to-br from-emerald-500 to-teal-600'
      )}>
        <CardContent className="p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {bill.balanceDue > 0 ? (
                <AlertCircle className="h-5 w-5" />
              ) : (
                <CheckCircle2 className="h-5 w-5" />
              )}
              <span className="text-sm font-medium">
                {bill.balanceDue > 0 ? 'Balance Due' : 'Paid in Full'}
              </span>
            </div>
            {bill.balanceDue > 0 && (
              <Badge className="bg-white/20 text-white border-0">
                Outstanding
              </Badge>
            )}
          </div>

          <div className="mb-4">
            <p className="text-white/80 text-sm">Total Amount</p>
            <p className="text-3xl font-bold">
              {bill.currency} {bill.balanceDue.toFixed(2)}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/20">
            <div>
              <p className="text-white/60 text-xs">Total Charges</p>
              <p className="font-semibold">{bill.currency} {bill.totalCharges.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-white/60 text-xs">Amount Paid</p>
              <p className="font-semibold">{bill.currency} {bill.totalPaid.toFixed(2)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Pay */}
      {bill.balanceDue > 0 && (
        <Button
          className="w-full bg-gradient-to-r from-sky-500 to-indigo-600"
          onClick={() => setIsPaymentDialogOpen(true)}
        >
          <CreditCard className="h-4 w-4 mr-2" />
          Pay Now - {bill.currency} {bill.balanceDue.toFixed(2)}
        </Button>
      )}

      {/* Charges by Date */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-base">Charges</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {Object.keys(groupedItems).length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No charges yet</p>
              <p className="text-sm">Charges will appear here as you use hotel services</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[400px]">
              {Object.entries(groupedItems)
                .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
                .map(([date, items]) => (
                  <div key={date}>
                    <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/50 sticky top-0">
                      <p className="text-xs font-medium text-muted-foreground">
                        {format(new Date(date), 'EEEE, MMMM d, yyyy')}
                      </p>
                    </div>
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="px-4 py-3 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 last:border-0"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg">
                            {categoryIcons[item.category] || '📦'}
                          </span>
                          <div>
                            <p className="text-sm font-medium">{item.description}</p>
                            {item.quantity > 1 && (
                              <p className="text-xs text-muted-foreground">
                                {item.quantity}x @ {bill.currency} {item.unitPrice.toFixed(2)}
                              </p>
                            )}
                          </div>
                        </div>
                        <p className="font-medium text-sm">
                          {bill.currency} {item.totalAmount.toFixed(2)}
                        </p>
                      </div>
                    ))}
                  </div>
                ))}
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Bill Summary */}
      <Card>
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-base">Summary</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Room Charges</span>
              <span>{bill.currency} {(bill.totalCharges * 0.7).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">F&B</span>
              <span>{bill.currency} {(bill.totalCharges * 0.15).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Services</span>
              <span>{bill.currency} {(bill.totalCharges * 0.08).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Taxes & Fees</span>
              <span>{bill.currency} {(bill.totalCharges * 0.07).toFixed(2)}</span>
            </div>

            <Separator />

            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span>{bill.currency} {bill.totalCharges.toFixed(2)}</span>
            </div>

            {bill.totalPaid > 0 && (
              <>
                <div className="flex justify-between text-sm text-emerald-600">
                  <span>Paid</span>
                  <span>-{bill.currency} {bill.totalPaid.toFixed(2)}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-bold text-lg">
                  <span>Balance Due</span>
                  <span className={bill.balanceDue > 0 ? 'text-amber-600' : 'text-emerald-600'}>
                    {bill.currency} {bill.balanceDue.toFixed(2)}
                  </span>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Payment History */}
      {folio && folio.payments.length > 0 && (
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-base">Payment History</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {folio.payments.map((payment) => (
              <div
                key={payment.id}
                className="px-4 py-3 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <CreditCard className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium capitalize">{payment.method}</p>
                    {payment.cardLast4 && (
                      <p className="text-xs text-muted-foreground">
                        {payment.cardType} ****{payment.cardLast4}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(payment.createdAt), 'MMM d, yyyy HH:mm')}
                    </p>
                  </div>
                </div>
                <p className="font-medium text-emerald-600">
                  +{bill.currency} {payment.amount.toFixed(2)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Help */}
      <Card className="bg-slate-50 dark:bg-slate-800/50">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground text-center">
            Questions about your bill?{' '}
            <button
              onClick={() => router.push(`/guest/${window.location.pathname.split('/')[2]}/chat`)}
              className="text-sky-600 dark:text-sky-400 font-medium hover:underline"
            >
              Chat with front desk
            </button>
          </p>
        </CardContent>
      </Card>

      {/* Payment Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Make Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg text-center">
              <p className="text-sm text-muted-foreground">Amount to Pay</p>
              <p className="text-2xl font-bold mt-1">
                {bill.currency} {bill.balanceDue.toFixed(2)}
              </p>
            </div>

            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full justify-between"
                disabled
              >
                <span>Credit Card</span>
                <span className="text-muted-foreground">Unavailable</span>
              </Button>
              <Button
                variant="outline"
                className="w-full justify-between"
                disabled
              >
                <span>Apple Pay</span>
                <span className="text-muted-foreground">Unavailable</span>
              </Button>
              <Button
                variant="outline"
                className="w-full justify-between"
                disabled
              >
                <span>Google Pay</span>
                <span className="text-muted-foreground">Unavailable</span>
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              For now, please visit the front desk to make a payment or charge to your room.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
