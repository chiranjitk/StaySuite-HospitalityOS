'use client';

import React, { useState, useEffect } from 'react';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useTimezone } from '@/contexts/TimezoneContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  RotateCcw,
  Search,
  Loader2,
  DollarSign,
  Plus,
  Eye,
  AlertCircle,
  RefreshCw,
  CheckCircle,
  Clock,
  XCircle,
  TrendingUp,
  Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns'; // Keep for relative time formatting

interface Payment {
  id: string;
  amount: number;
  currency: string;
  method: string;
  gateway?: string;
  cardType?: string;
  cardLast4?: string;
  transactionId?: string;
  reference?: string;
  status: string;
  refundAmount: number;
  refundReason?: string;
  refundedAt?: string;
  createdAt: string;
  processedAt?: string;
  folio: {
    id: string;
    folioNumber: string;
    booking?: {
      id: string;
      confirmationCode: string;
      primaryGuest?: {
        firstName: string;
        lastName: string;
        email?: string;
      };
    };
  };
  guest?: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
  };
}

interface RefundRequest {
  id: string;
  paymentId: string;
  amount: number;
  reason: string;
  status: string;
  requestedAt: string;
  processedAt?: string;
  requestedBy?: string;
  payment?: Payment;
}

const refundStatuses = [
  { value: 'pending', label: 'Pending', color: 'bg-amber-500', icon: Clock },
  { value: 'approved', label: 'Approved', color: 'bg-cyan-500', icon: CheckCircle },
  { value: 'processed', label: 'Processed', color: 'bg-emerald-500', icon: CheckCircle },
  { value: 'rejected', label: 'Rejected', color: 'bg-red-500', icon: XCircle },
];

const methodOptions = [
  { value: 'all', label: 'All Methods' },
  { value: 'card', label: 'Credit/Debit Card' },
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'wallet', label: 'Digital Wallet' },
];

