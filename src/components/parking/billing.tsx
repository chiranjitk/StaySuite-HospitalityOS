'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Car,
  Receipt,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  Search,
  RefreshCw,
  CreditCard,
  Download,
  Loader2,
  Calendar,
  TrendingUp,
  AlertTriangle,
  Plus,
  Eye,
  LogOut,
  Wallet,
  Banknote,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePropertyId } from '@/hooks/use-property';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/contexts/CurrencyContext';
import { exportToCSV } from '@/lib/export-utils';
import { format, formatDistanceToNow, startOfMonth, endOfMonth, subDays } from 'date-fns';

// ─── Types ───────────────────────────────────────────────────────────────────

interface BillingRecord {
  id: string;
  licensePlate: string;
  make?: string;
  model?: string;
  color?: string;
  year?: number;
  guestId?: string;
  guest?: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
  };
  bookingId?: string;
  slotId?: string;
  slot?: {
    id: string;
    number: string;
    floor: number;
    type: string;
  };
  entryTime?: string;
  exitTime?: string;
  parkingFee: number;
  isPaid: boolean;
  status: string;
  createdAt: string;
  durationMinutes?: number;
  durationFormatted?: string;
  calculatedFee?: number;
  hourlyRate?: number;
  dailyMaxRate?: number;
}

interface BillingSummary {
  totalVehicles: number;
  paidCount: number;
  unpaidCount: number;
  totalFees: number;
  paidFees: number;
  unpaidFees: number;
}

interface AvailableSlot {
  id: string;
  number: string;
  floor: number;
  type: string;
}

// ─── Payment method options ──────────────────────────────────────────────────

