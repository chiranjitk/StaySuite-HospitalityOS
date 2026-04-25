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
import { Switch } from '@/components/ui/switch';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Percent,
  DollarSign,
  Tag,
  Search,
  Loader2,
  Plus,
  Edit,
  Trash2,
  Copy,
  RefreshCw,
  CheckCircle,
  Clock,
  XCircle,
  Calendar,
  BarChart3,
  Gift,
  Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
// date-fns format removed - using useTimezone context

interface Discount {
  id: string;
  code: string;
  name: string;
  description: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  maxDiscount: number | null;
  minBookingValue: number | null;
  minNights: number;
  applicableRoomTypes: string[];
  property: string;
  startsAt: string;
  endsAt: string | null;
  maxUses: number | null;
  usedCount: number;
  maxUsesPerUser: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

const discountTypes = [
  { value: 'percentage', label: 'Percentage (%)', icon: Percent },
  { value: 'fixed', label: 'Fixed Amount', icon: DollarSign },
];

export default function Discounts() {
  const { toast } = useToast();
  const { formatCurrency, currency } = useCurrency();
  const { formatDate, formatTime, formatDateTime, settings } = useTimezone();
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    expired: 0,
    totalSavings: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedDiscount, setSelectedDiscount] = useState<Discount | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    discountType: 'percentage' as 'percentage' | 'fixed',
    discountValue: '',
    maxDiscount: '',
    minBookingValue: '',
    minNights: '1',
    startsAt: '',
    endsAt: '',
    maxUses: '',
    maxUsesPerUser: '',
  });

  // Fetch discounts
  const fetchDiscounts = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (typeFilter !== 'all') params.append('type', typeFilter);

      const response = await fetch(`/api/settings/discounts?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setDiscounts(result.data);
        setStats(result.stats);
      }
    } catch (error) {
      console.error('Error fetching discounts:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch discounts',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDiscounts();
  }, [statusFilter, typeFilter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length >= 2 || searchQuery.length === 0) {
        fetchDiscounts();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Generate random code using Web Crypto API
  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const array = new Uint8Array(8);
    crypto.getRandomValues(array);
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars[array[i] % chars.length];
    }
    setFormData(prev => ({ ...prev, code }));
  };

  // Create discount
  const handleCreate = async () => {
    if (!formData.name || !formData.discountValue) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/settings/discounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          code: formData.code || undefined,
          description: formData.description,
          discountType: formData.discountType,
          discountValue: parseFloat(formData.discountValue),
          maxDiscount: formData.maxDiscount ? parseFloat(formData.maxDiscount) : null,
          minBookingValue: formData.minBookingValue ? parseFloat(formData.minBookingValue) : null,
          minNights: parseInt(formData.minNights) || 1,
          startsAt: formData.startsAt || undefined,
          endsAt: formData.endsAt || undefined,
          maxUses: formData.maxUses ? parseInt(formData.maxUses) : null,
          maxUsesPerUser: formData.maxUsesPerUser ? parseInt(formData.maxUsesPerUser) : null,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Discount created successfully',
        });
        setIsCreateOpen(false);
        resetForm();
        fetchDiscounts();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to create discount',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error creating discount:', error);
      toast({
        title: 'Error',
        description: 'Failed to create discount',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Update discount
  const handleUpdate = async () => {
    if (!selectedDiscount || !formData.name || !formData.discountValue) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/settings/discounts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedDiscount.id,
          name: formData.name,
          code: formData.code,
          description: formData.description,
          discountType: formData.discountType,
          discountValue: parseFloat(formData.discountValue),
          startsAt: formData.startsAt || undefined,
          endsAt: formData.endsAt || undefined,
          status: selectedDiscount.status,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Discount updated successfully',
        });
        setIsEditOpen(false);
        resetForm();
        fetchDiscounts();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to update discount',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error updating discount:', error);
      toast({
        title: 'Error',
        description: 'Failed to update discount',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Delete discount
  const handleDelete = async () => {
    if (!selectedDiscount) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/settings/discounts?id=${selectedDiscount.id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Discount deleted successfully',
        });
        setIsDeleteOpen(false);
        setSelectedDiscount(null);
        fetchDiscounts();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to delete discount',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error deleting discount:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete discount',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle discount status
  const toggleStatus = async (discount: Discount) => {
    try {
      const newStatus = discount.status === 'active' ? 'inactive' : 'active';
      const response = await fetch('/api/settings/discounts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: discount.id,
          status: newStatus,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: `Discount ${newStatus === 'active' ? 'activated' : 'deactivated'}`,
        });
        fetchDiscounts();
      }
    } catch (error) {
      console.error('Error toggling discount:', error);
      toast({
        title: 'Error',
        description: 'Failed to update discount status',
        variant: 'destructive',
      });
    }
  };

  // Copy code to clipboard
  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: 'Copied!',
      description: `Code ${code} copied to clipboard`,
    });
  };

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      description: '',
      discountType: 'percentage',
      discountValue: '',
      maxDiscount: '',
      minBookingValue: '',
      minNights: '1',
      startsAt: '',
      endsAt: '',
      maxUses: '',
      maxUsesPerUser: '',
    });
    setSelectedDiscount(null);
  };

  const editDiscount = (discount: Discount) => {
    setSelectedDiscount(discount);
    setFormData({
      name: discount.name,
      code: discount.code,
      description: discount.description,
      discountType: discount.discountType,
      discountValue: discount.discountValue.toString(),
      maxDiscount: discount.maxDiscount?.toString() || '',
      minBookingValue: discount.minBookingValue?.toString() || '',
      minNights: discount.minNights.toString(),
      startsAt: discount.startsAt ? discount.startsAt.split('T')[0] : '',
      endsAt: discount.endsAt ? discount.endsAt.split('T')[0] : '',
      maxUses: discount.maxUses?.toString() || '',
      maxUsesPerUser: discount.maxUsesPerUser?.toString() || '',
    });
    setIsEditOpen(true);
  };

  const getStatusBadge = (status: string, endsAt: string | null) => {
    const isExpired = endsAt && new Date(endsAt) < new Date();
    if (isExpired) {
      return (
        <Badge variant="secondary" className="bg-gray-500 text-white gap-1">
          <XCircle className="h-3 w-3" />
          Expired
        </Badge>
      );
    }
    const statusMap: Record<string, { label: string; color: string; icon: React.ElementType }> = {
      active: { label: 'Active', color: 'bg-emerald-500', icon: CheckCircle },
      inactive: { label: 'Inactive', color: 'bg-gray-500', icon: XCircle },
    };
    const option = statusMap[status] || { label: status, color: 'bg-gray-500', icon: Clock };
    const Icon = option.icon;
    return (
      <Badge variant="secondary" className={cn('text-white gap-1', option.color)}>
        <Icon className="h-3 w-3" />
        {option.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Discounts Management
          </h2>
          <p className="text-sm text-muted-foreground">
            Create and manage discount codes
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchDiscounts}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => { resetForm(); setIsCreateOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            New Discount
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <Tag className="h-4 w-4 text-violet-500 dark:text-violet-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-xs text-muted-foreground">Total Discounts</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <CheckCircle className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.active}</div>
              <div className="text-xs text-muted-foreground">Active</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gray-500/10">
              <XCircle className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.expired}</div>
              <div className="text-xs text-muted-foreground">Expired</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <Gift className="h-4 w-4 text-cyan-500 dark:text-cyan-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{formatCurrency(stats.totalSavings)}</div>
              <div className="text-xs text-muted-foreground">Total Savings</div>
            </div>
          </div>
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
                  placeholder="Search by code or name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="percentage">Percentage</SelectItem>
                <SelectItem value="fixed">Fixed Amount</SelectItem>
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

      {/* Discounts Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : discounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Tag className="h-12 w-12 mb-4" />
              <p>No discounts found</p>
              <p className="text-sm">Create your first discount code to get started</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Discount</TableHead>
                    <TableHead>Validity</TableHead>
                    <TableHead>Usage</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {discounts.map((discount) => {
                    const usageProgress = discount.maxUses
                      ? (discount.usedCount / discount.maxUses) * 100
                      : 0;

                    return (
                      <TableRow key={discount.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <code className="px-2 py-1 bg-muted rounded font-mono text-sm">
                              {discount.code}
                            </code>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => copyCode(discount.code)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{discount.name}</p>
                            {discount.description && (
                              <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                                {discount.description}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {discount.discountType === 'percentage' ? (
                              <>
                                <Percent className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
                                <span className="font-medium">{discount.discountValue}%</span>
                              </>
                            ) : (
                              <>
                                <DollarSign className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
                                <span className="font-medium">{discount.discountValue}</span>
                              </>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p>{formatDate(discount.startsAt)}</p>
                            {discount.endsAt && (
                              <p className="text-xs text-muted-foreground">
                                to {formatDate(discount.endsAt)}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="text-sm">{discount.usedCount} uses</p>
                            {discount.maxUses && (
                              <Progress value={usageProgress} className="h-1.5" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(discount.status, discount.endsAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => {
                                setSelectedDiscount(discount);
                                setIsDetailOpen(true);
                              }}
                              title="View Details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => editDiscount(discount)}
                              title="Edit"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => toggleStatus(discount)}
                              title={discount.status === 'active' ? 'Deactivate' : 'Activate'}
                            >
                              <Switch
                                checked={discount.status === 'active'}
                                className="data-[state=checked]:bg-emerald-500"
                              />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-600 dark:text-red-400"
                              onClick={() => {
                                setSelectedDiscount(discount);
                                setIsDeleteOpen(true);
                              }}
                              title="Delete"
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
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Discount Dialog */}
      <Dialog open={isCreateOpen || isEditOpen} onOpenChange={(open) => {
        if (!open) {
          setIsCreateOpen(false);
          setIsEditOpen(false);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>{isEditOpen ? 'Edit Discount' : 'Create Discount'}</DialogTitle>
            <DialogDescription>
              {isEditOpen ? 'Update discount details' : 'Create a new discount code'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 flex-1 overflow-y-auto pr-2 -mr-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Summer Sale"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Code</Label>
                <div className="flex gap-2">
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                    placeholder="AUTO"
                    className="flex-1"
                  />
                  <Button variant="outline" size="icon" onClick={generateCode} title="Generate Code">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Discount description..."
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="discountType">Discount Type *</Label>
                <Select
                  value={formData.discountType}
                  onValueChange={(value: 'percentage' | 'fixed') => 
                    setFormData(prev => ({ ...prev, discountType: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {discountTypes.map(type => {
                      const Icon = type.icon;
                      return (
                        <SelectItem key={type.value} value={type.value}>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            {type.label}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="discountValue">Value *</Label>
                <div className="relative">
                  {formData.discountType === 'fixed' && (
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  )}
                  <Input
                    id="discountValue"
                    type="number"
                    min="0"
                    step={formData.discountType === 'percentage' ? '1' : '0.01'}
                    value={formData.discountValue}
                    onChange={(e) => setFormData(prev => ({ ...prev, discountValue: e.target.value }))}
                    placeholder={formData.discountType === 'percentage' ? '10' : '50.00'}
                    className={formData.discountType === 'fixed' ? 'pl-9' : ''}
                  />
                  {formData.discountType === 'percentage' && (
                    <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">%</span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startsAt">Start Date</Label>
                <Input
                  id="startsAt"
                  type="date"
                  value={formData.startsAt}
                  onChange={(e) => setFormData(prev => ({ ...prev, startsAt: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endsAt">End Date</Label>
                <Input
                  id="endsAt"
                  type="date"
                  value={formData.endsAt}
                  onChange={(e) => setFormData(prev => ({ ...prev, endsAt: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="minNights">Min. Nights</Label>
                <Input
                  id="minNights"
                  type="number"
                  min="1"
                  value={formData.minNights}
                  onChange={(e) => setFormData(prev => ({ ...prev, minNights: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxUses">Max Uses</Label>
                <Input
                  id="maxUses"
                  type="number"
                  min="0"
                  placeholder="Unlimited"
                  value={formData.maxUses}
                  onChange={(e) => setFormData(prev => ({ ...prev, maxUses: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="shrink-0">
            <Button variant="outline" onClick={() => {
              setIsCreateOpen(false);
              setIsEditOpen(false);
              resetForm();
            }}>
              Cancel
            </Button>
            <Button onClick={isEditOpen ? handleUpdate : handleCreate} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEditOpen ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Discount Details
            </DialogTitle>
          </DialogHeader>
          {selectedDiscount && (
            <div className="space-y-4">
              <Card className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <code className="px-3 py-1.5 bg-muted rounded font-mono text-lg">
                    {selectedDiscount.code}
                  </code>
                  {getStatusBadge(selectedDiscount.status, selectedDiscount.endsAt)}
                </div>
                <p className="font-medium text-lg">{selectedDiscount.name}</p>
                {selectedDiscount.description && (
                  <p className="text-sm text-muted-foreground mt-1">{selectedDiscount.description}</p>
                )}
              </Card>

              <Card className="p-4">
                <h4 className="text-sm font-medium text-muted-foreground mb-3">Discount Value</h4>
                <div className="flex items-center gap-2">
                  {selectedDiscount.discountType === 'percentage' ? (
                    <>
                      <div className="p-2 rounded-lg bg-emerald-500/10">
                        <Percent className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{selectedDiscount.discountValue}%</p>
                        <p className="text-xs text-muted-foreground">Percentage discount</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="p-2 rounded-lg bg-emerald-500/10">
                        <DollarSign className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{formatCurrency(selectedDiscount.discountValue)}</p>
                        <p className="text-xs text-muted-foreground">Fixed amount discount</p>
                      </div>
                    </>
                  )}
                </div>
              </Card>

              <Card className="p-4">
                <h4 className="text-sm font-medium text-muted-foreground mb-3">Details</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Valid From</span>
                    <span>{formatDate(selectedDiscount.startsAt)}</span>
                  </div>
                  {selectedDiscount.endsAt && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Valid Until</span>
                      <span>{formatDate(selectedDiscount.endsAt)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Min. Nights</span>
                    <span>{selectedDiscount.minNights}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Times Used</span>
                    <span>{selectedDiscount.usedCount}{selectedDiscount.maxUses ? ` / ${selectedDiscount.maxUses}` : ''}</span>
                  </div>
                </div>
              </Card>

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => copyCode(selectedDiscount.code)}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Code
                </Button>
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => {
                    setIsDetailOpen(false);
                    editDiscount(selectedDiscount);
                  }}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Discount</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete discount code &quot;{selectedDiscount?.code}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={isSaving}
            >
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
