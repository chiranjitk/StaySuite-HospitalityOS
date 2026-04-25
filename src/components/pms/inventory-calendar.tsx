'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Package,
  Loader2,
  Pencil,
  DollarSign,
  Lock,
  Unlock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/contexts/CurrencyContext';

interface Property {
  id: string;
  name: string;
}

interface RoomType {
  id: string;
  name: string;
  code: string;
  basePrice: number;
  totalRooms: number;
}

interface InventoryData {
  date: string;
  roomTypeId: string;
  available: number;
  total: number;
  price: number;
}

interface RatePlan {
  id: string;
  roomTypeId: string;
  name: string;
  basePrice: number;
  status: string;
}

const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const toLocalDateString = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export default function InventoryCalendar() {
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const [properties, setProperties] = useState<Property[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  // Calendar state
  const [currentDate, setCurrentDate] = useState(new Date());
  const [inventoryData, setInventoryData] = useState<InventoryData[]>([]);

  // Edit dialog state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editData, setEditData] = useState<{
    date: string;
    roomTypeId: string;
    available: number;
    price: number;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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

  // Fetch inventory data when property changes
  useEffect(() => {
    const fetchInventory = async () => {
      if (!selectedProperty) return;
      setIsLoading(true);

      // Calculate date range for current month view
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, month + 2, 0); // Get 2 months of data for navigation

      try {
        const params = new URLSearchParams({
          propertyId: selectedProperty,
          startDate: toLocalDateString(startDate),
          endDate: toLocalDateString(endDate),
        });

        const response = await fetch(`/api/inventory?${params.toString()}`);
        const result = await response.json();

        if (result.success) {
          setInventoryData(result.data);
          setRoomTypes(result.roomTypes || []);
        }
      } catch (error) {
        console.error('Error fetching inventory:', error);
        toast({
          title: 'Error',
          description: 'Failed to fetch inventory data',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchInventory();
  }, [selectedProperty, currentDate]);

  // Fetch rate plans for the selected property
  useEffect(() => {
    const fetchRatePlans = async () => {
      if (!selectedProperty) return;
      try {
        const response = await fetch(`/api/rate-plans?propertyId=${selectedProperty}`);
        const result = await response.json();
        if (result.success) {
          setRatePlans(result.data);
        }
      } catch (error) {
        console.error('Error fetching rate plans:', error);
      }
    };
    fetchRatePlans();
  }, [selectedProperty]);

  // Generate calendar dates for the current month
  const calendarDates = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const dates: Date[] = [];

    // Add days from previous month to fill the first week
    const firstDayOfWeek = firstDay.getDay();
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      dates.push(new Date(year, month, -i));
    }

    // Add days of current month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      dates.push(new Date(year, month, i));
    }

    // Add days from next month to fill the last week
    const remainingDays = 42 - dates.length; // 6 rows * 7 days
    for (let i = 1; i <= remainingDays; i++) {
      dates.push(new Date(year, month + 1, i));
    }

    return dates;
  }, [currentDate]);

  // Navigate months
  const goToPreviousMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Get inventory for a specific date and room type
  const getInventory = (date: Date, roomTypeId: string): InventoryData | undefined => {
    const dateStr = toLocalDateString(date);
    return inventoryData.find(d => d.date === dateStr && d.roomTypeId === roomTypeId);
  };

  // Get availability color
  const getAvailabilityColor = (available: number, total: number) => {
    if (total === 0) return 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400';
    const percent = available / total;
    if (percent === 0) return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    if (percent <= 0.25) return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
    if (percent <= 0.5) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
    if (percent <= 0.75) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
  };

  // Check if date is today
  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  // Check if date is in current month
  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentDate.getMonth();
  };

  // Check if date is in past
  const isPast = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  // Format date for display
  const formatDate = (date: Date) => {
    return date.getDate().toString();
  };

  // Open edit dialog
  const openEditDialog = (date: Date, roomTypeId: string) => {
    const inventory = getInventory(date, roomTypeId);
    if (!inventory || isPast(date)) return;

    setEditData({
      date: toLocalDateString(date),
      roomTypeId,
      available: inventory.available,
      price: inventory.price,
    });
    setIsEditOpen(true);
  };

  // Handle price update
  const handlePriceUpdate = async () => {
    if (!editData) return;
    setIsSaving(true);

    try {
      // Find the rate plan for this room type
      const ratePlan = ratePlans.find(rp => rp.roomTypeId === editData.roomTypeId);
      if (!ratePlan) {
        toast({
          title: 'Error',
          description: 'No rate plan found for this room type',
          variant: 'destructive',
        });
        return;
      }

      // Create/update price override
      const response = await fetch('/api/price-overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ratePlanId: ratePlan.id,
          date: editData.date,
          price: editData.price,
          reason: 'Manual adjustment',
        }),
      });

      const result = await response.json();

      if (result.success) {
        // Update local state
        setInventoryData(prev =>
          prev.map(inv =>
            inv.date === editData.date && inv.roomTypeId === editData.roomTypeId
              ? { ...inv, price: editData.price }
              : inv
          )
        );
        toast({
          title: 'Success',
          description: 'Price updated successfully',
        });
        setIsEditOpen(false);
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to update price',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error updating price:', error);
      toast({
        title: 'Error',
        description: 'Failed to update price',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Calculate stats for the month
  const monthlyStats = useMemo(() => {
    const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

    let totalAvailable = 0;
    let totalRooms = 0;
    let avgPrice = 0;
    let priceCount = 0;

    inventoryData.forEach(inv => {
      const invDate = new Date(inv.date);
      if (invDate >= monthStart && invDate <= monthEnd) {
        totalAvailable += inv.available;
        totalRooms += inv.total;
        avgPrice += inv.price;
        priceCount++;
      }
    });

    return {
      occupancy: totalRooms > 0 ? Math.round((1 - totalAvailable / totalRooms) * 100) : 0,
      avgPrice: priceCount > 0 ? Math.round(avgPrice / priceCount) : 0,
    };
  }, [inventoryData, currentDate]);

  // Selected date details
  const [selectedCell, setSelectedCell] = useState<{
    date: string;
    roomTypeId: string;
  } | null>(null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Package className="h-5 w-5" />
            Inventory Calendar
          </h2>
          <p className="text-sm text-muted-foreground">
            View and manage room availability and pricing
          </p>
        </div>
        <Select value={selectedProperty} onValueChange={setSelectedProperty}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Select Property" />
          </SelectTrigger>
          <SelectContent>
            {properties.map(property => (
              <SelectItem key={property.id} value={property.id}>
                {property.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <Card className="p-4">
          <div className="text-2xl font-bold">{monthlyStats.occupancy}%</div>
          <div className="text-xs text-muted-foreground">Avg Occupancy</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold">{formatCurrency(monthlyStats.avgPrice)}</div>
          <div className="text-xs text-muted-foreground">Avg Daily Rate</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold">{roomTypes.length}</div>
          <div className="text-xs text-muted-foreground">Room Types</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold">
            {roomTypes.reduce((sum, rt) => sum + rt.totalRooms, 0)}
          </div>
          <div className="text-xs text-muted-foreground">Total Rooms</div>
        </Card>
      </div>

      {/* Calendar Navigation */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={goToPreviousMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-[160px] text-center font-semibold">
                {months[currentDate.getMonth()]} {currentDate.getFullYear()}
              </div>
              <Button variant="outline" size="icon" onClick={goToNextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={goToToday} className="ml-2">
                Today
              </Button>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline" className="gap-1">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                Available
              </Badge>
              <Badge variant="outline" className="gap-1">
                <div className="w-2 h-2 rounded-full bg-yellow-500" />
                Limited
              </Badge>
              <Badge variant="outline" className="gap-1">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                Sold Out
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : roomTypes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <CalendarIcon className="h-12 w-12 mb-4" />
              <p>No room types found</p>
              <p className="text-sm">Create room types to view inventory</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              {/* Room Type Header Row */}
              <div className="grid gap-1" style={{ gridTemplateColumns: '80px repeat(7, minmax(90px, 1fr))' }}>
                {/* Empty corner cell */}
                <div className="p-2 font-medium text-xs text-muted-foreground">Room Type</div>
                {/* Day headers */}
                {calendarDates.slice(0, 7).map((date, idx) => (
                  <div key={idx} className="p-2 text-center font-medium text-xs">
                    {daysOfWeek[date.getDay()]}
                  </div>
                ))}
              </div>

              {/* Calendar Grid by Room Type */}
              {roomTypes.map(roomType => (
                <div key={roomType.id}>
                  <div className="grid gap-1" style={{ gridTemplateColumns: '80px repeat(7, minmax(90px, 1fr))' }}>
                    {/* Room Type Cell */}
                    <div className="p-2 border-t">
                      <div className="font-medium text-xs truncate">{roomType.name}</div>
                      <div className="text-xs text-muted-foreground">{roomType.totalRooms} rooms</div>
                    </div>

                    {/* Date Cells */}
                    {calendarDates.map((date, idx) => {
                      const inventory = getInventory(date, roomType.id);
                      const isCurrent = isCurrentMonth(date);
                      const past = isPast(date);

                      return (
                        <div
                          key={idx}
                          className={cn(
                            "p-1 border-t text-center transition-colors",
                            !isCurrent && "bg-muted/30 text-muted-foreground",
                            isToday(date) && "ring-2 ring-primary ring-inset",
                            selectedCell?.date === toLocalDateString(date) &&
                            selectedCell?.roomTypeId === roomType.id && "bg-primary/10",
                            !past && "cursor-pointer hover:bg-muted/50"
                          )}
                          onClick={() => {
                            if (!past) {
                              setSelectedCell({
                                date: toLocalDateString(date),
                                roomTypeId: roomType.id,
                              });
                            }
                          }}
                          onDoubleClick={() => openEditDialog(date, roomType.id)}
                        >
                          <div className="text-xs font-medium mb-1">{formatDate(date)}</div>
                          {inventory && (
                            <>
                              <div className={cn(
                                "text-xs font-semibold rounded px-1",
                                getAvailabilityColor(inventory.available, inventory.total)
                              )}>
                                {inventory.available}/{inventory.total}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {formatCurrency(inventory.price)}
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selected Cell Details */}
      {selectedCell && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg">
                {formatDate(new Date(selectedCell.date))}
              </CardTitle>
              {!isPast(new Date(selectedCell.date)) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openEditDialog(new Date(selectedCell.date), selectedCell.roomTypeId)}
                >
                  <Pencil className="h-4 w-4 mr-1" />
                  Edit Price
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {roomTypes.filter(rt => rt.id === selectedCell.roomTypeId).map(roomType => {
                const inventory = inventoryData.find(
                  d => d.date === selectedCell.date && d.roomTypeId === roomType.id
                );

                return (
                  <div key={roomType.id} className="space-y-2">
                    <div className="font-medium">{roomType.name}</div>
                    {inventory && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Available:</span>
                          <span className="ml-1 font-medium text-emerald-600 dark:text-emerald-400">{inventory.available}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Total:</span>
                          <span className="ml-1">{inventory.total}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Price:</span>
                          <span className="ml-1 font-medium">{formatCurrency(inventory.price)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Sold:</span>
                          <span className="ml-1">{inventory.total - inventory.available}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Pricing</DialogTitle>
            <DialogDescription>
              Update the price for this date
            </DialogDescription>
          </DialogHeader>
          {editData && (
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <div className="text-sm">
                  {formatDate(new Date(editData.date))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Room Type</Label>
                <div className="text-sm">
                  {roomTypes.find(rt => rt.id === editData.roomTypeId)?.name || 'Unknown'}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Price ($)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="price"
                    type="number"
                    className="pl-9"
                    value={editData.price}
                    onChange={(e) => setEditData(prev => prev ? { ...prev, price: parseFloat(e.target.value) || 0 } : null)}
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handlePriceUpdate} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Update Price
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
