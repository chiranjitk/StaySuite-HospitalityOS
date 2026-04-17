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
import { 
  Loader2, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Calendar,
  Users,
  DollarSign,
  Building,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Property {
  id: string;
  name: string;
}

interface EventSpace {
  id: string;
  name: string;
  propertyId: string;
  minCapacity: number;
  maxCapacity: number;
  hourlyRate: number | null;
  dailyRate: number | null;
}

interface Event {
  id: string;
  tenantId: string;
  propertyId: string;
  spaceId: string | null;
  name: string;
  type: string;
  description: string | null;
  organizerName: string;
  organizerEmail: string;
  organizerPhone: string;
  startDate: string;
  endDate: string;
  setupStart: string | null;
  teardownEnd: string | null;
  expectedAttendance: number;
  actualAttendance: number | null;
  spaceCharge: number;
  cateringCharge: number;
  avCharge: number;
  otherCharges: number;
  totalAmount: number;
  currency: string;
  depositAmount: number;
  depositPaid: boolean;
  status: string;
  contractUrl: string | null;
  contractSignedAt: string | null;
  notes: string | null;
  property: {
    id: string;
    name: string;
  };
  space: {
    id: string;
    name: string;
  } | null;
  _count?: {
    resources: number;
  };
}

interface Stats {
  total: number;
  inquiry: number;
  confirmed: number;
  in_progress: number;
  completed: number;
  cancelled: number;
  upcoming: number;
  totalRevenue: number;
}

export default function EventBooking() {
  const { formatCurrency } = useCurrency();
  const [events, setEvents] = useState<Event[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [spaces, setSpaces] = useState<EventSpace[]>([]);
  const [stats, setStats] = useState<Stats>({
    total: 0, inquiry: 0, confirmed: 0, in_progress: 0, completed: 0, cancelled: 0, upcoming: 0, totalRevenue: 0
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [propertyFilter, setPropertyFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    propertyId: '',
    spaceId: '',
    name: '',
    type: 'meeting',
    description: '',
    organizerName: '',
    organizerEmail: '',
    organizerPhone: '',
    startDate: '',
    startTime: '09:00',
    endDate: '',
    endTime: '17:00',
    expectedAttendance: 50,
    spaceCharge: 0,
    cateringCharge: 0,
    avCharge: 0,
    otherCharges: 0,
    depositAmount: 0,
    depositPaid: false,
    status: 'inquiry',
    notes: ''
  });

  useEffect(() => {
    fetchEvents();
    fetchProperties();
    fetchSpaces();
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [propertyFilter, statusFilter, typeFilter]);

  useEffect(() => {
    if (formData.propertyId) {
      const propertySpaces = spaces.filter(s => s.propertyId === formData.propertyId);
      if (formData.spaceId && !propertySpaces.find(s => s.id === formData.spaceId)) {
        setFormData(prev => ({ ...prev, spaceId: '' }));
      }
    }
  }, [formData.propertyId, spaces]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (propertyFilter !== 'all') params.append('propertyId', propertyFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (typeFilter !== 'all') params.append('type', typeFilter);

      const response = await fetch(`/api/events?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch events');
      
      const data = await response.json();
      setEvents(data.events || []);
      setStats(data.stats || {
        total: 0, inquiry: 0, confirmed: 0, in_progress: 0, completed: 0, cancelled: 0, upcoming: 0, totalRevenue: 0
      });
    } catch (error) {
      console.error('Error fetching events:', error);
      toast.error('Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  const fetchProperties = async () => {
    try {
      const response = await fetch('/api/properties');
      if (response.ok) {
        const data = await response.json();
        setProperties(data.properties || []);
        // Set default tenant ID from first property
        if (data.properties?.length > 0) {
          // Fetch tenant ID from a different endpoint or set a default
        }
      }
    } catch (error) {
      console.error('Error fetching properties:', error);
    }
  };

  const fetchSpaces = async () => {
    try {
      const response = await fetch('/api/events/spaces');
      if (response.ok) {
        const data = await response.json();
        setSpaces(data.spaces || []);
      }
    } catch (error) {
      console.error('Error fetching spaces:', error);
    }
  };

  const handleCreate = async () => {
    try {
      setSaving(true);
      
      // tenantId is derived from authenticated session on the backend
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: formData.propertyId,
          spaceId: formData.spaceId || null,
          name: formData.name,
          type: formData.type,
          description: formData.description || null,
          organizerName: formData.organizerName,
          organizerEmail: formData.organizerEmail,
          organizerPhone: formData.organizerPhone,
          startDate: `${formData.startDate}T${formData.startTime}:00`,
          endDate: `${formData.endDate}T${formData.endTime}:00`,
          expectedAttendance: formData.expectedAttendance,
          spaceCharge: formData.spaceCharge,
          cateringCharge: formData.cateringCharge,
          avCharge: formData.avCharge,
          otherCharges: formData.otherCharges,
          totalAmount: formData.spaceCharge + formData.cateringCharge + formData.avCharge + formData.otherCharges,
          depositAmount: formData.depositAmount,
          depositPaid: formData.depositPaid,
          status: formData.status,
          notes: formData.notes || null
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create event');
      }

      toast.success('Event created successfully');
      setIsCreateOpen(false);
      resetForm();
      fetchEvents();
    } catch (error: any) {
      console.error('Error creating event:', error);
      toast.error(error.message || 'Failed to create event');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedEvent) return;
    
    try {
      setSaving(true);
      const response = await fetch(`/api/events/${selectedEvent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: formData.propertyId,
          spaceId: formData.spaceId || null,
          name: formData.name,
          type: formData.type,
          description: formData.description || null,
          organizerName: formData.organizerName,
          organizerEmail: formData.organizerEmail,
          organizerPhone: formData.organizerPhone,
          startDate: `${formData.startDate}T${formData.startTime}:00`,
          endDate: `${formData.endDate}T${formData.endTime}:00`,
          expectedAttendance: formData.expectedAttendance,
          spaceCharge: formData.spaceCharge,
          cateringCharge: formData.cateringCharge,
          avCharge: formData.avCharge,
          otherCharges: formData.otherCharges,
          totalAmount: formData.spaceCharge + formData.cateringCharge + formData.avCharge + formData.otherCharges,
          depositAmount: formData.depositAmount,
          depositPaid: formData.depositPaid,
          status: formData.status,
          notes: formData.notes || null
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update event');
      }

      toast.success('Event updated successfully');
      setIsEditOpen(false);
      setSelectedEvent(null);
      resetForm();
      fetchEvents();
    } catch (error: any) {
      console.error('Error updating event:', error);
      toast.error(error.message || 'Failed to update event');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedEvent) return;
    
    try {
      setSaving(true);
      const response = await fetch(`/api/events/${selectedEvent.id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete event');
      }

      toast.success('Event deleted successfully');
      setIsDeleteOpen(false);
      setSelectedEvent(null);
      fetchEvents();
    } catch (error: any) {
      console.error('Error deleting event:', error);
      toast.error(error.message || 'Failed to delete event');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (event: Event, newStatus: string) => {
    try {
      const response = await fetch(`/api/events/${event.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) throw new Error('Failed to update status');

      toast.success(`Event status updated to ${newStatus}`);
      fetchEvents();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  };

  const resetForm = () => {
    setFormData({
      propertyId: '',
      spaceId: '',
      name: '',
      type: 'meeting',
      description: '',
      organizerName: '',
      organizerEmail: '',
      organizerPhone: '',
      startDate: '',
      startTime: '09:00',
      endDate: '',
      endTime: '17:00',
      expectedAttendance: 50,
      spaceCharge: 0,
      cateringCharge: 0,
      avCharge: 0,
      otherCharges: 0,
      depositAmount: 0,
      depositPaid: false,
      status: 'inquiry',
      notes: ''
    });
  };

  const openEditDialog = (event: Event) => {
    setSelectedEvent(event);
    const startDateTime = new Date(event.startDate);
    const endDateTime = new Date(event.endDate);
    
    setFormData({
      propertyId: event.propertyId,
      spaceId: event.spaceId || '',
      name: event.name,
      type: event.type,
      description: event.description || '',
      organizerName: event.organizerName,
      organizerEmail: event.organizerEmail,
      organizerPhone: event.organizerPhone,
      startDate: format(startDateTime, 'yyyy-MM-dd'),
      startTime: format(startDateTime, 'HH:mm'),
      endDate: format(endDateTime, 'yyyy-MM-dd'),
      endTime: format(endDateTime, 'HH:mm'),
      expectedAttendance: event.expectedAttendance,
      spaceCharge: event.spaceCharge,
      cateringCharge: event.cateringCharge,
      avCharge: event.avCharge,
      otherCharges: event.otherCharges,
      depositAmount: event.depositAmount,
      depositPaid: event.depositPaid,
      status: event.status,
      notes: event.notes || ''
    });
    setIsEditOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'inquiry': return 'bg-blue-100 text-blue-800';
      case 'confirmed': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredEvents = events.filter(event =>
    event.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    event.organizerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    event.property.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredSpaces = formData.propertyId 
    ? spaces.filter(s => s.propertyId === formData.propertyId)
    : [];

  const selectedSpace = formData.spaceId 
    ? spaces.find(s => s.id === formData.spaceId)
    : null;

  if (loading) {
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
          <h2 className="text-2xl font-bold tracking-tight">Event Bookings</h2>
          <p className="text-muted-foreground">Manage event inquiries and bookings</p>
        </div>
        <Button onClick={() => { resetForm(); setIsCreateOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          New Event
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-8">
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Total</div>
            <div className="text-xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Inquiry</div>
            <div className="text-xl font-bold text-blue-600">{stats.inquiry}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Confirmed</div>
            <div className="text-xl font-bold text-green-600">{stats.confirmed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">In Progress</div>
            <div className="text-xl font-bold text-yellow-600">{stats.in_progress}</div>
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
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Upcoming</div>
            <div className="text-xl font-bold text-teal-600">{stats.upcoming}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Revenue</div>
            <div className="text-lg font-bold text-green-600">{formatCurrency(stats.totalRevenue)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search events..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={propertyFilter} onValueChange={setPropertyFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="All Properties" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Properties</SelectItem>
                {properties.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="inquiry">Inquiry</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="conference">Conference</SelectItem>
                <SelectItem value="wedding">Wedding</SelectItem>
                <SelectItem value="meeting">Meeting</SelectItem>
                <SelectItem value="party">Party</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Events Table */}
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Property / Space</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Organizer</TableHead>
                <TableHead>Guests</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEvents.map(event => (
                <TableRow key={event.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{event.name}</div>
                      <div className="text-sm text-muted-foreground">{event.type}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{event.property.name}</div>
                      <div className="text-sm text-muted-foreground">{event.space?.name || 'No space'}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>{format(new Date(event.startDate), 'MMM d, yyyy')}</div>
                      <div className="text-muted-foreground">
                        {format(new Date(event.startDate), 'h:mm a')} - {format(new Date(event.endDate), 'h:mm a')}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{event.organizerName}</div>
                      <div className="text-sm text-muted-foreground">{event.organizerEmail}</div>
                    </div>
                  </TableCell>
                  <TableCell>{event.expectedAttendance}</TableCell>
                  <TableCell>
                    <div className="font-medium">{formatCurrency(event.totalAmount)}</div>
                    {event.depositAmount > 0 && (
                      <div className="text-sm text-muted-foreground">
                        Deposit: {formatCurrency(event.depositAmount)} {event.depositPaid ? '✓' : 'pending'}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(event.status)}>
                      {event.status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {event.status === 'inquiry' && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-green-600 hover:text-green-700"
                            onClick={() => handleStatusChange(event, 'confirmed')}
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => handleStatusChange(event, 'cancelled')}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => openEditDialog(event)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => { setSelectedEvent(event); setIsDeleteOpen(true); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {filteredEvents.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12">
              <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No events found</h3>
              <p className="text-muted-foreground text-sm">Create your first event booking to get started</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Event Booking</DialogTitle>
            <DialogDescription>Create a new event or inquiry</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Property *</Label>
                <Select value={formData.propertyId} onValueChange={(v) => setFormData({ ...formData, propertyId: v, spaceId: '' })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select property" />
                  </SelectTrigger>
                  <SelectContent>
                    {properties.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Event Space</Label>
                <Select value={formData.spaceId} onValueChange={(v) => setFormData({ ...formData, spaceId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select space" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No space</SelectItem>
                    {filteredSpaces.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} ({s.minCapacity}-{s.maxCapacity} guests)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Event Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Annual Conference 2024"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Event Type</Label>
                <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="conference">Conference</SelectItem>
                    <SelectItem value="wedding">Wedding</SelectItem>
                    <SelectItem value="meeting">Meeting</SelectItem>
                    <SelectItem value="party">Party</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Expected Guests</Label>
                <Input
                  type="number"
                  value={formData.expectedAttendance}
                  onChange={(e) => setFormData({ ...formData, expectedAttendance: parseInt(e.target.value) || 1 })}
                />
                {selectedSpace && (formData.expectedAttendance < selectedSpace.minCapacity || formData.expectedAttendance > selectedSpace.maxCapacity) && (
                  <p className="text-sm text-yellow-600">
                    Capacity: {selectedSpace.minCapacity} - {selectedSpace.maxCapacity}
                  </p>
                )}
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Event description..."
                rows={2}
              />
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Organizer Details</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label>Name *</Label>
                  <Input
                    value={formData.organizerName}
                    onChange={(e) => setFormData({ ...formData, organizerName: e.target.value })}
                    placeholder="John Doe"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={formData.organizerEmail}
                    onChange={(e) => setFormData({ ...formData, organizerEmail: e.target.value })}
                    placeholder="john@example.com"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Phone</Label>
                  <Input
                    value={formData.organizerPhone}
                    onChange={(e) => setFormData({ ...formData, organizerPhone: e.target.value })}
                    placeholder="+1 234 567 8900"
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Date & Time</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Start Date *</Label>
                  <Input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Start Time</Label>
                  <Input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>End Date *</Label>
                  <Input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>End Time</Label>
                  <Input
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Pricing</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Space Charge ($)</Label>
                  <Input
                    type="number"
                    value={formData.spaceCharge}
                    onChange={(e) => setFormData({ ...formData, spaceCharge: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Catering Charge ($)</Label>
                  <Input
                    type="number"
                    value={formData.cateringCharge}
                    onChange={(e) => setFormData({ ...formData, cateringCharge: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>A/V Charge ($)</Label>
                  <Input
                    type="number"
                    value={formData.avCharge}
                    onChange={(e) => setFormData({ ...formData, avCharge: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Other Charges ($)</Label>
                  <Input
                    type="number"
                    value={formData.otherCharges}
                    onChange={(e) => setFormData({ ...formData, otherCharges: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Deposit ($)</Label>
                  <Input
                    type="number"
                    value={formData.depositAmount}
                    onChange={(e) => setFormData({ ...formData, depositAmount: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Total Amount</Label>
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(formData.spaceCharge + formData.cateringCharge + formData.avCharge + formData.otherCharges)}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inquiry">Inquiry</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Special requests, notes..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving || !formData.propertyId || !formData.name || !formData.startDate || !formData.endDate || !formData.organizerName}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Event</DialogTitle>
            <DialogDescription>Update event details</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Property</Label>
                <Select value={formData.propertyId} onValueChange={(v) => setFormData({ ...formData, propertyId: v, spaceId: '' })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {properties.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Event Space</Label>
                <Select value={formData.spaceId} onValueChange={(v) => setFormData({ ...formData, spaceId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select space" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No space</SelectItem>
                    {filteredSpaces.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Event Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Event Type</Label>
                <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="conference">Conference</SelectItem>
                    <SelectItem value="wedding">Wedding</SelectItem>
                    <SelectItem value="meeting">Meeting</SelectItem>
                    <SelectItem value="party">Party</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Expected Guests</Label>
                <Input
                  type="number"
                  value={formData.expectedAttendance}
                  onChange={(e) => setFormData({ ...formData, expectedAttendance: parseInt(e.target.value) || 1 })}
                />
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

            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Organizer Details</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label>Name</Label>
                  <Input
                    value={formData.organizerName}
                    onChange={(e) => setFormData({ ...formData, organizerName: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={formData.organizerEmail}
                    onChange={(e) => setFormData({ ...formData, organizerEmail: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Phone</Label>
                  <Input
                    value={formData.organizerPhone}
                    onChange={(e) => setFormData({ ...formData, organizerPhone: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Date & Time</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Start Time</Label>
                  <Input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>End Time</Label>
                  <Input
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Pricing</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Space Charge ($)</Label>
                  <Input
                    type="number"
                    value={formData.spaceCharge}
                    onChange={(e) => setFormData({ ...formData, spaceCharge: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Catering Charge ($)</Label>
                  <Input
                    type="number"
                    value={formData.cateringCharge}
                    onChange={(e) => setFormData({ ...formData, cateringCharge: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>A/V Charge ($)</Label>
                  <Input
                    type="number"
                    value={formData.avCharge}
                    onChange={(e) => setFormData({ ...formData, avCharge: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Other Charges ($)</Label>
                  <Input
                    type="number"
                    value={formData.otherCharges}
                    onChange={(e) => setFormData({ ...formData, otherCharges: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Deposit ($)</Label>
                  <Input
                    type="number"
                    value={formData.depositAmount}
                    onChange={(e) => setFormData({ ...formData, depositAmount: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Total</Label>
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(formData.spaceCharge + formData.cateringCharge + formData.avCharge + formData.otherCharges)}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inquiry">Inquiry</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
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
            <Button onClick={handleEdit} disabled={saving}>
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
            <AlertDialogTitle>Delete Event</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedEvent?.name}"? This will also remove all associated resources. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
