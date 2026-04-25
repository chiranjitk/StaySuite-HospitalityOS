'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Loader2,
  Save,
  X,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/contexts/CurrencyContext';

interface Property {
  id: string;
  name: string;
  currency: string;
}

interface RoomType {
  id: string;
  name: string;
  code: string;
  basePrice: number;
  currency: string;
  propertyId: string;
}

interface RatePlan {
  id: string;
  name: string;
  code: string;
  basePrice: number;
  currency: string;
  roomType?: { id: string; name: string };
}

interface RateEntry {
  date: string;
  dayName: string;
  ratePlanId: string;
  ratePlanName: string;
  baseRate: number;
  overrideRate: number | null;
  closedToArrival: boolean;
  closedToDeparture: boolean;
  minStay: number | null;
  available: boolean;
  locked: boolean;
  lockReason: string | null;
}

interface CalendarDay {
  date: string;
  dayName: string;
  dayNum: number;
  isToday: boolean;
  isWeekend: boolean;
}

const toLocalDateString = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export default function RoomRateCalendar() {
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();

  const [properties, setProperties] = useState<Property[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([]);
  const [rates, setRates] = useState<RateEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [selectedProperty, setSelectedProperty] = useState<string>('');
  const [selectedRoomType, setSelectedRoomType] = useState<string>('');
  const [selectedRatePlan, setSelectedRatePlan] = useState<string>('');

  const [currentDate, setCurrentDate] = useState(new Date());
  const [editingCell, setEditingCell] = useState<{ date: string; ratePlanId: string } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkRate, setBulkRate] = useState<string>('');
  const [bulkStartDate, setBulkStartDate] = useState<string>('');
  const [bulkEndDate, setBulkEndDate] = useState<string>('');
  const [bulkReason, setBulkReason] = useState<string>('');

  // Generate calendar days for the current month view
  const calendarDays = useMemo<CalendarDay[]>(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: CalendarDay[] = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(year, month, d);
      const dateStr = toLocalDateString(date);
      days.push({
        date: dateStr,
        dayName: dayNames[date.getDay()],
        dayNum: d,
        isToday: date.getTime() === today.getTime(),
        isWeekend: date.getDay() === 0 || date.getDay() === 6,
      });
    }
    return days;
  }, [currentDate]);

  // Fetch properties on mount
  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const response = await fetch('/api/properties');
        const result = await response.json();
        if (result.success && result.data) {
          setProperties(result.data);
          if (result.data.length > 0) setSelectedProperty(result.data[0].id);
        }
      } catch (error) {
        console.error('Error fetching properties:', error);
      }
    };
    fetchProperties();
  }, []);

  // Fetch room types when property changes
  useEffect(() => {
    const fetchRoomTypes = async () => {
      if (!selectedProperty) return;
      try {
        const response = await fetch(`/api/room-types?propertyId=${selectedProperty}`);
        const result = await response.json();
        if (result.success && result.data) {
          setRoomTypes(result.data.filter((rt: { deletedAt: unknown }) => !rt.deletedAt));
          if (result.data.length > 0) setSelectedRoomType(result.data[0].id);
        }
      } catch (error) {
        console.error('Error fetching room types:', error);
      }
    };
    fetchRoomTypes();
  }, [selectedProperty]);

  // Fetch rate plans when room type changes
  useEffect(() => {
    const fetchRatePlans = async () => {
      if (!selectedProperty || !selectedRoomType) return;
      try {
        const response = await fetch(`/api/rate-plans?roomTypeId=${selectedRoomType}`);
        const result = await response.json();
        if (result.success && result.data) {
          setRatePlans(result.data);
          if (result.data.length > 0) setSelectedRatePlan(result.data[0].id);
        }
      } catch (error) {
        console.error('Error fetching rate plans:', error);
      }
    };
    fetchRatePlans();
  }, [selectedProperty, selectedRoomType]);

  // Fetch rates for current month view
  const fetchRates = useCallback(async () => {
    if (!selectedRoomType || !selectedRatePlan) return;
    setIsLoading(true);
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month + 1, 0).getDate();
      const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      const params = new URLSearchParams({
        roomTypeId: selectedRoomType,
        startDate,
        endDate,
      });

      const response = await fetch(`/api/rate-plans/bulk-rates?${params}`);
      const result = await response.json();
      if (result.success && result.data) {
        setRates(result.data.rates);
      }
    } catch (error) {
      console.error('Error fetching rates:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedRoomType, selectedRatePlan, currentDate]);

  useEffect(() => {
    fetchRates();
  }, [fetchRates]);

  // Navigation
  const goToPrevMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Get rate for a specific date and plan
  const getRate = (date: string, ratePlanId: string): RateEntry | undefined => {
    return rates.find(r => r.date === date && r.ratePlanId === ratePlanId);
  };

  // Handle cell click to edit
  const handleCellClick = (date: string, ratePlanId: string) => {
    const rate = getRate(date, ratePlanId);
    setEditingCell({ date, ratePlanId });
    setEditValue(rate?.overrideRate?.toString() || rate?.baseRate?.toString() || '');
  };

  // Save inline edit
  const saveInlineEdit = async () => {
    if (!editingCell || !editValue) return;

    setIsSaving(true);
    try {
      const response = await fetch('/api/rate-plans/bulk-rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomTypeId: selectedRoomType,
          ratePlanId: editingCell.ratePlanId,
          startDate: editingCell.date,
          endDate: editingCell.date,
          rates: { [editingCell.date]: parseFloat(editValue) },
          reason: 'Manual rate edit',
        }),
      });

      const result = await response.json();
      if (result.success) {
        toast({ title: 'Rate Updated', description: `Rate for ${editingCell.date} updated to ${formatCurrency(parseFloat(editValue))}` });
        setEditingCell(null);
        fetchRates();
      } else {
        toast({ title: 'Error', description: result.error?.message || 'Failed to update rate', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to update rate', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  // Bulk rate update
  const handleBulkUpdate = async () => {
    if (!bulkRate || !bulkStartDate || !bulkEndDate || !selectedRatePlan || !selectedRoomType) return;

    setIsSaving(true);
    try {
      const start = new Date(bulkStartDate);
      const end = new Date(bulkEndDate);
      const ratesMap: Record<string, number> = {};
      const price = parseFloat(bulkRate);

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        ratesMap[toLocalDateString(d)] = price;
      }

      const response = await fetch('/api/rate-plans/bulk-rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomTypeId: selectedRoomType,
          ratePlanId: selectedRatePlan,
          startDate: bulkStartDate,
          endDate: bulkEndDate,
          rates: ratesMap,
          reason: bulkReason || 'Bulk rate update',
        }),
      });

      const result = await response.json();
      if (result.success) {
        toast({ title: 'Bulk Update Complete', description: result.message });
        setBulkDialogOpen(false);
        setBulkRate('');
        setBulkReason('');
        fetchRates();
      } else {
        toast({ title: 'Error', description: result.error?.message || 'Failed to update rates', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to update rates', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  // Open bulk dialog with default dates
  const openBulkDialog = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    setBulkStartDate(`${year}-${String(month + 1).padStart(2, '0')}-01`);
    const lastDay = new Date(year, month + 1, 0).getDate();
    setBulkEndDate(`${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`);
    const plan = ratePlans.find(p => p.id === selectedRatePlan);
    setBulkRate(plan?.basePrice?.toString() || '');
    setBulkDialogOpen(true);
  };

  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Stats
  const avgRate = useMemo(() => {
    const planRates = rates.filter(r => r.ratePlanId === selectedRatePlan);
    if (planRates.length === 0) return 0;
    const sum = planRates.reduce((acc, r) => acc + (r.overrideRate ?? r.baseRate), 0);
    return sum / planRates.length;
  }, [rates, selectedRatePlan]);

  const minRate = useMemo(() => {
    const planRates = rates.filter(r => r.ratePlanId === selectedRatePlan);
    if (planRates.length === 0) return 0;
    return Math.min(...planRates.map(r => r.overrideRate ?? r.baseRate));
  }, [rates, selectedRatePlan]);

  const maxRate = useMemo(() => {
    const planRates = rates.filter(r => r.ratePlanId === selectedRatePlan);
    if (planRates.length === 0) return 0;
    return Math.max(...planRates.map(r => r.overrideRate ?? r.baseRate));
  }, [rates, selectedRatePlan]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Room Rate Calendar
          </h2>
          <p className="text-sm text-muted-foreground">
            View and edit nightly rates by room type and rate plan
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={goToToday}>
            <CalendarIcon className="h-4 w-4 mr-1" />
            Today
          </Button>
          <Button size="sm" onClick={openBulkDialog}>
            <Sparkles className="h-4 w-4 mr-1" />
            Bulk Update
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Property</Label>
              <Select value={selectedProperty} onValueChange={setSelectedProperty}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select property" />
                </SelectTrigger>
                <SelectContent>
                  {properties.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Room Type</Label>
              <Select value={selectedRoomType} onValueChange={setSelectedRoomType}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select room type" />
                </SelectTrigger>
                <SelectContent>
                  {roomTypes.map(rt => (
                    <SelectItem key={rt.id} value={rt.id}>
                      {rt.name} ({formatCurrency(rt.basePrice)} base)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Rate Plan</Label>
              <Select value={selectedRatePlan} onValueChange={setSelectedRatePlan}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select rate plan" />
                </SelectTrigger>
                <SelectContent>
                  {ratePlans.filter(rp => !selectedRoomType || rp.roomType?.id === selectedRoomType).map(rp => (
                    <SelectItem key={rp.id} value={rp.id}>
                      {rp.name} ({formatCurrency(rp.basePrice)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Month Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={goToPrevMonth}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          Previous
        </Button>
        <h3 className="text-lg font-semibold">{monthName}</h3>
        <Button variant="outline" size="sm" onClick={goToNextMonth}>
          Next
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3 bg-blue-50 dark:bg-blue-950/30 border-blue-200/50 dark:border-blue-800/30">
          <div className="text-center">
            <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{formatCurrency(avgRate)}</p>
            <p className="text-xs text-muted-foreground">Avg Rate</p>
          </div>
        </Card>
        <Card className="p-3 bg-green-50 dark:bg-green-950/30 border-green-200/50 dark:border-green-800/30">
          <div className="text-center">
            <p className="text-xl font-bold text-green-600 dark:text-green-400">{formatCurrency(minRate)}</p>
            <p className="text-xs text-muted-foreground">Min Rate</p>
          </div>
        </Card>
        <Card className="p-3 bg-red-50 dark:bg-red-950/30 border-red-200/50 dark:border-red-800/30">
          <div className="text-center">
            <p className="text-xl font-bold text-red-600 dark:text-red-400">{formatCurrency(maxRate)}</p>
            <p className="text-xs text-muted-foreground">Max Rate</p>
          </div>
        </Card>
      </div>

      {/* Calendar Grid */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <ScrollArea className="w-full">
              <div className="min-w-[900px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[60px] text-center sticky left-0 bg-background z-10">Day</TableHead>
                      <TableHead className="w-[40px] text-center sticky left-[60px] bg-background z-10">Date</TableHead>
                      {ratePlans.filter(rp => !selectedRoomType || rp.roomType?.id === selectedRoomType).map(rp => (
                        <TableHead key={rp.id} className="text-center min-w-[140px]">
                          {rp.name}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {calendarDays.map(day => {
                      const currentRatePlan = ratePlans.find(rp => rp.id === selectedRatePlan);
                      const rate = getRate(day.date, selectedRatePlan);

                      return (
                        <TableRow
                          key={day.date}
                          className={cn(
                            day.isToday && 'bg-primary/5',
                            day.isWeekend && 'bg-muted/30',
                          )}
                        >
                          <TableCell className="text-center text-xs font-medium text-muted-foreground sticky left-0 bg-background z-10">
                            {day.dayName}
                          </TableCell>
                          <TableCell className={cn(
                            'text-center text-sm font-medium sticky left-[60px] bg-background z-10',
                            day.isToday && 'text-primary',
                          )}>
                            {day.dayNum}
                          </TableCell>
                          {ratePlans.filter(rp => !selectedRoomType || rp.roomType?.id === selectedRoomType).map(rp => {
                            const dayRate = getRate(day.date, rp.id);
                            const effectiveRate = dayRate?.overrideRate ?? dayRate?.baseRate ?? 0;
                            const isOverridden = dayRate?.overrideRate !== null && dayRate?.overrideRate !== undefined;
                            const isSelectedPlan = rp.id === selectedRatePlan;

                            const cellStatus = dayRate?.locked
                              ? dayRate.lockReason === 'soldout'
                                ? 'soldout'
                                : 'restricted'
                              : dayRate?.closedToArrival || dayRate?.closedToDeparture
                                ? 'restricted'
                                : 'available';

                            return (
                              <TableCell key={rp.id} className="text-center p-0">
                                {editingCell?.date === day.date && editingCell?.ratePlanId === rp.id ? (
                                  <div className="flex items-center gap-1 p-1">
                                    <Input
                                      type="number"
                                      value={editValue}
                                      onChange={(e) => setEditValue(e.target.value)}
                                      className="h-7 text-xs text-center w-20"
                                      autoFocus
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') saveInlineEdit();
                                        if (e.key === 'Escape') setEditingCell(null);
                                      }}
                                    />
                                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={saveInlineEdit} disabled={isSaving}>
                                      {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3 text-green-600" />}
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditingCell(null)}>
                                      <X className="h-3 w-3 text-red-500" />
                                    </Button>
                                  </div>
                                ) : (
                                  <div
                                    className={cn(
                                      'cursor-pointer py-2 px-1 text-sm font-medium transition-colors hover:bg-muted/50 min-h-[40px] flex items-center justify-center',
                                      cellStatus === 'soldout' && 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300',
                                      cellStatus === 'restricted' && 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300',
                                      cellStatus === 'available' && 'text-foreground',
                                    )}
                                    onClick={() => isSelectedPlan && handleCellClick(day.date, rp.id)}
                                    title={isSelectedPlan ? 'Click to edit rate' : undefined}
                                  >
                                    <div className="flex flex-col items-center">
                                      <span>{formatCurrency(effectiveRate)}</span>
                                      <div className="flex gap-0.5 mt-0.5">
                                        {isOverridden && (
                                          <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                                            Edited
                                          </Badge>
                                        )}
                                        {dayRate?.closedToArrival && (
                                          <XCircle className="h-3 w-3 text-red-500" />
                                        )}
                                        {dayRate?.closedToDeparture && (
                                          <XCircle className="h-3 w-3 text-orange-500" />
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-green-100 dark:bg-green-900 border border-green-300 dark:border-green-700" />
          Available
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-amber-100 dark:bg-amber-900 border border-amber-300 dark:border-amber-700" />
          Restricted
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700" />
          Sold Out
        </div>
        <div className="flex items-center gap-1.5">
          <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3 bg-blue-100 text-blue-700">Edited</Badge>
          Rate Override
        </div>
      </div>

      {/* Bulk Update Dialog */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Bulk Rate Update
            </DialogTitle>
            <DialogDescription>
              Set a fixed rate for a range of dates
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Date Range</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="date"
                  value={bulkStartDate}
                  onChange={(e) => setBulkStartDate(e.target.value)}
                />
                <Input
                  type="date"
                  value={bulkEndDate}
                  onChange={(e) => setBulkEndDate(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>New Rate</Label>
              <Input
                type="number"
                value={bulkRate}
                onChange={(e) => setBulkRate(e.target.value)}
                placeholder="Enter rate amount"
              />
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Input
                value={bulkReason}
                onChange={(e) => setBulkReason(e.target.value)}
                placeholder="Seasonal pricing, weekend rate, etc."
              />
            </div>
            {bulkStartDate && bulkEndDate && (() => {
              const days = Math.ceil((new Date(bulkEndDate).getTime() - new Date(bulkStartDate).getTime()) / (1000 * 60 * 60 * 24)) + 1;
              return (
                <div className="p-3 bg-muted rounded-lg text-sm">
                  <p className="font-medium">{days} days will be updated</p>
                  <p className="text-muted-foreground">
                    All dates: {bulkStartDate} to {bulkEndDate} at {bulkRate ? formatCurrency(parseFloat(bulkRate)) : '-'}
                  </p>
                </div>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleBulkUpdate} disabled={isSaving || !bulkRate || !bulkStartDate || !bulkEndDate}>
              {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Apply Bulk Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
