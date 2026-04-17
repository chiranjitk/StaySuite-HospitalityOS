'use client';

import { useState, useEffect } from 'react';
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
  Users, 
  Square, 
  DollarSign,
  Building
} from 'lucide-react';
import { toast } from 'sonner';
import { useCurrency } from '@/contexts/CurrencyContext';

interface Property {
  id: string;
  name: string;
}

interface EventSpace {
  id: string;
  propertyId: string;
  name: string;
  description: string | null;
  minCapacity: number;
  maxCapacity: number;
  sizeSqMeters: number | null;
  sizeSqFeet: number | null;
  hourlyRate: number | null;
  dailyRate: number | null;
  amenities: string[];
  images: string[];
  status: string;
  property: {
    id: string;
    name: string;
  };
  _count?: {
    events: number;
  };
}

interface Stats {
  total: number;
  active: number;
  inactive: number;
  maintenance: number;
  totalEvents: number;
}

export default function EventSpaces() {
  const { formatCurrency } = useCurrency();
  const [spaces, setSpaces] = useState<EventSpace[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, inactive: 0, maintenance: 0, totalEvents: 0 });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [propertyFilter, setPropertyFilter] = useState('all');
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedSpace, setSelectedSpace] = useState<EventSpace | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    propertyId: '',
    name: '',
    description: '',
    minCapacity: 1,
    maxCapacity: 100,
    sizeSqMeters: null as number | null,
    sizeSqFeet: null as number | null,
    hourlyRate: null as number | null,
    dailyRate: null as number | null,
    amenities: [] as string[],
    status: 'active'
  });

  const [amenityInput, setAmenityInput] = useState('');

  useEffect(() => {
    fetchSpaces();
    fetchProperties();
  }, []);

  const fetchSpaces = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (propertyFilter !== 'all') params.append('propertyId', propertyFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);

      const response = await fetch(`/api/events/spaces?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch event spaces');
      
      const data = await response.json();
      setSpaces(data.spaces || []);
      setStats(data.stats || { total: 0, active: 0, inactive: 0, maintenance: 0, totalEvents: 0 });
    } catch (error) {
      console.error('Error fetching event spaces:', error);
      toast.error('Failed to load event spaces');
    } finally {
      setLoading(false);
    }
  };

  const fetchProperties = async () => {
    try {
      const response = await fetch('/api/properties');
      if (!response.ok) throw new Error('Failed to fetch properties');
      
      const data = await response.json();
      setProperties(data.properties || []);
    } catch (error) {
      console.error('Error fetching properties:', error);
    }
  };

  useEffect(() => {
    fetchSpaces();
  }, [statusFilter, propertyFilter]);

  const handleCreate = async () => {
    try {
      setSaving(true);
      const response = await fetch('/api/events/spaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create event space');
      }

      toast.success('Event space created successfully');
      setIsCreateOpen(false);
      resetForm();
      fetchSpaces();
    } catch (error: any) {
      console.error('Error creating event space:', error);
      toast.error(error.message || 'Failed to create event space');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedSpace) return;
    
    try {
      setSaving(true);
      const response = await fetch(`/api/events/spaces/${selectedSpace.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update event space');
      }

      toast.success('Event space updated successfully');
      setIsEditOpen(false);
      setSelectedSpace(null);
      resetForm();
      fetchSpaces();
    } catch (error: any) {
      console.error('Error updating event space:', error);
      toast.error(error.message || 'Failed to update event space');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedSpace) return;
    
    try {
      setSaving(true);
      const response = await fetch(`/api/events/spaces/${selectedSpace.id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete event space');
      }

      toast.success('Event space deleted successfully');
      setIsDeleteOpen(false);
      setSelectedSpace(null);
      fetchSpaces();
    } catch (error: any) {
      console.error('Error deleting event space:', error);
      toast.error(error.message || 'Failed to delete event space');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      propertyId: '',
      name: '',
      description: '',
      minCapacity: 1,
      maxCapacity: 100,
      sizeSqMeters: null,
      sizeSqFeet: null,
      hourlyRate: null,
      dailyRate: null,
      amenities: [],
      status: 'active'
    });
    setAmenityInput('');
  };

  const openEditDialog = (space: EventSpace) => {
    setSelectedSpace(space);
    setFormData({
      propertyId: space.propertyId,
      name: space.name,
      description: space.description || '',
      minCapacity: space.minCapacity,
      maxCapacity: space.maxCapacity,
      sizeSqMeters: space.sizeSqMeters,
      sizeSqFeet: space.sizeSqFeet,
      hourlyRate: space.hourlyRate,
      dailyRate: space.dailyRate,
      amenities: space.amenities || [],
      status: space.status
    });
    setIsEditOpen(true);
  };

  const addAmenity = () => {
    if (amenityInput.trim() && !formData.amenities.includes(amenityInput.trim())) {
      setFormData({ ...formData, amenities: [...formData.amenities, amenityInput.trim()] });
      setAmenityInput('');
    }
  };

  const removeAmenity = (amenity: string) => {
    setFormData({ ...formData, amenities: formData.amenities.filter(a => a !== amenity) });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      case 'maintenance': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredSpaces = spaces.filter(space =>
    space.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    space.property.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
          <h2 className="text-2xl font-bold tracking-tight">Event Spaces</h2>
          <p className="text-muted-foreground">Manage halls, meeting rooms, and event venues</p>
        </div>
        <Button onClick={() => { resetForm(); setIsCreateOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Add Space
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Spaces</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Inactive</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{stats.inactive}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Maintenance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.maintenance}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-teal-600">{stats.totalEvents}</div>
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
                placeholder="Search spaces..."
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
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Spaces Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredSpaces.map(space => (
          <Card key={space.id} className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-lg">{space.name}</CardTitle>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Building className="h-3 w-3 mr-1" />
                    {space.property.name}
                  </div>
                </div>
                <Badge className={getStatusColor(space.status)}>
                  {space.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {space.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">{space.description}</p>
              )}
              
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>{space.minCapacity} - {space.maxCapacity}</span>
                </div>
                {space.sizeSqMeters && (
                  <div className="flex items-center gap-2">
                    <Square className="h-4 w-4 text-muted-foreground" />
                    <span>{space.sizeSqMeters} m²</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-4 text-sm">
                {space.hourlyRate && (
                  <div className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3 text-muted-foreground" />
                    <span>{formatCurrency(space.hourlyRate)}/hr</span>
                  </div>
                )}
                {space.dailyRate && (
                  <div className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3 text-muted-foreground" />
                    <span>{formatCurrency(space.dailyRate)}/day</span>
                  </div>
                )}
              </div>

              {space.amenities.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {space.amenities.slice(0, 3).map((amenity, idx) => (
                    <Badge key={idx} variant="secondary" className="text-xs">
                      {amenity}
                    </Badge>
                  ))}
                  {space.amenities.length > 3 && (
                    <Badge variant="secondary" className="text-xs">
                      +{space.amenities.length - 3}
                    </Badge>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-xs text-muted-foreground">
                  {space._count?.events || 0} events
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditDialog(space)}
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setSelectedSpace(space); setIsDeleteOpen(true); }}
                    disabled={(space._count?.events || 0) > 0}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredSpaces.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No event spaces found</h3>
            <p className="text-muted-foreground text-sm">Get started by creating your first event space</p>
          </CardContent>
        </Card>
      )}

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Event Space</DialogTitle>
            <DialogDescription>Add a new hall, meeting room, or event venue</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="property">Property *</Label>
              <Select value={formData.propertyId} onValueChange={(v) => setFormData({ ...formData, propertyId: v })}>
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
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Grand Ballroom"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Elegant ballroom with crystal chandeliers..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="minCapacity">Min Capacity</Label>
                <Input
                  id="minCapacity"
                  type="number"
                  value={formData.minCapacity}
                  onChange={(e) => setFormData({ ...formData, minCapacity: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="maxCapacity">Max Capacity</Label>
                <Input
                  id="maxCapacity"
                  type="number"
                  value={formData.maxCapacity}
                  onChange={(e) => setFormData({ ...formData, maxCapacity: parseInt(e.target.value) || 100 })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="sizeSqMeters">Size (sq meters)</Label>
                <Input
                  id="sizeSqMeters"
                  type="number"
                  value={formData.sizeSqMeters ?? ''}
                  onChange={(e) => setFormData({ ...formData, sizeSqMeters: e.target.value ? parseFloat(e.target.value) : null })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="sizeSqFeet">Size (sq feet)</Label>
                <Input
                  id="sizeSqFeet"
                  type="number"
                  value={formData.sizeSqFeet ?? ''}
                  onChange={(e) => setFormData({ ...formData, sizeSqFeet: e.target.value ? parseFloat(e.target.value) : null })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="hourlyRate">Hourly Rate ($)</Label>
                <Input
                  id="hourlyRate"
                  type="number"
                  value={formData.hourlyRate ?? ''}
                  onChange={(e) => setFormData({ ...formData, hourlyRate: e.target.value ? parseFloat(e.target.value) : null })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="dailyRate">Daily Rate ($)</Label>
                <Input
                  id="dailyRate"
                  type="number"
                  value={formData.dailyRate ?? ''}
                  onChange={(e) => setFormData({ ...formData, dailyRate: e.target.value ? parseFloat(e.target.value) : null })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Amenities</Label>
              <div className="flex gap-2">
                <Input
                  value={amenityInput}
                  onChange={(e) => setAmenityInput(e.target.value)}
                  placeholder="Add amenity"
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addAmenity())}
                />
                <Button type="button" variant="outline" onClick={addAmenity}>Add</Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.amenities.map((amenity, idx) => (
                  <Badge key={idx} variant="secondary" className="cursor-pointer" onClick={() => removeAmenity(amenity)}>
                    {amenity} ×
                  </Badge>
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving || !formData.propertyId || !formData.name}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Space
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Event Space</DialogTitle>
            <DialogDescription>Update space details</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-property">Property *</Label>
              <Select value={formData.propertyId} onValueChange={(v) => setFormData({ ...formData, propertyId: v })}>
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
              <Label htmlFor="edit-name">Name *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Min Capacity</Label>
                <Input
                  type="number"
                  value={formData.minCapacity}
                  onChange={(e) => setFormData({ ...formData, minCapacity: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Max Capacity</Label>
                <Input
                  type="number"
                  value={formData.maxCapacity}
                  onChange={(e) => setFormData({ ...formData, maxCapacity: parseInt(e.target.value) || 100 })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Size (sq meters)</Label>
                <Input
                  type="number"
                  value={formData.sizeSqMeters ?? ''}
                  onChange={(e) => setFormData({ ...formData, sizeSqMeters: e.target.value ? parseFloat(e.target.value) : null })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Size (sq feet)</Label>
                <Input
                  type="number"
                  value={formData.sizeSqFeet ?? ''}
                  onChange={(e) => setFormData({ ...formData, sizeSqFeet: e.target.value ? parseFloat(e.target.value) : null })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Hourly Rate ($)</Label>
                <Input
                  type="number"
                  value={formData.hourlyRate ?? ''}
                  onChange={(e) => setFormData({ ...formData, hourlyRate: e.target.value ? parseFloat(e.target.value) : null })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Daily Rate ($)</Label>
                <Input
                  type="number"
                  value={formData.dailyRate ?? ''}
                  onChange={(e) => setFormData({ ...formData, dailyRate: e.target.value ? parseFloat(e.target.value) : null })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Amenities</Label>
              <div className="flex gap-2">
                <Input
                  value={amenityInput}
                  onChange={(e) => setAmenityInput(e.target.value)}
                  placeholder="Add amenity"
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addAmenity())}
                />
                <Button type="button" variant="outline" onClick={addAmenity}>Add</Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.amenities.map((amenity, idx) => (
                  <Badge key={idx} variant="secondary" className="cursor-pointer" onClick={() => removeAmenity(amenity)}>
                    {amenity} ×
                  </Badge>
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={saving || !formData.propertyId || !formData.name}>
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
            <AlertDialogTitle>Delete Event Space</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedSpace?.name}"? This action cannot be undone.
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