const paymentMethods = [
  { value: 'cash', label: 'Cash', icon: Banknote, color: 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
  { value: 'card', label: 'Card', icon: CreditCard, color: 'border-violet-500 bg-violet-500/10 text-violet-700 dark:text-violet-400' },
  { value: 'folio', label: 'Folio', icon: FileText, color: 'border-cyan-500 bg-cyan-500/10 text-cyan-700 dark:text-cyan-400' },
  { value: 'wallet', label: 'Wallet', icon: Wallet, color: 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400' },
  { value: 'other', label: 'Other', icon: Receipt, color: 'border-gray-500 bg-gray-500/10 text-gray-700 dark:text-gray-400' },
];

// ─── Component ───────────────────────────────────────────────────────────────

export function ParkingBilling() {
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const { propertyId } = usePropertyId();

  // Data state
  const [records, setRecords] = useState<BillingRecord[]>([]);
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Tab state
  const [activeTab, setActiveTab] = useState<string>('all');

  // Dialog states
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isCheckinOpen, setIsCheckinOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<BillingRecord | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('cash');
  const [isSaving, setIsSaving] = useState(false);

  // Check-in form
  const [checkinForm, setCheckinForm] = useState({
    licensePlate: '',
    make: '',
    model: '',
    color: '',
    year: '',
    guestId: '',
    slotId: '',
    hourlyRate: '50',
    dailyMaxRate: '500',
  });
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);

  // ─── Fetch billing records ─────────────────────────────────────────────────

  const fetchRecords = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter === 'paid') params.append('status', 'paid');
      if (statusFilter === 'unpaid') params.append('status', 'unpaid');
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      params.append('limit', '100');

      const response = await fetch(`/api/parking/billing?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setRecords(result.data);
        setSummary(result.summary);
      }
    } catch (error) {
      console.error('Error fetching billing records:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch billing records',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, startDate, endDate, toast]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // ─── Tab-based filtering ───────────────────────────────────────────────────

  useEffect(() => {
    if (activeTab === 'paid') {
      setStatusFilter('paid');
    } else if (activeTab === 'unpaid') {
      setStatusFilter('unpaid');
    } else {
      setStatusFilter('all');
    }
  }, [activeTab]);

  // ─── Client-side search filter ─────────────────────────────────────────────

  const filteredRecords = records.filter((record) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesPlate = record.licensePlate.toLowerCase().includes(query);
      const matchesGuest =
        record.guest &&
        `${record.guest.firstName} ${record.guest.lastName}`.toLowerCase().includes(query);
      if (!matchesPlate && !matchesGuest) return false;
    }
    return true;
  });

  // ─── Fetch available slots ─────────────────────────────────────────────────

  const fetchAvailableSlots = async () => {
    setIsLoadingSlots(true);
    try {
      const params = new URLSearchParams();
      params.append('status', 'available');
      if (propertyId) params.append('propertyId', propertyId);
      const response = await fetch(`/api/parking?${params.toString()}`);
      const result = await response.json();
      if (result.success) {
        setAvailableSlots(
          result.data.map((slot: AvailableSlot) => ({
            id: slot.id,
            number: slot.number,
            floor: slot.floor,
            type: slot.type,
          }))
        );
      }
    } catch (error) {
      console.error('Error fetching available slots:', error);
    } finally {
      setIsLoadingSlots(false);
    }
  };

  // ─── Check-out vehicle ────────────────────────────────────────────────────

  const handleCheckout = async (record: BillingRecord) => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/parking/billing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: record.id,
          action: 'checkout',
          hourlyRate: record.hourlyRate,
          dailyMaxRate: record.dailyMaxRate,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Vehicle Checked Out',
          description: `Fee: ${formatCurrency(result.data.parkingFee || 0)}`,
        });
        setIsDetailOpen(false);
        fetchRecords();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to check out vehicle',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error checking out vehicle:', error);
      toast({
        title: 'Error',
        description: 'Failed to check out vehicle',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Record payment ───────────────────────────────────────────────────────

  const handlePayment = async () => {
    if (!selectedRecord) return;

    setIsSaving(true);
    try {
      const response = await fetch('/api/parking/billing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedRecord.id,
          action: 'pay',
          paymentMethod: selectedPaymentMethod,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Payment Recorded',
          description: `Payment of ${formatCurrency(result.data.parkingFee || 0)} via ${selectedPaymentMethod}`,
        });
        setIsPaymentOpen(false);
        setIsDetailOpen(false);
        fetchRecords();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to record payment',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error recording payment:', error);
      toast({
        title: 'Error',
        description: 'Failed to record payment',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Vehicle check-in ─────────────────────────────────────────────────────

  const handleCheckin = async () => {
    if (!checkinForm.licensePlate.trim()) {
      toast({
        title: 'Validation Error',
        description: 'License plate is required',
        variant: 'destructive',
      });
      return;
    }

    if (checkinForm.licensePlate.trim().length < 2) {
      toast({
        title: 'Validation Error',
        description: 'License plate must be at least 2 characters',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const payload: Record<string, unknown> = {
        licensePlate: checkinForm.licensePlate.toUpperCase().trim(),
        make: checkinForm.make || undefined,
        model: checkinForm.model || undefined,
        color: checkinForm.color || undefined,
        year: checkinForm.year ? parseInt(checkinForm.year, 10) : undefined,
        guestId: checkinForm.guestId || undefined,
        slotId: checkinForm.slotId || undefined,
        hourlyRate: parseFloat(checkinForm.hourlyRate) || 50,
        dailyMaxRate: parseFloat(checkinForm.dailyMaxRate) || 500,
      };

      const response = await fetch('/api/parking/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Vehicle Checked In',
          description: `${checkinForm.licensePlate.toUpperCase()} has been logged`,
        });
        setIsCheckinOpen(false);
        setCheckinForm({
          licensePlate: '',
          make: '',
          model: '',
          color: '',
          year: '',
          guestId: '',
          slotId: '',
          hourlyRate: '50',
          dailyMaxRate: '500',
        });
        fetchRecords();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to check in vehicle',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error checking in vehicle:', error);
      toast({
        title: 'Error',
        description: 'Failed to check in vehicle',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Export CSV ────────────────────────────────────────────────────────────

  const handleExport = () => {
    if (filteredRecords.length === 0) {
      toast({
        title: 'No Data',
        description: 'No records to export',
        variant: 'destructive',
      });
      return;
    }

    exportToCSV(
      filteredRecords.map((r) => ({
        licensePlate: r.licensePlate,
        make: r.make || '',
        model: r.model || '',
        color: r.color || '',
        year: r.year || '',
        guest: r.guest ? `${r.guest.firstName} ${r.guest.lastName}` : '',
        slot: r.slot ? `${r.slot.number} (F${r.slot.floor})` : '',
        entryTime: r.entryTime ? format(new Date(r.entryTime), 'yyyy-MM-dd HH:mm') : '',
        exitTime: r.exitTime ? format(new Date(r.exitTime), 'yyyy-MM-dd HH:mm') : '',
        duration: r.durationFormatted || '',
        fee: r.calculatedFee ?? r.parkingFee,
        status: r.isPaid ? 'Paid' : 'Unpaid',
      })),
      `parking-billing-${format(new Date(), 'yyyy-MM-dd')}`,
      [
        { key: 'licensePlate', label: 'License Plate' },
        { key: 'make', label: 'Make' },
        { key: 'model', label: 'Model' },
        { key: 'color', label: 'Color' },
        { key: 'year', label: 'Year' },
        { key: 'guest', label: 'Guest' },
        { key: 'slot', label: 'Slot' },
        { key: 'entryTime', label: 'Entry Time' },
        { key: 'exitTime', label: 'Exit Time' },
        { key: 'duration', label: 'Duration' },
        { key: 'fee', label: 'Fee' },
        { key: 'status', label: 'Status' },
      ]
    );
  };

  // ─── Quick date presets ───────────────────────────────────────────────────

  const setThisMonth = () => {
    setStartDate(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
    setEndDate(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  };

  const setLast7Days = () => {
    setStartDate(format(subDays(new Date(), 6), 'yyyy-MM-dd'));
    setEndDate(format(new Date(), 'yyyy-MM-dd'));
  };

  const setLast30Days = () => {
    setStartDate(format(subDays(new Date(), 29), 'yyyy-MM-dd'));
    setEndDate(format(new Date(), 'yyyy-MM-dd'));
  };

  const clearDates = () => {
    setStartDate('');
    setEndDate('');
  };

  // ─── Computed stats ───────────────────────────────────────────────────────

  const totalRevenue = summary?.paidFees || 0;
  const outstanding = summary?.unpaidFees || 0;
  const totalTransactions = summary?.totalVehicles || 0;
  const averageFee = totalTransactions > 0 ? (summary?.totalFees || 0) / totalTransactions : 0;

  // ─── Property guard ───────────────────────────────────────────────────────

  if (!propertyId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <Car className="h-12 w-12 mb-4" />
        <p className="text-lg font-medium">No Property Selected</p>
        <p className="text-sm">Please select a property to manage parking billing</p>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Parking Billing
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage vehicle check-ins, fees, and payments
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchRecords}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button size="sm" onClick={() => { setIsCheckinOpen(true); fetchAvailableSlots(); }}>
            <Plus className="h-4 w-4 mr-2" />
            Check-In
          </Button>
        </div>
      </div>

      {/* Stats Cards Row */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <DollarSign className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
              <div className="text-xs text-muted-foreground">Total Revenue</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <AlertTriangle className="h-4 w-4 text-amber-500 dark:text-amber-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{formatCurrency(outstanding)}</div>
              <div className="text-xs text-muted-foreground">Outstanding</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <TrendingUp className="h-4 w-4 text-cyan-500 dark:text-cyan-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{totalTransactions}</div>
              <div className="text-xs text-muted-foreground">Total Transactions</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <Receipt className="h-4 w-4 text-violet-500 dark:text-violet-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{formatCurrency(averageFee)}</div>
              <div className="text-xs text-muted-foreground">Average Fee</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all" className="gap-1.5">
            <Car className="h-3.5 w-3.5" />
            All Records
          </TabsTrigger>
          <TabsTrigger value="unpaid" className="gap-1.5">
            <XCircle className="h-3.5 w-3.5" />
            Unpaid
          </TabsTrigger>
          <TabsTrigger value="paid" className="gap-1.5">
            <CheckCircle className="h-3.5 w-3.5" />
            Paid
          </TabsTrigger>
        </TabsList>

        {/* Filters Bar */}
        <Card className="mt-4">
          <CardContent className="p-4">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Search */}
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by license plate or guest name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                {/* Status filter (visible when on "all" tab) */}
                {activeTab === 'all' && (
                  <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v)}>
                    <SelectTrigger className="w-full sm:w-40">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="unpaid">Unpaid</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Date range filters */}
              <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      From
                    </Label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      To
                    </Label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="h-9"
                    />
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={setThisMonth} className="text-xs h-9">
                    This Month
                  </Button>
                  <Button variant="outline" size="sm" onClick={setLast7Days} className="text-xs h-9">
                    7 Days
                  </Button>
                  <Button variant="outline" size="sm" onClick={setLast30Days} className="text-xs h-9">
                    30 Days
                  </Button>
                  {(startDate || endDate) && (
                    <Button variant="ghost" size="sm" onClick={clearDates} className="text-xs h-9 text-muted-foreground">
                      Clear
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Billing Records Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Receipt className="h-12 w-12 mb-4" />
            <p className="text-lg font-medium">No Billing Records</p>
            <p className="text-sm mt-1">
              {searchQuery || startDate || endDate
                ? 'No records match your current filters'
                : 'Check in a vehicle to start tracking billing'}
            </p>
            {searchQuery || startDate || endDate ? (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => {
                  setSearchQuery('');
                  clearDates();
                }}
              >
                Clear Filters
              </Button>
            ) : (
              <Button
                size="sm"
                className="mt-4"
                onClick={() => { setIsCheckinOpen(true); fetchAvailableSlots(); }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Check In Vehicle
              </Button>
            )}
          </div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <ScrollArea className="max-h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vehicle</TableHead>
                      <TableHead className="hidden md:table-cell">Guest</TableHead>
                      <TableHead className="hidden sm:table-cell">Slot</TableHead>
                      <TableHead className="hidden lg:table-cell">Entry Time</TableHead>
                      <TableHead className="hidden xl:table-cell">Exit Time</TableHead>
                      <TableHead className="hidden lg:table-cell">Duration</TableHead>
                      <TableHead>Fee</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRecords.map((record) => {
                      const entryTime = record.entryTime ? new Date(record.entryTime) : null;
                      const exitTime = record.exitTime ? new Date(record.exitTime) : null;
                      const isParked = record.status === 'parked';

                      return (
                        <TableRow key={record.id}>
                          {/* Vehicle */}
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="p-2 rounded-lg bg-muted">
                                <Car className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="font-medium">{record.licensePlate}</p>
                                <p className="text-xs text-muted-foreground">
                                  {[record.make, record.model, record.color].filter(Boolean).join(' ')}
                                  {record.year ? ` (${record.year})` : ''}
                                </p>
                              </div>
                            </div>
                          </TableCell>

                          {/* Guest */}
                          <TableCell className="hidden md:table-cell">
                            {record.guest ? (
                              <span className="text-sm">
                                {record.guest.firstName} {record.guest.lastName}
                              </span>
                            ) : (
                              <span className="text-sm text-muted-foreground">Walk-in</span>
                            )}
                          </TableCell>

                          {/* Slot */}
                          <TableCell className="hidden sm:table-cell">
                            {record.slot ? (
                              <Badge variant="outline">
                                {record.slot.number} (F{record.slot.floor})
                              </Badge>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </TableCell>

                          {/* Entry Time */}
                          <TableCell className="hidden lg:table-cell">
                            <span className="text-sm">
                              {entryTime ? format(entryTime, 'MMM d, HH:mm') : '-'}
                            </span>
                          </TableCell>

                          {/* Exit Time */}
                          <TableCell className="hidden xl:table-cell">
                            <span className="text-sm">
                              {exitTime ? format(exitTime, 'MMM d, HH:mm') : (isParked ? (
                                <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  In progress
                                </span>
                              ) : '-')}
                            </span>
                          </TableCell>

                          {/* Duration */}
                          <TableCell className="hidden lg:table-cell">
                            <span className="text-sm">
                              {record.durationFormatted
                                ? record.durationFormatted
                                : entryTime
                                  ? formatDistanceToNow(entryTime, { addSuffix: false })
                                  : '-'}
                            </span>
                          </TableCell>

                          {/* Fee */}
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">
                                {formatCurrency(record.calculatedFee ?? record.parkingFee)}
                              </p>
                              {record.isPaid && (
                                <p className="text-xs text-emerald-600 dark:text-emerald-400">Paid</p>
                              )}
                            </div>
                          </TableCell>

                          {/* Status */}
                          <TableCell>
                            <Badge
                              variant="secondary"
                              className={cn(
                                'text-white',
                                record.isPaid ? 'bg-emerald-500' : 'bg-amber-500'
                              )}
                            >
                              {record.isPaid ? 'Paid' : 'Unpaid'}
                            </Badge>
                          </TableCell>

                          {/* Actions */}
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedRecord(record);
                                  setIsDetailOpen(true);
                                }}
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              {!record.isPaid && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedRecord(record);
                                    setSelectedPaymentMethod('cash');
                                    setIsPaymentOpen(true);
                                  }}
                                  title="Record Payment"
                                >
                                  <CreditCard className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {isParked && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleCheckout(record)}
                                  disabled={isSaving}
                                  title="Record Exit"
                                >
                                  <LogOut className="h-3.5 w-3.5" />
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
            </CardContent>
          </Card>
        )}
      </Tabs>

      {/* ─── Vehicle Detail Dialog ─────────────────────────────────────────── */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Vehicle Details</DialogTitle>
            <DialogDescription>
              Full billing and vehicle information
            </DialogDescription>
          </DialogHeader>
          {selectedRecord && (
            <div className="space-y-4">
              {/* Vehicle info */}
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-muted">
                  <Car className="h-8 w-8" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-lg">{selectedRecord.licensePlate}</h3>
                  <p className="text-sm text-muted-foreground">
                    {[selectedRecord.make, selectedRecord.model, selectedRecord.color].filter(Boolean).join(' ')}
                    {selectedRecord.year ? ` (${selectedRecord.year})` : ''}
                  </p>
                </div>
                <Badge
                  variant="secondary"
                  className={cn(
                    'text-white',
                    selectedRecord.isPaid ? 'bg-emerald-500' : 'bg-amber-500'
                  )}
                >
                  {selectedRecord.isPaid ? 'Paid' : 'Unpaid'}
                </Badge>
              </div>

              {/* Details grid */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                {selectedRecord.guest && (
                  <div className="col-span-2 p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground mb-1">Guest</p>
                    <p className="font-medium">
                      {selectedRecord.guest.firstName} {selectedRecord.guest.lastName}
                    </p>
                    {selectedRecord.guest.phone && (
                      <p className="text-xs text-muted-foreground">{selectedRecord.guest.phone}</p>
                    )}
                  </div>
                )}
                {selectedRecord.slot && (
                  <div>
                    <p className="text-muted-foreground">Slot</p>
                    <p className="font-medium">
                      {selectedRecord.slot.number} (Floor {selectedRecord.slot.floor})
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground">Entry Time</p>
                  <p className="font-medium">
                    {selectedRecord.entryTime
                      ? format(new Date(selectedRecord.entryTime), 'MMM d, yyyy HH:mm')
                      : '-'}
                  </p>
                </div>
                {selectedRecord.exitTime && (
                  <div>
                    <p className="text-muted-foreground">Exit Time</p>
                    <p className="font-medium">
                      {format(new Date(selectedRecord.exitTime), 'MMM d, yyyy HH:mm')}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground">Duration</p>
                  <p className="font-medium">
                    {selectedRecord.durationFormatted || '-'}
                  </p>
                </div>
              </div>

              {/* Fee breakdown */}
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm">Parking Fee</span>
                  <span className="text-xl font-bold">
                    {formatCurrency(selectedRecord.calculatedFee ?? selectedRecord.parkingFee)}
                  </span>
                </div>
                {selectedRecord.hourlyRate && (
                  <div className="flex justify-between items-center text-xs text-muted-foreground">
                    <span>Hourly Rate</span>
                    <span>{formatCurrency(selectedRecord.hourlyRate)}</span>
                  </div>
                )}
                {selectedRecord.dailyMaxRate && (
                  <div className="flex justify-between items-center text-xs text-muted-foreground">
                    <span>Daily Max</span>
                    <span>{formatCurrency(selectedRecord.dailyMaxRate)}</span>
                  </div>
                )}
                {!selectedRecord.isPaid && (selectedRecord.calculatedFee ?? selectedRecord.parkingFee) > 0 && (
                  <Badge className="bg-amber-500 mt-1">Payment Pending</Badge>
                )}
                {selectedRecord.isPaid && (
                  <Badge className="bg-emerald-500 mt-1 flex items-center gap-1 w-fit">
                    <CheckCircle className="h-3 w-3" />
                    Payment Complete
                  </Badge>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                {selectedRecord.status === 'parked' && (
                  <Button
                    className="flex-1"
                    onClick={() => handleCheckout(selectedRecord)}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <LogOut className="h-4 w-4 mr-2" />
                    )}
                    Record Exit
                  </Button>
                )}
                {!selectedRecord.isPaid && (selectedRecord.calculatedFee ?? selectedRecord.parkingFee) > 0 && (
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setSelectedPaymentMethod('cash');
                      setIsPaymentOpen(true);
                    }}
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    Mark as Paid
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Payment Dialog ────────────────────────────────────────────────── */}
      <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Select a payment method for{' '}
              <span className="font-medium">{selectedRecord?.licensePlate}</span>
            </DialogDescription>
          </DialogHeader>
          {selectedRecord && (
            <div className="space-y-4">
              {/* Fee summary */}
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Amount Due</span>
                  <span className="text-xl font-bold">
                    {formatCurrency(selectedRecord.calculatedFee ?? selectedRecord.parkingFee)}
                  </span>
                </div>
              </div>

              {/* Payment method selection as cards */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Payment Method</Label>
                <div className="grid grid-cols-2 gap-2">
                  {paymentMethods.map((method) => {
                    const Icon = method.icon;
                    const isSelected = selectedPaymentMethod === method.value;
                    return (
                      <button
                        key={method.value}
                        type="button"
                        onClick={() => setSelectedPaymentMethod(method.value)}
                        className={cn(
                          'flex items-center gap-2 p-3 rounded-lg border-2 text-sm font-medium transition-all cursor-pointer',
                          isSelected
                            ? method.color
                            : 'border-muted hover:border-muted-foreground/30 text-muted-foreground'
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {method.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsPaymentOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handlePayment} disabled={isSaving}>
                  {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Confirm Payment
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── New Vehicle Check-in Dialog ──────────────────────────────────── */}
      <Dialog open={isCheckinOpen} onOpenChange={(open) => { setIsCheckinOpen(open); if (!open) setAvailableSlots([]); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Vehicle Check-In</DialogTitle>
            <DialogDescription>
              Log a new vehicle entering the parking facility
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            {/* License Plate */}
            <div className="space-y-2">
              <Label>License Plate *</Label>
              <Input
                placeholder="ABC-1234"
                value={checkinForm.licensePlate}
                onChange={(e) =>
                  setCheckinForm((prev) => ({
                    ...prev,
                    licensePlate: e.target.value.toUpperCase(),
                  }))
                }
              />
            </div>

            {/* Make, Model, Year */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Make</Label>
                <Input
                  placeholder="Toyota"
                  value={checkinForm.make}
                  onChange={(e) =>
                    setCheckinForm((prev) => ({ ...prev, make: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Model</Label>
                <Input
                  placeholder="Camry"
                  value={checkinForm.model}
                  onChange={(e) =>
                    setCheckinForm((prev) => ({ ...prev, model: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Year</Label>
                <Input
                  placeholder="2024"
                  value={checkinForm.year}
                  onChange={(e) =>
                    setCheckinForm((prev) => ({ ...prev, year: e.target.value }))
                  }
                />
              </div>
            </div>

            {/* Color */}
            <div className="space-y-2">
              <Label>Color</Label>
              <Input
                placeholder="Silver"
                value={checkinForm.color}
                onChange={(e) =>
                  setCheckinForm((prev) => ({ ...prev, color: e.target.value }))
                }
              />
            </div>

            {/* Guest */}
            <div className="space-y-2">
              <Label>Guest ID (optional)</Label>
              <Input
                placeholder="Link to a guest booking"
                value={checkinForm.guestId}
                onChange={(e) =>
                  setCheckinForm((prev) => ({ ...prev, guestId: e.target.value }))
                }
              />
            </div>

            {/* Slot */}
            <div className="space-y-2">
              <Label>Parking Slot (optional)</Label>
              <Select
                value={checkinForm.slotId}
                onValueChange={(value) =>
                  setCheckinForm((prev) => ({ ...prev, slotId: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      isLoadingSlots ? 'Loading slots...' : 'Select available slot'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No slot assigned</SelectItem>
                  {availableSlots.map((slot) => (
                    <SelectItem key={slot.id} value={slot.id}>
                      {slot.number} (Floor {slot.floor}) - {slot.type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {availableSlots.length === 0 && !isLoadingSlots && (
                <p className="text-xs text-muted-foreground">
                  No available slots. Leave empty for unassigned parking.
                </p>
              )}
            </div>

            {/* Rates */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Hourly Rate</Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={checkinForm.hourlyRate}
                  onChange={(e) =>
                    setCheckinForm((prev) => ({ ...prev, hourlyRate: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Daily Max Rate</Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={checkinForm.dailyMaxRate}
                  onChange={(e) =>
                    setCheckinForm((prev) => ({ ...prev, dailyMaxRate: e.target.value }))
                  }
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCheckinOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCheckin} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Check In Vehicle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
