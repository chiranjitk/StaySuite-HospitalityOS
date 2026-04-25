'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { Textarea } from '@/components/ui/textarea';
import {
  TrendingUp,
  Plus,
  Pencil,
  Trash2,
  Calendar,
  Loader2,
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
  description?: string;
  basePrice: number;
  currency: string;
  mealPlan: string;
  minStay: number;
  maxStay?: number;
  cancellationPolicy?: string;
  status: string;
  roomType?: RoomType;
  overridesCount?: number;
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

const mealPlans = [
  { value: 'room_only', label: 'Room Only' },
  { value: 'breakfast', label: 'Bed & Breakfast' },
  { value: 'half_board', label: 'Half Board' },
  { value: 'full_board', label: 'Full Board' },
  { value: 'all_inclusive', label: 'All Inclusive' },
];

const cancellationPolicies = [
  { value: 'flexible', label: 'Flexible (24h before)' },
  { value: 'moderate', label: 'Moderate (48h before)' },
  { value: 'strict', label: 'Strict (7 days before)' },
  { value: 'non_refundable', label: 'Non-refundable' },
];

export function PricingManager() {
  const { toast } = useToast();
  const { formatCurrency, currency } = useCurrency();
  const [properties, setProperties] = useState<Property[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([]);
  const [priceOverrides, setPriceOverrides] = useState<PriceOverride[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProperty, setSelectedProperty] = useState<string>('');
  const [selectedRoomType, setSelectedRoomType] = useState<string>('');

  // Dialog states
  const [isRatePlanOpen, setIsRatePlanOpen] = useState(false);
  const [isPriceOverrideOpen, setIsPriceOverrideOpen] = useState(false);
  const [selectedRatePlan, setSelectedRatePlan] = useState<RatePlan | null>(null);
  const [selectedOverride, setSelectedOverride] = useState<PriceOverride | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Rate plan form
  const [ratePlanForm, setRatePlanForm] = useState({
    roomTypeId: '',
    name: '',
    code: '',
    description: '',
    basePrice: '',
    mealPlan: 'room_only',
    minStay: 1,
    maxStay: '',
    cancellationPolicy: 'moderate',
    status: 'active',
  });

  // Price override form
  const [overrideForm, setOverrideForm] = useState({
    ratePlanId: '',
    date: '',
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

  // Fetch rate plans and overrides
  useEffect(() => {
    const fetchData = async () => {
      if (!selectedProperty) return;
      setIsLoading(true);

      try {
        // Fetch rate plans
        const ratePlansResponse = await fetch(`/api/rate-plans?propertyId=${selectedProperty}`);
        const ratePlansResult = await ratePlansResponse.json();
        if (ratePlansResult.success) {
          setRatePlans(ratePlansResult.data);
        }

        // Fetch price overrides
        const overridesResponse = await fetch('/api/price-overrides');
        const overridesResult = await overridesResponse.json();
        if (overridesResult.success) {
          // Filter overrides for current property
          const filteredOverrides = overridesResult.data.filter((o: PriceOverride) =>
            ratePlansResult.data.some((rp: RatePlan) => rp.id === o.ratePlanId)
          );
          setPriceOverrides(filteredOverrides);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        toast({
          title: 'Error',
          description: 'Failed to fetch pricing data',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [selectedProperty]);

  const openRatePlanDialog = (plan?: RatePlan) => {
    if (plan) {
      setSelectedRatePlan(plan);
      setRatePlanForm({
        roomTypeId: plan.roomTypeId,
        name: plan.name,
        code: plan.code,
        description: plan.description || '',
        basePrice: plan.basePrice.toString(),
        mealPlan: plan.mealPlan,
        minStay: plan.minStay,
        maxStay: plan.maxStay?.toString() || '',
        cancellationPolicy: plan.cancellationPolicy || 'moderate',
        status: plan.status,
      });
    } else {
      setSelectedRatePlan(null);
      setRatePlanForm({
        roomTypeId: selectedRoomType || roomTypes[0]?.id || '',
        name: '',
        code: '',
        description: '',
        basePrice: '',
        mealPlan: 'room_only',
        minStay: 1,
        maxStay: '',
        cancellationPolicy: 'moderate',
        status: 'active',
      });
    }
    setIsRatePlanOpen(true);
  };

  const handleSaveRatePlan = async () => {
    if (!ratePlanForm.roomTypeId || !ratePlanForm.name || !ratePlanForm.code || !ratePlanForm.basePrice) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const url = selectedRatePlan ? `/api/rate-plans/${selectedRatePlan.id}` : '/api/rate-plans';
      const method = selectedRatePlan ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...ratePlanForm,
          basePrice: parseFloat(ratePlanForm.basePrice),
          maxStay: ratePlanForm.maxStay ? parseInt(ratePlanForm.maxStay) : null,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: `Rate plan ${selectedRatePlan ? 'updated' : 'created'} successfully`,
        });
        setIsRatePlanOpen(false);
        // Refresh data
        const ratePlansResponse = await fetch(`/api/rate-plans?propertyId=${selectedProperty}`);
        const ratePlansResult = await ratePlansResponse.json();
        if (ratePlansResult.success) {
          setRatePlans(ratePlansResult.data);
        }
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to save rate plan',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error saving rate plan:', error);
      toast({
        title: 'Error',
        description: 'Failed to save rate plan',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRatePlan = async (planId: string) => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/rate-plans/${planId}`, { method: 'DELETE' });
      const result = await response.json();

      if (result.success) {
        toast({ title: 'Success', description: 'Rate plan deleted' });
        setRatePlans(prev => prev.filter(p => p.id !== planId));
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to delete rate plan',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error deleting rate plan:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete rate plan',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const openPriceOverrideDialog = (ratePlanId: string, override?: PriceOverride) => {
    setOverrideForm({
      ratePlanId,
      date: override?.date || new Date().toISOString().split('T')[0],
      price: override?.price?.toString() || '',
      reason: override?.reason || '',
      minStay: override?.minStay?.toString() || '',
      closedToArrival: override?.closedToArrival || false,
      closedToDeparture: override?.closedToDeparture || false,
    });
    setSelectedOverride(override || null);
    setIsPriceOverrideOpen(true);
  };

  const handleSavePriceOverride = async () => {
    if (!overrideForm.ratePlanId || !overrideForm.date || !overrideForm.price) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const url = selectedOverride ? `/api/price-overrides/${selectedOverride.id}` : '/api/price-overrides';
      const method = selectedOverride ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...overrideForm,
          price: parseFloat(overrideForm.price),
          minStay: overrideForm.minStay ? parseInt(overrideForm.minStay) : null,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: `Price override ${selectedOverride ? 'updated' : 'added'}`,
        });
        setIsPriceOverrideOpen(false);
        // Refresh overrides
        const overridesResponse = await fetch('/api/price-overrides');
        const overridesResult = await overridesResponse.json();
        if (overridesResult.success) {
          const filteredOverrides = overridesResult.data.filter((o: PriceOverride) =>
            ratePlans.some(rp => rp.id === o.ratePlanId)
          );
          setPriceOverrides(filteredOverrides);
        }
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to save price override',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error saving price override:', error);
      toast({
        title: 'Error',
        description: 'Failed to save price override',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteOverride = async (overrideId: string) => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/price-overrides/${overrideId}`, { method: 'DELETE' });
      const result = await response.json();

      if (result.success) {
        toast({ title: 'Success', description: 'Price override removed' });
        setPriceOverrides(prev => prev.filter(o => o.id !== overrideId));
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to delete override',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error deleting override:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete override',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Filter rate plans by selected room type
  const filteredRatePlans = selectedRoomType
    ? ratePlans.filter(p => p.roomTypeId === selectedRoomType)
    : ratePlans;

  // Filter overrides
  const filteredOverrides = priceOverrides.filter(o =>
    filteredRatePlans.some(p => p.id === o.ratePlanId)
  );

  const getMealPlanLabel = (value: string) => {
    return mealPlans.find(m => m.value === value)?.label || value;
  };

  const getCancellationLabel = (value?: string) => {
    return cancellationPolicies.find(c => c.value === value)?.label || value || 'Not set';
  };

  const getRoomTypeName = (roomTypeId: string) => {
    return roomTypes.find(rt => rt.id === roomTypeId)?.name || 'Unknown';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Pricing Management
          </h2>
          <p className="text-sm text-muted-foreground">
            Configure rate plans and price overrides
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedProperty} onValueChange={setSelectedProperty}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Property" />
            </SelectTrigger>
            <SelectContent>
              {properties.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedRoomType || 'all'} onValueChange={(v) => setSelectedRoomType(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Room Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {roomTypes.map(rt => (
                <SelectItem key={rt.id} value={rt.id}>{rt.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <Card className="p-4">
          <div className="text-2xl font-bold">{ratePlans.length}</div>
          <div className="text-xs text-muted-foreground">Rate Plans</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold">{roomTypes.length}</div>
          <div className="text-xs text-muted-foreground">Room Types</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold">{priceOverrides.length}</div>
          <div className="text-xs text-muted-foreground">Price Overrides</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold">
            {formatCurrency(roomTypes.length > 0
              ? Math.round(roomTypes.reduce((sum, rt) => sum + rt.basePrice, 0) / roomTypes.length)
              : 0)}
          </div>
          <div className="text-xs text-muted-foreground">Avg Base Rate</div>
        </Card>
      </div>

      <Tabs defaultValue="rate-plans" className="space-y-4">
        <TabsList>
          <TabsTrigger value="rate-plans">Rate Plans</TabsTrigger>
          <TabsTrigger value="overrides">Price Overrides</TabsTrigger>
        </TabsList>

        {/* Rate Plans Tab */}
        <TabsContent value="rate-plans">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg">Rate Plans</CardTitle>
                <Button size="sm" onClick={() => openRatePlanDialog()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Rate Plan
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredRatePlans.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <TrendingUp className="h-12 w-12 mb-4" />
                  <p>No rate plans found</p>
                  <p className="text-sm">Create rate plans to manage pricing</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Room Type</TableHead>
                      <TableHead>Meal Plan</TableHead>
                      <TableHead>Base Price</TableHead>
                      <TableHead>Min Stay</TableHead>
                      <TableHead>Cancellation</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRatePlans.map(plan => (
                      <TableRow key={plan.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{plan.name}</p>
                            <p className="text-xs text-muted-foreground">{plan.code}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{getRoomTypeName(plan.roomTypeId)}</Badge>
                        </TableCell>
                        <TableCell>{getMealPlanLabel(plan.mealPlan)}</TableCell>
                        <TableCell>
                          <span className="font-medium">{formatCurrency(plan.basePrice)}</span>
                        </TableCell>
                        <TableCell>{plan.minStay} night{plan.minStay > 1 ? 's' : ''}</TableCell>
                        <TableCell className="text-sm">{getCancellationLabel(plan.cancellationPolicy)}</TableCell>
                        <TableCell>
                          <Badge variant={plan.status === 'active' ? 'default' : 'secondary'}>
                            {plan.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openRatePlanDialog(plan)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                              onClick={() => handleDeleteRatePlan(plan.id)}
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
        </TabsContent>

        {/* Price Overrides Tab */}
        <TabsContent value="overrides">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg">Price Overrides</CardTitle>
                <Button
                  size="sm"
                  onClick={() => openPriceOverrideDialog(filteredRatePlans[0]?.id || '')}
                  disabled={filteredRatePlans.length === 0}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Override
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {filteredOverrides.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Calendar className="h-12 w-12 mb-4" />
                  <p>No price overrides</p>
                  <p className="text-sm">Add overrides to adjust prices for specific dates</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Rate Plan</TableHead>
                      <TableHead>Override Price</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Restrictions</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOverrides.map(override => {
                      const plan = ratePlans.find(p => p.id === override.ratePlanId);
                      return (
                        <TableRow key={override.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              {new Date(override.date).toLocaleDateString('en-US', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric'
                              })}
                            </div>
                          </TableCell>
                          <TableCell>{plan?.name || 'Unknown'}</TableCell>
                          <TableCell>
                            <span className="font-medium">{formatCurrency(override.price)}</span>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {override.reason || '-'}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {override.minStay && (
                                <Badge variant="outline" className="text-xs">
                                  Min {override.minStay} nights
                                </Badge>
                              )}
                              {override.closedToArrival && (
                                <Badge variant="outline" className="text-xs text-orange-600 dark:text-orange-400">
                                  CTA
                                </Badge>
                              )}
                              {override.closedToDeparture && (
                                <Badge variant="outline" className="text-xs text-orange-600 dark:text-orange-400">
                                  CTD
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openPriceOverrideDialog(override.ratePlanId, override)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive"
                                onClick={() => handleDeleteOverride(override.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Rate Plan Dialog */}
      <Dialog open={isRatePlanOpen} onOpenChange={setIsRatePlanOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedRatePlan ? 'Edit Rate Plan' : 'Create Rate Plan'}</DialogTitle>
            <DialogDescription>
              Configure pricing and restrictions
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Room Type</Label>
              <Select
                value={ratePlanForm.roomTypeId}
                onValueChange={(v) => setRatePlanForm(prev => ({ ...prev, roomTypeId: v }))}
                disabled={!!selectedRatePlan}
              >
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={ratePlanForm.name}
                  onChange={(e) => setRatePlanForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Standard Rate"
                />
              </div>
              <div className="space-y-2">
                <Label>Code</Label>
                <Input
                  value={ratePlanForm.code}
                  onChange={(e) => setRatePlanForm(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                  placeholder="STD"
                  maxLength={10}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={ratePlanForm.description}
                onChange={(e) => setRatePlanForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Rate plan description..."
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Base Price ({currency.symbol})</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{currency.symbol}</span>
                  <Input
                    type="number"
                    className="pl-9"
                    value={ratePlanForm.basePrice}
                    onChange={(e) => setRatePlanForm(prev => ({ ...prev, basePrice: e.target.value }))}
                    placeholder="3500"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Meal Plan</Label>
                <Select
                  value={ratePlanForm.mealPlan}
                  onValueChange={(v) => setRatePlanForm(prev => ({ ...prev, mealPlan: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {mealPlans.map(mp => (
                      <SelectItem key={mp.value} value={mp.value}>{mp.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Min Stay (nights)</Label>
                <Input
                  type="number"
                  min="1"
                  value={ratePlanForm.minStay}
                  onChange={(e) => setRatePlanForm(prev => ({ ...prev, minStay: parseInt(e.target.value) || 1 }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Max Stay (optional)</Label>
                <Input
                  type="number"
                  min="1"
                  value={ratePlanForm.maxStay}
                  onChange={(e) => setRatePlanForm(prev => ({ ...prev, maxStay: e.target.value }))}
                  placeholder="No limit"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Cancellation Policy</Label>
              <Select
                value={ratePlanForm.cancellationPolicy}
                onValueChange={(v) => setRatePlanForm(prev => ({ ...prev, cancellationPolicy: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {cancellationPolicies.map(cp => (
                    <SelectItem key={cp.value} value={cp.value}>{cp.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={ratePlanForm.status}
                onValueChange={(v) => setRatePlanForm(prev => ({ ...prev, status: v }))}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRatePlanOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveRatePlan} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {selectedRatePlan ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Price Override Dialog */}
      <Dialog open={isPriceOverrideOpen} onOpenChange={setIsPriceOverrideOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedOverride ? 'Edit Price Override' : 'Add Price Override'}</DialogTitle>
            <DialogDescription>
              Set a custom price for a specific date
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Rate Plan</Label>
              <Select
                value={overrideForm.ratePlanId}
                onValueChange={(v) => setOverrideForm(prev => ({ ...prev, ratePlanId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select rate plan" />
                </SelectTrigger>
                <SelectContent>
                  {filteredRatePlans.map(rp => (
                    <SelectItem key={rp.id} value={rp.id}>{rp.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={overrideForm.date}
                  onChange={(e) => setOverrideForm(prev => ({ ...prev, date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Override Price ({currency.symbol})</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{currency.symbol}</span>
                  <Input
                    type="number"
                    className="pl-9"
                    value={overrideForm.price}
                    onChange={(e) => setOverrideForm(prev => ({ ...prev, price: e.target.value }))}
                    placeholder="4500"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Reason</Label>
              <Input
                value={overrideForm.reason}
                onChange={(e) => setOverrideForm(prev => ({ ...prev, reason: e.target.value }))}
                placeholder="Holiday rate, Weekend pricing, etc."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Switch
                  checked={overrideForm.closedToArrival}
                  onCheckedChange={(c) => setOverrideForm(prev => ({ ...prev, closedToArrival: c }))}
                />
                <span>Closed to Arrival</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Switch
                  checked={overrideForm.closedToDeparture}
                  onCheckedChange={(c) => setOverrideForm(prev => ({ ...prev, closedToDeparture: c }))}
                />
                <span>Closed to Departure</span>
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPriceOverrideOpen(false)}>Cancel</Button>
            <Button onClick={handleSavePriceOverride} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {selectedOverride ? 'Update' : 'Add Override'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
