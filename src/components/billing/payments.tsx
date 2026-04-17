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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  CreditCard,
  Banknote,
  Building2,
  Wallet,
  Search,
  Loader2,
  DollarSign,
  Plus,
  Eye,
  RotateCcw,
  AlertCircle,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  CreditCard as CardIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns'; // Keep for relative time formatting

interface Folio {
  id: string;
  folioNumber: string;
  balance: number;
  totalAmount: number;
  paidAmount: number;
  status: string;
  booking?: {
    id: string;
    confirmationCode: string;
    primaryGuest?: {
      id: string;
      firstName: string;
      lastName: string;
      email?: string;
    };
  };
}

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

const paymentStatuses = [
  { value: 'pending', label: 'Pending', color: 'bg-gradient-to-r from-amber-500 to-amber-400', icon: Clock },
  { value: 'completed', label: 'Completed', color: 'bg-gradient-to-r from-emerald-500 to-teal-400', icon: CheckCircle },
  { value: 'failed', label: 'Failed', color: 'bg-gradient-to-r from-red-500 to-rose-400', icon: XCircle },
  { value: 'refunded', label: 'Refunded', color: 'bg-gradient-to-r from-gray-500 to-gray-400', icon: RotateCcw },
  { value: 'partially_refunded', label: 'Partial Refund', color: 'bg-gradient-to-r from-orange-500 to-amber-400', icon: RotateCcw },
];

const methodBadgeColors: Record<string, string> = {
  card: 'bg-gradient-to-r from-blue-500 to-blue-400',
  cash: 'bg-gradient-to-r from-emerald-500 to-emerald-400',
  bank_transfer: 'bg-gradient-to-r from-amber-500 to-amber-400',
  wallet: 'bg-gradient-to-r from-teal-500 to-teal-400',
  check: 'bg-gradient-to-r from-gray-500 to-gray-400',
};

const paymentMethods = [
  { value: 'card', label: 'Credit/Debit Card', icon: CreditCard, description: 'Visa, Mastercard, Amex' },
  { value: 'cash', label: 'Cash', icon: Banknote, description: 'Cash payment' },
  { value: 'bank_transfer', label: 'Bank Transfer', icon: Building2, description: 'Wire transfer' },
  { value: 'wallet', label: 'Digital Wallet', icon: Wallet, description: 'Apple Pay, Google Pay' },
  { value: 'check', label: 'Check', icon: CreditCard, description: 'Personal/Business check' },
];

const cardTypes = [
  { value: 'visa', label: 'Visa' },
  { value: 'mastercard', label: 'Mastercard' },
  { value: 'amex', label: 'American Express' },
  { value: 'discover', label: 'Discover' },
];

const gateways = [
  { value: 'stripe', label: 'Stripe' },
  { value: 'paypal', label: 'PayPal' },
  { value: 'square', label: 'Square' },
  { value: 'manual', label: 'Manual' },
];

