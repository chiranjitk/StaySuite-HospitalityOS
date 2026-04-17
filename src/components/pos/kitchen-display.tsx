'use client';

import { useState, useEffect, useCallback } from 'react';
import { useCurrency } from '@/contexts/CurrencyContext';
import { usePropertyId } from '@/hooks/use-property';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { 
  Loader2, 
  ChefHat, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  Timer,
  Volume2,
  RefreshCw
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
    preparationTime?: number;
    kitchenStation?: string;
  };
}

interface Order {
  id: string;
  orderNumber: string;
  orderType: string;
  status: string;
  kitchenStatus: string;
  totalAmount: number;
  guestName?: string;
  notes?: string;
  createdAt: string;
  kitchenStartedAt?: string;
  kitchenCompletedAt?: string;
  table?: {
    id: string;
    number: string;
    name?: string;
    area?: string;
  };
  items: OrderItem[];
}

const orderTypeLabels: Record<string, string> = {
  dine_in: 'Dine In',
  takeout: 'Takeout',
  delivery: 'Delivery',
  room_service: 'Room Service',
};

const kitchenStatusConfig: Record<string, { color: string; bgColor: string; borderColor: string }> = {
  pending: {
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-300',
  },
  cooking: {
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-300',
  },
  ready: {
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-300',
  },
  completed: {
    color: 'text-slate-700',
    bgColor: 'bg-slate-50',
    borderColor: 'border-slate-300',
  },
};

