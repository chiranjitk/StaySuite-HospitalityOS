'use client';

import { useState, useEffect, useCallback } from 'react';
import { useCurrency } from '@/contexts/CurrencyContext';
import { usePropertyId } from '@/hooks/use-property';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { 
  Search, 
  Plus, 
  Loader2, 
  UtensilsCrossed, 
  Clock, 
  ChefHat, 
  CheckCircle,
  XCircle,
  Eye,
  DollarSign,
  Users,
  ShoppingBag
} from 'lucide-react';

interface OrderItem {
  id: string;
  menuItemId: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  notes?: string;
  status: string;
  menuItem: {
    id: string;
    name: string;
    price: number;
    imageUrl?: string;
  };
}

interface Order {
  id: string;
  orderNumber: string;
  orderType: string;
  status: string;
  kitchenStatus: string;
  subtotal: number;
  taxes: number;
  totalAmount: number;
  guestName?: string;
  notes?: string;
  createdAt: string;
  table?: {
    id: string;
    number: string;
    name?: string;
    area?: string;
  };
  items: OrderItem[];
  _count?: {
    items: number;
  };
}

interface MenuItem {
  id: string;
  name: string;
  price: number;
  description?: string;
  imageUrl?: string;
  isAvailable: boolean;
  category?: {
    id: string;
    name: string;
  };
}

const statusColors: Record<string, string> = {
  pending: 'bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-800 border border-amber-200',
  confirmed: 'bg-gradient-to-r from-sky-100 to-blue-100 text-sky-800 border border-sky-200',
  preparing: 'bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-800 border border-blue-200',
  ready: 'bg-gradient-to-r from-emerald-100 to-green-100 text-emerald-800 border border-emerald-200',
  served: 'bg-gradient-to-r from-gray-100 to-slate-100 text-gray-700 border border-gray-200',
  cancelled: 'bg-gradient-to-r from-red-100 to-rose-100 text-red-800 border border-red-200',
};

const kitchenStatusColors: Record<string, string> = {
  pending: 'bg-gradient-to-r from-gray-100 to-slate-100 text-gray-800 border border-gray-200',
  cooking: 'bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-800 border border-blue-200',
  ready: 'bg-gradient-to-r from-emerald-100 to-green-100 text-emerald-800 border border-emerald-200',
};

const orderTypeLabels: Record<string, string> = {
  dine_in: 'Dine In',
  takeout: 'Takeout',
  delivery: 'Delivery',
  room_service: 'Room Service',
};

