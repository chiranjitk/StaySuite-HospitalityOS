'use client';

import { useState, useEffect } from 'react';
import { useCurrency } from '@/contexts/CurrencyContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
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
import { 
  Loader2, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Package,
  Users,
  Utensils,
  Music,
  Wrench,
  DollarSign
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Event {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
  property: {
    id: string;
    name: string;
  };
  space: {
    id: string;
    name: string;
  } | null;
}

interface EventResource {
  id: string;
  eventId: string;
  name: string;
  category: string;
  description: string | null;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  vendorId: string | null;
  vendorName: string | null;
  staffId: string | null;
  staffName: string | null;
  status: string;
  setupTime: string | null;
  teardownTime: string | null;
  notes: string | null;
  createdAt: string;
}

interface Stats {
  total: number;
  totalAmount: number;
  pending: number;
  confirmed: number;
  in_use: number;
  completed: number;
  cancelled: number;
  categoryTotals: Record<string, { count: number; totalAmount: number }>;
}

const categoryIcons: Record<string, any> = {
  equipment: Package,
  staff: Users,
  catering: Utensils,
  decor: Music,
  av: Music,
  other: Package
};

const categoryColors: Record<string, string> = {
  equipment: 'bg-teal-100 text-teal-800',
  staff: 'bg-emerald-100 text-emerald-800',
  catering: 'bg-orange-100 text-orange-800',
  decor: 'bg-pink-100 text-pink-800',
  av: 'bg-amber-100 text-amber-800',
  other: 'bg-gray-100 text-gray-800'
};

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-emerald-100 text-emerald-800',
  in_use: 'bg-teal-100 text-teal-800',
  completed: 'bg-gray-100 text-gray-800',
  cancelled: 'bg-red-100 text-red-800'
};

