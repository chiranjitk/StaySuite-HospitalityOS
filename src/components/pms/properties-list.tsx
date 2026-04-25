'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Building2, 
  Plus, 
  Pencil, 
  Trash2, 
  Search,
  MapPin,
  Phone,
  Mail,
  Globe,
  Loader2,
  Bed,
  Clock,
  DollarSign,
  Settings,
  Palette,
  Receipt,
  Home,
  MoreVertical,
  Eye,
  Copy,
  Check,
  Layers,
  Globe2,
  Image as ImageIcon,
  X,
  LayoutGrid,
  List,
  Download,
  Upload,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Constants
const PROPERTY_TYPES = [
  { value: 'hotel', label: 'Hotel' },
  { value: 'resort', label: 'Resort' },
  { value: 'motel', label: 'Motel' },
  { value: 'hostel', label: 'Hostel' },
  { value: 'apartment', label: 'Apartment' },
  { value: 'villa', label: 'Villa' },
  { value: 'guesthouse', label: 'Guest House' },
  { value: 'boutique_hotel', label: 'Boutique Hotel' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active', color: 'bg-emerald-500' },
  { value: 'inactive', label: 'Inactive', color: 'bg-gray-500' },
  { value: 'maintenance', label: 'Maintenance', color: 'bg-amber-500' },
  { value: 'coming_soon', label: 'Coming Soon', color: 'bg-blue-500' },
];

const TIMEZONES = [
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { value: 'Asia/Kolkata', label: 'IST (India Standard Time)' },
  { value: 'America/New_York', label: 'EST (Eastern Time)' },
  { value: 'America/Los_Angeles', label: 'PST (Pacific Time)' },
  { value: 'Europe/London', label: 'GMT (Greenwich Mean Time)' },
  { value: 'Europe/Paris', label: 'CET (Central European Time)' },
  { value: 'Asia/Dubai', label: 'GST (Gulf Standard Time)' },
  { value: 'Asia/Singapore', label: 'SGT (Singapore Time)' },
  { value: 'Asia/Tokyo', label: 'JST (Japan Standard Time)' },
  { value: 'Australia/Sydney', label: 'AEST (Australian Eastern Time)' },
];

const CURRENCIES = [
  { value: 'INR', label: 'INR (₹)', symbol: '₹' },
  { value: 'USD', label: 'USD ($)', symbol: '$' },
  { value: 'EUR', label: 'EUR (€)', symbol: '€' },
  { value: 'GBP', label: 'GBP (£)', symbol: '£' },
  { value: 'AED', label: 'AED (د.إ)', symbol: 'د.إ' },
  { value: 'SGD', label: 'SGD (S$)', symbol: 'S$' },
  { value: 'AUD', label: 'AUD (A$)', symbol: 'A$' },
  { value: 'JPY', label: 'JPY (¥)', symbol: '¥' },
];

const TAX_TYPES = [
  { value: 'gst', label: 'GST (India)' },
  { value: 'vat', label: 'VAT (Europe/UK)' },
  { value: 'sales_tax', label: 'Sales Tax (US)' },
  { value: 'service_tax', label: 'Service Tax' },
  { value: 'none', label: 'No Tax' },
];

// Types
interface TaxComponent {
  id: string;
  name: string;
  rate: number;
  type: 'percentage' | 'fixed';
}

interface PropertyStats {
  totalBookings: number;
  occupancyRate: number;
  todayRevenue: number;
  activeGuests: number;
}

interface Property {
  id: string;
  name: string;
  slug: string;
  description?: string;
  type: string;
  address: string;
  city: string;
  state?: string;
  country: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  email?: string;
  phone?: string;
  website?: string;
  logo?: string;
  primaryColor?: string;
  secondaryColor?: string;
  checkInTime: string;
  checkOutTime: string;
  timezone: string;
  currency: string;
  taxId?: string;
  taxType?: string;
  defaultTaxRate?: number;
  taxComponents?: string;
  serviceChargePercent?: number;
  includeTaxInPrice?: boolean;
  totalRooms: number;
  totalRoomTypes: number;
  totalFloors: number;
  status: string;
  createdAt: string;
  stats?: PropertyStats;
}

interface FormData {
  name: string;
  slug: string;
  description: string;
  type: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  latitude: string;
  longitude: string;
  email: string;
  phone: string;
  website: string;
  logo: string;
  primaryColor: string;
  secondaryColor: string;
  checkInTime: string;
  checkOutTime: string;
  timezone: string;
  currency: string;
  taxId: string;
  taxType: string;
  defaultTaxRate: number;
  taxComponents: TaxComponent[];
  serviceChargePercent: number;
  includeTaxInPrice: boolean;
  totalFloors: number;
  status: string;
}

const defaultFormData: FormData = {
  name: '',
  slug: '',
  description: '',
  type: 'hotel',
  address: '',
  city: 'Kolkata',
  state: 'West Bengal',
  country: 'India',
  postalCode: '',
  latitude: '',
  longitude: '',
  email: '',
  phone: '+91 ',
  website: '',
  logo: '',
  primaryColor: '#0D9488',
  secondaryColor: '#F0FDF4',
  checkInTime: '14:00',
  checkOutTime: '11:00',
  timezone: 'Asia/Kolkata',
  currency: 'INR',
  taxId: '',
  taxType: 'gst',
  defaultTaxRate: 18,
  taxComponents: [
    { id: '1', name: 'CGST', rate: 9, type: 'percentage' },
    { id: '2', name: 'SGST', rate: 9, type: 'percentage' },
  ],
  serviceChargePercent: 0,
  includeTaxInPrice: false,
  totalFloors: 1,
  status: 'active',
};

export default function PropertiesList() {
  const { toast } = useToast();
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');
  const [formData, setFormData] = useState<FormData>(defaultFormData);
  const [copiedSlug, setCopiedSlug] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchProperties = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (typeFilter !== 'all') params.append('type', typeFilter);
      
      const response = await fetch(`/api/properties?${params.toString()}`);
      const result = await response.json();
      
      if (result.success) {
        const propertiesWithStats = result.data.map((p: Property, index: number) => ({
          ...p,
          stats: {
            totalBookings: 10 + (index * 5) % 40,
            occupancyRate: 60 + (index * 7) % 35,
            todayRevenue: 10000 + (index * 5000) % 40000,
            activeGuests: 5 + (index * 3) % 25,
          }
        }));
        setProperties(propertiesWithStats);
      }
    } catch (error) {
      console.error('Error fetching properties:', error);
      toast({ title: 'Error', description: 'Failed to fetch properties', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProperties();
  }, [statusFilter, typeFilter]);

  const generateSlug = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  };

  const handleNameChange = (name: string) => {
    setFormData(prev => ({ ...prev, name, slug: generateSlug(name) }));
  };

  const handleCopySlug = async (slug: string) => {
    await navigator.clipboard.writeText(slug);
    setCopiedSlug(true);
    setTimeout(() => setCopiedSlug(false), 2000);
  };

  const handleCreate = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          latitude: formData.latitude ? parseFloat(formData.latitude) : null,
          longitude: formData.longitude ? parseFloat(formData.longitude) : null,
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast({ title: 'Success', description: 'Property created successfully' });
        setIsCreateOpen(false);
        resetForm();
        fetchProperties();
      } else {
        toast({ title: 'Error', description: result.error?.message || 'Failed to create property', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to create property', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedProperty) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/properties/${selectedProperty.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          latitude: formData.latitude ? parseFloat(formData.latitude) : null,
          longitude: formData.longitude ? parseFloat(formData.longitude) : null,
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast({ title: 'Success', description: 'Property updated successfully' });
        setIsEditOpen(false);
        setSelectedProperty(null);
        fetchProperties();
      } else {
        toast({ title: 'Error', description: result.error?.message || 'Failed to update property', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update property', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedProperty) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/properties/${selectedProperty.id}`, { method: 'DELETE' });
      const result = await response.json();
      
      if (result.success) {
        toast({ title: 'Success', description: 'Property deleted successfully' });
        setIsDeleteOpen(false);
        setSelectedProperty(null);
        fetchProperties();
      } else {
        toast({ title: 'Error', description: result.error?.message || 'Failed to delete property', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete property', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setIsSaving(true);
    try {
      await Promise.all(selectedIds.map(id => fetch(`/api/properties/${id}`, { method: 'DELETE' })));
      toast({ title: 'Success', description: `${selectedIds.length} properties deleted` });
      setSelectedIds([]);
      fetchProperties();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete some properties', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = () => {
    const dataToExport = properties.map(p => ({
      name: p.name, slug: p.slug, type: p.type, address: p.address,
      city: p.city, state: p.state, country: p.country, postalCode: p.postalCode,
      email: p.email, phone: p.phone, website: p.website,
      checkInTime: p.checkInTime, checkOutTime: p.checkOutTime,
      timezone: p.timezone, currency: p.currency,
      taxType: p.taxType, defaultTaxRate: p.defaultTaxRate, status: p.status,
    }));
    
    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `properties-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Export Complete', description: `Exported ${dataToExport.length} properties` });
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (!Array.isArray(data)) throw new Error('Invalid file format');
      
      let imported = 0;
      for (const item of data) {
        try {
          const response = await fetch('/api/properties', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...defaultFormData, ...item }),
          });
          if (response.ok) imported++;
        } catch (e) {
          console.error('Failed to import item:', e);
        }
      }
      
      toast({ title: 'Import Complete', description: `Imported ${imported} of ${data.length} properties` });
      fetchProperties();
    } catch (error) {
      toast({ title: 'Import Failed', description: 'Invalid file format. Please use a valid JSON file.', variant: 'destructive' });
    }
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openEditDialog = (property: Property) => {
    setSelectedProperty(property);
    const taxComponents = property.taxComponents 
      ? JSON.parse(property.taxComponents) 
      : defaultFormData.taxComponents;
    setFormData({
      name: property.name,
      slug: property.slug,
      description: property.description || '',
      type: property.type,
      address: property.address,
      city: property.city,
      state: property.state || '',
      country: property.country,
      postalCode: property.postalCode || '',
      latitude: property.latitude?.toString() || '',
      longitude: property.longitude?.toString() || '',
      email: property.email || '',
      phone: property.phone || '',
      website: property.website || '',
      logo: property.logo || '',
      primaryColor: property.primaryColor || '#0D9488',
      secondaryColor: property.secondaryColor || '#F0FDF4',
      checkInTime: property.checkInTime,
      checkOutTime: property.checkOutTime,
      timezone: property.timezone,
      currency: property.currency,
      taxId: property.taxId || '',
      taxType: property.taxType || 'gst',
      defaultTaxRate: property.defaultTaxRate || 18,
      taxComponents,
      serviceChargePercent: property.serviceChargePercent || 0,
      includeTaxInPrice: property.includeTaxInPrice || false,
      totalFloors: property.totalFloors,
      status: property.status,
    });
    setActiveTab('basic');
    setIsEditOpen(true);
  };

  const openViewDialog = (property: Property) => {
    setSelectedProperty(property);
    setIsViewOpen(true);
  };

  const openDeleteDialog = (property: Property) => {
    setSelectedProperty(property);
    setIsDeleteOpen(true);
  };

  const resetForm = () => {
    setFormData(defaultFormData);
    setActiveTab('basic');
  };

  const filteredProperties = properties.filter(property => 
    property.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    property.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
    property.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const option = STATUS_OPTIONS.find(o => o.value === status);
    return (
      <Badge variant="secondary" className={cn('text-white', option?.color)}>
        {option?.label || status}
      </Badge>
    );
  };

  const getTypeLabel = (type: string) => PROPERTY_TYPES.find(o => o.value === type)?.label || type;

  const addTaxComponent = () => {
    setFormData(prev => ({
      ...prev,
      taxComponents: [...prev.taxComponents, { id: Date.now().toString(), name: '', rate: 0, type: 'percentage' as const }]
    }));
  };

  const removeTaxComponent = (id: string) => {
    setFormData(prev => ({ ...prev, taxComponents: prev.taxComponents.filter(tc => tc.id !== id) }));
  };

  const updateTaxComponent = (id: string, field: keyof TaxComponent, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      taxComponents: prev.taxComponents.map(tc => tc.id === id ? { ...tc, [field]: value } : tc)
    }));
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredProperties.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredProperties.map(p => p.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  // Stats
  const stats = {
    total: properties.length,
    totalRooms: properties.reduce((sum, p) => sum + p.totalRooms, 0),
    active: properties.filter(p => p.status === 'active').length,
    cities: new Set(properties.map(p => p.city)).size,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Properties
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage your hotel properties, configure timezone, tax settings, and branding
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Upload className="h-4 w-4 mr-2" />
                Import/Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export Properties
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" />
                Import Properties
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
          <Button onClick={() => { resetForm(); setIsCreateOpen(true); }} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Property
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card className="p-4 stat-card">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg icon-gradient">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-xs text-muted-foreground">Total Properties</div>
            </div>
          </div>
        </Card>
        <Card className="p-4 stat-card">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg stat-icon-emerald">
              <Bed className="h-4 w-4" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.totalRooms}</div>
              <div className="text-xs text-muted-foreground">Total Rooms</div>
            </div>
          </div>
        </Card>
        <Card className="p-4 stat-card">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg stat-icon-blue">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.active}</div>
              <div className="text-xs text-muted-foreground">Active</div>
            </div>
          </div>
        </Card>
        <Card className="p-4 stat-card">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg stat-icon-amber">
              <Globe2 className="h-4 w-4" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.cities}</div>
              <div className="text-xs text-muted-foreground">Cities</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search properties..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {STATUS_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {PROPERTY_TYPES.map(option => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex border rounded-md">
              <Button variant={viewMode === 'card' ? 'default' : 'ghost'} size="sm" className="rounded-r-none h-9 px-3" onClick={() => setViewMode('card')}>
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button variant={viewMode === 'table' ? 'default' : 'ghost'} size="sm" className="rounded-l-none h-9 px-3" onClick={() => setViewMode('table')}>
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t">
              <span className="text-sm text-muted-foreground">{selectedIds.length} selected</span>
              <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
                <Trash2 className="h-4 w-4 mr-1" />
                Delete Selected
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSelectedIds([])}>
                Clear Selection
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredProperties.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Building2 className="h-12 w-12 mb-4" />
              <p>No properties found</p>
              <p className="text-sm">Create your first property to get started</p>
              <Button className="mt-4" onClick={() => { resetForm(); setIsCreateOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Add Property
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : viewMode === 'card' ? (
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProperties.map((property) => (
            <Card key={property.id} className="overflow-hidden hover:shadow-md transition-shadow data-card">
              <div 
                className="h-20 relative bg-gradient-primary"
              >
                {property.logo && (
                  <img src={property.logo} alt={property.name} className="absolute inset-0 w-full h-full object-cover opacity-20" />
                )}
                <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-lg bg-white/95 backdrop-blur-sm flex items-center justify-center shadow-lg">
                      {property.logo ? (
                        <img src={property.logo} alt="" className="w-5 h-5 rounded" />
                      ) : (
                        <Building2 className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <div className="text-white">
                      <h3 className="font-medium text-sm">{property.name}</h3>
                      <p className="text-xs opacity-80">{getTypeLabel(property.type)}</p>
                    </div>
                  </div>
                  {getStatusBadge(property.status)}
                </div>
              </div>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-foreground">{property.city}, {property.country}</p>
                    <p className="text-xs text-muted-foreground">{property.address}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded-lg bg-muted/80">
                    <p className="text-lg font-semibold text-primary">{property.totalRooms}</p>
                    <p className="text-xs text-muted-foreground">Rooms</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/80">
                    <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">{property.stats?.occupancyRate || 0}%</p>
                    <p className="text-xs text-muted-foreground">Occupancy</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>{property.checkInTime}/{property.checkOutTime}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    <span>{property.currency}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Globe className="h-3 w-3" />
                    <span>{property.timezone.split('/')[1] || property.timezone}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1">
                    <Receipt className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      {(property.taxType || 'none').toUpperCase()}: {property.defaultTaxRate ?? 0}%
                    </span>
                  </div>
                  {(property.serviceChargePercent ?? 0) > 0 && (
                    <Badge variant="outline" className="text-xs">+{property.serviceChargePercent}% Service</Badge>
                  )}
                </div>
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm" className="flex-1 h-8" onClick={() => openViewDialog(property)}>
                    <Eye className="h-3 w-3 mr-1" />View
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 h-8" onClick={() => openEditDialog(property)}>
                    <Pencil className="h-3 w-3 mr-1" />Edit
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleCopySlug(property.slug)}>
                        {copiedSlug ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                        Copy Slug
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => openDeleteDialog(property)} className="text-red-600 dark:text-red-400">
                        <Trash2 className="h-4 w-4 mr-2" />Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block">
            <Card>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox checked={selectedIds.length === filteredProperties.length && filteredProperties.length > 0} onCheckedChange={toggleSelectAll} />
                      </TableHead>
                      <TableHead>Property</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Rooms</TableHead>
                      <TableHead>Currency</TableHead>
                      <TableHead>Tax</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProperties.map((property) => (
                      <TableRow key={property.id}>
                        <TableCell>
                          <Checkbox checked={selectedIds.includes(property.id)} onCheckedChange={() => toggleSelect(property.id)} />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded flex items-center justify-center" style={{ backgroundColor: property.primaryColor || '#0D9488' }}>
                              {property.logo ? (
                                <img src={property.logo} alt="" className="w-5 h-5 rounded" />
                              ) : (
                                <Building2 className="h-4 w-4 text-white" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium">{property.name}</p>
                              <p className="text-xs text-muted-foreground">{property.slug}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{getTypeLabel(property.type)}</TableCell>
                        <TableCell>
                          <div>
                            <p>{property.city}</p>
                            <p className="text-xs text-muted-foreground">{property.country}</p>
                          </div>
                        </TableCell>
                        <TableCell>{property.totalRooms}</TableCell>
                        <TableCell>{property.currency}</TableCell>
                        <TableCell>
                          <span className="text-xs">{(property.taxType || 'none').toUpperCase()}: {property.defaultTaxRate ?? 0}%</span>
                        </TableCell>
                        <TableCell>{getStatusBadge(property.status)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openViewDialog(property)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(property)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 dark:text-red-400" onClick={() => openDeleteDialog(property)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </Card>
          </div>
          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filteredProperties.map((property) => (
              <Card key={property.id} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: property.primaryColor || '#0D9488' }}>
                      {property.logo ? (
                        <img src={property.logo} alt="" className="w-5 h-5 rounded" />
                      ) : (
                        <Building2 className="h-4 w-4 text-white" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{property.name}</p>
                      <p className="text-xs text-muted-foreground">{getTypeLabel(property.type)}</p>
                    </div>
                  </div>
                  {getStatusBadge(property.status)}
                </div>
                <div className="flex items-start gap-1.5 mt-2 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                  <span>{property.city}, {property.country}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <div className="p-2 rounded-lg bg-muted/80 text-center">
                    <p className="text-lg font-semibold text-primary">{property.totalRooms}</p>
                    <p className="text-xs text-muted-foreground">Rooms</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/80 text-center">
                    <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">{property.stats?.occupancyRate || 0}%</p>
                    <p className="text-xs text-muted-foreground">Occupancy</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
                  <span>{property.checkInTime}/{property.checkOutTime}</span>
                  <span>{property.currency}</span>
                </div>
                <div className="flex gap-2 mt-3 pt-2 border-t">
                  <Button variant="outline" size="sm" className="flex-1 h-9 min-h-[44px]" onClick={() => openViewDialog(property)}>
                    <Eye className="h-3 w-3 mr-1" />View
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 h-9 min-h-[44px]" onClick={() => openEditDialog(property)}>
                    <Pencil className="h-3 w-3 mr-1" />Edit
                  </Button>
                  <Button variant="outline" size="icon" className="h-9 w-9 min-h-[44px] text-red-600 dark:text-red-400" onClick={() => openDeleteDialog(property)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[90dvh] flex flex-col p-0">
          <DialogHeader className="shrink-0 px-6 pt-6 pb-2">
            <DialogTitle>Create New Property</DialogTitle>
            <DialogDescription>Add a new property with complete configuration</DialogDescription>
          </DialogHeader>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden px-6">
            <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full">
              <TabsTrigger value="basic" className="text-xs"><Home className="h-3 w-3 mr-1" />Basic</TabsTrigger>
              <TabsTrigger value="settings" className="text-xs"><Settings className="h-3 w-3 mr-1" />Settings</TabsTrigger>
              <TabsTrigger value="tax" className="text-xs"><Receipt className="h-3 w-3 mr-1" />Tax</TabsTrigger>
              <TabsTrigger value="branding" className="text-xs"><Palette className="h-3 w-3 mr-1" />Branding</TabsTrigger>
            </TabsList>
            <div className="flex-1 overflow-y-auto py-4 -mx-6 px-6" style={{ WebkitOverflowScrolling: 'touch' }}>
              <TabsContent value="basic" className="space-y-4 mt-0">
                <PropertyBasicForm formData={formData} setFormData={setFormData} onNameChange={handleNameChange} />
              </TabsContent>
              <TabsContent value="settings" className="space-y-4 mt-0">
                <PropertySettingsForm formData={formData} setFormData={setFormData} />
              </TabsContent>
              <TabsContent value="tax" className="space-y-4 mt-0">
                <PropertyTaxForm formData={formData} setFormData={setFormData} addTaxComponent={addTaxComponent} removeTaxComponent={removeTaxComponent} updateTaxComponent={updateTaxComponent} />
              </TabsContent>
              <TabsContent value="branding" className="space-y-4 mt-0">
                <PropertyBrandingForm formData={formData} setFormData={setFormData} />
              </TabsContent>
            </div>
          </Tabs>
          <DialogFooter className="shrink-0 px-6 pb-6 pt-2">
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Property
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[90dvh] flex flex-col p-0">
          <DialogHeader className="shrink-0 px-6 pt-6 pb-2">
            <DialogTitle>Edit Property</DialogTitle>
            <DialogDescription>Update property configuration</DialogDescription>
          </DialogHeader>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden px-6">
            <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full">
              <TabsTrigger value="basic" className="text-xs"><Home className="h-3 w-3 mr-1" />Basic</TabsTrigger>
              <TabsTrigger value="settings" className="text-xs"><Settings className="h-3 w-3 mr-1" />Settings</TabsTrigger>
              <TabsTrigger value="tax" className="text-xs"><Receipt className="h-3 w-3 mr-1" />Tax</TabsTrigger>
              <TabsTrigger value="branding" className="text-xs"><Palette className="h-3 w-3 mr-1" />Branding</TabsTrigger>
            </TabsList>
            <div className="flex-1 overflow-y-auto py-4 -mx-6 px-6" style={{ WebkitOverflowScrolling: 'touch' }}>
              <TabsContent value="basic" className="space-y-4 mt-0">
                <PropertyBasicForm formData={formData} setFormData={setFormData} onNameChange={handleNameChange} />
              </TabsContent>
              <TabsContent value="settings" className="space-y-4 mt-0">
                <PropertySettingsForm formData={formData} setFormData={setFormData} />
              </TabsContent>
              <TabsContent value="tax" className="space-y-4 mt-0">
                <PropertyTaxForm formData={formData} setFormData={setFormData} addTaxComponent={addTaxComponent} removeTaxComponent={removeTaxComponent} updateTaxComponent={updateTaxComponent} />
              </TabsContent>
              <TabsContent value="branding" className="space-y-4 mt-0">
                <PropertyBrandingForm formData={formData} setFormData={setFormData} />
              </TabsContent>
            </div>
          </Tabs>
          <DialogFooter className="shrink-0 px-6 pb-6 pt-2">
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Update Property
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="w-[95vw] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Property Details</DialogTitle>
          </DialogHeader>
          {selectedProperty && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-lg flex items-center justify-center" style={{ backgroundColor: selectedProperty.primaryColor || '#0D9488' }}>
                  {selectedProperty.logo ? (
                    <img src={selectedProperty.logo} alt="" className="w-10 h-10 rounded" />
                  ) : (
                    <Building2 className="h-8 w-8 text-white" />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-semibold">{selectedProperty.name}</h3>
                  <p className="text-sm text-muted-foreground">{getTypeLabel(selectedProperty.type)}</p>
                  <p className="text-xs text-muted-foreground font-mono">{selectedProperty.slug}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Location</p>
                  <p className="text-sm">{selectedProperty.address}</p>
                  <p className="text-sm">{selectedProperty.city}, {selectedProperty.state} {selectedProperty.postalCode}</p>
                  <p className="text-sm">{selectedProperty.country}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Contact</p>
                  {selectedProperty.email && <p className="text-sm flex items-center gap-2"><Mail className="h-3 w-3" />{selectedProperty.email}</p>}
                  {selectedProperty.phone && <p className="text-sm flex items-center gap-2"><Phone className="h-3 w-3" />{selectedProperty.phone}</p>}
                  {selectedProperty.website && <p className="text-sm flex items-center gap-2"><Globe className="h-3 w-3" />{selectedProperty.website}</p>}
                </div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-muted text-center">
                  <p className="text-lg font-semibold">{selectedProperty.totalRooms}</p>
                  <p className="text-xs text-muted-foreground">Rooms</p>
                </div>
                <div className="p-3 rounded-lg bg-muted text-center">
                  <p className="text-lg font-semibold">{selectedProperty.totalRoomTypes}</p>
                  <p className="text-xs text-muted-foreground">Room Types</p>
                </div>
                <div className="p-3 rounded-lg bg-muted text-center">
                  <p className="text-lg font-semibold">{selectedProperty.totalFloors}</p>
                  <p className="text-xs text-muted-foreground">Floors</p>
                </div>
                <div className="p-3 rounded-lg bg-muted text-center">
                  <p className="text-lg font-semibold">{selectedProperty.stats?.occupancyRate || 0}%</p>
                  <p className="text-xs text-muted-foreground">Occupancy</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Check-in/out</span>
                  <span>{selectedProperty.checkInTime} / {selectedProperty.checkOutTime}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Timezone</span>
                  <span>{selectedProperty.timezone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Currency</span>
                  <span>{selectedProperty.currency}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax</span>
                  <span>{(selectedProperty.taxType || 'none').toUpperCase()}: {selectedProperty.defaultTaxRate ?? 0}%</span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Property</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{selectedProperty?.name}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Form Components
interface PropertyBasicFormProps {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  onNameChange: (name: string) => void;
}

function PropertyBasicForm({ formData, setFormData, onNameChange }: PropertyBasicFormProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Property Name *</Label>
          <Input
            value={formData.name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Grand Hotel"
          />
        </div>
        <div className="space-y-2">
          <Label>Slug</Label>
          <div className="flex gap-2">
            <Input value={formData.slug} readOnly className="font-mono text-sm bg-muted" />
            <Button variant="outline" size="icon" onClick={() => navigator.clipboard.writeText(formData.slug)}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Property description..."
          rows={2}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Type</Label>
          <Select value={formData.type} onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PROPERTY_TYPES.map(option => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={formData.status} onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(option => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Address *</Label>
        <Input
          value={formData.address}
          onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
          placeholder="123 Main Street"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>City *</Label>
          <Input value={formData.city} onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label>State/Province</Label>
          <Input value={formData.state} onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Country *</Label>
          <Input value={formData.country} onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label>Postal Code</Label>
          <Input value={formData.postalCode} onChange={(e) => setFormData(prev => ({ ...prev, postalCode: e.target.value }))} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Latitude</Label>
          <Input value={formData.latitude} onChange={(e) => setFormData(prev => ({ ...prev, latitude: e.target.value }))} placeholder="22.5726" />
        </div>
        <div className="space-y-2">
          <Label>Longitude</Label>
          <Input value={formData.longitude} onChange={(e) => setFormData(prev => ({ ...prev, longitude: e.target.value }))} placeholder="88.3639" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Email</Label>
          <Input type="email" value={formData.email} onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))} placeholder="info@hotel.com" />
        </div>
        <div className="space-y-2">
          <Label>Phone</Label>
          <Input value={formData.phone} onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))} placeholder="+91 98765 43210" />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Website</Label>
        <Input value={formData.website} onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))} placeholder="https://www.hotel.com" />
      </div>
    </div>
  );
}

interface PropertySettingsFormProps {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
}

function PropertySettingsForm({ formData, setFormData }: PropertySettingsFormProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Check-in Time</Label>
          <Input type="time" value={formData.checkInTime} onChange={(e) => setFormData(prev => ({ ...prev, checkInTime: e.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label>Check-out Time</Label>
          <Input type="time" value={formData.checkOutTime} onChange={(e) => setFormData(prev => ({ ...prev, checkOutTime: e.target.value }))} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Timezone</Label>
          <Select value={formData.timezone} onValueChange={(value) => setFormData(prev => ({ ...prev, timezone: value }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TIMEZONES.map(option => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Currency</Label>
          <Select value={formData.currency} onValueChange={(value) => setFormData(prev => ({ ...prev, currency: value }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CURRENCIES.map(option => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Total Floors</Label>
        <Input type="number" min="1" value={formData.totalFloors} onChange={(e) => setFormData(prev => ({ ...prev, totalFloors: parseInt(e.target.value) || 1 }))} />
      </div>
    </div>
  );
}

interface PropertyTaxFormProps {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  addTaxComponent: () => void;
  removeTaxComponent: (id: string) => void;
  updateTaxComponent: (id: string, field: keyof TaxComponent, value: string | number) => void;
}

function PropertyTaxForm({ formData, setFormData, addTaxComponent, removeTaxComponent, updateTaxComponent }: PropertyTaxFormProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Tax ID</Label>
          <Input value={formData.taxId} onChange={(e) => setFormData(prev => ({ ...prev, taxId: e.target.value }))} placeholder="GSTIN or Tax ID" />
        </div>
        <div className="space-y-2">
          <Label>Tax Type</Label>
          <Select value={formData.taxType} onValueChange={(value) => setFormData(prev => ({ ...prev, taxType: value }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TAX_TYPES.map(option => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Default Tax Rate (%)</Label>
        <Input type="number" min="0" max="100" step="0.01" value={formData.defaultTaxRate} onChange={(e) => setFormData(prev => ({ ...prev, defaultTaxRate: parseFloat(e.target.value) || 0 }))} />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Tax Components</Label>
          <Button variant="outline" size="sm" onClick={addTaxComponent}>
            <Plus className="h-3 w-3 mr-1" />Add
          </Button>
        </div>
        <div className="space-y-2">
          {formData.taxComponents.map((tc) => (
            <div key={tc.id} className="flex items-center gap-2 p-2 border rounded-lg">
              <Input
                value={tc.name}
                onChange={(e) => updateTaxComponent(tc.id, 'name', e.target.value)}
                placeholder="Component name"
                className="flex-1"
              />
              <Input
                type="number"
                value={tc.rate}
                onChange={(e) => updateTaxComponent(tc.id, 'rate', parseFloat(e.target.value) || 0)}
                className="w-20"
              />
              <span className="text-sm text-muted-foreground">%</span>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 dark:text-red-400" onClick={() => removeTaxComponent(tc.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Service Charge (%)</Label>
          <Input type="number" min="0" max="100" step="0.01" value={formData.serviceChargePercent} onChange={(e) => setFormData(prev => ({ ...prev, serviceChargePercent: parseFloat(e.target.value) || 0 }))} />
        </div>
        <div className="flex items-center gap-2 pt-6">
          <Switch
            checked={formData.includeTaxInPrice}
            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, includeTaxInPrice: checked }))}
          />
          <Label className="font-normal">Include tax in displayed price</Label>
        </div>
      </div>
    </div>
  );
}

interface PropertyBrandingFormProps {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
}

function PropertyBrandingForm({ formData, setFormData }: PropertyBrandingFormProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Logo URL</Label>
        <Input value={formData.logo} onChange={(e) => setFormData(prev => ({ ...prev, logo: e.target.value }))} placeholder="https://..." />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Primary Color</Label>
          <div className="flex gap-2">
            <Input type="color" value={formData.primaryColor} onChange={(e) => setFormData(prev => ({ ...prev, primaryColor: e.target.value }))} className="w-12 h-9 p-1" />
            <Input value={formData.primaryColor} onChange={(e) => setFormData(prev => ({ ...prev, primaryColor: e.target.value }))} className="flex-1" />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Secondary Color</Label>
          <div className="flex gap-2">
            <Input type="color" value={formData.secondaryColor} onChange={(e) => setFormData(prev => ({ ...prev, secondaryColor: e.target.value }))} className="w-12 h-9 p-1" />
            <Input value={formData.secondaryColor} onChange={(e) => setFormData(prev => ({ ...prev, secondaryColor: e.target.value }))} className="flex-1" />
          </div>
        </div>
      </div>
      <div className="p-4 rounded-lg border">
        <p className="text-sm text-muted-foreground mb-2">Preview</p>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: formData.primaryColor }}>
            <Building2 className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="font-medium">{formData.name || 'Property Name'}</p>
            <p className="text-sm text-muted-foreground">{formData.city || 'City'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