export default function Orders() {
  const { propertyId } = usePropertyId();
  const { formatCurrency } = useCurrency();
  const [orders, setOrders] = useState<Order[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [orderTypeFilter, setOrderTypeFilter] = useState('all');
  const [stats, setStats] = useState({
    statusCounts: {} as Record<string, number>,
    todayOrders: 0,
    totalRevenue: 0,
  });

  // Property tax rate
  const [taxRate, setTaxRate] = useState<number>(0);

  // New order dialog state
  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [selectedItems, setSelectedItems] = useState<{ menuItemId: string; quantity: number }[]>([]);
  const [orderType, setOrderType] = useState('dine_in');
  const [guestName, setGuestName] = useState('');
  const [notes, setNotes] = useState('');
  const [creating, setCreating] = useState(false);

  // Order detail dialog state
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (propertyId) params.append('propertyId', propertyId);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (orderTypeFilter !== 'all') params.append('orderType', orderTypeFilter);
      if (search) params.append('search', search);

      const statsParams = new URLSearchParams();
      statsParams.append('stats', 'true');
      if (propertyId) statsParams.append('propertyId', propertyId);

      const [ordersRes, statsRes] = await Promise.all([
        fetch(`/api/orders?${params.toString()}`),
        fetch(`/api/orders?${statsParams.toString()}`),
      ]);

      const ordersData = await ordersRes.json();
      const statsData = await statsRes.json();

      if (ordersData.success) {
        setOrders(ordersData.data);
      }

      if (statsData.success) {
        setStats({
          statusCounts: statsData.data.statusCounts || {},
          todayOrders: statsData.data.todayOrders || 0,
          totalRevenue: statsData.data.totalRevenue || 0,
        });
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error('Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  }, [propertyId, statusFilter, orderTypeFilter, search]);

  const fetchMenuItems = async () => {
    if (!propertyId) return;
    try {
      const res = await fetch(`/api/menu-items?propertyId=${propertyId}`);
      const data = await res.json();
      if (data.success) {
        setMenuItems(data.data);
      }
    } catch (error) {
      console.error('Error fetching menu items:', error);
    }
  };

  // Fetch property tax rate
  const fetchPropertyTaxRate = async () => {
    if (!propertyId) return;
    try {
      const res = await fetch(`/api/properties/${propertyId}`);
      const data = await res.json();
      if (data.success && data.data?.defaultTaxRate !== undefined) {
        setTaxRate(data.data.defaultTaxRate);
      } else {
        setTaxRate(0); // No tax by default
      }
    } catch {
      setTaxRate(0); // Fallback: no tax
    }
  };

  useEffect(() => {
    if (propertyId) {
      fetchOrders();
      fetchMenuItems();
      fetchPropertyTaxRate();
    }
  }, [fetchOrders, propertyId]);

  const updateOrderStatus = async (orderId: string, status: string, kitchenStatus?: string) => {
    try {
      const res = await fetch('/api/orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: orderId, status, kitchenStatus }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Order status updated');
        fetchOrders();
        if (detailOrder?.id === orderId) {
          setDetailOrder(data.data);
        }
      } else {
        toast.error(data.error?.message || 'Failed to update order');
      }
    } catch (error) {
      console.error('Error updating order:', error);
      toast.error('Failed to update order');
    }
  };

  const createOrder = async () => {
    if (selectedItems.length === 0) {
      toast.error('Please select at least one item');
      return;
    }

    if (!propertyId) {
      toast.error('No property selected');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          orderType,
          guestName: guestName || undefined,
          notes: notes || undefined,
          items: selectedItems,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Order created successfully');
        setNewOrderOpen(false);
        setSelectedItems([]);
        setGuestName('');
        setNotes('');
        fetchOrders();
      } else {
        toast.error(data.error?.message || 'Failed to create order');
      }
    } catch (error) {
      console.error('Error creating order:', error);
      toast.error('Failed to create order');
    } finally {
      setCreating(false);
    }
  };

  const toggleItemSelection = (menuItemId: string) => {
    setSelectedItems(prev => {
      const existing = prev.find(item => item.menuItemId === menuItemId);
      if (existing) {
        if (existing.quantity > 1) {
          return prev.map(item =>
            item.menuItemId === menuItemId ? { ...item, quantity: item.quantity - 1 } : item
          );
        } else {
          return prev.filter(item => item.menuItemId !== menuItemId);
        }
      } else {
        return [...prev, { menuItemId, quantity: 1 }];
      }
    });
  };

  const increaseItem = (menuItemId: string) => {
    setSelectedItems(prev =>
      prev.map(item =>
        item.menuItemId === menuItemId ? { ...item, quantity: item.quantity + 1 } : item
      )
    );
  };

  const calculateTotal = () => {
    const subtotal = selectedItems.reduce((sum, item) => {
      const menuItem = menuItems.find(m => m.id === item.menuItemId);
      return sum + (menuItem?.price || 0) * item.quantity;
    }, 0);
    const taxes = subtotal * (taxRate / 100);
    return { subtotal, taxes, total: subtotal + taxes };
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-3 w-3" />;
      case 'preparing':
        return <ChefHat className="h-3 w-3" />;
      case 'ready':
        return <CheckCircle className="h-3 w-3" />;
      case 'served':
        return <UtensilsCrossed className="h-3 w-3" />;
      case 'cancelled':
        return <XCircle className="h-3 w-3" />;
      default:
        return <Clock className="h-3 w-3" />;
    }
  };

  if (!propertyId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <UtensilsCrossed className="h-12 w-12 mb-4" />
        <p className="text-lg font-medium">No Property Selected</p>
        <p className="text-sm">Please select a property to manage orders</p>
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

  const { subtotal, taxes, total } = calculateTotal();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
        <p className="text-muted-foreground">
          Manage restaurant orders and track their status
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today&apos;s Orders</CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.todayOrders}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.statusCounts.pending || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Kitchen</CardTitle>
            <ChefHat className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.statusCounts.preparing || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</div>
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
                placeholder="Search orders..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="preparing">Preparing</SelectItem>
                <SelectItem value="ready">Ready</SelectItem>
                <SelectItem value="served">Served</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={orderTypeFilter} onValueChange={setOrderTypeFilter}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="dine_in">Dine In</SelectItem>
                <SelectItem value="takeout">Takeout</SelectItem>
                <SelectItem value="delivery">Delivery</SelectItem>
                <SelectItem value="room_service">Room Service</SelectItem>
              </SelectContent>
            </Select>
            <Dialog open={newOrderOpen} onOpenChange={setNewOrderOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700">
                  <Plus className="h-4 w-4 mr-2" />
                  New Order
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[95vw] sm:max-w-4xl max-h-[90vh]">
                <DialogHeader>
                  <DialogTitle>Create New Order</DialogTitle>
                  <DialogDescription>
                    Select items from the menu to create a new order
                  </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Menu Items */}
                  <div className="space-y-4">
                    <h4 className="font-semibold">Menu Items</h4>
                    <ScrollArea className="h-[400px] pr-4">
                      <div className="grid grid-cols-1 gap-2">
                        {menuItems.filter(m => m.isAvailable).map((item) => {
                          const selected = selectedItems.find(s => s.menuItemId === item.id);
                          return (
                            <div
                              key={item.id}
                              className={`p-3 rounded-lg border cursor-pointer transition-all ${
                                selected
                                  ? 'border-emerald-500 bg-emerald-50'
                                  : 'hover:border-muted-foreground/50'
                              }`}
                              onClick={() => toggleItemSelection(item.id)}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium">{item.name}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {formatCurrency(item.price)}
                                  </p>
                                </div>
                                {selected && (
                                  <div className="flex items-center gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-6 w-6 p-0"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleItemSelection(item.id);
                                      }}
                                    >
                                      -
                                    </Button>
                                    <span className="w-6 text-center">{selected.quantity}</span>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-6 w-6 p-0"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        increaseItem(item.id);
                                      }}
                                    >
                                      +
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </div>

                  {/* Order Summary */}
                  <div className="space-y-4">
                    <h4 className="font-semibold">Order Details</h4>
                    <Select value={orderType} onValueChange={setOrderType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dine_in">Dine In</SelectItem>
                        <SelectItem value="takeout">Takeout</SelectItem>
                        <SelectItem value="delivery">Delivery</SelectItem>
                        <SelectItem value="room_service">Room Service</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="Guest Name (optional)"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                    />
                    <Textarea
                      placeholder="Special instructions..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />

                    {/* Selected Items Summary */}
                    {selectedItems.length > 0 && (
                      <div className="space-y-2">
                        <h5 className="font-medium">Selected Items</h5>
                        <ScrollArea className="h-32">
                          {selectedItems.map((item) => {
                            const menuItem = menuItems.find(m => m.id === item.menuItemId);
                            if (!menuItem) return null;
                            return (
                              <div key={item.menuItemId} className="flex justify-between py-1">
                                <span className="text-sm">
                                  {menuItem.name} x{item.quantity}
                                </span>
                                <span className="text-sm font-medium">
                                  {formatCurrency(menuItem.price * item.quantity)}
                                </span>
                              </div>
                            );
                          })}
                        </ScrollArea>
                        <Separator />
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span>Subtotal</span>
                            <span>{formatCurrency(subtotal)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Tax ({taxRate}%)</span>
                            <span>{formatCurrency(taxes)}</span>
                          </div>
                          <div className="flex justify-between font-bold text-base">
                            <span>Total</span>
                            <span>{formatCurrency(total)}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setNewOrderOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={createOrder}
                    disabled={creating || selectedItems.length === 0}
                    className="bg-gradient-to-r from-emerald-500 to-teal-600"
                  >
                    {creating ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Plus className="h-4 w-4 mr-2" />
                    )}
                    Create Order
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Orders List */}
      <div className="grid gap-4">
        {orders.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <UtensilsCrossed className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Orders Found</h3>
              <p className="text-muted-foreground text-center">
                {search || statusFilter !== 'all' || orderTypeFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Create your first order to get started'}
              </p>
            </CardContent>
          </Card>
        ) : (
          orders.map((order) => (
            <Card key={order.id} className="overflow-hidden transition-all duration-200 hover:shadow-lg hover:shadow-muted/50 hover:-translate-y-0.5 cursor-pointer group">
              <div className="flex flex-col md:flex-row">
                {/* Status indicator */}
                <div className={`w-full md:w-2 ${
                  order.status === 'pending' ? 'bg-amber-500' :
                  order.status === 'preparing' ? 'bg-orange-500' :
                  order.status === 'ready' ? 'bg-emerald-500' :
                  order.status === 'served' ? 'bg-teal-500' :
                  order.status === 'cancelled' ? 'bg-red-500' : 'bg-gray-500'
                }`} />

                <div className="flex-1 p-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold">{order.orderNumber}</h3>
                        <Badge className={statusColors[order.status]}>
                          {getStatusIcon(order.status)}
                          <span className="ml-1 capitalize">{order.status}</span>
                        </Badge>
                        <Badge className={kitchenStatusColors[order.kitchenStatus]}>
                          <ChefHat className="h-3 w-3 mr-1" />
                          {order.kitchenStatus}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        <span>{orderTypeLabels[order.orderType]}</span>
                        {order.table && (
                          <span>Table {order.table.number}</span>
                        )}
                        {order.guestName && (
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {order.guestName}
                          </span>
                        )}
                        <span>{new Date(order.createdAt).toLocaleTimeString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className={cn(
                          'text-lg font-bold',
                          (order.status === 'served' || order.status === 'ready') && 'bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent'
                        )}>{formatCurrency(order.totalAmount)}</p>
                        <p className="text-xs text-muted-foreground">{order.items.length} items</p>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Quick actions based on status */}
                        {order.status === 'pending' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateOrderStatus(order.id, 'cancelled')}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              className="bg-orange-500 hover:bg-orange-600"
                              onClick={() => updateOrderStatus(order.id, 'preparing', 'cooking')}
                            >
                              <ChefHat className="h-4 w-4 mr-1" />
                              Start
                            </Button>
                          </>
                        )}
                        {order.status === 'preparing' && (
                          <Button
                            size="sm"
                            className="bg-emerald-500 hover:bg-emerald-600"
                            onClick={() => updateOrderStatus(order.id, 'ready', 'ready')}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Ready
                          </Button>
                        )}
                        {order.status === 'ready' && (
                          <Button
                            size="sm"
                            className="bg-teal-500 hover:bg-teal-600"
                            onClick={() => updateOrderStatus(order.id, 'served')}
                          >
                            <UtensilsCrossed className="h-4 w-4 mr-1" />
                            Served
                          </Button>
                        )}

                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setDetailOrder(order)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Order {order.orderNumber}</DialogTitle>
                              <DialogDescription>
                                Order details and items
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div className="flex items-center gap-2">
                                <Badge className={statusColors[order.status]}>
                                  {order.status}
                                </Badge>
                                <Badge className={kitchenStatusColors[order.kitchenStatus]}>
                                  Kitchen: {order.kitchenStatus}
                                </Badge>
                              </div>

                              <div className="text-sm space-y-1">
                                <p><strong>Type:</strong> {orderTypeLabels[order.orderType]}</p>
                                {order.table && (
                                  <p><strong>Table:</strong> {order.table.number} ({order.table.area})</p>
                                )}
                                {order.guestName && (
                                  <p><strong>Guest:</strong> {order.guestName}</p>
                                )}
                                <p><strong>Created:</strong> {new Date(order.createdAt).toLocaleString()}</p>
                              </div>

                              <Separator />

                              <div className="space-y-2">
                                <h4 className="font-semibold">Items</h4>
                                {order.items.map((item) => (
                                  <div key={item.id} className="flex justify-between items-center py-2 border-b">
                                    <div>
                                      <p className="font-medium">{item.menuItem.name}</p>
                                      <p className="text-sm text-muted-foreground">
                                        {formatCurrency(item.unitPrice)} x {item.quantity}
                                      </p>
                                      {item.notes && (
                                        <p className="text-xs text-muted-foreground italic">
                                          {item.notes}
                                        </p>
                                      )}
                                    </div>
                                    <p className="font-medium">{formatCurrency(item.totalAmount)}</p>
                                  </div>
                                ))}
                              </div>

                              <div className="space-y-1 text-sm">
                                <div className="flex justify-between">
                                  <span>Subtotal</span>
                                  <span>{formatCurrency(order.subtotal)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Tax</span>
                                  <span>{formatCurrency(order.taxes)}</span>
                                </div>
                                <div className="flex justify-between font-bold text-lg">
                                  <span>Total</span>
                                  <span>{formatCurrency(order.totalAmount)}</span>
                                </div>
                              </div>

                              {order.notes && (
                                <>
                                  <Separator />
                                  <div>
                                    <h4 className="font-semibold mb-1">Notes</h4>
                                    <p className="text-sm text-muted-foreground">{order.notes}</p>
                                  </div>
                                </>
                              )}
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
