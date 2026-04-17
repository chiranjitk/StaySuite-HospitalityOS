'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter,
  DialogDescription
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  FileText,
  Plus,
  Search,
  Eye,
  Loader2,
  Filter,
  Calendar,
  Package,
  CheckCircle2,
  Clock,
  XCircle,
  Send,
  Truck,
  X,
  MinusCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useCurrency } from '@/contexts/CurrencyContext';
import { format } from 'date-fns';

interface PurchaseOrderItem {
  id: string;
  stockItemId: string;
  stockItem: {
    id: string;
    name: string;
    sku?: string;
    unit: string;
    unitCost: number;
  };
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  receivedQuantity?: number;
}

interface PurchaseOrder {
  id: string;
  tenantId: string;
  vendorId: string;
  vendor: {
    id: string;
    name: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
    type: string;
  };
  orderNumber: string;
  orderDate: string;
  expectedDate?: string;
  receivedDate?: string;
  subtotal: number;
  taxes: number;
  totalAmount: number;
  status: string;
  approvedBy?: string;
  approvedAt?: string;
  notes?: string;
  items: PurchaseOrderItem[];
  itemCount: number;
  totalQuantity: number;
  receivedQuantity: number;
  createdAt: string;
}

interface Vendor {
  id: string;
  name: string;
  type: string;
}

interface StockItem {
  id: string;
  name: string;
  sku?: string;
  unit: string;
  unitCost: number;
}

interface POStats {
  totalOrders: number;
  statusDistribution: Array<{
    status: string;
    count: number;
    totalAmount: number;
  }>;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof FileText }> = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300', icon: FileText },
  submitted: { label: 'Submitted', color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400', icon: Send },
  approved: { label: 'Approved', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: CheckCircle2 },
  received: { label: 'Received', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: Truck },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: XCircle },
};