export default function Refunds() {
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const { formatDate, formatTime, formatDateTime, settings } = useTimezone();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [methodFilter, setMethodFilter] = useState<string>('all');

  // Dialog states
  const [isProcessOpen, setIsProcessOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Refund form state
  const [refundData, setRefundData] = useState({
    amount: '',
    reason: '',
    isPartial: false,
  });

  // Fetch payments with refunds
  const fetchPayments = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('status', 'refunded,partially_refunded,completed');
      if (searchQuery) params.append('search', searchQuery);
      if (methodFilter !== 'all') params.append('method', methodFilter);

      const response = await fetch(`/api/payments?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        // Filter to only show payments that can be refunded or have been refunded
        const refundablePayments = result.data.filter(
          (p: Payment) => p.status === 'completed' || p.status === 'refunded' || p.status === 'partially_refunded'
        );
        setPayments(refundablePayments);
      }
    } catch (error) {
      console.error('Error fetching payments:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch refund data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [methodFilter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length >= 2 || searchQuery.length === 0) {
        fetchPayments();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Process refund
  const handleRefund = async () => {
    if (!selectedPayment || !refundData.amount || !refundData.reason) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    const refundAmount = parseFloat(refundData.amount);
    const maxRefund = selectedPayment.amount - selectedPayment.refundAmount;

    if (refundAmount <= 0 || refundAmount > maxRefund) {
      toast({
        title: 'Validation Error',
        description: `Refund amount must be between ${formatCurrency(0.01)} and ${formatCurrency(maxRefund)}`,
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/payments/${selectedPayment.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refundAmount,
          refundReason: refundData.reason,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: refundData.isPartial ? 'Partial refund processed successfully' : 'Full refund processed successfully',
        });
        setIsProcessOpen(false);
        setRefundData({ amount: '', reason: '', isPartial: false });
        fetchPayments();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to process refund',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error processing refund:', error);
      toast({
        title: 'Error',
        description: 'Failed to process refund',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; color: string; icon: React.ElementType }> = {
      completed: { label: 'Completed', color: 'bg-gradient-to-r from-emerald-500 to-teal-400', icon: CheckCircle },
      pending: { label: 'Pending', color: 'bg-gradient-to-r from-amber-500 to-amber-400', icon: Clock },
      refunded: { label: 'Refunded', color: 'bg-gradient-to-r from-gray-500 to-gray-400', icon: RotateCcw },
      partially_refunded: { label: 'Partial Refund', color: 'bg-gradient-to-r from-orange-500 to-amber-400', icon: RotateCcw },
      failed: { label: 'Failed', color: 'bg-gradient-to-r from-red-500 to-rose-400', icon: XCircle },
    };
    const option = statusMap[status] || { label: status, color: 'bg-gray-500', icon: Clock };
    const Icon = option.icon;
    return (
      <Badge variant="secondary" className={cn('text-white gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium', option.color)}>
        <Icon className="h-3 w-3" />
        {option.label}
      </Badge>
    );
  };

  // Stats
  const totalRefunded = payments.reduce((sum, p) => sum + p.refundAmount, 0);
  const pendingRefunds = payments.filter(p => p.status === 'pending').length;
  const processedRefunds = payments.filter(p => p.status === 'refunded' || p.status === 'partially_refunded').length;
  const totalRefundable = payments
    .filter(p => p.status === 'completed')
    .reduce((sum, p) => sum + (p.amount - p.refundAmount), 0);

  const filteredPayments = payments.filter(p => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'refundable') return p.status === 'completed' && p.refundAmount < p.amount;
    if (statusFilter === 'refunded') return p.status === 'refunded' || p.status === 'partially_refunded';
    return p.status === statusFilter;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <RotateCcw className="h-5 w-5" />
            Refunds Management
          </h2>
          <p className="text-sm text-muted-foreground">
            Process and manage refund requests
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchPayments}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <Card className="p-4 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 hover:-translate-y-0.5">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Clock className="h-4 w-4 text-amber-500 dark:text-amber-400" />
            </div>
            <div>
              <div className="text-2xl font-bold bg-gradient-to-r from-amber-600 to-amber-400 bg-clip-text text-transparent">{pendingRefunds}</div>
              <div className="text-xs text-muted-foreground">Pending</div>
            </div>
          </div>
        </Card>
        <Card className="p-4 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 hover:-translate-y-0.5">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <CheckCircle className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
            </div>
            <div>
              <div className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-400 bg-clip-text text-transparent">{processedRefunds}</div>
              <div className="text-xs text-muted-foreground">Processed</div>
            </div>
          </div>
        </Card>
        <Card className="p-4 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 hover:-translate-y-0.5">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-red-500/10">
              <DollarSign className="h-4 w-4 text-red-500 dark:text-red-400" />
            </div>
            <div>
              <div className="text-2xl font-bold bg-gradient-to-r from-red-600 to-rose-400 bg-clip-text text-transparent">{formatCurrency(totalRefunded)}</div>
              <div className="text-xs text-muted-foreground">Total Refunded</div>
            </div>
          </div>
        </Card>
        <Card className="p-4 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 hover:-translate-y-0.5">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <TrendingUp className="h-4 w-4 text-cyan-500 dark:text-cyan-400" />
            </div>
            <div>
              <div className="text-2xl font-bold bg-gradient-to-r from-cyan-600 to-cyan-400 bg-clip-text text-transparent">{formatCurrency(totalRefundable)}</div>
              <div className="text-xs text-muted-foreground">Refundable</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/30 rounded-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by transaction ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={methodFilter} onValueChange={setMethodFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Method" />
              </SelectTrigger>
              <SelectContent>
                {methodOptions.map(method => (
                  <SelectItem key={method.value} value={method.value}>
                    {method.label}
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
                <SelectItem value="refundable">Refundable</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
                <SelectItem value="partially_refunded">Partial Refund</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Payments Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <RotateCcw className="h-12 w-12 mb-4" />
              <p>No refund records found</p>
              <p className="text-sm">No payments match the current filters</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Transaction</TableHead>
                    <TableHead>Guest</TableHead>
                    <TableHead>Original Amount</TableHead>
                    <TableHead>Refunded</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.map((payment) => {
                    const refundProgress = (payment.refundAmount / payment.amount) * 100;
                    const canRefund = payment.status === 'completed' && payment.refundAmount < payment.amount;

                    return (
                      <TableRow key={payment.id} className="hover:bg-muted/50 transition-colors">
                        <TableCell>
                          <div>
                            <p className="font-mono text-sm">{payment.transactionId}</p>
                            <p className="text-xs text-muted-foreground capitalize">
                              {payment.method.replace('_', ' ')}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {payment.folio?.booking?.primaryGuest ? (
                            <div>
                              <p className="text-sm">
                                {payment.folio.booking.primaryGuest.firstName} {payment.folio.booking.primaryGuest.lastName}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {payment.folio.booking.primaryGuest.email}
                              </p>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <p className="font-medium">{formatCurrency(payment.amount)}</p>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-red-600 dark:text-red-400">
                              {formatCurrency(payment.refundAmount)}
                            </p>
                            {payment.refundAmount > 0 && (
                              <Progress value={refundProgress} className="h-1.5" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(payment.status)}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm">{formatDate(payment.createdAt)}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(payment.createdAt))} ago
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => {
                                setSelectedPayment(payment);
                                setIsDetailOpen(true);
                              }}
                              title="View Details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {canRefund && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-amber-600 dark:text-amber-400"
                                onClick={() => {
                                  setSelectedPayment(payment);
                                  setRefundData({
                                    amount: (payment.amount - payment.refundAmount).toFixed(2),
                                    reason: '',
                                    isPartial: false,
                                  });
                                  setIsProcessOpen(true);
                                }}
                                title="Process Refund"
                              >
                                <RotateCcw className="h-4 w-4" />
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
          )}
        </CardContent>
      </Card>

      {/* Process Refund Dialog */}
      <Dialog open={isProcessOpen} onOpenChange={setIsProcessOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-5 w-5" />
              Process Refund
            </DialogTitle>
            <DialogDescription>
              Transaction: {selectedPayment?.transactionId}
            </DialogDescription>
          </DialogHeader>
          {selectedPayment && (
            <div className="grid gap-4 py-4">
              <Card className="p-4 bg-muted/50">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Original Amount</span>
                    <span>{formatCurrency(selectedPayment.amount)}</span>
                  </div>
                  {selectedPayment.refundAmount > 0 && (
                    <div className="flex justify-between text-amber-600 dark:text-amber-400">
                      <span>Already Refunded</span>
                      <span>{formatCurrency(selectedPayment.refundAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold">
                    <span>Available for Refund</span>
                    <span>{formatCurrency(selectedPayment.amount - selectedPayment.refundAmount)}</span>
                  </div>
                </div>
              </Card>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="partialRefund"
                  checked={refundData.isPartial}
                  onChange={(e) => {
                    const isPartial = e.target.checked;
                    setRefundData(prev => ({
                      ...prev,
                      isPartial,
                      amount: isPartial ? '' : (selectedPayment.amount - selectedPayment.refundAmount).toFixed(2),
                    }));
                  }}
                  className="h-4 w-4"
                />
                <Label htmlFor="partialRefund">Partial refund</Label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="refundAmount">Refund Amount</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="refundAmount"
                    type="number"
                    min="0.01"
                    max={selectedPayment.amount - selectedPayment.refundAmount}
                    step="0.01"
                    placeholder="0.00"
                    value={refundData.amount}
                    onChange={(e) => setRefundData(prev => ({ ...prev, amount: e.target.value }))}
                    className="pl-9"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRefundData(prev => ({
                      ...prev,
                      amount: ((selectedPayment.amount - selectedPayment.refundAmount) / 2).toFixed(2),
                      isPartial: true,
                    }))}
                  >
                    50%
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRefundData(prev => ({
                      ...prev,
                      amount: (selectedPayment.amount - selectedPayment.refundAmount).toFixed(2),
                      isPartial: false,
                    }))}
                  >
                    Full
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="refundReason">Reason for Refund *</Label>
                <Select
                  value={refundData.reason}
                  onValueChange={(value) => setRefundData(prev => ({ ...prev, reason: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select reason" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="guest_request">Guest Request</SelectItem>
                    <SelectItem value="cancellation">Booking Cancellation</SelectItem>
                    <SelectItem value="service_issue">Service Issue</SelectItem>
                    <SelectItem value="billing_error">Billing Error</SelectItem>
                    <SelectItem value="duplicate_charge">Duplicate Charge</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {refundData.reason === 'other' && (
                <div className="space-y-2">
                  <Label htmlFor="otherReason">Please specify</Label>
                  <Textarea
                    id="otherReason"
                    placeholder="Enter reason for refund..."
                    rows={2}
                  />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsProcessOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRefund} disabled={isSaving} className="bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white shadow-md hover:shadow-lg transition-all">
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Process Refund
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Details Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Payment & Refund Details
            </DialogTitle>
          </DialogHeader>
          {selectedPayment && (
            <div className="space-y-4">
              <Card className="p-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Transaction ID</span>
                    <span className="font-mono">{selectedPayment.transactionId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    {getStatusBadge(selectedPayment.status)}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Method</span>
                    <span className="capitalize">{selectedPayment.method.replace('_', ' ')}</span>
                  </div>
                  {selectedPayment.gateway && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Gateway</span>
                      <span className="capitalize">{selectedPayment.gateway}</span>
                    </div>
                  )}
                </div>
              </Card>

              <Card className="p-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Original Amount</span>
                    <span className="font-medium">{formatCurrency(selectedPayment.amount)}</span>
                  </div>
                  {selectedPayment.refundAmount > 0 && (
                    <>
                      <div className="flex justify-between text-red-600 dark:text-red-400">
                        <span>Refunded</span>
                        <span>-{formatCurrency(selectedPayment.refundAmount)}</span>
                      </div>
                      {selectedPayment.refundReason && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Reason: {selectedPayment.refundReason}
                        </div>
                      )}
                      {selectedPayment.refundedAt && (
                        <div className="text-xs text-muted-foreground">
                          Refunded: {formatDateTime(selectedPayment.refundedAt)}
                        </div>
                      )}
                    </>
                  )}
                  <div className="flex justify-between font-bold pt-2 border-t">
                    <span>Net Amount</span>
                    <span>{formatCurrency(selectedPayment.amount - selectedPayment.refundAmount)}</span>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Folio</span>
                    <span className="font-mono">{selectedPayment.folio?.folioNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Created</span>
                    <span>{formatDateTime(selectedPayment.createdAt)}</span>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
