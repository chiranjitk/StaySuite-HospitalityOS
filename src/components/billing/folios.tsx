'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useTimezone } from '@/contexts/TimezoneContext';
import { useTax } from '@/contexts/TaxContext';
import { useAuth } from '@/contexts/AuthContext';
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
import { Separator } from '@/components/ui/separator';
import {
  FileText,
  Plus,
  Search,
  Loader2,
  DollarSign,
  CreditCard,
  Eye,
  Trash2,
  Receipt,
  Calendar,
  User,
  Building2,
  RefreshCw,
  X,
  Percent,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns'; // Keep for non-standard date formatting

interface Guest {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
}

interface Booking {
  id: string;
  confirmationCode: string;
  checkIn: string;
  checkOut: string;
  primaryGuest: Guest;
  room?: { id: string; number: string };
  roomType?: { id: string; name: string };
}

interface LineItem {
  id: string;
  description: string;
  category: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  serviceDate: string;
  taxRate: number;
  taxAmount: number;
}

interface Payment {
  id: string;
  amount: number;
  method: string;
  status: string;
  createdAt: string;
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
  currency: string;
  status: string;
  invoiceNumber?: string;
  createdAt: string;
  booking: Booking;
  lineItems?: LineItem[];
  payments?: Payment[];
  _count?: {
    lineItems: number;
    payments: number;
  };
}

const folioStatuses = [
  { value: 'open', label: 'Open', color: 'bg-gradient-to-r from-blue-500 to-blue-400' },
  { value: 'partially_paid', label: 'Partially Paid', color: 'bg-gradient-to-r from-amber-500 to-amber-400' },
  { value: 'paid', label: 'Paid', color: 'bg-gradient-to-r from-emerald-500 to-teal-400' },
  { value: 'closed', label: 'Closed', color: 'bg-gradient-to-r from-gray-500 to-gray-400' },
];

const lineItemCategories = [
  { value: 'room', label: 'Room Charge' },
  { value: 'food', label: 'Food & Beverage' },
  { value: 'service', label: 'Services' },
  { value: 'amenity', label: 'Amenities' },
  { value: 'tax', label: 'Tax' },
  { value: 'discount', label: 'Discount' },
  { value: 'other', label: 'Other' },
];

export default function Folios() {
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const { formatDate, formatTime, formatDateTime, settings } = useTimezone();
  const { taxes, getTaxesForCategory, calculateTax, formatTaxRate } = useTax();
  const { user } = useAuth();
  const [folios, setFolios] = useState<Folio[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [selectedFolio, setSelectedFolio] = useState<Folio | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state for creating folio
  const [createFormData, setCreateFormData] = useState({
    propertyId: '',
    bookingId: '',
    guestId: '',
  });

  // Form state for adding line item
  const [lineItemFormData, setLineItemFormData] = useState({
    description: '',
    category: 'room',
    quantity: '1',
    unitPrice: '',
    useAutoTax: true,
  });

  // Calculate applicable taxes for the selected category
  const applicableTaxes = useMemo(() => {
    return getTaxesForCategory(lineItemFormData.category);
  }, [lineItemFormData.category, getTaxesForCategory]);

  // Calculate tax preview for the form
  const taxPreview = useMemo(() => {
    const amount = parseFloat(lineItemFormData.unitPrice || '0') * parseInt(lineItemFormData.quantity || '1');
    if (amount <= 0) return null;
    return calculateTax(amount, lineItemFormData.category);
  }, [lineItemFormData.unitPrice, lineItemFormData.quantity, lineItemFormData.category, calculateTax]);

  // Fetch bookings for dropdown
  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const response = await fetch('/api/bookings?limit=100');
        const result = await response.json();
        if (result.success) {
          // Filter bookings without folios
          setBookings(result.data);
          if (result.data.length > 0) {
            setCreateFormData(prev => ({
              ...prev,
              bookingId: result.data[0].id,
              guestId: result.data[0].primaryGuest?.id,
            }));
          }
        }
      } catch (error) {
        console.error('Error fetching bookings:', error);
      }
    };
    fetchBookings();
  }, []);

  // Fetch folios
  const fetchFolios = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (statusFilter !== 'all') params.append('status', statusFilter);

      const response = await fetch(`/api/folios?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setFolios(result.data);
      }
    } catch (error) {
      console.error('Error fetching folios:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch folios',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFolios();
  }, [statusFilter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length >= 2 || searchQuery.length === 0) {
        fetchFolios();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // View folio details
  const viewFolioDetails = async (folioId: string) => {
    try {
      const response = await fetch(`/api/folios/${folioId}`);
      const result = await response.json();

      if (result.success) {
        setSelectedFolio(result.data);
        setIsDetailOpen(true);
      } else {
        toast({
          title: 'Error',
          description: 'Failed to load folio details',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error fetching folio details:', error);
    }
  };

  // Create folio
  const handleCreate = async () => {
    if (!createFormData.bookingId) {
      toast({
        title: 'Validation Error',
        description: 'Please select a booking',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const selectedBooking = bookings.find(b => b.id === createFormData.bookingId);
      
      const response = await fetch('/api/folios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: user?.tenantId,
          bookingId: createFormData.bookingId,
          guestId: selectedBooking?.primaryGuest?.id,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Folio created successfully',
        });
        setIsCreateOpen(false);
        fetchFolios();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to create folio',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error creating folio:', error);
      toast({
        title: 'Error',
        description: 'Failed to create folio',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Add line item
  const handleAddLineItem = async () => {
    if (!selectedFolio || !lineItemFormData.description || !lineItemFormData.unitPrice) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      // Calculate taxes using TaxContext
      const amount = parseFloat(lineItemFormData.unitPrice) * parseInt(lineItemFormData.quantity);
      const taxResult = calculateTax(amount, lineItemFormData.category);
      
      const response = await fetch(`/api/folios/${selectedFolio.id}/line-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: lineItemFormData.description,
          category: lineItemFormData.category,
          quantity: parseInt(lineItemFormData.quantity),
          unitPrice: parseFloat(lineItemFormData.unitPrice),
          taxRate: taxResult.totalTax > 0 ? (taxResult.totalTax / amount) * 100 : 0,
          taxAmount: taxResult.totalTax,
          appliedTaxes: taxResult.taxes.map(t => ({
            taxId: t.tax.id,
            name: t.tax.name,
            rate: t.tax.rate,
            type: t.tax.type,
            amount: t.amount,
          })),
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Line item added successfully',
        });
        setIsAddItemOpen(false);
        setLineItemFormData({
          description: '',
          category: 'room',
          quantity: '1',
          unitPrice: '',
          useAutoTax: true,
        });
        // Refresh folio details
        viewFolioDetails(selectedFolio.id);
        fetchFolios();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to add line item',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error adding line item:', error);
      toast({
        title: 'Error',
        description: 'Failed to add line item',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Remove line item
  const handleRemoveLineItem = async (lineItemId: string) => {
    if (!selectedFolio) return;

    try {
      const response = await fetch(`/api/folios/${selectedFolio.id}/line-items?lineItemId=${lineItemId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Line item removed successfully',
        });
        // Refresh folio details
        viewFolioDetails(selectedFolio.id);
        fetchFolios();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to remove line item',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error removing line item:', error);
    }
  };

  // Close folio
  const handleCloseFolio = async (folioId: string) => {
    try {
      const response = await fetch(`/api/folios/${folioId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Folio closed successfully',
        });
        setIsDetailOpen(false);
        fetchFolios();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to close folio',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error closing folio:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const option = folioStatuses.find(o => o.value === status);
    return (
      <Badge variant="secondary" className={cn('text-white px-2.5 py-0.5 rounded-full text-xs font-medium', option?.color)}>
        {option?.label || status}
      </Badge>
    );
  };

  const getPaymentPercentage = (folio: Folio) => {
    if (folio.totalAmount === 0) return 100;
    return Math.min(100, (folio.paidAmount / folio.totalAmount) * 100);
  };

  // Stats
  const openFolios = folios.filter(f => f.status === 'open').length;
  const totalBalance = folios.reduce((sum, f) => sum + f.balance, 0);
  const totalRevenue = folios.reduce((sum, f) => sum + f.paidAmount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Folios
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage guest billing and charges
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchFolios}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Folio
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <Card className="p-4 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 hover:-translate-y-0.5">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <FileText className="h-4 w-4 text-violet-500" />
            </div>
            <div>
              <div className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-violet-400 bg-clip-text text-transparent">{folios.length}</div>
              <div className="text-xs text-muted-foreground">Total Folios</div>
            </div>
          </div>
        </Card>
        <Card className="p-4 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 hover:-translate-y-0.5">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <Receipt className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <div className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-400 bg-clip-text text-transparent">{openFolios}</div>
              <div className="text-xs text-muted-foreground">Open Folios</div>
            </div>
          </div>
        </Card>
        <Card className="p-4 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 hover:-translate-y-0.5">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <DollarSign className="h-4 w-4 text-amber-500" />
            </div>
            <div>
              <div className="text-2xl font-bold bg-gradient-to-r from-amber-600 to-red-400 bg-clip-text text-transparent">{formatCurrency(totalBalance)}</div>
              <div className="text-xs text-muted-foreground">Outstanding</div>
            </div>
          </div>
        </Card>
        <Card className="p-4 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 hover:-translate-y-0.5">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <CreditCard className="h-4 w-4 text-cyan-500" />
            </div>
            <div>
              <div className="text-2xl font-bold bg-gradient-to-r from-cyan-600 to-cyan-400 bg-clip-text text-transparent">{formatCurrency(totalRevenue)}</div>
              <div className="text-xs text-muted-foreground">Collected</div>
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
                  placeholder="Search by folio number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {folioStatuses.map(status => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Folios Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : folios.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mb-4" />
              <p>No folios found</p>
              <p className="text-sm">Create your first folio to get started</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Folio</TableHead>
                    <TableHead>Guest</TableHead>
                    <TableHead>Booking</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Paid</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {folios.map((folio) => (
                    <TableRow key={folio.id} className="hover:bg-muted/50 transition-colors">
                      <TableCell>
                        <div>
                          <p className="font-mono font-medium">{folio.folioNumber}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(folio.createdAt)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">
                              {folio.booking?.primaryGuest?.firstName} {folio.booking?.primaryGuest?.lastName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {folio.booking?.primaryGuest?.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium">{folio.booking?.confirmationCode}</p>
                          {folio.booking?.room && (
                            <p className="text-xs text-muted-foreground">Room {folio.booking.room.number}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{formatCurrency(folio.totalAmount)}</span>
                      </TableCell>
                      <TableCell>
                        <div className="min-w-[100px]">
                          <div className="flex justify-between text-sm mb-1">
                            <span>{formatCurrency(folio.paidAmount)}</span>
                            <span className="text-muted-foreground">{getPaymentPercentage(folio).toFixed(0)}%</span>
                          </div>
                          <Progress value={getPaymentPercentage(folio)} className="h-1.5" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={cn(
                          'font-medium',
                          folio.balance > 0
                            ? 'bg-gradient-to-r from-amber-600 to-red-500 bg-clip-text text-transparent'
                            : 'bg-gradient-to-r from-emerald-600 to-teal-400 bg-clip-text text-transparent'
                        )}>
                          {formatCurrency(folio.balance)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(folio.status)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => viewFolioDetails(folio.id)}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Create Folio Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Folio</DialogTitle>
            <DialogDescription>
              Create a folio for a booking
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="bookingId">Booking</Label>
              <Select
                value={createFormData.bookingId}
                onValueChange={(value) => {
                  const booking = bookings.find(b => b.id === value);
                  setCreateFormData(prev => ({
                    ...prev,
                    bookingId: value,
                    guestId: booking?.primaryGuest?.id || '',
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select booking" />
                </SelectTrigger>
                <SelectContent>
                  {bookings.map(booking => (
                    <SelectItem key={booking.id} value={booking.id}>
                      {booking.confirmationCode} - {booking.primaryGuest?.firstName} {booking.primaryGuest?.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {createFormData.bookingId && (
              <Card className="p-4 bg-muted/50">
                {(() => {
                  const booking = bookings.find(b => b.id === createFormData.bookingId);
                  return booking ? (
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>{booking.primaryGuest?.firstName} {booking.primaryGuest?.lastName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>{formatDate(booking.checkIn)} - {formatDate(booking.checkOut)}</span>
                      </div>
                      {booking.room && (
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span>Room {booking.room.number}</span>
                        </div>
                      )}
                    </div>
                  ) : null;
                })()}
              </Card>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Folio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Folio Details Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Folio {selectedFolio?.folioNumber}
            </DialogTitle>
            <DialogDescription>
              View and manage folio details
            </DialogDescription>
          </DialogHeader>
          {selectedFolio && (
            <div className="space-y-6 flex-1 overflow-y-auto pr-2 -mr-2">
              {/* Guest & Booking Info */}
              <div className="grid grid-cols-2 gap-4">
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Guest</span>
                  </div>
                  <p className="font-medium">
                    {selectedFolio.booking?.primaryGuest?.firstName} {selectedFolio.booking?.primaryGuest?.lastName}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {selectedFolio.booking?.primaryGuest?.email}
                  </p>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Booking</span>
                  </div>
                  <p className="font-medium">{selectedFolio.booking?.confirmationCode}</p>
                  {selectedFolio.booking?.room && (
                    <p className="text-sm text-muted-foreground">Room {selectedFolio.booking.room.number}</p>
                  )}
                </Card>
              </div>

              {/* Line Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium">Line Items</h3>
                  {selectedFolio.status === 'open' && (
                    <Button size="sm" onClick={() => setIsAddItemOpen(true)}>
                      <Plus className="h-3 w-3 mr-1" />
                      Add Item
                    </Button>
                  )}
                </div>
                <Card>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Unit Price</TableHead>
                        <TableHead className="text-right">Tax</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        {selectedFolio.status === 'open' && <TableHead></TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedFolio.lineItems?.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div>
                              <p className="text-sm">{item.description}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatDate(item.serviceDate)}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {item.category}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.taxAmount)}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(item.totalAmount)}</TableCell>
                          {selectedFolio.status === 'open' && (
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-red-600"
                                onClick={() => handleRemoveLineItem(item.id)}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                      {(!selectedFolio.lineItems || selectedFolio.lineItems.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={selectedFolio.status === 'open' ? 7 : 6} className="text-center text-muted-foreground">
                            No line items
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </Card>
              </div>

              {/* Totals */}
              <Card className="p-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatCurrency(selectedFolio.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Taxes</span>
                    <span>{formatCurrency(selectedFolio.taxes)}</span>
                  </div>
                  {selectedFolio.discount > 0 && (
                    <div className="flex justify-between text-sm text-emerald-600">
                      <span>Discount</span>
                      <span>-{formatCurrency(selectedFolio.discount)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-medium">
                    <span>Total</span>
                    <span>{formatCurrency(selectedFolio.totalAmount)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-cyan-600">
                    <span>Paid</span>
                    <span>{formatCurrency(selectedFolio.paidAmount)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-bold text-lg">
                    <span>Balance</span>
                    <span className={selectedFolio.balance > 0 ? 'text-amber-600' : 'text-emerald-600'}>
                      {formatCurrency(selectedFolio.balance)}
                    </span>
                  </div>
                </div>
              </Card>

              {/* Payments */}
              {selectedFolio.payments && selectedFolio.payments.length > 0 && (
                <div>
                  <h3 className="font-medium mb-2">Payments</h3>
                  <Card>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Method</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedFolio.payments.map((payment) => (
                          <TableRow key={payment.id}>
                            <TableCell>{formatDate(payment.createdAt)}</TableCell>
                            <TableCell className="capitalize">{payment.method}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="capitalize">
                                {payment.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(payment.amount)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Card>
                </div>
              )}

              {/* Actions */}
              {selectedFolio.status === 'open' && selectedFolio.balance === 0 && (
                <div className="shrink-0 pt-4">
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => handleCloseFolio(selectedFolio.id)}
                  >
                    Close Folio
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Line Item Dialog */}
      <Dialog open={isAddItemOpen} onOpenChange={setIsAddItemOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Line Item</DialogTitle>
            <DialogDescription>
              Add a charge to the folio. Taxes are automatically applied based on category.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="e.g., Room Service"
                value={lineItemFormData.description}
                onChange={(e) => setLineItemFormData(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={lineItemFormData.category}
                onValueChange={(value) => setLineItemFormData(prev => ({ ...prev, category: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {lineItemCategories.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  value={lineItemFormData.quantity}
                  onChange={(e) => setLineItemFormData(prev => ({ ...prev, quantity: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unitPrice">Unit Price</Label>
                <Input
                  id="unitPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={lineItemFormData.unitPrice}
                  onChange={(e) => setLineItemFormData(prev => ({ ...prev, unitPrice: e.target.value }))}
                />
              </div>
            </div>
            
            {/* Applicable Taxes Display */}
            {applicableTaxes.length > 0 && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Percent className="h-4 w-4" />
                  Applicable Taxes (Auto-applied)
                </Label>
                <div className="flex flex-wrap gap-2">
                  {applicableTaxes.map(tax => (
                    <Badge key={tax.id} variant={tax.enabled ? "default" : "secondary"} className="text-xs">
                      {tax.name} ({formatTaxRate(tax)})
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            
            {/* Tax Calculation Preview */}
            {taxPreview && (
              <Card className="p-4 bg-muted/50">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span>{formatCurrency(taxPreview.subtotal)}</span>
                  </div>
                  {taxPreview.taxes.map((t, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t.tax.name}:</span>
                      <span>{formatCurrency(t.amount)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm font-medium border-t pt-2">
                    <span>Total Tax:</span>
                    <span className="text-amber-600">{formatCurrency(taxPreview.totalTax)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg border-t pt-2">
                    <span>Total:</span>
                    <span className="text-emerald-600">{formatCurrency(taxPreview.total)}</span>
                  </div>
                </div>
              </Card>
            )}
            
            {lineItemFormData.unitPrice && !taxPreview && (
              <Card className="p-4 bg-muted/50">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Line Total:</span>
                  <span className="font-bold">
                    {formatCurrency(parseFloat(lineItemFormData.unitPrice) * parseInt(lineItemFormData.quantity || '1'))}
                  </span>
                </div>
              </Card>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddItemOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddLineItem} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