export default function KitchenDisplay() {
  const { formatCurrency } = useCurrency();
  const { propertyId } = usePropertyId();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    pending: 0,
    cooking: 0,
    ready: 0,
    completed: 0,
    avgWaitTime: 0,
  });

  const fetchOrders = useCallback(async () => {
    try {
      // Fetch active orders filtered by propertyId (including served for the served column)
      const params = new URLSearchParams();
      if (propertyId) params.append('propertyId', propertyId);
      params.append('status', 'pending,confirmed,preparing,ready,served');
      const res = await fetch(`/api/orders?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        const allOrders: Order[] = data.data;
        setOrders(allOrders);

        // Separate active orders (non-served) for the working columns
        const activeOrders = allOrders.filter((o: Order) => 
          ['pending', 'confirmed', 'preparing', 'ready'].includes(o.status)
        );

        // Calculate stats from the fresh data
        const pending = activeOrders.filter((o: Order) => o.kitchenStatus === 'pending').length;
        const cooking = activeOrders.filter((o: Order) => o.kitchenStatus === 'cooking').length;
        const ready = activeOrders.filter((o: Order) => o.kitchenStatus === 'ready').length;
        const completed = allOrders.filter((o: Order) => o.status === 'served').length;

        // Calculate average wait time for pending orders
        const pendingOrders = activeOrders.filter((o: Order) => o.kitchenStatus === 'pending');
        let totalWait = 0;
        pendingOrders.forEach((o: Order) => {
          const wait = (Date.now() - new Date(o.createdAt).getTime()) / 60000;
          totalWait += wait;
        });
        const avgWaitTime = pendingOrders.length > 0 ? totalWait / pendingOrders.length : 0;

        setStats({ pending, cooking, ready, completed, avgWaitTime });


      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    fetchOrders();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const updateKitchenStatus = async (orderId: string, kitchenStatus: string) => {
    try {
      let newStatus = '';
      if (kitchenStatus === 'cooking') {
        newStatus = 'preparing';
      } else if (kitchenStatus === 'ready') {
        newStatus = 'ready';
      } else if (kitchenStatus === 'completed') {
        // completed will auto-set status to 'served' on the backend
        newStatus = 'served';
      }

      const res = await fetch('/api/orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: orderId, 
          kitchenStatus,
          status: newStatus || undefined
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(`Order ${kitchenStatus === 'completed' ? 'marked as served' : kitchenStatus === 'ready' ? 'ready for pickup' : 'updated'}`);
        fetchOrders();
      } else {
        toast.error(data.error?.message || 'Failed to update order');
      }
    } catch (error) {
      console.error('Error updating order:', error);
      toast.error('Failed to update order');
    }
  };

  const getWaitTime = (createdAt: string) => {
    const diff = Date.now() - new Date(createdAt).getTime();
    const minutes = Math.floor(diff / 60000);
    return minutes;
  };

  const getWaitTimeColor = (minutes: number) => {
    if (minutes < 10) return 'text-emerald-600';
    if (minutes < 20) return 'text-amber-600';
    return 'text-red-600';
  };

  // Group orders by kitchen status for active columns
  const pendingOrders = orders.filter(o => ['pending', 'confirmed', 'preparing', 'ready'].includes(o.status) && o.kitchenStatus === 'pending');
  const cookingOrders = orders.filter(o => o.kitchenStatus === 'cooking');
  const readyOrders = orders.filter(o => o.kitchenStatus === 'ready');
  // Served orders (status = 'served') for the completed/served column
  const completedOrders = orders.filter(o => o.status === 'served');

  if (!propertyId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <ChefHat className="h-12 w-12 mb-4" />
        <p className="text-lg font-medium">No Property Selected</p>
        <p className="text-sm">Please select a property to view kitchen orders</p>
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Kitchen Display System</h1>
          <p className="text-muted-foreground">
            Real-time kitchen order management
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchOrders}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Timer className="h-4 w-4" />
            Auto-refresh: 30s
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-600" />
              Pending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-700">{stats.pending}</div>
            {stats.avgWaitTime > 0 && (
              <p className="text-xs text-amber-600 mt-1">
                Avg wait: {stats.avgWaitTime.toFixed(0)} min
              </p>
            )}
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ChefHat className="h-4 w-4 text-orange-600" />
              Cooking
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-700">{stats.cooking}</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-600" />
              Ready
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-700">{stats.ready}</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-slate-600" />
              Served
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-700">{stats.completed}</div>
          </CardContent>
        </Card>
      </div>

      {/* Orders Columns */}
      <div className="grid gap-6 grid-cols-1 md:grid-cols-4">
        {/* Pending Column */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-amber-500" />
            <h2 className="text-lg font-semibold">Pending ({pendingOrders.length})</h2>
          </div>
          <ScrollArea className="h-[calc(100vh-400px)]">
            <div className="space-y-4 pr-4">
              {pendingOrders.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="flex items-center justify-center py-8 text-muted-foreground">
                    No pending orders
                  </CardContent>
                </Card>
              ) : (
                pendingOrders.map((order) => {
                  const waitTime = getWaitTime(order.createdAt);
                  return (
                    <Card 
                      key={order.id} 
                      className={`${kitchenStatusConfig.pending.bgColor} ${kitchenStatusConfig.pending.borderColor} border-2`}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">{order.orderNumber}</CardTitle>
                          <Badge className={`${kitchenStatusConfig.pending.bgColor} ${kitchenStatusConfig.pending.color}`}>
                            {orderTypeLabels[order.orderType]}
                          </Badge>
                        </div>
                        <CardDescription className="flex items-center justify-between">
                          <span>
                            {order.table ? `Table ${order.table.number}` : order.guestName || 'No guest'}
                          </span>
                          <span className={`flex items-center gap-1 ${getWaitTimeColor(waitTime)}`}>
                            <Clock className="h-3 w-3" />
                            {waitTime}m
                          </span>
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="space-y-2">
                          {order.items.map((item) => (
                            <div key={item.id} className="flex items-start justify-between">
                              <div className="flex items-start gap-2">
                                <span className="font-bold text-lg">{item.quantity}x</span>
                                <div>
                                  <p className="font-medium">{item.menuItem.name}</p>
                                  {item.notes && (
                                    <p className="text-xs text-muted-foreground italic">
                                      {item.notes}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        {order.notes && (
                          <div className="pt-2 border-t border-amber-200">
                            <p className="text-xs font-medium text-amber-700">
                              <AlertTriangle className="h-3 w-3 inline mr-1" />
                              {order.notes}
                            </p>
                          </div>
                        )}
                        <Button
                          className="w-full bg-orange-500 hover:bg-orange-600"
                          onClick={() => updateKitchenStatus(order.id, 'cooking')}
                        >
                          <ChefHat className="h-4 w-4 mr-2" />
                          Start Cooking
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Cooking Column */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-orange-500" />
            <h2 className="text-lg font-semibold">Cooking ({cookingOrders.length})</h2>
          </div>
          <ScrollArea className="h-[calc(100vh-400px)]">
            <div className="space-y-4 pr-4">
              {cookingOrders.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="flex items-center justify-center py-8 text-muted-foreground">
                    No orders cooking
                  </CardContent>
                </Card>
              ) : (
                cookingOrders.map((order) => {
                  const waitTime = getWaitTime(order.createdAt);
                  const cookingTime = order.kitchenStartedAt 
                    ? getWaitTime(order.kitchenStartedAt)
                    : 0;
                  return (
                    <Card 
                      key={order.id} 
                      className={`${kitchenStatusConfig.cooking.bgColor} ${kitchenStatusConfig.cooking.borderColor} border-2`}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">{order.orderNumber}</CardTitle>
                          <Badge className={`${kitchenStatusConfig.cooking.bgColor} ${kitchenStatusConfig.cooking.color}`}>
                            {orderTypeLabels[order.orderType]}
                          </Badge>
                        </div>
                        <CardDescription className="flex items-center justify-between">
                          <span>
                            {order.table ? `Table ${order.table.number}` : order.guestName || 'No guest'}
                          </span>
                          <span className="text-orange-600 flex items-center gap-1">
                            <ChefHat className="h-3 w-3" />
                            {cookingTime}m cooking
                          </span>
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="space-y-2">
                          {order.items.map((item) => (
                            <div key={item.id} className="flex items-start justify-between">
                              <div className="flex items-start gap-2">
                                <span className="font-bold text-lg">{item.quantity}x</span>
                                <div>
                                  <p className="font-medium">{item.menuItem.name}</p>
                                  {item.notes && (
                                    <p className="text-xs text-muted-foreground italic">
                                      {item.notes}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        {order.notes && (
                          <div className="pt-2 border-t border-orange-200">
                            <p className="text-xs font-medium text-orange-700">
                              <AlertTriangle className="h-3 w-3 inline mr-1" />
                              {order.notes}
                            </p>
                          </div>
                        )}
                        <Button
                          className="w-full bg-emerald-500 hover:bg-emerald-600"
                          onClick={() => updateKitchenStatus(order.id, 'ready')}
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Mark Ready
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Ready Column */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-emerald-500" />
            <h2 className="text-lg font-semibold">Ready ({readyOrders.length})</h2>
          </div>
          <ScrollArea className="h-[calc(100vh-400px)]">
            <div className="space-y-4 pr-4">
              {readyOrders.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="flex items-center justify-center py-8 text-muted-foreground">
                    No orders ready
                  </CardContent>
                </Card>
              ) : (
                readyOrders.map((order) => {
                  const readyTime = order.kitchenCompletedAt 
                    ? getWaitTime(order.kitchenCompletedAt)
                    : 0;
                  return (
                    <Card 
                      key={order.id} 
                      className={`${kitchenStatusConfig.ready.bgColor} ${kitchenStatusConfig.ready.borderColor} border-2`}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">{order.orderNumber}</CardTitle>
                          <Badge className={`${kitchenStatusConfig.ready.bgColor} ${kitchenStatusConfig.ready.color}`}>
                            {orderTypeLabels[order.orderType]}
                          </Badge>
                        </div>
                        <CardDescription className="flex items-center justify-between">
                          <span>
                            {order.table ? `Table ${order.table.number}` : order.guestName || 'No guest'}
                          </span>
                          <span className="text-emerald-600 flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Ready {readyTime}m
                          </span>
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="space-y-2">
                          {order.items.map((item) => (
                            <div key={item.id} className="flex items-start justify-between">
                              <div className="flex items-start gap-2">
                                <span className="font-bold text-lg">{item.quantity}x</span>
                                <p className="font-medium">{item.menuItem.name}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-emerald-200">
                          <span className="text-sm font-medium">Total: {formatCurrency(order.totalAmount)}</span>
                          <Badge className="bg-emerald-500 text-white">
                            READY TO SERVE
                          </Badge>
                        </div>
                        <Button
                          className="w-full bg-slate-600 hover:bg-slate-700"
                          onClick={() => updateKitchenStatus(order.id, 'completed')}
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Mark Served
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Completed/Served Column */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-slate-400" />
            <h2 className="text-lg font-semibold">Served ({completedOrders.length})</h2>
          </div>
          <ScrollArea className="h-[calc(100vh-400px)]">
            <div className="space-y-4 pr-4">
              {completedOrders.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="flex items-center justify-center py-8 text-muted-foreground">
                    No orders served
                  </CardContent>
                </Card>
              ) : (
                completedOrders.map((order) => {
                  const completedTime = order.kitchenCompletedAt 
                    ? getWaitTime(order.kitchenCompletedAt)
                    : 0;
                  return (
                    <Card 
                      key={order.id} 
                      className={`${kitchenStatusConfig.completed.bgColor} ${kitchenStatusConfig.completed.borderColor} border-2 opacity-75`}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">{order.orderNumber}</CardTitle>
                          <Badge className={`${kitchenStatusConfig.completed.bgColor} ${kitchenStatusConfig.completed.color}`}>
                            {orderTypeLabels[order.orderType]}
                          </Badge>
                        </div>
                        <CardDescription className="flex items-center justify-between">
                          <span>
                            {order.table ? `Table ${order.table.number}` : order.guestName || 'No guest'}
                          </span>
                          <span className="text-slate-500 flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Served
                          </span>
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="space-y-2">
                          {order.items.map((item) => (
                            <div key={item.id} className="flex items-start justify-between">
                              <div className="flex items-start gap-2">
                                <span className="font-bold text-lg">{item.quantity}x</span>
                                <p className="font-medium">{item.menuItem.name}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                          <span className="text-sm font-medium">Total: {formatCurrency(order.totalAmount)}</span>
                          <Badge className="bg-slate-500 text-white">
                            SERVED
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