export default function EventResources() {
  const { formatCurrency } = useCurrency();
  const [events, setEvents] = useState<Event[]>([]);
  const [resources, setResources] = useState<EventResource[]>([]);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    totalAmount: 0,
    pending: 0,
    confirmed: 0,
    in_use: 0,
    completed: 0,
    cancelled: 0,
    categoryTotals: {}
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedResource, setSelectedResource] = useState<EventResource | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    category: 'equipment',
    description: '',
    quantity: 1,
    unitPrice: 0,
    vendorName: '',
    staffName: '',
    status: 'pending',
    setupTime: '',
    teardownTime: '',
    notes: ''
  });

  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    if (selectedEvent) {
      fetchResources(selectedEvent.id);
    }
  }, [selectedEvent, categoryFilter, statusFilter]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/events?status=confirmed,status=in_progress');
      if (!response.ok) throw new Error('Failed to fetch events');
      
      const data = await response.json();
      const filteredEvents = (data.events || []).filter((e: Event) => 
        e.status !== 'cancelled' && e.status !== 'completed'
      );
      setEvents(filteredEvents);
      
      // Select first event by default
      if (filteredEvents.length > 0 && !selectedEvent) {
        setSelectedEvent(filteredEvents[0]);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
      toast.error('Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  const fetchResources = async (eventId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/events/${eventId}/resources`);
      if (!response.ok) throw new Error('Failed to fetch resources');
      
      const data = await response.json();
      let filteredResources = data.resources || [];
      
      if (categoryFilter !== 'all') {
        filteredResources = filteredResources.filter((r: EventResource) => r.category === categoryFilter);
      }
      
      if (statusFilter !== 'all') {
        filteredResources = filteredResources.filter((r: EventResource) => r.status === statusFilter);
      }
      
      setResources(filteredResources);
      setStats(data.stats || {
        total: 0,
        totalAmount: 0,
        pending: 0,
        confirmed: 0,
        in_use: 0,
        completed: 0,
        cancelled: 0,
        categoryTotals: {}
      });
    } catch (error) {
      console.error('Error fetching resources:', error);
      toast.error('Failed to load resources');
    } finally {
      setLoading(false);
    }
  };

  const handleAddResource = async () => {
    if (!selectedEvent) return;
    
    try {
      setSaving(true);
      const response = await fetch(`/api/events/${selectedEvent.id}/resources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          category: formData.category,
          description: formData.description || null,
          quantity: formData.quantity,
          unitPrice: formData.unitPrice,
          vendorName: formData.vendorName || null,
          staffName: formData.staffName || null,
          status: formData.status,
          setupTime: formData.setupTime || null,
          teardownTime: formData.teardownTime || null,
          notes: formData.notes || null
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add resource');
      }

      toast.success('Resource added successfully');
      setIsAddOpen(false);
      resetForm();
      fetchResources(selectedEvent.id);
    } catch (error: unknown) {
      console.error('Error adding resource:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to add resource');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateResource = async () => {
    if (!selectedEvent || !selectedResource) return;
    
    try {
      setSaving(true);
      // Use PUT to update the resource in-place (not create-then-delete)
      const response = await fetch(`/api/events/${selectedEvent.id}/resources?resourceId=${selectedResource.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resourceId: selectedResource.id,
          name: formData.name,
          category: formData.category,
          description: formData.description || null,
          quantity: formData.quantity,
          unitPrice: formData.unitPrice,
          vendorName: formData.vendorName || null,
          staffName: formData.staffName || null,
          status: formData.status,
          setupTime: formData.setupTime || null,
          teardownTime: formData.teardownTime || null,
          notes: formData.notes || null
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update resource');
      }

      toast.success('Resource updated successfully');
      setIsEditOpen(false);
      setSelectedResource(null);
      resetForm();
      fetchResources(selectedEvent.id);
    } catch (error: unknown) {
      console.error('Error updating resource:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update resource');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteResource = async () => {
    if (!selectedEvent || !selectedResource) return;
    
    try {
      setSaving(true);
      const response = await fetch(`/api/events/${selectedEvent.id}/resources?resourceId=${selectedResource.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete resource');
      }

      toast.success('Resource deleted successfully');
      setIsDeleteOpen(false);
      setSelectedResource(null);
      fetchResources(selectedEvent.id);
    } catch (error: unknown) {
      console.error('Error deleting resource:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete resource');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      category: 'equipment',
      description: '',
      quantity: 1,
      unitPrice: 0,
      vendorName: '',
      staffName: '',
      status: 'pending',
      setupTime: '',
      teardownTime: '',
      notes: ''
    });
  };

  const openEditDialog = (resource: EventResource) => {
    setSelectedResource(resource);
    setFormData({
      name: resource.name,
      category: resource.category,
      description: resource.description || '',
      quantity: resource.quantity,
      unitPrice: resource.unitPrice,
      vendorName: resource.vendorName || '',
      staffName: resource.staffName || '',
      status: resource.status,
      setupTime: resource.setupTime ? format(new Date(resource.setupTime), "yyyy-MM-dd'T'HH:mm") : '',
      teardownTime: resource.teardownTime ? format(new Date(resource.teardownTime), "yyyy-MM-dd'T'HH:mm") : '',
      notes: resource.notes || ''
    });
    setIsEditOpen(true);
  };

  const filteredResources = resources.filter(resource =>
    resource.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (resource.vendorName?.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (resource.staffName?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading && !selectedEvent) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Event Resources</h2>
          <p className="text-muted-foreground">Manage equipment, staff, catering, and more for events</p>
        </div>
        <Button onClick={() => { resetForm(); setIsAddOpen(true); }} disabled={!selectedEvent}>
          <Plus className="h-4 w-4 mr-2" />
          Add Resource
        </Button>
      </div>

      {/* Event Selection */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <Select 
              value={selectedEvent?.id || ''} 
              onValueChange={(v) => {
                const event = events.find(e => e.id === v);
                setSelectedEvent(event || null);
              }}
            >
              <SelectTrigger className="w-full sm:w-80">
                <SelectValue placeholder="Select an event" />
              </SelectTrigger>
              <SelectContent>
                {events.map(event => (
                  <SelectItem key={event.id} value={event.id}>
                    {event.name} - {format(new Date(event.startDate), 'MMM d, yyyy')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedEvent && (
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>{selectedEvent.property.name}</span>
                {selectedEvent.space && <span>• {selectedEvent.space.name}</span>}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedEvent && (
        <>
          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-7">
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">Total Items</div>
                <div className="text-xl font-bold">{stats.total}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">Total Amount</div>
                <div className="text-xl font-bold text-emerald-600">{formatCurrency(stats.totalAmount)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">Pending</div>
                <div className="text-xl font-bold text-yellow-600">{stats.pending}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">Confirmed</div>
                <div className="text-xl font-bold text-emerald-600">{stats.confirmed}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">In Use</div>
                <div className="text-xl font-bold text-teal-600">{stats.in_use}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">Completed</div>
                <div className="text-xl font-bold text-gray-600">{stats.completed}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-sm text-muted-foreground">Cancelled</div>
                <div className="text-xl font-bold text-red-600">{stats.cancelled}</div>
              </CardContent>
            </Card>
          </div>

          {/* Category Summary */}
          {Object.keys(stats.categoryTotals).length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Category Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  {Object.entries(stats.categoryTotals).map(([category, data]) => {
                    const Icon = categoryIcons[category] || Package;
                    return (
                      <div key={category} className="flex items-center gap-3 p-3 rounded-lg border">
                        <div className={`p-2 rounded-md ${categoryColors[category] || 'bg-gray-100'}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-sm font-medium capitalize">{category}</div>
                          <div className="text-xs text-muted-foreground">
                            {data.count} items • {formatCurrency(data.totalAmount)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search resources..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="equipment">Equipment</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="catering">Catering</SelectItem>
                    <SelectItem value="decor">Decor</SelectItem>
                    <SelectItem value="av">A/V</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="in_use">In Use</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Resources Table */}
          <Card>
            <CardContent className="pt-6">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Resource</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead>Unit Price</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Vendor/Staff</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredResources.map(resource => {
                      const Icon = categoryIcons[resource.category] || Package;
                      return (
                        <TableRow key={resource.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className={`p-1.5 rounded ${categoryColors[resource.category] || 'bg-gray-100'}`}>
                                <Icon className="h-3 w-3" />
                              </div>
                              <div>
                                <div className="font-medium">{resource.name}</div>
                                {resource.description && (
                                  <div className="text-xs text-muted-foreground line-clamp-1">
                                    {resource.description}
                                  </div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {resource.category}
                            </Badge>
                          </TableCell>
                          <TableCell>{resource.quantity}</TableCell>
                          <TableCell>{formatCurrency(resource.unitPrice)}</TableCell>
                          <TableCell className="font-medium">{formatCurrency(resource.totalAmount)}</TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {resource.vendorName && <div>{resource.vendorName}</div>}
                              {resource.staffName && <div className="text-muted-foreground">{resource.staffName}</div>}
                              {!resource.vendorName && !resource.staffName && <span className="text-muted-foreground">-</span>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={statusColors[resource.status] || 'bg-gray-100'}>
                              {resource.status.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="sm" onClick={() => openEditDialog(resource)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => { setSelectedResource(resource); setIsDeleteOpen(true); }}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}

              {filteredResources.length === 0 && !loading && (
                <div className="flex flex-col items-center justify-center py-12">
                  <Package className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">No resources found</h3>
                  <p className="text-muted-foreground text-sm">Add resources to this event</p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {!selectedEvent && events.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No active events</h3>
            <p className="text-muted-foreground text-sm">Create an event booking first to manage resources</p>
          </CardContent>
        </Card>
      )}

      {/* Add Resource Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Resource</DialogTitle>
            <DialogDescription>Add a new resource to this event</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Resource Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Projector, Microphone, Catering..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Category</Label>
                <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="equipment">Equipment</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="catering">Catering</SelectItem>
                    <SelectItem value="decor">Decor</SelectItem>
                    <SelectItem value="av">A/V</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Additional details..."
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Quantity</Label>
                <Input
                  type="number"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Unit Price ($)</Label>
                <Input
                  type="number"
                  value={formData.unitPrice}
                  onChange={(e) => setFormData({ ...formData, unitPrice: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="text-right text-sm text-muted-foreground">
              Total: <span className="font-bold text-foreground">{formatCurrency(formData.quantity * formData.unitPrice)}</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Vendor Name</Label>
                <Input
                  value={formData.vendorName}
                  onChange={(e) => setFormData({ ...formData, vendorName: e.target.value })}
                  placeholder="External supplier"
                />
              </div>
              <div className="grid gap-2">
                <Label>Staff Name</Label>
                <Input
                  value={formData.staffName}
                  onChange={(e) => setFormData({ ...formData, staffName: e.target.value })}
                  placeholder="Assigned staff"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Setup Time</Label>
                <Input
                  type="datetime-local"
                  value={formData.setupTime}
                  onChange={(e) => setFormData({ ...formData, setupTime: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Teardown Time</Label>
                <Input
                  type="datetime-local"
                  value={formData.teardownTime}
                  onChange={(e) => setFormData({ ...formData, teardownTime: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Special instructions..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAddResource} disabled={saving || !formData.name}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Resource
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Resource Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Resource</DialogTitle>
            <DialogDescription>Update resource details</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Resource Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Category</Label>
                <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="equipment">Equipment</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="catering">Catering</SelectItem>
                    <SelectItem value="decor">Decor</SelectItem>
                    <SelectItem value="av">A/V</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="in_use">In Use</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Quantity</Label>
                <Input
                  type="number"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Unit Price ($)</Label>
                <Input
                  type="number"
                  value={formData.unitPrice}
                  onChange={(e) => setFormData({ ...formData, unitPrice: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="text-right text-sm text-muted-foreground">
              Total: <span className="font-bold text-foreground">{formatCurrency(formData.quantity * formData.unitPrice)}</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Vendor Name</Label>
                <Input
                  value={formData.vendorName}
                  onChange={(e) => setFormData({ ...formData, vendorName: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Staff Name</Label>
                <Input
                  value={formData.staffName}
                  onChange={(e) => setFormData({ ...formData, staffName: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Setup Time</Label>
                <Input
                  type="datetime-local"
                  value={formData.setupTime}
                  onChange={(e) => setFormData({ ...formData, setupTime: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Teardown Time</Label>
                <Input
                  type="datetime-local"
                  value={formData.teardownTime}
                  onChange={(e) => setFormData({ ...formData, teardownTime: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateResource} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Resource</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedResource?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteResource} className="bg-red-600 hover:bg-red-700">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