export default function Payments() {
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const { formatDate, formatTime, formatDateTime, settings } = useTimezone();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [folios, setFolios] = useState<Folio[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [summary, setSummary] = useState({
    totalAmount: 0,
    totalRefunded: 0,
    count: 0,
  });

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isRefundOpen, setIsRefundOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    folioId: '',
    amount: '',
    method: 'card',
    gateway: 'manual',
    cardType: '',
    cardLast4: '',
    cardExpiry: '',
    reference: '',
  });

  // Refund form state
  const [refundData, setRefundData] = useState({
    amount: '',
    reason: '',
  });

  // Fetch folios for dropdown
  useEffect(() => {
    const fetchFolios = async () => {
      try {
        const response = await fetch('/api/folios?limit=100');
        const result = await response.json();
        if (result.success) {
          // Filter folios with outstanding balance
          setFolios(result.data.filter((f: Folio) => f.balance > 0));
          if (result.data.length > 0) {
            const firstFolio = result.data.find((f: Folio) => f.balance > 0);
            if (firstFolio) {
              setFormData(prev => ({
                ...prev,
                folioId: firstFolio.id,
                amount: firstFolio.balance.toString(),
              }));
            }
          }
        }
      } catch (error) {
        console.error('Error fetching folios:', error);
      }
    };
    fetchFolios();
  }, []);

  // Fetch payments
  const fetchPayments = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (methodFilter !== 'all') params.append('method', methodFilter);

      const response = await fetch(`/api/payments?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setPayments(result.data);
        setSummary(result.summary);
      }
    } catch (error) {
      console.error('Error fetching payments:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch payments',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [statusFilter, methodFilter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length >= 2 || searchQuery.length === 0) {
        fetchPayments();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // View payment details
  const viewPaymentDetails = async (paymentId: string) => {
    try {
      const response = await fetch(`/api/payments/${paymentId}`);
      const result = await response.json();

      if (result.success) {
        setSelectedPayment(result.data);
        setIsDetailOpen(true);
      }
    } catch (error) {
      console.error('Error fetching payment details:', error);
    }
  };

  // Create payment
  const handleCreate = async () => {
    if (!formData.folioId || !formData.amount || !formData.method) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    if (parseFloat(formData.amount) <= 0) {
      toast({
        title: 'Validation Error',
        description: 'Amount must be greater than 0',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folioId: formData.folioId,
          amount: parseFloat(formData.amount),
          method: formData.method,
          gateway: formData.gateway,
          cardType: formData.cardType || undefined,
          cardLast4: formData.cardLast4 || undefined,
          cardExpiry: formData.cardExpiry || undefined,
          reference: formData.reference || undefined,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Payment processed successfully',
        });
        setIsCreateOpen(false);
        resetForm();
        fetchPayments();
        // Refresh folios to update balance
        const foliosResponse = await fetch('/api/folios?limit=100');
        const foliosResult = await foliosResponse.json();
        if (foliosResult.success) {
          setFolios(foliosResult.data.filter((f: Folio) => f.balance > 0));
        }
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
      setIsSaving(false);
    }
  };

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
    if (refundAmount <= 0 || refundAmount > selectedPayment.amount - selectedPayment.refundAmount) {
      toast({
        title: 'Validation Error',
        description: 'Invalid refund amount',
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
          description: 'Refund processed successfully',
        });
        setIsRefundOpen(false);
        setRefundData({ amount: '', reason: '' });
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

  const resetForm = () => {
    const firstFolio = folios[0];
    setFormData({
      folioId: firstFolio?.id || '',
      amount: firstFolio?.balance?.toString() || '',
      method: 'card',
      gateway: 'manual',
      cardType: '',
      cardLast4: '',
      cardExpiry: '',
      reference: '',
    });
  };

  const getStatusBadge = (status: string) => {
    const option = paymentStatuses.find(o => o.value === status);
    const Icon = option?.icon || Clock;
    return (
      <Badge variant="secondary" className={cn('text-white gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium', option?.color)}>
        <Icon className="h-3 w-3" />
        {option?.label || status}
      </Badge>
    );
  };

  const getMethodBadge = (method: string) => {
    const methodOption = paymentMethods.find(m => m.value === method);
    const Icon = methodOption?.icon || CreditCard;
    return (
      <Badge variant="secondary" className={cn('text-white gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium', methodBadgeColors[method] || 'bg-gray-500')}>
        <Icon className="h-3 w-3" />
        {methodOption?.label || method.replace('_', ' ')}
      </Badge>
    );
  };

  const getMethodIcon = (method: string) => {
    const methodOption = paymentMethods.find(m => m.value === method);
    const Icon = methodOption?.icon || CreditCard;
    return <Icon className="h-4 w-4" />;
  };

  const selectedFolio = folios.find(f => f.id === formData.folioId);
  const selectedMethod = paymentMethods.find(m => m.value === formData.method);

  // Stats
  const completedPayments = payments.filter(p => p.status === 'completed').length;
  const pendingPayments = payments.filter(p => p.status === 'pending').length;
  const todayPayments = payments.filter(p => {
    const today = new Date().toDateString();
    return new Date(p.createdAt).toDateString() === today;
  }).reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Payments
          </h2>
          <p className="text-sm text-muted-foreground">
            Process and manage payments
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchPayments}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => { resetForm(); setIsCreateOpen(true); }} className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-md hover:shadow-lg transition-all">
            <Plus className="h-4 w-4 mr-2" />
            New Payment
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <Card className="p-4 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 hover:-translate-y-0.5">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <CreditCard className="h-4 w-4 text-violet-500" />
            </div>
            <div>
              <div className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-violet-400 bg-clip-text text-transparent">{summary.count}</div>
              <div className="text-xs text-muted-foreground">Total Payments</div>
            </div>
          </div>
        </Card>
        <Card className="p-4 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 hover:-translate-y-0.5">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <DollarSign className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <div className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-400 bg-clip-text text-transparent">{formatCurrency(summary.totalAmount)}</div>
              <div className="text-xs text-muted-foreground">Total Processed</div>
            </div>
          </div>
        </Card>
        <Card className="p-4 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 hover:-translate-y-0.5">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Clock className="h-4 w-4 text-amber-500" />
            </div>
            <div>
              <div className="text-2xl font-bold bg-gradient-to-r from-amber-600 to-amber-400 bg-clip-text text-transparent">{pendingPayments}</div>
              <div className="text-xs text-muted-foreground">Pending</div>
            </div>
          </div>
        </Card>
        <Card className="p-4 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 hover:-translate-y-0.5">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <CheckCircle className="h-4 w-4 text-cyan-500" />
            </div>
            <div>
              <div className="text-2xl font-bold bg-gradient-to-r from-cyan-600 to-cyan-400 bg-clip-text text-transparent">{formatCurrency(todayPayments)}</div>
              <div className="text-xs text-muted-foreground">Today</div>
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
                <SelectItem value="all">All Methods</SelectItem>
                {paymentMethods.map(method => (
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
                {paymentStatuses.map(status => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
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
          ) : payments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <CreditCard className="h-12 w-12 mb-4" />
              <p>No payments found</p>
              <p className="text-sm">Process your first payment to get started</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Transaction</TableHead>
                    <TableHead>Folio</TableHead>
                    <TableHead>Guest</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment.id} className="hover:bg-muted/50 transition-colors">
                      <TableCell>
                        <div>
                          <p className="font-mono text-sm">{payment.transactionId}</p>
                          {payment.reference && (
                            <p className="text-xs text-muted-foreground">{payment.reference}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="font-mono text-sm">{payment.folio?.folioNumber}</p>
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
                        <div className="flex flex-col gap-1">
                          {getMethodBadge(payment.method)}
                          {payment.cardLast4 && (
                            <p className="text-xs text-muted-foreground">****{payment.cardLast4}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{formatCurrency(payment.amount)}</p>
                          {payment.refundAmount > 0 && (
                            <p className="text-xs text-red-600">
                              -{formatCurrency(payment.refundAmount)} refunded
                            </p>
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
                            onClick={() => viewPaymentDetails(payment.id)}
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {payment.status === 'completed' && payment.refundAmount < payment.amount && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-amber-600"
                              onClick={() => {
                                setSelectedPayment(payment);
                                setRefundData({
                                  amount: '',
                                  reason: '',
                                });
                                setIsRefundOpen(true);
                              }}
                              title="Refund"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Create Payment Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>Process Payment</DialogTitle>
            <DialogDescription>
              Record a new payment
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 flex-1 overflow-y-auto pr-2 -mr-2">
            {/* Folio Selection */}
            <div className="space-y-2">
              <Label htmlFor="folioId">Select Folio</Label>
              <Select
                value={formData.folioId}
                onValueChange={(value) => {
                  const folio = folios.find(f => f.id === value);
                  setFormData(prev => ({
                    ...prev,
                    folioId: value,
                    amount: folio?.balance?.toString() || '',
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select folio" />
                </SelectTrigger>
                <SelectContent>
                  {folios.map(folio => (
                    <SelectItem key={folio.id} value={folio.id}>
                      {folio.folioNumber} - Balance: {formatCurrency(folio.balance)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Selected Folio Info */}
            {selectedFolio && (
              <Card className="p-4 bg-muted/50">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Guest:</span>
                    <span>
                      {selectedFolio.booking?.primaryGuest?.firstName} {selectedFolio.booking?.primaryGuest?.lastName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Amount:</span>
                    <span>{formatCurrency(selectedFolio.totalAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Already Paid:</span>
                    <span className="text-cyan-600">{formatCurrency(selectedFolio.paidAmount)}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>Outstanding Balance:</span>
                    <span className="text-amber-600">{formatCurrency(selectedFolio.balance)}</span>
                  </div>
                </div>
              </Card>
            )}

            {/* Amount */}
            <div className="space-y-2">
              <Label htmlFor="amount">Payment Amount</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                  className="pl-9"
                />
              </div>
              {selectedFolio && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFormData(prev => ({ ...prev, amount: selectedFolio.balance.toFixed(2) }))}
                  >
                    Full Amount
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFormData(prev => ({ ...prev, amount: (selectedFolio.balance / 2).toFixed(2) }))}
                  >
                    50%
                  </Button>
                </div>
              )}
            </div>

            {/* Payment Method Selection */}
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <RadioGroup
                value={formData.method}
                onValueChange={(value) => setFormData(prev => ({ ...prev, method: value }))}
                className="grid grid-cols-2 gap-2"
              >
                {paymentMethods.map(method => {
                  const Icon = method.icon;
                  return (
                    <Label
                      key={method.value}
                      htmlFor={method.value}
                      className={cn(
                        'flex items-center gap-3 p-3 border rounded-lg cursor-pointer',
                        formData.method === method.value && 'border-primary bg-primary/5'
                      )}
                    >
                      <RadioGroupItem value={method.value} id={method.value} className="sr-only" />
                      <Icon className="h-5 w-5" />
                      <div>
                        <p className="text-sm font-medium">{method.label}</p>
                        <p className="text-xs text-muted-foreground">{method.description}</p>
                      </div>
                    </Label>
                  );
                })}
              </RadioGroup>
            </div>

            {/* Card Details (if card payment) */}
            {formData.method === 'card' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="gateway">Payment Gateway</Label>
                  <Select
                    value={formData.gateway}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, gateway: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select gateway" />
                    </SelectTrigger>
                    <SelectContent>
                      {gateways.map(gateway => (
                        <SelectItem key={gateway.value} value={gateway.value}>
                          {gateway.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cardType">Card Type</Label>
                    <Select
                      value={formData.cardType}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, cardType: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent>
                        {cardTypes.map(type => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cardLast4">Last 4 Digits</Label>
                    <Input
                      id="cardLast4"
                      placeholder="4242"
                      maxLength={4}
                      value={formData.cardLast4}
                      onChange={(e) => setFormData(prev => ({ ...prev, cardLast4: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cardExpiry">Expiry</Label>
                    <Input
                      id="cardExpiry"
                      placeholder="MM/YY"
                      maxLength={5}
                      value={formData.cardExpiry}
                      onChange={(e) => {
                        let value = e.target.value.replace(/\D/g, '');
                        if (value.length >= 2) {
                          value = value.slice(0, 2) + '/' + value.slice(2);
                        }
                        setFormData(prev => ({ ...prev, cardExpiry: value.slice(0, 5) }));
                      }}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Reference */}
            <div className="space-y-2">
              <Label htmlFor="reference">Reference / Notes</Label>
              <Input
                id="reference"
                placeholder="Optional reference or notes..."
                value={formData.reference}
                onChange={(e) => setFormData(prev => ({ ...prev, reference: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter className="shrink-0">
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isSaving} className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-md hover:shadow-lg transition-all">
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Process Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Details Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Payment Details
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
                    <span className="text-muted-foreground">Amount</span>
                    <span className="font-medium">{formatCurrency(selectedPayment.amount)}</span>
                  </div>
                  {selectedPayment.refundAmount > 0 && (
                    <>
                      <div className="flex justify-between text-red-600">
                        <span>Refunded</span>
                        <span>-{formatCurrency(selectedPayment.refundAmount)}</span>
                      </div>
                      {selectedPayment.refundReason && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Reason: {selectedPayment.refundReason}
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
                  {selectedPayment.processedAt && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Processed</span>
                      <span>{formatDateTime(selectedPayment.processedAt)}</span>
                    </div>
                  )}
                </div>
              </Card>

              {selectedPayment.cardLast4 && (
                <Card className="p-4">
                  <div className="flex items-center gap-3">
                    <CardIcon className="h-8 w-8 text-muted-foreground" />
                    <div>
                      <p className="font-medium capitalize">{selectedPayment.cardType}</p>
                      <p className="text-sm text-muted-foreground">****{selectedPayment.cardLast4}</p>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Refund Dialog */}
      <Dialog open={isRefundOpen} onOpenChange={setIsRefundOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertCircle className="h-5 w-5" />
              Process Refund
            </DialogTitle>
            <DialogDescription>
              Refund payment {selectedPayment?.transactionId}
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
                    <div className="flex justify-between text-amber-600">
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

              <div className="space-y-2">
                <Label htmlFor="refundAmount">Refund Amount</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="refundAmount"
                    type="number"
                    min="0"
                    max={selectedPayment.amount - selectedPayment.refundAmount}
                    step="0.01"
                    placeholder="0.00"
                    value={refundData.amount}
                    onChange={(e) => setRefundData(prev => ({ ...prev, amount: e.target.value }))}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="refundReason">Reason for Refund</Label>
                <Textarea
                  id="refundReason"
                  placeholder="Enter reason for refund..."
                  value={refundData.reason}
                  onChange={(e) => setRefundData(prev => ({ ...prev, reason: e.target.value }))}
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRefundOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRefund} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Process Refund
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
