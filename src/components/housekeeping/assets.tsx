'use client';

import React, { useState, useEffect } from 'react';
import { useCurrency } from '@/contexts/CurrencyContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
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
import {
  Package,
  Plus,
  Search,
  Loader2,
  RefreshCw,
  MapPin,
  Calendar,
  DollarSign,
  AlertTriangle,
  MoreHorizontal,
  Pencil,
  Trash2,
  Wrench,
  CheckCircle2,
  Clock,
  Building2,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { format, formatDistanceToNow, isAfter, isBefore, addDays } from 'date-fns';

interface Asset {
  id: string;
  name: string;
  category: string;
  description: string | null;
  location: string | null;
  roomId: string | null;
  purchasePrice: number | null;
  purchaseDate: string | null;
  currentValue: number | null;
  warrantyExpiry: string | null;
  warrantyProvider: string | null;
  lastMaintenanceAt: string | null;
  nextMaintenanceAt: string | null;
  maintenanceIntervalDays: number | null;
  status: string;
  serialNumber: string | null;
  modelNumber: string | null;
  manufacturer: string | null;
  createdAt: string;
  room?: {
    id: string;
    number: string;
    roomType: {
      name: string;
    };
  } | null;
}

interface Property {
  id: string;
  name: string;
}

interface Room {
  id: string;
  number: string;
  roomType: {
    name: string;
  };
}

const assetCategories = [
  { value: 'furniture', label: 'Furniture' },
  { value: 'appliance', label: 'Appliance' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'vehicle', label: 'Vehicle' },
  { value: 'electronics', label: 'Electronics' },
  { value: 'other', label: 'Other' },
];

const assetStatuses = [
  { value: 'active', label: 'Active', color: 'bg-emerald-500' },
  { value: 'maintenance', label: 'In Maintenance', color: 'bg-amber-500' },
  { value: 'retired', label: 'Retired', color: 'bg-gray-500' },
  { value: 'disposed', label: 'Disposed', color: 'bg-red-500' },
];

// Mock assets removed - now using real API

export default function Assets() {
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    category: 'other',
    description: '',
    location: '',
    purchasePrice: '',
    purchaseDate: '',
    currentValue: '',
    warrantyExpiry: '',
    warrantyProvider: '',
    serialNumber: '',
    modelNumber: '',
    manufacturer: '',
    maintenanceIntervalDays: '',
    status: 'active',
  });

  // Fetch properties and assets
  const fetchInitialData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [propertiesRes, assetsRes] = await Promise.all([
        fetch('/api/properties'),
        fetch('/api/assets'),
      ]);
      
      const propertiesResult = await propertiesRes.json();
      if (propertiesResult.success) {
        setProperties(propertiesResult.data);
      }
      
      const assetsResult = await assetsRes.json();
      if (assetsResult.success) {
        setAssets(assetsResult.data);
      }
    } catch (error) {
      console.error('Error fetching initial data:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch assets',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // Filter assets
  const filteredAssets = assets.filter(asset => {
    const matchesSearch = !searchQuery || 
      asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.serialNumber?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || asset.category === categoryFilter;
    const matchesStatus = statusFilter === 'all' || asset.status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  // Stats
  const totalAssets = assets.length;
  const activeAssets = assets.filter(a => a.status === 'active').length;
  const maintenanceAssets = assets.filter(a => a.status === 'maintenance').length;
  const totalValue = assets.reduce((sum, a) => sum + (a.currentValue || 0), 0);
  
  // Assets needing attention
  const warrantyExpiringSoon = assets.filter(a => {
    if (!a.warrantyExpiry) return false;
    const expiry = new Date(a.warrantyExpiry);
    return isBefore(expiry, addDays(new Date(), 90)) && isAfter(expiry, new Date());
  }).length;
  
  const maintenanceDue = assets.filter(a => {
    if (!a.nextMaintenanceAt) return false;
    const due = new Date(a.nextMaintenanceAt);
    return isBefore(due, addDays(new Date(), 30));
  }).length;

  const handleCreate = async () => {
    if (!formData.name) {
      toast({
        title: 'Validation Error',
        description: 'Asset name is required',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          category: formData.category,
          description: formData.description || null,
          location: formData.location || null,
          purchasePrice: formData.purchasePrice ? parseFloat(formData.purchasePrice) : null,
          purchaseDate: formData.purchaseDate || null,
          currentValue: formData.currentValue ? parseFloat(formData.currentValue) : null,
          warrantyExpiry: formData.warrantyExpiry || null,
          warrantyProvider: formData.warrantyProvider || null,
          serialNumber: formData.serialNumber || null,
          modelNumber: formData.modelNumber || null,
          manufacturer: formData.manufacturer || null,
          maintenanceIntervalDays: formData.maintenanceIntervalDays ? parseInt(formData.maintenanceIntervalDays) : null,
          status: formData.status,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setAssets(prev => [result.data, ...prev]);
        toast({
          title: 'Success',
          description: 'Asset created successfully',
        });
        setIsCreateOpen(false);
        resetForm();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to create asset',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error creating asset:', error);
      toast({
        title: 'Error',
        description: 'Failed to create asset',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedAsset || !formData.name) return;

    setIsSaving(true);
    try {
      const response = await fetch('/api/assets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedAsset.id,
          name: formData.name,
          category: formData.category,
          description: formData.description || null,
          location: formData.location || null,
          purchasePrice: formData.purchasePrice ? parseFloat(formData.purchasePrice) : null,
          purchaseDate: formData.purchaseDate || null,
          currentValue: formData.currentValue ? parseFloat(formData.currentValue) : null,
          warrantyExpiry: formData.warrantyExpiry || null,
          warrantyProvider: formData.warrantyProvider || null,
          serialNumber: formData.serialNumber || null,
          modelNumber: formData.modelNumber || null,
          manufacturer: formData.manufacturer || null,
          maintenanceIntervalDays: formData.maintenanceIntervalDays ? parseInt(formData.maintenanceIntervalDays) : null,
          status: formData.status,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setAssets(prev => prev.map(a => a.id === selectedAsset.id ? result.data : a));
        toast({
          title: 'Success',
          description: 'Asset updated successfully',
        });
        setIsEditOpen(false);
        setSelectedAsset(null);
        resetForm();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to update asset',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error updating asset:', error);
      toast({
        title: 'Error',
        description: 'Failed to update asset',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedAsset) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/assets?id=${selectedAsset.id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        setAssets(prev => prev.filter(a => a.id !== selectedAsset.id));
        toast({
          title: 'Success',
          description: 'Asset deleted successfully',
        });
        setIsDeleteOpen(false);
        setSelectedAsset(null);
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to delete asset',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error deleting asset:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete asset',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      category: 'other',
      description: '',
      location: '',
      purchasePrice: '',
      purchaseDate: '',
      currentValue: '',
      warrantyExpiry: '',
      warrantyProvider: '',
      serialNumber: '',
      modelNumber: '',
      manufacturer: '',
      maintenanceIntervalDays: '',
      status: 'active',
    });
  };

  const openEditDialog = (asset: Asset) => {
    setSelectedAsset(asset);
    setFormData({
      name: asset.name,
      category: asset.category,
      description: asset.description || '',
      location: asset.location || '',
      purchasePrice: asset.purchasePrice?.toString() || '',
      purchaseDate: asset.purchaseDate ? format(new Date(asset.purchaseDate), 'yyyy-MM-dd') : '',
      currentValue: asset.currentValue?.toString() || '',
      warrantyExpiry: asset.warrantyExpiry ? format(new Date(asset.warrantyExpiry), 'yyyy-MM-dd') : '',
      warrantyProvider: asset.warrantyProvider || '',
      serialNumber: asset.serialNumber || '',
      modelNumber: asset.modelNumber || '',
      manufacturer: asset.manufacturer || '',
      maintenanceIntervalDays: asset.maintenanceIntervalDays?.toString() || '',
      status: asset.status,
    });
    setIsEditOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const option = assetStatuses.find(s => s.value === status);
    return (
      <Badge variant="secondary" className={cn('text-white', option?.color || 'bg-gray-500')}>
        {option?.label || status}
      </Badge>
    );
  };

  const getCategoryBadge = (category: string) => {
    const option = assetCategories.find(c => c.value === category);
    return (
      <Badge variant="outline" className="capitalize">
        {option?.label || category}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Package className="h-5 w-5" />
            Asset Management
          </h2>
          <p className="text-sm text-muted-foreground">
            Track and manage property assets and equipment
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => fetchInitialData()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => { resetForm(); setIsCreateOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Asset
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gray-500/10">
              <Package className="h-4 w-4 text-gray-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{totalAssets}</div>
              <div className="text-xs text-muted-foreground">Total Assets</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{activeAssets}</div>
              <div className="text-xs text-muted-foreground">Active</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Wrench className="h-4 w-4 text-amber-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{maintenanceAssets}</div>
              <div className="text-xs text-muted-foreground">In Maintenance</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <DollarSign className="h-4 w-4 text-violet-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{formatCurrency(totalValue)}</div>
              <div className="text-xs text-muted-foreground">Total Value</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-orange-500/10">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{warrantyExpiringSoon}</div>
              <div className="text-xs text-muted-foreground">Warranty Expiring</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <Clock className="h-4 w-4 text-cyan-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{maintenanceDue}</div>
              <div className="text-xs text-muted-foreground">Maintenance Due</div>
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
                  placeholder="Search assets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {assetCategories.map(category => (
                  <SelectItem key={category.value} value={category.value}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {assetStatuses.map(status => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Assets Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredAssets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mb-4" />
              <p>No assets found</p>
              <p className="text-sm">Add a new asset to get started</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Asset</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Warranty</TableHead>
                    <TableHead>Next Maintenance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAssets.map((asset) => {
                    const warrantyExpiring = asset.warrantyExpiry && 
                      isBefore(new Date(asset.warrantyExpiry), addDays(new Date(), 90));
                    const maintenanceDueSoon = asset.nextMaintenanceAt && 
                      isBefore(new Date(asset.nextMaintenanceAt), addDays(new Date(), 30));
                    
                    return (
                      <TableRow key={asset.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{asset.name}</p>
                            {asset.serialNumber && (
                              <p className="text-xs text-muted-foreground">
                                S/N: {asset.serialNumber}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{getCategoryBadge(asset.category)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm">{asset.location || 'Not specified'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{asset.currentValue ? formatCurrency(asset.currentValue) : '-'}</p>
                            {asset.purchasePrice && asset.currentValue && asset.purchasePrice !== asset.currentValue && (
                              <p className="text-xs text-muted-foreground line-through">
                                {formatCurrency(asset.purchasePrice)}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {asset.warrantyExpiry ? (
                            <div className={cn(
                              'flex items-center gap-1',
                              warrantyExpiring && 'text-amber-500'
                            )}>
                              <Calendar className="h-3 w-3" />
                              <span className="text-sm">
                                {format(new Date(asset.warrantyExpiry), 'MMM d, yyyy')}
                              </span>
                              {warrantyExpiring && (
                                <AlertTriangle className="h-3 w-3 ml-1" />
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">No warranty</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {asset.nextMaintenanceAt ? (
                            <div className={cn(
                              'flex items-center gap-1',
                              maintenanceDueSoon && 'text-amber-500'
                            )}>
                              <Wrench className="h-3 w-3" />
                              <span className="text-sm">
                                {format(new Date(asset.nextMaintenanceAt), 'MMM d, yyyy')}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">Not scheduled</span>
                          )}
                        </TableCell>
                        <TableCell>{getStatusBadge(asset.status)}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditDialog(asset)}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit Asset
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => { setSelectedAsset(asset); setIsDeleteOpen(true); }}
                                className="text-red-600"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete Asset
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Asset</DialogTitle>
            <DialogDescription>
              Register a new asset or equipment
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label htmlFor="name">Asset Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Air Conditioning Unit"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {assetCategories.map(category => (
                      <SelectItem key={category.value} value={category.value}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {assetStatuses.map(status => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Asset description..."
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                placeholder="e.g., Room 101, Pool Area"
                value={formData.location}
                onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="serialNumber">Serial Number</Label>
                <Input
                  id="serialNumber"
                  placeholder="S/N"
                  value={formData.serialNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, serialNumber: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="modelNumber">Model Number</Label>
                <Input
                  id="modelNumber"
                  placeholder="Model"
                  value={formData.modelNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, modelNumber: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="manufacturer">Manufacturer</Label>
              <Input
                id="manufacturer"
                placeholder="Manufacturer name"
                value={formData.manufacturer}
                onChange={(e) => setFormData(prev => ({ ...prev, manufacturer: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="purchasePrice">Purchase Price</Label>
                <Input
                  id="purchasePrice"
                  type="number"
                  placeholder="0.00"
                  value={formData.purchasePrice}
                  onChange={(e) => setFormData(prev => ({ ...prev, purchasePrice: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currentValue">Current Value</Label>
                <Input
                  id="currentValue"
                  type="number"
                  placeholder="0.00"
                  value={formData.currentValue}
                  onChange={(e) => setFormData(prev => ({ ...prev, currentValue: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="purchaseDate">Purchase Date</Label>
                <Input
                  id="purchaseDate"
                  type="date"
                  value={formData.purchaseDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, purchaseDate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="warrantyExpiry">Warranty Expiry</Label>
                <Input
                  id="warrantyExpiry"
                  type="date"
                  value={formData.warrantyExpiry}
                  onChange={(e) => setFormData(prev => ({ ...prev, warrantyExpiry: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="warrantyProvider">Warranty Provider</Label>
                <Input
                  id="warrantyProvider"
                  placeholder="Provider name"
                  value={formData.warrantyProvider}
                  onChange={(e) => setFormData(prev => ({ ...prev, warrantyProvider: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maintenanceIntervalDays">Maint. Interval (days)</Label>
                <Input
                  id="maintenanceIntervalDays"
                  type="number"
                  placeholder="90"
                  value={formData.maintenanceIntervalDays}
                  onChange={(e) => setFormData(prev => ({ ...prev, maintenanceIntervalDays: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Asset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Asset</DialogTitle>
            <DialogDescription>
              Update asset details
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label htmlFor="edit-name">Asset Name *</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-category">Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {assetCategories.map(category => (
                      <SelectItem key={category.value} value={category.value}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {assetStatuses.map(status => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-location">Location</Label>
              <Input
                id="edit-location"
                value={formData.location}
                onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-serialNumber">Serial Number</Label>
                <Input
                  id="edit-serialNumber"
                  value={formData.serialNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, serialNumber: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-modelNumber">Model Number</Label>
                <Input
                  id="edit-modelNumber"
                  value={formData.modelNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, modelNumber: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-manufacturer">Manufacturer</Label>
              <Input
                id="edit-manufacturer"
                value={formData.manufacturer}
                onChange={(e) => setFormData(prev => ({ ...prev, manufacturer: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-purchasePrice">Purchase Price</Label>
                <Input
                  id="edit-purchasePrice"
                  type="number"
                  value={formData.purchasePrice}
                  onChange={(e) => setFormData(prev => ({ ...prev, purchasePrice: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-currentValue">Current Value</Label>
                <Input
                  id="edit-currentValue"
                  type="number"
                  value={formData.currentValue}
                  onChange={(e) => setFormData(prev => ({ ...prev, currentValue: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-purchaseDate">Purchase Date</Label>
                <Input
                  id="edit-purchaseDate"
                  type="date"
                  value={formData.purchaseDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, purchaseDate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-warrantyExpiry">Warranty Expiry</Label>
                <Input
                  id="edit-warrantyExpiry"
                  type="date"
                  value={formData.warrantyExpiry}
                  onChange={(e) => setFormData(prev => ({ ...prev, warrantyExpiry: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-warrantyProvider">Warranty Provider</Label>
                <Input
                  id="edit-warrantyProvider"
                  value={formData.warrantyProvider}
                  onChange={(e) => setFormData(prev => ({ ...prev, warrantyProvider: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-maintenanceIntervalDays">Maint. Interval (days)</Label>
                <Input
                  id="edit-maintenanceIntervalDays"
                  type="number"
                  value={formData.maintenanceIntervalDays}
                  onChange={(e) => setFormData(prev => ({ ...prev, maintenanceIntervalDays: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Update Asset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Asset</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this asset? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {selectedAsset && (
              <div className="rounded-lg bg-muted p-4">
                <p className="font-medium">{selectedAsset.name}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedAsset.location || 'No location specified'}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete Asset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
