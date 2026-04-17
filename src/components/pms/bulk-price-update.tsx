'use client';

import React, { useState, useEffect } from 'react';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  Loader2,
  Plus,
  CalendarDays,
  Percent,
  IndianRupee,
  Zap,
  Target,
  BarChart3,
  Sparkles,
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
  roomTypeId: string;
  name: string;
  code: string;
  basePrice: number;
  currency: string;
  status: string;
  roomType?: RoomType;
}

interface BulkPriceEntry {
  date: string;
  price: number;
  reason: string;
}

interface DateRange {
  start: string;
  end: string;
}

export default function BulkPriceUpdate() {
  const { toast } = useToast();
  const { formatCurrency, currency } = useCurrency();
  const [properties, setProperties] = useState<Property[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Form state
  const [selectedProperty, setSelectedProperty] = useState<string>('');
  const [selectedRoomType, setSelectedRoomType] = useState<string>('');
  const [selectedRatePlan, setSelectedRatePlan] = useState<string>('');
  const [dateRange, setDateRange] = useState<DateRange>({
    start: new Date().toISOString().split('T')[0],
    end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  });

  // Bulk pricing options
  const [updateMode, setUpdateMode] = useState<'fixed' | 'percentage' | 'increment'>('fixed');
  const [priceValue, setPriceValue] = useState<string>('');
  const [percentageValue, setPercentageValue] = useState<string>('');
  const [reason, setReason] = useState<string>('');

  // Preview
  const [preview, setPreview] = useState<BulkPriceEntry[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);

  // Fetch properties
  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const response = await fetch('/api/properties');
        const result = await response.json();
        if (result.success) {
          setProperties(result.data);
          if (result.data.length > 0) {
            setSelectedProperty(result.data[0].id);
          }
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
        if (result.success) {
          setRoomTypes(result.data);
          if (result.data.length > 0) {
            setSelectedRoomType(result.data[0].id);
          }
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
      if (!selectedProperty) return;
      try {
        const response = await fetch(`/api/rate-plans?propertyId=${selectedProperty}`);
        const result = await response.json();
        if (result.success) {
          setRatePlans(result.data);
          if (result.data.length > 0) {
            setSelectedRatePlan(result.data[0].id);
          }
        }
      } catch (error) {
        console.error('Error fetching rate plans:', error);
      }
    };
    fetchRatePlans();
  }, [selectedProperty, selectedRoomType]);

  // Generate preview
  const generatePreview = () => {
    const ratePlan = ratePlans.find(rp => rp.id === selectedRatePlan);
    if (!ratePlan) return;

    const startDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);
    const entries: BulkPriceEntry[] = [];

    let newPrice = ratePlan.basePrice;
    if (updateMode === 'fixed') {
      newPrice = parseFloat(priceValue) || ratePlan.basePrice;
    } else if (updateMode === 'percentage') {
      const percent = parseFloat(percentageValue) || 0;
      newPrice = Math.round(ratePlan.basePrice * (1 + percent / 100));
    } else if (updateMode === 'increment') {
      newPrice = ratePlan.basePrice + (parseFloat(priceValue) || 0);
    }

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      entries.push({
        date: d.toISOString().split('T')[0],
        price: newPrice,
        reason: reason || `Bulk price update (${updateMode})`,
      });
    }

    setPreview(entries);
    setIsDialogOpen(true);
  };

  // Save bulk prices
  const handleSave = async () => {
    if (!selectedRatePlan || preview.length === 0) return;

    setIsSaving(true);
    setSaveProgress(0);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < preview.length; i++) {
      const entry = preview[i];
      try {
        const response = await fetch('/api/price-overrides', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ratePlanId: selectedRatePlan,
            date: entry.date,
            price: entry.price,
            reason: entry.reason,
          }),
        });

        const result = await response.json();
        if (result.success) {
          successCount++;
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      }

      setSaveProgress(Math.round(((i + 1) / preview.length) * 100));
    }

    setIsSaving(false);
    setIsDialogOpen(false);

    toast({
      title: 'Bulk Update Complete',
      description: `${successCount} prices updated successfully. ${failCount} failed.`,
    });

    // Reset form
    setPriceValue('');
    setPercentageValue('');
    setReason('');
    setPreview([]);
  };

  // Calculate days in range
  const getDaysInRange = () => {
    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  };

  const selectedRatePlanData = ratePlans.find(rp => rp.id === selectedRatePlan);
  const selectedRoomTypeData = roomTypes.find(rt => rt.id === selectedRoomType);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Bulk Price Update
          </h2>
          <p className="text-sm text-muted-foreground">
            Update prices for multiple dates at once
          </p>
        </div>
      </div>

      {/* Configuration Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Property & Room Type Selection */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Property</Label>
              <Select value={selectedProperty} onValueChange={setSelectedProperty}>
                <SelectTrigger>
                  <SelectValue placeholder="Select property" />
                </SelectTrigger>
                <SelectContent>
                  {properties.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Room Type</Label>
              <Select value={selectedRoomType} onValueChange={setSelectedRoomType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select room type" />
                </SelectTrigger>
                <SelectContent>
                  {roomTypes.map(rt => (
                    <SelectItem key={rt.id} value={rt.id}>{rt.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Rate Plan</Label>
              <Select value={selectedRatePlan} onValueChange={setSelectedRatePlan}>
                <SelectTrigger>
                  <SelectValue placeholder="Select rate plan" />
                </SelectTrigger>
                <SelectContent>
                  {ratePlans.filter(rp => !selectedRoomType || rp.roomTypeId === selectedRoomType).map(rp => (
                    <SelectItem key={rp.id} value={rp.id}>
                      {rp.name} ({formatCurrency(rp.basePrice)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Date Range */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Date Range ({getDaysInRange()} days)
            </Label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Start Date</Label>
                <Input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">End Date</Label>
                <Input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {/* Price Update Mode */}
          <div className="space-y-4">
            <Label>Update Method</Label>
            <div className="flex gap-2">
              <Button
                variant={updateMode === 'fixed' ? 'default' : 'outline'}
                onClick={() => setUpdateMode('fixed')}
                className="flex-1"
              >
                <IndianRupee className="h-4 w-4 mr-2" />
                Fixed Price
              </Button>
              <Button
                variant={updateMode === 'percentage' ? 'default' : 'outline'}
                onClick={() => setUpdateMode('percentage')}
                className="flex-1"
              >
                <Percent className="h-4 w-4 mr-2" />
                Percentage
              </Button>
              <Button
                variant={updateMode === 'increment' ? 'default' : 'outline'}
                onClick={() => setUpdateMode('increment')}
                className="flex-1"
              >
                <Plus className="h-4 w-4 mr-2" />
                Increment
              </Button>
            </div>

            {/* Value Input */}
            <div className="grid grid-cols-2 gap-4">
              {updateMode === 'fixed' && (
                <div className="space-y-2">
                  <Label>New Price ({currency.symbol})</Label>
                  <Input
                    type="number"
                    value={priceValue}
                    onChange={(e) => setPriceValue(e.target.value)}
                    placeholder="5000"
                  />
                  {selectedRatePlanData && (
                    <p className="text-xs text-muted-foreground">
                      Current base price: {formatCurrency(selectedRatePlanData.basePrice)}
                    </p>
                  )}
                </div>
              )}
              {updateMode === 'percentage' && (
                <div className="space-y-2">
                  <Label>Percentage Change (%)</Label>
                  <Input
                    type="number"
                    value={percentageValue}
                    onChange={(e) => setPercentageValue(e.target.value)}
                    placeholder="10 or -10"
                  />
                </div>
              )}
              {updateMode === 'increment' && (
                <div className="space-y-2">
                  <Label>Amount to Add ({currency.symbol})</Label>
                  <Input
                    type="number"
                    value={priceValue}
                    onChange={(e) => setPriceValue(e.target.value)}
                    placeholder="500"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>Reason</Label>
                <Input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Seasonal pricing, Weekend rate, etc."
                />
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          {selectedRatePlanData && (
            <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
              <div className="text-center">
                <p className="text-2xl font-bold">{formatCurrency(selectedRatePlanData.basePrice)}</p>
                <p className="text-xs text-muted-foreground">Current Base Rate</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{getDaysInRange()}</p>
                <p className="text-xs text-muted-foreground">Days to Update</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">
                  {updateMode === 'fixed' && priceValue ? formatCurrency(parseFloat(priceValue)) :
                   updateMode === 'percentage' && percentageValue ? `${percentageValue}%` :
                   updateMode === 'increment' && priceValue ? `+${formatCurrency(parseFloat(priceValue))}` : '-'}
                </p>
                <p className="text-xs text-muted-foreground">New Price</p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={generatePreview}
              disabled={!selectedRatePlan || !dateRange.start || !dateRange.end}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Preview Changes
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preview Price Updates</DialogTitle>
            <DialogDescription>
              Review the price changes before applying
            </DialogDescription>
          </DialogHeader>

          {isSaving ? (
            <div className="py-8 space-y-4">
              <Progress value={saveProgress} />
              <p className="text-center text-muted-foreground">
                Updating prices... {saveProgress}%
              </p>
            </div>
          ) : (
            <>
              <div className="max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Day</TableHead>
                      <TableHead>Base Price</TableHead>
                      <TableHead>New Price</TableHead>
                      <TableHead>Change</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.slice(0, 50).map((entry, idx) => {
                      const basePrice = selectedRatePlanData?.basePrice || 0;
                      const change = entry.price - basePrice;
                      const changePercent = basePrice > 0 ? ((change / basePrice) * 100).toFixed(1) : '0';
                      const date = new Date(entry.date);
                      
                      return (
                        <TableRow key={idx}>
                          <TableCell>
                            {date.toLocaleDateString('en-IN', { 
                              day: 'numeric', 
                              month: 'short' 
                            })}
                          </TableCell>
                          <TableCell>
                            {date.toLocaleDateString('en-IN', { weekday: 'short' })}
                          </TableCell>
                          <TableCell>{formatCurrency(basePrice)}</TableCell>
                          <TableCell className="font-medium">{formatCurrency(entry.price)}</TableCell>
                          <TableCell>
                            <Badge
                              variant="secondary"
                              className={cn(
                                change > 0 && 'text-green-600 bg-green-50',
                                change < 0 && 'text-red-600 bg-red-50'
                              )}
                            >
                              {change > 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : 
                               change < 0 ? <TrendingDown className="h-3 w-3 mr-1" /> : null}
                              {change > 0 ? '+' : ''}{changePercent}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {preview.length > 50 && (
                  <p className="text-center text-muted-foreground text-sm py-2">
                    Showing first 50 of {preview.length} entries
                  </p>
                )}
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={preview.length === 0}>
                  Apply {preview.length} Price Updates
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