export default function PurchaseOrders() {
  const { formatCurrency } = useCurrency();
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [stats, setStats] = useState<POStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [vendorFilter, setVendorFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    vendorId: '',
    expectedDate: '',
    notes: '',
    items: [{ stockItemId: '', quantity: 1, unitPrice: 0 }],
  });

  const [receiveData, setReceiveData] = useState<{ [key: string]: number }>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (vendorFilter !== 'all') params.append('vendorId', vendorFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);

      const response = await fetch(`/api/inventory/purchase-orders?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setPurchaseOrders(data.data);
        setStats(data.stats);
      }

      // Fetch vendors
      const vendorsResponse = await fetch('/api/inventory/vendors');
      const vendorsData = await vendorsResponse.json();
      if (vendorsData.success) {
        setVendors(vendorsData.data);
      }

      // Fetch stock items
      const stockResponse = await fetch('/api/inventory/stock?limit=100');
      const stockData = await stockResponse.json();
      if (stockData.success) {
        setStockItems(stockData.data);
      }
    } catch (error) {
      console.error('Error fetching purchase orders:', error);
      toast.error('Failed to fetch purchase orders');
    } finally {
      setLoading(false);
    }
  }, [search, vendorFilter, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenCreateDialog = () => {
    setFormData({
      vendorId: '',
      expectedDate: '',
      notes: '',
      items: [{ stockItemId: '', quantity: 1, unitPrice: 0 }],
    });
    setCreateDialogOpen(true);
  };

  const handleAddItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { stockItemId: '', quantity: 1, unitPrice: 0 }],
    });
  };

  const handleRemoveItem = (index: number) => {
    if (formData.items.length > 1) {
      const newItems = formData.items.filter((_, i) => i !== index);
      setFormData({ ...formData, items: newItems });
    }
  };

  const handleItemChange = (index: number, field: string, value: string | number) => {
    const newItems = [...formData.items];
    if (field === 'stockItemId') {
      const item = stockItems.find(i => i.id === value);
      newItems[index] = {
        ...newItems[index],
        stockItemId: value as string,
        unitPrice: item?.unitCost || 0,
      };
    } else {
      (newItems[index] as Record<string, unknown>)[field] = value;
    }
    setFormData({ ...formData, items: newItems });
  };

  const handleCreateOrder = async () => {
    if (!formData.vendorId) {
      toast.error('Please select a vendor');
      return;
    }

    const validItems = formData.items.filter(i => i.stockItemId && i.quantity > 0);
    if (validItems.length === 0) {
      toast.error('Please add at least one item');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/inventory/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorId: formData.vendorId,
          expectedDate: formData.expectedDate || null,
          notes: formData.notes || null,
          items: validItems.map(i => ({
            stockItemId: i.stockItemId,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
          })),
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Purchase order created');
        setCreateDialogOpen(false);
        fetchData();
      } else {
        toast.error(data.error?.message || 'Failed to create order');
      }
    } catch (error) {
      console.error('Error creating purchase order:', error);
      toast.error('Failed to create purchase order');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    setSaving(true);
    try {
      const response = await fetch('/api/inventory/purchase-orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: orderId, status: newStatus }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(`Order ${newStatus}`);
        fetchData();
      } else {
        toast.error(data.error?.message || `Failed to ${newStatus} order`);
      }
    } catch (error) {
      console.error('Error updating order:', error);
      toast.error('Failed to update order');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenReceiveDialog = (order: PurchaseOrder) => {
    setSelectedOrder(order);
    const initialReceiveData: Record<string, number> = {};
    order.items.forEach(item => {
      initialReceiveData[item.id] = item.quantity;
    });
    setReceiveData(initialReceiveData);
    setReceiveDialogOpen(true);
  };

  const handleReceiveOrder = async () => {
    if (!selectedOrder) return;

    setSaving(true);
    try {
      const items = selectedOrder.items.map(item => ({
        stockItemId: item.stockItemId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        receivedQuantity: receiveData[item.id] || item.quantity,
      }));

      const response = await fetch('/api/inventory/purchase-orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedOrder.id,
          status: 'received',
          receivedDate: new Date().toISOString(),
          items,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Order received and stock updated');
        setReceiveDialogOpen(false);
        fetchData();
      } else {
        toast.error(data.error?.message || 'Failed to receive order');
      }
    } catch (error) {
      console.error('Error receiving order:', error);
      toast.error('Failed to receive order');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!selectedOrder) return;
    await handleUpdateStatus(selectedOrder.id, 'cancelled');
    setCancelDialogOpen(false);
    setSelectedOrder(null);
  };

  const calculateSubtotal = () => {
    return formData.items.reduce((sum, item) => {
      if (item.stockItemId && item.quantity > 0) {
        return sum + item.quantity * item.unitPrice;
      }
      return sum;
    }, 0);
  };

  const calculateTax = () => calculateSubtotal() * 0.1;
  const calculateTotal = () => calculateSubtotal() + calculateTax();

  const getAvailableActions = (order: PurchaseOrder) => {
    const actions: { label: string; action: () => void; variant: string; icon: typeof FileText }[] = [];

    switch (order.status) {
      case 'draft':
        actions.push({
          label: 'Submit',
          action: () => handleUpdateStatus(order.id, 'submitted'),
          variant: 'default',
          icon: Send,
        });
        actions.push({
          label: 'Cancel',
          action: () => { setSelectedOrder(order); setCancelDialogOpen(true); },
          variant: 'destructive',
          icon: X,
        });
        break;
      case 'submitted':
        actions.push({
          label: 'Approve',
          action: () => handleUpdateStatus(order.id, 'approved'),
          variant: 'default',
          icon: CheckCircle2,
        });
        actions.push({
          label: 'Cancel',
          action: () => { setSelectedOrder(order); setCancelDialogOpen(true); },
          variant: 'destructive',
          icon: X,
        });
        break;
      case 'approved':
        actions.push({
          label: 'Receive',
          action: () => handleOpenReceiveDialog(order),
          variant: 'default',
          icon: Truck,
        });
        actions.push({
          label: 'Cancel',
          action: () => { setSelectedOrder(order); setCancelDialogOpen(true); },
          variant: 'destructive',
          icon: X,
        });
        break;
    }

    return actions;
  };

  const getStatusIcon = (status: string) => {
    const config = STATUS_CONFIG[status];
    if (!config) return <FileText className="h-4 w-4" />;
    const Icon = config.icon;
    return <Icon className="h-4 w-4" />;
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-4">
        <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border-emerald-200 dark:border-emerald-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Total Orders</CardTitle>
            <FileText className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-700">{stats?.totalOrders || 0}</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-cyan-50 to-sky-50 dark:from-cyan-950/20 dark:to-sky-950/20 border-cyan-200 dark:border-cyan-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-cyan-700 dark:text-cyan-400">Pending</CardTitle>
            <Clock className="h-4 w-4 text-cyan-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-cyan-700">
              {stats?.statusDistribution.filter(s => ['draft', 'submitted', 'approved'].includes(s.status)).reduce((sum, s) => sum + s.count, 0) || 0}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-teal-50 to-emerald-50 dark:from-teal-950/20 dark:to-emerald-950/20 border-teal-200 dark:border-teal-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-teal-700 dark:text-teal-400">Received</CardTitle>
            <Truck className="h-4 w-4 text-teal-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-teal-700">
              {stats?.statusDistribution.find(s => s.status === 'received')?.count || 0}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border-amber-200 dark:border-amber-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-amber-700 dark:text-amber-400">Total Value</CardTitle>
            <Package className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-700">
              {formatCurrency(stats?.statusDistribution.reduce((sum, s) => sum + s.totalAmount, 0) || 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by order #, vendor, notes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={vendorFilter} onValueChange={setVendorFilter}>
              <SelectTrigger className="w-full md:w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Vendor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Vendors</SelectItem>
                {vendors.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>{config.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleOpenCreateDialog} className="bg-emerald-500 hover:bg-emerald-600">
              <Plus className="h-4 w-4 mr-2" />
              New Order
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Purchase Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Purchase Orders
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
            </div>
          ) : purchaseOrders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No purchase orders found
            </div>
          ) : (
            <ScrollArea className="max-h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Order Date</TableHead>
                    <TableHead>Expected</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchaseOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                          {order.orderNumber}
                        </code>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{order.vendor.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {order.vendor.type}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(order.orderDate), 'MMM dd, yyyy')}
                        </div>
                      </TableCell>
                      <TableCell>
                        {order.expectedDate ? (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(order.expectedDate), 'MMM dd, yyyy')}
                          </div>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">
                          {order.itemCount} items ({order.totalQuantity} units)
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{formatCurrency(order.totalAmount)}</span>
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUS_CONFIG[order.status]?.color || ''}>
                          <span className="flex items-center gap-1">
                            {getStatusIcon(order.status)}
                            {STATUS_CONFIG[order.status]?.label || order.status}
                          </span>
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setSelectedOrder(order); setViewDialogOpen(true); }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {getAvailableActions(order).map((action, i) => (
                            <Button
                              key={i}
                              variant={action.variant === 'destructive' ? 'destructive' : 'outline'}
                              size="sm"
                              onClick={action.action}
                              disabled={saving}
                            >
                              <action.icon className="h-4 w-4" />
                            </Button>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Create Order Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Purchase Order</DialogTitle>
            <DialogDescription>
              Create a new purchase order for stock items.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Vendor *</Label>
                <Select
                  value={formData.vendorId}
                  onValueChange={(v) => setFormData({ ...formData, vendorId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Expected Date</Label>
                <Input
                  type="date"
                  value={formData.expectedDate}
                  onChange={(e) => setFormData({ ...formData, expectedDate: e.target.value })}
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Order Items</Label>
                <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Item
                </Button>
              </div>
              {formData.items.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5">
                    <Select
                      value={item.stockItemId}
                      onValueChange={(v) => handleItemChange(index, 'stockItemId', v)}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Select item" />
                      </SelectTrigger>
                      <SelectContent>
                        {stockItems.map((si) => (
                          <SelectItem key={si.id} value={si.id}>
                            {si.name} {si.sku ? `(${si.sku})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                      className="h-9"
                      min={1}
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      placeholder="Price"
                      value={item.unitPrice}
                      onChange={(e) => handleItemChange(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                      className="h-9"
                      step="0.01"
                    />
                  </div>
                  <div className="col-span-2">
                    <div className="h-9 px-3 py-2 bg-muted rounded text-sm">
                      {formatCurrency(item.quantity * item.unitPrice)}
                    </div>
                  </div>
                  <div className="col-span-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveItem(index)}
                      disabled={formData.items.length === 1}
                    >
                      <MinusCircle className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Order notes..."
                  rows={2}
                />
              </div>
              <div className="space-y-2 bg-muted p-3 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(calculateSubtotal())}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Tax (10%):</span>
                  <span>{formatCurrency(calculateTax())}</span>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between font-medium">
                  <span>Total:</span>
                  <span>{formatCurrency(calculateTotal())}</span>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateOrder} disabled={saving} className="bg-emerald-500 hover:bg-emerald-600">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Order Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Order Details</DialogTitle>
            <DialogDescription>
              {selectedOrder?.orderNumber}
            </DialogDescription>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Vendor</Label>
                  <div className="font-medium">{selectedOrder.vendor.name}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Status</Label>
                  <div>
                    <Badge className={STATUS_CONFIG[selectedOrder.status]?.color || ''}>
                      <span className="flex items-center gap-1">
                        {getStatusIcon(selectedOrder.status)}
                        {STATUS_CONFIG[selectedOrder.status]?.label}
                      </span>
                    </Badge>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Order Date</Label>
                  <div>{format(new Date(selectedOrder.orderDate), 'MMMM dd, yyyy')}</div>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Expected Date</Label>
                  <div>
                    {selectedOrder.expectedDate 
                      ? format(new Date(selectedOrder.expectedDate), 'MMMM dd, yyyy')
                      : 'Not specified'}
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Items</Label>
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Unit Price</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedOrder.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div className="font-medium">{item.stockItem.name}</div>
                            {item.stockItem.sku && (
                              <div className="text-xs text-muted-foreground">{item.stockItem.sku}</div>
                            )}
                          </TableCell>
                          <TableCell>{item.quantity} {item.stockItem.unit}</TableCell>
                          <TableCell>{formatCurrency(item.unitPrice)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.totalAmount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="bg-muted p-3 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(selectedOrder.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Tax:</span>
                  <span>{formatCurrency(selectedOrder.taxes)}</span>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between font-medium">
                  <span>Total:</span>
                  <span>{formatCurrency(selectedOrder.totalAmount)}</span>
                </div>
              </div>

              {selectedOrder.notes && (
                <div className="space-y-1">
                  <Label className="text-muted-foreground">Notes</Label>
                  <div className="text-sm bg-muted p-3 rounded-lg">{selectedOrder.notes}</div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receive Order Dialog */}
      <Dialog open={receiveDialogOpen} onOpenChange={setReceiveDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Receive Order</DialogTitle>
            <DialogDescription>
              Confirm quantities received for {selectedOrder?.orderNumber}
            </DialogDescription>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                {selectedOrder.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-medium">{item.stockItem.name}</div>
                      <div className="text-sm text-muted-foreground">
                        Ordered: {item.quantity} {item.stockItem.unit}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-muted-foreground">Received:</Label>
                      <Input
                        type="number"
                        value={receiveData[item.id] || 0}
                        onChange={(e) => setReceiveData({ 
                          ...receiveData, 
                          [item.id]: parseFloat(e.target.value) || 0 
                        })}
                        className="w-24"
                        max={item.quantity}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-sm text-muted-foreground">
                Receiving these items will update your stock quantities.
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleReceiveOrder} disabled={saving} className="bg-emerald-500 hover:bg-emerald-600">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm Receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel {selectedOrder?.orderNumber}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No, Keep Order</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelOrder}
              className="bg-red-500 hover:bg-red-600"
              disabled={saving}
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Yes, Cancel Order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
