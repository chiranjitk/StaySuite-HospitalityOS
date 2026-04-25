'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useGuestApp } from '../layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  Plus,
  Minus,
  Clock,
  CheckCircle2,
  Loader2,
  UtensilsCrossed,
  Sparkles,
  Wrench,
  Car,
  Dumbbell,
  Coffee,
  MessageSquare,
  Leaf,
  Wheat,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface ServiceCategory {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  items: ServiceItem[];
}

interface ServiceItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  imageUrl?: string;
  preparationTime?: number;
  dietary: {
    isVegetarian: boolean;
    isVegan: boolean;
    isGlutenFree: boolean;
  };
}

interface ServiceRequest {
  id: string;
  type: string;
  subject: string;
  description?: string;
  status: string;
  priority: string;
  createdAt: string;
  startedAt?: string;
}

// Service type icons
const serviceIcons: Record<string, React.ElementType> = {
  room_service: UtensilsCrossed,
  housekeeping: Sparkles,
  maintenance: Wrench,
  valet: Car,
  spa: Dumbbell,
  concierge: Coffee,
  other: MessageSquare,
};

function ServicesContent() {
  const searchParams = useSearchParams();
  const actionParam = searchParams.get('action');
  const { data: guestData } = useGuestApp();
  const { toast } = useToast();

  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [existingRequests, setExistingRequests] = useState<ServiceRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Dialog states
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ServiceItem | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [specialRequests, setSpecialRequests] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Custom request dialog
  const [isCustomDialogOpen, setIsCustomDialogOpen] = useState(false);
  const [customRequest, setCustomRequest] = useState({
    type: 'room_service',
    subject: '',
    description: '',
    priority: 'medium',
  });

  // Fetch services
  useEffect(() => {
    const fetchServices = async () => {
      if (!guestData) return;

      setIsLoading(true);
      try {
        const token = window.location.pathname.split('/')[2];
        const response = await fetch(`/api/guest-app/services?token=${token}`);
        const result = await response.json();

        if (result.success) {
          setCategories(result.data.categories);
          setExistingRequests(result.data.existingRequests);
        }
      } catch (error) {
        console.error('Error fetching services:', error);
        toast({
          title: 'Error',
          description: 'Failed to load services',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchServices();
  }, [guestData, toast]);

  // Open dialog based on action param
  useEffect(() => {
    if (actionParam && !isLoading) {
      const typeMap: Record<string, string> = {
        'room-service': 'room_service',
        'housekeeping': 'housekeeping',
        'valet': 'valet',
        'spa': 'spa',
        'pool': 'spa',
        'concierge': 'concierge',
      };
      setCustomRequest(prev => ({
        ...prev,
        type: typeMap[actionParam] || 'other',
      }));
      setIsCustomDialogOpen(true);
    }
  }, [actionParam, isLoading]);

  // Handle order item
  const handleOrderItem = async () => {
    if (!selectedItem) return;

    setIsSubmitting(true);
    try {
      const token = window.location.pathname.split('/')[2];
      const response = await fetch('/api/guest-app/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          type: 'room_service',
          subject: selectedItem.name,
          menuItemId: selectedItem.id,
          quantity,
          specialRequests,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Order Placed',
          description: `Your ${selectedItem.name} has been ordered`,
        });
        setIsRequestDialogOpen(false);
        setSelectedItem(null);
        setQuantity(1);
        setSpecialRequests('');
        // Refresh requests
        setExistingRequests(prev => [result.data, ...prev]);
      } else {
        throw new Error(result.error?.message || 'Failed to place order');
      }
    } catch (error) {
      console.error('Error placing order:', error);
      toast({
        title: 'Error',
        description: 'Failed to place order',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle custom request
  const handleCustomRequest = async () => {
    if (!customRequest.subject) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a subject',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const token = window.location.pathname.split('/')[2];
      const response = await fetch('/api/guest-app/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          ...customRequest,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Request Submitted',
          description: 'Your request has been submitted',
        });
        setIsCustomDialogOpen(false);
        setCustomRequest({
          type: 'room_service',
          subject: '',
          description: '',
          priority: 'medium',
        });
        setExistingRequests(prev => [result.data, ...prev]);
      } else {
        throw new Error(result.error?.message || 'Failed to submit request');
      }
    } catch (error) {
      console.error('Error submitting request:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit request',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter categories
  const filteredCategories = categories.filter(cat =>
    cat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cat.items.some(item =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Services</h2>
          <p className="text-sm text-muted-foreground">
            Order room service or request assistance
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setIsCustomDialogOpen(true)}
        >
          <Plus className="h-4 w-4 mr-1" />
          Request
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search services..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Active Requests */}
      {existingRequests.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
            Active Requests
          </h3>
          <div className="space-y-2">
            {existingRequests.slice(0, 3).map((request) => {
              const Icon = serviceIcons[request.type] || MessageSquare;
              return (
                <Card key={request.id}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center">
                          <Icon className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{request.subject}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          request.status === 'completed' && 'border-emerald-500 text-emerald-600 dark:text-emerald-400',
                          request.status === 'in_progress' && 'border-amber-500 text-amber-600 dark:text-amber-400',
                          request.status === 'pending' && 'border-slate-400 text-slate-600'
                        )}
                      >
                        {request.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Service Categories */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
          Menu & Services
        </h3>

        {filteredCategories.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <UtensilsCrossed className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No services available at this time</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredCategories.map((category) => (
              <Card key={category.id}>
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-base">{category.name}</CardTitle>
                  {category.description && (
                    <p className="text-xs text-muted-foreground">{category.description}</p>
                  )}
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="max-h-[400px]">
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {category.items.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => {
                            setSelectedItem(item);
                            setQuantity(1);
                            setSpecialRequests('');
                            setIsRequestDialogOpen(true);
                          }}
                          className="w-full p-4 flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left"
                        >
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.name}
                              className="w-16 h-16 rounded-lg object-cover"
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center">
                              <UtensilsCrossed className="h-6 w-6 text-slate-400" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-medium text-sm">{item.name}</p>
                                {item.description && (
                                  <p className="text-xs text-muted-foreground line-clamp-2">
                                    {item.description}
                                  </p>
                                )}
                              </div>
                              <p className="font-semibold text-sm whitespace-nowrap">
                                {item.currency} {item.price.toFixed(2)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 mt-2">
                              {item.dietary.isVegetarian && (
                                <Badge variant="outline" className="text-[10px] py-0">
                                  <Leaf className="h-3 w-3 mr-1 text-emerald-500 dark:text-emerald-400" />
                                  Veg
                                </Badge>
                              )}
                              {item.dietary.isVegan && (
                                <Badge variant="outline" className="text-[10px] py-0">
                                  <Leaf className="h-3 w-3 mr-1 text-green-500 dark:text-green-400" />
                                  Vegan
                                </Badge>
                              )}
                              {item.dietary.isGlutenFree && (
                                <Badge variant="outline" className="text-[10px] py-0">
                                  <Wheat className="h-3 w-3 mr-1 text-amber-500 dark:text-amber-400" />
                                  GF
                                </Badge>
                              )}
                              {item.preparationTime && (
                                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {item.preparationTime} min
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Order Item Dialog */}
      <Dialog open={isRequestDialogOpen} onOpenChange={setIsRequestDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Order {selectedItem?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedItem && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Price</span>
                  <span className="font-semibold">
                    {selectedItem.currency} {selectedItem.price.toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <Label>Quantity</Label>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-8 text-center">{quantity}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setQuantity(quantity + 1)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div>
                  <Label>Special Requests</Label>
                  <Textarea
                    placeholder="Any special instructions..."
                    value={specialRequests}
                    onChange={(e) => setSpecialRequests(e.target.value)}
                    rows={2}
                    className="mt-1"
                  />
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <div className="flex justify-between text-sm">
                    <span>Total</span>
                    <span className="font-bold">
                      {selectedItem.currency} {(selectedItem.price * quantity).toFixed(2)}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRequestDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleOrderItem} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Place Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Custom Request Dialog */}
      <Dialog open={isCustomDialogOpen} onOpenChange={setIsCustomDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Submit Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Request Type</Label>
              <Select
                value={customRequest.type}
                onValueChange={(value) =>
                  setCustomRequest(prev => ({ ...prev, type: value }))
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="room_service">Room Service</SelectItem>
                  <SelectItem value="housekeeping">Housekeeping</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="valet">Valet</SelectItem>
                  <SelectItem value="spa">Spa & Wellness</SelectItem>
                  <SelectItem value="concierge">Concierge</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Subject</Label>
              <Input
                placeholder="Brief description of your request"
                value={customRequest.subject}
                onChange={(e) =>
                  setCustomRequest(prev => ({ ...prev, subject: e.target.value }))
                }
                className="mt-1"
              />
            </div>

            <div>
              <Label>Details</Label>
              <Textarea
                placeholder="More details about your request..."
                value={customRequest.description}
                onChange={(e) =>
                  setCustomRequest(prev => ({ ...prev, description: e.target.value }))
                }
                rows={3}
                className="mt-1"
              />
            </div>

            <div>
              <Label>Priority</Label>
              <Select
                value={customRequest.priority}
                onValueChange={(value) =>
                  setCustomRequest(prev => ({ ...prev, priority: value }))
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCustomDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCustomRequest} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ServicesPage() {
  return (
    <Suspense fallback={<div className="p-4"><Skeleton className="h-64 w-full rounded-xl" /></div>}>
      <ServicesContent />
    </Suspense>
  );
}
