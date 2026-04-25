'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
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
  Tv,
  Lightbulb,
  Thermometer,
  Coffee,
  UtensilsCrossed,
  Sparkles,
  ShoppingCart,
  Clock,
  RefreshCw,
  Plus,
  Loader2,
  Sun,
  Moon,
  BedDouble,
  DoorOpen,
  Heart,
  ConciergeBell,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { toast as sonnerToast } from 'sonner';

interface RoomControl {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  value?: number;
  unit?: string;
}

interface ServiceItem {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  available: boolean;
  preparationTime: number;
}

interface ServiceOrder {
  id: string;
  items: { name: string; quantity: number; price: number }[];
  total: number;
  status: 'pending' | 'confirmed' | 'preparing' | 'delivered';
  orderedAt: string;
  estimatedDelivery?: string;
  roomNumber: string;
  specialRequests?: string;
}

interface RoomPortal {
  roomNumber: string;
  roomType: string;
  floor: number;
  guestName: string;
  checkIn: string;
  checkOut: string;
  roomId?: string;
  controls: RoomControl[];
  services: ServiceItem[];
  recentOrders: ServiceOrder[];
}

const serviceCategories = [
  { value: 'food', label: 'Food & Dining', icon: UtensilsCrossed },
  { value: 'beverages', label: 'Beverages', icon: Coffee },
  { value: 'spa', label: 'Spa & Wellness', icon: Heart },
  { value: 'housekeeping', label: 'Housekeeping', icon: Sparkles },
  { value: 'concierge', label: 'Concierge', icon: ConciergeBell },
];

const controlIcons: Record<string, React.ElementType> = {
  light: Lightbulb,
  ac: Thermometer,
  tv: Tv,
  curtain: Moon,
  dnd: DoorOpen,
  privacy: BedDouble,
};

