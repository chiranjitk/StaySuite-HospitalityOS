'use client';

import { useState, useEffect, useCallback } from 'react';
import { useCurrency } from '@/contexts/CurrencyContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { usePropertyId } from '@/hooks/use-property';
import { 
  Search, 
  Plus, 
  Loader2, 
  UtensilsCrossed,
  Edit,
  Trash2,
  Leaf,
  Wheat,
  DollarSign,
  Clock,
  Star
} from 'lucide-react';

interface Category {
  id: string;
  name: string;
  description?: string;
  sortOrder: number;
}

interface MenuItem {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  price: number;
  currency: string;
  isVegetarian: boolean;
  isVegan: boolean;
  isGlutenFree: boolean;
  isAvailable: boolean;
  preparationTime?: number;
  kitchenStation?: string;
  sortOrder: number;
  status: string;
  category?: Category;
  createdAt: string;
}

interface MenuStats {
  totalItems: number;
  availableItems: number;
  avgPrice: number;
  categoryCounts: Record<string, number>;
}

export default function MenuManagement() {
  const { propertyId } = usePropertyId();
  const { formatCurrency } = useCurrency();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [stats, setStats] = useState<MenuStats>({
    totalItems: 0,
    availableItems: 0,
    avgPrice: 0,
    categoryCounts: {},
  });

  // Dialog states
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [editItem, setEditItem] = useState<MenuItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    categoryId: '',
    isVegetarian: false,
    isVegan: false,
    isGlutenFree: false,
    isAvailable: true,
    preparationTime: '',
    kitchenStation: '',
    status: 'active',
  });

  const fetchMenuItems = useCallback(async () => {
    if (!propertyId) return;
    try {
      const params = new URLSearchParams();
      params.append('propertyId', propertyId);
      if (categoryFilter !== 'all') params.append('categoryId', categoryFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (search) params.append('search', search);

      const [itemsRes, statsRes] = await Promise.all([
        fetch(`/api/menu-items?${params.toString()}`),
        fetch(`/api/menu-items?stats=true&propertyId=${propertyId}`),
      ]);

      const itemsData = await itemsRes.json();
      const statsData = await statsRes.json();

      if (itemsData.success) {
        setMenuItems(itemsData.data);
      }

      if (statsData.success) {
        setStats(statsData.data);
      }
    } catch (error) {
      console.error('Error fetching menu items:', error);
      toast.error('Failed to fetch menu items');
    } finally {
      setLoading(false);
    }
  }, [propertyId, categoryFilter, statusFilter, search]);

  // Fetch categories from API
  const fetchCategories = async () => {
    if (!propertyId) return;
    try {
      const res = await fetch(`/api/menu-categories?propertyId=${propertyId}`);
      const data = await res.json();
      if (data.success) {
        setCategories(data.data);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
      toast.error('Failed to fetch categories');
    }
  };

  useEffect(() => {
    if (propertyId) {
      fetchCategories();
    }
  }, [propertyId]);

  useEffect(() => {
    if (propertyId) {
      fetchMenuItems();
    }
  }, [fetchMenuItems, propertyId]);

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      price: '',
      categoryId: '',
      isVegetarian: false,
      isVegan: false,
      isGlutenFree: false,
      isAvailable: true,
      preparationTime: '',
      kitchenStation: '',
      status: 'active',
    });
  };

  const handleAddItem = async () => {
    if (!formData.name.trim() || !formData.price || !formData.categoryId) {
      toast.error('Name, price, and category are required');
      return;
    }

    if (!propertyId) {
      toast.error('No property selected');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/menu-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          name: formData.name,
          description: formData.description || undefined,
          price: parseFloat(formData.price),
          categoryId: formData.categoryId,
          isVegetarian: formData.isVegetarian,
          isVegan: formData.isVegan,
          isGlutenFree: formData.isGlutenFree,
          isAvailable: formData.isAvailable,
          preparationTime: formData.preparationTime ? parseInt(formData.preparationTime, 10) : undefined,
          kitchenStation: formData.kitchenStation || undefined,
          status: formData.status,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Menu item created successfully');
        setAddItemOpen(false);
        resetForm();
        fetchMenuItems();
      } else {
        toast.error(data.error?.message || 'Failed to create menu item');
      }
    } catch (error) {
      console.error('Error creating menu item:', error);
      toast.error('Failed to create menu item');
    } finally {
      setSaving(false);
    }
  };

  const handleEditItem = async () => {
    if (!editItem || !formData.name.trim() || !formData.price || !formData.categoryId) {
      toast.error('Name, price, and category are required');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/menu-items', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editItem.id,
          name: formData.name,
          description: formData.description || undefined,
          price: parseFloat(formData.price),
          categoryId: formData.categoryId,
          isVegetarian: formData.isVegetarian,
          isVegan: formData.isVegan,
          isGlutenFree: formData.isGlutenFree,
          isAvailable: formData.isAvailable,
          preparationTime: formData.preparationTime ? parseInt(formData.preparationTime, 10) : undefined,
          kitchenStation: formData.kitchenStation || undefined,
          status: formData.status,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Menu item updated successfully');
        setEditItem(null);
        resetForm();
        fetchMenuItems();
      } else {
        toast.error(data.error?.message || 'Failed to update menu item');
      }
    } catch (error) {
      console.error('Error updating menu item:', error);
      toast.error('Failed to update menu item');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = (itemId: string) => {
    setDeleteItemId(itemId);
  };

  const confirmDeleteItem = async () => {
    if (!deleteItemId) return;

    try {
      const res = await fetch(`/api/menu-items?id=${deleteItemId}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Menu item deleted successfully');
        fetchMenuItems();
      } else {
        toast.error(data.error?.message || 'Failed to delete menu item');
      }
    } catch (error) {
      console.error('Error deleting menu item:', error);
      toast.error('Failed to delete menu item');
    } finally {
      setDeleteItemId(null);
    }
  };

  const toggleAvailability = async (item: MenuItem) => {
    try {
      const res = await fetch('/api/menu-items', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          isAvailable: !item.isAvailable,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(`Item ${!item.isAvailable ? 'enabled' : 'disabled'}`);
        fetchMenuItems();
      }
    } catch (error) {
      console.error('Error updating item:', error);
      toast.error('Failed to update item');
    }
  };

  const openEditDialog = (item: MenuItem) => {
    setEditItem(item);
    setFormData({
      name: item.name,
      description: item.description || '',
      price: item.price.toString(),
      categoryId: item.category?.id || '',
      isVegetarian: item.isVegetarian,
      isVegan: item.isVegan,
      isGlutenFree: item.isGlutenFree,
      isAvailable: item.isAvailable,
      preparationTime: item.preparationTime?.toString() || '',
      kitchenStation: item.kitchenStation || '',
      status: item.status,
    });
  };

  if (!propertyId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <UtensilsCrossed className="h-12 w-12 mb-4" />
        <p className="text-lg font-medium">No Property Selected</p>
        <p className="text-sm">Please select a property to manage menu items</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Menu Management</h1>
        <p className="text-muted-foreground">
          Manage restaurant menu items and categories
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Items</CardTitle>
            <UtensilsCrossed className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalItems}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available</CardTitle>
            <Star className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{stats.availableItems}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Price</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.avgPrice)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categories</CardTitle>
            <UtensilsCrossed className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Object.keys(stats.categoryCounts).length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search menu items..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Dialog open={addItemOpen} onOpenChange={setAddItemOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700" onClick={resetForm}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Add Menu Item</DialogTitle>
                  <DialogDescription>
                    Add a new item to the menu
                  </DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh]">
                  <div className="grid gap-4 py-4 pr-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Name *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Item name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Item description"
                        rows={2}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="price">Price *</Label>
                        <Input
                          id="price"
                          type="number"
                          step="0.01"
                          value={formData.price}
                          onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                          placeholder="0.00"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="category">Category *</Label>
                        <Select
                          value={formData.categoryId}
                          onValueChange={(v) => setFormData({ ...formData, categoryId: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map(cat => (
                              <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="prepTime">Prep Time (min)</Label>
                        <Input
                          id="prepTime"
                          type="number"
                          value={formData.preparationTime}
                          onChange={(e) => setFormData({ ...formData, preparationTime: e.target.value })}
                          placeholder="15"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="station">Kitchen Station</Label>
                        <Select
                          value={formData.kitchenStation}
                          onValueChange={(v) => setFormData({ ...formData, kitchenStation: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select station" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="grill">Grill</SelectItem>
                            <SelectItem value="sauté">Sauté</SelectItem>
                            <SelectItem value="fryer">Fryer</SelectItem>
                            <SelectItem value="salad">Salad Bar</SelectItem>
                            <SelectItem value="dessert">Dessert</SelectItem>
                            <SelectItem value="bar">Bar</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Separator />
                    <div className="space-y-3">
                      <Label>Dietary Options</Label>
                      <div className="flex flex-wrap gap-4">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={formData.isVegetarian}
                            onCheckedChange={(v) => setFormData({ ...formData, isVegetarian: v })}
                          />
                          <Label className="flex items-center gap-1">
                            <Leaf className="h-4 w-4 text-green-500" />
                            Vegetarian
                          </Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={formData.isVegan}
                            onCheckedChange={(v) => setFormData({ ...formData, isVegan: v })}
                          />
                          <Label className="flex items-center gap-1">
                            <Leaf className="h-4 w-4 text-green-600" />
                            Vegan
                          </Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={formData.isGlutenFree}
                            onCheckedChange={(v) => setFormData({ ...formData, isGlutenFree: v })}
                          />
                          <Label className="flex items-center gap-1">
                            <Wheat className="h-4 w-4 text-amber-500" />
                            Gluten Free
                          </Label>
                        </div>
                      </div>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={formData.isAvailable}
                          onCheckedChange={(v) => setFormData({ ...formData, isAvailable: v })}
                        />
                        <Label>Available for ordering</Label>
                      </div>
                      <Select
                        value={formData.status}
                        onValueChange={(v) => setFormData({ ...formData, status: v })}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </ScrollArea>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddItemOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAddItem}
                    disabled={saving}
                    className="bg-gradient-to-r from-emerald-500 to-teal-600"
                  >
                    {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Add Item
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Menu Items List */}
      <div className="grid gap-4">
        {menuItems.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <UtensilsCrossed className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Menu Items Found</h3>
              <p className="text-muted-foreground text-center">
                {search || categoryFilter !== 'all' || statusFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Add your first menu item to get started'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {menuItems.map((item) => (
              <Card key={item.id} className={`overflow-hidden ${!item.isAvailable ? 'opacity-60' : ''}`}>
                <div className="flex">
                  <div className="flex-1 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold">{item.name}</h3>
                        <p className="text-lg font-bold text-emerald-600">
                          {formatCurrency(item.price)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Switch
                          checked={item.isAvailable}
                          onCheckedChange={() => toggleAvailability(item)}
                          className="data-[state=checked]:bg-emerald-500"
                        />
                      </div>
                    </div>
                    
                    {item.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {item.description}
                      </p>
                    )}

                    <div className="flex items-center gap-2 mt-2">
                      {item.category && (
                        <Badge variant="outline" className="text-xs">
                          {item.category.name}
                        </Badge>
                      )}
                      {item.isVegetarian && (
                        <Badge className="bg-green-100 text-green-700 text-xs">
                          <Leaf className="h-3 w-3 mr-1" />
                          V
                        </Badge>
                      )}
                      {item.isVegan && (
                        <Badge className="bg-green-100 text-green-700 text-xs">
                          VG
                        </Badge>
                      )}
                      {item.isGlutenFree && (
                        <Badge className="bg-amber-100 text-amber-700 text-xs">
                          GF
                        </Badge>
                      )}
                    </div>

                    {item.preparationTime && (
                      <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {item.preparationTime} min
                        {item.kitchenStation && ` • ${item.kitchenStation}`}
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-4 pt-2 border-t">
                      <Badge className={item.isAvailable ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}>
                        {item.isAvailable ? 'Available' : 'Unavailable'}
                      </Badge>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditDialog(item)}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => handleDeleteItem(item.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteItemId} onOpenChange={(open) => !open && setDeleteItemId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Menu Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this menu item? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteItem} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Dialog */}
      <Dialog open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Menu Item</DialogTitle>
            <DialogDescription>
              Update menu item details
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="grid gap-4 py-4 pr-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name *</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-price">Price *</Label>
                  <Input
                    id="edit-price"
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-category">Category *</Label>
                  <Select
                    value={formData.categoryId}
                    onValueChange={(v) => setFormData({ ...formData, categoryId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-prepTime">Prep Time (min)</Label>
                  <Input
                    id="edit-prepTime"
                    type="number"
                    value={formData.preparationTime}
                    onChange={(e) => setFormData({ ...formData, preparationTime: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-station">Kitchen Station</Label>
                  <Select
                    value={formData.kitchenStation}
                    onValueChange={(v) => setFormData({ ...formData, kitchenStation: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select station" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="grill">Grill</SelectItem>
                      <SelectItem value="sauté">Sauté</SelectItem>
                      <SelectItem value="fryer">Fryer</SelectItem>
                      <SelectItem value="salad">Salad Bar</SelectItem>
                      <SelectItem value="dessert">Dessert</SelectItem>
                      <SelectItem value="bar">Bar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Separator />
              <div className="space-y-3">
                <Label>Dietary Options</Label>
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.isVegetarian}
                      onCheckedChange={(v) => setFormData({ ...formData, isVegetarian: v })}
                    />
                    <Label>Vegetarian</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.isVegan}
                      onCheckedChange={(v) => setFormData({ ...formData, isVegan: v })}
                    />
                    <Label>Vegan</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.isGlutenFree}
                      onCheckedChange={(v) => setFormData({ ...formData, isGlutenFree: v })}
                    />
                    <Label>Gluten Free</Label>
                  </div>
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.isAvailable}
                    onCheckedChange={(v) => setFormData({ ...formData, isAvailable: v })}
                  />
                  <Label>Available</Label>
                </div>
                <Select
                  value={formData.status}
                  onValueChange={(v) => setFormData({ ...formData, status: v })}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleEditItem}
              disabled={saving}
              className="bg-gradient-to-r from-emerald-500 to-teal-600"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
