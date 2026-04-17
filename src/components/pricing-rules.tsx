'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
import {
  CalendarDays,
  Plus,
  Pencil,
  Trash2,
  Search,
  DollarSign,
  Loader2,
  Calendar,
  ArrowUpDown,
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
  propertyId: string;
}

interface RatePlan {
  id: string;
  roomTypeId: string;
  name: string;
  code: string;
  basePrice: number;
  status: string;
  roomType?: RoomType;
}

interface PriceOverride {
  id: string;
  ratePlanId: string;
  date: string;
  price: number;
  reason?: string;
  minStay?: number;
  closedToArrival: boolean;
  closedToDeparture: boolean;
  ratePlan?: RatePlan;
}

export function PricingRules() {
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const [overrides, setOverrides] = useState<PriceOverride[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [propertyFilter, setPropertyFilter] = useState<string>('all');

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedOverride, setSelectedOverride] = useState<PriceOverride | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    ratePlanId: '',
    date: new Date().toISOString().split('T')[0],
    price: '',
    reason: '',
    minStay: '',
    closedToArrival: false,
    closedToDeparture: false,
  });

  // Fetch properties
  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const response = await fetch('/api/properties');
        const result = await response.json();
        if (result.success) {
          setProperties(result.data);
        }
      } catch (error) {
        console.error('Error fetching properties:', error);
      }
    };
    fetchProperties();
  }, []);

  // Fetch room types
  useEffect(() => {
    const fetchRoomTypes = async () => {
      try {
        const params = new URLSearchParams();
        if (propertyFilter !== 'all') {
          params.append('propertyId', propertyFilter);
        }
        const response = await fetch(`/api/room-types?${params.toString()}`);
        const result = await response.json();
        if (result.success) {
          setRoomTypes(result.data);
        }
      } catch (error) {
        console.error('Error fetching room types:', error);
      }
    };
    fetchRoomTypes();
  }, [propertyFilter]);

  // Fetch rate plans
  useEffect(() => {
    const fetchRatePlans = async () => {
      try {
        const params = new URLSearchParams();
        if (propertyFilter !== 'all') {
          params.append('propertyId', propertyFilter);
        }
        const response = await fetch(`/api/rate-plans?${params.toString()}`);
        const result = await response.json();
        if (result.success) {
          setRatePlans(result.data);
          if (result.data.length > 0 && !formData.ratePlanId) {
            setFormData(prev => ({ ...prev, ratePlanId: result.data[0].id }));
          }
        }
      } catch (error) {
        console.error('Error fetching rate plans:', error);
      }
    };
    fetchRatePlans();
  }, [propertyFilter]);

  // Fetch price overrides
  const fetchOverrides = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/price-overrides');
      const result = await response.json();

      if (result.success) {
        // Filter by property if needed
        let data = result.data;
        if (propertyFilter !== 'all') {
          data = data.filter((o: PriceOverride) =>
            o.ratePlan?.roomType?.propertyId === propertyFilter ||
            ratePlans.find(rp => rp.id === o.ratePlanId)?.roomType?.propertyId === propertyFilter
          );
        }
        setOverrides(data);
      }
    } catch (error) {
      console.error('Error fetching price overrides:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch price overrides',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOverrides();
  }, [propertyFilter, ratePlans]);

  // Create price override
  const handleCreate = async () => {
    if (!formData.ratePlanId || !formData.date || !formData.price) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/price-overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          price: parseFloat(formData.price),
          minStay: formData.minStay ? parseInt(formData.minStay) : null,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Price override created successfully',
        });
        setIsCreateOpen(false);
        resetForm();
        fetchOverrides();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to create price override',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error creating price override:', error);
      toast({
        title: 'Error',
        description: 'Failed to create price override',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Update price override
  const handleUpdate = async () => {
    if (!selectedOverride) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/price-overrides/${selectedOverride.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          price: parseFloat(formData.price),
          reason: formData.reason,
          minStay: formData.minStay ? parseInt(formData.minStay) : null,
          closedToArrival: formData.closedToArrival,
          closedToDeparture: formData.closedToDeparture,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Price override updated successfully',
        });
        setIsEditOpen(false);
        setSelectedOverride(null);
        fetchOverrides();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to update price override',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error updating price override:', error);
      toast({
        title: 'Error',
        description: 'Failed to update price override',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Delete price override
  const handleDelete = async () => {
    if (!selectedOverride) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/price-overrides/${selectedOverride.id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Price override deleted successfully',
        });
        setIsDeleteOpen(false);
        setSelectedOverride(null);
        fetchOverrides();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to delete price override',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error deleting price override:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete price override',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const openEditDialog = (override: PriceOverride) => {
    setSelectedOverride(override);
    setFormData({
      ratePlanId: override.ratePlanId,
      date: override.date,
      price: override.price.toString(),
      reason: override.reason || '',
      minStay: override.minStay?.toString() || '',
      closedToArrival: override.closedToArrival,
      closedToDeparture: override.closedToDeparture,
    });
    setIsEditOpen(true);
  };

  const openDeleteDialog = (override: PriceOverride) => {
    setSelectedOverride(override);
    setIsDeleteOpen(true);
  };

  const resetForm = () => {
    setFormData({
      ratePlanId: ratePlans[0]?.id || '',
      date: new Date().toISOString().split('T')[0],
      price: '',
      reason: '',
      minStay: '',
      closedToArrival: false,
      closedToDeparture: false,
    });
  };

  // Filter overrides by search query
  const filteredOverrides = overrides.filter(override => {
    const ratePlan = ratePlans.find(rp => rp.id === override.ratePlanId);
    return (
      override.reason?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ratePlan?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      override.date.includes(searchQuery)
    );
  });

  // Sort by date
  const sortedOverrides = [...filteredOverrides].sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const getRatePlanName = (ratePlanId: string) => {
    return ratePlans.find(rp => rp.id === ratePlanId)?.name || 'Unknown';
  };

  const getRoomTypeName = (ratePlanId: string) => {
    const ratePlan = ratePlans.find(rp => rp.id === ratePlanId);
    if (!ratePlan?.roomType) return 'Unknown';
    return ratePlan.roomType.name;
  };

  const isPast = (date: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(date) < today;
  };

  // Stats
  const stats = {
    total: overrides.length,
    upcoming: overrides.filter(o => !isPast(o.date)).length,
    avgPrice: overrides.length > 0
      ? Math.round(overrides.reduce((sum, o) => sum + o.price, 0) / overrides.length)
      : 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Pricing Rules
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage date-specific price overrides and restrictions
          </p>
        </div>
        <Button onClick={() => { resetForm(); setIsCreateOpen(true); }} disabled={ratePlans.length === 0}>
          <Plus className="h-4 w-4 mr-2" />
          Add Override
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3">
        <Card className="p-4">
          <div className="text-2xl font-bold">{stats.total}</div>
          <div className="text-xs text-muted-foreground">Total Overrides</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-emerald-500">{stats.upcoming}</div>
          <div className="text-xs text-muted-foreground">Upcoming</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold">{formatCurrency(stats.avgPrice)}</div>
          <div className="text-xs text-muted-foreground">Avg Override Price</div>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by date, reason, or rate plan..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={propertyFilter} onValueChange={setPropertyFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Select Property" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Properties</SelectItem>
                {properties.map(property => (
                  <SelectItem key={property.id} value={property.id}>
                    {property.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Overrides Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : sortedOverrides.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Calendar className="h-12 w-12 mb-4" />
              <p>No price overrides found</p>
              <p className="text-sm">Add overrides to adjust prices for specific dates</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Rate Plan</TableHead>
                  <TableHead>Room Type</TableHead>
                  <TableHead>Override Price</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Restrictions</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedOverrides.map((override) => (
                  <TableRow key={override.id} className={cn(isPast(override.date) && 'opacity-50')}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium">
                            {new Date(override.date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(override.date).toLocaleDateString('en-US', {
                              weekday: 'short',
                              year: 'numeric',
                            })}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{getRatePlanName(override.ratePlanId)}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{getRoomTypeName(override.ratePlanId)}</TableCell>
                    <TableCell>
                      <span className="font-medium">{formatCurrency(override.price)}</span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-32 truncate">
                      {override.reason || '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {override.minStay && (
                          <Badge variant="secondary" className="text-xs">
                            Min {override.minStay}n
                          </Badge>
                        )}
                        {override.closedToArrival && (
                          <Badge variant="outline" className="text-xs text-orange-600 border-orange-200">
                            CTA
                          </Badge>
                        )}
                        {override.closedToDeparture && (
                          <Badge variant="outline" className="text-xs text-orange-600 border-orange-200">
                            CTD
                          </Badge>
                        )}
                        {!override.minStay && !override.closedToArrival && !override.closedToDeparture && (
                          <span className="text-xs text-muted-foreground">None</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(override)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDeleteDialog(override)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Price Override</DialogTitle>
            <DialogDescription>
              Set a custom price for a specific date
            </DialogDescription>
          </DialogHeader>
          <OverrideForm
            formData={formData}
            setFormData={setFormData}
            ratePlans={ratePlans}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Override
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Price Override</DialogTitle>
            <DialogDescription>
              Update price override details
            </DialogDescription>
          </DialogHeader>
          <OverrideForm
            formData={formData}
            setFormData={setFormData}
            ratePlans={ratePlans}
            isEdit
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Price Override</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this price override? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Override Form Component
interface OverrideFormData {
  ratePlanId: string;
  date: string;
  price: string;
  reason: string;
  minStay: string;
  closedToArrival: boolean;
  closedToDeparture: boolean;
}

interface OverrideFormProps {
  formData: OverrideFormData;
  setFormData: React.Dispatch<React.SetStateAction<OverrideFormData>>;
  ratePlans: RatePlan[];
  isEdit?: boolean;
}

function OverrideForm({ formData, setFormData, ratePlans, isEdit }: OverrideFormProps) {
  const { formatCurrency } = useCurrency();
  const selectedRatePlan = ratePlans.find(rp => rp.id === formData.ratePlanId);

  return (
    <div className="grid gap-4 py-4">
      {/* Rate Plan Selection */}
      <div className="space-y-2">
        <Label htmlFor="ratePlanId">Rate Plan *</Label>
        <Select
          value={formData.ratePlanId as string}
          onValueChange={(value) => setFormData(prev => ({ ...prev, ratePlanId: value }))}
          disabled={isEdit}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select rate plan" />
          </SelectTrigger>
          <SelectContent>
            {ratePlans.filter(rp => rp.status === 'active').map(rp => (
              <SelectItem key={rp.id} value={rp.id}>
                {rp.name} ({formatCurrency(rp.basePrice)})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Date and Price */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="date">Date *</Label>
          <Input
            id="date"
            type="date"
            value={formData.date as string}
            onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
            disabled={isEdit}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="price">Override Price *</Label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="price"
              type="number"
              className="pl-9"
              value={formData.price as string}
              onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
              placeholder={selectedRatePlan?.basePrice.toString() || '199.00'}
              min="0"
              step="0.01"
            />
          </div>
          {selectedRatePlan && (
            <p className="text-xs text-muted-foreground">
              Base: {formatCurrency(selectedRatePlan.basePrice)}
            </p>
          )}
        </div>
      </div>

      {/* Reason */}
      <div className="space-y-2">
        <Label htmlFor="reason">Reason</Label>
        <Input
          id="reason"
          value={formData.reason as string}
          onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
          placeholder="Holiday rate, Weekend pricing, etc."
        />
      </div>

      {/* Min Stay */}
      <div className="space-y-2">
        <Label htmlFor="minStay">Minimum Stay (nights)</Label>
        <Input
          id="minStay"
          type="number"
          min="1"
          value={formData.minStay as string}
          onChange={(e) => setFormData(prev => ({ ...prev, minStay: e.target.value }))}
          placeholder="No minimum"
        />
      </div>

      {/* Restrictions */}
      <div className="space-y-3">
        <Label>Restrictions</Label>
        <div className="grid grid-cols-2 gap-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Switch
              checked={formData.closedToArrival as boolean}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, closedToArrival: checked }))}
            />
            <span>Closed to Arrival</span>
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Switch
              checked={formData.closedToDeparture as boolean}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, closedToDeparture: checked }))}
            />
            <span>Closed to Departure</span>
          </label>
        </div>
        <p className="text-xs text-muted-foreground">
          CTA/CTD restrictions prevent check-ins/check-outs on this date
        </p>
      </div>
    </div>
  );
}
