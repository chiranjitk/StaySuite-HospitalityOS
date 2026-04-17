'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  AlertTriangle, 
  Package, 
  Loader2,
  AlertCircle,
  ShoppingBag,
  RefreshCw,
  TrendingDown
} from 'lucide-react';
import { toast } from 'sonner';
import { useCurrency } from '@/contexts/CurrencyContext';

interface StockItem {
  id: string;
  name: string;
  sku?: string;
  category?: string;
  unit: string;
  quantity: number;
  minQuantity: number;
  maxQuantity?: number;
  reorderPoint?: number;
  unitCost: number;
  location?: string;
  isLowStock: boolean;
}

interface Vendor {
  id: string;
  name: string;
  type: string;
}

export default function LowStockAlerts() {
  const { formatCurrency } = useCurrency();
  const [lowStockItems, setLowStockItems] = useState<StockItem[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null);
  const [saving, setSaving] = useState(false);

  const [orderFormData, setOrderFormData] = useState({
    vendorId: '',
    quantity: 0,
    notes: '',
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch low stock items
      const response = await fetch('/api/inventory/stock?lowStock=true');
      const data = await response.json();

      if (data.success) {
        setLowStockItems(data.data);
      }

      // Fetch vendors for PO creation
      const vendorsResponse = await fetch('/api/inventory/vendors?type=supplier');
      const vendorsData = await vendorsResponse.json();

      if (vendorsData.success) {
        setVendors(vendorsData.data);
      }
    } catch (error) {
      console.error('Error fetching low stock items:', error);
      toast.error('Failed to fetch low stock items');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenDialog = (item: StockItem) => {
    setSelectedItem(item);
    setOrderFormData({
      vendorId: '',
      quantity: Math.ceil((item.minQuantity - item.quantity) * 1.5), // Suggest reorder amount
      notes: `Reorder for ${item.name}`,
    });
    setDialogOpen(true);
  };

  const handleCreatePurchaseOrder = async () => {
    if (!selectedItem) return;
    
    if (!orderFormData.vendorId) {
      toast.error('Please select a vendor');
      return;
    }

    if (orderFormData.quantity <= 0) {
      toast.error('Quantity must be greater than 0');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/inventory/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorId: orderFormData.vendorId,
          items: [{
            stockItemId: selectedItem.id,
            quantity: orderFormData.quantity,
            unitPrice: selectedItem.unitCost,
          }],
          notes: orderFormData.notes,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Purchase order created');
        setDialogOpen(false);
        fetchData();
      } else {
        toast.error(data.error?.message || 'Failed to create purchase order');
      }
    } catch (error) {
      console.error('Error creating purchase order:', error);
      toast.error('Failed to create purchase order');
    } finally {
      setSaving(false);
    }
  };

  const getStockLevelPercent = (item: StockItem) => {
    const max = item.maxQuantity || item.minQuantity * 5;
    return Math.min((item.quantity / max) * 100, 100);
  };

  const getSeverityLevel = (item: StockItem) => {
    const ratio = item.quantity / item.minQuantity;
    if (ratio <= 0.25) return 'critical';
    if (ratio <= 0.5) return 'warning';
    return 'low';
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500';
      case 'warning': return 'bg-amber-500';
      default: return 'bg-orange-500';
    }
  };

  const getSeverityBg = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800';
      case 'warning': return 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800';
      default: return 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800';
    }
  };

  const getSeverityTextColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-700 dark:text-red-400';
      case 'warning': return 'text-amber-700 dark:text-amber-400';
      default: return 'text-orange-700 dark:text-orange-400';
    }
  };

  // Group items by severity
  const criticalItems = lowStockItems.filter(i => getSeverityLevel(i) === 'critical');
  const warningItems = lowStockItems.filter(i => getSeverityLevel(i) === 'warning');
  const lowItems = lowStockItems.filter(i => getSeverityLevel(i) === 'low');

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        <Card className="bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/20 dark:to-rose-950/20 border-red-200 dark:border-red-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-red-700 dark:text-red-400">Critical</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700">{criticalItems.length}</div>
            <p className="text-xs text-red-600 mt-1">Below 25% of minimum</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/20 dark:to-yellow-950/20 border-amber-200 dark:border-amber-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-amber-700 dark:text-amber-400">Warning</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-700">{warningItems.length}</div>
            <p className="text-xs text-amber-600 mt-1">25-50% of minimum</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 border-orange-200 dark:border-orange-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-400">Low Stock</CardTitle>
            <TrendingDown className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-700">{lowItems.length}</div>
            <p className="text-xs text-orange-600 mt-1">50-100% of minimum</p>
          </CardContent>
        </Card>
      </div>

      {/* Low Stock Items List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Low Stock Alerts ({lowStockItems.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
            </div>
          ) : lowStockItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 text-emerald-500" />
              <p className="font-medium">All stock levels are healthy</p>
              <p className="text-sm">No items below minimum quantity</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[500px]">
              <div className="space-y-3">
                {lowStockItems.map((item) => {
                  const severity = getSeverityLevel(item);
                  return (
                    <div 
                      key={item.id} 
                      className={`p-4 rounded-lg border ${getSeverityBg(severity)}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className={`${getSeverityColor(severity)} text-white`}>
                              {severity.toUpperCase()}
                            </Badge>
                            <span className="font-medium">{item.name}</span>
                            {item.sku && (
                              <code className="text-xs bg-muted px-2 py-0.5 rounded">
                                {item.sku}
                              </code>
                            )}
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Current:</span>
                              <span className={`ml-1 font-medium ${getSeverityTextColor(severity)}`}>
                                {item.quantity} {item.unit}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Minimum:</span>
                              <span className="ml-1 font-medium">{item.minQuantity} {item.unit}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Deficit:</span>
                              <span className="ml-1 font-medium text-red-600">
                                {item.minQuantity - item.quantity} {item.unit}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Location:</span>
                              <span className="ml-1">{item.location || '-'}</span>
                            </div>
                          </div>
                          <div className="mt-3">
                            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                              <span>Stock Level</span>
                              <span>{Math.round(getStockLevelPercent(item))}%</span>
                            </div>
                            <Progress 
                              value={getStockLevelPercent(item)} 
                              className="h-2"
                            />
                          </div>
                        </div>
                        <Button 
                          size="sm" 
                          onClick={() => handleOpenDialog(item)}
                          className="bg-emerald-500 hover:bg-emerald-600 ml-4"
                        >
                          <ShoppingBag className="h-4 w-4 mr-1" />
                          Reorder
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Quick Reorder Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5" />
              Quick Reorder
            </DialogTitle>
            <DialogDescription>
              Create a purchase order for {selectedItem?.name}
            </DialogDescription>
          </DialogHeader>
          {selectedItem && (
            <div className="grid gap-4 py-4">
              <div className="bg-muted p-3 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Current Stock:</span>
                  <span className="font-medium text-red-600">
                    {selectedItem.quantity} {selectedItem.unit}
                  </span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-muted-foreground">Minimum Level:</span>
                  <span className="font-medium">{selectedItem.minQuantity} {selectedItem.unit}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-muted-foreground">Unit Cost:</span>
                  <span className="font-medium">{formatCurrency(selectedItem.unitCost)}</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Vendor *</Label>
                <Select
                  value={orderFormData.vendorId}
                  onValueChange={(v) => setOrderFormData({ ...orderFormData, vendorId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map((vendor) => (
                      <SelectItem key={vendor.id} value={vendor.id}>
                        {vendor.name} ({vendor.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Order Quantity *</Label>
                <Input
                  type="number"
                  value={orderFormData.quantity}
                  onChange={(e) => setOrderFormData({ ...orderFormData, quantity: parseFloat(e.target.value) || 0 })}
                />
                <p className="text-xs text-muted-foreground">
                  Suggested: {Math.ceil((selectedItem.minQuantity - selectedItem.quantity) * 1.5)} {selectedItem.unit}
                </p>
              </div>
              <div className="bg-muted p-3 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Estimated Cost:</span>
                  <span className="font-medium">
                    {formatCurrency(orderFormData.quantity * selectedItem.unitCost)}
                  </span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreatePurchaseOrder} disabled={saving} className="bg-emerald-500 hover:bg-emerald-600">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Purchase Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
