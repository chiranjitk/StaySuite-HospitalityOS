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
import { Textarea } from '@/components/ui/textarea';
import {
  Tag,
  Plus,
  Pencil,
  Trash2,
  Search,
  DollarSign,
  Loader2,
  Clock,
  Coffee,
  Utensils,
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
  cancellationHours?: number;
  status: string;
  roomType?: RoomType;
  overridesCount?: number;
}

const mealPlans = [
  { value: 'room_only', label: 'Room Only', icon: Tag },
  { value: 'breakfast', label: 'Bed & Breakfast', icon: Coffee },
  { value: 'half_board', label: 'Half Board', icon: Utensils },
  { value: 'full_board', label: 'Full Board', icon: Utensils },
  { value: 'all_inclusive', label: 'All Inclusive', icon: Utensils },
];

const cancellationPolicies = [
  { value: 'flexible', label: 'Flexible (24h before)', hours: 24 },
  { value: 'moderate', label: 'Moderate (48h before)', hours: 48 },
  { value: 'strict', label: 'Strict (7 days before)', hours: 168 },
  { value: 'non_refundable', label: 'Non-refundable', hours: 0 },
];

export function RatePlansManager() {
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [propertyFilter, setPropertyFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<RatePlan | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
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
          if (result.data.length > 0 && !formData.roomTypeId) {
            setFormData(prev => ({ ...prev, roomTypeId: result.data[0].id }));
          }
        }
      } catch (error) {
        console.error('Error fetching room types:', error);
      }
    };
    fetchRoomTypes();
  }, [propertyFilter]);

  // Fetch rate plans
  const fetchRatePlans = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (propertyFilter !== 'all') {
        params.append('propertyId', propertyFilter);
      }
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const response = await fetch(`/api/rate-plans?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setRatePlans(result.data);
      }
    } catch (error) {
      console.error('Error fetching rate plans:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch rate plans',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRatePlans();
  }, [propertyFilter, statusFilter]);

  // Generate code from name
  const generateCode = (name: string) => {
    return name
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '')
      .substring(0, 8);
  };

  const handleNameChange = (name: string) => {
    setFormData(prev => ({
      ...prev,
      name,
      code: generateCode(name),
    }));
  };

  // Create rate plan
  const handleCreate = async () => {
    if (!formData.roomTypeId || !formData.name || !formData.code || !formData.basePrice) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/rate-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          basePrice: parseFloat(formData.basePrice),
          maxStay: formData.maxStay ? parseInt(formData.maxStay) : null,
          cancellationHours: cancellationPolicies.find(p => p.value === formData.cancellationPolicy)?.hours,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Rate plan created successfully',
        });
        setIsCreateOpen(false);
        resetForm();
        fetchRatePlans();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to create rate plan',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error creating rate plan:', error);
      toast({
        title: 'Error',
        description: 'Failed to create rate plan',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Update rate plan
  const handleUpdate = async () => {
    if (!selectedPlan) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/rate-plans/${selectedPlan.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          basePrice: parseFloat(formData.basePrice),
          maxStay: formData.maxStay ? parseInt(formData.maxStay) : null,
          cancellationHours: cancellationPolicies.find(p => p.value === formData.cancellationPolicy)?.hours,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Rate plan updated successfully',
        });
        setIsEditOpen(false);
        setSelectedPlan(null);
        fetchRatePlans();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to update rate plan',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error updating rate plan:', error);
      toast({
        title: 'Error',
        description: 'Failed to update rate plan',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Delete rate plan
  const handleDelete = async () => {
    if (!selectedPlan) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/rate-plans/${selectedPlan.id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Rate plan deleted successfully',
        });
        setIsDeleteOpen(false);
        setSelectedPlan(null);
        fetchRatePlans();
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

  const openEditDialog = (plan: RatePlan) => {
    setSelectedPlan(plan);
    setFormData({
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
    setIsEditOpen(true);
  };

  const openDeleteDialog = (plan: RatePlan) => {
    setSelectedPlan(plan);
    setIsDeleteOpen(true);
  };

  const resetForm = () => {
    setFormData({
      roomTypeId: roomTypes[0]?.id || '',
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
  };

  // Filter rate plans by search query
  const filteredPlans = ratePlans.filter(plan =>
    plan.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    plan.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getMealPlanLabel = (value: string) => {
    return mealPlans.find(m => m.value === value)?.label || value;
  };

  const getCancellationLabel = (value?: string) => {
    return cancellationPolicies.find(c => c.value === value)?.label || value || 'Not set';
  };

  const getRoomTypeName = (roomTypeId: string) => {
    const plan = ratePlans.find(p => p.roomTypeId === roomTypeId);
    return plan?.roomType?.name || roomTypes.find(rt => rt.id === roomTypeId)?.name || 'Unknown';
  };

  // Stats
  const stats = {
    total: ratePlans.length,
    active: ratePlans.filter(p => p.status === 'active').length,
    avgPrice: ratePlans.length > 0
      ? Math.round(ratePlans.reduce((sum, p) => sum + p.basePrice, 0) / ratePlans.length)
      : 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Rate Plans
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage pricing plans for your room types
          </p>
        </div>
        <Button onClick={() => { resetForm(); setIsCreateOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Add Rate Plan
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3">
        <Card className="p-4">
          <div className="text-2xl font-bold">{stats.total}</div>
          <div className="text-xs text-muted-foreground">Total Rate Plans</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-emerald-500 dark:text-emerald-400">{stats.active}</div>
          <div className="text-xs text-muted-foreground">Active Plans</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold">{formatCurrency(stats.avgPrice)}</div>
          <div className="text-xs text-muted-foreground">Avg Base Price</div>
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
                  placeholder="Search rate plans..."
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
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Rate Plans Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredPlans.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Tag className="h-12 w-12 mb-4" />
              <p>No rate plans found</p>
              <p className="text-sm">Create your first rate plan to get started</p>
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
                {filteredPlans.map((plan) => (
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
                          size="icon"
                          onClick={() => openEditDialog(plan)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDeleteDialog(plan)}
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Rate Plan</DialogTitle>
            <DialogDescription>
              Define a new pricing plan
            </DialogDescription>
          </DialogHeader>
          <RatePlanForm
            formData={formData}
            setFormData={setFormData}
            roomTypes={roomTypes}
            onNameChange={handleNameChange}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Rate Plan</DialogTitle>
            <DialogDescription>
              Update rate plan details
            </DialogDescription>
          </DialogHeader>
          <RatePlanForm
            formData={formData}
            setFormData={setFormData}
            roomTypes={roomTypes}
            onNameChange={handleNameChange}
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
            <DialogTitle>Delete Rate Plan</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{selectedPlan?.name}&quot;? This action cannot be undone.
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

// Rate Plan Form Component
interface RatePlanFormData {
  roomTypeId: string;
  name: string;
  code: string;
  description: string;
  basePrice: string;
  mealPlan: string;
  minStay: number;
  maxStay: string;
  cancellationPolicy: string;
  status: string;
}

interface RatePlanFormProps {
  formData: RatePlanFormData;
  setFormData: React.Dispatch<React.SetStateAction<RatePlanFormData>>;
  roomTypes: RoomType[];
  onNameChange: (name: string) => void;
  isEdit?: boolean;
}

function RatePlanForm({ formData, setFormData, roomTypes, onNameChange, isEdit }: RatePlanFormProps) {
  const { formatCurrency } = useCurrency();
  return (
    <div className="grid gap-4 py-4">
      {/* Room Type Selection */}
      <div className="space-y-2">
        <Label htmlFor="roomTypeId">Room Type *</Label>
        <Select
          value={formData.roomTypeId as string}
          onValueChange={(value) => setFormData(prev => ({ ...prev, roomTypeId: value }))}
          disabled={isEdit}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select room type" />
          </SelectTrigger>
          <SelectContent>
            {roomTypes.map(rt => (
              <SelectItem key={rt.id} value={rt.id}>
                {rt.name} ({formatCurrency(rt.basePrice)})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Name and Code */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name *</Label>
          <Input
            id="name"
            value={formData.name as string}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Standard Rate"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="code">Code *</Label>
          <Input
            id="code"
            value={formData.code as string}
            onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
            placeholder="STD"
            maxLength={10}
          />
        </div>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description as string}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Rate plan description..."
          rows={2}
        />
      </div>

      {/* Base Price and Meal Plan */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="basePrice">Base Price *</Label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="basePrice"
              type="number"
              className="pl-9"
              value={formData.basePrice as string}
              onChange={(e) => setFormData(prev => ({ ...prev, basePrice: e.target.value }))}
              placeholder="199.00"
              min="0"
              step="0.01"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="mealPlan">Meal Plan</Label>
          <Select
            value={formData.mealPlan as string}
            onValueChange={(value) => setFormData(prev => ({ ...prev, mealPlan: value }))}
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

      {/* Min/Max Stay */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="minStay">Min Stay (nights)</Label>
          <Input
            id="minStay"
            type="number"
            min="1"
            value={formData.minStay as number}
            onChange={(e) => setFormData(prev => ({ ...prev, minStay: parseInt(e.target.value) || 1 }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="maxStay">Max Stay (optional)</Label>
          <Input
            id="maxStay"
            type="number"
            min="1"
            value={formData.maxStay as string}
            onChange={(e) => setFormData(prev => ({ ...prev, maxStay: e.target.value }))}
            placeholder="No limit"
          />
        </div>
      </div>

      {/* Cancellation Policy */}
      <div className="space-y-2">
        <Label htmlFor="cancellationPolicy">Cancellation Policy</Label>
        <Select
          value={formData.cancellationPolicy as string}
          onValueChange={(value) => setFormData(prev => ({ ...prev, cancellationPolicy: value }))}
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

      {/* Status */}
      <div className="space-y-2">
        <Label htmlFor="status">Status</Label>
        <Select
          value={formData.status as string}
          onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
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
  );
}