export default function InRoomPortal() {
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const { user } = useAuth();
  const [portalData, setPortalData] = useState<RoomPortal | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isOrderDialogOpen, setIsOrderDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ServiceItem | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [specialRequests, setSpecialRequests] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchPortalData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/portal/in-room');
      const result = await response.json();

      if (result.success) {
        setPortalData(result.data);
      } else {
        sonnerToast.error('Failed to load portal data');
      }
    } catch (error) {
      console.error('Error fetching portal data:', error);
      sonnerToast.error('Failed to load room portal data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPortalData();
  }, [fetchPortalData]);

  const handleControlToggle = async (control: RoomControl, enabled: boolean) => {
    if (!portalData) return;

    // Optimistic update
    setPortalData({
      ...portalData,
      controls: portalData.controls.map(c =>
        c.id === control.id ? { ...c, enabled } : c
      ),
    });

    try {
      const response = await fetch('/api/portal/in-room', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: control.id.startsWith('ctrl-') ? undefined : control.id,
          roomId: portalData.roomId,
          controlType: control.type,
          enabled,
        }),
      });

      if (!response.ok) {
        // Revert on failure
        setPortalData({
          ...portalData,
          controls: portalData.controls.map(c =>
            c.id === control.id ? { ...c, enabled: !enabled } : c
          ),
        });
        sonnerToast.error('Failed to update control');
      }
    } catch (error) {
      console.error('Error updating control:', error);
      sonnerToast.error('Failed to update control');
    }
  };

  const handleControlValueChange = async (control: RoomControl, value: number) => {
    if (!portalData) return;

    // Optimistic update
    setPortalData({
      ...portalData,
      controls: portalData.controls.map(c =>
        c.id === control.id ? { ...c, value } : c
      ),
    });

    try {
      await fetch('/api/portal/in-room', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: control.id.startsWith('ctrl-') ? undefined : control.id,
          roomId: portalData.roomId,
          controlType: control.type,
          value,
        }),
      });
    } catch (error) {
      console.error('Error updating control value:', error);
    }
  };

  const handleOrderService = async () => {
    if (!selectedItem) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/service-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: user?.tenantId,
          roomId: portalData?.roomId,
          type: 'room_service',
          subject: `${selectedItem.name} x${quantity}`,
          description: specialRequests || undefined,
          priority: 'medium',
        }),
      });

      const result = await response.json();

      if (result.success) {
        sonnerToast.success(`Order placed! Estimated delivery: ${selectedItem.preparationTime} minutes`);
        setIsOrderDialogOpen(false);
        setSelectedItem(null);
        setQuantity(1);
        setSpecialRequests('');
        fetchPortalData();
      } else {
        throw new Error(result.error?.message || 'Failed to place order');
      }
    } catch (error) {
      console.error('Error placing order:', error);
      sonnerToast.error('Failed to place order');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredServices = portalData?.services.filter(
    service => selectedCategory === 'all' || service.category === selectedCategory
  ) || [];

  if (isLoading || !portalData) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-24" />
        </div>
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Tv className="h-5 w-5" />
            In-Room Portal
          </h2>
          <p className="text-sm text-muted-foreground">
            Room {portalData.roomNumber} - {portalData.roomType}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchPortalData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Room Info Card */}
      <Card className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-emerald-500/20">
                <BedDouble className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Welcome, {portalData.guestName}</h3>
                <p className="text-sm text-muted-foreground">
                  Stay: {format(new Date(portalData.checkIn), 'MMM d')} - {format(new Date(portalData.checkOut), 'MMM d, yyyy')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-400">
                Floor {portalData.floor}
              </Badge>
              <Badge variant="outline">
                {portalData.roomType}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Room Controls */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-amber-500 dark:text-amber-400" />
            Room Controls
          </CardTitle>
          <CardDescription>Manage your room environment</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            {portalData.controls.map((control) => {
              const Icon = controlIcons[control.type] || Lightbulb;
              return (
                <Card
                  key={control.id}
                  className={cn(
                    'relative overflow-hidden transition-all',
                    control.enabled ? 'border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-950/20' : ''
                  )}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className={cn(
                        'p-2 rounded-lg transition-colors',
                        control.enabled ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-muted text-muted-foreground'
                      )}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <Switch
                        checked={control.enabled}
                        onCheckedChange={(checked) => handleControlToggle(control, checked)}
                      />
                    </div>
                    <p className="text-sm font-medium">{control.name}</p>
                    {control.value !== undefined && control.enabled && (
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                          <span>{control.value}{control.unit}</span>
                        </div>
                        <Slider
                          value={[control.value]}
                          onValueChange={(values) => handleControlValueChange(control, values[0])}
                          max={control.type === 'ac' ? 30 : 100}
                          min={control.type === 'ac' ? 16 : 0}
                          step={1}
                          className="h-1"
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Services Catalog */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-violet-500 dark:text-violet-400" />
                Guest Services
              </CardTitle>
              <CardDescription>Order food, spa, and concierge services</CardDescription>
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Services</SelectItem>
                {serviceCategories.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px] pr-4">
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
              {filteredServices.map((service) => {
                const categoryConfig = serviceCategories.find(c => c.value === service.category);
                const CategoryIcon = categoryConfig?.icon || Coffee;
                return (
                  <Card key={service.id} className="overflow-hidden hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div className="p-3 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/20 text-violet-600">
                          <CategoryIcon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium">{service.name}</h4>
                            {service.price > 0 && (
                              <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(service.price)}</span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {service.description}
                          </p>
                          <div className="flex items-center justify-between mt-3">
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span>{service.preparationTime} mins</span>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedItem(service);
                                setIsOrderDialogOpen(true);
                              }}
                              disabled={!service.available}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Order
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Recent Orders */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5 text-cyan-500 dark:text-cyan-400" />
            Recent Orders
          </CardTitle>
          <CardDescription>Track your service orders</CardDescription>
        </CardHeader>
        <CardContent>
          {portalData.recentOrders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No recent orders</p>
            </div>
          ) : (
            <div className="space-y-3">
              {portalData.recentOrders.map((order) => (
                <Card key={order.id} className="bg-muted/30">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Order #{order.id.slice(-6)}</span>
                          <Badge
                            variant="secondary"
                            className={cn(
                              'text-white',
                              order.status === 'delivered' ? 'bg-emerald-500' :
                              order.status === 'preparing' ? 'bg-amber-500' :
                              order.status === 'confirmed' ? 'bg-cyan-500' : 'bg-gray-500'
                            )}
                          >
                            {order.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {order.items.map(i => `${i.name} x${i.quantity}`).join(', ')}
                        </p>
                        {order.specialRequests && (
                          <p className="text-xs text-muted-foreground mt-1 italic">
                            Note: {order.specialRequests}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatCurrency(order.total)}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(order.orderedAt), 'MMM d, HH:mm')}
                        </p>
                        {order.estimatedDelivery && (
                          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                            ETA: {order.estimatedDelivery}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order Dialog */}
      <Dialog open={isOrderDialogOpen} onOpenChange={setIsOrderDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Order Service</DialogTitle>
            <DialogDescription>
              {selectedItem?.name}
            </DialogDescription>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="text-sm text-muted-foreground">Price per item</span>
                <span className="font-semibold">{formatCurrency(selectedItem.price)}</span>
              </div>

              <div className="space-y-2">
                <Label>Quantity</Label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  >
                    -
                  </Button>
                  <Input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-20 text-center"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setQuantity(quantity + 1)}
                  >
                    +
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Special Requests</Label>
                <Textarea
                  placeholder="Any special requests or dietary requirements..."
                  value={specialRequests}
                  onChange={(e) => setSpecialRequests(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg">
                <span className="font-medium">Total</span>
                <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(selectedItem.price * quantity)}
                </span>
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Estimated delivery: {selectedItem.preparationTime} minutes</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOrderDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleOrderService} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Place Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
